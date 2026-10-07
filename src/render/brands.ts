import { hash3 } from '../core/rng';
import { type C3, type Paint } from './paint2d';
import { fontRows } from './signs';

/**
 * 15.18: the city's brands as families (docs/identidade/fabricantes-manual.html). A brand's name is
 * the seed's (locale/names.ts); its family fixes the rest: the case the name is written in, a dot font
 * of its own (made by code from the 5 x 7 bulb font of the signs, with the "way" of the manual's
 * typeface: stencil cuts, a thin round lower case, a condensed one…), a 16 x 16 symbol with one variant
 * in four picked by the seed, and its colors. No web fonts in the game: these are what the signs, the
 * screens and the decals on the devices draw the logos with (up close dots, from afar one ASCII letter
 * a letter, as with every text in the world).
 */
export const Fam = {
  /** Phone makers: the index of a maker is its family (sim/device.ts). */
  Giant: 0, Exec: 1, Fashion: 2, Rugged: 3,
  /** Notebook makers, by role (sim/computer.ts LAPTOP_MAKERS). */
  Work: 4, Retail: 5,
  /** Operators, by index (operatorName): the megacorp and the two prepaid ones. */
  Megacorp: 6, Youth: 7, Discount: 8,
  /** The small brands: the player's watch, the security cameras (one family for the three). */
  Watch: 9, Cctv: 10,
} as const;
export const phoneFam = (maker: number) => maker;
export const laptopFam = (maker: number) => Fam.Work + maker;
export const operatorFam = (op: number) => Fam.Megacorp + op;

type Case = 'title' | 'upper' | 'lower';
/** The ways a dot font is made from the base letters (see glyph). */
type Way = 'bold' | 'serif' | 'thin' | 'stencil' | 'wide' | 'italic' | 'condensed' | 'plain';
export interface Family {
  name: string;
  case: Case;
  way: Way;
  /** Empty dot columns between letters. */
  track: number;
  /** The symbol's two colors and the name's, on dark (night, screens) and on light (paper, boxes, day signs). */
  dark: [C3, C3, C3];
  light: [C3, C3, C3];
  /** The symbol goes after the name (the megacorp's wedge) rather than before it. */
  after?: boolean;
}
const hex = (s: string): C3 => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const cols = (a: string, b: string, t: string): [C3, C3, C3] => [hex(a), hex(b), hex(t)];

export const FAMILIES: Family[] = [
  { name: 'giant', case: 'title', way: 'bold', track: 1, dark: cols('#3b82e6', '#0b0c0e', '#e9eef7'), light: cols('#1f5fbf', '#ffffff', '#183a6e') },
  { name: 'exec', case: 'upper', way: 'serif', track: 2, dark: cols('#c9ccd3', '#0b0c0e', '#e4e6ea'), light: cols('#1a1b1f', '#ffffff', '#1a1b1f') },
  { name: 'fashion', case: 'lower', way: 'thin', track: 1, dark: cols('#ff5aa5', '#9b6bff', '#ffe4f0'), light: cols('#d2387f', '#7b3fd0', '#5a1a40') },
  { name: 'rugged', case: 'upper', way: 'stencil', track: 1, dark: cols('#ff7a1a', '#1d1f1d', '#ff9a4a'), light: cols('#ff7a1a', '#1d1f1d', '#1d1f1d') },
  { name: 'work', case: 'upper', way: 'wide', track: 2, dark: cols('#d9d7d0', '#ffb030', '#d9d7d0'), light: cols('#18191c', '#ffb030', '#18191c') },
  { name: 'retail', case: 'title', way: 'italic', track: 1, dark: cols('#c6ccd3', '#2fb6ff', '#eef2f6'), light: cols('#5d6670', '#2fb6ff', '#3c434b') },
  { name: 'megacorp', case: 'lower', way: 'bold', track: 0, dark: cols('#8f6bff', '#0b0c0e', '#ffffff'), light: cols('#6633ff', '#ffffff', '#111114'), after: true },
  { name: 'youth', case: 'lower', way: 'bold', track: 1, dark: cols('#8ee63a', '#0b0c0e', '#f6ffe8'), light: cols('#6cc11a', '#ffffff', '#1b1b1b') },
  { name: 'discount', case: 'upper', way: 'condensed', track: 1, dark: cols('#e3161b', '#ffd400', '#ffd400'), light: cols('#e3161b', '#ffd400', '#e3161b') },
  { name: 'watch', case: 'upper', way: 'wide', track: 2, dark: cols('#e6e2d6', '#0b0c0e', '#e6e2d6'), light: cols('#2a2a2a', '#ffffff', '#2a2a2a') },
  { name: 'cctv', case: 'upper', way: 'plain', track: 2, dark: cols('#f2c300', '#0b0c0e', '#d8d8d8'), light: cols('#3a3d42', '#f2c300', '#3a3d42') },
];

