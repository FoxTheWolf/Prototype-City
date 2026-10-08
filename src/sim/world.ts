import { hash3, mulberry32, type Rng } from '../core/rng';
import { drain, type Steps } from '../core/steps';
import { FLOOR_H, generateCity, nearestRoad, SIDEWALK, type City } from './city';
import { baseAt, blocked, cellAt, ESC_AT, escapeAt, escapeZ, feetZ, planOf, ROOM, STEP_UP } from './interior';
import { type Sit } from './seats';
import { TIME_SCALE } from './clock';
import { buildCctv, type Cctv } from './cctv';
import { openAccount, type BankAccount } from './bank';
import { newGear, type Gear } from './gear';
import { newBag, stepBag, type Bag } from './bag';
import { newNeeds, stepNeeds, type Needs } from './needs';
import { newMail, type Mail } from './mail';
import { buildJobs, stepJobs, type JobBoard } from './jobs';
import { buildPower, switchSub, type PowerGrid } from './power';
import { buildTelco, type Telco } from './telco';
import { leafBlocks, stepDoors, streetOpen } from './doors';
import { carHere, inLift, stepLifts, type LiftCar } from './lifts';
import { buildWifi, type AccessPoint } from './wifi';
import { noPeople, peopleSteps, PEOPLE as PEOPLE_AT, type Population } from './citizens';
import { newFeed, stepSocial, type Feed } from './social';
import { newHeat, recordAct, stepHeat, type Heat } from './heat'; // [HACKING]
import { lastEvent, logEvent, newEventLog, type EventLog } from './events';
import { crashes, queues, roadGrip, spawnCars, stepCars, type Car } from './traffic';
import { crossers, spawnPeds, stepPeds, type Ped } from './peds';
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
  /** Cash in the pocket, in cents (coins for payphones now; the economy, stage 13, will use it). */
  cash: number;
  /** The seat the player sits on (13.10f), or null standing; saves from before it have none. */
  sit?: Sit | null;
  /** Crouching (14.8): 0 standing .. 1 down (the eye lower, the steps slow and quiet; read by whoever looks for the player). */
  crouch?: number;
  /** A jump (14.8): how high the feet are off the ground (m) and how fast they rise (m/s). Only the view: it clears nothing. */
  hop?: number;
  hopV?: number;
}

/** What the player asks for this tick. The only way the outside world affects the sim. */
export interface PlayerInput {
  forward: number;
  strafe: number;
  run: boolean;
  heading: number;
  /** Jump (held: once, on the ground) and crouch (held), 14.8. */
  jump?: boolean;
  crouch?: boolean;
}

/** The player's Switchboard forum state (15.8c): the account (bound to the phone number, confirmed by
 *  SMS) and the replies posted, each with the op's later answer. Kept in the save. */
export interface ForumState {
  me: { handle: string; num: string; code: string; ok: boolean } | null;
  mine: { tid: string; time: number; text: string; reply: string | null; at: number }[];
}

