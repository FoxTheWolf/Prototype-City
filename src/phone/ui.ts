import { hash3 } from '../core/rng';
import { SHAPE } from '../render/atlas';
import { type C3, ch, type Lcd, SH, SW } from './lcd';
import { inBox } from './shells';

/**
 * The pieces the phone's own screens are drawn with since its redesign (stage 12): the look of a
 * 2008 handset's system, glossy bars and rounded tiles, the same family as the apps that have a
 * look of their own (skins.ts, wire.ts, calendar.ts).
 */
export const lerp = (a: C3, b: C3, k: number): C3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
export const mul = (c: C3, k: number): C3 => [c[0] * k, c[1] * k, c[2] * k];

/** Rows y0..y1 in a vertical gradient. */
export function vgrad(S: Lcd, y0: number, y1: number, top: C3, bot: C3) {
  for (let y = y0; y <= y1; y++) S.fill(y, lerp(top, bot, y1 > y0 ? (y - y0) / (y1 - y0) : 0));
}

/**
 * A rounded box from (x0, y0) to (x1, y1), filled with `col` (or a gradient down to `bot`); its
 * corners show `under` (a color, or what the screen has there, read per cell).
 */
export function box(S: Lcd, x0: number, y0: number, x1: number, y1: number, col: C3, under: C3 | ((x: number, y: number) => C3), r = 1, bot?: C3) {
  for (let y = y0; y <= y1; y++) {
    const c = bot ? lerp(col, bot, y1 > y0 ? (y - y0) / (y1 - y0) : 0) : col;
    for (let x = x0; x <= x1; x++) {
      const v = inBox(x, y, x0, y0, x1, y1, r);
      if (v === 1) S.put(x, y, 32, c, c);
      else if (v) S.put(x, y, v, c, typeof under === 'function' ? under(x, y) : under);
    }
  }
}

/** A person's picture: two cells in a color of their own (from the name), their initials in it. */
export function face(S: Lcd, x: number, y: number, name: string) {
  let h = 0;
  for (let k = 0; k < name.length; k++) h = (h * 31 + name.charCodeAt(k)) | 0;
  const hue = hash3(h, 1, 2) * 6, i = Math.floor(hue), f = hue - i;
  const rgb = [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i % 6];
  const c: C3 = [60 + rgb[0] * 130, 60 + rgb[1] * 130, 60 + rgb[2] * 130];
  const parts = name.replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/);
  const ini = /^[0-9]/.test(name) ? '#' : ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
  S.put(x, y, ch(ini[0] ?? ' '), [255, 255, 255], c);
  S.put(x + 1, y, ch(ini[1] ?? ' '), [255, 255, 255], c);
}

/** The system's bars: glossy, the top a shade lighter than the rest. */
/** The picked row on a light page: a dark accent with light text (unpicked rows stay light with dark text). */
export const PICK: C3 = [30, 66, 140], PICK_INK: C3 = [255, 255, 255], PICK_DIM: C3 = [176, 196, 232];

export const CHROME = { top: [44, 62, 92] as C3, bot: [22, 30, 48] as C3, text: [235, 242, 255] as C3, dim: [140, 160, 190] as C3, accent: [255, 196, 90] as C3 };

/** A title bar on row 1: the title, an icon before it, something on the right. */
export function header(S: Lcd, title: string, right = '', icon = '', iconCol: C3 = CHROME.accent) {
  S.fill(1, CHROME.top);
  let x = 1;
  if (icon) { S.text(1, 1, icon, iconCol, CHROME.top); x = 2 + icon.length; }
  S.text(x, 1, title.slice(0, SW - x - right.length - 2), CHROME.text, CHROME.top);
  if (right) S.text(SW - right.length - 1, 1, right, CHROME.dim, CHROME.top);
  for (let xx = 0; xx < SW; xx++) S.put(xx, 2, SHAPE.top, mul(CHROME.top, 0.6), [0, 0, 0]);
}

/** The signal bars, 4 of rising height (partial blocks), at x on row 0. */
export function bars(S: Lcd, x: number, n: number, on: C3, off: C3, bg: C3) {
  const G = [SHAPE.q1, SHAPE.bottom, SHAPE.q3, 128];
  for (let b = 0; b < 4; b++) S.put(x + b, 0, G[b], b < n ? on : off, bg);
}

export { SH };
