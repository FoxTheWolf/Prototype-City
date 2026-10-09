import { hash3, mulberry32 } from '../core/rng';
import { BAY, blockAt, blockHundred, faceSpan, FLOOR_H, isSolid, type Building, type BusinessKind, type City } from './city';
import { BUILDINGS, FLOORS, FURN as FURN_RULES, fitArrangements, grow, shopFits, SINGLE, type Floor } from './floorplans';
import { COLD, OUTLETS, PLACES } from './placeTypes';

/**
 * The insides of the buildings, in the same space as the street: no loading, the door is a gap in
 * the wall. Each floor is a raster of CELL squares holding the room they belong to; the walls have a
 * body (13.10a): one cell thick, the WALL bit on the cells along the outer walls and on the low side
 * of every line where two rooms meet; a doorway is where the cells on both sides carry the DOOR bit
 * (and none the WALL bit). Room walls stand on the window
 * grid (multiples of BAY), so every window seen from the street belongs to one room. Plans are
 * made on demand from the building's position and kept, so a building is the same every visit.
 */

/** Plan raster cell in metres: an eighth of a window bay, and the thickness of a wall. */
export const CELL = 0.25;
/** Floor to ceiling; the slab takes the rest of FLOOR_H. */
export const CEIL = 3.2;
export const DOOR_H = 2.2;
/** A cell's room + 1 (0 outside the plan). */
export const ROOM = 0xff;
/** On the cells of a doorway: crossing between two such cells passes. */
export const DOOR = 0x100;
/** On the cells a wall stands on. */
export const WALL = 0x200;

export type RoomKind = 'lobby' | 'hall' | 'stair' | 'lift' | 'foyer' | 'living' | 'bedroom' | 'kitchen' | 'bath' | 'office' | 'open' | 'shop' | 'store' | 'roof';

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
  /** Room index + 1 per cell (0 outside), with the DOOR and WALL bits. Cell (i, j) is at ((gx + i), (gy + j)) * CELL. */
  cells: Uint16Array;
  gx: number;
  gy: number;
  nx: number;
  ny: number;
  /** The cells where two rooms of a drawn plan meet with no wall (an open plan): a way through, never a door leaf. */
  seams?: Uint8Array;
  /**
   * The way out (13.19; the signage manual's EXIT): per room, the next room + 1 on the shortest way through the
   * common parts to the street (on the ground floor, to the main street door; above, to the stair), 0 where there is
   * none (a home's or a shop's rooms, the way's end). An EXIT sign hangs over each doorway on it.
   */
  exitTo?: Uint16Array;
}

/** Furniture: what it is, where it stands, the way it faces (c, s) and its half sizes along and across that. */
export type FurnKind = 'bed' | 'nightstand' | 'sofa' | 'coffee' | 'tv' | 'counter' | 'fridge' | 'tub' | 'toilet' | 'desk' | 'chair' | 'shelf' | 'till' | 'plant' | 'reception' | 'table'
  | 'bar' | 'stool' | 'bottles' | 'cooler' | 'case' | 'oven' | 'washer' | 'dryer' | 'outlet' | 'stair' | 'switch' | 'tank' | 'ac';
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
  /** Where the one who uses it stays and the way they look (the manual's section 8; drawn plans, 13.20). */
  posto?: Posto;
  /** At a till: where the customer stands to pay, facing it (the manual's 7b). */
  serve?: Posto;
}
/** A posto: what is done there (sleep, sofa, desk, eat, cook, dishes, shower), the point and the way one faces. */
export interface Posto { kind: string; x: number; y: number; c: number; s: number }

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
/** (13.10e) Whether a door at `a` along a face of lot k opens toward the street, not into a yard closed in behind the buildings. */
export function toStreet(city: City, k: number, face: number, a: number): boolean {
  const B = city.buildings[k], [x, y, nx, ny] = facePoint(B, face, a), X = x + nx * 0.6, Y = y + ny * 0.6;
  return !blockAt(city, X, Y)?.yards?.some((r) => X > r[0] && X < r[2] && Y > r[1] && Y < r[3]);
}

export function doorOf(city: City, k: number): Door | null {
  if (doorCache.has(k)) return doorCache.get(k)!;
  // a drawn plan: its residents' street door (rework of the interiors, step 2)
  const St = stackOf(city, k);
  if (St) { const D = stackDoors(city, St).main; doorCache.set(k, D); return D; }
  const B = city.buildings[k], blk = blockAt(city, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2)!;
  let best: Door | null = null, bestGap = 1e9;
  for (let face = 0; face < (B.cut ? 5 : 4); face++) {
    // a lot reached by an alley has its door on the alley (13.10e)
    if (B.way && face !== B.way[0]) continue;
    const sp = faceSpan(B, face), lo = sp[0], hi = sp[1];
    let w0 = Math.ceil((lo + 0.4) / BAY), w1 = Math.floor((hi - 0.4) / BAY) - 1;
    if (B.way) { w0 = Math.max(w0, Math.ceil(B.way[1] / BAY - 1e-6)); w1 = Math.min(w1, Math.floor(B.way[2] / BAY + 1e-6) - 1); }
    if (w1 < w0) continue;
    // the preferred bay, else the nearest one along the face with open ground before it (13.10c)
    const pref = B.shop && w1 > w0 ? w0 + 1 : Math.round((w0 + w1) / 2);
    let wi = -1;
    for (let o = 0; o <= w1 - w0 && wi < 0; o++) for (const c of o ? [pref - o, pref + o] : [pref]) {
      if (c < w0 || c > w1) continue;
      const [x, y, nx, ny] = facePoint(B, face, (c + 0.5) * BAY);
      if (B.cut && B.cut.nx * x + B.cut.ny * y > B.cut.c - 0.3 && face < 4) continue;
      if (!isSolid(city, x + nx * 0.6, y + ny * 0.6)) { wi = c; break; }
    }
    if (wi < 0) continue;
    // how far the face stands back from the edge of the block; the cut face is on the avenue
    const gap = face === 0 ? B.x0 - blk.x0 : face === 1 ? blk.x1 - B.x1 : face === 2 ? B.y0 - blk.y0 : face === 3 ? blk.y1 - B.y1 : 0;
    if (gap < bestGap - 0.5) { bestGap = gap; best = { face, a0: wi * BAY, a1: (wi + 1) * BAY }; }
  }
  doorCache.set(k, best);
  return best;
}

const numCache = new Map<number, number>();
/**
 * The street number on a lot's door (the signage manual, section 5): counted from the block's hundred along the
 * road its door faces (blockHundred: the corner sign shows it), by how far along the block it stands; even on
 * one side of the road, odd on the other. 0 when the lot has no street door.
 */
export function doorNumber(city: City, k: number): number {
  let n = numCache.get(k);
  if (n !== undefined) return n;
  n = 0;
  const D = doorOf(city, k);
  if (D) {
    const [x, y, nx, ny] = facePoint(city.buildings[k], D.face, (D.a0 + D.a1) / 2);
    // a face turned across x looks onto an avenue (they run along y): counted along y between its crossings
    const onAve = Math.abs(nx) > Math.abs(ny), t = onAve ? y : x, b = onAve ? city.yb : city.xb;
    let c = -1;
    for (let q = 0; q < b.length / 2; q++) if (b[2 * q + 1] <= t) c = q;
    const from = c >= 0 ? b[2 * c + 1] : 0, to = c + 1 < b.length / 2 ? b[2 * c + 2] : (onAve ? city.h : city.w);
    const f = Math.min(0.999, Math.max(0, (t - from) / Math.max(1, to - from)));
    n = Math.max(1, blockHundred(c) + 2 * Math.floor(f * 48) + 2 + ((onAve ? nx : ny) < 0 ? 1 : 0));
  }
  numCache.set(k, n);
  return n;
}

let labels: Map<number, string> | null = null, labelsOf: City | null = null;
/**
 * The number as the door shows it: where two lots of one side of a block come out with the same number (49 numbers
 * a side, more lots on a long block), the second along the road gets an A, the third a B (522, 522A; C2, reunion of
 * 2026-10-08). Made once per city for every lot with a door.
 */
