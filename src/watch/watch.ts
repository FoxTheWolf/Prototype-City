import { type CharGrid } from '../render/grid';
import { calendar } from '../sim/clock';
import { type C3 } from '../phone/lcd';

/**
 * The digital watch on the player's left wrist (F.4, a HUD for good since F.6): a cheap 2008 resin
 * quartz watch in the bottom left of the view, in sight by default; I lowers it out of the way (and
 * raises it again). Lowered, it still comes up by itself on the hour as it chimes (while the hourly
 * signal is on), and when its alarm goes off. Its LCD reads by the scene's light and fades in the dark;
 * L lights it (blue) for a few seconds. Three modes, as on the real ones, stepped by MODE (J): the time,
 * the daily alarm and a stopwatch; the right button (K) is START/STOP: in the alarm mode it steps the
 * alarm and the hourly signal on and off as a Casio does (alarm, signal, both, neither; held, it sets
 * the alarm: K steps the blinking field, J moves to the next) and runs the stopwatch (held while
 * stopped, it clears it). The stopwatch counts real seconds, so it times what the player does.
 */
/** The watch is in the game (F.4); off, its keys do nothing and it is never drawn. */
export const WATCH_ON = true;

export type WatchMode = 'time' | 'alarm' | 'chrono';
const MODES: WatchMode[] = ['time', 'alarm', 'chrono'];

export class Watch {
  /** In sight (the player's choice; I). */
  up = true;
  /** 0 down at the side, 1 held up in sight (eased). */
  raise = 0;
  mode: WatchMode = 'time';
  /** The daily alarm: the minute of the day it rings, on or off. */
  alarm = { min: 7 * 60, on: false };
  /** The hourly signal: a chime on the hour, and the watch coming up by itself. */
  chime = true;
  /** The stopwatch: running since `swAt` (real seconds, -1 stopped), with `swAcc` seconds before. */
  swAt = -1;
  swAcc = 0;
  /** Setting the alarm: 0 not, 1 the hour blinking, 2 the minutes. */
  setting = 0;
  /** When the light button was last pressed (real seconds). */
  lightAt = -99;
  /** Ringing until (real seconds), and the next burst of beeps. */
  ringUntil = 0;
  private ringNext = 0;
  /** Up by itself until then (the hourly chime). */
  private popUntil = 0;
  /** The right button: when it went down (-1: up), and whether its hold already did something. */
  private bDown = -1;
  private bHeld = false;
  /** The game hour and minute last seen (-1: not yet). */
  private hour = -1;
  private minute = -1;
  /** Sounds asked for this frame: 'up', 'down', 'light', 'chime', 'beep', 'alarm'. */
  sfx: string[] = [];

  /** What the save keeps (the stopwatch is real time, so it comes back stopped, with what it had counted). */
  snapshot() { return { up: this.up, mode: this.mode, alarm: { ...this.alarm }, sw: this.swAcc, chime: this.chime }; }
  restore(d: ReturnType<Watch['snapshot']>, now: number) {
    this.up = d.up; this.mode = d.mode; this.alarm = { ...d.alarm }; this.swAcc = d.sw; this.chime = d.chime ?? true; this.swAt = -1; this.setting = 0; this.ringUntil = 0;
    this.lightAt = now - 99;
  }

