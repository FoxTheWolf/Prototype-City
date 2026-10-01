import { type Rng } from '../core/rng';
import { SIDEWALK, type Block, type City } from './city';
import { type PowerGrid } from './power';
import { Sig, signal, type Car } from './traffic';

/**
 * Pedestrians: the people on the sidewalks around the player. Each walks round a block on its
 * sidewalk, a little in from the curb, and at a corner turns or crosses on the crosswalk to the next
 * block, waiting for the walk light (traffic running alongside has the green), or at a stop sign or a
 * dark signal for a gap in the traffic. Cars stop for whoever is on the crosswalk. They exist only
 * near the player (the rest of the city is too far to see) and come and go out of sight; each has
 * an identity of its own, for stage 11 to tie to a citizen with a home and a routine.
 */
export interface Ped {
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
}

/** Where on the road the crosswalk runs: this far from the intersection's edge (the stripes are 1-4.5 m). */
const CW = 2.75;
/** Pedestrians live within this of the player, and are moved away beyond the second radius. */
export const PED_R = 220, PED_FAR = 260;
/** Share of PEDS on the sidewalks at each hour. */
const PEDS = 520;
const PED_RUSH = [0.12, 0.08, 0.06, 0.05, 0.05, 0.1, 0.25, 0.6, 0.9, 0.7, 0.6, 0.7, 0.95, 0.85, 0.7, 0.7, 0.8, 1, 0.95, 0.8, 0.65, 0.5, 0.35, 0.2];

export function pedsWanted(t: number, rain: number) {
  const h = (t / 3600) % 24, a = Math.floor(h), f = h - a;
  return Math.round(PEDS * (PED_RUSH[a] * (1 - f) + PED_RUSH[(a + 1) % 24] * f) * (1 - 0.4 * rain));
}

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

/** A new pedestrian on a sidewalk between rMin and rMax from (x, y), or null if none fits. */
function spawnPed(city: City, rng: Rng, x: number, y: number, rMin: number, rMax: number): Ped | null {
  for (let tries = 0; tries < 30; tries++) {
    const n = (rng() * city.blocks.length) | 0, b = city.blocks[n];
    if (!walkable(b)) continue;
    const off = 0.7 + rng() * (SIDEWALK - 1.4), e = (rng() * 4) | 0;
    edge(b, off, e, E);
    const t = rng() * E[4], px = E[0] + E[2] * t, py = E[1] + E[3] * t, d = Math.hypot(px - x, py - y);
    if (d < rMin || d > rMax) continue;
    const dir = rng() < 0.5 ? 1 : -1;
    return { id: (rng() * 2 ** 31) | 0, x: px, y: py, px, py, dx: E[2] * dir, dy: E[3] * dir, v: 0, pace: 1.1 + rng() * 0.5, blk: n, e, t, dir, off, way: [], wi: 0, ci: 0, cj: 0, axis: 0, wait: 0, stride: rng() * 2 };
  }
  return null;
}

export function spawnPeds(city: City, rng: Rng, count: number, x: number, y: number): Ped[] {
  const out: Ped[] = [];
  for (let k = 0; k < count * 3 && out.length < count; k++) { const p = spawnPed(city, rng, x, y, 0, PED_R); if (p) out.push(p); }
  return out;
}

/**
 * At a corner: turn, or cross straight on to the next block. Crossing sets the waypoints and the
 * stop whose light it waits for (the intersection, and the axis of the traffic running alongside).
 */
function corner(city: City, rng: Rng, p: Ped) {
  const b = city.blocks[p.blk], bi = p.blk % city.nbx, bj = Math.floor(p.blk / city.nbx);
  edge(b, p.off, p.e, E);
  const tx = E[2] * p.dir, ty = E[3] * p.dir; // travelling this way
  const ni = bi + tx, nj = bj + ty, nb = ni >= 0 && nj >= 0 && ni < city.nbx && nj < city.nby ? city.blocks[nj * city.nbx + ni] : undefined;
  if (walkable(nb) && rng() < 0.45) {
    // straight on across the road, on the crosswalk next to the intersection
    const n = nb!;
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

/** One tick of the pedestrians near the player; the crowd thins and grows with the hour, out of sight. */
export function stepPeds(city: City, power: PowerGrid, peds: Ped[], cars: Car[], rng: Rng, dt: number, tick: number, px: number, py: number, want: number) {
  const sec = tick * dt;
  crossers.length = 0;
  for (let k = peds.length - 1; k >= 0; k--) {
    const p = peds[k];
    p.px = p.x; p.py = p.y;
    // too far behind the player: gone (it comes back as someone else, out of sight)
    if (Math.abs(p.x - px) > PED_FAR || Math.abs(p.y - py) > PED_FAR) {
      const n = peds.length > want ? null : spawnPed(city, rng, px, py, PED_R * 0.7, PED_R);
      if (n) peds[k] = n; else peds.splice(k, 1);
      continue;
    }
    let v = p.pace;
    if (p.way.length) {
      // crossing: to the curb, wait for the light, over the road, back onto the sidewalk
      const wx = p.way[p.wi * 2], wy = p.way[p.wi * 2 + 1];
      if (p.wi === 0) {
        const dd = Math.hypot(wx - p.x, wy - p.y);
        if (dd < 0.3) {
          const sg = signal(city, power, p.ci, p.cj, p.axis, sec);
          // a walk light: go; a stop sign or a dark signal: after a look both ways, when nothing is coming
          const go = sg === Sig.Green || ((sg === Sig.Dark || sg === Sig.Stop) && p.wait > 30 && p.wait % 15 === 0 && !traffic(cars, wx, wy));
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
      if (d - step < 0.05 && p.wi > 0) { p.wi++; if (p.wi > 2) p.way = []; }
    } else {
      // round the block
      const b = city.blocks[p.blk];
      const ahx = p.x + p.dx * 0.8, ahy = p.y + p.dy * 0.8;
      if (Math.hypot(ahx - px, ahy - py) < 0.7) v = 0; // the player is in the way
      p.t += p.dir * v * dt;
      edge(b, p.off, p.e, E);
      if (p.t > E[4] || p.t < 0) { corner(city, rng, p); if (p.way.length) { p.stride += v * dt; continue; } edge(b, p.off, p.e, E); }
      p.x = E[0] + E[2] * p.t; p.y = E[1] + E[3] * p.t;
      p.dx = E[2] * p.dir; p.dy = E[3] * p.dir;
    }
    p.v = v;
    p.stride += v * dt;
  }
  // more people out at this hour: a few come round a corner, out of sight
  if (tick % 20 === 0) for (let n = 0; n < 3 && peds.length < want; n++) { const q = spawnPed(city, rng, px, py, PED_R * 0.7, PED_R); if (q) peds.push(q); }
  if (tick % 20 === 10 && peds.length > want) {
    for (let k = peds.length - 1, n = 0; k >= 0 && n < 3 && peds.length > want; k--) if (Math.hypot(peds[k].x - px, peds[k].y - py) > PED_R * 0.7 && !peds[k].way.length) { peds.splice(k, 1); n++; }
  }
}
