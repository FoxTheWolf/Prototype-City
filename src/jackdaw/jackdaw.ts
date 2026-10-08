import { calendar, TIME_SCALE } from '../sim/clock';
import { batIcon, bootFrame, Buf, FW, hdr, ICONS, menuFrame, scene, TRINKETS, type Mood, type SceneSt } from './screen';

/**
 * 15.22: the Jackdaw Mini, the pocket gadget of docs/identidade/jackdaw-manual.html (and docs/dispositivo.md),
 * its non-hacking foundation: the lever that switches it on and off, the opening, the home screen with the
 * jackdaw (it looks, hops, blinks, dozes after 2 minutes without a key or on a low battery), the menu, the
 * loading screen, and the factory apps (PET, TONE, LIGHT, CLOCK, FILES, SETTINGS). Every key clicks; every key
 * lights the screen's backlight for 5 s. It runs at the manual's 10 frames a second: `update` steps its ticks
 * and redraws `screen` when what it shows changed (`ver` goes up, for the texture).
 *
 * THE APPS' INTERFACE (where the two halves meet, docs/dispositivo.md): an app is a DeviceApp in `apps`, the
 * menu lists them in order. The shell owns the navigation (BACK always returns to the menu), the screen, the
 * jackdaw, the keys and the sounds; an app draws its content (`render`, into a Buf of 128 x 64) and takes the
 * keys the shell does not (`input`). Through `dev` it can beep, make the jackdaw react (`pet`), give it a
 * trinket (`collect`), and read and write the SD card (`sd`). Only the apps ever touch the simulation.
 * The hacking apps (stage 19) register into the same list from their own [HACKING] modules.
 */
export type JKey = 'up' | 'down' | 'left' | 'right' | 'ok' | 'back';
export type JSfx = 'down' | 'up' | 'lever' | 'boot' | 'enter' | 'back' | 'happy' | 'sad' | 'err' | 'low' | 'tone';
export interface DeviceApp {
  id: string;
  /** Its name in the menu (capitals, the 3 x 5 font). */
  title: string;
  /** Its 7 x 7 icon ('#' lit). */
  icon: readonly string[];
  /** The stage 19 apps (in [HACKING] modules). */
  hacking?: boolean;
  /** Its frame into b (blank); `now` the game's time (s). Return a scene's name to show the jackdaw's scene instead. */
  render(b: Buf, dev: Jackdaw, now: number): string | void;
  /** A key the shell did not take (BACK always goes back to the menu). */
  input?(k: JKey, dev: Jackdaw): void;
  /** Opened from the menu. */
  open?(dev: Jackdaw): void;
  /** Its own scene of the jackdaw, shown as it opens (the manual's rule 5): the scene's name and state. */
  scene?(dev: Jackdaw): [string, SceneSt];
}
/** How long an app's own scene shows as it opens (ticks). */
const SCENE_T = 15;

const MOODS: Mood[] = ['neutral', 'happy', 'smug', 'surprised', 'sulky', 'sleepy'];
/** The backlight after a key (ticks), the doze after no key (ticks), the low battery's mark. */
const LIGHT_T = 50, DOZE_T = 1200, LOW = 0.05;
/** Hours of game time a full battery lasts switched on (the backlight does not change it: a 2008 toy). */
const BATT_H = 30;

export class Jackdaw {
  /** The player has one (the debug gives it until stage 19). */
  owned = false;
  /** Out of the pocket, in the hand (0..1 eased; `out` the wish). */
  out = false;
  raise = 0;
  on = false;
  mode: 'off' | 'boot' | 'home' | 'menu' | 'loading' | 'app' = 'off';
  /** Ticks (tenths of a second) in this mode. */
  t = 0;
  sel = 0;
  app: DeviceApp | null = null;
  look = 0; hop = 0; mood = 0; light = 0; idle = 0;
  freq = 440;
  batt = 1;
  /** The trinkets the jackdaw found (pet.collect), and how many there are to find. */
  shinies: string[] = [];
  readonly of = 40;
  /** The SD card's files (name: content), the apps' captures and saves. */
  sd = new Map<string, string>([['PET.SAV', ''], ['README.TXT', 'JACKDAW MINI']]);
  /** The low battery's sheet over everything (until a key). */
  lowSheet = false;
  private lowAt = -1;
  /** A key pressed this frame (for the body's keys sinking), the time it was (real s). */
  pressed = new Map<JKey | 'power', number>();
  readonly sfx: (JSfx | ['tone', number])[] = [];
  readonly apps: DeviceApp[] = [];
  /** The screen's dots now, and its version (up when it changed). */
  readonly screen = new Buf();
  ver = 0;
  private acc = 0;
  /** The game's time (s) at the last update. */
  time = 0;

  constructor() { this.apps.push(...FACTORY); }

