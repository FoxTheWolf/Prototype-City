import { hash3, mulberry32, type Rng } from '../core/rng';
import { FLOOR_H, generateCity, SIDEWALK, type City } from './city';
import { baseAt, blocked, cellAt, ESC_AT, escapeAt, escapeZ, planOf, stairStep } from './interior';
import { TIME_SCALE } from './clock';
import { buildPower, switchSub, type PowerGrid } from './power';
import { lastEvent, logEvent, newEventLog, type EventLog } from './events';
import { queues, spawnCars, stepCars, type Car } from './traffic';
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
  /** Feet height in metres: floor * FLOOR_H, except while riding a lift. */
  z: number;
  /** The floor a lift is taking the player to, or -1 when not riding one. */
  liftTo: number;
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
  /** What has happened (see events.ts). */
  events: EventLog;
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
  return { seed, tick: 0, rng, city, cars, player: { x, y, px: x, py: y, speed: 0, floor: 0, inside: -1, z: 0, liftTo: -1 }, time, ptime: time, weather, power: buildPower(seed, city), events: newEventLog() };
}

/** Debug: jump the clock by some hours (sleeping will do this for real). */
export function skipHours(w: World, h: number) {
  w.time = w.ptime = Math.max(0, w.time + h * 3600);
  stepWeather(w.weather, w.seed, w.time, 0);
}

/** Debug: switch the substation nearest the player, or (all) every one: all off if any is on. */
export function togglePower(w: World, all: boolean) {
  const P = w.power, p = w.player;
  const flip = (k: number, on: boolean) => {
    if (P.subs[k].on === on) return;
    switchSub(P, k, on, w.tick, p.x, p.y);
    logEvent(w.events, on ? 'restored' : 'blackout', w.tick, w.time, P.subs[k].x, P.subs[k].y, 0.8, [k]);
  };
  if (all) { const off = P.subs.some((s) => s.on); P.subs.forEach((_, k) => flip(k, !off)); return; }
  let k = 0;
  P.subs.forEach((s, n) => { if (Math.hypot(s.x - p.x, s.y - p.y) < Math.hypot(P.subs[k].x - p.x, P.subs[k].y - p.y)) k = n; });
  flip(k, !P.subs[k].on);
}

/** Debug: go up or down a storey inside a building (until it has stairs and lifts), where that floor has room to stand. */
export function debugFloor(w: World, d: number) {
  const p = w.player;
  if (p.inside < 0) return;
  // in a lift car the buttons call it: it rides there for real, doors shut
  const here = planOf(w.city, p.inside, p.floor), c = here ? cellAt(here, p.x, p.y) & 127 : 0;
  if (c && here!.rooms[c - 1].kind === 'lift') {
    const f = (p.liftTo >= 0 ? p.liftTo : p.floor) + d, P = f >= 0 ? planOf(w.city, p.inside, f) : null;
    if (P && (cellAt(P, p.x, p.y) & 127) && P.rooms[(cellAt(P, p.x, p.y) & 127) - 1].kind === 'lift') p.liftTo = f;
    return;
  }
  const f = Math.max(0, p.floor + d), P = planOf(w.city, p.inside, f);
  if (P && cellAt(P, p.x, p.y)) { p.floor = f; p.z = f * FLOOR_H; }
}

/** The lift car the player stands in: the number of floors it serves, or 0 when not in one. */
export function liftFloors(w: World): number {
  const p = w.player;
  if (p.inside < 0) return 0;
  const P = planOf(w.city, p.inside, p.floor), c = P ? cellAt(P, p.x, p.y) & 127 : 0;
  if (!c || P!.rooms[c - 1].kind !== 'lift') return 0;
  let n = p.floor + 1;
  for (;;) { const Q = planOf(w.city, p.inside, n), q = Q ? cellAt(Q, p.x, p.y) & 127 : 0; if (!q || Q!.rooms[q - 1].kind !== 'lift') return n; n++; }
}

