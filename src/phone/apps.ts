import { hash3 } from '../core/rng';
import { businessName, citizenName, districtName, operatorName, roadName, wifiName, workplaceName } from '../locale/names';
import { districtAt, nearestRoad } from '../sim/city';
import { drawWire } from './wire';
import { drawCalendar } from './calendar';
import { newsApp, weatherApp } from './skins';
import PEOPLE from '../locale/people.en.json';
import { Role, whereIs } from '../sim/citizens';
import { Sec } from '../sim/wifi';
import { DEBUG } from '../debug';
import { calendar } from '../sim/clock';
import { formatNumber } from '../sim/telco';
import { type World } from '../sim/world';
import { BAR, bigText, BAD, ch, DIM, HI, hhmm, INK, LCD, type Lcd, MONTHS, SEL, SH, softKeys, SW, T, title, typed, typeHint, WHITE, type C3 } from './lcd';
import { VIEW_LIGHT } from '../render/raycaster';
import { secretCodes } from './codes';
import { freeVoucher } from './ussd';
import { expose, OPTICAL, type Photo } from './camera';
import { type CharGrid } from '../render/grid';
import { CONVERT, SNAKE_H, SNAKE_W } from './store';
import { APPS, EDGE_LIMIT_KB, MENU_COLS, money, STORE, TOPUPS, fmtDist, PREF_ROWS, SET_PAGES, type App, type Key, type Phone } from './phone';
import { HD } from '../render/hd';
import { appIcon } from './hdicons';
import { box, CHROME, face, header, lerp, mul, PICK, PICK_DIM, PICK_INK, vgrad } from './ui';
import { BLOCK, SHAPE } from '../render/atlas';
import { CASES, SHELLS } from './shells';
import { compile, TRACKS } from '../audio/tracks';
import { drawRey } from './reynard';
import SONGS from '../locale/music.en.json';

/** An app's own page color over the whole screen (between the status bar and the soft keys). */
function paint(S: Lcd, bg: C3) { for (let y = 1; y < SH - 1; y++) S.fill(y, bg); }
/** An app's own title bar. */
function bar(S: Lcd, text: string, fg: C3, bg: C3, right = '', rfg: C3 = fg) {
  S.fill(1, bg); S.text(1, 1, text, fg, bg);
  if (right) S.text(SW - right.length - 1, 1, right, rfg, bg);
}

/**
 * The phone's menu and its apps besides the map. Those that need nothing more work for real
 * (calculator, notes typed by multi-tap, the about screen with the
 * hardware and the GPS); the dialer, contacts and messages have their screens but no network to
 * use (the antennas come with stage 9); the rest say what they are waiting for.
 */
const A = T.apps;
const name = (a: App) => (T.app as Record<string, string>)[a];

/** Each app's icon: a symbol, its tile's color, the symbol's color. */
const ICON: Record<App, [string, C3, C3]> = {
  map: ['+N', [56, 150, 80], [255, 255, 255]], calls: [')))', [40, 170, 90], [255, 255, 255]], contacts: ['@', [220, 140, 60], [255, 255, 255]], messages: ['[=]', [60, 120, 210], [255, 255, 255]],
  camera: ['[o]', [90, 94, 104], [230, 235, 245]], wire: ['sw', [38, 62, 120], [255, 170, 60]], news: ['NEWS', [236, 228, 208], [24, 20, 16]], weather: ['\\o/', [70, 150, 230], [255, 230, 110]],
  calendar: ['31', [240, 240, 244], [210, 50, 50]], bank: ['$$', [22, 70, 52], [235, 200, 110]], calc: ['+-', [56, 56, 62], [255, 150, 30]], notes: ['~~', [250, 230, 120], [40, 50, 110]],
  snake: ['~o', [150, 178, 84], [36, 48, 22]], folder: ['[_]', [200, 150, 60], [255, 245, 220]], store: ['$', [110, 50, 130], [255, 140, 210]], settings: ['<o>', [120, 126, 140], [255, 255, 255]],
  tunes: ['d', [130, 60, 170], [255, 220, 255]],
};
/** The icons of apps from the store. */
const STORE_ICON: Record<string, [string, C3, C3]> = {
  torch: ['*', [230, 200, 60], [255, 255, 255]], convert: ['<>', [40, 150, 150], [255, 255, 255]], tunes: ICON.tunes, atlas: ['3D', [60, 130, 90], [255, 255, 255]],
  snake: ICON.snake, news: ICON.news, social: ICON.wire, bank: ICON.bank, web: ['(e)', [30, 70, 150], [255, 210, 80]], reynard: ['^.^', [34, 30, 28], [232, 112, 44]],
};
const MENU_BG: [C3, C3] = [[18, 26, 46], [6, 8, 16]];
const menuBg = (y: number): C3 => lerp(MENU_BG[0], MENU_BG[1], (y - 1) / (SH - 3));

/** An app's tile on a grid: the icon (a glossy rounded square with its symbol) and its name; the picked one on a lit panel. */
function tile(S: Lcd, x: number, y: number, [sym, col, fg]: [string, C3, C3], label: string, sel: boolean, t: number, id = '') {
  if (t < 0) return;
  if (sel) box(S, x, y, x + 9, y + 3, [56, 86, 140], menuBg, 1, [34, 54, 96]);
  const under = (_x: number, yy: number) => (sel ? lerp([56, 86, 140], [34, 54, 96], (yy - y) / 3) : menuBg(yy));
  box(S, x + 2, y, x + 7, y + 2, mul(col, 1.18), under, 1, mul(col, 0.78));
  // the gloss: the top of the icon brighter
  for (let k = x + 3; k <= x + 6; k++) S.put(k, y, SHAPE.top, lerp(mul(col, 1.18), [255, 255, 255], 0.35), mul(col, 1.18));
  S.text(x + 5 - (sym.length >> 1) - (sym.length & 1 ? 0 : 0), y + 1, sym, fg, col);
  // in HD: the icon as a picture over the characters' one
  appIcon(S, x + 2, y, id, col, (r) => under(0, y + r));
  const l = label.slice(0, 10);
  S.text(x + ((10 - l.length) >> 1), y + 3, l, sel ? [255, 255, 255] : [150, 165, 190], sel ? [34, 54, 96] : menuBg(y + 3));
}

/** The menu: 16 apps in a 4x4 grid; the picked one named below with a word on what it does. */
export function menu(S: Lcd, P: Phone, t: number) {
  vgrad(S, 1, SH - 2, MENU_BG[0], MENU_BG[1]);
  APPS.forEach((a, n) => tile(S, 1 + (n % MENU_COLS) * 10, 2 + Math.floor(n / MENU_COLS) * 5, ICON[a], name(a), n === P.sel, t - 0.06 - n * 0.025, a));
  const a = APPS[P.sel], about = (A.about as Record<string, string>)[a] ?? '';
  S.center(22, typed(name(a), t - 0.2), [255, 255, 255], menuBg(22));
  S.center(23, typed(about, t - 0.3), [130, 150, 180], menuBg(23));
  softKeys(S, T.open, T.back);
}

/** My Apps: the apps downloaded from the store, as tiles. */
function folder(S: Lcd, P: Phone, t: number) {
  vgrad(S, 1, SH - 2, MENU_BG[0], MENU_BG[1]);
  header(S, name('folder'), `${P.downloads().length}`, '[_]', ICON.folder[1]);
  const L = P.downloads();
  if (!L.length) { A.set.noDownloads.forEach((l, k) => S.center(10 + k, l, [150, 165, 190], menuBg(10 + k))); return softKeys(S, '', T.back); }
  L.forEach((i, n) => tile(S, 1 + (n % MENU_COLS) * 10, 4 + Math.floor(n / MENU_COLS) * 5, STORE_ICON[STORE[i][0]] ?? ICON.store, appName(i), n === P.fsel, t - n * 0.04, STORE[i][0] === 'social' ? 'wire' : STORE[i][0]));
  softKeys(S, T.open, T.back);
}

