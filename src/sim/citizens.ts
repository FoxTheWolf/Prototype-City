import { hash3, mulberry32 } from '../core/rng';
import { drain } from '../core/steps';
import { type City } from './city';
import { floorsOf, habitable, isOffice, tiersOf } from './interior';
import { MAKERS } from './device';
import { forecast, newWeather } from './weather';
import { BIZ_HOURS, localNumber, type Telco } from './telco';
import { PLACES, visitKinds } from './placeTypes';

/**
 * The citizens: everyone who lives in the city, with a home, maybe a job, a family or roommates,
 * friends, a phone, and the hours they keep. Generated once from the seed, in the order of the
 * design (buildings -> homes and workplaces -> people -> relations -> routines), and kept as flat
 * arrays (20 thousand people). Words (names, firms) live in the locale: here only numbers.
 *
 * Where someone is at a given time is a pure function of the person and the clock (whereIs), so a
 * citizen far from the player costs nothing: their day is only worked out when someone asks.
 */

export enum Role { Worker, Student, Retired, Idle, Child }

/** A home: an apartment slot on a floor of a building, and the people living there (ids m0 .. m0+n). */
export interface Household {
  building: number;
  floor: number;
  /** Which apartment on that floor (counted in the floor's plan; see homeUnit). */
  slot: number;
  m0: number;
  n: number;
  /** The landline's local number, or '' (no phone at home). */
  line: string;
  /** A pet (0 none, 1 cat, 2 dog, 3 bird, 4 fish) and its name's pick (the locale's list). */
  pet: number;
  petName: number;
  /** An answering machine on the landline. */
  machine: boolean;
}

export type WorkKind = 'shop' | 'office' | 'plant';

/** A place where people work: a business on a ground floor, a firm in an office tower, a plant in a warehouse. */
export interface Workplace {
  kind: WorkKind;
  building: number;
  /** The business (index into city.businesses) for a shop; -1 for the others. */
  biz: number;
  /** Picks a firm's name from the locale (offices and plants). */
  name: number;
  /** Shifts: start hour and length in hours, one per shift (a 24-hour place has three). */
  shifts: [number, number][];
  /** Open on weekends too. */
  weekends: boolean;
  /** Who works here, by citizen id. */
  staff: number[];
}

export interface Population {
  /** The city's seed (every person's day is drawn from it). */
  seed: number;
  n: number;
  /** Name picks (indexes into the locale's first and last names). */
  first: Uint16Array;
  last: Uint16Array;
  age: Uint8Array;
  /** 0 a woman, 1 a man (the first name is picked from the matching list). */
  gender: Uint8Array;
  role: Uint8Array;
  /** Household index. */
  home: Int32Array;
  /** Workplace index (-1: none) and which of its shifts. */
  job: Int32Array;
  shift: Uint8Array;
  /** Spouse's id, or -1. */
  spouse: Int32Array;
  /** Friends: the ids friendList[friendAt[i] .. friendAt[i+1]). Symmetric. */
  friendAt: Int32Array;
  friendList: Int32Array;
  /** Waking and bedtime hours (bedtime may pass 24). */
  wake: Uint8Array;
  bed: Uint8Array;
  /** How much they go out in the evening and how much they talk (texts, calls, posts later), 0..255. */
  social: Uint8Array;
  talk: Uint8Array;
  /** Phone model: maker * 3 + tier (see device.ts), 255 for none; the mobile number, '' for none. */
  phone: Uint8Array;
  mobile: string[];
  households: Household[];
  workplaces: Workplace[];
  /** Local numbers of the people: >= 0 a citizen's mobile, < 0 household -1-n's landline. */
  byNum: Map<string, number>;
}

/** Citizens in a city of the default size; the homes are filled to about this many. */
export const PEOPLE = 100000;
/** Floor area of one apartment, roughly (the plans give about 46 m² of footprint per unit). */
const UNIT_M2 = 46;

/** Staff a business needs, all shifts together. */
const SHOP_STAFF: Record<string, number> = Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, p.staff]));

/** Shifts that cover opening hours [a, b): one if short, two if long, three round the clock. */
function shiftsFor(a: number, b: number): [number, number][] {
  const span = b - a;
  if (span >= 24) return [[6, 8], [14, 8], [22, 8]];
  if (span > 10) { const h = Math.ceil(span / 2); return [[a, h], [a + span - h, h]]; }
  return [[a, span]];
}

