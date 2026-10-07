import { mulberry32 } from '../core/rng';
import { Img, dark, hex, Paint, type C3 } from '../render/paint2d';

/**
 * 15.17c: the Ferret's frame in pixels (docs/identidade/ferret-manual.html, "A moldura"), painted on the
 * notebook screen's HD layer under the text the browser writes in its cells. The rows: the tabs (2: the strip
 * with the name Ferret on the right, the tabs' titles under it), the navigation bar (2 and a bit: the round back
 * button, forward, reload or stop, home, the address, the Lookwise box, the ferret), the bookmarks (1 and a bit),
 * the page, the status line (1). The frame is the Ferret's cream and earth (the user, 2026-10-07: a grey frame
 * did not stand apart from a white page). Everything here is in the pane's cells
 * (CW x CH pixels each) from the pane's left edge `ox`, so the browser and this agree on where things are.
 */
export const CW = 8, CH = 16;
/** The rows: the tabs (their titles on TAB_ROW), the navigation bar, the bookmarks; the page starts at PAGE_Y; the status is the last. */
export const TABS_Y = 0, TAB_ROW = 1, NAV_Y = 2, MARKS_Y = 5, PAGE_Y = 6;
/** A tab's width in cells; where its icon, title and close box fall within it. */
export const TAB_W = 22, TAB_ICON = 1, TAB_TEXT = 4, TAB_TEXT_W = 14, TAB_X = 19;
/** The navigation bar's buttons (cell spans) and fields; the text of the address and the search is on NAV_TEXT_Y. */
export const NAV_TEXT_Y = 3, BACK: [number, number] = [0, 4], FWD: [number, number] = [4, 7], RELOAD: [number, number] = [7, 9], HOME: [number, number] = [10, 13];
export const ADDR_X = 13;
/** The address field ends SEARCH_W + 6 cells before the pane's right edge; the search box, then the ferret. */
export const SEARCH_W = 16;
export const addrEnd = (W: number) => W - SEARCH_W - 7;
export const searchX = (W: number) => W - SEARCH_W - 5;

/** What a site's icon is: the browser's own pages, the search, the portal, the mail, the social site, or a letter in a color. */
export type Icon = { k: 'ferret' | 'look' | 'mail' } | { k: 'letter'; ch: string; bg: C3; fg: C3 };
/** The ferret in the corner: still (peeking), digging while the network works, coming out once it is done, lost on an error. */
export type FerretState = 'peek' | 'dig' | 'out' | 'lost';

export interface ChromeState {
  W: number;
  H: number;
  tabs: { icon: Icon; on: boolean }[];
  canBack: boolean;
  canFwd: boolean;
  loading: boolean;
  secure: boolean;
  /** The current page's icon (in the address field); the page's scroll (0..1 down, and the share shown); null for no bar. */
  icon: Icon;
  scroll: [number, number] | null;
  ferret: [FerretState, number];
  marks: { icon: Icon; w: number }[];
  /** The page come down so far, 0..1, while it is coming; null when not loading. */
  progress: number | null;
  /** A bookmark star: lit when the page is one. */
  marked: boolean;
  /** The browser's own error page (15.17d): which, and its buttons (cells x, y, width) to frame. */
  err: { kind: 'offline' | 'dns' | 'down' | 'cert'; btns: [number, number, number][] } | null;
}
/** The lost ferret on an error page: its size, and where it sits (cells from the page's top-left). */
const ERR_FERRET = 120, ERR_FERRET_AT: [number, number] = [3, 3];

const B = { cream: hex('#f1e4c8'), cafe: hex('#4a2c1a'), pet: hex('#6b4a2e'), pet2: hex('#7a5838'), eye: hex('#120a06'), nose: hex('#2e170c'), muzzle: hex('#fbf6ea'), shade: hex('#d9c6a0') };
const FIELD_LINE: C3 = hex('#a08c6a'), GOLD: C3 = hex('#c9a227');