export function doorLabel(city: City, k: number): string {
  if (labelsOf !== city || !labels) {
    labels = new Map(); labelsOf = city;
    const groups = new Map<string, { k: number; t: number }[]>();
    for (let q = 0; q < city.buildings.length; q++) {
      const B = city.buildings[q], n = B.tier === 1 ? doorNumber(city, q) : 0, D = n ? doorOf(city, q) : null;
      if (!D) continue;
      const [x, y, nx, ny] = facePoint(B, D.face, (D.a0 + D.a1) / 2), onAve = Math.abs(nx) > Math.abs(ny);
      // (the same road: the block column or row the face stands in)
      const b = onAve ? city.xb : city.yb, c = onAve ? x : y;
      let r = -1;
      for (let i = 0; i < b.length / 2; i++) if (b[2 * i + 1] <= c) r = i;
      const key = `${n}|${onAve ? 'a' : 's'}|${r}`, g = groups.get(key) ?? [];
      g.push({ k: q, t: onAve ? y : x }); groups.set(key, g);
    }
    for (const [key, g] of groups) {
      g.sort((a, b) => a.t - b.t);
      g.forEach((e, i) => labels!.set(e.k, key.split('|')[0] + (i ? String.fromCharCode(64 + i) : '')));
    }
  }
  return labels.get(k) ?? String(doorNumber(city, k));
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
/** (13.10i) How many ground floors became one whole shop: read by tests/plans.ts. */
export let fallbacks = 0;
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
    // along one wall: the door's, so the door opens straight into it; under a shop the back one,
    // so the shop keeps the street front (13.10i)
    if ((dv > (J0 + J1) / 2) !== !!B.shop) { c1 = J1; c0 = snap(J1) - BAY; if (J1 - c0 < 1.2) c0 -= BAY; }
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
    // under a shop, at the end away from the door, so the shop is not cut in two (13.10i)
    let su0 = snap(mid - coreW / 2);
    if (B.shop && du > -1e8) { const e = du < mid ? snap(I1 - 0.4) - coreW : snap(I0 + 0.4); if (e >= I0 && e + coreW <= I1) su0 = e; }
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
/** A drawn stack's floor in the plan cache: apart from the cut plans' keys. */
const stackKey = (j: number, f: number) => -1 - (j * 128 + f);
/** Who lives in home `unit` of floor f of lot k, in the manual's words (citizens' householdTags); null before the people exist. */
let residents: ((k: number, f: number, unit: number) => string[]) | null = null;
/** The world gives the plans its people (13.20): the drawn homes made before are made again, furnished by them. */
export function setResidents(fn: typeof residents) {
  residents = fn;
  for (const key of [...planCache.keys()]) if (key < 0) planCache.delete(key);
}
/** How well an arrangement's "who" ("casal, renda alta") fits a home's tags: 2 per word in common, -1 for another income. */
function whoScore(who: string, tags: string[]): number {
  const w = who.toLowerCase(), inc = /renda (baixa|média|alta)/.exec(w), mine = tags.find((t) => t.startsWith('renda '));
  let s = 0;
  for (const t of tags) if (w.includes(t)) s += 2;
  return inc && mine && inc[0] !== mine ? s - 1 : s;
}
/** Plans kept at most; the oldest go first (they are remade the same when needed again). */
const PLAN_KEEP = 4000;
/** Floor f of lot k (its ground volume's index), or null above the roof. */
export function planOf(city: City, k: number, f: number): Plan | null {
  const j = storeyBox(city, k, f);
  if (j < 0) {
    // (13.23) a drawn stack's roof: the storey over the top floor, where its stair ends (the manual's T plans)
    const St = f === floorsOf(city.buildings[k]) ? stackOf(city, k) : null;
    if (!St?.roof) return null;
    const sk = stackKey(k, f);
    let P = planCache.get(sk);
    if (P === undefined) { P = planFromFloor(city, k, St, 2, f); P.exitTo = exitWay(city, k, P, false); planCache.set(sk, P); }
    return P;
  }
  // the floors of one box above the ground are alike (but for the furniture of the drawn ones)
  const key = j * 2 + (f === 0 ? 0 : 1);
  const St = stackOf(city, k);
  if (St) {
    // a drawn plan: the ground floor and the floors above are each one plan, cached as the cut ones are
    // per floor: the homes on each are furnished by who lives there (13.20)
    const sk = stackKey(j, f);
    let P = planCache.get(sk);
    if (P === undefined) { P = planFromFloor(city, k, St, f === 0 ? 0 : 1, f); P.exitTo = exitWay(city, k, P, f === 0); addSwitches(P); planCache.set(sk, P); }
    return P;
  }
  let P = planCache.get(key);
  if (P === undefined) {
    P = makePlan(city, k, j, f === 0);
    if (P) { P.exitTo = exitWay(city, k, P, f === 0); addSwitches(P); }
    planCache.set(key, P);
    if (planCache.size > PLAN_KEEP) { let n = 500; for (const old of planCache.keys()) { planCache.delete(old); if (--n === 0) break; } }
  }
  return P;
}

/** Plan.exitTo: a search from the way's end (the rooms at the main street door, or the stair) out through the common rooms' doorways. */
function exitWay(city: City, k: number, P: Plan, ground: boolean): Uint16Array {
  const n = P.rooms.length, next = new Uint16Array(n), seen = new Uint8Array(n), q: number[] = [];
  const common = (r: number) => r >= 0 && P.rooms[r].unit < 0;
  const end = (r: number) => { if (common(r) && !seen[r]) { seen[r] = 1; q.push(r); } };
  if (ground) {
    const D = doorOf(city, k);
    if (D) { const [x, y, nx, ny] = facePoint(city.buildings[k], D.face, (D.a0 + D.a1) / 2); end((cellAt(P, x - nx * 0.4, y - ny * 0.4) & ROOM) - 1); }
  } else P.rooms.forEach((R, r) => { if (R.kind === 'stair') end(r); });
  // two rooms meet at a doorway where neighbouring cells of each have the DOOR bit
  const adj = P.rooms.map(() => new Set<number>());
  for (let j = 0; j < P.ny; j++) for (let i = 0; i < P.nx; i++) {
    const c = P.cells[j * P.nx + i];
    if (!(c & DOOR)) continue;
    for (const e of [i + 1 < P.nx ? P.cells[j * P.nx + i + 1] : 0, j + 1 < P.ny ? P.cells[(j + 1) * P.nx + i] : 0]) {
      const a = (c & ROOM) - 1, b = (e & ROOM) - 1;
      if (e & DOOR && a >= 0 && b >= 0 && a !== b) { adj[a].add(b); adj[b].add(a); }
    }
  }
  for (let h = 0; h < q.length; h++) for (const b of adj[q[h]]) if (common(b) && !seen[b]) { seen[b] = 1; next[b] = q[h] + 1; q.push(b); }
  return next;
}

/** Floor f of lot k if it was already made (undefined if not yet), so a caller can spread the work over frames. */
export function cachedPlan(city: City, k: number, f: number): Plan | null | undefined {
  const j = storeyBox(city, k, f);
  // (a drawn stack's roof, 13.23, is cached under the lot)
  if (j < 0) return f === floorsOf(city.buildings[k]) && stackOf(city, k)?.roof ? planCache.get(stackKey(k, f)) : null;
  return planCache.get(stackOf(city, k) ? stackKey(j, f) : j * 2 + (f === 0 ? 0 : 1));
}

// ---------- the drawn plans (the interiors manual; plano-interiores, step 2) ----------

/** A lot's drawn floors (the manual's building stacks), turned to its street face and maybe mirrored. */
export interface Stack {
  k: number;
  /** The street face (0..3) the plans' first row stands on; the lot's width along it and depth from it, m. */
  face: number;
  W: number;
  D: number;
  mirror: boolean;
  /** The ground floor, the floors above it (all alike), the roof: grown to the lot's depth. */
  ground: Floor;
  upper: Floor | null;
  roof: Floor | null;
}
const floorById = new Map(FLOORS.map((F) => [F.id, F]));
const hasShop = (F: Floor) => F.rooms.some((r) => r.includes('o'));
/** Whether a drawn floor fits a lot W x D m (along its street face, then deep). */
const fitsLot = (F: Floor, W: number, D: number) => F.rooms[0].length === W * 2 && (F.depths ? F.depths.includes(D) : F.rooms.length === D * 2);
const stackCache = new Map<number, Stack | null>();
/**
 * The drawn stack of lot k, or null when the manual has none for it yet (its size, a shop or not, an office, a tower
 * with setbacks): those keep the old cut plans until their plan is drawn. The stack and the mirror come from the
 * lot's seed, so every floor of a building is the same plan (R9).
 */
export function stackOf(city: City, k: number): Stack | null {
  let S = stackCache.get(k);
  if (S !== undefined) return S;
  S = null;
  const B = city.buildings[k];
  if (habitable(B) && !isOffice(B) && B.way && !B.cut && tiersOf(city, k).length === 1) {
    const face = B.way[0], W = Math.round(face < 2 ? B.y1 - B.y0 : B.x1 - B.x0), D = Math.round(face < 2 ? B.x1 - B.x0 : B.y1 - B.y0);
    const cands = BUILDINGS.filter((T) => { const G = floorById.get(T.floors[0]); return !!G && fitsLot(G, W, D) && hasShop(G) === B.shop; });
    if (cands.length) {
      const T = cands[Math.floor(hash3(city.nameSeed ^ 0x5a17, k, 3) * cands.length)], at = (n: number) => grow(floorById.get(T.floors[n])!, D);
      S = { k, face, W, D, mirror: hash3(city.nameSeed ^ 0x5a17, k, 4) < 0.5, ground: at(0), upper: T.floors.length > 2 ? at(1) : null, roof: T.floors.length > 1 ? at(T.floors.length - 1) : null };
    }
  }
  stackCache.set(k, S);
  return S;
}

/** A point (u along the street face, v in from it, m) of a stack's plan, in the city. */
function stackXY(St: Stack, B: Building, u: number, v: number): [number, number] {
  if (St.mirror) u = St.W - u;
  return St.face === 2 ? [B.x0 + u, B.y0 + v] : St.face === 3 ? [B.x1 - u, B.y1 - v] : St.face === 0 ? [B.x0 + v, B.y1 - u] : [B.x1 - v, B.y0 + u];
}
/** A direction (du, dv) of a stack's plan, in the city. */
function stackDir(St: Stack, du: number, dv: number): [number, number] {
  if (St.mirror) du = -du;
  return St.face === 2 ? [du, dv] : St.face === 3 ? [-du, -dv] : St.face === 0 ? [dv, -du] : [-dv, du];
}
/** The street doors of a stack's ground floor: the residents' (behind it a room that is not the shop) and the shop's own. */
/**
 * Whether lot k's main street door is the residents' own (13.19): a drawn plan's, into its lobby or hall (not a
 * shop's, an office's or the motel's, which stay a pair of glass leaves). It is one wooden leaf with a glass light, a
 * glass transom over it with the street number (the signage manual, section 5). Read as stackDoors finds the main door.
 */
export function entryDoor(city: City, k: number): boolean {
  const St = stackOf(city, k);
  if (!St) return false;
  const row = St.ground.rooms[0], below = St.ground.rooms[1];
  for (let c = 0; c < row.length; c++) if (row[c] === 'R' && below[c] !== 'o') return '.cS'.includes(below[c]);
  return false;
}

function stackDoors(city: City, St: Stack): { main: Door | null; shops: Door[] } {
  const B = city.buildings[St.k], row = St.ground.rooms[0], below = St.ground.rooms[1];
  let main: Door | null = null;
  const shops: Door[] = [];
  for (let c = 0; c < row.length; c++) {
    if (row[c] !== 'R' || row[c - 1] === 'R') continue;
    let e = c;
    while (row[e + 1] === 'R') e++;
    // along the face as faceSpan measures it
    const a = stackXY(St, B, c * 0.5, 0), b = stackXY(St, B, (e + 1) * 0.5, 0), along = (p: [number, number]) => (St.face < 2 ? p[1] : p[0]);
    const D: Door = { face: St.face, a0: Math.min(along(a), along(b)), a1: Math.max(along(a), along(b)) };
    if (below.slice(c, e + 1).includes('o')) shops.push(D); else if (!main) main = D;
  }
  return { main, shops };
}

const ROOM_OF: Record<string, RoomKind> = {
  l: 'living', k: 'kitchen', b: 'bedroom', h: 'bath', s: 'living', e: 'foyer', c: 'lobby', '.': 'hall', S: 'stair', L: 'lift',
  o: 'shop', p: 'open', m: 'office', n: 'office', q: 'kitchen', u: 'hall', r: 'office', x: 'roof',
};
const FURN_OF: Record<string, FurnKind> = {
  B: 'bed', A: 'shelf', Q: 'desk', h: 'chair', F: 'sofa', r: 'sofa', T: 'tv', t: 'table', K: 'counter', O: 'oven', N: 'counter',
  G: 'fridge', V: 'counter', C: 'toilet', H: 'tub', P: 'plant', S: 'shelf', w: 'washer', y: 'dryer',
  $: 'till', '=': 'bar', v: 'case', m: 'shelf', I: 'cooler', L: 'bottles', s: 'stool', Z: 'tank', U: 'ac',
};
const PLAN_WALLS = new Set(['#', 'W', 'G', '+']);

/**
 * A stack's stair (plano-interiores step 4, redrawn as a U in 2026-10-08): along the S rectangle's long side, a landing
 * at the floor's level at the end its floors' doors open on, then two flights side by side, the first climbing away
 * from the landing to a half landing at the far end, the second climbing back to the next floor's landing, at the same
 * end. Here, in plan metres (u along the face, v in from it), the rectangle of the two flights and the half landing
 * (the stairwell), and the first flight's climb (du, dv). The same on every floor (R9).
 */
export interface Flight { u0: number; v0: number; u1: number; v1: number; du: number; dv: number }
/** A flight's run (9 treads of 25 cm) and the half landing past it, m. */
export const STAIR_RUN = 2.25, STAIR_MID = 1;
const flightCache = new Map<Stack, Flight | null>();
function flightOf(St: Stack): Flight | null {
  let F = flightCache.get(St);
  if (F !== undefined) return F;
  F = null;
  const R0 = St.ground.rooms;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  R0.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'S') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }));
  const along = x1 - x0 >= y1 - y0, len = ((along ? x1 - x0 : y1 - y0) + 1) / 2;
  if (x1 >= 0 && len >= STAIR_RUN + STAIR_MID + 1) {
    // the ways in, on every floor: a door or a room right outside the rectangle; the landing is at the end nearer them
    let sx = 0, sy = 0, n = 0;
    for (const Fl of [St.ground, St.upper, St.roof]) {
      if (!Fl) continue;
      const R = Fl.rooms, way = (x: number, y: number) => { const ch = R[y]?.[x]; return !!ch && (ch in ROOM_OF || 'DER'.includes(ch)) && ch !== 'S'; };
      for (let x = x0; x <= x1; x++) for (const y of [y0 - 1, y1 + 1]) if (way(x, y)) { sx += x; sy += y; n++; }
      for (let y = y0; y <= y1; y++) for (const x of [x0 - 1, x1 + 1]) if (way(x, y)) { sx += x; sy += y; n++; }
    }
    const mid = n ? (along ? sx / n : sy / n) : along ? x0 : y0, lowEnd = mid <= (along ? (x0 + x1) / 2 : (y0 + y1) / 2);
    const lo = (along ? x0 : y0) / 2, hi = ((along ? x1 : y1) + 1) / 2, a0 = lowEnd ? hi - STAIR_RUN - STAIR_MID : lo, a1 = lowEnd ? hi : lo + STAIR_RUN + STAIR_MID;
    F = along ? { u0: a0, v0: y0 / 2, u1: a1, v1: (y1 + 1) / 2, du: lowEnd ? 1 : -1, dv: 0 } : { u0: x0 / 2, v0: a0, u1: (x1 + 1) / 2, v1: a1, du: 0, dv: lowEnd ? 1 : -1 };
  }
  flightCache.set(St, F);
  return F;
}

