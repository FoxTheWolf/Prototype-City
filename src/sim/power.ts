import { hash3 } from '../core/rng';
import { diagS, type City } from './city';

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
  /** What its traffic-signal controller has been told (the cabinet in its district): 0 normal, 1 flashing, 2 dark. */
  sig: number;
  /** Game time the crews noticed it down (the first check after it went off), or -1 while it is on: it comes back by itself some hours later. */
  offAt: number;
  /**
   * The fenced yard it stands in: an empty lot of the city (its rubble cleared), its middle at (x, y);
   * `a` is the heading of the side toward the nearest street (the gate and the warning sign). Null
   * when no empty lot was near enough (then it is only a point, as before).
   */
  yard: { x0: number; y0: number; x1: number; y1: number; a: number } | null;
}

export interface PowerGrid {
  subs: Substation[];
  /** Substation of every building and every lamp, by index. */
  building: Uint8Array;
  lamp: Uint8Array;
  /** Buildings with a backup generator: their lights come back dimmer after a few seconds. */
  generator: Uint8Array;
  /**
   * What keeps each building lit with its substation down (Backup): nothing, battery emergency
   * lights, a generator for the common parts ("half light"), or a critical generator (near normal).
   * Old brick and historic buildings mostly have nothing; newer offices have the emergency lights.
   * Kinds of building to come (hospitals, stations, police) pick theirs here.
   */
  backup: Uint8Array;
  /** Coarse lookup of the substation feeding a point: GRID x GRID cells over the city. */
  cell: Uint8Array;
}

const SPACING = 650, GRID = 64;
/** A building's backup power, see PowerGrid.backup. */
export const Backup = { None: 0, Battery: 1, Generator: 2, Critical: 3 } as const;

/** Index of the substation nearest to a point. */
function nearest(subs: Substation[], x: number, y: number) {
  let best = 0, bd = Infinity;
  subs.forEach((s, k) => { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = k; } });
  return best;
}

export function buildPower(seed: number, city: City): PowerGrid {
  const nx = Math.max(1, Math.round(city.w / SPACING)), ny = Math.max(1, Math.round(city.h / SPACING));
  const subs: Substation[] = [];
  const used = new Set<number>();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = ((i + 0.25 + 0.5 * hash3(seed, i, j * 7 + 1)) * city.w) / nx, y = ((j + 0.25 + 0.5 * hash3(seed, i, j * 7 + 2)) * city.h) / ny;
    subs.push(placeYard(city, used, x, y));
  }
  const building = new Uint8Array(city.buildings.length), generator = new Uint8Array(city.buildings.length), backup = new Uint8Array(city.buildings.length);
  const hall = city.landmarks.find((l) => l.kind === 'hall');
  city.buildings.forEach((B, k) => {
    const mx = (B.x0 + B.x1) / 2, my = (B.y0 + B.y1) / 2;
    building[k] = nearest(subs, mx, my);
    const civic = hall && Math.hypot(mx - hall.x, my - hall.y) < 40;
    generator[k] = civic || (B.h > 40 && hash3(seed ^ 0x6e7, mx | 0, my | 0) < 0.04) ? 1 : 0;
    const h = hash3(seed ^ 0xb4c, mx | 0, my | 0);
    backup[k] = civic ? Backup.Critical : generator[k] ? Backup.Generator
      : h < ({ office: 0.9, glass: 0.95, residential: 0.5, brick: 0.25, historic: 0.3, warehouse: 0.2 } as Record<string, number>)[B.style] ? Backup.Battery : Backup.None;
  });
  const lamp = new Uint8Array(city.lamps.length);
  city.lamps.forEach((p, k) => { lamp[k] = nearest(subs, p.x, p.y); });
  const cell = new Uint8Array(GRID * GRID);
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) cell[j * GRID + i] = nearest(subs, ((i + 0.5) * city.w) / GRID, ((j + 0.5) * city.h) / GRID);
  return { subs, building, lamp, generator, backup, cell };
}

/**
 * A substation near (x, y): in the nearest empty lot big enough for a yard (at least 12 m a side,
 * clear of the diagonal avenue and its plazas), within YARD_REACH; its rubble is cleared. The gate
 * faces the side of the lot nearest its block's edge (the street).
 */
const YARD_MIN = 12, YARD_REACH = 360;
function placeYard(city: City, used: Set<number>, x: number, y: number): Substation {
  // a smaller lot further off when there is none (a cramped yard beats none)
  let best = pickLot(city, used, x, y, YARD_MIN, YARD_REACH);
  if (best < 0) best = pickLot(city, used, x, y, 9, YARD_REACH * 2);
  return placeYardAt(city, used, x, y, best);
}
function pickLot(city: City, used: Set<number>, x: number, y: number, min: number, reach: number): number {
  let best = -1, bd = reach;
  city.empties.forEach((L, k) => {
    if (used.has(k) || Math.min(L.x1 - L.x0, L.y1 - L.y0) < min) return;
    const B = city.blocks[L.block], mx = (L.x0 + L.x1) / 2, my = (L.y0 + L.y1) / 2;
    if (B.diag || B.square || B.open) return;
    if (Math.abs(diagS(city.diagonal, mx, my)) < city.diagonal.w / 2 + Math.hypot(L.x1 - L.x0, L.y1 - L.y0) / 2 + 6) return;
    const d = Math.hypot(mx - x, my - y);
    if (d < bd) { bd = d; best = k; }
  });
  return best;
}
function placeYardAt(city: City, used: Set<number>, x: number, y: number, best: number): Substation {
  const S: Substation = { x, y, on: true, changed: -1, ox: 0, oy: 0, sig: 0, offAt: -1, yard: null };
  if (best < 0) return S;
  used.add(best);
  const L = city.empties[best], B = city.blocks[L.block];
  S.x = (L.x0 + L.x1) / 2; S.y = (L.y0 + L.y1) / 2;
  // the side nearest the block's edge: west, north, east, south (headings pi, -pi/2, 0, pi/2)
  const gaps = [L.x0 - B.x0, L.y0 - B.y0, B.x1 - L.x1, B.y1 - L.y1], side = gaps.indexOf(Math.min(...gaps));
  S.yard = { x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1, a: [Math.PI, -Math.PI / 2, 0, Math.PI / 2][side] };
  // the rubble is cleared away
  B.props = B.props.filter((p) => p.kind !== 'debris' || p.x < L.x0 || p.x > L.x1 || p.y < L.y0 || p.y > L.y1);
  return S;
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
