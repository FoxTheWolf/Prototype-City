import { hash3 } from '../core/rng';
import { type City } from './city';

/**
 * The power grid. Substations stand at fixed points; every building and street lamp hangs on the
 * nearest one (its shop sign, blade sign and floodlights go with the building). Switching a
 * substation off is a blackout of everything it feeds: the renderer and the sound only read this
 * state. Later the same grid will run the traffic lights (stage 6), doors and lifts (7), phone
 * masts and Wi-Fi (9), and be what the player hacks (14).
 */
export interface Substation {
  x: number;
  y: number;
  on: boolean;
  /** Tick of the last switch, or -1 if it never switched (so it has always been on). */
  changed: number;
  /** Where that switch was thrown: the blackout ring spreads out from here. */
  ox: number;
  oy: number;
}

export interface PowerGrid {
  subs: Substation[];
  /** Substation of every building and every lamp, by index. */
  building: Uint8Array;
  lamp: Uint8Array;
  /** Buildings with a backup generator: their lights come back dimmer after a few seconds. */
  generator: Uint8Array;
  /** Coarse lookup of the substation feeding a point: GRID x GRID cells over the city. */
  cell: Uint8Array;
}

const SPACING = 650, GRID = 64;

/** Index of the substation nearest to a point. */
function nearest(subs: Substation[], x: number, y: number) {
  let best = 0, bd = Infinity;
  subs.forEach((s, k) => { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = k; } });
  return best;
}

export function buildPower(seed: number, city: City): PowerGrid {
  const nx = Math.max(1, Math.round(city.w / SPACING)), ny = Math.max(1, Math.round(city.h / SPACING));
  const subs: Substation[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    subs.push({ x: ((i + 0.25 + 0.5 * hash3(seed, i, j * 7 + 1)) * city.w) / nx, y: ((j + 0.25 + 0.5 * hash3(seed, i, j * 7 + 2)) * city.h) / ny, on: true, changed: -1, ox: 0, oy: 0 });
  }
  const building = new Uint8Array(city.buildings.length), generator = new Uint8Array(city.buildings.length);
  const hall = city.landmarks.find((l) => l.kind === 'hall');
  city.buildings.forEach((B, k) => {
    const mx = (B.x0 + B.x1) / 2, my = (B.y0 + B.y1) / 2;
    building[k] = nearest(subs, mx, my);
    const civic = hall && Math.hypot(mx - hall.x, my - hall.y) < 40;
    generator[k] = civic || (B.h > 40 && hash3(seed ^ 0x6e7, mx | 0, my | 0) < 0.04) ? 1 : 0;
  });
  const lamp = new Uint8Array(city.lamps.length);
  city.lamps.forEach((p, k) => { lamp[k] = nearest(subs, p.x, p.y); });
  const cell = new Uint8Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) cell[j * GRID + i] = nearest(subs, ((i + 0.5) * city.w) / GRID, ((j + 0.5) * city.h) / GRID);
  return { subs, building, lamp, generator, cell };
}

/** The substation feeding a point of the city (outside it, the nearest edge's). */
export function subAt(p: PowerGrid, city: City, x: number, y: number) {
  const i = Math.min(GRID - 1, Math.max(0, Math.floor((x / city.w) * GRID))), j = Math.min(GRID - 1, Math.max(0, Math.floor((y / city.h) * GRID)));
  return p.cell[j * GRID + i];
}

/** Switch a substation, at this tick, from the point (x, y) (for now the player's position). */
export function switchSub(p: PowerGrid, k: number, on: boolean, tick: number, x: number, y: number) {
  const s = p.subs[k];
  if (s.on === on) return;
  s.on = on; s.changed = tick; s.ox = x; s.oy = y;
}