/** The frame's cream and earth (the cells' backgrounds under the text are these too, browser.ts). */
export const FR = {
  strip: hex('#d8c8a6'), strip2: hex('#c8b590'), tabOn: hex('#f8f1e2'), tabOff: hex('#e6d9bd'), tabOffHi: hex('#efe5cf'),
  nav: hex('#f8f1e2'), nav2: hex('#e9dcc0'), marks: hex('#efe4cc'), status: hex('#ece0c6'), status2: hex('#dccdae'), line: hex('#b09a74'), brand: hex('#6b4a2e'),
};

/** The whole frame (not the page's own content), for a pane W x H cells at cell column ox. */
export function paintChrome(P: Paint, S: ChromeState, ox: number) {
  const X = ox * CW, W = S.W, PW = W * CW, R = (r: number) => r * CH;
  // the tabs: a strip two rows tall, a rounded tab each (the active one lighter, merging into the bar below), the "+"
  P.grad(X, R(TABS_Y), PW, R(NAV_Y), [[0, FR.strip], [1, FR.strip2]]);
  S.tabs.forEach((t, i) => {
    const tx = X + (1 + i * TAB_W) * CW, tw = (TAB_W - 1) * CW, y0 = R(TAB_ROW) - 7, y1 = R(NAV_Y);
    const pts = [tx, y1, tx + 5, y0 + 1, tx + 9, y0, tx + tw - 9, y0, tx + tw - 5, y0 + 1, tx + tw, y1];
    P.poly(pts, FR.line);
    const inner = [tx + 1, y1, tx + 6, y0 + 2, tx + 9, y0 + 1, tx + tw - 9, y0 + 1, tx + tw - 6, y0 + 2, tx + tw - 1, y1];
    P.poly(inner, t.on ? FR.tabOn : FR.tabOff);
    if (!t.on) P.rect(tx + 3, y0 + 2, tw - 6, 5, FR.tabOffHi);
    icon(P, t.icon, tx + TAB_ICON * CW + 4, R(TAB_ROW));
  });
  // the name, on the strip's right: the ferret's face and "Ferret" (the cells write the word)
  icon(P, { k: 'ferret' }, X + PW - 10 * CW, R(TABS_Y));
  // the navigation bar
  const nb = R(NAV_Y), mb = R(MARKS_Y) - 6, cy = R(NAV_TEXT_Y) + 7;
  P.grad(X, nb, PW, mb - nb, [[0, FR.nav], [1, FR.nav2]]);
  // back: the big round one; forward: smaller, brown only when there is somewhere to go
  const bx = X + 16;
  P.disc(bx, cy, 12.5, hex('#8a7556'));
  P.grad(bx - 11.5, cy - 11.5, 23, 23, [[0, hex('#fffdf8')], [0.5, hex('#efe6d4')], [1, hex('#cdbd9f')]], true, 11.5);
  P.poly([bx - 7, cy, bx + 1, cy - 7, bx + 1, cy - 2.5, bx + 8, cy - 2.5, bx + 8, cy + 2.5, bx + 1, cy + 2.5, bx + 1, cy + 7], S.canBack ? B.pet : hex('#b3a68e'));
  const fx = X + 41;
  P.disc(fx, cy, 8.5, hex('#9a8868'));
  P.grad(fx - 7.5, cy - 7.5, 15, 15, [[0, hex('#fffdf8')], [1, hex('#d6c8ac')]], true, 7.5);
  P.poly([fx + 5, cy, fx - 0.5, cy - 5, fx - 0.5, cy - 2, fx - 5, cy - 2, fx - 5, cy + 2, fx - 0.5, cy + 2, fx - 0.5, cy + 5], S.canFwd ? B.pet : hex('#bdb19a'));
  // reload (a green turning arrow) or, while loading, stop (a red cross)
  const rx = X + RELOAD[0] * CW + 8;
  if (S.loading) { P.line(rx - 5, cy - 5, rx + 5, cy + 5, 2.6, hex('#c0392b')); P.line(rx + 5, cy - 5, rx - 5, cy + 5, 2.6, hex('#c0392b')); }
  else {
    P.ring(rx, cy, 6.5, 2.2, hex('#2e7d4f'));
    P.rect(rx + 1, cy - 8, 7, 6, FR.nav);
    P.poly([rx + 1, cy - 9, rx + 6, cy - 6, rx + 1, cy - 2], hex('#2e7d4f'));
  }
  // home: a house's outline
  const hx = X + HOME[0] * CW + 12, hc: C3 = hex('#5a4630');
  P.line(hx - 9, cy + 1, hx, cy - 7, 2, hc); P.line(hx, cy - 7, hx + 9, cy + 1, 2, hc);
  P.line(hx - 6, cy, hx - 6, cy + 7, 2, hc); P.line(hx + 6, cy, hx + 6, cy + 7, 2, hc); P.line(hx - 6, cy + 7, hx + 6, cy + 7, 2, hc);
  // the address: a white field (light yellow with a padlock on https), the site's icon, the star
  const ax = X + ADDR_X * CW, aw = (addrEnd(W) - ADDR_X) * CW, fy = R(NAV_TEXT_Y) - 2, fh = CH + 3;
  P.rrect(ax, fy, aw, fh, 3, S.secure ? GOLD : FIELD_LINE);
  P.rrect(ax + 1, fy + 1, aw - 2, fh - 2, 2, S.secure ? hex('#fff8c4') : [255, 255, 255]);
  icon(P, S.icon, ax + CW - 2, fy + 2);
  if (S.secure) lock(P, ax + aw - 4 * CW + 2, fy + 6, GOLD);
  starIcon(P, ax + aw - 2 * CW + 2, fy + fh / 2, S.marked ? hex('#f2b51c') : null);
  // the search box: rounded, the owl, the name in grey (the cells write it)
  const sx = X + searchX(W) * CW, sw = SEARCH_W * CW;
  P.rrect(sx, fy, sw, fh, fh / 2, FIELD_LINE);
  P.rrect(sx + 1, fy + 1, sw - 2, fh - 2, fh / 2 - 1, [255, 255, 255]);
  icon(P, { k: 'look' }, sx + 6, fy + 2);
  // the ferret in the corner, behind a thin rule
  P.rect(X + PW - 4 * CW - 3, nb + 6, 1, mb - nb - 12, FR.line);
  sprite(P, ferretSprite(S.ferret[0], S.ferret[1]), X + PW - 4 * CW + 1, cy - 14);
  // the bookmarks: a band a row and a bit, a rule over it and under it
  P.rect(X, mb, PW, R(PAGE_Y) - mb, FR.marks);
  P.rect(X, mb, PW, 1, FR.line);
  P.rect(X, R(PAGE_Y) - 1, PW, 1, FR.line);
  let mx = 1;
  for (const m of S.marks) { if (mx + 3 + m.w > W) break; icon(P, m.icon, X + mx * CW, R(MARKS_Y)); mx += m.w + 5; }
  // the page's scroll bar: thin, rounded, in the last column
  const py = R(PAGE_Y), ph = (S.H - PAGE_Y - 1) * CH;
  if (S.scroll) {
    const [at, share] = S.scroll, tx = X + PW - 6, th = Math.max(12, ph * share);
    P.rrect(tx, py + 2, 4, ph - 4, 2, hex('#c9ced5'));
    P.rrect(tx, py + 2 + (ph - 4 - th) * at, 4, th, 2, hex('#8f98a3'));
  }
  // an error page: the lost ferret, a frame round each button, and for a lapsed certificate the yellow band
  if (S.err) {
    if (S.err.kind === 'cert') P.rect(X, py, PW - 8, 4, hex('#e8b400'));
    sprite(P, ferretSprite('lost', 2, ERR_FERRET), X + ERR_FERRET_AT[0] * CW, py + ERR_FERRET_AT[1] * CH);
    const [bx0, by0, bw0] = S.err.btns[0] ?? [0, -1, 0];
    if (by0 >= 0) { P.rrect(X + bx0 * CW - 3, by0 * CH - 3, bw0 * CW + 6, CH + 6, 4, hex('#8a8a8a')); P.rrect(X + bx0 * CW - 2, by0 * CH - 2, bw0 * CW + 4, CH + 4, 3, hex('#e4e4e4')); }
  }
  // the status line, its progress bar (the burrow's earth) and the padlock
  const sb = R(S.H - 1);
  P.grad(X, sb, PW, CH, [[0, FR.status], [1, FR.status2]]);
  P.rect(X, sb, PW, 1, FR.line);
  if (S.progress !== null) {
    const gx = X + PW - 32 * CW, gw = 16 * CW;
    P.rect(gx, sb + 4, gw, 9, hex('#9a8868')); P.rect(gx + 1, sb + 5, gw - 2, 7, [255, 255, 255]);
    if (S.progress > 0) P.grad(gx + 1, sb + 5, (gw - 2) * S.progress, 7, [[0, hex('#a27a52')], [1, B.pet]]);
  }
  if (S.secure) lock(P, X + PW - 14 * CW, sb + 4, GOLD);
}