  // ---- what the apps may use ----
  beep(ok: boolean) { this.sfx.push(ok ? 'enter' : 'err'); }
  /** The jackdaw reacts: a win (content, hopping), a fail (sulky), or back to idle. */
  pet(r: 'win' | 'fail' | 'idle') { this.mood = r === 'win' ? 1 : r === 'fail' ? 4 : 0; if (r !== 'idle') { this.hop = r === 'win' ? 4 : 0; this.sfx.push(r === 'win' ? 'happy' : 'sad'); } }
  /** A trinket found: kept, and the jackdaw shows it off. */
  collect(id: string) { if (this.shinies.includes(id)) return; this.shinies.push(id); this.pet('win'); }
  get lit() { return this.on && this.light > 0; }

  /** The lever: on (the opening) or off, from any screen. */
  lever() {
    this.pressed.set('power', performance.now() / 1000);
    this.sfx.push('lever');
    if (this.on || this.batt <= 0) { this.on = false; this.mode = 'off'; this.light = 0; this.lowSheet = false; }
    else { this.on = true; this.mode = 'boot'; }
    this.t = 0;
  }
  /** A key: it clicks always; then what it does where the device is. */
  press(k: JKey) {
    this.pressed.set(k, performance.now() / 1000);
    this.sfx.push('down');
    if (this.mode === 'off' || this.mode === 'boot') return;
    this.light = LIGHT_T; this.idle = 0;
    if (this.lowSheet) { this.lowSheet = false; return; }
    if (this.mode === 'home') {
      if (k === 'ok') { this.mode = 'menu'; this.sfx.push('enter'); }
      else if (k === 'left' || k === 'right') { this.look = k === 'left' ? -1 : 1; this.hop = 3; }
      else if (k === 'up') { this.hop = 4; this.sfx.push('happy'); }
      else this.sfx.push('err');
    } else if (this.mode === 'menu') {
      if (k === 'up') this.sel = (this.sel + this.apps.length - 1) % this.apps.length;
      else if (k === 'down') this.sel = (this.sel + 1) % this.apps.length;
      else if (k === 'ok') { this.mode = 'loading'; this.t = 0; this.app = this.apps[this.sel]; this.sfx.push('enter'); }
      else if (k === 'back') { this.mode = 'home'; this.sfx.push('back'); }
      else this.sfx.push('err');
    } else if (this.mode === 'app') {
      if (k === 'back') { this.mode = 'menu'; this.sfx.push('back'); this.mood = 0; }
      else if (this.app?.input) this.app.input(k, this);
    }
  }
  /** A key let go (its click up). */
  release() { this.sfx.push('up'); }

