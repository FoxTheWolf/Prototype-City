/**
 * Lights that change every frame: car headlights (cones), tail lights (points) and neon signs
 * (segments along a facade, lighting the side they face). Rebuilt each frame around the viewer and
 * sorted into 8 m buckets, so a point only looks at the few lights that can reach it.
 */
const LightKind = { Point: 0, Cone: 1, Segment: 2, Flood: 3, Panel: 4 } as const;
/**
 * A panel light's size factor: a panel of area A lights a point d away by A' / (d^2 + A'), A' = PANEL_S * A
 * (full on its face, falling as 1 / d^2 farther than its own size). The shader has the same.
 */
export const PANEL_S = 0.6;
// (only the part within ~2d of the point counts, so a long tube falls off as 1 / d and a wide panel up close is even)
/** A wall floodlight's spot stands this far out from its wall (the shader's FLOOD_OUT). */
export const FLOOD_OUT = 1.2;
/**
 * A wall floodlight's beam at (a along the wall, s out from the lamp, height z): as wide as the shader paints it
 * on the wall, leaning in from the lamp to meet the wall by 4 m up, fading to the top it reaches (h).
 */
export function floodBeam(a: number, s: number, z: number, h: number) {
  const w = 1.4 + 0.55 * z, fz = Math.min(1, z / 1.5) * Math.max(0, 1 - z / h) ** 1.2;
  // (not the fixture's own housing, within ~0.25 m of the spot)
  const own = Math.min(1, Math.max(0, (a * a + s * s - 0.06) / 0.1));
  const sc = s + FLOOD_OUT * Math.min(1, z / 4);
  return own * (fz * Math.exp(-(a * a + sc * sc * 4) / (w * w)) + 0.3 * Math.exp(-(a * a + s * s) / 0.6) * Math.max(0, 1 - z));
}

export const CELL = 8, SIDE = 64; // buckets cover 512 m around the viewer
const MAX = 4096;

export class DynLights {
  n = 0;
  /** Panel: 4 + its wrap (0: lights only what faces it, ~1: all round, a bare tube). */
  private kind = new Float32Array(MAX);
  private x = new Float32Array(MAX); private y = new Float32Array(MAX);
  /** Cone: direction. Segment: the other end. */
  private u = new Float32Array(MAX); private w = new Float32Array(MAX);
  /** Segment: the outward normal. Cone: cos of the half angle in nx. */
  private nx = new Float32Array(MAX); private ny = new Float32Array(MAX);
  private range = new Float32Array(MAX);
  /** Full strength up to height zFull, fading to nothing at zTop. */
  private zFull = new Float32Array(MAX); private zTop = new Float32Array(MAX);
  private r = new Float32Array(MAX); private g = new Float32Array(MAX); private b = new Float32Array(MAX);
  /**
   * Segment: brightness of the pieces along it (the letters of a sign), as running sums in `lv`
   * starting at lv0, lvN pieces; lvN = 0 means evenly lit.
   */
  private lv0 = new Int32Array(MAX); private lvN = new Uint16Array(MAX); private lvH = new Float32Array(MAX);
  private lv = new Float32Array(MAX * 8); private lvUsed = 0;
  private buckets: number[][] = Array.from({ length: SIDE * SIDE }, () => []);
  private used: number[] = [];
  private bx = 0; private by = 0;

  /** Start a frame centered on the viewer. */
  begin(x: number, y: number) {
    for (const k of this.used) this.buckets[k].length = 0;
    this.used.length = 0;
    this.n = 0; this.lvUsed = 0;
    this.bx = Math.floor(x / CELL) - SIDE / 2; this.by = Math.floor(y / CELL) - SIDE / 2;
  }

  point(x: number, y: number, range: number, zFull: number, zTop: number, r: number, g: number, b: number) {
    this.add(LightKind.Point, x, y, 0, 0, 0, 0, range, zFull, zTop, r, g, b, x - range, y - range, x + range, y + range);
  }

  /**
   * A beam from (x, y) along (dx, dy). If something stands in it (a car ahead), cut is how far along the beam its back is
   * and slope where it is across (its side offset / cut): past it the beam is shadowed behind it (the shader's lightAt).
   */
  cone(x: number, y: number, dx: number, dy: number, cosHalf: number, range: number, zFull: number, zTop: number, r: number, g: number, b: number, cut = 0, slope = 0) {
    this.add(LightKind.Cone, x, y, dx, dy, cosHalf, cut, range, zFull, zTop, r, g, b, x - range, y - range, x + range, y + range);
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
   * faces the point and how the point's surface faces the panel (the shader's lightAt). levels as in pieces.
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

  /** A strip from (x0, y0) to (x1, y1) shining toward (nx, ny). */
  segment(x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, range: number, zFull: number, zTop: number, r: number, g: number, b: number) {
    this.add(LightKind.Segment, x0, y0, x1, y1, nx, ny, range, zFull, zTop, r, g, b,
      Math.min(x0, x1) - range, Math.min(y0, y1) - range, Math.max(x0, x1) + range, Math.max(y0, y1) + range);
  }

