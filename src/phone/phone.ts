import { playerPhone, type Device } from '../sim/device';
import { type World } from '../sim/world';
import { Gps } from './gps';
import { Call, type Sfx } from './call';
import { codeKind, secretCodes, type CodeKind } from './codes';
import { Radio } from './radio';
import { ussd } from './ussd';
import en from '../locale/en.json';
import { businessName, makerName, operatorName } from '../locale/names';
import { BIZ_HOURS, formatNumber, lookup } from '../sim/telco';
import { hash3 } from '../core/rng';

/**
 * The player's phone as an object in hand: out of the pocket or not, powered or not, which screen
 * it shows, the state of its apps and its GPS, and which of its keys was pressed when (they light
 * up and click). No DOM here: main passes keys in, draw.ts and apps.ts read the state. Times are
 * real seconds (performance.now / 1000).
 *
 * Controls, after GTA IV on PC: Up takes it out (P too, both ways); with it out, the arrows are
 * the d-pad, Enter or the left mouse button its middle (OK, and the left soft key's action),
 * Backspace or a click of the right mouse button the right soft key (Back), which on the standby
 * screen puts it away; the middle button takes it out and puts it away. With it out the system
 * cursor is free (hold the right button to look around), a click on a key presses it, and the wheel
 * steps through the menu and scrolls lists; the digit keys are the keypad, + / numpad * its * key, - and . its # key, Space the
 * green call key and Delete the red end key. In the map, 1-4 (or * and #, or the mouse wheel)
 * pick the zoom, and OK opens the list of places (or, with the view moved, centers it again).
 */
export type App = 'map' | 'calls' | 'contacts' | 'messages' | 'camera' | 'web' | 'clock' | 'calc' | 'notes' | 'weather' | 'store' | 'settings';
export type Screen = 'off' | 'boot' | 'standby' | 'menu' | 'places' | 'code' | 'contact' | 'ussd' | 'msglist' | 'msg' | 'compose' | App;
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
/**
 * The phone's settings: a list of pages; the sound, display and unit pages are rows of options
 * (left/right or OK change them), "about" lists the hardware and the line, "debug" holds what is
 * there for testing the game (the secret codes, to dial them; to go once gameplay replaces it).
 */
export type SetPage = 'root' | 'sound' | 'display' | 'units' | 'about' | 'debug';
export const SET_PAGES: SetPage[] = ['sound', 'display', 'units', 'about', 'debug'];
export interface Prefs {
  /** 0 normal, 1 vibrate, 2 silent. */
  profile: number;
  ring: number;
  /** Keypad tones: 0 beep, 1 click only, 2 touch-tones, 3 off. */
  keys: number;
  theme: number;
  /** 0 Fahrenheit, 1 Celsius. */
  temp: number;
  /** 0 metres, 1 feet. */
  dist: number;
}
export const PREF_ROWS: Record<'sound' | 'display' | 'units', (keyof Prefs)[]> = { sound: ['profile', 'ring', 'keys'], display: ['theme'], units: ['temp', 'dist'] };
/** How many values each option has (their names are in the locale). */
export const PREF_N: Record<keyof Prefs, number> = { profile: 3, ring: 6, keys: 4, theme: 6, temp: 2, dist: 2 };