/** How a grid of furniture letters (a floor's layer, or a shop room's model) stands in the city. */
interface GridMap {
  /** Metres per character across the rows (u) and down them (v): half a metre, or a shop's stretched a little to its walls. */
  su: number;
  sv: number;
  /** The city point of a grid point (u, v) in metres, and the city direction of a grid one. */
  at: (u: number, v: number) => [number, number];
  dir: (du: number, dv: number) => [number, number];
  /** How far the floor runs past a piece's side into the wall beyond (pastWall); none when the grid is the room inside its walls. */
  past?: (across: boolean, a: number, b0: number, b1: number) => number;
  /** A character that is wall (or out of the grid), and one that is free floor a posto may stand on. */
  wallish: (x: number, y: number) => boolean;
  floor: (x: number, y: number) => boolean;
}
const OUT: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/**
 * The one reader of the furniture letters (the interiors manual's grammar; homes and shops, 13.21): each letter's
 * rectangle (one per letter for chairs, stools and plants; cut into units for the pieces that come in them), facing out
 * of the wall it stands against, a chair or stool toward its table or counter, a shop counter toward the street (row
 * 0); then the postos (the manual's section 8), and the clerk's and the customer's at the counters (7b). goods: what a
 * shop's shelf, case, cooler or bottles hold; display: what the shop's expositor 'm' is.
 */
function placeGrid(P: Plan, MF: string[][], G: GridMap, rnd: () => number, goods?: (kind: FurnKind) => string[] | undefined, display: FurnKind = 'shelf') {
  const H = MF.length, Wc = MF[0].length, seen = new Uint8Array(Wc * H), { wallish } = G;
  const pieces: { ch: string; x: number; y: number; x1: number; y1: number; back: number; i: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < Wc; x++) {
    const ch = MF[y][x];
    if (seen[y * Wc + x] || !(ch in FURN_OF)) continue;
    let x1 = x, y1 = y;
    if (!SINGLE.has(ch)) {
      while (MF[y][x1 + 1] === ch) x1++;
      while (MF[y1 + 1]?.[x] === ch) y1++;
    }
    for (let b = y; b <= y1; b++) for (let a = x; a <= x1; a++) seen[b * Wc + a] = 1;
    const w = x1 - x + 1, h = y1 - y + 1, mx = (x + x1) >> 1, my = (y + y1) >> 1, rule = FURN_RULES[ch];
    // the sides: 0 left, 1 right, 2 top (toward the street), 3 bottom; how much wall touches each
    const touch = [0, 0, 0, 0];
    for (let b = y; b <= y1; b++) { if (wallish(x - 1, b)) touch[0]++; if (wallish(x1 + 1, b)) touch[1]++; }
    for (let a = x; a <= x1; a++) { if (wallish(a, y - 1)) touch[2]++; if (wallish(a, y1 + 1)) touch[3]++; }
    /** The side within n characters on which one of the letters stands, or -1. */
    const look = (ls: string, n: number) => {
      for (let d = 1; d <= n; d++) for (let s2 = 0; s2 < 4; s2++) {
        const cx2 = s2 === 0 ? x - d : s2 === 1 ? x1 + d : mx, cy2 = s2 === 2 ? y - d : s2 === 3 ? y1 + d : my;
        if (!wallish(cx2, cy2) && ls.includes(MF[cy2][cx2])) return s2;
      }
      return -1;
    };
    const dist = (sx: number, sy: number, dx: number, dy: number) => { let d = 0; while (!wallish(sx + dx * (d + 1), sy + dy * (d + 1)) && d < 40) d++; return d; };
    let back = touch.indexOf(Math.max(...touch));
    if (rule?.front) back = 3;
    else if (ch === 'h' || ch === 's') { const s2 = look('tQ=v$', 2); if (s2 >= 0) back = s2 ^ 1; }
    else if (ch === 'F' || ch === 'r') { const s2 = look('T', 14); if (s2 >= 0) back = s2 ^ 1; }
    // a bed's head is on a short side, the one nearer a wall
    else if (ch === 'B') back = h >= w ? (dist(mx, y, 0, -1) <= dist(mx, y1, 0, 1) ? 2 : 3) : dist(x, my, -1, 0) <= dist(x1, my, 1, 0) ? 0 : 1;
    else if (Math.max(...touch) === 0) back = h > w ? 0 : 2;
    // it faces away from its back: along that, its depth; across, its width
    const [du, dv] = OUT[back], [c, s2] = G.dir(du, dv), kind = ch === 'm' ? display : FURN_OF[ch];
    // a run of a piece that comes in units: cut along its long side, with the gap between
    const [max, gap] = rule?.unit ?? [99, 0], long = w >= h;
    for (let p = long ? x : y; p <= (long ? x1 : y1); p += max + gap) {
      const q = Math.min(p + max, (long ? x1 : y1) + 1) - 1, px0 = long ? p : x, px1 = long ? q : x1, py0 = long ? y : p, py1 = long ? y1 : q;
      // against a wall it stands right at the wall (a centimetre off); from wall to wall it fills the room
      const u0 = px0 * G.su, u1 = (px1 + 1) * G.su, v0 = py0 * G.sv, v1 = (py1 + 1) * G.sv, past = G.past ?? (() => 0);
      const gl = px0 === x && touch[0] ? past(false, u0 - CELL / 2, v0, v1) : 0, gr = px1 === x1 && touch[1] ? past(false, u1 + CELL / 2, v0, v1) : 0;
      const gt = py0 === y && touch[2] ? past(true, v0 - CELL / 2, u0, u1) : 0, gb = py1 === y1 && touch[3] ? past(true, v1 + CELL / 2, u0, u1) : 0;
      const fit = (a0: number, a1: number, lo: number, hi: number): [number, number] => {
        const e = (a1 - a0) / 2 - 0.05;
        return lo && hi ? [(a0 + a1 + hi - lo) / 2, e + (lo + hi) / 2] : [(a0 + a1) / 2 + (hi ? hi + 0.04 : lo ? -lo - 0.04 : 0), e];
      };
      const [cu, eu] = fit(u0, u1, gl, gr), [cv, ev] = fit(v0, v1, gt, gb), [wx, wy] = G.at(cu, cv);
      pieces.push({ ch, x: px0, y: py0, x1: px1, y1: py1, back, i: P.furn.length });
      const F: Furn = { kind, x: wx, y: wy, c, s: s2, hx: du ? eu : ev, hy: du ? ev : eu, seed: (rnd() * 1e6) | 0 };
      const st = goods?.(kind);
      if (st) F.stock = st;
      P.furn.push(F);
    }
  }
  // the postos: in bed, on the sofa, in the shower; on the chair at a table or a desk; standing on the free cell in
  // front of the stove or the sink, facing it; the clerk behind a counter, the customer in front of the till
  for (const p of pieces) {
    const rule = FURN_RULES[p.ch], kind = rule?.posto, Fu = P.furn[p.i];
    if (!kind || kind === 'sit') continue;
    if (kind === 'sleep' || kind === 'sofa' || kind === 'shower') { Fu.posto = { kind, x: Fu.x, y: Fu.y, c: Fu.c, s: Fu.s }; continue; }
    const chair = kind === 'eat' || kind === 'desk' ? pieces.find((q) => q.ch === 'h' && ((q.x <= p.x1 + 1 && q.x1 >= p.x - 1 && q.y <= p.y1 && q.y1 >= p.y) || (q.y <= p.y1 + 1 && q.y1 >= p.y - 1 && q.x <= p.x1 && q.x1 >= p.x))) : undefined;
    if (chair) { const Ch = P.furn[chair.i]; Fu.posto = { kind, x: Ch.x, y: Ch.y, c: Ch.c, s: Ch.s }; continue; }
    /** The posto on the free cell nearest the middle of one of the piece's sides, facing it. */
    const stand = (side: number, k: string): Posto | null => {
      const along = side < 2, n = along ? p.y1 - p.y + 1 : p.x1 - p.x + 1, cells: [number, number][] = [];
      for (let t = 0; t < n; t++) cells.push(along ? [side === 0 ? p.x - 1 : p.x1 + 1, p.y + t] : [p.x + t, side === 2 ? p.y - 1 : p.y1 + 1]);
      cells.sort((a, b) => Math.abs(a[0] - (p.x + p.x1) / 2) + Math.abs(a[1] - (p.y + p.y1) / 2) - Math.abs(b[0] - (p.x + p.x1) / 2) - Math.abs(b[1] - (p.y + p.y1) / 2));
      const c0 = cells.find(([x, y]) => G.floor(x, y));
      if (!c0) return null;
      const [px, py] = G.at((c0[0] + 0.5) * G.su, (c0[1] + 0.5) * G.sv), [c, s2] = G.dir(OUT[side][0], OUT[side][1]);
      return { kind: k, x: px, y: py, c, s: s2 };
    };
    // the clerk stands behind (at the counter's back), the others in front first
    const front = p.back ^ 1, order = kind === 'clerk' ? [p.back] : [front, ...[0, 1, 2, 3].filter((q) => q !== front && q !== p.back), p.back];
    for (const side of order) { const ps = stand(side, kind); if (ps) { Fu.posto = ps; break; } }
    if (rule?.serve) Fu.serve = stand(front, 'customer') ?? undefined;
  }
}

