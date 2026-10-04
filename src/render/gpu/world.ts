import { BAY, blockAt, faceSpan, SIDEWALK, type City } from '../../sim/city';
import { cachedPlan, escapesOf, exitsOf, floorsOf, habitable, liftGlassBox, planOf, tiersOf, type Plan } from '../../sim/interior';
import { diagRoad } from '../../sim/traffic';
import type { World } from '../../sim/world';
import { gpuInside, gpuObjects, gpuPrepare, REL, reliefOf, roofs, VFOV, VIEW_GLINT, VIEW_LIGHT, type View } from '../raycaster';
import { CharGrid } from '../grid';
import { insideLamps, type Inside } from '../interior';
import { furnitureModel } from '../models';
import type { Obj, Part } from '../objects';
import { OW, PW, TILE } from './objects';
/** By day, how much wider the objects are gathered than the view (their shadows reach in from the sides), and how near an off-screen one must be to cast (m). */
const SHADOW_CONE = 1.6, SHADOW_CASTERS = 150;
/** By day, how near an object behind the viewer must be to still cast its shadow forward (m; SG_LONG). */
const SHADOW_BACK = 60;
/** Objects within FLOOD_REACH m of a floodlit facade nearer than FLOOD_SHADOW_FAR cast its lamps' shadows on it (at most FLOOD_CASTERS). */
const FLOOD_REACH = 3, FLOOD_SHADOW_FAR = 60, FLOOD_CASTERS = 64;
/** The objects' shadow grid: cells per side, their size (m), and the longest shadow binned (m). */
const SG_N = 128, SG_CELL = 2, SG_LONG = 60;
/** The objects' footprints on the ground (footGrid): OG_N x OG_N cells of OG_CELL metres round the viewer, for the lamps' shadows and the reflections. */
const OG_N = 64, OG_CELL = 2;
import { CURVE_R } from '../sarcophagus';
import { setEye } from '../eye';
import { eyeHold, eyePush } from '../power';
import { subAt } from '../../sim/power';
import { fallShape } from '../precip';
import { fontRows, signMode, signText } from '../signs';
import { BLD, BLK, FX_TAB, IN_LAMPS, SG_BIZ, SG_FONT, STYLES, TICK_MAX, UNIFORMS, worldWGSL } from './shader';

/**
 * Stage R: the world drawn on the GPU (WebGPU). The city goes up once as lists (street boundaries,
 * blocks, buildings, substations); every frame the CPU still does what is per frame and not per cell
 * (gpuPrepare in raycaster.ts: the lamps' failures and power, the dynamic lights, the sky's numbers)
 * and sends those lists; the compute shader (shader.ts) casts one ray per cell and shades it. The
 * compositor (compositor.ts) draws the cells in the same submit.
 *
 * Ported: the ground (streets, markings, sidewalks, plazas, parks, yards, snow, wet), the roofs, the
 * walls by style (windows, bands, cornices, piers, balconies, glass, warehouses, crowns, neon,
 * floodlights, the power per window in a blackout), the lamps' and the dynamic lights, the finish
 * (daylight, moonlight, haze, a whole-city blackout, the display modes), a true 3D camera, and
 * the sky (gradient, stars, moon, clouds), the shop signs, painted ads, video screens and the news
 * ticker, the burnt ground, the fence, the Sarcophagus and its cranes, scaffolding and reliefs, the street doors and the fire escapes
 * drawn on the facades, the rooms seen through the windows, and the objects (gpu/objects.ts: lamps, trees, furniture, blade
 * signs, billboards, signals, cars, people, cameras, substations, sheds, the fire escapes' frames), the smoke of the fire
 * zone, rain and snow falling, and the floor the viewer stands in (shader.ts, interiorCell: its walls, doors, the
 * lift's panel, the windows with the city through them and their glass, floor and ceiling; its furniture as objects).
 */

type UName = (typeof UNIFORMS)[number];
const UIDX = Object.fromEntries(UNIFORMS.map((n, k) => [n, k])) as Record<UName, number>;

/**
 * The eye's light meter (L.3): the mean of the log of each cell's light on the screen, as the frame was shown
 * (glyph and background together, in linear light), in one workgroup; with how many cells were blown out.
 */
