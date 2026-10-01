import { hash3 } from '../core/rng';
import { type City } from './city';
import { TIME_SCALE } from './clock';
import { subAt, type PowerGrid } from './power';

/**
 * The mobile network: the operator's cell sites on the rooftops, and the player's line with it.
 * A site is a mast with panel antennas on top of the tallest building of its patch of the city
 * (about one every SPACING metres, as downtown macro cells were in 2008). It runs on its
 * substation, and on batteries for a few hours of game time when that goes down. What a phone
 * receives from them (signal, bars, which site serves it) is the handset's business (phone/radio.ts);
 * the sites and the accounts are the city's, and later what the player hacks.
 */
export interface CellSite {
  x: number;
  y: number;
  /** Height of the antennas above the ground, metres. */
  h: number;
  /** The building it stands on. */
  building: number;
  /** Its cell id, as a phone's field test screen shows it. */
  id: number;
  /** Also a 3G (UMTS) site: the newer ones downtown. The player's phone is GSM/EDGE only. */
  umts: boolean;
  /** Game seconds its batteries last without mains power. */
  battery: number;
}

/**
 * A line with the operator. The player's is prepaid: credit pays for calls and texts, and data
 * comes in bundles of so many kilobytes; when a bundle is used up there is no data until another
 * one is bought (stage 9B, with the operator's service codes; with money of the economy, stage 13).
 */
export interface Account {
  number: string;
  /** Credit in cents. */
  credit: number;
  /** Data left in the bundle, and used in all, in kilobytes. */
  dataKB: number;
  usedKB: number;
}

export interface Telco {
  /** The city's area code, and every business's local number (7 digits) by business index. */
  area: string;
  bizNum: string[];
  /** Local number to business index. */
  byNum: Map<string, number>;
  /** Top-up card codes already used. */
  spent: Set<string>;
  sites: CellSite[];
  /** Substation of every site. */
  sub: Uint8Array;
  player: Account;
}

const SPACING = 450;
/** The mast's height above the roof, to the antennas' middle. */
export const MAST = 6;
/** The bundle a new line starts with, in KB, and the credit. */
export const START_DATA_KB = 5 * 1024, START_CREDIT = 2000;

export function buildTelco(seed: number, city: City, power: PowerGrid): Telco {
  const nx = Math.max(1, Math.round(city.w / SPACING)), ny = Math.max(1, Math.round(city.h / SPACING));
  // the tallest building of each patch carries the site (the tower tiers carry their own: only tier 1 and up)
  const best = new Int32Array(nx * ny).fill(-1);
  city.buildings.forEach((B, k) => {
    if (B.tier < 1) return;
    const i = Math.min(nx - 1, Math.floor(((B.x0 + B.x1) / 2 / city.w) * nx)), j = Math.min(ny - 1, Math.floor(((B.y0 + B.y1) / 2 / city.h) * ny));
    if (i < 0 || j < 0) return;
    const q = j * nx + i;
    if (best[q] < 0 || B.h > city.buildings[best[q]].h) best[q] = k;
  });
  const sites: CellSite[] = [];
  best.forEach((k, q) => {
    if (k < 0) return;
    // the mast stands near a corner of the roof (the middle of a round one, or of one the diagonal cuts there)
    const B = city.buildings[k];
    let x = B.x0 + 2.5, y = B.y0 + 2.5;
    if (B.round || (B.cut && B.cut.nx * x + B.cut.ny * y > B.cut.c - 1)) { x = (B.x0 + B.x1) / 2; y = (B.y0 + B.y1) / 2; }
    const d = Math.hypot(x - city.cx, y - city.cy) / Math.hypot(city.w, city.h);
    sites.push({
      x, y, h: B.h + MAST, building: k,
      id: 10000 + Math.floor(hash3(seed, q, 41) * 50000),
      umts: d < 0.25 && hash3(seed, q, 42) < 0.7,
      battery: (2 + 4 * hash3(seed, q, 43)) * 3600,
    });
  });
  const sub = new Uint8Array(sites.map((s) => subAt(power, city, s.x, s.y)));
  // the player's number: a local area code, and a line from the 555-01xx block kept for fiction
  const area = String(200 + Math.floor(hash3(seed, 555, 1) * 700));
  const line = String(Math.floor(hash3(seed, 555, 2) * 100)).padStart(2, '0');
  // every business has a number of its own
  const byNum = new Map<string, number>();
  const bizNum = city.businesses.map((_, k) => {
    let n = '';
    for (let t = 0; !n || byNum.has(n); t++) n = localNumber(seed, k * 31 + t);
    byNum.set(n, k);
    return n;
  });
  return { area, bizNum, byNum, spent: new Set(), sites, sub, player: { number: `555-01${line}`, credit: START_CREDIT, dataKB: START_DATA_KB, usedKB: 0 } };
}

