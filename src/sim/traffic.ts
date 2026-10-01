import { hash3, type Rng } from '../core/rng';
import { districtAt, LANE_W, lanesOf, roadCenter, type City, type RGB } from './city';
import { subAt, type PowerGrid } from './power';

/**
 * Traffic. Cars keep to their lanes on the two-way grid (right-hand traffic), follow the car ahead
 * (the intelligent driver model), and at each intersection go straight or turn along a smooth
 * curve, from the inner lane to the left and the outer lane to the right. Intersections have
 * traffic lights, or stop signs on quiet corners: the lights run on the power grid, and a dark
 * one is an all-way stop, first come first served. Signal timing is a pure function of the
 * intersection and the real-time clock (the tick), so the renderer and later the hacking read
 * the same state.
 */
export interface Car {
  x: number;
  y: number;
  /** Position at the previous tick, for render interpolation. */
  px: number;
  py: number;
  /** Heading (unit vector): along the road, or the curve's tangent while turning. */
  dx: number;
  dy: number;
  v: number;
  max: number;
  taxi: boolean;
  col: RGB;
  /** Road direction (index into DIRS), the road it is on, its lane counted from the center (0 = innermost). */
  hd: number;
  road: number;
  lane: number;
  /** Intersection it is heading to (or crossing): vertical road ni crossing horizontal road nj. */
  ni: number;
  nj: number;
  /** Direction it leaves that intersection by (index into DIRS). */
  plan: number;
  /** Crossing the intersection: the curve (quadratic, from p0 by control c to p1), its length and progress 0..1. */
  turn: boolean;
  t0x: number; t0y: number; tcx: number; tcy: number; t1x: number; t1y: number; tlen: number; ts: number;
  /** Tick it came to a halt at an all-way stop, or -1. */
  arrive: number;
}

/** E, S, W, N as (dx, dy). */
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const CAR_COLS: RGB[] = [[180, 40, 40], [40, 90, 170], [200, 200, 210], [40, 40, 48], [60, 140, 90], [150, 90, 40], [120, 60, 150]];
const CAR_L = 4.5;
/** The stop line, this far before the intersection (behind the crosswalk). */
export const STOP_BACK = 5;
/** Driver model: max acceleration, comfortable braking, jam gap, time headway. */
const ACC = 2, BRAKE = 3, GAP0 = 2, HEADWAY = 1.2;
/** Speed through a turn. */
const TURN_V = 5.5;

/** Offset from the road center to the middle of a lane; drives on the right. */
export function laneOff(hd: number, lane: number): [number, number] {
  const [dx, dy] = DIRS[hd], o = LANE_W * (lane + 0.5);
  return [-dy * o, dx * o];
}

// ---- signals

export const Sig = { Green: 0, Yellow: 1, Red: 2, Dark: 3, Stop: 4 } as const;
/** Cycle length (real seconds), yellow and all-red clearance. */
export const CYCLE = 64, YELLOW = 3.5, ALL_RED = 2;

const wideX = (city: City, i: number) => city.xb[2 * i + 1] - city.xb[2 * i] > 22;
const wideY = (city: City, j: number) => city.yb[2 * j + 1] - city.yb[2 * j] > 15;

/** Whether intersection (i, j) has lights (else stop signs): quiet corners away from downtown and wide roads do not. */
export function hasSignal(city: City, i: number, j: number): boolean {
  let t = signalled.get(city);
  if (!t) {
    const NX = NXof(city), NY = NYof(city);
    t = new Uint8Array(NX * NY);
    for (let jj = 0; jj < NY; jj++) for (let ii = 0; ii < NX; ii++) {
      const type = city.districts[districtAt(city, roadCenter(city.xb, ii), roadCenter(city.yb, jj))].type;
      t[jj * NX + ii] = wideX(city, ii) || wideY(city, jj) || (type !== 'residential' && type !== 'industrial') || hash3(city.nameSeed, ii * 7 + 3, jj * 13 + 5) < 0.45 ? 1 : 0;
    }
    signalled.set(city, t);
  }
  return t[j * NXof(city) + i] === 1;
}
const signalled = new WeakMap<City, Uint8Array>();