export function app(S: Lcd, P: Phone, world: World, t: number, now: number) {
  switch (P.screen as App) {
    case 'calls': return calls(S, P, world, t, now);
    case 'contacts': return contacts(S, P, t);
    case 'messages': return messages(S, P, t);
    case 'camera': return cameraScreen(S, P, now);
    case 'calendar': return drawCalendar(S, P, world, now);
    case 'weather': return weatherApp(S, P, world, t, now);
    case 'store': return store(S, P, t, now);
    case 'calc': return calc(S, P, t);
    case 'notes': return notes(S, P, t, now);
    case 'settings': return settings(S, P, world, t);
    default:
      if (P.screen === 'code') return service(S, P, world, t, now);
      if (P.screen === 'contact') return contactEdit(S, P, now);
      if (P.screen === 'ussd') return ussdScreen(S, P, t, now);
      if (P.screen === 'photos') return photosScreen(S, P, t);
      if (P.screen === 'app') return appScreen(S, P, world, t, now);
      if (P.screen === 'wifikey') return wifiKey(S, P, world, now);
      if (P.screen === 'msglist') return msgList(S, P, t);
      if (P.screen === 'folder') return folder(S, P, t);
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

/** The light pages of the phone's own apps (dialer, messages): a pale gradient, dark ink, blue accents. */
const PG0: C3 = [234, 238, 244], PG1: C3 = [206, 212, 222], INKD: C3 = [30, 34, 44], GREY: C3 = [110, 118, 132], BLUE: C3 = [40, 90, 170];
const pageBg = (y: number): C3 => lerp(PG0, PG1, (y - 1) / (SH - 3));
const lightPage = (S: Lcd) => vgrad(S, 1, SH - 2, PG0, PG1);

/**
 * The dialer: the number big on a white display, who it is, the numbers called last. During a call:
 * a dark page, the other end's picture, name and number, the state and the time, and what is said
 * in bubbles, typing in as it is spoken.
 */
function calls(S: Lcd, P: Phone, world: World, t: number, now: number) {
  const d = P.dial, c = P.call, who = P.contacts.find((x) => x.number === d)?.name;
  if (!c) {
    lightPage(S);
    header(S, '', P.missed ? `${P.missed} missed` : '', ')))', [120, 230, 150]);
    tabs(S, 5, 0, CHROME.text, CHROME.top, [40, 170, 90]);
    box(S, 1, 4, SW - 2, 11, [255, 255, 255], pageBg, 1, [244, 246, 250]);
    if (d.length <= 7) bigText(S, 5, d, INKD);
    else S.center(8, d, INKD, [250, 251, 253]);
    if (who) S.center(10, who, BLUE, [246, 248, 251]);
    if (!d) S.center(8, typed(A.dialHint, t - 0.2), GREY, [250, 251, 253]);
    // the call log: each call with how it went (arrow out made, arrow in received, red missed or not
    // completed) and when; with nothing dialed the arrows pick one and the green key calls it back
    if (P.log.length) {
      S.text(2, 13, A.recent, GREY, pageBg(13));
      const view = 5, sel = Math.min(P.lsel, P.log.length - 1), top = Math.max(0, Math.min(sel - view + 1, P.log.length - view));
      P.log.slice(top, top + view).forEach((e, n) => {
        const k = top + n, y = 14 + n * 2, on = k === sel && !d, nm = P.contacts.find((x) => x.number === e.number)?.name, num = /^[0-9]{7}$/.test(e.number) ? formatNumber(world.telco, e.number) : e.number;
        if (t < 0.15 + n * 0.05) return;
        const bg: C3 = on ? PICK : [242, 245, 249];
        box(S, 1, y, SW - 2, y, bg, pageBg, 0);
        face(S, 2, y, nm ?? e.number);
        const bad = e.kind === 'missed' || e.kind === 'failed', col: C3 = bad ? [200, 50, 50] : e.kind === 'in' ? BLUE : [40, 150, 80];
        S.text(5, y, e.kind === 'in' || e.kind === 'missed' ? '<' : '>', on ? (bad ? [255, 150, 140] : PICK_INK) : col, bg);
        const c = calendar(e.at), when = `${A.log[e.kind]} ${hhmm(c.hour)}`;
        S.text(7, y, (nm ?? num).slice(0, SW - when.length - 10), on ? PICK_INK : bad ? [170, 40, 40] : INKD, bg);
        S.text(SW - when.length - 2, y, when, on ? PICK_DIM : GREY, bg);
      });
    }
    return softKeys(S, d ? A.save : '', d ? A.clear : T.back);
  }
  const D0: C3 = [26, 44, 70], D1: C3 = [8, 12, 22], dbg = (y: number) => lerp(D0, D1, (y - 1) / (SH - 3));
  vgrad(S, 1, SH - 2, D0, D1);
  const label = who ?? (d.replace(/\D/g, '').length === 7 ? formatNumber(world.telco, d) : d);
  // their picture: a rounded tile in their color, the initials in it
  box(S, 17, 2, 24, 5, [70, 90, 130], dbg, 1, [40, 56, 90]);
  face(S, 20, 3, label);
  S.center(6, label, WHITE, dbg(6));
  if (who) S.center(7, d.replace(/\D/g, '').length === 7 ? formatNumber(world.telco, d) : d, [150, 170, 200], dbg(7));
  const u = Math.max(0, now - (c.connectAt >= 0 ? c.connectAt : now)), tm = `${String(Math.floor(u / 60)).padStart(2, '0')}:${String(Math.floor(u % 60)).padStart(2, '0')}`;
  const state = P.callIn && c.state === 'ringing' ? A.incoming : c.state === 'dialing' ? `${A.calling}${'.'.repeat(Math.floor(now * 3) % 4)}` : c.state === 'ringing' ? `${A.ringing} (${c.rings})` : c.state === 'talk' ? tm : c.reason;
  S.center(9, state, c.state === 'ended' ? BAD : c.state === 'talk' ? [120, 255, 150] : HI, dbg(9));
  if (c.state === 'ended' && !P.callIn && c.cost()) S.center(10, A.cost.replace('{c}', `$${(c.cost() / 100).toFixed(2)}`), [150, 170, 200], dbg(10));
  // ringing in: rings spreading from the picture
  if (P.callIn && c.state === 'ringing') { const r = Math.floor(now * 3) % 3; for (let k = 0; k <= r; k++) { S.put(15 - k * 2, 3, ch(')'), [120, 200, 255], dbg(3)); S.put(26 + k * 2, 3, ch('('), [120, 200, 255], dbg(3)); } }
  // what is said, the latest at the bottom: theirs in white bubbles, recordings in amber
  const rows: [string, C3, C3 | null][] = [];
  for (const L of c.lines) {
    const shown = L.text.slice(0, Math.ceil(((now - L.at) / L.dur) * L.text.length));
    const them = L.who === 'them';
    for (const l of wrap(L.who === 'rec' ? `~ ${shown}` : shown, SW - 6)) rows.push([l, them ? INKD : L.who === 'rec' ? HI : [150, 170, 200], them ? [236, 240, 246] : null]);
    rows.push(['', INKD, null]);
  }
  rows.slice(-(SH - 14)).forEach(([l, col, bub], k) => {
    const y = 12 + k;
    if (bub && l) { for (let x = 1; x < l.length + 3; x++) S.put(x, y, 32, bub, bub); S.text(2, y, l, col, bub); }
    else S.text(2, y, l, col, dbg(y));
  });
  if (P.callIn && c.state === 'ringing') return softKeys(S, A.answer, A.end);
  softKeys(S, '', c.state === 'ended' ? '' : A.end);
}

/** The Phone's two tabs on the title row (Calls, Contacts), the one open lit; left and right switch them. */
function tabs(S: Lcd, x: number, on: number, fg: C3, bg: C3, hi: C3) {
  [A.tabCalls, A.tabContacts].forEach((l, k) => {
    const s = ` ${l} `;
    S.text(x, 1, s, k === on ? [255, 255, 255] : mul(fg, 0.6), k === on ? hi : bg);
    x += s.length + 1;
  });
}

/** Contacts: an address book (cream pages, a brown cover bar, the first letter as a tab); OK calls, New adds one. */
function contacts(S: Lcd, P: Phone, t: number) {
  const PG: C3 = [240, 232, 212], INKC: C3 = [40, 32, 24], TAB: C3 = [170, 120, 70];
  paint(S, PG);
  bar(S, '', [250, 236, 210], [110, 64, 36], A.sim.replace('{n}', String(P.contacts.length)), [210, 180, 150]);
  tabs(S, 1, 1, [250, 236, 210], [110, 64, 36], [220, 140, 60]);
  if (!P.contacts.length) S.center(10, A.noContacts, [140, 120, 100], PG);
  const view = Math.floor((SH - 5) / 2), top = Math.max(0, Math.min(P.csel - view + 1, P.contacts.length - view));
  P.contacts.slice(top, top + view).forEach((c, n) => {
    const k = top + n, sel = k === P.csel, y = 3 + n * 2, bg: C3 = sel ? [110, 64, 36] : PG;
    for (let x = 0; x < SW; x++) S.put(x, y, 32, bg, bg);
    S.put(0, y, ch(c.name[0]?.toUpperCase() ?? '#'), [255, 255, 255], TAB);
    S.text(2, y, typed(c.name, t - 0.04 * n), sel ? [255, 244, 224] : INKC, bg);
    S.text(SW - c.number.length - 1, y, c.number, sel ? [230, 200, 160] : [120, 100, 80], bg);
    for (let x = 2; x < SW - 1; x++) S.put(x, y + 1, ch('.'), [214, 204, 180], PG);
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
  title(S, `${name('contacts').toUpperCase()} +`, 1, E.step === 0 ? P.nameEd.label() : '123');
  if (E.step === 0) typeHint(S, 1, SH - 3, P.nameEd, now, A.modeHint, DIM, LCD); else S.text(1, SH - 3, 'v number', DIM, LCD);
  softKeys(S, E.name && E.number ? A.save : '', (E.step === 0 ? E.name : E.number) ? A.clear : T.back);
}

/** Messages: the boxes as cards (inbox with the unread count, sent, a new message). */
function messages(S: Lcd, P: Phone, t: number) {
  lightPage(S);
  header(S, name('messages'), '', '[=]', [150, 200, 255]);
  const unread = P.inbox.filter((m) => !m.read).length;
  const cards: [string, string, string, C3][] = [['[v]', A.inbox, unread ? `${unread} new` : `${P.inbox.length}`, BLUE], ['[^]', A.sent, `${P.sent.length}`, GREY], ['[+]', A.newMsg, '', [40, 160, 80]], ['[x]', A.clearAll, '', [200, 60, 50]]];
  cards.forEach(([icon, label, count, col], k) => {
    const y = 4 + k * 4, sel = k === P.box, bg: C3 = sel ? [44, 88, 170] : [240, 243, 248], bot: C3 = sel ? PICK : [228, 232, 240], mid = lerp(bg, bot, 0.5);
    if (t < 0.05 * k) return;
    box(S, 1, y, SW - 2, y + 2, bg, pageBg, 1, bot);
    S.text(3, y + 1, icon, sel ? PICK_INK : col, mid);
    S.text(8, y + 1, label, sel ? PICK_INK : INKD, mid);
    if (count) S.text(SW - count.length - 3, y + 1, count, sel ? (unread && k === 0 ? [255, 190, 170] : PICK_DIM) : unread && k === 0 ? [210, 60, 50] : GREY, mid);
  });
  softKeys(S, T.open, T.back);
}

/** Who a message is from (or to): the contact's name when there is one. */
const nameOf = (P: Phone, n: string) => P.contacts.find((c) => c.number === n)?.name ?? n;

/** A box of messages as a list of conversations: the picture, who, when, the first words; unread ones marked. */
function msgList(S: Lcd, P: Phone, t: number) {
  const L = P.box === 0 ? P.inbox.map((m) => [m.from, m.text, m.read, m.at] as const) : P.sent.map((m) => [m.to, m.text, true, m.at] as const);
  lightPage(S);
  header(S, P.box === 0 ? A.inbox : A.sent, `${L.length}`, '[=]', [150, 200, 255]);
  if (!L.length) S.center(10, A.noMsgs, GREY, pageBg(10));
  const per = 3, view = Math.floor((SH - 5) / per), top = Math.max(0, Math.min(P.msel - view + 1, L.length - view));
  L.slice(top, top + view).forEach(([who, text, read, at], n) => {
    const sel = top + n === P.msel, y = 3 + n * per, bg: C3 = sel ? PICK : pageBg(y);
    if (t < 0.04 * n) return;
    if (sel) box(S, 0, y, SW - 1, y + 1, bg, pageBg, 0);
    face(S, 1, y, nameOf(P, who));
    const c = calendar(at), when = `${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${hhmm(c.hour)}`;
    S.text(4, y, nameOf(P, who).slice(0, SW - when.length - 7), sel ? PICK_INK : read ? INKD : BLUE, bg);
    S.text(SW - when.length - 1, y, when, sel ? PICK_DIM : GREY, bg);
    S.text(4, y + 1, text.slice(0, SW - 6), sel ? (read ? PICK_DIM : PICK_INK) : read ? GREY : INKD, sel ? bg : pageBg(y + 1));
    if (!read) S.put(SW - 2, y + 1, SHAPE.dot, sel ? [150, 200, 255] : BLUE, sel ? bg : pageBg(y + 1));
    for (let x = 4; x < SW - 1; x++) S.put(x, y + 2, SHAPE.top, [218, 222, 230], pageBg(y + 2));
  });
  softKeys(S, A.new, T.back);
}

function msgRead(S: Lcd, P: Phone, t: number) {
  const m = P.box === 0 ? P.inbox[P.msel] : null, s2 = P.box === 1 ? P.sent[P.msel] : null;
  const who = m ? m.from : s2?.to ?? '', text = m ? m.text : s2?.text ?? '', at = m ? m.at : s2?.at ?? 0, c = calendar(at);
  const PG: C3 = [214, 222, 232];
  paint(S, PG);
  bar(S, `${P.box === 0 ? A.from : A.to}: ${nameOf(P, who)}`.slice(0, SW - 2), WHITE, [60, 90, 130]);
  S.center(3, `${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${hhmm(c.hour)}`, [110, 120, 136], PG);
  // the message as a bubble: theirs white on the left, the player's green on the right
  const mine = P.box === 1, lines = wrap(text, SW - 10).slice(0, SH - 9), w = Math.max(1, ...lines.map((l) => l.length)) + 2;
  const x0 = mine ? SW - w - 2 : 2, BUB: C3 = mine ? [150, 222, 130] : [250, 250, 252];
  for (let k = -1; k <= lines.length; k++) for (let x = 0; x < w; x++) S.put(x0 + x, 5 + k, 32, BUB, BUB);
  lines.forEach((l, k) => S.text(x0 + 1, 5 + k, typed(l, t - k * 0.05), [24, 28, 34], BUB));
  S.put(mine ? x0 + w : x0 - 1, 5 + lines.length, ch(mine ? '/' : '\\'), BUB, PG);
  softKeys(S, /^[0-9*#]+$/.test(who) ? A.replyK : '', T.back);
}

function compose(S: Lcd, P: Phone, now: number) {
  const D = P.draft, blink = Math.floor(now * 2) & 1, W: C3 = [255, 255, 255];
  lightPage(S);
  header(S, A.newMsg, `${D.step === 1 ? P.smsEd.label() : '123'} ${D.text.length}/160`, '[+]', [120, 230, 150]);
  // the number on a field of its own, the text on a white page; the field being typed in outlined in blue
  box(S, 1, 3, SW - 2, 3, D.step === 0 ? W : [244, 246, 250], pageBg, 0);
  S.text(2, 3, A.to, D.step === 0 ? BLUE : GREY, D.step === 0 ? W : [244, 246, 250]);
  S.text(6, 3, nameOf(P, D.to) + (D.step === 0 && blink ? '_' : ''), INKD, D.step === 0 ? W : [244, 246, 250]);
  const pg: C3 = D.step === 1 ? W : [244, 246, 250];
  box(S, 1, 5, SW - 2, SH - 4, pg, pageBg, 1);
  const lines = wrap(D.text, SW - 4);
  lines.slice(-(SH - 11)).forEach((l, k) => S.text(2, 6 + k, l, INKD, pg));
  if (D.step === 1 && blink) S.put(2 + (lines[lines.length - 1]?.length ?? 0), 6 + Math.max(0, Math.min(lines.length, SH - 11) - 1), ch('_'), BLUE, pg);
  if (!D.text) S.text(2, 6, A.text, GREY, pg);
  if (D.step === 0) S.text(1, SH - 3, '* <-   v text', GREY, pageBg(SH - 3)); else typeHint(S, 1, SH - 3, P.smsEd, now, A.modeHint, GREY, pageBg(SH - 3));
  softKeys(S, D.step === 0 ? T.ok : D.to && D.text ? A.send : '', D.step === 1 && D.text ? A.clear : T.back);
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

/** The calculator: a dark body, the display in big white digits, and its keys drawn as buttons with what they do. */
function calc(S: Lcd, P: Phone, t: number) {
  const BODY: C3 = [38, 38, 42], DISP: C3 = [12, 12, 14], OR: C3 = [255, 150, 30], KEY: C3 = [80, 80, 86];
  paint(S, BODY);
  bar(S, name('calc').toUpperCase(), [220, 220, 225], BODY, P.calc.op, OR);
  for (let y = 3; y <= 11; y++) for (let x = 1; x < SW - 1; x++) S.put(x, y, 32, DISP, DISP);
  const v = P.calc.cur;
  if (v.length <= 6) bigText(S, 4, v, v === 'ERROR' ? BAD : WHITE);
  else S.text(SW - v.length - 2, 8, v, WHITE, DISP);
  // the keys: the arrows are the operations, OK equals, * clears, # the point
  const keys: [string, string, C3][] = [['^', '+', OR], ['v', '-', OR], ['<', 'x', OR], ['>', '/', OR], ['OK', '=', OR], ['*', 'C', [170, 170, 176]], ['#', '.', KEY]];
  keys.forEach(([k, op, col], n) => {
    const x0 = 2 + (n % 4) * 10, y0 = 14 + Math.floor(n / 4) * 4;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 8; x++) S.put(x0 + x, y0 + y, 32, col, col);
    S.text(x0 + 3, y0 + 1, op, n === 6 ? WHITE : [20, 20, 20], col);
    S.text(x0 + 1, y0 + 2, k, n === 6 ? [200, 200, 200] : [70, 40, 10], col);
  });
  void t;
  softKeys(S, '=', T.back);
}

/** Notes: a yellow legal pad (ruled lines, the red margin); the text typed on the keypad (Abc, T9 or 123, see textinput.ts). */
function notes(S: Lcd, P: Phone, t: number, now: number) {
  const PAD: C3 = [252, 238, 150], RULE: C3 = [236, 220, 128], INKN: C3 = [30, 40, 90], RED: C3 = [210, 80, 80];
  paint(S, PAD);
  bar(S, name('notes'), [250, 236, 210], [122, 72, 40], `${P.noteEd.label()} ${P.note.length}/400`, [220, 190, 160]);
  const rowBg = (y: number): C3 => (y % 2 ? PAD : RULE);
  for (let y = 3; y < SH - 2; y++) { for (let x = 0; x < SW; x++) S.put(x, y, 32, rowBg(y), rowBg(y)); S.put(2, y, ch('|'), RED, rowBg(y)); }
  const lines: string[] = [], w = SW - 5;
  for (const para of P.note.split('\n')) { let s2 = para; do { lines.push(s2.slice(0, w)); s2 = s2.slice(w); } while (s2.length); }
  const rows = SH - 6, shown = lines.slice(-rows);
  shown.forEach((l, k) => S.text(4, 3 + k, l, INKN, rowBg(3 + k)));
  const ed = P.noteEd, live = ed.seq ? ed.word().length : ed.tapping(now) ? 1 : 0, last = shown.length ? shown[shown.length - 1] : '', y = 2 + Math.max(1, shown.length);
  for (let n = 0; n < live; n++) { const x = last.length - live + n; if (x >= 0) S.put(4 + x, y, ch(last[x]), PAD, INKN); }
  if (Math.floor(now * 2) & 1 && !live) S.put(4 + last.length, y, ch('_'), INKN, rowBg(y));
  if (!P.note) S.center(10, typed(A.notesHint, t - 0.2), [150, 130, 80], rowBg(10));
  typeHint(S, 1, SH - 2, ed, now, A.modeHint, [140, 120, 70], PAD);
  softKeys(S, '', P.note ? A.clear : T.back);
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
  if (pg === 'wifi') return wifiPage(S, P, world, t);
  if (pg === 'people') return peoplePage(S, P, world, t);
  if (pg === 'usb') {
    // the cable to the notebook: plugged in or not, and what the notebook sees
    const U = SET.usb;
    row(S, 3, U.cable, P.usb ? U.in : U.out, true, t);
    const say = P.usb ? (P.usbLinked ? U.linked : U.waiting) : U.hint;
    say.forEach((l, k) => S.text(1, 6 + k, typed(l, t - 0.1 - 0.05 * k), k ? DIM : INK, LCD));
    return softKeys(S, P.usb ? U.unplug : U.plug, T.back);
  }
  if (pg === 'looks') {
    row(S, 3, SET.rows.shell, `< ${P.maker} ${SHELLS[P.look].name} >`, P.setSel === 0, t);
    row(S, 5, SET.rows.case, `< ${CASES[P.case].name} >`, P.setSel === 1, t - 0.05);
    S.text(1, 8, `${P.looks.length}/${SHELLS.length}  ${CASES.length > 1 ? `${P.cases.length - 1}/${CASES.length - 1}` : ''}`, DIM, LCD);
    S.text(1, 9, SET.looksHint, DIM, LCD);
    return softKeys(S, T.ok, T.back);
  }
  if (pg === 'debug') {
    SET.debugHint.forEach((l, k) => S.text(1, 3 + k, typed(l, t - 0.05 * k), DIM, LCD));
    secretCodes(world.seed).forEach((c, n) => row(S, 7 + n * 2, c.code, A.code[c.kind], n === P.setSel, t - 0.2 - 0.05 * n));
    row(S, 7 + secretCodes(world.seed).length * 2, SET.unlock, '', P.setSel === secretCodes(world.seed).length, t - 0.4);
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
  const net = R.state === 'service' ? operatorName(world.city, world.telco.player.op ?? 0).toUpperCase() : R.state === 'search' ? A.searching : T.noService;
  const rows: [string, string][] = [
    [A.network, net], [A.signal, R.state === 'service' ? `${R.dbm} dBm (${R.bars}/4)` : '-'], [A.cell, site ? `ID ${site.id}` : '-'],
    [A.number, formatNumber(world.telco, acc.number.replace('-', ''))], [A.credit, `$${(acc.credit / 100).toFixed(2)}`], [A.dataLeft, kbText(acc.dataKB)], [A.dataUsed, kbText(acc.usedKB)],
    [A.model, `${P.maker} ${D.model}`], [A.os, D.os], [A.cpu, `${D.cpu} ${D.cpuMHz} MHz`], [A.ram, `${D.ramMB} MB`], [A.flash, `${D.flashMB} MB`],
    [A.display, D.screen], [A.cameraRow, D.cameraMP ? `${D.cameraMP} MP` : T.off], [A.radio, D.radio], [A.wlan, P.wifi.state === 'up' ? `${wifiName(world.city, world.wifi[P.wifi.ap])} ${P.wifi.ip}` : `${D.wlan} ${P.wifi.on ? '' : T.off}`], [A.gps, D.gps], [A.gpsNow, gps], [A.imei, imei],
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

/** (Debug) Who lives in the building next to the player: name, age, what they do, where they are now, their number. */
function peoplePage(S: Lcd, P: Phone, world: World, t: number) {
  const L = P.people.ids, Pop = world.pop, c = world.city;
  if (!L.length) { S.text(1, 3, SET.peopleNone, DIM, LCD); return softKeys(S, '', T.back); }
  S.text(1, 3, `${SET.peopleAt} #${P.people.building} (${L.length})`, DIM, LCD);
  const per = 3, view = Math.floor((SH - 7) / per), top = Math.max(0, Math.min(P.setSel - Math.floor(view / 2), L.length - view));
  const R = PEOPLE.role, D = PEOPLE.doing, roles = [R.worker, R.student, R.retired, R.idle, R.child];
  const doings = [D.asleep, D.home, D.commute, D.work, D.out, D.errand];
  for (let n = 0; n < view && top + n < L.length; n++) {
    const i = L[top + n], y = 5 + n * per, sel = top + n === P.setSel, H = Pop.households[Pop.home[i]];
    const job = Pop.job[i] >= 0 ? workplaceName(c, Pop, Pop.job[i]) : '';
    const W = whereIs(Pop, c, i, world.time), doing = doings[W.doing].replace('{place}', W.biz >= 0 ? businessName(c, W.biz) : '');
    row(S, y, `${citizenName(c, Pop, i)}, ${Pop.age[i]}`.slice(0, SW - 6), `F${H.floor + 1}`, sel, t - 0.04 * n);
    S.text(2, y + 1, typed(`${roles[Pop.role[i]].replace('{place}', job)}`.slice(0, SW - 3), t - 0.04 * n - 0.05), DIM, LCD);
    const num = Pop.mobile[i] ? formatNumber(world.telco, Pop.mobile[i]) : H.line ? `${formatNumber(world.telco, H.line)} H` : '-';
    S.text(2, y + 2, typed(`${doing.slice(0, 16)} ${num}`.slice(0, SW - 3), t - 0.04 * n - 0.1), Pop.role[i] === Role.Child ? DIM : INK, LCD);
  }
  S.center(SH - 3, SET.peopleHint, DIM, LCD);
  softKeys(S, SET.dial, T.back);
}

const kbText = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`);

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

/**
 * A photo in blocks shown on the screen's rows y0..y1: scaled down by averaging its pixels (two per
 * cell), so a big picture keeps its detail instead of skipping rows and columns.
 */
function photoBlocks(S: Lcd, p: Photo, y0: number, y1: number) {
  const rows = y1 - y0, pw = p.w, ph = p.h * 2;
  const k = Math.max(pw / SW, ph / (rows * 2)), dw = Math.floor(pw / k), dh = Math.floor(ph / k / 2), x0 = (SW - dw) >> 1, top = y0 + ((rows - dh) >> 1);
  const px = (x: number, y: number, c: number) => { const q = ((y >> 1) * pw + x) * 4; return y & 1 ? p.bg[q + c] : p.cells[q + 1 + c]; };
  const avg = (sx0: number, sy0: number): C3 => {
    const sx1 = Math.max(sx0 + 1, Math.floor(sx0 + k)), sy1 = Math.max(sy0 + 1, Math.floor(sy0 + k)), o = [0, 0, 0];
    let n = 0;
    // the root of the mean square: small bright lights (signs, lamps, windows) keep their light instead of being averaged into the dark
    for (let y = sy0; y < sy1 && y < ph; y++) for (let x = sx0; x < sx1 && x < pw; x++) { for (let c = 0; c < 3; c++) o[c] += px(x, y, c) ** 2; n++; }
    return [Math.sqrt(o[0] / n), Math.sqrt(o[1] / n), Math.sqrt(o[2] / n)];
  };
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const sx = Math.floor(x * k), a = avg(sx, Math.floor(y * 2 * k)), b = avg(sx, Math.floor((y * 2 + 1) * k));
    S.put(x0 + x, top + y, SHAPE.top, a, b);
  }
  if (!S.hd) return;
  // in HD, each cell's nine pixels over it, each the mean square of the photo's pixels under it (a
  // cell is k photo pixels wide and 2k tall, so an HD pixel is k/HD by 2k/HD of them)
  const fw = k / HD, fh = (2 * k) / HD;
  for (let y = 0; y < dh * HD; y++) for (let x = 0; x < dw * HD; x++) {
    const sx0 = Math.floor(x * fw), sy0 = Math.floor(y * fh), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * fw)), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * fh));
    let r = 0, g = 0, bl = 0, n = 0;
    for (let yy = sy0; yy < sy1 && yy < ph; yy++) for (let xx = sx0; xx < sx1 && xx < pw; xx++) { r += px(xx, yy, 0) ** 2; g += px(xx, yy, 1) ** 2; bl += px(xx, yy, 2) ** 2; n++; }
    if (n) S.pixel(x0 + Math.floor(x / HD), top + Math.floor(y / HD), x % HD, y % HD, Math.sqrt(r / n), Math.sqrt(g / n), Math.sqrt(bl / n));
  }
}

let finder: CharGrid | null = null, finderAt = -1, finderN = 0;
/** The camera: the viewfinder live (15 times a second), a white flash on a shot, how many fit in the storage. */
function cameraScreen(S: Lcd, P: Phone, now: number) {
  if (P.render && (now - finderAt > 1 / 15 || !finder)) { finder = expose(P.render, SW, SH - 2, P.light, finderN++, P.camBlocks, P.camZoom) ?? finder; finderAt = now; }
  if (finder) picture(S, finder.cells, finder.bg, SW, SH - 2, 1, SH - 1);
  if (now - P.shotAt < 0.15) for (let y = 1; y < SH - 1; y++) S.fill(y, WHITE);
  // the frame's corners, the resolution and the photos left
  for (const [x, y, c] of [[1, 2, '+'], [SW - 2, 2, '+'], [1, SH - 3, '+'], [SW - 2, SH - 3, '+']] as const) S.put(x, y, ch(c), WHITE, [0, 0, 0]);
  const left = Math.max(0, Math.floor(P.freeKB() / (P.device.cameraMP * 340)));
  S.text(1, 1, ` ${P.device.cameraMP}MP  ${left} `, WHITE, [0, 0, 0]);
  const mode = `${P.camZoom > 1 ? `${P.camZoom.toFixed(1)}x${P.camZoom > OPTICAL ? 'D' : ''} ` : ''}${P.camFlash ? A.flashOn : A.flashOff}`;
  S.text(SW - mode.length - 2, 1, ` ${mode} `, WHITE, [0, 0, 0]);
  S.text(1, SH - 2, ` ${A.camKeys} `, [200, 200, 200], [0, 0, 0]);
  softKeys(S, `${A.photos} (${P.photos.length})`, T.back);
  S.text((SW - A.shoot.length) >> 1, SH - 1, A.shoot, HI, BAR);
}

/** The photos taken: one at a time, with when it was taken. */
function photosScreen(S: Lcd, P: Phone, t: number) {
  const p: Photo | undefined = P.photos[P.phsel];
  title(S, `${A.photos.toUpperCase()} ${p ? `${P.phsel + 1}/${P.photos.length}` : ''}`, t);
  if (!p) { S.center(10, A.noPhotos, DIM, LCD); return softKeys(S, '', T.back); }
  if (p.blocks) photoBlocks(S, p, 2, SH - 2); else picture(S, p.cells, p.bg, p.w, p.h, 2, SH - 2);
  const c = calendar(p.at);
  S.text(1, SH - 2, `${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${hhmm(c.hour)}  ${p.kb} KB  ${A.del}`, DIM, LCD);
  softKeys(S, '< >', T.back);
}

const ST = A.shop;
const appName = (i: number) => (ST.names as Record<string, string>)[STORE[i][0]];

/** The store: the maker's own shop (dark plum, pink accents); the catalog (size, price, whether it fits over EDGE) and the apps installed; a download's progress. */
function store(S: Lcd, P: Phone, t: number, now: number) {
  const BG: C3 = [30, 18, 42], PINK: C3 = [255, 120, 200], CARD: C3 = [52, 32, 70], PICKC: C3 = [176, 52, 140], TXT: C3 = [240, 226, 250], DIMS: C3 = [160, 130, 180];
  paint(S, BG);
  bar(S, `${P.maker} ${name('store')}`, [255, 255, 255], [70, 30, 90], '', PINK);
  ST.tabs.forEach((tb, k) => S.text(2 + k * 14, 3, k === P.stab ? `[${tb}]` : ` ${tb} `, k === P.stab ? PINK : DIMS, BG));
  const list = P.stab === 0 ? P.catalog() : P.downloads();
  if (!list.length) S.center(10, ST.none, DIMS, BG);
  list.forEach((i, n) => {
    const [id, kb, price] = STORE[i], y = 5 + n * 2, sel = n === P.ssel, bg = sel ? PICKC : CARD, have = P.apps.includes(i);
    for (let x = 1; x < SW - 1; x++) S.put(x, y, 32, bg, bg);
    const right = P.stab === 1 ? '' : have ? ST.installed : `${kb >= 1024 ? `${(kb / 1024).toFixed(0)}MB` : `${kb}KB`} ${price ? `$${(price / 100).toFixed(2)}` : ST.free}`;
    S.text(2, y, typed(appName(i), t - n * 0.04), kb > EDGE_LIMIT_KB && !have ? DIMS : TXT, bg);
    S.text(SW - right.length - 2, y, right, sel ? TXT : have ? PINK : DIMS, bg);
    if (sel && P.stab === 0) S.text(1, SH - 4, (ST.about as Record<string, string>)[id], DIMS, BG);
  });
  const J = P.radio.job;
  if (J?.what.startsWith('app:') && (J.state === 'connecting' || J.state === 'loading')) {
    const f = J.done / J.kb, n = Math.round(f * (SW - 16));
    S.text(1, SH - 3, `${ST.downloading} [${'#'.repeat(n).padEnd(SW - 16, '.')}]`, PINK, BG);
  } else if (P.storeNote) S.text(1, SH - 3, (ST.notes as Record<string, string>)[P.storeNote], BAD, BG);
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
    // the green screen of the old phones, dark pixels on it
    const G = P.snake, x0 = 1, y0 = 3, GR: C3 = [150, 178, 84], PX: C3 = [36, 48, 22];
    paint(S, GR);
    bar(S, `${ST.score} ${G.score}  ${ST.best} ${G.best}`, PX, [132, 160, 70]);
    for (let y = -1; y <= SNAKE_H; y++) for (let x = -1; x <= SNAKE_W; x++) if (x < 0 || y < 0 || x === SNAKE_W || y === SNAKE_H) S.put(x0 + x, y0 + y, 32, PX, PX);
    S.put(x0 + G.food[0], y0 + G.food[1], ch('o'), PX, GR);
    G.body.forEach(([x, y], n) => S.put(x0 + x, y0 + y, n ? 32 : ch('@'), GR, n ? PX : GR));
    if (G.over) { S.center(10, ` ${ST.gameOver} `, GR, PX); S.center(12, ` ${ST.again} `, PX, GR); }
    return softKeys(S, '', T.back);
  }
  if (id === 'social') {
    const J = P.radio.job;
    return drawWire(S, P, world, now, J?.what === 'social' && (J.state === 'connecting' || J.state === 'loading'));
  }
  if (id === 'news') {
    const J = P.radio.job;
    return newsApp(S, P, world, t, J?.what === 'news' && (J.state === 'connecting' || J.state === 'loading'));
  }
  if (id === 'bank') return bankApp(S, P, world, t);
  if (id === 'tunes') return tunesApp(S, P, t, now);
  if (id === 'reynard') return drawRey(S, P, world, t, now);
  if (id === 'web') return P.web.draw(S, now);
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

const BK = A.bank;
/**
 * The bank's app, in the bank's own colors (a deep green bar, gold, a cream page): the account and
 * its balance, the statement, a top-up of the phone's credit from the account, and the branch (where
 * it is, its hours, its number). Nothing shows until the account has come down over the network.
 */
/** Kilobytes a second of the MP3s of 2008 (128 kbps): every song's size is its length at that rate, whatever the file really is (2026-10-06). */
const MP3_KBS = 128 / 8;
/** The songs' lengths (s), compiled once. */
const trackSecs = new Map<number, number>();
/** A song of the Tunes Player by its place on the list: its title, band and size on the phone (-1: not known yet). */
export function songInfo(P: Phone, i: number): { title: string; band: string; kb: number } {
  if (i < TRACKS.length) {
    const s = (SONGS as Record<string, { band: string; title: string }>)[TRACKS[i].id];
    let secs = trackSecs.get(i);
    if (secs === undefined) { const c = compile(TRACKS[i]); secs = c.steps * c.stepS; trackSecs.set(i, secs); }
    return { ...s, kb: Math.round(secs * MP3_KBS) };
  }
  const f = P.sd[i - TRACKS.length];
  return { title: f.name.replace(/\.[^.]+$/, ''), band: TN.sd, kb: f.secs ? Math.round(f.secs * MP3_KBS) : -1 };
}
/** The visualizer's falling peaks, and when they were last moved. */
const peaks = new Float32Array(32);
let peaksAt = 0;
/**
 * A spectrum visualizer as the players of 2008 had (2026-10-06): a bar a band in a dark well, green at
 * the foot to yellow and red at the top, with a peak that falls slowly; w x rows cells from (x, y).
 * In HD (2026-10-06, second pass) the well has rounded corners and each bar is drawn in pixels, its top
 * pixel lit by how far into it the level reaches, so it moves smoothly instead of a cell at a time.
 */
export function drawSpectrum(S: Lcd, x: number, y: number, w: number, rows: number, spec: Float32Array, now: number, bg: (y: number) => C3) {
  const dt = Math.min(0.2, Math.max(0, now - peaksAt)); peaksAt = now;
  for (let k = 0; k < spec.length; k++) peaks[k] = Math.max(spec[k], peaks[k] - dt * 0.5);
  if (S.hd) {
    const W = w * HD, H = rows * HD, n = spec.length, bw = 4, x0 = (W - (n * bw - 1)) >> 1;
    const px = (X: number, Y: number, c: C3) => S.pixel(x + Math.floor(X / HD), y + Math.floor(Y / HD), X % HD, Y % HD, c[0], c[1], c[2]);
    for (let r = 0; r < rows; r++) for (let c = 0; c < w; c++) S.put(x + c, y + r, 32, bg(y + r), bg(y + r));
    // the well: darker than the panel, its corners rounded (the corner pixel gone, its neighbours half)
    const well = (Y: number) => mul(bg(y + Math.floor(Y / HD)), 0.45);
    const corner = (X: number, Y: number) => { const cx = Math.min(X, W - 1 - X), cy = Math.min(Y, H - 1 - Y); return cx + cy === 0 ? 0 : cx + cy === 1 ? 0.5 : 1; };
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const k = Math.floor((X - x0) / bw), inBar = X >= x0 && k < n && (X - x0) % bw < bw - 1;
      const f = 1 - (Y + 0.5) / H, base: C3 = f < 0.5 ? lerp([60, 220, 110], [240, 220, 70], f * 2) : lerp([240, 220, 70], [255, 80, 60], (f - 0.5) * 2);
      let c = well(Y);
      if (inBar) {
        const i = H - 1 - Y, lit = Math.max(0, Math.min(1, spec[k] * H - i)), pk = Math.min(H - 1, Math.floor(peaks[k] * H));
        // the unlit LEDs faint; the falling peak a pale pixel; the lit ones from green to red
        c = lit > 0 ? lerp(mul(base, 0.22), base, lit) : i === pk && pk > 0 ? [215, 215, 232] : mul(base, 0.16);
      }
      const v = corner(X, Y);
      if (v) px(X, Y, v === 1 ? c : lerp(bg(y + Math.floor(Y / HD)), c, v));
    }
    return;
  }
  // in characters: two cells a band (as many bands as fit), in quarter blocks
  const COL: C3[] = [[90, 230, 120], [240, 220, 80], [255, 90, 70]];
  const Q = [SHAPE.q1, SHAPE.bottom, SHAPE.q3, BLOCK.full], m = Math.floor(w / 2);
  for (let j = 0; j < m; j++) {
    const k = Math.floor((j * spec.length) / m), v = spec[k] * rows * 4, pk = peaks[k] * rows * 4;
    for (let r = 0; r < rows; r++) {
      const yy = y + rows - 1 - r, q = Math.min(4, Math.max(0, Math.round(v - r * 4)));
      const col = COL[Math.min(2, Math.floor((r / rows) * 3))];
      if (q > 0) S.put(x + j * 2, yy, Q[q - 1], col, bg(yy));
      else if (pk > 0.5 && Math.min(rows - 1, Math.floor(pk / 4)) === r) S.put(x + j * 2, yy, SHAPE.top, [200, 200, 220], bg(yy));
      else S.put(x + j * 2, yy, ch('.'), mul(bg(yy), 1.6), bg(yy));
    }
  }
}
/**
 * The volume (2026-10-06): ten little bars rising left to right, drawn in the lower part of the row so
 * they stand apart from a line above; the lit ones in `acc`. In characters, a row of blocks and dots.
 */
export function volBars(S: Lcd, x: number, y: number, vol: number, acc: C3, grey: C3, bg: C3) {
  const v = Math.round(vol * 10);
  if (!S.hd) { for (let k = 0; k < 10; k++) S.put(x + k, y, k < v ? BLOCK.full : ch('.'), k < v ? acc : grey, bg); return; }
  for (let k = 0; k < 10; k++) S.put(x + k, y, 32, bg, bg);
  // ten bars 2 px wide with a 1 px gap (30 px = ten cells), from 1 px tall to the row's height less one
  for (let k = 0; k < 10; k++) {
    const h = 1 + Math.round((k / 9) * (HD - 2)), c = k < v ? acc : mul(grey, 0.6);
    for (let i = 0; i < 2; i++) for (let Y = HD - h; Y < HD; Y++) { const X = k * 3 + i; S.pixel(x + Math.floor(X / HD), y, X % HD, Y, c[0], c[1], c[2]); }
  }
}
const TN = A.tunes;
/** The song's place on row y from x0 to x1: playing or paused, a bar of how far in, the time and the length. */
export function progress(S: Lcd, x0: number, x1: number, y: number, P: Phone, acc: C3, grey: C3, ink: C3, bg: C3) {
  const T2 = P.tn, mm = (v: number) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
  const time = `${mm(T2.at)}/${mm(T2.len)}`, w = x1 - x0 - 3 - time.length, f = T2.len > 0 ? Math.min(1, T2.at / T2.len) : 0;
  S.text(x0, y, T2.playing ? '>' : '"', acc, bg);
  // in HD: a thin track (a pixel tall) with the played part thicker in the accent, and a knob where it is
  if (S.hd) {
    const W = w * HD, at = Math.round(f * (W - 1));
    for (let k = 0; k < w; k++) S.put(x0 + 2 + k, y, 32, bg, bg);
    for (let X = 0; X < W; X++) for (let Y = 0; Y < HD; Y++) {
      const c: C3 | null = X === at ? [245, 235, 255] : X < at ? (Y === 1 || Y === 2 ? acc : null) : Y === 1 ? grey : null;
      if (c) S.pixel(x0 + 2 + Math.floor(X / HD), y, X % HD, Y, c[0], c[1], c[2]);
    }
  } else for (let k = 0; k < w; k++) S.put(x0 + 2 + k, y, k < Math.round(f * w) ? BLOCK.full : ch('-'), k < Math.round(f * w) ? acc : grey, bg);
  S.text(x1 - time.length, y, time, ink, bg);
}
/**
 * The Tunes Player (15.9c): what plays on a panel at the top (title, band, how far in, the volume) and
 * the songs below, those that came with it and then the SD card's; where the sound comes out at the right of the bar.
 */
function tunesApp(S: Lcd, P: Phone, t: number, now: number) {
  const BG0: C3 = [34, 16, 48], BG1: C3 = [10, 5, 16], ACC: C3 = [200, 130, 255], INK2: C3 = [232, 218, 250], GREY: C3 = [130, 110, 150], PANEL: C3 = [58, 30, 80];
  const T2 = P.tn, bg = (y: number) => lerp(BG0, BG1, (y - 1) / (SH - 3));
  vgrad(S, 1, SH - 2, BG0, BG1);
  bar(S, (ST.names as Record<string, string>).tunes.toUpperCase(), ACC, [20, 8, 30], P.earphones ? TN.phones : TN.speaker, GREY);
  // the panel: what plays, its spectrum dancing under the title
  box(S, 1, 3, SW - 2, 10, PANEL, bg, 1, [40, 20, 58]);
  const pbg = (y: number) => lerp(PANEL, [40, 20, 58], (y - 3) / 7);
  if (T2.cur < 0) S.text(3, 4, typed(TN.idle, t), GREY, pbg(4));
  else {
    const s = songInfo(P, T2.cur);
    S.text(3, 4, typed(s.title.slice(0, SW - 6), t), INK2, pbg(4));
    S.text(3, 5, typed(s.band.slice(0, SW - 6), t - 0.05), GREY, pbg(5));
    drawSpectrum(S, 3, 6, SW - 6, 3, P.spec, now, pbg);
    progress(S, 3, SW - 3, 9, P, ACC, GREY, INK2, pbg(9));
  }
  // the volume, as ten little bars rising
  S.text(3, 11, 'VOL', GREY, bg(11));
  volBars(S, 7, 11, T2.vol, ACC, GREY, bg(11));
  if (T2.shuffle) S.text(19, 11, TN.shuffle, ACC, bg(11));
  S.text(SW - 16, 11, TN.keys, GREY, bg(11));
  // the list: a heading before each part, the picked row lit, kept in sight
  const rows: [string, number][] = [[TN.songs, -1], ...TRACKS.map((_, i): [string, number] => ['', i]), [TN.sd, -1], ...(P.sd.length ? P.sd.map((_, i): [string, number] => ['', TRACKS.length + i]) : [[TN.sdEmpty, -2] as [string, number]])];
  const top = 13, h = SH - 3 - top, at = rows.findIndex(([, i]) => i === T2.sel), off = Math.max(0, Math.min(rows.length - h, at - (h >> 1)));
  rows.slice(off, off + h).forEach(([label, i], r) => {
    const y = top + r;
    if (i === -1) { S.text(1, y, label, ACC, bg(y)); for (let x = label.length + 2; x < SW - 1; x++) S.put(x, y, ch('-'), [70, 40, 90], bg(y)); return; }
    if (i === -2) { S.text(3, y, label, GREY, bg(y)); return; }
    const s = songInfo(P, i), sel = i === T2.sel, rb: C3 = sel ? [90, 46, 120] : bg(y);
    if (sel) S.fill(y, rb);
    const size = s.kb < 0 ? '--' : s.kb >= 1024 ? TN.mb.replace('{n}', (s.kb / 1024).toFixed(1)) : TN.kb.replace('{n}', String(s.kb));
    S.text(1, y, i === T2.cur ? (T2.playing ? '>' : '"') : ' ', ACC, rb);
    S.text(3, y, typed(`${s.title}${i < TRACKS.length ? ` - ${s.band}` : ''}`.slice(0, SW - 6 - size.length), t - 0.1 - r * 0.02), sel ? [255, 255, 255] : INK2, rb);
    S.text(SW - 1 - size.length, y, size, GREY, rb);
  });
  softKeys(S, T2.cur === T2.sel && T2.playing ? TN.pause : TN.play, T.back);
}

function bankApp(S: Lcd, P: Phone, world: World, t: number) {
  const GREEN: C3 = [18, 64, 48], GOLD: C3 = [236, 200, 112], PAGE: C3 = [242, 238, 226], INK2: C3 = [34, 38, 34], GREY: C3 = [120, 122, 112], RED: C3 = [170, 40, 40], OK2: C3 = [30, 120, 60];
  const { city } = world, Acc = world.bank, B = P.bk, J = P.radio.job, op = operatorName(city, world.telco.player.op ?? 0);
  paint(S, PAGE);
  bar(S, P.bankName.toUpperCase().slice(0, SW - 4), GOLD, GREEN, '$$', GOLD);
  if (!B.ok) {
    const busy = J?.what === 'bank' && (J.state === 'connecting' || J.state === 'loading');
    if (busy) {
      S.center(10, typed(BK.connecting, t), INK2, PAGE);
      const n = Math.round((J!.done / J!.kb) * 20);
      S.center(12, `[${'#'.repeat(n).padEnd(20, '.')}]`, GREEN, PAGE);
    } else BK.offline.forEach((l, k) => S.center(10 + k, l, GREY, PAGE));
    return softKeys(S, busy ? '' : T.ok, T.back);
  }
  const date = (at: number) => { const c = calendar(at); return `${String(c.month).padStart(2, '0')}/${String(c.day).padStart(2, '0')}`; };
  const corner = (k: number) => {
    const Bd = city.buildings[city.businesses[k].building], x = (Bd.x0 + Bd.x1) / 2, y = (Bd.y0 + Bd.y1) / 2;
    return [`${roadName(city, true, nearestRoad(city.xb, city.xCell, x))} &`, roadName(city, false, nearestRoad(city.yb, city.yCell, y)), districtName(city, districtAt(city, x, y))];
  };
  if (B.view === 'home') {
    S.text(2, 3, typed(`${BK.checking} ****${Acc.number.slice(-4)}`, t), GREY, PAGE);
    S.text(2, 5, typed(BK.balance, t - 0.1), INK2, PAGE);
    S.text(2, 6, typed(money(Acc.balance), t - 0.15), GREEN, PAGE);
    S.text(2, 7, typed(BK.asOf.replace('{t}', hhmm(calendar(world.time).hour)), t - 0.2), GREY, PAGE);
    BK.menu.forEach((m, n) => {
      const sel = n === B.sel, bg: C3 = sel ? GREEN : PAGE;
      S.fill(10 + n * 2, bg);
      S.text(2, 10 + n * 2, typed(m, t - 0.25 - n * 0.05), sel ? GOLD : INK2, bg);
      S.text(SW - 3, 10 + n * 2, '>', sel ? GOLD : GREY, bg);
    });
    return softKeys(S, T.ok, T.back);
  }
  if (B.view === 'stmt') {
    S.text(1, 2, BK.stmt, GREEN, PAGE);
    const L = Acc.ledger, rows = SH - 6, top = Math.max(0, Math.min(B.sel - (rows >> 1), L.length - rows));
    for (let n = 0; n < rows && top + n < L.length; n++) {
      const e = L[L.length - 1 - (top + n)], y = 4 + n, sel = top + n === B.sel, bg: C3 = sel ? [222, 230, 214] : PAGE;
      const what = (BK.kinds as Record<string, string>)[e.kind].replace('{biz}', e.kind === 'card' || e.kind === 'atm' ? businessName(city, e.ref) : '').replace('{op}', op);
      const amt = `${e.amount > 0 ? '+' : ''}${money(e.amount)}`;
      S.fill(y, bg);
      S.text(1, y, date(e.at), GREY, bg);
      S.text(7, y, what.slice(0, SW - 9 - amt.length), INK2, bg);
      S.text(SW - amt.length - 1, y, amt, e.amount > 0 ? OK2 : INK2, bg);
    }
    return softKeys(S, '', T.back);
  }
  if (B.view === 'topup') {
    S.text(1, 2, BK.topupTitle.replace('{op}', op.toUpperCase()).slice(0, SW - 2), GREEN, PAGE);
    S.text(2, 4, BK.credit, GREY, PAGE); S.text(SW - money(world.telco.player.credit).length - 2, 4, money(world.telco.player.credit), INK2, PAGE);
    S.text(2, 5, BK.balance, GREY, PAGE); S.text(SW - money(Acc.balance).length - 2, 5, money(Acc.balance), INK2, PAGE);
    TOPUPS.forEach((c, n) => {
      const sel = n === B.sel, bg: C3 = sel ? GREEN : PAGE;
      S.fill(8 + n * 2, bg);
      S.text(2, 8 + n * 2, money(c), sel ? GOLD : INK2, bg);
    });
    const busy = J?.what.startsWith('banktop:') && (J.state === 'connecting' || J.state === 'loading');
    if (busy) S.text(2, SH - 4, BK.paying, GREY, PAGE);
    else if (B.note) S.text(2, SH - 4, (BK.notes as Record<string, string>)[B.note], B.note === 'done' ? OK2 : RED, PAGE);
    return softKeys(S, busy ? '' : BK.pay, T.back);
  }
  // the branch where the account is, and the head office
  const k = Acc.branch, chain = city.banks[Acc.bank], hq = chain.hq;
  S.text(1, 2, BK.branch, GREEN, PAGE);
  corner(k).forEach((l, n) => S.text(2, 4 + n, typed(l.slice(0, SW - 4), t - n * 0.05), INK2, PAGE));
  S.text(2, 8, BK.hours, GREY, PAGE);
  S.text(2, 9, formatNumber(world.telco, world.telco.bizNum[k]), INK2, PAGE);
  if (hq !== k) {
    S.text(2, 12, BK.hq, GREEN, PAGE);
    corner(hq).forEach((l, n) => S.text(2, 13 + n, l.slice(0, SW - 4), INK2, PAGE));
  } else S.text(2, 12, BK.isHq, GREEN, PAGE);
  S.text(2, 17, BK.branches.replace('{n}', String(chain.branches.length)), GREY, PAGE);
  S.text(2, SH - 4, BK.callHint, GREY, PAGE);
  softKeys(S, '', T.back);
}

const WF = A.wifi;
/** Wi-Fi: on or off, the networks around with their signal and lock, the one joined; for now the selected one's key shows (debug). */
function wifiPage(S: Lcd, P: Phone, world: World, t: number) {
  const W = P.wifi;
  row(S, 3, WF.wifi, `< ${W.on ? WF.on : WF.off} >`, P.setSel === 0, t);
  const st = W.state === 'assoc' ? WF.assoc : W.state === 'dhcp' ? WF.dhcp : W.state === 'badkey' ? WF.badKey : W.state === 'up' ? `${WF.up} ${W.ip}` : '';
  if (st) S.text(1, 4, st.slice(0, SW - 2), W.state === 'badkey' ? BAD : W.state === 'up' ? [120, 255, 150] : HI, LCD);
  if (W.on && !W.list.length) S.center(10, WF.none, DIM, LCD);
  W.list.slice(0, 8).forEach(([i, dbm], n) => {
    const A = world.wifi[i], bars = [-85, -76, -67, -58].reduce((c, b) => (dbm >= b ? c + 1 : c), 0);
    const mark = i === W.ap && W.state === 'up' ? '>' : ' ', lock = A.sec === Sec.Open ? ' ' : A.sec === Sec.WEP ? 'w' : '*';
    row(S, 6 + n * 2, `${mark}${wifiName(world.city, A)}`.slice(0, SW - 9), `${lock} ${'|'.repeat(bars).padEnd(4, '.')}`, P.setSel === n + 1, t - 0.04 * n);
  });
  // (debug) the picked network's key
  const sel = W.list[P.setSel - 1];
  if (DEBUG.showWifiKey && sel) { const A = world.wifi[sel[0]]; S.text(1, SH - 3, `${WF.debugKey} ${A.sec === Sec.Open ? WF.openNet : A.key}`, DIM, LCD); }
  softKeys(S, P.setSel === 0 ? T.ok : WF.join, T.back);
}

/** Typing a network's key. */
function wifiKey(S: Lcd, P: Phone, world: World, now: number) {
  const A = world.wifi[P.wkey.ap];
  title(S, WF.keyTitle, 1);
  S.text(1, 4, wifiName(world.city, A), WHITE, LCD);
  S.text(1, 5, A.sec === Sec.WEP ? 'WEP' : 'WPA-PSK', DIM, LCD);
  S.text(1, 8, WF.key, HI, LCD);
  S.text(1, 9, '*'.repeat(Math.max(0, P.wkey.key.length - 1)) + P.wkey.key.slice(-1) + (Math.floor(now * 2) & 1 ? '_' : ''), WHITE, LCD);
  if (DEBUG.showWifiKey) S.text(1, SH - 4, `${WF.debugKey} ${A.key}`, DIM, LCD);
  S.text(1, SH - 3, '0-9   * <-', DIM, LCD);
  softKeys(S, P.wkey.key ? WF.join : '', T.back);
}
