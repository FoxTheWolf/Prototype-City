import { hash3 } from '../core/rng';
import { calendar } from '../sim/clock';
import { type World } from '../sim/world';
import { bigText, BAD, ch, DAYS, DIM, HI, hhmm, INK, LCD, type Lcd, MONTHS, SEL, SH, softKeys, SW, T, title, typed, WHITE, type C3 } from './lcd';
import { APPS, GRID_KEYS, TAPS, type App, type Phone } from './phone';

/**
 * The phone's menu and its apps besides the map. Those that need nothing more work for real
 * (calculator, clock with a stopwatch, notes typed by multi-tap, the about screen with the
 * hardware and the GPS); the dialer, contacts and messages have their screens but no network to
 * use (the antennas come with stage 9); the rest say what they are waiting for.
 */
const A = T.apps;
const name = (a: App) => (T.app as Record<string, string>)[a];

/** Each app's icon: a framed symbol in its color. */
const ICON: Record<App, [string, C3]> = {
  map: ['*', [120, 230, 140]], calls: ['#', [120, 255, 160]], contacts: ['@', [255, 200, 120]], messages: ['=', [140, 200, 255]],
  camera: ['o', [200, 200, 210]], web: ['W', [120, 170, 255]], clock: ['%', [255, 220, 120]], calc: ['+', [230, 230, 230]],
  notes: ['~', [255, 240, 160]], weather: ['^', [150, 220, 255]], store: ['$', [255, 160, 200]], settings: ['&', [180, 180, 200]],
};

/** The menu: 12 apps in a 3x4 grid, each in the place of its key on the keypad. */
export function menu(S: Lcd, P: Phone, t: number) {
  title(S, T.menuTitle, t);
  APPS.forEach((a, n) => {
    const cx = 2 + (n % 3) * 13, cy = 3 + Math.floor(n / 3) * 5, sel = n === P.sel, bg = sel ? SEL : LCD;
    if (t < 0.08 + n * 0.04) return; // the icons pop in one by one
    if (sel) for (let y = 0; y < 5; y++) for (let x = -1; x < 12; x++) S.put(cx + x, cy + y, 32, bg, bg);
    const [sym, col] = ICON[a], fr: C3 = sel ? WHITE : [col[0] * 0.6, col[1] * 0.6, col[2] * 0.6];
    S.text(cx + 3, cy, '+---+', fr, bg);
    S.text(cx + 3, cy + 1, '|   |', fr, bg); S.put(cx + 5, cy + 1, ch(sym), col, bg);
    S.text(cx + 3, cy + 2, '+---+', fr, bg);
    const label = `${GRID_KEYS[n]} ${name(a)}`.slice(0, 11);
    S.text(cx + ((11 - label.length) >> 1), cy + 3, label, sel ? WHITE : INK, bg);
  });
  softKeys(S, T.open, T.back);
}

/** A screen that only explains: why the app cannot do anything yet. */
function notice(S: Lcd, t: number, head: string, lines: string[], col: C3 = BAD) {
  title(S, head, t);
  lines.forEach((l, k) => S.center(8 + k * 2, typed(l, t - 0.2 - k * 0.15), k === 0 ? col : DIM, LCD));
  softKeys(S, '', T.back);
}

export function app(S: Lcd, P: Phone, world: World, t: number, now: number) {
  switch (P.screen as App) {
    case 'calls': return calls(S, P, t, now);
    case 'contacts': return notice(S, t, `${name('contacts').toUpperCase()} (0)`, A.contacts, INK);
    case 'messages': return messages(S, t);
    case 'camera': return notice(S, t, name('camera').toUpperCase(), A.camera, HI);
    case 'web': return notice(S, t, name('web').toUpperCase(), A.web);
    case 'weather': return notice(S, t, name('weather').toUpperCase(), A.weather);
    case 'store': return notice(S, t, `${P.device.maker.toUpperCase()} ${name('store').toUpperCase()}`, A.store);
    case 'clock': return clock(S, P, world, t, now);
    case 'calc': return calc(S, P, t);
    case 'notes': return notes(S, P, t, now);
    case 'settings': return settings(S, P, world, t);
  }
}

/** The dialer: the number in big digits; the green key calls, and with no network the call fails. */
function calls(S: Lcd, P: Phone, t: number, now: number) {
  title(S, name('calls').toUpperCase(), t);
  const d = P.dial;
  if (d.length <= 7) bigText(S, 6, d, INK);
  else S.center(9, d, INK, LCD);
  if (P.callAt >= 0) {
    // (the frame's time can be a little earlier than the key's)
    const u = Math.max(0, now - P.callAt);
    S.center(15, `${A.calling} ${d}${'.'.repeat(Math.floor(u * 3) % 4)}`, HI, LCD);
    if (u > 1.6) { S.center(17, A.noNetwork, BAD, LCD); S.center(19, A.callFailed, BAD, LCD); }
    return softKeys(S, '', T.back);
  }
  if (!d) S.center(15, typed(A.dialHint, t - 0.2), DIM, LCD);
  softKeys(S, d ? A.call : '', d ? A.clear : T.back);
}

