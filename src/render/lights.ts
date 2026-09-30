/**
 * Lights that change every frame: car headlights (cones), tail lights (points) and neon signs
 * (segments along a facade, lighting the side they face). Rebuilt each frame around the viewer and
 * sorted into 8 m buckets, so a point only looks at the few lights that can reach it.
 */
export const LightKind = { Point: 0, Cone: 1, Segment: 2 } as const;

const CELL = 8, SIDE = 64; // buckets cover 512 m around the viewer
const MAX = 4096;

export class DynLights {
  n = 0;
  private kind = new Uint8Array(MAX);
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

  cone(x: number, y: number, dx: number, dy: number, cosHalf: number, range: number, zFull: number, zTop: number, r: number, g: number, b: number) {
    this.add(LightKind.Cone, x, y, dx, dy, cosHalf, 0, range, zFull, zTop, r, g, b, x - range, y - range, x + range, y + range);
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

  /** Add the light reaching (px, py) at height pz to out[0..2]. */
  sample(px: number, py: number, pz: number, out: Float32Array) {
    const i = Math.floor(px / CELL) - this.bx, j = Math.floor(py / CELL) - this.by;
    if (i < 0 || j < 0 || i >= SIDE || j >= SIDE) return;
    for (const k of this.buckets[j * SIDE + i]) {
      const zk = pz <= this.zFull[k] ? 1 : (this.zTop[k] - pz) / (this.zTop[k] - this.zFull[k]);
      if (zk <= 0) continue;
      const R = this.range[k];
      let dx = px - this.x[k], dy = py - this.y[k], f = 0, lvl = 1;
      const kind = this.kind[k];
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
