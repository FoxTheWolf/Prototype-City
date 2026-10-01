import { PLAYER_PHONE, type Device } from '../sim/device';

/**
 * The player's phone as an object in hand: out of the pocket or not, powered or not, which screen
 * it shows, and which of its keys was pressed when (they light up and click). No DOM here: main
 * passes keys in, draw.ts reads the state. Times are real seconds (performance.now / 1000).
 *
 * Controls, after GTA IV on PC: Up takes it out (P too, both ways); with it out, the arrows are
 * the d-pad, Enter or the left mouse button its middle (OK, and the left soft key's action),
 * Backspace or the right mouse button the right soft key (Back), which on the standby screen puts
 * it away; the digit keys are the keypad.
 */
export type Screen = 'off' | 'boot' | 'standby' | 'menu' | 'map';
export type Key = 'lsoft' | 'rsoft' | 'up' | 'down' | 'left' | 'right' | 'ok' | 'send' | 'end' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#';

/** The apps on the menu, in order (the digit keys pick them). */
export const APPS: Screen[] = ['map'];
/** Power on: the hardware check scrolls by fast for BOOT_LOG_S, then the splash screen until BOOT_S. */
export const BOOT_LOG_S = 1.9, BOOT_S = 4.6;

export class Phone {
  readonly device: Device = PLAYER_PHONE;
  out = false;
  /** 0 in the pocket .. 1 held up; eases toward out. */
  raise = 0;
  screen: Screen = 'off';
  /** When the current screen was opened (or redrawn): text types and the map draws in from here. */
  since = 0;
  sel = 0;
  /** The map: metres the view is moved off the player (0, 0 follows the GPS position). */
  panX = 0;
  panY = 0;
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
  }

  open(s: Screen, now: number) {
    this.screen = s; this.since = now;
    if (s === 'menu') this.sel = Math.min(this.sel, APPS.length - 1);
    if (s === 'map') this.panX = this.panY = 0;
  }

  /** A key pressed; returns false when it does nothing here (the click still sounds), 'away' when it went back in the pocket. */
  press(k: Key, now: number, viewW: number, viewH: number): boolean | 'away' {
    this.pressed.set(k, now);
    switch (this.screen) {
      case 'boot':
        if (k === 'rsoft') { this.out = false; return 'away'; }
        return false;
      case 'standby':
        if (k === 'ok' || k === 'lsoft') { this.open('menu', now); return true; }
        if (k === 'rsoft') { this.out = false; return 'away'; }
        return false;
      case 'menu': {
        if (k === 'up' || k === 'down') { this.sel = (this.sel + (k === 'up' ? -1 : 1) + APPS.length) % APPS.length; return true; }
        const n = '123456789'.indexOf(k);
        if (n >= 0 && n < APPS.length) { this.open(APPS[n], now); return true; }
        if (k === 'ok' || k === 'lsoft') { this.open(APPS[this.sel], now); return true; }
        if (k === 'rsoft' || k === 'end') { this.open('standby', now); return true; }
        return false;
      }
      case 'map':
        // the d-pad moves the view a quarter of a screen; OK centers it on the position again
        if (k === 'left' || k === 'right') { this.panX += (k === 'left' ? -1 : 1) * viewW / 4; this.since = now; return true; }
        if (k === 'up' || k === 'down') { this.panY += (k === 'up' ? -1 : 1) * viewH / 4; this.since = now; return true; }
        if (k === 'ok' || k === 'lsoft') { this.panX = this.panY = 0; this.since = now; return true; }
        if (k === 'rsoft') { this.open('menu', now); return true; }
        if (k === 'end') { this.open('standby', now); return true; }
        return false;
    }
    return false;
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
    case 'NumpadMultiply': return '*';
  }
  return null;
}
