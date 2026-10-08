import { Vec } from './vec';

/**
 * 15.22: the Jackdaw Mini's screen, as its manual draws it (docs/identidade/jackdaw-manual.html, sections 6–8):
 * a 1-bit LCD of 128 x 64 dots (Buf), the 3 x 5 dot font in capitals at sizes 1 to 4, the jackdaw drawn in
 * vectors (vec.ts) 8 times bigger and brought down to dots (each dot the tone most of its square holds, the
 * greys an ordered dither), the system's screens (the opening, home, the menu, loading, low battery) and the
 * scenes the apps ask for by name. The device (jackdaw.ts) says which, ten times a second.
 */
export const W = 128, H = 64;

const FONT: Record<string, string> = {
  'A': '.#. #.# ### #.# #.#', 'B': '##. #.# ##. #.# ##.', 'C': '.## #.. #.. #.. .##', 'D': '##. #.# #.# #.# ##.', 'E': '### #.. ##. #.. ###',
  'F': '### #.. ##. #.. #..', 'G': '.## #.. #.# #.# .##', 'H': '#.# #.# ### #.# #.#', 'I': '### .#. .#. .#. ###', 'J': '..# ..# ..# #.# .#.',
  'K': '#.# #.# ##. #.# #.#', 'L': '#.. #.. #.. #.. ###', 'M': '#.# ### ### #.# #.#', 'N': '##. #.# #.# #.# #.#', 'O': '.#. #.# #.# #.# .#.',
  'P': '##. #.# ##. #.. #..', 'Q': '.#. #.# #.# ##. .##', 'R': '##. #.# ##. #.# #.#', 'S': '.## #.. .#. ..# ##.', 'T': '### .#. .#. .#. .#.',
  'U': '#.# #.# #.# #.# ###', 'V': '#.# #.# #.# #.# .#.', 'W': '#.# #.# ### ### #.#', 'X': '#.# #.# .#. #.# #.#', 'Y': '#.# #.# .#. .#. .#.',
  'Z': '### ..# .#. #.. ###', '0': '### #.# #.# #.# ###', '1': '.#. ##. .#. .#. ###', '2': '##. ..# .#. #.. ###', '3': '##. ..# .#. ..# ##.',
  '4': '#.# #.# ### ..# ..#', '5': '### #.. ##. ..# ##.', '6': '.## #.. ### #.# ###', '7': '### ..# .#. .#. .#.', '8': '### #.# ### #.# ###',
  '9': '### #.# ### ..# ##.', ':': '... .#. ... .#. ...', '.': '... ... ... ... .#.', '-': '... ... ### ... ...', '>': '#.. .#. ..# .#. #..',
  '!': '.#. .#. .#. ... .#.', '?': '##. ..# .#. ... .#.', '/': '..# ..# .#. #.. #..', '%': '#.# ..# .#. #.. #.#', '+': '... .#. ### .#. ...', "'": '.#. .#. ... ... ...', ' ': '... ... ... ... ...',
};

/** The screen's dots: 1 lit (dark on the green), 0 off. */
export class Buf {
  readonly p = new Uint8Array(W * H);
  clr() { this.p.fill(0); }
  fill(x: number, y: number, w: number, h: number, v = 1) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < W && j < H) this.p[j * W + i] = v; }
  text(x: number, y: number, s: string, sc = 1, v = 1) {
    for (const ch of s.toUpperCase()) {
      (FONT[ch] || FONT[' ']).split(' ').forEach((r, j) => { for (let i = 0; i < 3; i++) if (r[i] === '#') this.fill(x + i * sc, y + j * sc, sc, sc, v); });
      x += 4 * sc;
    }
    return x;
  }
  static tw(s: string, sc = 1) { return s.length * 4 * sc - sc; }
  spr(x: number, y: number, rows: readonly string[], sc = 1, v = 1) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') this.fill(x + i * sc, y + j * sc, sc, sc, v); }); }
  box(x: number, y: number, w: number, h: number) { this.fill(x, y, w, 1); this.fill(x, y + h - 1, w, 1); this.fill(x, y, 1, h); this.fill(x + w - 1, y, 1, h); }
  copy(o: Buf) { this.p.set(o.p); return this; }
}