export interface World {
  seed: number;
  tick: number;
  rng: Rng;
  city: City;
  cars: Car[];
  /** The people on the sidewalks near the player. */
  peds: Ped[];
  player: Player;
  /** What each citizen remembers of the player from talking (14.2, talk.ts), by citizen. */
  talks: Map<number, { met: number; rude: number; name: boolean; num?: boolean; face?: boolean; topic?: string }>;
  /** Game time in seconds since midnight, January 1st 2008 (see clock.ts), and at the previous tick. */
  time: number;
  ptime: number;
  weather: Weather;
  power: PowerGrid;
  /** The mobile network: cell sites and the player's line (see telco.ts). */
  telco: Telco;
  /** The Wi-Fi routers of shops and homes (see wifi.ts). */
  wifi: AccessPoint[];
  /**
   * How open each door is (between rooms, and the street doors), 0 shut .. 1 open, by doorKey; doors not listed are shut.
   * F opens them (doors.ts), and they swing shut by themselves once the player walks off.
   */
  doors: Map<number, number>;
  /** The doors the player opened (they swing toward open), and where each one is. */
  doorWant: Set<number>;
  doorAt: Map<number, [number, number]>;
  /** Each building's lift car (lifts.ts), by lot, made when first looked at. */
  lifts: Map<number, LiftCar>;
  /** Doors that just started to open (+1), just closed (-1) or would not open (2, locked), lift cars that came when called (3), shop shutters starting to roll down (4) or up (5), with where and what the door is made of (DOOR_*), for main to sound. */
  doorSfx: [number, number, number, number?][];
  /** What has happened (see events.ts). */
  events: EventLog;
  /** Everyone who lives in the city (see citizens.ts). */
  pop: Population;
  /** What they post (see social.ts). */
  feed: Feed;
  /** The player's Switchboard forum account and replies (15.8c; web/forum.ts drives it). */
  forum: ForumState;
  /** The security cameras (see cctv.ts). */
  cctv: Cctv[];
  /** The player's bank account (see bank.ts). */
  bank: BankAccount;
  /** What the player has bought (F.9): the notebook's antenna and second battery, the SIMs. */
  gear: Gear;
  /** What the player carries in the backpack (13.4; see bag.ts). */
  bag: Bag;
  /** Hunger and breath (13.5; see needs.ts). */
  needs: Needs;
  /** The player's e-mail accounts (15.4; see mail.ts). */
  mail: Mail;
  /** [HACKING] The jobs a fixer offers (see jobs.ts). */
  jobs: JobBoard;
  /** [HACKING] The heat the player draws, and the traces behind it (see heat.ts). */
  heat: Heat;
}

/** Cars on the grid at the busiest hour (and 12% more on the diagonal), for the default city size. */
const CARS = 2000;
/** Share of CARS on the streets at each hour of the day: quiet before dawn, full at the rush hours. */
const RUSH = [0.3, 0.25, 0.22, 0.22, 0.25, 0.35, 0.6, 0.9, 1, 0.95, 0.8, 0.8, 0.85, 0.8, 0.8, 0.85, 0.95, 1, 1, 0.85, 0.7, 0.6, 0.5, 0.4];
/** Cars wanted at game time t (seconds), the hours blended. */
function carsWanted(t: number) {
  const h = (t / 3600) % 24, a = Math.floor(h), f = h - a;
  return Math.round(CARS * 1.12 * (RUSH[a] * (1 - f) + RUSH[(a + 1) % 24] * f));
}
/** How far from the player cars leave or join the streets, and how many per step (every half second). */
const HIDE_R = 300, TURNOVER = 4;

/** Default city side in metres. */
export const CITY_SIZE = 2000;

/** people: false for a world that is only drawn (the render workers), which needs no citizens. */
export function createWorld(seed: number, size = CITY_SIZE, people = true): World { return drain(worldSteps(seed, size, people)); }

