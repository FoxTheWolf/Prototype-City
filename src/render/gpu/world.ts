import { BAY, blockAt, faceSpan, SIDEWALK, type City } from '../../sim/city';
import { cachedPlan, escapesOf, exitsOf, floorsOf, habitable, planOf, tiersOf } from '../../sim/interior';
import { diagRoad } from '../../sim/traffic';
import type { World } from '../../sim/world';
import { gpuObjects, gpuPrepare, REL, reliefOf, roofs, VFOV, type View } from '../raycaster';
import type { Part } from '../objects';
import { OW, PW, TILE } from './objects';
import { CURVE_R } from '../sarcophagus';
import { fallShape } from '../precip';
import { fontRows, signMode, signText } from '../signs';
import { BLD, BLK, FX_TAB, SG_BIZ, SG_FONT, STYLES, TICK_MAX, UNIFORMS, worldWGSL } from './shader';

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
 * zone, rain and snow falling. Not yet: interiors, the glass of the windows indoors.
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
  private oW = new Uint32Array(OBJ_CAP);
  private oF = new Float32Array(this.oW.buffer);

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
    this.fxW = new Uint32Array(FX_TAB + 3 * nb + (1 << 20)); this.fxF = new Float32Array(this.fxW.buffer);
    this.fxW[0] = nb;
    this.fxState = new Uint8Array(nb); this.fxPlan = new Uint8Array(nb * 2); this.fxEnd = FX_TAB + 3 * nb;
    // after the facades and plans: the models, then the frame's objects (fx[1] says where)
    this.mBase = this.fxW.length; this.oBase = this.mBase + MODEL_CAP; this.fxW[1] = this.oBase;
    this.mW = new Uint32Array(MODEL_CAP); this.mF = new Float32Array(this.mW.buffer);
    this.fx = dev.createBuffer({ size: (this.oBase + OBJ_CAP) * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    dev.queue.writeBuffer(this.fx, 0, this.fxW);
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
    this.out = this.dev.createBuffer({ size: cols * rows * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
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
      for (let k = 0; k < C.buildings.length; k++) { this.blds[k * BLD + 46] = P.building[k]; this.blds[k * BLD + 47] = P.generator[k]; this.blds[k * BLD + 63] = P.backup[k]; }
      q.writeBuffer(this.fixed[5], 0, this.blds);
      this.powerSet = true;
    }
    const S = new Float32Array(P.subs.length * 4);
    P.subs.forEach((s, k) => S.set([s.changed < 0 ? -1 : s.changed / 60, s.on ? 1 : 0, s.ox, s.oy], k * 4));
    q.writeBuffer(this.subs, 0, S);
    if (F.light.version !== this.lmapVersion) { this.lmapVersion = F.light.version; q.writeBuffer(this.lmap, 0, F.light.packMap()); }
    q.writeBuffer(this.lampCol, 0, F.light.colors);
    this.facades(v.x, v.y);
    const D = F.dyn.pack();
    [D.lights, D.lv, D.off, D.idx].forEach((a, k) => { const b = this.fit(k, a.byteLength); q.writeBuffer(b, 0, a); });
    if (!this.bind) {
      this.bind = this.dev.createBindGroup({
        layout: this.pipe.getBindGroupLayout(0),
        entries: [this.uni, ...this.fixed, this.out, this.subs, this.lmap, this.lampCol, ...this.dyn, this.sg, this.fx].map((buffer, binding) => ({ binding, resource: { buffer } })),
      });
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
      sunX: F.sun[0], sunY: F.sun[1], sunZ: F.sun[2], sunEl: sky.sunEl, cloud: sky.cloud, moonlight: sky.moonlight, cityLit: sky.cityLit, flash: sky.flash,
      snow: W.snowCover, wet: W.wet, rain: W.snow ? 0 : W.precip, cam3d: this.cam3d ? 1 : 0, pitch: v.pitch, colW: (2 * plane) / cols, plane, pad0: 0,
      dusk: sky.dusk, sunA: sky.sunA, moonA: sky.moonA, moonEl: sky.moonEl, phase: sky.phase, precip: sky.precip, driftX: sky.driftX, driftY: sky.driftY,
      cityW: C.w, cityH: C.h, ccx: C.cx, ccy: C.cy, sarX: C.sarcophagus.x, sarY: C.sarcophagus.y, sarR: C.sarcophagus.r,
      sarH: C.sarcophagus.h, towX: C.sarcophagus.tx, towY: C.sarcophagus.ty, towR: C.sarcophagus.tr, towH: C.sarcophagus.th,
      starSlots: Math.round((cols * Math.PI) / Math.atan(plane)), tickN: Math.min(TICK_MAX, this.ticker.length),
      yaw: v.yaw, fall: W.precip, fallSnow: W.snow ? 1 : 0, windX: W.windX, windY: W.windY,
      fallB: Math.floor(Fs.fallen / Fs.period), fallR: Fs.fallen - Math.floor(Fs.fallen / Fs.period) * Fs.period,
      fallSpeed: Fs.speed, fallStreak: Fs.streak, fallDens: Fs.dens, fallPeriod: Fs.period,
    };
    for (const k of UNIFORMS) U[UIDX[k]] = vals[k];
    this.objects(world, v, scale, plane, vals.hor);
    q.writeBuffer(this.uni, 0, U);
    const pass = enc.beginComputePass();
    pass.setPipeline(this.pipe); pass.setBindGroup(0, this.bind);
    pass.dispatchWorkgroups(Math.ceil(cols / 8), Math.ceil(rows / 8));
    pass.end();
  }

  /** A model's offset in fx, written into the model area the first time it is seen (-1: the area is full). */
  private model(parts: Part[]): number {
    const at = this.models.get(parts);
    if (at !== undefined) return at;
    let chars = 0;
    for (const p of parts) chars += p.text?.length ?? 0;
    const n = 1 + parts.length * PW + chars;
    if (this.mEnd + n > MODEL_CAP) return -1;
    const W = this.mW, F = this.mF, o = this.mEnd;
    let tx = o + 1 + parts.length * PW;
    W[o] = parts.length;
    parts.forEach((p, k) => {
      const w = o + 1 + k * PW;
      W[w] = p.shape; F[w + 1] = p.x0; F[w + 2] = p.y0; F[w + 3] = p.z0; F[w + 4] = p.x1; F[w + 5] = p.y1; F[w + 6] = p.z1;
      F[w + 7] = p.col[0]; F[w + 8] = p.col[1]; F[w + 9] = p.col[2];
      W[w + 10] = p.mat; W[w + 11] = p.side; W[w + 12] = p.top; W[w + 13] = p.end;
      const t = p.text ?? '';
      W[w + 14] = this.mBase + tx; W[w + 15] = t.length;
      for (let c = 0; c < t.length; c++) W[tx++] = code(t, c);
      W[w + 16] = p.sym === undefined || p.sym < 0 ? 0 : p.sym + 1;
      const c2 = p.col2;
      F[w + 17] = c2?.[0] ?? 0; F[w + 18] = c2?.[1] ?? 0; F[w + 19] = c2?.[2] ?? 0; W[w + 20] = c2 ? 1 : 0;
      F[w + 21] = p.lamp ?? 0; W[w + 22] = p.bulbs ? 1 : 0; W[w + 23] = 0;
    });
    this.mEnd = tx;
    this.models.set(parts, this.mBase + o);
    return this.mBase + o;
  }

  /**
   * The frame's objects (raycaster.ts, gpuObjects) into fx: each one's screen box (its bounding box's
   * corners projected), the 8-column tiles it covers, and its model (sent once). When the model area
   * fills, it starts over and the frame is packed again.
   */
  private objects(world: World, v: View, scale: number, plane: number, hor: number) {
    const { cols, rows } = this, q = this.dev.queue;
    const dirX = Math.cos(v.yaw), dirY = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch), c3 = this.cam3d;
    // the cone the objects are gathered in: the 3D camera turned up or down sees wider at its top or bottom rows
    const den = cp - Math.abs(sp) * Math.tan(VFOV / 2);
    const list = gpuObjects(world, v, cols, !c3 ? plane : den > 0.15 ? plane / den : 1e3);
    const nT = Math.ceil(cols / TILE), box: number[] = [], mods: number[] = [], picked: number[] = [];
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
      box.length = 0; mods.length = 0; picked.length = 0;
      let full = false;
      for (let k = 0; k < list.length; k++) {
        const { o, far, zoff } = list[k];
        const tY = (o.x - v.x) * dirX + (o.y - v.y) * dirY;
        if (tY + o.r < 0.3 || tY - o.r > far) continue;
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, behind = false;
        const zl = (o.z0 ?? 0) + zoff - 0.4, zh = o.h + zoff + 0.4;
        for (let c = 0; c < 8; c++) {
          if (!proj(o.x + (c & 1 ? o.r : -o.r), o.y + (c & 2 ? o.r : -o.r), c & 4 ? zh : zl)) { behind = true; break; }
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
        if (behind) { x0 = 0; x1 = cols; y0 = 0; y1 = rows; }
        const bx0 = Math.max(0, Math.floor(x0) - 1), bx1 = Math.min(cols, Math.ceil(x1) + 1), by0 = Math.max(0, Math.floor(y0) - 1), by1 = Math.min(rows, Math.ceil(y1) + 1);
        if (bx0 >= bx1 || by0 >= by1) continue;
        const m = this.model(o.parts);
        if (m < 0) { full = true; break; }
        picked.push(k); mods.push(m); box.push(bx0, bx1, by0, by1);
      }
      if (!full) break;
      this.models = new WeakMap(); this.mEnd = 0; this.mSent = 0;
    }
    if (this.mEnd > this.mSent) { q.writeBuffer(this.fx, (this.mBase + this.mSent) * 4, this.mW, this.mSent, this.mEnd - this.mSent); this.mSent = this.mEnd; }
    // the tiles' lists: counted, then filled
    const n = picked.length, W = this.oW, F = this.oF, cnt = new Uint32Array(nT + 1);
    for (let j = 0; j < n; j++) for (let t = Math.floor(box[j * 4] / TILE); t <= Math.floor((box[j * 4 + 1] - 1) / TILE); t++) cnt[t]++;
    const tab = 6, lst = tab + nT + 1;
    let total = 0;
    for (let t = 0; t < nT; t++) { W[tab + t] = total; total += cnt[t]; }
    W[tab + nT] = total;
    // after the objects, this frame's roofs that keep the rain off (gatherRoofs): x, y, c, s, hx, hy, z
    const ob = lst + total, rb = ob + n * OW, nR = roofs.length;
    if (rb + nR * 7 > OBJ_CAP) { W.fill(0, 0, 6); q.writeBuffer(this.fx, this.oBase * 4, W, 0, 6); return; }
    roofs.forEach((R, k) => F.set([R.x, R.y, R.c, R.s, R.hx, R.hy, R.z], rb + k * 7));
    const fill = cnt.fill(0);
    for (let j = 0; j < n; j++) {
      for (let t = Math.floor(box[j * 4] / TILE); t <= Math.floor((box[j * 4 + 1] - 1) / TILE); t++) W[lst + W[tab + t] + fill[t]++] = j;
      const { o, far, zoff } = list[picked[j]], w = ob + j * OW, lean = o.lift !== undefined;
      F[w] = o.x; F[w + 1] = o.y; F[w + 2] = o.c; F[w + 3] = o.s; F[w + 4] = o.r; F[w + 5] = o.h; F[w + 6] = o.z0 ?? 0;
      W[w + 7] = o.seed | 0; F[w + 8] = far; F[w + 9] = zoff;
      F[w + 10] = lean ? o.pitch ?? 0 : 0; F[w + 11] = lean ? o.roll ?? 0 : 0; F[w + 12] = lean ? o.lift ?? 0 : 0; F[w + 13] = o.wheel ?? 0;
      W[w + 14] = lean ? 1 : 0; W[w + 15] = mods[j];
      W[w + 16] = box[j * 4]; W[w + 17] = box[j * 4 + 1]; W[w + 18] = box[j * 4 + 2]; W[w + 19] = box[j * 4 + 3];
    }
    W[0] = n; W[1] = nT; W[2] = ob; W[3] = lst; W[4] = rb; W[5] = nR;
    q.writeBuffer(this.fx, this.oBase * 4, W, 0, rb + nR * 7);
  }

  /** Start over when the near buffer is full: the tables cleared, everything written again as it is looked at. */
  private fxReset() {
    const nb = this.city.buildings.length;
    this.fxState.fill(0); this.fxPlan.fill(0);
    this.fxW.fill(0, FX_TAB, FX_TAB + 3 * nb); this.fxEnd = FX_TAB + 3 * nb;
    this.dev.queue.writeBuffer(this.fx, 0, this.fxW, 0, this.fxEnd);
  }

  /** Room for n words at the end of the near buffer (its offset), or -1 after starting over. */
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
    const C = this.city, W = this.fxW, F = this.fxF, nb = C.buildings.length, q = this.dev.queue;
    let plans = FX_PLANS;
    const start = this.fxEnd, slots: number[] = [];
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
              if (!P || P.box !== (f ? j : k) || this.fxPlan[P.box * 2 + (f ? 1 : 0)]) continue;
              const o = this.fxTake(6 + P.rooms.length * 6 + Math.ceil(P.cells.length / 4));
              if (o < 0) return;
              W[o] = P.gx; W[o + 1] = P.gy; W[o + 2] = P.nx; W[o + 3] = P.ny; W[o + 4] = P.rooms.length; W[o + 5] = k;
              P.rooms.forEach((R, r) => { const w = o + 6 + r * 6; F[w] = R.x0; F[w + 1] = R.y0; F[w + 2] = R.x1; F[w + 3] = R.y1; W[w + 4] = ROOMS.indexOf(R.kind); W[w + 5] = R.unit; });
              W.set(new Uint32Array(P.cells.buffer, P.cells.byteOffset, P.cells.length >> 2), o + 6 + P.rooms.length * 6);
              if (P.cells.length & 3) { const c0 = P.cells.length & ~3; let v = 0; for (let c = c0; c < P.cells.length; c++) v |= P.cells[c] << ((c - c0) * 8); W[o + 6 + P.rooms.length * 6 + (c0 >> 2)] = v; }
              this.fxPlan[P.box * 2 + (f ? 1 : 0)] = 1;
              const t = FX_TAB + nb + P.box * 2 + (f ? 1 : 0); W[t] = o; slots.push(t);
            }
            f0 = Math.max(f0, top);
          }
        }
        const want = cachedPlan(C, k, 0) ? 2 : 1;
        if (this.fxState[k] >= want) continue;
        const doors = exitsOf(C, k, true), escs = escapesOf(C, k), n = doors.length + escs.length;
        const o = n ? this.fxTake(1 + n * 3) : 0;
        if (o < 0) return;
        this.fxState[k] = want;
        if (!n) continue;
        W[o] = n;
        doors.forEach((D, e) => { W[o + 1 + e * 3] = D.face << 4; F[o + 2 + e * 3] = D.a0; F[o + 3 + e * 3] = D.a1; });
        escs.forEach((E, e) => { const w = o + 1 + (doors.length + e) * 3; W[w] = 1 | (E.face << 4); F[w + 1] = E.a0; F[w + 2] = E.a0 + 2 * BAY; });
        W[FX_TAB + k] = o; slots.push(FX_TAB + k);
      }
    }
    if (this.fxEnd > start) q.writeBuffer(this.fx, start * 4, W, start, this.fxEnd - start);
    for (const t of slots) q.writeBuffer(this.fx, t * 4, W, t, 1);
  }
}

/** Words for the objects' models and for a frame's objects in fx. */
const MODEL_CAP = 1 << 20, OBJ_CAP = 1 << 18;
/** How near the doors and escapes are looked at, and the floor plans made (a few every 6 frames). */
const FX_NEAR = 250, FX_PLAN = 80, FX_PLANS = 4;
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
