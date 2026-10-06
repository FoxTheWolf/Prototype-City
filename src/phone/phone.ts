import { lookPhone, playerPhone, type Device } from '../sim/device';
import { type World } from '../sim/world';
import { Gps } from './gps';
import { Call, type Sfx } from './call';
import { MAX_ZOOM, takePhoto, type Photo } from './camera';
import { CONVERT, Snake } from './store';
import { type CharGrid } from '../render/grid';
import { codeKind, secretCodes, type CodeKind } from './codes';
import { Radio } from './radio';
import { Wifi } from './wifi';
import { Editor } from './textinput';
import { linkSubs, onRoute, placeAt, route, search, type Place } from './places';
import { Sec } from '../sim/wifi';
import { ussd } from './ussd';
import { smsText } from '../locale/sms';
import en from '../locale/en.json';
import { TRACKS } from '../audio/tracks';
import { DEBUG } from '../debug';
import { debugChat, newRey, openRey, reyKey, stepRey } from './reynard';
import { type FsNode } from '../sim/computer';
import { callsIn, callsOut, contactsIn, contactsOut, DATA, DCIM, fsDirs, fsGet, fsPut, inboxIn, inboxOut, phoneFs, sentIn, sentOut } from '../sim/phonefs';
import { businessName, makerName, operatorName, districtName } from '../locale/names';
import { smsReply, Talk } from '../talk';
import { BIZ_HOURS, formatNumber, lookup } from '../sim/telco';
import { post } from '../sim/bank';
import { jobReply, answerTrace } from '../sim/jobs'; // [HACKING] ver CLAUDE.md > Arquivos de hacking
import { jobSms } from '../locale/jobs'; // [HACKING]
import { hash3 } from '../core/rng';
import { calendar as calendarOf, TIME_SCALE } from '../sim/clock';
import { CABLE, outletPower } from '../sim/outlets';
import { type Furn } from '../sim/interior';
import { Doing, residentsOf, whereIs } from '../sim/citizens';
import { type Post } from '../sim/social';
import { newWire, wireKey } from './wire';
import { newsStories, type Story } from '../locale/news';
import { calKey, newCal } from './calendar';
import { CASES, SHELLS } from './shells';
import { WebApp } from './webapp';

/**
 * The player's phone as an object in hand: out of the pocket or not, powered or not, which screen
 * it shows, the state of its apps and its GPS, and which of its keys was pressed when (they light
 * up and click). No DOM here: main passes keys in, draw.ts and apps.ts read the state. Times are
 * real seconds (performance.now / 1000).
 *
 * Controls, after GTA IV on PC: Up takes it out, P and the middle mouse button take it out and
 * lower it (it keeps its screen and state; on the standby screen the middle button, or Up, opens the
 * dialer instead); with it out, the arrows are the d-pad, Enter or the left mouse button its middle
 * (OK, and the left soft key's action), Backspace or a click of the right mouse button the right
 * soft key (Back), which on the standby screen puts it away. With it out the system
 * cursor is free (hold the right button to look around), a click on a key presses it, and the wheel
 * steps through the menu and scrolls lists; the digit keys are the keypad, + / numpad * its * key, - and . its # key, Space the
 * green call key and Delete the red end key. In the map, 1-4 (or * and #, or the mouse wheel)
 * pick the zoom, and OK opens the list of places (or, with the view moved, centers it again).
 */
export type App = 'map' | 'calls' | 'contacts' | 'tunes' | 'messages' | 'camera' | 'wire' | 'news' | 'snake' | 'calendar' | 'bank' | 'calc' | 'notes' | 'weather' | 'folder' | 'store' | 'settings';
export type Screen = 'off' | 'boot' | 'standby' | 'menu' | 'places' | 'code' | 'contact' | 'ussd' | 'msglist' | 'msg' | 'compose' | 'photos' | 'app' | 'wifikey' | App;
export type CallKind = 'out' | 'failed' | 'in' | 'missed';
export type Key = 'vup' | 'vdown' | 'play' | 'prev' | 'next' | 'lsoft' | 'rsoft' | 'up' | 'down' | 'left' | 'right' | 'ok' | 'send' | 'end' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '*' | '#';

/**
 * The menu: a 4x4 grid of apps, picked with the arrows (or 1-9 and 0 for the first ten). Streetwire,
 * the news, Snake and the Tunes Player come with the phone, as phones then came with a few apps and a
 * game; the apps downloaded from the store sit in their own folder. Calls and Contacts are one app,
 * the Phone, with two tabs (left and right switch them; 2026-10-06, to make room for the music).
 */
export const MENU_COLS = 4;
export const APPS: App[] = ['calls', 'messages', 'camera', 'map', 'tunes', 'wire', 'news', 'weather', 'calendar', 'bank', 'calc', 'notes', 'snake', 'folder', 'store', 'settings'];
/** The apps on the menu that are store apps installed at the factory (their entries in STORE); the bank's came with the account. */
const BUNDLED_APP: Partial<Record<App, string>> = { wire: 'social', news: 'news', snake: 'snake', bank: 'bank', tunes: 'tunes' };
/** Store apps that come installed (for now the same on every phone; later each model will come with its own). */
export const BUNDLED = ['social', 'news', 'snake', 'bank', 'tunes'];
/** (15.9e) Apps that are not in the store: installed by cable once the phone is unlocked (stage 19), and shown in My Apps. */
export const SIDELOAD = ['reynard'];
/** Power on: the hardware check scrolls by fast for BOOT_LOG_S, then the splash screen until BOOT_S. */
export const BOOT_LOG_S = 2.4, BOOT_S = 5.1;
/** The map's zoom levels (local, district, sector, city): metres per screen row. */
export const ZOOM_ROW_M = [8, 18, 36, 96];
/** Inside a building the map shows the floor plan instead, at these scales. */
export const INDOOR_ROW_M = [1, 2, 3.5, 6];
/**
 * The phone's settings: a list of pages; the sound, display and unit pages are rows of options
 * (left/right or OK change them), "about" lists the hardware and the line, "debug" holds what is
 * there for testing the game (the secret codes, to dial them; to go once gameplay replaces it).
 */
export type SetPage = 'root' | 'sound' | 'display' | 'looks' | 'units' | 'wifi' | 'usb' | 'about' | 'debug' | 'people';
export const SET_PAGES: SetPage[] = ['sound', 'display', 'looks', 'units', 'wifi', 'usb', 'about', 'debug', 'people'];
export interface Prefs {
  /** 0 normal, 1 vibrate, 2 silent. */
  profile: number;
  ring: number;
  /** Keypad tones: 0 beep, 1 click only, 2 touch-tones, 3 off. */
  keys: number;
  theme: number;
  /** The standby screen's wallpaper. */
  wall: number;
  /** 0 Fahrenheit, 1 Celsius. */
  temp: number;
  /** 0 metres, 1 feet. */
  dist: number;
}
export const PREF_ROWS: Record<'sound' | 'display' | 'units', (keyof Prefs)[]> = { sound: ['profile', 'ring', 'keys'], display: ['theme', 'wall'], units: ['temp', 'dist'] };
/** How many values each option has (their names are in the locale). */
export const PREF_N: Record<keyof Prefs, number> = { profile: 3, ring: 6, keys: 4, theme: 6, wall: 4, temp: 2, dist: 2 };

