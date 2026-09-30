import { hash3 } from '../core/rng';
import { type RGB } from '../sim/city';
import { Mat, part, Shape, type Part } from './objects';

const { Box, Cyl, Ball } = Shape;
const { Solid, Leaf, Glow } = Mat;

const GLASS: RGB = [45, 65, 95];
const TIRE: RGB = [28, 28, 32];
const STEEL: RGB = [100, 100, 110];

const cars = new Map<string, Part[]>();
/** A sedan 4.4 m long; taxis carry a lit roof sign. */
export function carModel(col: RGB, taxi: boolean): Part[] {
  const key = col.join() + taxi;
  let m = cars.get(key);
  if (m) return m;
  m = [
    part(Box, -2.2, -0.9, 0.35, 2.2, 0.9, 0.95, col, Solid, '#', '=', '#'),
    part(Box, -1.1, -0.82, 0.95, 0.9, 0.82, 1.4, GLASS, Solid, '=', '=', '='),
    part(Box, -1.0, -0.8, 1.4, 0.8, 0.8, 1.5, col, Solid, '-', '_', '-'),
  ];
  for (const wx of [-1.4, 1.4]) for (const wy of [-1, 1]) m.push(part(Box, wx - 0.33, wy * 0.95 - 0.12, 0, wx + 0.33, wy * 0.95 + 0.12, 0.62, TIRE, Solid, 'o'));
  for (const wy of [-1, 1]) {
    const a = wy * 0.45, b = wy * 0.8;
    m.push(part(Box, 2.19, Math.min(a, b), 0.62, 2.25, Math.max(a, b), 0.82, [255, 245, 200], Glow, '@'));
    m.push(part(Box, -2.25, Math.min(a, b), 0.62, -2.19, Math.max(a, b), 0.82, [255, 40, 40], Glow, '@'));
  }
  if (taxi) m.push(part(Box, -0.3, -0.3, 1.5, 0.2, 0.3, 1.75, [255, 215, 90], Glow, '#'));
  cars.set(key, m);
  return m;
}

const lamps = new Map<string, Part[]>();
/** Street lamp: a pole on a base, with an arm reaching over the street (+x) to the lamp head, glowing `head`. */
export function lampModel(head: RGB): Part[] {
  const key = head.join();
  let m = lamps.get(key);
  if (m) return m;
  m = [
    part(Cyl, -0.18, -0.18, 0, 0.18, 0.18, 0.6, STEEL, Solid, '#', '='),
    part(Cyl, -0.08, -0.08, 0, 0.08, 0.08, 6.6, STEEL, Solid, '|', '.'),
    part(Box, 0, -0.05, 6.45, 1.7, 0.05, 6.6, STEEL, Solid, '-', '-', '|'),
    part(Box, 1.2, -0.2, 6.25, 2.0, 0.2, 6.5, head, Glow, '*'),
  ];
  lamps.set(key, m);
  return m;
}

const trees = new Map<number, Part[]>();
/** Street and park tree: a trunk under a crown of one to three leafy ellipsoids, varied by seed. */
export function treeModel(seed: number, w: number, h: number): Part[] {
  let m = trees.get(seed);
  if (m) return m;
  const r = (k: number) => hash3(seed, k, 71);
  const leaf: RGB = [40 + r(1) * 25, 110 + r(2) * 60, 45 + r(3) * 20];
  const R = w / 2;
  m = [
    part(Cyl, -0.18, -0.18, 0, 0.18, 0.18, h * 0.55, [90, 62, 38], Solid, '|', '.'),
    part(Ball, -R * 0.6, -R * 0.6, h * 0.45, R * 0.6, R * 0.6, h * 0.85, leaf, Leaf, '@'),
  ];
  // clumps around the core make the outline lumpy
  const n = 5 + ((r(4) * 4) | 0);
  for (let k = 0; k < n; k++) {
    const a = (k / n + r(10 + k) * 0.15) * Math.PI * 2, d = R * (0.4 + 0.2 * r(40 + k)), s = R * (0.35 + 0.2 * r(20 + k));
    const zc = h * (0.5 + 0.35 * r(30 + k)), cx = Math.cos(a) * d, cy = Math.sin(a) * d;
    m.push(part(Ball, cx - s, cy - s, zc - s * 0.8, cx + s, cy + s, zc + s * 0.8, leaf, Leaf, '@'));
  }
  trees.set(seed, m);
  return m;
}

const WOOD: RGB = [125, 85, 50];
const DARK: RGB = [55, 58, 62];

