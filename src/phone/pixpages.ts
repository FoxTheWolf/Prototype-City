import { hash3 } from '../core/rng';
import { moonPhase, sunDir } from '../sim/clock';
import { Paint, type C3 } from '../render/paint2d';
import { FOOT_H, ICE, ptext, ptextW, SCR_H, SCR_W, STATUS_H } from './pixui';
import { type Key } from './phone';

/**
 * The phone's screens drawn in pixels by the manual v2's grid (section 6: the 18 px bar on top, the 26 px
 * footer, a 12 px margin, the night-blue theme with an ice-blue accent and a colour an app): they paint the
 * whole content area of the screen's pixel picture (pixui.ts PHONE_PX), over the cells, which they replace.
 * Each records where a touch lands (HITS): a rectangle, and the key it presses (after `pre`, which picks
 * the item touched; no key: the touch only picks it).
 */
export interface Hit { x: number; y: number; w: number; h: number; key?: Key; pre?: () => void }
export const HITS: Hit[] = [];

/** The theme (the manual's section 6). */
export const BG: C3 = [11, 18, 25], INK: C3 = [232, 244, 255], DIM: C3 = [127, 151, 170], SOFT: C3 = [169, 188, 203];
/** Each app's colour, in the menu's order (phone.ts APPS; the manual's section 6): on its icon and on the edge of its cards. */
export const APP_COL: C3[] = [[47, 174, 90], [63, 143, 224], [154, 159, 168], [95, 191, 111], [176, 95, 208], [168, 104, 58], [63, 95, 176], [216, 199, 160],
  [95, 176, 224], [208, 72, 58], [63, 160, 112], [122, 128, 144], [224, 192, 80], [224, 154, 58], [176, 95, 160], [138, 147, 160]];
/** The content area: under the bar, over the footer. */
export const Y0 = STATUS_H, Y1 = SCR_H - FOOT_H, M = 12;

const lerp = (a: C3, b: C3, t: number): C3 => { const k = Math.max(0, Math.min(1, t)); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };
const mul = (c: C3, k: number): C3 => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
/** Text centred on the screen at y. */
export const ctext = (P: Paint, y: number, s: string, c: C3, k = 1, bold = false) => ptext(P, Math.round((SCR_W - ptextW(s, k, bold)) / 2), y, s, c, k, bold);
/** Text typed in: the first part of it, t seconds after it began (as the cells' `typed`). */
const typed = (s: string, t: number) => (t <= 0 ? '' : s.slice(0, Math.ceil(t * 60)));

/**
 * The wallpaper over the whole screen (the bar lies over its top): 0 the skyline under the sky of the hour
 * (the moon of the right phase, or the sun; lit windows by night), 1 rain running down the glass over
 * hills, 2 a dusk over hills, 3 plain dark (as the cells' wallpaper in ui.ts, now in pixels).
 */