/** createWorld in steps (0..1 along), for a loader that keeps the page alive; `saved`: the population already made for this seed (a cache). */
export function* worldSteps(seed: number, size = CITY_SIZE, people = true, saved?: Population): Steps<World> {
  const rng = mulberry32(seed);
  yield 0;
  const city = generateCity(seed, size);
  yield 0.05;
  // every city starts on a day of 2008 of its own, at nine in the evening
  const time = (Math.floor(hash3(seed, 2008, 9) * 366) * 24 + 21) * 3600;
  const cars = spawnCars(city, rng, Math.round(carsWanted(time) / 1.12));
  // start on the sidewalk of the block closest to downtown
  let start = city.blocks[0];
  for (const b of city.blocks) if (Math.hypot(b.x0 - city.cx, b.y0 - city.cy) < Math.hypot(start.x0 - city.cx, start.y0 - city.cy)) start = b;
  const x = start.x0 + SIDEWALK / 2, y = (start.y0 + start.y1) / 2;

  const weather = newWeather();
  stepWeather(weather, seed, time, 0);
  const power = buildPower(seed, city);
  yield 0.08;
  const telco = buildTelco(seed, city, power);
  yield 0.1;
  let pop = saved ?? noPeople();
  if (people && !saved) {
    const g = peopleSteps(seed, city, telco, Math.round(PEOPLE_AT * (size / CITY_SIZE) ** 2));
    for (let r = g.next(); ; r = g.next()) { if (r.done) { pop = r.value; break; } yield 0.1 + 0.85 * r.value; }
  }
  yield 0.95;
  telco.people = pop.byNum;
  const peds = spawnPeds(city, pop, rng, time, x, y);
  return { seed, tick: 0, rng, city, cars, peds, player: { x, y, px: x, py: y, speed: 0, floor: 0, inside: -1, z: 0, liftTo: -1, cash: 1250 }, time, ptime: time, weather, power, doors: new Map(), doorWant: new Set(), doorAt: new Map(), lifts: new Map(), doorSfx: [], telco, wifi: buildWifi(seed, city, x, y, power), events: newEventLog(), pop, feed: newFeed(), forum: { me: null, mine: [] }, cctv: buildCctv(seed, city), bank: openAccount(seed, city, x, y, time), gear: newGear(), bag: newBag(), needs: newNeeds(), mail: newMail(), talks: new Map(), jobs: buildJobs(seed, city, power, pop, telco, x, y, time), heat: newHeat() };
}

/** Debug: jump the clock by some hours (sleeping will do this for real). */
export function skipHours(w: World, h: number) {
  w.time = w.ptime = Math.max(0, w.time + h * 3600);
  stepWeather(w.weather, w.seed, w.time, 0);
}

/** The fewest game hours a dark substation waits for the crews (up to twice that). */
const RESTORE_H = 2;

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
  const wasOn = P.subs[k].on;
  flip(k, !wasOn);
  // [HACKING] throwing a breaker dark is a traceable act, like the hacked blackout (see heat.ts)
  if (wasOn) recordAct(w.heat, w, p.x, p.y, w.time, true);
}

/** Debug: go up or down a storey inside a building (until it has stairs and lifts), where that floor has room to stand. */
export function debugFloor(w: World, d: number) {
  const p = w.player;
  if (p.inside < 0) return;
  // in a lift car the buttons call it: it rides there for real, doors shut
  const here = planOf(w.city, p.inside, p.floor), c = here ? cellAt(here, p.x, p.y) & ROOM : 0;
  if (c && here!.rooms[c - 1].kind === 'lift') {
    const f = (p.liftTo >= 0 ? p.liftTo : p.floor) + d, P = f >= 0 ? planOf(w.city, p.inside, f) : null;
    if (P && (cellAt(P, p.x, p.y) & ROOM) && P.rooms[(cellAt(P, p.x, p.y) & ROOM) - 1].kind === 'lift') p.liftTo = f;
    return;
  }
  const f = Math.max(0, p.floor + d), P = planOf(w.city, p.inside, f);
  if (P && cellAt(P, p.x, p.y)) { p.floor = f; p.z = f * FLOOR_H; }
}

/** The lift car the player stands in: the number of floors it serves, or 0 when not in one. */
export function liftFloors(w: World): number {
  const p = w.player;
  if (p.inside < 0) return 0;
  const P = planOf(w.city, p.inside, p.floor), c = P ? cellAt(P, p.x, p.y) & ROOM : 0;
  if (!c || P!.rooms[c - 1].kind !== 'lift') return 0;
  let n = p.floor + 1;
  for (;;) { const Q = planOf(w.city, p.inside, n), q = Q ? cellAt(Q, p.x, p.y) & ROOM : 0; if (!q || Q!.rooms[q - 1].kind !== 'lift') return n; n++; }
}

/** Press a floor on the car's panel: it rides there (true), or the floor does not exist (false). */
export function callLift(w: World, f: number): boolean {
  const n = liftFloors(w), p = w.player;
  if (!n || f < 0 || f >= n || f === (p.liftTo >= 0 ? p.liftTo : p.floor)) return false;
  p.liftTo = f;
  return true;
}

