/**
 * Lights that change every frame: car headlights (cones), tail lights (points), wall floodlights, and the
 * lit panels (signs, screens, neon, shop windows, lighting the side they face). Rebuilt each frame around the viewer and
 * sorted into 8 m buckets, so a point only looks at the few lights that can reach it.
 */
const LightKind = { Point: 0, Cone: 1, Flood: 3, Panel: 4 } as const;
/**
 * A panel light's size factor: a panel of area A lights a point d away by A' / (d^2 + A'), A' = PANEL_S * A
 * (full on its face, falling as 1 / d^2 farther than its own size). The shader has the same.
 */
export const PANEL_S = 0.6;
// (only the part within ~2d of the point counts, so a long tube falls off as 1 / d and a wide panel up close is even)
/** A wall floodlight's spot stands this far out from its wall (the shader's FLOOD_OUT). */
export const FLOOD_OUT = 1.2;
/**
 * (16.1c) A wall floodlight's beam, a cone (the shader's floodCone): the lamp FLOOD_Z up at its spot, FLOOD_OUT out from
 * the wall, aimed up and into it so that the cone's outer edge runs up the wall (FLOOD_HALF its half angle, FLOOD_EDGE the
 * soft edge, brighter toward its middle). On the wall it draws the fan of a real uplight: an arc at the bottom (~2.4 m up,
 * the scallop) opening upward, the light falling with the distance; KC: ~5 at its brightest, ~3 m up (a wall washer 1.2 m out lights its wall ~10x what the street lamps do).
 * (a along the wall, s out from the lamp, z the height): the light on what faces the lamp there.
 */
export const FLOOD_Z = 0.3, FLOOD_HALF = 0.2618, FLOOD_EDGE = 0.05, FLOOD_KC = 200;
const FAX = [0, -Math.sin(FLOOD_HALF), Math.cos(FLOOD_HALF)];
export function floodCone(a: number, s: number, z: number) {
  const vz = z - FLOOD_Z, l = Math.hypot(a, s, vz);
  if (l < 0.05) return 0;
  const th = Math.acos(Math.max(-1, Math.min(1, (s * FAX[1] + vz * FAX[2]) / l)));
  const cut = 1 - smh(FLOOD_HALF - FLOOD_EDGE, FLOOD_HALF + FLOOD_EDGE, th);
  return cut * (0.35 + 0.65 * Math.exp(-((th / (FLOOD_HALF * 0.6)) ** 2))) * FLOOD_KC / (l * l + 0.5);
}
const smh = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A wall floodlight's light at (a, s, z) as floodCone, up to the top it reaches (h), with a little spill round the lamp on the pavement. */
export function floodBeam(a: number, s: number, z: number, h: number) {
  // (not the fixture's own housing, within ~0.25 m of the spot)
  const own = Math.min(1, Math.max(0, (a * a + s * s - 0.06) / 0.1));
  return own * (floodCone(a, s, z) * Math.max(0, 1 - z / h) ** 1.2 + 0.3 * Math.exp(-(a * a + s * s) / 0.6) * Math.max(0, 1 - z));
}

/**
 * (16.1c) A headlight's beam pattern (what a lamp maker's photometry gives), the same in the shader's lightAt: s along the
 * beam, a across it (+ to the right), z the height; h the lamp's height, tc the cutoff's slope (HEAD_DIP: the dipped beam
 * lights what stands ahead only below the lamp, a line on the walls and the cars, stepping up on the right toward the
 * signs; HEAD_HIGH: the high beam over it), R its reach. (16.1c, part 3) Its light falls off by the inverse square (HEAD_K:
 * its strength, the street lamps' units), and its beam's lower edge (what it aims at, ~7-11° under the lamp) leaves the road
 * right at the bumper dark; past R it is culled, softly. The value is the old sRGB-coded light's (the shader takes linL of it).
 */
export const HEAD_H = 0.65, HEAD_DIP = -0.01, HEAD_HIGH = 0.04, HEAD_K = 39;
const sm = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export function headBeam(s: number, a: number, z: number, h: number, tc: number, R: number) {
  if (s <= 0.05 || s >= R) return 0;
  const phi = Math.atan2(a, s);
  const zc = h + s * (tc + 0.27 * Math.min(0.12, Math.max(0, phi - 0.02))), soft = 0.04 + 0.015 * s;
  const d2 = s * s + a * a + (z - h) ** 2, below = (h - z) / s;
  return Math.exp(-(((phi - 0.05) / 0.33) ** 2)) * (HEAD_K / (d2 + 1)) ** (1 / 2.2) * (1 - sm(0.12, 0.2, below)) * (1 - sm(0.8 * R, R, s)) * (1 - sm(zc - soft, zc + soft, z));
}

