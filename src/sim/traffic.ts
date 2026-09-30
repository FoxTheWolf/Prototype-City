import { type Rng } from '../core/rng';
import { LANE_W, lanesOf, roadCenter, type City, type RGB } from './city';

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
  /** Lane counted from the road center, 0 = innermost. */
  lane: number;
  /** Intersection the car is heading to: vertical road nx crossing horizontal road ny. */
  nx: number;
  ny: number;
}

const CAR_COLS: RGB[] = [[180, 40, 40], [40, 90, 170], [200, 200, 210], [40, 40, 48], [60, 140, 90], [150, 90, 40], [120, 60, 150]];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
/** Offset from the road center to the middle of a lane; drives on the right. */
const laneOff = (dx: number, dy: number, lane: number) => {
  const o = LANE_W * (lane + 0.5);
  return [-dy * o, dx * o] as const;
};

export function spawnCars(city: City, rng: Rng, count: number): Car[] {
  const cars: Car[] = [];
  const NX = city.xb.length / 2, NY = city.yb.length / 2;
  for (let k = 0; k < count; k++) {
    const horiz = rng() < 0.5, fwd = rng() < 0.5;
    const road = (rng() * (horiz ? NY : NX)) | 0, seg = (rng() * ((horiz ? NX : NY) - 1)) | 0;
    const [dx, dy] = horiz ? (fwd ? DIRS[0] : DIRS[2]) : (fwd ? DIRS[1] : DIRS[3]);
    const lane = (rng() * lanesOf(horiz ? city.yb : city.xb, road)) | 0;
    const [ox, oy] = laneOff(dx, dy, lane);
    const cross = horiz ? city.xb : city.yb;
    const along = roadCenter(cross, seg) + (roadCenter(cross, seg + 1) - roadCenter(cross, seg)) * (0.2 + rng() * 0.6);
    const next = fwd ? seg + 1 : seg;
    const taxi = rng() < 0.22;
    const col: RGB = taxi ? [255, 200, 40] : CAR_COLS[(rng() * CAR_COLS.length) | 0];
    const x = horiz ? along : roadCenter(city.xb, road) + ox;
    const y = horiz ? roadCenter(city.yb, road) + oy : along;
    cars.push({ x, y, px: x, py: y, dx, dy, v: 0, max: 8 + rng() * 6, taxi, col, lane, nx: horiz ? next : road, ny: horiz ? road : next });
  }
  return cars;
}

/** Advance traffic one tick. Cars keep distance, yield to the player and turn at intersections. */
export function stepCars(city: City, cars: Car[], rng: Rng, dt: number, playerX: number, playerY: number) {
  const NX = city.xb.length / 2, NY = city.yb.length / 2;
  for (const c of cars) {
    c.px = c.x; c.py = c.y;
    let want = c.max;
    const rx = playerX - c.x, ry = playerY - c.y;
    const ahead = rx * c.dx + ry * c.dy, lat = Math.abs(rx * c.dy - ry * c.dx);
    if (ahead > 0 && ahead < 10 && lat < 1.8) want = 0;
    for (const o of cars) {
      if (o === c || o.dx !== c.dx || o.dy !== c.dy) continue;
      const ox = o.x - c.x, oy = o.y - c.y, a = ox * c.dx + oy * c.dy, l = Math.abs(ox * c.dy - oy * c.dx);
      if (a > 0 && a < 7 && l < 1.2) { want = 0; break; }
    }
    c.v += Math.sign(want - c.v) * Math.min(Math.abs(want - c.v), dt * (want < c.v ? 7 : 2.5));
    const target = c.dx ? roadCenter(city.xb, c.nx) : roadCenter(city.yb, c.ny);
    const before = c.dx ? c.x : c.y;
    c.x += c.dx * c.v * dt; c.y += c.dy * c.v * dt;
    const after = c.dx ? c.x : c.y, dirSign = c.dx || c.dy;
    if ((after - target) * dirSign < 0 || (before - target) * dirSign >= 0) continue;

    // at an intersection: straight (weighted x2) / left / right, staying inside the map
    const opts: (readonly [number, number])[] = [];
    for (const d of DIRS) {
      if (d[0] === -c.dx && d[1] === -c.dy) continue;
      const ni = c.nx + d[0], nj = c.ny + d[1];
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NY) continue;
      opts.push(d);
      if (d[0] === c.dx && d[1] === c.dy) opts.push(d);
    }
    const nd = opts.length ? opts[(rng() * opts.length) | 0] : [-c.dx, -c.dy] as const;
    c.dx = nd[0]; c.dy = nd[1];
    c.lane = Math.min(c.lane, lanesOf(c.dx ? city.yb : city.xb, c.dx ? c.ny : c.nx) - 1);
    const [ox, oy] = laneOff(c.dx, c.dy, c.lane);
    c.x = roadCenter(city.xb, c.nx) + ox; c.y = roadCenter(city.yb, c.ny) + oy;
    c.nx += c.dx; c.ny += c.dy;
  }
}
