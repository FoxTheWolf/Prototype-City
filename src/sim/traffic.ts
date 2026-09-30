import { type Rng } from '../core/rng';
import { BLOCKS, BS, type RGB } from './city';

export interface Car {
  x: number;
  y: number;
  /** Position at the previous tick, for render interpolation. */
  px: number;
  py: number;
  dx: number;
  dy: number;
  v: number;
  max: number;
  taxi: boolean;
  col: RGB;
  /** Coordinate along the travel axis of the next intersection center. */
  target: number;
}

const CAR_COLS: RGB[] = [[180, 40, 40], [40, 90, 170], [200, 200, 210], [40, 40, 48], [60, 140, 90], [150, 90, 40], [120, 60, 150]];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const laneOff = (dx: number, dy: number) => [-dy * 0.75, dx * 0.75] as const;

export function spawnCars(rng: Rng, count: number): Car[] {
  const cars: Car[] = [];
  for (let k = 0; k < count; k++) {
    const horiz = rng() < 0.5, road = (rng() * BLOCKS) | 0, seg = (rng() * (BLOCKS - 1)) | 0;
    const [dx, dy] = DIRS[horiz ? (rng() < 0.5 ? 0 : 2) : (rng() < 0.5 ? 1 : 3)];
    const [ox, oy] = laneOff(dx, dy);
    const along = seg * BS + 1.5 + 6;
    const taxi = rng() < 0.22;
    const col: RGB = taxi ? [255, 200, 40] : CAR_COLS[(rng() * CAR_COLS.length) | 0];
    const target = ((horiz ? dx : dy) > 0 ? seg + 1 : seg) * BS + 1.5;
    const x = horiz ? along : road * BS + 1.5 + ox;
    const y = horiz ? road * BS + 1.5 + oy : along;
    cars.push({ x, y, px: x, py: y, dx, dy, v: 0, max: 2.6 + rng() * 2.2, taxi, col, target });
  }
  return cars;
}

/** Advance traffic one tick. Cars keep distance, yield to the player and turn at intersections. */
export function stepCars(cars: Car[], rng: Rng, dt: number, playerX: number, playerY: number) {
  for (const c of cars) {
    c.px = c.x; c.py = c.y;
    let want = c.max;
    const rx = playerX - c.x, ry = playerY - c.y;
    const ahead = rx * c.dx + ry * c.dy, lat = Math.abs(rx * c.dy - ry * c.dx);
    if (ahead > 0 && ahead < 2.6 && lat < 0.9) want = 0;
    for (const o of cars) {
      if (o === c || o.dx !== c.dx || o.dy !== c.dy) continue;
      const ox = o.x - c.x, oy = o.y - c.y, a = ox * c.dx + oy * c.dy, l = Math.abs(ox * c.dy - oy * c.dx);
      if (a > 0 && a < 1.7 && l < 0.4) { want = 0; break; }
    }
    c.v += Math.sign(want - c.v) * Math.min(Math.abs(want - c.v), dt * (want < c.v ? 9 : 3));
    const before = c.dx ? c.x : c.y;
    c.x += c.dx * c.v * dt; c.y += c.dy * c.v * dt;
    const after = c.dx ? c.x : c.y, dirSign = c.dx || c.dy;
    if ((after - c.target) * dirSign < 0 || (before - c.target) * dirSign >= 0) continue;

    // at an intersection: straight (weighted x2) / left / right, staying inside the map
    const [lox, loy] = laneOff(c.dx, c.dy);
    const ci = c.dx ? Math.round((c.target - 1.5) / BS) : Math.round((c.x - lox - 1.5) / BS);
    const cj = c.dy ? Math.round((c.target - 1.5) / BS) : Math.round((c.y - loy - 1.5) / BS);
    const opts: (readonly [number, number])[] = [];
    for (const d of DIRS) {
      if (d[0] === -c.dx && d[1] === -c.dy) continue;
      const ni = ci + d[0], nj = cj + d[1];
      if (ni < 0 || nj < 0 || ni >= BLOCKS || nj >= BLOCKS) continue;
      opts.push(d);
      if (d[0] === c.dx && d[1] === c.dy) opts.push(d);
    }
    const nd = opts.length ? opts[(rng() * opts.length) | 0] : [-c.dx, -c.dy] as const;
    c.dx = nd[0]; c.dy = nd[1];
    const [ox, oy] = laneOff(c.dx, c.dy);
    c.x = ci * BS + 1.5 + ox; c.y = cj * BS + 1.5 + oy;
    c.target = c.dx ? (ci + c.dx) * BS + 1.5 : (cj + c.dy) * BS + 1.5;
  }
}
