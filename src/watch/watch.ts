import { type CharGrid } from '../render/grid';
import { calendar } from '../sim/clock';
import { type C3 } from '../phone/lcd';

/**
 * The digital watch on the player's left wrist (F.4): a cheap 2008 resin quartz watch, raised into
 * the bottom left of the view with H while walking on (the mouse stays on the view). Its LCD shows the
 * city's time in seven-segment digits, the weekday and the date; it is a reflective display, so it
 * reads by the scene's light and fades in the dark, and L lights it for a few seconds from the side,
 * as the real ones do. On the hour it chimes twice, raised or not.
 */
/** The watch is in the game (F.4); off, H and L do nothing and it is never drawn. Kept simple until it earns a role (see CLAUDE.md, F.4). */
export const WATCH_ON = true;

export class Watch {
  up = false;
  /** 0 down at the side, 1 held up in sight (eased). */
  raise = 0;
  /** When the light button was last pressed (real seconds). */
  lightAt = -99;
  /** The game hour last seen, for the hourly chime (-1: not yet). */
  private hour = -1;
  /** Sounds asked for this frame: 'up', 'down', 'light', 'chime'. */
  sfx: string[] = [];

  toggle() { this.up = !this.up; this.sfx.push(this.up ? 'up' : 'down'); }
  /** The light button: only reachable with the watch in sight. */
  light(now: number) { if (this.raise > 0.5) { this.lightAt = now; this.sfx.push('light'); } }
  lit(now: number) { return now - this.lightAt < LIGHT_S; }

  update(dt: number, time: number) {
    this.raise += ((this.up ? 1 : 0) - this.raise) * Math.min(1, dt * 9);
    if (Math.abs(this.raise - (this.up ? 1 : 0)) < 0.002) this.raise = this.up ? 1 : 0;
    const h = Math.floor(time / 3600);
    if (this.hour >= 0 && h !== this.hour) this.sfx.push('chime');
    this.hour = h;
  }
}

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
  const b = brand.toUpperCase().slice(0, 14);
  text(W - 2 - b.length, CASE_Y + 1, b, BRAND, RESIN);
  for (let x = 2; x < W - 2; x++) cell(x, CASE_Y + 2, '-', GOLD, RESIN);
  text((W - 13) >> 1, CASE_Y + CASE_H - 2, 'WATER RESIST', LABEL, RESIN);

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
  const C = calendar(time), hh = Math.floor(C.hour), mm = Math.floor((C.hour % 1) * 60), ss = Math.floor((((C.hour % 1) * 60) % 1) * 60);
  const ink = (x: number, y: number, s: string) => { for (let k = 0; k < s.length; k++) { const [c, own] = lcd(x + k - LX); cell(x + k, y, s[k], INK, c, own); } };
  ink(LX + 1, LY + 1, DAYS[C.weekday]);
  const date = `${C.month}-${String(C.day).padStart(2, ' ')}`;
  ink(LX + LW - 1 - date.length, LY + 1, date);
  const dx = LX + 1, dy = LY + 3;
  digit(dx, dy, hh >= 10 ? Math.floor(hh / 10) : -1); // no leading zero, as on the real ones digit(dx + 5, dy, hh % 10);
  seg(dx + 10, dy + 1, true); seg(dx + 10, dy + 3, true);
  digit(dx + 12, dy, Math.floor(mm / 10)); digit(dx + 17, dy, mm % 10);
  ink(dx + 22, dy + 4, String(ss).padStart(2, '0'));
}
