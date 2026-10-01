import { hash3, type Rng } from '../core/rng';
import { districtAt, LANE_W, lanesOf, roadCenter, type City, type Diagonal, type RGB } from './city';
import { subAt, type PowerGrid } from './power';

/**
 * Traffic. Cars keep to their lanes on the two-way grid (right-hand traffic), follow the car ahead
 * (the intelligent driver model), and at each intersection go straight or turn along a smooth
 * curve, from the inner lane to the left and the outer lane to the right. Intersections have
 * traffic lights, or stop signs on quiet corners: the lights run on the power grid, and a dark
 * one is an all-way stop, first come first served. Signal timing is a pure function of the
 * intersection and the real-time clock (the tick), so the renderer and later the hacking read
 * the same state. Cars also run both ways along the diagonal avenue, edge to edge; where it
 * crosses a grid road there are lights too (see Zone).
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
  /** Tick it came to a halt at an all-way stop, or -1, and that stop's key (see gateOf). */
  arrive: number;
  gate: number;
  /** On the diagonal avenue: 1 or -1 along its direction (0 on the grid), and how far along it is. */
  dg: number;
  u: number;
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
/** Cycle where the diagonal crosses an intersection (three phases) or a road between two (two phases, the diagonal's longer). */
const CYCLE3 = 75, CYCLE_Z = 60;

const wideX = (city: City, i: number) => city.xb[2 * i + 1] - city.xb[2 * i] > 22;
const wideY = (city: City, j: number) => city.yb[2 * j + 1] - city.yb[2 * j] > 15;

