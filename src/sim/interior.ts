import { hash3, mulberry32 } from '../core/rng';
import { BAY, blockAt, faceSpan, FLOOR_H, isSolid, type Building, type City } from './city';

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

export type RoomKind = 'lobby' | 'hall' | 'stair' | 'lift' | 'foyer' | 'living' | 'bedroom' | 'kitchen' | 'bath' | 'office' | 'open' | 'shop';

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
  /** Room index + 1 per cell (0 outside), with the DOOR bit. Cell (i, j) is at ((gx + i), (gy + j)) * CELL. */
  cells: Uint8Array;
  gx: number;
  gy: number;
  nx: number;
  ny: number;
}

/** The street door: on face 0..4 (as faceSpan numbers them), from a0 to a1 along it. */
export interface Door {
  face: number;
  a0: number;
  a1: number;
}

const HABITABLE = new Set(['office', 'glass', 'residential', 'brick']);
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
function facePoint(B: Building, face: number, a: number): [number, number, number, number] {
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
}

const snap = (v: number) => Math.round(v / BAY) * BAY;

const frameCache = new Map<number, Frame>();
function frameOf(city: City, k: number): Frame {
  let F = frameCache.get(k);
  if (F) return F;
  const B = city.buildings[k], alongX = B.x1 - B.x0 >= B.y1 - B.y0;
  const U0 = alongX ? B.x0 : B.y0, U1 = alongX ? B.x1 : B.y1, V0 = alongX ? B.y0 : B.x0, V1 = alongX ? B.y1 : B.x1;
  const W = V1 - V0, tall = Math.max(...tiersOf(city, k).map((j) => floorsOf(city.buildings[j])));
  const lift = isOffice(B) || tall > 5;
  // which side of the corridor the door is on: the core goes on the other one
  const D = doorOf(city, k);
  let dv = (V0 + V1) / 2;
  if (D) { const [x, y] = facePoint(B, D.face, (D.a0 + D.a1) / 2); dv = alongX ? y : x; }
  let c0: number, c1: number;
  if (W >= 10.5) { c0 = snap((V0 + V1) / 2 - BAY / 2); c1 = c0 + BAY; }
  else if (W >= 7) { c0 = V0; c1 = snap(V0) + BAY; if (c1 - V0 < 1.2) c1 += BAY; } // along one wall
  else { c0 = c1 = V0; }
  const mid = (U0 + U1) / 2, coreW = (lift ? 3 : 2) * BAY;
  if (c1 > c0) {
    // the core on the deeper side, unless the door opens there
    let sideA = c0 - V0 > V1 - c1;
    if (c0 === V0) sideA = false;
    else if (dv < c0) sideA = false;
    else if (dv > c1) sideA = true;
    const depth = Math.min(3 * BAY, sideA ? c0 - V0 : V1 - c1);
    const su0 = snap(mid - coreW / 2);
    F = { alongX, c0, c1, su0, su1: su0 + 2 * BAY, lu1: su0 + coreW, cv0: sideA ? c0 - depth : c1, cv1: sideA ? c0 : c1 + depth };
  } else {
    // a narrow walk-up: the stairs across one end, no corridor
    const su0 = U0 - 1, su1 = snap(U0) + 2 * BAY;
    F = { alongX, c0, c1, su0, su1, lu1: su1, cv0: V0 - 1, cv1: V1 + 1 };
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

const lotCache = new Map<number, number>();
/** The lot (ground volume with an inside) a box belongs to: itself, the base of a setback, or -1. */
export function lotOf(city: City, j: number): number {
  let k = lotCache.get(j);
  if (k !== undefined) return k;
  const B = city.buildings[j];
  k = -1;
  if (B.tier === 1) k = habitable(B) ? j : -1;
  else if (B.tier > 1) {
    const cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2, b = blockAt(city, cx, cy);
    if (b) for (let q = b.b0; q < b.b1; q++) { const T = city.buildings[q]; if (T.tier === 1 && T.style === B.style && habitable(T) && inside(T, cx, cy)) { k = q; break; } }
  }
  lotCache.set(j, k);
  return k;
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
    if (shop) { room('shop', unit++, a, Math.min(cv, vf), b, Math.max(cv, vf)); return; }
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
    room('stair', -1, F.su0, F.cv0, F.su1, F.cv1);
    doorV(core < 0 ? F.c0 : F.c1, F.su0 + 0.4);
    if (F.lu1 > F.su1) { room('lift', -1, F.su1, F.cv0, F.lu1, F.cv1); doorV(core < 0 ? F.c0 : F.c1, F.su1 + 0.4); }
    if (lSide) { room('lobby', -1, lu0, lSide < 0 ? V0 : F.c1, lu1, lSide < 0 ? F.c0 : V1); doorV(lSide < 0 ? F.c0 : F.c1, lu0 + BAY + 0.2); }
    // behind a shallow core, a room of the unit next to it
    const outer = core < 0 ? V0 : V1, back = core < 0 ? F.cv0 : F.cv1;
    if (Math.abs(outer - back) > 1.2) {
      const v0 = Math.min(outer, back), v1 = Math.max(outer, back), vm = (v0 + v1) / 2;
      const c = cellAt({ box: j, rooms, cells, gx, gy, nx, ny }, ax ? F.su0 - 0.2 : vm, ax ? vm : F.su0 - 0.2) & 127;
      const next = c && rooms[c - 1].unit >= 0 ? rooms[c - 1] : null; // not a corridor or the lobby
      room(next ? (next.kind === 'shop' || next.kind === 'open' || next.kind === 'office' ? next.kind : 'bedroom') : office ? 'office' : 'bedroom', next ? next.unit : unit++, F.su0, v0, F.lu1, v1);
      if (next && next.kind !== 'shop') doorU(F.su0, vm - 0.6);
    }
  } else {
    // walk-up: stairs at one end, the rest is one home (or a shop downstairs)
    room('stair', -1, U0, V0, F.su1, V1);
    if (shop) room('shop', unit++, F.su1, V0, U1, V1);
    else if (office) { room('office', unit++, F.su1, V0, U1, V1); doorU(F.su1, V0 + 0.4); }
    else {
      const n = (U1 - F.su1) / BAY, id = unit++;
      if (n >= 5) { const b = snap(U1 - 2 * BAY); room('living', id, F.su1, V0, b, V1); room('bedroom', id, b, V0, U1, V1); doorU(b, V0 + 0.4); }
      else room('living', id, F.su1, V0, U1, V1);
      doorU(F.su1, V0 + 0.4);
    }
  }
  for (const [u0, v0, u1, v1] of doors) fill(u0, v0, u1, v1, DOOR, true);
  return { box: j, rooms, cells, gx, gy, nx, ny };
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
export function blocked(city: City, f: number, ax: number, ay: number, bx: number, by: number): boolean {
  const ka = baseAt(city, ax, ay), kb = baseAt(city, bx, by);
  if (kb < 0 && isSolid(city, bx, by)) return true;
  if (ka !== kb) {
    if (ka >= 0 && kb >= 0) return true;
    const k = ka >= 0 ? ka : kb, D = f === 0 ? doorOf(city, k) : null;
    if (!D) return true;
    const B = city.buildings[k], [px, py, nx, ny] = facePoint(B, D.face, D.a0);
    const sa = (ax - px) * nx + (ay - py) * ny, sb = (bx - px) * nx + (by - py) * ny;
    if (sa > 0 === sb > 0) return true; // left through another face
    const ua = alongFace(B, D.face, ax, ay), ub = alongFace(B, D.face, bx, by);
    return Math.min(ua, ub) < D.a0 + 0.05 || Math.max(ua, ub) > D.a1 - 0.05;
  }
  if (ka < 0) return false;
  const P = planOf(city, ka, f);
  if (!P) return true;
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
