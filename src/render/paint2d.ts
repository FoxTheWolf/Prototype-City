import { hash3, mulberry32 } from '../core/rng';
import { HdOrder, type HdLayer } from './hd';
import { fontRows } from './signs';

/**
 * 15.17b: the 2D painter the Ferret's kit draws with (docs/identidade/ferret-manual.html), in plain
 * TypeScript over pixels (no canvas: it runs in Node and could run in a worker). Shapes take a cheap
 * 2 x 2 coverage on their edges (round corners, circles, polygons); the rest is whole pixels, jagged as
 * the web of 2008 was. Everything is clipped to the surface's rectangle (a page's window).
 */
export type C3 = readonly [number, number, number];
/** Gradient stops: where (0 to 1), the color, its opacity (1 by default). */
export type Stops = readonly (readonly [number, C3, number?])[];

/** What the painter draws on: an HD layer (at one order, under or over the text) or a small picture. */
export interface Px {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8ClampedArray;
  /** Whether something was drawn at (x, y) (inside the picture). */
  has(x: number, y: number): boolean;
  set(x: number, y: number, r: number, g: number, b: number): void;
}

/** A plain RGBA picture (a photo painted at low resolution, a map). */
export class Img implements Px {
  readonly px: Uint8ClampedArray;
  constructor(readonly w: number, readonly h: number) { this.px = new Uint8ClampedArray(w * h * 4); }
  has(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.px[(y * this.w + x) * 4 + 3] > 0; }
  set(x: number, y: number, r: number, g: number, b: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const k = (y * this.w + x) * 4, P = this.px;
    P[k] = r; P[k + 1] = g; P[k + 2] = b; P[k + 3] = 255;
  }
}

/** An HD layer seen as a surface, every pixel at one order (under the text, or over it). */
export const onHd = (hd: HdLayer, order: HdOrder = HdOrder.Over): Px => ({
  w: hd.w, h: hd.h, px: hd.px,
  has: (x, y) => hd.at(x, y) >= 0,
  set: (x, y, r, g, b) => hd.put(x, y, r, g, b, order),
});

/** The surface and the rectangle drawing is clipped to (x0, y0 inclusive, x1, y1 exclusive). */
export class Paint {
  x0 = 0; y0 = 0; x1: number; y1: number;
  constructor(readonly s: Px) { this.x1 = s.w; this.y1 = s.h; }
  clip(x0: number, y0: number, x1: number, y1: number) {
    this.x0 = Math.max(0, x0); this.y0 = Math.max(0, y0); this.x1 = Math.min(this.s.w, x1); this.y1 = Math.min(this.s.h, y1);
    return this;
  }

  /**
   * One pixel at opacity a, mixed over what is drawn there. Over nothing (the page's paper is in the
   * cells, not here), a pixel half covered or more is drawn whole and a fainter one is left out.
   */
  dot(x: number, y: number, c: C3, a = 1) {
    if (x < this.x0 || y < this.y0 || x >= this.x1 || y >= this.y1 || a <= 0) return;
    const S = this.s;
    if (a >= 1) { S.set(x, y, c[0], c[1], c[2]); return; }
    if (!S.has(x, y)) { if (a >= 0.5) S.set(x, y, c[0], c[1], c[2]); return; }
    const k = (y * S.w + x) * 4, P = S.px;
    S.set(x, y, P[k] + (c[0] - P[k]) * a, P[k + 1] + (c[1] - P[k + 1]) * a, P[k + 2] + (c[2] - P[k + 2]) * a);
  }
  /** Light added over what is drawn (a glow); nothing where nothing is. */
  add(x: number, y: number, c: C3, a: number) {
    if (x < this.x0 || y < this.y0 || x >= this.x1 || y >= this.y1 || a <= 0 || !this.s.has(x, y)) return;
    const k = (y * this.s.w + x) * 4, P = this.s.px;
    this.s.set(x, y, P[k] + c[0] * a, P[k + 1] + c[1] * a, P[k + 2] + c[2] * a);
  }

