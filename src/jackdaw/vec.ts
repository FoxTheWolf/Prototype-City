/**
 * 15.22: a tiny vector canvas for the Jackdaw's pictures, as the manual draws them (docs/identidade/
 * jackdaw-manual.html, its `gralha` and `headVec` on a 2D canvas): paths of lines and quadratic curves,
 * circles, ellipses and round rectangles, filled (non-zero) or stroked (round caps and joins), a clip, and
 * the save/translate/rotate/scale stack, over a grid of grey (0 ink .. 255 paper). Plain TypeScript, so
 * the bird is the same in the game and in the tests (Node), and nothing is an image file.
 */
type M = [number, number, number, number, number, number];

export class Vec {
  readonly g: Uint8Array;
  private m: M = [1, 0, 0, 1, 0, 0];
  private clipM: Uint8Array | null = null;
  private stack: { m: M; clip: Uint8Array | null }[] = [];
  /** The path: subpaths of device points (x, y pairs), each with whether it was closed. */
  private subs: { p: number[]; closed: boolean }[] = [];
  private cur: number[] | null = null;
  private lx = 0; private ly = 0;
  constructor(readonly w: number, readonly h: number) { this.g = new Uint8Array(w * h).fill(255); }

  save() { this.stack.push({ m: [...this.m] as M, clip: this.clipM }); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s.m; this.clipM = s.clip; } }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this.m = [a, b, c, d, e, f]; }
  private mul(a: number, b: number, c: number, d: number, e: number, f: number) {
    const [A, B, C, D, E, F] = this.m;
    this.m = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + E, B * e + D * f + F];
  }
  translate(x: number, y: number) { this.mul(1, 0, 0, 1, x, y); }
  scale(x: number, y = x) { this.mul(x, 0, 0, y, 0, 0); }
  rotate(a: number) { const c = Math.cos(a), s = Math.sin(a); this.mul(c, s, -s, c, 0, 0); }
  private tx(x: number, y: number): [number, number] { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  private get k() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])); }

  beginPath() { this.subs = []; this.cur = null; }
  moveTo(x: number, y: number) { this.cur = []; this.subs.push({ p: this.cur, closed: false }); this.cur.push(...this.tx(x, y)); this.lx = x; this.ly = y; }
  lineTo(x: number, y: number) { if (!this.cur) return this.moveTo(x, y); this.cur.push(...this.tx(x, y)); this.lx = x; this.ly = y; }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    const x0 = this.lx, y0 = this.ly, n = 10;
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; this.lineTo(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y); }
  }
  closePath() { const s = this.subs[this.subs.length - 1]; if (s) s.closed = true; }
  /** A whole ellipse (rotated by rot) as its own closed subpath. */
  ellipse(x: number, y: number, rx: number, ry: number, rot = 0) {
    const c = Math.cos(rot), s = Math.sin(rot), n = 28;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry, X = x + ex * c - ey * s, Y = y + ex * s + ey * c;
      if (i === 0) this.moveTo(X, Y); else this.lineTo(X, Y);
    }
    this.closePath();
  }
  arc(x: number, y: number, r: number) { this.ellipse(x, y, r, r); }
  roundRect(x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, w / 2, h / 2);
    const corner = (cx: number, cy: number, a0: number) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); this.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } };
    this.moveTo(x + r, y);
    corner(x + w - r, y + r, -Math.PI / 2); corner(x + w - r, y + h - r, 0); corner(x + r, y + h - r, Math.PI / 2); corner(x + r, y + r, Math.PI);
    this.closePath();
  }

  /** The path's coverage (non-zero), one sample a pixel's centre. */
  private cover(): Uint8Array {
    const W = this.w, H = this.h, out = new Uint8Array(W * H);
    let y0 = H, y1 = 0;
    for (const s of this.subs) for (let i = 1; i < s.p.length; i += 2) { y0 = Math.min(y0, s.p[i]); y1 = Math.max(y1, s.p[i]); }
    const xs: { x: number; d: number }[] = [];
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
      const py = y + 0.5;
      xs.length = 0;
      for (const s of this.subs) {
        const p = s.p, n = p.length / 2;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, ax = p[i * 2], ay = p[i * 2 + 1], bx = p[j * 2], by = p[j * 2 + 1];
          if ((ay <= py) === (by <= py)) continue;
          xs.push({ x: ax + ((py - ay) / (by - ay)) * (bx - ax), d: by > ay ? 1 : -1 });
        }
      }
      xs.sort((a, b) => a.x - b.x);
      let wn = 0;
      for (let i = 0; i < xs.length - 1; i++) {
        wn += xs[i].d;
        if (!wn) continue;
        for (let x = Math.max(0, Math.ceil(xs[i].x - 0.5)); x <= Math.min(W - 1, Math.floor(xs[i + 1].x - 0.5)); x++) out[y * W + x] = 1;
      }
    }
    return out;
  }
  private put(cov: Uint8Array, v: number) {
    const C = this.clipM;
    for (let i = 0; i < cov.length; i++) if (cov[i] && (!C || C[i])) this.g[i] = v;
  }
  fill(v: number) { this.put(this.cover(), v); }
  clip() { const c = this.cover(); if (this.clipM) for (let i = 0; i < c.length; i++) c[i] &= this.clipM[i]; this.clipM = c; }
  fillRect(x: number, y: number, w: number, h: number, v: number) { this.beginPath(); this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); this.fill(v); }
  /** The path stroked w wide (in the current units), round caps and joins. */
  stroke(w: number, v: number) {
    const r = (w * this.k) / 2, W = this.w, H = this.h, cov = new Uint8Array(W * H);
    for (const s of this.subs) {
      const p = s.p, n = p.length / 2, segs = s.closed ? n : n - 1;
      for (let i = 0; i < Math.max(1, segs); i++) {
        const j = (i + 1) % n, ax = p[i * 2], ay = p[i * 2 + 1], bx = p[j * 2] ?? ax, by = p[j * 2 + 1] ?? ay;
        const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
        for (let y = Math.max(0, Math.floor(Math.min(ay, by) - r)); y <= Math.min(H - 1, Math.ceil(Math.max(ay, by) + r)); y++)
          for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - r)); x <= Math.min(W - 1, Math.ceil(Math.max(ax, bx) + r)); x++) {
            const qx = x + 0.5 - ax, qy = y + 0.5 - ay, t = L2 ? Math.max(0, Math.min(1, (qx * dx + qy * dy) / L2)) : 0;
            if ((qx - t * dx) ** 2 + (qy - t * dy) ** 2 <= r * r) cov[y * W + x] = 1;
          }
      }
    }
    this.put(cov, v);
  }
}
