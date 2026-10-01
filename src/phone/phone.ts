import { PLAYER_PHONE, type Device } from '../sim/device';
import { type World } from '../sim/world';
import { Gps } from './gps';

/**
 * The player's phone as an object in hand: out of the pocket or not, powered or not, which screen
 * it shows, the state of its apps and its GPS, and which of its keys was pressed when (they light
 * up and click). No DOM here: main passes keys in, draw.ts and apps.ts read the state. Times are
 * real seconds (performance.now / 1000).
 *
 * Controls, after GTA IV on PC: Up takes it out (P too, both ways); with it out, the arrows are
 * the d-pad, Enter or the left mouse button its middle (OK, and the left soft key's action),
 * Backspace or the right mouse button the right soft key (Back), which on the standby screen puts
 * it away; the digit keys are the keypad, + / numpad * its * key, - and . its # key, Space the
 * green call key and Delete the red end key. In the map, 1-4 (or * and #, or the mouse wheel)
 * pick the zoom, and OK opens the list of places (or, with the view moved, centers it again).
 */
export type App = 'map' | 'calls' | 'contacts' | 'messages' | 'camera' | 'web' | 'clock' | 'calc' | 'notes' | 'weather' | 'store' | 'settings';
export type Screen = 'off' | 'boot' | 'standby' | 'menu' | 'places' | App;
export type Key = 'lsoft' | 'rsoft' | 'up' | 'down' | 'left' | 'right' | 'ok' | 'send' | 'end' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#';