  rect(x: number, y: number, w: number, h: number, c: C3, a = 1) {
    const X0 = Math.round(x), Y0 = Math.round(y), X1 = Math.round(x + w), Y1 = Math.round(y + h);
    for (let j = Y0; j < Y1; j++) for (let i = X0; i < X1; i++) this.dot(i, j, c, a);
  }

  /** A shape by its coverage test (inside at a point), 2 x 2 samples a pixel within the box x, y, w, h. */
  private cover(x: number, y: number, w: number, h: number, inside: (px: number, py: number) => boolean, c: C3 | ((i: number, j: number) => C3), a = 1) {
    const X0 = Math.floor(x), Y0 = Math.floor(y), X1 = Math.ceil(x + w), Y1 = Math.ceil(y + h);
    for (let j = Y0; j < Y1; j++) for (let i = X0; i < X1; i++) {
      const n = +inside(i + 0.25, j + 0.25) + +inside(i + 0.75, j + 0.25) + +inside(i + 0.25, j + 0.75) + +inside(i + 0.75, j + 0.75);
      if (n) this.dot(i, j, typeof c === 'function' ? c(i, j) : c, (a * n) / 4);
    }
  }

  /** A rectangle with round corners of radius r. */
  rrect(x: number, y: number, w: number, h: number, r: number, c: C3, a = 1) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    this.cover(x, y, w, h, (px, py) => {
      const dx = Math.max(x + r - px, px - (x + w - r), 0), dy = Math.max(y + r - py, py - (y + h - r), 0);
      return dx * dx + dy * dy <= r * r;
    }, c, a);
  }

  /** A gradient across (vertical: top to bottom) a rectangle with round corners (r 0 for square). */
  grad(x: number, y: number, w: number, h: number, stops: Stops, vertical = true, r = 0) {
    const at = (i: number, j: number) => stopAt(stops, vertical ? (j + 0.5 - y) / h : (i + 0.5 - x) / w);
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    const X0 = Math.floor(x), Y0 = Math.floor(y), X1 = Math.ceil(x + w), Y1 = Math.ceil(y + h);
    for (let j = Y0; j < Y1; j++) for (let i = X0; i < X1; i++) {
      let n = 4;
      if (r > 0) {
        const inn = (px: number, py: number) => { const dx = Math.max(x + r - px, px - (x + w - r), 0), dy = Math.max(y + r - py, py - (y + h - r), 0); return dx * dx + dy * dy <= r * r; };
        n = +inn(i + 0.25, j + 0.25) + +inn(i + 0.75, j + 0.25) + +inn(i + 0.25, j + 0.75) + +inn(i + 0.75, j + 0.75);
      }
      if (!n) continue;
      const [c, a] = at(i, j);
      this.dot(i, j, c, (a * n) / 4);
    }
  }

  /** A line w pixels thick, with round ends. */
  line(x0: number, y0: number, x1: number, y1: number, w: number, c: C3, a = 1) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9, R = w / 2;
    this.cover(Math.min(x0, x1) - R, Math.min(y0, y1) - R, Math.abs(dx) + w, Math.abs(dy) + w, (px, py) => {
      const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L2)), ex = px - x0 - dx * t, ey = py - y0 - dy * t;
      return ex * ex + ey * ey <= R * R;
    }, c, a);
  }

  /** A filled ellipse round cx, cy (a circle when ry is left out). */
  disc(cx: number, cy: number, rx: number, c: C3, a = 1, ry = rx) {
    this.cover(cx - rx, cy - ry, rx * 2, ry * 2, (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1, c, a);
  }
  /** An elliptic ring w pixels thick (its outer edge at rx, ry). */
  ring(cx: number, cy: number, rx: number, w: number, c: C3, a = 1, ry = rx) {
    const ix = Math.max(0.01, rx - w), iy = Math.max(0.01, ry - w);
    this.cover(cx - rx, cy - ry, rx * 2, ry * 2, (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1 && ((px - cx) / ix) ** 2 + ((py - cy) / iy) ** 2 > 1, c, a);
  }

  /** A filled polygon (x, y pairs; even-odd). */
  poly(pts: readonly number[], c: C3, a = 1) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < pts.length; k += 2) { x0 = Math.min(x0, pts[k]); x1 = Math.max(x1, pts[k]); y0 = Math.min(y0, pts[k + 1]); y1 = Math.max(y1, pts[k + 1]); }
    const n = pts.length >> 1;
    this.cover(x0, y0, x1 - x0, y1 - y0, (px, py) => {
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }, c, a);
  }

  /** Soft light round cx, cy fading to nothing at radius r, added over what is drawn (a lamp, a glow). */
  glow(cx: number, cy: number, r: number, c: C3, a: number) {
    for (let j = Math.floor(cy - r); j < Math.ceil(cy + r); j++) for (let i = Math.floor(cx - r); i < Math.ceil(cx + r); i++) {
      const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy) / r;
      if (d < 1) this.mixIn(i, j, c, a * (1 - d));
    }
  }
  /** As dot, but only over what is drawn. */
  private mixIn(x: number, y: number, c: C3, a: number) { if (this.s.has(x, y)) this.dot(x, y, c, a); }

  /**
   * Text in the 5 x 7 bulb font (render/signs.ts), each bulb s x s pixels, its inner corners rounded (a
   * gap between two lit bulbs that meet at a corner is filled to the diagonal); lower case is drawn as
   * upper (the font has none yet). Returns the width drawn. `gap`: pixels between letters (s by default).
   */
  text(x: number, y: number, str: string, s: number, c: C3, a = 1, gap = s): number {
    let cx = x;
    for (const chr of str) {
      const rows = fontRows(chr.charCodeAt(0)) ?? fontRows(chr.toUpperCase().charCodeAt(0));
      if (rows) this.glyph(cx, y, rows, s, c, a);
      cx += 5 * s + gap;
    }
    return Math.max(0, cx - x - gap);
  }
  private glyph(x: number, y: number, rows: readonly number[], s: number, c: C3, a: number) {
    const on = (i: number, j: number) => i >= 0 && i < 5 && j >= 0 && j < 7 && ((rows[j] >> (4 - i)) & 1) === 1;
    for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) {
      if (on(i, j)) { this.rect(x + i * s, y + j * s, s, s, c, a); continue; }
      if (s < 2) continue;
      // an empty bulb between two lit ones that meet at its corner: fill that corner to the diagonal
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (!on(i + dx, j) || !on(i, j + dy)) continue;
        const ox = dx < 0 ? 0 : s, oy = dy < 0 ? 0 : s;
        this.cover(x + i * s, y + j * s, s, s, (px, py) => Math.abs(px - (x + i * s + ox)) + Math.abs(py - (y + j * s + oy)) <= s / 2, c, a);
      }
    }
  }
  /** The width text(…) would take. */
  static textW(str: string, s: number, gap = s) { return str.length ? str.length * (5 * s + gap) - gap : 0; }

  /** A picture laid over x, y, w, h, scaled with hard pixels (nearest); flipY for a reflection; a: its opacity. */
  image(img: Img, x: number, y: number, w: number, h: number, a = 1, flipY = false) {
    const X0 = Math.round(x), Y0 = Math.round(y), W = Math.round(w), H = Math.round(h), P = img.px;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const sx = Math.min(img.w - 1, Math.floor((i * img.w) / W)), sy0 = Math.min(img.h - 1, Math.floor((j * img.h) / H)), sy = flipY ? img.h - 1 - sy0 : sy0;
      const k = (sy * img.w + sx) * 4;
      if (P[k + 3]) this.dot(X0 + i, Y0 + j, [P[k], P[k + 1], P[k + 2]], a);
    }
  }
}

