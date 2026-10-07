import { hash3 } from '../core/rng';
import { businessName, citizenName, districtName, operatorName, roadName, wifiName, workplaceName } from '../locale/names';
import { districtAt, nearestRoad } from '../sim/city';
import { drawWire } from './wire';
import { drawCalendar } from './calendar';
import { newsApp, weatherApp } from './skins';
import PEOPLE from '../locale/people.en.json';
import { whereIs } from '../sim/citizens';
import { Sec } from '../sim/wifi';
import { DEBUG } from '../debug';
import { calendar } from '../sim/clock';
import { formatNumber } from '../sim/telco';
import { type World } from '../sim/world';
import { BAR, BAD, ch, DIM, HI, hhmm, INK, LCD, type Lcd, MONTHS, SEL, SH, softKeys, SW, T, title, WHITE, type C3 } from './lcd';
import { VIEW_LIGHT } from '../render/raycaster';
import { secretCodes } from './codes';
import { freeVoucher } from './ussd';
import { expose, OPTICAL, type Photo } from './camera';
import { type CharGrid } from '../render/grid';
import { CONVERT, SNAKE_H, SNAKE_W } from './store';
import { APP_COL, INK as PINK_INK, paintBank, type BankPage, type BankView, paintCalc, paintList, paintMenu, paintNotes, paintStore, edHint, type ListPage, type Row, type Tile, type TunesPage } from './pixpages';
import { type Paint } from '../render/paint2d';
import { EDGE_LIMIT_KB, money, STORE, TOPUPS, fmtDist, PREF_ROWS, SET_PAGES, type App, type Key, type Phone } from './phone';
import { HD } from '../render/hd';
import { artColors } from './hdicons';
import { mul } from './ui';
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
/** An app's name on the menu (the screens drawn in pixels). */
export const appLabel = name;

/** Each app's icon: a symbol, its tile's color, the symbol's color. */
const ICON: Record<App, [string, C3, C3]> = {
  map: ['+N', [56, 150, 80], [255, 255, 255]], calls: [')))', [40, 170, 90], [255, 255, 255]], contacts: ['@', [220, 140, 60], [255, 255, 255]], messages: ['[=]', [60, 120, 210], [255, 255, 255]],
  camera: ['[o]', [90, 94, 104], [230, 235, 245]], wire: ['sw', [38, 62, 120], [255, 170, 60]], news: ['NEWS', [236, 228, 208], [24, 20, 16]], weather: ['\\o/', [70, 150, 230], [255, 230, 110]],
  calendar: ['31', [240, 240, 244], [210, 50, 50]], bank: ['$$', [22, 70, 52], [235, 200, 110]], calc: ['+-', [56, 56, 62], [255, 150, 30]], notes: ['~~', [250, 230, 120], [40, 50, 110]],
  folder: ['[_]', [200, 150, 60], [255, 245, 220]], store: ['$', [110, 50, 130], [255, 140, 210]], settings: ['<o>', [120, 126, 140], [255, 255, 255]],
  tunes: ['d', [130, 60, 170], [255, 220, 255]], web: ['(o)', [74, 44, 26], [241, 228, 200]],
};
/** The icons of apps from the store. */
const STORE_ICON: Record<string, [string, C3, C3]> = {
  torch: ['*', [230, 200, 60], [255, 255, 255]], convert: ['<>', [40, 150, 150], [255, 255, 255]], tunes: ICON.tunes, atlas: ['3D', [60, 130, 90], [255, 255, 255]],
  snake: ['~o', [150, 178, 84], [36, 48, 22]], news: ICON.news, social: ICON.wire, bank: ICON.bank, web: ICON.web, reynard: ['^.^', [34, 30, 28], [232, 112, 44]],
};
/** A screen drawn in pixels (pixpages.ts): what paints it. */
type Pg = (Pt: Paint) => void;
/** The apps besides those draw.ts picks itself; those drawn in pixels return their painter, the rest draw on the cells. */
export function app(S: Lcd, P: Phone, world: World, t: number, now: number): Pg | void {
  switch (P.screen as App) {
    case 'camera': return cameraScreen(S, P, now);
    case 'calendar': return drawCalendar(S, P, world, now);
    case 'weather': return weatherApp(S, P, world, t, now);
    case 'store': return store(S, P, t);
    case 'calc': return calc(S, P);
    case 'notes': return notes(S, P, t, now);
    case 'settings': return settings(S, P, world, t);
    default:
      if (P.screen === 'code') return service(S, P, world, t, now);
      if (P.screen === 'ussd') return ussdScreen(S, P, now);
      if (P.screen === 'photos') return photosScreen(S, P, t);
      if (P.screen === 'app') return appScreen(S, P, world, t, now);
      if (P.screen === 'wifikey') return wifiKey(S, P, world, now);
      if (P.screen === 'folder') return folder(S, P, t);
  }
}