/**
 * The light facing traffic along an axis (0 = moving along x, on the horizontal road; 1 = along
 * y, on the avenue) at intersection (i, j), at real time `sec`. The avenue gets the longer green;
 * offsets make a green wave up the avenues.
 */
export function signal(city: City, power: PowerGrid, i: number, j: number, axis: number, sec: number): number {
  if (!hasSignal(city, i, j)) return Sig.Stop;
  const x = roadCenter(city.xb, i), y = roadCenter(city.yb, j);
  if (!power.subs[subAt(power, city, x, y)].on) return Sig.Dark;
  const off = y / 11 + hash3(city.nameSeed, i, j) * 6;
  const p = (((sec + off) % CYCLE) + CYCLE) % CYCLE;
  const gA = Math.round(CYCLE * (wideX(city, i) ? 0.58 : 0.5)) - YELLOW - ALL_RED; // the avenue's green
  const a = p < gA ? Sig.Green : p < gA + YELLOW ? Sig.Yellow : Sig.Red;
  const q = p - gA - YELLOW - ALL_RED, gS = CYCLE - gA - 2 * (YELLOW + ALL_RED);
  const s = q >= 0 && q < gS ? Sig.Green : q >= gS && q < gS + YELLOW ? Sig.Yellow : Sig.Red;
  return axis === 1 ? a : s;
}

// ---- geometry

/** The box of intersection (i, j). */
const box = (city: City, i: number, j: number) => [city.xb[2 * i], city.xb[2 * i + 1], city.yb[2 * j], city.yb[2 * j + 1]] as const;
const NXof = (city: City) => city.xb.length / 2, NYof = (city: City) => city.yb.length / 2;
/** Signed distance along heading hd of a point (x, y). */
const along = (hd: number, x: number, y: number) => DIRS[hd][0] * x + DIRS[hd][1] * y;
/** Along-coordinate where a car heading hd enters / leaves intersection (i, j). */
function entryS(city: City, hd: number, i: number, j: number) {
  const [x0, x1, y0, y1] = box(city, i, j);
  return hd === 0 ? x0 : hd === 1 ? y0 : hd === 2 ? -x1 : -y1;
}
function exitS(city: City, hd: number, i: number, j: number) {
  const [x0, x1, y0, y1] = box(city, i, j);
  return hd === 0 ? x1 : hd === 1 ? y1 : hd === 2 ? -x0 : -y0;
}
/** Road a heading runs on at intersection (i, j): horizontal j for E/W, vertical i for N/S. */
const roadOf = (hd: number, i: number, j: number) => (hd & 1 ? i : j);
const lanesFor = (city: City, hd: number, road: number) => Math.max(1, lanesOf(hd & 1 ? city.xb : city.yb, road));

/** A turn: 0 straight, 1 right, -1 left (right-hand traffic: E then S is a right turn, y grows south). */
const turnOf = (from: number, to: number) => (to === from ? 0 : to === ((from + 1) & 3) ? 1 : -1);

/** Pick where a car heading hd leaves intersection (i, j): straight twice as likely, never back or off the map. */
function choosePlan(city: City, rng: Rng, hd: number, i: number, j: number): number {
  const opts: number[] = [];
  for (let d = 0; d < 4; d++) {
    if (d === ((hd + 2) & 3)) continue;
    const ni = i + DIRS[d][0], nj = j + DIRS[d][1];
    if (ni < 0 || nj < 0 || ni >= NXof(city) || nj >= NYof(city)) continue;
    opts.push(d);
    if (d === hd) opts.push(d);
  }
  return opts.length ? opts[(rng() * opts.length) | 0] : (hd + 2) & 3;
}

/** The lane to be in for a turn: the inner one to turn left, the outer to turn right, any to go straight. */
function laneFor(rng: Rng, lanes: number, turn: number): number {
  return turn < 0 ? 0 : turn > 0 ? lanes - 1 : (rng() * lanes) | 0;
}