  /** In sight now: by choice, or come up by itself. */
  shown(now: number) { return this.up || now < this.popUntil || this.ringing(now); }
  ringing(now: number) { return now < this.ringUntil; }
  toggle() { this.up = !this.up; this.sfx.push(this.up ? 'up' : 'down'); }
  /** The buttons are only pressed with the watch in sight; any of them stops the alarm ringing. */
  private reach(now: number) {
    if (this.raise < 0.5) return false;
    if (this.ringing(now)) { this.ringUntil = 0; return false; }
    return true;
  }
  light(now: number) { if (this.raise > 0.5) { if (this.ringing(now)) this.ringUntil = 0; this.lightAt = now; this.sfx.push('light'); } }
  lit(now: number) { return now - this.lightAt < LIGHT_S; }
  /** MODE: the next mode, or (setting the alarm) the next field. */
  modeKey(now: number) {
    if (!this.reach(now)) return;
    this.sfx.push('beep');
    if (this.setting) { this.setting = this.setting === 1 ? 2 : 0; return; }
    this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
  }
  /** The right button pressed (repeat: the key held down, stepping a field being set). */
  startDown(now: number, repeat: boolean) {
    if (!repeat && !this.reach(now)) return;
    if (repeat && this.raise < 0.5) return;
    if (this.setting) { this.step(); if (!repeat) this.sfx.push('beep'); return; }
    if (repeat) return;
    this.bDown = now; this.bHeld = false;
    if (this.mode === 'chrono') {
      // start and stop at once, as the button goes down
      if (this.swAt >= 0) { this.swAcc += now - this.swAt; this.swAt = -1; } else this.swAt = now;
      this.bHeld = this.swAt >= 0;
      this.sfx.push('beep');
    }
  }
  startUp() {
    if (this.bDown < 0) return;
    const held = this.bHeld;
    this.bDown = -1;
    if (held || this.raise < 0.5) return;
    // alarm only, signal only, both, neither (and round)
    if (this.mode === 'alarm') {
      const n = ((this.alarm.on ? 1 : 0) + (this.chime ? 2 : 0) + 1) % 4;
      this.alarm.on = !!(n & 1); this.chime = !!(n & 2);
      this.sfx.push('beep');
    }
  }
  /** A step of the field being set: an hour, or a minute. */
  private step() { const A = this.alarm; A.min = this.setting === 1 ? (A.min + 60) % 1440 : A.min - (A.min % 60) + ((A.min % 60) + 1) % 60; }

  update(dt: number, time: number, now: number) {
    // held: in alarm mode it starts setting it; on a stopped stopwatch it clears it
    if (this.bDown >= 0 && !this.bHeld && now - this.bDown > HOLD_S) {
      this.bHeld = true;
      if (this.mode === 'alarm') { this.setting = 1; this.alarm.on = true; this.sfx.push('beep'); }
      else if (this.mode === 'chrono' && this.swAt < 0) { this.swAcc = 0; this.sfx.push('beep'); }
    }
    const h = Math.floor(time / 3600);
    if (this.hour >= 0 && h !== this.hour && this.chime) { this.sfx.push('chime'); if (!this.up) this.popUntil = now + POP_S; }
    this.hour = h;
    // the alarm: once a day at its minute (also when the clock jumps past it), 20 seconds of beeps
    const m = Math.floor(time / 60) % 1440, A = this.alarm;
    if (A.on && !this.setting && this.minute >= 0 && m !== this.minute && ((m - A.min + 1440) % 1440) < ((m - this.minute + 1440) % 1440)) { this.ringUntil = now + RING_S; this.ringNext = now; }
    this.minute = m;
    if (this.ringing(now) && now >= this.ringNext) { this.ringNext = now + 1; this.sfx.push('alarm'); }
    const want = this.shown(now) ? 1 : 0;
    this.raise += (want - this.raise) * Math.min(1, dt * 9);
    if (Math.abs(this.raise - want) < 0.002) this.raise = want;
  }
}

/** Holding the right button this long sets the alarm, or clears the stopwatch; up by itself on the hour for POP_S; the alarm rings RING_S. */
const HOLD_S = 1.2, POP_S = 3.5, RING_S = 20;
/** How long the light stays on. */
const LIGHT_S = 3;
/** Size of the watch on the interface's grid (the case; one row of strap above it, one below at the screen's edge). */
const W = 32, CASE_Y = 1, CASE_H = 15;
/** The LCD window, inside the case. */
const LX = 4, LY = CASE_Y + 3, LW = 24, LH = 9;

/** Seven segments per digit (a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle). */
const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const STEEL: C3 = [92, 94, 100], FACE: C3 = [26, 26, 29], STRAP: C3 = [24, 24, 26], LABEL: C3 = [150, 150, 150], BRAND: C3 = [230, 226, 214], GOLD: C3 = [170, 140, 70];
const LCD_BG: C3 = [150, 160, 136], INK: C3 = [24, 28, 24], BACKLIT: C3 = [70, 150, 245];
/** How much of the glint each surface gives back: the brushed steel, the face's print, the crystal over the LCD. */
const G_STEEL = 0.45, G_FACE = 0.12, G_GLASS = 0.5;
/** How far (cells) the backlight's blue spills over the case round the LCD, and how strong. */
const SPILL = 4, SPILL_K = 0.5;
/** An unlit LCD only reflects: it goes dark faster than the scene (its light to this power), so the light (L) is needed. */
const LCD_POW = 1.8;

