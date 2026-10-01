import { hash3, mulberry32, type Rng } from '../core/rng';
import { generateCity, SIDEWALK, type City } from './city';
import { baseAt, blocked, cellAt, planOf } from './interior';
import { TIME_SCALE } from './clock';
import { buildPower, switchSub, type PowerGrid } from './power';
import { spawnCars, stepCars, type Car } from './traffic';
import { newWeather, PRESETS, stepWeather, type Weather } from './weather';

/** Simulation rate. The sim always advances in steps of exactly this size. */
export const TICK = 1 / 60;

export interface Player {
  x: number;
  y: number;
  /** Position at the previous tick, for render interpolation. */
  px: number;
  py: number;
  speed: number;
  /** Storey the player stands on (0 = the street), and the building around them (its ground volume), or -1. */
  floor: number;
  inside: number;
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
  /** Game time in seconds since midnight, January 1st 2008 (see clock.ts), and at the previous tick. */
  time: number;
  ptime: number;
  weather: Weather;
  power: PowerGrid;
}

/** Default city side in metres. */
export const CITY_SIZE = 2000;

export function createWorld(seed: number, size = CITY_SIZE): World {
  const rng = mulberry32(seed);
  const city = generateCity(seed, size);
  const cars = spawnCars(city, rng, 300);
  // start on the sidewalk of the block closest to downtown
  let start = city.blocks[0];
  for (const b of city.blocks) if (Math.hypot(b.x0 - city.cx, b.y0 - city.cy) < Math.hypot(start.x0 - city.cx, start.y0 - city.cy)) start = b;
  const x = start.x0 + SIDEWALK / 2, y = (start.y0 + start.y1) / 2;
  // every city starts on a day of 2008 of its own, at nine in the evening
  const time = (Math.floor(hash3(seed, 2008, 9) * 366) * 24 + 21) * 3600;
  const weather = newWeather();
  stepWeather(weather, seed, time, 0);
  return { seed, tick: 0, rng, city, cars, player: { x, y, px: x, py: y, speed: 0, floor: 0, inside: -1 }, time, ptime: time, weather, power: buildPower(seed, city) };
}

/** Debug: jump the clock by some hours (sleeping will do this for real). */
export function skipHours(w: World, h: number) {
  w.time = w.ptime = Math.max(0, w.time + h * 3600);
  stepWeather(w.weather, w.seed, w.time, 0);
}

/** Debug: switch the substation nearest the player, or (all) every one: all off if any is on. */
export function togglePower(w: World, all: boolean) {
  const P = w.power, p = w.player;
  if (all) { const off = P.subs.some((s) => s.on); P.subs.forEach((_, k) => switchSub(P, k, !off, w.tick, p.x, p.y)); return; }
  let k = 0;
  P.subs.forEach((s, n) => { if (Math.hypot(s.x - p.x, s.y - p.y) < Math.hypot(P.subs[k].x - p.x, P.subs[k].y - p.y)) k = n; });
  switchSub(P, k, !P.subs[k].on, w.tick, p.x, p.y);
}

/** Debug: go up or down a storey inside a building (until it has stairs and lifts), where that floor has room to stand. */
export function debugFloor(w: World, d: number) {
  const p = w.player;
  if (p.inside < 0) return;
  const f = Math.max(0, p.floor + d), P = planOf(w.city, p.inside, f);
  if (P && cellAt(P, p.x, p.y)) p.floor = f;
}

/** Debug: step through the fixed skies, then back to the forecast. */
export function cycleWeather(w: World) {
  w.weather.preset = w.weather.preset + 1 >= PRESETS.length ? -1 : w.weather.preset + 1;
  stepWeather(w.weather, w.seed, w.time, 0);
}

export function stepWorld(w: World, input: PlayerInput) {
  const p = w.player;
  p.px = p.x; p.py = p.y;
  let f = input.forward, st = input.strafe;
  const len = Math.hypot(f, st);
  if (len > 1) { f /= len; st /= len; }
  const sp = input.run ? 9 : 3.5;
  const dx = Math.cos(input.heading), dy = Math.sin(input.heading);
  const vx = (dx * f - dy * st) * sp, vy = (dy * f + dx * st) * sp;
  p.speed = Math.hypot(vx, vy);
  const R = 0.3;
  const nx = p.x + vx * TICK;
  // probes ahead of the player on both shoulders; walls, doorways and the street door are in interior.ts
  const hit = (x: number, y: number) => blocked(w.city, p.floor, p.x, p.y, x, y);
  if (!hit(nx + Math.sign(vx) * R, p.y - R * 0.7) && !hit(nx + Math.sign(vx) * R, p.y + R * 0.7)) p.x = nx;
  const ny = p.y + vy * TICK;
  if (!hit(p.x - R * 0.7, ny + Math.sign(vy) * R) && !hit(p.x + R * 0.7, ny + Math.sign(vy) * R)) p.y = ny;
  p.inside = baseAt(w.city, p.x, p.y);

  stepCars(w.city, w.cars, w.rng, TICK, p.x, p.y);
  w.ptime = w.time;
  w.time += TICK * TIME_SCALE;
  stepWeather(w.weather, w.seed, w.time, TICK * TIME_SCALE);
  w.tick++;
}
