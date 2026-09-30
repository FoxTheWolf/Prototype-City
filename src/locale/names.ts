import { type City, type District } from '../sim/city';
import en from './en.json';

/**
 * Names of places, read from the locale file. The sim only stores numbers (a name seed per
 * city and a pick per district); the words live here, so the language can change without
 * touching the simulation or its seed.
 */
const L = en;
const plural = new Intl.PluralRules(L.lang, { type: 'ordinal' });

/**
 * Every named thing has a slot number; slots map to distinct roots as long as there are
 * fewer named things than roots (7919 is prime, so the step never repeats early).
 */
const SLOT_CITY = 0, SLOT_SEAM = 1, SLOT_DISTRICT = 2;
function root(city: City, slot: number): string {
  return L.roots[(city.nameSeed + slot * 7919) % L.roots.length];
}
const fill = (tpl: string, r: string, n = '') => tpl.replace('{r}', r).replace('{n}', n);

export function ordinal(n: number): string {
  return n + L.ordinal[plural.select(n) as keyof typeof L.ordinal];
}

export function cityName(city: City): string {
  return fill(L.city[city.nameSeed % L.city.length], root(city, SLOT_CITY));
}

export function seamName(city: City): string {
  return fill(L.seam, root(city, SLOT_SEAM));
}

export function districtName(city: City, d: number): string {
  const D: District = city.districts[d];
  const tpls = L.district[D.type];
  return fill(tpls[D.pick % tpls.length], root(city, SLOT_DISTRICT + d));
}

export function districtType(city: City, d: number): string {
  return L.districtType[city.districts[d].type];
}

/** Avenue k (north-south road) or street k (east-west). Wide roads get a name, the rest a number. */
export function roadName(city: City, avenue: boolean, k: number): string {
  const b = avenue ? city.xb : city.yb;
  if (!isWide(b, k)) return fill(avenue ? L.avenue : L.street, '', ordinal(k + 1));
  // wide roads are numbered in order, avenues first, so their slots stay compact
  let slot = SLOT_DISTRICT + city.districts.length;
  if (!avenue) for (let a = 0; a < city.xb.length / 2; a++) if (isWide(city.xb, a)) slot++;
  for (let a = 0; a < k; a++) if (isWide(b, a)) slot++;
  return fill(avenue ? L.wideAvenue : L.wideStreet, root(city, slot));
}

/** The first road of each axis is always a wide one (see layoutAxis). */
const isWide = (b: number[], k: number) => b[2 * k + 1] - b[2 * k] >= b[1] - b[0];

/** Landmarks take their roots from the end of the list, away from the other slots. */
export function landmarkName(city: City, k: number): string {
  return fill(L.landmark[city.landmarks[k].kind], L.roots[(city.nameSeed + (L.roots.length - 1 - k) * 7919) % L.roots.length]);
}

const COMPASS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
/** Compass point from one place to another. North is -y (sectors are numbered from the north). */
export function compass(dx: number, dy: number): string {
  return COMPASS[Math.round(((Math.atan2(dy, dx) / (2 * Math.PI)) * 8 + 8)) % 8];
}

/** Map sector code like "C3": letter = column from the west, number = row from the north. */
export function sectorCode(city: City, x: number, y: number): string {
  const sx = Math.min(city.sectors - 1, Math.max(0, Math.floor((x / city.w) * city.sectors)));
  const sy = Math.min(city.sectors - 1, Math.max(0, Math.floor((y / city.h) * city.sectors)));
  return String.fromCharCode(65 + sx) + (sy + 1);
}
