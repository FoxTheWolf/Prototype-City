import { hash3, type Rng } from '../core/rng';
import { SIDEWALK, type Block, type City } from './city';
import { Doing, whereIs, type Population } from './citizens';
import { doorPoint } from './interior';
import { type PowerGrid } from './power';
import { Sig, signal, stopLike, type Car } from './traffic';

/**
 * Pedestrians: the citizens on their way somewhere near the player (see citizens.ts). Whoever's
 * day has them walking from one building to another, near enough to be seen, comes out of the door
 * of the first (or round a corner, out of sight, when already on the way) and walks the sidewalks
 * a little in from the curb, round the blocks and across the crosswalks towards the second, waiting
 * for the walk light (traffic running alongside has the green), or at a stop sign or a dark signal
 * for a gap in the traffic; at the block they go to, they walk in through its door and are gone.
 * Cars stop for whoever is on the crosswalk. Out of the player's reach they are dropped, and go on
 * by their plan, which costs nothing.
 */
export interface Ped {
  /** The citizen. */
  id: number;
  x: number;
  y: number;
  /** Position at the previous tick, for render interpolation. */
  px: number;
  py: number;
  /** Facing (unit vector) and speed now; its own walking pace. */
  dx: number;
  dy: number;
  v: number;
  pace: number;
  /** The block it walks round, the edge (0 north going east, 1 east going south, 2 south going west, 3 west going north), metres along it, which way (1 clockwise) and how far in from the curb. */
  blk: number;
  e: number;
  t: number;
  dir: number;
  off: number;
  /** Crossing: waypoints (the curb, the far curb, back on the sidewalk), the next one, and the stop it waits at. */
  way: number[];
  wi: number;
  ci: number;
  cj: number;
  axis: number;
  /** Ticks waited at the curb; metres walked (the legs swing with it). */
  wait: number;
  stride: number;
  /** Where it goes: the building (-1: nowhere it can walk to, it leaves round the corner), its block, and the point on this ring of sidewalk across from its door. */
  goal: number;
  gb: number;
  ge: number;
  gt: number;
  /** Through a door: 1 coming out to the sidewalk, 2 going in; lx, ly the point it walks to. */
  door: number;
  lx: number;
  ly: number;
  /** Their phone now (see phoneUse): 0 not in use, 1 on a call (at the ear), 2 texting (in the hand, its screen lit), 3 ringing. */
  use: number;
}

/**
 * Whether someone walking has their phone out at a moment (real seconds): in slots of PHONE_SLOT s,
 * the talkative ones more often; a call starts with a few seconds of ringing (incoming) or not
 * (they dial). A pure function of the citizen and the time, so the same person uses it the same way.
 */
const PHONE_SLOT = 40, RING_S = 4;
export function phoneUse(pop: Population, id: number, sec: number): number {
  if (pop.phone[id] === 255) return 0;
  const slot = Math.floor(sec / PHONE_SLOT + hash3(id, 5, 71)), h = hash3(id, slot, 77);
  if (h >= 0.1 + 0.3 * (pop.talk[id] / 255)) return 0;
  const into = (sec / PHONE_SLOT + hash3(id, 5, 71) - slot) * PHONE_SLOT;
  // most slots run short of the whole: a call or a text of 12 to 40 s
  if (into > 12 + 28 * hash3(id, slot, 79)) return 0;
  if (hash3(id, slot, 78) < 0.5) return 2;
  return into < RING_S && hash3(id, slot, 80) < 0.5 ? 3 : 1;
}

/** Where on the road the crosswalk runs: this far from the intersection's edge (the stripes are 1-4.5 m). */
const CW = 2.75;
/** Pedestrians live within this of the player, and are dropped beyond the second radius. */
export const PED_R = 220, PED_FAR = 260;
/** At most this many at once, and how much of the population is looked at per tick (all of it every 0.5 s). */
const PED_CAP = 700, SCAN_TICKS = 30;