const EMPTY: Population = {
  seed: 0, n: 0, first: new Uint16Array(0), last: new Uint16Array(0), age: new Uint8Array(0), gender: new Uint8Array(0), role: new Uint8Array(0), home: new Int32Array(0),
  job: new Int32Array(0), shift: new Uint8Array(0), spouse: new Int32Array(0), friendAt: new Int32Array(1), friendList: new Int32Array(0),
  wake: new Uint8Array(0), bed: new Uint8Array(0), social: new Uint8Array(0), talk: new Uint8Array(0), phone: new Uint8Array(0), mobile: [],
  households: [], workplaces: [], byNum: new Map(),
};
/** No people (the render workers make a world without them). */
export const noPeople = (): Population => EMPTY;

/**
 * Everyone, from the seed. Names are picks (the locale takes them modulo its lists). Numbers are drawn so they never clash with a business's or a payphone's.
 */
export function generatePeople(seed: number, city: City, T: Telco, target = PEOPLE): Population { return drain(peopleSteps(seed, city, T, target)); }

/** generatePeople in steps: yields how far along (0..1) every so often, so a loader can let the page breathe. */
export function* peopleSteps(seed: number, city: City, T: Telco, target = PEOPLE): Generator<number, Population> {
  const FIRST = 65536, LAST = 65536;
  const rnd = mulberry32(hash3(seed, 0xc171, 11) * 2 ** 32);
  const ri = (n: number) => Math.floor(rnd() * n);

  // --- homes: apartment slots in the residential buildings (not offices), floor by floor
  const slots: [number, number, number][] = [];
  const places: Workplace[] = [];
  yield 0;
  city.buildings.forEach((B, k) => {
    if (B.tier !== 1 || B.round) return;
    const area = (B.x1 - B.x0) * (B.y1 - B.y0) * (B.cut ? 0.7 : 1);
    if (B.style === 'warehouse') {
      const jobs = Math.max(2, Math.round(area / 90));
      places.push({ kind: 'plant', building: k, biz: -1, name: ri(1 << 20), shifts: jobs > 12 ? [[6, 8], [14, 8], [22, 8]] : [[7, 9]], weekends: jobs > 12, staff: [] });
      (places[places.length - 1] as Workplace & { cap: number }).cap = jobs;
      return;
    }
    if (!habitable(B)) return;
    const floors = Math.max(...tiersOf(city, k).map((j) => floorsOf(city.buildings[j])), floorsOf(B));
    if (isOffice(B)) {
      const s = 8 + ri(3);
      places.push({ kind: 'office', building: k, biz: -1, name: ri(1 << 20), shifts: [[s, 8 + ri(2)]], weekends: false, staff: [] });
      (places[places.length - 1] as Workplace & { cap: number }).cap = Math.max(3, Math.round((area * floors) / 20));
      return;
    }
    const per = Math.max(1, Math.floor(area / UNIT_M2));
    for (let f = B.shop ? 1 : 0; f < floors; f++) for (let s = 0; s < per; s++) slots.push([k, f, s]);
  });
  city.businesses.forEach((b, k) => {
    const [o, c] = BIZ_HOURS[b.kind] ?? [9, 17];
    places.push({ kind: 'shop', building: b.building, biz: k, name: 0, shifts: shiftsFor(o, c), weekends: b.kind !== 'bank', staff: [] });
    (places[places.length - 1] as Workplace & { cap: number }).cap = SHOP_STAFF[b.kind] ?? 3;
  });

  // pick the occupied apartments (a shuffled prefix), about target / 2.3 of them
  const nh = Math.min(slots.length, Math.round(target / 2.3));
  for (let k = 0; k < nh; k++) { const j = k + ri(slots.length - k); [slots[k], slots[j]] = [slots[j], slots[k]]; }

  // --- the people of each home
  const first: number[] = [], last: number[] = [], age: number[] = [], spouse: number[] = [], home: number[] = [];
  const households: Household[] = [];
  const person = (h: number, ln: number, a: number) => { first.push(ri(FIRST)); last.push(ln); age.push(a); spouse.push(-1); home.push(h); return first.length - 1; };
  yield 0.05;
  for (let h = 0; h < nh; h++) {
    if ((h & 4095) === 0) yield 0.05 + 0.15 * (h / nh);
    const [building, floor, slot] = slots[h], m0 = first.length, fam = ri(LAST), r = rnd();
    if (r < 0.34) person(h, fam, 20 + ri(66));                                       // alone
    else if (r < 0.6) { const a = person(h, fam, 22 + ri(60)), b = person(h, fam, Math.max(19, age[m0] - 6 + ri(13))); spouse[a] = b; spouse[b] = a; } // a couple
    else if (r < 0.8) {                                                                // a couple with children
      const a = person(h, fam, 27 + ri(26)), b = person(h, fam, Math.max(22, age[m0] - 5 + ri(11))); spouse[a] = b; spouse[b] = a;
      for (let c = 1 + ri(3); c > 0; c--) person(h, fam, Math.max(0, age[m0] - 22 - ri(14)));
    } else if (r < 0.88) { person(h, fam, 25 + ri(30)); for (let c = 1 + ri(2); c > 0; c--) person(h, fam, Math.max(0, age[m0] - 20 - ri(15))); } // one parent
    else for (let c = 2 + ri(2); c > 0; c--) person(h, ri(LAST), 19 + ri(16));       // roommates
    households.push({ building, floor, slot, m0, n: first.length - m0, line: '', machine: rnd() < 0.7, pet: 0, petName: 0 });
  }
  const n = first.length;

  // --- what each one does
  yield 0.2;
  const role = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = age[i], r = rnd();
    role[i] = a < 18 ? Role.Child : a >= 66 ? (r < 0.15 ? Role.Worker : Role.Retired) : a < 25 && r < 0.35 ? Role.Student : r < 0.86 ? Role.Worker : Role.Idle;
  }
  // jobs: first two people per shift of every shop, so none stands empty on a day off; then everyone else by the room left
  const job = new Int32Array(n).fill(-1), shift = new Uint8Array(n);
  const workers: number[] = [];
  for (let i = 0; i < n; i++) if (role[i] === Role.Worker) workers.push(i);
  for (let k = workers.length - 1; k > 0; k--) { const j = ri(k + 1); [workers[k], workers[j]] = [workers[j], workers[k]]; }
  let w = 0;
  const hire = (p: number, i: number, s: number) => { job[i] = p; shift[i] = s; places[p].staff.push(i); };
  for (let r = 0; r < 2; r++) places.forEach((P, p) => { if (P.kind === 'shop') P.shifts.forEach((_, s) => { if (w < workers.length) hire(p, workers[w++], s); }); });
  // the rest: weighted by the jobs still open (a running total, then a binary search per worker)
  const cap = places.map((P) => Math.max(0, (P as Workplace & { cap: number }).cap - P.staff.length));
  const cum = new Float64Array(places.length);
  let tot = 0;
  cap.forEach((c, p) => { tot += places[p].kind === 'shop' ? c * 6 : c; cum[p] = tot; }); // shops hire first
  yield 0.25;
  for (; w < workers.length; w++) {
    if ((w & 8191) === 0) yield 0.25 + 0.1 * (w / workers.length);
    const x = rnd() * tot;
    let lo = 0, hi = places.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
    hire(lo, workers[w], ri(places[lo].shifts.length));
  }
  places.forEach((P) => delete (P as Partial<Workplace & { cap: number }>).cap);

  // --- the hours they keep: night shifts sleep by day; the rest by their nature
  yield 0.35;
  const wake = new Uint8Array(n), bed = new Uint8Array(n), social = new Uint8Array(n), talk = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = age[i];
    social[i] = Math.floor(255 * Math.min(1, Math.max(0, rnd() * (a < 35 ? 1.2 : a < 60 ? 0.9 : 0.6))));
    talk[i] = Math.floor(256 * rnd() ** 1.5);
    if (job[i] >= 0) {
      const [s, len] = places[job[i]].shifts[shift[i]];
      if (s >= 20 || s < 4) { wake[i] = (s + len + 8) % 24; bed[i] = (s + len + 1) % 24; continue; } // up from the afternoon through the shift, asleep in the morning
      wake[i] = Math.max(4, s - 1 - ri(2)); bed[i] = Math.min(wake[i] + 21, Math.max(s + len + 2, Math.max(21, Math.min(26, wake[i] + 16 + ri(3)))));
    } else {
      wake[i] = a < 18 ? 7 : 6 + ri(5); bed[i] = a < 13 ? 20 + ri(2) : 22 + ri(4);
    }
  }

  // --- friends: a few each, mostly from the same part of the city or the same work
  const pairs: number[] = [];
  const near = (i: number) => {
    const H = households[home[i]], B = city.buildings[H.building];
    return (Math.floor((B.x0 + B.x1) / 300) * 64 + Math.floor((B.y0 + B.y1) / 300)) | 0;
  };
  const cells = new Map<number, number[]>();
  for (let i = 0; i < n; i++) { if (age[i] < 14) continue; const c = near(i); let l = cells.get(c); if (!l) cells.set(c, (l = [])); l.push(i); }
  yield 0.45;
  for (let i = 0; i < n; i++) {
    if ((i & 8191) === 0) yield 0.45 + 0.2 * (i / n);
    if (age[i] < 14) continue;
    const want = 1 + Math.floor((social[i] / 255) * 3);
    for (let k = 0; k < want; k++) {
      let j = -1;
      const r = rnd();
      if (r < 0.35 && job[i] >= 0) { const st = places[job[i]].staff; j = st[ri(st.length)]; }
      else if (r < 0.8) { const l = cells.get(near(i))!; j = l[ri(l.length)]; }
      else j = ri(n);
      if (j !== i && age[j] >= 14 && Math.abs(age[j] - age[i]) < 25) pairs.push(i, j);
    }
  }
  const deg = new Int32Array(n + 1);
  for (let k = 0; k < pairs.length; k++) deg[pairs[k] + 1]++;
  for (let i = 0; i < n; i++) deg[i + 1] += deg[i];
  const fill = deg.slice(0, n), friendList = new Int32Array(pairs.length);
  for (let k = 0; k < pairs.length; k += 2) { friendList[fill[pairs[k]]++] = pairs[k + 1]; friendList[fill[pairs[k + 1]]++] = pairs[k]; }

  // --- phones: a mobile for most adults (fewer of the old, some of the teenagers), a landline in most homes
  yield 0.65;
  const byNum = new Map<string, number>();
  const taken = (s: string) => byNum.has(s) || T.byNum.has(s) || s === T.player.number.replace('-', '');
  let q = 0;
  const number = () => { let s = ''; while (!s || taken(s)) s = localNumber(seed, 200000 + q++); return s; };
  const phone = new Uint8Array(n).fill(255), mobile: string[] = new Array(n).fill('');
  for (let i = 0; i < n; i++) {
    if ((i & 4095) === 0) yield 0.65 + 0.25 * (i / n);
    const a = age[i], p = a < 13 ? 0 : a < 18 ? 0.5 : a < 66 ? 0.88 : 0.55;
    if (rnd() >= p) continue;
    const r = rnd() * (a < 40 ? 1 : 0.75), tier = r < 0.5 ? 0 : r < 0.85 ? 1 : 2;
    phone[i] = ri(MAKERS) * 3 + tier;
    mobile[i] = number(); byNum.set(mobile[i], i);
  }
  yield 0.9;
  households.forEach((H, h) => {
    const old = age[H.m0] > 50;
    if (rnd() < (old ? 0.92 : 0.62)) { H.line = number(); byNum.set(H.line, -1 - h); }
  });

  // --- gender and pets: from hashes, so the draws above stay as they were. A couple is mostly a man
  // and a woman (some are two men or two women); a pet in about four homes in ten
  yield 0.92;
  const gender = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const s = spouse[i];
    gender[i] = s >= 0 && s < i ? (hash3(seed, i, 0x9e7) < 0.94 ? 1 - gender[s] : gender[s]) : hash3(seed, i, 0x9e6) < 0.5 ? 1 : 0;
  }
  households.forEach((H, h) => {
    const r = hash3(seed, h, 0x9e7a);
    H.pet = r < 0.18 ? 1 : r < 0.34 ? 2 : r < 0.38 ? 3 : r < 0.42 ? 4 : 0;
    H.petName = Math.floor(hash3(seed, h, 0x9e7b) * 65536);
  });

  return {
    seed, n, first: Uint16Array.from(first), last: Uint16Array.from(last), age: Uint8Array.from(age), gender, role, home: Int32Array.from(home), job, shift,
    spouse: Int32Array.from(spouse), friendAt: deg, friendList, wake, bed, social, talk, phone, mobile, households, workplaces: places, byNum,
  };
}