// ---- spawning

export function spawnCars(city: City, rng: Rng, count: number): Car[] {
  const cars: Car[] = [];
  const NX = NXof(city), NY = NYof(city);
  for (let k = 0, tries = 0; k < count && tries < count * 20; tries++) {
    const hd = (rng() * 4) | 0, [dx, dy] = DIRS[hd];
    // a road and the segment between two of its intersections
    const road = (rng() * (hd & 1 ? NX : NY)) | 0, n = hd & 1 ? NY : NX;
    const seg = (rng() * (n - 1)) | 0, next = dx + dy > 0 ? seg + 1 : seg;
    const ni = hd & 1 ? road : next, nj = hd & 1 ? next : road;
    const pi = ni - dx, pj = nj - dy;
    const a0 = exitS(city, hd, pi, pj), a1 = entryS(city, hd, ni, nj) - STOP_BACK - CAR_L;
    if (a1 - a0 < 6) continue;
    const s = a0 + 3 + rng() * (a1 - a0 - 3);
    const plan = choosePlan(city, rng, hd, ni, nj), lane = laneFor(rng, lanesFor(city, hd, road), turnOf(hd, plan));
    const [ox, oy] = laneOff(hd, lane);
    const x = hd & 1 ? roadCenter(city.xb, road) + ox : s * dx + ox;
    const y = hd & 1 ? s * dy + oy : roadCenter(city.yb, road) + oy;
    // not on top of another car
    if (cars.some((c) => Math.abs(c.x - x) < 8 && Math.abs(c.y - y) < 2)) continue;
    const taxi = rng() < 0.22;
    const col: RGB = taxi ? [255, 200, 40] : CAR_COLS[(rng() * CAR_COLS.length) | 0];
    cars.push({ x, y, px: x, py: y, dx, dy, v: 0, max: 8 + rng() * 6, taxi, col, hd, road, lane, ni, nj, plan, turn: false, t0x: 0, t0y: 0, tcx: 0, tcy: 0, t1x: 0, t1y: 0, tlen: 1, ts: 0, arrive: -1 });
    k++;
  }
  return cars;
}

// ---- stepping

/** Cars by lane, sorted by how far along they are: key = (heading, road, lane). */
const lanes = new Map<number, { c: Car; s: number }[]>();
const laneKey = (hd: number, road: number, lane: number) => (hd * 1024 + road) * 8 + lane;
/** Cars inside each intersection right now, and the earliest arrival waiting at each all-way stop. */
const busy = new Map<number, number>();
const firstWait = new Map<number, number>();
const iKey = (i: number, j: number) => i * 1024 + j;

function bucket(hd: number, road: number, lane: number) {
  const k = laneKey(hd, road, lane);
  let b = lanes.get(k);
  if (!b) { b = []; lanes.set(k, b); }
  return b;
}

/** Point and tangent of a car's curve at progress s. */
function curveAt(c: Car, s: number, out: number[]) {
  const u = 1 - s;
  out[0] = u * u * c.t0x + 2 * u * s * c.tcx + s * s * c.t1x;
  out[1] = u * u * c.t0y + 2 * u * s * c.tcy + s * s * c.t1y;
  const tx = 2 * u * (c.tcx - c.t0x) + 2 * s * (c.t1x - c.tcx), ty = 2 * u * (c.tcy - c.t0y) + 2 * s * (c.t1y - c.tcy), L = Math.hypot(tx, ty) || 1;
  out[2] = tx / L; out[3] = ty / L;
}
const P = [0, 0, 0, 0];