/** The ring on a block's sidewalk `off` in from the curb: start and direction of edge e, and its length. */
function edge(b: Block, off: number, e: number, out: number[]) {
  const X0 = b.x0 + off, X1 = b.x1 - off, Y0 = b.y0 + off, Y1 = b.y1 - off;
  if (e === 0) { out[0] = X0; out[1] = Y0; out[2] = 1; out[3] = 0; out[4] = X1 - X0; }
  else if (e === 1) { out[0] = X1; out[1] = Y0; out[2] = 0; out[3] = 1; out[4] = Y1 - Y0; }
  else if (e === 2) { out[0] = X1; out[1] = Y1; out[2] = -1; out[3] = 0; out[4] = X1 - X0; }
  else { out[0] = X0; out[1] = Y1; out[2] = 0; out[3] = -1; out[4] = Y1 - Y0; }
}
const E = [0, 0, 0, 0, 0];

/** Whether a pedestrian can walk this block's sidewalk (the diagonal's blocks are left out for now). */
const walkable = (b: Block | undefined) => !!b && !b.diag;

/** The block (index) a point is in, or -1 on a road. */
function blockIndex(city: City, x: number, y: number): number {
  const cx = city.xCell[Math.max(0, Math.min(city.xCell.length - 1, Math.floor(x)))], cy = city.yCell[Math.max(0, Math.min(city.yCell.length - 1, Math.floor(y)))];
  if (!(cx & 1) || !(cy & 1)) return -1;
  return ((cy - 1) >> 1) * city.nbx + ((cx - 1) >> 1);
}

/** The point of block b's ring nearest (x, y): its edge and metres along it. */
function onRing(b: Block, off: number, x: number, y: number): [number, number] {
  let best = 1e18, be = 0, bt = 0;
  for (let e = 0; e < 4; e++) {
    edge(b, off, e, E);
    const t = Math.max(0, Math.min(E[4], (x - E[0]) * E[2] + (y - E[1]) * E[3]));
    const d = (E[0] + E[2] * t - x) ** 2 + (E[1] + E[3] * t - y) ** 2;
    if (d < best) { best = d; be = e; bt = t; }
  }
  return [be, bt];
}

/** Metres round the ring (clockwise) from edge 0's start. */
function ringPos(b: Block, off: number, e: number, t: number) {
  const w = b.x1 - b.x0 - 2 * off, h = b.y1 - b.y0 - 2 * off;
  return [0, w, w + h, 2 * w + h][e] + t;
}

/** Whether, at the corner reached going this way along edge e, crossing straight on heads for the goal block. */
function towards(city: City, p: Ped, e: number, dir: number): boolean {
  const b = city.blocks[p.blk], bi = p.blk % city.nbx, bj = Math.floor(p.blk / city.nbx);
  const gi = p.gb % city.nbx, gj = Math.floor(p.gb / city.nbx);
  edge(b, p.off, e, E);
  const tx = E[2] * dir, ty = E[3] * dir;
  if (tx ? Math.sign(gi - bi) !== tx : Math.sign(gj - bj) !== ty) return false;
  const ni = bi + tx, nj = bj + ty;
  return ni >= 0 && nj >= 0 && ni < city.nbx && nj < city.nby && walkable(city.blocks[nj * city.nbx + ni]);
}

