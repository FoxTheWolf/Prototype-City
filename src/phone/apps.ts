import { hash3 } from '../core/rng';
import en from '../locale/en.json';
import { cityName, operatorName } from '../locale/names';
import { calendar, moonPhase } from '../sim/clock';
import { formatNumber } from '../sim/telco';
import { forecast, newWeather, type Weather } from '../sim/weather';
import { type World } from '../sim/world';
import { BAR, bigText, BAD, ch, DAYS, DIM, HI, hhmm, INK, LCD, type Lcd, MONTHS, SEL, SH, softKeys, SW, T, title, typed, WHITE, type C3 } from './lcd';
import { VIEW_LIGHT } from '../render/raycaster';
import { secretCodes } from './codes';
import { freeVoucher } from './ussd';
import { expose, type Photo } from './camera';
import { type CharGrid } from '../render/grid';
import { tickerText } from '../locale/news';
import { CONVERT, SNAKE_H, SNAKE_W } from './store';
import { APPS, EDGE_LIMIT_KB, STORE, fmtDist, GRID_KEYS, PREF_ROWS, SET_PAGES, TAPS, type App, type Key, type Phone } from './phone';

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
    case 'calls': return calls(S, P, world, t, now);
    case 'contacts': return contacts(S, P, t);
    case 'messages': return messages(S, P, t);
    case 'camera': return cameraScreen(S, P, now);
    case 'web': return notice(S, t, name('web').toUpperCase(), P.radio.state === 'service' ? A.soon : A.web, P.radio.state === 'service' ? HI : BAD);
    case 'weather': return weather(S, P, world, t, now);
    case 'store': return store(S, P, t, now);
    case 'clock': return clock(S, P, world, t, now);
    case 'calc': return calc(S, P, t);
    case 'notes': return notes(S, P, t, now);
    case 'settings': return settings(S, P, world, t);
    default:
      if (P.screen === 'code') return service(S, P, world, t, now);
      if (P.screen === 'contact') return contactEdit(S, P, now);
      if (P.screen === 'ussd') return ussdScreen(S, P, t, now);
      if (P.screen === 'photos') return photosScreen(S, P, t);
      if (P.screen === 'app') return appScreen(S, P, world, t, now);
      if (P.screen === 'msglist') return msgList(S, P, t);
      if (P.screen === 'msg') return msgRead(S, P, t);
      if (P.screen === 'compose') return compose(S, P, now);
  }
}

