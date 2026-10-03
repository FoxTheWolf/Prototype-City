import type { City } from '../../sim/city';
import { FLOOR_H, SIDEWALK, LANE_W } from '../../sim/city';
import type { World } from '../../sim/world';
import { VFOV, type View } from '../raycaster';
import { CURVE_R } from '../sarcophagus';
import { prepareSky } from '../sky';

/**
 * Stage R.2: a prototype of the world drawn on the GPU (WebGPU). The city goes up once as lists
 * (street boundaries, blocks, buildings); a compute shader casts one 3D ray per cell (no y-shearing
 * per column: the same projection as the CPU's for now, so the two can be compared) and writes the
 * cell's glyph and colors. Only the ground, the walls with their windows, the roofs and the sky:
 * enough to measure. The compositor (compositor.ts) draws the cells in the same submit: the world
 * reaches the screen in the frame it was drawn for, without coming back to the CPU.
 */

const STYLES = ['office', 'glass', 'brick', 'historic', 'residential', 'warehouse', 'crown', 'spire', 'dome', 'tank', 'chimney', 'mech'];
const OPEN: Record<string, number> = { park: 1, plaza: 2, yard: 3 };
const BLK = 8, BLD = 24, UNI = 32;

const WGSL = /* wgsl */ `
struct U {
  px: f32, py: f32, eye: f32, dirX: f32, dirY: f32, plX: f32, plY: f32, hor: f32,
  scale: f32, cols: f32, rows: f32, sec: f32, day: f32, solid: f32, cw: f32, ch: f32,
  nbx: f32, nxb: f32, nyb: f32, curveR: f32, dox: f32, doy: f32, dex: f32, dey: f32,
  dnx: f32, dny: f32, dw: f32, p0: f32, p1: f32, p2: f32, p3: f32, p4: f32,
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> xb: array<f32>;
@group(0) @binding(2) var<storage, read> yb: array<f32>;
@group(0) @binding(3) var<storage, read> xc: array<u32>;
@group(0) @binding(4) var<storage, read> yc: array<u32>;
@group(0) @binding(5) var<storage, read> blk: array<f32>;
@group(0) @binding(6) var<storage, read> bld: array<f32>;
@group(0) @binding(7) var<storage, read_write> outp: array<u32>;

const FLOOR_H = ${FLOOR_H};
const SIDEWALK = ${SIDEWALK};
const LANE_W = ${LANE_W};

// the same hash as core/rng.ts's hash3 (32-bit wrapping products)
fn hash3(a: i32, b: i32, c: i32) -> f32 {
  var h = (u32(a) * 374761393u) ^ (u32(b) * 668265263u) ^ (u32(c) * 2147483647u);
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h) / 4294967296.0;
}
fn put(i: u32, n: u32, ch: u32, c: vec3f) {
  let k = vec3u(clamp(c, vec3f(0.0), vec3f(255.0)));
  outp[i] = ch | (k.x << 8u) | (k.y << 16u) | (k.z << 24u);
  let b = vec3u(clamp(c * u.solid, vec3f(0.0), vec3f(255.0)));
  outp[n + i] = b.x | (b.y << 8u) | (b.z << 16u) | (255u << 24u);
}
fn colOf(o: u32) -> vec3f { return vec3f(bld[o], bld[o + 1u], bld[o + 2u]); }

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let cols = u32(u.cols); let rows = u32(u.rows);
  if (gid.x >= cols || gid.y >= rows) { return; }
  let n = cols * rows; let i = gid.y * cols + gid.x;
  let camX = 2.0 * (f32(gid.x) + 0.5) / u.cols - 1.0;
  let rdx = u.dirX + u.plX * camX; let rdy = u.dirY + u.plY * camX;
  let L = sqrt(rdx * rdx + rdy * rdy);
  // the ray's height: z(t) = eye - m t - (t L)^2 / 2R (the ground falls away over the curve)
  let m = (f32(gid.y) + 0.5 - u.hor) / u.scale;
  let A = L * L / (2.0 * u.curveR);
  var tG = 1e9;
  if (m > 0.0) { let disc = m * m - 4.0 * A * u.eye; if (disc > 0.0) { tG = 2.0 * u.eye / (m + sqrt(disc)); } }

  // ---- walk the street grid front to back, as the CPU does, but for this one cell's ray
  let ix = select(1e12, 1.0 / rdx, rdx != 0.0); let iy = select(1e12, 1.0 / rdy, rdy != 0.0);
  let stX = select(1, -1, rdx < 0.0); let stY = select(1, -1, rdy < 0.0);
  let W = arrayLength(&xc); let H = arrayLength(&yc);
  var cx = i32(xc[u32(clamp(u.px, 0.0, f32(W - 1u)))]);
  var cy = i32(yc[u32(clamp(u.py, 0.0, f32(H - 1u)))]);
  let nx = i32(u.nxb) - 1; let ny = i32(u.nyb) - 1;
  var tx = (select(xb[cx + 1], xb[cx], rdx < 0.0) - u.px) * ix;
  var ty = (select(yb[cy + 1], yb[cy], rdy < 0.0) - u.py) * iy;
  var tIn = 0.0;
  var best = 1e9; var bk = -1; var bside = 0; var roof = false;
  for (var s = 0; s < 512; s++) {
    if (tIn > tG) { break; }
    let tOut = min(tx, ty);
    if ((cx & 1) == 1 && (cy & 1) == 1) {
      let o = u32(((cy >> 1) * i32(u.nbx) + (cx >> 1)) * ${BLK});
      let b0 = i32(blk[o + 4u]); let b1 = i32(blk[o + 5u]); let maxH = blk[o + 6u];
      let zMin = min(u.eye - m * tIn - A * tIn * tIn, u.eye - m * tOut - A * tOut * tOut);
      if (b1 > b0 && zMin < maxH) {
        for (var k = b0; k < b1; k++) {
          let q = u32(k * ${BLD});
          let x0 = bld[q]; let y0 = bld[q + 1u]; let x1 = bld[q + 2u]; let y1 = bld[q + 3u]; let h = bld[q + 4u];
          var tN = 0.0; var tF = 0.0; var side = 0;
          if (bld[q + 5u] > 0.5) {
            let rr = (x1 - x0) * 0.5; let ox = u.px - (x0 + rr); let oy = u.py - (y0 + rr);
            let qa = rdx * rdx + rdy * rdy; let qb = ox * rdx + oy * rdy;
            let disc = qb * qb - qa * (ox * ox + oy * oy - rr * rr);
            if (disc <= 0.0) { continue; }
            tN = (-qb - sqrt(disc)) / qa; tF = (-qb + sqrt(disc)) / qa; side = 2;
          } else {
            let ax = (x0 - u.px) * ix; let bx = (x1 - u.px) * ix; let ay = (y0 - u.py) * iy; let by = (y1 - u.py) * iy;
            let nnx = min(ax, bx); let nny = min(ay, by);
            tF = min(max(ax, bx), max(ay, by)); tN = max(nnx, nny); side = select(1, 0, nnx > nny);
            if (bld[q + 6u] > 0.5) {
              let knx = bld[q + 7u]; let kny = bld[q + 8u]; let kc = bld[q + 9u];
              let dn = knx * rdx + kny * rdy; let th = (kc - knx * u.px - kny * u.py) / dn;
              if (dn < 0.0) { if (th > tN) { tN = th; side = 3; } }
              else if (dn > 0.0) { tF = min(tF, th); }
              else if (knx * u.px + kny * u.py > kc) { continue; }
            }
          }
          if (tN <= 0.01 || tN >= tF || tN >= best) { continue; }
          let zN = u.eye - m * tN - A * tN * tN;
          if (zN >= 0.0 && zN <= h) { best = tN; bk = k; bside = side; roof = false; }
          else if (zN > h && m > 0.0) {
            let tr = (u.eye - h) / m;
            if (tr <= tF && tr < best) { best = tr; bk = k; bside = side; roof = true; }
          }
        }
        if (bk >= 0) { break; }
      }
    }
    if (tx < ty) { cx += stX; tIn = tx; if (cx < 0 || cx >= nx) { break; } tx = (select(xb[cx + 1], xb[cx], rdx < 0.0) - u.px) * ix; }
    else { cy += stY; tIn = ty; if (cy < 0 || cy >= ny) { break; } ty = (select(yb[cy + 1], yb[cy], rdy < 0.0) - u.py) * iy; }
  }
  let night = 1.0 - u.day;

  // ---- a wall or a roof
  if (bk >= 0 && best < tG) {
    let q = u32(bk * ${BLD});
    let hx = u.px + best * rdx; let hy = u.py + best * rdy;
    let fog = 1.0 - min(1.0, best / 1500.0) * 0.75;
    let frame = colOf(q + 15u); let win = colOf(q + 12u);
    if (roof) { put(i, n, 46u, frame * 0.35 * fog); return; }
    var along = 0.0; var lk = 1.0;
    if (bside == 2) {
      let rr = (bld[q + 2u] - bld[q]) * 0.5; let nxx = (hx - bld[q] - rr) / rr; let nyy = (hy - bld[q + 1u] - rr) / rr;
      along = (atan2(nyy, nxx) + 3.14159265) * rr; lk = 0.72 + 0.28 * abs(nxx);
    } else if (bside == 3) { along = hx * bld[q + 8u] - hy * bld[q + 7u]; lk = 0.72 + 0.28 * abs(bld[q + 7u]); }
    else { along = select(hx, hy, bside == 0); lk = select(0.72, 1.0, bside == 0); }
    let z = u.eye - m * best - A * best * best;
    let style = i32(bld[q + 10u]); let lit = bld[q + 11u];
    let fl = floor(z / FLOOR_H); let fz = z / FLOOR_H - fl;
    let bay = floor(along / 1.6); let fa = along / 1.6 - bay;
    let rowM = best / u.scale; // metres one row covers here
    let shade = lk * fog * (0.55 + 0.45 * u.day);
    let isWin = fz > 0.3 && fz < 0.84 && fa > select(0.18, 0.06, style == 1) && fa < select(0.82, 0.94, style == 1) && z > 3.2;
    if (rowM > 1.4) {
      // far: a floor is under three rows, the windows blend into one glyph
      let on = hash3(bk, i32(bay), i32(fl)) < lit * night;
      if (on) { put(i, n, select(58u, 43u, hash3(bk, i32(bay), 7) < 0.5), win * 0.75 * fog); }
      else { put(i, n, select(46u, 58u, fz < 0.5), frame * 0.45 * shade); }
      return;
    }
    if (isWin) {
      let on = hash3(bk, i32(bay), i32(fl)) < lit * night;
      if (on) { put(i, n, select(64u, 56u, fz > 0.6), win * (0.85 + 0.15 * hash3(bk, i32(bay), i32(fl) + 9)) * fog); }
      else { put(i, n, 35u, frame * 0.3 * shade + vec3f(8.0, 10.0, 16.0) * night); }
    } else if (fz < 0.08 || fz > 0.95) { put(i, n, 61u, frame * 0.7 * shade); }
    else { put(i, n, select(58u, 124u, fa < 0.06 || fa > 0.94), frame * 0.55 * shade); }
    return;
  }

  // ---- the ground
  if (tG < 1e8) {
    let wx = u.px + rdx * tG; let wy = u.py + rdy * tG;
    if (wx < 0.0 || wy < 0.0 || wx >= f32(W) || wy >= f32(H)) { put(i, n, 46u, vec3f(60.0, 30.0, 18.0)); return; }
    if (tG > 600.0) { put(i, n, 46u, vec3f(28.0, 24.0, 32.0)); return; }
    let fog = 1.0 - (tG / 600.0) * 0.9;
    let gx = i32(xc[u32(wx)]); let gy = i32(yc[u32(wy)]);
    let hv = hash3(i32(floor(wx * 1.2)), i32(floor(wy * 1.2)), 3);
    var ch = 46u; var c = vec3f(38.0, 38.0, 46.0);
    let roadX = (gx & 1) == 0; let roadY = (gy & 1) == 0;
    let sD = (wx - u.dox) * u.dnx + (wy - u.doy) * u.dny; let pastD = abs(sD) - u.dw * 0.5;
    if (pastD < 0.0 || roadX || roadY) {
      ch = select(select(39u, 44u, hv < 0.8), 46u, hv < 0.5);
      if (pastD >= 0.0 && roadX != roadY && tG < 200.0) {
        let across = select(wy - (yb[gy] + yb[gy + 1]) * 0.5, wx - (xb[gx] + xb[gx + 1]) * 0.5, roadX);
        let a = abs(across); let ml = a % LANE_W;
        if (a < 0.3) { ch = select(45u, 124u, roadX); c = vec3f(210.0, 170.0, 60.0); }
        else if (min(ml, LANE_W - ml) < 0.12 && i32(floor(select(wx, wy, roadX) / 3.0)) % 2 == 0) { ch = select(45u, 124u, roadX); c = vec3f(150.0); }
      }
    } else {
      let o = u32(((gy >> 1) * i32(u.nbx) + (gx >> 1)) * ${BLK});
      let edge = min(min(wx - blk[o], blk[o + 2u] - wx), min(wy - blk[o + 1u], blk[o + 3u] - wy));
      let opk = u32(blk[o + 7u]) & 3u;
      if (edge < SIDEWALK) {
        let fx = fract(wx / 1.5); let fy = fract(wy / 1.5);
        ch = select(58u, 43u, fx < 0.08 || fy < 0.08); c = vec3f(78.0, 74.0, 78.0);
      } else if (opk == 1u) { ch = select(select(59u, 44u, hv < 0.7), 34u, hv < 0.4); c = vec3f(40.0, 95.0 + hv * 40.0, 45.0); }
      else if (opk == 2u) { let fx = fract(wx / 2.5); let fy = fract(wy / 2.5); ch = select(58u, 43u, fx < 0.06 || fy < 0.06); c = vec3f(92.0, 86.0, 80.0); }
      else { ch = select(44u, 46u, hv < 0.7); c = vec3f(50.0, 48.0, 52.0); }
    }
    put(i, n, ch, c * fog * (0.7 + 0.6 * u.day));
    return;
  }

  // ---- the sky: a gradient, stars at night
  let up = clamp(-m * 1.2, 0.0, 1.0);
  var sky = mix(vec3f(26.0, 22.0, 40.0), vec3f(5.0, 7.0, 18.0), up);
  sky = mix(sky, mix(vec3f(150.0, 165.0, 190.0), vec3f(90.0, 120.0, 170.0), up), u.day);
  let az = atan2(rdy, rdx);
  if (night > 0.5 && hash3(i32(az * 700.0), i32(m * 300.0), 5) < 0.004) { put(i, n, 46u, vec3f(170.0, 170.0, 190.0)); return; }
  put(i, n, 32u, sky);
}
`;