/** The seed's variant (0..3) of a family's symbol: small, it changes the symbol's face, never its drawing. */
export function brandVariant(nameSeed: number, fam: number): number {
  return Math.floor(hash3(nameSeed, fam, 15180) * 4);
}

/** A name in its family's case ("Kesion" -> "kesion" for the megacorp; the lower ones run the words together). */
export function brandWord(fam: number, name: string): string {
  const c = FAMILIES[fam].case;
  return c === 'upper' ? name.toUpperCase() : c === 'lower' ? name.toLowerCase().replace(/ /g, '') : name;
}

// ---- the dot fonts ----

/**
 * The lower case the 5 x 7 font lacks, 5 wide and 8 rows (the x-height rows 2-6, row 7 the descender),
 * in the manner of the character LCDs of the time.
 */
const LOWER: Record<string, number[]> = {
  a: [0, 0, 14, 1, 15, 17, 15], b: [16, 16, 22, 25, 17, 17, 30], c: [0, 0, 14, 16, 16, 17, 14], d: [1, 1, 13, 19, 17, 17, 15],
  e: [0, 0, 14, 17, 31, 16, 14], f: [6, 9, 8, 28, 8, 8, 8], g: [0, 0, 15, 17, 17, 15, 1, 14], h: [16, 16, 22, 25, 17, 17, 17],
  i: [4, 0, 12, 4, 4, 4, 14], j: [2, 0, 6, 2, 2, 2, 18, 12], k: [16, 16, 18, 20, 24, 20, 18], l: [12, 4, 4, 4, 4, 4, 14],
  m: [0, 0, 26, 21, 21, 17, 17], n: [0, 0, 22, 25, 17, 17, 17], o: [0, 0, 14, 17, 17, 17, 14], p: [0, 0, 30, 17, 17, 30, 16, 16],
  q: [0, 0, 15, 17, 17, 15, 1, 1], r: [0, 0, 22, 25, 16, 16, 16], s: [0, 0, 14, 16, 14, 1, 30], t: [8, 8, 28, 8, 8, 9, 6],
  u: [0, 0, 17, 17, 17, 19, 13], v: [0, 0, 17, 17, 17, 10, 4], w: [0, 0, 17, 17, 21, 21, 10], x: [0, 0, 17, 10, 4, 10, 17],
  y: [0, 0, 17, 17, 17, 15, 1, 14], z: [0, 0, 31, 2, 4, 8, 31],
};
/** Signs the bulb font lacks, in the same 5 x 7 (the phone's small text: hints, arrows, markers). */
const SIGNS: Record<string, number[]> = {
  '<': [2, 4, 8, 16, 8, 4, 2], '>': [8, 4, 2, 1, 2, 4, 8], '^': [4, 10, 17, 0, 0, 0, 0], _: [0, 0, 0, 0, 0, 0, 31], '=': [0, 0, 31, 0, 31, 0, 0],
  '[': [14, 8, 8, 8, 8, 8, 14], ']': [14, 2, 2, 2, 2, 2, 14], '|': [4, 4, 4, 4, 4, 4, 4], '"': [10, 10, 0, 0, 0, 0, 0], ';': [0, 12, 12, 0, 12, 4, 8],
  '@': [14, 17, 23, 21, 23, 16, 14], '~': [0, 0, 8, 21, 2, 0, 0],
};
/** A letter of a dot font: w columns, 8 rows of bits (the high bit of w is the left column). */
export interface Glyph { w: number; rows: number[] }
const H = 8;

