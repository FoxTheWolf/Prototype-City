import { hash3, mulberry32 } from '../core/rng';
import { type City } from './city';
import { calendar } from './clock';
import { floorsOf, habitable, isOffice, tiersOf } from './interior';
import { MAKERS } from './device';
import { BIZ_HOURS, localNumber, type Telco } from './telco';

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
  n: number;
  /** Name picks (indexes into the locale's first and last names). */
  first: Uint16Array;
  last: Uint16Array;
  age: Uint8Array;
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
export const PEOPLE = 20000;
/** Floor area of one apartment, roughly (the plans give about 46 m² of footprint per unit). */
const UNIT_M2 = 46;

/** Staff a business needs, all shifts together. */
const SHOP_STAFF: Record<string, number> = {
  diner: 7, bar: 5, cafe: 4, pharmacy: 6, grocery: 8, laundry: 3, pawn: 2, electronics: 5, liquor: 3,
  hotel: 20, bank: 12, cinema: 9, books: 3, tailor: 2, autoparts: 5, parking: 4,
};

/** Shifts that cover opening hours [a, b): one if short, two if long, three round the clock. */
function shiftsFor(a: number, b: number): [number, number][] {
  const span = b - a;
  if (span >= 24) return [[6, 8], [14, 8], [22, 8]];
  if (span > 10) { const h = Math.ceil(span / 2); return [[a, h], [a + span - h, h]]; }
  return [[a, span]];
}

const EMPTY: Population = {
  n: 0, first: new Uint16Array(0), last: new Uint16Array(0), age: new Uint8Array(0), role: new Uint8Array(0), home: new Int32Array(0),
  job: new Int32Array(0), shift: new Uint8Array(0), spouse: new Int32Array(0), friendAt: new Int32Array(1), friendList: new Int32Array(0),
  wake: new Uint8Array(0), bed: new Uint8Array(0), social: new Uint8Array(0), talk: new Uint8Array(0), phone: new Uint8Array(0), mobile: [],
  households: [], workplaces: [], byNum: new Map(),
};
/** No people (the render workers make a world without them). */
export const noPeople = (): Population => EMPTY;

/**
 * Everyone, from the seed. Names are picks (the locale takes them modulo its lists). Numbers are drawn so they never clash with a business's or a payphone's.
 */
