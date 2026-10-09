import { hash3 } from '../core/rng';
import { DEBUG } from '../debug';
import { baseAt, cellAt, DOOR_ENTRY, DOOR_GLASS, DOOR_METAL, entryDoor, exitsOf, facePoint, LEAF_TH, leavesOf, planOf, WALL, type Door, type Leaf, type Room } from './interior';
import type { Building } from './city';
import { isOpen } from './telco';
import { PLACES } from './placeTypes';
import type { World } from './world';

/**
 * The doors by hand (13.2c): F opens the door in front, or closes it; a locked one stays shut. The
 * leaves between rooms (leavesOf) and the street doors (each a pair of glass leaves) swing open over
 * a moment, block the way while shut, and swing shut by themselves once the player has walked off.
 */

/** A door's key in world.doors and world.doorWant: the lot, the storey and its index in leavesOf (100 + n: street door n of exitsOf). */
export const doorKey = (k: number, f: number, n: number) => (k * 256 + f) * 128 + n;
const STREET = 100;
/** Reach of F, m; how far off an open door swings shut by itself. */
const REACH = 1.7, LEAVE = 3;
/** Seconds to open and to shut, by what the leaf is made of (DOOR_*): the steel one is heavy and its closer slow. */
const OPEN_S = [0.6, 0.6, 0.9, 0.6, 0.7], SHUT_S = [0.9, 0.8, 1.6, 0.8, 1.2];

/** What door key's leaf is made of: the street doors are glass (the residents' own wood: entryDoor), the rest as leavesOf says. */
export function doorKind(w: World, key: number): number {
  const n = key % 128, f = Math.floor(key / 128) % 256, k = Math.floor(key / 128 / 256);
  if (n >= STREET) return n === STREET && entryDoor(w.city, k) ? DOOR_ENTRY : DOOR_GLASS;
  const P = planOf(w.city, k, f);
  return (P && leavesOf(P)[n]?.kind) ?? DOOR_GLASS;
}

/**
 * The steel shutter of a shop's own street door (13.10d): how far down it is at this hour, 0 up, 1 down. It rolls
 * down over SHUTTER_H after closing time and up over SHUTTER_H before opening; a shop always open never shuts.
 */
export const SHUTTER_H = 0.05;
export function shutterAt(hours: [number, number], hour: number): number {
  const [a, b] = hours;
  if (b - a >= 24) return 0;
  const h = ((hour % 24) + 24) % 24, open = (h >= a && h < b) || h + 24 < b;
  if (open) return 0;
  const since = (((h - b) % 24) + 24) % 24, until = (((a - h) % 24) + 24) % 24;
  return Math.min(1, since / SHUTTER_H, until / SHUTTER_H);
}
/** Open enough to walk through. */
const PASS = 0.8;

/** A door within reach: its key, where its middle is, and whether it is a street door (with its lot and index). */
export interface DoorRef { key: number; x: number; y: number; k: number; f: number; n: number; street: boolean }

/**
 * A street door's pair of glass leaves (13.10d2): hinged at the jambs at the wall's outer face (the outer wall is
 * CELL thick; set back in it, the door sat in a recess with no sides, playtests of 2026-10-08), half a leaf's
 * thickness in from the jamb and from the face, so the leaf never swings through the
 * wall; shut they meet in the middle, open they turn into the building (against the outward normal). The residents'
 * own door (`entry`, 13.19) is one wooden leaf the whole width, hinged at the a0 jamb. The one source of their
 * geometry: the renderer's walk from inside and from the street both read these.
 */
export function doorLeaves(B: Building, D: Door, entry = false): Leaf[] {
  const [x0, y0, nx, ny] = facePoint(B, D.face, D.a0), [x1, y1] = facePoint(B, D.face, D.a1);
  const half = Math.hypot(x1 - x0, y1 - y0) / 2, ux = (x1 - x0) / (2 * half), uy = (y1 - y0) / (2 * half);
  const inK = LEAF_TH / 2, ix = -nx * inK, iy = -ny * inK, j = LEAF_TH / 2, w = half - j;
  if (entry) return [{ hx: x0 + ix + ux * j, hy: y0 + iy + uy * j, ax: ux, ay: uy, nx: -nx, ny: -ny, w: 2 * w, cx: x0 + ix + ux * half, cy: y0 + iy + uy * half, ra: -1, rb: -1, kind: DOOR_ENTRY }];
  return [
    { hx: x0 + ix + ux * j, hy: y0 + iy + uy * j, ax: ux, ay: uy, nx: -nx, ny: -ny, w, cx: x0 + ix + ux * half / 2, cy: y0 + iy + uy * half / 2, ra: -1, rb: -1, kind: DOOR_GLASS },
    { hx: x1 + ix - ux * j, hy: y1 + iy - uy * j, ax: -ux, ay: -uy, nx: -nx, ny: -ny, w, cx: x1 + ix - ux * half / 2, cy: y1 + iy - uy * half / 2, ra: -1, rb: -1, kind: DOOR_GLASS },
  ];
}