/** The base letter (5 wide, 8 rows): the 5 x 7 bulb font's, or the lower case above. */
function base(ch: string): Glyph | undefined {
  const r = LOWER[ch] ?? fontRows(ch.charCodeAt(0)) ?? fontRows(ch.toUpperCase().charCodeAt(0)) ?? SIGNS[ch];
  if (!r) return undefined;
  const rows = r.slice();
  while (rows.length < H) rows.push(0);
  return { w: 5, rows };
}
/** A plain letter of the dot font (5 x 8, with lower case), for small pixel text (the phone's screen). */
export const plainGlyph = (ch: string): Glyph | undefined => base(ch);
export const glyphBit = (g: Glyph, x: number, y: number) => bit(g, x, y);
const bit = (g: Glyph, x: number, y: number) => x >= 0 && x < g.w && y >= 0 && y < H && ((g.rows[y] >> (g.w - 1 - x)) & 1) === 1;
/** A glyph from a test on its pixels. */
const make = (w: number, on: (x: number, y: number) => boolean): Glyph => {
  const rows: number[] = [];
  for (let y = 0; y < H; y++) { let r = 0; for (let x = 0; x < w; x++) r = (r << 1) | (on(x, y) ? 1 : 0); rows.push(r); }
  return { w, rows };
};

/**
 * Each family's way with the base letters: heavy (each dot doubled to its right, 6 wide), serifs (a
 * lone stem's end grows a foot each side, 7 wide), thin (as is), stencil (heavy, its bars cut down the
 * middle), wide (the outer stems doubled, 7 wide), italic (the upper rows leaned a dot right, 6 wide),
 * condensed (the three middle columns squeezed into two, 4 wide).
 */
function glyph(way: Way, ch: string): Glyph | undefined {
  const g = base(ch);
  if (!g) return undefined;
  switch (way) {
    case 'bold': return make(6, (x, y) => bit(g, x, y) || bit(g, x - 1, y));
    case 'stencil': {
      const b = make(6, (x, y) => bit(g, x, y) || bit(g, x - 1, y));
      // cut a horizontal bar where it crosses the middle column: the gaps a stencil leaves to hold its islands
      return make(6, (x, y) => bit(b, x, y) && !(x === 3 && bit(b, 2, y) && bit(b, 4, y) && !bit(b, 3, y - 1) && !bit(b, 3, y + 1)));
    }
    case 'serif': return make(7, (x, y) => {
      if (bit(g, x - 1, y)) return true;
      // a foot either side of a stem's end at the top or the base row of the letter
      for (const sx of [x - 2, x]) {
        if (!bit(g, sx, y) || bit(g, sx - 1, y) || bit(g, sx + 1, y)) continue;
        if ((y === 0 || !bit(g, sx, y - 1)) !== (y === H - 1 || !bit(g, sx, y + 1)) && (y === 0 || y === 6)) return true;
      }
      return false;
    });
    case 'wide': return make(7, (x, y) => (x <= 1 ? bit(g, 0, y) : x >= 5 ? bit(g, 4, y) : bit(g, x - 1, y)));
    case 'italic': return make(6, (x, y) => bit(g, x - (y < 3 ? 1 : 0), y));
    case 'condensed': return make(4, (x, y) => (x === 0 ? bit(g, 0, y) : x === 3 ? bit(g, 4, y) : bit(g, x, y) || bit(g, x + 1, y)));
    default: return g;
  }
}