function wallpaper(P: Paint, kind: number, time: number, now: number) {
  const hills = (c: C3) => { for (let x = 0; x < SCR_W; x++) { const h = 14 + Math.round((Math.sin(x * 0.05) + Math.sin(x * 0.019) * 1.5) * 8); P.rect(x, Y1 - h, 1, h, c); } };
  if (kind === 3) { P.grad(0, 0, SCR_W, Y1, [[0, [18, 24, 36]], [1, [10, 12, 18]]]); return; }
  if (kind === 2) { P.grad(0, 0, SCR_W, Y1, [[0, [40, 30, 90]], [1, [230, 120, 70]]]); hills([30, 18, 40]); return; }
  if (kind === 1) {
    P.grad(0, 0, SCR_W, Y1, [[0, [20, 34, 48]], [1, [40, 56, 70]]]);
    // drops on the glass, running down, a tail behind each
    for (let k = 0; k < 60; k++) {
      const x = Math.floor(hash3(k, 3, 9) * SCR_W), sp = 14 + hash3(k, 4, 9) * 40, y = Math.floor((now * sp + hash3(k, 5, 9) * 500) % (Y1 + 20)) - 10;
      P.rect(x, y - 9, 1, 9, [120, 150, 170], 0.5); P.rect(x, y, 2, 2, [190, 220, 240]);
    }
    hills([12, 20, 28]);
    return;
  }
  const sun = sunDir(time, SUN)[0], day = Math.max(0, Math.min(1, (sun + 0.1) / 0.25)), dusk = Math.max(0, 1 - Math.abs(sun - 0.02) / 0.14);
  const top = lerp(lerp([8, 12, 34], [70, 130, 205], day), [70, 60, 120], dusk * 0.5);
  const bot = lerp(lerp([60, 40, 90], [175, 205, 232], day), [240, 140, 80], dusk * 0.8);
  P.grad(0, 0, SCR_W, Y1, [[0, top], [1, bot]]);
  // the sun or the moon in the top right corner, clear of the clock
  const mx = SCR_W - 20, my = Y0 + 12;
  if (day > 0.5) { P.glow(mx, my, 26, [255, 230, 170], 0.35); P.disc(mx, my, 10, lerp([255, 210, 120], [255, 250, 220], day)); }
  else {
    const ph = moonPhase(time), term = Math.cos(ph * Math.PI * 2);
    for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) {
      if (x * x + y * y > 100) continue;
      // lit past the terminator: from the right while it waxes, from the left while it wanes
      const xn = x / Math.sqrt(Math.max(1, 100 - y * y)), lit = ph < 0.5 ? xn > term : xn < -term;
      P.dot(mx + x, my + y, lit ? [235, 230, 200] : [40, 40, 70]);
    }
    for (let k = 0; k < 50; k++) { const x = Math.floor(hash3(k, 7, 1) * SCR_W), y = Y0 + Math.floor(hash3(k, 7, 2) * (Y1 - Y0) * 0.5); if (Math.abs(x - mx) > 14 || Math.abs(y - my) > 14) P.dot(x, y, [200, 200, 230], (1 - day * 2) * (0.4 + 0.6 * hash3(k, 7, 3))); }
  }
  // the skyline: blocks of varied width and height, their windows lit by night (a few change every 7 s)
  let x = 0;
  while (x < SCR_W) {
    const w = 14 + Math.floor(hash3(x, 11, 3) * 22), h = 50 + Math.floor(hash3(x, 11, 4) * 130), c = lerp([7 + hash3(x, 11, 5) * 8, 16, 27], [70 + hash3(x, 11, 5) * 30, 84, 104], day);
    P.rect(x, Y1 - h, w, h, c);
    for (let yy = Y1 - h + 6; yy < Y1 - 4; yy += 9) for (let xx = x + 3; xx < x + w - 3; xx += 6) {
      if (day < 0.5) { if (hash3(xx, yy, Math.floor(now / 7)) < 0.3) P.rect(xx, yy, 2, 3, [232, 176, 74]); }
      else P.rect(xx, yy, 2, 3, lerp(c, [200, 220, 240], 0.35));
    }
    x += w + 2;
  }
}
const SUN = new Float64Array(2);

/** A card on the standby screen: the app's colour on its left edge, the text; lit when picked. */
export interface Card { col: C3; text: string; sel: boolean; blink: boolean; pre: () => void }
/** The music's panel on the standby screen. */
export interface Tune { title: string; band: string; at: number; len: number; playing: boolean; vol: number; shuffle: string; spec: Float32Array; sel: boolean; pre: () => void }
export interface Standby { wall: number; time: number; t: number; hour: string; date: string; op: string; opOk: boolean; cards: Card[]; tune: Tune | null; hint: string; volLabel: string }

/** The visualizer's falling peaks. */
const peaks = new Float32Array(64);
let peaksAt = 0;

