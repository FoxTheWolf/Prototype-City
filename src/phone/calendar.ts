import { hash3 } from '../core/rng';
import { calendar, moonPhase, sunDir } from '../sim/clock';
import { forecast, newWeather } from '../sim/weather';
import { type World } from '../sim/world';
import { businessName, cityName, districtName, landmarkName, roadName } from '../locale/names';
import { expand, rngOf, type Grammar } from '../locale/gen';
import { TEXT } from '../locale/text';
import CALLS from '../locale/calls.json';
import en from '../locale/en.json';
import { ch, type C3, type Lcd, SH, softKeys, SW, typeHint } from './lcd';
import { type Key, type Phone } from './phone';
import { Editor } from './textinput';

/**
 * The calendar, as a 2008 phone's organizer looked: white paper, a red bar with the month, the
 * days in a grid (today in red, the holidays in red letters, a dot where the player wrote a
 * reminder, a star where the city has something on). A day opens to what is known of it: the
 * holiday, sunrise and sunset, the moon, the forecast when it is near, the city's events (from the
 * businesses that exist: a premiere at a cinema, a band at a bar, a sale) and the reminders. A
 * reminder (typed like a text, then its time) rings when its time comes, with a note in the inbox.
 */
const T = en.phone.cal;
const PAPER: C3 = [246, 245, 240], INK: C3 = [30, 30, 34], DIM: C3 = [130, 130, 140], RED: C3 = [200, 40, 46], BAR2: C3 = [168, 28, 34];
const SEL: C3 = [40, 70, 130], GRID: C3 = [222, 220, 212], BLUE: C3 = [40, 90, 170];
const DAY = 86400;
const MONTHS = T.months, WEEK = T.week;

export interface Reminder { at: number; text: string; done: boolean }
export interface CalState { y: number; m: number; d: number; view: 'month' | 'day' | 'new'; step: 0 | 1; time: string; scroll: number; reminders: Reminder[]; ed: Editor }
export const newCal = (): CalState => ({ y: 2008, m: 1, d: 1, view: 'month', step: 0, time: '', scroll: 0, reminders: [], ed: new Editor(60) });