  /**
   * A frame of dt real seconds at the game's time (s): the hand easing, the battery, and the device's ticks
   * at 10 a second (the screen drawn again when it shows something else).
   */
  update(dt: number, time: number) {
    this.time = time;
    this.raise += ((this.out && this.owned ? 1 : 0) - this.raise) * (1 - Math.exp(-dt / 0.12));
    if (this.on) {
      this.batt = Math.max(0, this.batt - (dt * TIME_SCALE) / 3600 / BATT_H);
      if (this.batt <= 0) { this.on = false; this.mode = 'off'; this.light = 0; this.lowSheet = false; }
      else if (this.batt < LOW && (this.lowAt < 0 || time - this.lowAt > 60 * TIME_SCALE)) { this.lowAt = time; this.lowSheet = true; this.sfx.push('low'); }
    }
    this.acc += dt;
    while (this.acc >= 0.1) { this.acc -= 0.1; this.tick(); }
    this.draw();
  }
  private tick() {
    this.t++;
    if (this.hop > 0) this.hop--;
    if (this.light > 0 && !(this.mode === 'app' && this.app?.id === 'light')) this.light--;
    if (this.mode === 'home') {
      this.idle++;
      if (this.t % 47 === 30) this.hop = 3;
      if (this.t % 60 === 0) this.look = [0, 1, 0, -1][(this.t / 60) % 4];
    }
    if (this.mode === 'loading' && this.t > 10) { this.mode = 'app'; this.t = 0; this.app?.open?.(this); }
  }
  /** The clock as the device shows it (the game's). */
  clock() { const h = calendar(this.time).hour, m = Math.floor((h % 1) * 60); return `${String(Math.floor(h)).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  date() {
    const C = calendar(this.time);
    return `${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][C.weekday]} ${String(C.day).padStart(2, '0')} ${['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][C.month - 1]}`;
  }
  private draw() {
    // only sent again when a dot changed
    const s = this.screen.p, n = this.frame().p;
    for (let i = 0; i < s.length; i++) if (s[i] !== n[i]) { s.set(n); this.ver++; break; }
  }
  /** This tick's picture. */
  private frame(): Buf {
    const blink = this.t % 38 < 2, hop = this.hop > 0;
    if (this.mode === 'off') return BLANK;
    if (this.mode === 'boot') {
      if (this.t === 1) this.sfx.push('boot');
      const [b, done] = bootFrame(this.t, [`JACKDAW FW ${FW}`, 'BOARD JKD-M REV.C', 'SD CARD....... OK', `APPS${'.'.repeat(Math.max(1, 12 - String(this.apps.length).length))}${this.apps.length}`, 'PET......... AWAKE']);
      if (done) { this.mode = 'home'; this.t = 0; this.idle = 0; this.sfx.push('happy'); }
      return b;
    }
    if (this.lowSheet) return scene('lowbat', { z: (this.t / 5 | 0) % 3, on: this.t % 10 < 5, bat: Math.max(1, Math.round(this.batt * 100)) });
    if (this.mode === 'home') {
      if (this.idle > DOZE_T || this.batt < LOW) return scene('sleepy', { z: (this.t / 5 | 0) % 3 });
      const st: SceneSt = { look: this.look, hop, blink, time: this.clock(), date: this.date(), shinies: this.shinies.length, of: this.of, found: Math.min(TRINKETS.length, this.shinies.length), bat: Math.min(3, Math.ceil(this.batt * 3)) };
      return scene('home', st);
    }
    if (this.mode === 'menu') return menuFrame(this.apps, this.sel, this.clock());
    if (this.mode === 'loading') return scene('loading', { p: Math.min(1, this.t / 9), hop: this.t % 4 < 2 });
    if (this.mode === 'app' && this.app) {
      if (this.app.scene && this.t < SCENE_T) { const [n, st] = this.app.scene(this); return scene(n, st); }
      const b = SCRATCH; b.clr();
      const sc = this.app.render(b, this, this.time);
      return sc ? scene(sc, { hop, blink, look: this.look, z: (this.t >> 2) % 3, f: (this.t / 4 | 0) % 2, sp: this.t % 8 < 4 }) : b;
    }
    return BLANK;
  }
  /** The tick count (for the apps' animations). */
  get tickN() { return this.t; }

  // ---- the save ----
  save() { return { owned: this.owned, batt: this.batt, shinies: this.shinies, sd: [...this.sd], freq: this.freq }; }
  restore(d: ReturnType<Jackdaw['save']> | undefined) {
    if (!d) return;
    this.owned = d.owned; this.batt = d.batt; this.shinies = d.shinies ?? []; this.freq = d.freq ?? 440;
    if (d.sd) this.sd = new Map(d.sd);
  }
}
const BLANK = new Buf(), SCRATCH = new Buf();

// ---- the factory apps (the manual's section 7–8 and its live device) ----
const FACTORY: DeviceApp[] = [
  {
    id: 'pet', title: 'PET', icon: ICONS.PET,
    open: (d) => { d.mood = 0; },
    render: (_b, d) => MOODS[d.mood],
    input: (k, d) => {
      if (k === 'left') d.mood = (d.mood + MOODS.length - 1) % MOODS.length;
      else if (k === 'right') d.mood = (d.mood + 1) % MOODS.length;
      else if (k === 'ok') { d.mood = 1; d.hop = 4; d.sfx.push('happy'); }
    },
  },
  {
    id: 'tone', title: 'TONE', icon: ICONS.TONE,
    scene: (d) => ['tone', { f: (d.tickN / 4 | 0) % 2 }],
    render: (b, d) => {
      hdr(b, 'TONE', d.clock());
      const s = `${d.freq} HZ`; b.text(64 - Buf.tw(s, 3) / 2, 16, s, 3); b.text(20, 42, 'UP DN  PITCH'); b.text(20, 51, 'OK     PLAY');
    },
    input: (k, d) => {
      if (k === 'up') d.freq = Math.min(2000, d.freq + 40);
      else if (k === 'down') d.freq = Math.max(120, d.freq - 40);
      else if (k === 'ok') d.sfx.push(['tone', d.freq]);
    },
  },
  {
    // the screen at full backlight while it is open (a torch of green)
    id: 'light', title: 'LIGHT', icon: ICONS.LIGHT,
    open: (d) => { d.light = LIGHT_T; },
    render: (_b, d) => { d.light = LIGHT_T; return 'light'; },
  },
  {
    id: 'clock', title: 'CLOCK', icon: ICONS.CLOCK,
    scene: (d) => { const h = calendar(d.time).hour; return ['clock', { h: Math.floor(h), m: Math.floor((h % 1) * 60) }]; },
    render: (b, d) => {
      hdr(b, 'CLOCK');
      const s = d.clock(); b.text(64 - Buf.tw(s, 4) / 2, 18, s, 4); b.text(64 - Buf.tw(d.date()) / 2, 50, d.date());
    },
  },
  {
    id: 'files', title: 'FILES', icon: ICONS.FILES,
    render: (b, d) => { hdr(b, 'FILES', d.clock()); ['/SD', ...[...d.sd.keys()].map((n) => `  ${n}`), d.shinies.length ? '  SHINIES/' : ''].filter(Boolean).slice(0, 6).forEach((l, i) => b.text(4, 11 + i * 9, l)); },
  },
  {
    id: 'settings', title: 'SETTINGS', icon: ICONS.SETTINGS,
    render: (b, d) => {
      hdr(b, 'SETTINGS', d.clock());
      b.text(4, 12, 'BATTERY'); batIcon(b, 50, 11, Math.min(3, Math.ceil(d.batt * 3))); b.text(66, 12, `${Math.round(d.batt * 100)}%`);
      b.text(4, 22, 'SOUND'); b.text(50, 22, 'ON'); b.text(4, 32, 'BACKLIGHT'); b.text(50, 32, '5 S'); b.text(4, 42, 'FIRMWARE'); b.text(50, 42, FW);
    },
  },
];