/** The letters of a name in a family's dot font (its case applied), spaces as gaps. */
export function brandGlyphs(fam: number, name: string): (Glyph | null)[] {
  const F = FAMILIES[fam];
  return [...brandWord(fam, name)].map((c) => (c === ' ' ? null : glyph(F.way, c) ?? null));
}

/** The width in dots of a name in its family's font. */
export function brandTextW(fam: number, name: string): number {
  const t = FAMILIES[fam].track, gs = brandGlyphs(fam, name);
  return gs.reduce((w, g) => w + (g ? g.w : 3) + t, 0) - (gs.length ? t : 0);
}

/** Paint a name in its family's dot font, each dot s x s pixels, its top-left at x, y (8 rows tall). Returns the width. */
export function paintBrandText(P: Paint, x: number, y: number, fam: number, name: string, s: number, c: C3): number {
  const t = FAMILIES[fam].track;
  let cx = x;
  for (const g of brandGlyphs(fam, name)) {
    if (g) for (let j = 0; j < H; j++) for (let i = 0; i < g.w; i++) if (bit(g, i, j)) P.rect(cx + i * s, y + j * s, s, s, c);
    cx += ((g ? g.w : 3) + t) * s;
  }
  return cx - x - t * s;
}

// ---- the symbols ----

/** A symbol: 16 x 16 pixels, each 0 (empty), 1 (the family's first color) or 2 (its second). */
export type Symbol16 = Uint8Array;
type Shape = (x: number, y: number) => number;
const deg = Math.PI / 180;
const disc = (cx: number, cy: number, r: number) => (x: number, y: number) => Math.hypot(x - cx, y - cy) <= r;
const box = (x0: number, y0: number, w: number, h: number) => (x: number, y: number) => x >= x0 && x <= x0 + w && y >= y0 && y <= y0 + h;
/** Inside a convex or star polygon (even-odd). */
const poly = (pts: number[][]) => (x: number, y: number) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const around = (n: number, r: number, a0 = 0) => Array.from({ length: n }, (_, i) => [50 + Math.cos(a0 + (i * 2 * Math.PI) / n) * r, 50 + Math.sin(a0 + (i * 2 * Math.PI) / n) * r]);

/**
 * The symbols of the manual, drawn on a 100 x 100 box (the last shape that covers a point wins), for
 * variant v: the giant's ear and voice (the ring's opening turns), the executive's 3 x 3 keys (the
 * missing corner), the fashion one's two half moons (how far apart), the rugged one's nut (2, 3, 4 or
 * 6 rivets), the work brick's square with its amber lamp (the corner), the shop-window one's orbit
 * (its tilt), the megacorp's signal wedge (whole, or 2-4 bars), the youth one's speech balloon (1-3
 * dots, or the tail turned), the discount one's offer star (10-16 points), the watch's dial (the hand), the three camera
 * marks (v is the maker: the lens, the shutter, the dome).
 */
