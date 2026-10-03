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
 * The device screens (the phone's and the notebook's) glow over everything round them, the device and the
 * world (R.36: drawn after the interface layers, so the device does not hide it): the screen's mean light
 * (worked out each frame) times a tight core and a wide halo falling off with the distance from the screen's
 * edge, their reach a share of the screen's height. SCREEN_REFL: how strongly the glass reflects the frame's
 * bright lights (mirrored, blurred: the glow), where the screen is dark.
 */
const CORE_K = 1.0, CORE_R = 0.06, HALO_K = 0.8, HALO_R = 0.4, SCREEN_REFL = 0.5;
/**
 * The screens' own bloom (R.36): their bright parts (the phone's big clock, white text) blurred over the
 * screen cells round them (SCR_RX x SCR_RY cells) and added over the screen, times SCR_K.
 */
const SCR_K = 0.9, SCR_RX = 4, SCR_RY = 3;

const CU = /* wgsl */ `
struct CU {
  cell: vec2i, origin: vec2i, grid: vec2i, uiCell: vec2i, uiOrigin: vec2i, uiGrid: vec2i,
  tmCell: vec2i, tmOrigin: vec2i, tmGrid: vec2i, ph0: vec2i, ph1: vec2i, tmShow: vec2i, g0: vec2i, g1: vec2i, g2: vec2i, g3: vec2i,
};
// the screens' rectangles in pixels: the phone's (ph0 to ph1, empty when off) and the notebook's layer
// (tmGrid is set while the notebook's screen is up, tmShow.x while its layer is shown: faced squarely);
// g0 to g3: the notebook glass's corners (top-left, top-right, bottom-right, bottom-left), faced or from
// aside, for its glow
fn inPhone(p: vec2i) -> bool { return all(p >= u.ph0) && all(p < u.ph1); }
fn inTerm(p: vec2i) -> bool { return u.tmShow.x > 0 && all(p >= u.tmOrigin) && all(p < u.tmOrigin + u.tmGrid * u.tmCell); }
// a screen cell's light: its paper, and a little of its glyph's color (a glyph covers part of the cell)
fn cellLight(cells: texture_2d<f32>, bg: texture_2d<f32>, c: vec2i) -> vec3f {
  let k = textureLoad(cells, c, 0); let b = textureLoad(bg, c, 0).rgb;
  let gi = i32(k.r * 255.0 + 0.5);
  return select(b, mix(b, k.gba, 0.3), gi > 32);
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
@group(0) @binding(11) var<storage, read> mean: array<vec4f>;
@group(0) @binding(12) var<storage, read> scr: array<vec4f>;
// a screen's bloom at pixel p: the cells' blur (from base, a grid of g cells of size cs at o), between
// cell centers, within the cells a to b
fn scrAt(p: vec2i, o: vec2i, cs: vec2i, base: u32, g: vec2i, a: vec2i, b: vec2i) -> vec3f {
  let f = (vec2f(p - o) + 0.5) / vec2f(cs) - 0.5; let i = vec2i(floor(f)); let t = fract(f);
  let i0 = clamp(i, a, b - 1); let i1 = clamp(i + 1, a, b - 1);
  let s00 = scr[base + u32(i0.y * g.x + i0.x)].rgb; let s10 = scr[base + u32(i0.y * g.x + i1.x)].rgb;
  let s01 = scr[base + u32(i1.y * g.x + i0.x)].rgb; let s11 = scr[base + u32(i1.y * g.x + i1.x)].rgb;
  return mix(mix(s00, s10, t.x), mix(s01, s11, t.x), t.y);
}

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
// a screen's glow: its mean light (m), by the signed distance d from its edge (a screen h px tall); inside
// it (a glass seen from aside, where nothing else covers it) the glow fades in from the edge
fn halo(d: f32, h: f32, m: vec3f) -> vec3f {
  if (d < 0.0) { return m * ${CORE_K + HALO_K} * exp(d / (${CORE_R / 2} * h)); }
  return m * (${CORE_K} * exp(-d / (${CORE_R} * h)) + ${HALO_K} * exp(-d / (${HALO_R} * h)));
}
// the signed distance from a convex quad's edge (corners in order), negative inside
fn sdQuad(p: vec2f, v0: vec2f, v1: vec2f, v2: vec2f, v3: vec2f) -> f32 {
  var v = array<vec2f, 4>(v0, v1, v2, v3);
  var d = 1e12; var inside = true;
  for (var i = 0; i < 4; i++) {
    let a = v[i]; let e = v[(i + 1) % 4] - a; let w = p - a;
    let b = w - e * clamp(dot(w, e) / max(dot(e, e), 1e-6), 0.0, 1.0);
    d = min(d, dot(b, b));
    if (e.x * w.y - e.y * w.x < 0.0) { inside = false; }
  }
  return select(sqrt(d), -sqrt(d), inside);
}
fn rgb(w: u32) -> vec3f { return vec3f(f32((w >> 8u) & 255u), f32((w >> 16u) & 255u), f32(w >> 24u)) / 255.0; }

@fragment fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let s = vec2i(pos.xy);
  var col = vec3f(0.0);
  let p = s - u.origin; let c = p / u.cell;
  if (p.x >= 0 && p.y >= 0 && c.x < u.grid.x && c.y < u.grid.y) {
    let i = u32(c.y * u.grid.x + c.x); let n = u32(u.grid.x * u.grid.y);
    let w = world[i]; let b = world[n + i];
    let bg = vec3f(f32(b & 255u), f32((b >> 8u) & 255u), f32((b >> 16u) & 255u)) / 255.0;
    col = mix(bg, rgb(w), glyphAt(atlas, i32(w & 255u), p, c, u.cell)) + glow[i].rgb * ${GLOW_K};
  }
  let q = s - u.uiOrigin; let uc = q / u.uiCell;
  if (q.x >= 0 && q.y >= 0 && uc.x < u.uiGrid.x && uc.y < u.uiGrid.y) {
    let hp = textureLoad(hd, (q * ${HD}) / u.uiCell, 0);
    if (hp.a > 0.25 && hp.a < 0.75) { col = hp.rgb; }
    let m = s - u.tmOrigin; let mc = m / max(u.tmCell, vec2i(1));
    // (like the interface: a cell nothing was drawn in is clear, one with a glyph only lies over what is under it)
    if (u.tmShow.x > 0 && m.x >= 0 && m.y >= 0 && mc.x < u.tmGrid.x && mc.y < u.tmGrid.y) {
      let tb = textureLoad(tmBg, mc, 0);
      if (tb.a > 0.25) { col = layer(tmCells, tmAtlas, m, mc, u.tmCell, select(col, tb.rgb, tb.a > 0.75)); }
    } else if (u.tmShow.x > 0 && m.x >= -u.uiCell.x && m.y >= -u.uiCell.y && m.x < u.tmGrid.x * u.tmCell.x + u.uiCell.x && m.y < u.tmGrid.y * u.tmCell.y + u.uiCell.y) {
      // within an interface cell round the layer: its nearest edge cell's paper (the screen's black edge)
      let tb = textureLoad(tmBg, clamp(m / max(u.tmCell, vec2i(1)), vec2i(0), u.tmGrid - 1), 0);
      if (tb.a > 0.75) { col = tb.rgb; }
    }
    let ub = textureLoad(uiBg, uc, 0);
    if (ub.a > 0.25) { col = layer(uiCells, uiAtlas, q, uc, u.uiCell, select(col, ub.rgb, ub.a > 0.75)); }
    if (hp.a > 0.75) { col = hp.rgb; }
  }
  if (inPhone(s)) {
    col += scrAt(s, u.uiOrigin, u.uiCell, 0u, u.uiGrid, (u.ph0 - u.uiOrigin) / u.uiCell, (u.ph1 - u.uiOrigin) / u.uiCell) * ${SCR_K};
  } else if (inTerm(s)) {
    col += scrAt(s, u.tmOrigin, u.tmCell, u32(u.uiGrid.x * u.uiGrid.y), u.tmGrid, vec2i(0), u.tmGrid) * ${SCR_K};
  }
  if (inPhone(s) || inTerm(s)) {
    // the screen's glass: the frame's bright lights mirrored on it, blurred (the world's glow only, in .a),
    // seen where the screen is dark
    let mx = clamp(u.grid.x - 1 - c.x, 0, u.grid.x - 1); let my = clamp(c.y, 0, u.grid.y - 1);
    let r = glow[u32(my * u.grid.x + mx)].a; let l = dot(col, vec3f(0.3, 0.5, 0.2));
    col += vec3f(0.85, 0.9, 1.0) * r * ${SCREEN_REFL} * max(0.0, 1.0 - l * 2.5);
  } else {
    // round the screens: their glow, over the device and the world alike
    let f = vec2f(s) + 0.5;
    if (u.ph1.x > u.ph0.x) {
      let q = abs(f - vec2f(u.ph0 + u.ph1) * 0.5) - vec2f(u.ph1 - u.ph0) * 0.5;
      col += halo(length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0), f32(u.ph1.y - u.ph0.y), mean[0].rgb);
    }
    if (u.tmGrid.x > 0) {
      let a = vec2f(u.g0); let b = vec2f(u.g1); let c = vec2f(u.g2); let e = vec2f(u.g3);
      // its height: the mean of its two sides (the near one is taller from aside)
      col += halo(sdQuad(f, a, b, c, e), 0.5 * (length(e - a) + length(c - b)), mean[1].rgb);
    }
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
struct GU { cols: u32, rows: u32, dir: u32, pad: u32 };
@group(0) @binding(0) var<uniform> g: GU;
@group(0) @binding(1) var<storage, read> world: array<u32>;
@group(0) @binding(2) var<storage, read_write> tmp: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> glow: array<vec4f>;
// what glows at world cell (x, y), and in .a its brightness, which the screens reflect
fn src(x: i32, y: i32) -> vec4f {
  let i = u32(y) * g.cols + u32(x); let w = world[i]; let a = f32(world[g.cols * g.rows + i] >> 24u) / 255.0;
  let wc = vec3f(f32((w >> 8u) & 255u), f32((w >> 16u) & 255u), f32(w >> 24u)) / 255.0 * a;
  return vec4f(wc, dot(wc, vec3f(0.3, 0.5, 0.2)));
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
/**
 * The sun's rays (B.2): from every cell, RAY_N looks along the line to the sun on the screen, summing the bright
 * sky near the sun they cross (what blocks it, a building's dark edge, leaves a gap: the shafts), added to glow.
 */
const RAY_N = 32;
const RAYS_WGSL = /* wgsl */ `
struct RU { cols: f32, rows: f32, aspect: f32, k: f32, sx: f32, sy: f32, pad0: f32, pad1: f32 };
@group(0) @binding(0) var<uniform> r: RU;
@group(0) @binding(1) var<storage, read> world: array<u32>;
@group(0) @binding(2) var<storage, read_write> glow: array<vec4f>;
// the sky's light at a cell, if it is bright and near the sun (in screen heights)
fn lit(x: i32, y: i32) -> vec3f {
  let n = u32(r.cols) * u32(r.rows); let w = world[n + u32(y) * u32(r.cols) + u32(x)];
  let c = vec3f(f32(w & 255u), f32((w >> 8u) & 255u), f32((w >> 16u) & 255u)) / 255.0;
  let d = length(vec2f((f32(x) - r.sx) / r.cols * r.aspect, (f32(y) - r.sy) / r.rows));
  return c * smoothstep(0.35, 0.8, dot(c, vec3f(0.3, 0.5, 0.2))) * exp(-d / 0.22);
}
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let cols = u32(r.cols); let rows = u32(r.rows);
  if (id.x >= cols || id.y >= rows) { return; }
  let p = vec2f(f32(id.x), f32(id.y)); let to = vec2f(r.sx, r.sy) - p;
  // from a fixed offset per cell along the line (no bands)
  let j = fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y)); // interleaved gradient: finer grain
  var s = vec3f(0.0); var wt = 1.0; var ws = 0.0;
  for (var k = 0; k < ${RAY_N}; k++) {
    ws += wt;
    let q = p + to * ((f32(k) + j) / f32(${RAY_N}));
    let qx = i32(q.x); let qy = i32(q.y);
    if (qx >= 0 && qy >= 0 && qx < i32(cols) && qy < i32(rows)) { s += lit(qx, qy) * wt; }
    wt *= 0.96;
  }
  let i = id.y * cols + id.x;
  // the mean along the line (so an open sky only brightens a little), capped: the shafts are the contrast
  let ray = min(s * (r.k * 1.0 / ws), vec3f(0.2));
  glow[i] = vec4f(glow[i].rgb + ray, glow[i].a);
}
`;
/** Each screen's mean light (the phone's in mean[0], the notebook's in mean[1]): one workgroup a screen. */
const MEAN_WGSL = /* wgsl */ `
${CU}
@group(0) @binding(0) var<uniform> u: CU;
@group(0) @binding(1) var uiCells: texture_2d<f32>;
@group(0) @binding(2) var uiBg: texture_2d<f32>;
@group(0) @binding(3) var tmCells: texture_2d<f32>;
@group(0) @binding(4) var tmBg: texture_2d<f32>;
@group(0) @binding(5) var<storage, read_write> mean: array<vec4f>;
var<workgroup> part: array<vec3f, 64>;
@compute @workgroup_size(64) fn main(@builtin(workgroup_id) wg: vec3u, @builtin(local_invocation_index) t: u32) {
  var a = vec2i(0); var b = vec2i(0);
  if (wg.x == 0u) { a = (u.ph0 - u.uiOrigin) / u.uiCell; b = (u.ph1 - u.uiOrigin) / u.uiCell; }
  else if (u.tmGrid.x > 0) { b = u.tmGrid; }
  let n = max(b - a, vec2i(0)); var s = vec3f(0.0);
  for (var k = i32(t); k < n.x * n.y; k += 64) {
    let c = a + vec2i(k % n.x, k / n.x);
    s += select(cellLight(tmCells, tmBg, c), cellLight(uiCells, uiBg, c), wg.x == 0u);
  }
  part[t] = s;
  workgroupBarrier();
  if (t == 0u) {
    var m = vec3f(0.0);
    for (var k = 0u; k < 64u; k++) { m += part[k]; }
    mean[wg.x] = vec4f(m / f32(max(n.x * n.y, 1)), 0.0);
  }
}
`;
/** The screens' bright cells blurred (scr: the phone's over the interface's grid, then the notebook's). */
const SCR_WGSL = /* wgsl */ `
${CU}
@group(0) @binding(0) var<uniform> u: CU;
@group(0) @binding(1) var uiCells: texture_2d<f32>;
@group(0) @binding(2) var uiBg: texture_2d<f32>;
@group(0) @binding(3) var tmCells: texture_2d<f32>;
@group(0) @binding(4) var tmBg: texture_2d<f32>;
@group(0) @binding(5) var<storage, read_write> scr: array<vec4f>;
fn bright(c: vec3f) -> vec3f { return c * smoothstep(0.3, 0.85, dot(c, vec3f(0.3, 0.5, 0.2))); }
@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {
  let c = vec2i(id.xy); let phone = id.z == 0u;
  var a = vec2i(0); var b = u.tmGrid;
  if (phone) { a = (u.ph0 - u.uiOrigin) / u.uiCell; b = (u.ph1 - u.uiOrigin) / u.uiCell; }
  if (any(c < a) || any(c >= b)) { return; }
  var s = vec3f(0.0); var ws = 0.0;
  for (var dy = -${SCR_RY}; dy <= ${SCR_RY}; dy++) {
    for (var dx = -${SCR_RX}; dx <= ${SCR_RX}; dx++) {
      let w = exp(-f32(dx * dx) / ${(SCR_RX * SCR_RX) / 2.5} - f32(dy * dy) / ${(SCR_RY * SCR_RY) / 2.5}); ws += w;
      let q = c + vec2i(dx, dy);
      if (all(q >= a) && all(q < b)) {
        s += bright(select(cellLight(tmCells, tmBg, q), cellLight(uiCells, uiBg, q), phone)) * w;
      }
    }
  }
  let i = select(u32(u.uiGrid.x * u.uiGrid.y) + u32(c.y * u.tmGrid.x + c.x), u32(c.y * u.uiGrid.x + c.x), phone);
  scr[i] = vec4f(s / ws, 0.0);
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
  private U = new Int32Array(32);
  private t: Record<'atlas' | 'uiCells' | 'uiBg' | 'uiAtlas' | 'hd' | 'tmCells' | 'tmBg' | 'tmAtlas', GPUTexture>;
  private bind: GPUBindGroup | null = null;
  private ui: Layout | null = null;
  private tm = { cols: 1, rows: 1 };
  private outFor: GPUBuffer | null = null;
  private glowPipe: GPUComputePipeline;
  private glowUni: GPUBuffer[];
  private glowBuf: { tmp: GPUBuffer; glow: GPUBuffer; n: number } | null = null;
  private glowBind: GPUBindGroup[] = [];
  private meanPipe: GPUComputePipeline;
  private meanBuf: GPUBuffer;
  private meanBind: GPUBindGroup | null = null;
  private scrPipe: GPUComputePipeline;
  private scrBuf: GPUBuffer | null = null;
  private scrBind: GPUBindGroup | null = null;
  private timing = false;
  private rayPipe: GPUComputePipeline;
  private rayUni: GPUBuffer;
  private rayBind: GPUBindGroup | null = null;
  private RU = new Float32Array(8);

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
    const mm = dev.createShaderModule({ code: MEAN_WGSL });
    mm.getCompilationInfo().then((info) => info.messages.forEach((m) => console[m.type === 'error' ? 'error' : 'warn'](`WGSL mean ${m.lineNum}:${m.linePos} ${m.message}`)));
    this.meanPipe = dev.createComputePipeline({ layout: 'auto', compute: { module: mm, entryPoint: 'main' } });
    this.meanBuf = dev.createBuffer({ size: 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const sm = dev.createShaderModule({ code: SCR_WGSL });
    sm.getCompilationInfo().then((info) => info.messages.forEach((m) => console[m.type === 'error' ? 'error' : 'warn'](`WGSL scr ${m.lineNum}:${m.linePos} ${m.message}`)));
    this.scrPipe = dev.createComputePipeline({ layout: 'auto', compute: { module: sm, entryPoint: 'main' } });
    this.glowUni = [0, 1].map(() => dev.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
    const rm = dev.createShaderModule({ code: RAYS_WGSL });
    rm.getCompilationInfo().then((info) => info.messages.forEach((m) => console[m.type === 'error' ? 'error' : 'warn'](`WGSL rays ${m.lineNum}:${m.linePos} ${m.message}`)));
    this.rayPipe = dev.createComputePipeline({ layout: 'auto', compute: { module: rm, entryPoint: 'main' } });
    this.rayUni = dev.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
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

  /**
   * This frame: the world drawn on the GPU (from `world` and `v`), then every layer over it, in one submit.
   * term: the notebook's screen while it is up (its layer shown at x, y when `show`; `glass`, its glass's
   * corners in pixels, x, y from the top-left clockwise, for its glow); phone: the phone's screen, in
   * interface cells.
   */
  draw(world: World, v: View, ui: CharGrid, hd: HdLayer, term: { grid: CharGrid; x: number; y: number; show: boolean; glass: readonly number[] } | null = null, phone: readonly number[] | null = null) {
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
      this.U[22] = term.show ? 1 : 0;
      this.U.set(term.glass.map(Math.round), 24);
      this.up(this.t.tmCells, term.grid.cells, this.tm.cols, this.tm.rows);
      this.up(this.t.tmBg, term.grid.bg, this.tm.cols, this.tm.rows);
    } else { this.U[16] = 0; this.U[17] = 0; this.U[22] = 0; }
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
        return this.dev.createBindGroup({ layout: this.glowPipe.getBindGroupLayout(0), entries:
          [b, gw.out, G.tmp, G.glow].map((buffer, binding) => ({ binding, resource: { buffer } })) });
      });
      this.rayBind = this.dev.createBindGroup({ layout: this.rayPipe.getBindGroupLayout(0), entries:
        [this.rayUni, gw.out, G.glow].map((buffer, binding) => ({ binding, resource: { buffer } })) });
      this.scrBuf?.destroy();
      this.scrBuf = this.dev.createBuffer({ size: (L.cols * L.rows + this.tm.cols * this.tm.rows) * 16, usage: GPUBufferUsage.STORAGE });
      this.scrBind = this.dev.createBindGroup({ layout: this.scrPipe.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: this.uni } },
        ...[T.uiCells, T.uiBg, T.tmCells, T.tmBg].map((t, k) => ({ binding: k + 1, resource: t.createView() })),
        { binding: 5, resource: { buffer: this.scrBuf } }] });
      this.meanBind = this.dev.createBindGroup({ layout: this.meanPipe.getBindGroupLayout(0), entries: [
        { binding: 0, resource: { buffer: this.uni } },
        ...[T.uiCells, T.uiBg, T.tmCells, T.tmBg].map((t, k) => ({ binding: k + 1, resource: t.createView() })),
        { binding: 5, resource: { buffer: this.meanBuf } }] });
      this.bind = this.dev.createBindGroup({
        layout: this.pipe.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.uni } }, { binding: 1, resource: { buffer: gw.out } },
          ...[T.atlas, T.uiCells, T.uiBg, T.uiAtlas, T.hd, T.tmCells, T.tmBg, T.tmAtlas].map((t, k) => ({ binding: k + 2, resource: t.createView() })),
          { binding: 10, resource: { buffer: G.glow } }, { binding: 11, resource: { buffer: this.meanBuf } },
          { binding: 12, resource: { buffer: this.scrBuf } }],
      });
    }
    const enc = this.dev.createCommandEncoder();
    gw.encode(enc, world, v, true);
    for (const b of this.glowBind) {
      const cp = enc.beginComputePass();
      cp.setPipeline(this.glowPipe); cp.setBindGroup(0, b); cp.dispatchWorkgroups(Math.ceil(gw.cols / 8), Math.ceil(gw.rows / 8));
      cp.end();
    }
    // the sun's rays over the glow, when the sun is up and near enough the screen to show
    const S = gw.sunScreen;
    if (S[2] > 0) {
      const cv = this.ctx.canvas as HTMLCanvasElement;
      this.RU.set([gw.cols, gw.rows, cv.width / Math.max(1, cv.height), S[2], S[0], S[1], 0, 0]);
      this.dev.queue.writeBuffer(this.rayUni, 0, this.RU);
      const rp = enc.beginComputePass();
      rp.setPipeline(this.rayPipe); rp.setBindGroup(0, this.rayBind!); rp.dispatchWorkgroups(Math.ceil(gw.cols / 8), Math.ceil(gw.rows / 8));
      rp.end();
    }
    const mp = enc.beginComputePass();
    mp.setPipeline(this.meanPipe); mp.setBindGroup(0, this.meanBind!); mp.dispatchWorkgroups(2);
    mp.setPipeline(this.scrPipe); mp.setBindGroup(0, this.scrBind!);
    mp.dispatchWorkgroups(Math.ceil(Math.max(L.cols, this.tm.cols) / 8), Math.ceil(Math.max(L.rows, this.tm.rows) / 8), 2);
    mp.end();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: this.ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
    pass.setPipeline(this.pipe); pass.setBindGroup(0, this.bind); pass.draw(3);
    pass.end();
    this.dev.queue.submit([enc.finish()]);
    gw.readTime();
    // how long the GPU takes: one frame measured at a time
    if (!this.timing) {
      this.timing = true;
      const t0 = performance.now();
      this.dev.queue.onSubmittedWorkDone().then(() => { this.ms += (performance.now() - t0 - this.ms) * 0.2; this.timing = false; });
    }
  }
}
