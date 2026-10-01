import { type City, type District } from '../sim/city';
import { hash3 } from '../core/rng';
import en from './en.json';
import THANKS from './thanks.json';

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

/**
 * Friends of the author, thanked by name (see CLAUDE.md, "Agradecimentos"): each one shows up
 * exactly once in every city, in a place its seed picks: a shop, a boulevard, a landmark or a
 * district takes the name. Later stages add places to the draw (a citizen, a contact, a post).
 * The key is `kind:ref`; the value, the name.
 */
const thanked = new WeakMap<City, Map<string, string>>();
function thanks(city: City): Map<string, string> {
  let m = thanked.get(city);
  if (m) return m;
  m = new Map();
  const wide: string[] = [];
  for (const avenue of [true, false]) {
    const b = avenue ? city.xb : city.yb;
    for (let k = 0; k < b.length / 2; k++) if (isWide(b, k)) wide.push(`road:${avenue ? 1 : 0}${k}`);
  }
  const marks = city.landmarks.map((l, k) => (L.landmark[l.kind].includes('{r}') ? `landmark:${k}` : '')).filter(Boolean);
  const places = [
    [0.4, city.businesses.map((_, k) => `biz:${k}`)],
    [0.2, wide],
    [0.2, marks],
    [0.2, city.districts.map((_, k) => `district:${k}`)],
  ] as const;
  THANKS.forEach((name, n) => {
    for (let tries = 0; tries < 50; tries++) {
      const h = (q: number) => hash3(city.nameSeed, 0x7a1 + n * 64 + tries, q);
      let r = h(0), kind = 0;
      while (kind < places.length - 1 && r > places[kind][0]) r -= places[kind][0], kind++;
      const list = places[kind][1];
      if (!list.length) continue;
      const key = list[Math.floor(h(1) * list.length)];
      if (!m!.has(key)) { m!.set(key, name); return; }
    }
  });
  thanked.set(city, m);
  return m;
}

export function districtName(city: City, d: number): string {
  const t = thanks(city).get(`district:${d}`);
  const D: District = city.districts[d];
  const tpls = L.district[D.type];
  return fill(tpls[D.pick % tpls.length], t ?? root(city, SLOT_DISTRICT + d));
}

export function districtType(city: City, d: number): string {
  return L.districtType[city.districts[d].type];
}

/** Avenue k (north-south road) or street k (east-west). Wide roads get a name, the rest a number. */
export function roadName(city: City, avenue: boolean, k: number): string {
  const b = avenue ? city.xb : city.yb;
  if (!isWide(b, k)) return fill(avenue ? L.avenue : L.street, '', ordinal(k + 1));
  const t = thanks(city).get(`road:${avenue ? 1 : 0}${k}`);
  if (t) return fill(avenue ? L.wideAvenue : L.wideStreet, t);
  // wide roads are numbered in order, avenues first, so their slots stay compact
  let slot = SLOT_DISTRICT + city.districts.length;
  if (!avenue) for (let a = 0; a < city.xb.length / 2; a++) if (isWide(city.xb, a)) slot++;
  for (let a = 0; a < k; a++) if (isWide(b, a)) slot++;
  return fill(avenue ? L.wideAvenue : L.wideStreet, root(city, slot));
}

/** The first road of each axis is always a wide one (see layoutAxis). */
const isWide = (b: number[], k: number) => b[2 * k + 1] - b[2 * k] >= b[1] - b[0];

/** The diagonal avenue, named from a slot between the roads' and the landmarks'. */
export function diagonalName(city: City): string {
  return fill(L.diagonal, L.roots[(city.nameSeed + (L.roots.length - 21) * 7919) % L.roots.length]);
}

/** Landmarks take their roots from the end of the list, away from the other slots. */
export function landmarkName(city: City, k: number): string {
  const t = thanks(city).get(`landmark:${k}`);
  if (t) return fill(L.landmark[city.landmarks[k].kind], t);
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

/**
 * The word on a business's blade sign: what it is (BAR, PAWN, PARK), or for hotels and cinemas the
 * most telling word of its name. At most 8 letters, upper case.
 */
export function bladeText(city: City, k: number): string {
  const t = (L.blade as Record<string, string>)[city.businesses[k].kind] ?? '';
  if (t !== '{name}') return t.slice(0, 8);
  const words = businessName(city, k).toUpperCase().split(' ').filter((w) => !['THE', 'HOTEL', 'CINEMA', 'INN', '&'].includes(w));
  return (words.sort((a, b) => b.length - a.length)[0] ?? 'OPEN').replace(/[^A-Z0-9']/g, '').slice(0, 8);
}

/** A business's name, from its name pick: a template for its kind filled with surnames and brand words. */
export function businessName(city: City, k: number): string {
  const b = city.businesses[k], n = b.name;
  const tpls = L.business[b.kind];
  const t = thanks(city).get(`biz:${k}`);
  if (t) {
    // a template with the one surname slot, the friend's full name in it
    const own = tpls.filter((s) => s.includes('{s}') && !s.includes('{s2}') && !s.includes('{w}'));
    return (own[n % own.length] ?? '{s}').replace('{s}', t);
  }
  return tpls[n % tpls.length]
    .replace('{s}', L.surnames[(n >>> 3) % L.surnames.length])
    .replace('{s2}', L.surnames[(n >>> 9) % L.surnames.length])
    .replace('{w}', L.words[(n >>> 15) % L.words.length]);
}

/** The mobile operator, named from a slot of its own. */
export function operatorName(city: City): string {
  return fill(L.operator[city.nameSeed % L.operator.length], L.roots[(city.nameSeed + (L.roots.length - 23) * 7919) % L.roots.length]);
}

/** The phone maker k of the city (see sim/device.ts), named from a slot of its own. */
export function makerName(city: City, k: number): string {
  return L.roots[(city.nameSeed + (L.roots.length - 25 - k) * 7919) % L.roots.length];
}
