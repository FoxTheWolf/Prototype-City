import { hash3, mulberry32 } from '../core/rng';
import { BAY, blockAt, faceSpan, FLOOR_H, isSolid, type Building, type BusinessKind, type City } from './city';
import { COLD, PLACES } from './placeTypes';

/**
 * The insides of the buildings, in the same space as the street: no loading, the door is a gap in
 * the wall. Each floor is a raster of CELL squares holding the room they belong to; a wall is where
 * two rooms meet, a doorway is where both cells carry the DOOR bit. Room walls stand on the window
 * grid (multiples of BAY), so every window seen from the street belongs to one room. Plans are
 * made on demand from the building's position and kept, so a building is the same every visit.
 */

/** Plan raster cell in metres: a quarter of a window bay. */
export const CELL = 0.4;
/** Floor to ceiling; the slab takes the rest of FLOOR_H. */
export const CEIL = 3.2;
export const DOOR_H = 2.2;
/** On the cells of a doorway: crossing between two such cells passes. The low 7 bits are the room. */
export const DOOR = 0x80;

export type RoomKind = 'lobby' | 'hall' | 'stair' | 'lift' | 'foyer' | 'living' | 'bedroom' | 'kitchen' | 'bath' | 'office' | 'open' | 'shop' | 'store';

