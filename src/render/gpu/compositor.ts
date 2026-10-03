import { ATLAS_COLS, buildAtlas } from '../atlas';
import type { CharGrid } from '../grid';
import type { Layout } from '../glRenderer';
import { HD, type HdLayer } from '../hd';
import type { World } from '../../sim/world';
import type { View } from '../raycaster';
import type { GpuWorld } from './world';

/**
 * Stage R.3: the compositor of glRenderer.ts on WebGPU, on a canvas of its own laid over the WebGL one.
 * The same layers in the same order (the world, the HD pixels, the notebook's screen, the interface),
 * but the world's cells are read straight from the buffer the world's compute pass wrote in the same
 * submit: drawn and shown in one frame, never copied back to the CPU. The interface's layers still
 * come up from the CPU each frame, as they do for WebGL.
 */

/** How much of the blurred glow is added over the world. */
const GLOW_K = 1.4;
/**
 * The device screens (the phone's and the notebook's) in the bloom: how much of a screen cell's light glows,
 * how much of that glow spills over the device around the screen (within SPILL px), and how strongly the
 * glass reflects the frame's bright lights (mirrored, blurred: the glow), where the screen is dark.
 */
const SCREEN_GLOW = 0.55, SPILL_K = 0.7, SPILL = 48, SCREEN_REFL = 0.5;

const CU = /* wgsl */ `
struct CU {
  cell: vec2i, origin: vec2i, grid: vec2i, uiCell: vec2i, uiOrigin: vec2i, uiGrid: vec2i,
  tmCell: vec2i, tmOrigin: vec2i, tmGrid: vec2i, ph0: vec2i, ph1: vec2i, pad: vec2i,
};
// the screens' rectangles in pixels: the phone's (ph0 to ph1, empty when off) and the notebook's
fn inPhone(p: vec2i) -> bool { return all(p >= u.ph0) && all(p < u.ph1); }
fn inTerm(p: vec2i) -> bool { return u.tmGrid.x > 0 && all(p >= u.tmOrigin) && all(p < u.tmOrigin + u.tmGrid * u.tmCell); }
fn nearScreen(p: vec2i) -> bool {
  let s = vec2i(${SPILL});
  return (u.ph1.x > u.ph0.x && all(p >= u.ph0 - s) && all(p < u.ph1 + s))
    || (u.tmGrid.x > 0 && all(p >= u.tmOrigin - s) && all(p < u.tmOrigin + u.tmGrid * u.tmCell + s));
}
`;