/**
 * Floor f (0 the ground, 1 any above) of lot k read from its drawn plan (the manual's grammar): one character is
 * 2 x 2 cells; a wall or door character's cells go to the nearest room character (so an inner wall is the low room's
 * last cell, as walls() makes it); the rooms are the letters' rectangles, their units the homes behind each entry
 * door E; the furniture is the plan's own layer, each piece facing out of the wall it stands against. The shop's
 * floor is one of the manual's shop models (7b), read by the same placeGrid (13.21).
 */
function planFromFloor(city: City, k: number, St: Stack, f: number, fl = f): Plan {
  // (f: 0 the ground floor, 1 the floors above, 2 the roof)
  const Fl = f === 2 ? St.roof! : f === 0 ? St.ground : St.upper ?? St.ground;
  const B = city.buildings[k], R = Fl.rooms, M = Fl.furn, H = R.length, Wc = R[0].length;
  const gx = Math.floor(B.x0 / CELL), gy = Math.floor(B.y0 / CELL), nx = Math.ceil(B.x1 / CELL) - gx, ny = Math.ceil(B.y1 / CELL) - gy;
  const cells = new Uint16Array(nx * ny);
  const isRoom = (ch: string | undefined) => !!ch && ch in ROOM_OF;
  // the rooms: each letter's connected rectangle
  const id = new Int16Array(Wc * H).fill(-1), rooms: Room[] = [], letter: string[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < Wc; x++) {
    if (!isRoom(R[y][x]) || id[y * Wc + x] >= 0) continue;
    const ch = R[y][x], n = rooms.length, q = [[x, y]];
    id[y * Wc + x] = n;
    while (q.length) {
      const [a, b] = q.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c = a + dx, d = b + dy;
        if (c < 0 || d < 0 || c >= Wc || d >= H || R[d][c] !== ch || id[d * Wc + c] >= 0) continue;
        id[d * Wc + c] = n; q.push([c, d]);
      }
    }
    rooms.push({ kind: ROOM_OF[ch], unit: -1, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
    letter.push(ch);
  }
  /** The room a cell at plan point (u, v) (in characters) belongs to: its own character's, or the nearest room character's. */
  const roomAt = (u: number, v: number) => {
    const x = Math.floor(u), y = Math.floor(v);
    if (isRoom(R[y]?.[x])) return id[y * Wc + x];
    let best = -1, bd = Infinity;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const c = x + dx, d = y + dy;
      if (!isRoom(R[d]?.[c])) continue;
      const e = (c + 0.5 - u) ** 2 + (d + 0.5 - v) ** 2 + (dx && dy ? 0.01 : 0);
      if (e < bd) { bd = e; best = id[d * Wc + c]; }
    }
    return best;
  };
  /** The plan point (characters) of the city point (x, y). */
  const planUV = (x: number, y: number): [number, number] => {
    let u: number, v: number;
    if (St.face === 2) { u = x - B.x0; v = y - B.y0; } else if (St.face === 3) { u = B.x1 - x; v = B.y1 - y; } else if (St.face === 0) { v = x - B.x0; u = B.y1 - y; } else { v = B.x1 - x; u = y - B.y0; }
    if (St.mirror) u = St.W - u;
    return [u * 2, v * 2];
  };
  const doorCells: number[] = [], bare = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const cx = (gx + i + 0.5) * CELL, cy = (gy + j + 0.5) * CELL, [u, v] = planUV(cx, cy), ch = R[Math.floor(v)]?.[Math.floor(u)];
    if (ch === undefined) continue;
    if (isRoom(ch)) bare[j * nx + i] = 1;
    const r = roomAt(u, v);
    if (r < 0) continue;
    cells[j * nx + i] = r + 1;
    const RR = rooms[r];
    RR.x0 = Math.min(RR.x0, cx - CELL / 2); RR.x1 = Math.max(RR.x1, cx + CELL / 2); RR.y0 = Math.min(RR.y0, cy - CELL / 2); RR.y1 = Math.max(RR.y1, cy + CELL / 2);
    if (ch === 'D' || ch === 'E') doorCells.push(j * nx + i);
  }
  // the units: the common parts are what the stair, the lift and the halls reach through plain doors; the other
  // rooms fall into homes (or the shop) by what joins them without an entry door
  const link: [number, number, string][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < Wc; x++) {
    const ch = R[y][x];
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      // two rooms meet side by side with no wall (an open plan), or across a door character
      if (isRoom(ch) && isRoom(R[y + dy]?.[x + dx]) && id[y * Wc + x] !== id[(y + dy) * Wc + x + dx]) link.push([id[y * Wc + x], id[(y + dy) * Wc + x + dx], '']);
      if ((ch === 'D' || ch === 'E') && isRoom(R[y - dy]?.[x - dx]) && isRoom(R[y + dy]?.[x + dx])) link.push([id[(y - dy) * Wc + x - dx], id[(y + dy) * Wc + x + dx], ch]);
    }
  }
  const group = new Int16Array(rooms.length).fill(-2);
  const spread = (start: number, g: number) => {
    const q = [start];
    group[start] = g;
    while (q.length) {
      const a = q.pop()!;
      for (const [p, r, kind] of link) {
        if (kind === 'E') continue;
        const b = p === a ? r : r === a ? p : -1;
        if (b >= 0 && group[b] === -2) { group[b] = g; q.push(b); }
      }
    }
  };
  letter.forEach((ch, r) => { if (group[r] === -2 && (ch === 'S' || ch === 'L' || ch === '.' || ch === 'c')) spread(r, -1); });
  let unit = 0;
  letter.forEach((_, r) => { if (group[r] === -2) spread(r, unit++); });
  rooms.forEach((RR, r) => { RR.unit = group[r]; });
  walls(cells, nx, ny);
  for (const c of doorCells) cells[c] = (cells[c] | DOOR) & ~WALL;
  // two rooms side by side with no wall character between them are one space (the open kitchen, a corridor
  // running into the stair): their meeting cells are a doorway as long as they meet
  const seam: number[] = [], seams = new Uint8Array(nx * ny);
  for (let c = 0; c < nx * ny; c++) for (const d of [1, nx]) {
    const e = c + d;
    if ((d === 1 && c % nx === nx - 1) || e >= nx * ny || !bare[c] || !bare[e] || (cells[c] & ROOM) === (cells[e] & ROOM)) continue;
    cells[c] = (cells[c] | DOOR) & ~WALL; cells[e] = (cells[e] | DOOR) & ~WALL;
    seam.push(c, e); seams[c] = seams[e] = 1;
  }
  // the outer wall opens at the street doors, and up the fire escapes at their windows
  const { main, shops } = stackDoors(city, St);
  const open = (D: Door, f0: number, f1: number) => {
    const [px, py, nX, nY] = facePoint(B, D.face, 0);
    for (let jj = 0; jj < ny; jj++) for (let i = 0; i < nx; i++) {
      const k2 = jj * nx + i;
      if (!(cells[k2] & WALL)) continue;
      const cx = (gx + i + 0.5) * CELL, cy = (gy + jj + 0.5) * CELL;
      if ((px - cx) * nX + (py - cy) * nY > CELL) continue;
      const fw = (alongFace(B, D.face, cx, cy) - D.a0) / (D.a1 - D.a0);
      if (fw > f0 && fw < f1) cells[k2] &= ~WALL;
    }
  };
  if (f === 0) for (const D of main ? [main, ...shops] : shops) open(D, 0, 1);
  else if (f === 1) for (const e of escapesOf(city, k)) for (let b = 0; b < 2; b++) open({ face: e.face, a0: e.a0 + b * BAY, a1: e.a0 + (b + 1) * BAY }, 0.3, 0.7);
  const P: Plan = { box: k, rooms, exits: f === 0 ? shops : [], furn: [], cells, gx, gy, nx, ny, seams };
  // each home room furnished by an arrangement of the manual's library that fits it (turned or flipped), the one
  // that best fits who lives there (13.20); where none fits, the floor's own layer
  const MF = M.map((r) => [...r]), rect = rooms.map(() => [Infinity, Infinity, -1, -1]);
  for (let y = 0; y < H; y++) for (let x = 0; x < Wc; x++) {
    const r = id[y * Wc + x];
    if (r >= 0) { const q = rect[r]; q[0] = Math.min(q[0], x); q[1] = Math.min(q[1], y); q[2] = Math.max(q[2], x); q[3] = Math.max(q[3], y); }
  }
  rooms.forEach((RR, r) => {
    if (!'lkbhs'.includes(letter[r]) || RR.unit < 0) return;
    const [x0, y0, x1, y1] = rect[r], fits = fitArrangements(Fl, x0, y0, x1, y1);
    if (!fits.length) return;
    const tags = residents?.(k, fl, RR.unit) ?? [];
    // and again in the game's own cells: no piece on a cell the walls or a doorway took (a jagged corner of inner walls)
    const clear = (rows: string[]) => rows.every((row, y) => [...row].every((c, x) => c === '.' || [0.125, 0.375].every((du) => [0.125, 0.375].every((dv) => {
      const [cx, cy] = stackXY(St, B, (x0 + x) / 2 + du, (y0 + y) / 2 + dv), v = cellAt(P, cx, cy);
      return (v & ROOM) && !(v & (WALL | DOOR));
    }))));
    let pick = -1, bs = -Infinity;
    fits.forEach((Fa, i) => { const sc = whoScore(Fa.A.who, tags) + hash3(city.nameSeed ^ 0x3c1d, k * 64 + r, fl * 97 + i) * 0.5; if (sc > bs && clear(Fa.rows)) { bs = sc; pick = i; } });
    if (pick < 0) return;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) MF[y][x] = fits[pick].rows[y - y0][x - x0];
  });
  const rnd = mulberry32((hash3(city.nameSeed ^ 0x77f1, k, f) * 4294967296) | 0);
  // a wall character is half a metre but its wall one cell, on its low side in the city: on the other side the room
  // runs a cell into it, and a piece drawn against it would stand that far off the wall (playtest of 2026-10-08)
  /**
   * How far the floor runs past a piece's side into the wall character beyond, all along it (plan metres: the side
   * at u = a, from v0 to v1, or at v = a from u0 to u1 when across): a cell, or 0 if a wall cell is there anywhere.
   */
  const pastWall = (across: boolean, a: number, b0: number, b1: number) => {
    for (let b = b0 + CELL / 2; b < b1; b += CELL) {
      const [cx, cy] = across ? stackXY(St, B, b, a) : stackXY(St, B, a, b), c = cellAt(P, cx, cy);
      if (!(c & ROOM) || c & WALL) return 0;
    }
    return CELL;
  };
  // the furniture: the plan's layer, read as every grid of letters is (placeGrid)
  const wallish = (x: number, y: number) => x < 0 || y < 0 || x >= Wc || y >= H || PLAN_WALLS.has(R[y][x]);
  placeGrid(P, MF, { su: 0.5, sv: 0.5, at: (u, v) => stackXY(St, B, u, v), dir: (du, dv) => stackDir(St, du, dv), past: pastWall, wallish, floor: (x, y) => !wallish(x, y) && isRoom(R[y][x]) && MF[y][x] === '.' }, rnd);
  // the stair's two flights and half landing, a piece of its own (drawn in little cubes; walked by its steps, not round it)
  const Fg = f === 2 ? null : flightOf(St);
  if (Fg) {
    // out to the walls on its long sides and at its far end (the half landing), as the furniture
    let { u0, v0, u1, v1 } = Fg;
    const L = pastWall(false, u0 - CELL / 2, v0, v1), Rr = pastWall(false, u1 + CELL / 2, v0, v1), T = pastWall(true, v0 - CELL / 2, u0, u1), Bm = pastWall(true, v1 + CELL / 2, u0, u1);
    if (Fg.du) { v0 -= T; v1 += Bm; if (Fg.du > 0) u1 += Rr; else u0 -= L; }
    else { u0 -= L; u1 += Rr; if (Fg.dv > 0) v1 += Bm; else v0 -= T; }
    const [px, py] = stackXY(St, B, (u0 + u1) / 2, (v0 + v1) / 2), [c, s2] = stackDir(St, Fg.du, Fg.dv);
    const run = Fg.du ? u1 - u0 : v1 - v0, wide = Fg.du ? v1 - v0 : u1 - u0;
    P.furn.push({ kind: 'stair', x: px, y: py, c, s: s2, hx: run / 2, hy: wide / 2 - 0.01, seed: 0 });
  }
  // where a piece stands on the seam of an open plan (the fridge at the edge of the open kitchen), that stretch is no way through
  for (const c of seam) if (inFurniture(P, (gx + (c % nx) + 0.5) * CELL, (gy + Math.floor(c / nx) + 0.5) * CELL)) cells[c] &= ~DOOR;
  // the shop: furnished by its model (the manual's 7b), read as the rest of the floor is
  if (f === 0 && B.shop) furnish(P, rnd, false, shops.map((D) => facePoint(B, D.face, (D.a0 + D.a1) / 2)), B.biz >= 0 ? city.businesses[B.biz]?.kind : undefined, (x, y) => !isSolid(city, x, y), new Set(['shop', 'store']));
  return P;
}