export interface Room {
  kind: RoomKind;
  /** Apartment or office suite it belongs to; -1 for the common parts. */
  unit: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Plan {
  /** The box this floor fills: the ground volume, or a setback higher up. */
  box: number;
  rooms: Room[];
  /** Doors to the street besides the main one: each shop's own, in its shop front. */
  exits: Door[];
  /** The furniture of the floor; it is solid. */
  furn: Furn[];
  /** Room index + 1 per cell (0 outside), with the DOOR bit. Cell (i, j) is at ((gx + i), (gy + j)) * CELL. */
  cells: Uint8Array;
  gx: number;
  gy: number;
  nx: number;
  ny: number;
}

/** Furniture: what it is, where it stands, the way it faces (c, s) and its half sizes along and across that. */
export type FurnKind = 'bed' | 'nightstand' | 'sofa' | 'coffee' | 'tv' | 'counter' | 'fridge' | 'tub' | 'toilet' | 'desk' | 'chair' | 'shelf' | 'till' | 'plant' | 'reception' | 'table'
  | 'bar' | 'stool' | 'bottles' | 'cooler' | 'case' | 'oven' | 'washer' | 'dryer';
export interface Furn {
  kind: FurnKind;
  x: number;
  y: number;
  c: number;
  s: number;
  hx: number;
  hy: number;
  seed: number;
  /** What a shelf, cooler or display case holds: goods of the shop (placeTypes), a few per piece. */
  stock?: string[];
}

/** The street door: on face 0..4 (as faceSpan numbers them), from a0 to a1 along it. */
export interface Door {
  face: number;
  a0: number;
  a1: number;
}

const HABITABLE = new Set(['office', 'glass', 'residential', 'brick', 'historic']);
/** Buildings with an inside, for now: apartments and offices. */
export function habitable(B: Building): boolean {
  return B.tier === 1 && !B.round && HABITABLE.has(B.style);
}
export const isOffice = (B: Building) => B.style === 'office' || B.style === 'glass';
export const floorsOf = (B: Building) => Math.round((B.h - 1) / FLOOR_H);

function inside(B: Building, x: number, y: number): boolean {
  return x >= B.x0 && x < B.x1 && y >= B.y0 && y < B.y1 && (!B.cut || B.cut.nx * x + B.cut.ny * y <= B.cut.c);
}

/** The building with an inside whose ground footprint holds the point, or -1. */
export function baseAt(city: City, x: number, y: number): number {
  const b = blockAt(city, x, y);
  if (!b) return -1;
  for (let k = b.b0; k < b.b1; k++) if (habitable(city.buildings[k]) && inside(city.buildings[k], x, y)) return k;
  return -1;
}

const tierCache = new Map<number, number[]>();
/** The boxes of a lot from the ground up: the ground volume, then its setbacks. */
export function tiersOf(city: City, k: number): number[] {
  let t = tierCache.get(k);
  if (t) return t;
  const B = city.buildings[k], b = blockAt(city, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2)!;
  t = [k];
  for (let j = b.b0; j < b.b1; j++) {
    const T = city.buildings[j];
    if (T.tier > 1 && T.style === B.style && inside(B, (T.x0 + T.x1) / 2, (T.y0 + T.y1) / 2)) t.push(j);
  }
  t.sort((a, b) => city.buildings[a].tier - city.buildings[b].tier);
  tierCache.set(k, t);
  return t;
}

/** The box that floor f of a lot fills (the outermost one still that tall), or -1 above the roof. */
export function storeyBox(city: City, k: number, f: number): number {
  for (const j of tiersOf(city, k)) if (floorsOf(city.buildings[j]) > f) return j;
  return -1;
}

/** Outward normal and the point at `a` along face 0..4 of a box. */
export function facePoint(B: Building, face: number, a: number): [number, number, number, number] {
  if (face === 0) return [B.x0, a, -1, 0];
  if (face === 1) return [B.x1, a, 1, 0];
  if (face === 2) return [a, B.y0, 0, -1];
  if (face === 3) return [a, B.y1, 0, 1];
  const C = B.cut!;
  return [C.nx * C.c + a * C.ny, C.ny * C.c - a * C.nx, C.nx, C.ny];
}

/** Position along face 0..4, as the renderer measures it. */
export function alongFace(B: Building, face: number, x: number, y: number): number {
  return face < 2 ? y : face < 4 ? x : x * B.cut!.ny - y * B.cut!.nx;
}

/** Just outside a lot's street door (0.6 m out), or null when it has none. */
export function doorPoint(city: City, k: number): [number, number] | null {
  const D = doorOf(city, k);
  if (!D) return null;
  const [x, y, nx, ny] = facePoint(city.buildings[k], D.face, (D.a0 + D.a1) / 2);
  return [x + nx * 0.6, y + ny * 0.6];
}

const doorCache = new Map<number, Door | null>();
/**
 * The street door of a lot: one bay on the face closest to the street that has open ground in front
 * of it; near one end when the ground floor is a shop, in the middle otherwise. Null when the lot
 * is closed in on every side.
 */
export function doorOf(city: City, k: number): Door | null {
  if (doorCache.has(k)) return doorCache.get(k)!;
  const B = city.buildings[k], blk = blockAt(city, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2)!;
  let best: Door | null = null, bestGap = 1e9;
  for (let face = 0; face < (B.cut ? 5 : 4); face++) {
    const sp = faceSpan(B, face), lo = sp[0], hi = sp[1];
    const w0 = Math.ceil((lo + 0.4) / BAY), w1 = Math.floor((hi - 0.4) / BAY) - 1;
    if (w1 < w0) continue;
    const wi = B.shop && w1 > w0 ? w0 + 1 : Math.round((w0 + w1) / 2);
    const [x, y, nx, ny] = facePoint(B, face, (wi + 0.5) * BAY);
    if (isSolid(city, x + nx * 0.6, y + ny * 0.6)) continue;
    // how far the face stands back from the edge of the block; the cut face is on the avenue
    const gap = face === 0 ? B.x0 - blk.x0 : face === 1 ? blk.x1 - B.x1 : face === 2 ? B.y0 - blk.y0 : face === 3 ? blk.y1 - B.y1 : 0;
    if (gap < bestGap - 0.5) { bestGap = gap; best = { face, a0: wi * BAY, a1: (wi + 1) * BAY }; }
  }
  doorCache.set(k, best);
  return best;
}

/**
 * Every floor of a lot shares one frame, set by the ground volume and its door: the long axis, the
 * corridor along it, and the core (stairs, and a lift in taller buildings) so the stairs line up.
 */
interface Frame {
  alongX: boolean;
  /** Corridor band across the long axis, or c0 === c1 when there is none. */
  c0: number;
  c1: number;
  /** Core: stairs from su0 to su1 (and a lift from su1 to lu1) along u, from cv0 to cv1 across. */
  su0: number;
  su1: number;
  lu1: number;
  cv0: number;
  cv1: number;
  /** A panoramic lift: the core stands against the facade and the car's outer wall is glass. */
  glass: boolean;
}

const snap = (v: number) => Math.round(v / BAY) * BAY;

const frameCache = new Map<number, Frame>();
function frameOf(city: City, k: number): Frame {
  let F = frameCache.get(k);
  if (F) return F;
  const B = city.buildings[k], alongX = B.x1 - B.x0 >= B.y1 - B.y0;
  const U0 = alongX ? B.x0 : B.y0, U1 = alongX ? B.x1 : B.y1, V0 = alongX ? B.y0 : B.x0, V1 = alongX ? B.y1 : B.x1;
  const tiers = tiersOf(city, k), tall = Math.max(...tiers.map((j) => floorsOf(city.buildings[j])));
  // the core (corridor and lift) must stand inside every tier, or a setback tower's lift stops short of its top:
  // it is laid out in the part all the tiers share (13.2b)
  let I0 = U0, I1 = U1, J0 = V0, J1 = V1;
  for (const j of tiers) {
    const T = city.buildings[j];
    I0 = Math.max(I0, alongX ? T.x0 : T.y0); I1 = Math.min(I1, alongX ? T.x1 : T.y1);
    J0 = Math.max(J0, alongX ? T.y0 : T.x0); J1 = Math.min(J1, alongX ? T.y1 : T.x1);
  }
  if (I1 - I0 < 4 * BAY || J1 - J0 < 3) { I0 = U0; I1 = U1; J0 = V0; J1 = V1; }
  const W = J1 - J0;
  // no stairs inside for now (decided 2026-10-01: they caused too much trouble): every building of
  // more than one storey has a lift
  const lift = tall > 1;
  // which side of the corridor the door is on: the core goes on the other one
  const D = doorOf(city, k);
  let dv = (J0 + J1) / 2, du = -1e9;
  if (D) { const [x, y] = facePoint(B, D.face, (D.a0 + D.a1) / 2); dv = alongX ? y : x; du = alongX ? x : y; }
  let c0: number, c1: number;
  if (W >= 10.5) { c0 = snap((J0 + J1) / 2 - BAY / 2); c1 = c0 + BAY; }
  else if (W >= 7) {
    // along one wall: the door's, so the door opens straight into it
    if (dv > (J0 + J1) / 2) { c1 = J1; c0 = snap(J1) - BAY; if (J1 - c0 < 1.2) c0 -= BAY; }
    else { c0 = J0; c1 = snap(J0) + BAY; if (c1 - J0 < 1.2) c1 += BAY; }
  }
  else { c0 = c1 = J0; }
  const mid = (I0 + I1) / 2, coreW = (lift ? 3 : 2) * BAY;
  if (c1 > c0) {
    // the core on the deeper side, unless the door opens there
    let sideA = c0 - J0 > J1 - c1;
    if (c0 === J0) sideA = false;
    else if (c1 === J1) sideA = true;
    else if (dv < c0) sideA = false;
    else if (dv > c1) sideA = true;
    // some office towers have a glass lift: the core reaches the facade
    const glass = lift && isOffice(B) && tall > 12 && hash3(Math.round(B.x0), Math.round(B.y0), 313) < 0.45;
    const depth = glass ? (sideA ? c0 - J0 : J1 - c1) : Math.min(3 * BAY, sideA ? c0 - J0 : J1 - c1);
    let su0 = snap(mid - coreW / 2);
    // when the door is on the core's side, its lobby (three bays around it) must not cross the core
    const doorSide = dv < c0 ? sideA : dv > c1 ? !sideA : false;
    if (doorSide) {
      const l0 = Math.floor(du / BAY) * BAY - BAY, l1 = l0 + 3 * BAY;
      if (su0 < l1 && su0 + coreW > l0) su0 = l1 + coreW <= I1 - 0.4 ? l1 : l0 - coreW >= I0 + 0.4 ? l0 - coreW : su0;
    }
    F = { alongX, c0, c1, su0, su1: su0 + 2 * BAY, lu1: su0 + coreW, cv0: sideA ? c0 - depth : c1, cv1: sideA ? c0 : c1 + depth, glass };
  } else {
    // a narrow walk-up: the stairs across one end, no corridor
    const su0 = I0 - 1, su1 = snap(I0) + 2 * BAY;
    F = { alongX, c0, c1, su0, su1, lu1: su1, cv0: V0 - 1, cv1: V1 + 1, glass: false };
  }
  frameCache.set(k, F);
  return F;
}

/**
 * Stairs: every stair room is a U-shaped stair. From the landing by its door (depth b < STAIR_LAND)
 * one flight climbs along the first half of its width to a landing at the back, half a storey up,
 * and the second flight climbs back along the other half to the landing of the floor above, right
 * over the first. SL gets the point's position in the room: across (a, of width W) and in from the
 * door side (b, of depth D).
 */
export const STAIR_LAND = 0.9;
export const SL = new Float64Array(4);
export function stairLocal(city: City, k: number, x: number, y: number): boolean {
  const F = frameOf(city, k), B = city.buildings[k], u = F.alongX ? x : y, v = F.alongX ? y : x;
  if (F.c1 > F.c0) {
    if (u < F.su0 || u > F.su1 || v < F.cv0 || v > F.cv1) return false;
    const near = F.cv0 < F.c0 ? F.cv1 : F.cv0;
    SL[0] = u - F.su0; SL[1] = Math.abs(v - near); SL[2] = F.su1 - F.su0; SL[3] = F.cv1 - F.cv0;
  } else {
    // a walk-up: the stairs fill one end, the door on the side of the home
    const U0 = F.alongX ? B.x0 : B.y0, V0 = F.alongX ? B.y0 : B.x0, V1 = F.alongX ? B.y1 : B.x1;
    if (u < U0 || u > F.su1 || v < V0 || v > V1) return false;
    SL[0] = v - V0; SL[1] = F.su1 - u; SL[2] = V1 - V0; SL[3] = F.su1 - U0;
  }
  return true;
}

/** Height of the stairs above their storey's floor at (a, b) of a W x D stair room: 0 to FLOOR_H. */
export function stairH(a: number, b: number, W: number, D: number): number {
  const run = D - 2 * STAIR_LAND, half = FLOOR_H / 2;
  if (run < 1 || b < STAIR_LAND) return 0;
  if (b > D - STAIR_LAND) return half;
  const t = (b - STAIR_LAND) / run;
  return a < W / 2 ? half * t : half + half * (1 - t);
}

/**
 * Walking on stairs: the new height at (x, y) for someone whose feet were at z, or null away from
 * the stairs, or NaN where the step is not possible (over the rail between the flights, below the
 * ground floor, above the top one).
 */
export function stairStep(city: City, k: number, x: number, y: number, z: number): number | null {
  if (!stairLocal(city, k, x, y)) return null;
  const H = stairH(SL[0], SL[1], SL[2], SL[3]), f = Math.floor((z + 0.01) / FLOOR_H);
  let top = 0;
  for (const j of tiersOf(city, k)) top = Math.max(top, floorsOf(city.buildings[j]) - 1);
  let best = NaN;
  for (let g = f - 1; g <= f + 1; g++) {
    const zz = g * FLOOR_H + H;
    if (g < 0 || zz > top * FLOOR_H + 0.01) continue;
    if (Number.isNaN(best) || Math.abs(zz - z) < Math.abs(best - z)) best = zz;
  }
  return Number.isNaN(best) || Math.abs(best - z) > 0.5 ? NaN : best;
}

/** The glass wall of lot k's panoramic lift shaft, as a box along u (x if alongX, else y) and across v; null if none. */
export function liftGlassBox(city: City, k: number) {
  const F = frameOf(city, k);
  return F.glass ? { alongX: F.alongX, u0: F.su1 + 0.08, u1: F.lu1 - 0.08, v0: F.cv0 - 0.3, v1: F.cv1 + 0.3 } : null;
}

/** Whether (x, y), on the facade of lot k, is the glass wall of its panoramic lift shaft. */
export function liftGlassAt(city: City, k: number, x: number, y: number): boolean {
  const G = liftGlassBox(city, k);
  if (!G) return false;
  const u = G.alongX ? x : y, v = G.alongX ? y : x;
  return u > G.u0 && u < G.u1 && v > G.v0 && v < G.v1;
}

/**
 * Every street door of lot k: the main one, then the shops' own. With `made`, only from a ground
 * plan already made (for the renderer, which must not make plans for every far facade).
 */
export function exitsOf(city: City, k: number, made = false): Door[] {
  const D = doorOf(city, k), P = made ? cachedPlan(city, k, 0) : planOf(city, k, 0);
  const out = D ? [D] : [];
  if (P) out.push(...P.exits);
  return out;
}

/**
 * Fire escapes: on brick walk-ups, two bays wide every seven bays, where the facade draws them, on
 * the faces with open ground in front. A landing at every floor, 1 m deep, and flights zigzagging
 * up the outer half (ESC_RAMP..ESC_D out from the wall), from the street to the top floor.
 */
export const ESC_D = 1, ESC_RAMP = 0.45, ESC_MID = 0.72;
export interface Escape {
  k: number;
  face: number;
  /** Where it starts on the facade (along the face), the point there, the outward normal and the direction along. */
  a0: number;
  ox: number;
  oy: number;
  nx: number;
  ny: number;
  ux: number;
  uy: number;
  /** The top floor it reaches. */
  top: number;
}
const escCache = new Map<number, Escape[]>();
/** Lots whose escapes were worked out before their ground floor's plan (its shop doors) existed. */
const escEarly = new Set<number>();
export function escapesOf(city: City, k: number): Escape[] {
  let E = escCache.get(k);
  if (E && !(escEarly.has(k) && cachedPlan(city, k, 0))) return E;
  escEarly.delete(k);
  E = [];
  const B = city.buildings[k];
  // never in front of a street door (the shops' are known once the ground floor's plan is made)
  const plan = cachedPlan(city, k, 0), doors = B.tier === 1 && B.style === 'brick' ? exitsOf(city, k, true) : [];
  if (B.tier === 1 && B.style === 'brick' && B.feat < 0.45 && B.h > 12) {
    for (let face = 0; face < 4; face++) {
      const sp = faceSpan(B, face), lo = sp[0], hi = sp[1];
      for (let m = Math.floor(lo / BAY / 7) - 1; (7 * m + 2) * BAY < hi; m++) {
        const a0 = (7 * m + 2) * BAY;
        if (a0 < lo + 0.35 || a0 + 2 * BAY > hi - 0.35) continue;
        const [x, y, nx, ny] = facePoint(B, face, a0), [mx, my] = facePoint(B, face, a0 + BAY);
        if (isSolid(city, mx + nx * 0.6, my + ny * 0.6) || (B.cut && B.cut.nx * mx + B.cut.ny * my > B.cut.c - 0.1)) continue;
        if (doors.some((D) => D.face === face && D.a1 > a0 - 0.3 && D.a0 < a0 + 2 * BAY + 0.3)) continue;
        E.push({ k, face, a0, ox: x, oy: y, nx, ny, ux: face < 2 ? 0 : 1, uy: face < 2 ? 1 : 0, top: floorsOf(B) - 1 });
      }
    }
  }
  // worked out again once the shops' doors are known
  escCache.set(k, E);
  if (!plan && B.tier === 1 && B.style === 'brick') escEarly.add(k);
  return E;
}

/** The fire escape at (x, y), with the point's place on it: u along (0..1) and d out from the wall. */
export const ESC_AT = { e: null as Escape | null, u: 0, d: 0 };
export function escapeAt(city: City, x: number, y: number): boolean {
  const b = blockAt(city, x, y);
  if (!b) return false;
  for (let k = b.b0; k < b.b1; k++) {
    const B = city.buildings[k];
    if (B.style !== 'brick' || B.tier !== 1 || x < B.x0 - ESC_D - 0.1 || x > B.x1 + ESC_D + 0.1 || y < B.y0 - ESC_D - 0.1 || y > B.y1 + ESC_D + 0.1) continue;
    for (const e of escapesOf(city, k)) {
      const dx = x - e.ox, dy = y - e.oy, d = dx * e.nx + dy * e.ny, a = dx * e.ux + dy * e.uy;
      if (d > 0 && d < ESC_D && a > 0 && a < 2 * BAY) { ESC_AT.e = e; ESC_AT.u = a / (2 * BAY); ESC_AT.d = d; return true; }
    }
  }
  return false;
}

/** Height of the fire escape under feet at z (landing, flight or the street), or NaN out of reach. */
export function escapeZ(e: Escape, u: number, d: number, z: number): number {
  // a flight within reach wins (stepping onto it is climbing it); even flights run in the inner
  // band of the outer half, odd ones in the outer band, so going up and going down are side by side
  if (d >= ESC_RAMP) for (let f = d < ESC_MID ? 0 : 1; f < e.top; f += 2) {
    const h = f * FLOOR_H + FLOOR_H * (f & 1 ? 1 - u : u);
    if (Math.abs(h - z) <= 0.45) return h;
  }
  let best = 0;
  for (let f = 1; f <= e.top; f++) if (Math.abs(f * FLOOR_H - z) < Math.abs(best - z)) best = f * FLOOR_H;
  return Math.abs(best - z) <= 0.45 ? best : NaN;
}

/** Whether a step through face `face` of lot k at `along`, on floor f, goes through a fire escape's window. */
function escapeWindow(city: City, k: number, face: number, along: number, f: number): boolean {
  if (f < 1) return false;
  for (const e of escapesOf(city, k)) {
    if (e.face !== face || f > e.top) continue;
    const a = along - e.a0, fw = (a / BAY) % 1;
    if (a > 0 && a < 2 * BAY && fw > 0.3 && fw < 0.7) return true;
  }
  return false;
}

const planCache = new Map<number, Plan | null>();
/** Plans kept at most; the oldest go first (they are remade the same when needed again). */
const PLAN_KEEP = 4000;
/** Floor f of lot k (its ground volume's index), or null above the roof. */
export function planOf(city: City, k: number, f: number): Plan | null {
  const j = storeyBox(city, k, f);
  if (j < 0) return null;
  // the floors of one box above the ground are alike
  const key = j * 2 + (f === 0 ? 0 : 1);
  let P = planCache.get(key);
  if (P === undefined) {
    P = makePlan(city, k, j, f === 0);
    planCache.set(key, P);
    if (planCache.size > PLAN_KEEP) { let n = 500; for (const old of planCache.keys()) { planCache.delete(old); if (--n === 0) break; } }
  }
  return P;
}

/** Floor f of lot k if it was already made (undefined if not yet), so a caller can spread the work over frames. */
export function cachedPlan(city: City, k: number, f: number): Plan | null | undefined {
  const j = storeyBox(city, k, f);
  return j < 0 ? null : planCache.get(j * 2 + (f === 0 ? 0 : 1));
}

function makePlan(city: City, k: number, j: number, ground: boolean): Plan {
  const B = city.buildings[j], base = city.buildings[k], F = frameOf(city, k), ax = F.alongX;
  const rnd = mulberry32((hash3(city.nameSeed ^ 0x51ab, Math.round(B.x0 * 10), Math.round(B.y0 * 10) + (ground ? 7 : 0)) * 4294967296) | 0);
  const U0 = ax ? B.x0 : B.y0, U1 = ax ? B.x1 : B.y1, V0 = ax ? B.y0 : B.x0, V1 = ax ? B.y1 : B.x1;
  const gx = Math.floor(B.x0 / CELL), gy = Math.floor(B.y0 / CELL);
  const nx = Math.ceil(B.x1 / CELL) - gx, ny = Math.ceil(B.y1 / CELL) - gy;
  const cells = new Uint8Array(nx * ny), rooms: Room[] = [];
  const C = B.cut;

  /** Fill the cells whose centers fall in a (u, v) rectangle; at the outer walls take the edge cells too. */
  const fill = (u0: number, v0: number, u1: number, v1: number, val: number, or: boolean) => {
    let x0 = ax ? u0 : v0, y0 = ax ? v0 : u0, x1 = ax ? u1 : v1, y1 = ax ? v1 : u1;
    if (x0 <= B.x0 + 1e-6) x0 -= CELL; if (y0 <= B.y0 + 1e-6) y0 -= CELL;
    if (x1 >= B.x1 - 1e-6) x1 += CELL; if (y1 >= B.y1 - 1e-6) y1 += CELL;
    for (let j2 = 0; j2 < ny; j2++) {
      const cy = (gy + j2 + 0.5) * CELL;
      if (cy < y0 || cy >= y1) continue;
      for (let i = 0; i < nx; i++) {
        const cx = (gx + i + 0.5) * CELL;
        if (cx < x0 || cx >= x1 || (C && C.nx * cx + C.ny * cy > C.c + CELL * 0.71)) continue;
        if (or) { if (cells[j2 * nx + i]) cells[j2 * nx + i] |= val; } else cells[j2 * nx + i] = val;
      }
    }
  };
  const room = (kind: RoomKind, unit: number, u0: number, v0: number, u1: number, v1: number) => {
    u0 = Math.max(u0, U0); u1 = Math.min(u1, U1); v0 = Math.max(v0, V0); v1 = Math.min(v1, V1);
    if (u1 - u0 < 0.3 || v1 - v0 < 0.3 || rooms.length >= 127) return;
    rooms.push(ax ? { kind, unit, x0: u0, y0: v0, x1: u1, y1: v1 } : { kind, unit, x0: v0, y0: u0, x1: v1, y1: u1 });
    fill(u0, v0, u1, v1, rooms.length, false);
  };
  /** A doorway: a rectangle across a wall, both sides of it get the DOOR bit (once all rooms are in). */
  const doors: number[][] = [];
  const door = (u0: number, v0: number, u1: number, v1: number) => doors.push([u0, v0, u1, v1]);
  /** Doorway through the wall at v = at, from u0 along u (1.2 m wide). */
  const doorV = (at: number, u0: number) => door(u0, at - CELL, u0 + 1.2, at + CELL);
  /** Doorway through the wall at u = at, from v0 across (1.2 m wide). */
  const doorU = (at: number, v0: number) => door(at - CELL, v0, at + CELL, v0 + 1.2);

  const office = isOffice(base), shop = ground && base.shop;
  let unit = 0;
  /** A shop's own street door: one bay in the middle of its front on the outer wall at v = vf. */
  const exits: Door[] = [];
  const shopExit = (a: number, b: number, vf: number) => {
    const face = vf <= V0 + 0.01 ? (ax ? 2 : 0) : (ax ? 3 : 1), m = (a + b) / 2, a0 = Math.floor(m / BAY) * BAY;
    if (a0 < a + 0.3 || a0 + BAY > b - 0.3) return;
    const [x, y, nX, nY] = facePoint(B, face, a0 + BAY / 2);
    if (C && C.nx * x + C.ny * y > C.c - 0.3) return;
    if (isSolid(city, x + nX * 0.6, y + nY * 0.6)) return;
    exits.push({ face, a0, a1: a0 + BAY });
  };

  /** An apartment from a to b along u, its depth running from the corridor wall at cv toward vf. */
  const apartment = (a: number, b: number, cv: number, vf: number) => {
    const s = vf > cv ? 1 : -1, D = Math.abs(vf - cv), n = (b - a) / BAY, id = unit++;
    const dv = (d0: number, d1: number): [number, number] => (s > 0 ? [cv + d0, cv + d1] : [cv - d1, cv - d0]);
    const R = (kind: RoomKind, u0: number, u1: number, d0: number, d1: number) => { const [v0, v1] = dv(d0, d1); room(kind, id, u0, v0, u1, v1); };
    const DU = (at: number, d0: number) => { const [v0] = dv(d0, d0 + 1.2); doorU(at, v0); };
    const DV = (d: number, u0: number) => doorV(cv + s * d, u0);
    // the corridor wall itself, when the corridor runs along it (cv is not an outer wall)
    const entry = (u0: number) => { if (cv > V0 + 0.01 && cv < V1 - 0.01) DV(0, u0); };
    if (n < 3.5 || D < 5) {
      // a studio: one room and a bathroom by the door
      R('living', a, b, 0, D);
      if (n >= 2 && D >= 4) { R('bath', b - BAY, b, 0, 2.4); DU(b - BAY, 0.8); }
      entry(a + 0.3);
      return;
    }
    const bedU = snap(b - (n >= 6 ? 3 : 2) * BAY);
    R('living', a, bedU, 0, D);
    R('bedroom', bedU, b, 0, D);
    DU(bedU, D - 2.6);
    R('foyer', a, a + BAY, 0, 2.4);
    entry(a + 0.3);
    DV(2.4, a + 0.2);
    if (bedU - a >= 3 * BAY - 0.01) { R('bath', a + BAY, snap(a + 2 * BAY), 0, 2.4); DU(a + BAY, 0.8); }
    if (bedU - a >= 4 * BAY - 0.01) { const k0 = snap(a + 2 * BAY); R('kitchen', k0, bedU, 0, 2.4); DV(2.4, k0 + 0.2); }
  };
  /** Office space: open plan when it is big, else a row of rooms, each with its door. */
  const offices = (a: number, b: number, cv: number, vf: number) => {
    const n = (b - a) / BAY, v0 = Math.min(cv, vf), v1 = Math.max(cv, vf), onCorr = cv > V0 + 0.01 && cv < V1 - 0.01;
    if (n >= 6 && rnd() < 0.6) {
      room('open', unit++, a, v0, b, v1);
      if (onCorr) { doorV(cv, a + 0.4); if (n > 10) doorV(cv, b - 1.6); }
      return;
    }
    for (let u = a; u < b - 0.5;) {
      const e = b - u < 4.5 * BAY ? b : snap(u + (2 + ((rnd() * 2) | 0)) * BAY);
      room('office', unit++, u, v0, e, v1);
      if (onCorr) doorV(cv, u + 0.3);
      u = e;
    }
  };
  /** Split [a, b] along u into units of a few bays and fill each. */
  const units = (a: number, b: number, cv: number, vf: number) => {
    if (b - a < 1.2) return;
    if (shop) {
      // a deep shop keeps a stockroom at the back, off the corridor, behind a door (13.2b)
      const D = Math.abs(vf - cv), s = vf > cv ? 1 : -1, id = unit++;
      if (D > 9 && b - a >= 3 * BAY) {
        const back = cv + s * Math.min(D - 6, Math.max(3, D * 0.3));
        room('store', id, a, Math.min(cv, back), b, Math.max(cv, back));
        room('shop', id, a, Math.min(back, vf), b, Math.max(back, vf));
        doorV(back, a + 0.4);
      } else room('shop', id, a, Math.min(cv, vf), b, Math.max(cv, vf));
      shopExit(a, b, vf);
      return;
    }
    if (office) { offices(a, b, cv, vf); return; }
    for (let u = a; u < b - 0.5;) {
      const n = 4 + ((rnd() * 4) | 0);
      let e = snap(u + n * BAY);
      if (b - e < 3 * BAY) e = b;
      apartment(u, e, cv, vf);
      u = e;
    }
  };

  // the lobby: from the street door to the corridor, on the ground floor
  const D = ground ? doorOf(city, k) : null;
  let lu0 = 0, lu1 = 0, lSide = 0;
  if (D) {
    const [x, y, nX, nY] = facePoint(base, D.face, (D.a0 + D.a1) / 2), du = ax ? x - nX * 0.3 : y - nY * 0.3, dvv = ax ? y - nY * 0.3 : x - nX * 0.3;
    if (dvv < F.c0 || dvv >= F.c1) {
      lSide = dvv < F.c0 ? -1 : 1;
      lu0 = Math.floor(du / BAY) * BAY - BAY; lu1 = lu0 + 3 * BAY;
    }
  }

  const corr: RoomKind = ground ? 'lobby' : 'hall';
  if (F.c1 > F.c0) {
    const core = F.cv0 < F.c0 ? -1 : 1;
    // each side: the units, around the core and the lobby
    for (const side of [-1, 1]) {
      const cv = side < 0 ? F.c0 : F.c1, vf = side < 0 ? V0 : V1;
      if ((side < 0 ? F.c0 - V0 : V1 - F.c1) < 1.2) continue;
      const holes: [number, number][] = [];
      if (side === core) holes.push([F.su0, F.lu1]);
      if (side === lSide) holes.push([lu0, lu1]);
      holes.sort((p, q) => p[0] - q[0]);
      let u = U0;
      for (const [h0, h1] of holes) { units(u, Math.max(u, h0), cv, vf); u = Math.max(u, h1); }
      units(u, U1, cv, vf);
    }
    room(corr, -1, U0, F.c0, U1, F.c1);
    // where the stairs were (they are left out for now): a nook of the corridor
    room('hall', -1, F.su0, F.cv0, F.su1, F.cv1);
    doorV(core < 0 ? F.c0 : F.c1, F.su0 + 0.4);
    if (F.lu1 > F.su1) {
      if (F.glass && F.cv1 - F.cv0 > 4) {
        // the glass car stands at the facade, 2.4 m deep, behind a small hall off the corridor
        const at = core < 0 ? F.cv0 + 2.4 : F.cv1 - 2.4;
        room('hall', -1, F.su1, F.cv0, F.lu1, F.cv1);
        room('lift', -1, F.su1, core < 0 ? F.cv0 : at, F.lu1, core < 0 ? at : F.cv1);
        doorV(at, F.su1 + 0.2);
      } else room('lift', -1, F.su1, F.cv0, F.lu1, F.cv1);
      doorV(core < 0 ? F.c0 : F.c1, F.su1 + 0.4);
    }
    // behind a shallow core, a room of the unit next to it
    const outer = core < 0 ? V0 : V1, back = core < 0 ? F.cv0 : F.cv1;
    if (Math.abs(outer - back) > 1.2) {
      const v0 = Math.min(outer, back), v1 = Math.max(outer, back), vm = (v0 + v1) / 2;
      const c = cellAt({ box: j, rooms, exits, furn: [], cells, gx, gy, nx, ny }, ax ? F.su0 - 0.2 : vm, ax ? vm : F.su0 - 0.2) & 127;
      const next = c && rooms[c - 1].unit >= 0 ? rooms[c - 1] : null; // not a corridor or the lobby
      room(next ? (next.kind === 'shop' || next.kind === 'store' || next.kind === 'open' || next.kind === 'office' ? next.kind : 'bedroom') : office ? 'office' : 'bedroom', next ? next.unit : unit++, F.su0, v0, F.lu1, v1);
      if (next && next.kind !== 'shop' && next.kind !== 'store') doorU(F.su0, vm - 0.6);
    }
    if (lSide) { room('lobby', -1, lu0, lSide < 0 ? V0 : F.c1, lu1, lSide < 0 ? F.c0 : V1); doorV(lSide < 0 ? F.c0 : F.c1, (Math.max(lu0, U0) + Math.min(lu1, U1)) / 2 - 0.6); }
  } else {
    // walk-up: stairs at one end, the rest is one home (or a shop downstairs)
    // a walk-up: its end is a lift (the stairs are left out for now)
    room(floorsOf(city.buildings[k]) > 1 ? 'lift' : 'hall', -1, U0, V0, F.su1, V1);
    if (shop) { room('shop', unit++, F.su1, V0, U1, V1); shopExit(F.su1, U1, V0); if (!exits.length) shopExit(F.su1, U1, V1); }
    else if (office) { room('office', unit++, F.su1, V0, U1, V1); doorU(F.su1, V0 + 0.4); }
    else {
      const n = (U1 - F.su1) / BAY, id = unit++;
      if (n >= 5) { const b = snap(U1 - 2 * BAY); room('living', id, F.su1, V0, b, V1); room('bedroom', id, b, V0, U1, V1); doorU(b, V0 + 0.4); }
      else room('living', id, F.su1, V0, U1, V1);
      doorU(F.su1, V0 + 0.4);
    }
  }
  for (const [u0, v0, u1, v1] of doors) fill(u0, v0, u1, v1, DOOR, true);
  connect(cells, nx, ny, rooms);
  const P: Plan = { box: j, rooms, exits, furn: [], cells, gx, gy, nx, ny };
  // the street doors (the main one and the shops'), so nothing is put in front of them
  const streets: [number, number][] = [];
  if (ground) {
    const main = doorOf(city, k);
    for (const D of main ? [main, ...exits] : exits) { const [x, y] = facePoint(city.buildings[k], D.face, (D.a0 + D.a1) / 2); streets.push([x, y]); }
  }
  furnish(P, rnd, office, streets, shop && base.biz >= 0 ? city.businesses[base.biz]?.kind : undefined);
  return P;
}

/**
 * Make every room reachable from the stairs (shops stay closed): where the cut of the diagonal,
 * or a tight lot, left a room with no way in, open a doorway to a neighbour that has one.
 */
function connect(cells: Uint8Array, nx: number, ny: number, rooms: Room[]) {
  const seen = new Uint8Array(nx * ny), stack: number[] = [];
  // from the stairs; where the cut took them away, from the lobby or the corridor
  let start = cells.findIndex((v) => v !== 0 && (rooms[(v & 127) - 1].kind === 'stair' || rooms[(v & 127) - 1].kind === 'lift'));
  if (start < 0) start = cells.findIndex((v) => v !== 0 && (rooms[(v & 127) - 1].kind === 'lobby' || rooms[(v & 127) - 1].kind === 'hall'));
  if (start < 0) return;
  for (let guard = 0; guard < 60; guard++) {
    seen.fill(0); stack.length = 0; stack.push(start); seen[start] = 1;
    while (stack.length) {
      const c = stack.pop()!, v = cells[c], i = c % nx, j = (c - i) / nx;
      for (const d of [1, -1, nx, -nx]) {
        if ((d === 1 && i === nx - 1) || (d === -1 && i === 0) || (d === nx && j === ny - 1) || (d === -nx && j === 0)) continue;
        const e = c + d, w = cells[e];
        if (!w || seen[e] || ((w & 127) !== (v & 127) && !(w & v & DOOR))) continue;
        seen[e] = 1; stack.push(e);
      }
    }
    // the first wall between a reached cell and a room still closed off: a doorway three cells wide
    let made = false;
    for (let c = 0; c < nx * ny && !made; c++) {
      const i = c % nx;
      for (const d of [1, nx]) {
        if (d === 1 && i === nx - 1) continue;
        for (const [a, b] of [[c, c + d], [c + d, c]]) {
          if (b >= nx * ny || a < 0 || !cells[b] || seen[b] || !seen[a] || rooms[(cells[b] & 127) - 1].kind === 'shop' || rooms[(cells[b] & 127) - 1].kind === 'store') continue;
          const side = d === 1 ? nx : 1;
          for (const o of [-side, 0, side]) {
            const p = a + o, q = b + o;
            if (p < 0 || q < 0 || p >= nx * ny || q >= nx * ny) continue;
            if ((cells[p] & 127) === (cells[a] & 127) && (cells[q] & 127) === (cells[b] & 127)) { cells[p] |= DOOR; cells[q] |= DOOR; }
          }
          made = true; break;
        }
        if (made) break;
      }
    }
    if (!made) return;
  }
}

/**
 * Furnish every room by its kind. A piece goes against a wall (or in a grid, for desks and shop
 * shelves), only where all its floor and a strip in front of it are that room's, away from the
 * doorways and the other pieces, so the rooms stay walkable.
 */
/** Metres kept clear around doorways when furnishing. */
const CLEAR = 0.9;
function furnish(P: Plan, rnd: () => number, office: boolean, streets: [number, number][], biz?: BusinessKind) {
  const F = P.furn;
  const free = (r: number, x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0 + 0.1; y < y1; y += 0.2) for (let x = x0 + 0.1; x < x1; x += 0.2) {
      const c = cellAt(P, x, y);
      if ((c & 127) !== r + 1 || c & DOOR) return false;
    }
    // keep a metre clear in front of every doorway, and 1.6 m in front of the street doors
    for (let y = y0 - CLEAR; y < y1 + CLEAR; y += 0.2) for (let x = x0 - CLEAR; x < x1 + CLEAR; x += 0.2) if (cellAt(P, x, y) & DOOR) return false;
    for (const [sx, sy] of streets) if (sx > x0 - 1.6 && sx < x1 + 1.6 && sy > y0 - 1.6 && sy < y1 + 1.6) return false;
    for (const f of F) {
      const ex = Math.abs(f.c) * f.hx + Math.abs(f.s) * f.hy, ey = Math.abs(f.s) * f.hx + Math.abs(f.c) * f.hy;
      if (x0 < f.x + ex && x1 > f.x - ex && y0 < f.y + ey && y1 > f.y - ey) return false;
    }
    return true;
  };
  /** Put a piece of depth L and width W facing (c, s) with its back at (bx, by); front: clear strip in front. */
  const put = (r: number, kind: FurnKind, bx: number, by: number, c: number, s: number, L: number, W: number, front: number): Furn | null => {
    const x = bx + c * L / 2, y = by + s * L / 2, ex = Math.abs(c) * L / 2 + Math.abs(s) * W / 2, ey = Math.abs(s) * L / 2 + Math.abs(c) * W / 2;
    const fx = c * (L / 2 + front / 2), fy = s * (L / 2 + front / 2), fex = Math.abs(c) * front / 2 + Math.abs(s) * W / 2, fey = Math.abs(s) * front / 2 + Math.abs(c) * W / 2;
    if (!free(r, x - ex, y - ey, x + ex, y + ey)) return null;
    if (front > 0 && !free(r, x + fx - fex, y + fy - fey, x + fx + fex, y + fy + fey)) return null;
    const f: Furn = { kind, x, y, c, s, hx: L / 2, hy: W / 2, seed: (rnd() * 1e6) | 0 };
    F.push(f);
    return f;
  };
  /** Against one of the room's walls, trying them (and spots along them) in turn. */
  const wall = (r: number, R: Room, kind: FurnKind, L: number, W: number, front: number, spots = [0.5, 0.3, 0.7]): Furn | null => {
    const walls: [number, number, number, number, number][] = [
      [R.x0 + 0.05, 0, 1, 0, R.y1 - R.y0], [R.x1 - 0.05, 0, -1, 0, R.y1 - R.y0], [0, R.y0 + 0.05, 0, 1, R.x1 - R.x0], [0, R.y1 - 0.05, 0, -1, R.x1 - R.x0]];
    const start = (rnd() * 4) | 0;
    for (const t of spots) for (let k = 0; k < 4; k++) {
      const [wx, wy, c, s, len] = walls[(start + k) % 4];
      if (len < W + 0.2) continue;
      const along = (c ? R.y0 : R.x0) + 0.1 + W / 2 + t * (len - W - 0.2);
      const f = c ? put(r, kind, wx, along, c, s, L, W, front) : put(r, kind, along, wy, c, s, L, W, front);
      if (f) return f;
    }
    return null;
  };
  /** Goods of the shop for one piece: a few of what it sells, from a spot picked by the plan's dice; the cold ones only in a cooler, and never on a dry shelf. */
  const stock = (biz: BusinessKind | undefined, n: number, cold = false): string[] | undefined => {
    const sold = biz ? PLACES[biz].sells.map(([g]) => g) : [], keep = sold.filter((g) => COLD.has(g) === cold);
    const all = keep.length || cold ? keep : sold;
    if (!all.length) return undefined;
    const out: string[] = [], at = (rnd() * all.length) | 0;
    for (let k = 0; k < Math.min(n, all.length); k++) out.push(all[(at + k) % all.length]);
    return out;
  };
  /** A run of pieces side by side along the first wall where at least `min` of them fit. */
  const row = (r: number, R: Room, kind: FurnKind, L: number, W: number, front: number, n: number, min = 2, biz?: BusinessKind): Furn[] => {
    const walls: [number, number, number, number, number][] = [
      [R.x0 + 0.05, 0, 1, 0, R.y1 - R.y0], [R.x1 - 0.05, 0, -1, 0, R.y1 - R.y0], [0, R.y0 + 0.05, 0, 1, R.x1 - R.x0], [0, R.y1 - 0.05, 0, -1, R.x1 - R.x0]];
    const start = (rnd() * 4) | 0;
    for (let k = 0; k < 4; k++) {
      const [wx, wy, c, s, len] = walls[(start + k) % 4], got: Furn[] = [];
      for (let a = 0.3 + W / 2; a < len - 0.3 - W / 2 && got.length < n; a += W + 0.05) {
        const along = (c ? R.y0 : R.x0) + a;
        const f = c ? put(r, kind, wx, along, c, s, L, W, front) : put(r, kind, along, wy, c, s, L, W, front);
        if (f) { f.stock = stock(biz, 3, kind === 'cooler'); got.push(f); }
      }
      if (got.length >= min) return got;
      for (const f of got) F.splice(F.indexOf(f), 1);
    }
    return [];
  };
  /** Small tables with a chair on two sides, in a grid over what is left of the room. */
  const tables = (r: number, R: Room, step: number) => {
    for (let y = R.y0 + 1.4; y < R.y1 - 1.1; y += step) for (let x = R.x0 + 1.4; x < R.x1 - 1.1; x += step) {
      const t = put(r, 'table', x - 0.4, y, 1, 0, 0.8, 0.8, 0);
      if (!t) continue;
      // put() takes the back of a piece: each chair's back 0.5 m off the table's edge, facing it
      put(r, 'chair', t.x - 0.95, t.y - 0.15, 1, 0, 0.45, 0.45, 0);
      put(r, 'chair', t.x + 0.95, t.y + 0.15, -1, 0, 0.45, 0.45, 0);
    }
  };
  /** A counter along a wall with stools in front of it (a diner's, a bar's). */
  const counterStools = (r: number, R: Room, kind: FurnKind, len: number): Furn | null => {
    const f = wall(r, R, kind, 0.7, Math.min(len, Math.max(R.x1 - R.x0, R.y1 - R.y0) - 2.4), 1.6);
    if (!f) return null;
    const px = -f.s, py = f.c, out = f.hx + 0.25;
    for (let t = -f.hy + 0.4; t <= f.hy - 0.3; t += 0.75)
      put(r, 'stool', f.x + f.c * out + px * t, f.y + f.s * out + py * t, f.c, f.s, 0.4, 0.4, 0);
    return f;
  };
  /** Aisles of free-standing shelves (up to 5 m each) down the long side, each with its goods; against the walls when the shop is too narrow. */
  const shelves = (r: number, R: Room, biz: BusinessKind | undefined, max = 99) => {
    const w = R.x1 - R.x0, d = R.y1 - R.y0, alongY = d >= w;
    const a0 = alongY ? R.x0 : R.y0, a1 = alongY ? R.x1 : R.y1, b0 = alongY ? R.y0 : R.x0, b1 = alongY ? R.y1 : R.x1;
    let n = 0;
    for (let a = a0 + 1.6; a < a1 - 1.6 && n < max; a += 2.2) for (let b = b0 + 1.4; b < b1 - 1.4 && n < max;) {
      const L = Math.min(5, b1 - 1.4 - b);
      if (L < 1) break;
      const f = alongY ? put(r, 'shelf', a, b + L / 2, 1, 0, 0.5, L, 0) : put(r, 'shelf', b + L / 2, a, 0, 1, 0.5, L, 0);
      if (f) { f.stock = stock(biz, 3); n++; }
      b += L + 1.4;
    }
    if (!n) n = row(r, R, 'shelf', 0.5, 1.4, 0.9, Math.min(max, 6), 1, biz).length;
  };
  /** A shop's floor by what the business is (placeTypes); every shop keeps a till, where the counter is (F.9). */
  const shopFloor = (r: number, R: Room, biz: BusinessKind | undefined) => {
    const area = (R.x1 - R.x0) * (R.y1 - R.y0);
    switch (biz) {
      case 'diner': case 'fastfood':
        wall(r, R, 'till', 0.7, 1.4, 1.1);
        if (biz === 'diner') counterStools(r, R, 'bar', 6);
        else { const c = wall(r, R, 'case', 0.7, 3, 1.4); if (c) c.stock = stock(biz, 4); }
        wall(r, R, 'oven', 0.8, 1.6, 0.9, [0.1, 0.9]);
        tables(r, R, 2.3);
        break;
      case 'cafe': case 'deli': case 'pizza': {
        wall(r, R, 'till', 0.7, 1.4, 1.1);
        const c = wall(r, R, 'case', 0.7, 2.4, 1.4);
        if (c) c.stock = stock(biz, 4);
        if (biz === 'pizza') wall(r, R, 'oven', 0.9, 1.6, 0.9, [0.1, 0.9]);
        else row(r, R, 'cooler', 0.7, 1, 0.9, 2, 1, biz);
        tables(r, R, 2.4);
        if (biz === 'cafe') wall(r, R, 'sofa', 0.9, 2, 1.2, [0.2, 0.8]);
        break;
      }
      case 'bar': {
        counterStools(r, R, 'bar', 7);
        const b = wall(r, R, 'bottles', 0.35, 2.4, 1.0);
        if (b) b.stock = stock(biz, 3);
        wall(r, R, 'till', 0.7, 1.2, 1.1);
        tables(r, R, 2.6);
        break;
      }
      case 'cyber':
        wall(r, R, 'till', 0.7, 1.6, 1.2);
        // the computers, each a desk with its screen and a chair, in rows
        for (let y = R.y0 + 1.6; y < R.y1 - 1.0; y += 2.2) for (let x = R.x0 + 1.2; x < R.x1 - 1.0; x += 1.7) {
          const dk = put(r, 'desk', x, y, 0, 1, 0.7, 1.4, 0);
          if (dk) put(r, 'chair', dk.x, dk.y + 0.9, 0, -1, 0.5, 0.5, 0);
        }
        row(r, R, 'cooler', 0.7, 1, 0.9, 1, 1, biz);
        break;
      case 'laundry':
        wall(r, R, 'till', 0.7, 1.4, 1.1);
        row(r, R, 'washer', 0.7, 0.7, 1.2, 8);
        row(r, R, 'dryer', 0.7, 0.7, 1.2, 8);
        if (area > 30) wall(r, R, 'table', 0.8, 1.8, 0.9, [0.5]);
        break;
      case 'grocery': case 'liquor':
        wall(r, R, 'till', 0.7, 1.6, 1.2);
        row(r, R, 'cooler', 0.7, 1, 1.0, 5, 2, biz);
        shelves(r, R, biz);
        break;
      case 'electronics': case 'phones': case 'pawn':
        wall(r, R, 'till', 0.7, 1.6, 1.1);
        row(r, R, 'case', 0.6, 1.6, 1.0, 4, 1, biz);
        shelves(r, R, biz, biz === 'electronics' ? 99 : 2);
        break;
      case 'bank':
        wall(r, R, 'reception', 0.8, Math.min(5, Math.max(R.x1 - R.x0, R.y1 - R.y0) - 2), 1.8);
        wall(r, R, 'till', 0.7, 1.2, 1.1);
        wall(r, R, 'table', 0.7, 1.4, 1.0);
        wall(r, R, 'plant', 0.45, 0.45, 0.3, [0.05, 0.95]);
        break;
      case 'hotel': case 'motel': case 'cinema': case 'parking':
        wall(r, R, 'till', 0.7, 2.2, 1.4);
        wall(r, R, 'sofa', 0.9, 2, 1.2);
        wall(r, R, 'plant', 0.45, 0.45, 0.3, [0.05, 0.95]);
        break;
      default:
        wall(r, R, 'till', 0.7, 1.8, 1.1);
        shelves(r, R, biz);
    }
  };
  /** How much of room r's floor its pieces cover, 0..1. */
  const covered = (r: number, R: Room) => {
    let a = 0;
    for (const f of F) if (f.x > R.x0 && f.x < R.x1 && f.y > R.y0 && f.y < R.y1 && (cellAt(P, f.x, f.y) & 127) === r + 1) a += 4 * f.hx * f.hy;
    return a / ((R.x1 - R.x0) * (R.y1 - R.y0));
  };
  /** Free-standing pieces in a grid over what is left of the room (islands), each with its goods. */
  const islands = (r: number, R: Room, kind: FurnKind, L: number, W: number, stepA: number, stepB: number, biz?: BusinessKind) => {
    const alongY = R.y1 - R.y0 >= R.x1 - R.x0;
    for (let a = 1.5; a < (alongY ? R.x1 - R.x0 : R.y1 - R.y0) - 1.2; a += stepA) for (let b = 1.5; b < (alongY ? R.y1 - R.y0 : R.x1 - R.x0) - 1.2; b += stepB) {
      const f = alongY ? put(r, kind, R.x0 + a - L / 2, R.y0 + b, 1, 0, L, W, 0) : put(r, kind, R.x0 + b, R.y0 + a - L / 2, 0, 1, L, W, 0);
      if (f && biz) f.stock = stock(biz, 3, kind === 'cooler');
    }
  };
  /**
   * A shop whose own layout left most of the floor bare (a wide pawn shop with two shelves, a bank
   * hall): more of what that kind of place has, in islands over the floor (13.2b).
   */
  const fillShop = (r: number, R: Room, biz: BusinessKind | undefined) => {
    if (covered(r, R) > 0.16 || (R.x1 - R.x0) * (R.y1 - R.y0) < 20) return;
    switch (biz) {
      case 'diner': case 'fastfood': case 'cafe': case 'deli': case 'pizza': case 'bar': tables(r, R, 2.0); break;
      case 'electronics': case 'phones': case 'pawn': case 'books': islands(r, R, 'case', 0.8, 1.6, 2.4, 2.6, biz); break;
      case 'laundry': islands(r, R, 'washer', 0.7, 0.7, 2.6, 0.75); break;
      case 'bank': case 'hotel': case 'motel': case 'cinema': case 'parking':
        for (let y = R.y0 + 1.8; y < R.y1 - 1.4; y += 2.8) for (let x = R.x0 + 1.8; x < R.x1 - 1.6; x += 3.2) {
          const so = put(r, 'sofa', x - 0.45, y, 1, 0, 0.9, 2, 0);
          if (so) put(r, 'coffee', so.x + 0.95, so.y, 1, 0, 0.55, 1, 0);
        }
        break;
      default: islands(r, R, 'shelf', 0.5, 4, 2.2, 5.4, biz); if (covered(r, R) < 0.12) islands(r, R, 'shelf', 0.5, 1.8, 2.0, 3.0, biz);
    }
    wall(r, R, 'plant', 0.45, 0.45, 0.3, [0.05, 0.95]);
  };
  /** A stockroom: shelves of boxes along the walls, a desk with its chair; a cooler for a place that sells cold goods. */
  const storeRoom = (r: number, R: Room, biz: BusinessKind | undefined) => {
    const dk = wall(r, R, 'desk', 0.75, 1.4, 1.0);
    if (dk) put(r, 'chair', dk.x + dk.c * 1.0, dk.y + dk.s * 1.0, -dk.c, -dk.s, 0.5, 0.5, 0);
    if (biz && PLACES[biz].sells.some(([g]) => COLD.has(g))) row(r, R, 'cooler', 0.7, 1, 0.9, 2, 1, biz);
    for (let n = 0; n < 3; n++) row(r, R, 'shelf', 0.5, 1.4, 0.9, 8, 1, biz);
  };
  P.rooms.forEach((R, r) => {
    const w = R.x1 - R.x0, d = R.y1 - R.y0;
    switch (R.kind) {
      case 'bedroom': {
        const b = wall(r, R, 'bed', 2.05, w > 2.6 && d > 2.6 ? 1.5 : 1, 0.6);
        if (b) put(r, 'nightstand', b.x - b.c * (b.hx - 0.22) - b.s * (b.hy + 0.3), b.y - b.s * (b.hx - 0.22) + b.c * (b.hy + 0.3), b.c, b.s, 0.45, 0.45, 0);
        break;
      }
      case 'living': {
        const sofa = wall(r, R, 'sofa', 0.9, 2, 1.4);
        if (sofa) put(r, 'coffee', sofa.x + sofa.c * 1.05, sofa.y + sofa.s * 1.05, sofa.c, sofa.s, 0.55, 1, 0);
        wall(r, R, 'tv', 0.45, 1.2, 1.5);
        if (w * d > 14) wall(r, R, 'table', 0.9, 1.2, 0.8, [0.3, 0.7]);
        if (rnd() < 0.6) wall(r, R, 'plant', 0.45, 0.45, 0.3, [0.05, 0.95]);
        break;
      }
      case 'kitchen': wall(r, R, 'counter', 0.62, Math.min(3, Math.max(w, d) - 0.6), 0.9); wall(r, R, 'fridge', 0.7, 0.75, 0.9, [0.05, 0.95]); break;
      case 'bath': wall(r, R, 'tub', 0.75, 1.65, 0.6); wall(r, R, 'toilet', 0.65, 0.45, 0.6, [0.2, 0.8]); break;
      case 'office': { const dk = wall(r, R, 'desk', 0.75, 1.5, 1.1); if (dk) put(r, 'chair', dk.x + dk.c * 1.0, dk.y + dk.s * 1.0, -dk.c, -dk.s, 0.5, 0.5, 0); if (rnd() < 0.5) wall(r, R, 'shelf', 0.4, 1.8, 0.7); break; }
      case 'open':
        // rows of desks, each with its chair, in a grid with aisles
        for (let y = R.y0 + 1.6; y < R.y1 - 1.2; y += 3) for (let x = R.x0 + 1.4; x < R.x1 - 1.4; x += 2.2) {
          const dk = put(r, 'desk', x, y, 0, 1, 0.75, 1.5, 0);
          if (dk) put(r, 'chair', dk.x, dk.y + 1.0, 0, -1, 0.5, 0.5, 0);
        }
        wall(r, R, 'plant', 0.45, 0.45, 0.3, [0.05, 0.95]);
        break;
      case 'shop': shopFloor(r, R, biz); fillShop(r, R, biz); break;
      case 'store': storeRoom(r, R, biz); break;
      case 'lobby':
        if (office) wall(r, R, 'reception', 0.8, 2.2, 1.2);
        wall(r, R, 'plant', 0.45, 0.45, 0.3, [0.05, 0.95]);
        break;
    }
  });
}

