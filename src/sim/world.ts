import { mulberry32, type Rng } from '../core/rng';
import { BS, generateCity, isSolid, type City } from './city';
import { spawnCars, stepCars, type Car } from './traffic';

/** Simulation rate. The sim always advances in steps of exactly this size. */
export const TICK = 1 / 60;

export interface Player {
  x: number;
  y: number;
  /** Position at the previous tick, for render interpolation. */
  px: number;
  py: number;
  speed: number;
}

/** What the player asks for this tick. The only way the outside world affects the sim. */
export interface PlayerInput {
  forward: number;
  strafe: number;
  run: boolean;
  heading: number;
}

export interface World {
  seed: number;
  tick: number;
  rng: Rng;
  city: City;
  cars: Car[];
  player: Player;
}

export function createWorld(seed: number): World {
  const rng = mulberry32(seed);
  const city = generateCity(rng);
  const cars = spawnCars(rng, 70);
  const x = 6 * BS + 3.5, y = 6 * BS + 7;
  return { seed, tick: 0, rng, city, cars, player: { x, y, px: x, py: y, speed: 0 } };
}

export function stepWorld(w: World, input: PlayerInput) {
  const p = w.player;
  p.px = p.x; p.py = p.y;
  let f = input.forward, st = input.strafe;
  const len = Math.hypot(f, st);
  if (len > 1) { f /= len; st /= len; }
  const sp = input.run ? 6.5 : 2.8;
  const dx = Math.cos(input.heading), dy = Math.sin(input.heading);
  const vx = (dx * f - dy * st) * sp, vy = (dy * f + dx * st) * sp;
  p.speed = Math.hypot(vx, vy);
  const R = 0.22;
  const nx = p.x + vx * TICK;
  if (!isSolid(w.city, nx + Math.sign(vx) * R, p.y - R * 0.7) && !isSolid(w.city, nx + Math.sign(vx) * R, p.y + R * 0.7)) p.x = nx;
  const ny = p.y + vy * TICK;
  if (!isSolid(w.city, p.x - R * 0.7, ny + Math.sign(vy) * R) && !isSolid(w.city, p.x + R * 0.7, ny + Math.sign(vy) * R)) p.y = ny;

  stepCars(w.cars, w.rng, TICK, p.x, p.y);
  w.tick++;
}