/** Which way round its block a pedestrian should go: to its goal on this block, or to the corner where it crosses towards it. */
function pickDir(city: City, p: Ped) {
  const b = city.blocks[p.blk];
  if (p.blk === p.gb) {
    const L = 2 * (b.x1 - b.x0 + b.y1 - b.y0 - 4 * p.off), fw = (((ringPos(b, p.off, p.ge, p.gt) - ringPos(b, p.off, p.e, p.t)) % L) + L) % L;
    p.dir = fw <= L / 2 ? 1 : -1;
    return;
  }
  let best = Infinity;
  for (const d of [1, -1]) {
    let e = p.e, t = p.t, dist = 0;
    for (let k = 0; k < 4; k++) {
      edge(b, p.off, e, E);
      dist += d > 0 ? E[4] - t : t;
      if (towards(city, p, e, d)) break;
      e = (e + (d > 0 ? 1 : 3)) & 3;
      edge(b, p.off, e, E);
      t = d > 0 ? 0 : E[4];
      if (k === 3) dist = Infinity;
    }
    if (dist < best) { best = dist; p.dir = d; }
  }
  // no way on from here (the diagonal's blocks in between): round this block to the nearest point to the door, and off
  if (best === Infinity) {
    const to = doorPoint(city, p.goal)!;
    p.gb = p.blk; p.goal = -1;
    [p.ge, p.gt] = onRing(b, p.off, to[0], to[1]);
    pickDir(city, p);
  }
}

/**
 * Citizen i out walking, as a pedestrian: from the door of the building they left (out) or at the
 * point of their way they have reached (x, y), on its nearest sidewalk; null when their way cannot
 * be walked (a block of the diagonal, a lot without a door).
 */
/**
 * How fast someone walks this trip, m/s: most at an ordinary pace, some hurrying (a jog; more of them
 * in the morning rush, few old people), some taking their time (more of them old, and late at night).
 * Until the day's length is settled this stands in for being late or early by their plan.
 */
function pickPace(rng: Rng, age: number, hour: number): number {
  const rush = hour >= 7 && hour < 9.5, night = hour >= 20 || hour < 5;
  const hurry = (0.06 + (rush ? 0.12 : 0)) * (age >= 70 ? 0.2 : 1), slow = 0.15 + (age >= 65 ? 0.45 : 0) + (night ? 0.1 : 0);
  const r = rng();
  if (r < hurry) return 2.4 + rng() * 1.0;
  if (r < hurry + slow) return 0.8 + rng() * 0.3;
  return 1.15 + rng() * 0.45;
}