// ---- the vectors brought down to dots ----
const INK = 0, G75 = 64, G50 = 128, G25 = 192, PAP = 255, SS = 8;
let VC: Vec | null = null;
/** draw(g) on the vector canvas 8x the screen, then each dot the tone most of its square holds, the greys dithered. */
function raster(draw: (g: Vec) => void, b: Buf) {
  const g = VC ?? (VC = new Vec(W * SS, H * SS));
  g.g.fill(255); g.setTransform(SS, 0, 0, SS, 0, 0);
  draw(g);
  const d = g.g, bw = W * SS, cnt = new Int32Array(5);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    cnt.fill(0);
    for (let sy = 0; sy < SS; sy++) { let o = (y * SS + sy) * bw + x * SS; for (let sx = 0; sx < SS; sx++, o++) cnt[Math.round(d[o] / 64)]++; }
    let k = 0; for (let i = 1; i < 5; i++) if (cnt[i] > cnt[k]) k = i;
    const ev = (x & 1) === 0 && (y & 1) === 0;
    b.p[y * W + x] = k === 0 ? 1 : k === 1 ? (ev ? 0 : 1) : k === 2 ? (((x + y) & 1) === 0 ? 1 : 0) : k === 3 ? (ev ? 1 : 0) : 0;
  }
}

// ---- the jackdaw (the manual's `gralha`, line for line) ----
function fluff(g: Vec, cx: number, cy: number, r: number, n: number, amp: number, rot = 0) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = rot + (i / n) * Math.PI * 2, vx = cx + Math.cos(a) * r, vy = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(vx, vy);
    else g.quadraticCurveTo(cx + Math.cos(a - Math.PI / n) * (r + amp * 1.9), cy + Math.sin(a - Math.PI / n) * (r + amp * 1.9), vx, vy);
  }
  g.closePath();
}
const circ = (g: Vec, x: number, y: number, r: number, c: number) => { g.beginPath(); g.arc(x, y, r); g.fill(c); };
const ell = (g: Vec, x: number, y: number, rx: number, ry: number, c: number, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot); g.fill(c); };
function line(g: Vec, pts: number[], w: number, c: number) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(w, c); }
function curve(g: Vec, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w: number, c: number) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke(w, c); }
function star(g: Vec, x: number, y: number, r: number) { line(g, [x - r, y, x + r, y], 1.1, INK); line(g, [x, y - r, x, y + r], 1.1, INK); line(g, [x - r * 0.45, y - r * 0.45, x + r * 0.45, y + r * 0.45], 0.9, INK); line(g, [x - r * 0.45, y + r * 0.45, x + r * 0.45, y - r * 0.45], 0.9, INK); }