/** The glint (VIEW_GLINT), eased so it does not jump from frame to frame (as the phone's). */
const GL = { lat: 0, str: 0, r: 1, g: 1, b: 1, back: 0, at: 0 };

/** Where this frame drew the lit LCD (interface cells: x, y, w, h), for the compositor's glow; null when unlit. */
export const WATCH_LCD: { at: number[] | null } = { at: null };

/**
 * The watch on the interface grid g, in the scene's light like the phone (F.7): a brushed steel case
 * lit on its top and left rim, the brightest light nearby sliding over it as a sheen, the LCD sunk
 * under its crystal (the face's shadow on it, away from the light). `light` is the scene's light at the
 * hands (VIEW_LIGHT), `glint` VIEW_GLINT, `brand` the maker printed on the face.
 */
export function drawWatch(g: CharGrid, Wt: Watch, time: number, now: number, light: Float32Array, glint: Float32Array, brand: string) {
  WATCH_LCD.at = null;
  if (Wt.raise < 0.01) return;
  const e = 1 - (1 - Wt.raise) ** 3;
  const ox = 6, oy = g.rows - Math.round((CASE_Y + CASE_H + 1) * e);
  const L = [Math.max(0.03, light[0]), Math.max(0.03, light[1]), Math.max(0.03, light[2])];
  const dt = Math.min(0.1, Math.max(0, now - GL.at)), q = 1 - Math.exp(-dt / 0.25);
  GL.at = now;
  GL.lat += (glint[0] - GL.lat) * q; GL.str += (glint[1] - GL.str) * q;
  GL.back += (glint[5] - GL.back) * q; GL.r += (glint[2] - GL.r) * q; GL.g += (glint[3] - GL.g) * q; GL.b += (glint[4] - GL.b) * q;
  // the sheen: a soft diagonal band on the side the light comes from
  const s0 = 16 + GL.lat * 14, amp = GL.str * 55;
  const sheen = (x: number, y: number) => Math.exp(-(((x + y * 0.55 - s0) / 4) ** 2)) * amp;
  const lit = Wt.lit(now);
  // the LCD's backlight spilling blue over the case round it
  const spill = (x: number, y: number) => {
    if (!lit) return 0;
    const dx = Math.max(LX - x, 0, x - (LX + LW - 1)), dy = Math.max(LY - y, 0, y - (LY + LH - 1));
    return Math.max(0, 1 - Math.hypot(dx * 0.6, dy) / SPILL) * SPILL_K;
  };
  const at = (x: number, y: number) => { const gx = ox + x, gy = oy + y; return gx >= 0 && gy >= 0 && gx < g.cols && gy < g.rows ? gy * g.cols + gx : -1; };
  // a cell of the watch in the scene's light, with the sheen by its gloss and the backlight's spill;
  // `own` is light of its own (the backlight) the scene does not dim; `Lk` the light it takes (the LCD's is darker)
  const cell = (x: number, y: number, c: string, fg: C3, bg: C3, gloss = G_FACE, own = 0, Lk = L) => {
    const i = at(x, y);
    if (i < 0) return;
    const sh = sheen(x, y) * gloss, sp = own ? 0 : spill(x, y), G = [GL.r, GL.g, GL.b];
    const v = (c3: C3, n: number) => c3[n] * Math.max(own, Lk[n]) + sh * G[n] + sp * BACKLIT[n];
    g.setBg(i, v(bg, 0), v(bg, 1), v(bg, 2));
    g.put(i, c.charCodeAt(0), v(fg, 0), v(fg, 1), v(fg, 2));
  };
  const shade = (x: number, y: number, f: number) => {
    const i = at(x, y);
    if (i < 0) return;
    const k = i * 4;
    for (let c = 0; c < 3; c++) { g.bg[k + c] *= 1 - f; g.cells[k + c + 1] *= 1 - f; }
  };
  const text = (x: number, y: number, s: string, fg: C3, bg: C3) => { for (let k = 0; k < s.length; k++) cell(x + k, y, s[k], fg, bg); };
  const mul = (c: C3, k: number): C3 => [c[0] * k, c[1] * k, c[2] * k];

  // the strap: a row above the case, and below it to the screen's edge
  for (let y = 0; y < g.rows - oy; y++) {
    if (y >= CASE_Y && y < CASE_Y + CASE_H) continue;
    for (let x = 8; x < W - 8; x++) cell(x, y, (x + y) % 4 === 0 ? ':' : ' ', [40, 40, 44], STRAP, 0.05);
  }
  // the case: brushed steel, two cells on the sides, a row top and bottom, its corners rounded off (the
  // world shows there); its rim lit on top and left, dark on the right and below; the dark face inside
  for (let y = 0; y < CASE_H; y++) for (let x = 0; x < W; x++) {
    if ((y === 0 || y === CASE_H - 1) && (x === 0 || x === W - 1)) continue;
    const steel = y === 0 || y === CASE_H - 1 || x < 2 || x > W - 3;
    if (!steel) { cell(x, CASE_Y + y, ' ', FACE, FACE); continue; }
    const top = y === 0 || x === 0, low = y === CASE_H - 1 || x === W - 1;
    let c = mul(STEEL, 1 + (((x * 7 + y * 13) % 5) - 2) * 0.03);
    if (top) c = [c[0] * 1.45 + 16, c[1] * 1.45 + 16, c[2] * 1.45 + 16]; else if (low) c = mul(c, 0.55);
    cell(x, CASE_Y + y, (x + y * 3) % 7 === 0 && !top && !low ? '-' : ' ', mul(c, 1.12), c, top ? 0.9 : G_STEEL);
  }
  // the buttons on its sides, in steel too
  for (const [x, y] of [[-1, LY + 1], [-1, LY + LH - 2], [W, LY + 1]] as const) cell(x, y, x < 0 ? '[' : ']', mul(STEEL, 1.3), mul(STEEL, 0.8), G_STEEL);
  text(3, CASE_Y + 1, 'LIGHT', LABEL, FACE);
  // the buttons' names along the case: MODE by the lower left one, START/STOP by the right one
  text(3, CASE_Y + CASE_H - 2, 'MODE', LABEL, FACE);
  text(W - 8, CASE_Y + CASE_H - 2, 'START', LABEL, FACE);
  const b = brand.toUpperCase().slice(0, 14);
  text(W - 3 - b.length, CASE_Y + 1, b, BRAND, FACE);
  for (let x = 3; x < W - 3; x++) cell(x, CASE_Y + 2, '-', GOLD, FACE);
  text((W - 12) >> 1, CASE_Y + CASE_H - 2, 'WATER RESIST', LABEL, FACE);

  // the LCD: lit from its left edge while the light is on (blue), else only reflecting what is around, darker
  const Ld = L.map((v) => Math.pow(Math.min(1, v), LCD_POW));
  const lcd = (x: number): [C3, number] => {
    if (!lit) return [LCD_BG, 0];
    const k = 1 - (x / LW) * 0.35;
    return [[BACKLIT[0] * k, BACKLIT[1] * k, BACKLIT[2] * k], 1];
  };
  const lc = (x: number, y: number, c: string, fg: C3, bg: C3, own: number) => cell(x, y, c, fg, bg, G_GLASS * (own ? 0.4 : 1), own, Ld);
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) { const [c, own] = lcd(x); lc(LX + x, LY + y, ' ', INK, c, own); }
  // a segment cell: dark where on, and very faintly so where off (the ghost of a cheap LCD)
  const seg = (x: number, y: number, on: boolean) => {
    const [c, own] = lcd(x - LX);
    lc(x, y, ' ', INK, on ? INK : [c[0] * 0.94, c[1] * 0.94, c[2] * 0.94], own);
  };
  // a digit, 4 columns by 5 rows
  const digit = (x: number, y: number, n: number) => {
    const s = SEG[n] ?? 0;
    for (let k = 0; k < 4; k++) { seg(x + k, y, !!(s & 1) && k > 0 && k < 3); seg(x + k, y + 2, !!(s & 64) && k > 0 && k < 3); seg(x + k, y + 4, !!(s & 8) && k > 0 && k < 3); }
    seg(x + 3, y + 1, !!(s & 2)); seg(x + 3, y + 3, !!(s & 4)); seg(x, y + 3, !!(s & 16)); seg(x, y + 1, !!(s & 32));
    // the corners belong to whichever side or bar is on
    seg(x, y, !!(s & 33)); seg(x + 3, y, !!(s & 3)); seg(x, y + 4, !!(s & 24)); seg(x + 3, y + 4, !!(s & 12));
    seg(x, y + 2, !!(s & 112)); seg(x + 3, y + 2, !!(s & 70));
  };
  const C = calendar(time), dx = LX, dy = LY + 3;
  const ink = (x: number, y: number, s: string) => { for (let k = 0; k < s.length; k++) { const [c, own] = lcd(x + k - LX); lc(x + k, y, s[k], INK, c, own); } };
  // hh:mm in big digits, either pair blank (the field blinking while it is set); `zero`: a leading zero on the hour
  const big = (h: number, m: number, hideH = false, hideM = false, zero = false) => {
    digit(dx, dy, hideH || (h < 10 && !zero) ? -1 : Math.floor(h / 10)); digit(dx + 5, dy, hideH ? -1 : h % 10);
    seg(dx + 10, dy + 1, true); seg(dx + 10, dy + 3, true);
    digit(dx + 12, dy, hideM ? -1 : Math.floor(m / 10)); digit(dx + 17, dy, hideM ? -1 : m % 10);
  };
  // the marks, top middle: the alarm's while it is on, the hourly signal's while it is on
  if (Wt.alarm.on) ink(LX + 8, LY + 1, '(*)');
  if (Wt.chime) ink(LX + 12, LY + 1, 'SIG');
  if (Wt.mode === 'time' || Wt.ringing(now)) {
    const hh = Math.floor(C.hour), mm = Math.floor((C.hour % 1) * 60), ss = Math.floor((((C.hour % 1) * 60) % 1) * 60);
    ink(LX + 1, LY + 1, DAYS[C.weekday]);
    const date = `${C.month}-${String(C.day).padStart(2, ' ')}`;
    ink(LX + LW - 1 - date.length, LY + 1, date);
    big(hh, mm);
    ink(dx + 22, dy + 4, String(ss).padStart(2, '0'));
  } else if (Wt.mode === 'alarm') {
    const blink = Math.floor(now * 2) & 1;
    ink(LX + 1, LY + 1, 'AL');
    if (Wt.setting) ink(LX + LW - 4, LY + 1, 'SET');
    big(Math.floor(Wt.alarm.min / 60), Wt.alarm.min % 60, Wt.setting === 1 && !blink, Wt.setting === 2 && !blink);
    ink(dx + 22, dy + 4, Wt.alarm.on ? 'ON' : '--');
  } else {
    const sw = Wt.swAcc + (Wt.swAt >= 0 ? now - Wt.swAt : 0);
    ink(LX + 1, LY + 1, 'ST');
    // past an hour, the hours go up beside the label
    if (sw >= 3600) ink(LX + LW - 4, LY + 1, `${Math.floor(sw / 3600) % 100}H`.padStart(3, ' '));
    big(Math.floor(sw / 60) % 60, Math.floor(sw) % 60, false, false, true);
    ink(dx + 22, dy + 4, String(Math.floor((sw % 1) * 100)).padStart(2, '0'));
  }
  // the LCD sits under the face: the face's edge shades its top row, and the side away from the light
  for (let x = 0; x < LW; x++) shade(LX + x, LY, 0.3);
  const vx = -GL.lat;
  if (Math.abs(vx) > 0.3) for (let y = 0; y < LH; y++) shade(vx < 0 ? LX : LX + LW - 1, LY + y, (0.15 + 0.35 * GL.str) * Math.abs(vx));
  if (lit) WATCH_LCD.at = [ox + LX, oy + LY, LW, LH];
}
