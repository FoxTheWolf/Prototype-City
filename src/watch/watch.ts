import { type CharGrid } from '../render/grid';
import { calendar, moonPhase, sunDir } from '../sim/clock';
import { Img, Paint, type C3 } from '../render/paint2d';
import { BTNS, NX, watchGpu, watchProject, WATCH_CASE, WATCH_GPU, WATCH_LCD_MM, type WatchGpu, type WBtn } from './body3d';
import { HandSway, type HandView } from '../render/sway';

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
 * The fourth button (DISPLAY, Ç; 15.21, docs/identidade/relogio-manual.html) steps the bottom row in
 * every mode: the compass and the thermometer, the day's sunrise and sunset, the moon's age, the pulse
 * (which follows the breath: up running, down resting).
 */
/** The watch is in the game (F.4); off, its keys do nothing and it is never drawn. */
export const WATCH_ON = true;

export type WatchMode = 'time' | 'alarm' | 'chrono';
const MODES: WatchMode[] = ['time', 'alarm', 'chrono'];
/** The bottom row's faces, stepped by DISPLAY. */
export type WatchFace = 'compass' | 'sun' | 'moon' | 'pulse';
const FACES: WatchFace[] = ['compass', 'sun', 'moon', 'pulse'];

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
  /** The bottom row's face (DISPLAY). */
  face: WatchFace = 'compass';
  /** The pulse (beats a minute), eased after the breath; the last beat (real seconds); the breath last seen. */
  pulse = 70;
  beatAt = 0;
  private breath = 1;
  /** The thermometer's reading (degrees C, NaN: not yet): it follows the air slowly, as a real one on a wrist does. */
  temp = NaN;
  /** When each button was last pressed (real seconds): it shows sunk for a moment. */
  readonly pressedAt: Partial<Record<WBtn, number>> = {};
  /** Sounds asked for this frame: 'up', 'down', 'light', 'chime', 'beep', 'alarm'. */
  sfx: string[] = [];

  /** What the save keeps (the stopwatch is real time, so it comes back stopped, with what it had counted). */
  snapshot() { return { up: this.up, mode: this.mode, alarm: { ...this.alarm }, sw: this.swAcc, chime: this.chime, face: this.face }; }
  restore(d: ReturnType<Watch['snapshot']>, now: number) {
    this.up = d.up; this.mode = d.mode; this.alarm = { ...d.alarm }; this.swAcc = d.sw; this.chime = d.chime ?? true; this.swAt = -1; this.setting = 0; this.ringUntil = 0;
    this.face = d.face ?? 'compass';
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
  light(now: number) { this.pressedAt.light = now; if (this.raise > 0.5) { if (this.ringing(now)) this.ringUntil = 0; this.lightAt = now; this.sfx.push('light'); } }
  lit(now: number) { return now - this.lightAt < LIGHT_S; }
  /** MODE: the next mode, or (setting the alarm) the next field. */
  modeKey(now: number) {
    this.pressedAt.mode = now;
    if (!this.reach(now)) return;
    this.sfx.push('beep');
    if (this.setting) { this.setting = this.setting === 1 ? 2 : 0; return; }
    this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
  }
  /** DISPLAY: the next face of the bottom row. */
  displayKey(now: number) {
    this.pressedAt.display = now;
    if (!this.reach(now)) return;
    this.sfx.push('beep');
    this.face = FACES[(FACES.indexOf(this.face) + 1) % FACES.length];
  }
  /** The right button pressed (repeat: the key held down, stepping a field being set). */
  startDown(now: number, repeat: boolean) {
    if (!repeat) this.pressedAt.start = now;
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

  /** `air`: the temperature round the player (the weather's outdoors, a room's indoors); `breath`: the player's (sim/needs.ts, 0..1). */
  update(dt: number, time: number, now: number, air: number, breath = 1) {
    this.temp = Number.isNaN(this.temp) ? air : this.temp + (air - this.temp) * Math.min(1, dt / TEMP_S);
    // the pulse: resting ~68, higher the less breath is left, and higher still while it is being spent (running)
    const bpm = 68 + (1 - breath) * 70 + (breath < this.breath - 1e-6 ? 35 : 0);
    this.breath = breath;
    this.pulse += (bpm - this.pulse) * Math.min(1, dt / PULSE_S);
    if (now - this.beatAt >= 60 / this.pulse || now < this.beatAt) this.beatAt = now;
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
/** How slowly the thermometer follows the air, and the pulse the breath (real seconds). */
const TEMP_S = 20, PULSE_S = 4;
/** The day's sunrise and sunset (hours of the day, NaN when the sun does not cross), worked out once a game day. */
const sunDay = { day: NaN, up: NaN, down: NaN };
const SUN_H = (-0.833 * Math.PI) / 180, sunTmp = new Float64Array(2);
function sunTimes(time: number, hour: number): [number, number] {
  const day = Math.floor((time - hour * 3600) / 60 + 0.5);
  if (day !== sunDay.day) {
    sunDay.day = day; sunDay.up = NaN; sunDay.down = NaN;
    const t0 = time - hour * 3600;
    let prev = sunDir(t0, sunTmp)[0] - SUN_H;
    for (let k = 1; k <= 144; k++) {
      const e = sunDir(t0 + k * 600, sunTmp)[0] - SUN_H;
      if ((prev < 0) !== (e < 0)) { const h = ((k - 1) + prev / (prev - e)) / 6; if (e > 0) sunDay.up = h; else sunDay.down = h; }
      prev = e;
    }
  }
  return [sunDay.up, sunDay.down];
}
const hhmm = (h: number) => (Number.isNaN(h) ? '--:--' : `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`);
/** The compass reads its sensor this often (real seconds), like a watch's: the number does not follow every turn of the head. */
const COMPASS_S = 0.6;
const compass = { at: -1e9, deg: 0 };
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Seven segments per digit (a top, b top right, c bottom right, d bottom, e bottom left, f top left, g middle). */
const SEG = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f];
const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const LCD_BG: C3 = [66, 72, 58], INK: C3 = [24, 28, 24], BACKLIT: C3 = [70, 150, 245];
/** The lit LCD glows over the case and the world like the phone's screen, but it is small: its glow reaches this much further (and the square root of it stronger). */
const GLOW_BOOST = 3;
/** The segments that are off still show faintly (a cheap LCD): this much darker than the paper. */
const GHOST = 0.86;
/** The case's width on the interface's grid (cells), where it sits from the left edge, and how far it comes up (rows, from the bottom). */
const CASE_COLS = 32, CASE_X = 6, CASE_ROWS = 17;
/** The watch on screen, of the old case's size (the user, 2026-10-08: 20 % smaller). */
const WATCH_SIZE = 0.8;
/** A button shows pressed this long after it was. */
const PRESS_S = 0.12;

/** The watch's sway and the arm's swing (render/sway.ts), and how far the swing lifts it at full (mm). */
const SWAY = new HandSway(0.55), SWING_LIFT = 2.2;

/** Where this frame drew the lit LCD (interface cells: x, y, w, h, and GLOW_BOOST), for the compositor's glow; null when unlit. */
export const WATCH_LCD: { at: number[] | null } = { at: null };
/** Where the watch's buttons were drawn on the grid this frame (for the mouse, with the cursor free: 15.9a). */
export const WATCH_BTN: [x: number, y: number, b: WBtn][] = [];

// ---- the LCD's picture (LCD_W x LCD_H pixels, 8 a millimetre), painted only when what it shows changes ----
let lcdKey = '';
/** A seven-segment digit (n < 0: blank) at x, y, w x h, its bars t thick with chamfered ends; the ones off as ghosts. */
function digit(P: Paint, x: number, y: number, w: number, h: number, t: number, n: number, ink: C3, ghost: C3) {
  const s = n < 0 ? 0 : SEG[n], m = (h - t) / 2, g = 1;
  const hor = (x0: number, y0: number, len: number) => [x0 + t / 2, y0, x0 + len - t / 2, y0, x0 + len, y0 + t / 2, x0 + len - t / 2, y0 + t, x0 + t / 2, y0 + t, x0, y0 + t / 2];
  const ver = (x0: number, y0: number, len: number) => [x0 + t / 2, y0, x0 + t, y0 + t / 2, x0 + t, y0 + len - t / 2, x0 + t / 2, y0 + len, x0, y0 + len - t / 2, x0, y0 + t / 2];
  const bars = [hor(x + g, y, w - 2 * g), ver(x + w - t, y + g, m + t / 2 - 2 * g), ver(x + w - t, y + m + t / 2 + g, m + t / 2 - 2 * g), hor(x + g, y + h - t, w - 2 * g),
    ver(x, y + m + t / 2 + g, m + t / 2 - 2 * g), ver(x, y + g, m + t / 2 - 2 * g), hor(x + g, y + m, w - 2 * g)];
  bars.forEach((b, k) => P.poly(b, s & (1 << k) ? ink : ghost));
}
/** The LCD as the watch shows it now into I; true if it changed (a new picture to send up). */
function paintLcd(I: Img, Wt: Watch, time: number, now: number, yaw: number, lit: boolean): boolean {
  const C = calendar(time), blink = Math.floor(now * 2) & 1;
  if (now - compass.at >= COMPASS_S || now < compass.at) { compass.at = now; compass.deg = Math.round((((yaw * 180) / Math.PI + 90) % 360 + 360) % 360) % 360; }
  // what it shows: the top row, the big pair, the small pair, the bottom row
  let top = '', date = '', big: [number, number, boolean, boolean, boolean] = [0, 0, false, false, false], small = '';
  const ringing = Wt.mode === 'time' || Wt.ringing(now);
  if (ringing) {
    const hh = Math.floor(C.hour), mm = Math.floor((C.hour % 1) * 60), ss = Math.floor((((C.hour % 1) * 60) % 1) * 60);
    top = DAYS[C.weekday]; date = `${C.month}-${String(C.day).padStart(2, ' ')}`; big = [hh, mm, false, false, false]; small = String(ss).padStart(2, '0');
  } else if (Wt.mode === 'alarm') {
    top = 'AL'; date = Wt.setting ? 'SET' : ''; big = [Math.floor(Wt.alarm.min / 60), Wt.alarm.min % 60, Wt.setting === 1 && !blink, Wt.setting === 2 && !blink, false]; small = Wt.alarm.on ? 'ON' : '--';
  } else {
    const sw = Wt.swAcc + (Wt.swAt >= 0 ? now - Wt.swAt : 0);
    top = 'ST'; date = sw >= 3600 ? `${Math.floor(sw / 3600) % 100}H` : ''; big = [Math.floor(sw / 60) % 60, Math.floor(sw) % 60, false, false, true]; small = String(Math.floor((sw % 1) * 100)).padStart(2, '0');
  }
  let lo = '', ro = '', icon = '';
  if (Wt.face === 'compass') { lo = `${COMPASS[Math.round(compass.deg / 45) % 8].padEnd(2, ' ')} ${String(compass.deg).padStart(3, '0')}`; ro = Number.isNaN(Wt.temp) ? '' : `${Math.round(Wt.temp) || 0}C`; }
  else if (Wt.face === 'sun') { const [u, d] = sunTimes(time, C.hour); lo = hhmm(u); ro = hhmm(d); icon = 'sun'; }
  else if (Wt.face === 'moon') { const p = moonPhase(time); icon = `moon${Math.round(p * 8) % 8}`; ro = `AGE ${String(Math.floor(p * 29.53)).padStart(2, '0')}`; }
  else { icon = now - Wt.beatAt < 0.12 ? 'beat' : 'heart'; lo = String(Math.round(Wt.pulse)).padStart(3, '0'); ro = 'BPM'; }
  const key = [top, date, big.join(), small, lo, ro, icon, Wt.alarm.on, Wt.chime, lit].join('|');
  if (key === lcdKey) return false;
  lcdKey = key;

  const P = new Paint(I), W = I.w, H = I.h;
  // the paper: olive, or backlit blue (brighter at its left edge, where the light comes in)
  for (let x = 0; x < W; x++) { const k = lit ? 1 - (x / W) * 0.35 : 1, c: C3 = lit ? [BACKLIT[0] * k, BACKLIT[1] * k, BACKLIT[2] * k] : LCD_BG; P.rect(x, 0, 1, H, c); }
  const paper: C3 = lit ? [BACKLIT[0] * 0.85, BACKLIT[1] * 0.85, BACKLIT[2] * 0.85] : LCD_BG, ghost: C3 = [paper[0] * GHOST, paper[1] * GHOST, paper[2] * GHOST];
  const text = (x: number, y: number, s: string, right = false) => P.text(right ? x - Paint.textW(s, 2) : x, y, s, 2, INK);
  // the top row: the day or the mode, the alarm's and the signal's marks (ghosts when off), the date
  text(8, 8, top);
  P.text(90, 8, '(*)', 2, Wt.alarm.on ? INK : ghost); P.text(134, 8, 'SIG', 2, Wt.chime ? INK : ghost);
  text(W - 8, 8, date, true);
  // the big pair, hh:mm (a field blank while it blinks being set), and the small pair or word beside it
  const [h, m, hideH, hideM, zero] = big;
  digit(P, 8, 30, 34, 62, 7, hideH || (h < 10 && !zero) ? -1 : Math.floor(h / 10), INK, ghost);
  digit(P, 49, 30, 34, 62, 7, hideH ? -1 : h % 10, INK, ghost);
  P.rect(90, 46, 7, 7, INK); P.rect(90, 70, 7, 7, INK);
  digit(P, 104, 30, 34, 62, 7, hideM ? -1 : Math.floor(m / 10), INK, ghost);
  digit(P, 145, 30, 34, 62, 7, hideM ? -1 : m % 10, INK, ghost);
  if (/^\d\d$/.test(small)) { digit(P, 192, 62, 20, 30, 5, +small[0], INK, ghost); digit(P, 218, 62, 20, 30, 5, +small[1], INK, ghost); }
  else { digit(P, 192, 62, 20, 30, 5, -1, INK, ghost); digit(P, 218, 62, 20, 30, 5, -1, INK, ghost); text(200, 72, small); }
  // the bottom row: the face DISPLAY picked, its icon in pixels
  const by = 104;
  if (icon === 'sun') {
    P.poly([10, by + 12, 16, by + 2, 22, by + 12], INK); text(26, by, lo);
    const rx = W - 8 - Paint.textW(ro, 2) - 16; P.poly([rx, by + 2, rx + 12, by + 2, rx + 6, by + 12], INK); text(W - 8, by, ro, true);
  } else if (icon.startsWith('moon')) {
    // the moon as 8 slices of a disc, lit from the right while it waxes
    const p = +icon.slice(4) / 8, lit8 = Math.round((p < 0.5 ? p * 2 : (1 - p) * 2) * 8), cx = 18, cy = by + 7, r = 7;
    for (let i = 0; i < 8; i++) {
      const x0 = cx - r + (i * 2 * r) / 8, on = p < 0.5 ? i >= 8 - lit8 : i < lit8, hw = Math.sqrt(Math.max(0, r * r - (x0 + r / 8 - cx) ** 2));
      P.rect(Math.round(x0), Math.round(cy - hw), 1, Math.round(hw * 2), on ? INK : ghost);
    }
    text(W - 8, by, ro, true);
  } else if (icon === 'heart' || icon === 'beat') {
    P.disc(13, by + 5, 4, icon === 'beat' ? INK : ghost); P.disc(20, by + 5, 4, icon === 'beat' ? INK : ghost); P.poly([9, by + 6, 24, by + 6, 16.5, by + 14], icon === 'beat' ? INK : ghost);
    text(30, by, lo); text(W - 8, by, ro, true);
  } else { text(8, by, lo); text(W - 8, by, ro, true); }
  return true;
}

/**
 * The watch for this frame (15.21: its body in cubes on the GPU, watch/body3d.ts and render/gpu/voxWatch.ts,
 * as its manual draws it): its place at the bottom left of the view (rising from below as it comes up),
 * the LCD's picture painted when it changes, the buttons' places for the mouse and the lit LCD's for the
 * glow. `px`: the interface grid's origin and cell on the monitor (pixels: x, y, w, h). Null when down.
 */
export function drawWatch(g: CharGrid, Wt: Watch, time: number, now: number, light: Float32Array, brand: string, yaw: number, px: readonly number[], view?: HandView): WatchGpu | null {
  WATCH_LCD.at = null;
  WATCH_BTN.length = 0;
  if (Wt.raise < 0.01) { SWAY.reset(); return null; }
  const e = 1 - (1 - Wt.raise) ** 3, [ox, oy, cw, ch] = px;
  const mo = SWAY.step(now, view);
  // WATCH_SIZE of as wide as the case was in cells, its left and bottom where the old case's were (and up and down with the arm's swing)
  const k0 = (CASE_COLS * cw) / WATCH_CASE.w, k = k0 * WATCH_SIZE, cx = ox + (CASE_X + (CASE_COLS / 2) * WATCH_SIZE) * cw;
  const cy = oy + (g.rows - CASE_ROWS * e + 1 + 7.5) * ch + (1 - WATCH_SIZE) * WATCH_CASE.h * k0 * 0.5 + SWAY.lift * SWING_LIFT * k;
  const lit = Wt.lit(now), L = [Math.max(0.03, light[0]), Math.max(0.03, light[1]), Math.max(0.03, light[2])];
  if (paintLcd(WATCH_GPU.lcd, Wt, time, now, yaw, lit)) WATCH_GPU.lcdVer++;
  const G = watchGpu(cx, cy, k, L, lit, (b) => now - (Wt.pressedAt[b] ?? -9) < PRESS_S, brand, mo);
  const toCell = (p: [number, number]): [number, number] => [Math.floor((p[0] - ox) / cw), Math.floor((p[1] - oy) / ch)];
  if (Wt.raise > 0.5) for (const B of BTNS) WATCH_BTN.push([...toCell(watchProject(B.left ? 1 : NX - 1, B.y0 + 2.5, 5, cx, cy, k)), B.b]);
  if (lit) {
    const M = WATCH_LCD_MM, a = toCell(watchProject(M.x0, M.y0, 9, cx, cy, k)), b = toCell(watchProject(M.x0 + M.w, M.y0 + M.h, 9, cx, cy, k));
    WATCH_LCD.at = [a[0], a[1], b[0] - a[0] + 1, b[1] - a[1] + 1, GLOW_BOOST];
  }
  return G;
}