const WGSL = /* wgsl */ `
${CU}
@group(0) @binding(0) var<uniform> u: CU;
@group(0) @binding(1) var<storage, read> world: array<u32>;
@group(0) @binding(2) var atlas: texture_2d<f32>;
@group(0) @binding(3) var uiCells: texture_2d<f32>;
@group(0) @binding(4) var uiBg: texture_2d<f32>;
@group(0) @binding(5) var uiAtlas: texture_2d<f32>;
@group(0) @binding(6) var hd: texture_2d<f32>;
@group(0) @binding(7) var tmCells: texture_2d<f32>;
@group(0) @binding(8) var tmBg: texture_2d<f32>;
@group(0) @binding(9) var tmAtlas: texture_2d<f32>;
@group(0) @binding(10) var<storage, read> glow: array<vec4f>;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  // one triangle covering the whole screen
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

fn glyphAt(at: texture_2d<f32>, glyph: i32, p: vec2i, c: vec2i, size: vec2i) -> f32 {
  let a = vec2i(glyph % ${ATLAS_COLS}, glyph / ${ATLAS_COLS}) * size + (p - c * size);
  return textureLoad(at, a, 0).r;
}
fn layer(cells: texture_2d<f32>, at: texture_2d<f32>, p: vec2i, c: vec2i, size: vec2i, bg: vec3f) -> vec3f {
  let cell = textureLoad(cells, c, 0);
  return mix(bg, cell.gba, glyphAt(at, i32(cell.r * 255.0 + 0.5), p, c, size));
}
fn rgb(w: u32) -> vec3f { return vec3f(f32((w >> 8u) & 255u), f32((w >> 16u) & 255u), f32(w >> 24u)) / 255.0; }

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let s = vec2i(pos.xy);
  var col = vec3f(0.0); var gl = vec4f(0.0);
  let p = s - u.origin; let c = p / u.cell;
  if (p.x >= 0 && p.y >= 0 && c.x < u.grid.x && c.y < u.grid.y) {
    let i = u32(c.y * u.grid.x + c.x); let n = u32(u.grid.x * u.grid.y);
    let w = world[i]; let b = world[n + i];
    let bg = vec3f(f32(b & 255u), f32((b >> 8u) & 255u), f32((b >> 16u) & 255u)) / 255.0;
    gl = glow[i];
    col = mix(bg, rgb(w), glyphAt(atlas, i32(w & 255u), p, c, u.cell)) + gl.rgb * ${GLOW_K};
  }
  var over = false;
  let q = s - u.uiOrigin; let uc = q / u.uiCell;
  if (q.x >= 0 && q.y >= 0 && uc.x < u.uiGrid.x && uc.y < u.uiGrid.y) {
    let hp = textureLoad(hd, (q * ${HD}) / u.uiCell, 0);
    if (hp.a > 0.25 && hp.a < 0.75) { col = hp.rgb; over = true; }
    let m = s - u.tmOrigin; let mc = m / max(u.tmCell, vec2i(1));
    // (like the interface: a cell nothing was drawn in is clear, one with a glyph only lies over what is under it)
    if (u.tmGrid.x > 0 && m.x >= 0 && m.y >= 0 && mc.x < u.tmGrid.x && mc.y < u.tmGrid.y) {
      let tb = textureLoad(tmBg, mc, 0);
      if (tb.a > 0.25) { col = layer(tmCells, tmAtlas, m, mc, u.tmCell, select(col, tb.rgb, tb.a > 0.75)); over = true; }
    } else if (u.tmGrid.x > 0 && m.x >= -u.uiCell.x && m.y >= -u.uiCell.y && m.x < u.tmGrid.x * u.tmCell.x + u.uiCell.x && m.y < u.tmGrid.y * u.tmCell.y + u.uiCell.y) {
      // within an interface cell round the layer: its nearest edge cell's paper (the screen's black edge)
      let tb = textureLoad(tmBg, clamp(m / max(u.tmCell, vec2i(1)), vec2i(0), u.tmGrid - 1), 0);
      if (tb.a > 0.75) { col = tb.rgb; over = true; }
    }
    let ub = textureLoad(uiBg, uc, 0);
    if (ub.a > 0.25) { col = layer(uiCells, uiAtlas, q, uc, u.uiCell, select(col, ub.rgb, ub.a > 0.75)); over = true; }
    if (hp.a > 0.75) { col = hp.rgb; over = true; }
  }
  if (inPhone(s) || inTerm(s)) {
    // the screen's glass: the frame's bright lights mirrored on it, blurred (the world's glow only, in .a),
    // seen where the screen is dark
    let mx = clamp(u.grid.x - 1 - c.x, 0, u.grid.x - 1); let my = clamp(c.y, 0, u.grid.y - 1);
    let r = glow[u32(my * u.grid.x + mx)].a; let l = dot(col, vec3f(0.3, 0.5, 0.2));
    col += vec3f(0.85, 0.9, 1.0) * r * ${SCREEN_REFL} * max(0.0, 1.0 - l * 2.5);
  } else if (over && nearScreen(s)) {
    // the device around a screen: the glow spills over it (the screen's own, and the city's)
    col += gl.rgb * ${GLOW_K * SPILL_K};
  }
  return vec4f(col, 1.0);
}
`;

/**
 * The bloom (R.21): what glows (the background's alpha the world pass wrote, times the cell's color) blurred
 * over the cells around it, across then down (a cell is about twice as tall as wide), into glow, which the
 * compositor adds over the world.
 */