/** Press a floor on the car's panel: it rides there (true), or the floor does not exist (false). */
export function callLift(w: World, f: number): boolean {
  const n = liftFloors(w), p = w.player;
  if (!n || f < 0 || f >= n || f === (p.liftTo >= 0 ? p.liftTo : p.floor)) return false;
  p.liftTo = f;
  return true;
}

/** Lift speed in m/s, with a gentle start and stop. */
const LIFT_V = 2.5;
function stepLift(p: Player) {
  const goal = p.liftTo * FLOOR_H, d = goal - p.z;
  p.z += Math.sign(d) * Math.min(Math.abs(d), Math.min(LIFT_V, 0.6 + Math.abs(d) * 1.5) * TICK);
  // the storey whose plan surrounds the car
  p.floor = Math.round(p.z / FLOOR_H);
  if (Math.abs(goal - p.z) < 1e-3) { p.z = goal; p.floor = p.liftTo; p.liftTo = -1; }
}

/** Debug: step through the fixed skies, then back to the forecast. */
export function cycleWeather(w: World) {
  w.weather.preset = w.weather.preset + 1 >= PRESETS.length ? -1 : w.weather.preset + 1;
  stepWeather(w.weather, w.seed, w.time, 0);
}

/** Cars waiting at one approach to call it a jam, and ticks before the same jam is news again. */
const JAM_CARS = 7, JAM_AGAIN = 60 * 300;

export function stepWorld(w: World, input: PlayerInput) {
  const p = w.player;
  p.px = p.x; p.py = p.y;
  let f = input.forward, st = input.strafe;
  const len = Math.hypot(f, st);
  if (len > 1) { f /= len; st /= len; }
  const sp = p.liftTo >= 0 ? 0 : input.run ? 9 : 3.5; // a moving car holds the player still
  if (p.liftTo >= 0) stepLift(p);
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
  const wasOut = p.inside < 0;
  p.inside = baseAt(w.city, p.x, p.y);
  // outdoors up a fire escape: the feet follow its landings and flights, and there is no walking off it
  if (p.inside < 0 && (p.x !== p.px || p.y !== p.py)) {
    const z = escapeAt(w.city, p.x, p.y) ? escapeZ(ESC_AT.e!, ESC_AT.u, ESC_AT.d, p.z) : p.z > 0.01 ? NaN : 0;
    if (Number.isNaN(z)) { p.x = p.px; p.y = p.py; }
    else { p.z = z; p.floor = Math.floor((z + 0.01) / FLOOR_H); }
  }
  // in through a fire escape's window: onto that floor
  if (p.inside >= 0 && wasOut && p.liftTo < 0) p.z = p.floor * FLOOR_H;
  // on the stairs the feet follow the steps; the floor is the storey they are in
  if (p.inside >= 0 && p.liftTo < 0 && (p.x !== p.px || p.y !== p.py)) {
    const z = stairStep(w.city, p.inside, p.x, p.y, p.z);
    if (z !== null && Number.isNaN(z)) { p.x = p.px; p.y = p.py; }
    else if (z !== null) { p.z = z; p.floor = Math.floor((z + 0.01) / FLOOR_H); }
  }

  stepCars(w.city, w.power, w.cars, w.rng, TICK, w.tick, p.x, p.y);
  // every 10 s, a queue longer than a red light makes is a jam (logged again only after 5 min)
  if (w.tick % 600 === 599) queues(w.city, w.cars, (i, j, hd, n) => {
    if (n < JAM_CARS) return;
    const refs = [i, j, hd], last = lastEvent(w.events, 'jam', refs);
    if (last && w.tick - last.tick < JAM_AGAIN) return;
    logEvent(w.events, 'jam', w.tick, w.time, (w.city.xb[2 * i] + w.city.xb[2 * i + 1]) / 2, (w.city.yb[2 * j] + w.city.yb[2 * j + 1]) / 2, Math.min(1, n / 15), refs);
  });
  w.ptime = w.time;
  w.time += TICK * TIME_SCALE;
  stepWeather(w.weather, w.seed, w.time, TICK * TIME_SCALE);
  w.tick++;
}