  /**
   * A segment made of pieces with their own brightness (0..1, in order from (x0, y0)): a point takes
   * the brightness of the pieces around its nearest spot on the strip, over a stretch that widens
   * with the distance (right against the wall only the piece in front counts).
   */
  pieces(x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, range: number, zFull: number, zTop: number, r: number, g: number, b: number, levels: number[]) {
    const n = levels.length;
    if (this.lvUsed + n + 1 > this.lv.length || this.n >= MAX) return;
    if (levels.every((l) => l === levels[0])) {
      // all pieces alike (a steady or blinking sign): an ordinary segment
      this.segment(x0, y0, x1, y1, nx, ny, range, zFull, zTop, r * levels[0], g * levels[0], b * levels[0]);
      return;
    }
    this.segment(x0, y0, x1, y1, nx, ny, range, zFull, zTop, r, g, b);
    const i = this.n - 1, o = this.lvUsed;
    this.lv0[i] = o; this.lvN[i] = n; this.lvH[i] = n / Math.hypot(x1 - x0, y1 - y0); this.lv[o] = 0;
    for (let k = 0; k < n; k++) this.lv[o + k + 1] = this.lv[o + k] + levels[k];
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
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) {
      const c = j * SIDE + k;
      if (this.buckets[c].length === 0) this.used.push(c);
      this.buckets[c].push(i);
    }
  }

  /**
   * This frame's lights as flat arrays for the GPU (render/gpu): 16 floats per light (kind, x, y, u, w,
   * nx, ny, range, zFull, zTop, r, g, b, lv0, lvN, lvH), the pieces' running sums, and the buckets as
   * offsets into a list of light indices (SIDE x SIDE + 1 offsets).
   */
  pack() {
    const n = this.n, L = new Float32Array(Math.max(1, n) * 16);
    for (let i = 0; i < n; i++) {
      L.set([this.kind[i], this.x[i], this.y[i], this.u[i], this.w[i], this.nx[i], this.ny[i], this.range[i], this.zFull[i], this.zTop[i], this.r[i], this.g[i], this.b[i], this.lv0[i], this.lvN[i], this.lvH[i]], i * 16);
    }
    const off = new Uint32Array(SIDE * SIDE + 1);
    let total = 0;
    for (let c = 0; c < SIDE * SIDE; c++) { off[c] = total; total += this.buckets[c].length; }
    off[SIDE * SIDE] = total;
    const idx = new Uint32Array(Math.max(1, total));
    for (let c = 0; c < SIDE * SIDE; c++) idx.set(this.buckets[c], off[c]);
    return { lights: L, lv: this.lv.subarray(0, Math.max(1, this.lvUsed)), off, idx, bx: this.bx, by: this.by };
  }

  /** Add the light reaching (px, py) at height pz to out[0..2]. */
  sample(px: number, py: number, pz: number, out: Float32Array) {
    const i = Math.floor(px / CELL) - this.bx, j = Math.floor(py / CELL) - this.by;
    if (i < 0 || j < 0 || i >= SIDE || j >= SIDE) return;
    for (const k of this.buckets[j * SIDE + i]) {
      if (this.kind[k] >= LightKind.Panel) { this.samplePanel(k, px, py, pz, out); continue; }
      const zk = pz <= this.zFull[k] ? 1 : (this.zTop[k] - pz) / (this.zTop[k] - this.zFull[k]);
      if (zk <= 0) continue;
      const R = this.range[k];
      let dx = px - this.x[k], dy = py - this.y[k], f = 0, lvl = 1;
      const kind = Math.floor(this.kind[k]);
      if (kind === LightKind.Flood) {
        const s = dx * this.nx[k] + dy * this.ny[k];
        if (s < 0.1 - FLOOD_OUT) continue; // the wall itself: the shader paints it with the same beam
        f = floodBeam(-dx * this.ny[k] + dy * this.nx[k], s, Math.max(0, pz), this.zFull[k]);
        out[0] += this.r[k] * f; out[1] += this.g[k] * f; out[2] += this.b[k] * f;
        continue;
      }
      if (kind === LightKind.Segment) {
        // distance to the strip, only on the side it faces
        if (dx * this.nx[k] + dy * this.ny[k] < -0.3) continue;
        const sx = this.u[k] - this.x[k], sy = this.w[k] - this.y[k];
        const t = Math.max(0, Math.min(1, (dx * sx + dy * sy) / (sx * sx + sy * sy)));
        dx -= sx * t; dy -= sy * t;
        const n = this.lvN[k];
        if (n) {
          const h = (0.3 + 0.5 * Math.hypot(dx, dy)) * this.lvH[k], c = t * n, a = Math.max(0, c - h), b = Math.min(n, c + h);
          lvl = (this.lvSum(k, b) - this.lvSum(k, a)) / (b - a);
        }
      }
      const d = Math.hypot(dx, dy);
      if (d >= R) continue;
      f = (1 - d / R) ** 2;
      if (kind === LightKind.Cone) {
        const c = (dx * this.u[k] + dy * this.w[k]) / (d || 1), c0 = this.nx[k];
        if (c <= c0) continue;
        f *= Math.min(1, (c - c0) / ((1 - c0) * 0.5));
      }
      f *= zk * lvl;
      out[0] += this.r[k] * f; out[1] += this.g[k] * f; out[2] += this.b[k] * f;
    }
  }
}
