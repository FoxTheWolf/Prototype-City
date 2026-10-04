import { type CharGrid } from '../render/grid';
import { calendar } from '../sim/clock';
import { type C3 } from '../phone/lcd';

/**
 * The digital watch on the player's left wrist (F.4, a HUD for good since F.6): a cheap 2008 resin
 * quartz watch in the bottom left of the view, in sight by default; H lowers it out of the way (and
 * raises it again). Lowered, it still comes up by itself on the hour, as it chimes, and when its
 * alarm goes off. Its LCD reads by the scene's light and fades in the dark; L lights it for a few
 * seconds. Three modes, as on the real ones, stepped by MODE (J): the time, the daily alarm and a
 * stopwatch; the right button (I) is START/STOP: it turns the alarm on and off (held, it sets the
 * alarm: I steps the blinking field, J moves to the next) and runs the stopwatch (held while stopped,
 * it clears it). The stopwatch counts real seconds, so it times what the player does.
 */
/** The watch is in the game (F.4); off, its keys do nothing and it is never drawn. */
export const WATCH_ON = true;

export type WatchMode = 'time' | 'alarm' | 'chrono';
const MODES: WatchMode[] = ['time', 'alarm', 'chrono'];

export class Watch {
  /** In sight (the player's choice; H). */
  up = true;
  /** 0 down at the side, 1 held up in sight (eased). */
  raise = 0;
  mode: WatchMode = 'time';
  /** The daily alarm: the minute of the day it rings, on or off. */
  alarm = { min: 7 * 60, on: false };
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
    if (this.mode === 'alarm') { this.alarm.on = !this.alarm.on; this.sfx.push('beep'); }
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
    if (this.hour >= 0 && h !== this.hour) { this.sfx.push('chime'); if (!this.up) this.popUntil = now + POP_S; }
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
/** Size of the watch on the interface's grid (the case; the strap runs past it, off the bottom). */
const W = 32, CASE_Y = 3, CASE_H = 15;
/** The LCD window, inside the case. */
const LX = 3, LY = 6, LW = 26, LH = 9;

/** Seven segments per digit (a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle). */
const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const RESIN: C3 = [30, 30, 33], RIM: C3 = [52, 52, 56], STRAP: C3 = [24, 24, 26], LABEL: C3 = [150, 150, 150], BRAND: C3 = [230, 226, 214], GOLD: C3 = [170, 140, 70];
const LCD_BG: C3 = [150, 160, 136], INK: C3 = [24, 28, 24], BACKLIT: C3 = [90, 210, 190];

/**
 * The watch on the interface grid g. `light` is the scene's light at the hands (VIEW_LIGHT), `brand`
 * the maker printed on the bezel.
 */
export function drawWatch(g: CharGrid, Wt: Watch, time: number, now: number, light: Float32Array, brand: string) {
  if (Wt.raise < 0.01) return;
  const e = 1 - (1 - Wt.raise) ** 3;
  const ox = 6, oy = g.rows - Math.round((CASE_Y + CASE_H + 3) * e);
  const L = [Math.max(0.05, light[0]), Math.max(0.05, light[1]), Math.max(0.05, light[2])];
  const at = (x: number, y: number) => { const gx = ox + x, gy = oy + y; return gx >= 0 && gy >= 0 && gx < g.cols && gy < g.rows ? gy * g.cols + gx : -1; };
  // a cell of the watch in the scene's light; `own` is light of its own (the backlight) the scene does not dim
  const cell = (x: number, y: number, c: string, fg: C3, bg: C3, own = 0) => {
    const i = at(x, y);
    if (i < 0) return;
    const k = (n: number) => Math.max(own, L[n]);
    g.setBg(i, bg[0] * k(0), bg[1] * k(1), bg[2] * k(2));
    g.put(i, c.charCodeAt(0), fg[0] * k(0), fg[1] * k(1), fg[2] * k(2));
  };
  const text = (x: number, y: number, s: string, fg: C3, bg: C3) => { for (let k = 0; k < s.length; k++) cell(x + k, y, s[k], fg, bg); };

  // the strap: above the case, and below it off the bottom of the view, with its holes
  for (let y = 0; y < g.rows - oy; y++) {
    if (y >= CASE_Y && y < CASE_Y + CASE_H) continue;
    for (let x = 8; x < W - 8; x++) {
      const hole = y > CASE_Y + CASE_H + 2 && (y - CASE_Y - CASE_H) % 3 === 0 && x === W >> 1;
      cell(x, y, hole ? 'o' : (x + y) % 4 === 0 ? ':' : ' ', hole ? [8, 8, 8] : [40, 40, 44], STRAP);
    }
  }
  // the case, its corners rounded off (the world shows there), the buttons on its sides
  for (let y = 0; y < CASE_H; y++) for (let x = 0; x < W; x++) {
    const corner = (y === 0 || y === CASE_H - 1) && (x === 0 || x === W - 1);
    if (corner) continue;
    const edge = y === 0 || y === CASE_H - 1 || x === 0 || x === W - 1;
    cell(x, CASE_Y + y, ' ', RIM, edge ? RIM : RESIN);
  }
  cell(-1, LY + 1, '[', LABEL, RIM); cell(-1, LY + LH - 2, '[', LABEL, RIM); cell(W, LY + 1, ']', LABEL, RIM);
  text(2, CASE_Y + 1, 'LIGHT', LABEL, RESIN);
  // the buttons' names along the case: MODE by the lower left one, START/STOP by the right one
  text(1, CASE_Y + CASE_H - 2, 'MODE', LABEL, RESIN);
  text(W - 6, CASE_Y + CASE_H - 2, 'START', LABEL, RESIN);
  const b = brand.toUpperCase().slice(0, 14);
  text(W - 2 - b.length, CASE_Y + 1, b, BRAND, RESIN);
  for (let x = 2; x < W - 2; x++) cell(x, CASE_Y + 2, '-', GOLD, RESIN);
  text((W - 12) >> 1, CASE_Y + CASE_H - 2, 'WR ALARM CHR', LABEL, RESIN);

  // the LCD: lit from its left edge while the light is on, else only by what is around
  const lit = Wt.lit(now);
  const lcd = (x: number): [C3, number] => {
    if (!lit) return [LCD_BG, 0];
    const k = 1 - (x / LW) * 0.35;
    return [[BACKLIT[0] * k, BACKLIT[1] * k, BACKLIT[2] * k], 1];
  };
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) { const [c, own] = lcd(x); cell(LX + x, LY + y, ' ', INK, c, own); }
  // a segment cell: dark where on, and very faintly so where off (the ghost of a cheap LCD)
  const seg = (x: number, y: number, on: boolean) => {
    const [c, own] = lcd(x - LX);
    cell(x, y, ' ', INK, on ? INK : [c[0] * 0.94, c[1] * 0.94, c[2] * 0.94], own);
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
  const C = calendar(time), dx = LX + 1, dy = LY + 3;
  const ink = (x: number, y: number, s: string) => { for (let k = 0; k < s.length; k++) { const [c, own] = lcd(x + k - LX); cell(x + k, y, s[k], INK, c, own); } };
  // hh:mm in big digits, either pair blank (the field blinking while it is set); `zero`: a leading zero on the hour
  const big = (h: number, m: number, hideH = false, hideM = false, zero = false) => {
    digit(dx, dy, hideH || (h < 10 && !zero) ? -1 : Math.floor(h / 10)); digit(dx + 5, dy, hideH ? -1 : h % 10);
    seg(dx + 10, dy + 1, true); seg(dx + 10, dy + 3, true);
    digit(dx + 12, dy, hideM ? -1 : Math.floor(m / 10)); digit(dx + 17, dy, hideM ? -1 : m % 10);
  };
  // the alarm's mark, top middle, while it is on
  if (Wt.alarm.on) ink(LX + 11, LY + 1, '((*))');
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
    ink(dx + 21, dy + 4, Wt.alarm.on ? 'ON' : '--');
  } else {
    const sw = Wt.swAcc + (Wt.swAt >= 0 ? now - Wt.swAt : 0);
    ink(LX + 1, LY + 1, 'ST');
    // past an hour, the hours go up beside the label
    if (sw >= 3600) ink(LX + LW - 4, LY + 1, `${Math.floor(sw / 3600) % 100}H`.padStart(3, ' '));
    big(Math.floor(sw / 60) % 60, Math.floor(sw) % 60, false, false, true);
    ink(dx + 22, dy + 4, String(Math.floor((sw % 1) * 100)).padStart(2, '0'));
  }
}