const DRAW: ((v: number) => Shape)[] = [
  (v) => {
    const open = [0, -45, 45, 90][v] * deg, ring = (x: number, y: number) => {
      const d = Math.hypot(x - 50, y - 50), a = Math.atan2(y - 50, x - 50);
      const off = Math.abs(((a - open + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      return Math.abs(d - 25) <= 6.5 && off > 50 * deg;
    };
    const D = disc(50, 50, 47), dot = disc(50, 50, 9);
    return (x, y) => (ring(x, y) || dot(x, y) ? 2 : D(x, y) ? 1 : 0);
  },
  (v) => {
    const skip = [0, 2, 6, 8][v];
    return (x, y) => {
      for (let i = 0; i < 9; i++) if (i !== skip && box(4 + (i % 3) * 32, 4 + Math.floor(i / 3) * 32, 26, 26)(x, y)) return 1;
      return 0;
    };
  },
  (v) => {
    const d = 6 + v * 4;
    return (x, y) => (y <= 46 && Math.hypot(x - d - 50, y - 47) <= 46 ? 1 : y >= 54 && Math.hypot(x + d - 50, y - 53) <= 46 ? 2 : 0);
  },
  (v) => {
    const hex6 = poly(around(6, 48)), n = [2, 3, 4, 6][v], riv = around(n, 36, 30 * deg).map(([cx, cy]) => disc(cx, cy, 6.5));
    const hole = disc(50, 50, 17), slot = box(43, 20, 14, 60);
    return (x, y) => (hole(x, y) || slot(x, y) || riv.some((r) => r(x, y)) ? 2 : hex6(x, y) ? 1 : 0);
  },
  (v) => {
    const [cx, cy] = [[22, 22], [52, 22], [22, 52], [52, 52]][v], lamp = box(cx, cy, 26, 26), frame = box(2, 2, 96, 96), inner = box(15, 15, 70, 70);
    return (x, y) => (lamp(x, y) ? 2 : frame(x, y) && !inner(x, y) ? 1 : 0);
  },
  (v) => {
    const t = [-22, -35, -12, 25][v] * deg, c = Math.cos(t), s = Math.sin(t), dot = disc(50, 50, 19);
    return (x, y) => {
      if (dot(x, y)) return 2;
      const u = (x - 50) * c + (y - 50) * s, w = -(x - 50) * s + (y - 50) * c, e = Math.hypot(u / 50, w / 18);
      return e <= 1 && e >= 0.72 ? 1 : 0;
    };
  },
  (v) => {
    if (!v) return (x, y) => (poly([[4, 96], [96, 96], [96, 4]])(x, y) ? 1 : 0);
    const n = v + 1, w = 92 / n;
    return (x, y) => {
      const i = Math.floor((x - 4) / w), h = ((i + 1) / n) * 92;
      return i >= 0 && i < n && x - 4 - i * w < w - 12 && y >= 96 - h && y <= 96 ? 1 : 0;
    };
  },
  (v) => {
    const body = (x: number, y: number) => box(4, 8, 92, 60)(x, y) && Math.hypot(Math.max(0, Math.abs(x - 50) - 18), Math.max(0, Math.abs(y - 38) - 0)) <= 32;
    // 1-3 dots; the fourth variant two dots with the tail on the other side
    const tail = poly(v === 3 ? [[76, 60], [88, 96], [50, 64]] : [[24, 60], [12, 96], [50, 64]]), n = v === 3 ? 2 : 1 + v;
    const dots = Array.from({ length: n }, (_, i) => disc(50 + (i - (n - 1) / 2) * 24, 38, 9));
    return (x, y) => (dots.some((d) => d(x, y)) ? 2 : body(x, y) || tail(x, y) ? 1 : 0);
  },
  (v) => {
    const n = [10, 12, 14, 16][v], pts = Array.from({ length: n * 2 }, (_, i) => [50 + Math.cos((i * Math.PI) / n - Math.PI / 2) * (i % 2 ? 38 : 50), 50 + Math.sin((i * Math.PI) / n - Math.PI / 2) * (i % 2 ? 38 : 50)]);
    const star = poly(pts), o1 = disc(36, 36, 8), o2 = disc(64, 64, 8);
    const slash = (x: number, y: number) => Math.abs(x + y - 100) <= 7 && Math.abs(x - y) <= 34;
    return (x, y) => (o1(x, y) || o2(x, y) || slash(x, y) ? 1 : star(x, y) ? 2 : 0);
  },
  (v) => {
    const a = ([40, 130, 220, 310][v] - 90) * deg, hx = 50 + Math.cos(a) * 32, hy = 50 + Math.sin(a) * 32;
    return (x, y) => {
      const d = Math.hypot(x - 50, y - 50);
      if (Math.abs(d - 44) <= 5) return 1;
      if (d >= 30 && d <= 42 && (Math.abs(x - 50) <= 4 || Math.abs(y - 50) <= 4)) return 1;
      // the hand: within 5 of the segment from the middle to (hx, hy)
      const t = Math.max(0, Math.min(1, ((x - 50) * (hx - 50) + (y - 50) * (hy - 50)) / (32 * 32)));
      return Math.hypot(x - 50 - t * (hx - 50), y - 50 - t * (hy - 50)) <= 5 || d <= 6 ? 1 : 0;
    };
  },
  (k) => {
    if (k === 0) return (x, y) => { const d = Math.hypot(x - 50, y - 50); return d <= 15 ? (Math.hypot(x - 43, y - 43) <= 5 ? 2 : 1) : d <= 30 ? 2 : d <= 47 ? 1 : 0; };
    if (k === 1) {
      const hex6 = poly(around(6, 47, 30 * deg)), core = poly(around(6, 16, 0));
      return (x, y) => (core(x, y) ? 2 : hex6(x, y) ? 1 : 0);
    }
    return (x, y) => (Math.hypot(x - 50, y - 44) <= 10 && y <= 56 ? 2 : (y <= 56 && Math.hypot(x - 50, y - 56) <= 42) || box(2, 62, 96, 14)(x, y) ? 1 : 0);
  },
];

/** A family's symbol sampled on an n x n grid, each pixel the shape at its 4 x 4 samples' majority. */
function sample(fam: number, v: number, n: number): Uint8Array {
  const S = DRAW[fam](v), out = new Uint8Array(n * n);
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    const k = [0, 0, 0];
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) k[S(((px + (sx + 0.5) / 4) * 100) / n, ((py + (sy + 0.5) / 4) * 100) / n)]++;
    out[py * n + px] = k[0] >= 8 ? 0 : k[2] >= k[1] ? 2 : 1;
  }
  return out;
}
const symCache = new Map<number, Symbol16>();
/** A family's 16 x 16 symbol in variant v (for the cameras, v is the maker 0..2). */
export function brandSymbol(fam: number, v: number): Symbol16 {
  const key = fam * 4 + v;
  let S = symCache.get(key);
  if (!S) symCache.set(key, (S = sample(fam, v, 16)));
  return S;
}

/** Paint a symbol, each pixel s x s, in the family's colors (dark or light). */
export function paintSymbol(P: Paint, x: number, y: number, fam: number, v: number, s: number, dark = true) {
  const [a, b] = FAMILIES[fam][dark ? 'dark' : 'light'], S = brandSymbol(fam, v);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const k = S[j * 16 + i]; if (k) P.rect(x + i * s, y + j * s, s, s, k === 1 ? a : b); }
}

/**
 * A whole logo, each dot s x s pixels: the symbol (16 tall) and the name (8 rows) beside it, its
 * letters centered on the symbol; the megacorp's wedge after the name instead, at the capitals'
 * height (7 dots), sampled at that size. Returns the width.
 */
export function paintLogo(P: Paint, x: number, y: number, fam: number, name: string, v: number, s: number, dark = true): number {
  const F = FAMILIES[fam], [a, b, t] = F[dark ? 'dark' : 'light'];
  if (F.after) {
    const w = paintBrandText(P, x, y + 4 * s, fam, name, s, t), n = 7 * s, S = sample(fam, v, n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = S[j * n + i]; if (k) P.rect(x + w + 2 * s + i, y + 4 * s + j, 1, 1, k === 1 ? a : b); }
    return w + 2 * s + n;
  }
  paintSymbol(P, x, y, fam, v, s, dark);
  return 19 * s + paintBrandText(P, x + 19 * s, y + 4 * s, fam, name, s, t);
}
