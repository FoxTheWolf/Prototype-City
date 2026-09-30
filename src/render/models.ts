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
/** Street lamp: a pole on a base, with an arm reaching over the street (+x) to the lamp head. */
export function lampModel(light: RGB): Part[] {
  const key = light.join();
  let m = lamps.get(key);
  if (m) return m;
  const s = 255 / Math.max(...light), head: RGB = [light[0] * s, light[1] * s, light[2] * s];
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

/** Cordon floodlight tower: a lattice mast with a bank of lamps facing +x. */
export const FLOOD: Part[] = [
  part(Box, -0.25, -0.25, 0, 0.25, 0.25, 13, STEEL, Solid, 'x', '=', 'x'),
  part(Box, -0.1, -0.9, 12.6, 0.2, 0.9, 12.8, STEEL, Solid, '=', '='),
  part(Box, 0.2, -0.8, 12.8, 0.5, 0.8, 14.2, [255, 250, 225], Glow, '#'),
];
