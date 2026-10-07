import { hash3 } from '../core/rng';
import { calendar, moonPhase, sunDir } from '../sim/clock';
import { forecast, newWeather } from '../sim/weather';
import { type World } from '../sim/world';
import { businessName, cityName, districtName, landmarkName, roadName } from '../locale/names';
import { expand, rngOf, type Grammar } from '../locale/gen';
import { TEXT } from '../locale/text';
import CALLS from '../locale/calls.json';
import en from '../locale/en.json';
import { type Lcd, softKeys } from './lcd';
import { edHint, paintCalDay, paintCalMonth, paintCalNew, type CalDay, type CalDayPage } from './pixpages';
import { type Paint } from '../render/paint2d';
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

/** The calendar, painted in pixels by pixpages.ts: the month, a day open, a new reminder. */
export function drawCalendar(S: Lcd, P: Phone, world: World, now: number): (Pt: Paint) => void {
  const C = P.cal;
  if (C.view === 'month') return month(S, P, world);
  if (C.view === 'day') return dayPage(S, P, world);
  return newReminder(S, P, now);
}

function month(S: Lcd, P: Phone, world: World): (Pt: Paint) => void {
  const C = P.cal, today = calendar(world.time), first = weekday(C.y, C.m, 1), n = dim(C.y, C.m);
  const days: CalDay[] = [];
  for (let d = 1; d <= n; d++) {
    const cell = first + d - 1, t0 = dateT(C.y, C.m, d);
    days.push({ d, col: cell % 7, row: Math.floor(cell / 7), today: today.year === C.y && today.month === C.m && today.day === d, sel: d === C.d,
      red: holidays(world, C.y, C.m, d).length > 0 || cell % 7 === 0, rem: C.reminders.some((r) => r.at >= t0 && r.at < t0 + DAY), ev: hash3(world.seed, Math.floor(t0 / DAY), 0xe7) < 0.35, pre: () => { C.d = d; } });
  }
  // what the picked day has, in brief
  const t0 = dateT(C.y, C.m, C.d);
  const lines = [...holidays(world, C.y, C.m, C.d).map((h) => ({ text: h, red: true })), ...events(world, t0).slice(0, 3).map((e) => ({ text: `* ${e}`, red: false }))];
  softKeys(S, T.open, en.phone.back);
  const d = { title: `${MONTHS[C.m - 1].toUpperCase()} ${C.y}`, week: WEEK, days, date: `${WEEK[weekday(C.y, C.m, C.d)]} ${MONTHS[C.m - 1]} ${C.d}`,
    moon: en.phone.apps.wx.phases[Math.round(moonPhase(t0 + DAY / 2) * 8) % 8], lines, hint: T.hint };
  return (Pt) => paintCalMonth(Pt, d);
}

function dayPage(S: Lcd, P: Phone, world: World): (Pt: Paint) => void {
  const C = P.cal, t0 = dateT(C.y, C.m, C.d);
  const rows: CalDayPage['lines'] = [];
  const add = (text: string, col: CalDayPage['lines'][number]['col'] = 'ink', head = false) => rows.push({ text, col, head });
  for (const h of holidays(world, C.y, C.m, C.d)) add(h, 'red');
  const [rise, set] = sunTimes(t0);
  add(`${T.sunrise} ${hm(rise)}   ${T.sunset} ${hm(set)}`);
  add(`${T.moon} ${en.phone.apps.wx.phases[Math.round(moonPhase(t0 + DAY / 2) * 8) % 8]}`);
  // the forecast, while the day is near enough for it to mean something
  if (t0 + DAY > world.time && t0 < world.time + 3 * DAY) {
    forecast(world.seed, Math.max(world.time, t0 + 14 * 3600), wx);
    const temp = P.prefs.temp ? `${Math.round(wx.temp)}°C` : `${Math.round(wx.temp * 1.8 + 32)}°F`;
    const sky = wx.precip > 0.05 ? (wx.snow ? T.snow : T.rain) : wx.cloud > 0.6 ? T.cloudy : T.clear;
    add(`${T.forecast} ${sky}, ${temp}`, 'blue');
  }
  add('');
  add(T.reminders, 'red', true);
  const rems = C.reminders.filter((r) => r.at >= t0 && r.at < t0 + DAY).sort((a, b) => a.at - b.at);
  if (!rems.length) add(T.noReminders, 'dim');
  for (const r of rems) add(`${hm((r.at - t0) / 3600)}  ${r.text}`, r.done ? 'dim' : 'ink');
  add('');
  add(T.inCity, 'red', true);
  for (const e of events(world, t0)) add(`* ${e}`);
  C.scroll = Math.max(0, Math.min(C.scroll, rows.length + 4));
  softKeys(S, T.add, en.phone.back);
  const d = { title: `${WEEK[weekday(C.y, C.m, C.d)].toUpperCase()} ${MONTHS[C.m - 1].toUpperCase()} ${C.d}, ${C.y}`, lines: rows, scroll: C.scroll };
  return (Pt) => paintCalDay(Pt, d);
}

function newReminder(S: Lcd, P: Phone, now: number): (Pt: Paint) => void {
  const C = P.cal, txt = C.ed.value(), tm = C.time.padEnd(4, '-');
  softKeys(S, txt && C.time.length === 4 ? T.save : '', en.phone.back);
  const d = { title: `${T.newReminder} - ${MONTHS[C.m - 1]} ${C.d}`, whatLabel: T.what, what: txt, whenLabel: T.when, when: `${tm.slice(0, 2)}:${tm.slice(2)}  ${T.hhmm}`, step: C.step,
    blink: (Math.floor(now * 2) & 1) === 1, hint: C.step === 0 ? edHint(C.ed, now, `${C.ed.label()}  ${T.next}`) : T.timeHint,
    goWhat: () => { C.step = 0; }, goWhen: () => { C.step = 1; } };
  return (Pt) => paintCalNew(Pt, d);
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