export function generatePeople(seed: number, city: City, T: Telco, target = PEOPLE): Population {
  const FIRST = 65536, LAST = 65536;
  const rnd = mulberry32(hash3(seed, 0xc171, 11) * 2 ** 32);
  const ri = (n: number) => Math.floor(rnd() * n);

  // --- homes: apartment slots in the residential buildings (not offices), floor by floor
  const slots: [number, number, number][] = [];
  const places: Workplace[] = [];
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
  for (let h = 0; h < nh; h++) {
    const [building, floor, slot] = slots[h], m0 = first.length, fam = ri(LAST), r = rnd();
    if (r < 0.34) person(h, fam, 20 + ri(66));                                       // alone
    else if (r < 0.6) { const a = person(h, fam, 22 + ri(60)), b = person(h, fam, Math.max(19, age[m0] - 6 + ri(13))); spouse[a] = b; spouse[b] = a; } // a couple
    else if (r < 0.8) {                                                                // a couple with children
      const a = person(h, fam, 27 + ri(26)), b = person(h, fam, Math.max(22, age[m0] - 5 + ri(11))); spouse[a] = b; spouse[b] = a;
      for (let c = 1 + ri(3); c > 0; c--) person(h, fam, Math.max(0, age[m0] - 22 - ri(14)));
    } else if (r < 0.88) { person(h, fam, 25 + ri(30)); for (let c = 1 + ri(2); c > 0; c--) person(h, fam, Math.max(0, age[m0] - 20 - ri(15))); } // one parent
    else for (let c = 2 + ri(2); c > 0; c--) person(h, ri(LAST), 19 + ri(16));       // roommates
    households.push({ building, floor, slot, m0, n: first.length - m0, line: '', machine: rnd() < 0.7 });
  }
  const n = first.length;

  // --- what each one does
  const role = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = age[i], r = rnd();
    role[i] = a < 18 ? Role.Child : a >= 66 ? (r < 0.15 ? Role.Worker : Role.Retired) : a < 25 && r < 0.35 ? Role.Student : r < 0.86 ? Role.Worker : Role.Idle;
  }
  // jobs: first one person per shift of every shop, so none stands empty; then everyone else by the room left
  const job = new Int32Array(n).fill(-1), shift = new Uint8Array(n);
  const workers: number[] = [];
  for (let i = 0; i < n; i++) if (role[i] === Role.Worker) workers.push(i);
  for (let k = workers.length - 1; k > 0; k--) { const j = ri(k + 1); [workers[k], workers[j]] = [workers[j], workers[k]]; }
  let w = 0;
  const hire = (p: number, i: number, s: number) => { job[i] = p; shift[i] = s; places[p].staff.push(i); };
  places.forEach((P, p) => { if (P.kind === 'shop') P.shifts.forEach((_, s) => { if (w < workers.length) hire(p, workers[w++], s); }); });
  // the rest: weighted by the jobs still open (a running total, then a binary search per worker)
  const cap = places.map((P) => Math.max(0, (P as Workplace & { cap: number }).cap - P.staff.length));
  const cum = new Float64Array(places.length);
  let tot = 0;
  cap.forEach((c, p) => { tot += places[p].kind === 'shop' ? c * 6 : c; cum[p] = tot; }); // shops hire first
  for (; w < workers.length; w++) {
    const x = rnd() * tot;
    let lo = 0, hi = places.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
    hire(lo, workers[w], ri(places[lo].shifts.length));
  }
  places.forEach((P) => delete (P as Partial<Workplace & { cap: number }>).cap);

  // --- the hours they keep: night shifts sleep by day; the rest by their nature
  const wake = new Uint8Array(n), bed = new Uint8Array(n), social = new Uint8Array(n), talk = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = age[i];
    social[i] = Math.floor(255 * Math.min(1, Math.max(0, rnd() * (a < 35 ? 1.2 : a < 60 ? 0.9 : 0.6))));
    talk[i] = Math.floor(256 * rnd() ** 1.5);
    if (job[i] >= 0) {
      const [s, len] = places[job[i]].shifts[shift[i]];
      if (s >= 20 || s < 4) { wake[i] = (s + len + 8) % 24; bed[i] = (s + len + 1) % 24; continue; } // up from the afternoon through the shift, asleep in the morning
      wake[i] = Math.max(4, s - 1 - ri(2)); bed[i] = Math.max(21, Math.min(26, wake[i] + 16 + ri(3)));
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
  for (let i = 0; i < n; i++) {
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
  const byNum = new Map<string, number>();
  const taken = (s: string) => byNum.has(s) || T.byNum.has(s) || s === T.player.number.replace('-', '');
  let q = 0;
  const number = () => { let s = ''; while (!s || taken(s)) s = localNumber(seed, 200000 + q++); return s; };
  const phone = new Uint8Array(n).fill(255), mobile: string[] = new Array(n).fill('');
  for (let i = 0; i < n; i++) {
    const a = age[i], p = a < 13 ? 0 : a < 18 ? 0.5 : a < 66 ? 0.88 : 0.55;
    if (rnd() >= p) continue;
    const r = rnd() * (a < 40 ? 1 : 0.75), tier = r < 0.5 ? 0 : r < 0.85 ? 1 : 2;
    phone[i] = ri(MAKERS) * 3 + tier;
    mobile[i] = number(); byNum.set(mobile[i], i);
  }
  households.forEach((H, h) => {
    const old = age[H.m0] > 50;
    if (rnd() < (old ? 0.92 : 0.62)) { H.line = number(); byNum.set(H.line, -1 - h); }
  });

  return {
    n, first: Uint16Array.from(first), last: Uint16Array.from(last), age: Uint8Array.from(age), role, home: Int32Array.from(home), job, shift,
    spouse: Int32Array.from(spouse), friendAt: deg, friendList, wake, bed, social, talk, phone, mobile, households, workplaces: places, byNum,
  };
}

/** What someone is doing. */
export enum Doing { Asleep, Home, Commute, Work, Out }

export interface Whereabouts {
  doing: Doing;
  /** The building they are in or heading to (-1 when out somewhere without one). */
  building: number;
  /** A business they went out to (Out), or -1. */
  biz: number;
}

const HERE: Whereabouts = { doing: Doing.Home, building: -1, biz: -1 };
/** Whether hour h (0..24) is within [a, a + len) on a clock that wraps. */
const within = (h: number, a: number, len: number) => ((h - a + 24) % 24) < len;

/**
 * Where citizen i is at game time t, and what they are doing: a pure function of the person, the
 * day and the hour (the same answer every time it is asked), so far-off people cost nothing. Their
 * sleep, the shift on the days they work (with the trip there and back), an evening out now and
 * then at a bar, a diner or a café of the city, and otherwise home. The result is shared: copy it.
 */
export function whereIs(P: Population, city: City, i: number, t: number): Whereabouts {
  const C = calendar(t), h = C.hour, day = Math.floor(t / 86400), H = P.households[P.home[i]];
  const R = HERE;
  R.building = H.building; R.biz = -1;
  const wake = P.wake[i], bed = P.bed[i], awake = (bed - wake + 24) % 24 || 24;
  if (!within(h, wake, awake)) { R.doing = Doing.Asleep; return R; }
  const j = P.job[i];
  if (j >= 0) {
    const W = P.workplaces[j], [s, len] = W.shifts[P.shift[i]];
    // two days off a week: the weekend at a place closed then, two days of their own at the others
    const off = W.weekends ? (C.weekday + i) % 7 < 2 : C.weekday === 0 || C.weekday === 6;
    if (!off) {
      const trip = 0.25 + (i % 4) * 0.1;
      if (within(h, s, len)) { R.doing = Doing.Work; R.building = W.building; return R; }
      if (within(h, s - trip, trip) || within(h, s + len, trip)) { R.doing = Doing.Commute; R.building = within(h, s - trip, trip) ? W.building : H.building; return R; }
    }
  }
  // an evening out: some nights, for a few hours before bed
  const out = hash3(i, day, 0x0e7) < (P.social[i] / 255) * 0.3;
  if (out && P.age[i] >= 18 && within(h, 19 + (i % 3), 3)) {
    const k = outing(city, i, day);
    if (k >= 0) { R.doing = Doing.Out; R.biz = k; R.building = city.businesses[k].building; return R; }
  }
  R.doing = Doing.Home;
  return R;
}

const OUT_KINDS = new Set(['bar', 'diner', 'cafe', 'cinema']);
/** The place someone goes out to on a given day: a bar, a diner, a café or a cinema, often near home. */
function outing(city: City, i: number, day: number): number {
  const B = city.businesses, n = B.length;
  for (let k = 0; k < 8; k++) {
    const b = Math.floor(hash3(i, day, 0x0e8 + k) * n);
    if (OUT_KINDS.has(B[b].kind)) return b;
  }
  return -1;
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