export type Mood = 'neutral' | 'happy' | 'sulky' | 'sleepy' | 'surprised' | 'smug';
interface BirdOpt { x?: number; y?: number; s?: number; look?: number; mood?: Mood; blink?: boolean; tilt?: number; coin?: boolean; sparkle?: boolean; hold?: ((g: Vec) => void) | null }
function gralha(g: Vec, o: BirdOpt) {
  const { x = 0, y = 0, s = 1, look = 0, mood = 'neutral', blink = false, tilt = 0, coin = false, sparkle = true, hold = null } = o;
  g.save(); g.translate(x, y); g.rotate(tilt); g.scale(s, s);
  fluff(g, 0, 37, 20, 16, 1.8, 0.2); g.fill(INK);
  fluff(g, 0, 41, 10.5, 12, 1.4, 0.3); g.fill(G25);
  curve(g, -15, 30, -13, 40, -8, 46, 1.2, G50); curve(g, 15, 30, 13, 40, 8, 46, 1.2, G50);
  if (coin || hold) { ell(g, 17, 27, 6.5, 9, INK, -0.7); ell(g, 17, 27, 5.2, 7.6, G75, -0.7); }
  if (coin) {
    circ(g, 22, 16, 5.6, INK); circ(g, 22, 16, 4.4, PAP); circ(g, 22, 16, 2.6, INK); circ(g, 22, 16, 1.4, PAP);
    if (sparkle) { star(g, 30, 9, 3); star(g, 14, 6, 2); }
  }
  fluff(g, 0, 0, 19.5, 22, 2.2, 0.1); g.fill(INK);
  fluff(g, 0, 0, 18.2, 22, 2.0, 0.1); g.fill(PAP);
  g.save(); fluff(g, 0, 0, 18.2, 22, 2.0, 0.1); g.clip();
  ell(g, -17, 4, 7, 14, G50); ell(g, 17, 4, 7, 14, G50);
  g.beginPath(); g.moveTo(-19, 4); g.quadraticCurveTo(-15, 10.5, -8, 9.5); g.quadraticCurveTo(-3, 9, 0, 6); g.quadraticCurveTo(3, 9, 8, 9.5); g.quadraticCurveTo(15, 10.5, 19, 4);
  g.lineTo(24, -30); g.lineTo(-24, -30); g.closePath(); g.fill(INK);
  g.restore();
  for (const [bx, tx, ty] of [[-4, -8, -27], [0, 1, -30], [4, 8, -25]]) { g.beginPath(); g.moveTo(bx - 3, -16); g.quadraticCurveTo(tx - 2, ty + 4, tx, ty); g.quadraticCurveTo(bx + 2, ty + 7, bx + 3, -16); g.fill(INK); }
  const bl = mood === 'sulky' ? 1.3 : 1;
  ell(g, -11.5, 13, 3.4 * bl, 2 * bl, G50); ell(g, 11.5, 13, 3.4 * bl, 2 * bl, G50);
  const EY = 1.5;
  for (const side of [-1, 1]) {
    const ex = side * 8.6;
    if (blink || mood === 'happy' || mood === 'sleepy') {
      if (mood === 'happy') curve(g, ex - 4.5, EY + 2, ex, EY - 4, ex + 4.5, EY + 2, 2, PAP);
      else curve(g, ex - 4.5, EY + 0.5, ex, EY + 3, ex + 4.5, EY + 0.5, 1.8, PAP);
      continue;
    }
    const R = mood === 'surprised' ? 7.4 : 6.8, pr = mood === 'surprised' ? 2.2 : 3.9;
    circ(g, ex, EY, R, PAP);
    const lk = mood === 'smug' ? 1 : look, px = ex + lk * 1.9, py = EY + 0.8;
    circ(g, px, py, pr, INK);
    circ(g, px - 1.3, py - 1.4, 1.2, PAP); circ(g, px + 1.2, py + 1.3, 0.6, PAP);
    if (mood === 'sulky' || mood === 'smug') {
      const lid = mood === 'sulky' ? (side < 0 ? 0.35 : -0.35) : 0;
      g.save(); g.beginPath(); g.arc(ex, EY, R); g.clip();
      g.beginPath(); g.moveTo(ex - R - 1, EY - 1.2 - lid * 4); g.lineTo(ex + R + 1, EY - 1.2 + lid * 4); g.lineTo(ex + R + 1, EY - R - 2); g.lineTo(ex - R - 1, EY - R - 2); g.closePath();
      g.fill(INK); g.restore();
    }
  }
  const BR = ({ neutral: [-6.5, -6.5], happy: [-8, -8], sulky: [-8.8, -5], sleepy: [-6, -6], surprised: [-10, -10], smug: [-6, -9] } as const)[mood];
  for (const side of [-1, 1]) {
    const smugR = mood === 'smug' && side > 0;
    if (mood !== 'neutral') line(g, [side * 11.5, smugR ? BR[1] : BR[0], side * 5, smugR ? BR[1] + 1 : BR[1]], 1.2, PAP);
  }
  const open = mood === 'happy' || mood === 'surprised';
  const upper = (tip: number) => { g.beginPath(); g.moveTo(-5.2, 6.2); g.quadraticCurveTo(0, 4, 5.2, 6.2); g.quadraticCurveTo(3, 9, 0, tip); g.quadraticCurveTo(-3, 9, -5.2, 6.2); g.closePath(); };
  if (open) {
    ell(g, 0, 13.2, mood === 'surprised' ? 3.2 : 4.4, mood === 'surprised' ? 3.6 : 2.8, INK);
    if (mood === 'happy') ell(g, 0, 14.2, 2.4, 1.3, G50);
    upper(11.6); g.stroke(2.2, PAP); g.fill(INK);
  } else {
    upper(14.4); g.stroke(2.2, PAP); g.fill(INK);
    if (mood === 'smug') line(g, [3.4, 13.4, 6.4, 12], 1.1, INK);
  }
  line(g, [-2.6, 6.6, -1.2, 9], 1, PAP);
  // the scarf, its stripes and its end
  g.save();
  g.beginPath(); g.roundRect(-16.5, 16, 33, 8.4, 4.2); g.fill(INK);
  g.beginPath(); g.roundRect(-15.3, 17.2, 30.6, 6, 3); g.fill(PAP);
  for (let sx = -9; sx < 12; sx += 8) g.fillRect(sx, 17, 2.2, 6.4, INK);
  g.translate(-10, 22); g.rotate(0.18);
  g.beginPath(); g.roundRect(-3.6, 0, 7.2, 14, 1.5); g.fill(INK);
  g.beginPath(); g.roundRect(-2.4, 1.2, 4.8, 11.6, 1); g.fill(PAP);
  g.fillRect(-2.4, 5, 4.8, 1.6, INK); g.fillRect(-2.4, 9, 4.8, 1.6, INK);
  for (let k = -2; k <= 2; k += 2) g.fillRect(k - 0.45, 14, 0.9, 2.4, INK);
  g.restore();
  if (hold) hold(g);
  g.restore();
}
/** The logo's head (the manual's headVec): a stamp's silhouette, not the mascot. */
function headVec(g: Vec, x: number, y: number, s: number) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(13, 8); g.quadraticCurveTo(9, 1, 8, -2); g.quadraticCurveTo(14, 2, 17, 7); g.quadraticCurveTo(18, -1, 20, -4); g.quadraticCurveTo(23, 2, 22, 7); g.quadraticCurveTo(26, 2, 31, 1); g.quadraticCurveTo(28, 6, 26, 9); g.closePath(); g.fill(INK);
  circ(g, 20, 22, 15, INK);
  g.beginPath(); g.moveTo(6, 30); g.quadraticCurveTo(20, 44, 34, 30); g.lineTo(34, 40); g.lineTo(6, 40); g.closePath(); g.fill(INK);
  circ(g, 14.5, 21, 5.4, PAP); circ(g, 25.5, 21, 5.4, PAP); circ(g, 15.6, 21.8, 2.7, INK); circ(g, 26.6, 21.8, 2.7, INK);
  g.beginPath(); g.moveTo(17, 26.5); g.quadraticCurveTo(20, 25.5, 23, 26.5); g.lineTo(20, 31.5); g.closePath(); g.fill(PAP);
  line(g, [7, 15, 13, 16], 1.6, PAP); line(g, [33, 15, 27, 16], 1.6, PAP);
  g.restore();
}
function clockFace(g: Vec, cx: number, cy: number, r: number, h: number, m: number) {
  circ(g, cx, cy, r, INK); circ(g, cx, cy, r - 2.2, PAP);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; line(g, [cx + Math.cos(a) * (r - 5), cy + Math.sin(a) * (r - 5), cx + Math.cos(a) * (r - 3.2), cy + Math.sin(a) * (r - 3.2)], i % 3 ? 0.9 : 1.6, INK); }
  const ah = (((h % 12) + m / 60) / 12) * Math.PI * 2 - Math.PI / 2, am = (m / 60) * Math.PI * 2 - Math.PI / 2;
  line(g, [cx, cy, cx + Math.cos(ah) * r * 0.5, cy + Math.sin(ah) * r * 0.5], 2.2, INK);
  line(g, [cx, cy, cx + Math.cos(am) * r * 0.75, cy + Math.sin(am) * r * 0.75], 1.4, INK);
  circ(g, cx, cy, 1.6, INK);
}