/** What someone is doing. */
export enum Doing { Asleep, Home, Walk, Work, Out, Errand }

/**
 * A stretch of someone's day, in hours from the day's midnight (past 24 for after midnight): at a
 * place (to, with biz for a business), or walking from one building to another.
 */
export interface Seg {
  a: number;
  b: number;
  doing: Doing;
  from: number;
  to: number;
  biz: number;
}

export interface Whereabouts {
  doing: Doing;
  /** The building they are in or heading to. */
  building: number;
  /** The business they are at or heading to, or -1. */
  biz: number;
  /** Walking: the building they left, and how far along the way (0..1). */
  from: number;
  prog: number;
}

/** Walking pace between buildings, m/s (a city block takes about a minute). */
export const WALK_V = 1.35;
/** Hours to walk from building a to building b (along the grid, as people do). */
function walkHours(city: City, a: number, b: number): number {
  const A = city.buildings[a], B = city.buildings[b];
  const d = Math.abs((A.x0 + A.x1 - B.x0 - B.x1) / 2) + Math.abs((A.y0 + A.y1 - B.y0 - B.y1) / 2);
  return 0.02 + d / WALK_V / 3600;
}

/** Businesses by 100 m cell, to find what is near a home. */
const bizGrid = new WeakMap<City, Map<number, number[]>>();
const cellKey = (x: number, y: number) => Math.floor(x / 100) * 1024 + Math.floor(y / 100);
function nearBiz(city: City, x: number, y: number, kinds: Set<string>, r: number, pick: number): number {
  let G = bizGrid.get(city);
  if (!G) {
    G = new Map();
    city.businesses.forEach((b, k) => {
      const B = city.buildings[b.building], q = cellKey((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2);
      let l = G!.get(q); if (!l) G!.set(q, (l = [])); l.push(k);
    });
    bizGrid.set(city, G);
  }
  const found: number[] = [];
  for (let gx = Math.floor((x - r) / 100); gx <= Math.floor((x + r) / 100); gx++) for (let gy = Math.floor((y - r) / 100); gy <= Math.floor((y + r) / 100); gy++) {
    for (const k of G.get(gx * 1024 + gy) ?? []) if (kinds.has(city.businesses[k].kind)) found.push(k);
  }
  return found.length ? found[Math.floor(pick * found.length)] : -1;
}

const OUT_KINDS: Set<string> = visitKinds('out');
const ERRAND_KINDS: Set<string> = visitKinds('errand');
const LUNCH_KINDS = new Set(['diner', 'cafe', 'grocery']);
const STROLL_KINDS: Set<string> = visitKinds('stroll');

const WX = newWeather();
/** How hard it rains or snows (0..1) at game time t, by the forecast the city's weather follows. */
function rainAt(seed: number, t: number) { forecast(seed, t, WX); return WX.precip; }

/** Plans by citizen and day; dropped wholesale when it grows big (they are cheap to make again). */
const plans = new Map<number, Seg[]>();

/**
 * Citizen i's day: work (with the walk there and back) on the days they work, an errand at a shop
 * near home some days, an evening out now and then. A pure function of the person and the day, so
 * every reader (the phone, the streets, later the news) sees the same day. Time not in a stretch
 * is at home, awake or asleep.
 */
export function dayPlan(P: Population, city: City, i: number, day: number): Seg[] {
  const key = i * 4096 + (day & 4095);
  const got = plans.get(key);
  if (got) return got;
  if (plans.size > 200000) plans.clear();
  const out: Seg[] = [], h = (q: number) => hash3(P.seed ^ i, day, q);
  const home = P.households[P.home[i]].building, B = city.buildings[home], hx = (B.x0 + B.x1) / 2, hy = (B.y0 + B.y1) / 2;
  const wake = P.wake[i], bedEnd = P.bed[i] > wake ? P.bed[i] : P.bed[i] + 24;
  const free = (a: number, b: number) => a >= wake + 0.3 && b <= bedEnd - 0.3 && out.every((s) => b <= s.a || a >= s.b);
  /** A trip from a building and back: walk there, stay, walk back. */
  const trip = (from: number, at: number, stay: number, doing: Doing, to: number, biz: number, check = true) => {
    const w = walkHours(city, from, to), a = at - w, b = at + stay + w;
    if (check && !free(a, b)) return false;
    out.push({ a, b: at, doing: Doing.Walk, from, to, biz }, { a: at, b: at + stay, doing, from: to, to, biz }, { a: at + stay, b, doing: Doing.Walk, from: to, to: from, biz: -1 });
    return true;
  };
  /** An errand to a shop near (x, y) within r metres, tried at a few times of the day. */
  const errand = (q: number, kinds: Set<string>, r: number, stay: number) => {
    const k = nearBiz(city, hx, hy, kinds, r, h(q));
    if (k < 0) return;
    for (let n = 0; n < 3; n++) {
      const at = wake + 1 + h(q + 1 + n) * Math.max(0, bedEnd - wake - 4);
      // not out in a downpour, unless it has to be done
      if (rainAt(P.seed, (day * 24 + at) * 3600) > 0.35 && h(q + 5) < 0.7) continue;
      if (trip(home, at, stay, Doing.Errand, city.businesses[k].building, k)) return;
    }
  };
  const j = P.job[i], wd = (((day + 2) % 7) + 7) % 7;
  if (j >= 0) {
    const W = P.workplaces[j], [s, len] = W.shifts[P.shift[i]];
    // two days off a week: the weekend at a place closed then, two days of their own at the others;
    // a shop's people on the same shift take theirs in turn, so the till is never left alone
    const off = !W.weekends ? wd === 0 || wd === 6 : W.kind === 'shop' ? (wd + 7 - offStart(P, W, i)) % 7 < 2 : (wd + i) % 7 < 2;
    // in a little early, out a little late; a lunch out from the offices and plants on a day shift
    const early = h(10) * 0.35, late = h(11) * 0.3;
    if (!off && trip(home, s - early, len + early + late, Doing.Work, W.building, W.biz)) {
      const Wb = city.buildings[W.building], lunch = nearBiz(city, (Wb.x0 + Wb.x1) / 2, (Wb.y0 + Wb.y1) / 2, LUNCH_KINDS, 250, h(12));
      if (W.kind !== 'shop' && s >= 7 && s <= 11 && len >= 8 && lunch >= 0 && h(13) < 0.55) {
        const at = s + 3.5 + h(14), stay = 0.4 + h(15) * 0.4, wseg = out[1];
        // the shift splits round the lunch, and the trip there and back comes out of it
        const w = walkHours(city, W.building, city.businesses[lunch].building);
        out.splice(1, 1, { ...wseg, b: at - w }, { ...wseg, a: at + stay + w });
        trip(W.building, at, stay, Doing.Errand, city.businesses[lunch].building, lunch, false);
      }
    }
  }
  const adult = P.age[i] >= 18, home0 = !(j >= 0);
  // errands some days: groceries, the pharmacy, the laundry, a coffee; and a stroll to a shop further off for whoever has the time
  if (P.age[i] >= 13 && h(1) < (adult ? 0.6 : 0.3)) errand(20, ERRAND_KINDS, 260, 0.2 + h(4) * 0.5);
  if (adult && h(2) < 0.3) errand(30, ERRAND_KINDS, 400, 0.15 + h(5) * 0.3);
  if (P.age[i] >= 10 && home0 && h(3) < 0.6) errand(40, STROLL_KINDS, 700, 0.1 + h(6) * 0.4);
  // an evening out, more often for the sociable
  if (adult && h(7) < (P.social[i] / 255) * 0.35) {
    const k = nearBiz(city, hx, hy, OUT_KINDS, 500, h(8));
    const at = 18.5 + h(9) * 3;
    if (k >= 0 && (rainAt(P.seed, (day * 24 + at) * 3600) < 0.5 || h(17) < 0.3)) trip(home, at, 1.2 + h(16) * 2, Doing.Out, city.businesses[k].building, k);
  }
  out.sort((x, y) => x.a - y.a);
  plans.set(key, out);
  return out;
}

/** Where a shop worker's two days off start (0..6): spread evenly over the people of the same shift. */
function offStart(P: Population, W: Workplace, i: number): number {
  let r = 0, n = 0;
  for (const j of W.staff) if (P.shift[j] === P.shift[i]) { if (j === i) r = n; n++; }
  return Math.floor((r * 7) / n);
}

/** The workplace of each shop, by business. */
const shopOf = new WeakMap<Population, Map<number, Workplace>>();

/** Who is at work in business k at game time t (the clerks behind the till), by citizen id. */
export function staffOn(P: Population, city: City, k: number, t: number): number[] {
  let M = shopOf.get(P);
  if (!M) { M = new Map(); for (const W of P.workplaces) if (W.kind === 'shop') M.set(W.biz, W); shopOf.set(P, M); }
  const out: number[] = [];
  for (const i of M.get(k)?.staff ?? []) { const R = whereIs(P, city, i, t); if (R.doing === Doing.Work && R.biz === k) out.push(i); }
  return out;
}

const HERE: Whereabouts = { doing: Doing.Home, building: -1, biz: -1, from: -1, prog: 0 };

/**
 * Where citizen i is at game time t, and what they are doing, from their day's plan (and the
 * night before, for a shift or an evening past midnight). Far-off people cost nothing: their day is
 * only looked up when someone asks. The result is shared: copy what you keep.
 */
export function whereIs(P: Population, city: City, i: number, t: number): Whereabouts {
  const day = Math.floor(t / 86400), hr = t / 3600 - day * 24, R = HERE;
  for (const [d, x] of [[day, hr], [day - 1, hr + 24]]) {
    for (const s of dayPlan(P, city, i, d)) {
      if (x < s.a || x >= s.b) continue;
      R.doing = s.doing; R.building = s.to; R.biz = s.biz; R.from = s.from; R.prog = (x - s.a) / (s.b - s.a);
      return R;
    }
  }
  R.building = P.households[P.home[i]].building; R.biz = -1; R.from = -1; R.prog = 0;
  const wake = P.wake[i], bedEnd = P.bed[i] > wake ? P.bed[i] : P.bed[i] + 24;
  R.doing = (hr >= wake && hr < bedEnd) || (hr + 24 >= wake && hr + 24 < bedEnd) ? Doing.Home : Doing.Asleep;
  return R;
}

/** The friends of citizen i. */
export function friendsOf(P: Population, i: number): Int32Array {
  return P.friendList.subarray(P.friendAt[i], P.friendAt[i + 1]);
}

/** The people living in a building, by citizen id. */
export function residentsOf(P: Population, building: number): number[] {
  const out: number[] = [];
  for (const H of P.households) if (H.building === building) for (let k = 0; k < H.n; k++) out.push(H.m0 + k);
  return out;
}

const unitIndex = new WeakMap<Population, Map<number, number>>();
/**
 * The household living in home `unit` of floor f of building k, or -1 (empty): a floor's homes are its plan's units
 * in order, and the households' slots count them (13.20; a floor with more slots than drawn homes keeps the rest
 * off the plan for now).
 */
export function homeUnit(P: Population, k: number, f: number, unit: number): number {
  let M = unitIndex.get(P);
  if (!M) {
    M = new Map();
    P.households.forEach((H, h) => M!.set((H.building * 128 + H.floor) * 64 + H.slot, h));
    unitIndex.set(P, M);
  }
  return M.get((k * 128 + f) * 64 + unit) ?? -1;
}

/**
 * What a home says about who lives there, in the words of the interiors manual's arrangements ("renda média",
 * "casal", "estudante", "gamer"…), to pick its furniture (13.20). The income is read from the best job in the house
 * until the economy (19) gives people wages: an office pays well, a shop or a plant pays middling, no job pays little.
 * The hobby is drawn from the seed (the etapa 17 gives people real ones).
 */
export function householdTags(P: Population, h: number): string[] {
  const H = P.households[h], tags: string[] = [];
  let inc = 0, couple = false, kids = false, student = false;
  for (let i = H.m0; i < H.m0 + H.n; i++) {
    const r = P.role[i] as Role, w = P.job[i] >= 0 ? P.workplaces[P.job[i]] : null;
    if (r === Role.Child) kids = true;
    if (r === Role.Student) student = true;
    if (P.spouse[i] >= 0) couple = true;
    inc = Math.max(inc, w ? (w.kind === 'office' ? 2 : 1) : r === Role.Retired ? 1 : 0);
  }
  tags.push(['renda baixa', 'renda média', 'renda alta'][inc], inc === 2 ? 'banheira' : 'chuveiro');
  if (inc === 0) tags.push('barato');
  if (couple) tags.push('casal');
  if (kids) tags.push('família', 'criança');
  if (student) tags.push('estudante');
  const hobby = hash3(P.seed ^ 0x6b1e, h, 3);
  if (hobby < 0.2) tags.push('gamer'); else if (hobby < 0.35) tags.push('leitor'); else if (hobby < 0.45) tags.push('bagunceiro');
  return tags;
}