export const CELL = 8, SIDE = 64; // buckets cover 512 m around the viewer
const MAX = 4096;

export class DynLights {
  n = 0;
  /** Panel: 4 + its wrap (0: lights only what faces it, ~1: all round, a bare tube). */
  private kind = new Float32Array(MAX);
  private x = new Float32Array(MAX); private y = new Float32Array(MAX);
  /** Cone: direction. Panel: the other end. */
  private u = new Float32Array(MAX); private w = new Float32Array(MAX);
  /** Panel: the outward normal. Cone: cos of the half angle in nx. */
  private nx = new Float32Array(MAX); private ny = new Float32Array(MAX);
  private range = new Float32Array(MAX);
  /** Full strength up to height zFull, fading to nothing at zTop. */
  private zFull = new Float32Array(MAX); private zTop = new Float32Array(MAX);
  private r = new Float32Array(MAX); private g = new Float32Array(MAX); private b = new Float32Array(MAX);
  /**
   * Panel: brightness of the pieces along it (the letters of a sign), as running sums in `lv`
   * starting at lv0, lvN pieces; lvN = 0 means evenly lit.
   */
  private lv0 = new Int32Array(MAX); private lvN = new Uint16Array(MAX); private lvH = new Float32Array(MAX);
  private lv = new Float32Array(MAX * 8); private lvUsed = 0;
  // (16.1) the buckets as (cell, light) pairs, counted into off/idx when read: lists kept from frame to frame (an array
  // emptied by length = 0 lets its memory go, and refilling them every frame fed the garbage collector)
  private pc = new Uint16Array(1024); private pl = new Uint16Array(1024); private np = 0;
  private off = new Uint32Array(SIDE * SIDE + 1); private idx = new Uint32Array(1024); private sorted = true;
  private L = new Float32Array(MAX * 16);
  private bx = 0; private by = 0;

  /** Start a frame centered on the viewer. */
  begin(x: number, y: number) {
    this.np = 0; this.sorted = false;
    this.n = 0; this.lvUsed = 0;
    this.bx = Math.floor(x / CELL) - SIDE / 2; this.by = Math.floor(y / CELL) - SIDE / 2;
  }

  point(x: number, y: number, range: number, zFull: number, zTop: number, r: number, g: number, b: number) {
    this.add(LightKind.Point, x, y, 0, 0, 0, 0, range, zFull, zTop, r, g, b, x - range, y - range, x + range, y + range);
  }

  /**
   * A headlight's beam from (x, y) along (dx, dy), the lamp h up, its cutoff's slope tc (headBeam). If something stands in it
   * (a car ahead), cut is how far along the beam its back is and slope where it is across (its side offset / cut): past it
   * the beam is shadowed behind it (the shader's lightAt).
   */
  cone(x: number, y: number, dx: number, dy: number, h: number, range: number, tc: number, r: number, g: number, b: number, cut = 0, slope = 0) {
    this.add(LightKind.Cone, x, y, dx, dy, h, cut, range, tc, 99, r, g, b, x - range, y - range, x + range, y + range);
    this.lvH[this.n - 1] = slope;
  }

  /**
   * A floodlight at the foot of a wall (its spot (x, y), the wall's outward normal), aimed up the wall to
   * height h: the same beam the shader paints on the wall, here for what stands in front of it.
   */
  flood(x: number, y: number, nx: number, ny: number, h: number, r: number, g: number, b: number) {
    this.add(LightKind.Flood, x, y, 0, 0, nx, ny, 3, h, h + 1, r, g, b, x - 3, y - 3, x + 3, y + 3);
  }

  /**
   * A lit rectangle standing on the line (x0, y0)-(x1, y1) from height z0 to z1, facing (nx, ny): a sign, a screen,
   * a shop window; a vertical line if the two ends meet (a neon tube up a corner). wrap: how much it also lights
   * what is beside or behind its face (0 a flat screen, 1 a bare tube). Lit by distance in 3D, by how the panel
   * faces the point and how the point's surface faces the panel (the shader's lightAt). levels: the brightness of
   * pieces along it (0..1, from (x0, y0): a sign's letters); a point takes those round its nearest spot on it.
   * Its color (r, g, b) is in linear light, 1 = white (linC), unlike the other lights'.
   */
  panel(x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, z0: number, z1: number, range: number, wrap: number, r: number, g: number, b: number, levels?: number[]) {
    const n = levels?.length ?? 0;
    if (n && this.lvUsed + n + 1 > this.lv.length) return;
    this.add(LightKind.Panel + Math.min(0.99, wrap), x0, y0, x1, y1, nx, ny, range, z0, z1, r, g, b,
      Math.min(x0, x1) - range, Math.min(y0, y1) - range, Math.max(x0, x1) + range, Math.max(y0, y1) + range);
    if (!n || this.n === 0) return;
    const i = this.n - 1, o = this.lvUsed;
    this.lv0[i] = o; this.lvN[i] = n; this.lvH[i] = n / Math.max(0.1, Math.hypot(x1 - x0, y1 - y0)); this.lv[o] = 0;
    for (let k = 0; k < n; k++) this.lv[o + k + 1] = this.lv[o + k] + levels![k];
    this.lvUsed += n + 1;
  }