function messages(S: Lcd, t: number) {
  title(S, name('messages').toUpperCase(), t);
  A.boxes.forEach((b, k) => S.text(2, 3 + k * 2, typed(`${b} (0)`, t - 0.1 - k * 0.05), INK, LCD));
  A.messages.forEach((l, k) => S.center(13 + k * 2, typed(l, t - 0.4 - k * 0.15), k === 0 ? BAD : DIM, LCD));
  softKeys(S, '', T.back);
}

/** The time of day (the city's), the date, and a stopwatch on real seconds. */
function clock(S: Lcd, P: Phone, world: World, t: number, now: number) {
  title(S, name('clock').toUpperCase(), t);
  const c = calendar(world.time);
  bigText(S, 3, hhmm(c.hour), INK, t);
  S.center(11, `${DAYS[c.weekday]} ${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${c.year}`, DIM, LCD);
  const sw = P.swAcc + (P.swAt >= 0 ? now - P.swAt : 0), m = Math.floor(sw / 60), s = sw % 60;
  S.center(15, A.stopwatch, HI, LCD);
  S.center(17, `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`, P.swAt >= 0 ? WHITE : INK, LCD);
  S.center(20, A.stopwatchHint, DIM, LCD);
  softKeys(S, P.swAt >= 0 ? A.stop : A.start, T.back);
}

/** The calculator: the display in big digits, the operation waiting, and which key does what. */
function calc(S: Lcd, P: Phone, t: number) {
  title(S, name('calc').toUpperCase(), t, P.calc.op);
  const v = P.calc.cur;
  if (v.length <= 7) bigText(S, 5, v, v === 'ERROR' ? BAD : WHITE);
  else S.text(SW - v.length - 2, 8, v, WHITE, LCD);
  A.calcHint.forEach((l, k) => S.center(16 + k * 2, l, DIM, LCD));
  softKeys(S, '=', T.back);
}

/** Notes: the text typed by tapping the keypad (a tap within a second picks the key's next letter). */
function notes(S: Lcd, P: Phone, t: number, now: number) {
  title(S, name('notes').toUpperCase(), t, `${P.note.length}/400`);
  // wrap to the screen, keeping the end in view
  const lines: string[] = [];
  for (const para of P.note.split('\n')) { let s = para; do { lines.push(s.slice(0, SW - 2)); s = s.slice(SW - 2); } while (s.length); }
  const rows = SH - 6, shown = lines.slice(-rows);
  shown.forEach((l, k) => S.text(1, 3 + k, l, INK, LCD));
  const last = shown.length ? shown[shown.length - 1] : '', tapping = P.tapKey && now - P.tapAt < 1;
  if (Math.floor(now * 2) & 1 || tapping) S.put(1 + last.length - (tapping ? 1 : 0), 2 + Math.max(1, shown.length), tapping ? ch(last[last.length - 1] || ' ') : ch('_'), tapping ? LCD : INK, tapping ? INK : LCD);
  if (!P.note) S.center(10, typed(A.notesHint, t - 0.2), DIM, LCD);
  if (tapping) S.text(1, SH - 2, TAPS[P.tapKey], DIM, LCD);
  softKeys(S, '', T.back);
}

/** About the phone: its hardware, its radios, and what the GPS is doing. */
function settings(S: Lcd, P: Phone, world: World, t: number) {
  title(S, name('settings').toUpperCase(), t);
  const D = P.device, g = P.gps;
  const imei = String(Math.floor(hash3(world.seed, 7, 7) * 1e15)).padStart(15, '0');
  const gps = g.state === 'fix' ? `${A.gpsFix} ${g.sats} SAT +-${g.acc}m` : g.state === 'search' ? `${A.gpsSearch} ${g.sats} SAT` : g.state === 'lost' ? A.gpsLost : A.gpsOff;
  const rows: [string, string][] = [
    [A.model, `${D.maker} ${D.model}`], [A.os, D.os], [A.cpu, `${D.cpu} ${D.cpuMHz} MHz`], [A.ram, `${D.ramMB} MB`], [A.flash, `${D.flashMB} MB`],
    [A.display, D.screen], [A.radio, D.radio], [A.network, T.noService], [A.wlan, `${D.wlan} ${T.off}`], [A.gps, D.gps], [A.gpsNow, gps], [A.imei, imei],
  ];
  const view = SH - 5, top = Math.min(P.scroll, Math.max(0, rows.length * 2 - view));
  P.scroll = top;
  rows.forEach(([k, v], n) => {
    const y = 3 + n * 2 - top;
    if (y < 3 || y >= SH - 2) return;
    S.text(1, y, typed(k, t - 0.05 * n), DIM, LCD);
    S.text(SW - v.length - 1, y, typed(v, t - 0.05 * n - 0.1), v === T.noService || v.endsWith(T.off) ? BAD : INK, LCD);
  });
  softKeys(S, '', T.back);
}