const GLOW_RX = 14, GLOW_RY = 7;
const GLOW_WGSL = /* wgsl */ `
${CU}
struct GU { cols: u32, rows: u32, dir: u32, pad: u32 };
@group(0) @binding(0) var<uniform> g: GU;
@group(0) @binding(1) var<storage, read> world: array<u32>;
@group(0) @binding(2) var<storage, read_write> tmp: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> glow: array<vec4f>;
@group(0) @binding(4) var<uniform> u: CU;
@group(0) @binding(5) var uiCells: texture_2d<f32>;
@group(0) @binding(6) var uiBg: texture_2d<f32>;
@group(0) @binding(7) var tmCells: texture_2d<f32>;
@group(0) @binding(8) var tmBg: texture_2d<f32>;
// a screen cell's light: its paper, and a little of its glyph's color (a glyph covers part of the cell)
fn cellLight(cells: texture_2d<f32>, bg: texture_2d<f32>, c: vec2i) -> vec3f {
  let k = textureLoad(cells, c, 0); let b = textureLoad(bg, c, 0).rgb;
  let gi = i32(k.r * 255.0 + 0.5);
  return select(b, mix(b, k.gba, 0.3), gi > 32);
}
// what glows at world cell (x, y): rgb with the screens, and in .a the world's alone (its brightness),
// which the screens reflect
fn src(x: i32, y: i32) -> vec4f {
  let i = u32(y) * g.cols + u32(x); let w = world[i]; let a = f32(world[g.cols * g.rows + i] >> 24u) / 255.0;
  let wc = vec3f(f32((w >> 8u) & 255u), f32((w >> 16u) & 255u), f32(w >> 24u)) / 255.0 * a;
  var s = wc;
  let p = u.origin + vec2i(x, y) * u.cell + u.cell / 2;
  if (inPhone(p)) { s = cellLight(uiCells, uiBg, (p - u.uiOrigin) / u.uiCell) * ${SCREEN_GLOW}; }
  else if (inTerm(p)) { s = cellLight(tmCells, tmBg, (p - u.tmOrigin) / max(u.tmCell, vec2i(1))) * ${SCREEN_GLOW}; }
  return vec4f(s, dot(wc, vec3f(0.3, 0.5, 0.2)));
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= g.cols || id.y >= g.rows) { return; }
  let x = i32(id.x); let y = i32(id.y); var s = vec4f(0.0); var ws = 0.0;
  if (g.dir == 0u) {
    for (var d = -${GLOW_RX}; d <= ${GLOW_RX}; d++) {
      let w = exp(-f32(d * d) / ${(GLOW_RX * GLOW_RX) / 4.5}); ws += w;
      let xx = x + d; if (xx >= 0 && xx < i32(g.cols)) { s += src(xx, y) * w; }
    }
    tmp[u32(y) * g.cols + u32(x)] = s / ws;
  } else {
    for (var d = -${GLOW_RY}; d <= ${GLOW_RY}; d++) {
      let w = exp(-f32(d * d) / ${(GLOW_RY * GLOW_RY) / 4.5}); ws += w;
      let yy = y + d; if (yy >= 0 && yy < i32(g.rows)) { s += tmp[u32(yy) * g.cols + u32(x)] * w; }
    }
    glow[u32(y) * g.cols + u32(x)] = s / ws;
  }
}
`;
const TEX = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST;

export class GpuCompositor {
  /** Time from submitting a frame to the GPU finishing it (ms), smoothed. */
  ms = 0;
  private dev: GPUDevice;
  private ctx: GPUCanvasContext;
  private pipe: GPURenderPipeline;
  private uni: GPUBuffer;
  private U = new Int32Array(24);
  private t: Record<'atlas' | 'uiCells' | 'uiBg' | 'uiAtlas' | 'hd' | 'tmCells' | 'tmBg' | 'tmAtlas', GPUTexture>;
  private bind: GPUBindGroup | null = null;
  private ui: Layout | null = null;
  private tm = { cols: 1, rows: 1 };
  private outFor: GPUBuffer | null = null;
  private glowPipe: GPUComputePipeline;
  private glowUni: GPUBuffer[];
  private glowBuf: { tmp: GPUBuffer; glow: GPUBuffer; n: number } | null = null;
  private glowBind: GPUBindGroup[] = [];
  private timing = false;