export class GpuWorld {
  /** The cells of the last frame: glyph + fg per cell, then bg per cell (CharGrid's layout), read by the compositor. */
  out!: GPUBuffer;
  cols = 0;
  rows = 0;
  private bind!: GPUBindGroup;
  private uni: GPUBuffer;
  private U = new Float32Array(UNI);
  private pipe: GPUComputePipeline;
  private bufs: GPUBuffer[];

  static available(): boolean { return typeof navigator !== 'undefined' && 'gpu' in navigator; }

  static async create(city: City): Promise<GpuWorld> {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) throw new Error('no WebGPU adapter');
    const device = await adapter.requestDevice();
    return new GpuWorld(device, city);
  }

  private constructor(readonly dev: GPUDevice, private city: City) {
    const C = city;
    const blocks = new Float32Array(C.blocks.length * BLK);
    C.blocks.forEach((b, k) => {
      const ind = C.districts[b.district].type === 'industrial' ? 1 : 0;
      blocks.set([b.x0, b.y0, b.x1, b.y1, b.b0, b.b1, b.maxH, (b.open ? OPEN[b.open] : 0) | (b.diag << 2) | (ind << 5)], k * BLK);
    });
    const blds = new Float32Array(C.buildings.length * BLD);
    C.buildings.forEach((B, k) => {
      const K = B.cut;
      blds.set([B.x0, B.y0, B.x1, B.y1, B.h, B.round ? 1 : 0, K ? 1 : 0, K?.nx ?? 0, K?.ny ?? 0, K?.c ?? 0, STYLES.indexOf(B.style), B.lit, ...B.win, ...B.frame, B.feat], k * BLD);
    });
    const store = (a: Float32Array | Uint32Array) => {
      const b = this.dev.createBuffer({ size: Math.max(16, a.byteLength), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      this.dev.queue.writeBuffer(b, 0, a); return b;
    };
    this.bufs = [new Float32Array(C.xb), new Float32Array(C.yb), Uint32Array.from(C.xCell), Uint32Array.from(C.yCell), blocks, blds].map(store);
    this.uni = dev.createBuffer({ size: UNI * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const mod = dev.createShaderModule({ code: WGSL });
    mod.getCompilationInfo().then((info) => info.messages.forEach((m) => console[m.type === 'error' ? 'error' : 'warn'](`WGSL ${m.lineNum}:${m.linePos} ${m.message}`)));
    this.pipe = dev.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } });
  }

  /** The screen's size: a new output buffer. */
  resize(cols: number, rows: number) {
    if (cols === this.cols && rows === this.rows) return;
    this.cols = cols; this.rows = rows;
    this.out?.destroy();
    this.out = this.dev.createBuffer({ size: cols * rows * 8, usage: GPUBufferUsage.STORAGE });
    this.bind = this.dev.createBindGroup({
      layout: this.pipe.getBindGroupLayout(0),
      entries: [this.uni, ...this.bufs, this.out].map((buffer, binding) => ({ binding, resource: { buffer } })),
    });
  }

  /** This frame's world into `out`, as the first pass of the encoder (the compositor draws it in the same submit). */
  encode(enc: GPUCommandEncoder, world: World, v: View) {
    const { cols, rows } = this, C = this.city;
    const scale = rows / 2 / Math.tan(VFOV / 2), plane = ((cols / 2) * v.cellAspect) / scale;
    const dirX = Math.cos(v.yaw), dirY = Math.sin(v.yaw), sec = (world.tick + v.alpha) / 60;
    const sky = prepareSky(C, world.power, world.weather, world.seed, world.ptime + (world.time - world.ptime) * v.alpha, sec);
    const D = C.diagonal;
    this.U.set([v.x, v.y, v.eye, dirX, dirY, -dirY * plane, dirX * plane, rows / 2 + Math.tan(v.pitch) * scale,
      scale, cols, rows, sec, sky.day, v.look.solid, 0, 0,
      C.nbx, C.xb.length, C.yb.length, CURVE_R, D.ox, D.oy, D.ex, D.ey,
      D.nx, D.ny, D.w, 0, 0, 0, 0, 0]);
    this.dev.queue.writeBuffer(this.uni, 0, this.U);
    const pass = enc.beginComputePass();
    pass.setPipeline(this.pipe); pass.setBindGroup(0, this.bind);
    pass.dispatchWorkgroups(Math.ceil(cols / 8), Math.ceil(rows / 8));
    pass.end();
  }
}