/** The colour of the settings' header, and a list page with it. */
const SET_COL = APP_COL[15];
const listPage = (d: Omit<ListPage, 'col'> & { col?: ListPage['col'] }): Pg => (Pt) => paintList(Pt, { col: SET_COL, ...d });

/** My Apps: the apps downloaded from the store, on a grid as the menu's, under a header. */
function folder(S: Lcd, P: Phone, t: number): Pg {
  const L = P.downloads();
  const tiles = L.map((i, n): Tile => ({ label: appName(i), col: (STORE_ICON[STORE[i][0]] ?? ICON.store)[1], art: artColors(STORE[i][0] === 'social' ? 'wire' : STORE[i][0]), sel: n === P.fsel, pre: () => { P.fsel = n; } }));
  softKeys(S, L.length ? T.open : '', T.back);
  return (Pt) => paintMenu(Pt, tiles, t, { title: name('folder'), note: `${L.length}`, col: APP_COL[APPS_FOLDER], empty: A.set.noDownloads });
}
const APPS_FOLDER = 13;

/** The operator's service menu: "running" for a moment, then its text and, on a menu, the answer being typed. */
function ussdScreen(S: Lcd, P: Phone, now: number): Pg {
  const U = P.us, run = now - U.at < 1.4;
  const rows: Row[] = run ? [{ kind: 'text', label: `${A.running}${'.'.repeat(Math.floor(now * 3) % 4)}` }]
    : U.text.split('\n').flatMap((l) => wrap(l, 36)).map((l, k): Row => ({ kind: 'text', label: l, col: k === 0 ? [143, 211, 255] : PINK_INK }));
  if (!run && U.menu) rows.push({ kind: 'field', label: `${A.reply} ${U.input}${Math.floor(now * 2) & 1 ? '_' : ''}`, sel: true });
  softKeys(S, run ? '' : U.menu ? (U.input ? A.send : '') : T.ok, T.back);
  return listPage({ title: U.code, note: '', rows, t: run ? 9 : now - U.at - 1.4 });
}

/** The calculator: the display, and the operations as buttons on the glass (the numbers come from the keypad). */
function calc(S: Lcd, P: Phone): Pg {
  const v = P.calc.cur;
  softKeys(S, '=', T.back);
  return (Pt) => paintCalc(Pt, { title: name('calc'), value: v, op: P.calc.op, err: v === 'ERROR', hint: A.calcType,
    keys: [['+', 'up', '^'], ['-', 'down', 'v'], ['x', 'left', '<'], ['/', 'right', '>'], ['C', '*', '*'], ['.', '#', '#'], ['=', 'ok', 'OK']].map(([sym, key, hint]) => ({ sym, key: key as Key, hint, kind: sym === 'C' ? 'clear' as const : sym === '.' ? 'point' as const : 'op' as const })) });
}

/** Notes: the legal pad, the text typed on the keypad (Abc, T9 or 123, see textinput.ts). */
function notes(S: Lcd, P: Phone, t: number, now: number): Pg {
  const ed = P.noteEd, live = ed.seq ? ed.word().length : ed.tapping(now) ? 1 : 0;
  softKeys(S, '', P.note ? A.clear : T.back);
  return (Pt) => paintNotes(Pt, { title: name('notes'), note: `${ed.label()} ${P.note.length}/400`, text: P.note, live, blink: (Math.floor(now * 2) & 1) === 1, empty: A.notesHint, hint: edHint(ed, now, A.modeHint), t });
}