  constructor(private gw: GpuWorld, canvas: HTMLCanvasElement) {
    const dev = (this.dev = gw.dev);
    this.ctx = canvas.getContext('webgpu')!;
    const format = navigator.gpu.getPreferredCanvasFormat();
    this.ctx.configure({ device: dev, format, alphaMode: 'opaque' });
    const mod = dev.createShaderModule({ code: WGSL });
    mod.getCompilationInfo().then((info) => info.messages.forEach((m) => console[m.type === 'error' ? 'error' : 'warn'](`WGSL ${m.lineNum}:${m.linePos} ${m.message}`)));
    this.pipe = dev.createRenderPipeline({ layout: 'auto', vertex: { module: mod, entryPoint: 'vs' }, fragment: { module: mod, entryPoint: 'fs', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    this.uni = dev.createBuffer({ size: this.U.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const gm = dev.createShaderModule({ code: GLOW_WGSL });
    gm.getCompilationInfo().then((info) => info.messages.forEach((m) => console[m.type === 'error' ? 'error' : 'warn'](`WGSL glow ${m.lineNum}:${m.linePos} ${m.message}`)));
    this.glowPipe = dev.createComputePipeline({ layout: 'auto', compute: { module: gm, entryPoint: 'main' } });
    this.glowUni = [0, 1].map(() => dev.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
    const one = () => this.tex(1, 1);
    this.t = { atlas: one(), uiCells: one(), uiBg: one(), uiAtlas: one(), hd: one(), tmCells: one(), tmBg: one(), tmAtlas: one() };
  }

  private tex(w: number, h: number, usage = TEX): GPUTexture {
    return this.dev.createTexture({ size: [w, h], format: 'rgba8unorm', usage });
  }
  private atlasTex(cellW: number, cellH: number): GPUTexture {
    const cv = buildAtlas(cellW, cellH), t = this.tex(cv.width, cv.height, TEX | GPUTextureUsage.RENDER_ATTACHMENT);
    this.dev.queue.copyExternalImageToTexture({ source: cv }, { texture: t }, [cv.width, cv.height]);
    return t;
  }
  private set(k: keyof GpuCompositor['t'], t: GPUTexture) { this.t[k].destroy(); this.t[k] = t; this.bind = null; }

  /** The same as GlyphRenderer.setLayout: the world's grid and atlas, the interface's, the HD layer. */
  setLayout(l: Layout, ui: Layout) {
    this.ui = ui;
    this.U.set([l.cellW, l.cellH, l.originX, l.originY, l.cols, l.rows, ui.cellW, ui.cellH, ui.originX, ui.originY, ui.cols, ui.rows], 0);
    this.set('atlas', this.atlasTex(l.cellW, l.cellH));
    this.set('uiAtlas', this.atlasTex(ui.cellW, ui.cellH));
    this.set('uiCells', this.tex(ui.cols, ui.rows));
    this.set('uiBg', this.tex(ui.cols, ui.rows));
    this.set('hd', this.tex(ui.cols * HD, ui.rows * HD));
    this.hdAll = true;
  }
  private hdAll = true;

  /** The same as GlyphRenderer.setTerm: the notebook screen's layer. */
  setTerm(cols: number, rows: number, cellW: number, cellH: number) {
    this.tm = { cols, rows };
    this.U[12] = cellW; this.U[13] = cellH;
    this.set('tmCells', this.tex(cols, rows));
    this.set('tmBg', this.tex(cols, rows));
    this.set('tmAtlas', this.atlasTex(cellW, cellH));
  }

  private up(t: GPUTexture, data: Uint8ClampedArray, w: number, h: number, y0 = 0) {
    this.dev.queue.writeTexture({ texture: t, origin: [0, y0] }, data, { bytesPerRow: w * 4 }, [w, h]);
  }

  /** This frame: the world drawn on the GPU (from `world` and `v`), then every layer over it, in one submit. */
  draw(world: World, v: View, ui: CharGrid, hd: HdLayer, term: { grid: CharGrid; x: number; y: number } | null = null, phone: readonly number[] | null = null) {
    const L = this.ui!, gw = this.gw;
    this.up(this.t.uiCells, ui.cells, L.cols, L.rows);
    this.up(this.t.uiBg, ui.bg, L.cols, L.rows);
    // the HD layer: only the rows drawn or cleared since the last upload (all of it after a resize)
    hd.mark();
    if (this.hdAll) { this.up(this.t.hd, hd.px, hd.w, hd.h); this.hdAll = false; hd.lo = Infinity; hd.hi = -1; }
    else if (hd.hi >= hd.lo) {
      const y0 = Math.max(0, hd.lo), y1 = Math.min(hd.h - 1, hd.hi);
      this.up(this.t.hd, hd.px.subarray(y0 * hd.w * 4, (y1 + 1) * hd.w * 4), hd.w, y1 - y0 + 1, y0);
      hd.lo = Infinity; hd.hi = -1;
    }
    if (term) {
      this.U.set([Math.round(term.x), Math.round(term.y), this.tm.cols, this.tm.rows], 14);
      this.up(this.t.tmCells, term.grid.cells, this.tm.cols, this.tm.rows);
      this.up(this.t.tmBg, term.grid.bg, this.tm.cols, this.tm.rows);
    } else { this.U[16] = 0; this.U[17] = 0; }
    // the phone's screen (in interface cells) in pixels
    if (phone) {
      const x0 = L.originX + phone[0] * L.cellW, y0 = L.originY + phone[1] * L.cellH;
      this.U.set([x0, y0, x0 + phone[2] * L.cellW, y0 + phone[3] * L.cellH], 18);
    } else this.U.fill(0, 18, 22);
    this.dev.queue.writeBuffer(this.uni, 0, this.U);
    const n = gw.cols * gw.rows;
    if (!this.glowBuf || this.glowBuf.n !== n) {
      this.glowBuf?.tmp.destroy(); this.glowBuf?.glow.destroy();
      const mk = () => this.dev.createBuffer({ size: Math.max(16, n * 16), usage: GPUBufferUsage.STORAGE });
      this.glowBuf = { tmp: mk(), glow: mk(), n };
      this.bind = null;
    }
    if (!this.bind || this.outFor !== gw.out) {
      this.outFor = gw.out;
      const T = this.t, G = this.glowBuf;
      this.glowBind = this.glowUni.map((b, k) => {
        this.dev.queue.writeBuffer(b, 0, new Uint32Array([gw.cols, gw.rows, k, 0]));
        return this.dev.createBindGroup({ layout: this.glowPipe.getBindGroupLayout(0), entries: [
          ...[b, gw.out, G.tmp, G.glow, this.uni].map((buffer, binding) => ({ binding, resource: { buffer } })),
          ...[T.uiCells, T.uiBg, T.tmCells, T.tmBg].map((t, k) => ({ binding: k + 5, resource: t.createView() }))] });
      });
      this.bind = this.dev.createBindGroup({
        layout: this.pipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.uni } }, { binding: 1, resource: { buffer: gw.out } },
          ...[T.atlas, T.uiCells, T.uiBg, T.uiAtlas, T.hd, T.tmCells, T.tmBg, T.tmAtlas].map((t, k) => ({ binding: k + 2, resource: t.createView() })),
          { binding: 10, resource: { buffer: G.glow } }],
      });
    }
    const enc = this.dev.createCommandEncoder();
    gw.encode(enc, world, v);
    for (const b of this.glowBind) {
      const cp = enc.beginComputePass();
      cp.setPipeline(this.glowPipe); cp.setBindGroup(0, b); cp.dispatchWorkgroups(Math.ceil(gw.cols / 8), Math.ceil(gw.rows / 8));
      cp.end();
    }
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
    pass.setPipeline(this.pipe); pass.setBindGroup(0, this.bind); pass.draw(3);
    pass.end();
    this.dev.queue.submit([enc.finish()]);
    // how long the GPU takes: one frame measured at a time
    if (!this.timing) {
      this.timing = true;
      const t0 = performance.now();
      this.dev.queue.onSubmittedWorkDone().then(() => { this.ms += (performance.now() - t0 - this.ms) * 0.2; this.timing = false; });
    }
  }
}