/** A distance as the phone shows it, in the units picked in its settings. */
export function fmtDist(m: number, feet: number): string {
  if (feet) { const f = m * 3.281; return f < 5280 ? `${Math.round(f)}ft` : `${(f / 5280).toFixed(1)}mi`; }
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

/** The contacts that come with the line: emergency, the operator's care line and its service menu, directory assistance. */
const CONTACTS: [string, string][] = [['Emergency', '911'], ['Customer Care', '611'], ['Balance & Data', '*100#'], ['Directory', '411']];

const SMS = en.phone.sms;
/** The flash the system takes, in KB. */
const SYSTEM_KB = 40 * 1024;
/**
 * The store's catalog: id, size in KB, price in cents. Small apps download over EDGE; past
 * EDGE_LIMIT_KB they need Wi-Fi (as the 2008 store did with its 10 MB limit over the cell network).
 */
export const STORE: [string, number, number][] = [['snake', 48, 0], ['torch', 12, 0], ['news', 64, 0], ['convert', 36, 99], ['tunes', 14 * 1024, 499], ['atlas', 38 * 1024, 999], ['social', 180, 0], ['bank', 96, 0], ['web', 110, 0], ['reynard', 220, 0]];
/** Kilobytes the bank's app downloads to show the account, and to make a payment. */
const BANK_KB = 6, BANK_PAY_KB = 2;
/** What the bank's app can top the phone's credit up by, in cents. */
export const TOPUPS = [500, 1000, 2000, 5000];
/** Kilobytes the news reader downloads each time. */
const NEWS_KB = 8;
/** Posts a Streetwire page holds. */
const WIRE_POSTS = 40;
export const EDGE_LIMIT_KB = 10 * 1024;
/** Cents as dollars: $1,234.56. */
export const money = (c: number) => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Kilobytes of a weather forecast download. */
const WEATHER_KB = 12;
/** The letters on the keypad, for typing notes by tapping a key again and again (multi-tap). */
export const TAPS: Record<string, string> = { '1': '.,?!-\'1', '2': 'abc2', '3': 'def3', '4': 'ghi4', '5': 'jkl5', '6': 'mno6', '7': 'pqrs7', '8': 'tuv8', '9': 'wxyz9', '0': ' 0' };

export class Phone {
  device: Device;
  /** The maker's name, from the city (the maker of the phone in hand, so it follows the look). */
  get maker(): string { return makerName(this.world.city, this.device.maker); }
  readonly gps = new Gps();
  readonly radio = new Radio();
  /** The web browser from the store (15.5). */
  readonly web: WebApp;
  readonly wifi = new Wifi();
  /** Wi-Fi: the network whose key is being typed (index into world.wifi), and the key. */
  wkey = { ap: -1, key: '' };
  prefs: Prefs = { profile: 0, ring: 0, keys: 0, theme: 0, wall: 0, temp: 0, dist: 0 };
  /** Settings: the page open and the row picked on it. */
  setPage: SetPage = 'root';
  setSel = 0;
  /** A sound the last key asks for (main plays it): a ringtone preview, the buzz of vibrate, or silence. */
  cue: 'ring' | 'vibrate' | 'stop' | null = null;
  /** Vibrating until this time (real seconds), for this long: the phone shakes on screen with the buzz. */
  buzzUntil = 0;
  buzzLen = 0;
  /** The call on the line is coming in (from a payphone): the far end pays and runs it; ringing again at nextRing. */
  callIn = false;
  /** Calls that rang out unanswered since the dialer was last opened. */
  missed = 0;
  /** The game hour last checked for a citizen getting the player's number wrong; a call due at a time, from whom. */
  private oddHour = -1;
  private wrongAt = -1;
  private wrongN = 0;
  /** Citizens who texted the player by mistake (answer them and they say so). */
  private wrongSms = new Set<number>();
  private nextRing = 0;
  /** A call ringing the player's own number (main hands it the payphone's), with the number it comes from. */
  incomingCall: () => [Call, string] | null = () => null;
  /** The service screen a secret code opened. */
  code: CodeKind = 'imei';
  /** A code being dialed by itself (from the debug settings): the keys left, and when the next one goes. */
  private autoQ = '';
  private autoAt = 0;
  /** LCD test: the color shown. */
  lcdStep = 0;
  /** Apps from the store: installed (indexes into STORE), the one picked, the tab (0 catalog, 1 installed). */
  readonly apps: number[] = [];
  ssel = 0;
  stab = 0;
  /** The app from the store that is open (an index into STORE), where it was opened from, and the apps' state. */
  appId = 0;
  appFrom: Screen = 'menu';
  /** The downloads folder: the app picked. */
  fsel = 0;
  /**
   * The Tunes Player (15.9c): the row picked on its list, the song playing (-1: none; the songs that
   * came with it, then the SD card's), whether it plays, its volume (0..1), and a count that goes up
   * when a song is to start from its beginning (main plays it). Main fills in where the song is.
   */
  tn = { sel: 0, cur: -1, playing: false, vol: 0.7, gen: 0, at: 0, len: 0, shuffle: false };
  /** The songs played before, newest last (shuffle's "previous" goes back through them). */
  private tnHist: number[] = [];
  /** The SD card's songs: the player's own, from music/ beside the game (main reads the folder). */
  sd: { name: string; size: number; secs?: number }[] = [];
  /** The music's spectrum now, 16 bands 0..1 (main fills it from the player each frame), for the visualizer. */
  spec = new Float32Array(26);
  /** The earphones in (15.9d): the music for the player alone; else it comes out of the phone's speaker. */
  earphones = false;
  /** The bag's thing worn as earphones ('headphones' or 'hands_free'). */
  earGood = '';
  /** Reynard, the encrypted messenger (15.9e): registered or not, the key, the chats. */
  rey = newRey();
  /**
   * The body: the shell (one of SHELLS) and the case (one of CASES, 0 none), and those the player
   * has. The phone comes in a shell of its own; others are got later (for now, from the debug page).
   */
  look: number;
  case = 0;
  looks: number[];
  cases: number[] = [0];
  readonly snake = new Snake();
  conv = { pair: 0, input: '' };
  /** The store: a note on the last try (no Wi-Fi, no credit, no storage). */
  storeNote = '';
  newsAt = -1e9;
  /** The news app: the story picked on the front page, and the one open (null: the front page). */
  newsSel = 0;
  newsOpen: Story | null = null;
  private newsScroll = 0;
  /** Streetwire: the posts as last downloaded (newest last), when, and the newest post id seen then. */
  wire: Post[] = [];
  wireAt = -1e9;
  /** Streetwire's pages: the feed, a post, a profile; what was liked. */
  readonly wst = newWire();
  /** The calendar: the month and day in view, the page, the player's reminders. */
  readonly cal = newCal();
  /** Renders the city from a point (main hands it): the photos on Streetwire's posts (false while the picture is not there yet). */
  shoot: ((g: CharGrid, x: number, y: number, yaw: number, eye?: number, pitch?: number) => boolean) | null = null;
  private wireId = -1;
  /**
   * The bank's app (it came installed by the bank, on the menu): the page open, the row picked, the
   * scroll of the statement, whether the account has been downloaded since it was opened, and a note
   * on the last top-up (done, no funds, no data connection).
   */
  bk = { view: 'home' as 'home' | 'stmt' | 'topup' | 'branch', sel: 0, ok: false, note: '' };
  /** The player's bank, by its name. */
  get bankName(): string { const c = this.world.city; return businessName(c, c.banks[this.world.bank.bank].hq); }
  /** Weather: game time the forecast was last downloaded (-1: never); it keeps an hour. */
  wxAt = -1e9;
  constructor(private world: World) {
    this.device = playerPhone(world.seed);
    this.look = this.device.look;
    this.looks = [this.look];
    this.web = new WebApp(world, this.radio, () => this.online());
    for (const id of BUNDLED) this.apps.push(STORE.findIndex((a) => a[0] === id));
    this.debugRey();
    linkSubs(world.city, world.power.subs); // the Maps can find a job's GRIDLINK substation

    this.fs = phoneFs(this.device, world.seed, world.time, en.phone.apps.set.values.ring, [...new Set([...APPS.filter((a) => a !== 'folder' && a !== 'tunes'), 'contacts', ...BUNDLED])]);
  }
  out = false;
  /** 0 in the pocket .. 1 held up; eases toward out. */
  raise = 0;
  /** 0 .. 1: peeking out of the pocket for a notification, until peekUntil. */
  peek = 0;
  peekUntil = 0;
  /** Alt held (2026-10-06): main sets `reach`; `handy` 0..1 brings the top of the phone out of the pocket, its music keys in reach. */
  reach = false;
  handy = 0;
  /** Lowered while talking on it (14.7): held at the ear, the conversation at the bottom of the screen. */
  atEar = false;
  /** 0 .. 1: held up whole, the keypad in sight (since 2026-10-06 always, while it is out). */
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
  /**
   * Maps' search: the words typed, the words last searched, the places found (nearest first; null
   * before a search), the one picked (-1: the field), and why nothing came back ('' or 'offline').
   */
  readonly findEd = new Editor(24, true);
  findQ = '';
  places: Place[] | null = null;
  psel = -1;
  findNote = '';
  /** A place shown on the map with its card (null: none), and where the position was then (the view stays on the place as the GPS moves). */
  pin: Place | null = null;
  private pinHere = [0, 0];
  /**
   * The walking route: to where, its corners (empty until it comes back from the server), the
   * state, whether it was asked for, and the seconds off it (a while off it, it is calculated again).
   */
  nav: { to: Place; R: number[]; state: 'routing' | 'go' | 'none' | 'arrived'; asked: boolean; off: number } | null = null;
  /** Calls: the number being dialled, the call under way (or just ended). */
  dial = '';
  call: Call | null = null;
  /**
   * The call log, newest first (it keeps 20): the number, how the call went (made and answered,
   * made but not completed, received, missed) and the game time. The dialer lists it; the arrows
   * pick one and the green key (or OK) calls it back.
   */
  readonly log: { number: string; kind: CallKind; at: number }[] = [];
  lsel = 0;
  /** Sounds the phone asks main to play (the call's tones and voices). */
  readonly sfx: Sfx[] = [];
  /** The contacts on the SIM (it holds 250): a few come with the line, the rest are added by hand. */
  readonly contacts: { name: string; number: string }[] = [];
  csel = 0;
  /** The contact being written: its name (typed by multi-tap), its number, and which of them is being typed. */
  edit = { name: '', number: '', step: 0 };
  /** The text fields, typed in Abc, T9 or 123 (see textinput.ts): notes, a text message, a contact's name. */
  readonly noteEd = new Editor(400);
  readonly smsEd = new Editor(160);
  readonly nameEd = new Editor(20, true);
  /** Text messages received (from, text, game time, read) and sent (to, text, game time). */
  readonly inbox: { from: string; text: string; at: number; read: boolean }[] = [];
  readonly sent: { to: string; text: string; at: number }[] = [];
  /** Messages: the box open (0 inbox, 1 sent), the one picked, the message being written. */
  box = 0;
  msel = 0;
  draft = { to: '', text: '', step: 0 };
  /** Messages on their way to the phone: from, text, and when they arrive (real seconds). */
  private incoming: { from: string; text: string; at: number }[] = [];
  /** The camera: what it sees (main hands it the player's view), the light there, the photos, the one shown, the last shot. */
  render: ((g: CharGrid, k?: number) => boolean) | null = null;
  /** A shot taken whose picture is not there yet (on the GPU it comes back a frame later): tried every frame. */
  private shotDue: (() => Photo | null) | null = null;
  /** The camera draws in blocks (two pixels a cell); the characters version was tried and dropped. */
  readonly camBlocks = true;
  /** The camera's zoom (1 .. MAX_ZOOM) and whether its flash fires. */
  camZoom = 1;
  camFlash = true;
  light = 1;
  readonly photos: Photo[] = [];
  phsel = 0;
  shotAt = -9;
  /**
   * The battery (13.9), 0..1: it runs down with the game clock while the phone is on, faster with
   * the screen out, the GPS, a call, data moving or the Wi-Fi on; flat, the phone switches itself
   * off and stays off. It charges plugged into a wall outlet (13.9c: F at a café's, a bar's, a
   * cybercafé's... outlet), on or off, while the player stays within the cable's reach. `charging`
   * while it does; `low` the last warning given (1 at 15%, 2 at 5%).
   */
  batt = 0.8;
  charging = false;
  /** The outlet it is plugged into (13.9c), with the building and the floor; `pulled` once the cable came out by walking off. */
  plug: { f: Furn; b: number; floor: number } | null = null;
  pulled = false;
  low = 0;
  /** Switched on before (the line's numbers are in its contacts): a boot after a flat battery does not add them again. */
  private everOn = false;
  /** Operator notices already sent: welcome, low data, no data. */
  private told = { welcome: false, low: false, out: false };
  /** A USSD session: the code, the answers so far, what came back, what is being typed, when it was asked. */
  us = { code: '', path: [] as string[], text: '', menu: false, input: '', at: 0 };
  /** Calculator: the number on the display, the one kept, the operation waiting, and whether the next digit starts a new number. */
  calc = { cur: '0', acc: 0, op: '', fresh: true };
  /** Notes: the text (typed through noteEd). */
  note = '';
  /** Settings: the scroll of the list. */
  scroll = 0;
  /** (Debug) the residents of the building in or next to which the settings' people page was opened. */
  people: { building: number; ids: number[] } = { building: -1, ids: [] };
  /** When each key was last pressed, for its light. */
  readonly pressed = new Map<Key, number>();

  buzz(now: number, secs: number) { this.buzzUntil = now + secs; this.buzzLen = secs; }

  /** Out of the pocket or back in; it boots the first time. Returns what to play. */
  toggle(now: number): 'out' | 'in' | 'boot' {
    this.out = !this.out;
    if (!this.out) return 'in';
    if (this.screen === 'off') {
      // flat: it stays dark in the hand
      if (this.batt <= 0.01) return 'out';
      this.screen = 'boot'; this.since = now + 0.35;
      // the numbers that come with the line
      if (!this.everOn) for (const [name, number] of CONTACTS) this.contacts.push({ name, number });
      this.everOn = true;
      return 'boot';
    }
    this.since = now; // the backlight wakes up: the screen draws in again
    return 'out';
  }

  /**
   * The phone's file system (sim/phonefs.ts): firmware, system and the user's data as files. The data
   * the screens use (contacts, call log, texts, notes, photos) is kept in step with its files: a file
   * changed from outside (the notebook, over the cable) is read back in; a change on the phone is
   * written out. `fsSaid` holds what each file last said, to tell which side changed.
   */
  fs: FsNode;
  private fsSaid: Record<string, string> = {};
  private fsAt = -1;
  private photoN = 0;
  /** The cable to the notebook: wanted (the settings), and whether the notebook has it mounted (main sets it). */
  usb = false;
  usbLinked = false;
  private syncFs(now: number) {
    if (now - this.fsAt < 0.5) return;
    this.fsAt = now;
    const files: [string, () => string, (s: string) => void][] = [
      [DATA.contacts, () => contactsOut(this.contacts), (t) => this.contacts.splice(0, this.contacts.length, ...contactsIn(t).slice(0, 250))],
      [DATA.calls, () => callsOut(this.log), (t) => this.log.splice(0, this.log.length, ...callsIn(t))],
      [DATA.inbox, () => inboxOut(this.inbox), (t) => this.inbox.splice(0, this.inbox.length, ...inboxIn(t))],
      [DATA.sent, () => sentOut(this.sent), (t) => this.sent.splice(0, this.sent.length, ...sentIn(t))],
      [DATA.notes, () => this.note, (t) => { this.note = t.slice(0, 400); this.noteEd.set(this.note); }],
    ];
    for (const [path, out, read] of files) {
      const f = fsGet(this.fs, path), said = this.fsSaid[path];
      if (f && !f.dir && said !== undefined && (f.data ?? '') !== said) { read(f.data ?? ''); this.fsSaid[path] = f.data ?? ''; continue; }
      const text = out();
      if (text !== said || !f) { fsPut(this.fs, path, text, 'user', this.world.time); this.fsSaid[path] = text; }
    }
    // the photos: each a file in the camera's folder; one deleted there is gone from the phone, a new one gets its file
    const dir = fsDirs(this.fs, DCIM, 'user', this.world.time);
    for (let k = this.photos.length - 1; k >= 0; k--) {
      const ph = this.photos[k];
      if (!ph.name) { ph.name = `IMG_${String(++this.photoN).padStart(4, '0')}.JPG`; fsPut(this.fs, `${DCIM}/${ph.name}`, ph.kb * 1024, 'user', ph.at); }
      else if (!dir.kids!.has(ph.name)) this.photos.splice(k, 1);
    }
  }
  /**
   * What the save keeps of the phone (F.6): its files (the contacts, calls, texts and notes live
   * there), the photos, the apps, the settings and looks, the reminders. Plain data (structured clone).
   */
  /** (Debug, DEBUG.reynard) Reynard installed and registered, with a test chat: until the jailbreak (stage 19) installs it. */
  private debugRey() {
    if (!DEBUG.reynard) return;
    const i = STORE.findIndex((a) => a[0] === 'reynard');
    if (!this.apps.includes(i)) this.apps.push(i);
    const R = this.rey;
    if (R.reg === 'none' && !R.chats.length) { R.reg = 'ok'; R.mine = '738120946352817406938271650493'; R.chats.push(debugChat(this.world)); }
  }
  /** A new SIM in the phone (13.6): it registers again, and the new operator says hello. */
  newSim() { this.told.welcome = false; this.radio.state = 'off'; }

  snapshot() {
    return {
      fs: this.fs, photos: this.photos, photoN: this.photoN, apps: [...this.apps], prefs: { ...this.prefs }, look: this.look, case: this.case,
      looks: [...this.looks], cases: [...this.cases], reminders: this.cal.reminders, wifiOn: this.wifi.on, told: { ...this.told },
      // already switched on once (the line's numbers are in its contacts): it comes back on, in the pocket
      booted: this.screen !== 'off' || this.everOn, batt: this.batt,
      tunes: { sel: this.tn.sel, cur: this.tn.cur, vol: this.tn.vol, shuffle: this.tn.shuffle }, earphones: this.earphones, earGood: this.earGood, rey: this.rey,
    };
  }
  /** Back to a saved phone: in the pocket and off; the screens' data is read back from the files at the next sync. */
  restore(d: ReturnType<Phone['snapshot']>) {
    this.fs = d.fs;
    this.fsSaid = {};
    for (const path of Object.values(DATA)) this.fsSaid[path] = '\u0000';
    this.photos.splice(0, this.photos.length, ...d.photos); this.photoN = d.photoN;
    this.apps.splice(0, this.apps.length, ...d.apps);
    this.prefs = { ...this.prefs, ...d.prefs };
    this.look = d.look; this.case = d.case; this.looks = d.looks; this.cases = d.cases;
    this.cal.reminders = d.reminders; this.wifi.on = d.wifiOn; this.told = d.told;
    this.everOn = d.booted;
    if (d.batt !== undefined) this.batt = d.batt;
    if (d.tunes) this.tn = { ...this.tn, ...d.tunes, playing: false };
    this.earphones = !!d.earphones; this.earGood = d.earGood ?? '';
    if (d.rey) this.rey = d.rey;
    this.debugRey();
    if (d.booted && this.batt > 0.01) this.screen = 'standby';
  }
  /**
   * The battery, a frame of dt real seconds (game hours: one full charge lasts ~40 h idle, ~8 h with
   * the screen out, ~3 h on the map with the GPS); charging takes ~1.5 h from flat.
   */
  private power(dt: number) {
    const w = this.world, p = w.player, h = (dt * TIME_SCALE) / 3600;
    const pl = this.plug;
    if (pl && (p.inside !== pl.b || p.floor !== pl.floor || Math.hypot(pl.f.x - p.x, pl.f.y - p.y) > CABLE)) { this.plug = null; this.pulled = true; }
    this.charging = !!this.plug && outletPower(w);
    if (this.charging) { this.batt = Math.min(1, this.batt + h / 1.5); if (this.batt > 0.2) this.low = 0; return; }
    if (this.screen === 'off') return;
    const call = this.call && this.call.state !== 'ended', data = this.radio.job && this.radio.job.state !== 'done';
    const rate = 1 / 40 + (this.out ? 1 / 8 : 0) + (this.gps.state !== 'off' ? 1 / 5 : 0) + (call ? 1 / 6 : 0) + (data ? 1 / 10 : 0) + (this.wifi.on ? 1 / 40 : 0) + (this.tn.playing ? 1 / 20 : 0);
    this.batt = Math.max(0, this.batt - h * rate);
    // low: a warning beep at 15% and 5%; flat, it switches off
    const lv = this.batt < 0.05 ? 2 : this.batt < 0.15 ? 1 : 0;
    if (lv > this.low) { this.low = lv; this.sfx.push(['beep']); this.buzz(performance.now() / 1000, 0.5); }
    if (this.batt <= 0) { this.screen = 'off'; this.tn.playing = false; this.sfx.push(['stop']); }
  }

  /** The shot taken, into the photos once its picture is there. */
  private develop() {
    const ph = this.shotDue?.();
    if (ph) { this.photos.unshift(ph); this.shotDue = null; }
  }

  update(dt: number, now: number) {
    this.develop();
    this.power(dt);
    this.syncFs(now);
    // in the pocket it still comes up for a call ringing in (all the way, while it rings) and peeks
    // out a little for a text or a reminder (its top row in sight for a few seconds)
    const ringing = this.callIn && this.call?.state === 'ringing';
    this.raise += ((this.out || ringing ? (this.atEar ? 0.35 : 1) : 0) - this.raise) * Math.min(1, dt * 14);
    this.peek += ((!this.out && !ringing && now < this.peekUntil ? 1 : 0) - this.peek) * Math.min(1, dt * 8);
    this.handy += ((this.reach && !this.out && !ringing ? 1 : 0) - this.handy) * Math.min(1, dt * 12);
    // (2026-10-06) the phone is held up whole whenever it is out: no raising it to type
    this.lift += ((this.out ? 1 : 0) - this.lift) * Math.min(1, dt * 10);
    // reminders whose time has come ring, with a note in the inbox
    for (const r of this.cal.reminders) if (!r.done && r.at <= this.world.time) {
      r.done = true;
      this.incoming.push({ from: en.phone.cal.from, text: en.phone.cal.alarm.replace('{text}', r.text), at: now });
      if (this.prefs.profile === 0) this.cue = 'ring'; else if (this.prefs.profile === 1) this.buzz(now, 1.6);
    }
    if (this.screen === 'boot' && now - this.since > BOOT_S) this.open('standby', now);
    // the GPS runs while the map is open, in the hand or not
    this.gps.update(this.world, this.screen === 'map' || this.screen === 'places' || (this.screen === 'code' && this.code === 'gps'), now, dt);
    this.wifi.update(this.world, this.screen !== 'off', now);
    this.radio.wifiKbps = this.wifi.kbps();
    this.radio.update(this.world, this.screen !== 'off', now, dt);
    stepRey(this, this.world);
    // the webmail's codes (15.4), texted to this line
    for (const m of this.world.mail.sms.splice(0)) this.receive(m.from, m.text, now + 3);
    // text messages arriving; the operator's notices
    for (let i = this.incoming.length - 1; i >= 0; i--) {
      const m = this.incoming[i];
      if (now < m.at || this.radio.state !== 'service') continue;
      this.incoming.splice(i, 1);
      this.inbox.unshift({ from: m.from, text: m.text, at: this.world.time, read: false });
      if (!this.out) this.peekUntil = now + 4;
      this.sfx.push(['sms']);
      if (this.prefs.profile === 1) this.buzz(now, 0.8);
    }
    if (this.radio.state === 'service') {
      const A = this.world.telco.player, op = operatorName(this.world.city, this.world.telco.player.op ?? 0);
      if (!this.told.welcome) { this.told.welcome = true; this.receive(op, SMS.welcome.replace('{op}', op), now + 4); }
      if (A.dataKB < 500 && !this.told.low) { this.told.low = true; this.receive(op, SMS.lowData, now + 2); }
      if (A.dataKB < 1 && !this.told.out) { this.told.out = true; this.receive(op, SMS.noData, now + 2); }
      if (A.dataKB > 500) this.told.low = this.told.out = false;
    }
    // [HACKING] the fixer's texts: the offer when its time comes, the reply to YES/NO, the result
    for (const j of this.world.jobs.jobs) {
      if (!j.sent.offer && j.state !== 'pending' && this.world.time >= j.offerAt) { j.sent.offer = true; this.receive(j.from, jobSms(this.world, j, 'offer'), now + 4); }
      if (!j.sent.ack && (j.state === 'active' || j.state === 'declined')) { j.sent.ack = true; this.receive(j.from, jobSms(this.world, j, j.state === 'active' ? 'confirm' : 'declined'), now + 4); }
      if (!j.sent.result && (j.state === 'done' || j.state === 'failed')) { j.sent.result = true; this.receive(j.from, jobSms(this.world, j, j.state === 'done' ? 'paid' : 'failed'), now + 6); }
      if (j.kind === 'trace' && j.nudge) { j.nudge = false; this.receive(j.from, jobSms(this.world, j, 'wrong'), now + 6); } // a wrong answer: look again
    }
    // now and then a citizen gets the player's number wrong: a call, or a text (one hour in a few)
    if (this.screen !== 'off' && this.radio.state === 'service') {
      const hr = Math.floor(this.world.time / 3600), h = (q: number) => hash3(this.world.seed, hr, q);
      if (hr !== this.oddHour) {
        if (this.oddHour >= 0) {
          if (h(0x11c) < 0.08) this.wrongAt = now + h(0x11e) * 90;
          // most of the texts nobody asked for are a shop's advertising (from its own number); the rest a wrong number
          const B = this.world.city.businesses, ad = h(0x11d) < 0.12 && h(0x123) < 0.75 && B.length > 0;
          if (ad) { const k = Math.floor(h(0x124) * B.length); this.receive(this.world.telco.bizNum[k], smsText(this.world, 'promo', -1, h(0x120), k), now + 5 + h(0x121) * 80); }
          const i = !ad && h(0x11d) < 0.12 ? this.somebody(h(0x11f)) : -1;
          if (i >= 0) { this.wrongSms.add(i); this.receive(this.world.pop.mobile[i], smsText(this.world, 'wrong', i, h(0x120)), now + 5 + h(0x121) * 80); }
        }
        this.oddHour = hr;
      }
      if (this.wrongAt >= 0 && now >= this.wrongAt && !this.call) {
        this.wrongAt = -1;
        const i = this.somebody(h(0x122 + ++this.wrongN));
        if (i >= 0) { this.call = Call.from(this.world, i, now); this.callIn = true; this.dial = this.world.pop.mobile[i]; this.nextRing = now; this.open('calls', now); }
      }
    }
    // the call: its tones and voices; ended, it is paid for and, a moment later, put away
    // a call to the player's own number: it rings here (or cannot get through)
    const ic = this.incomingCall();
    if (ic && ic[0].state === 'ringing' && this.call !== ic[0]) {
      if (this.screen === 'off' || this.radio.state !== 'service') ic[0].refuse(now, en.phone.apps.unreachable, this.sfx);
      else if (this.call) ic[0].refuse(now, en.phone.apps.busy, this.sfx);
      else { this.call = ic[0]; this.callIn = true; this.dial = ic[1]; this.nextRing = now; this.open('calls', now); }
    }
    const c = this.call;
    if (c && this.callIn) {
      // ringing as the profile says: the ringtone, the buzz, or nothing; it stops once answered or gone
      if (c.state === 'ringing' && now >= this.nextRing) {
        this.nextRing = now + 4;
        if (this.prefs.profile === 0) this.cue = 'ring';
        else if (this.prefs.profile === 1) { this.cue = 'vibrate'; this.buzz(now, 1.6); }
      }
      if (c.state !== 'ringing' && this.nextRing > 0) { this.nextRing = 0; this.cue = 'stop'; this.buzzUntil = 0; }
      // a citizen's call runs here (their voice, not their ringback)
      if (c.caller >= 0) c.update(now, c.state === 'talk' ? this.sfx : []);
      if (c.state === 'ended' && now > c.endAt + 2.5) {
        // answered, or missed (counted on the standby screen and the dialer until it is opened)
        const answered = c.connectAt >= 0;
        if (!answered) this.missed++;
        this.logCall(this.dial, answered ? 'in' : 'missed');
        this.call = null; this.callIn = false; this.dial = '';
      }
    } else if (c) {
      c.update(now, this.sfx);
      if (c.state === 'ended' && now > c.endAt + 2.5) {
        this.world.telco.player.credit -= c.cost();
        this.logCall(c.number, c.connectAt >= 0 ? 'out' : 'failed');
        this.dial = '';
        for (const [name, num] of c.listings) this.receive('411', `${name} ${formatNumber(this.world.telco, num)}`, now + 3);
        this.call = null;
      }
    }
    const J = this.radio.job;
    if (J?.what === 'weather' && J.state === 'done') { this.wxAt = this.world.time; this.radio.job = null; }
    // an app finished downloading: installed (and paid for on the operator's bill)
    if (J?.what.startsWith('app:') && J.state === 'done') {
      const i = +J.what.slice(4);
      if (!this.apps.includes(i)) { this.apps.push(i); this.world.telco.player.credit -= STORE[i][2]; this.sfx.push(['sent']); }
      this.radio.job = null;
    }
    if (J?.what === 'news' && J.state === 'done') { this.newsAt = this.world.time; this.radio.job = null; }
    if (J?.what === 'bank' && J.state === 'done') { this.bk.ok = true; this.radio.job = null; }
    // a top-up from the bank: off the account, onto the line's credit, and the operator says so
    if (J?.what.startsWith('banktop:') && J.state === 'done') {
      const c = +J.what.slice(8), op = operatorName(this.world.city, this.world.telco.player.op ?? 0);
      this.radio.job = null;
      if (post(this.world.bank, this.world.time, 'topup', -c, 0)) {
        this.world.telco.player.credit += c; this.bk.note = 'done'; this.sfx.push(['sent']);
        this.receive(op, SMS.topup.replace('{amount}', money(c)).replace('{credit}', money(this.world.telco.player.credit)), now + 3);
      } else this.bk.note = 'funds';
    }
    if (J?.what === 'social' && J.state === 'done') {
      this.wire = this.world.feed.posts.slice(-WIRE_POSTS); this.wireAt = this.world.time; this.wireId = this.world.feed.next - 1; this.radio.job = null; this.scroll = 0;
      if (this.wst.view === 'feed') this.wst.sel = 0;
    }
    // Maps: the search's answer, the route's, and the walk along it
    if (J?.what === 'find' && J.state === 'done') {
      const [x, y] = this.here();
      this.places = search(this.world.city, this.findQ, x, y); this.psel = this.places.length ? 0 : -1; this.radio.job = null;
    }
    const N = this.nav;
    if (N) this.navigate(N, J, now, dt);
    if (this.pin !== null) { const [x, y] = this.here(); this.panX += this.pinHere[0] - x; this.panY += this.pinHere[1] - y; this.pinHere = [x, y]; }
    if (this.screen === 'app' && STORE[this.appId][0] === 'snake' && this.snake.update(now)) this.sfx.push(['beep']);
    // with the weather open, the forecast downloads over EDGE when it is older than an hour (and
    // again once the signal is back after a failed try; not with the bundle used up)
    const busy = this.radio.job === J && J?.what === 'weather' && (J.state === 'connecting' || J.state === 'loading' || J.state === 'nodata');
    if (this.screen === 'weather' && !busy && this.world.time - this.wxAt > 3600 && this.online()) this.radio.fetch('weather', WEATHER_KB, now);
  }

  open(s: Screen, now: number) {
    if (this.screen === 'settings' && s !== 'settings') this.cue = 'stop';
    // leaving the dialer clears what was being dialed; put away and taken out again, it stays
    if (this.screen === 'calls' && s !== 'calls' && !this.call) this.dial = '';
    if (s === 'calls' && this.screen !== 'calls') this.lsel = 0;
    this.screen = s; this.since = now; this.scroll = 0;
    if (s === 'standby') this.nsel = -1;
    if (s === 'settings') { this.setPage = 'root'; this.setSel = 0; }
    if (s === 'calls' && !this.call) this.missed = 0;
    if (s === 'compose') this.smsEd.set(this.draft.text);
    if (s === 'contact') this.nameEd.set(this.edit.name);
    if (s === 'map') { this.panX = this.panY = 0; this.pin = null; }
    if (s === 'calendar') { const c = calendarOf(this.world.time); this.cal.y = c.year; this.cal.m = c.month; this.cal.d = c.day; this.cal.view = 'month'; }
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
    const g = this.gps, c = this.world.city, N = this.nav;
    if (!g.known) return [c.cx, c.cy];
    // on a route, a position near it is put on it (as a navigator holds a car to the road)
    if (N?.state === 'go' && g.state === 'fix') { const o = onRoute(N.R, g.x, g.y); if (o.off < Math.max(20, g.acc)) return [o.px, o.py]; }
    return [g.x, g.y];
  }

  /**
   * The route: asked for once there is a position and a connection (the server works it out, so it
   * costs data and takes a moment), then followed: arrived near the door; a while off it, again.
   */
  private navigate(N: NonNullable<Phone['nav']>, J: Phone['radio']['job'], now: number, dt: number) {
    const g = this.gps, city = this.world.city, [bx, by] = placeAt(city, N.to);
    if (N.state === 'routing') {
      if (J?.what === 'route' && J.state === 'done') {
        this.radio.job = null;
        N.R = route(city, g.x, g.y, bx, by); N.state = N.R.length ? 'go' : 'none'; N.off = 0;
        this.sfx.push([N.state === 'go' ? 'sent' : 'fail']);
      } else if (J?.what === 'route' && (J.state === 'nosignal' || J.state === 'nodata')) { this.radio.job = null; N.asked = false; }
      else if (!N.asked && g.known && this.online() && (J?.what !== 'route')) {
        N.asked = true;
        this.radio.fetch('route', 3 + Math.hypot(bx - g.x, by - g.y) / 250, now);
      }
      return;
    }
    if (N.state !== 'go' || g.state !== 'fix') return;
    if (Math.hypot(bx - g.x, by - g.y) < Math.max(15, g.acc * 0.6)) { N.state = 'arrived'; this.sfx.push(['beep']); this.buzz(now, 0.5); return; }
    const o = onRoute(N.R, g.x, g.y);
    N.off = o.off > Math.max(35, g.acc * 1.5) ? N.off + dt : 0;
    if (N.off > 6) { N.state = 'routing'; N.asked = false; N.R = []; }
  }

  /** Maps' search page, as it was left. */
  private openFind(now: number) {
    this.screen = 'places'; this.since = now;
    if (!this.places?.length) this.psel = -1;
  }

  /** Show a place on the map with its card, at a zoom that keeps the position in sight when it is near. */
  private showPlace(p: Place, now: number) {
    const [x, y] = this.here(), [px, py] = placeAt(this.world.city, p);
    this.pin = p; this.screen = 'map'; this.since = now; this.pinHere = [x, y];
    this.panX = px - x; this.panY = py - y;
    const d = Math.hypot(this.panX, this.panY);
    this.zoom = d < 150 ? 0 : d < 350 ? 1 : d < 700 ? 2 : 3;
  }

  /** Call a place found (a landmark has no number). */
  private callPlace(p: Place, now: number): boolean {
    if (p < 0) return false;
    this.open('calls', now); this.place(this.world.telco.bizNum[p], now);
    return true;
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
    // the music keys on top (2026-10-06): the volume up and down, previous, play/pause and next, from any screen
    if (k === 'vup' || k === 'vdown' || k === 'play' || k === 'prev' || k === 'next') return s !== 'boot' && this.sideKey(k);
    switch (s) {
      case 'boot':
        if (k === 'rsoft') { this.out = false; return 'away'; }
        return false;
      case 'standby':
        // (2026-10-06) the arrows step through what is waiting (notices); OK opens the one picked, or the menu
        if (k === 'up' || k === 'down') {
          const n = this.notices().length, s = Math.max(-1, Math.min(n - 1, this.nsel + (k === 'up' ? -1 : 1)));
          if (s === this.nsel) return false;
          this.nsel = s; return true;
        }
        if (k === 'ok' && this.nsel >= 0) { this.openNotice(this.notices()[this.nsel], now); return true; }
        if (k === 'ok' || k === 'lsoft') { this.open('menu', now); return true; }
        // * clears what is waiting (missed calls, unread texts)
        if (k === '*' && (this.missed || this.inbox.some((m) => !m.read))) { this.clearNotices(); this.nsel = -1; return true; }
        // a number typed on the standby screen opens the dialer with it, as phones did
        if (/^[0-9*#]$/.test(k)) { this.dial = k; this.call = null; this.open('calls', now); return true; }
        if (k === 'rsoft') { this.out = false; return 'away'; }
        return false;
      case 'menu': {
        if (k === 'left' || k === 'right') { this.sel = (this.sel + (k === 'left' ? -1 : 1) + APPS.length) % APPS.length; return true; }
        if (k === 'up' || k === 'down') { this.sel = (this.sel + (k === 'up' ? -MENU_COLS : MENU_COLS) + APPS.length) % APPS.length; return true; }
        if (/^[0-9]$/.test(k)) { this.sel = k === '0' ? 9 : +k - 1; this.launch(APPS[this.sel], now); return true; }
        if (k === 'ok' || k === 'lsoft') { this.launch(APPS[this.sel], now); return true; }
        if (k === 'rsoft') { this.open('standby', now); return true; }
        return false;
      }
      case 'map':
        // the d-pad moves the view a quarter of a screen; OK centers it on the position again
        if (k === 'left' || k === 'right') { this.panX += (k === 'left' ? -1 : 1) * viewW / 4; this.since = now; return this.clampPan(); }
        if (k === 'up' || k === 'down') { this.panY += (k === 'up' ? -1 : 1) * viewH / 4; this.since = now; return this.clampPan(); }
        if (k === '1' || k === '2' || k === '3' || k === '4') return this.setZoom(+k - 1, now);
        if (k === '*' || k === '#') return this.setZoom(this.zoom + (k === '*' ? -1 : 1), now);
        if (this.pin !== null) {
          // a place's card: the middle button (or Route) walks there, the green key calls it, Back goes back to the list
          const p = this.pin;
          if (k === 'ok' || k === 'lsoft') { this.nav = { to: p, R: [], state: 'routing', asked: false, off: 0 }; this.pin = null; this.panX = this.panY = 0; this.zoom = 0; this.since = now; return true; }
          if (k === 'send') return this.callPlace(p, now);
          if (k === 'rsoft') { this.pin = null; this.openFind(now); return true; }
          return false;
        }
        if (k === 'ok') {
          if (this.panX || this.panY) { this.panX = this.panY = 0; this.since = now; return true; }
          this.openFind(now);
          return true;
        }
        // the left soft key: End the route under way, or Search
        if (k === 'lsoft') { if (this.nav) this.nav = null; else this.openFind(now); return true; }
        if (k === 'send' && this.nav) return this.callPlace(this.nav.to, now);
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
      case 'places': {
        // the search field on top (psel -1), the places found under it
        const n = this.places?.length ?? 0;
        if (k === 'up' || k === 'down') { const s = Math.max(-1, Math.min(n - 1, this.psel + (k === 'up' ? -1 : 1))); if (s === this.psel) return false; this.psel = s; return true; }
        if (this.psel >= 0) {
          const p = this.places![this.psel];
          if (k === 'ok' || k === 'lsoft') { this.showPlace(p, now); return true; }
          if (k === 'send') return this.callPlace(p, now);
          if (k === 'rsoft') { this.psel = -1; return true; }
          return false;
        }
        if (k === 'rsoft') { if (!this.findEd.del()) { this.screen = 'map'; this.since = now; } return true; }
        if (k === 'ok' || k === 'lsoft' || k === 'send') {
          // the words go to the server over EDGE (or the Wi-Fi), and the places come back
          const q = this.findEd.value().trim();
          if (!q) return false;
          const J = this.radio.job;
          if (J?.what === 'find' && (J.state === 'connecting' || J.state === 'loading')) return true;
          this.findQ = q; this.places = null; this.since = now;
          if (!this.online()) { this.findNote = 'offline'; this.sfx.push(['fail']); return true; }
          this.findNote = ''; this.radio.fetch('find', 2 + q.length * 0.05 + 1.5, now);
          return true;
        }
        return this.findEd.key(k, now);
      }
      case 'calls':
        if (this.call && this.callIn && this.call.state === 'ringing') {
          // answer with the green key, OK or Answer; Reject (the right soft key) hangs up
          if (k === 'send' || k === 'ok' || k === 'lsoft') { this.call.answerHere(now); return true; }
          if (k === 'rsoft') { this.call.hangUp(now); return true; }
          return false;
        }
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
        // with nothing dialed, the arrows pick a call in the log and the green key (or OK) calls it back
        if (!this.dial && this.log.length && (k === 'up' || k === 'down')) { this.lsel = Math.max(0, Math.min(this.log.length - 1, this.lsel + (k === 'up' ? -1 : 1))); return true; }
        // the Phone's tabs: right goes to Contacts
        if (!this.dial && k === 'right') { this.open('contacts', now); return true; }
        if (!this.dial && this.log.length && (k === 'send' || k === 'ok')) { this.place(this.log[Math.min(this.lsel, this.log.length - 1)].number, now); return true; }
        if (k === 'lsoft' && this.dial) { this.edit = { name: '', number: this.dial, step: 0 }; this.open('contact', now); return true; }
        if (k === 'rsoft') { if (this.dial) this.dial = this.dial.slice(0, -1); else this.open('menu', now); return true; }
        return false;
      case 'calc':
        return this.calcKey(k, now);
      case 'notes': {
        // the right soft key deletes, and goes back once there is nothing left
        if (k === 'rsoft') { if (!this.noteEd.del()) this.open('menu', now); this.note = this.noteEd.value(); return true; }
        const ok = this.noteEd.key(k, now);
        this.note = this.noteEd.value();
        return ok;
      }
      case 'contacts': {
        const n = this.contacts.length;
        if (n && (k === 'up' || k === 'down')) { this.csel = (this.csel + (k === 'up' ? -1 : 1) + n) % n; return true; }
        // the Phone's tabs: left goes back to Calls
        if (k === 'left') { this.dial = ''; this.open('calls', now); return true; }
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
      case 'camera':
        // OK (or the green key) takes a photo, if the storage holds it
        if ((k === 'ok' || k === 'send') && this.render) {
          if (this.freeKB() < 600) { this.sfx.push(['fail']); return false; }
          // the flash fires as the picture is taken (it lights the scene the sensor sees)
          const p = this.world.player;
          if (this.camFlash) this.shotAt = performance.now() / 1000;
          const R = this.render, mp = this.device.cameraMP, light = this.light + (this.camFlash ? 0.9 : 0), at = this.world.time, x = p.x, y = p.y, blocks = this.camBlocks, zoom = this.camZoom;
          this.shotDue = () => takePhoto(R, mp, light, at, x, y, this.world.seed, blocks, zoom);
          this.develop();
          this.sfx.push(['shutter']);
          return true;
        }
        if (k === 'lsoft') { this.phsel = 0; this.open('photos', now); return true; }
        // the d-pad: up and down zoom, left the flash
        if (k === 'up' || k === 'down') { this.camZoom = Math.max(1, Math.min(MAX_ZOOM, this.camZoom * (k === 'up' ? 1.25 : 0.8))); if (this.camZoom < 1.05) this.camZoom = 1; return true; }
        if (k === 'left') { this.camFlash = !this.camFlash; return true; }
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
      case 'photos': {
        const n = this.photos.length;
        if (n && (k === 'left' || k === 'right' || k === 'up' || k === 'down')) { this.phsel = (this.phsel + (k === 'left' || k === 'up' ? -1 : 1) + n) % n; return true; }
        if (n && k === '*') { this.photos.splice(this.phsel, 1); this.phsel = Math.min(this.phsel, this.photos.length - 1); return true; }
        if (k === 'rsoft') { this.open('camera', now); return true; }
        return false;
      }
      case 'folder': {
        const L = this.downloads(), n = L.length;
        if (n && (k === 'up' || k === 'down' || k === 'left' || k === 'right')) { this.fsel = (this.fsel + (k === 'up' || k === 'left' ? -1 : 1) + n) % n; return true; }
        if (n && (k === 'ok' || k === 'lsoft')) { this.openApp(L[this.fsel], now, 'folder'); return true; }
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
      }
      case 'store': {
        // two tabs: the catalog (OK downloads) and the apps installed (OK opens)
        const list = this.stab === 0 ? this.catalog() : this.downloads(), n = list.length;
        if (k === 'left' || k === 'right') { this.stab = 1 - this.stab; this.ssel = 0; this.storeNote = ''; return true; }
        if (n && (k === 'up' || k === 'down')) { this.ssel = (this.ssel + (k === 'up' ? -1 : 1) + n) % n; this.storeNote = ''; return true; }
        if (n && (k === 'ok' || k === 'lsoft')) {
          const i = list[this.ssel], [, kb, price] = STORE[i];
          if (this.stab === 1 || this.apps.includes(i)) { this.openApp(i, now, 'store'); return true; }
          if (!this.online()) this.storeNote = 'signal';
          else if (kb > EDGE_LIMIT_KB && this.wifi.state !== 'up') this.storeNote = 'wifi';
          else if (this.freeKB() < kb) this.storeNote = 'full';
          else if (this.world.telco.player.credit < price) this.storeNote = 'credit';
          else { this.radio.fetch(`app:${i}`, kb, now); this.storeNote = ''; }
          return true;
        }
        if (k === 'rsoft') { this.open('menu', now); return true; }
        return false;
      }
      case 'app': return this.appKey(k, now);
      case 'wifikey': {
        // the network's key: digits, * deletes, OK joins
        const K = this.wkey;
        const back = () => { this.open('settings', now); this.setPage = 'wifi'; this.setSel = 0; };
        if (k === 'rsoft') { back(); return true; }
        if (/^[0-9]$/.test(k) && K.key.length < 16) { K.key += k; return true; }
        if (k === '*' && K.key) { K.key = K.key.slice(0, -1); return true; }
        if ((k === 'ok' || k === 'lsoft' || k === 'send') && K.key) { this.wifi.connect(this.world, K.ap, K.key, now); back(); return true; }
        return false;
      }
      case 'messages': {
        // the boxes, and a new message
        if (k === 'up' || k === 'down') { this.box = (this.box + (k === 'up' ? 3 : 1)) % 4; return true; }
        if (k === 'ok' || k === 'lsoft') {
          if (this.box === 3) { this.clearNotices(); this.sfx.push(['sent']); return true; }
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
        if (k === 'rsoft') {
          if (D.step === 1 && this.smsEd.del()) { D.text = this.smsEd.value(); return true; }
          if (D.step === 1) D.step = 0; else this.open('messages', now);
          return true;
        }
        if (k === 'up' || k === 'down') { D.step = k === 'down' ? 1 : 0; return true; }
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
        const ok = this.smsEd.key(k, now);
        D.text = this.smsEd.value();
        return ok;
      }
      case 'contact': {
        // a new contact: the name by multi-tap (# goes on to the number), then the number; OK saves
        const E = this.edit;
        if (k === 'rsoft') {
          if (E.step === 0 && this.nameEd.del()) { E.name = this.nameEd.value(); return true; }
          if (E.step === 1 && E.number) { E.number = E.number.slice(0, -1); return true; }
          if (E.step === 1) E.step = 0; else this.open('contacts', now);
          return true;
        }
        if ((k === 'ok' || k === 'lsoft') && E.name && E.number) {
          if (this.contacts.length < 250) this.contacts.push({ name: E.name, number: E.number });
          this.csel = this.contacts.length - 1; this.open('contacts', now);
          return true;
        }
        if (k === 'down' || k === 'up') { E.step = k === 'down' ? 1 : 0; return true; }
        if (E.step === 0) {
          const ok = this.nameEd.key(k, now);
          E.name = this.nameEd.value();
          return ok;
        }
        if (k === '*' && E.number) { E.number = E.number.slice(0, -1); return true; }
        if (/^[0-9#]$/.test(k) && E.number.length < 16) { E.number += k; return true; }
        return false;
      }
      case 'calendar': {
        const r = calKey(this, this.world, k, now);
        if (r === 'menu') { this.open('menu', now); return true; }
        return r;
      }
      case 'settings':
        return this.settingsKey(k, now);
      case 'code':
        if (k === 'rsoft') { this.open('calls', now); return true; }
        if (this.code === 'lcd' && (k === 'ok' || k === 'lsoft')) { this.lcdStep++; return true; }
        return this.code === 'keys';
      case 'weather':
        // OK downloads it again
        if ((k === 'ok' || k === 'lsoft') && this.online()) { this.radio.fetch('weather', WEATHER_KB, now); this.since = now; return true; }
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
      if (k === 'ok' || k === 'lsoft') { this.setPage = SET_PAGES[this.setSel]; this.setSel = 0; this.scroll = 0; this.since = now; if (this.setPage === 'wifi') this.wifi.scanNow(); if (this.setPage === 'people') this.people = peopleNear(this.world); return true; }
      if (k === 'rsoft') { this.open('menu', now); return true; }
      return false;
    }
    if (k === 'rsoft') return back();
    if (pg === 'about') {
      if (k === 'up' || k === 'down') { this.scroll = Math.max(0, this.scroll + (k === 'up' ? -1 : 1)); return true; }
      return false;
    }
    if (pg === 'usb') {
      // the cable to the notebook: OK plugs it in or pulls it out
      if (k === 'ok' || k === 'lsoft') { this.usb = !this.usb; this.sfx.push([this.usb ? 'sent' : 'fail']); return true; }
      return false;
    }
    if (pg === 'wifi') {
      // the first row switches the Wi-Fi; the networks found below it; OK joins one (or leaves it)
      const W = this.wifi, n = 1 + Math.min(8, W.list.length);
      if (k === 'up' || k === 'down') { this.setSel = (this.setSel + (k === 'up' ? -1 : 1) + n) % n; return true; }
      if (k !== 'ok' && k !== 'lsoft') return false;
      if (this.setSel === 0) { W.on = !W.on; if (!W.on) W.disconnect(); this.setSel = 0; return true; }
      const i = W.list[this.setSel - 1]?.[0];
      if (i === undefined) return false;
      if (i === W.ap && W.state !== 'idle') { W.disconnect(); return true; }
      if (this.world.wifi[i].sec === Sec.Open) W.connect(this.world, i, '', now);
      else { this.wkey = { ap: i, key: '' }; this.open('wifikey', now); }
      return true;
    }
    if (pg === 'looks') {
      // the shell and the case: left/right (or OK) step through those the player has
      if (k === 'up' || k === 'down') { this.setSel = 1 - this.setSel; return true; }
      const less = k === 'left';
      if (!(less || k === 'right' || k === 'ok' || k === 'lsoft')) return false;
      const L = this.setSel === 0 ? this.looks : this.cases, cur = this.setSel === 0 ? this.look : this.case;
      const n = L[(L.indexOf(cur) + (less ? -1 : 1) + L.length) % L.length];
      if (this.setSel === 0) { this.look = n; this.device = n === this.device.look ? this.device : lookPhone(this.world.seed, n); } else this.case = n;
      return true;
    }
    if (pg === 'people') {
      const L = this.people.ids;
      if (!L.length) return false;
      if (k === 'up' || k === 'down') { this.setSel = (this.setSel + (k === 'up' ? -1 : 1) + L.length) % L.length; return true; }
      if (k === 'ok' || k === 'lsoft') {
        // (debug) ring their mobile, or else their home
        const P = this.world.pop, i = L[this.setSel], num = P.mobile[i] || P.households[P.home[i]].line;
        if (!num) return false;
        this.dial = num; this.call = null; this.open('calls', now); this.place(num, now);
        return true;
      }
      return false;
    }
    if (pg === 'debug') {
      const C = secretCodes(this.world.seed), n = C.length + 1;
      if (k === 'up' || k === 'down') { this.setSel = (this.setSel + (k === 'up' ? -1 : 1) + n) % n; return true; }
      // the last row: every shell and case (until the game has ways to get them)
      if ((k === 'ok' || k === 'lsoft') && this.setSel === C.length) { this.looks = SHELLS.map((_, i) => i); this.cases = CASES.map((_, i) => i); this.sfx.push(['sent']); return true; }
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
    if (this.cue === 'vibrate') this.buzz(performance.now() / 1000, 1.6);
    return true;
  }

  /** A citizen awake now, with a mobile, picked by r (0..1): who gets the number wrong; -1 if none found. */
  private somebody(r: number): number {
    const P = this.world.pop;
    for (let k = 0; k < 40 && P.n; k++) {
      const i = Math.floor(hash3(this.world.seed, Math.floor(r * 1e6), k) * P.n);
      if (P.mobile[i] && P.age[i] >= 16 && whereIs(P, this.world.city, i, this.world.time).doing !== Doing.Asleep) return i;
    }
    return -1;
  }

  /** Open an app from the menu: the bundled store apps run as apps; the rest are screens. */
  launch(a: App, now: number) {
    const id = BUNDLED_APP[a];
    if (id) this.openApp(STORE.findIndex((x) => x[0] === id), now, 'menu');
    else { if (a === 'folder') this.fsel = 0; this.open(a, now); }
  }

  /** The store's catalog: what it sells (not what came with the phone). */
  catalog(): number[] { return STORE.map((_, i) => i).filter((i) => !BUNDLED.includes(STORE[i][0]) && !SIDELOAD.includes(STORE[i][0])); }
  /** The apps downloaded from the store, in the folder. */
  downloads(): number[] { return this.apps.filter((i) => !BUNDLED.includes(STORE[i][0])); }

  private openApp(i: number, now: number, from: Screen) {
    this.appId = i; this.appFrom = from; this.open('app', now);
    const id = STORE[i][0];
    if (id === 'snake') this.snake.reset(now);
    if (id === 'news' && this.world.time - this.newsAt > 3600 && this.online()) this.radio.fetch('news', NEWS_KB, now);
    if (id === 'social') { this.wst.view = 'feed'; if (this.online()) this.fetchWire(now); }
    if (id === 'bank') { this.bk = { view: 'home', sel: 0, ok: false, note: '' }; if (this.online()) this.radio.fetch('bank', BANK_KB, now); }
    if (id === 'web') this.web.open(now);
    if (id === 'reynard') openRey(this);
  }

  /** Download what is new on the wire: a little for the page, and each post since the last time. */
  private fetchWire(now: number) {
    const fresh = Math.min(WIRE_POSTS, this.world.feed.next - 1 - this.wireId);
    this.radio.fetch('social', 3 + fresh * 0.35, now);
  }

  /** The keys of the app open. */
  private appKey(k: Key, now: number): boolean {
    const id = STORE[this.appId][0];
    // Streetwire's own pages first (Back on a post or a profile goes back a page)
    if (id === 'social' && (k !== 'rsoft' || this.wst.view !== 'feed')) {
      return wireKey(this, k, now, () => { if (this.online()) { this.fetchWire(now); this.since = now; } });
    }
    if (id === 'news' && this.newsOpen) {
      if (k === 'rsoft' || k === 'left') { this.newsOpen = null; this.scroll = this.newsScroll; return true; }
      return k === 'up' || k === 'down' ? (this.scroll = Math.max(0, this.scroll + (k === 'up' ? -1 : 1)), true) : false;
    }
    if (id === 'bank') { const r = this.bankKey(k, now); if (r !== null) return r; }
    if (id === 'web') { const r = this.web.key(k, now); if (r !== null) return r; }
    if (id === 'reynard') { const r = reyKey(this, this.world, k, now); if (r !== null) return r; }
    if (k === 'rsoft') { if (this.appFrom === 'store') this.stab = 1; this.open(this.appFrom, now); return true; }
    if (id === 'tunes') return this.tunesKey(k);
    if (id === 'snake') {
      const S = this.snake;
      if (S.over && (k === 'ok' || k === '5')) { S.reset(now); return true; }
      const d: Record<string, [number, number]> = { up: [0, -1], '2': [0, -1], down: [0, 1], '8': [0, 1], left: [-1, 0], '4': [-1, 0], right: [1, 0], '6': [1, 0] };
      if (d[k]) { S.steer(...d[k]); return true; }
      return false;
    }
    if (id === 'news') {
      if (k === 'lsoft' && this.online()) { this.radio.fetch('news', NEWS_KB, now); this.since = now; return true; }
      const fresh = this.world.time - this.newsAt <= 3600;
      if ((k === 'ok' || k === 'right') && fresh) {
        const q = newsStories(this.world).filter((s) => s.kind !== 'date')[this.newsSel];
        if (q) { this.newsOpen = q; this.newsScroll = this.scroll; this.scroll = 0; this.since = now; }
        return true;
      }
      if (k === 'ok' && this.online()) { this.radio.fetch('news', NEWS_KB, now); this.since = now; return true; }
      return k === 'up' || k === 'down' ? (this.newsSel = Math.max(0, this.newsSel + (k === 'up' ? -1 : 1)), true) : false;
    }
    if (id === 'convert') {
      const C = this.conv;
      if (k === 'up' || k === 'down') { C.pair = (C.pair + (k === 'up' ? -1 : 1) + CONVERT.length) % CONVERT.length; return true; }
      if (/^[0-9]$/.test(k) && C.input.length < 9) { C.input += k; return true; }
      if (k === '#' && !C.input.includes('.')) { C.input += '.'; return true; }
      if (k === '*') { C.input = C.input.slice(0, -1); return true; }
      return false;
    }
    return false;
  }

  /** The Tunes Player's songs: those that came with it, then the SD card's. */
  tunesCount() { return TRACKS.length + this.sd.length; }
  /** Plays song i from its start. */
  tunesPlay(i: number) {
    const n = this.tunesCount();
    if (!n) return;
    const T = this.tn;
    T.cur = ((i % n) + n) % n; T.playing = true; T.gen++; T.at = 0;
  }
  /**
   * The next song (dir 1) or the one before (-1): in order, or with shuffle a random other one going
   * forward and back through those played going back.
   */
  tunesSkip(dir: 1 | -1) {
    const T = this.tn, n = this.tunesCount();
    if (!n) return;
    if (T.cur < 0) return this.tunesPlay(T.sel);
    if (!T.shuffle || n < 2) { this.tunesPlay(T.cur + dir); T.sel = T.cur; return; }
    if (dir < 0) { const b = this.tnHist.pop(); this.tunesPlay(b ?? T.cur); T.sel = T.cur; return; }
    const was = T.cur;
    let i = Math.floor(Math.random() * (n - 1));
    if (i >= was) i++;
    this.tunesPlay(i); T.sel = T.cur;
    this.tnHist.push(was); if (this.tnHist.length > 50) this.tnHist.shift();
  }
  /** The music keys: the volume a step up or down; play/pause (the song picked when nothing is loaded); previous and next. */
  sideKey(k: Key): boolean {
    const T = this.tn;
    if (k === 'prev' || k === 'next') { if (!this.tunesCount()) return false; this.tunesSkip(k === 'next' ? 1 : -1); return true; }
    if (k === 'play') {
      if (!this.tunesCount()) return false;
      if (T.cur >= 0 && T.len > 0) T.playing = !T.playing; else this.tunesPlay(T.cur >= 0 ? T.cur : T.sel);
      return true;
    }
    const v = Math.max(0, Math.min(1, Math.round((T.vol + (k === 'vup' ? 0.1 : -0.1)) * 10) / 10));
    if (v === T.vol) return false;
    T.vol = v; this.volAt = performance.now() / 1000;
    return true;
  }
  /** When a side key last moved the volume (real s): the screen shows it for a moment. */
  volAt = -9;
  /** The Tunes Player's keys: the arrows pick, OK plays the song picked (or pauses the one playing), left and right skip, * and # the volume. */
  private tunesKey(k: Key): boolean {
    const T = this.tn, n = this.tunesCount();
    if ((k === 'up' || k === 'down') && n) { T.sel = (T.sel + (k === 'up' ? -1 : 1) + n) % n; return true; }
    if (k === 'ok' || k === 'lsoft' || k === '5') {
      // the song loaded already (after a load from the save it is not): pause or go on; else from its start
      if (T.cur === T.sel && T.cur >= 0 && T.len > 0) T.playing = !T.playing; else this.tunesPlay(T.sel);
      return true;
    }
    if ((k === 'left' || k === 'right' || k === '4' || k === '6') && T.cur >= 0) { this.tunesSkip(k === 'left' || k === '4' ? -1 : 1); return true; }
    // 0 turns shuffle on and off
    if (k === '0') { T.shuffle = !T.shuffle; this.tnHist = []; return true; }
    if (k === '*' || k === '#') { T.vol = Math.max(0, Math.min(1, Math.round((T.vol + (k === '#' ? 0.1 : -0.1)) * 10) / 10)); return true; }
    return false;
  }

  /** The bank's app: its pages (null: the key is the app's Back, to leave it). */
  private bankKey(k: Key, now: number): boolean | null {
    const B = this.bk, rows = B.view === 'home' ? 3 : B.view === 'topup' ? TOPUPS.length : B.view === 'stmt' ? this.world.bank.ledger.length : 0;
    if (!B.ok) {
      // not downloaded (no signal when it was opened): OK tries again
      if (k === 'ok' && this.online()) { this.radio.fetch('bank', BANK_KB, now); this.since = now; return true; }
      return k === 'rsoft' ? null : false;
    }
    if (k === 'rsoft') { if (B.view === 'home') return null; B.view = 'home'; B.sel = 0; B.note = ''; this.since = now; return true; }
    if ((k === 'up' || k === 'down') && rows) { B.sel = Math.max(0, Math.min(rows - 1, B.sel + (k === 'up' ? -1 : 1))); B.note = ''; return true; }
    if (B.view === 'home' && (k === 'ok' || k === 'lsoft')) { B.view = (['stmt', 'topup', 'branch'] as const)[B.sel]; B.sel = 0; this.since = now; return true; }
    if (B.view === 'topup' && (k === 'ok' || k === 'lsoft')) {
      const J = this.radio.job;
      if (J?.what.startsWith('banktop:') && (J.state === 'connecting' || J.state === 'loading')) return true;
      if (!this.online()) B.note = 'signal';
      else if (this.world.bank.balance < TOPUPS[B.sel]) B.note = 'funds';
      else { this.radio.fetch(`banktop:${TOPUPS[B.sel]}`, BANK_PAY_KB, now); B.note = ''; }
      return true;
    }
    // the branch's page: the green key calls it
    if (B.view === 'branch' && k === 'send') { this.open('calls', now); this.place(this.world.telco.bizNum[this.world.bank.branch], now); return true; }
    return false;
  }

  /** Whether data can go anywhere: the cell network, or a Wi-Fi joined. */
  online(): boolean { return this.radio.state === 'service' || this.wifi.state === 'up'; }

  /** Whether the torch app is lit. */
  torch(): boolean { return this.screen === 'app' && STORE[this.appId][0] === 'torch'; }

  /** Storage left in KB: the flash less the system, the photos and the apps installed. */
  freeKB(): number {
    return this.device.flashMB * 1024 - SYSTEM_KB - this.photos.reduce((a, p) => a + p.kb, 0) - this.apps.reduce((a, k) => a + STORE[k][1], 0);
  }

  /** A text message on its way to the phone, arriving at `at` (once there is signal). */
  receive(from: string, text: string, at: number) { this.incoming.push({ from, text, at }); }

  /** [HACKING] The district a trace answer names: the longest district name found in the player's
   *  text (the log shows the full name to copy), or -1 if none matches. */
  private parseDistrict(text: string): number {
    const t = text.toLowerCase();
    let best = -1, bl = 0;
    for (let d = 0; d < this.world.city.districts.length; d++) {
      const n = districtName(this.world.city, d).toLowerCase();
      if (n && t.includes(n) && n.length > bl) { bl = n.length; best = d; }
    }
    return best;
  }

  /**
   * Send a text (10 cents): the network carries it if there is signal; a business may answer with
   * an automatic reply, a home now and then; a number not in service bounces back.
   */
  private send(now: number): boolean {
    const D = this.draft, A = this.world.telco.player;
    if (this.radio.state !== 'service' || A.credit < 10) return false;
    A.credit -= 10;
    this.sent.unshift({ to: D.to, text: D.text, at: this.world.time });
    // [HACKING] a reply to a fixer's line: an active trace wants a district name, else it is a take/pass
    if (this.world.jobs.jobs.some((j) => j.from === D.to)) {
      const tr = this.world.jobs.jobs.find((j) => j.from === D.to && j.kind === 'trace' && j.state === 'active');
      if (tr) answerTrace(this.world.jobs, D.to, this.parseDistrict(D.text), this.world.bank, this.world.time);
      else jobReply(this.world.jobs, D.to, D.text, this.world.time);
      return true;
    }
    const c = lookup(this.world.telco, D.to), h = (q: number) => hash3(this.world.seed, this.sent.length, q), n = this.bother(D.to);
    const op = operatorName(this.world.city, this.world.telco.player.op ?? 0);
    if (c.kind === 'none') this.receive(op, SMS.failed.replace('{to}', D.to), now + 5);
    else if (c.kind === 'self') this.receive(D.to, D.text, now + 3);
    else if (c.kind === 'biz' && h(1) < 0.6 && n < 4) {
      const b = this.world.city.businesses[c.k], [o, z] = BIZ_HOURS[b.kind] ?? [9, 17], hh = (x: number) => `${((x + 11) % 12) + 1}${x % 24 < 12 ? 'am' : 'pm'}`;
      const t = smsText(this.world, 'biz', -1, h(2)).replace('{num}', formatNumber(this.world.telco, this.world.telco.bizNum[c.k])).replace('{open}', hh(o)).replace('{close}', hh(z)).replace('{biz}', businessName(this.world.city, c.k));
      this.receive(D.to, t, now + 8 + h(3) * 20);
    }
    // a text in a conversation going on by text (14.6): read like a line said, answered in their way of typing
    else if (c.kind === 'cell' && this.textTalk(c.i, false)) this.answerText(c.i, D.to, D.text, now, h(3));
    // texted again and again: a person asks them to stop, then goes quiet
    else if (c.kind === 'cell' && n >= 6) { /* no answer */ }
    else if (c.kind === 'cell' && n >= 3) { if (h(1) < 0.8) this.receive(D.to, smsText(this.world, 'annoyed', c.i, h(2)), now + 10 + h(3) * 30); }
    else if (c.kind === 'cell' && this.wrongSms.has(c.i)) this.receive(D.to, smsText(this.world, 'oops', c.i, h(2)), now + 10 + h(3) * 30);
    else if (c.kind === 'home') this.receive(op, SMS.failed.replace('{to}', D.to), now + 5); // a landline takes no texts
    // the owner reads it when awake, and maybe answers: the start of a conversation by text (14.6)
    else if (c.kind === 'cell' && h(1) < 0.5 + 0.5 * (this.world.pop.talk[c.i] / 255)) this.answerText(c.i, D.to, D.text, now, h(3));
    return true;
  }

  /** The conversations by text going on (14.6), by citizen; a new one after a quiet game hour. */
  private texting = new Map<number, { T: Talk; at: number }>();
  private textTalk(i: number, make = true): Talk | null {
    const t = this.world.time, c = this.texting.get(i);
    if (c && !c.T.over && t - c.at < 3600) return c.T;
    if (!make) return null;
    const T = new Talk(this.world, i, -1, true);
    this.texting.set(i, { T, at: t });
    return T;
  }
  /** Citizen i's answer to `text`, from `from`, when they read it (asleep: much later). */
  private answerText(i: number, from: string, text: string, now: number, q: number) {
    const T = this.textTalk(i)!, a = smsReply(this.world, T, text);
    this.texting.get(i)!.at = this.world.time;
    if (!a) return;
    const asleep = whereIs(this.world.pop, this.world.city, i, this.world.time).doing === Doing.Asleep;
    this.receive(from, a, now + (asleep ? 240 : 12) + q * 30 + a.length * 0.15);
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
    this.call.pester = this.bother(number);
    if (this.call.state === 'ended') this.sfx.push(['fail']);
    this.dial = number;
  }

  /** The player's calls and texts to each number (game times), for the people tired of them. */
  private bothered = new Map<string, number[]>();
  /** One more call or text to a number: how many in the last two game hours, this one included. */
  private bother(number: string): number {
    const t = this.world.time, L = (this.bothered.get(number) ?? []).filter((x) => t - x < 7200);
    L.push(t); this.bothered.set(number, L);
    return L.length;
  }

  /** Every notification seen: missed calls counted, texts read. */
  /** The notices on the standby screen, in their order: a missed call, unread texts, the next reminder, and the music loaded (with it, one card at most above its panel). */
  notices(): ('missed' | 'sms' | 'rem' | 'tune')[] {
    const L: ('missed' | 'sms' | 'rem' | 'tune')[] = [];
    if (this.missed) L.push('missed');
    if (this.inbox.some((m) => !m.read)) L.push('sms');
    if (this.cal.reminders.some((r) => !r.done)) L.push('rem');
    return this.tn.cur >= 0 ? [...L.slice(0, 1), 'tune'] : L.slice(0, 3);
  }
  /** The notice picked on the standby screen (-1: none; the arrows move it). */
  nsel = -1;
  /** OK on a notice: its app (the call log, the inbox, the calendar, the Tunes Player); Back comes home. */
  private openNotice(n: 'missed' | 'sms' | 'rem' | 'tune', now: number) {
    if (n === 'missed') { this.dial = ''; this.open('calls', now); }
    else if (n === 'sms') { this.box = 0; this.msel = Math.max(0, this.inbox.findIndex((m) => !m.read)); this.open('msglist', now); }
    else if (n === 'rem') this.open('calendar', now);
    else this.openApp(STORE.findIndex((a) => a[0] === 'tunes'), now, 'standby');
  }
  clearNotices() { this.missed = 0; for (const m of this.inbox) m.read = true; }

  /** A call into the log (newest first). */
  private logCall(number: string, kind: CallKind) {
    if (!number) return;
    this.log.unshift({ number, kind, at: this.world.time });
    if (this.log.length > 20) this.log.pop();
    this.lsel = 0;
  }

  /** Ask the operator's menu for the answer to the path so far. */
  private ask() {
    const r = ussd(this.world, this.us.code, this.us.path);
    this.us.text = r.text.replace('{op}', operatorName(this.world.city, this.world.telco.player.op ?? 0)); this.us.menu = r.menu; this.us.input = '';
    if (r.sms) this.receive(operatorName(this.world.city, this.world.telco.player.op ?? 0), r.sms, this.us.at + 4);
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
export function phoneKey(code: string, key = ''): Key | null {
  // * and # by the character typed (Shift+8 and Shift+3 without a number pad, any layout)
  if (key === '*') return '*';
  if (key === '#') return '#';
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

/** (Debug) The building the player is in, or the nearest one with people living in it, and its residents. */
export function peopleNear(world: World): { building: number; ids: number[] } {
  const p = world.player, B = world.city.buildings, P = world.pop;
  let best = p.inside, d = Infinity;
  if (best < 0 || !residentsOf(P, best).length) {
    best = -1;
    for (const H of P.households) {
      const b = B[H.building], dd = Math.hypot((b.x0 + b.x1) / 2 - p.x, (b.y0 + b.y1) / 2 - p.y);
      if (dd < d) { d = dd; best = H.building; }
    }
  }
  return { building: best, ids: best >= 0 ? residentsOf(P, best) : [] };
}