/** A distance as the phone shows it, in the units picked in its settings. */
export function fmtDist(m: number, feet: number): string {
  if (feet) { const f = m * 3.281; return f < 5280 ? `${Math.round(f)}ft` : `${(f / 5280).toFixed(1)}mi`; }
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

/** The contacts that come with the line: emergency, the operator's care line and its service menu, directory assistance. */
const CONTACTS: [string, string][] = [['Emergency', '911'], ['Customer Care', '611'], ['Balance & Data', '*100#'], ['Directory', '411']];

const SMS = en.phone.sms;

/** Kilobytes of a weather forecast download. */
const WEATHER_KB = 12;
/** The screens that take typing: the phone is held higher on them, the whole keypad in sight. */
export const TYPING: Screen[] = ['calls', 'calc', 'notes', 'contact', 'ussd', 'compose'];
/** The letters on the keypad, for typing notes by tapping a key again and again (multi-tap). */
export const TAPS: Record<string, string> = { '1': '.,?!-\'1', '2': 'abc2', '3': 'def3', '4': 'ghi4', '5': 'jkl5', '6': 'mno6', '7': 'pqrs7', '8': 'tuv8', '9': 'wxyz9', '0': ' 0' };

export class Phone {
  readonly device: Device;
  /** The maker's name, from the city. */
  readonly maker: string;
  readonly gps = new Gps();
  readonly radio = new Radio();
  prefs: Prefs = { profile: 0, ring: 0, keys: 0, theme: 0, temp: 0, dist: 0 };
  /** Settings: the page open and the row picked on it. */
  setPage: SetPage = 'root';
  setSel = 0;
  /** A sound the last key asks for (main plays it): a ringtone preview, the buzz of vibrate, or silence. */
  cue: 'ring' | 'vibrate' | 'stop' | null = null;
  /** The service screen a secret code opened. */
  code: CodeKind = 'imei';
  /** A code being dialed by itself (from the debug settings): the keys left, and when the next one goes. */
  private autoQ = '';
  private autoAt = 0;
  /** LCD test: the color shown. */
  lcdStep = 0;
  /** Weather: game time the forecast was last downloaded (-1: never); it keeps an hour. */
  wxAt = -1e9;
  constructor(private world: World) {
    this.device = playerPhone(world.seed);
    this.maker = makerName(world.city, this.device.maker);
  }
  out = false;
  /** 0 in the pocket .. 1 held up; eases toward out. */
  raise = 0;
  /** 0 .. 1: held higher, the whole keypad in sight, while the screen wants typing (as in GTA IV). */
  lift = 0;
  /** The grid cell under the system cursor, and the key there. */
  cx = -1;
  cy = -1;
  hover: Key | null = null;
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
  /** Calls: the number being dialled, the call under way (or just ended), the numbers called last. */
  dial = '';
  call: Call | null = null;
  readonly redial: string[] = [];
  /** Sounds the phone asks main to play (the call's tones and voices). */
  readonly sfx: Sfx[] = [];
  /** The contacts on the SIM (it holds 250): a few come with the line, the rest are added by hand. */
  readonly contacts: { name: string; number: string }[] = [];
  csel = 0;
  /** The contact being written: its name (typed by multi-tap), its number, and which of them is being typed. */
  edit = { name: '', number: '', step: 0 };
  /** Text messages received (from, text, game time, read) and sent (to, text, game time). */
  readonly inbox: { from: string; text: string; at: number; read: boolean }[] = [];
  readonly sent: { to: string; text: string; at: number }[] = [];
  /** Messages: the box open (0 inbox, 1 sent), the one picked, the message being written. */
  box = 0;
  msel = 0;
  draft = { to: '', text: '', step: 0 };
  /** Messages on their way to the phone: from, text, and when they arrive (real seconds). */
  private incoming: { from: string; text: string; at: number }[] = [];
  /** Operator notices already sent: welcome, low data, no data. */
  private told = { welcome: false, low: false, out: false };
  /** A USSD session: the code, the answers so far, what came back, what is being typed, when it was asked. */
  us = { code: '', path: [] as string[], text: '', menu: false, input: '', at: 0 };
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
    if (this.screen === 'off') {
      this.screen = 'boot'; this.since = now + 0.35;
      // the numbers that come with the line
      for (const [name, number] of CONTACTS) this.contacts.push({ name, number });
      return 'boot';
    }
    this.since = now; // the backlight wakes up: the screen draws in again
    return 'out';
  }

  update(dt: number, now: number) {
    this.raise += ((this.out ? 1 : 0) - this.raise) * Math.min(1, dt * 14);
    this.lift += ((this.out && TYPING.includes(this.screen) ? 1 : 0) - this.lift) * Math.min(1, dt * 10);
    if (this.screen === 'boot' && now - this.since > BOOT_S) this.open('standby', now);
    // the GPS runs while the map is open, in the hand or not
    this.gps.update(this.world, this.screen === 'map' || this.screen === 'places' || (this.screen === 'code' && this.code === 'gps'), now, dt);
    this.radio.update(this.world, this.screen !== 'off', now, dt);
    // text messages arriving; the operator's notices
    for (let i = this.incoming.length - 1; i >= 0; i--) {
      const m = this.incoming[i];
      if (now < m.at || this.radio.state !== 'service') continue;
      this.incoming.splice(i, 1);
      this.inbox.unshift({ from: m.from, text: m.text, at: this.world.time, read: false });
      this.sfx.push(['sms']);
    }
    if (this.radio.state === 'service') {
      const A = this.world.telco.player, op = operatorName(this.world.city);
      if (!this.told.welcome) { this.told.welcome = true; this.receive(op, SMS.welcome.replace('{op}', op), now + 4); }
      if (A.dataKB < 500 && !this.told.low) { this.told.low = true; this.receive(op, SMS.lowData, now + 2); }
      if (A.dataKB < 1 && !this.told.out) { this.told.out = true; this.receive(op, SMS.noData, now + 2); }
      if (A.dataKB > 500) this.told.low = this.told.out = false;
    }
    // the call: its tones and voices; ended, it is paid for and, a moment later, put away
    const c = this.call;
    if (c) {
      c.update(now, this.sfx);
      if (c.state === 'ended' && now > c.endAt + 2.5) {
        this.world.telco.player.credit -= c.cost();
        for (const [name, num] of c.listings) this.receive('411', `${name} ${formatNumber(this.world.telco, num)}`, now + 3);
        this.call = null;
      }
    }
    const J = this.radio.job;
    if (J?.what === 'weather' && J.state === 'done') { this.wxAt = this.world.time; this.radio.job = null; }
    // with the weather open, the forecast downloads over EDGE when it is older than an hour (and
    // again once the signal is back after a failed try; not with the bundle used up)
    const busy = this.radio.job === J && J?.what === 'weather' && (J.state === 'connecting' || J.state === 'loading' || J.state === 'nodata');
    if (this.screen === 'weather' && !busy && this.world.time - this.wxAt > 3600 && this.radio.state === 'service') this.radio.fetch('weather', WEATHER_KB, now);
  }

  open(s: Screen, now: number) {
    if (this.screen === 'settings' && s !== 'settings') this.cue = 'stop';
    this.screen = s; this.since = now; this.scroll = 0;
    if (s === 'settings') { this.setPage = 'root'; this.setSel = 0; }
    if (s === 'map') this.panX = this.panY = 0;
  }

  /** The next key of a code dialing itself, when its time has come. */
  autoKey(now: number): Key | null {
    if (this.screen !== 'calls') { this.autoQ = ''; return null; }
    if (!this.autoQ || now < this.autoAt) return null;
    const k = this.autoQ[0] as Key;
    this.autoQ = this.autoQ.slice(1); this.autoAt = now + 0.2;
    return k;
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
    if (k === 'end' && this.call && this.call.state !== 'ended') { this.call.hangUp(now); this.sfx.push(['stop']); return true; }
    if (k === 'end' && s !== 'boot' && s !== 'standby') { this.open('standby', now); return true; }
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
        if (this.call) {
          if (k === 'rsoft') { this.call.hangUp(now); this.sfx.push(['stop']); return true; }
          if (/^[0-9*#]$/.test(k)) { this.call.key(k, now); return true; }
          return false;
        }
        if (/^[0-9*#]$/.test(k)) {
          if (this.dial.length < 16) this.dial += k;
          // a secret code runs as soon as its last # is in
          const c = k === '#' ? codeKind(this.world.seed, this.dial) : null;
          if (c) { this.code = c; this.lcdStep = 0; this.dial = ''; this.open('code', now + 0.25); }
          return true;
        }
        if ((k === 'send' || k === 'ok') && this.dial) { this.place(this.dial, now); return true; }
        // the green key on an empty dialer brings back the last number called
        if (k === 'send' && this.redial.length) { this.dial = this.redial[0]; return true; }
        if (k === 'lsoft' && this.dial) { this.edit = { name: '', number: this.dial, step: 0 }; this.open('contact', now); return true; }
        if (k === 'rsoft') { if (this.dial) this.dial = this.dial.slice(0, -1); else this.open('menu', now); return true; }
        return false;
      case 'calc':
        return this.calcKey(k, now);
      case 'notes': {
        if (k === 'rsoft') { this.open('menu', now); return true; }
        if (k === '*') { this.note = this.note.slice(0, -1); this.tapKey = ''; return true; }
        if (k === '#') { this.note += '\n'; this.tapKey = ''; return true; }
        const t = this.tap(this.note, k, now, 400);
        if (t === null) return false;
        this.note = t;
        return true;
      }
      case 'contacts': {
        const n = this.contacts.length;
        if (n && (k === 'up' || k === 'down')) { this.csel = (this.csel + (k === 'up' ? -1 : 1) + n) % n; return true; }
        if (n && (k === 'ok' || k === 'send')) { this.open('calls', now); this.place(this.contacts[this.csel].number, now); return true; }
        if (k === 'lsoft') { this.edit = { name: '', number: '', step: 0 }; this.open('contact', now); return true; }
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
      }
      case 'ussd': {
        const U = this.us;
        if (k === 'rsoft' || (k === 'end')) { this.open('calls', now); return true; }
        if (!U.menu) return k === 'ok' ? (this.open('calls', now), true) : false;
        if (/^[0-9]$/.test(k) && U.input.length < 12) { U.input += k; return true; }
        if (k === '*' && U.input) { U.input = U.input.slice(0, -1); return true; }
        if ((k === 'ok' || k === 'send' || k === 'lsoft') && U.input) { U.path.push(U.input); U.at = now; this.since = now; this.ask(); return true; }
        return false;
      }
      case 'messages': {
        // the boxes, and a new message
        if (k === 'up' || k === 'down') { this.box = (this.box + (k === 'up' ? 2 : 1)) % 3; return true; }
        if (k === 'ok' || k === 'lsoft') {
          if (this.box === 2) { this.draft = { to: '', text: '', step: 0 }; this.open('compose', now); }
          else { this.msel = 0; this.open('msglist', now); }
          return true;
        }
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
      }
      case 'msglist': {
        const n = this.box === 0 ? this.inbox.length : this.sent.length;
        if (n && (k === 'up' || k === 'down')) { this.msel = (this.msel + (k === 'up' ? -1 : 1) + n) % n; return true; }
        if (n && k === 'ok') { if (this.box === 0) this.inbox[this.msel].read = true; this.open('msg', now); return true; }
        if (k === 'lsoft') { this.draft = { to: '', text: '', step: 0 }; this.open('compose', now); return true; }
        if (k === 'rsoft') { this.open('messages', now); return true; }
        return false;
      }
      case 'msg': {
        const m = this.box === 0 ? this.inbox[this.msel] : null, who = m ? m.from : this.sent[this.msel]?.to ?? '';
        if (k === 'lsoft' && /^[0-9*#]+$/.test(who)) { this.draft = { to: who, text: '', step: 1 }; this.open('compose', now); return true; }
        if (k === 'send' && /^[0-9]+$/.test(who)) { this.open('calls', now); this.place(who, now); return true; }
        if (k === 'rsoft') { this.open('msglist', now); return true; }
        return false;
      }
      case 'compose': {
        // the number, then the text by multi-tap (0 a space, * deletes); OK sends
        const D = this.draft;
        if (k === 'rsoft') { if (D.step === 1 && !D.text) D.step = 0; else this.open('messages', now); return true; }
        if (k === 'up' || k === 'down') { D.step = k === 'down' ? 1 : 0; this.tapKey = ''; return true; }
        if (k === 'ok' || k === 'lsoft' || k === 'send') {
          if (D.step === 0 && D.to) { D.step = 1; return true; }
          if (D.to && D.text) { const ok = this.send(now); this.box = 1; this.msel = 0; this.open('messages', now); this.sfx.push(ok ? ['sent'] : ['fail']); return true; }
          return false;
        }
        if (D.step === 0) {
          if (k === '*' && D.to) { D.to = D.to.slice(0, -1); return true; }
          if (/^[0-9#]$/.test(k) && D.to.length < 16) { D.to += k; return true; }
          return false;
        }
        if (k === '*') { D.text = D.text.slice(0, -1); this.tapKey = ''; return true; }
        if (k === '#') { D.text += '.'; this.tapKey = ''; return true; }
        const t = this.tap(D.text, k, now, 160);
        if (t === null) return false;
        D.text = t;
        return true;
      }
      case 'contact': {
        // a new contact: the name by multi-tap (# goes on to the number), then the number; OK saves
        const E = this.edit;
        if (k === 'rsoft') { if (E.step === 1 && !E.number) E.step = 0; else this.open('contacts', now); return true; }
        if ((k === 'ok' || k === 'lsoft') && E.name && E.number) {
          if (this.contacts.length < 250) this.contacts.push({ name: E.name, number: E.number });
          this.csel = this.contacts.length - 1; this.open('contacts', now);
          return true;
        }
        if (k === 'down' || k === 'up') { E.step = k === 'down' ? 1 : 0; this.tapKey = ''; return true; }
        if (E.step === 0) {
          if (k === '#') { E.step = 1; this.tapKey = ''; return true; }
          if (k === '*') { E.name = E.name.slice(0, -1); this.tapKey = ''; return true; }
          const t = this.tap(E.name, k, now, 20);
          if (t === null) return false;
          E.name = t.length === 1 || /\s.$/.test(t) ? t.slice(0, -1) + t.slice(-1).toUpperCase() : t;
          return true;
        }
        if (k === '*' && E.number) { E.number = E.number.slice(0, -1); return true; }
        if (/^[0-9#]$/.test(k) && E.number.length < 16) { E.number += k; return true; }
        return false;
      }
      case 'clock':
        if (k === 'ok' || k === 'lsoft') { if (this.swAt >= 0) { this.swAcc += now - this.swAt; this.swAt = -1; } else this.swAt = now; return true; }
        if (k === '*') { this.swAcc = 0; if (this.swAt >= 0) this.swAt = now; return true; }
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
      case 'settings':
        return this.settingsKey(k, now);
      case 'code':
        if (k === 'rsoft') { this.open('calls', now); return true; }
        if (this.code === 'lcd' && (k === 'ok' || k === 'lsoft')) { this.lcdStep++; return true; }
        return this.code === 'keys';
      case 'weather':
        // OK downloads it again
        if ((k === 'ok' || k === 'lsoft') && this.radio.state === 'service') { this.radio.fetch('weather', WEATHER_KB, now); this.since = now; return true; }
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
      default:
        // the apps that cannot do anything yet (no network, or a later stage): Back only
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
    }
  }

  private settingsKey(k: Key, now: number): boolean {
    const pg = this.setPage;
    const back = () => { this.setSel = SET_PAGES.indexOf(pg); this.setPage = 'root'; this.since = now; this.cue = 'stop'; return true; };
    if (pg === 'root') {
      if (k === 'up' || k === 'down') { this.setSel = (this.setSel + (k === 'up' ? -1 : 1) + SET_PAGES.length) % SET_PAGES.length; return true; }
      if (k === 'ok' || k === 'lsoft') { this.setPage = SET_PAGES[this.setSel]; this.setSel = 0; this.scroll = 0; this.since = now; return true; }
      if (k === 'rsoft') { this.open('menu', now); return true; }
      return false;
    }
    if (k === 'rsoft') return back();
    if (pg === 'about') {
      if (k === 'up' || k === 'down') { this.scroll = Math.max(0, this.scroll + (k === 'up' ? -1 : 1)); return true; }
      return false;
    }
    if (pg === 'debug') {
      const C = secretCodes(this.world.seed);
      if (k === 'up' || k === 'down') { this.setSel = (this.setSel + (k === 'up' ? -1 : 1) + C.length) % C.length; return true; }
      // OK dials the code: the dialer opens and its keys go in one by one, with their tones
      if (k === 'ok' || k === 'lsoft') { this.dial = ''; this.call = null; this.open('calls', now); this.autoQ = C[this.setSel].code; this.autoAt = now + 0.5; return true; }
      return false;
    }
    const rows = PREF_ROWS[pg];
    if (k === 'up' || k === 'down') { this.setSel = (this.setSel + (k === 'up' ? -1 : 1) + rows.length) % rows.length; return true; }
    const less = k === 'left';
    if (!(less || k === 'right' || k === 'ok' || k === 'lsoft')) return false;
    const key = rows[this.setSel], n = PREF_N[key];
    this.prefs[key] = (this.prefs[key] + (less ? -1 : 1) + n) % n;
    // hear what was picked
    if (key === 'ring' || key === 'profile') this.cue = this.prefs.profile === 0 ? 'ring' : this.prefs.profile === 1 ? 'vibrate' : 'stop';
    return true;
  }

  /** A text message on its way to the phone, arriving at `at` (once there is signal). */
  receive(from: string, text: string, at: number) { this.incoming.push({ from, text, at }); }

  /**
   * Send a text (10 cents): the network carries it if there is signal; a business may answer with
   * an automatic reply, a home now and then; a number not in service bounces back.
   */
  private send(now: number): boolean {
    const D = this.draft, A = this.world.telco.player;
    if (this.radio.state !== 'service' || A.credit < 10) return false;
    A.credit -= 10;
    this.sent.unshift({ to: D.to, text: D.text, at: this.world.time });
    const c = lookup(this.world.telco, this.world.seed, D.to), h = (q: number) => hash3(this.world.seed, this.sent.length, q);
    const op = operatorName(this.world.city);
    if (c.kind === 'none') this.receive(op, SMS.failed.replace('{to}', D.to), now + 5);
    else if (c.kind === 'self') this.receive(D.to, D.text, now + 3);
    else if (c.kind === 'biz' && h(1) < 0.6) {
      const b = this.world.city.businesses[c.k], [o, z] = BIZ_HOURS[b.kind] ?? [9, 17], hh = (x: number) => `${((x + 11) % 12) + 1}${x % 24 < 12 ? 'am' : 'pm'}`;
      const t = SMS.biz[Math.floor(h(2) * SMS.biz.length)].replace('{num}', formatNumber(this.world.telco, this.world.telco.bizNum[c.k])).replace('{open}', hh(o)).replace('{close}', hh(z)).replace('{biz}', businessName(this.world.city, c.k));
      this.receive(D.to, t, now + 8 + h(3) * 20);
    } else if (c.kind === 'res' && h(1) < 0.4) this.receive(D.to, SMS.res[Math.floor(h(2) * SMS.res.length)], now + 15 + h(3) * 40);
    return true;
  }

  /** Call a number: the exchange decides who answers (see call.ts); a *code# opens the operator's service menu. */
  place(number: string, now: number) {
    if (/^\*[0-9*]*#$/.test(number)) {
      if (this.radio.state !== 'service') { this.sfx.push(['fail']); return; }
      this.us = { code: number, path: [], text: '', menu: false, input: '', at: now };
      this.ask();
      this.open('ussd', now);
      return;
    }
    this.call = new Call(this.world, number, now, this.radio.state !== 'service');
    if (this.call.state === 'ended') this.sfx.push(['fail']);
    this.dial = number;
    if (this.redial[0] !== number) this.redial.unshift(number);
    if (this.redial.length > 10) this.redial.pop();
  }

  /** Ask the operator's menu for the answer to the path so far. */
  private ask() {
    const r = ussd(this.world, this.us.code, this.us.path);
    this.us.text = r.text.replace('{op}', operatorName(this.world.city)); this.us.menu = r.menu; this.us.input = '';
    if (r.sms) this.receive(operatorName(this.world.city), r.sms, this.us.at + 4);
  }

  /** Multi-tap: a key tapped again within a second picks its next letter; returns the text, or null for a key without letters. */
  private tap(text: string, k: Key, now: number, max: number): string | null {
    const letters = TAPS[k];
    if (!letters) return null;
    if (k === this.tapKey && now - this.tapAt < 1) { this.tapN = (this.tapN + 1) % letters.length; text = text.slice(0, -1); }
    else this.tapN = 0;
    if (text.length < max) text += letters[this.tapN];
    this.tapKey = k; this.tapAt = now;
    return text;
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