/** A padlock 10 px wide at x, y (its shackle above). */
function lock(P: Paint, x: number, y: number, c: C3) {
  P.ring(x + 5, y + 2, 3.5, 1.5, c, 1, 3.5);
  P.rect(x + 1, y + 3, 9, 1, [255, 248, 196]);
  P.rrect(x, y + 3, 10, 7, 1.5, c);
}
/** The bookmark star round x, y: lit (filled) or an outline. */
function starIcon(P: Paint, x: number, y: number, fill: C3 | null) {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) { const a = (Math.PI * i) / 5 - Math.PI / 2, q = i % 2 ? 2.6 : 6.5; pts.push(x + Math.cos(a) * q, y + Math.sin(a) * q); }
  P.poly(pts, fill ?? hex('#7a8594'));
  if (!fill) { const inn: number[] = []; for (let i = 0; i < 10; i++) { const a = (Math.PI * i) / 5 - Math.PI / 2, q = i % 2 ? 1.4 : 4.4; inn.push(x + Math.cos(a) * q, y + Math.sin(a) * q); } P.poly(inn, [255, 255, 255]); }
}

// ---- the 16 px icons (the manual's pixel maps) ----
const FPX: Record<string, C3> = { D: B.pet2, R: B.cafe, c: B.cream, s: B.shade, m: B.cafe, k: B.eye, w: B.muzzle, n: B.nose, e: hex('#d9a08c'), t: hex('#cfae84'), p: hex('#e0948c') };
const I16 = ['.....RRRRRR.....', '...RRDDDDDDRR...', '..RDcDDDDDDcDR..', '.RDcettttttecDR.', '.RDccccccccccDR.', 'RDcmmmmmmmmmmcDR', 'RDcmkmmmmmmkmcDR', 'RDccwmmppmmwccDR', 'RDDcwwwppwwwcDDR', 'RDDcwwwwwwwwcDDR', 'RDDDcwwwwwwcDDDR', '.RDDmccccccmDDR.', '.RDDmmccccmmDDR.', '..RRmmccccmmRR..', '..sccRRRRRRccs..', '................'];
const OW = { ink: hex('#16244a'), feath: hex('#5e6f8e'), feath2: hex('#3f4d6a'), disc: hex('#d6dde8'), amber: hex('#f4a91c'), pupil: hex('#0b0e16'), beak: hex('#e08a1a') };
const OPX: Record<string, C3> = { f: OW.feath2, F: OW.feath, k: OW.ink, a: OW.amber, p: OW.pupil, b: OW.beak, d: OW.disc, w: [255, 255, 255] };
const OWL16 = ['................', '.ff..........ff.', '.fFf........fFf.', '.fFFFFFFFFFFFFf.', 'fFFFFFFFFFFFFFFf', 'FFkkkkFFFFkkkkFF', 'FkaaaakFFkaaaakF', 'FkapwakddkapwakF', 'FkappakbbkappakF', 'FkaaaakbbkaaaakF', 'FFkkkkFbbFkkkkFF', 'fFFFFFFFFFFFFFFf', '.fFdFdFFFFdFdFf.', '..fFFdFFFFdFFf..', '...ffFFFFFFff...', '................'];

