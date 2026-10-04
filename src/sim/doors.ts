import { hash3 } from '../core/rng';
import { baseAt, exitsOf, facePoint, leavesOf, planOf, type Leaf, type Room } from './interior';
import { isOpen } from './telco';
import type { World } from './world';

/**
 * The doors by hand (13.2c): F opens the door in front, or closes it; a locked one stays shut. The
 * leaves between rooms (leavesOf) and the street doors (each a pair of glass leaves) swing open over
 * a moment, block the way while shut, and swing shut by themselves once the player has walked off.
 */

/** A door's key in world.doors and world.doorWant: the lot, the storey and its index in leavesOf (100 + n: street door n of exitsOf). */
export const doorKey = (k: number, f: number, n: number) => (k * 256 + f) * 128 + n;
const STREET = 100;
/** Reach of F, m; how far off an open door swings shut by itself; seconds to open and to shut. */
const REACH = 1.7, LEAVE = 3, OPEN_S = 0.6, SHUT_S = 0.8;
/** Open enough to walk through. */
const PASS = 0.8;

/** A door within reach: its key, where its middle is, and whether it is a street door (with its lot and index). */
export interface DoorRef { key: number; x: number; y: number; k: number; f: number; n: number; street: boolean }

/** The street doors' pairs of glass leaves (hinged at both jambs, swinging in), for the renderer and the walls. */
export function streetLeaves(w: World, k: number): Leaf[] {
  const B = w.city.buildings[k], out: Leaf[] = [];
  for (const D of exitsOf(w.city, k)) {
    const [x0, y0, nx, ny] = facePoint(B, D.face, D.a0), [x1, y1] = facePoint(B, D.face, D.a1);
    const half = Math.hypot(x1 - x0, y1 - y0) / 2, ux = (x1 - x0) / (2 * half), uy = (y1 - y0) / (2 * half);
    // the leaves lie along the facade when shut; open, they turn into the building (against the outward normal)
    // a few centimetres in from the facade, so the ray from inside meets them before the outer wall
    const ix = -nx * 0.04, iy = -ny * 0.04;
    out.push({ hx: x0 + ix, hy: y0 + iy, ax: ux, ay: uy, nx: -nx, ny: -ny, w: half, cx: x0 + ux * half / 2, cy: y0 + uy * half / 2, ra: -1, rb: -1 });
    out.push({ hx: x1 + ix, hy: y1 + iy, ax: -ux, ay: -uy, nx: -nx, ny: -ny, w: half, cx: x1 - ux * half / 2, cy: y1 - uy * half / 2, ra: -1, rb: -1 });
  }
  return out;
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
  const hour = (w.time / 3600) % 24, B = w.city.buildings[d.k];
  if (d.street) {
    // the shop's own door, outside its hours; the building's main door is open
    return w.player.inside < 0 && d.n > 0 && B.biz >= 0 && !isOpen(w.city.businesses[B.biz].kind, hour);
  }
  const P = planOf(w.city, d.k, d.f), L = P && leavesOf(P)[d.n];
  if (!P || !L) return false;
  const A: Room | undefined = P.rooms[L.ra], C: Room | undefined = P.rooms[L.rb];
  if (!A || !C || A.unit === C.unit) return false; // within one home or suite: never locked
  const R = A.unit >= 0 ? A : C;
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
  if (doorLocked(w, d)) { w.doorSfx.push([2, d.x, d.y]); return 'locked'; }
  w.doorWant.add(d.key);
  w.doorAt.set(d.key, [d.x, d.y]);
  return 'open';
}

/** Doors swing toward open or shut; an open one shuts by itself once the player is a few metres off it (or on another floor). */
export function stepDoors(w: World, tick: number) {
  const p = w.player;
  for (const key of w.doorWant) {
    const at = w.doorAt.get(key), f = Math.floor(key / 128) % 256;
    if (!at || Math.hypot(p.x - at[0], p.y - at[1]) > LEAVE || f !== p.floor) w.doorWant.delete(key);
  }
  for (const key of w.doorWant) {
    const a = w.doors.get(key) ?? 0;
    if (a === 0) { const at = w.doorAt.get(key)!; w.doorSfx.push([1, at[0], at[1]]); }
    if (a < 1) w.doors.set(key, Math.min(1, a + tick / OPEN_S));
  }
  for (const [key, a] of w.doors) {
    if (w.doorWant.has(key)) continue;
    const b = a - tick / SHUT_S;
    if (b > 0) { w.doors.set(key, b); continue; }
    w.doors.delete(key); w.doorAt.delete(key);
    w.doorSfx.push([-1, 0, 0]);
  }
}

/** Whether the street door n of lot k is open enough to walk through. */
export const streetOpen = (w: World, k: number, n: number) => (w.doors.get(doorKey(k, 0, STREET + n)) ?? 0) >= PASS;

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