// ---- the trinkets, icons and sprites (7 x 7) ----
export const TRINKETS: readonly (readonly string[])[] = [
  ['..###..', '.#...#.', '#..#..#', '#.###.#', '#..#..#', '.#...#.', '..###..'],
  ['.......', '.##....', '#..#...', '#..####', '.##..#.', '.....#.', '.......'],
  ['...#...', '..#.#..', '.#####.', '#.....#', '#.....#', '.#...#.', '..###..'],
  ['.#.#.#.', '#######', '#.....#', '#.###.#', '#.....#', '#######', '.#.#.#.'],
  ['..###..', '.#####.', '.##.##.', '..###..', '..#.#..', '..###..', '...#...'],
];
export const ICONS: Record<string, readonly string[]> = {
  PET: ['.#.#.#.', '.#####.', '##.#.##', '#######', '.##.##.', '..###..', '.......'],
  TONE: ['...##..', '...#.#.', '...#...', '...#...', '.###...', '####...', '.##....'],
  LIGHT: ['..###..', '.#...#.', '.#...#.', '..#.#..', '..###..', '..###..', '...#...'],
  CLOCK: ['..###..', '.#.#.#.', '#..#..#', '#..##.#', '#.....#', '.#...#.', '..###..'],
  FILES: ['###....', '#..####', '#.....#', '#.....#', '#.....#', '#######', '.......'],
  SETTINGS: ['..#.#..', '.#####.', '##...##', '.#...#.', '##...##', '.#####.', '..#.#..'],
};
const NOTE = ['..##', '..#.#', '..#', '..#', '###', '###'];
export function batIcon(b: Buf, x: number, y: number, n: number) { b.box(x, y, 12, 6); b.fill(x + 12, y + 2, 1, 2); for (let i = 0; i < n; i++) b.fill(x + 2 + i * 3, y + 2, 2, 2); }
/** An app's title bar: its name on the left, the time on the right, in negative. */
export function hdr(b: Buf, title: string, time?: string) { b.fill(0, 0, 128, 7); b.text(2, 1, title, 1, 0); if (time) b.text(128 - Buf.tw(time) - 2, 1, time, 1, 0); }