/** A site's 16 px icon with its top-left at x, y. */
export function icon(P: Paint, I: Icon, x: number, y: number) {
  if (I.k === 'ferret' || I.k === 'look') {
    const map = I.k === 'ferret' ? I16 : OWL16, pal = I.k === 'ferret' ? FPX : OPX;
    map.forEach((row, j) => { for (let i = 0; i < 16; i++) { const c = pal[row[i]]; if (c) P.dot(x + i, y + j, c); } });
    return;
  }
  if (I.k === 'mail') {
    // an envelope on the provider's blue
    P.rrect(x, y, 16, 16, 2, hex('#003399'));
    P.rect(x + 2, y + 4, 12, 8, [255, 255, 255]);
    P.line(x + 2.5, y + 4.5, x + 8, y + 9, 1, hex('#003399')); P.line(x + 13.5, y + 4.5, x + 8, y + 9, 1, hex('#003399'));
    return;
  }
  const L = I as Extract<Icon, { k: 'letter' }>;
  P.rrect(x, y, 16, 16, 2, dark(L.bg, 0.3));
  P.rrect(x + 1, y + 1, 14, 14, 1.5, L.bg);
  P.text(x + 3, y + 2, L.ch, 2, L.fg, 1, 0);
}

/** A sprite (a picture with soft edges) laid at x, y. */
function sprite(P: Paint, s: Sprite, x: number, y: number) {
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
    const k = (j * s.w + i) * 4, a = s.px[k + 3];
    if (a) P.dot(x + i, y + j, [s.px[k], s.px[k + 1], s.px[k + 2]], a / 255);
  }
}
interface Sprite { w: number; h: number; px: Uint8ClampedArray }