  /** A panel's light at a point (no surface: as if it faced the panel). */
  private samplePanel(k: number, px: number, py: number, pz: number, out: Float32Array) {
    const wrap = this.kind[k] - LightKind.Panel, enx = this.nx[k], eny = this.ny[k];
    let dx = px - this.x[k], dy = py - this.y[k];
    if (dx * enx + dy * eny < -0.3 && wrap < 0.9) return;
    const sx = this.u[k] - this.x[k], sy = this.w[k] - this.y[k], L2 = sx * sx + sy * sy;
    const t = L2 > 1e-4 ? Math.max(0, Math.min(1, (dx * sx + dy * sy) / L2)) : 0;
    dx -= sx * t; dy -= sy * t;
    const z0 = this.zFull[k], z1 = this.zTop[k], dz = pz - Math.max(z0, Math.min(z1, pz)), d2 = dx * dx + dy * dy + dz * dz, R = this.range[k];
    if (d2 >= R * R) return;
    const d = Math.sqrt(d2) + 0.05, ce = wrap + (1 - wrap) * Math.max(0, (dx * enx + dy * eny) / d);
    const ext = 2 * d + 0.3, S = PANEL_S * Math.min(ext, Math.max(0.3, Math.sqrt(L2))) * Math.min(ext, Math.max(0.3, z1 - z0)), w = 1 - d2 / (R * R);
    let lvl = 1;
    const n = this.lvN[k];
    if (n) {
      const h = (0.3 + 0.5 * Math.sqrt(d2)) * this.lvH[k], c = t * n, a = Math.max(0, c - h), b = Math.min(n, c + h);
      lvl = (this.lvSum(k, b) - this.lvSum(k, a)) / (b - a);
    }
    // (its color is linear light, 1 = white; added here as sRGB, roughly: this only lights the hands)
    const f = ce * (S / (d2 + S)) * w * w * lvl;
    out[0] += 255 * (this.r[k] * f) ** (1 / 2.2); out[1] += 255 * (this.g[k] * f) ** (1 / 2.2); out[2] += 255 * (this.b[k] * f) ** (1 / 2.2);
  }

  /** Running sum of the pieces of light i up to position p (in pieces, may be fractional). */
  private lvSum(i: number, p: number) {
    const o = this.lv0[i], k = Math.floor(p);
    return k >= this.lvN[i] ? this.lv[o + k] : this.lv[o + k] + (this.lv[o + k + 1] - this.lv[o + k]) * (p - k);
  }