/** The street doors' leaves of lot k, by exitsOf (each knows its door: Leaf.door), for the renderer and the walls. */
export function streetLeaves(w: World, k: number): Leaf[] {
  const B = w.city.buildings[k], entry = entryDoor(w.city, k);
  return exitsOf(w.city, k).flatMap((D, n) => doorLeaves(B, D, entry && n === 0).map((L) => ({ ...L, door: n })));
}

/** The doors the player could reach: the leaves of the floor they stand on, and the street doors of the lot they are in or before. */
function doorsAround(w: World, ahead: [number, number]): DoorRef[] {
  const p = w.player, out: DoorRef[] = [];
  if (p.liftTo >= 0) return out;
  if (p.inside >= 0) {
    const P = planOf(w.city, p.inside, p.floor);
    if (P) leavesOf(P).forEach((L, n) => out.push({ key: doorKey(p.inside, p.floor, n), x: L.cx, y: L.cy, k: p.inside, f: p.floor, n, street: false }));
  }
  const k = p.inside >= 0 ? p.inside : baseAt(w.city, ahead[0], ahead[1]);
  if (k >= 0 && p.floor === 0) {
    const B = w.city.buildings[k];
    exitsOf(w.city, k).forEach((D, n) => { const [x, y] = facePoint(B, D.face, (D.a0 + D.a1) / 2); out.push({ key: doorKey(k, 0, STREET + n), x, y, k, f: 0, n, street: true }); });
  }
  return out;
}

/** The door in front of the player within reach, or null. */
export function doorAhead(w: World, heading: number): DoorRef | null {
  const p = w.player, c = Math.cos(heading), s = Math.sin(heading);
  let best: DoorRef | null = null, bd = REACH;
  for (const d of doorsAround(w, [p.x + c * 1.2, p.y + s * 1.2])) {
    const dx = d.x - p.x, dy = d.y - p.y, r = Math.hypot(dx, dy);
    if (r < bd && (r < 0.5 || (dx * c + dy * s) / r > 0.35)) { bd = r; best = d; }
  }
  return best;
}

const HOME_KINDS = new Set(['living', 'bedroom', 'kitchen', 'bath', 'foyer']);
/** Whether a door is locked against the player now. Inside, a street door always lets them out. */
export function doorLocked(w: World, d: DoorRef): boolean {
  if (DEBUG.unlockDoors) return false;
  const hour = (w.time / 3600) % 24, B = w.city.buildings[d.k];
  if (d.street) {
    // the shop's own door, outside its hours; the building's main door is open, unless the whole ground floor is the shop (13.10i)
    const G = d.n === 0 && B.biz >= 0 ? planOf(w.city, d.k, 0) : null, whole = !!G && !G.exits.length && G.rooms.some((R) => R.kind === 'shop');
    return w.player.inside < 0 && (d.n > 0 || whole) && B.biz >= 0 && !isOpen(w.city.businesses[B.biz].kind, hour);
  }
  const P = planOf(w.city, d.k, d.f), L = P && leavesOf(P)[d.n];
  if (!P || !L) return false;
  const A: Room | undefined = P.rooms[L.ra], C: Room | undefined = P.rooms[L.rb];
  if (!A || !C || A.unit === C.unit) return false; // within one home or suite: never locked
  const R = A.unit >= 0 ? A : C;
  // the residents' way through a shop to their lift (13.10i)
  if (R.kind === 'shop' && (A.kind === 'hall' || C.kind === 'hall')) return false;
  if (R.kind === 'office' || R.kind === 'open') return hour < 7 || hour >= 19;
  if (R.kind === 'store' || R.kind === 'shop') return B.biz < 0 || !isOpen(w.city.businesses[B.biz].kind, hour);
  // a home's front door: most are locked, a few left on the latch (fixed per home)
  return HOME_KINDS.has(R.kind) && hash3(d.k * 64 + d.f, R.unit, 77) < 0.75;
}

/** F at a door: opens it (or closes it if open); 'locked' when it will not open; null when there is none in front. */
export function useDoor(w: World, heading: number): 'open' | 'close' | 'locked' | null {
  const d = doorAhead(w, heading);
  if (!d) return null;
  if (w.doorWant.has(d.key)) { w.doorWant.delete(d.key); return 'close'; }
  if (doorLocked(w, d)) { w.doorSfx.push([2, d.x, d.y, doorKind(w, d.key)]); return 'locked'; }
  w.doorWant.add(d.key);
  w.doorAt.set(d.key, [d.x, d.y]);
  return 'open';
}

/** Doors swing toward open or shut; an open one shuts by itself once the player is a few metres off it (or on another floor). */
/**
 * How far a street door may open (0..1, as world.doors): a leaf swung in meets a wall standing against the jamb
 * (playtest of 2026-10-08, note 7), so it stops short of it. The largest opening at which every leaf of the door
 * stays over open floor of the ground plan; cached by key. Never under OPEN_MIN (a leaf at ~45 degrees: still a way
 * through, as streetOpen counts it against this cap).
 */