const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const dim = (y: number, m: number) => [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
/** Game time at the start of a date (the game's clock starts on January 1st, 2008). */
export function dateT(y: number, m: number, d: number): number {
  let days = d - 1;
  for (let yy = 2008; yy < y; yy++) days += leap(yy) ? 366 : 365;
  for (let mm = 1; mm < m; mm++) days += dim(y, mm);
  return days * DAY;
}
const weekday = (y: number, m: number, d: number) => (((Math.floor(dateT(y, m, d) / DAY) + 2) % 7) + 7) % 7;
/** The n-th weekday wd of a month (n = -1: the last). */
function nth(y: number, m: number, wd: number, n: number): number {
  if (n < 0) { let d = dim(y, m); while (weekday(y, m, d) !== wd) d--; return d; }
  let d = 1; while (weekday(y, m, d) !== wd) d++;
  return d + (n - 1) * 7;
}
/** Easter Sunday (the Western computus). */
function easter(y: number): [number, number] {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return [Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1];
}

/** The holidays and observances of a day, by name (the US calendar; the city has a founders' day of its own). */
export function holidays(world: World, y: number, m: number, d: number): string[] {
  const H = T.holiday, out: string[] = [], is = (mm: number, dd: number) => m === mm && d === dd;
  if (is(1, 1)) out.push(H.newYear);
  if (m === 1 && d === nth(y, 1, 1, 3)) out.push(H.civil);
  if (is(2, 2)) out.push(H.groundhog);
  if (is(2, 14)) out.push(H.valentine);
  if (m === 2 && d === nth(y, 2, 1, 3)) out.push(H.presidents);
  if (m === 3 && d === nth(y, 3, 0, 2)) out.push(H.dstOn);
  if (is(3, 17)) out.push(H.patrick);
  const [em, ed] = easter(y);
  if (is(em, ed)) out.push(H.easter);
  if (is(4, 1)) out.push(H.fools);
  if (is(4, 15)) out.push(H.taxes);
  if (is(4, 22)) out.push(H.earth);
  if (m === 5 && d === nth(y, 5, 0, 2)) out.push(H.mother);
  if (m === 5 && d === nth(y, 5, 1, -1)) out.push(H.memorial);
  if (m === 6 && d === nth(y, 6, 0, 3)) out.push(H.father);
  if (is(6, 21)) out.push(H.summer);
  if (is(7, 4)) out.push(H.july4);
  if (m === 9 && d === nth(y, 9, 1, 1)) out.push(H.labor);
  if (is(9, 22)) out.push(H.fall);
  if (m === 10 && d === nth(y, 10, 1, 2)) out.push(H.columbus);
  if (is(10, 31)) out.push(H.halloween);
  if (m === 11 && d === nth(y, 11, 0, 1)) out.push(H.dstOff);
  if (m === 11 && y % 4 === 0 && d === nth(y, 11, 1, 1) + 1) out.push(H.election);
  if (is(11, 11)) out.push(H.veterans);
  if (m === 11 && d === nth(y, 11, 4, 4)) out.push(H.thanksgiving);
  if (is(12, 21)) out.push(H.winter);
  if (is(12, 24)) out.push(H.xmasEve);
  if (is(12, 25)) out.push(H.xmas);
  if (is(12, 31)) out.push(H.nye);
  // the city's own day, from its seed
  const fm = 3 + Math.floor(hash3(world.seed, 0xf0d, 1) * 7), fd = 1 + Math.floor(hash3(world.seed, 0xf0d, 2) * 28);
  if (is(fm, fd)) out.push(H.founders.replace('{city}', cityName(world.city)));
  return out;
}

const CALG: Grammar[] = [TEXT, CALLS as unknown as Grammar];
const evCache = new Map<number, string[]>();
/** What the city has on a day: two to four things at its real businesses and places. */
export function events(world: World, t: number): string[] {
  const day = Math.floor(t / DAY);
  let L = evCache.get(day);
  if (L) return L;
  const c = world.city, r = rngOf(world.seed, day, 0xca1e), B = c.businesses;
  L = [];
  const n = 2 + Math.floor(r() * 3);
  for (let k = 0; k < n * 4 && L.length < n; k++) {
    let key = 'cal.city', biz = '';
    if (B.length && r() < 0.65) {
      const b = Math.floor(r() * B.length), kind = B[b].kind;
      key = kind === 'cinema' ? 'cal.cinema' : kind === 'bar' ? 'cal.bar' : kind === 'diner' ? 'cal.diner' : kind === 'cafe' ? 'cal.cafe' : kind === 'hotel' ? 'cal.hotel' : kind === 'books' ? 'cal.books' : 'cal.shop';
      biz = businessName(c, b);
    }
    const ctx = {
      biz, district: districtName(c, Math.floor(r() * c.districts.length)),
      road: roadName(c, r() < 0.5, Math.floor(r() * (c.xb.length / 2))),
      landmark: c.landmarks.length ? landmarkName(c, Math.floor(r() * c.landmarks.length)) : cityName(c),
    };
    const s = expand(`#${key}#`, CALG, r, ctx);
    if (!L.includes(s)) L.push(s);
  }
  evCache.set(day, L);
  if (evCache.size > 400) evCache.delete(evCache.keys().next().value!);
  return L;
}

/** Sunrise and sunset of the day starting at t, as hours (found where the sun's height crosses the horizon). */
function sunTimes(t: number): [number, number] {
  const o = new Float64Array(2), el = (h: number) => sunDir(t + h * 3600, o)[0] + 0.0145;
  const find = (a: number, b: number) => { for (let k = 0; k < 30; k++) { const m = (a + b) / 2; if ((el(a) < 0) === (el(m) < 0)) a = m; else b = m; } return (a + b) / 2; };
  return [find(0, 12), find(12, 24)];
}
const hm = (h: number) => `${((Math.floor(h) + 11) % 12) + 1}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
const wx = newWeather();

export function drawCalendar(S: Lcd, P: Phone, world: World, now: number) {
  const C = P.cal;
  for (let y = 1; y < SH - 1; y++) S.fill(y, PAPER);
  if (C.view === 'month') return month(S, P, world);
  if (C.view === 'day') return dayPage(S, P, world);
  return newReminder(S, P, now);
}

function month(S: Lcd, P: Phone, world: World) {
  const C = P.cal, today = calendar(world.time);
  S.fill(1, RED); S.fill(2, BAR2);
  const title = `${MONTHS[C.m - 1].toUpperCase()} ${C.y}`;
  S.text(1, 1, '<', [255, 210, 210], RED); S.text(SW - 2, 1, '>', [255, 210, 210], RED);
  S.center(1, title, [255, 255, 255], RED);
  WEEK.forEach((w, k) => S.text(k * 6 + 2, 2, w, [255, 220, 220], BAR2));
  const first = weekday(C.y, C.m, 1), n = dim(C.y, C.m);
  for (let d = 1; d <= n; d++) {
    const cell = first + d - 1, col = cell % 7, row = Math.floor(cell / 7), x = col * 6, y = 4 + row * 2;
    const isToday = today.year === C.y && today.month === C.m && today.day === d, sel = d === C.d;
    const hol = holidays(world, C.y, C.m, d).length > 0, t0 = dateT(C.y, C.m, d);
    const rem = C.reminders.some((r) => r.at >= t0 && r.at < t0 + DAY), ev = hash3(world.seed, Math.floor(t0 / DAY), 0xe7) < 0.35;
    const bg: C3 = isToday ? RED : sel ? SEL : PAPER, fg: C3 = isToday || sel ? [255, 255, 255] : hol || col === 0 ? RED : INK;
    for (let k = 0; k < 5; k++) S.put(x + k, y, 32, bg, bg);
    S.text(x + 1, y, String(d).padStart(2), fg, bg);
    if (rem) S.put(x + 3, y, ch('.'), isToday || sel ? [255, 255, 255] : BLUE, bg);
    if (ev) S.put(x + 4, y, ch('*'), isToday ? [255, 230, 150] : [200, 150, 40], bg);
    if (sel && isToday) { S.put(x, y, ch('['), [255, 255, 255], bg); S.put(x + 4, y, ch(']'), [255, 255, 255], bg); }
  }
  // what the picked day has, in brief
  const t0 = dateT(C.y, C.m, C.d), hol = holidays(world, C.y, C.m, C.d);
  for (let x = 0; x < SW; x++) S.put(x, 17, ch('-'), GRID, PAPER);
  const ph = en.phone.apps.wx.phases[Math.round(moonPhase(t0 + DAY / 2) * 8) % 8];
  S.text(1, 18, `${WEEK[weekday(C.y, C.m, C.d)]} ${MONTHS[C.m - 1]} ${C.d}`, INK, PAPER);
  S.text(SW - ph.length - 1, 18, ph, DIM, PAPER);
  const lines = [...hol.map((h) => [h, RED] as const), ...events(world, t0).slice(0, 3).map((e) => [`* ${e}`, INK] as const)];
  lines.slice(0, 5).forEach(([l, col], k) => S.text(1, 19 + k, l.slice(0, SW - 2), col, PAPER));
  softKeys(S, T.open, en.phone.back);
  S.text((SW - T.hint.length) >> 1, SH - 1, T.hint, [150, 160, 180], [28, 62, 82]);
}

function dayPage(S: Lcd, P: Phone, world: World) {
  const C = P.cal, t0 = dateT(C.y, C.m, C.d);
  S.fill(1, RED); S.fill(2, BAR2);
  S.center(1, `${WEEK[weekday(C.y, C.m, C.d)].toUpperCase()} ${MONTHS[C.m - 1].toUpperCase()} ${C.d}, ${C.y}`, [255, 255, 255], RED);
  const rows: [string, C3][] = [];
  for (const h of holidays(world, C.y, C.m, C.d)) rows.push([h, RED]);
  const [rise, set] = sunTimes(t0);
  rows.push([`${T.sunrise} ${hm(rise)}   ${T.sunset} ${hm(set)}`, INK]);
  rows.push([`${T.moon} ${en.phone.apps.wx.phases[Math.round(moonPhase(t0 + DAY / 2) * 8) % 8]}`, INK]);
  // the forecast, while the day is near enough for it to mean something
  if (t0 + DAY > world.time && t0 < world.time + 3 * DAY) {
    forecast(world.seed, Math.max(world.time, t0 + 14 * 3600), wx);
    const temp = P.prefs.temp ? `${Math.round(wx.temp)}°C` : `${Math.round(wx.temp * 1.8 + 32)}°F`;
    const sky = wx.precip > 0.05 ? (wx.snow ? T.snow : T.rain) : wx.cloud > 0.6 ? T.cloudy : T.clear;
    rows.push([`${T.forecast} ${sky}, ${temp}`, BLUE]);
  }
  rows.push(['', INK]);
  rows.push([T.reminders, RED]);
  const rems = C.reminders.filter((r) => r.at >= t0 && r.at < t0 + DAY).sort((a, b) => a.at - b.at);
  if (!rems.length) rows.push([T.noReminders, DIM]);
  for (const r of rems) rows.push([`${hm((r.at - t0) / 3600).padStart(8)}  ${r.text}`, r.done ? DIM : INK]);
  rows.push(['', INK]);
  rows.push([T.inCity, RED]);
  for (const e of events(world, t0)) rows.push([`* ${e}`, INK]);
  const wrapped: [string, C3][] = [];
  for (const [l, c] of rows) { let s = l; do { wrapped.push([s.slice(0, SW - 2), c]); s = s.slice(SW - 2); } while (s.length); }
  C.scroll = Math.max(0, Math.min(C.scroll, wrapped.length - (SH - 5)));
  wrapped.slice(C.scroll, C.scroll + SH - 5).forEach(([l, c], k) => S.text(1, 4 + k, l, c, PAPER));
  softKeys(S, T.add, en.phone.back);
}

function newReminder(S: Lcd, P: Phone, now: number) {
  const C = P.cal, blink = Math.floor(now * 2) & 1;
  S.fill(1, RED); S.fill(2, BAR2);
  S.center(1, `${T.newReminder} - ${MONTHS[C.m - 1]} ${C.d}`, [255, 255, 255], RED);
  S.text(1, 4, T.what, C.step === 0 ? RED : DIM, PAPER);
  const txt = C.ed.value();
  S.text(1, 5, (txt + (C.step === 0 && blink ? '_' : '')).slice(-(SW - 2)), INK, PAPER);
  for (let x = 1; x < SW - 1; x++) S.put(x, 6, ch('_'), GRID, PAPER);
  S.text(1, 8, T.when, C.step === 1 ? RED : DIM, PAPER);
  const tm = C.time.padEnd(4, '-');
  S.text(1, 9, `${tm.slice(0, 2)}:${tm.slice(2)}${C.step === 1 && blink ? '_' : ''}  ${T.hhmm}`, INK, PAPER);
  if (C.step === 0) typeHint(S, 1, SH - 3, C.ed, now, `${C.ed.label()}  ${T.next}`, DIM, PAPER); else S.text(1, SH - 3, T.timeHint, DIM, PAPER);
  softKeys(S, txt && C.time.length === 4 ? T.save : '', en.phone.back);
}

/** The calendar's keys; false when one does nothing. */
export function calKey(P: Phone, world: World, k: Key, now: number): boolean | 'menu' {
  const C = P.cal;
  if (C.view === 'month') {
    const n = dim(C.y, C.m);
    const move = (dd: number) => {
      C.d += dd;
      if (C.d < 1) { C.m--; if (C.m < 1) { C.m = 12; C.y--; } C.d += dim(C.y, C.m); }
      else if (C.d > n) { C.d -= n; C.m++; if (C.m > 12) { C.m = 1; C.y++; } }
      if (C.y < 2008) { C.y = 2008; C.m = 1; C.d = 1; }
    };
    if (k === 'left' || k === 'right') { move(k === 'left' ? -1 : 1); return true; }
    if (k === 'up' || k === 'down') { move(k === 'up' ? -7 : 7); return true; }
    if (k === '*' || k === '#') { const dd = C.d; C.m += k === '*' ? -1 : 1; if (C.m < 1) { C.m = 12; C.y--; } if (C.m > 12) { C.m = 1; C.y++; } if (C.y < 2008) { C.y = 2008; C.m = 1; } C.d = Math.min(dd, dim(C.y, C.m)); return true; }
    if (k === '0') { const c = calendar(world.time); C.y = c.year; C.m = c.month; C.d = c.day; return true; }
    if (k === 'ok' || k === 'lsoft') { C.view = 'day'; C.scroll = 0; return true; }
    if (k === 'rsoft') return 'menu';
    return false;
  }
  if (C.view === 'day') {
    if (k === 'up' || k === 'down') { C.scroll = Math.max(0, C.scroll + (k === 'up' ? -1 : 1)); return true; }
    if (k === 'lsoft') { C.view = 'new'; C.step = 0; C.time = ''; C.ed.set(''); return true; }
    if (k === 'rsoft' || k === 'ok') { C.view = 'month'; return true; }
    return false;
  }
  // a new reminder: its words (Abc, T9 or 123), then its time as four digits
  if (k === 'rsoft') {
    if (C.step === 1 && C.time) { C.time = C.time.slice(0, -1); return true; }
    if (C.step === 1) { C.step = 0; return true; }
    if (C.ed.del()) return true;
    C.view = 'day'; return true;
  }
  if (k === 'down' && C.step === 0) { C.step = 1; return true; }
  if (k === 'up' && C.step === 1) { C.step = 0; return true; }
  if ((k === 'ok' || k === 'lsoft') && C.ed.value() && C.time.length === 4) {
    const h = Math.min(23, +C.time.slice(0, 2)), m = Math.min(59, +C.time.slice(2));
    C.reminders.push({ at: dateT(C.y, C.m, C.d) + h * 3600 + m * 60, text: C.ed.value(), done: false });
    C.view = 'day';
    return true;
  }
  if (k === 'ok' && C.step === 0) { C.step = 1; return true; }
  if (C.step === 1) { if (/^[0-9]$/.test(k) && C.time.length < 4) { C.time += k; return true; } return false; }
  return C.ed.key(k, now);
}