/** What a scene shows besides the bird's pose: the hop, the look, a blink, the Z's step, the clock's hands, the home screen's lines. */
export interface SceneSt { hop?: boolean; look?: number; blink?: boolean; z?: number; sp?: boolean; p?: number; f?: number; h?: number; m?: number; on?: boolean;
  time?: string; date?: string; shinies?: number; of?: number; bat?: number; found?: number }
const hopY = (st: SceneSt) => (st.hop ? -2.5 : 0);
const SC: Record<string, (b: Buf, st: SceneSt) => void> = {
  home: (b, st) => {
    raster((g) => gralha(g, { x: 32, y: 33 + hopY(st), s: 1.22, look: st.look || 0, blink: !!st.blink }), b);
    b.text(66, 6, st.time ?? '00:00', 2); b.text(66, 20, st.date ?? ''); b.text(66, 34, `SHINIES ${st.shinies ?? 0}/${st.of ?? 40}`); b.fill(64, 43, 64, 1);
    TRINKETS.slice(0, st.found ?? 0).forEach((t, i) => b.spr(66 + i * 12, 47, t)); batIcon(b, 114, 0, st.bat ?? 3);
  },
  neutral: (b, st) => raster((g) => gralha(g, { x: 34, y: 33 + hopY(st), s: 1.22, look: st.look || 0, blink: !!st.blink }), b),
  happy: (b, st) => { raster((g) => gralha(g, { x: 34, y: 33 + hopY(st), s: 1.22, mood: 'happy', coin: true, sparkle: st.sp !== false }), b); b.text(72, 18, 'FOUND A'); b.text(72, 27, 'SHINY!', 2); },
  smug: (b) => { raster((g) => gralha(g, { x: 34, y: 33, s: 1.22, mood: 'smug' }), b); b.text(72, 22, 'TOO', 2); b.text(72, 36, 'EASY.', 2); },
  surprised: (b, st) => { raster((g) => gralha(g, { x: 34, y: 33 + hopY(st), s: 1.22, mood: 'surprised' }), b); b.text(80, 20, '!?', 3); },
  sulky: (b, st) => { raster((g) => gralha(g, { x: 34, y: 33, s: 1.22, mood: 'sulky', blink: !!st.blink }), b); b.text(76, 22, 'HMPH.', 2); b.text(76, 40, "IT DIDN'T"); b.text(76, 47, 'WORK.'); },
  sleepy: (b, st) => {
    const z = st.z || 0; raster((g) => gralha(g, { x: 34, y: 35, s: 1.22, mood: 'sleepy', tilt: -0.14 }), b);
    b.text(74, 12 - z * 3, 'Z', 2); if (z > 0) b.text(88, 8 - z * 2, 'Z'); b.text(72, 40, '5 MORE'); b.text(72, 48, 'MINUTES');
  },
  bootlogo: (b) => { raster((g) => headVec(g, 6, 9, 1.15), b); b.text(56, 14, 'JACKDAW', 2); b.box(56, 30, 21, 11); b.text(59, 33, 'MINI'); b.text(56, 52, `FW ${FW}`); },
  loading: (b, st) => {
    const p = st.p || 0; raster((g) => gralha(g, { x: 14 + p * 100, y: 23 + hopY(st), s: 0.5, look: 1 }), b);
    b.text(64 - Buf.tw('LOADING') / 2, 0, 'LOADING'); b.box(8, 56, 112, 7); b.fill(10, 58, Math.round(108 * p), 3);
  },
  lowbat: (b, st) => {
    const z = st.z || 0; raster((g) => gralha(g, { x: 34, y: 35, s: 1.22, mood: 'sleepy', tilt: -0.14 }), b);
    b.text(74, 14 - z * 3, 'Z', 2); if (z > 0) b.text(88, 10 - z * 2, 'Z'); batIcon(b, 114, 0, st.on ? 1 : 0);
    b.text(72, 40, `BATTERY ${st.bat ?? 4}%`); b.text(72, 48, 'PLUG ME IN');
  },
  clock: (b, st) => raster((g) => { gralha(g, { x: 32, y: 33, s: 1.22, look: 1 }); clockFace(g, 96, 32, 22, st.h ?? 0, st.m ?? 0); }, b),
  tone: (b, st) => {
    const f = st.f || 0; raster((g) => gralha(g, { x: 34, y: 33 + (f % 2 ? -2 : 0), s: 1.22, mood: 'happy' }), b);
    b.spr(78, 8 + (f % 2) * 3, NOTE, 2); b.spr(100, 14 - (f % 2) * 3, NOTE, 2); b.text(80, 50, 'LA LA LA');
  },
  light: (b) => raster((g) => {
    g.beginPath(); g.moveTo(68, 44); g.lineTo(128, 18); g.lineTo(128, 64); g.lineTo(68, 52); g.closePath(); g.fill(G25);
    gralha(g, { x: 32, y: 33, s: 1.22, look: 1, hold: (h) => { h.fillRect(18, 11, 10, 6, INK); h.fillRect(27, 9.5, 3.5, 9, INK); } });
  }, b),
};
/** The firmware's version, shown at the opening and in the settings. */
export const FW = '0.8.2';
const cache = new Map<string, Buf>();
/** A scene by name (the apps ask for theirs: docs/identidade/jackdaw-manual.html, section 7), drawn once per state and kept. */
export function scene(name: string, st: SceneSt = {}): Buf {
  const key = name + JSON.stringify(st);
  let b = cache.get(key);
  if (b) return b;
  b = new Buf(); (SC[name] ?? SC.neutral)(b, st);
  if (cache.size > 300) cache.clear();
  cache.set(key, b);
  return b;
}
export const hasScene = (name: string) => name in SC;