/** Start crossing intersection (ni, nj) along its plan, into the lane its next turn needs. */
function startTurn(city: City, rng: Rng, c: Car) {
  const to = c.plan, [ex, ey] = DIRS[to];
  const road = roadOf(to, c.ni, c.nj), oi = c.ni + ex, oj = c.nj + ey;
  let next = choosePlan(city, rng, to, oi, oj), lane = Math.min(laneFor(rng, lanesFor(city, to, road), turnOf(to, next)), lanesFor(city, to, road) - 1);
  if (!laneFree(city, to, road, lane, c.ni, c.nj)) {
    // the lane it wanted is backed up: take one with room, and go on straight from it if it can
    for (let l = 0; l < lanesFor(city, to, road); l++) if (laneFree(city, to, road, l, c.ni, c.nj)) { lane = l; break; }
    const oi2 = oi + DIRS[to][0], oj2 = oj + DIRS[to][1];
    if (oi2 >= 0 && oj2 >= 0 && oi2 < NXof(city) && oj2 < NYof(city)) next = to;
  }
  const [x0, x1, y0, y1] = box(city, c.ni, c.nj);
  const [ox, oy] = laneOff(to, lane);
  c.t0x = c.x; c.t0y = c.y;
  c.t1x = to & 1 ? roadCenter(city.xb, road) + ox : ex > 0 ? x1 : x0;
  c.t1y = to & 1 ? (ey > 0 ? y1 : y0) : roadCenter(city.yb, road) + oy;
  if (to === c.hd) { c.tcx = (c.t0x + c.t1x) / 2; c.tcy = (c.t0y + c.t1y) / 2; }
  else { c.tcx = c.hd & 1 ? c.t0x : c.t1x; c.tcy = c.hd & 1 ? c.t1y : c.t0y; } // where the two lane lines cross
  // length of the curve, from a few chords
  let L = 0, qx = c.t0x, qy = c.t0y;
  for (let k = 1; k <= 8; k++) { curveAt(c, k / 8, P); L += Math.hypot(P[0] - qx, P[1] - qy); qx = P[0]; qy = P[1]; }
  c.tlen = Math.max(1, L); c.ts = 0; c.turn = true;
  c.road = road; c.lane = lane;
  c.arrive = -1;
  // what it will do at the next intersection, once out of this one
  c.plan = next;
}

/** Leave the intersection onto the road it turned into. */
function endTurn(c: Car) {
  c.turn = false;
  const to = headingOfExit(c);
  c.hd = to; c.dx = DIRS[to][0]; c.dy = DIRS[to][1];
  c.x = c.t1x; c.y = c.t1y;
  c.ni += c.dx; c.nj += c.dy;
}
/** The heading of a finished curve: its end tangent, snapped to the grid. */
function headingOfExit(c: Car) {
  const tx = c.t1x - c.tcx, ty = c.t1y - c.tcy;
  return Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 0 : 2) : ty > 0 ? 1 : 3;
}

