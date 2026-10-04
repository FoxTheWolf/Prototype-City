import { hash3 } from '../core/rng';
import { FLOOR_H } from './city';
import { cellAt, planOf, ROOM } from './interior';
import type { World } from './world';

/**
 * The lift cars (13.2d): each building's car stands on a floor of its own (picked from the seed at
 * first), and the player calls it from the hall with F. While it is elsewhere its doors are shut on
 * this floor; it rides to the call, rings and opens. Riding it is the player's lift (world.player.liftTo):
 * the car is wherever the player is while they are in it.
 *
 * Later (stage 16), people inside the buildings will ride the cars too; the player always comes first:
 * a car someone is in is taken from them (they are put at their floor) and sent to the player's call.
 */
export interface LiftCar {
  /** Height of the car's floor, m; the floor it is riding to, or -1 standing. */
  z: number;
  to: number;
}

/** Lift speed in m/s, with a gentle start and stop (as the player's ride). */
const LIFT_V = 6;

/** How many floors the lift of lot k serves (the plans with the lift room at the ground's spot), cached. */
const tops = new Map<number, number>();
export function liftTop(w: World, k: number): number {
  let n = tops.get(k);
  if (n !== undefined) return n;
  const G = planOf(w.city, k, 0), L = G?.rooms.find((R) => R.kind === 'lift');
  n = 0;
  if (L) {
    const x = (L.x0 + L.x1) / 2, y = (L.y0 + L.y1) / 2;
    for (;;) { const P = planOf(w.city, k, n), q = P ? cellAt(P, x, y) & ROOM : 0; if (!q || P!.rooms[q - 1].kind !== 'lift') break; n++; }
  }
  tops.set(k, n);
  return n;
}

/** The car of lot k (made the first time it is asked for, on a floor of its own). */
export function carOf(w: World, k: number): LiftCar {
  let c = w.lifts.get(k);
  if (!c) {
    const n = Math.max(1, liftTop(w, k));
    c = { z: Math.floor(hash3(w.seed, k, 41) * n) * FLOOR_H, to: -1 };
    w.lifts.set(k, c);
  }
  return c;
}

/** Whether lot k's car stands at floor f with its doors open. */
export const carHere = (w: World, k: number, f: number) => { const c = carOf(w, k); return c.to < 0 && Math.abs(c.z - f * FLOOR_H) < 0.05; };

/** Whether (x, y) on the player's floor is in the lift room. */
export function inLift(w: World, x: number, y: number): boolean {
  const p = w.player;
  if (p.inside < 0) return false;
  const P = planOf(w.city, p.inside, p.floor), c = P ? cellAt(P, x, y) & ROOM : 0;
  return !!c && P!.rooms[c - 1].kind === 'lift';
}

/** The lift doors of this floor within reach of F (the player in the hall before them), or false. */
export function liftAhead(w: World, heading: number): boolean {
  const p = w.player;
  if (p.inside < 0 || p.liftTo >= 0 || inLift(w, p.x, p.y)) return false;
  const c = Math.cos(heading), s = Math.sin(heading);
  for (const d of [0.6, 1.0, 1.4]) if (inLift(w, p.x + c * d, p.y + s * d)) return true;
  return false;
}

/** F at the lift doors: the car is sent for (true), or it is already here (false). */
export function callCar(w: World): boolean {
  const p = w.player, car = carOf(w, p.inside);
  if (carHere(w, p.inside, p.floor) || car.to === p.floor) return false;
  car.to = p.floor;
  return true;
}

/** The cars ride toward their calls; the one the player stands in is where the player is. Pushes a ring (3) where a called car arrives. */
export function stepLifts(w: World, tick: number) {
  const p = w.player;
  if (p.inside >= 0 && inLift(w, p.x, p.y)) { const c = carOf(w, p.inside); c.z = p.z; c.to = -1; }
  for (const c of w.lifts.values()) {
    if (c.to < 0) continue;
    const goal = c.to * FLOOR_H, d = goal - c.z;
    c.z += Math.sign(d) * Math.min(Math.abs(d), Math.min(LIFT_V, 0.8 + Math.abs(d) * 2.2) * tick);
    if (Math.abs(goal - c.z) < 1e-3) { c.z = goal; c.to = -1; w.doorSfx.push([3, 0, 0]); }
  }
}