/** Whether (x, y) is inside a piece of the plan's furniture. */
export function inFurniture(P: Plan, x: number, y: number): boolean {
  for (const f of P.furn) {
    const dx = x - f.x, dy = y - f.y, u = dx * f.c + dy * f.s, v = -dx * f.s + dy * f.c;
    if (Math.abs(u) < f.hx + 0.05 && Math.abs(v) < f.hy + 0.05) return true;
  }
  return false;
}

/**
 * A door in a doorway between two rooms: hinged at (hx, hy) on the wall, lying along (ax, ay) when
 * shut and swinging open toward (nx, ny) (into the private room, off the corridor); w wide; its
 * middle at (cx, cy). Wide openings (over 1.7 m) and the lift's and stairs' openings have none.
 */
export interface Leaf { hx: number; hy: number; ax: number; ay: number; nx: number; ny: number; w: number; cx: number; cy: number; /** The rooms on either side (indexes; -1 for a street door). */ ra: number; rb: number }
const leafCache = new WeakMap<Plan, Leaf[]>();
const COMMON = new Set<RoomKind>(['hall', 'lobby', 'foyer']);
export function leavesOf(P: Plan): Leaf[] {
  let L = leafCache.get(P);
  if (L) return L;
  L = [];
  const { cells, nx, ny, rooms } = P;
  // d 0: walls between columns i and i + 1 (the run goes along y); d 1: between rows j and j + 1
  for (let d = 0; d < 2; d++) {
    const nA = d ? ny - 1 : nx - 1, nB = d ? nx : ny;
    for (let a = 0; a < nA; a++) {
      let run = -1, ra = 0, rb = 0;
      for (let b = 0; b <= nB; b++) {
        const p = b < nB ? (d ? cells[a * nx + b] : cells[b * nx + a]) : 0, q = b < nB ? (d ? cells[(a + 1) * nx + b] : cells[b * nx + a + 1]) : 0;
        const ok = !!(p & q & DOOR) && (p & 127) !== (q & 127);
        if (run >= 0 && (!ok || (p & 127) !== ra || (q & 127) !== rb)) {
          const w = (b - run) * CELL, A = rooms[ra - 1], B = rooms[rb - 1];
          if (w <= 1.7 && A && B && A.kind !== 'lift' && B.kind !== 'lift' && A.kind !== 'stair' && B.kind !== 'stair') {
            // it swings into the room off the common parts; between two private rooms, into the later one
            const intoB = COMMON.has(A.kind) !== COMMON.has(B.kind) ? COMMON.has(A.kind) : rb > ra, n = intoB ? 1 : -1;
            const wc = ((d ? P.gy : P.gx) + a + 1) * CELL, s0 = ((d ? P.gx : P.gy) + run) * CELL;
            L.push(d ? { hx: s0, hy: wc, ax: 1, ay: 0, nx: 0, ny: n, w, cx: s0 + w / 2, cy: wc, ra: ra - 1, rb: rb - 1 } : { hx: wc, hy: s0, ax: 0, ay: 1, nx: n, ny: 0, w, cx: wc, cy: s0 + w / 2, ra: ra - 1, rb: rb - 1 });
          }
          run = -1;
        }
        if (ok && run < 0) { run = b; ra = p & 127; rb = q & 127; }
      }
    }
  }
  leafCache.set(P, L);
  return L;
}