// ---- the ferret, 28 px (the manual's `ferret`, painted 4x larger and shrunk for soft edges) ----
const FERRET_PX = 28, SS = 4;
const sprites = new Map<string, Sprite>();
/** The ferret's frames: digging loops 6 (~8 a second); coming out plays 6 once; lost looks side to side. */
export const FERRET_FRAMES = 6;
export function ferretSprite(state: FerretState, frame: number, size = FERRET_PX): Sprite {
  const f = state === 'peek' ? 0 : frame % FERRET_FRAMES, key = `${state}${f}:${size}`;
  let s = sprites.get(key);
  if (!s) { s = paintFerret(state, f, size); sprites.set(key, s); }
  return s;
}

/** An SVG path of M, L, C, Q and Z (absolute) as a polygon of points. */
function pathPts(d: string): number[] {
  const t = d.match(/[MLCQZ]|-?\d*\.?\d+/g)!, out: number[] = [];
  let i = 0, cx = 0, cy = 0, op = 'M';
  const n = () => parseFloat(t[i++]);
  while (i < t.length) {
    if (/[MLCQZ]/.test(t[i])) op = t[i++];
    if (op === 'Z') continue;
    if (op === 'M' || op === 'L') { cx = n(); cy = n(); out.push(cx, cy); }
    else if (op === 'C') {
      const x1 = n(), y1 = n(), x2 = n(), y2 = n(), x = n(), y = n();
      for (let k = 1; k <= 8; k++) { const u = k / 8, v = 1 - u; out.push(v * v * v * cx + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x, v * v * v * cy + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y); }
      cx = x; cy = y;
    } else if (op === 'Q') {
      const x1 = n(), y1 = n(), x = n(), y = n();
      for (let k = 1; k <= 6; k++) { const u = k / 6, v = 1 - u; out.push(v * v * cx + 2 * v * u * x1 + u * u * x, v * v * cy + 2 * v * u * y1 + u * u * y); }
      cx = x; cy = y;
    }
  }
  return out;
}
const HEAD = pathPts('M100 50 C 129 50, 149 65, 151 89 C 153 111, 143 128, 128 138 C 117 146, 83 146, 72 138 C 57 128, 47 111, 49 89 C 51 65, 71 50, 100 50 Z');
const MASKS = ['M50 92 C 56 82, 76 80, 92 88 C 96 92, 96 100, 92 104 C 84 110, 66 112, 56 106 C 51 102, 49 97, 50 92 Z', 'M150 92 C 144 82, 124 80, 108 88 C 104 92, 104 100, 108 104 C 116 110, 134 112, 144 106 C 149 102, 151 97, 150 92 Z', 'M91 86 Q 100 82 109 86 L 106 108 Q 100 106 94 108 Z'].map(pathPts);
const NECK = pathPts('M60 172 C 58 150, 64 134, 76 126 L 124 126 C 136 134, 142 150, 140 172 Z');
const BIB = pathPts('M84 172 C 83 154, 90 140, 100 138 C 110 140, 117 154, 116 172 Z');
const NOSE = pathPts('M87 110 C 87 103, 113 103, 113 110 C 113 117, 105 122, 100 122 C 95 122, 87 117, 87 110 Z');
const CROWN = pathPts('M30 30 L170 30 L170 80 C 140 64, 60 64, 30 80 Z');