/** Whether intersection (i, j) has lights (else stop signs): quiet corners away from downtown and wide roads do not. */
export function hasSignal(city: City, i: number, j: number): boolean {
  if (touched(city, i, j)) return true;
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
  if (touched(city, i, j)) {
    // the diagonal runs through it: three phases, the avenue, the street, the diagonal
    const p = (((sec + hash3(city.nameSeed, i, j) * 20) % CYCLE3) + CYCLE3) % CYCLE3, ph = CYCLE3 / 3, k = Math.floor(p / ph), q = p - k * ph;
    const mine = axis === 1 ? 0 : axis === 0 ? 1 : 2;
    return k !== mine ? Sig.Red : q < ph - YELLOW - ALL_RED ? Sig.Green : q < ph - ALL_RED ? Sig.Yellow : Sig.Red;
  }
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

// ---- the diagonal

/**
 * Where the diagonal avenue crosses a grid road: the stretch of that road it covers (a0..a1, in x
 * on a street, in y on an avenue) and of the diagonal the road covers (u0..u1). Next to a grid
 * intersection (i, j) it is part of it (three-phase lights); between two it has lights of its own.
 * `key` is the stop's identity for all-way stops (the intersection's when merged).
 */
export interface Zone { vert: boolean; road: number; a0: number; a1: number; u0: number; u1: number; i: number; j: number; key: number }

/** The diagonal's extent inside the city (u along it), its lanes per side, its zones (by u, and by grid road). */
export interface DiagRoad { u0: number; u1: number; lanes: number; zones: Zone[]; byRoad: Map<number, Zone[]>; touched: Set<number> }
const diagRoads = new WeakMap<City, DiagRoad>();
const ZKEY = 1 << 22;
/** A zone within this of a grid intersection's box joins it; a longer one is a shared stretch. */
const MERGE = 8, SHARED = 45;
const roadKey = (vert: boolean, k: number) => (vert ? 1024 : 0) + k;

export function diagRoad(city: City): DiagRoad {
  let D = diagRoads.get(city);
  if (D) return D;
  const d = city.diagonal, hw = d.w / 2;
  // the line inside the city, a little in from the edges
  let u0 = -1e9, u1 = 1e9;
  for (const [o, e, lim] of [[d.ox, d.ex, city.w], [d.oy, d.ey, city.h]]) {
    if (Math.abs(e) < 1e-9) continue;
    const a = (6 - o) / e, b = (lim - 6 - o) / e;
    u0 = Math.max(u0, Math.min(a, b)); u1 = Math.min(u1, Math.max(a, b));
  }
  const zones: Zone[] = [], byRoad = new Map<number, Zone[]>(), tset = new Set<number>();
  const NX = NXof(city), NY = NYof(city);
  for (const vert of [true, false]) {
    const b = vert ? city.xb : city.yb, n = vert ? NX : NY;
    // across the road (q) and along it (a): q = oq + u eq + s nq, and s = (q - oq) nq + (a - oa) na
    const eq = vert ? d.ex : d.ey, nq = vert ? d.nx : d.ny, oq = vert ? d.ox : d.oy, oa = vert ? d.oy : d.ox, na = vert ? d.ny : d.nx;
    if (Math.abs(eq) < 1e-6 || Math.abs(na) < 1e-6) continue;
    for (let k = 0; k < n; k++) {
      const ua: number[] = [], aa: number[] = [];
      for (const q of [b[2 * k], b[2 * k + 1]]) for (const sv of [-hw, hw]) {
        ua.push((q - oq - sv * nq) / eq);
        aa.push(oa + (sv - (q - oq) * nq) / na);
      }
      const z: Zone = { vert, road: k, a0: Math.min(...aa), a1: Math.max(...aa), u0: Math.min(...ua), u1: Math.max(...ua), i: -1, j: -1, key: 0 };
      if (z.u1 < u0 || z.u0 > u1) continue;
      // where it runs along an avenue at a shallow angle the two share the pavement for a long
      // stretch: no crossing of their own there, the cross streets' lights rule it
      if (z.a1 - z.a0 > SHARED) continue;
      // next to an intersection on this road?
      const cb = vert ? city.yb : city.xb, m = vert ? NY : NX;
      for (let c = 0; c < m; c++) if (z.a1 > cb[2 * c] - MERGE && z.a0 < cb[2 * c + 1] + MERGE) { z.i = vert ? k : c; z.j = vert ? c : k; }
      z.key = z.i >= 0 ? iKey(z.i, z.j) : ZKEY + zones.length;
      if (z.i >= 0) tset.add(iKey(z.i, z.j));
      zones.push(z);
      byRoad.set(roadKey(vert, k), [...(byRoad.get(roadKey(vert, k)) ?? []), z]);
    }
  }
  zones.sort((p, q) => p.u0 - q.u0);
  D = { u0, u1, lanes: Math.max(1, Math.floor(hw / LANE_W)), zones, byRoad, touched: tset };
  diagRoads.set(city, D);
  return D;
}

const touched = (city: City, i: number, j: number) => diagRoad(city).touched.has(iKey(i, j));

/** The light at a zone, for the diagonal (diag) or for the grid road. */
export function zoneSignal(city: City, power: PowerGrid, z: Zone, diag: boolean, sec: number): number {
  if (z.i >= 0) return signal(city, power, z.i, z.j, diag ? 2 : z.vert ? 1 : 0, sec);
  const d = city.diagonal, u = (z.u0 + z.u1) / 2;
  if (!power.subs[subAt(power, city, d.ox + d.ex * u, d.oy + d.ey * u)].on) return Sig.Dark;
  const p = (((sec + hash3(city.nameSeed, z.key, 77) * CYCLE_Z) % CYCLE_Z) + CYCLE_Z) % CYCLE_Z;
  const gD = CYCLE_Z * 0.55 - YELLOW - ALL_RED, gR = CYCLE_Z * 0.45 - YELLOW - ALL_RED;
  const a = p < gD ? Sig.Green : p < gD + YELLOW ? Sig.Yellow : Sig.Red;
  const q = p - gD - YELLOW - ALL_RED;
  const b = q >= 0 && q < gR ? Sig.Green : q >= gR && q < gR + YELLOW ? Sig.Yellow : Sig.Red;
  return diag ? a : b;
}

/** Point of the diagonal at u, `off` to the right of travel direction dg. */
export function diagPoint(d: Diagonal, u: number, dg: number, off: number, out: number[]) {
  out[0] = d.ox + d.ex * u - d.ey * dg * off;
  out[1] = d.oy + d.ey * u + d.ex * dg * off;
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
    cars.push({ x, y, px: x, py: y, dx, dy, v: 0, max: 8 + rng() * 6, taxi, col, hd, road, lane, ni, nj, plan, turn: false, t0x: 0, t0y: 0, tcx: 0, tcy: 0, t1x: 0, t1y: 0, tlen: 1, ts: 0, arrive: -1, gate: -1, dg: 0, u: 0 });
    k++;
  }
  // and some on the diagonal, both ways, between its crossings
  const D = diagRoad(city), d = city.diagonal, Q = [0, 0];
  for (let k = 0, tries = 0; k < Math.round(count * 0.12) && tries < count * 4; tries++) {
    const dg = rng() < 0.5 ? 1 : -1, u = D.u0 + 10 + rng() * (D.u1 - D.u0 - 20), lane = (rng() * D.lanes) | 0;
    if (D.zones.some((z) => u > z.u0 - 6 && u < z.u1 + 6)) continue;
    if (cars.some((c) => c.dg === dg && c.lane === lane && Math.abs(c.u - u) < 8)) continue;
    diagPoint(d, u, dg, LANE_W * (lane + 0.5), Q);
    const taxi = rng() < 0.22, col: RGB = taxi ? [255, 200, 40] : CAR_COLS[(rng() * CAR_COLS.length) | 0];
    cars.push({ x: Q[0], y: Q[1], px: Q[0], py: Q[1], dx: d.ex * dg, dy: d.ey * dg, v: 0, max: 9 + rng() * 6, taxi, col, hd: 0, road: 0, lane, ni: 0, nj: 0, plan: 0, turn: false, t0x: 0, t0y: 0, tcx: 0, tcy: 0, t1x: 0, t1y: 0, tlen: 1, ts: 0, arrive: -1, gate: -1, dg, u });
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
  const D = diagRoad(city), dgn = city.diagonal;
  const inc = (k: number) => busy.set(k, (busy.get(k) ?? 0) + 1);
  for (const c of cars) {
    if (c.dg) {
      // on the diagonal: a lane each way, and in a crossing while inside one
      bucket(c.dg > 0 ? 4 : 5, 0, c.lane).push({ c, s: c.u * c.dg });
      for (const z of D.zones) if (c.u > z.u0 && c.u < z.u1) inc(z.key);
      continue;
    }
    if (!c.turn) {
      const s = along(c.hd, c.x, c.y);
      bucket(c.hd, c.road, c.lane).push({ c, s });
      const zs = D.byRoad.get(roadKey((c.hd & 1) === 1, c.road));
      if (zs) for (const z of zs) { const a = c.hd & 1 ? c.y : c.x; if (a > z.a0 && a < z.a1) inc(z.key); }
      continue;
    }
    const to = headingOfExit(c);
    inc(iKey(c.ni, c.nj));
    bucket(to, c.road, c.lane).push({ c, s: along(to, c.t1x, c.t1y) - (1 - c.ts) * c.tlen });
  }
  for (const b of lanes.values()) b.sort((p, q) => p.s - q.s);
  // the earliest arrival at each all-way stop goes first
  firstWait.clear();
  for (const c of cars) if (c.arrive >= 0) { const f = firstWait.get(c.gate); if (f === undefined || c.arrive < f) firstWait.set(c.gate, c.arrive); }

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
      const s = c.dg ? c.u * c.dg : along(c.hd, c.x, c.y), b = c.dg ? bucket(c.dg > 0 ? 4 : 5, 0, c.lane) : bucket(c.hd, c.road, c.lane);
      let lead: { c: Car; s: number } | null = null;
      for (const q of b) if (q.c !== c && q.s > s) { lead = q; obstacle(q.s - s - CAR_L, q.c.v); break; }
      const front = s + CAR_L / 2;
      // slow down ahead of a turn
      if (!c.dg && c.plan !== c.hd) v0 = Math.min(v0, Math.sqrt(TURN_V * TURN_V + 2 * 1.5 * Math.max(0, entryS(city, c.hd, c.ni, c.nj) - front)));
      // the next stop line: a red light, a stop sign or a full lane beyond is an obstacle there (the jam gap behind it)
      gateOf(city, power, c, front, sec);
      if (c.arrive >= 0 && c.gate !== G.key) c.arrive = -1; // past the stop it was waiting at
      const dStop = G.start - STOP_BACK - front;
      if (dStop > -0.5 && dStop < 60 && !mayGo(city, c, dStop, tick, lead)) obstacle(dStop + GAP0, 0);
      else if (dStop < -0.5 && c.arrive >= 0 && c.gate === G.key) c.arrive = -1;
      // halted at an all-way stop: note when
      if (c.v < 0.2 && c.arrive < 0 && (G.sig === Sig.Dark || G.sig === Sig.Stop) && dStop < 2.5 && dStop > -1) { c.arrive = tick; c.gate = G.key; }
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

    // move
    const d = c.v * dt;
    if (c.dg) {
      c.u += c.dg * d;
      // at the end of the avenue, back the other way (at the city's edge, by the fence)
      if (c.u > D.u1 || c.u < D.u0) { c.dg = -c.dg; c.u = Math.max(D.u0, Math.min(D.u1, c.u)); c.v = 0; c.arrive = -1; }
      diagPoint(dgn, c.u, c.dg, LANE_W * (c.lane + 0.5), P);
      c.x = P[0]; c.y = P[1]; c.dx = dgn.ex * c.dg; c.dy = dgn.ey * c.dg;
      if (c.u === D.u0 || c.u === D.u1) { c.px = c.x; c.py = c.y; } // a turnaround, not a glide across
    } else if (c.turn) {
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

/**
 * The next stop line ahead of a car, into G: the intersection it heads to (its line moved back
 * when the diagonal crosses just before it), or a crossing of the diagonal on the way there; for a
 * car on the diagonal, the next crossing. `start` is where it begins along the car's way.
 */
const G = { start: 0, end: 0, key: 0, sig: 0, inter: false };
function gateOf(city: City, power: PowerGrid, c: Car, front: number, sec: number) {
  const D = diagRoad(city);
  if (c.dg) {
    G.start = 1e9; G.inter = false;
    for (const z of D.zones) {
      const zs = c.dg > 0 ? z.u0 : -z.u1;
      if (zs - STOP_BACK - front > -0.5 && zs < G.start) { G.start = zs; G.end = c.dg > 0 ? z.u1 : -z.u0; G.key = z.key; G.sig = zoneSignal(city, power, z, true, sec); }
    }
    return;
  }
  const e = entryS(city, c.hd, c.ni, c.nj), pos = c.dx + c.dy > 0;
  G.start = e; G.end = exitS(city, c.hd, c.ni, c.nj); G.key = iKey(c.ni, c.nj); G.inter = true;
  G.sig = signal(city, power, c.ni, c.nj, c.hd & 1, sec);
  const zs = D.byRoad.get(roadKey((c.hd & 1) === 1, c.road));
  if (zs) for (const z of zs) {
    const a = pos ? z.a0 : -z.a1, b = pos ? z.a1 : -z.a0;
    if (z.i === c.ni && z.j === c.nj) { if (a < G.start) G.start = a; }
    // (a crossing that belongs to another intersection runs on that one's phases: not a stop of its own)
    else if (z.i < 0 && a - STOP_BACK - front > -0.5 && a < G.start) { G.start = a; G.end = b; G.key = z.key; G.inter = false; G.sig = zoneSignal(city, power, z, false, sec); }
  }
}

/** Whether a car dStop metres from its stop line (G) may go on. */
function mayGo(city: City, c: Car, dStop: number, tick: number, lead: { c: Car; s: number } | null): boolean {
  const sg = G.sig;
  if (sg === Sig.Red) return false;
  if (sg === Sig.Yellow && dStop > (c.v * c.v) / (2 * 3.5) + 1) return false; // can stop in time: stop
  // not into a full lane on the far side (no blocking the box)
  if (G.inter ? !exitClear(city, c) : lead && lead.c.v < 2 && lead.s - G.end < CAR_L + 2) return false;
  if (sg === Sig.Dark || sg === Sig.Stop) {
    // an all-way stop: halt, then go in order of arrival, one at a time
    if (c.arrive < 0 || c.gate !== G.key || tick - c.arrive < 50) return false;
    if (busy.get(G.key)) return false;
    return firstWait.get(G.key) === c.arrive;
  }
  // a left turn on green yields to oncoming traffic
  if (G.inter && turnOf(c.hd, c.plan) < 0 && oncoming(city, c)) return false;
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
    if (c.dg || c.turn || c.v > 1) continue;
    if (entryS(city, c.hd, c.ni, c.nj) - along(c.hd, c.x, c.y) > 80) continue;
    const k = iKey(c.ni, c.nj) * 4 + c.hd;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  for (const [k, n] of count) cb(Math.floor(k / 4 / 1024), (k >> 2) % 1024, k & 3, n);
}