const capCache = new Map<number, number>(), OPEN_MIN = 0.3;
function openCap(w: World, key: number): number {
  const n = key % 128;
  if (n < STREET || Math.floor(key / 128) % 256 !== 0) return 1;
  let c = capCache.get(key);
  if (c !== undefined) return c;
  const k = Math.floor(key / 128 / 256), P = planOf(w.city, k, 0);
  c = 1;
  if (P) {
    const L = streetLeaves(w, k).filter((l) => l.door === n - STREET);
    const clear = (a: number) => L.every((l) => {
      const g = (1 - (1 - a) ** 2) * Math.PI * 0.5, dx = l.ax * Math.cos(g) + l.nx * Math.sin(g), dy = l.ay * Math.cos(g) + l.ny * Math.sin(g);
      for (let t = 0.25; t <= 1.001; t += 0.25) { const v = cellAt(P, l.hx + dx * l.w * t, l.hy + dy * l.w * t); if (!v || v & WALL) return false; }
      return true;
    });
    while (c > OPEN_MIN && !clear(c)) c = Math.max(OPEN_MIN, c - 0.05);
  }
  capCache.set(key, c);
  return c;
}

export function stepDoors(w: World, tick: number) {
  const p = w.player;
  for (const key of w.doorWant) {
    const at = w.doorAt.get(key), f = Math.floor(key / 128) % 256;
    if (!at || Math.hypot(p.x - at[0], p.y - at[1]) > LEAVE || f !== p.floor) w.doorWant.delete(key);
  }
  for (const key of w.doorWant) {
    const a = w.doors.get(key) ?? 0, kd = doorKind(w, key);
    if (a === 0) { const at = w.doorAt.get(key)!; w.doorSfx.push([1, at[0], at[1], kd]); }
    const cap = openCap(w, key);
    if (a < cap) w.doors.set(key, Math.min(cap, a + tick / OPEN_S[kd]));
  }
  for (const [key, a] of w.doors) {
    if (w.doorWant.has(key)) continue;
    const kd = doorKind(w, key), b = a - tick / SHUT_S[kd];
    if (b > 0) { w.doors.set(key, b); continue; }
    const at = w.doorAt.get(key) ?? [p.x, p.y];
    w.doors.delete(key); w.doorAt.delete(key);
    w.doorSfx.push([-1, at[0], at[1], kd]);
  }
  stepShutters(w, tick);
}

/** The shops' shutters near the player that start to roll this tick (a sound each: 4 down, 5 up). */
const SHUTTER_NEAR = 40;
function stepShutters(w: World, tick: number) {
  const p = w.player, h1 = (w.time / 3600) % 24, h0 = h1 - tick / 3600;
  for (const z of w.city.businesses) {
    const B = w.city.buildings[z.building];
    if (Math.abs((B.x0 + B.x1) / 2 - p.x) > SHUTTER_NEAR + 30 || Math.abs((B.y0 + B.y1) / 2 - p.y) > SHUTTER_NEAR + 30) continue;
    const hrs = PLACES[z.kind]?.hours ?? [9, 17], s0 = shutterAt(hrs, h0), s1 = shutterAt(hrs, h1);
    if (s0 === s1 || (s0 > 0 && s0 < 1)) continue;
    const k = z.building, D = exitsOf(w.city, k), Bk = w.city.buildings[k];
    for (let n = 1; n < D.length; n++) {
      const [x, y] = facePoint(Bk, D[n].face, (D[n].a0 + D[n].a1) / 2);
      if (Math.hypot(x - p.x, y - p.y) < SHUTTER_NEAR) w.doorSfx.push([s1 > s0 ? 4 : 5, x, y, DOOR_METAL]);
    }
  }
}

/** Whether the street door n of lot k is open enough to walk through. */
export const streetOpen = (w: World, k: number, n: number) => { const key = doorKey(k, 0, STREET + n); return (w.doors.get(key) ?? 0) >= Math.min(PASS, openCap(w, key) - 1e-6); };

/** Whether the step from (ax, ay) to (bx, by) on the player's floor goes through a shut leaf between rooms. */
export function leafBlocks(w: World, ax: number, ay: number, bx: number, by: number): boolean {
  const p = w.player;
  if (p.inside < 0) return false;
  const P = planOf(w.city, p.inside, p.floor);
  if (!P) return false;
  const L = leavesOf(P);
  for (let n = 0; n < L.length; n++) {
    const D = L[n];
    if ((w.doors.get(doorKey(p.inside, p.floor, n)) ?? 0) >= PASS) continue;
    // the doorway's line, from the hinge along the shut leaf
    const ex = D.ax * D.w, ey = D.ay * D.w, dx = bx - ax, dy = by - ay, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const qx = D.hx - ax, qy = D.hy - ay, t = (qx * ey - qy * ex) / den, u = (qx * dy - qy * dx) / den;
    if (t >= 0 && t <= 1 && u >= -0.05 && u <= 1.05) return true;
  }
  return false;
}
