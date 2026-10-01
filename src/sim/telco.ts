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
  const area = 200 + Math.floor(hash3(seed, 555, 1) * 700);
  const line = String(Math.floor(hash3(seed, 555, 2) * 100)).padStart(2, '0');
  return { sites, sub, player: { number: `(${area}) 555-01${line}`, credit: START_CREDIT, dataKB: START_DATA_KB, usedKB: 0 } };
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
