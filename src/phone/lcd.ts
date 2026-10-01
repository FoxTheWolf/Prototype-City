import en from '../locale/en.json';
import { type CharGrid } from '../render/grid';
import { fontRows } from '../render/signs';
import { calendar } from '../sim/clock';
import { type World } from '../sim/world';
import { type GpsState } from './gps';
import { type Radio } from './radio';

/** The phone's screen: its size in cells, its colors, and the pieces every app draws with. */
export const SW = 42, SH = 26;
export type C3 = readonly [number, number, number];
export const T = en.phone;
export const LCD: C3 = [8, 15, 20], INK: C3 = [170, 225, 245], DIM: C3 = [80, 120, 140], BAR: C3 = [28, 62, 82], HI: C3 = [255, 196, 90];
export const BAD: C3 = [255, 120, 90], SEL: C3 = [40, 90, 120], WHITE: C3 = [255, 255, 255];
export const ch = (s: string) => s.charCodeAt(0);

/**
 * The phone's themes (its settings): each sets the screen's colors. The color arrays above are
 * changed in place, so every app follows without passing a theme around.
 */
const THEMES: [C3, C3, C3, C3, C3, C3][] = [
  // screen, ink, dim, bar, highlight, selection
  [[8, 15, 20], [170, 225, 245], [80, 120, 140], [28, 62, 82], [255, 196, 90], [40, 90, 120]],
  [[18, 10, 4], [255, 190, 100], [150, 100, 50], [70, 40, 12], [255, 230, 160], [110, 60, 20]],
  [[4, 14, 6], [130, 255, 140], [60, 140, 70], [16, 60, 24], [220, 255, 120], [30, 90, 40]],
  [[196, 202, 184], [30, 36, 30], [90, 98, 86], [150, 160, 140], [140, 40, 20], [160, 175, 150]],
  [[20, 8, 14], [255, 170, 210], [150, 90, 120], [80, 30, 56], [255, 220, 140], [110, 40, 80]],
  [[10, 10, 10], [230, 230, 230], [120, 120, 120], [50, 50, 50], [255, 255, 255], [80, 80, 80]],
];
let theme = 0;
export function applyTheme(k: number) {
  if (k === theme) return;
  theme = k;
  const T = THEMES[k];
  [LCD, INK, DIM, BAR, HI, SEL].forEach((c, i) => { const m = c as unknown as number[]; m[0] = T[i][0]; m[1] = T[i][1]; m[2] = T[i][2]; });
}

/** The screen's cells, clipped to the grid: (x, y) are screen columns and rows. */
export class Lcd {
  constructor(private g: CharGrid, private x0: number, private y0: number) {}
  put(x: number, y: number, c: number, fg: C3, bg: C3) {
    const gx = this.x0 + x, gy = this.y0 + y, g = this.g;
    if (x < 0 || y < 0 || x >= SW || y >= SH || gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return;
    const i = gy * g.cols + gx;
    g.put(i, c, fg[0], fg[1], fg[2]); g.setBg(i, bg[0], bg[1], bg[2]);
  }
  text(x: number, y: number, s: string, fg: C3, bg: C3) { for (let k = 0; k < s.length; k++) this.put(x + k, y, s.charCodeAt(k), fg, bg); }
  fill(y: number, bg: C3) { for (let x = 0; x < SW; x++) this.put(x, y, 32, bg, bg); }
  /** Text centered on row y. */
  center(y: number, s: string, fg: C3, bg: C3) { this.text((SW - s.length) >> 1, y, s, fg, bg); }
}

/** Text that types in: as much of s as `cps` characters a second have written since t = 0. */
export const typed = (s: string, t: number, cps = 60) => s.slice(0, Math.max(0, Math.floor(t * cps)));

export const hhmm = (hour: number) => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;

/**
 * The top row: the antenna and its bars (x with no service, blinking while it searches), E while
 * data moves over EDGE, the GPS while it runs, the time, the battery.
 */
export function statusBar(S: Lcd, world: World, gps: GpsState, now: number, radio: Radio, unread = false) {
  S.fill(0, BAR);
  // an envelope while there are unread messages
  if (unread) S.text(14, 0, '[=]', Math.floor(now * 1.5) & 1 ? HI : INK, BAR);
  S.text(1, 0, 'Y', INK, BAR);
  if (radio.state === 'service') for (let b = 0; b < 4; b++) S.put(2 + b, 0, ch(b < radio.bars ? '|' : '.'), b < radio.bars ? [150, 230, 150] : DIM, BAR);
  else if (radio.state !== 'search' || Math.floor(now * 2) & 1) S.text(2, 0, 'x', BAD, BAR);
  const J = radio.job;
  if (J && (J.state === 'connecting' || J.state === 'loading') && Math.floor(now * 6) & 1) S.text(7, 0, 'E', HI, BAR);
  // GPS: blinking while it searches, steady with a fix, dim when it lost the satellites
  if (gps === 'fix') S.text(9, 0, 'GPS', [120, 255, 150], BAR);
  else if (gps === 'search' && Math.floor(now * 2) & 1) S.text(9, 0, 'GPS', [255, 220, 120], BAR);
  else if (gps === 'lost') S.text(9, 0, 'GPS', [110, 110, 110], BAR);
  S.text(SW - 13, 0, hhmm(calendar(world.time).hour), INK, BAR);
  S.text(SW - 6, 0, '[###]', [150, 230, 150], BAR);
}

export function softKeys(S: Lcd, left: string, right: string) {
  S.fill(SH - 1, BAR);
  S.text(1, SH - 1, left, INK, BAR);
  S.text(SW - 1 - right.length, SH - 1, right, INK, BAR);
}

/** A title on row 1. */
export function title(S: Lcd, s: string, t: number, right = '') {
  S.fill(1, [16, 30, 40]);
  S.text(1, 1, typed(s, t), HI, [16, 30, 40]);
  if (right) S.text(SW - right.length - 1, 1, right, DIM, [16, 30, 40]);
}

/** Big 5x7 characters made of lit cells, centered on row y. */
export function bigText(S: Lcd, y: number, s: string, col: C3, t = 1e9) {
  const x0 = (SW - (s.length * 6 - 1)) >> 1;
  for (let n = 0; n < s.length; n++) {
    const rows = fontRows(s.charCodeAt(n));
    if (!rows) continue;
    for (let r = 0; r < 7; r++) {
      if (r > t * 30) break; // draws in from the top
      for (let b = 0; b < 5; b++) if ((rows[r] >> (4 - b)) & 1) S.put(x0 + n * 6 + b, y + r, 32, col, col);
    }
  }
}

export const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