  private add(kind: number, x: number, y: number, u: number, w: number, nx: number, ny: number, range: number, zFull: number, zTop: number,
    r: number, g: number, b: number, ax: number, ay: number, bx: number, by: number) {
    if (this.n >= MAX) return;
    const i = this.n++;
    this.kind[i] = kind; this.x[i] = x; this.y[i] = y; this.u[i] = u; this.w[i] = w; this.nx[i] = nx; this.ny[i] = ny;
    this.lvN[i] = 0;
    this.range[i] = range; this.zFull[i] = zFull; this.zTop[i] = zTop; this.r[i] = r; this.g[i] = g; this.b[i] = b;
    const i0 = Math.max(0, Math.floor(ax / CELL) - this.bx), i1 = Math.min(SIDE - 1, Math.floor(bx / CELL) - this.bx);
    const j0 = Math.max(0, Math.floor(ay / CELL) - this.by), j1 = Math.min(SIDE - 1, Math.floor(by / CELL) - this.by);
    const need = this.np + Math.max(0, j1 - j0 + 1) * Math.max(0, i1 - i0 + 1);
    if (need > this.pc.length) {
      let m = this.pc.length; while (m < need) m *= 2;
      const pc = new Uint16Array(m), pl = new Uint16Array(m); pc.set(this.pc); pl.set(this.pl); this.pc = pc; this.pl = pl;
    }
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) { this.pc[this.np] = j * SIDE + k; this.pl[this.np++] = i; }
    this.sorted = false;
  }

  /**
   * This frame's lights as flat arrays for the GPU (render/gpu): 16 floats per light (kind, x, y, u, w,
   * nx, ny, range, zFull, zTop, r, g, b, lv0, lvN, lvH), the pieces' running sums, and the buckets as
   * offsets into a list of light indices (SIDE x SIDE + 1 offsets).
   */
  pack() {
    const n = this.n, L = this.L;
    for (let i = 0, o = 0; i < n; i++, o += 16) {
      L[o] = this.kind[i]; L[o + 1] = this.x[i]; L[o + 2] = this.y[i]; L[o + 3] = this.u[i]; L[o + 4] = this.w[i]; L[o + 5] = this.nx[i]; L[o + 6] = this.ny[i]; L[o + 7] = this.range[i];
      L[o + 8] = this.zFull[i]; L[o + 9] = this.zTop[i]; L[o + 10] = this.r[i]; L[o + 11] = this.g[i]; L[o + 12] = this.b[i]; L[o + 13] = this.lv0[i]; L[o + 14] = this.lvN[i]; L[o + 15] = this.lvH[i];
    }
    this.index();
    // (views of the kept lists: read before the next frame's begin, as the GPU's putDyn copies them at once)
    return { lights: L.subarray(0, Math.max(1, n) * 16), lv: this.lv.subarray(0, Math.max(1, this.lvUsed)), off: this.off, idx: this.idx.subarray(0, Math.max(1, this.np)), bx: this.bx, by: this.by };
  }

  /** The pairs counted into off (where each bucket's lights start in idx) and idx, in the order they were added. */
  private index() {
    if (this.sorted) return;
    this.sorted = true;
    const off = this.off, N = SIDE * SIDE;
    off.fill(0);
    for (let p = 0; p < this.np; p++) off[this.pc[p] + 1]++;
    for (let c = 0; c < N; c++) off[c + 1] += off[c];
    if (this.idx.length < this.np) { let m = this.idx.length; while (m < this.np) m *= 2; this.idx = new Uint32Array(m); }
    // (filled from the back, so the lights of a bucket keep the order they came in)
    for (let p = this.np - 1; p >= 0; p--) { const c = this.pc[p]; this.idx[off[c + 1] - 1 - (this.at[c]++)] = this.pl[p]; }
    this.at.fill(0);
  }
  private at = new Uint32Array(SIDE * SIDE);

  /** Add the light reaching (px, py) at height pz to out[0..2]. */
  sample(px: number, py: number, pz: number, out: Float32Array) {
    const i = Math.floor(px / CELL) - this.bx, j = Math.floor(py / CELL) - this.by;
    if (i < 0 || j < 0 || i >= SIDE || j >= SIDE) return;
    this.index();
    const c = j * SIDE + i;
    for (let e = this.off[c], e1 = this.off[c + 1]; e < e1; e++) {
      const k = this.idx[e];
      if (this.kind[k] >= LightKind.Panel) { this.samplePanel(k, px, py, pz, out); continue; }
      if (Math.floor(this.kind[k]) === LightKind.Cone) {
        const dx = px - this.x[k], dy = py - this.y[k], u = this.u[k], w = this.w[k];
        const f = headBeam(dx * u + dy * w, -dx * w + dy * u, pz, this.nx[k], this.zFull[k], this.range[k]);
        out[0] += this.r[k] * f; out[1] += this.g[k] * f; out[2] += this.b[k] * f;
        continue;
      }
      const zk = pz <= this.zFull[k] ? 1 : (this.zTop[k] - pz) / (this.zTop[k] - this.zFull[k]);
      if (zk <= 0) continue;
      const R = this.range[k];
      const dx = px - this.x[k], dy = py - this.y[k];
      let f = 0;
      const kind = Math.floor(this.kind[k]);
      if (kind === LightKind.Flood) {
        const s = dx * this.nx[k] + dy * this.ny[k];
        if (s < 0.1 - FLOOD_OUT) continue; // the wall itself: the shader paints it with the same beam
        f = floodBeam(-dx * this.ny[k] + dy * this.nx[k], s, Math.max(0, pz), this.zFull[k]);
        out[0] += this.r[k] * f; out[1] += this.g[k] * f; out[2] += this.b[k] * f;
        continue;
      }
      const d = Math.hypot(dx, dy);
      if (d >= R) continue;
      f = (1 - d / R) ** 2 * zk;
      out[0] += this.r[k] * f; out[1] += this.g[k] * f; out[2] += this.b[k] * f;
    }
  }
}