function makePlan(city: City, k: number, j: number, ground: boolean): Plan {
  const B = city.buildings[j], base = city.buildings[k], F = frameOf(city, k), ax = F.alongX;
  const rnd = mulberry32((hash3(city.nameSeed ^ 0x51ab, Math.round(B.x0 * 10), Math.round(B.y0 * 10) + (ground ? 7 : 0)) * 4294967296) | 0);
  const U0 = ax ? B.x0 : B.y0, U1 = ax ? B.x1 : B.y1, V0 = ax ? B.y0 : B.x0, V1 = ax ? B.y1 : B.x1;
  const gx = Math.floor(B.x0 / CELL), gy = Math.floor(B.y0 / CELL);
  const nx = Math.ceil(B.x1 / CELL) - gx, ny = Math.ceil(B.y1 / CELL) - gy;
  const cells = new Uint16Array(nx * ny), rooms: Room[] = [];
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
        // (a doorway takes the wall away)
        if (or) { if (cells[j2 * nx + i]) cells[j2 * nx + i] = (cells[j2 * nx + i] | val) & ~WALL; } else cells[j2 * nx + i] = val;
      }
    }
  };
  const room = (kind: RoomKind, unit: number, u0: number, v0: number, u1: number, v1: number) => {
    u0 = Math.max(u0, U0); u1 = Math.min(u1, U1); v0 = Math.max(v0, V0); v1 = Math.min(v1, V1);
    if (u1 - u0 < 0.3 || v1 - v0 < 0.3 || rooms.length >= ROOM - 1) return;
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
  /** Where a shop from a to b along u, its front on the outer wall at v = vf, can have its door: the bay nearest the middle with open ground before it (13.10c), or null. */
  const shopFront = (a: number, b: number, vf: number): Door | null => {
    if (vf > V0 + 0.01 && vf < V1 - 0.01) return null;
    return frontOn(a, b, vf <= V0 + 0.01 ? (ax ? 2 : 0) : (ax ? 3 : 1));
  };
  /** The same on any face, a to b measured along it: the end faces (at U0, U1) run along v (13.10i). */
  const frontOn = (a: number, b: number, face: number): Door | null => {
    const m = Math.floor((a + b) / 2 / BAY);
    for (const o of [0, -1, 1, -2, 2]) {
      const a0 = (m + o) * BAY;
      // (a wall between two rooms is the low room's last cell: only an outer wall stands at a, 13.10i)
      if (a0 < a + (a <= (face < 2 ? B.y0 : B.x0) + 0.01 ? 0.3 : 0) || a0 + BAY > b - 0.3) continue;
      const [x, y, nX, nY] = facePoint(B, face, a0 + BAY / 2);
      if (C && C.nx * x + C.ny * y > C.c - 0.3) continue;
      if (isSolid(city, x + nX * 0.6, y + nY * 0.6) || !toStreet(city, k, face, a0 + BAY / 2)) continue;
      return { face, a0, a1: a0 + BAY };
    }
    return null;
  };
  const shopExit = (a: number, b: number, vf: number) => { const E = shopFront(a, b, vf); if (E) exits.push(E); return !!E; };

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
  const units = (a: number, b: number, cv: number, vf: number, noShop = false) => {
    if (b - a < 1.2) return;
    // a shop only where its front is on the street (13.10c); the units at the back are offices or homes
    if (shop && !noShop && shopFront(a, b, vf)) {
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
    // (13.10i) or at an end of the building on the street, when the long faces are against the neighbours:
    // the shop takes that end, a few bays deep, and the rest are offices or homes
    if (shop && !noShop) for (const hi of [false, true]) {
      if (Math.abs((hi ? b : a) - (hi ? U1 : U0)) > 0.01) continue;
      const E = frontOn(Math.min(cv, vf), Math.max(cv, vf), hi ? (ax ? 1 : 3) : (ax ? 0 : 2));
      if (!E) continue;
      const d = b - a < 7 * BAY ? b - a : 4 * BAY, e = hi ? snap(b - d) : snap(a + d);
      room('shop', unit++, hi ? e : a, Math.min(cv, vf), hi ? b : e, Math.max(cv, vf));
      exits.push(E);
      if (hi) units(a, e, cv, vf, true); else units(e, b, cv, vf, true);
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
      // under a shop only the door's bay, so the shop keeps the rest of the front (13.10i)
      lu0 = Math.floor(du / BAY) * BAY - (shop ? 0 : BAY); lu1 = lu0 + (shop ? 1 : 3) * BAY;
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
      const c = cellAt({ box: j, rooms, exits, furn: [], cells, gx, gy, nx, ny }, ax ? F.su0 - 0.2 : vm, ax ? vm : F.su0 - 0.2) & ROOM;
      const next = c && rooms[c - 1].unit >= 0 ? rooms[c - 1] : null; // not a corridor or the lobby
      room(next ? (next.kind === 'shop' || next.kind === 'store' || next.kind === 'open' || next.kind === 'office' ? next.kind : 'bedroom') : office ? 'office' : 'bedroom', next ? next.unit : unit++, F.su0, v0, F.lu1, v1);
      if (next) doorU(F.su0, vm - 0.6);
    }
    if (lSide) { room('lobby', -1, lu0, lSide < 0 ? V0 : F.c1, lu1, lSide < 0 ? F.c0 : V1); doorV(lSide < 0 ? F.c0 : F.c1, (Math.max(lu0, U0) + Math.min(lu1, U1)) / 2 - 0.6); }
  } else {
    // walk-up: stairs at one end, the rest is one home (or a shop downstairs)
    // a walk-up: its end is a lift (the stairs are left out for now)
    room(floorsOf(city.buildings[k]) > 1 ? 'lift' : 'hall', -1, U0, V0, F.su1, V1);
    if (shop && (shopFront(F.su1, U1, V0) || shopFront(F.su1, U1, V1))) { room('shop', unit++, F.su1, V0, U1, V1); if (!shopExit(F.su1, U1, V0)) shopExit(F.su1, U1, V1); }
    // (13.10i) or its front on the far end
    else if (shop && frontOn(V0, V1, ax ? 1 : 3)) { room('shop', unit++, F.su1, V0, U1, V1); exits.push(frontOn(V0, V1, ax ? 1 : 3)!); }
    else if (office) { room('office', unit++, F.su1, V0, U1, V1); doorU(F.su1, V0 + 0.4); }
    else {
      const n = (U1 - F.su1) / BAY, id = unit++;
      if (n >= 5) { const b = snap(U1 - 2 * BAY); room('living', id, F.su1, V0, b, V1); room('bedroom', id, b, V0, U1, V1); doorU(b, V0 + 0.4); }
      else room('living', id, F.su1, V0, U1, V1);
      doorU(F.su1, V0 + 0.4);
    }
  }
  // (13.10i) a lot too small for a shop beside the residents' way in: the whole ground floor is the shop,
  // through the building's own door, with the lift at the back (the family upstairs keeps it)
  if (shop && !rooms.some((R) => R.kind === 'shop')) {
    fallbacks++;
    rooms.length = 0; cells.fill(0); doors.length = 0; exits.length = 0;
    const [x, y] = D ? facePoint(base, D.face, (D.a0 + D.a1) / 2) : [0, 0], lo = (ax ? x : y) < (F.su1 + F.lu1) / 2;
    if (F.c1 > F.c0 && F.lu1 > F.su1 && (lo ? F.su1 - U0 : U1 - F.lu1) >= 2 * BAY) {
      // the shop from the door's end to a bay before the lift (or to the lift, in a small one); past it a back
      // hall with the lift, its door in the middle of the wall (the shop's model keeps a metre clear inside it)
      let cut = lo ? F.su1 - BAY : F.lu1 + BAY;
      if ((lo ? cut - U0 : U1 - cut) < 2 * BAY) cut = lo ? F.su1 : F.lu1;
      room('shop', unit++, lo ? U0 : cut, V0, lo ? cut : U1, V1);
      room('hall', -1, lo ? cut : U0, V0, lo ? U1 : cut, V1);
      room('lift', -1, F.su1, F.cv0, F.lu1, F.cv1);
      doorV(F.cv0 < F.c0 ? F.c0 : F.c1, F.su1 + 0.4);
      const vm = (V0 + V1) / 2;
      doorU(cut, vm - 0.6);
    } else {
      // too small for a hall: the lift stands in the shop
      room('shop', unit++, U0, V0, U1, V1);
      if (F.c1 > F.c0 && F.lu1 > F.su1) { room('lift', -1, F.su1, F.cv0, F.lu1, F.cv1); doorV(F.cv0 < F.c0 ? F.c0 : F.c1, F.su1 + 0.4); }
      else if (F.c1 === F.c0 && floorsOf(city.buildings[k]) > 1) { room('lift', -1, U0, V0, F.su1, V1); doorU(F.su1, V0 + 0.4); }
    }
  }
  walls(cells, nx, ny);
  for (const [u0, v0, u1, v1] of doors) fill(u0, v0, u1, v1, DOOR, true);
  // the outer wall opens at the street doors, and up the fire escapes at their windows
  const open = (D: Door, f0: number, f1: number) => {
    const [px, py, nX, nY] = facePoint(B, D.face, 0);
    for (let jj = 0; jj < ny; jj++) for (let i = 0; i < nx; i++) {
      const k2 = jj * nx + i;
      if (!(cells[k2] & WALL)) continue;
      const cx = (gx + i + 0.5) * CELL, cy = (gy + jj + 0.5) * CELL;
      if ((px - cx) * nX + (py - cy) * nY > CELL) continue;
      const fw = (alongFace(B, D.face, cx, cy) - D.a0) / (D.a1 - D.a0);
      if (fw > f0 && fw < f1) cells[k2] &= ~WALL;
    }
  };
  if (ground) { const main = doorOf(city, k); for (const D of main ? [main, ...exits] : exits) open(D, 0, 1); }
  else if (j === k) for (const e of escapesOf(city, k)) for (let b = 0; b < 2; b++) open({ face: e.face, a0: e.a0 + b * BAY, a1: e.a0 + (b + 1) * BAY }, 0.3, 0.7);
  connect(cells, nx, ny, rooms);
  const P: Plan = { box: j, rooms, exits, furn: [], cells, gx, gy, nx, ny };
  // the street doors (the main one and the shops'), so nothing is put in front of them
  const streets: [number, number, number, number][] = [];
  if (ground) {
    const main = doorOf(city, k);
    for (const D of main ? [main, ...exits] : exits) streets.push(facePoint(city.buildings[k], D.face, (D.a0 + D.a1) / 2));
  }
  furnish(P, rnd, office, streets, shop && base.biz >= 0 ? city.businesses[base.biz]?.kind : undefined, (x, y) => !isSolid(city, x, y));
  return P;
}

/**
 * The walls (13.10a): a cell is wall when it is on the edge of the plan, or when the cell after it
 * (in x or in y) is another room's, so a wall between two rooms is one cell thick, on its low side.
 */
function walls(cells: Uint16Array, nx: number, ny: number) {
  const W = new Uint8Array(nx * ny);
  const at = (a: number, b: number) => (a < 0 || b < 0 || a >= nx || b >= ny ? 0 : cells[b * nx + a] & ROOM);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = cells[j * nx + i];
    if (!c) continue;
    const r = c & ROOM, e = at(i + 1, j), s = at(i, j + 1);
    if (!e || !s || !at(i - 1, j) || !at(i, j - 1) || e !== r || s !== r) W[j * nx + i] = 1;
  }
  for (let k = 0; k < nx * ny; k++) if (W[k]) cells[k] |= WALL;
}