function paintFerret(state: FerretState, f: number, size: number): Sprite {
  const N = size * SS, k = N / 200, base = new Img(N, N), P = new Paint(base);
  const sc = (pts: number[], dx = 0, dy = 0) => pts.map((v, i) => (i & 1 ? (v + dy) * k : (v + dx) * k));
  const headDy = state === 'peek' ? 44 : state === 'dig' ? [30, 44, 56, 44, 30, 22][f] : state === 'out' ? [40, 20, 0, 0, 0, 0][f] : 0;
  const look = state === 'lost' ? [-7, -7, 0, 7, 7, 0][f] : 0, blink = state === 'out' && f === 4;
  // the burrow: lit from the top
  const cx = 100 * k, cy = 96 * k;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy);
    if (d > 72 * k) continue;
    const t = Math.min(1, Math.hypot(i + 0.5 - cx, j + 0.5 - 84.5 * k) / (86 * k));
    base.set(i, j, 0xa8 + (0x5a - 0xa8) * t, 0x84 + (0x3c - 0x84) * t, 0x5a + (0x24 - 0x5a) * t);
  }
  // the earth thrown out while digging
  if (state === 'dig') {
    const r = mulberry32(1 + f);
    for (let n = 0; n < 9; n++) { const a = -Math.PI * (0.15 + r() * 0.7), d = 78 + r() * 26, x = 100 + Math.cos(a) * d, y = 96 + Math.sin(a) * d * 0.95; P.rect((x - 3) * k, (y - 3) * k, (4 + r() * 4) * k, (4 + r() * 3) * k, hex(n % 3 ? '#7a5434' : '#5a3a22')); }
  }
  // the head, painted apart and kept only inside the burrow (so it can sink into it)
  const head = new Img(N, N), H = new Paint(head), dx = look, dy = headDy;
  H.poly(sc(NECK, dx, dy), B.cafe);
  H.poly(sc(BIB, dx, dy), hex('#f4e9d3'));
  for (const [ex, ix] of [[60, 63], [140, 137]]) { H.disc((ex + dx) * k, (68 + dy) * k, 14 * k, hex('#a88a66')); H.disc((ex + dx) * k, (68 + dy) * k, 12 * k, hex('#f4e9d3')); H.disc((ix + dx) * k, (71 + dy) * k, 7.5 * k, hex('#d9a08c')); }
  H.poly(sc(HEAD, dx, dy), hex('#a88a66'));
  const face = new Img(N, N), F = new Paint(face);
  F.poly(sc(HEAD, dx, dy), hex('#f4e9d3'));
  F.poly(sc(CROWN, dx, dy), hex('#cfae84'));
  for (const m of MASKS) F.poly(sc(m, dx, dy), hex('#55361f'));
  for (const mx of [86, 114]) F.disc((mx + dx) * k, (124 + dy) * k, 17 * k, hex('#fffaf0'), 1, 12.5 * k);
  F.disc((100 + dx) * k, (137 + dy) * k, 13 * k, hex('#fffaf0'), 1, 7 * k);
  // the face inside the head's outline (a line's width in)
  const inHead = new Img(N, N);
  new Paint(inHead).poly(sc(HEAD.map((v, i) => (i & 1 ? 96 + (v - 96) * 0.97 : 100 + (v - 100) * 0.97)), dx, dy), [1, 1, 1]);
  for (let q = 0; q < N * N; q++) if (inHead.px[q * 4 + 3] && face.px[q * 4 + 3]) head.set(q % N, Math.floor(q / N), face.px[q * 4], face.px[q * 4 + 1], face.px[q * 4 + 2]);
  for (const ex of [79, 121]) {
    if (blink) H.line((ex - 5 + dx) * k, (96 + dy) * k, (ex + 5 + dx) * k, (96 + dy) * k, 3 * k, B.eye);
    else { H.disc((ex + dx) * k, (96 + dy) * k, 6 * k, B.eye); H.disc((ex + 1.8 + dx) * k, (94.2 + dy) * k, 2 * k, [255, 255, 255]); }
  }
  H.poly(sc(NOSE, dx, dy), hex('#e0948c'));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const q = (j * N + i) * 4;
    if (head.px[q + 3] && Math.hypot(i + 0.5 - cx, j + 0.5 - cy) <= 68 * k) base.set(i, j, head.px[q], head.px[q + 1], head.px[q + 2]);
  }
  // the burrow's rim over the neck; the white mitts over the rim when the ferret is up
  P.ring(cx, cy, 76 * k, 8 * k, B.cafe);
  if (headDy <= 8) for (const px of [78, 122]) { P.disc(px * k, 166 * k, 13 * k, hex('#a88a66'), 1, 8.5 * k); P.disc(px * k, 166 * k, 11 * k, hex('#f4e9d3'), 1, 7 * k); }
  // shrink SS x SS: the colour of what is covered, and how much is
  const out: Sprite = { w: size, h: size, px: new Uint8ClampedArray(size * size * 4) };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < SS; y++) for (let x = 0; x < SS; x++) { const q = ((j * SS + y) * N + i * SS + x) * 4; if (base.px[q + 3]) { r += base.px[q]; g += base.px[q + 1]; b += base.px[q + 2]; n++; } }
    if (!n) continue;
    const o = (j * size + i) * 4;
    out.px[o] = r / n; out.px[o + 1] = g / n; out.px[o + 2] = b / n; out.px[o + 3] = (255 * n) / (SS * SS);
  }
  return out;
}

/** A site's icon from its host: the browser's own pages, the search, the mail, else its first letter in a color of its own. */
export function iconOf(kind: string, name: string, seed: number): Icon {
  if (kind === 'ferret' || kind === 'burrow') return { k: 'ferret' };
  if (kind === 'search') return { k: 'look' };
  if (kind === 'mail') return { k: 'mail' };
  const r = mulberry32(seed), bg: C3 = kind === 'portal' ? hex('#003399') : kind === 'wire' ? hex('#2c4a88') : [40 + r() * 170, 40 + r() * 170, 40 + r() * 170];
  const fg: C3 = kind === 'portal' ? hex('#ffcc00') : (bg[0] * 0.3 + bg[1] * 0.59 + bg[2] * 0.11) > 140 ? [20, 20, 20] : [255, 255, 255];
  return { k: 'letter', ch: (name.match(/[a-z0-9]/i)?.[0] ?? '?').toUpperCase(), bg, fg };
}