/** The color and opacity of a gradient at t (0 to 1). */
export function stopAt(stops: Stops, t: number): [C3, number] {
  if (t <= stops[0][0]) return [stops[0][1], stops[0][2] ?? 1];
  for (let k = 1; k < stops.length; k++) {
    const [b, cb, ab = 1] = stops[k];
    if (t <= b) {
      const [a0, ca, aa = 1] = stops[k - 1], u = b > a0 ? (t - a0) / (b - a0) : 1;
      return [[ca[0] + (cb[0] - ca[0]) * u, ca[1] + (cb[1] - ca[1]) * u, ca[2] + (cb[2] - ca[2]) * u], aa + (ab - aa) * u];
    }
  }
  const l = stops[stops.length - 1];
  return [l[1], l[2] ?? 1];
}

export const mixC = (a: C3, b: C3, t: number): C3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const lite = (c: C3, t: number) => mixC(c, [255, 255, 255], t);
export const dark = (c: C3, t: number) => mixC(c, [0, 0, 0], t);
export const hex = (s: string): C3 => { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** The points of a star of n tips round cx, cy (outer radius R, inner r), its first tip up. */
export function star(cx: number, cy: number, R: number, r: number, n: number): number[] {
  const p: number[] = [];
  for (let i = 0; i < n * 2; i++) { const a = (Math.PI * i) / n - Math.PI / 2, q = i % 2 ? r : R; p.push(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
  return p;
}

/** What a photo shows: from the place's type (the manual's GROUP), or the city at night, dark, a face. */
export type PhotoSubj = 'store' | 'food' | 'room' | 'bar' | 'tech' | 'sky' | 'blackout' | 'face';

/**
 * The photos of 2008 (the manual's paintPhoto): small, grainy, a bit too warm, painted at pw x ph from
 * the seed. The grain comes from hash3 of the pixel and the seed, so the same seed is the same photo.
 */
export function paintPhoto(pw: number, ph: number, subj: PhotoSubj, seed: number): Img {
  const img = new Img(pw, ph), P = new Paint(img), r = mulberry32(seed), W = pw, H = ph;
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)];
  const F = (c: C3, x: number, y: number, w: number, h: number, a = 1) => P.rect(x, y, Math.max(1, w), Math.max(1, h), c, a);
  const V = (y0: number, y1: number, a: string, b: string) => P.grad(0, y0, W, y1 - y0, [[0, hex(a)], [1, hex(b)]]);
  if (subj === 'store') {
    V(0, H * 0.3, '#7fa6d0', '#d6e3ee');
    const wall = pick<C3>([[150, 72, 52], [118, 108, 98], [92, 100, 118], [168, 146, 116]]); F(wall, 0, H * 0.1, W, H * 0.76);
    for (let i = 0; i < 4; i++) F(dark(wall, 0.55), W * (0.07 + i * 0.24), H * 0.15, W * 0.13, H * 0.13);
    F(hex('#efe6d2'), W * 0.18, H * 0.31, W * 0.64, H * 0.08); F(dark(wall, 0.45), W * 0.26, H * 0.33, W * 0.48, H * 0.03);
    const aw = pick<C3>([[188, 32, 30], [28, 112, 60], [30, 62, 150], [206, 122, 20]]);
    for (let i = 0; i < W; i += 4) F(i % 8 ? [244, 240, 230] : aw, i, H * 0.42, 4, H * 0.09);
    F(dark(aw, 0.35), 0, H * 0.51, W, 1);
    F(hex('#1a232e'), W * 0.05, H * 0.55, W * 0.6, H * 0.3); P.glow(W * 0.3, H * 0.7, W * 0.25, [255, 200, 120], 0.55);
    F(hex('#2f2219'), W * 0.72, H * 0.55, W * 0.19, H * 0.31); F(hex('#c9a227'), W * 0.87, H * 0.7, 1, 2);
    V(H * 0.86, H, '#a29d93', '#7b766d');
  } else if (subj === 'food') {
    V(0, H, '#6b3e22', '#3e2213'); for (let y = 2; y < H; y += 5) F([0, 0, 0], 0, y, W, 1, 0.15);
    P.disc(W / 2, H * 0.55, W * 0.4, hex('#f4f1ea'), 1, H * 0.36);
    const k = pick(['pie', 'burger', 'sandwich']);
    if (k === 'pie') {
      P.disc(W / 2, H * 0.55, W * 0.32, hex('#d99a3a'), 1, H * 0.28); P.disc(W / 2, H * 0.55, W * 0.27, hex('#c4381c'), 1, H * 0.23);
      for (let i = 0; i < 9; i++) { const d = Math.max(1, W * 0.03); P.disc(W / 2 + (r() - 0.5) * W * 0.4, H * 0.55 + (r() - 0.5) * H * 0.32, d, hex(i % 3 ? '#8e1f12' : '#f3e2a0')); }
    } else if (k === 'burger') {
      F(hex('#d99a3a'), W * 0.3, H * 0.3, W * 0.4, H * 0.12); F(hex('#3d7a28'), W * 0.27, H * 0.42, W * 0.46, H * 0.05); F(hex('#5a2e17'), W * 0.28, H * 0.47, W * 0.44, H * 0.12);
      F(hex('#f1c232'), W * 0.29, H * 0.59, W * 0.42, H * 0.04); F(hex('#c8862e'), W * 0.3, H * 0.63, W * 0.4, H * 0.1);
    } else {
      F(hex('#e8cf98'), W * 0.22, H * 0.38, W * 0.56, H * 0.1); F(hex('#c0503a'), W * 0.23, H * 0.48, W * 0.54, H * 0.08);
      F(hex('#5c9a3a'), W * 0.22, H * 0.56, W * 0.56, H * 0.04); F(hex('#e8cf98'), W * 0.22, H * 0.6, W * 0.56, H * 0.1);
    }
    P.glow(W * 0.2, H * 0.1, W * 0.4, [255, 240, 200], 0.25);
  } else if (subj === 'room') {
    V(0, H, '#d8c7a4', '#a99677'); F(hex('#1c2742'), W * 0.62, H * 0.12, W * 0.28, H * 0.36); F(hex('#e9b44c'), W * 0.7, H * 0.3, 1, 1); F(hex('#e9b44c'), W * 0.8, H * 0.22, 1, 1);
    F(hex('#5a3a22'), W * 0.08, H * 0.34, W * 0.46, H * 0.18); F(hex('#f4f2ec'), W * 0.06, H * 0.5, W * 0.52, H * 0.26); F(hex('#8b2f3c'), W * 0.06, H * 0.66, W * 0.52, H * 0.1);
    P.glow(W * 0.62, H * 0.5, W * 0.18, [255, 214, 140], 0.7); F(hex('#3a2a1e'), W * 0.6, H * 0.56, W * 0.06, H * 0.2);
    F(hex('#6e5a44'), 0, H * 0.86, W, H * 0.14);
  } else if (subj === 'bar') {
    V(0, H, '#21140d', '#0b0705');
    for (let i = 0; i < 3; i++) {
      F(hex('#3a2416'), 0, H * (0.2 + i * 0.16), W, 1);
      for (let x = 2; x < W - 2; x += 3 + Math.floor(r() * 2)) F(hex(pick(['#7a3b12', '#2f6b3a', '#b8902e', '#5a1d1d', '#c7c2b0'])), x, H * (0.2 + i * 0.16) - 4, 2, 4);
    }
    P.glow(W * 0.25, H * 0.2, W * 0.2, [255, 170, 80], 0.45); P.glow(W * 0.75, H * 0.2, W * 0.2, [255, 170, 80], 0.45);
    for (let i = 0; i < 5; i++) P.line(W * (0.62 + i * 0.05), H * (i % 2 ? 0.56 : 0.62), W * (0.62 + (i + 1) * 0.05), H * ((i + 1) % 2 ? 0.56 : 0.62), 1, hex('#ff4fa3'));
    P.glow(W * 0.75, H * 0.6, W * 0.15, [255, 80, 160], 0.3);
    F(hex('#4a2c18'), 0, H * 0.72, W, H * 0.06); F(hex('#2a180d'), 0, H * 0.78, W, H * 0.22);
  } else if (subj === 'tech') {
    V(0, H, '#d9dde3', '#9ea6b0');
    for (let j = 0; j < 2; j++) {
      F(hex('#6d747d'), 0, H * (0.45 + j * 0.35), W, 1);
      for (let x = 3; x < W - 6; x += 9) { F(hex('#1b1f24'), x, H * (0.2 + j * 0.35), 7, H * 0.22); F(hex(pick(['#2f6fd0', '#3aa0c8', '#5a9a3a', '#8a5ac0'])), x + 1, H * (0.2 + j * 0.35) + 1, 5, H * 0.22 - 2); }
    }
  } else if (subj === 'sky' || subj === 'blackout') {
    const off = subj === 'blackout';
    V(0, H, '#0b1324', '#2b2a3a');
    for (let x = 0; x < W;) {
      const bw = 3 + Math.floor(r() * 6), bh = H * (0.3 + r() * 0.55);
      F(hex('#0a0d14'), x, H - bh, bw, bh);
      if (!off || x > W * 0.8) for (let yy = Math.round(H - bh + 2); yy < H - 2; yy += 3) for (let xx = x + 1; xx < x + bw - 1; xx += 2) if (r() < 0.35) F(hex('#e8b04a'), xx, yy, 1, 1);
      x += bw + (r() < 0.3 ? 1 : 0);
    }
    P.glow(W / 2, H * 1.05, W * 0.7, off ? [80, 90, 120] : [255, 170, 60], off ? 0.15 : 0.35);
    if (off) { F(hex('#fff6d0'), W * 0.3, H * 0.9, 1, 1); F(hex('#fff6d0'), W * 0.34, H * 0.9, 1, 1); P.glow(W * 0.32, H * 0.9, W * 0.12, [255, 240, 200], 0.4); }
  } else {
    const bg = hex(pick(['#c8d2e4', '#e4d2c8', '#d2e4c8', '#e4e0c8'])), skin = pick<C3>([[241, 200, 160], [214, 160, 116], [160, 108, 70], [104, 68, 44]]);
    const hair = pick<C3>([[30, 20, 14], [90, 56, 30], [200, 160, 90], [60, 60, 66]]), shirt = pick<C3>([[40, 70, 140], [150, 40, 40], [50, 50, 54], [60, 120, 70]]);
    F(bg, 0, 0, W, H); F(shirt, W * 0.15, H * 0.74, W * 0.7, H * 0.26); F(skin, W * 0.28, H * 0.2, W * 0.44, H * 0.52); F(hair, W * 0.26, H * 0.12, W * 0.48, H * 0.14);
    if (r() < 0.5) F(hair, W * 0.26, H * 0.2, W * 0.08, H * 0.28);
    F(hex('#1b1410'), W * 0.38, H * 0.42, W * 0.08, H * 0.07); F(hex('#1b1410'), W * 0.56, H * 0.42, W * 0.08, H * 0.07); F(dark(skin, 0.3), W * 0.44, H * 0.6, W * 0.14, H * 0.04);
  }
  // the grain of a cheap camera and a heavy JPEG
  const D = img.px;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = (j * W + i) * 4, n = (hash3(i, j, seed) - 0.5) * 14;
    D[k] += n; D[k + 1] += n; D[k + 2] += n;
  }
  return img;
}

