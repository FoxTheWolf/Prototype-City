import { faceSpan, type City } from '../../sim/city';
import type { World } from '../../sim/world';
import { gpuPrepare, VFOV, type View } from '../raycaster';
import { CURVE_R } from '../sarcophagus';
import { fontRows, signMode, signText } from '../signs';
import { BLD, BLK, SG_BIZ, SG_FONT, STYLES, TICK_MAX, UNIFORMS, worldWGSL } from './shader';

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
 * ticker, the burnt ground, the fence, the Sarcophagus and its cranes. Not yet: the blade signs and billboards (objects), the doors, the rooms
 * seen through the windows, fire escapes, scaffolding, reliefs, objects, cars, people, interiors,
 * the smoke, rain and snow falling, the glass of the windows indoors.
 */

type UName = (typeof UNIFORMS)[number];
const UIDX = Object.fromEntries(UNIFORMS.map((n, k) => [n, k])) as Record<UName, number>;

export class GpuWorld {
  /** The cells of the last frame: glyph + fg per cell, then bg per cell (CharGrid's layout), read by the compositor. */
  out!: GPUBuffer;
  cols = 0;
  rows = 0;
  /** A true 3D camera (rays turned by the pitch) instead of the CPU's sheared one. */
  cam3d = false;
  private uni: GPUBuffer;
  private U = new Float32Array(Math.ceil(UNIFORMS.length / 4) * 4);
  private pipe: GPUComputePipeline;
  /** The city's lists (fixed), then what changes: substations, light map, lamp colors, dynamic lights. */
  private fixed: GPUBuffer[];
  private subs: GPUBuffer;
  private lmap: GPUBuffer;
  private lampCol: GPUBuffer;
  private dyn: GPUBuffer[] = [];
  private lmapVersion = -1;
  private bind: GPUBindGroup | null = null;
  /** The buildings' floats, kept to write the power grid's part into (substation, generator). */
  private blds: Float32Array;
  private powerSet = false;
  /** The signs' buffer (see signData) and the ticker text last written into it. */
  private sg: GPUBuffer;
  private tickOff = 0;
  private ticker = '';

  static available(): boolean { return typeof navigator !== 'undefined' && 'gpu' in navigator; }

  static async create(city: City): Promise<GpuWorld> {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('no WebGPU adapter');
    const device = await adapter.requestDevice({ requiredLimits: { maxStorageBuffersPerShaderStage: Math.min(16, adapter.limits.maxStorageBuffersPerShaderStage) } });
    return new GpuWorld(device, city);
  }