/** Advance traffic one tick: follow, stop at lights and stop signs, turn, yield to the player. */
export function stepCars(city: City, power: PowerGrid, cars: Car[], rng: Rng, dt: number, tick: number, playerX: number, playerY: number) {
  const sec = tick * dt;
  // ---- who is where: lanes sorted by progress; a car crossing an intersection counts in the lane
  // it came from (for a while) and in the one it is heading into
  for (const b of lanes.values()) b.length = 0;
  busy.clear();
  for (const c of cars) {
    if (!c.turn) { bucket(c.hd, c.road, c.lane).push({ c, s: along(c.hd, c.x, c.y) }); continue; }
    const to = headingOfExit(c);
    busy.set(iKey(c.ni, c.nj), (busy.get(iKey(c.ni, c.nj)) ?? 0) + 1);
    bucket(to, c.road, c.lane).push({ c, s: along(to, c.t1x, c.t1y) - (1 - c.ts) * c.tlen });
  }
  for (const b of lanes.values()) b.sort((p, q) => p.s - q.s);
  // the earliest arrival at each all-way stop goes first
  firstWait.clear();
  for (const c of cars) if (c.arrive >= 0) { const k = iKey(c.ni, c.nj), f = firstWait.get(k); if (f === undefined || c.arrive < f) firstWait.set(k, c.arrive); }

  for (const c of cars) {
    c.px = c.x; c.py = c.y;
    let v0 = c.max, gap = 1e9, vl = 0;
    const obstacle = (g: number, v: number) => { if (g < gap) { gap = g; vl = v; } };

    if (c.turn) {
      // through the intersection at a crawl when turning
      const to = headingOfExit(c);
      if (to !== turnHeadingIn(c)) v0 = TURN_V;
      // the car ahead in the lane it is turning into: past this intersection, or crossing it
      // too (not those still waiting to come in from the far side)
      const b = bucket(to, c.road, c.lane), me = along(to, c.t1x, c.t1y) - (1 - c.ts) * c.tlen, out = along(to, c.t1x, c.t1y);
      for (const q of b) if (q.c !== c && q.s > me && (q.c.turn ? q.c.ni === c.ni && q.c.nj === c.nj : q.s > out - 0.5)) { obstacle(q.s - me - CAR_L, q.c.v); break; }
    } else {
      const s = along(c.hd, c.x, c.y), b = bucket(c.hd, c.road, c.lane);
      for (const q of b) if (q.c !== c && q.s > s) { obstacle(q.s - s - CAR_L, q.c.v); break; }
      const ent = entryS(city, c.hd, c.ni, c.nj), front = s + CAR_L / 2, dStop = ent - STOP_BACK - front;
      // slow down ahead of a turn
      if (c.plan !== c.hd) v0 = Math.min(v0, Math.sqrt(TURN_V * TURN_V + 2 * 1.5 * Math.max(0, ent - front)));
      // a red light, a stop sign or a full lane beyond: an obstacle at the line (the jam gap behind it)
      if (dStop > -0.5 && dStop < 60 && !mayGo(city, power, c, dStop, sec, tick)) obstacle(dStop + GAP0, 0);
    }

    // the player on the road: brake and wait (no running anyone over yet)
    const rx = playerX - c.x, ry = playerY - c.y, ahead = rx * c.dx + ry * c.dy, lat = Math.abs(rx * c.dy - ry * c.dx);
    if (ahead > 0 && ahead < 14 && lat < 1.6) obstacle(ahead - CAR_L / 2 - 0.5, 0);

    // intelligent driver model
    const sStar = GAP0 + Math.max(0, c.v * HEADWAY + (c.v * (c.v - vl)) / (2 * Math.sqrt(ACC * BRAKE)));
    let acc = ACC * (1 - (c.v / Math.max(0.1, v0)) ** 4) - ACC * (sStar / Math.max(0.1, gap)) ** 2;
    acc = Math.max(-9, acc);
    c.v = Math.max(0, c.v + acc * dt);
    if (gap < 0.3) c.v = Math.min(c.v, 0.5); // never into what is ahead

    // halted at an all-way stop: note when
    if (!c.turn && c.v < 0.2 && c.arrive < 0) {
      const sg = signal(city, power, c.ni, c.nj, c.hd & 1, sec);
      const dStop = entryS(city, c.hd, c.ni, c.nj) - STOP_BACK - (along(c.hd, c.x, c.y) + CAR_L / 2);
      if ((sg === Sig.Dark || sg === Sig.Stop) && dStop < 2.5 && dStop > -1) c.arrive = tick;
    }

    // move
    const d = c.v * dt;
    if (c.turn) {
      c.ts += d / c.tlen;
      if (c.ts >= 1) { const over = (c.ts - 1) * c.tlen; endTurn(c); c.x += c.dx * over; c.y += c.dy * over; }
      else { curveAt(c, c.ts, P); c.x = P[0]; c.y = P[1]; c.dx = P[2]; c.dy = P[3]; }
    } else {
      c.x += c.dx * d; c.y += c.dy * d;
      if (along(c.hd, c.x, c.y) >= entryS(city, c.hd, c.ni, c.nj)) {
        const k = iKey(c.ni, c.nj);
        busy.set(k, (busy.get(k) ?? 0) + 1); // the next in line waits for this one
        startTurn(city, rng, c);
      }
    }
  }
}