const SET = A.set;
/** Settings: the list of pages, the pages of options, about the phone, the cable, Wi-Fi, and the debug pages. */
function settings(S: Lcd, P: Phone, world: World, t: number): Pg {
  const pg = P.setPage, pick = (n: number) => () => { P.setSel = n; };
  if (pg === 'root') {
    softKeys(S, T.open, T.back);
    return listPage({ title: name('settings'), note: '', t, rows: SET_PAGES.map((p, n): Row => ({ kind: 'go', label: SET.pages[p as keyof typeof SET.pages], sel: n === P.setSel, pre: pick(n) })) });
  }
  const title = SET.pages[pg];
  if (pg === 'about') { softKeys(S, '', T.back); return listPage({ title, note: '', t, rows: about(P, world) }); }
  if (pg === 'wifi') return wifiPage(S, P, world, t);
  if (pg === 'people') return peoplePage(S, P, world, t);
  if (pg === 'usb') {
    // the cable to the notebook: plugged in or not, and what the notebook sees
    const U = SET.usb, say = P.usb ? (P.usbLinked ? U.linked : U.waiting) : U.hint;
    softKeys(S, P.usb ? U.unplug : U.plug, T.back);
    return listPage({ title, note: '', t, rows: [{ kind: 'pick', label: U.cable, value: P.usb ? U.in : U.out, col: P.usb ? [120, 255, 150] : undefined, sel: true, key: 'ok' }, { kind: 'text', label: '' },
      ...say.map((l, k): Row => ({ kind: 'text', label: l, col: k ? undefined : PINK_INK }))] });
  }
  if (pg === 'looks') {
    softKeys(S, T.ok, T.back);
    return listPage({ title, note: '', t, foot: SET.looksHint, rows: [
      { kind: 'opt', label: SET.rows.shell, value: `${P.maker} ${SHELLS[P.look].name}`, sel: P.setSel === 0, pre: pick(0) },
      { kind: 'opt', label: SET.rows.case, value: CASES[P.case].name, sel: P.setSel === 1, pre: pick(1) },
      { kind: 'text', label: '' }, { kind: 'text', label: `${P.looks.length}/${SHELLS.length}  ${CASES.length > 1 ? `${P.cases.length - 1}/${CASES.length - 1}` : ''}` }] });
  }
  if (pg === 'debug') {
    const C = secretCodes(world.seed);
    softKeys(S, SET.dial, T.back);
    return listPage({ title, note: '', t, rows: [...SET.debugHint.map((l): Row => ({ kind: 'text', label: l })), { kind: 'text', label: '' },
      ...C.map((c, n): Row => ({ kind: 'pick', label: c.code, value: A.code[c.kind], sel: n === P.setSel, pre: pick(n) })),
      { kind: 'pick', label: SET.unlock, sel: P.setSel === C.length, pre: pick(C.length) },
      { kind: 'text', label: '' }, { kind: 'text', label: A.voucher }, { kind: 'text', label: freeVoucher(world), col: PINK_INK }] });
  }
  softKeys(S, T.ok, T.back);
  return listPage({ title, note: '', t, foot: SET.hint, rows: PREF_ROWS[pg].map((key, n): Row => ({ kind: 'opt', label: SET.rows[key], value: SET.values[key][P.prefs[key]], sel: n === P.setSel, pre: pick(n) })) });
}

/** About the phone: its hardware, its radios, and what the GPS is doing. */
function about(P: Phone, world: World): Row[] {
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
  return rows.map(([k, v]): Row => ({ kind: 'info', label: k, value: v, col: v === T.noService || v.endsWith(T.off) ? BAD : undefined }));
}

/** (Debug) Who lives in the building next to the player: name, age, what they do, where they are now, their number. */
function peoplePage(S: Lcd, P: Phone, world: World, t: number): Pg {
  const L = P.people.ids, Pop = world.pop, c = world.city, title = SET.pages.people;
  if (!L.length) { softKeys(S, '', T.back); return listPage({ title, note: '', t, rows: [{ kind: 'text', label: SET.peopleNone }] }); }
  const R = PEOPLE.role, D = PEOPLE.doing, roles = [R.worker, R.student, R.retired, R.idle, R.child];
  const doings = [D.asleep, D.home, D.commute, D.work, D.out, D.errand];
  const rows = L.map((i, n): Row => {
    const H = Pop.households[Pop.home[i]], job = Pop.job[i] >= 0 ? workplaceName(c, Pop, Pop.job[i]) : '';
    const W = whereIs(Pop, c, i, world.time), doing = doings[W.doing].replace('{place}', W.biz >= 0 ? businessName(c, W.biz) : '');
    const num = Pop.mobile[i] ? formatNumber(world.telco, Pop.mobile[i]) : H.line ? `${formatNumber(world.telco, H.line)} H` : '-';
    return { kind: 'pick', label: `${citizenName(c, Pop, i)}, ${Pop.age[i]}`, value: `F${H.floor + 1}`, sub: [roles[Pop.role[i]].replace('{place}', job), `${doing.slice(0, 18)} ${num}`], sel: n === P.setSel, pre: () => { P.setSel = n; } };
  });
  softKeys(S, SET.dial, T.back);
  return listPage({ title, note: `#${P.people.building} (${L.length})`, t, foot: SET.peopleHint, rows });
}