/** Lift speed in m/s, with a gentle start and stop. */
const LIFT_V = 6;
function stepLift(p: Player) {
  const goal = p.liftTo * FLOOR_H, d = goal - p.z;
  p.z += Math.sign(d) * Math.min(Math.abs(d), Math.min(LIFT_V, 0.8 + Math.abs(d) * 2.2) * TICK);
  // the storey whose plan surrounds the car
  p.floor = Math.round(p.z / FLOOR_H);
  if (Math.abs(goal - p.z) < 1e-3) { p.z = goal; p.floor = p.liftTo; p.liftTo = -1; }
}

export { doorKey } from './doors';

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
  // seated, nobody walks (walking stands the player up first, main.ts)
  let f = p.sit ? 0 : input.forward, st = p.sit ? 0 : input.strafe;
  const len = Math.hypot(f, st);
  if (len > 1) { f /= len; st /= len; }
  // running spends breath, and a hungry stomach gives less of it (needs.ts)
  // crouching: down in a moment, slow steps, no running (14.8)
  const down = !!input.crouch && !p.sit && p.liftTo < 0;
  p.crouch = (p.crouch ?? 0) + ((down ? 1 : 0) - (p.crouch ?? 0)) * Math.min(1, TICK * 10);
  const low = (p.crouch ?? 0) > 0.5;
  const run = stepNeeds(w, input.run && !low && (f !== 0 || st !== 0) && p.liftTo < 0, TICK, TICK * TIME_SCALE) && input.run && !low;
  const sp = p.liftTo >= 0 ? 0 : run ? 9 : low ? 1.6 : 3.5; // a moving car holds the player still
  // a jump: up from the ground, back down by gravity
  if (input.jump && !p.hop && !p.hopV && !p.sit && !low && p.liftTo < 0) p.hopV = 3;
  if (p.hopV || p.hop) {
    p.hop = (p.hop ?? 0) + (p.hopV ?? 0) * TICK; p.hopV = (p.hopV ?? 0) - 9.8 * TICK;
    if (p.hop <= 0) { p.hop = 0; p.hopV = 0; }
  }
  if (p.liftTo >= 0) stepLift(p);
  const dx = Math.cos(input.heading), dy = Math.sin(input.heading);
  const vx = (dx * f - dy * st) * sp, vy = (dy * f + dx * st) * sp;
  p.speed = Math.hypot(vx, vy);
  const R = 0.3;
  const nx = p.x + vx * TICK;
  // probes ahead of the player on both shoulders; walls, doorways and the street door are in interior.ts
  // and the substations' fenced yards (the fence is 0.6 m in from the lot's edge)
  const yard = (x: number, y: number) => p.z < 2.6 && w.power.subs.some((S) => S.yard && x > S.yard.x0 + 0.55 && x < S.yard.x1 - 0.55 && y > S.yard.y0 + 0.55 && y < S.yard.y1 - 0.55);
  // the doors stop the way while shut (they open by hand, doors.ts)
  const open = (k: number, n: number) => streetOpen(w, k, n);
  // and the lift's doors are shut on this floor while its car is elsewhere (lifts.ts)
  const liftShut = (x: number, y: number) => p.liftTo < 0 && inLift(w, x, y) && !inLift(w, p.x, p.y) && !carHere(w, p.inside, p.floor);
  // and the stairs: no step up or down higher than a riser or two (a flight is entered at its ends; its rail and underside stop the rest)
  const steep = (x: number, y: number) => p.inside >= 0 && p.liftTo < 0 && Math.abs(feetZ(w.city, p.inside, x, y, p.z) - p.z) > STEP_UP;
  // the walls are those of the storey nearest the feet: at the top of a flight (feet a few centimetres under the next
  // floor) the walls around are the next floor's, not those of the one below
  const near = Math.round(p.z / FLOOR_H);
  const hit = (x: number, y: number) => blocked(w.city, near, p.x, p.y, x, y, open) || leafBlocks(w, p.x, p.y, x, y) || liftShut(x, y) || yard(x, y) || steep(x, y);
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
  // indoors the feet follow the floor, or the stair's steps; the storey is the one the feet are in
  else if (p.inside >= 0 && p.liftTo < 0 && (p.x !== p.px || p.y !== p.py)) { p.z = feetZ(w.city, p.inside, p.x, p.y, p.z); p.floor = Math.floor((p.z + 0.01) / FLOOR_H); }
  stepBag(w);
  stepDoors(w, TICK);
  stepLifts(w, TICK);

  const hour = (w.time / 3600) % 24;
  stepPeds(w.city, w.power, w.pop, w.peds, w.cars, w.rng, TICK, w.tick, w.time, p.x, p.y, Math.cos(input.heading), Math.sin(input.heading));
  stepCars(w.city, w.power, w.cars, w.rng, TICK, w.tick, p.x, p.y, roadGrip(w.weather.wet, w.weather.snowCover), hour < 5, crossers);
  // the streets fill up and empty with the hour, out of the player's sight
  if (w.tick % 30 === 0) {
    const want = carsWanted(w.time), cs = w.cars;
    if (cs.length > want) {
      for (let n = 0, k = cs.length - 1; k >= 0 && n < TURNOVER && cs.length > want; k--) {
        const c = cs[k];
        if (c.turn || c.wreck || Math.hypot(c.x - p.x, c.y - p.y) < HIDE_R) continue;
        cs.splice(k, 1); n++;
      }
    } else if (cs.length < want) {
      for (const c of spawnCars(w.city, w.rng, Math.min(TURNOVER, want - cs.length) + (w.tick % 300 === 0 ? 4 : 0), cs, { x: p.x, y: p.y, r: HIDE_R })) cs.push(c);
    }
  }
  for (const k of crashes) {
    const i = nearestRoad(w.city.xb, w.city.xCell, k.x), j = nearestRoad(w.city.yb, w.city.yCell, k.y);
    logEvent(w.events, 'crash', w.tick, w.time, k.x, k.y, Math.min(1, k.v / 15), [i, j]);
  }
  // every 10 s, a queue longer than a red light makes is a jam (logged again only after 5 min)
  if (w.tick % 600 === 599) queues(w.city, w.cars, (i, j, hd, n) => {
    if (n < JAM_CARS) return;
    const refs = [i, j, hd], last = lastEvent(w.events, 'jam', refs);
    if (last && w.tick - last.tick < JAM_AGAIN) return;
    logEvent(w.events, 'jam', w.tick, w.time, (w.city.xb[2 * i] + w.city.xb[2 * i + 1]) / 2, (w.city.yb[2 * j] + w.city.yb[2 * j + 1]) / 2, Math.min(1, n / 15), refs);
  });
  // the social network, every real second (30 game seconds)
  if (w.tick % 60 === 30) stepSocial(w.feed, w.pop, w.city, w.events, w.power, w.weather, w.seed, w.time, 60 * TICK * TIME_SCALE);
  // a substation left dark comes back by itself: the utility's crews take 2 to 4 game hours
  if (w.tick % 60 === 45) w.power.subs.forEach((s, k) => {
    if (s.on) { s.offAt = -1; return; }
    if (s.offAt < 0) { s.offAt = w.time; return; }
    if (w.time - s.offAt < (RESTORE_H + RESTORE_H * hash3(w.seed, k, Math.floor(s.offAt))) * 3600) return;
    switchSub(w.power, k, true, w.tick, s.x, s.y);
    logEvent(w.events, 'restored', w.tick, w.time, s.x, s.y, 0.8, [k]);
  });
  stepJobs(w); // [HACKING] the fixer's jobs resolve against the real grid (and the trace against the cell log)
  stepHeat(w, TICK); // [HACKING] heat cools off, traces go cold, the police close in
  w.ptime = w.time;
  w.time += TICK * TIME_SCALE;
  stepWeather(w.weather, w.seed, w.time, TICK * TIME_SCALE);
  w.tick++;
}