function spawnPed(city: City, rng: Rng, i: number, goal: number, x: number, y: number, out: [number, number] | null, pace: number): Ped | null {
  const to = doorPoint(city, goal);
  if (!to) return null;
  const off = 0.7 + rng() * (SIDEWALK - 1.4);
  const sx = out ? out[0] : x, sy = out ? out[1] : y;
  let blk = blockIndex(city, sx, sy);
  // on a road: the nearest block's sidewalk
  if (blk < 0) {
    for (let r = 2; r < 30 && blk < 0; r += 2) for (const [ox, oy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { blk = blockIndex(city, sx + ox, sy + oy); if (blk >= 0) break; }
  }
  const gb = blockIndex(city, to[0], to[1]);
  if (blk < 0 || gb < 0 || !walkable(city.blocks[blk]) || !walkable(city.blocks[gb])) return null;
  const [e, t] = onRing(city.blocks[blk], off, sx, sy), [ge, gt] = onRing(city.blocks[gb], off, to[0], to[1]);
  edge(city.blocks[blk], off, e, E);
  const rx = E[0] + E[2] * t, ry = E[1] + E[3] * t;
  const p: Ped = {
    id: i, x: out ? sx : rx, y: out ? sy : ry, px: 0, py: 0, dx: E[2], dy: E[3], v: 0, pace, blk, e, t, dir: 1, off,
    way: [], wi: 0, ci: 0, cj: 0, axis: 0, wait: 0, stride: rng() * 2, goal, gb, ge, gt, door: out ? 1 : 0, lx: rx, ly: ry, use: 0,
  };
  p.px = p.x; p.py = p.y;
  pickDir(city, p);
  return p;
}

/**
 * At a corner: turn, or cross straight on to the next block when that heads for the goal. Crossing
 * sets the waypoints and the stop whose light it waits for (the intersection, and the axis of the
 * traffic running alongside).
 */
function corner(city: City, p: Ped) {
  const b = city.blocks[p.blk], bi = p.blk % city.nbx, bj = Math.floor(p.blk / city.nbx);
  edge(b, p.off, p.e, E);
  const tx = E[2] * p.dir, ty = E[3] * p.dir; // travelling this way
  const ni = bi + tx, nj = bj + ty;
  if (p.blk !== p.gb && towards(city, p, p.e, p.dir)) {
    // straight on across the road, on the crosswalk next to the intersection
    const n = city.blocks[nj * city.nbx + ni];
    if (tx) {
      const yc = p.e === 0 ? b.y0 + CW : b.y1 - CW, ax = tx > 0 ? b.x1 : b.x0, bx = tx > 0 ? n.x0 : n.x1;
      edge(n, p.off, p.e, E);
      const t = p.dir > 0 ? 0 : E[4];
      p.way = [ax, yc, bx, yc, E[0] + E[2] * t, E[1] + E[3] * t];
      p.ci = tx > 0 ? bi + 1 : bi; p.cj = p.e === 0 ? bj : bj + 1; p.axis = 0;
      p.blk = nj * city.nbx + ni; p.t = t;
    } else {
      const xc = p.e === 3 ? b.x0 + CW : b.x1 - CW, ay = ty > 0 ? b.y1 : b.y0, by = ty > 0 ? n.y0 : n.y1;
      edge(n, p.off, p.e, E);
      const t = p.dir > 0 ? 0 : E[4];
      p.way = [xc, ay, xc, by, E[0] + E[2] * t, E[1] + E[3] * t];
      p.ci = p.e === 3 ? bi : bi + 1; p.cj = ty > 0 ? bj + 1 : bj; p.axis = 1;
      p.blk = nj * city.nbx + ni; p.t = t;
    }
    p.wi = 0; p.wait = 0;
    return;
  }
  // round the corner
  const over = p.dir > 0 ? p.t - E[4] : -p.t;
  p.e = (p.e + (p.dir > 0 ? 1 : 3)) & 3;
  edge(b, p.off, p.e, E);
  p.t = p.dir > 0 ? over : E[4] - over;
}

/** Whether a car is coming close to a crossing point (for a stop sign or a dark signal). */
function traffic(cars: Car[], x: number, y: number): boolean {
  for (const c of cars) if (c.v > 1.5 && Math.abs(c.x - x) < 28 && Math.abs(c.y - y) < 28) return true;
  return false;
}

/** Crosswalk users this tick (x, y pairs), for cars to stop for. */
export const crossers: number[] = [];

/** Walk straight to (lx, ly); true on arrival. */
function toPoint(p: Ped, v: number, dt: number): boolean {
  const dx = p.lx - p.x, dy = p.ly - p.y, d = Math.hypot(dx, dy);
  if (d > 1e-6) { p.dx = dx / d; p.dy = dy / d; }
  const step = Math.min(d, v * dt);
  if (d > 1e-6) { p.x += (dx / d) * step; p.y += (dy / d) * step; }
  return d - step < 0.05;
}

/**
 * Who of the population is out walking near the player: a share of the citizens each tick (all of
 * them every SCAN_TICKS). Someone who has just left a building in reach comes out of its door; someone
 * already on their way is picked up only out of sight (between 0.7 and 1 of the reach), so nobody
 * pops up in view. `all` looks at everyone at once (a new world).
 */
function scan(city: City, pop: Population, peds: Ped[], walking: Set<number>, rng: Rng, tick: number, time: number, px: number, py: number, all = false) {
  if (!pop.n) return;
  const per = Math.ceil(pop.n / SCAN_TICKS), i0 = all ? 0 : (tick % SCAN_TICKS) * per, i1 = all ? pop.n : Math.min(pop.n, i0 + per);
  const B = city.buildings;
  for (let i = i0; i < i1 && peds.length < PED_CAP; i++) {
    if (walking.has(i)) continue;
    const W = whereIs(pop, city, i, time);
    if (W.doing !== Doing.Walk) continue;
    const F = B[W.from], T = B[W.building];
    const fx = (F.x0 + F.x1) / 2, fy = (F.y0 + F.y1) / 2, gx = (T.x0 + T.x1) / 2, gy = (T.y0 + T.y1) / 2;
    const x = fx + (gx - fx) * W.prog, y = fy + (gy - fy) * W.prog;
    const metres = W.prog * (Math.abs(gx - fx) + Math.abs(gy - fy));
    let p: Ped | null = null;
    const pace = () => pickPace(rng, pop.age[i], (time % 86400) / 3600);
    if (metres < 25 && !all) {
      // just out of the door
      const out = doorPoint(city, W.from);
      if (out && Math.hypot(out[0] - px, out[1] - py) < PED_R) p = spawnPed(city, rng, i, W.building, 0, 0, out, pace());
    } else {
      const d = Math.hypot(x - px, y - py);
      if (d < PED_R && (all || d > PED_R * 0.7)) p = spawnPed(city, rng, i, W.building, x, y, null, pace());
    }
    if (p) { peds.push(p); walking.add(i); }
  }
}

/** Citizens now walking as pedestrians, by id (so nobody is on the street twice). */
const onStreet = new WeakMap<Ped[], Set<number>>();

/** The pedestrians around a new world. */
export function spawnPeds(city: City, pop: Population, rng: Rng, time: number, x: number, y: number): Ped[] {
  const peds: Ped[] = [], s = new Set<number>();
  scan(city, pop, peds, s, rng, 0, time, x, y, true);
  onStreet.set(peds, s);
  return peds;
}

/** How often (ticks) each pedestrian is checked against their plan, and how far behind it they may fall. */
const SYNC_TICKS = 60, SYNC_SLACK = 30;
/** Whether the player could be looking at a point: close by, or within a wide cone ahead (heading hx, hy). */
function inSight(x: number, y: number, px: number, py: number, hx: number, hy: number): boolean {
  const dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
  return d < 10 || (dx * hx + dy * hy) / d > 0.34;
}

/**
 * One tick of the pedestrians near the player: new ones from the population, each walking on, the
 * arrived and the far ones gone. The day runs faster than people walk (the clock is TIME_SCALE times
 * real time), so whoever has fallen behind their plan catches up while the player is not looking
 * (heading hx, hy): on to where the plan has them by now, or gone indoors if it has them arrived.
 * Someone followed walks on as they are, and gets there late.
 */
export function stepPeds(city: City, power: PowerGrid, pop: Population, peds: Ped[], cars: Car[], rng: Rng, dt: number, tick: number, time: number, px: number, py: number, hx = 1, hy = 0) {
  const sec = tick * dt;
  let walking = onStreet.get(peds);
  if (!walking) onStreet.set(peds, (walking = new Set(peds.map((p) => p.id))));
  crossers.length = 0;
  for (let k = peds.length - 1; k >= 0; k--) {
    const p = peds[k];
    p.px = p.x; p.py = p.y;
    // too far from the player: off the street (their day goes on by their plan)
    if (Math.abs(p.x - px) > PED_FAR || Math.abs(p.y - py) > PED_FAR) { walking.delete(p.id); peds.splice(k, 1); continue; }
    if ((tick + p.id) % SYNC_TICKS === 0 && !p.door && !p.way.length && p.goal >= 0 && !inSight(p.x, p.y, px, py, hx, hy)) {
      const W = whereIs(pop, city, p.id, time);
      if (W.doing !== Doing.Walk || W.building !== p.goal) { walking.delete(p.id); peds.splice(k, 1); continue; }
      const F = city.buildings[W.from], T = city.buildings[W.building];
      const fx = (F.x0 + F.x1) / 2, fy = (F.y0 + F.y1) / 2, gx = (T.x0 + T.x1) / 2, gy = (T.y0 + T.y1) / 2;
      const planLeft = (1 - W.prog) * (Math.abs(gx - fx) + Math.abs(gy - fy)), left = Math.abs(gx - p.x) + Math.abs(gy - p.y);
      if (left > planLeft + SYNC_SLACK) {
        const x = fx + (gx - fx) * W.prog, y = fy + (gy - fy) * W.prog;
        const q = Math.hypot(x - px, y - py) < PED_R && !inSight(x, y, px, py, hx, hy) ? spawnPed(city, rng, p.id, p.goal, x, y, null, p.pace) : null;
        if (q) { peds[k] = q; continue; }
        if (Math.hypot(x - px, y - py) >= PED_R) { walking.delete(p.id); peds.splice(k, 1); continue; }
      }
    }
    p.use = phoneUse(pop, p.id, sec);
    // (they walk through the player, so nobody is held up on their way by standing in it)
    // texting slows them down
    let v = p.use === 2 ? p.pace * 0.8 : p.pace;
    if (p.door) {
      // through the door: out onto the sidewalk, or in and gone
      if (toPoint(p, v, dt)) {
        if (p.door === 2) { walking.delete(p.id); peds.splice(k, 1); continue; }
        p.door = 0;
      }
    } else if (p.way.length) {
      // crossing: to the curb, wait for the light, over the road, back onto the sidewalk
      const wx = p.way[p.wi * 2], wy = p.way[p.wi * 2 + 1];
      if (p.wi === 0) {
        const dd = Math.hypot(wx - p.x, wy - p.y);
        if (dd < 0.3) {
          const sg = signal(city, power, p.ci, p.cj, p.axis, sec);
          // a walk light: go; a stop sign or a dark signal: after a look both ways, when nothing is coming
          const go = sg === Sig.Green || (stopLike(sg) && p.wait > 30 && p.wait % 15 === 0 && !traffic(cars, wx, wy));
          if (!go) { p.wait++; v = 0; }
          else p.wi = 1;
        }
      }
      if (p.wi >= 1) v *= 1.25; // hurry over the road
      const tx = p.way[p.wi * 2], ty = p.way[p.wi * 2 + 1], dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (v > 0 && d > 1e-6) { p.dx = dx / d; p.dy = dy / d; }
      const step = Math.min(d, v * dt);
      if (d > 1e-6) { p.x += (dx / d) * step; p.y += (dy / d) * step; }
      if (p.wi === 1) crossers.push(p.x, p.y);
      if (d - step < 0.05 && p.wi > 0) { p.wi++; if (p.wi > 2) { p.way = []; pickDir(city, p); } }
    } else {
      // round the block; at the door's point, in
      const b = city.blocks[p.blk];
      if (p.blk === p.gb && p.e === p.ge && Math.abs(p.t - p.gt) <= v * dt + 0.05) {
        const to = p.goal >= 0 ? doorPoint(city, p.goal)! : [p.x, p.y];
        p.door = 2; p.lx = to[0]; p.ly = to[1];
      } else {
        const t0 = p.t;
        p.t += p.dir * v * dt;
        // passing the door's point within one step
        if (p.blk === p.gb && p.e === p.ge && (t0 - p.gt) * (p.t - p.gt) <= 0) p.t = p.gt;
        edge(b, p.off, p.e, E);
        if (p.t > E[4] || p.t < 0) { corner(city, p); if (p.way.length) { p.v = v; p.stride += v * dt; continue; } edge(b, p.off, p.e, E); }
        p.x = E[0] + E[2] * p.t; p.y = E[1] + E[3] * p.t;
        p.dx = E[2] * p.dir; p.dy = E[3] * p.dir;
      }
    }
    p.v = v;
    p.stride += v * dt;
  }
  scan(city, pop, peds, walking, rng, tick, time, px, py);
}