/** The menu: a 3x4 grid of apps, picked with the arrows or the key in the same place on the keypad. */
export const APPS: App[] = ['map', 'calls', 'contacts', 'messages', 'camera', 'web', 'clock', 'calc', 'notes', 'weather', 'store', 'settings'];
export const GRID_KEYS: Key[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
/** Power on: the hardware check scrolls by fast for BOOT_LOG_S, then the splash screen until BOOT_S. */
export const BOOT_LOG_S = 1.9, BOOT_S = 4.6;
/** The map's zoom levels (local, district, sector, city): metres per screen row. */
export const ZOOM_ROW_M = [8, 18, 36, 96];
/** Inside a building the map shows the floor plan instead, at these scales. */
export const INDOOR_ROW_M = [1, 2, 3.5, 6];
/** The letters on the keypad, for typing notes by tapping a key again and again (multi-tap). */
export const TAPS: Record<string, string> = { '1': '.,?!-\'1', '2': 'abc2', '3': 'def3', '4': 'ghi4', '5': 'jkl5', '6': 'mno6', '7': 'pqrs7', '8': 'tuv8', '9': 'wxyz9', '0': ' 0' };

export class Phone {
  readonly device: Device = PLAYER_PHONE;
  readonly gps = new Gps();
  constructor(private world: World) {}
  out = false;
  /** 0 in the pocket .. 1 held up; eases toward out. */
  raise = 0;
  screen: Screen = 'off';
  /** When the current screen was opened (or redrawn): text types and the map draws in from here. */
  since = 0;
  /** The app picked on the menu grid. */
  sel = 0;
  /** The map: metres the view is moved off the GPS position (0, 0 follows it). */
  panX = 0;
  panY = 0;
  /** The map's zoom level (index into ZOOM_ROW_M). */
  zoom = 0;
  /** The list of places: landmarks nearest first, and the one picked. */
  places: number[] = [];
  psel = 0;
  /** Calls: the number being dialled, and when the green key was pressed on it (-1: not calling). */
  dial = '';
  callAt = -1;
  /** Calculator: the number on the display, the one kept, the operation waiting, and whether the next digit starts a new number. */
  calc = { cur: '0', acc: 0, op: '', fresh: true };
  /** Notes: the text, and the key last tapped with when (a tap within a second picks its next letter). */
  note = '';
  tapKey = '';
  tapAt = 0;
  tapN = 0;
  /** Clock: the stopwatch, running since `swAt` (or -1), with `swAcc` seconds before. */
  swAt = -1;
  swAcc = 0;
  /** Settings: the scroll of the list. */
  scroll = 0;
  /** When each key was last pressed, for its light. */
  readonly pressed = new Map<Key, number>();

  /** Out of the pocket or back in; it boots the first time. Returns what to play. */
  toggle(now: number): 'out' | 'in' | 'boot' {
    this.out = !this.out;
    if (!this.out) return 'in';
    if (this.screen === 'off') { this.screen = 'boot'; this.since = now + 0.35; return 'boot'; }
    this.since = now; // the backlight wakes up: the screen draws in again
    return 'out';
  }

  update(dt: number, now: number) {
    this.raise += ((this.out ? 1 : 0) - this.raise) * Math.min(1, dt * 14);
    if (this.screen === 'boot' && now - this.since > BOOT_S) this.open('standby', now);
    // the GPS runs while the map is open, in the hand or not
    this.gps.update(this.world, this.screen === 'map' || this.screen === 'places', now, dt);
  }

  open(s: Screen, now: number) {
    this.screen = s; this.since = now; this.scroll = 0;
    if (s === 'map') this.panX = this.panY = 0;
  }

  /** Where the map is: the GPS position (or the last known one), or the city's middle before any fix. */
  here(): [number, number] {
    const g = this.gps, c = this.world.city;
    return g.known ? [g.x, g.y] : [c.cx, c.cy];
  }

  /** The view stays over the city and its edge. */
  private clampPan(): boolean {
    const [x, y] = this.here(), c = this.world.city, M = 300;
    this.panX = Math.max(-M - x, Math.min(c.w + M - x, this.panX));
    this.panY = Math.max(-M - y, Math.min(c.h + M - y, this.panY));
    return true;
  }

  /** The map's zoom; false when it is already at that end. */
  setZoom(z: number, now: number): boolean {
    z = Math.max(0, Math.min(ZOOM_ROW_M.length - 1, z));
    if (z === this.zoom) return false;
    this.zoom = z; this.since = now;
    return true;
  }

  /** A key pressed; returns false when it does nothing here (the click still sounds), 'away' when it went back in the pocket. */
  press(k: Key, now: number, viewW: number, viewH: number): boolean | 'away' {
    this.pressed.set(k, now);
    const s = this.screen;
    // the red key always goes home; the green one opens the dialer
    if (k === 'end' && s !== 'boot' && s !== 'standby') { this.callAt = -1; this.open('standby', now); return true; }
    if (k === 'send' && (s === 'standby' || s === 'menu')) { this.open('calls', now); return true; }
    switch (s) {
      case 'boot':
        if (k === 'rsoft') { this.out = false; return 'away'; }
        return false;
      case 'standby':
        if (k === 'ok' || k === 'lsoft') { this.open('menu', now); return true; }
        if (k === 'rsoft') { this.out = false; return 'away'; }
        return false;
      case 'menu': {
        if (k === 'left' || k === 'right') { this.sel = (this.sel + (k === 'left' ? -1 : 1) + APPS.length) % APPS.length; return true; }
        if (k === 'up' || k === 'down') { this.sel = (this.sel + (k === 'up' ? -3 : 3) + APPS.length) % APPS.length; return true; }
        const n = GRID_KEYS.indexOf(k);
        if (n >= 0) { this.sel = n; this.open(APPS[n], now); return true; }
        if (k === 'ok' || k === 'lsoft') { this.open(APPS[this.sel], now); return true; }
        if (k === 'rsoft') { this.open('standby', now); return true; }
        return false;
      }
      case 'map':
        // the d-pad moves the view a quarter of a screen; OK centers it on the position again
        if (k === 'left' || k === 'right') { this.panX += (k === 'left' ? -1 : 1) * viewW / 4; this.since = now; return this.clampPan(); }
        if (k === 'up' || k === 'down') { this.panY += (k === 'up' ? -1 : 1) * viewH / 4; this.since = now; return this.clampPan(); }
        if (k === '1' || k === '2' || k === '3' || k === '4') return this.setZoom(+k - 1, now);
        if (k === '*' || k === '#') return this.setZoom(this.zoom + (k === '*' ? -1 : 1), now);
        if (k === 'ok' || k === 'lsoft') {
          if (this.panX || this.panY) { this.panX = this.panY = 0; this.since = now; return true; }
          // the places, nearest first
          const [x, y] = this.here(), L = this.world.city.landmarks;
          this.places = L.map((_, i) => i).sort((a, b) => Math.hypot(L[a].x - x, L[a].y - y) - Math.hypot(L[b].x - x, L[b].y - y));
          this.psel = 0; this.screen = 'places'; this.since = now;
          return true;
        }
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
      case 'places': {
        const n = this.places.length;
        if (n && (k === 'up' || k === 'down')) { this.psel = (this.psel + (k === 'up' ? -1 : 1) + n) % n; return true; }
        if (n && (k === 'ok' || k === 'lsoft')) {
          // show the place on the map, at a zoom that keeps the position in sight when it is near
          const [x, y] = this.here(), L = this.world.city.landmarks[this.places[this.psel]];
          this.screen = 'map'; this.since = now;
          this.panX = L.x - x; this.panY = L.y - y;
          const d = Math.hypot(this.panX, this.panY);
          this.zoom = Math.max(this.zoom, d < 150 ? 0 : d < 350 ? 1 : d < 700 ? 2 : 3);
          return true;
        }
        if (k === 'rsoft') { this.screen = 'map'; this.since = now; return true; }
        return false;
      }
      case 'calls':
        if (this.callAt >= 0) { if (k === 'rsoft') { this.callAt = -1; return true; } return false; }
        if (/^[0-9*#]$/.test(k)) { if (this.dial.length < 16) this.dial += k; return true; }
        if ((k === 'send' || k === 'ok' || k === 'lsoft') && this.dial) { this.callAt = now; return true; }
        if (k === 'rsoft') { if (this.dial) this.dial = this.dial.slice(0, -1); else this.open('menu', now); return true; }
        return false;
      case 'calc':
        return this.calcKey(k, now);
      case 'notes': {
        if (k === 'rsoft') { this.open('menu', now); return true; }
        if (k === '*') { this.note = this.note.slice(0, -1); this.tapKey = ''; return true; }
        if (k === '#') { this.note += '\n'; this.tapKey = ''; return true; }
        const letters = TAPS[k];
        if (!letters) return false;
        if (k === this.tapKey && now - this.tapAt < 1) { this.tapN = (this.tapN + 1) % letters.length; this.note = this.note.slice(0, -1); }
        else this.tapN = 0;
        if (this.note.length < 400) this.note += letters[this.tapN];
        this.tapKey = k; this.tapAt = now;
        return true;
      }
      case 'clock':
        if (k === 'ok' || k === 'lsoft') { if (this.swAt >= 0) { this.swAcc += now - this.swAt; this.swAt = -1; } else this.swAt = now; return true; }
        if (k === '*') { this.swAcc = 0; if (this.swAt >= 0) this.swAt = now; return true; }
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
      case 'settings':
        if (k === 'up' || k === 'down') { this.scroll = Math.max(0, this.scroll + (k === 'up' ? -1 : 1)); return true; }
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
      default:
        // the apps that cannot do anything yet (no network, or a later stage): Back only
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
    }
  }

  /** The calculator: digits, # the point, the arrows + - x /, OK =, * clears. */
  private calcKey(k: Key, now: number): boolean {
    const C = this.calc;
    if (k === 'rsoft') { this.open('menu', now); return true; }
    if (/^[0-9]$/.test(k) || k === '#') {
      const d = k === '#' ? '.' : k;
      if (C.fresh) { C.cur = d === '.' ? '0.' : d; C.fresh = false; return true; }
      if (d === '.' && C.cur.includes('.')) return false;
      if (C.cur.length >= 12) return false;
      C.cur = C.cur === '0' && d !== '.' ? d : C.cur + d;
      return true;
    }
    if (k === '*') { this.calc = { cur: '0', acc: 0, op: '', fresh: true }; return true; }
    const op = k === 'up' ? '+' : k === 'down' ? '-' : k === 'left' ? 'x' : k === 'right' ? '/' : k === 'ok' || k === 'lsoft' ? '=' : '';
    if (!op) return false;
    // a number typed after an operation completes it; an operation right after another replaces it
    const v = parseFloat(C.cur);
    if (C.op && !C.fresh) C.acc = C.op === '+' ? C.acc + v : C.op === '-' ? C.acc - v : C.op === 'x' ? C.acc * v : v === 0 ? NaN : C.acc / v;
    else if (!C.op) C.acc = v;
    C.cur = Number.isFinite(C.acc) ? String(+C.acc.toPrecision(10)).slice(0, 13) : 'ERROR';
    if (!Number.isFinite(C.acc)) C.acc = 0;
    C.op = op === '=' ? '' : op;
    C.fresh = true;
    return true;
  }
}

/** The phone key a keyboard key stands for, while the phone is out. */
export function phoneKey(code: string): Key | null {
  const m = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (m) return m[1] as Key;
  switch (code) {
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 'ArrowLeft': return 'left';
    case 'ArrowRight': return 'right';
    case 'Enter': case 'NumpadEnter': return 'ok';
    case 'Backspace': return 'rsoft';
    case 'Space': return 'send';
    case 'Delete': return 'end';
    // * (zoom in on the map) is also + on the keyboard; # (zoom out, the point in the calculator) also - and .
    case 'NumpadMultiply': case 'Equal': case 'NumpadAdd': return '*';
    case 'Minus': case 'NumpadSubtract': case 'Period': case 'NumpadDecimal': return '#';
  }
  return null;
}