/** A made-up local number (7 digits): an exchange from 200 to 999 (never 555 or an N11), and a line. */
function localNumber(seed: number, q: number): string {
  let ex = 0;
  for (let t = 0; !ex || ex === 555 || ex % 100 === 11; t++) ex = 200 + Math.floor(hash3(seed, q, 900 + t) * 800);
  return String(ex) + String(Math.floor(hash3(seed, q, 901) * 10000)).padStart(4, '0');
}

/** A number as phones of the city show it: (area) xxx-xxxx for a local one, short codes as they are. */
export function formatNumber(T: Telco, local: string): string {
  return local.length === 7 ? `(${T.area}) ${local.slice(0, 3)}-${local.slice(3)}` : local;
}

/** Opening hours of each kind of business (from, to; to past 24 for after midnight; 0-24 always open). */
export const BIZ_HOURS: Record<string, [number, number]> = {
  diner: [6, 23], bar: [16, 26], cafe: [6, 20], pharmacy: [8, 22], grocery: [7, 23], laundry: [7, 21], pawn: [10, 19], electronics: [10, 20],
  liquor: [10, 23], hotel: [0, 24], bank: [9, 17], cinema: [12, 24], books: [10, 21], tailor: [9, 18], autoparts: [8, 19], parking: [0, 24],
};
export function isOpen(kind: string, hour: number): boolean {
  const [a, b] = BIZ_HOURS[kind] ?? [9, 17];
  return (hour >= a && hour < b) || hour + 24 < b;
}

/** Who a dialed number reaches. */
export type Callee =
  | { kind: 'biz'; k: number } | { kind: 'res'; id: number } | { kind: 'operator' } | { kind: 'emergency' }
  | { kind: 'directory' } | { kind: 'self' } | { kind: 'none' };

/**
 * The number dialed, as the exchange routes it: the service codes (911, 411, 611), a local number
 * (7 digits, or 10 with the city's area code, with or without a leading 1). A business answers its
 * own; of the other numbers about a third are homes, whose people answer (stage 11 will put the
 * citizens behind them); the rest are not in service.
 */
export function lookup(T: Telco, seed: number, dialed: string): Callee {
  if (dialed === '911') return { kind: 'emergency' };
  if (dialed === '411') return { kind: 'directory' };
  if (dialed === '611') return { kind: 'operator' };
  let d = dialed.replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  if (d.length === 10) { if (d.slice(0, 3) !== T.area) return { kind: 'none' }; d = d.slice(3); }
  if (d.length !== 7 || d[0] < '2') return { kind: 'none' };
  if (d === T.player.number.replace('-', '')) return { kind: 'self' };
  const k = T.byNum.get(d);
  if (k !== undefined) return { kind: 'biz', k };
  if (d.startsWith('555')) return { kind: 'none' };
  const h = hash3(seed, +d, 4242);
  return h < 0.35 ? { kind: 'res', id: Math.floor(h * 1e9) } : { kind: 'none' };
}

/** Whether site k is on the air at this tick: on mains power, or on its batteries for a while after it went down. */
export function siteUp(T: Telco, power: PowerGrid, k: number, tick: number): boolean {
  const s = power.subs[T.sub[k]];
  if (s.on) return true;
  return ((tick - s.changed) / 60) * TIME_SCALE < T.sites[k].battery;
}

/** Use kilobytes of the player's data; false (and nothing used) when the bundle cannot cover them. */
export function useData(A: Account, kb: number): boolean {
  if (A.dataKB < kb) return false;
  A.dataKB -= kb; A.usedKB += kb;
  return true;
}
