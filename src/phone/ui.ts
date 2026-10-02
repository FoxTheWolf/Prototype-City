import { hash3 } from '../core/rng';
import { SHAPE } from '../render/atlas';
import { calendar, moonPhase, sunDir } from '../sim/clock';
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

/**
 * The wallpapers of the standby screen: a skyline at night under the moon, a rainy window, a dusk
 * sky, or a plain color. Drawn on rows y0..y1. The skyline's windows come and go.
 */
export function wallpaper(S: Lcd, kind: number, y0: number, y1: number, time: number, now: number) {
  if (kind === 3) { vgrad(S, y0, y1, [18, 24, 36], [10, 12, 18]); return; }
  if (kind === 2) { vgrad(S, y0, y1, [40, 30, 90], [230, 120, 70]); hills(S, y1, [30, 18, 40]); return; }
  if (kind === 1) {
    vgrad(S, y0, y1, [20, 34, 48], [40, 56, 70]);
    // drops on the glass, running down
    for (let k = 0; k < 40; k++) {
      const x = Math.floor(hash3(k, 3, 9) * SW), sp = 2 + hash3(k, 4, 9) * 5, y = y0 + Math.floor(((now * sp + hash3(k, 5, 9) * 40) % (y1 - y0 + 6))) - 3;
      for (let d = 0; d < 3; d++) if (y - d >= y0 && y - d <= y1) S.put(x, y - d, ch(d ? ':' : 'o'), lerp([90, 120, 140], [190, 220, 240], 1 - d / 3), lerp([20, 34, 48], [40, 56, 70], (y - d - y0) / (y1 - y0)));
    }
    hills(S, y1, [12, 20, 28]);
    return;
  }
  // the skyline under the sky of the hour (by the sun's height): a night sky with the moon of the right
  // phase and lit windows, a dusk glow, or a day sky with the sun; the moon and the sun sit in the top
  // right corner, clear of the clock
  const sun = sunDir(time, SUN)[0], day = Math.max(0, Math.min(1, (sun + 0.1) / 0.25)), dusk = Math.max(0, 1 - Math.abs(sun - 0.02) / 0.14);
  const top = lerp(lerp([8, 12, 34], [70, 130, 205], day), [70, 60, 120], dusk * 0.5);
  const bot = lerp(lerp([60, 40, 90], [175, 205, 232], day), [240, 140, 80], dusk * 0.8);
  const skyAt = (y: number) => lerp(top, bot, (y - y0) / (y1 - y0));
  vgrad(S, y0, y1, top, bot);
  const mx = SW - 4, my = y0 + 1;
  if (day > 0.5) {
    for (let y = -1; y <= 1; y++) for (let x = -2; x <= 2; x++) if (x * x / 6 + y * y <= 1.2) S.put(mx + x, my + y, 32, [0, 0, 0], lerp([255, 210, 120], [255, 250, 220], day));
  } else {
    const ph = moonPhase(time), term = Math.cos(ph * Math.PI * 2);
    for (let y = -1; y <= 1; y++) for (let x = -2; x <= 2; x++) {
      // lit past the terminator: from the right while it waxes, from the left while it wanes
      const xn = x / 2.2, lit = ph < 0.5 ? xn > term : xn < -term;
      if (x * x / 6 + y * y <= 1.2) S.put(mx + x, my + y, 32, [0, 0, 0], lit ? [235, 230, 200] : lerp([40, 40, 70], skyAt(my + y), day * 2));
    }
    for (let k = 0; k < 24; k++) { const x = Math.floor(hash3(k, 7, 1) * SW), y = y0 + Math.floor(hash3(k, 7, 2) * (y1 - y0) * 0.5); if (x < mx - 3) S.put(x, y, ch('.'), lerp([200, 200, 230], skyAt(y), day * 2), skyAt(y)); }
  }
  const hour = calendar(time).hour;
  let x = 0;
  while (x < SW) {
    const w = 3 + Math.floor(hash3(x, 11, 3) * 5), h = 3 + Math.floor(hash3(x, 11, 4) * (y1 - y0) * 0.6), c: C3 = lerp([14 + hash3(x, 11, 5) * 12, 14, 26], [70 + hash3(x, 11, 5) * 30, 84, 104], day);
    for (let y = y1 - h + 1; y <= y1; y++) for (let dx = 0; dx < w && x + dx < SW; dx++) {
      const pane = (dx % 2 === 1) && ((y1 - y) % 2 === 1);
      // by night some windows are lit; by day they are glass, a shade off the wall
      const win = pane && day < 0.5 && hash3(x + dx, y, Math.floor(now / 7) + (hour < 6 ? 1 : 0)) < 0.35;
      S.put(x + dx, y, win || (pane && day >= 0.5) ? ch('.') : 32, win ? [255, 200, 110] : lerp(c, [200, 220, 240], 0.5), c);
    }
    x += w + (hash3(x, 11, 6) < 0.3 ? 1 : 0);
  }
}

const SUN = new Float64Array(2);

function hills(S: Lcd, y1: number, c: C3) {
  for (let x = 0; x < SW; x++) { const h = 1 + Math.round(1.5 + Math.sin(x * 0.3) + Math.sin(x * 0.11) * 1.5); for (let y = y1 - h + 1; y <= y1; y++) S.put(x, y, 32, c, c); }
}

/** The signal bars, 4 of rising height (partial blocks), at x on row 0. */
export function bars(S: Lcd, x: number, n: number, on: C3, off: C3, bg: C3) {
  const G = [SHAPE.q1, SHAPE.bottom, SHAPE.q3, 128];
  for (let b = 0; b < 4; b++) S.put(x + b, 0, G[b], b < n ? on : off, bg);
}

export { SH };