/** Street furniture; +x faces the street (or the path, for park benches). */
export const FURNITURE: Record<string, { parts: Part[]; r: number; h: number }> = {
  bench: {
    r: 1, h: 0.95, parts: [
      part(Box, -0.25, -0.9, 0.42, 0.25, 0.9, 0.48, WOOD, Solid, '=', '='),
      part(Box, -0.32, -0.9, 0.52, -0.26, 0.9, 0.92, WOOD, Solid, '=', '-', '|'),
      part(Box, -0.28, -0.84, 0, 0.2, -0.76, 0.42, DARK, Solid, '|'),
      part(Box, -0.28, 0.76, 0, 0.2, 0.84, 0.42, DARK, Solid, '|'),
    ],
  },
  bin: {
    r: 0.45, h: 1, parts: [
      part(Cyl, -0.3, -0.3, 0, 0.3, 0.3, 0.88, [50, 75, 58], Solid, '#', 'o'),
      part(Cyl, -0.33, -0.33, 0.86, 0.33, 0.33, 0.96, STEEL, Solid, '=', 'o'),
    ],
  },
  hydrant: {
    r: 0.35, h: 0.85, parts: [
      part(Cyl, -0.15, -0.15, 0, 0.15, 0.15, 0.68, [190, 45, 35], Solid, '#', 'o'),
      part(Ball, -0.15, -0.15, 0.58, 0.15, 0.15, 0.82, [190, 45, 35], Solid, 'o'),
      part(Box, -0.06, -0.26, 0.42, 0.06, 0.26, 0.54, [210, 170, 60], Solid, '='),
    ],
  },
  mailbox: {
    r: 0.45, h: 1.25, parts: [
      part(Box, -0.25, -0.25, 0.35, 0.25, 0.25, 1.05, [40, 70, 155], Solid, '#', '=', '#'),
      part(Ball, -0.25, -0.25, 0.9, 0.25, 0.25, 1.22, [40, 70, 155], Solid, '='),
      part(Box, 0.25, -0.15, 0.85, 0.27, 0.15, 0.92, [180, 180, 190], Solid, '-'),
      part(Box, -0.2, -0.2, 0, 0.2, 0.2, 0.35, DARK, Solid, '|'),
    ],
  },
  news: {
    r: 0.4, h: 1, parts: [
      part(Box, -0.22, -0.25, 0, 0.22, 0.25, 0.98, [200, 170, 40], Solid, '#', '=', '#'),
      part(Box, 0.22, -0.18, 0.5, 0.24, 0.18, 0.85, [205, 205, 190], Solid, '='),
    ],
  },
  payphone: {
    // the phone faces the sidewalk (-x), under a blue hood
    r: 0.5, h: 2.15, parts: [
      part(Box, -0.06, -0.06, 0, 0.06, 0.06, 1.05, STEEL, Solid, '|'),
      part(Box, -0.22, -0.26, 1.0, 0.14, 0.26, 1.8, [150, 150, 158], Solid, '#', '=', '#'),
      part(Box, -0.24, -0.08, 1.2, -0.22, 0.08, 1.55, [30, 30, 34], Solid, '%'),
      part(Box, -0.24, -0.16, 1.62, -0.22, 0.16, 1.74, [170, 215, 255], Glow, '='),
      part(Box, -0.32, -0.36, 1.8, 0.2, 0.36, 2.1, [40, 80, 165], Solid, '=', '_', '='),
    ],
  },
  shelter: {
    // bus shelter: a roof on posts, a glass back and a lit poster at one end
    r: 2.3, h: 2.5, parts: [
      part(Box, -0.95, -2.05, 2.3, 0.95, 2.05, 2.45, STEEL, Solid, '=', '_'),
      part(Box, -0.95, -2.0, 0.25, -0.88, 2.0, 2.3, GLASS, Solid, ':'),
      part(Box, -0.88, 1.92, 0.3, 0.55, 2.0, 2.15, [240, 225, 200], Glow, '#'),
      part(Box, 0.8, -2.0, 0, 0.9, -1.9, 2.3, STEEL, Solid, '|'),
      part(Box, -0.6, -1.5, 0.42, -0.2, 1.3, 0.5, STEEL, Solid, '=', '='),
    ],
  },
  dumpster: {
    r: 1.4, h: 1.3, parts: [
      part(Box, -0.8, -1.0, 0.15, 0.8, 1.0, 1.15, [45, 90, 65], Solid, '#', '=', '#'),
      part(Box, -0.85, -1.05, 1.15, 0.85, 1.05, 1.25, [35, 70, 50], Solid, '=', '='),
      part(Box, -0.7, -0.9, 0, 0.7, 0.9, 0.15, TIRE, Solid, 'o'),
    ],
  },
};

const piles = new Map<number, Part[]>();
/** A pile of rubble: concrete chunks, planks and a tire, arranged by seed. */
export function debrisModel(seed: number): Part[] {
  const key = seed % 64;
  let m = piles.get(key);
  if (m) return m;
  m = [];
  const r = (k: number) => hash3(key, k, 83);
  const n = 3 + ((r(0) * 4) | 0);
  for (let k = 0; k < n; k++) {
    const x = (r(k * 4 + 1) - 0.5) * 2, y = (r(k * 4 + 2) - 0.5) * 2, kind = r(k * 4 + 3);
    if (kind < 0.5) { const s = 0.2 + 0.35 * r(k * 4 + 4); m.push(part(Box, x - s, y - s * 0.8, 0, x + s, y + s * 0.8, s * 1.4, [105, 100, 95], Solid, '#', '%', '#')); }
    else if (kind < 0.8) m.push(part(Box, x - 0.9, y - 0.1, 0, x + 0.9, y + 0.1, 0.08 + 0.3 * r(k * 4 + 4), WOOD, Solid, '=', '='));
    else m.push(part(Cyl, x - 0.35, y - 0.35, 0, x + 0.35, y + 0.35, 0.22, TIRE, Solid, 'o', '0'));
  }
  m.push(part(Ball, -1.2, -1, -0.3, 1.2, 1, 0.45, [80, 76, 72], Solid, ':'));
  piles.set(key, m);
  return m;
}

/** Cordon floodlight tower: a lattice mast with a bank of lamps facing +x. */
export const FLOOD: Part[] = [
  part(Box, -0.25, -0.25, 0, 0.25, 0.25, 13, STEEL, Solid, 'x', '=', 'x'),
  part(Box, -0.1, -0.9, 12.6, 0.2, 0.9, 12.8, STEEL, Solid, '=', '='),
  part(Box, 0.2, -0.8, 12.8, 0.5, 0.8, 14.2, [255, 250, 225], Glow, '#'),
];