/** The standby screen (the manual's): the wallpaper, the hour big, the date and the network, the cards for what waits, the music's panel. */
export function paintStandby(P: Paint, d: Standby, now: number) {
  wallpaper(P, d.wall, d.time, now);
  // the hour: big, with a shadow under it; then the date and the network typed in
  const hw = Paint.textW(d.hour, 7, 5), hx = Math.round((SCR_W - hw) / 2);
  P.text(hx + 2, 44, d.hour, 7, [0, 0, 0], 0.45, 5);
  P.text(hx, 42, d.hour, 7, [255, 255, 255], 1, 5);
  if (d.t > 0.2) ctext(P, 101, typed(d.date, d.t - 0.2), [207, 230, 247], 1, true);
  if (d.t > 0.5) ctext(P, 115, typed(d.op, d.t - 0.5), d.opOk ? [150, 200, 255] : [255, 120, 90]);
  let y = 136;
  d.cards.forEach((c, k) => {
    if (d.t < 0.6 + k * 0.1) return;
    P.rect(14, y, SCR_W - 28, 30, c.sel ? [36, 58, 86] : [10, 20, 30], c.sel ? 0.92 : 0.78);
    P.rect(14, y, 3, 30, c.col);
    if (c.sel) { P.rect(14, y, SCR_W - 28, 1, ICE, 0.7); P.rect(14, y + 29, SCR_W - 28, 1, ICE, 0.7); }
    ptext(P, 26, y + 11, c.text.slice(0, 32), c.blink && Math.floor(now * 2) & 1 ? c.col : INK, 1, true);
    HITS.push({ x: 14, y, w: SCR_W - 28, h: 30, key: 'ok', pre: c.pre });
    y += 36;
  });
  // the music: the song, the visualizer in its well, how far in, the volume
  const T = d.tune;
  if (T && d.t > 0.6) {
    const h = 96, PB: C3 = T.sel ? [62, 36, 92] : [30, 16, 44], ACC: C3 = [200, 130, 255], GR: C3 = [130, 110, 150], TX: C3 = [232, 218, 250];
    P.rect(14, y, SCR_W - 28, h, PB, 0.85); P.rect(14, y, 3, h, [176, 95, 208]);
    if (T.sel) { P.rect(14, y, SCR_W - 28, 1, ICE, 0.7); P.rect(14, y + h - 1, SCR_W - 28, 1, ICE, 0.7); }
    ptext(P, 26, y + 8, T.title.slice(0, 32), TX, 1, true);
    ptext(P, 26, y + 20, T.band.slice(0, 32), GR);
    // the visualizer: a bar a band in a dark well, green rising to yellow and red, the peaks falling
    const wx = 26, wy = y + 33, ww = SCR_W - 52, wh = 28, n = T.spec.length, bw = Math.floor(ww / n);
    P.rrect(wx - 2, wy - 2, ww + 4, wh + 4, 3, mul(PB, 0.45));
    const dt = Math.min(0.2, Math.max(0, now - peaksAt)); peaksAt = now;
    for (let k = 0; k < n; k++) {
      peaks[k] = Math.max(T.spec[k], peaks[k] - dt * 0.5);
      const bh = Math.round(Math.min(1, T.spec[k]) * wh), bx = wx + k * bw + Math.floor((ww - n * bw) / 2);
      for (let j = 0; j < bh; j++) { const f = j / wh; P.rect(bx, wy + wh - 1 - j, bw - 1, 1, f < 0.5 ? lerp([60, 220, 110], [240, 220, 70], f * 2) : lerp([240, 220, 70], [255, 80, 60], (f - 0.5) * 2)); }
      P.rect(bx, wy + wh - 1 - Math.round(Math.min(1, peaks[k]) * (wh - 1)), bw - 1, 1, [240, 240, 255], 0.8);
    }
    // how far in: a thin track, the played part thicker, a knob; playing or paused; the time
    const mm = (v: number) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`, time = `${mm(T.at)}/${mm(T.len)}`;
    const ty = y + 70, tx0 = 38, tx1 = SCR_W - 26 - ptextW(time) - 8, f = T.len > 0 ? Math.min(1, T.at / T.len) : 0, at = Math.round(tx0 + f * (tx1 - tx0));
    if (T.playing) P.poly([26, ty, 26, ty + 8, 32, ty + 4], ACC); else { P.rect(26, ty, 2, 8, ACC); P.rect(30, ty, 2, 8, ACC); }
    P.rect(tx0, ty + 4, tx1 - tx0, 1, GR); P.rect(tx0, ty + 3, at - tx0, 3, ACC); P.rect(at - 1, ty + 1, 3, 7, [245, 235, 255]);
    ptext(P, SCR_W - 26 - ptextW(time), ty, time, TX);
    // the volume: ten bars rising
    const vy = y + 82;
    ptext(P, 26, vy, d.volLabel, GR);
    const v = Math.round(T.vol * 10), vx = 26 + ptextW(d.volLabel) + 6;
    for (let k = 0; k < 10; k++) { const bh = 2 + Math.round(k * 0.7); P.rect(vx + k * 4, vy + 8 - bh, 3, bh, k < v ? ACC : mul(GR, 0.6)); }
    if (T.shuffle) ptext(P, SCR_W - 26 - ptextW(T.shuffle), vy, T.shuffle, ACC);
    HITS.push({ x: 14, y, w: SCR_W - 28, h, key: 'ok', pre: T.pre });
  }
  if (d.hint && d.t > 0.9) ctext(P, Y1 - 14, d.hint, SOFT);
}

/** An app on the menu: its name, colour and picture (null: its letter instead). */
export interface Tile { label: string; col: C3; art: (C3 | null)[][] | null; sel: boolean; pre: () => void }
/** The manual's grid: 4 x 4, cells of 54 x 94 from (12, 24). */
export const cellOf = (i: number) => ({ x: 12 + (i % 4) * 54, y: 24 + Math.floor(i / 4) * 94, w: 54, h: 90 });

/** An app's icon at (x, y): a 42 px rounded square in its colour, a gloss over its top, the picture on it (2 x 4 px a dot of the HD art). */
export function paintIcon(P: Paint, x: number, y: number, T: Pick<Tile, 'label' | 'col' | 'art'>) {
  P.grad(x, y, 42, 42, [[0, mul(T.col, 1.18)], [1, mul(T.col, 0.78)]], true, 9);
  P.rrect(x + 2, y + 2, 38, 16, 7, [255, 255, 255], 0.25);
  if (T.art) T.art.forEach((row, j) => row.forEach((c, i) => { if (c) P.rect(x + 3 + i * 2, y + 3 + j * 4, 2, 4, c); }));
  else { const s = T.label[0] ?? '?'; ptext(P, x + 21 - ptextW(s, 2, true) / 2, y + 13, s, [255, 255, 255], 2, true); }
}

/** The menu (the manual's): the apps' grid on the night blue, the picked one in an ice frame. */
export function paintMenu(P: Paint, tiles: Tile[], t: number) {
  P.rect(0, 0, SCR_W, Y1, BG);
  tiles.forEach((T, n) => {
    const { x, y, w, h } = cellOf(n);
    HITS.push({ x, y, w, h, key: 'ok', pre: T.pre });
    if (t < 0.06 + n * 0.025) return;
    if (T.sel) { P.rrect(x + 1, y + 2, w - 2, 82, 6, ICE, 0.16); ring(P, x + 1, y + 2, w - 2, 82, ICE); }
    paintIcon(P, x + 6, y + 10, T);
    const l = T.label.length > 9 ? T.label.slice(0, 8) + '.' : T.label;
    ptext(P, Math.round(x + (w - ptextW(l)) / 2), y + 62, l, T.sel ? [255, 255, 255] : SOFT);
  });
}

/** A one-pixel frame round a rectangle, its corners cut. */
function ring(P: Paint, x: number, y: number, w: number, h: number, c: C3) {
  P.rect(x + 2, y, w - 4, 1, c); P.rect(x + 2, y + h - 1, w - 4, 1, c); P.rect(x, y + 2, 1, h - 4, c); P.rect(x + w - 1, y + 2, 1, h - 4, c);
  P.dot(x + 1, y + 1, c); P.dot(x + w - 2, y + 1, c); P.dot(x + 1, y + h - 2, c); P.dot(x + w - 2, y + h - 2, c);
}

/** The volume, a moment after a side key or the wheel moved it, over what is open: a dark pill near the foot. */
export function paintVolume(P: Paint, vol: number, label: string) {
  const w = 150, x = (SCR_W - w) >> 1, y = Y1 - 40;
  P.rrect(x, y, w, 22, 6, [10, 14, 24], 0.92);
  ptext(P, x + 10, y + 7, label, SOFT);
  const v = Math.round(vol * 10), vx = x + 16 + ptextW(label);
  for (let k = 0; k < 10; k++) { const bh = 3 + k; P.rect(vx + k * 7, y + 16 - bh, 5, bh, k < v ? [200, 130, 255] : [70, 76, 90]); }
}

/** A call in the dialer's log: who, how it went, when; picked or not. */
export interface LogRow { who: string; kind: 'out' | 'in' | 'missed' | 'failed'; when: string; sel: boolean; pre: () => void; call: boolean }
export interface Dial { t: number; dial: string; who: string; missed: string; hint: string; tabs: [string, string]; toContacts: () => void; recent: string; log: LogRow[] }

/** The app's header: its tabs (the one open white over an ice line, the other touched to go to it), and a note on the right. */
function tabsBar(P: Paint, tabs: [string, string], on: number, note: string, noteCol: C3, go: (() => void) | null) {
  P.rect(0, Y0, SCR_W, 32, [15, 25, 34]);
  let x = M;
  tabs.forEach((l, k) => {
    const w = ptextW(l, 1, true);
    ptext(P, x, Y0 + 11, l, k === on ? INK : DIM, 1, true);
    if (k === on) P.rect(x, Y0 + 23, w, 2, ICE);
    else if (go) HITS.push({ x: x - 8, y: Y0, w: w + 16, h: 32, pre: go });
    x += w + 18;
  });
  if (note) ptext(P, SCR_W - M - ptextW(note), Y0 + 11, note, noteCol);
  P.rect(0, Y0 + 31, SCR_W, 1, [30, 46, 60]);
}

/** The dialer (the manual's): the number big on the right with the cursor blinking, whose it is, and the calls of late. */
export function paintDial(P: Paint, d: Dial, now: number) {
  P.rect(0, 0, SCR_W, Y1, BG);
  tabsBar(P, d.tabs, 0, d.missed, [255, 120, 90], d.dial ? null : d.toContacts);
  // the number: as big as fits, right-aligned, the ice cursor after it
  const n = d.dial, s = n.length <= 8 ? 4 : n.length <= 11 ? 3 : 2, w = Paint.textW(n, s), x = SCR_W - M - 6 - w, ny = 96 - s * 7;
  if (n) P.text(x, ny, n, s, [255, 255, 255]);
  if (Math.floor(now * 2) % 2 === 0) P.rect(SCR_W - M - 3, ny - 2, 2, s * 7 + 4, ICE);
  if (n && d.who) ptext(P, SCR_W - M - ptextW(d.who, 1, true), 112, d.who, ICE, 1, true);
  if (!n) ptext(P, M, 112, typed(d.hint, d.t - 0.2), DIM);
  // the log: each call with how it went (out green, in blue, missed or unanswered red) and when; touched it is
  // picked, touched again it is called back
  if (!d.log.length) return;
  ptext(P, M, 140, d.recent, DIM, 1, true);
  d.log.forEach((r, k) => {
    const y = 154 + k * 34;
    if (d.t < 0.15 + k * 0.05) return;
    if (r.sel) { P.rrect(6, y, SCR_W - 12, 30, 5, ICE, 0.16); ring(P, 6, y, SCR_W - 12, 30, ICE); }
    else P.rect(M, y + 30, SCR_W - 2 * M, 1, [24, 36, 48]);
    const bad = r.kind === 'missed' || r.kind === 'failed', col: C3 = bad ? [235, 90, 80] : r.kind === 'in' ? [100, 160, 240] : [70, 190, 110];
    // an arrow: out of the phone up and right, into it down and left
    const ax = M + 4, ay = y + 11;
    if (r.kind === 'in' || r.kind === 'missed') { P.line(ax + 8, ay, ax + 1, ay + 7, 1.5, col); P.rect(ax, ay + 3, 2, 5, col); P.rect(ax, ay + 7, 5, 2, col); }
    else { P.line(ax, ay + 8, ax + 7, ay + 1, 1.5, col); P.rect(ax + 4, ay, 5, 2, col); P.rect(ax + 7, ay, 2, 5, col); }
    const ww = ptextW(r.when);
    ptext(P, M + 20, y + 11, r.who.slice(0, Math.floor((SCR_W - 2 * M - 30 - ww) / 6)), bad ? [255, 170, 160] : INK, 1, true);
    ptext(P, SCR_W - M - ww, y + 11, r.when, r.sel ? SOFT : DIM);
    HITS.push({ x: 6, y, w: SCR_W - 12, h: 30, pre: r.pre, key: r.call ? 'ok' : undefined });
  });
}