/** A street map in the Lookwise Local style (the manual's paintMap): the blocks, an avenue each way, a park or two, the sea along the bottom. */
export function paintMap(pw: number, ph: number, seed: number): Img {
  const img = new Img(pw, ph), P = new Paint(img), r = mulberry32(seed);
  const sx = 7 + Math.floor(r() * 3), sy = 5 + Math.floor(r() * 2), ox = Math.floor(r() * sx), oy = Math.floor(r() * sy);
  P.rect(0, 0, pw, ph, hex('#fbfaf5'));
  for (let y = -oy; y < ph; y += sy) for (let x = -ox; x < pw; x += sx) P.rect(x + 1, y + 1, sx - 2, sy - 2, hex(r() < 0.1 ? '#c6dfa8' : '#e8e1cf'));
  P.rect(0, sy * 2 - oy - 1, pw, 2, hex('#f3cf63')); P.rect(sx * 3 - ox - 1, 0, 2, ph, hex('#f3cf63'));
  P.rect(0, ph - 3, pw, 3, hex('#a7c8e6'));
  return img;
}

/** Photos already painted, by key (they do not change while a page is open); the oldest goes past PHOTO_MAX. */
const PHOTO_MAX = 64;
const photos = new Map<string, Img>();
export function photoOf(pw: number, ph: number, subj: PhotoSubj, seed: number): Img {
  const key = `${subj}:${seed}:${pw}x${ph}`;
  let img = photos.get(key);
  if (!img) {
    img = paintPhoto(pw, ph, subj, seed);
    photos.set(key, img);
    if (photos.size > PHOTO_MAX) photos.delete(photos.keys().next().value!);
  }
  return img;
}