/** Text wrapped to a width. */
function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    if (line && line.length + 1 + word.length > w) { out.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

/**
 * The dialer: the number in big digits; the green key calls (Save makes it a contact). During a
 * call: who, its state and time, and what is said, typing in as it is spoken.
 */
function calls(S: Lcd, P: Phone, world: World, t: number, now: number) {
  title(S, name('calls').toUpperCase(), t);
  const d = P.dial, c = P.call, who = P.contacts.find((x) => x.number === d)?.name;
  if (!c) {
    if (d.length <= 7) bigText(S, 6, d, INK);
    else S.center(9, d, INK, LCD);
    if (who) S.center(14, who, HI, LCD);
    if (!d) S.center(15, typed(A.dialHint, t - 0.2), DIM, LCD);
    return softKeys(S, d ? A.save : '', d ? A.clear : T.back);
  }
  S.center(3, who ?? (d.replace(/\D/g, '').length === 7 ? formatNumber(world.telco, d) : d), WHITE, LCD);
  const u = Math.max(0, now - (c.connectAt >= 0 ? c.connectAt : now)), tm = `${String(Math.floor(u / 60)).padStart(2, '0')}:${String(Math.floor(u % 60)).padStart(2, '0')}`;
  const state = c.state === 'dialing' ? `${A.calling}${'.'.repeat(Math.floor(now * 3) % 4)}` : c.state === 'ringing' ? `${A.ringing} (${c.rings})` : c.state === 'talk' ? tm : c.reason;
  S.center(5, state, c.state === 'ended' ? BAD : c.state === 'talk' ? [120, 255, 150] : HI, LCD);
  if (c.state === 'ended' && c.cost()) S.center(6, A.cost.replace('{c}', `$${(c.cost() / 100).toFixed(2)}`), DIM, LCD);
  // what is said, the latest at the bottom
  const rows: [string, C3][] = [];
  for (const L of c.lines) {
    const shown = L.text.slice(0, Math.ceil(((now - L.at) / L.dur) * L.text.length));
    const col: C3 = L.who === 'them' ? INK : L.who === 'rec' ? HI : DIM;
    for (const l of wrap(L.who === 'rec' ? `~ ${shown}` : shown, SW - 2)) rows.push([l, col]);
  }
  rows.slice(-(SH - 10)).forEach(([l, col], k) => S.text(1, 8 + k, l, col, LCD));
  softKeys(S, '', c.state === 'ended' ? '' : A.end);
}

/** Contacts: the SIM's list; OK calls, New adds one. */
function contacts(S: Lcd, P: Phone, t: number) {
  title(S, name('contacts').toUpperCase(), t, A.sim.replace('{n}', String(P.contacts.length)));
  if (!P.contacts.length) S.center(10, A.noContacts, DIM, LCD);
  const view = Math.floor((SH - 5) / 2), top = Math.max(0, Math.min(P.csel - view + 1, P.contacts.length - view));
  P.contacts.slice(top, top + view).forEach((c, n) => {
    const k = top + n, sel = k === P.csel, y = 3 + n * 2, bg = sel ? SEL : LCD;
    if (sel) S.fill(y, bg);
    S.text(1, y, typed(c.name, t - 0.04 * n), sel ? WHITE : INK, bg);
    S.text(SW - c.number.length - 1, y, c.number, sel ? WHITE : DIM, bg);
  });
  softKeys(S, A.new, T.back);
}

/** A new contact: the name typed by multi-tap, then the number. */
function contactEdit(S: Lcd, P: Phone, now: number) {
  const E = P.edit, blink = Math.floor(now * 2) & 1;
  title(S, `${name('contacts').toUpperCase()} +`, 1);
  S.text(1, 4, A.name, E.step === 0 ? HI : DIM, LCD);
  S.text(1, 5, E.name + (E.step === 0 && blink ? '_' : ''), WHITE, LCD);
  S.text(1, 8, A.numberF, E.step === 1 ? HI : DIM, LCD);
  S.text(1, 9, E.number + (E.step === 1 && blink ? '_' : ''), WHITE, LCD);
  S.text(1, SH - 3, E.step === 0 ? A.notesHint : '* <-', DIM, LCD);
  softKeys(S, E.name && E.number ? A.save : '', T.back);
}

/** Messages: the inbox (unread count), the sent ones, and a new message. */
function messages(S: Lcd, P: Phone, t: number) {
  title(S, name('messages').toUpperCase(), t);
  const unread = P.inbox.filter((m) => !m.read).length;
  [`${A.inbox} (${unread}/${P.inbox.length})`, `${A.sent} (${P.sent.length})`, A.newMsg].forEach((l, k) => row(S, 3 + k * 2, l, '>', k === P.box, t - 0.05 * k));
  softKeys(S, T.open, T.back);
}

/** Who a message is from (or to): the contact's name when there is one. */
const nameOf = (P: Phone, n: string) => P.contacts.find((c) => c.number === n)?.name ?? n;

function msgList(S: Lcd, P: Phone, t: number) {
  const L = P.box === 0 ? P.inbox.map((m) => [m.from, m.text, m.read] as const) : P.sent.map((m) => [m.to, m.text, true] as const);
  title(S, P.box === 0 ? A.inbox.toUpperCase() : A.sent.toUpperCase(), t);
  if (!L.length) S.center(10, A.noMsgs, DIM, LCD);
  const view = Math.floor((SH - 5) / 2), top = Math.max(0, Math.min(P.msel - view + 1, L.length - view));
  L.slice(top, top + view).forEach(([who, text, read], n) => {
    const sel = top + n === P.msel, y = 3 + n * 2, bg = sel ? SEL : LCD;
    if (sel) S.fill(y, bg);
    S.text(1, y, `${read ? ' ' : '*'}${nameOf(P, who)}: ${text}`.slice(0, SW - 2), sel ? WHITE : read ? DIM : INK, bg);
  });
  softKeys(S, A.new, T.back);
}

function msgRead(S: Lcd, P: Phone, t: number) {
  const m = P.box === 0 ? P.inbox[P.msel] : null, s = P.box === 1 ? P.sent[P.msel] : null;
  const who = m ? m.from : s?.to ?? '', text = m ? m.text : s?.text ?? '', at = m ? m.at : s?.at ?? 0, c = calendar(at);
  title(S, `${P.box === 0 ? A.from : A.to}: ${nameOf(P, who)}`.slice(0, SW - 2), t);
  S.text(1, 3, `${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${hhmm(c.hour)}`, DIM, LCD);
  wrap(text, SW - 2).slice(0, SH - 8).forEach((l, k) => S.text(1, 5 + k, typed(l, t - k * 0.05), WHITE, LCD));
  softKeys(S, /^[0-9*#]+$/.test(who) ? A.replyK : '', T.back);
}

function compose(S: Lcd, P: Phone, now: number) {
  const D = P.draft, blink = Math.floor(now * 2) & 1;
  title(S, A.newMsg.toUpperCase(), 1, `${D.text.length}/160`);
  S.text(1, 3, A.to, D.step === 0 ? HI : DIM, LCD);
  S.text(5, 3, nameOf(P, D.to) + (D.step === 0 && blink ? '_' : ''), WHITE, LCD);
  S.text(1, 5, A.text, D.step === 1 ? HI : DIM, LCD);
  const lines = wrap(D.text, SW - 2);
  lines.slice(-(SH - 10)).forEach((l, k) => S.text(1, 6 + k, l, WHITE, LCD));
  if (D.step === 1 && blink) S.put(1 + (lines[lines.length - 1]?.length ?? 0), 6 + Math.max(0, Math.min(lines.length, SH - 10) - 1), ch('_'), WHITE, LCD);
  S.text(1, SH - 3, D.step === 0 ? '* <-   v text' : A.notesHint, DIM, LCD);
  softKeys(S, D.step === 0 ? T.ok : D.to && D.text ? A.send : '', T.back);
}

/** The operator's service menu: "running" for a moment, then its text and, on a menu, the answer being typed. */
function ussdScreen(S: Lcd, P: Phone, t: number, now: number) {
  const U = P.us;
  title(S, U.code, t);
  if (now - U.at < 1.4) { S.center(10, `${A.running}${'.'.repeat(Math.floor(now * 3) % 4)}`.slice(0, SW - 2), DIM, LCD); return softKeys(S, '', T.back); }
  const lines = U.text.split('\n').flatMap((l) => wrap(l, SW - 4));
  lines.forEach((l, k) => S.text(2, 3 + k, typed(l, now - U.at - 1.4 - k * 0.05, 90), k === 0 ? HI : WHITE, LCD));
  if (U.menu) {
    S.text(2, SH - 4, `${A.reply} ${U.input}${Math.floor(now * 2) & 1 ? '_' : ''}`, INK, LCD);
    return softKeys(S, U.input ? A.send : '', T.back);
  }
  softKeys(S, T.ok, T.back);
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
const SET = A.set;
/** A row of a list, picked or not: the label on the left, a value on the right. */
function row(S: Lcd, y: number, label: string, value: string, sel: boolean, t: number) {
  const bg = sel ? SEL : LCD;
  if (sel) S.fill(y, bg);
  S.text(1, y, typed(label, t), sel ? WHITE : INK, bg);
  if (value) S.text(SW - value.length - 1, y, typed(value, t - 0.1), sel ? WHITE : DIM, bg);
}

/** Settings: the list of pages, the pages of options, about the phone, and the debug page. */
function settings(S: Lcd, P: Phone, world: World, t: number) {
  const pg = P.setPage;
  if (pg === 'root') {
    title(S, name('settings').toUpperCase(), t);
    SET_PAGES.forEach((p, n) => row(S, 3 + n * 2, `${n + 1} ${SET.pages[p as keyof typeof SET.pages]}`, '>', n === P.setSel, t - 0.05 * n));
    return softKeys(S, T.open, T.back);
  }
  title(S, SET.pages[pg].toUpperCase(), t);
  if (pg === 'about') return about(S, P, world, t);
  if (pg === 'debug') {
    SET.debugHint.forEach((l, k) => S.text(1, 3 + k, typed(l, t - 0.05 * k), DIM, LCD));
    secretCodes(world.seed).forEach((c, n) => row(S, 7 + n * 2, c.code, A.code[c.kind], n === P.setSel, t - 0.2 - 0.05 * n));
    S.text(1, 22, A.voucher, DIM, LCD); S.text(1, 23, freeVoucher(world), INK, LCD);
    return softKeys(S, SET.dial, T.back);
  }
  PREF_ROWS[pg].forEach((key, n) => row(S, 3 + n * 2, SET.rows[key], `< ${SET.values[key][P.prefs[key]]} >`, n === P.setSel, t - 0.05 * n));
  S.center(SH - 3, SET.hint, DIM, LCD);
  softKeys(S, T.ok, T.back);
}

function about(S: Lcd, P: Phone, world: World, t: number) {
  const D = P.device, g = P.gps;
  const imei = imeiOf(world.seed);
  const gps = g.state === 'fix' ? `${A.gpsFix} ${g.sats} SAT +-${fmtDist(g.acc, P.prefs.dist)}` : g.state === 'search' ? `${A.gpsSearch} ${g.sats} SAT` : g.state === 'lost' ? A.gpsLost : A.gpsOff;
  const R = P.radio, acc = world.telco.player, site = R.site >= 0 ? world.telco.sites[R.site] : null;
  const net = R.state === 'service' ? operatorName(world.city).toUpperCase() : R.state === 'search' ? A.searching : T.noService;
  const rows: [string, string][] = [
    [A.network, net], [A.signal, R.state === 'service' ? `${R.dbm} dBm (${R.bars}/4)` : '-'], [A.cell, site ? `ID ${site.id}` : '-'],
    [A.number, formatNumber(world.telco, acc.number.replace('-', ''))], [A.credit, `$${(acc.credit / 100).toFixed(2)}`], [A.dataLeft, kbText(acc.dataKB)], [A.dataUsed, kbText(acc.usedKB)],
    [A.model, `${P.maker} ${D.model}`], [A.os, D.os], [A.cpu, `${D.cpu} ${D.cpuMHz} MHz`], [A.ram, `${D.ramMB} MB`], [A.flash, `${D.flashMB} MB`],
    [A.display, D.screen], [A.cameraRow, D.cameraMP ? `${D.cameraMP} MP` : T.off], [A.radio, D.radio], [A.wlan, `${D.wlan} ${T.off}`], [A.gps, D.gps], [A.gpsNow, gps], [A.imei, imei],
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

const kbText = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`);

const ahead: Weather = newWeather();
function skyWord(w: Weather): string {
  const W = A.wx.sky;
  if (w.precip > 0.02) return w.snow ? W.snow : w.precip > 0.75 ? W.storm : w.precip < 0.25 ? W.drizzle : W.rain;
  return w.cloud > 0.75 ? W.cloudy : w.cloud > 0.35 ? W.partly : W.clear;
}

/**
 * Weather: the forecast comes down over EDGE (the session set up, then the kilobytes as fast as
 * the signal allows, out of the data bundle), then shows now and the hours ahead, from the same
 * forecast the city's weather follows. It keeps for an hour; OK downloads it again.
 */
function weather(S: Lcd, P: Phone, world: World, t: number, now: number) {
  const R = P.radio, J = R.job?.what === 'weather' ? R.job : null, W = A.wx;
  const fresh = world.time - P.wxAt < 3600;
  if (!fresh && (!J || J.state === 'nosignal') && R.state !== 'service') return notice(S, t, name('weather').toUpperCase(), A.weather);
  title(S, `${name('weather').toUpperCase()} ${cityName(world.city).toUpperCase()}`, t);
  if (J && J.state !== 'done') {
    // the download, as a terminal would show it
    const u = Math.max(0, now - J.at);
    const lines = [`${W.attach} ...`, `${W.pdp} ...`, W.get.replace('{city}', cityName(world.city).toLowerCase().replace(/ /g, '_'))];
    lines.forEach((l, k) => { if (u > k * 0.6) S.text(1, 4 + k, l, DIM, LCD); });
    if (J.state === 'loading') {
      const f = J.done / J.kb, n = Math.round(f * (SW - 4));
      S.text(2, 9, '['.padEnd(n + 1, '#').padEnd(SW - 3, '.') + ']', INK, LCD);
      S.center(11, W.kb.replace('{a}', J.done.toFixed(1)).replace('{b}', String(J.kb)), DIM, LCD);
    }
    if (J.state === 'nosignal') S.center(12, W.lost, BAD, LCD);
    if (J.state === 'nodata') { S.center(12, W.noData, BAD, LCD); S.center(14, W.buy, DIM, LCD); }
    return softKeys(S, R.state === 'service' ? W.refresh : '', T.back);
  }
  // the forecast: now and the hours ahead
  const base = P.wxAt;
  ahead.preset = world.weather.preset;
  ([0, 3, 6, 12, 24] as const).forEach((h, k) => {
    if (t < 0.1 + k * 0.12) return;
    const at = base + h * 3600;
    forecast(world.seed, at, ahead);
    const c = calendar(at), label = h ? W.in.replace('{h}', String(h)) : W.now, y = 3 + k * 3;
    const tf = P.prefs.temp ? `${Math.round(ahead.temp)}°C` : `${Math.round(ahead.temp * 1.8 + 32)}°F`;
    S.text(1, y, label.padEnd(5), HI, LCD);
    S.text(7, y, hhmm(c.hour), DIM, LCD);
    S.text(13, y, skyWord(ahead), INK, LCD);
    S.text(SW - tf.length - 1, y, tf, WHITE, LCD);
    S.text(13, y + 1, `${Math.round(ahead.cloud * 100)}% cloud  wind ${Math.round(Math.hypot(ahead.windX, ahead.windY))} m/s`, DIM, LCD);
  });
  const ph = W.phases[Math.round(moonPhase(world.time) * 8) % 8];
  S.text(1, SH - 3, `${W.moon}: ${ph}`, DIM, LCD);
  S.text(1, SH - 2, W.updated.replace('{t}', hhmm(calendar(base).hour)), DIM, LCD);
  softKeys(S, R.state === 'service' ? W.refresh : '', T.back);
}

const C = A.code;
const imeiOf = (seed: number) => String(Math.floor(hash3(seed, 7, 7) * 1e15)).padStart(15, '0');

/** The service screens the secret codes open (see codes.ts). */
function service(S: Lcd, P: Phone, world: World, t: number, now: number) {
  const k = P.code;
  if (k === 'lcd') return lcdTest(S, P);
  title(S, `${C[k]}`, t);
  if (k === 'imei') {
    const im = imeiOf(world.seed);
    S.center(8, C.imei, DIM, LCD);
    S.center(10, typed(`${im.slice(0, 2)} ${im.slice(2, 8)} ${im.slice(8, 14)} ${im[14]}`, t, 30), WHITE, LCD);
    S.center(12, typed(C.sv, t - 0.6), DIM, LCD);
  } else if (k === 'gps') gpsTest(S, P, t);
  else if (k === 'field') fieldTest(S, P, world, t);
  else if (k === 'sensors') sensors(S, P, world, t, now);
  else if (k === 'keys') keyTest(S, P, now);
  else if (k === 'version') version(S, P, world, t);
  softKeys(S, '', T.back);
}

/** GPS test: the sky as a plot (north up, the horizon the ring, overhead the middle) and each satellite's signal. */
function gpsTest(S: Lcd, P: Phone, t: number) {
  const g = P.gps, cx = 13, cy = 12, R = 8, RX = 13;
  for (let a = 0; a < 64; a++) S.put(Math.round(cx + Math.cos((a / 64) * 6.283) * RX), Math.round(cy + Math.sin((a / 64) * 6.283) * R), ch('.'), DIM, LCD);
  for (let a = 0; a < 32; a++) S.put(Math.round(cx + Math.cos((a / 32) * 6.283) * RX / 2), Math.round(cy + Math.sin((a / 32) * 6.283) * R / 2), ch('.'), DIM, LCD);
  S.put(cx, cy - R - 1, ch('N'), INK, LCD); S.put(cx, cy, ch('+'), DIM, LCD);
  for (let s = 0; s < g.satAz.length; s++) {
    const r = 1 - Math.min(1, g.satEl[s] / (Math.PI / 2)), x = Math.round(cx + Math.cos(g.satAz[s]) * r * RX), y = Math.round(cy + Math.sin(g.satAz[s]) * r * R);
    const col: C3 = g.satUse[s] ? [120, 255, 150] : g.satSnr[s] ? HI : DIM;
    S.put(x, y, ch('0123456789AB'[s]), col, LCD);
    // the list: id, signal, a bar, in use
    if (t < 0.1 + s * 0.05) continue;
    const snr = Math.round(g.satSnr[s]), ly = 3 + s * 2;
    S.text(29, ly, `${'0123456789AB'[s]} ${String(snr).padStart(2)}`, col, LCD);
    S.text(35, ly, '#'.repeat(Math.round(snr / 10)).padEnd(5, '.'), col, LCD);
    if (g.satUse[s]) S.put(41, ly, ch('*'), col, LCD);
  }
  const st = g.state === 'fix' ? `${C.fix} ${g.sats} ${C.sat} +-${fmtDist(g.acc, P.prefs.dist)}` : `${C.noFix} ${g.sats} ${C.sat}`;
  S.text(1, SH - 2, st, g.state === 'fix' ? [120, 255, 150] : BAD, LCD);
}

/** Field test: the cell it camps on (id, area, channel, level, timing advance) and the neighbours it hears. */
function fieldTest(S: Lcd, P: Phone, world: World, t: number) {
  const R = P.radio, T2 = world.telco, p = world.player;
  const lac = (k: number) => 1000 + Math.floor(hash3(world.seed, T2.sites[k].building, 77) * 8) * 111;
  const arfcn = (k: number) => 1 + Math.floor(hash3(world.seed, k, 78) * 124);
  if (R.site < 0) { S.center(8, C.noCell, BAD, LCD); return; }
  const s = T2.sites[R.site], d = Math.hypot(s.x - p.x, s.y - p.y);
  S.text(1, 3, C.serving, HI, LCD);
  const rows: [string, string][] = [['CID', String(s.id)], [C.lac, String(lac(R.site))], [C.arfcn, String(arfcn(R.site))], [C.rxlev, `${R.dbm} dBm`], [C.ta, `${Math.round(d / 550)} (${fmtDist(d, P.prefs.dist)})`]];
  rows.forEach(([a, b], n) => { S.text(2, 4 + n, typed(a, t - n * 0.05), DIM, LCD); S.text(12, 4 + n, typed(b, t - n * 0.05), INK, LCD); });
  S.text(1, 10, C.neighbours, HI, LCD);
  R.heard.filter(([k]) => k !== R.site).slice(0, 6).forEach(([k, dbm], n) => {
    S.text(2, 11 + n * 2, typed(`${String(T2.sites[k].id).padEnd(7)}${String(arfcn(k)).padStart(4)}  ${dbm} dBm`, t - 0.3 - n * 0.05), INK, LCD);
  });
}

/** Sensors: the battery, its temperature, the ambient light sensor (from the light in the hands), the radio. */
function sensors(S: Lcd, P: Phone, world: World, t: number, now: number) {
  const pct = Math.max(5, Math.round(100 - world.tick / 60 / 600)), lux = Math.round(((VIEW_LIGHT[0] + VIEW_LIGHT[1] + VIEW_LIGHT[2]) / 3) * 420);
  const btemp = world.player.inside >= 0 ? 29 : 24 + world.weather.temp * 0.25, R = P.radio;
  const temp = (c: number) => (P.prefs.temp ? `${c.toFixed(1)}°C` : `${(c * 1.8 + 32).toFixed(1)}°F`);
  const rows: [string, string][] = [
    [C.battery, `${pct}%`], [C.volt, `${(3.55 + pct * 0.0065).toFixed(3)} V`], [C.btemp, temp(btemp + (hash3(Math.floor(now), 1, 1) - 0.5) * 0.2)],
    [C.light, `${lux} lx`], [C.rf, R.state === 'service' ? `${R.dbm} dBm` : '-'], [C.radioTemp, temp(btemp + 3 + (R.job ? 4 : 0))],
    [C.uptime, `${Math.floor(world.tick / 3600)}:${String(Math.floor(world.tick / 60) % 60).padStart(2, '0')}`],
  ];
  rows.forEach(([a, b], n) => { S.text(1, 3 + n * 2, typed(a, t - n * 0.05), DIM, LCD); S.text(SW - b.length - 1, 3 + n * 2, b, INK, LCD); });
}

const TEST_KEYS: Key[] = ['lsoft', 'up', 'rsoft', 'left', 'ok', 'right', 'send', 'down', 'end', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
/** Key test: every key, lit once pressed since the screen opened, bright while held. */
function keyTest(S: Lcd, P: Phone, now: number) {
  S.center(3, C.keysHint, DIM, LCD);
  TEST_KEYS.forEach((k, n) => {
    const at = P.pressed.get(k) ?? -1, seen = at >= P.since, hot = now - at < 0.2;
    const x = 4 + (n % 3) * 13, y = 5 + Math.floor(n / 3) * 3, bg: C3 = hot ? WHITE : seen ? [40, 140, 70] : SEL;
    for (let dx = 0; dx < 10; dx++) S.put(x + dx, y, 32, bg, bg);
    S.text(x + ((10 - k.length) >> 1), y, k.toUpperCase(), hot ? LCD : WHITE, bg);
  });
}

/** LCD test: the whole screen in one color after another (OK for the next). */
function lcdTest(S: Lcd, P: Phone) {
  const cols: C3[] = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 255], [0, 0, 0]];
  const n = P.lcdStep % (cols.length + 1);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const c: C3 = n < cols.length ? cols[n] : [Math.round((x / SW) * 255), Math.round((y / SH) * 255), 128];
    S.put(x, y, 32, c, c);
  }
  S.text(1, SH - 1, `${C.lcd} ${n + 1}/${cols.length + 1}  ${C.lcdHint}`, n === 3 ? [0, 0, 0] : WHITE, n < cols.length ? cols[n] : [0, 0, 0]);
}

/** Version: the firmware's build, as an engineering screen lists it. */
function version(S: Lcd, P: Phone, world: World, t: number) {
  const D = P.device, h = (q: number) => hash3(world.seed, 31, q);
  const rows: [string, string][] = [
    [C.build, `${D.os}.${Math.floor(h(1) * 9)}.${100 + Math.floor(h(2) * 800)}`], [C.date, `2008-0${1 + Math.floor(h(3) * 2)}-${10 + Math.floor(h(4) * 18)}`],
    [C.baseband, `BB ${(h(5) * 0xffff | 0).toString(16).toUpperCase()}`], [C.bootloader, `BL 1.${Math.floor(h(6) * 9)}`], [C.hw, `R${1 + Math.floor(h(7) * 4)}`], [C.imei, imeiOf(world.seed)],
  ];
  rows.forEach(([a, b], n) => { S.text(1, 3 + n * 2, typed(a, t - n * 0.05), DIM, LCD); S.text(SW - b.length - 1, 3 + n * 2, typed(b, t - n * 0.05), INK, LCD); });
  S.center(SH - 3, typed(C.eng, t - 0.5), BAD, LCD);
}

/** A picture (w x h cells) shown over the screen's rows y0..y1, scaled to fit. */
function picture(S: Lcd, cells: Uint8ClampedArray, bg: Uint8ClampedArray, w: number, h: number, y0: number, y1: number) {
  const rows = y1 - y0, k = Math.max(w / SW, h / rows), dw = Math.floor(w / k), dh = Math.floor(h / k), x0 = (SW - dw) >> 1, top = y0 + ((rows - dh) >> 1);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const i = Math.floor(y * k) * w + Math.floor(x * k), q = i * 4;
    S.put(x0 + x, top + y, cells[q] || 32, [cells[q + 1], cells[q + 2], cells[q + 3]], [bg[q], bg[q + 1], bg[q + 2]]);
  }
}

let finder: CharGrid | null = null, finderAt = -1, finderN = 0;
/** The camera: the viewfinder live (15 times a second), a white flash on a shot, how many fit in the storage. */
function cameraScreen(S: Lcd, P: Phone, now: number) {
  if (P.render && (now - finderAt > 1 / 15 || !finder)) { finder = expose(P.render, SW, SH - 2, P.light, finderN++); finderAt = now; }
  if (finder) picture(S, finder.cells, finder.bg, SW, SH - 2, 1, SH - 1);
  if (now - P.shotAt < 0.15) for (let y = 1; y < SH - 1; y++) S.fill(y, WHITE);
  // the frame's corners, the resolution and the photos left
  for (const [x, y, c] of [[1, 2, '+'], [SW - 2, 2, '+'], [1, SH - 3, '+'], [SW - 2, SH - 3, '+']] as const) S.put(x, y, ch(c), WHITE, [0, 0, 0]);
  const left = Math.max(0, Math.floor(P.freeKB() / (P.device.cameraMP * 340)));
  S.text(1, 1, ` ${P.device.cameraMP}MP  ${left} `, WHITE, [0, 0, 0]);
  softKeys(S, `${A.photos} (${P.photos.length})`, T.back);
  S.text((SW - A.shoot.length) >> 1, SH - 1, A.shoot, HI, BAR);
}

/** The photos taken: one at a time, with when it was taken. */
function photosScreen(S: Lcd, P: Phone, t: number) {
  const p: Photo | undefined = P.photos[P.phsel];
  title(S, `${A.photos.toUpperCase()} ${p ? `${P.phsel + 1}/${P.photos.length}` : ''}`, t);
  if (!p) { S.center(10, A.noPhotos, DIM, LCD); return softKeys(S, '', T.back); }
  picture(S, p.cells, p.bg, p.w, p.h, 2, SH - 2);
  const c = calendar(p.at);
  S.text(1, SH - 2, `${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${hhmm(c.hour)}  ${p.kb} KB  ${A.del}`, DIM, LCD);
  softKeys(S, '< >', T.back);
}

const ST = A.shop;
const appName = (i: number) => (ST.names as Record<string, string>)[STORE[i][0]];

/** The store: the catalog (size, price, whether it fits over EDGE) and the apps installed; a download's progress. */
function store(S: Lcd, P: Phone, t: number, now: number) {
  title(S, `${P.maker.toUpperCase()} ${name('store').toUpperCase()}`, t);
  ST.tabs.forEach((tb, k) => S.text(2 + k * 14, 3, k === P.stab ? `[${tb}]` : ` ${tb} `, k === P.stab ? HI : DIM, LCD));
  const list = P.stab === 0 ? STORE.map((_, i) => i) : P.apps;
  if (!list.length) S.center(10, ST.none, DIM, LCD);
  list.forEach((i, n) => {
    const [id, kb, price] = STORE[i], y = 5 + n * 2, sel = n === P.ssel, bg = sel ? SEL : LCD, have = P.apps.includes(i);
    if (sel) S.fill(y, bg);
    const right = P.stab === 1 ? '' : have ? ST.installed : `${kb >= 1024 ? `${(kb / 1024).toFixed(0)}MB` : `${kb}KB`} ${price ? `$${(price / 100).toFixed(2)}` : ST.free}`;
    S.text(1, y, typed(appName(i), t - n * 0.04), sel ? WHITE : kb > EDGE_LIMIT_KB && !have ? DIM : INK, bg);
    S.text(SW - right.length - 1, y, right, sel ? WHITE : DIM, bg);
    if (sel && P.stab === 0) S.text(1, SH - 4, (ST.about as Record<string, string>)[id], DIM, LCD);
  });
  const J = P.radio.job;
  if (J?.what.startsWith('app:') && (J.state === 'connecting' || J.state === 'loading')) {
    const f = J.done / J.kb, n = Math.round(f * (SW - 16));
    S.text(1, SH - 3, `${ST.downloading} [${'#'.repeat(n).padEnd(SW - 16, '.')}]`, HI, LCD);
  } else if (P.storeNote) S.text(1, SH - 3, (ST.notes as Record<string, string>)[P.storeNote], BAD, LCD);
  softKeys(S, P.stab === 1 || P.apps.includes(list[P.ssel]) ? ST.open : ST.get, T.back);
  void now;
}

/** The app from the store that is open. */
function appScreen(S: Lcd, P: Phone, world: World, t: number, now: number) {
  const id = STORE[P.appId][0];
  if (id === 'torch') {
    // the whole screen white, as bright as it goes
    for (let y = 0; y < SH; y++) S.fill(y, [255, 255, 250]);
    return;
  }
  title(S, appName(P.appId).toUpperCase(), t);
  if (id === 'snake') {
    const G = P.snake, x0 = 1, y0 = 3;
    for (let y = -1; y <= SNAKE_H; y++) for (let x = -1; x <= SNAKE_W; x++) if (x < 0 || y < 0 || x === SNAKE_W || y === SNAKE_H) S.put(x0 + x, y0 + y, ch('#'), DIM, LCD);
    S.put(x0 + G.food[0], y0 + G.food[1], ch('@'), HI, LCD);
    G.body.forEach(([x, y], n) => S.put(x0 + x, y0 + y, n ? 32 : ch('O'), [120, 255, 150], n ? [60, 170, 80] : LCD));
    S.text(1, 1, `${ST.score} ${G.score}  ${ST.best} ${G.best}`, HI, [16, 30, 40]);
    if (G.over) { S.center(10, ` ${ST.gameOver} `, BAD, LCD); S.center(12, ` ${ST.again} `, DIM, LCD); }
    return softKeys(S, '', T.back);
  }
  if (id === 'news') {
    const J = P.radio.job, loading = J?.what === 'news' && (J.state === 'connecting' || J.state === 'loading');
    if (loading || world.time - P.newsAt > 3600) {
      S.center(10, P.radio.state === 'service' ? ST.newsWait : ST.newsNone, P.radio.state === 'service' ? DIM : BAD, LCD);
      return softKeys(S, '', T.back);
    }
    // the same headlines the city's news tickers run
    const lines = tickerText(world).split(en.news.sep).filter(Boolean).flatMap((h) => [...wrap(h, SW - 3), '']);
    const top = Math.min(P.scroll, Math.max(0, lines.length - (SH - 5)));
    lines.slice(top, top + SH - 5).forEach((l, k) => S.text(1, 3 + k, typed(l, t - k * 0.03, 120), l ? INK : DIM, LCD));
    return softKeys(S, A.wx.refresh, T.back);
  }
  if (id === 'convert') {
    const C = P.conv, [what, from, to, f] = CONVERT[C.pair], v = parseFloat(C.input || '0');
    S.center(4, `< ${what} >`, HI, LCD);
    S.text(4, 8, `${C.input || '0'} ${from}`, WHITE, LCD);
    S.text(4, 11, `= ${+f(v).toFixed(3)} ${to}`, [120, 255, 150], LCD);
    S.text(1, SH - 3, '^ v units   # .   * <-', DIM, LCD);
    return softKeys(S, '', T.back);
  }
  // too big to have come over EDGE: nothing to show yet
  S.center(10, (ST.about as Record<string, string>)[id], DIM, LCD);
  softKeys(S, '', T.back);
  void now;
}