/**
 * Make every room reachable from the stairs (shops stay closed): where the cut of the diagonal,
 * or a tight lot, left a room with no way in, open a doorway to a neighbour that has one.
 */
function connect(cells: Uint16Array, nx: number, ny: number, rooms: Room[]) {
  const seen = new Uint8Array(nx * ny), stack: number[] = [];
  // from the stairs; where the cut took them away, from the lobby or the corridor
  let start = cells.findIndex((v) => v !== 0 && (rooms[(v & ROOM) - 1].kind === 'stair' || rooms[(v & ROOM) - 1].kind === 'lift'));
  if (start < 0) start = cells.findIndex((v) => v !== 0 && (rooms[(v & ROOM) - 1].kind === 'lobby' || rooms[(v & ROOM) - 1].kind === 'hall'));
  if (start < 0) return;
  for (let guard = 0; guard < 60; guard++) {
    seen.fill(0); stack.length = 0; stack.push(start); seen[start] = 1;
    while (stack.length) {
      const c = stack.pop()!, v = cells[c], i = c % nx, j = (c - i) / nx;
      for (const d of [1, -1, nx, -nx]) {
        if ((d === 1 && i === nx - 1) || (d === -1 && i === 0) || (d === nx && j === ny - 1) || (d === -nx && j === 0)) continue;
        const e = c + d, w = cells[e];
        if (!w || seen[e] || ((w & ROOM) !== (v & ROOM) && !(w & v & DOOR))) continue;
        seen[e] = 1; stack.push(e);
      }
    }
    // the first wall between a reached cell and a room still closed off: a doorway five cells wide
    let made = false;
    for (let c = 0; c < nx * ny && !made; c++) {
      const i = c % nx;
      for (const d of [1, nx]) {
        if (d === 1 && i === nx - 1) continue;
        for (const [a, b] of [[c, c + d], [c + d, c]]) {
          if (b >= nx * ny || a < 0 || !cells[b] || seen[b] || !seen[a] || rooms[(cells[b] & ROOM) - 1].kind === 'shop' || rooms[(cells[b] & ROOM) - 1].kind === 'store') continue;
          const side = d === 1 ? nx : 1;
          for (const o of [-2 * side, -side, 0, side, 2 * side]) {
            const p = a + o, q = b + o;
            if (p < 0 || q < 0 || p >= nx * ny || q >= nx * ny) continue;
            if ((cells[p] & ROOM) === (cells[a] & ROOM) && (cells[q] & ROOM) === (cells[b] & ROOM)) { cells[p] = (cells[p] | DOOR) & ~WALL; cells[q] = (cells[q] | DOOR) & ~WALL; }
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
/** open: whether a point outside the building is open air (a wall there can be glass), not a neighbour's wall. */
function furnish(P: Plan, rnd: () => number, office: boolean, streets: [number, number, number, number][], biz?: BusinessKind, open: (x: number, y: number) => boolean = () => true, only?: Set<RoomKind>) {
  const F = P.furn;
  const free = (r: number, x0: number, y0: number, x1: number, y1: number) => {
    // every cell the piece covers (13.10a: a wall is one cell thick, a looser sampling missed it)
    for (let j = Math.floor((y0 + 1e-3) / CELL); j <= Math.floor((y1 - 1e-3) / CELL); j++) for (let i = Math.floor((x0 + 1e-3) / CELL); i <= Math.floor((x1 - 1e-3) / CELL); i++) {
      const c = cellAt(P, (i + 0.5) * CELL, (j + 0.5) * CELL);
      if ((c & ROOM) !== r + 1 || c & (DOOR | WALL)) return false;
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
  /** The room's four walls, each as its inner face (past the wall's cells), the way a piece faces from it, and its length. */
  const sides = (R: Room): [number, number, number, number, number][] => {
    // from the room's edge inward, past the cells that are wall (looked at in three places: a doorway in the middle has none, 13.10i)
    const at = [0.25, 0.5, 0.75], wallAt = (onX: boolean, v: number) => at.some((t) => cellAt(P, onX ? v : R.x0 + (R.x1 - R.x0) * t, onX ? R.y0 + (R.y1 - R.y0) * t : v) & WALL);
    const face = (e: number, d: number, onX: boolean) => { let v = e; for (let n = 0; n < 3; n++) { if (!wallAt(onX, v + d * CELL * 0.5)) break; v = (Math.floor((v + d * CELL * 0.5) / CELL) + (d > 0 ? 1 : 0)) * CELL; } return v + d * 0.05; };
    const x0 = face(R.x0, 1, true), x1 = face(R.x1, -1, true), y0 = face(R.y0, 1, false), y1 = face(R.y1, -1, false);
    return [[x0, 0, 1, 0, R.y1 - R.y0], [x1, 0, -1, 0, R.y1 - R.y0], [0, y0, 0, 1, R.x1 - R.x0], [0, y1, 0, -1, R.x1 - R.x0]];
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
    const walls = sides(R);
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
    const walls = sides(R);
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
  /**
   * A shop's floor from the manual's shop models (section 7b; 13.21, one reader with the drawn floors): the room inside
   * its walls as a grid of about half-metre characters, its first row along the wall with the shop's street door; the
   * frame read from the cells (the shop front's glass, the doorways, the walls); the first model the dice pick that
   * passes the rules there and stands clear of the walls and doorways in the cells; placed by placeGrid.
   */
  const shopGrid = (r: number, R: Room, biz: BusinessKind | undefined) => {
    // its street door: the one opening into it, or (another room in the way, as a lift of the cut plans) the one on its wall
    const door = streets.find(([x, y, nX, nY]) => (cellAt(P, x - nX * 0.4, y - nY * 0.4) & ROOM) === r + 1)
      ?? streets.find(([x, y]) => x > R.x0 - 0.5 && x < R.x1 + 0.5 && y > R.y0 - 0.5 && y < R.y1 + 0.5)
      // (a shop of a cut plan entered from another one: its front is the wall toward the nearest street door)
      ?? [...streets].sort((a, b) => Math.hypot(a[0] - (R.x0 + R.x1) / 2, a[1] - (R.y0 + R.y1) / 2) - Math.hypot(b[0] - (R.x0 + R.x1) / 2, b[1] - (R.y0 + R.y1) / 2))[0];
    if (!door || (door[2] && door[3])) return;
    const [, , fx, fy] = door, w = sides(R), xs0 = w[0][0], xs1 = w[1][0], ys0 = w[2][1], ys1 = w[3][1];
    const depth = fx ? xs1 - xs0 : ys1 - ys0, width = fx ? ys1 - ys0 : xs1 - xs0;
    const rows = Math.floor(depth / 0.5), cols = Math.floor(width / 0.5);
    if (rows < 2 || cols < 2) return;
    const su = width / cols, sv = depth / rows;
    // rows run from the street door (fx, fy points out to the street) to the back wall; columns across
    const rx = -fx, ry = -fy, cx = -ry, cy = rx;
    const ox = (rx || cx) > 0 ? xs0 : xs1, oy = (ry || cy) > 0 ? ys0 : ys1;
    const at = (u: number, v: number): [number, number] => [ox + cx * u + rx * v, oy + cy * u + ry * v];
    // the frame: what is just past the inner face, at two points along each character
    const frame: string[] = [];
    for (let j = -1; j <= rows; j++) {
      let row = '';
      for (let i = -1; i <= cols; i++) {
        if ((i < 0 || i >= cols) && (j < 0 || j >= rows)) { row += '#'; continue; }
        if (i >= 0 && i < cols && j >= 0 && j < rows) { row += '.'; continue; }
        let ch = '#';
        for (const t of [0.25, 0.75]) {
          const u = i < 0 ? -0.1 : i >= cols ? width + 0.1 : (i + t) * su, v = j < 0 ? -0.1 : j >= rows ? depth + 0.1 : (j + t) * sv;
          const c = cellAt(P, ...at(u, v));
          if (c & DOOR || ((c & ROOM) && !(c & WALL))) ch = 'D';
        }
        row += ch === '#' && j < 0 ? 'W' : ch;
      }
      frame.push(row);
    }
    // a model whose pieces all stand on the room's own floor in the cells (not a wall, not a doorway)
    const clear = (g: string[]) => g.every((row, j) => [...row].every((ch, i) => ch === '.' || [0.15, 0.85].every((a) => [0.15, 0.85].every((b) => {
      const v = cellAt(P, ...at((i + a) * su, (j + b) * sv));
      return (v & ROOM) === r + 1 && !(v & (WALL | DOOR));
    }))));
    let g: string[] | null = null;
    for (const cand of shopFits(frame, biz, rnd())) if (clear(cand)) { g = cand; break; }
    if (!g) return;
    const MF = g.map((row) => [...row]), inside = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
    const display: FurnKind = biz === 'electronics' || biz === 'phones' || biz === 'pawn' ? 'case' : 'shelf';
    placeGrid(P, MF, {
      su, sv, at, dir: (du, dv) => [cx * du + rx * dv, cy * du + ry * dv],
      wallish: (x, y) => !inside(x, y), floor: (x, y) => inside(x, y) && MF[y][x] === '.',
    }, rnd, (kind) => (kind === 'shelf' || kind === 'case' || kind === 'cooler' || kind === 'bottles' ? stock(biz, kind === 'case' ? 4 : 3, kind === 'cooler') : undefined), display);
  };
  /**
   * (13.9c) Wall outlets a customer may use: n of them on the room's blind walls (another room or a
   * neighbour's building behind, never open air: the shop front's glass), the spots nearest a seat or
   * a table first, 2 m apart at least; in a small shop 1 m, and under a window when it has no blind wall left (13.10i).
   */
  const outlets = (r: number, R: Room, n: number) => {
    const seats = F.filter((f) => f.x > R.x0 && f.x < R.x1 && f.y > R.y0 && f.y < R.y1 && ['table', 'stool', 'chair', 'sofa', 'bar', 'coffee', 'washer'].includes(f.kind));
    const spots: [number, number, number, number, number, boolean][] = [];
    for (const [wx, wy, c, s] of sides(R)) {
      const lo = (c ? R.y0 : R.x0) + 0.4, hi = (c ? R.y1 : R.x1) - 0.4;
      for (let a = lo; a <= hi; a += 0.6) {
        const x = c ? wx : a, y = c ? a : wy, bx = x - c * (CELL * 1.5 + 0.05), by = y - s * (CELL * 1.5 + 0.05);
        // behind the wall's cells: another room, or a neighbour's wall; open air is the street side
        const blind = !!(cellAt(P, bx, by) & (ROOM | WALL)) || !open(bx, by);
        spots.push([x, y, c, s, seats.reduce((m, f) => Math.min(m, Math.hypot(f.x - x, f.y - y)), 9), blind]);
      }
    }
    spots.sort((A, B) => A[4] - B[4]);
    const got: Furn[] = [];
    // (a small shop with one blind wall: closer together, and if still short, under a window, 13.10i)
    for (const [apart, any] of [[2, false], [1, false], [1, true]] as const) for (const [x, y, c, s, , blind] of spots) {
      if (got.length >= n) break;
      if (!blind && !any) continue;
      if (got.some((o) => Math.hypot(o.x - x, o.y - y) < apart)) continue;
      const o = put(r, 'outlet', x, y, c, s, 0.04, 0.12, 0.3);
      if (o) got.push(o);
    }
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
    if (only && !only.has(R.kind)) return;
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
      case 'shop': shopGrid(r, R, biz); if (biz && OUTLETS.has(biz)) outlets(r, R, 2); break;
      case 'store': storeRoom(r, R, biz); break;
      case 'lobby':
        if (office) wall(r, R, 'reception', 0.8, 2.2, 1.2);
        wall(r, R, 'plant', 0.45, 0.45, 0.3, [0.05, 0.95]);
        break;
    }
  });
}

/** Whether (tx, ty) can be walked to from (sx, sy) inside room r, round its walls and furniture. */
export function reach(P: Plan, r: number, sx: number, sy: number, tx: number, ty: number): boolean {
  const { cells, nx, ny } = P, n = nx * ny;
  const idx = (x: number, y: number) => { const i = Math.floor(x / CELL) - P.gx, j = Math.floor(y / CELL) - P.gy; return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : j * nx + i; };
  const ok = (c: number) => (cells[c] & ROOM) === r + 1 && !(cells[c] & WALL) && !inFurniture(P, (P.gx + c % nx + 0.5) * CELL, (P.gy + ((c / nx) | 0) + 0.5) * CELL);
  const s = idx(sx, sy), t = idx(tx, ty);
  if (s < 0 || t < 0 || !ok(s) || !ok(t)) return false;
  const seen = new Uint8Array(n), stack = [s];
  seen[s] = 1;
  while (stack.length) {
    const c = stack.pop()!, i = c % nx;
    if (c === t) return true;
    for (const d of [1, -1, nx, -nx]) {
      if ((d === 1 && i === nx - 1) || (d === -1 && i === 0)) continue;
      const e = c + d;
      if (e < 0 || e >= n || seen[e]) continue;
      seen[e] = 1;
      if (ok(e)) stack.push(e);
    }
  }
  return false;
}

/** Whether (x, y) is inside a piece of the plan's furniture. */
/** How far the feet may rise or drop in one step (a riser is 17.5 cm; more is a rail, or a flight's underside). */
export const STEP_UP = 0.45;
/** The gap between a stair's two flights, m (a rail runs in it). */
export const STAIR_GAP = 0.125;
/**
 * The height of the feet over their storey's floor on a stair piece (model frame: u along the first flight's climb,
 * from -hx; v across, the first flight on v < 0): the first flight ramps up to the half landing (half a storey), the
 * second, beside it, on up to the next floor; NaN in the gap between the two flights (the rail).
 */
export function stairRise(hx: number, u: number, v: number): number {
  const w = Math.max(0, Math.min(1, (u + hx) / STAIR_RUN)), half = FLOOR_H / 2;
  if (w >= 1) return half;
  if (Math.abs(v) < STAIR_GAP / 2 + 0.15) return NaN;
  return v < 0 ? w * half : FLOOR_H - w * half;
}
/**
 * The height of the feet at (x, y) in lot k, for someone at height z (plano-interiores step 4): on a stair, the step
 * under them, of the storey nearest their height (the one they are on); elsewhere the level of the floor nearest z.
 * The top floor's stair leads to the roof where the lot has one (a drawn stack, 13.23). In the gap between the flights,
 * out of reach (the rail).
 */
export function feetZ(city: City, k: number, x: number, y: number, z: number): number {
  const top = floorsOf(city.buildings[k]), roof = !!stackOf(city, k)?.roof, f0 = Math.max(0, Math.min(roof ? top : top - 1, Math.round(z / FLOOR_H))), P = planOf(city, k, f0);
  // (on the roof, whose plan has no stair of its own: the top floor's, whose flights rise into the stair house)
  const S = P?.furn.find((f) => f.kind === 'stair') ?? (f0 > 0 ? planOf(city, k, f0 - 1)?.furn.find((f) => f.kind === 'stair') : undefined);
  if (S && top >= 2) {
    const dx = x - S.x, dy = y - S.y, u = dx * S.c + dy * S.s, v = -dx * S.s + dy * S.c;
    if (u >= -S.hx && u <= S.hx && Math.abs(v) <= S.hy + 0.05) {
      const r = stairRise(S.hx, u, v);
      if (Number.isNaN(r)) return z + 9;
      const f = Math.max(0, Math.min(roof ? top - 1 : top - 2, Math.round((z - r) / FLOOR_H)));
      return f * FLOOR_H + r;
    }
  }
  return f0 * FLOOR_H;
}

export function inFurniture(P: Plan, x: number, y: number, walking = false): boolean {
  for (const f of P.furn) {
    // walking, chairs and stools are pushed aside, not walked round (bars and diners are full of them)
    if (walking && (f.kind === 'chair' || f.kind === 'stool')) continue;
    // the stair is walked by its steps (world.ts), not round
    if (f.kind === 'stair') continue;
    const dx = x - f.x, dy = y - f.y, u = dx * f.c + dy * f.s, v = -dx * f.s + dy * f.c;
    if (Math.abs(u) < f.hx + 0.05 && Math.abs(v) < f.hy + 0.05) return true;
  }
  return false;
}

/**
 * A door in a doorway between two rooms: hinged at (hx, hy) on the wall, lying along (ax, ay) when
 * shut and swinging open toward (nx, ny) (into the private room, off the corridor); w wide; its
 * middle at (cx, cy). Wide openings (over 1.7 m) and the lift's and stairs' openings have none (but a home's own
 * door off the stair's landing).
 */
/** What a door leaf is made of (13.10d): the street doors' glass, a home's wood, the steel of a stockroom, an office's painted panel. */
export const DOOR_GLASS = 0, DOOR_WOOD = 1, DOOR_METAL = 2, DOOR_OFFICE = 3, DOOR_ENTRY = 4;
/** A door leaf's thickness, m (the renderer draws its free edge as a strip when it stands open). */
export const LEAF_TH = 0.05;
export interface Leaf { hx: number; hy: number; ax: number; ay: number; nx: number; ny: number; w: number; cx: number; cy: number; /** The rooms on either side (indexes; -1 for a street door). */ ra: number; rb: number; kind: number; /** A street door's leaf: which of exitsOf it is. */ door?: number }
const HOME = new Set<RoomKind>(['living', 'bedroom', 'kitchen', 'bath', 'foyer']);
/** Steel onto a stockroom, wood in and into a home, a painted panel elsewhere (offices, lobbies, a shop's own rooms). */
const leafKind = (A: Room, B: Room) => A.kind === 'store' || B.kind === 'store' ? DOOR_METAL : HOME.has(A.kind) || HOME.has(B.kind) ? DOOR_WOOD : DOOR_OFFICE;
const leafCache = new WeakMap<Plan, Leaf[]>();
const COMMON = new Set<RoomKind>(['hall', 'lobby', 'foyer']);
export function leavesOf(P: Plan): Leaf[] {
  let L = leafCache.get(P);
  if (L) return L;
  L = [];
  const { cells, nx, ny, rooms, seams } = P;
  // d 0: walls between columns i and i + 1 (the run goes along y); d 1: between rows j and j + 1
  for (let d = 0; d < 2; d++) {
    const nA = d ? ny - 1 : nx - 1, nB = d ? nx : ny;
    for (let a = 0; a < nA; a++) {
      let run = -1, ra = 0, rb = 0;
      for (let b = 0; b <= nB; b++) {
        const p = b < nB ? (d ? cells[a * nx + b] : cells[b * nx + a]) : 0, q = b < nB ? (d ? cells[(a + 1) * nx + b] : cells[b * nx + a + 1]) : 0;
        const ok = !!(p & q & DOOR) && (p & ROOM) !== (q & ROOM) && !(seams && b < nB && seams[d ? a * nx + b : b * nx + a]);
        if (run >= 0 && (!ok || (p & ROOM) !== ra || (q & ROOM) !== rb)) {
          const w = (b - run) * CELL, A = rooms[ra - 1], B = rooms[rb - 1];
          // a home's own door may open right off the stair's landing (the drawn plans, R12): that one has its leaf
          const entry = (S: Room, H: Room) => S.kind === 'stair' && H.unit >= 0 && HOME.has(H.kind);
          if (w <= 1.7 && A && B && A.kind !== 'lift' && B.kind !== 'lift' && ((A.kind !== 'stair' && B.kind !== 'stair') || entry(A, B) || entry(B, A))) {
            // it swings into the room off the common parts; between two private rooms, into the later one
            const intoB = entry(A, B) || (!entry(B, A) && (COMMON.has(A.kind) !== COMMON.has(B.kind) ? COMMON.has(A.kind) : rb > ra)), n = intoB ? 1 : -1;
            const wc = ((d ? P.gy : P.gx) + a + 1) * CELL, s0 = ((d ? P.gx : P.gy) + run) * CELL;
            const kind = leafKind(A, B);
            L.push(d ? { hx: s0, hy: wc, ax: 1, ay: 0, nx: 0, ny: n, w, cx: s0 + w / 2, cy: wc, ra: ra - 1, rb: rb - 1, kind } : { hx: wc, hy: s0, ax: 0, ay: 1, nx: n, ny: 0, w, cx: wc, cy: s0 + w / 2, ra: ra - 1, rb: rb - 1, kind });
          }
          run = -1;
        }
        if (ok && run < 0) { run = b; ra = p & ROOM; rb = q & ROOM; }
      }
    }
  }
  leafCache.set(P, L);
  return L;
}

/** Rooms lit all the time (the fire code: the ways out), and the roof (open air): without a switch. */
const ALWAYS_LIT = new Set<RoomKind>(['hall', 'lobby', 'stair', 'lift', 'roof']);
/** A switch's plate: how high its middle is, m. */
export const SWITCH_Z = 1.2;
/**
 * (13.22, the manual's R10) The light switches: one in each room but the ways out, inside it on the wall by the free edge
 * of the leaf that swings into it (the handle's side), or by the hinge when there is no wall there. Furniture of kind
 * 'switch' facing into the room, its seed the room's index (sim/lights.ts toggles it). A room with no leaf (an open
 * doorway) has none yet.
 */
function addSwitches(P: Plan) {
  const done = new Set<number>();
  for (const L of leavesOf(P)) {
    if (L.ra < 0 || L.rb < 0) continue;
    const r = L.nx + L.ny > 0 ? L.rb : L.ra, R = P.rooms[r];
    if (!R || done.has(r) || ALWAYS_LIT.has(R.kind)) continue;
    for (const u of [L.w + 0.15, -0.15]) {
      const bx = L.hx + L.ax * u, by = L.hy + L.ay * u;
      if (!(cellAt(P, bx, by) & WALL) && !(cellAt(P, bx - L.nx * 0.1, by - L.ny * 0.1) & WALL)) continue;
      // from the leaf's line into the room, to the wall's face
      let t = -1;
      for (let s = 0.02; s < 0.6; s += 0.05) {
        const c = cellAt(P, bx + L.nx * s, by + L.ny * s);
        if (c & DOOR) break;
        if (!(c & WALL) && (c & ROOM) === r + 1) { t = s; break; }
      }
      if (t < 0) continue;
      const px = bx + L.nx * t, py = by + L.ny * t;
      // the face is the edge of the room's first cell
      const face = (v: number, n: number) => (n > 0 ? Math.floor(v / CELL) : Math.floor(v / CELL) + 1) * CELL + n * 0.015;
      const x = L.nx ? face(px, L.nx) : px, y = L.ny ? face(py, L.ny) : py;
      P.furn.push({ kind: 'switch', x, y, c: L.nx, s: L.ny, hx: 0.015, hy: 0.045, seed: r });
      done.add(r);
      break;
    }
  }
  // a room with no leaf of its own (an open doorway, a wide one, a shop off the street): on the wall beside its first doorway
  const { cells, nx, ny } = P, at = (i: number, j: number) => (i < 0 || j < 0 || i >= nx || j >= ny ? 0 : cells[j * nx + i]);
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  P.rooms.forEach((R, r) => {
    if (done.has(r) || ALWAYS_LIT.has(R.kind)) return;
    for (let j = 0; j < ny && !done.has(r); j++) for (let i = 0; i < nx && !done.has(r); i++) {
      const c = cells[j * nx + i];
      if ((c & ROOM) !== r + 1 || !(c & DOOR)) continue;
      for (const [dx, dy] of D4) {
        if ((at(i + dx, j + dy) & ROOM) === r + 1) continue; // (dx, dy) leads out of the room: the wall runs across it
        for (const sg of [1, -1]) {
          const ax = dy * sg, ay = -dx * sg;
          for (let k = 1; k < 9; k++) {
            const wi = i + ax * k, wj = j + ay * k, w = at(wi, wj);
            if ((w & ROOM) === r + 1 && (w & DOOR)) continue;
            const fl = at(wi - dx, wj - dy);
            if ((w & ROOM) === r + 1 && (w & WALL) && (fl & ROOM) === r + 1 && !(fl & (WALL | DOOR))) {
              const x = (P.gx + wi + 0.5) * CELL - dx * (CELL / 2 + 0.015), y = (P.gy + wj + 0.5) * CELL - dy * (CELL / 2 + 0.015);
              P.furn.push({ kind: 'switch', x, y, c: -dx, s: -dy, hx: 0.015, hy: 0.045, seed: r });
              done.add(r);
            }
            break;
          }
          if (done.has(r)) break;
        }
        if (done.has(r)) break;
      }
    }
  });
}

/** The cell value at a point (room + 1 with the DOOR and WALL bits), 0 outside the plan. */
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
  if (inFurniture(P, bx, by, true)) return true;
  // walk the step in short hops; a wall is a cell with the WALL bit (stepping out of one is free, so
  // nobody gets stuck), or a change of room without the DOOR bit on both sides
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.1);
  let prev = cellAt(P, ax, ay);
  for (let s = 1; s <= n; s++) {
    const c = cellAt(P, ax + ((bx - ax) * s) / n, ay + ((by - ay) * s) / n);
    if (!c || !prev) { prev = c || prev; continue; }
    if (c & WALL && !(prev & WALL)) return true;
    if ((c & ROOM) !== (prev & ROOM) && !(c & prev & DOOR)) return true;
    prev = c;
  }
  return false;
}