/** The heading a turning car came in with (its curve's start tangent). */
function turnHeadingIn(c: Car) {
  const tx = c.tcx - c.t0x, ty = c.tcy - c.t0y;
  if (Math.abs(tx) < 1e-6 && Math.abs(ty) < 1e-6) return headingOfExit(c);
  return Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 0 : 2) : ty > 0 ? 1 : 3;
}

/** Whether a car dStop metres from its stop line may go on into the intersection. */
function mayGo(city: City, power: PowerGrid, c: Car, dStop: number, sec: number, tick: number): boolean {
  const sg = signal(city, power, c.ni, c.nj, c.hd & 1, sec);
  if (sg === Sig.Red) return false;
  if (sg === Sig.Yellow && dStop > (c.v * c.v) / (2 * 3.5) + 1) return false; // can stop in time: stop
  // not into a full lane on the far side (no blocking the box)
  if (!exitClear(city, c)) return false;
  if (sg === Sig.Dark || sg === Sig.Stop) {
    // an all-way stop: halt, then go in order of arrival, one at a time
    if (c.arrive < 0 || tick - c.arrive < 50) return false;
    const k = iKey(c.ni, c.nj);
    if (busy.get(k)) return false;
    return firstWait.get(k) === c.arrive;
  }
  // a left turn on green yields to oncoming traffic
  if (turnOf(c.hd, c.plan) < 0 && oncoming(city, c)) return false;
  return true;
}

/** Room for this car in a lane it can leave the intersection by (it picks one with room when it goes in). */
function exitClear(city: City, c: Car): boolean {
  const to = c.plan, road = roadOf(to, c.ni, c.nj), n = lanesFor(city, to, road);
  for (let l = 0; l < n; l++) if (laneFree(city, to, road, l, c.ni, c.nj)) return true;
  return false;
}

/** No slow car in the first metres of lane l past intersection (i, j), nor one crossing into it. */
function laneFree(city: City, to: number, road: number, l: number, i: number, j: number): boolean {
  const b = lanes.get(laneKey(to, road, l)), out = exitS(city, to, i, j);
  if (b) for (const q of b) if ((q.c.turn ? q.c.ni === i && q.c.nj === j : q.s > out) && q.s < out + CAR_L + 3 && q.c.v < 2) return false;
  return true;
}

/** Oncoming cars close to or inside the intersection, going straight or right (a left turner must wait). */
function oncoming(city: City, c: Car): boolean {
  const opp = (c.hd + 2) & 3, road = roadOf(opp, c.ni, c.nj), ent = entryS(city, opp, c.ni, c.nj), n = lanesFor(city, opp, road);
  for (let l = 0; l < n; l++) {
    const b = lanes.get(laneKey(opp, road, l));
    if (b) for (const q of b) {
      if (q.c.turn || turnOf(opp, q.c.plan) < 0) continue;
      const d = ent - (q.s + CAR_L / 2);
      if (d > -1 && d < 32 && (q.c.v > 1 || d < 6)) return true;
    }
  }
  // and one already crossing toward it
  for (const [, b] of lanes) for (const q of b) if (q.c.turn && q.c.ni === c.ni && q.c.nj === c.nj && turnHeadingIn(q.c) === opp && turnOf(opp, headingOfExit(q.c)) >= 0) return true;
  return false;
}

/**
 * Queues of stopped cars, per approach: intersection (i, j) and the heading cars come in by, with
 * how many wait within 80 m of it. For the event queue to tell a jam from a red light.
 */
export function queues(city: City, cars: Car[], cb: (i: number, j: number, hd: number, n: number) => void) {
  const count = new Map<number, number>();
  for (const c of cars) {
    if (c.turn || c.v > 1) continue;
    if (entryS(city, c.hd, c.ni, c.nj) - along(c.hd, c.x, c.y) > 80) continue;
    const k = iKey(c.ni, c.nj) * 4 + c.hd;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  for (const [k, n] of count) cb(Math.floor(k / 4 / 1024), (k >> 2) % 1024, k & 3, n);
}
