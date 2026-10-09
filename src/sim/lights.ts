/**
 * The lights of the rooms (13.22): whether a room is lit comes from who is in it, as the people's positions do. Near the
 * player each home, office and shop is looked up (lightsOf, written into the GPU's near buffer by gpu/world.ts); far,
 * the same rule as an average (lightShares), which the far facades use. One rule for both, so a tower seen from afar
 * and the same tower walked up to agree. The switches the player turns (world.lights) win over the rule.
 *
 * - A home: its living spaces lit while someone is home and awake; the bedroom in the last hour before bed.
 * - An office: lit through its shifts (a timer, as offices had in 2008), dark otherwise.
 * - A shop: lit while open.
 * - The stairs, halls and lobby: always (the fire code), drawn so by the shader without any of this.
 */
import { calendar } from './clock';
import { Doing, homeUnit, whereIs, type Population } from './citizens';
import { type City } from './city';
import { cellAt, planOf, ROOM, type Furn } from './interior';
import { type World } from './world';
import { isOpen } from './telco';

/** Bits of a home in a floor's word, two per home (16 homes a floor): someone up and about; someone going to bed. */
export const HOME_UP = 1, HOME_BED = 2;
/** Bits of a lot's header word: its shop is open; its offices are working. */
export const LOT_SHOP = 1, LOT_OFFICE = 2;
/** Homes a floor's word holds; switches a floor's words hold (rooms 0..31 of its plan). */
export const LIGHT_HOMES = 16, LIGHT_ROOMS = 32;
/** Going to bed: the bedroom's lamp on this long before bedtime (hours). */
const BEDTIME_H = 0.75;

/** A room's switch, as world.lights keys it: lot k, floor f, room r of the floor's plan. */
export const switchKey = (k: number, f: number, r: number) => (k * 256 + f) * LIGHT_ROOMS + r;

/** The state of household h's home at game time t: HOME_UP | HOME_BED bits. */
export function homeLights(P: Population, city: City, h: number, t: number): number {
  const H = P.households[h], hr = (t / 3600) % 24;
  let s = 0;
  for (let k = 0; k < H.n; k++) {
    const i = H.m0 + k, R = whereIs(P, city, i, t);
    if (R.building !== H.building) continue;
    if (R.doing === Doing.Home) {
      s |= HOME_UP;
      // (bedtime may pass 24)
      const toBed = (((P.bed[i] - hr) % 24) + 24) % 24;
      if (toBed < BEDTIME_H) s |= HOME_BED;
    }
  }
  return s;
}

/** Whether lot k's offices are working at game time t (any shift on, weekends only where they work them). */
function officeOn(P: Population, k: number, t: number): boolean {
  const c = calendar(t), weekend = c.weekday === 0 || c.weekday === 6;
  for (const W of officesOf(P).get(k) ?? []) {
    if (weekend && !W.weekends) continue;
    for (const [a, len] of W.shifts) if ((((c.hour - a) % 24) + 24) % 24 < len) return true;
  }
  return false;
}
const offices = new WeakMap<Population, Map<number, Population['workplaces']>>();
function officesOf(P: Population) {
  let M = offices.get(P);
  if (!M) {
    M = new Map();
    for (const W of P.workplaces) if (W.kind === 'office') { const L = M.get(W.building) ?? []; L.push(W); M.set(W.building, L); }
    offices.set(P, M);
  }
  return M;
}

/**
 * Lot k's lights at game time t, for floors 0 .. floors-1: a header word (LOT_SHOP | LOT_OFFICE), then per floor three
 * words: its homes (two bits each, by the plan's unit), and its switches (which rooms 0..31 the player set, and
 * whether each is on).
 */
export function lightsOf(P: Population, city: City, lights: Map<number, boolean>, k: number, floors: number, t: number): Uint32Array {
  const out = new Uint32Array(1 + floors * 3), biz = city.buildings[k].biz;
  out[0] = (biz >= 0 && isOpen(city.businesses[biz].kind, (t / 3600) % 24) ? LOT_SHOP : 0) | (officeOn(P, k, t) ? LOT_OFFICE : 0);
  for (let f = 0; f < floors; f++) {
    let homes = 0;
    if (P.n) for (let u = 0; u < LIGHT_HOMES; u++) { const h = homeUnit(P, k, f, u); if (h >= 0) homes |= homeLights(P, city, h, t) << (2 * u); }
    let mask = 0, on = 0;
    for (let r = 0; r < LIGHT_ROOMS; r++) {
      const v = lights.get(switchKey(k, f, r));
      if (v !== undefined) { mask |= 1 << r; if (v) on |= 1 << r; }
    }
    out[1 + f * 3] = homes; out[2 + f * 3] = mask >>> 0; out[3 + f * 3] = on >>> 0;
  }
  return out;
}

/**
 * The same rule as an average, for what is too far to look up: the share of homes with someone up at game time t, and
 * of offices working (from a fixed sample, so it moves smoothly with the hour).
 */
export function lightShares(P: Population, city: City, t: number): { home: number; work: number } {
  if (!P.n) return { home: 0.5, work: 0.5 };
  let up = 0, n = 0;
  const step = Math.max(1, Math.floor(P.households.length / 400));
  for (let h = 0; h < P.households.length; h += step) { n++; if (homeLights(P, city, h, t) & HOME_UP) up++; }
  const lots = [...officesOf(P).keys()];
  let on = 0;
  for (const k of lots) if (officeOn(P, k, t)) on++;
  return { home: up / Math.max(1, n), work: lots.length ? on / lots.length : 0.5 };
}

/**
 * Whether the room of switch f (on the player's floor) is lit now, as far as its switch knows: as the player last set
 * it, else lit when it is the room they stand in (the shader lights the viewer's room as if they had found the switch).
 */
export function switchOn(w: World, f: Furn): boolean {
  const p = w.player, v = w.lights.get(switchKey(p.inside, p.floor, f.seed));
  if (v !== undefined) return v;
  const P = planOf(w.city, p.inside, p.floor);
  return !!P && (cellAt(P, p.x, p.y) & ROOM) - 1 === f.seed;
}
/** The player turns switch f: its room's light the other way, written to the GPU at once (gpu/world.ts putLights). */
export function turnSwitch(w: World, f: Furn) {
  const p = w.player;
  w.lights.set(switchKey(p.inside, p.floor, f.seed), !switchOn(w, f));
  w.lightsDirty = p.inside;
}