/** The cell value at a point (room + 1 with the DOOR bit), 0 outside the plan. */
export function cellAt(P: Plan, x: number, y: number): number {
  const i = Math.floor(x / CELL) - P.gx, j = Math.floor(y / CELL) - P.gy;
  return i < 0 || j < 0 || i >= P.nx || j >= P.ny ? 0 : P.cells[j * P.nx + i];
}

/**
 * Whether a step from (ax, ay) to (bx, by) on floor f runs into a wall: walls between rooms, the
 * outer walls (crossed only through the street door, on the ground floor), and on the street the
 * buildings without an inside.
 */
/** `open(k, n)`: whether street door n of lot k (exitsOf's order) stands open; a shut one is a wall (13.2c). */
export function blocked(city: City, f: number, ax: number, ay: number, bx: number, by: number, open?: (k: number, n: number) => boolean): boolean {
  const ka = baseAt(city, ax, ay), kb = baseAt(city, bx, by);
  if (kb < 0 && isSolid(city, bx, by)) return true;
  if (ka !== kb) {
    if (ka >= 0 && kb >= 0) return true;
    const k = ka >= 0 ? ka : kb, B = city.buildings[k];
    if (f !== 0) {
      // up a floor, only through the window onto a fire escape
      for (let face = 0; face < 4; face++) {
        const [px, py, nx, ny] = facePoint(B, face, 0);
        const sa = (ax - px) * nx + (ay - py) * ny, sb = (bx - px) * nx + (by - py) * ny;
        if (sa > 0 !== sb > 0 && escapeWindow(city, k, face, alongFace(B, face, (ax + bx) / 2, (ay + by) / 2), f)) return false;
      }
      return true;
    }
    // through one of the street doors: the main one or a shop's
    const E = exitsOf(city, k);
    for (let n = 0; n < E.length; n++) {
      const D = E[n];
      if (open && !open(k, n)) continue;
      const [px, py, nx, ny] = facePoint(B, D.face, D.a0);
      const sa = (ax - px) * nx + (ay - py) * ny, sb = (bx - px) * nx + (by - py) * ny;
      if (sa > 0 === sb > 0) continue; // not crossing this face
      const ua = alongFace(B, D.face, ax, ay), ub = alongFace(B, D.face, bx, by);
      if (Math.min(ua, ub) >= D.a0 + 0.05 && Math.max(ua, ub) <= D.a1 - 0.05) return false;
    }
    return true;
  }
  if (ka < 0) return false;
  const P = planOf(city, ka, f);
  if (!P) return true;
  if (inFurniture(P, bx, by)) return true;
  // walk the step in short hops; a wall is a change of room without the DOOR bit on both sides
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.1);
  let prev = cellAt(P, ax, ay);
  for (let s = 1; s <= n; s++) {
    const c = cellAt(P, ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n);
    if (!c || !prev) { prev = c || prev; continue; }
    if ((c & 127) !== (prev & 127) && !(c & prev & DOOR)) return true;
    prev = c;
  }
  return false;
}