const METER_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read> outp: array<u32>;
@group(0) @binding(1) var<storage, read_write> res: array<f32>;
@group(0) @binding(2) var<uniform> dim: vec4f;
var<workgroup> sumL: array<f32, 256>;
var<workgroup> sumB: array<f32, 256>;
fn ch(w: u32, k: u32) -> f32 { return pow(f32((w >> k) & 255u) / 255.0, 2.2); }
@compute @workgroup_size(256) fn main(@builtin(local_invocation_index) t: u32) {
  let n = u32(dim.x) * u32(dim.y);
  var s = 0.0; var b = 0.0;
  for (var i = t; i < n; i += 256u) {
    let f = outp[i]; let g = outp[n + i];
    let lf = 0.2126 * ch(f, 8u) + 0.7152 * ch(f, 16u) + 0.0722 * ch(f, 24u);
    let lg = 0.2126 * ch(g, 0u) + 0.7152 * ch(g, 8u) + 0.0722 * ch(g, 16u);
    let L = select(lf, 0.0, (f & 255u) == 32u) * 0.55 + lg * 0.45;
    s += log(L + 1e-3); b += select(0.0, 1.0, L > 0.7);
  }
  sumL[t] = s; sumB[t] = b;
  workgroupBarrier();
  for (var k = 128u; k > 0u; k >>= 1u) { if (t < k) { sumL[t] += sumL[t + k]; sumB[t] += sumB[t + k]; } workgroupBarrier(); }
  if (t == 0u) { res[0] = sumL[0] / f32(n); res[1] = sumB[0] / f32(n); }
}`;

/** The eye's adaptation (L.3): the exposure the time of day expects already fits a scene whose mean light (as the
 *  meter reads it, at adaptation 1) is within the band (by night, by day); past its edges the eye moves by the
 *  strength of the difference (opening up in the dark, closing in bright light), within the range; and how fast (s):
 *  it closes quickly in bright light and opens slowly in the dark. */
const ADAPT_BAND_NIGHT = [0.007, 0.05], ADAPT_BAND_DAY = [0.05, 0.12], ADAPT_DARK = 0.7, ADAPT_BRIGHT = 0.75, ADAPT_MIN = 1 / 8, ADAPT_MAX = 16;
const ADAPT_DOWN_S = 0.45, ADAPT_UP_S = 2.2;

export class GpuWorld {
  /** The cells of the last frame: glyph + fg per cell, then bg per cell (CharGrid's layout), read by the compositor. */
  out!: GPUBuffer;
  cols = 0;
  rows = 0;
  /** A true 3D camera (rays turned by the pitch); false: the old raycaster's sheared one. */
  cam3d = true;
  private uni: GPUBuffer;
  private U = new Float32Array(Math.ceil(UNIFORMS.length / 4) * 4);
  /** The sun on the screen this frame: cell column, row, and the strength of its rays (0: none). */
  sunScreen = [0, 0, 0];
  private pipe!: GPUComputePipeline;
  private mod: GPUShaderModule;
  /** The city's lists (fixed), then what changes: substations, light map, lamp colors, dynamic lights. */
  private fixed: GPUBuffer[];
  private subs: GPUBuffer;
  private lmap: GPUBuffer;
  private lampCol: GPUBuffer;
  private dyn: GPUBuffer[] = [];
  private lmapVersion = -1;
  private bind: GPUBindGroup | null = null;
  /** Bumped when a list's buffer is made again: every bind group made before is stale. */
  private gen = 0;
  private bindGen = -1;
  /** Views drawn off the screen and read back (see shot), by key. */
  private shots = new Map<string, Shot>();
  /** The buildings' floats, kept to write the power grid's part into (substation, generator). */
  private blds: Float32Array;
  private powerSet = false;
  /** The signs' buffer (see signData) and the ticker text last written into it. */
  private sg: GPUBuffer;
  private tickOff = 0;
  private ticker = '';
  /**
   * What is near and changes as the viewer moves (binding 16, the last the adapters allow: later lists
   * go in here too, after their own header word): at FX_TAB, one word per building, where its facade
   * features start (0: none); each is a count, then per feature its kind | face << 4 (0 a street door,
   * 1 a fire escape) and its span along the face (two f32). Then two words per box, where its plans
   * start: the ground floor's and the upper floors' (gx, gy, nx, ny, rooms, lot; per room its box as
   * four f32, kind and unit; the cells, four to a word). fx[0] is the number of buildings.
   */
  private fx: GPUBuffer;
  private fxW: Uint32Array;
  private fxF: Float32Array;
  private fxEnd = 0;
  /** Per building: 0 not looked at, 1 its features without the ground plan, 2 with it (the shops' doors). */
  private fxState: Uint8Array;
  /** Per box: 1 where its ground (2k) or upper floors' (2k + 1) plan is in fx. */
  private fxPlan: Uint8Array;
  private fxScan = 0;
  /** The objects' models in fx (from mBase, MODEL_CAP words; offsets kept by Part list) and the frame's objects (from oBase). */
  private mBase = 0;
  private mW: Uint32Array;
  private mF: Float32Array;
  private mEnd = 0;
  private mSent = 0;
  private models = new WeakMap<Part[], number>();
  private oBase = 0;
  private sgCnt = new Uint32Array(SG_N * SG_N);
  private sgStamp = new Int32Array(SG_N * SG_N);
  private ogCnt = new Uint32Array(OG_N * OG_N);
  /** Every lamp's color this frame and where its head is (r, g, b, x, y, z), for the lamps' shadows. */
  private lampBuf: Float32Array;
  private oW = new Uint32Array(OBJ_CAP);
  private oF = new Float32Array(this.oW.buffer);

  /** The eye's adaptation: the exposure over the one the time of day expects (L.3). */
  adapt = 1;
  /** (L.13) The eye when a blackout began pushing it darker (-1: not pushing). */
  private pushBase = -1;
  /** The world's pass on the GPU's own clock (ms, smoothed); -1 without timestamp queries. */
  gpuMs = -1;
  private tq: { set: GPUQuerySet; res: GPUBuffer; read: GPUBuffer; busy: boolean } | null = null;
  /** The meter's pipeline, result and read-back, the frame's adaptation it saw, and the target it gives. */
  private meter: { pipe: GPUComputePipeline; res: GPUBuffer; read: GPUBuffer; uni: GPUBuffer; bind: GPUBindGroup | null; busy: boolean; pending: boolean; adapt: number; day: number } | null = null;
  /** The last reading: mean log light at adaptation 1, and the share of cells blown out (debug). */
  meterLog = 0;
  meterHot = 0;
  /** Where the eye is going (adapt's target), and when it last moved (ms). */
  private adaptTarget = 1;
  private adaptAt = -1;
  /** Set false to hold the eye at the time of day's exposure (debug). */
  autoExposure = true;

  static available(): boolean { return typeof navigator !== 'undefined' && 'gpu' in navigator; }

  static async create(city: City): Promise<GpuWorld> {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('no WebGPU adapter');
    // the GPU's own clock on the world's pass, where the adapter has it (the real cost of the shader, L.0)
    const ts = adapter.features.has('timestamp-query');
    const device = await adapter.requestDevice({ requiredFeatures: ts ? ['timestamp-query'] : [], requiredLimits: { maxStorageBuffersPerShaderStage: Math.min(16, adapter.limits.maxStorageBuffersPerShaderStage) } });
    const g = new GpuWorld(device, city);
    // compiled off the main thread (the first compile takes seconds)
    g.pipe = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: g.mod, entryPoint: 'main' } });
    return g;
  }

  private constructor(readonly dev: GPUDevice, private city: City) {
    const C = city;
    const blocks = new Float32Array(C.blocks.length * BLK);
    C.blocks.forEach((b, k) => {
      const ind = C.districts[b.district].type === 'industrial' ? 1 : 0;
      blocks.set([b.x0, b.y0, b.x1, b.y1, b.b0, b.b1, b.maxH, (b.open ? { park: 1, plaza: 2, yard: 3 }[b.open] : 0) | (b.diag << 2) | (ind << 5) | (b.square ? 64 : 0)], k * BLK);
    });
    // per building: box, height, round, cut (flag, nx, ny, c), style, lit, win, frame, feat, shop, tier,
    // sign, neon (+ flag), crown (+ flag), flood + its height, the five faces' spans, substation, generator,
    // business, ad, screen, ticker, scaffolding (top, net, faces), relief (P, off, a, w, d, z0, z1, flag)
    const blds = new Float32Array(C.buildings.length * BLD);
    C.buildings.forEach((B, k) => {
      const K = B.cut, o = k * BLD;
      blds.set([B.x0, B.y0, B.x1, B.y1, B.h, B.round ? 1 : 0, K ? 1 : 0, K?.nx ?? 0, K?.ny ?? 0, K?.c ?? 0, STYLES.indexOf(B.style), B.lit,
        ...B.win, ...B.frame, B.feat, B.shop ? 1 : 0, B.tier, ...B.sign, ...(B.neon ?? [0, 0, 0]), B.neon ? 1 : 0, ...(B.crown ?? [0, 0, 0]), B.crown ? 1 : 0,
        ...(B.flood ?? [0, 0, 0]), B.flood ? B.floodH : 0], o);
      blds.set([B.biz, B.ad, B.screen, B.ticker ? 1 : 0], o + 48);
      // the scaffolding (its top, net, and the street faces it stands on: scaffoldFace), and the relief (reliefOf)
      if (B.scaffold) {
        const b = blockAt(C, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2);
        let mask = 0;
        if (b) [B.x0 - b.x0, b.x1 - B.x1, B.y0 - b.y0, b.y1 - B.y1].forEach((gap, f) => { if (gap <= SIDEWALK + 0.5) mask |= 1 << f; });
        blds.set([B.scaffold, B.net, mask], o + 52);
      }
      if (reliefOf(B)) blds.set([REL.P, REL.off, REL.a, REL.w, REL.d, REL.z0, REL.z1, 1], o + 55);
      for (let f = 0; f < 5; f++) {
        if (f === 4 && !K) continue;
        const sp = faceSpan(B, f);
        blds[o + 36 + f * 2] = sp[0]; blds[o + 37 + f * 2] = sp[1];
      }
    });
    this.blds = blds;
    const store = (a: Float32Array | Uint32Array) => {
      const b = dev.createBuffer({ size: Math.max(16, a.byteLength), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      dev.queue.writeBuffer(b, 0, a); return b;
    };
    const S = signData(city);
    this.sg = store(S.data); this.tickOff = S.tick;
    this.fixed = [new Float32Array(C.xb), new Float32Array(C.yb), Uint32Array.from(C.xCell), Uint32Array.from(C.yCell), blocks, blds].map(store);
    const nb = C.buildings.length;
    this.fxW = new Uint32Array(FX_TAB + 3 * nb + (1 << 22)); this.fxF = new Float32Array(this.fxW.buffer); // room for many plans: when full, all start over
    this.fxW[0] = nb;
    this.fxState = new Uint8Array(nb); this.fxPlan = new Uint8Array(nb * 2); this.fxEnd = FX_TAB + 3 * nb;
    // after the facades and plans: the models, then the frame's objects (fx[1] says where)
    this.mBase = this.fxW.length; this.oBase = this.mBase + MODEL_CAP; this.fxW[1] = this.oBase;
    this.mW = new Uint32Array(MODEL_CAP); this.mF = new Float32Array(this.mW.buffer);
    this.fx = dev.createBuffer({ size: (this.oBase + OBJ_CAP) * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    dev.queue.writeBuffer(this.fx, 0, this.fxW);
    this.uni = dev.createBuffer({ size: this.U.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const sz = (n: number) => dev.createBuffer({ size: Math.max(16, n), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.subs = sz(64 * 16);
    this.lmap = sz(1024 * 1024 * 4 * 2);
    this.lampCol = sz(C.lamps.length * 24);
    this.lampBuf = new Float32Array(C.lamps.length * 6);
    // the head hangs at the end of the arm (lampModel: 1.6 m out, 6.4 m up)
    C.lamps.forEach((p, n) => this.lampBuf.set([0, 0, 0, p.x + Math.cos(p.a) * 1.6, p.y + Math.sin(p.a) * 1.6, 6.37], n * 6));
    if (dev.features.has('timestamp-query')) {
      this.tq = { set: dev.createQuerySet({ type: 'timestamp', count: 2 }), res: dev.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }),
        read: dev.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }), busy: false };
    }
    {
      const pipe = dev.createComputePipeline({ layout: 'auto', compute: { module: dev.createShaderModule({ code: METER_WGSL }), entryPoint: 'main' } });
      this.meter = { pipe, res: dev.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }),
        read: dev.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }),
        uni: dev.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }), bind: null, busy: false, pending: false, adapt: 1, day: 0 };
    }
    const mod = (this.mod = dev.createShaderModule({ code: worldWGSL() }));
    mod.getCompilationInfo().then((info) => info.messages.forEach((m) => console[m.type === 'error' ? 'error' : 'warn'](`WGSL ${m.lineNum}:${m.linePos} ${m.message}`)));
  }

  /** The screen's size: a new output buffer. */
  resize(cols: number, rows: number) {
    if (cols === this.cols && rows === this.rows) return;
    this.cols = cols; this.rows = rows;
    this.out?.destroy();
    this.out = this.dev.createBuffer({ size: cols * rows * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    if (this.meter) this.meter.bind = null;
    this.bind = null;
  }

  /** A buffer for a list that changes size: grown (by doubling) when it no longer fits; the bind group follows. */
  private fit(k: number, bytes: number) {
    const b = this.dyn[k];
    if (b && b.size >= bytes) return b;
    b?.destroy();
    let size = 256; while (size < bytes) size *= 2;
    this.dyn[k] = this.dev.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.gen++;
    return this.dyn[k];
  }

  /** This frame's world into `out`, as the first pass of the encoder (the compositor draws it in the same submit). */
  encode(enc: GPUCommandEncoder, world: World, v: View, timed = false) {
    const { cols, rows } = this, C = this.city, q = this.dev.queue;
    const F = gpuPrepare(world, v), sky = F.sky, P = world.power, I = gpuInside(world, v, cols, rows, sky), sk = I?.base;
    if (F.ticker !== this.ticker) {
      this.ticker = F.ticker;
      const T = new Uint32Array(Math.min(TICK_MAX, F.ticker.length));
      for (let k = 0; k < T.length; k++) T[k] = code(F.ticker, k);
      if (T.length) q.writeBuffer(this.sg, this.tickOff * 4, T);
    }
    if (!this.powerSet) {
      // which substation feeds each building, and whether it has a generator: fixed once the grid exists
      for (let k = 0; k < C.buildings.length; k++) { this.blds[k * BLD + 46] = P.building[k]; this.blds[k * BLD + 47] = P.generator[k]; this.blds[k * BLD + 63] = P.backup[k]; }
      q.writeBuffer(this.fixed[5], 0, this.blds);
      this.powerSet = true;
    }
    const S = new Float32Array(P.subs.length * 4);
    P.subs.forEach((s, k) => S.set([s.changed < 0 ? -1 : s.changed / 60, s.on ? 1 : 0, s.ox, s.oy], k * 4));
    q.writeBuffer(this.subs, 0, S);
    if (F.light.version !== this.lmapVersion) { this.lmapVersion = F.light.version; q.writeBuffer(this.lmap, 0, F.light.packMap()); }
    { const c = F.light.colors, L = this.lampBuf; for (let n = 0, m = c.length / 3; n < m; n++) { L[n * 6] = c[n * 3]; L[n * 6 + 1] = c[n * 3 + 1]; L[n * 6 + 2] = c[n * 3 + 2]; } }
    q.writeBuffer(this.lampCol, 0, this.lampBuf);
    this.facades(v.x, v.y);
    this.streetDoors(world);
    const D = F.dyn.pack();
    [D.lights, D.lv, D.off, D.idx].forEach((a, k) => { const b = this.fit(k, a.byteLength); q.writeBuffer(b, 0, a); });
    if (!this.bind || this.bindGen !== this.gen) {
      this.bindGen = this.gen;
      this.bind = this.dev.createBindGroup({
        layout: this.pipe.getBindGroupLayout(0),
        entries: [this.uni, ...this.fixed, this.out, this.subs, this.lmap, this.lampCol, ...this.dyn, this.sg, this.fx].map((buffer, binding) => ({ binding, resource: { buffer } })),
      });
    }
    if (timed) {
      // (L.12) a blackout or the power coming back round the viewer holds the eye where it was for a moment
      const sub = subAt(P, C, world.player.x, world.player.y);
      const sec = (world.tick + v.alpha) / 60, push = eyePush(P, sub, world.player.x, world.player.y, sec, 1 - sky.day);
      // (L.13) then pushes it darker for a few seconds, from where it was, before letting it adapt again
      if (push < 1 && this.autoExposure) {
        if (this.pushBase < 0) this.pushBase = this.adapt;
        this.adapt = this.pushBase * push;
        this.adaptAt = performance.now();
      } else {
        this.pushBase = -1;
        this.adaptStep(sky.day, eyeHold(P, sub, world.player.x, world.player.y, sec));
      }
    }
    const scale = rows / 2 / Math.tan(VFOV / 2), plane = ((cols / 2) * v.cellAspect) / scale;
    const dirX = Math.cos(v.yaw), dirY = Math.sin(v.yaw), W = world.weather, Dg = C.diagonal, U = this.U;
    // how far the rain has fallen, shared with the CPU's drawFall (split into whole bands and the rest, for the f32s)
    const Fs = fallShape({ amount: W.precip, snow: W.snow, windX: W.windX, windY: W.windY, sec: (world.tick + v.alpha) / 60, flash: sky.flash });
    const vals: Record<UName, number> = {
      px: v.x, py: v.y, eye: v.eye, dirX, dirY, plX: -dirY * plane, plY: dirX * plane, hor: rows / 2 + Math.tan(v.pitch) * scale,
      scale, cols, rows, sec: (world.tick + v.alpha) / 60, day: sky.day, solid: v.look.solid, sharp: v.look.sharp, fuse: v.look.fuse ? 1 : 0,
      nbx: C.nbx, nxb: C.xb.length, nyb: C.yb.length, curveR: CURVE_R, dox: Dg.ox, doy: Dg.oy, dex: Dg.ex, dey: Dg.ey,
      dnx: Dg.nx, dny: Dg.ny, dw: Dg.w, blocks: v.look.blocks ? 1 : 0, lox: F.light.ox, loy: F.light.oy, dbx: D.bx, dby: D.by,
      sunX: F.sun[0], sunY: F.sun[1], sunZ: F.sun[2], sunEl: sky.sunEl, cloud: sky.cloud, moonlight: sky.moonlight, cityLit: 0.65 * F.light.litShare + 0.35 * sky.cityLit, flash: sky.flash,
      snow: W.snowCover, wet: W.wet, rain: W.snow ? 0 : W.precip, cam3d: this.cam3d ? 1 : 0, pitch: v.pitch, colW: (2 * plane) / cols, plane, adapt: timed ? this.adapt : 1,
      dusk: sky.dusk, sunA: sky.sunA, moonA: sky.moonA, moonEl: sky.moonEl, phase: sky.phase, precip: sky.precip, driftX: sky.driftX, driftY: sky.driftY,
      cityW: C.w, cityH: C.h, ccx: C.cx, ccy: C.cy, sarX: C.sarcophagus.x, sarY: C.sarcophagus.y, sarR: C.sarcophagus.r,
      sarH: C.sarcophagus.h, towX: C.sarcophagus.tx, towY: C.sarcophagus.ty, towR: C.sarcophagus.tr, towH: C.sarcophagus.th,
      starSlots: Math.round((cols * Math.PI) / Math.atan(plane)), tickN: Math.min(TICK_MAX, this.ticker.length),
      yaw: v.yaw, fall: W.precip, fallSnow: W.snow ? 1 : 0, windX: W.windX, windY: W.windY,
      fallB: Math.floor(Fs.fallen / Fs.period), fallR: Fs.fallen - Math.floor(Fs.fallen / Fs.period) * Fs.period,
      fallSpeed: Fs.speed, fallStreak: Fs.streak, fallDens: Fs.dens, fallPeriod: Fs.period,
      hand: v.hand ?? 0, inX0: sk ? sk.x0 : 1e9, inY0: sk ? sk.y0 : 1e9, inX1: sk ? sk.x1 : -1e9, inY1: sk ? sk.y1 : -1e9,
    };
    for (const k of UNIFORMS) U[UIDX[k]] = vals[k];
    if (timed) setEye(sky.day, vals.cityLit, vals.adapt);
    // the sun on the screen (cell x, y) and how strongly its rays show, for the compositor's (B.2)
    {
      const [sx, sy, sz] = F.sun, f = sx * dirX + sy * dirY, lat = sy * dirX - sx * dirY, cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
      const d = this.cam3d ? f * cp + sz * sp : f;
      const k = sky.day * Math.min(1, Math.max(0, sz) * 12) * (1 - 0.6 * sky.cloud) * (1 - 0.8 * sky.precip);
      if (d > 0.05 && k > 0.01) {
        this.sunScreen[0] = (cols / 2) * (1 + lat / (d * plane));
        this.sunScreen[1] = this.cam3d ? rows / 2 - ((-f * sp + sz * cp) / d) * scale : vals.hor - (sz * scale) / f;
        this.sunScreen[2] = k;
      } else this.sunScreen[2] = 0;
    }
    this.objects(world, v, scale, plane, vals.hor, I, sky.day > 0.01 && F.sun[2] > 0.02 ? F.sun : null);
    q.writeBuffer(this.uni, 0, U);
    const T = timed && this.tq && !this.tq.busy ? this.tq : null;
    const pass = enc.beginComputePass(T ? { timestampWrites: { querySet: T.set, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } } : undefined);
    pass.setPipeline(this.pipe); pass.setBindGroup(0, this.bind);
    pass.dispatchWorkgroups(Math.ceil(cols / 8), Math.ceil(rows / 8));
    pass.end();
    if (T) { enc.resolveQuerySet(T.set, 0, 2, T.res, 0); enc.copyBufferToBuffer(T.res, 0, T.read, 0, 16); T.busy = true; this.tqPending = true; }
    // the eye's meter over what this frame shows
    const M = timed && this.meter && !this.meter.busy ? this.meter : null;
    if (M) {
      if (!M.bind) M.bind = this.dev.createBindGroup({ layout: M.pipe.getBindGroupLayout(0), entries: [this.out, M.res, M.uni].map((buffer, binding) => ({ binding, resource: { buffer } })) });
      q.writeBuffer(M.uni, 0, new Float32Array([cols, rows, 0, 0]));
      const mp = enc.beginComputePass();
      mp.setPipeline(M.pipe); mp.setBindGroup(0, M.bind); mp.dispatchWorkgroups(1); mp.end();
      enc.copyBufferToBuffer(M.res, 0, M.read, 0, 16);
      M.busy = true; M.pending = true; M.adapt = this.adapt; M.day = sky.day;
    }
  }

  /** The eye: toward the meter's target, closing up fast and opening slowly. */
  private adaptStep(day: number, hold = 0) {
    const now = performance.now(), dt = this.adaptAt < 0 ? 0 : Math.min(0.25, (now - this.adaptAt) / 1000);
    this.adaptAt = now;
    if (!this.autoExposure) { this.adapt = 1; return; }
    const tau = (this.adaptTarget < this.adapt ? ADAPT_DOWN_S : ADAPT_UP_S) / Math.max(1e-3, 1 - hold);
    this.adapt *= Math.pow(this.adaptTarget / this.adapt, 1 - Math.exp(-dt / tau));
    void day;
  }
  private tqPending = false;
  /** After the frame's submit: read the world pass's time and the eye's meter back when they land. */
  readTime() {
    const M = this.meter;
    if (M && M.pending) {
      M.pending = false;
      M.read.mapAsync(GPUMapMode.READ).then(() => {
        const r = new Float32Array(M.read.getMappedRange().slice(0));
        M.read.unmap(); M.busy = false;
        // the mean light the scene would have at adaptation 1 (the curve's shoulder ignored), and where that sends the eye
        this.meterLog = r[0] - Math.log(M.adapt); this.meterHot = r[1];
        const g = Math.min(1, Math.max(0, M.day / 0.35)), edge = (k: number) => Math.log(ADAPT_BAND_NIGHT[k]) * (1 - g) + Math.log(ADAPT_BAND_DAY[k]) * g;
        const lo = edge(0), hi = edge(1), m = this.meterLog;
        const over = m < lo ? (m - lo) * ADAPT_DARK : m > hi ? (m - hi) * ADAPT_BRIGHT : 0;
        this.adaptTarget = Math.min(ADAPT_MAX, Math.max(ADAPT_MIN, Math.exp(-over)));
      }, () => { M.busy = false; });
    }
    const T = this.tq;
    if (!T || !this.tqPending) return;
    this.tqPending = false;
    T.read.mapAsync(GPUMapMode.READ).then(() => {
      const t = new BigUint64Array(T.read.getMappedRange());
      const ms = Number(t[1] - t[0]) / 1e6;
      T.read.unmap(); T.busy = false;
      if (ms > 0 && ms < 1000) this.gpuMs = this.gpuMs < 0 ? ms : this.gpuMs + (ms - this.gpuMs) * 0.1;
    }, () => { T.busy = false; });
  }

  /**
   * View v drawn into a cols x rows grid off the screen and read back to the CPU, for what works on the
   * picture there (the cameras' monitor, the opening, the phone's camera and the photos): under `key`,
   * the last picture that landed, or null; a new one is started unless one is on its way. Without a
   * tag the picture must have been asked for in the last quarter second (a live view, a frame or two
   * late); with one, it must be the picture asked for with that tag (a photo of one place), and it is
   * not drawn again once it is there.
   */
  shot(key: string, world: World, v: View, cols: number, rows: number, tag?: string): CharGrid | null {
    let S = this.shots.get(key);
    if (!S || S.cols !== cols || S.rows !== rows) {
      if (S) { S.out.destroy(); S.read.destroy(); }
      const size = cols * rows * 8, dev = this.dev;
      S = { cols, rows, out: dev.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }), read: dev.createBuffer({ size, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }),
        bind: null, bindGen: -1, busy: false, grid: new CharGrid(cols, rows), at: -1, tag: undefined };
      this.shots.set(key, S);
    }
    const now = performance.now(), ok = S.at >= 0 && (tag !== undefined ? S.tag === tag : now - S.at < 250);
    if (ok && tag !== undefined) return S.grid;
    if (!S.busy) {
      // drawn as the screen's frame is, into this picture's buffer; the light on the viewer's hands is the screen's
      const keep = { out: this.out, cols: this.cols, rows: this.rows, bind: this.bind, bindGen: this.bindGen }, L = VIEW_LIGHT.slice(), G = VIEW_GLINT.slice();
      Object.assign(this, { out: S.out, cols, rows, bind: S.bind, bindGen: S.bindGen });
      const enc = this.dev.createCommandEncoder();
      this.encode(enc, world, v);
      enc.copyBufferToBuffer(S.out, 0, S.read, 0, cols * rows * 8);
      this.dev.queue.submit([enc.finish()]);
      S.bind = this.bind; S.bindGen = this.bindGen;
      Object.assign(this, keep);
      VIEW_LIGHT.set(L); VIEW_GLINT.set(G);
      const T = S, n = cols * rows * 4;
      T.busy = true;
      // (the out buffer is CharGrid's layout: glyph and color per cell, then the background)
      T.read.mapAsync(GPUMapMode.READ).then(() => {
        const a = new Uint8Array(T.read.getMappedRange());
        T.grid.cells.set(a.subarray(0, n)); T.grid.bg.set(a.subarray(n, 2 * n));
        // (the GPU keeps the glow in the background's alpha; on the CPU a background is opaque)
        for (let k = 3; k < n; k += 4) T.grid.bg[k] = 255;
        T.read.unmap(); T.busy = false; T.at = now; T.tag = tag;
      }, () => { T.busy = false; });
    }
    return ok ? S.grid : null;
  }

  /** A model's offset in fx, written into the model area the first time it is seen (-1: the area is full). */
  private model(parts: Part[]): number {
    const at = this.models.get(parts);
    if (at !== undefined) return at;
    const n = partsSize(parts);
    if (this.mEnd + n > MODEL_CAP) return -1;
    const o = this.mEnd;
    this.mEnd = packParts(this.mW, this.mF, o, parts, this.mBase);
    this.models.set(parts, this.mBase + o);
    return this.mBase + o;
  }

  /**
   * The frame's objects (raycaster.ts, gpuObjects) into fx: each one's screen box (its bounding box's
   * corners projected), the 8-column tiles it covers, and its model (sent once). When the model area
   * fills, it starts over and the frame is packed again.
   */
  private objects(world: World, v: View, scale: number, plane: number, hor: number, I: Inside | null, sun: ArrayLike<number> | null) {
    const shadows = sun !== null;
    const { cols, rows } = this, q = this.dev.queue;
    const dirX = Math.cos(v.yaw), dirY = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch), c3 = this.cam3d;
    // the cone the objects are gathered in: the 3D camera turned up or down sees wider at its top or bottom rows
    const den = cp - Math.abs(sp) * Math.tan(VFOV / 2);
    // (by day wider: what stands just off the screen casts its shadow into it)
    const cone = (!c3 ? plane : den > 0.15 ? plane / den : 1e3) * (shadows ? SHADOW_CONE : 1);
    const list: { o: Obj; far: number; zoff: number; indoor?: boolean }[] = gpuObjects(world, v, cols, cone, shadows ? SHADOW_BACK : 0);
    // indoors, the floor's furniture, lit by its rooms' lamps
    if (I) for (const f of I.plan.furn) list.push({ o: { x: f.x, y: f.y, c: f.c, s: f.s, parts: furnitureModel(f.kind, f.seed, f.hx, f.hy, f.stock), r: Math.hypot(f.hx, f.hy) + 0.4, h: 2, seed: f.seed }, far: 40, zoff: I.z0, indoor: true });
    const nT = Math.ceil(cols / TILE), box: number[] = [], mods: number[] = [], picked: number[] = [];
    // the floodlit facades near enough for their lamps' shadows: who stands in front of one casts them
    const lit: number[] = [];
    for (const b of this.city.blocks) {
      if (b.x1 < v.x - FLOOD_SHADOW_FAR || b.x0 > v.x + FLOOD_SHADOW_FAR || b.y1 < v.y - FLOOD_SHADOW_FAR || b.y0 > v.y + FLOOD_SHADOW_FAR) continue;
      for (let k = b.b0; k < b.b1; k++) { const B = this.city.buildings[k]; if (B.flood && !B.round) lit.push(k); }
    }
    const byFlood = (o: Obj) => lit.some((k) => {
      const B = this.city.buildings[k], dx = Math.max(B.x0 - o.x, 0, o.x - B.x1), dy = Math.max(B.y0 - o.y, 0, o.y - B.y1);
      return dx * dx + dy * dy < (FLOOD_REACH + o.r) ** 2;
    });
    const casters: number[] = [];
    // a point on the screen, as cell edges (column, row), or false behind the eye
    let px = 0, py = 0;
    const proj = (X: number, Y: number, Z: number) => {
      const rx = X - v.x, ry = Y - v.y, rz = Z - v.eye, f = rx * dirX + ry * dirY, lat = ry * dirX - rx * dirY;
      if (!c3) { if (f < 0.3) return false; px = (cols / 2) * (1 + lat / (f * plane)); py = hor - (rz * scale) / f; return true; }
      const d = f * cp + rz * sp;
      if (d < 0.3) return false;
      px = (cols / 2) * (1 + lat / (d * plane)); py = rows / 2 - ((-f * sp + rz * cp) / d) * scale; return true;
    };
    for (let pass = 0; pass < 2; pass++) {
      box.length = 0; mods.length = 0; picked.length = 0; casters.length = 0;
      let full = false;
      for (let k = 0; k < list.length; k++) {
        const { o, far, zoff } = list[k];
        const tY = (o.x - v.x) * dirX + (o.y - v.y) * dirY;
        if (tY - o.r > far) continue;
        // wholly behind the eye: by day still sent (with no screen box) if near enough to cast forward
        const back = tY + o.r < 0.3;
        if (back && !(shadows && Math.hypot(o.x - v.x, o.y - v.y) < SHADOW_BACK)) continue;
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, behind = false;
        const zl = (o.z0 ?? 0) + zoff - 0.4, zh = o.h + zoff + 0.4;
        for (let c = 0; c < 8; c++) {
          if (!proj(o.x + (c & 1 ? o.r : -o.r), o.y + (c & 2 ? o.r : -o.r), c & 4 ? zh : zl)) { behind = true; break; }
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
        if (back) x1 = -1e9;
        else if (behind) { x0 = 0; x1 = cols; y0 = 0; y1 = rows; }
        const bx0 = Math.max(0, Math.floor(x0) - 1), bx1 = Math.min(cols, Math.ceil(x1) + 1), by0 = Math.max(0, Math.floor(y0) - 1), by1 = Math.min(rows, Math.ceil(y1) + 1);
        // off the screen: by day still sent (with no screen box) to cast its shadow, if near enough
        const off = bx0 >= bx1 || by0 >= by1;
        const flood = lit.length > 0 && !list[k].indoor && casters.length < FLOOD_CASTERS && byFlood(o);
        if (off && !(shadows && Math.hypot(o.x - v.x, o.y - v.y) < SHADOW_CASTERS) && !flood) continue;
        const m = this.model(o.parts);
        if (m < 0) { full = true; break; }
        if (flood) casters.push(picked.length);
        picked.push(k); mods.push(m); if (off) box.push(0, 0, 0, 0); else box.push(bx0, bx1, by0, by1);
      }
      if (!full) break;
      this.models = new WeakMap(); this.mEnd = 0; this.mSent = 0;
    }
    if (this.mEnd > this.mSent) { q.writeBuffer(this.fx, (this.mBase + this.mSent) * 4, this.mW, this.mSent, this.mEnd - this.mSent); this.mSent = this.mEnd; }
    // the tiles' lists: counted, then filled
    const n = picked.length, W = this.oW, F = this.oF, cnt = new Uint32Array(nT + 1);
    for (let j = 0; j < n; j++) for (let t = Math.floor(box[j * 4] / TILE); t <= Math.floor((box[j * 4 + 1] - 1) / TILE); t++) cnt[t]++;
    const tab = 10, lst = tab + nT + 1;
    let total = 0;
    for (let t = 0; t < nT; t++) { W[tab + t] = total; total += cnt[t]; }
    W[tab + nT] = total;
    // after the objects, this frame's roofs that keep the rain off (gatherRoofs): x, y, c, s, hx, hy, z
    const ob = lst + total, rb = ob + n * OW, nR = roofs.length;
    if (rb + nR * 7 > OBJ_CAP) { W.fill(0, 0, 10); q.writeBuffer(this.fx, this.oBase * 4, W, 0, 10); return; }
    roofs.forEach((R, k) => F.set([R.x, R.y, R.c, R.s, R.hx, R.hy, R.z], rb + k * 7));
    const fill = cnt.fill(0);
    for (let j = 0; j < n; j++) {
      for (let t = Math.floor(box[j * 4] / TILE); t <= Math.floor((box[j * 4 + 1] - 1) / TILE); t++) W[lst + W[tab + t] + fill[t]++] = j;
      const { o, far, zoff, indoor } = list[picked[j]], w = ob + j * OW, lean = o.lift !== undefined;
      F[w] = o.x; F[w + 1] = o.y; F[w + 2] = o.c; F[w + 3] = o.s; F[w + 4] = o.r; F[w + 5] = o.h; F[w + 6] = o.z0 ?? 0;
      W[w + 7] = o.seed | 0; F[w + 8] = far; F[w + 9] = zoff;
      F[w + 10] = lean ? o.pitch ?? 0 : 0; F[w + 11] = lean ? o.roll ?? 0 : 0; F[w + 12] = lean ? o.lift ?? 0 : 0; F[w + 13] = o.wheel ?? 0;
      W[w + 14] = lean ? 1 : indoor ? 2 : 0; W[w + 15] = mods[j];
      W[w + 16] = box[j * 4]; W[w + 17] = box[j * 4 + 1]; W[w + 18] = box[j * 4 + 2]; W[w + 19] = box[j * 4 + 3];
    }
    // then the floor the viewer stands in (see the shader's IN_ words): its plan, lot, box, storey, floor height, doors
    // shut, the lift's floors and destination, how many door leaves and street doors, the panoramic lift's glass,
    // the rooms; the rooms' lamps, the leaves (hinge, along, out, width, swing), the street doors (face, a0, a1)
    let ib = rb + nR * 7, end = ib;
    const po = I ? this.putPlan(I.plan, I.floor !== 0, I.k) : -1;
    if (I && po >= 0) {
      const nr = I.plan.rooms.length, nL = I.leaves.length, ex = I.floor === 0 ? I.exits : [], G = liftGlassBox(this.city, I.k);
      end = ib + IN_LAMPS + nr * 3 + nL * 8 + ex.length * 3;
      if (end > OBJ_CAP) { ib = 0; end = rb + nR * 7; }
      else {
        W[ib] = po; W[ib + 1] = I.k; W[ib + 2] = I.boxId; W[ib + 3] = I.floor; F[ib + 4] = I.z0; W[ib + 5] = I.closed ? 1 : 0;
        W[ib + 6] = I.liftN; W[ib + 7] = I.liftTo; W[ib + 8] = nL; W[ib + 9] = ex.length;
        W[ib + 10] = G ? (G.alongX ? 1 : 2) : 0; F[ib + 11] = G?.u0 ?? 0; F[ib + 12] = G?.u1 ?? 0; F[ib + 13] = G?.v0 ?? 0; F[ib + 14] = G?.v1 ?? 0; W[ib + 15] = nr;
        F.set(insideLamps().subarray(0, nr * 3), ib + IN_LAMPS);
        const lb = ib + IN_LAMPS + nr * 3;
        // a street door's glass leaves have their width negative (the shader draws them as glass in a frame)
        I.leaves.forEach((L, k) => F.set([L.hx, L.hy, L.ax, L.ay, L.nx, L.ny, L.ra < 0 && L.rb < 0 ? -L.w : L.w, I.leafA[k]], lb + k * 8));
        ex.forEach((D, k) => { W[lb + nL * 8 + k * 3] = D.face; F[lb + nL * 8 + k * 3 + 1] = D.a0; F[lb + nL * 8 + k * 3 + 2] = D.a1; });
      }
    } else ib = 0;
    // by day, the grid of the objects' shadows on the ground (see shadowGrid)
    let sg = 0;
    if (sun) { const e = this.shadowGrid(W, F, end, ob, n, sun, v); if (e > 0) { sg = end; end = e; } }
    // and the objects that cast the floodlights' shadows: their count, then their indices
    let fl = 0;
    if (casters.length && end + 1 + casters.length <= OBJ_CAP) { fl = end; W[end] = casters.length; W.set(casters, end + 1); end += 1 + casters.length; }
    // the objects' footprints, for the lamps' shadows and what the wet street and the glass mirror
    let og = 0;
    { const e = this.footGrid(W, F, end, ob, n, v); if (e > 0) { og = end; end = e; } }
    W[0] = n; W[1] = nT; W[2] = ob; W[3] = lst; W[4] = rb; W[5] = nR; W[6] = ib; W[7] = sg; W[8] = fl; W[9] = og;
    q.writeBuffer(this.fx, this.oBase * 4, W, 0, end);
  }

  /**
   * The objects' shadows binned on the ground, from word at: a square of SG_N x SG_N cells of SG_CELL metres
   * around the viewer (its corner x, y), the cells' offsets into the list, then the list of objects. An object
   * lands in every cell its volume's shadow covers when cast on the ground along the sun (a capsule from its foot
   * toward the shadow's tip, as wide as it is): the shader casts a point to the ground the same way and tests
   * only that cell's objects. The end, or 0 if it did not fit.
   */
  private shadowGrid(W: Uint32Array, F: Float32Array, at: number, ob: number, n: number, sun: ArrayLike<number>, v: View): number {
    const N = SG_N, x0 = Math.floor(v.x / SG_CELL) * SG_CELL - (N / 2) * SG_CELL, y0 = Math.floor(v.y / SG_CELL) * SG_CELL - (N / 2) * SG_CELL;
    const Sx = sun[0] / sun[2], Sy = sun[1] / sun[2], cnt = this.sgCnt.fill(0), stamp = this.sgStamp.fill(-1);
    const head = at + 4, list = head + N * N + 1;
    const visit = (j: number, f: (c: number) => void) => {
      const w = ob + j * OW;
      if (W[w + 14] === 2) return;
      const x = F[w], y = F[w + 1], r = F[w + 4] + SG_CELL * 0.5, zoff = F[w + 9], zl = F[w + 6] + zoff, top = F[w + 5] + zoff;
      // the shadow of heights zl..top on the ground, its length kept under SG_LONG
      const k = Math.min(1, SG_LONG / Math.max(1e-3, Math.hypot(Sx, Sy) * top));
      const ax = x - Sx * zl * k, ay = y - Sy * zl * k, bx = x - Sx * top * k, by = y - Sy * top * k;
      const len = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.ceil(len / (SG_CELL * 0.5)));
      for (let s = 0; s <= steps; s++) {
        const px = ax + ((bx - ax) * s) / steps - x0, py = ay + ((by - ay) * s) / steps - y0;
        const i0 = Math.max(0, Math.floor((px - r) / SG_CELL)), i1 = Math.min(N - 1, Math.floor((px + r) / SG_CELL));
        const j0 = Math.max(0, Math.floor((py - r) / SG_CELL)), j1 = Math.min(N - 1, Math.floor((py + r) / SG_CELL));
        for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) { const c = jj * N + ii; if (stamp[c] !== j) { stamp[c] = j; f(c); } }
      }
    };
    for (let j = 0; j < n; j++) visit(j, (c) => cnt[c]++);
    let total = 0;
    for (let c = 0; c < N * N; c++) { W[head + c] = total; total += cnt[c]; }
    W[head + N * N] = total;
    if (list + total > OBJ_CAP) return 0;
    cnt.fill(0); stamp.fill(-1);
    for (let j = 0; j < n; j++) visit(j, (c) => { W[list + W[head + c] + cnt[c]++] = j; });
    F[at] = x0; F[at + 1] = y0; W[at + 2] = N; F[at + 3] = SG_CELL;
    return list + total;
  }

  /**
   * The outdoor objects binned by their footprint on the ground (their circle), from word at: a square of OG_N x OG_N
   * cells of OG_CELL metres round the viewer (its corner x, y), the cells' offsets into the list, then the list. A ray
   * near the ground (to a street lamp, or mirrored off the wet street) walks its cells and tests only their objects.
   * The end, or 0 if it did not fit.
   */
  private footGrid(W: Uint32Array, F: Float32Array, at: number, ob: number, n: number, v: View): number {
    const N = OG_N, cs = OG_CELL, x0 = Math.floor(v.x / cs) * cs - (N / 2) * cs, y0 = Math.floor(v.y / cs) * cs - (N / 2) * cs;
    const cnt = this.ogCnt.fill(0), head = at + 4, list = head + N * N + 1;
    const each = (f: (c: number) => void) => {
      for (let j = 0; j < n; j++) {
        const w = ob + j * OW;
        if (W[w + 14] === 2 || F[w + 9] !== 0) continue;
        const x = F[w] - x0, y = F[w + 1] - y0, r = F[w + 4];
        const i0 = Math.max(0, Math.floor((x - r) / cs)), i1 = Math.min(N - 1, Math.floor((x + r) / cs));
        const j0 = Math.max(0, Math.floor((y - r) / cs)), j1 = Math.min(N - 1, Math.floor((y + r) / cs));
        for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) { cur = j; f(jj * N + ii); }
      }
    };
    let cur = 0;
    each((c) => cnt[c]++);
    let total = 0;
    for (let c = 0; c < N * N; c++) { W[head + c] = total; total += cnt[c]; }
    W[head + N * N] = total;
    if (list + total > OBJ_CAP) return 0;
    cnt.fill(0);
    each((c) => { W[list + W[head + c] + cnt[c]++] = cur; });
    F[at] = x0; F[at + 1] = y0; W[at + 2] = N; F[at + 3] = cs;
    return list + total;
  }

  /** Plan P (a lot's ground floor, or its box's upper floors) into fx unless it is there: its offset, or -1 if fx had to start over. */
  private putPlan(P: Plan, upper: boolean, lot: number): number {
    const W = this.fxW, F = this.fxF, s = P.box * 2 + (upper ? 1 : 0), t = FX_TAB + this.city.buildings.length + s, q = this.dev.queue;
    if (this.fxPlan[s]) return W[t];
    // after the cells, the furniture (seen through the windows): its count, then per piece x, y, c, s,
    // its radius and its model's offset; then the models, each once
    const mods = new Map<Part[], number>(), list = P.furn.map((f) => furnitureModel(f.kind, f.seed, f.hx, f.hy, f.stock));
    let mSize = 0;
    for (const m of list) if (!mods.has(m)) { mods.set(m, 0); mSize += partsSize(m); }
    const nCells = Math.ceil(P.cells.length / 4), fo = 6 + P.rooms.length * 6 + nCells;
    const n = fo + 1 + P.furn.length * 6 + mSize, o = this.fxTake(n);
    if (o < 0) return -1;
    let mo = o + fo + 1 + P.furn.length * 6;
    for (const m of mods.keys()) { mods.set(m, mo); mo = packParts(W, F, mo, m, 0); }
    W[o + fo] = P.furn.length;
    P.furn.forEach((f, k) => { const e = o + fo + 1 + k * 6; F[e] = f.x; F[e + 1] = f.y; F[e + 2] = f.c; F[e + 3] = f.s; F[e + 4] = Math.hypot(f.hx, f.hy) + 0.4; W[e + 5] = mods.get(list[k])!; });
    W[o] = P.gx; W[o + 1] = P.gy; W[o + 2] = P.nx; W[o + 3] = P.ny; W[o + 4] = P.rooms.length; W[o + 5] = lot;
    P.rooms.forEach((R, r) => { const w = o + 6 + r * 6; F[w] = R.x0; F[w + 1] = R.y0; F[w + 2] = R.x1; F[w + 3] = R.y1; W[w + 4] = ROOMS.indexOf(R.kind === 'store' ? 'office' : R.kind); W[w + 5] = R.unit; });
    W.set(new Uint32Array(P.cells.buffer, P.cells.byteOffset, P.cells.length >> 2), o + 6 + P.rooms.length * 6);
    if (P.cells.length & 3) { const c0 = P.cells.length & ~3; let v = 0; for (let c = c0; c < P.cells.length; c++) v |= P.cells[c] << ((c - c0) * 8); W[o + 6 + P.rooms.length * 6 + (c0 >> 2)] = v; }
    this.fxPlan[s] = 1; W[t] = o;
    q.writeBuffer(this.fx, o * 4, W, o, n); q.writeBuffer(this.fx, t * 4, W, t, 1);
    return o;
  }

  /** Start over when the near buffer is full: the tables cleared, everything written again as it is looked at. */
  private fxReset() {
    const nb = this.city.buildings.length;
    this.fxState.fill(0); this.fxPlan.fill(0);
    this.fxW.fill(0, FX_TAB, FX_TAB + 3 * nb); this.fxEnd = FX_TAB + 3 * nb;
    this.dev.queue.writeBuffer(this.fx, 0, this.fxW, 0, this.fxEnd);
  }

  /** Room for n words at the end of the near buffer (its offset), or -1 after starting over. */
  /** The street doors' word in each lot's list (face << 4) gets how open the door is in bits 8..15 (13.2c), written only when it changes. */
  private doorOpen = new Map<number, number>();
  private streetDoors(world: World) {
    const W = this.fxW, q = this.dev.queue, now = new Map<number, number>();
    for (const [key, a] of world.doors) {
      const n = key % 128, k = Math.floor(key / 128 / 256);
      if (n < 100 || Math.floor(key / 128) % 256 !== 0) continue;
      const o = W[FX_TAB + k];
      if (o && n - 100 < W[o] && (W[o + 1 + (n - 100) * 3] & 15) === 0) now.set(o + 1 + (n - 100) * 3, Math.round(a * 255));
    }
    for (const i of this.doorOpen.keys()) if (!now.has(i)) now.set(i, 0);
    for (const [i, b] of now) {
      const v = (W[i] & 0xff) | (b << 8);
      if (v !== W[i]) { W[i] = v; q.writeBuffer(this.fx, i * 4, W, i, 1); }
      if (b) this.doorOpen.set(i, b); else this.doorOpen.delete(i);
    }
  }

  private fxTake(n: number) {
    if (this.fxEnd + n > this.fxW.length) { this.fxReset(); return -1; }
    const o = this.fxEnd; this.fxEnd += n; return o;
  }

  /**
   * The houses near (x, y), into fx, looked at every few frames: their street doors and fire escapes
   * (again once a ground plan brings the shops' doors and moves the escapes off them), and within
   * FX_PLAN the floor plans of each box, made here a few at a time (as the CPU's window peeks do).
   */
  private facades(x: number, y: number) {
    if (this.fxScan++ % 6) return;
    const C = this.city, W = this.fxW, F = this.fxF, q = this.dev.queue;
    let plans = FX_PLANS;
    const slots: number[] = [];
    const make = (k: number, f: number) => { if (plans > 0 && cachedPlan(C, k, f) === undefined) { planOf(C, k, f); plans--; } };
    for (const b of C.blocks) {
      if (b.b1 <= b.b0 || Math.max(b.x0 - x, x - b.x1, b.y0 - y, y - b.y1) > FX_NEAR) continue;
      for (let k = b.b0; k < b.b1; k++) {
        const B = C.buildings[k];
        if (!habitable(B)) continue;
        if (Math.max(B.x0 - x, x - B.x1, B.y0 - y, y - B.y1) < FX_PLAN) {
          // the ground floor's plan, and the upper floors' of each box of the lot (the first storey it holds)
          make(k, 0);
          let f0 = 1;
          for (const j of tiersOf(C, k)) {
            const top = floorsOf(C.buildings[j]);
            if (f0 < top) make(k, f0);
            for (const f of f0 < top ? [0, f0] : [0]) {
              const P = cachedPlan(C, k, f);
              if (P && P.box === (f ? j : k) && this.putPlan(P, f !== 0, k) < 0) return;
            }
            f0 = Math.max(f0, top);
          }
        }
        const want = cachedPlan(C, k, 0) ? 2 : 1;
        if (this.fxState[k] >= want) continue;
        const doors = exitsOf(C, k, true), escs = escapesOf(C, k), n = doors.length + escs.length;
        const o = n ? this.fxTake(1 + n * 3) : 0;
        if (o < 0) return;
        const start = o;
        this.fxState[k] = want;
        if (!n) continue;
        W[o] = n;
        doors.forEach((D, e) => { W[o + 1 + e * 3] = D.face << 4; F[o + 2 + e * 3] = D.a0; F[o + 3 + e * 3] = D.a1; });
        escs.forEach((E, e) => { const w = o + 1 + (doors.length + e) * 3; W[w] = 1 | (E.face << 4); F[w + 1] = E.a0; F[w + 2] = E.a0 + 2 * BAY; });
        W[FX_TAB + k] = o; slots.push(FX_TAB + k);
        q.writeBuffer(this.fx, start * 4, W, start, 1 + n * 3);
      }
    }
    for (const t of slots) q.writeBuffer(this.fx, t * 4, W, t, 1);
  }
}

/** A view drawn off the screen (GpuWorld.shot): its buffers, and the last picture read back (asked for at `at`, with `tag`). */
interface Shot {
  cols: number;
  rows: number;
  out: GPUBuffer;
  read: GPUBuffer;
  bind: GPUBindGroup | null;
  bindGen: number;
  busy: boolean;
  grid: CharGrid;
  at: number;
  tag: string | undefined;
}

/** Words a model takes in fx (packParts). */
function partsSize(parts: Part[]) {
  let chars = 0;
  for (const p of parts) chars += p.text?.length ?? 0;
  return 1 + parts.length * PW + chars;
}

/**
 * A model into W at o (W[0] is fx[base]): its part count, PW words per part, then the parts' texts;
 * returns where it ends.
 */
function packParts(W: Uint32Array, F: Float32Array, o: number, parts: Part[], base: number) {
  let tx = o + 1 + parts.length * PW;
  W[o] = parts.length;
  parts.forEach((p, k) => {
    const w = o + 1 + k * PW;
    W[w] = p.shape; F[w + 1] = p.x0; F[w + 2] = p.y0; F[w + 3] = p.z0; F[w + 4] = p.x1; F[w + 5] = p.y1; F[w + 6] = p.z1;
    F[w + 7] = p.col[0]; F[w + 8] = p.col[1]; F[w + 9] = p.col[2];
    W[w + 10] = p.mat; W[w + 11] = p.side; W[w + 12] = p.top; W[w + 13] = p.end;
    const t = p.text ?? '';
    W[w + 14] = base + tx; W[w + 15] = t.length;
    for (let c = 0; c < t.length; c++) W[tx++] = code(t, c);
    W[w + 16] = p.sym === undefined || p.sym < 0 ? 0 : p.sym + 1;
    const c2 = p.col2;
    F[w + 17] = c2?.[0] ?? 0; F[w + 18] = c2?.[1] ?? 0; F[w + 19] = c2?.[2] ?? 0; W[w + 20] = c2 ? 1 : 0;
    F[w + 21] = p.lamp ?? 0; W[w + 22] = p.bulbs ? 1 : 0; W[w + 23] = 0;
  });
  return tx;
}

/** Words for the objects' models and for a frame's objects in fx. */
const MODEL_CAP = 1 << 20, OBJ_CAP = 1 << 19;
/**
 * How near the doors and escapes are looked at, and the floor plans made (a few every 6 frames): the plans
 * beyond where the rooms start fading in through the windows (1.3 x PEEK_FAR in the shader, 104 m), so a
 * plan never arrives where its rooms would show at once.
 */
const FX_NEAR = 250, FX_PLAN = 130, FX_PLANS = 6;
/** The room kinds, numbered as the shader has them. */
const ROOMS = ['lobby', 'hall', 'stair', 'lift', 'foyer', 'living', 'bedroom', 'kitchen', 'bath', 'office', 'open', 'shop'];

/** A character as the atlas has it (Latin-1): an accent outside it falls back to its plain letter. */
function code(s: string, k: number) {
  const c = s.charCodeAt(k);
  if (c < 256) return c;
  const b = s[k].normalize('NFD').charCodeAt(0);
  return b < 256 ? b : 63;
}

/**
 * The signs' data, one u32 each: a header (the ticker's and the text pool's offsets, the number of
 * businesses, the cranes' offset and count), the 5x7 font for codes 0..255 at SG_FONT, three words per business at SG_BIZ (its
 * full sign name and its longest word, as offset << 8 | length into the pool, and its sign mode),
 * room for the ticker, then the pool, then the Sarcophagus's cranes (four floats each), the smoke vents and the diagonal's X per avenue. The shader cuts the name to a face as signText does.
 */
function signData(city: City) {
  const nb = city.businesses.length, tick = SG_BIZ + nb * 3, pool = tick + TICK_MAX;
  const chars: number[] = [], at = new Map<string, number>();
  const put = (s: string) => {
    let o = at.get(s);
    if (o === undefined) { o = pool + chars.length; at.set(s, o); for (let k = 0; k < s.length; k++) chars.push(code(s, k)); }
    return (o << 8) | Math.min(255, s.length);
  };
  const words: number[] = [];
  for (let b = 0; b < nb; b++) {
    const full = signText(city, b, 255), word = full.split(' ').sort((x, y) => y.length - x.length)[0];
    words.push(put(full), put(word), signMode(city, b));
  }
  // the Sarcophagus's cranes after the pool: x, y, z, a as floats
  // then the smoke vents (x, y, r, h), then per avenue the X the diagonal makes on it (a0, a1; 0, 0 if none)
  const cranes = city.sarcophagus.cranes, cr0 = pool + chars.length, v0 = cr0 + cranes.length * 4, x0 = v0 + city.vents.length * 4;
  const nAv = (city.xb.length >> 1) + 1, zones = diagRoad(city).byRoad;
  const out = new Uint32Array(x0 + nAv * 2);
  out[0] = tick; out[1] = pool; out[2] = nb; out[3] = cr0; out[4] = cranes.length; out[5] = v0; out[6] = city.vents.length; out[7] = x0;
  const OF = new Float32Array(out.buffer);
  OF.set(cranes.flatMap((k) => [k.x, k.y, k.z, k.a]), cr0);
  OF.set(city.vents.flatMap((s) => [s.x, s.y, s.r, s.h]), v0);
  for (let k = 0; k < nAv; k++) { const X = zones.get(1024 + k)?.find((z) => z.isX); if (X) { OF[x0 + k * 2] = X.a0; OF[x0 + k * 2 + 1] = X.a1; } }
  for (let c = 0; c < 256; c++) { const r = fontRows(c); if (r) for (let k = 0; k < 7; k++) out[SG_FONT + c * 7 + k] = r[k]; }
  out.set(words, SG_BIZ);
  out.set(chars, pool);
  return { data: out, tick };
}