const ST = A.shop;
const appName = (i: number) => (ST.names as Record<string, string>)[STORE[i][0]];

/** The store: the maker's own shop (plum, pink accents); the catalog (size, price, whether it fits over EDGE) and the apps installed; a download's progress. */
function store(S: Lcd, P: Phone, t: number): Pg {
  const list = P.stab === 0 ? P.catalog() : P.downloads(), view = 7, top = Math.max(0, Math.min(P.ssel - view + 1, list.length - view));
  const rows = list.slice(top, top + view).map((i, n) => {
    const [id, kb, price] = STORE[i], have = P.apps.includes(i), k = top + n;
    const right = P.stab === 1 ? '' : have ? ST.installed : `${kb >= 1024 ? `${(kb / 1024).toFixed(0)}MB` : `${kb}KB`} ${price ? `$${(price / 100).toFixed(2)}` : ST.free}`;
    return { label: appName(i), right, col: (STORE_ICON[id] ?? ICON.store)[1], art: artColors(id === 'social' ? 'wire' : id), big: kb > EDGE_LIMIT_KB, have, sel: k === P.ssel, pre: () => { P.ssel = k; P.storeNote = ''; } };
  });
  const J = P.radio.job, sel = list[P.ssel];
  const bar = J?.what.startsWith('app:') && (J.state === 'connecting' || J.state === 'loading') ? J.done / J.kb : -1;
  softKeys(S, P.stab === 1 || P.apps.includes(sel) ? ST.open : ST.get, T.back);
  return (Pt) => paintStore(Pt, { title: `${P.maker} ${name('store')}`, tabs: [ST.tabs[0], ST.tabs[1]], tab: P.stab, goTab: (k) => { P.stab = k; P.ssel = 0; P.storeNote = ''; }, empty: ST.none, rows,
    about: P.stab === 0 && sel !== undefined ? (ST.about as Record<string, string>)[STORE[sel][0]] : '', bar, note: P.storeNote ? (ST.notes as Record<string, string>)[P.storeNote] : '', t });
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

const kbText = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`);

const C = A.code;
const imeiOf = (seed: number) => String(Math.floor(hash3(seed, 7, 7) * 1e15)).padStart(15, '0');

/** The service screens the secret codes open (see codes.ts). */
function service(S: Lcd, P: Phone, world: World, t: number, now: number): Pg | void {
  const k = P.code;
  if (k === 'lcd') return lcdTest(S, P);
  softKeys(S, '', T.back);
  const page = (rows: Row[]) => listPage({ title: `${C[k]}`, note: '', t, rows, col: [120, 60, 50] });
  if (k === 'imei') {
    const im = imeiOf(world.seed);
    return page([{ kind: 'info', label: C.imei, value: `${im.slice(0, 2)} ${im.slice(2, 8)} ${im.slice(8, 14)} ${im[14]}` }, { kind: 'text', label: '' }, { kind: 'text', label: C.sv }]);
  }
  if (k === 'field') return page(fieldTest(P, world));
  if (k === 'sensors') return page(sensors(P, world, now));
  if (k === 'version') return page([...version(P, world), { kind: 'text', label: '' }, { kind: 'text', label: C.eng, col: BAD }]);
  title(S, `${C[k]}`, t);
  if (k === 'gps') gpsTest(S, P, t);
  else if (k === 'keys') keyTest(S, P, now);
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
function fieldTest(P: Phone, world: World): Row[] {
  const R = P.radio, T2 = world.telco, p = world.player;
  const lac = (k: number) => 1000 + Math.floor(hash3(world.seed, T2.sites[k].building, 77) * 8) * 111;
  const arfcn = (k: number) => 1 + Math.floor(hash3(world.seed, k, 78) * 124);
  if (R.site < 0) return [{ kind: 'text', label: C.noCell, col: BAD }];
  const s = T2.sites[R.site], d = Math.hypot(s.x - p.x, s.y - p.y);
  const rows: [string, string][] = [['CID', String(s.id)], [C.lac, String(lac(R.site))], [C.arfcn, String(arfcn(R.site))], [C.rxlev, `${R.dbm} dBm`], [C.ta, `${Math.round(d / 550)} (${fmtDist(d, P.prefs.dist)})`]];
  return [{ kind: 'head', label: C.serving }, ...rows.map(([a, b]): Row => ({ kind: 'info', label: a, value: b })), { kind: 'head', label: C.neighbours },
    ...R.heard.filter(([k]) => k !== R.site).slice(0, 6).map(([k, dbm]): Row => ({ kind: 'info', label: `${T2.sites[k].id}  ARFCN ${arfcn(k)}`, value: `${dbm} dBm` }))];
}

/** Sensors: the battery, its temperature, the ambient light sensor (from the light in the hands), the radio. */
function sensors(P: Phone, world: World, now: number): Row[] {
  const pct = Math.max(5, Math.round(100 - world.tick / 60 / 600)), lux = Math.round(((VIEW_LIGHT[0] + VIEW_LIGHT[1] + VIEW_LIGHT[2]) / 3) * 420);
  const btemp = world.player.inside >= 0 ? 29 : 24 + world.weather.temp * 0.25, R = P.radio;
  const temp = (c: number) => (P.prefs.temp ? `${c.toFixed(1)}°C` : `${(c * 1.8 + 32).toFixed(1)}°F`);
  const rows: [string, string][] = [
    [C.battery, `${pct}%`], [C.volt, `${(3.55 + pct * 0.0065).toFixed(3)} V`], [C.btemp, temp(btemp + (hash3(Math.floor(now), 1, 1) - 0.5) * 0.2)],
    [C.light, `${lux} lx`], [C.rf, R.state === 'service' ? `${R.dbm} dBm` : '-'], [C.radioTemp, temp(btemp + 3 + (R.job ? 4 : 0))],
    [C.uptime, `${Math.floor(world.tick / 3600)}:${String(Math.floor(world.tick / 60) % 60).padStart(2, '0')}`],
  ];
  return rows.map(([a, b]): Row => ({ kind: 'info', label: a, value: b }));
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
function version(P: Phone, world: World): Row[] {
  const D = P.device, h = (q: number) => hash3(world.seed, 31, q);
  const rows: [string, string][] = [
    [C.build, `${D.os}.${Math.floor(h(1) * 9)}.${100 + Math.floor(h(2) * 800)}`], [C.date, `2008-0${1 + Math.floor(h(3) * 2)}-${10 + Math.floor(h(4) * 18)}`],
    [C.baseband, `BB ${(h(5) * 0xffff | 0).toString(16).toUpperCase()}`], [C.bootloader, `BL 1.${Math.floor(h(6) * 9)}`], [C.hw, `R${1 + Math.floor(h(7) * 4)}`], [C.imei, imeiOf(world.seed)],
  ];
  return rows.map(([a, b]): Row => ({ kind: 'info', label: a, value: b }));
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
    return drawWire(S, P, world, now, J?.what === 'social' && (J.state === 'connecting' || J.state === 'loading'), t);
  }
  if (id === 'news') {
    const J = P.radio.job;
    return newsApp(S, P, world, t, J?.what === 'news' && (J.state === 'connecting' || J.state === 'loading'));
  }
  if (id === 'bank') return bankApp(S, P, world, t);
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
/** The Tunes Player's page (painted in pixels by pixpages.ts paintTunes): what plays, and the songs (those that came with it, then the SD card's), kept in sight round the one picked. */
export function tunesData(P: Phone, t: number): TunesPage {
  const T2 = P.tn, mark = (i: number): '' | 'play' | 'pause' => (i === T2.cur ? (T2.playing ? 'play' : 'pause') : '');
  const size = (kb: number) => (kb < 0 ? '--' : kb >= 1024 ? TN.mb.replace('{n}', (kb / 1024).toFixed(1)) : TN.kb.replace('{n}', String(kb)));
  const song = (i: number): TunesPage['rows'][number] => { const s = songInfo(P, i); return { kind: 'song', label: `${s.title}${i < TRACKS.length ? ` - ${s.band}` : ''}`, size: size(s.kb), mark: mark(i), sel: i === T2.sel, pre: () => { T2.sel = i; } }; };
  const all: TunesPage['rows'] = [{ kind: 'head', label: TN.songs, size: '', mark: '', sel: false }, ...TRACKS.map((_, i) => song(i)), { kind: 'head', label: TN.sd, size: '', mark: '', sel: false },
    ...(P.sd.length ? P.sd.map((_, i) => song(TRACKS.length + i)) : [{ kind: 'note' as const, label: TN.sdEmpty, size: '', mark: '' as const, sel: false }])];
  const h = 8, at = all.findIndex((r) => r.sel), off = Math.max(0, Math.min(all.length - h, at - (h >> 1)));
  let tune: TunesPage['tune'] = null;
  if (T2.cur >= 0) { const s = songInfo(P, T2.cur); tune = { title: s.title, band: s.band, at: T2.at, len: T2.len, playing: T2.playing, vol: T2.vol, shuffle: T2.shuffle ? TN.shuffle : '', spec: P.spec, sel: false, pre: () => {} }; }
  return { title: (ST.names as Record<string, string>).tunes, out: P.earphones ? TN.phones : TN.speaker, idle: TN.idle, tune, volLabel: 'VOL', keys: TN.keys, rows: all.slice(off, off + h), t };
}

function bankApp(S: Lcd, P: Phone, world: World, t: number): Pg {
  const { city } = world, Acc = world.bank, B = P.bk, J = P.radio.job, op = operatorName(city, world.telco.player.op ?? 0);
  const page = (view: BankView): Pg => { const d: BankPage = { name: P.bankName.toUpperCase(), view, t }; return (Pt) => paintBank(Pt, d); };
  if (!B.ok) {
    const busy = J?.what === 'bank' && (J.state === 'connecting' || J.state === 'loading');
    softKeys(S, busy ? '' : T.ok, T.back);
    return page(busy ? { kind: 'wait', lines: [BK.connecting], bar: J!.done / J!.kb } : { kind: 'wait', lines: BK.offline, bar: null });
  }
  const date = (at: number) => { const c = calendar(at); return `${String(c.month).padStart(2, '0')}/${String(c.day).padStart(2, '0')}`; };
  const corner = (k: number) => {
    const Bd = city.buildings[city.businesses[k].building], x = (Bd.x0 + Bd.x1) / 2, y = (Bd.y0 + Bd.y1) / 2;
    return [`${roadName(city, true, nearestRoad(city.xb, city.xCell, x))} &`, roadName(city, false, nearestRoad(city.yb, city.yCell, y)), districtName(city, districtAt(city, x, y))];
  };
  const pick = (n: number) => () => { B.sel = n; B.note = ''; };
  if (B.view === 'home') {
    softKeys(S, T.ok, T.back);
    return page({ kind: 'home', acct: `${BK.checking} ****${Acc.number.slice(-4)}`, label: BK.balance, balance: money(Acc.balance), asOf: BK.asOf.replace('{t}', hhmm(calendar(world.time).hour)),
      menu: BK.menu.map((m, n) => ({ label: m, sel: n === B.sel, pre: pick(n) })) });
  }
  if (B.view === 'stmt') {
    const L = Acc.ledger;
    softKeys(S, '', T.back);
    return page({ kind: 'stmt', title: BK.stmt, rows: L.map((_, n) => {
      const e = L[L.length - 1 - n];
      const what = (BK.kinds as Record<string, string>)[e.kind].replace('{biz}', e.kind === 'card' || e.kind === 'atm' ? businessName(city, e.ref) : '').replace('{op}', op);
      return { date: date(e.at), what, amt: `${e.amount > 0 ? '+' : ''}${money(e.amount)}`, plus: e.amount > 0, sel: n === B.sel, pre: pick(n) };
    }) });
  }
  if (B.view === 'topup') {
    const busy = J?.what.startsWith('banktop:') && (J.state === 'connecting' || J.state === 'loading');
    softKeys(S, busy ? '' : BK.pay, T.back);
    return page({ kind: 'topup', title: BK.topupTitle.replace('{op}', op.toUpperCase()), info: [[BK.credit, money(world.telco.player.credit)], [BK.balance, money(Acc.balance)]],
      amounts: TOPUPS.map((c, n) => ({ label: money(c), sel: n === B.sel, pre: pick(n) })),
      note: busy ? BK.paying : B.note ? (BK.notes as Record<string, string>)[B.note] : '', noteKind: busy ? 'dim' : B.note === 'done' ? 'ok' : 'bad' });
  }
  // the branch where the account is, and the head office
  const k = Acc.branch, chain = city.banks[Acc.bank], hq = chain.hq;
  const lines: Extract<BankView, { kind: 'branch' }>['lines'] = corner(k).map((text) => ({ text, kind: 'ink' as const }));
  lines.push({ text: '', kind: 'ink' }, { text: BK.hours, kind: 'dim' }, { text: formatNumber(world.telco, world.telco.bizNum[k]), kind: 'num' });
  if (hq !== k) { lines.push({ text: BK.hq, kind: 'head' }); for (const l of corner(hq)) lines.push({ text: l, kind: 'ink' }); }
  else lines.push({ text: BK.isHq, kind: 'head' });
  lines.push({ text: '', kind: 'ink' }, { text: BK.branches.replace('{n}', String(chain.branches.length)), kind: 'dim' });
  softKeys(S, '', T.back);
  return page({ kind: 'branch', title: BK.branch, lines, call: BK.call });
}

const WF = A.wifi;
/** Wi-Fi: on or off, the networks around with their signal and lock, the one joined; for now the selected one's key shows (debug). */
function wifiPage(S: Lcd, P: Phone, world: World, t: number): Pg {
  const W = P.wifi;
  const st = W.state === 'assoc' ? WF.assoc : W.state === 'dhcp' ? WF.dhcp : W.state === 'badkey' ? WF.badKey : W.state === 'up' ? `${WF.up} ${W.ip}` : '';
  const rows: Row[] = [{ kind: 'pick', label: WF.wifi, value: W.on ? WF.on : WF.off, col: W.on ? [120, 255, 150] : undefined, sel: P.setSel === 0, pre: () => { P.setSel = 0; }, key: 'ok' }];
  if (st) rows.push({ kind: 'text', label: st, col: W.state === 'badkey' ? BAD : W.state === 'up' ? [120, 255, 150] : [143, 211, 255] });
  if (W.on && !W.list.length) rows.push({ kind: 'text', label: '' }, { kind: 'text', label: WF.none });
  W.list.slice(0, 8).forEach(([i, dbm], n) => {
    const A2 = world.wifi[i], bars = [-85, -76, -67, -58].reduce((c, b) => (dbm >= b ? c + 1 : c), 0), up = i === W.ap && W.state === 'up';
    rows.push({ kind: 'pick', label: `${up ? '> ' : ''}${wifiName(world.city, A2)}`, value: A2.sec === Sec.Open ? '' : A2.sec === Sec.WEP ? 'WEP' : 'WPA', col: up ? [120, 255, 150] : undefined, bars, sel: P.setSel === n + 1, pre: () => { P.setSel = n + 1; } });
  });
  // (debug) the picked network's key
  const sel = W.list[P.setSel - 1], A3 = sel ? world.wifi[sel[0]] : null;
  softKeys(S, P.setSel === 0 ? T.ok : WF.join, T.back);
  return listPage({ title: SET.pages.wifi, note: '', t, rows, foot: DEBUG.showWifiKey && A3 ? `${WF.debugKey} ${A3.sec === Sec.Open ? WF.openNet : A3.key}` : '' });
}

/** Typing a network's key. */
function wifiKey(S: Lcd, P: Phone, world: World, now: number): Pg {
  const A2 = world.wifi[P.wkey.ap], K = P.wkey.key;
  softKeys(S, K ? WF.join : '', T.back);
  return listPage({ title: WF.keyTitle, note: A2.sec === Sec.WEP ? 'WEP' : 'WPA-PSK', t: 9, foot: DEBUG.showWifiKey ? `${WF.debugKey} ${A2.key}` : '0-9   * <-', rows: [
    { kind: 'text', label: wifiName(world.city, A2), col: PINK_INK }, { kind: 'text', label: '' }, { kind: 'head', label: WF.key },
    { kind: 'field', label: '*'.repeat(Math.max(0, K.length - 1)) + K.slice(-1) + (Math.floor(now * 2) & 1 ? '_' : ''), sel: true }] });
}