/** The menu: the title bar, a row of 9 dots an app (its 7 x 7 icon, its name), the scroll bar on the right. */
export function menuFrame(items: readonly { title: string; icon: readonly string[] }[], sel: number, time: string): Buf {
  const b = new Buf(), rows = 6, top = Math.max(0, Math.min(sel - rows + 1, items.length - rows));
  hdr(b, 'MENU', time);
  items.slice(top, top + rows).forEach((it, k) => {
    const i = top + k, y = 9 + k * 9, on = i === sel;
    if (on) b.fill(0, y - 1, 123, 9);
    b.spr(3, y, it.icon, 1, on ? 0 : 1); b.text(13, y + 1, it.title, 1, on ? 0 : 1);
  });
  const bh = Math.max(3, Math.round(54 / Math.max(1, items.length))); b.fill(126, 9, 1, 54); b.fill(125, 9 + Math.round((sel / Math.max(1, items.length - 1)) * (54 - bh)), 3, bh);
  return b;
}
/** The opening, t ticks (a tenth of a second) after power on: the logo for 1.4 s, then the lines typed out. */
export function bootFrame(t: number, lines: readonly string[]): [Buf, boolean] {
  if (t < 14) return [scene('bootlogo'), false];
  const b = new Buf(); let r = t - 14;
  for (let i = 0; i < lines.length; i++) {
    const n = Math.max(0, Math.min(lines[i].length, Math.floor(r * 2.4)));
    b.text(2, 4 + i * 8, lines[i].slice(0, n));
    if (n < lines[i].length) { if (t % 4 < 2) b.fill(2 + n * 4, 4 + i * 8, 3, 5); return [b, false]; }
    r -= lines[i].length / 2.4 + 2;
  }
  return [b, r > 6];
}

/** The LCD's three lights (the manual's section 3 and 6): the paper, the dot lit, the dot off (the ghost). */
export const LCD_DAY = { bg: [0xaa, 0xb8, 0x6a], on: [0x1f, 0x2a, 0x0c], ghost: [0xa0, 0xae, 0x62] } as const;
export const LCD_LIT = { bg: [0xc4, 0xdc, 0x62], on: [0x1b, 0x2a, 0x05], ghost: [0xb8, 0xd0, 0x5a] } as const;