  private constructor(readonly dev: GPUDevice, private city: City) {
    const C = city;
    const blocks = new Float32Array(C.blocks.length * BLK);
    C.blocks.forEach((b, k) => {
      const ind = C.districts[b.district].type === 'industrial' ? 1 : 0;
      blocks.set([b.x0, b.y0, b.x1, b.y1, b.b0, b.b1, b.maxH, (b.open ? { park: 1, plaza: 2, yard: 3 }[b.open] : 0) | (b.diag << 2) | (ind << 5) | (b.square ? 64 : 0)], k * BLK);
    });
    // per building: box, height, round, cut (flag, nx, ny, c), style, lit, win, frame, feat, shop, tier,
    // sign, neon (+ flag), crown (+ flag), flood + its height, the five faces' spans, substation, generator
    const blds = new Float32Array(C.buildings.length * BLD);
    C.buildings.forEach((B, k) => {
      const K = B.cut, o = k * BLD;
      blds.set([B.x0, B.y0, B.x1, B.y1, B.h, B.round ? 1 : 0, K ? 1 : 0, K?.nx ?? 0, K?.ny ?? 0, K?.c ?? 0, STYLES.indexOf(B.style), B.lit,
        ...B.win, ...B.frame, B.feat, B.shop ? 1 : 0, B.tier, ...B.sign, ...(B.neon ?? [0, 0, 0]), B.neon ? 1 : 0, ...(B.crown ?? [0, 0, 0]), B.crown ? 1 : 0,
        ...(B.flood ?? [0, 0, 0]), B.flood ? B.floodH : 0], o);
      blds.set([B.biz, B.ad, B.screen, B.ticker ? 1 : 0], o + 48);
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
    this.uni = dev.createBuffer({ size: this.U.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const sz = (n: number) => dev.createBuffer({ size: Math.max(16, n), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.subs = sz(64 * 16);
    this.lmap = sz(1024 * 1024 * 4);
    this.lampCol = sz(C.lamps.length * 12);
    const mod = dev.createShaderModule({ code: worldWGSL() });
    mod.getCompilationInfo().then((info) => info.messages.forEach((m) => console[m.type === 'error' ? 'error' : 'warn'](`WGSL ${m.lineNum}:${m.linePos} ${m.message}`)));
    this.pipe = dev.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } });
  }

  /** The screen's size: a new output buffer. */
  resize(cols: number, rows: number) {
    if (cols === this.cols && rows === this.rows) return;
    this.cols = cols; this.rows = rows;
    this.out?.destroy();
    this.out = this.dev.createBuffer({ size: cols * rows * 8, usage: GPUBufferUsage.STORAGE });
    this.bind = null;
  }

  /** A buffer for a list that changes size: grown (by doubling) when it no longer fits; the bind group follows. */
  private fit(k: number, bytes: number) {
    const b = this.dyn[k];
    if (b && b.size >= bytes) return b;
    b?.destroy();
    let size = 256; while (size < bytes) size *= 2;
    this.dyn[k] = this.dev.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    this.bind = null;
    return this.dyn[k];
  }

  /** This frame's world into `out`, as the first pass of the encoder (the compositor draws it in the same submit). */
  encode(enc: GPUCommandEncoder, world: World, v: View) {
    const { cols, rows } = this, C = this.city, q = this.dev.queue;
    const F = gpuPrepare(world, v), sky = F.sky, P = world.power;
    if (F.ticker !== this.ticker) {
      this.ticker = F.ticker;
      const T = new Uint32Array(Math.min(TICK_MAX, F.ticker.length));
      for (let k = 0; k < T.length; k++) T[k] = code(F.ticker, k);
      if (T.length) q.writeBuffer(this.sg, this.tickOff * 4, T);
    }
    if (!this.powerSet) {
      // which substation feeds each building, and whether it has a generator: fixed once the grid exists
      for (let k = 0; k < C.buildings.length; k++) { this.blds[k * BLD + 46] = P.building[k]; this.blds[k * BLD + 47] = P.generator[k]; }
      q.writeBuffer(this.fixed[5], 0, this.blds);
      this.powerSet = true;
    }
    const S = new Float32Array(P.subs.length * 4);
    P.subs.forEach((s, k) => S.set([s.changed < 0 ? -1 : s.changed / 60, s.on ? 1 : 0, s.ox, s.oy], k * 4));
    q.writeBuffer(this.subs, 0, S);
    if (F.light.version !== this.lmapVersion) { this.lmapVersion = F.light.version; q.writeBuffer(this.lmap, 0, F.light.packMap()); }
    q.writeBuffer(this.lampCol, 0, F.light.colors);
    const D = F.dyn.pack();
    [D.lights, D.lv, D.off, D.idx].forEach((a, k) => { const b = this.fit(k, a.byteLength); q.writeBuffer(b, 0, a); });
    if (!this.bind) {
      this.bind = this.dev.createBindGroup({
        layout: this.pipe.getBindGroupLayout(0),
        entries: [this.uni, ...this.fixed, this.out, this.subs, this.lmap, this.lampCol, ...this.dyn, this.sg].map((buffer, binding) => ({ binding, resource: { buffer } })),
      });
    }
    const scale = rows / 2 / Math.tan(VFOV / 2), plane = ((cols / 2) * v.cellAspect) / scale;
    const dirX = Math.cos(v.yaw), dirY = Math.sin(v.yaw), W = world.weather, Dg = C.diagonal, U = this.U;
    const vals: Record<UName, number> = {
      px: v.x, py: v.y, eye: v.eye, dirX, dirY, plX: -dirY * plane, plY: dirX * plane, hor: rows / 2 + Math.tan(v.pitch) * scale,
      scale, cols, rows, sec: (world.tick + v.alpha) / 60, day: sky.day, solid: v.look.solid, sharp: v.look.sharp, fuse: v.look.fuse ? 1 : 0,
      nbx: C.nbx, nxb: C.xb.length, nyb: C.yb.length, curveR: CURVE_R, dox: Dg.ox, doy: Dg.oy, dex: Dg.ex, dey: Dg.ey,
      dnx: Dg.nx, dny: Dg.ny, dw: Dg.w, blocks: v.look.blocks ? 1 : 0, lox: F.light.ox, loy: F.light.oy, dbx: D.bx, dby: D.by,
      sunX: F.sun[0], sunY: F.sun[1], sunZ: F.sun[2], sunEl: sky.sunEl, cloud: sky.cloud, moonlight: sky.moonlight, cityLit: sky.cityLit, flash: sky.flash,
      snow: W.snowCover, wet: W.wet, rain: W.snow ? 0 : W.precip, cam3d: this.cam3d ? 1 : 0, pitch: v.pitch, colW: (2 * plane) / cols, plane, pad0: 0,
      dusk: sky.dusk, sunA: sky.sunA, moonA: sky.moonA, moonEl: sky.moonEl, phase: sky.phase, precip: sky.precip, driftX: sky.driftX, driftY: sky.driftY,
      cityW: C.w, cityH: C.h, ccx: C.cx, ccy: C.cy, sarX: C.sarcophagus.x, sarY: C.sarcophagus.y, sarR: C.sarcophagus.r,
      sarH: C.sarcophagus.h, towX: C.sarcophagus.tx, towY: C.sarcophagus.ty, towR: C.sarcophagus.tr, towH: C.sarcophagus.th,
      starSlots: Math.round((cols * Math.PI) / Math.atan(plane)), tickN: Math.min(TICK_MAX, this.ticker.length),
    };
    for (const k of UNIFORMS) U[UIDX[k]] = vals[k];
    q.writeBuffer(this.uni, 0, U);
    const pass = enc.beginComputePass();
    pass.setPipeline(this.pipe); pass.setBindGroup(0, this.bind);
    pass.dispatchWorkgroups(Math.ceil(cols / 8), Math.ceil(rows / 8));
    pass.end();
  }
}

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
 * room for the ticker, then the pool, then the Sarcophagus's cranes (four floats each). The shader cuts the name to a face as signText does.
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
  const cranes = city.sarcophagus.cranes, cr0 = pool + chars.length;
  const out = new Uint32Array(cr0 + cranes.length * 4);
  out[0] = tick; out[1] = pool; out[2] = nb; out[3] = cr0; out[4] = cranes.length;
  new Float32Array(out.buffer).set(cranes.flatMap((k) => [k.x, k.y, k.z, k.a]), cr0);
  for (let c = 0; c < 256; c++) { const r = fontRows(c); if (r) for (let k = 0; k < 7; k++) out[SG_FONT + c * 7 + k] = r[k]; }
  out.set(words, SG_BIZ);
  out.set(chars, pool);
  return { data: out, tick };
}
