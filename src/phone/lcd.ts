import en from '../locale/en.json';
import { type CharGrid } from '../render/grid';
import { HD, HdOrder, type HdLayer } from '../render/hd';
import { fontRows } from '../render/signs';
import { calendar } from '../sim/clock';
import { type World } from '../sim/world';
import { type GpsState } from './gps';
import { type Radio } from './radio';
import { type Wifi } from './wifi';
import { type Editor } from './textinput';
import { CHROME } from './pixui';

/** The phone's screen: its size in cells, its colors, and the pieces every app draws with. */
/** The screen's cells (the content area between the pixel bars, pixui.ts): 40 x 32 cells of 6 x 12 pixels on the 240 x 432 screen. */
export const SW = 40, SH = 32;
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
  /** `hd`: the pixel layer the screen draws on (its own, since the screen is a picture of its own; else the interface's). */
  constructor(private g: CharGrid, private x0: number, private y0: number, private hdl: HdLayer | null = null) {}
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
  /** The background colour drawn at screen cell (x, y), or null off the grid. */
  peek(x: number, y: number): C3 | null {
    const gx = this.x0 + x, gy = this.y0 + y, g = this.g;
    if (x < 0 || y < 0 || x >= SW || y >= SH || gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return null;
    const k = (gy * g.cols + gx) * 4;
    return [g.bg[k], g.bg[k + 1], g.bg[k + 2]];
  }
  /** Whether there is an HD layer to draw pixels on. */
  get hd(): boolean { return !!(this.hdl ?? HDL); }
  /** HD pixel (ix, iy) (0..HD-1 each) of screen cell (x, y), over the interface (or under its letters, 15.17i). */
  pixel(x: number, y: number, ix: number, iy: number, r: number, g: number, b: number, under = false) {
    const H = this.hdl ?? HDL;
    if (!H || x < 0 || y < 0 || x >= SW || y >= SH) return;
    H.put((this.x0 + x) * HD + ix, (this.y0 + y) * HD + iy, r, g, b, under ? HdOrder.Under : HdOrder.Over);
  }
}

/** The HD layer the phone draws its photos on (main sets it). */
let HDL: HdLayer | null = null;
export const setHd = (h: HdLayer) => { HDL = h; };
export const hdLayer = () => HDL;

/** Text that types in: as much of s as `cps` characters a second have written since t = 0. */
export const typed = (s: string, t: number, cps = 60) => s.slice(0, Math.max(0, Math.floor(t * cps)));

export const hhmm = (hour: number) => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;

/**
 * The top row: the antenna and its bars (rising, x with no service, blinking while it searches), E
 * while data moves over EDGE, Wi-Fi, the GPS while it runs, an envelope for unread messages, the
 * time, the battery.
 */
export function statusBar(_S: Lcd, world: World, gps: GpsState, now: number, radio: Radio, unread = false, wifi: Wifi | null = null, batt = 1, charging = false, phones = false) {
  // drawn in pixels over the screen's top (pixui.ts, the manual's 18 px bar)
  const J = radio.job, blink = (Math.floor(now * 2) & 1) === 1;
  CHROME.status = {
    bars: radio.bars, service: radio.state === 'service', search: radio.state === 'search', edge: !!J && (J.state === 'connecting' || J.state === 'loading'),
    gps: gps === 'off' ? '' : gps, unread, wifi: wifi && (wifi.state === 'up' || ((wifi.state === 'assoc' || wifi.state === 'dhcp') && blink)) ? Math.ceil(wifi.bars * 0.75) : -1,
    phones, time: hhmm(calendar(world.time).hour), batt, charging, blink,
  };
}

/** The soft keys' actions: drawn in pixels as the footer's touch buttons (pixui.ts, the manual's 26 px footer). */
export function softKeys(_S: Lcd, left: string, right: string) { CHROME.soft = [left, right]; }

/** A title on row 1. */
export function title(S: Lcd, s: string, t: number, right = '') {
  const B: C3 = [BAR[0] * 1.2 + 6, BAR[1] * 1.2 + 6, BAR[2] * 1.2 + 6];
  S.fill(1, B);
  S.text(1, 1, typed(s, t), [255, 255, 255], B);
  if (right) S.text(SW - right.length - 1, 1, right, INK, B);
}

/** Big 5x7 characters made of lit cells, centered on row y. */
export function bigText(S: Lcd, y: number, s: string, col: C3, t = 1e9, dx = 0) {
  // a column between letters while they fit; set tight when one more would not
  const step = s.length * 6 - 1 <= SW ? 6 : 5, x0 = ((SW - (s.length * step - (step - 5))) >> 1) + dx;
  for (let n = 0; n < s.length; n++) {
    const rows = fontRows(s.charCodeAt(n));
    if (!rows) continue;
    for (let r = 0; r < 7; r++) {
      if (r > t * 30) break; // draws in from the top
      for (let b = 0; b < 5; b++) if ((rows[r] >> (4 - b)) & 1) S.put(x0 + n * step + b, y + r, 32, col, col);
    }
  }
}

export const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * The typing hint on row y (2026-10-06): in Abc, the tapping key's letters with the one picked lit;
 * in T9, the guesses for the keys typed with the one shown lit (* steps through them); else `rest`.
 */
export function typeHint(S: Lcd, x: number, y: number, ed: Editor, now: number, rest: string, fg: C3, bg: C3) {
  const tap = ed.tapping(now);
  if (tap) {
    const i = ed.tapIndex();
    for (let k = 0; k < tap.length && x + k < SW - 1; k++) S.put(x + k, y, ch(tap[k] === ' ' ? '_' : tap[k]), k === i ? bg : fg, k === i ? fg : bg);
    return;
  }
  const L = ed.guesses();
  if (L.length < 2) { S.text(x, y, rest, fg, bg); return; }
  // the words in a row; from the one shown back as far as fits, so it never falls off the edge
  const i = ed.guessIndex(), room = SW - 1 - x;
  let a = 0, w = L.slice(0, i + 1).reduce((n, s) => n + s.length + 1, 0);
  while (w > room && a < i) w -= L[a++].length + 1;
  let cx = x;
  for (let k = a; k < L.length && cx < x + room; k++) {
    const s = L[k].slice(0, x + room - cx), on = k === i;
    S.text(cx, y, s, on ? bg : fg, on ? fg : bg);
    cx += s.length + 1;
  }
}
