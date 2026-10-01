import { hash3 } from '../core/rng';
import { type RGB } from '../sim/city';
import { Mat, part, Shape, type Part } from './objects';

const { Box, Cyl, Ball } = Shape;
const { Solid, Leaf, Glow, Text, Board } = Mat;

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

const blades = new Map<string, Part[]>();
/** Height of a blade sign's panel: its letters, a square symbol on top if it has one, and the frame. */
export function bladeHeight(text: string, sym: number, letter: number) {
  return text.length * letter + (sym >= 0 ? letter * 1.04 : 0) + 0.3;
}
/** Reach of a blade sign from the wall. */
export function bladeReach(letter: number) {
  return 0.4 + letter * 1.2;
}
/**
 * Blade sign, sticking out of a wall along +x: two steel arms, a dark frame and the lit panel with
 * its word stacked from the top. `col` is the neon's color at its current brightness. A tall one
 * (bigger letters) has more arms and bulbs chasing up its two edges.
 */
export function bladeModel(text: string, sym: number, col: RGB, z0: number, letter: number, chase = 0): Part[] {
  const key = text + sym + col.join() + letter + chase;
  let m = blades.get(key);
  if (m) return m;
  const z1 = z0 + bladeHeight(text, sym, letter), x1 = bladeReach(letter), wy = 0.16 * letter / 0.75;
  m = [
    part(Box, 0.4, -wy, z0, x1, wy, z1, [40, 36, 44], Solid, '|', '=', '|'),
    part(Box, 0.46, -wy - 0.02, z0 + 0.15, x1 - 0.06, wy + 0.02, z1 - 0.15, col, Text, ' '),
  ];
  m[1].text = text;
  if (sym >= 0) m[1].sym = sym;
  const arms = letter > 1 ? 4 : 2;
  for (let k = 0; k < arms; k++) {
    const z = z0 + 0.3 + ((z1 - z0 - 0.6) * k) / (arms - 1);
    m.push(part(Box, 0, -0.04, z - 0.05, 0.4, 0.04, z + 0.05, STEEL, Solid, '-', '-', '|'));
  }
  if (letter > 1) {
    // bulbs up the front and back edges, every third one lit, climbing
    const n = Math.floor((z1 - z0) / 0.5);
    for (let k = 0; k < n && m.length < 30; k += 1) {
      if ((k + chase) % 3) continue;
      const z = z0 + 0.25 + k * 0.5;
      m.push(part(Box, x1 - 0.02, -wy - 0.06, z - 0.08, x1 + 0.06, wy + 0.06, z + 0.08, [255, 230, 160], Glow, 'o'));
    }
  }
  if (blades.size > 4000) blades.clear();
  blades.set(key, m);
  return m;
}

const dimmed = new Map<string, Part[]>();
/** A piece of street furniture with its lights (poster, phone sign) at power k, in eighths so models are reused. */
export function poweredFurniture(kind: string, k: number): Part[] {
  const q = Math.round(Math.min(1.25, k) * 8) / 8, key = kind + q;
  let m = dimmed.get(key);
  if (!m) {
    m = FURNITURE[kind].parts.map((p) => (p.mat === Mat.Glow ? { ...p, col: [p.col[0] * q, p.col[1] * q, p.col[2] * q] as RGB } : p));
    dimmed.set(key, m);
  }
  return m;
}

const GOODS: RGB[] = [[200, 60, 50], [60, 120, 200], [230, 200, 60], [80, 170, 90], [220, 220, 210]];
const furns = new Map<string, Part[]>();
/**
 * Furniture, facing +x (its front), centered, hx deep and hy wide (half sizes), as volumes like the
 * street furniture. Colors vary a little with the seed.
 */
export function furnitureModel(kind: string, seed: number, hx: number, hy: number): Part[] {
  const v = seed % 4, key = kind + v + hx.toFixed(2) + hy.toFixed(2);
  let m = furns.get(key);
  if (m) return m;
  const pick = <T>(a: T[]) => a[v % a.length];
  const WOOD = pick<RGB>([[120, 80, 50], [95, 65, 45], [140, 105, 70], [80, 60, 50]]);
  const FAB = pick<RGB>([[120, 60, 55], [60, 80, 120], [90, 110, 80], [130, 120, 100]]);
  const WHITE: RGB = [200, 200, 195], DARK: RGB = [45, 45, 50];
  switch (kind) {
    case 'bed': m = [
      part(Box, -hx, -hy, 0, hx, hy, 0.3, WOOD, Solid, '=', '='),
      part(Box, -hx + 0.05, -hy + 0.05, 0.3, hx - 0.05, hy - 0.05, 0.5, FAB, Solid, '~', '~'),
      part(Box, -hx + 0.05, -hy + 0.15, 0.5, -hx + 0.45, hy - 0.15, 0.62, WHITE, Solid, 'o', 'o'),
      part(Box, -hx, -hy, 0, -hx + 0.08, hy, 1.0, WOOD, Solid, '#', '=')]; break;
    case 'nightstand': m = [part(Box, -hx, -hy, 0, hx, hy, 0.55, WOOD, Solid, '=', '_'), part(Ball, -0.08, -0.08, 0.55, 0.08, 0.08, 0.8, [255, 220, 150], Glow, 'o')]; break;
    case 'sofa': m = [
      part(Box, -hx, -hy, 0.1, hx, hy, 0.45, FAB, Solid, '=', '~'),
      part(Box, -hx, -hy, 0.45, -hx + 0.22, hy, 0.85, FAB, Solid, '#', '='),
      part(Box, -hx, -hy, 0.45, hx, -hy + 0.18, 0.65, FAB, Solid, '#', '='),
      part(Box, -hx, hy - 0.18, 0.45, hx, hy, 0.65, FAB, Solid, '#', '=')]; break;
    case 'coffee': case 'table': m = [
      part(Box, -hx, -hy, kind === 'table' ? 0.72 : 0.38, hx, hy, kind === 'table' ? 0.77 : 0.43, WOOD, Solid, '-', '='),
      part(Box, -hx + 0.05, -hy + 0.05, 0, -hx + 0.1, -hy + 0.1, 0.72, WOOD, Solid, '|'),
      part(Box, hx - 0.1, hy - 0.1, 0, hx - 0.05, hy - 0.05, 0.72, WOOD, Solid, '|')]; break;
    case 'tv': m = [part(Box, -hx, -hy, 0, hx, hy, 0.5, WOOD, Solid, '=', '_'), part(Box, -0.05, -hy + 0.1, 0.5, 0.03, hy - 0.1, 1.15, DARK, Solid, '#'), part(Box, 0.03, -hy + 0.15, 0.55, 0.05, hy - 0.15, 1.1, [90, 140, 200], Glow, ':')]; break;
    case 'counter': m = [part(Box, -hx, -hy, 0, hx, hy, 0.88, WHITE, Solid, '#', '='), part(Box, -hx, -hy, 0.88, hx, hy, 0.93, [70, 70, 75], Solid, '-', '_')]; break;
    case 'fridge': m = [part(Box, -hx, -hy, 0, hx, hy, 1.8, WHITE, Solid, '|', '=', '|'), part(Box, hx, -hy + 0.1, 1.1, hx + 0.03, -hy + 0.15, 1.4, [150, 150, 155], Solid, '|')]; break;
    case 'tub': m = [part(Box, -hx, -hy, 0, hx, hy, 0.55, WHITE, Solid, '#', 'o'), part(Box, -hx + 0.1, -hy + 0.1, 0.35, hx - 0.1, hy - 0.1, 0.56, [110, 150, 170], Solid, '~')]; break;
    case 'toilet': m = [part(Ball, -hx + 0.1, -hy, 0, hx, hy, 0.42, WHITE, Solid, 'o'), part(Box, -hx, -hy, 0.3, -hx + 0.2, hy, 0.8, WHITE, Solid, '#', '=')]; break;
    case 'desk': m = [
      part(Box, -hx, -hy, 0.72, hx, hy, 0.76, WOOD, Solid, '-', '='),
      part(Box, -hx, -hy, 0, hx, -hy + 0.05, 0.72, WOOD, Solid, '|'), part(Box, -hx, hy - 0.05, 0, hx, hy, 0.72, WOOD, Solid, '|'),
      part(Box, -hx + 0.08, -0.25, 0.76, -hx + 0.14, 0.25, 1.1, DARK, Solid, '#'), part(Box, -hx + 0.14, -0.22, 0.79, -hx + 0.16, 0.22, 1.07, [120, 200, 160], Glow, ':')]; break;
    case 'chair': m = [part(Box, -hx, -hy, 0.42, hx, hy, 0.48, DARK, Solid, '=', '='), part(Box, -hx, -hy, 0.48, -hx + 0.08, hy, 0.95, DARK, Solid, '#'), part(Box, -0.04, -0.04, 0, 0.04, 0.04, 0.42, [90, 90, 95], Solid, '|')]; break;
    case 'shelf': {
      m = [part(Box, -hx, -hy, 0, hx, hy, 1.8, WOOD, Solid, '|', '=')];
      // goods on the shelves, in bright packaging
      for (let z = 0.3; z < 1.7; z += 0.42) for (let y = -hy + 0.1; y < hy - 0.2; y += 0.3) {
        const h = hash3(seed, Math.round(y * 10), Math.round(z * 10));
        if (h < 0.25) continue;
        m.push(part(Box, hx - 0.02, y, z, hx + 0.02, y + 0.22, z + 0.25, GOODS[(h * GOODS.length) | 0], Solid, '#'));
      }
      break;
    }
    case 'till': m = [part(Box, -hx, -hy, 0, hx, hy, 1.0, WOOD, Solid, '#', '='), part(Box, -0.15, -0.2, 1.0, 0.1, 0.2, 1.25, DARK, Solid, '#'), part(Box, 0.1, -0.15, 1.05, 0.12, 0.15, 1.2, [120, 255, 140], Glow, ':')]; break;
    case 'reception': m = [part(Box, -hx, -hy, 0, hx, hy, 1.05, [70, 60, 55], Solid, '#', '='), part(Box, -hx, -hy, 1.05, hx + 0.1, hy, 1.12, [170, 160, 140], Solid, '-', '_')]; break;
    case 'plant': m = [part(Cyl, -hx * 0.6, -hy * 0.6, 0, hx * 0.6, hy * 0.6, 0.4, [150, 90, 60], Solid, '|', 'o'), part(Ball, -hx, -hy, 0.35, hx, hy, 1.2, [60, 130, 70], Leaf, '@')]; break;
    default: m = [part(Box, -hx, -hy, 0, hx, hy, 0.8, WOOD, Solid, '#')];
  }
  furns.set(key, m);
  return m;
}

const escapes = new Map<string, Part[]>();
/**
 * One storey of a fire escape, facing +x out of the wall, centered along it (2 bays): the landing's
 * grating at z 0 with its rails (from the first floor up), and the flight up to the next landing in
 * the outer half, climbing toward +y (up) or -y.
 */
export function escapeModel(landing: boolean, flight: number, half: number, odd: boolean): Part[] {
  const key = `${landing}${flight}${half}${odd}`;
  let m = escapes.get(key);
  if (m) return m;
  const IRON: RGB = [95, 95, 105];
  m = [];
  if (landing) {
    m.push(part(Box, 0.02, -half, -0.06, 1, half, 0, IRON, Solid, '=', '#'));
    m.push(part(Box, 0.96, -half, 0, 1, half, 1, IRON, Solid, '|', '-'));
    m.push(part(Box, 0.02, -half, 0, 1, -half + 0.04, 1, IRON, Solid, '|', '-'));
    m.push(part(Box, 0.02, half - 0.04, 0, 1, half, 1, IRON, Solid, '|', '-'));
  }
  if (flight) {
    for (let i = 0; i < 10; i++) {
      const u = (i + 0.5) / 10, y = -half + 2 * half * (flight > 0 ? u : 1 - u), z = 3.5 * (i + 1) / 10;
      m.push(part(Box, odd ? 0.73 : 0.46, y - half / 10, z - 0.04, odd ? 0.97 : 0.71, y + half / 10, z, IRON, Solid, '_', '='));
    }
    m.push(part(Box, 0.95, -half, 0.9, 0.99, half, 0.95, IRON, Solid, '/', '-'));
  }
  escapes.set(key, m);
  return m;
}

const shedModels = new Map<number, Part[]>();
/**
 * A piece of sidewalk shed, `len` long along the wall (y), 2.6 m out (x, from -1.3 to 1.3, the wall
 * at -1.3): a green plywood deck at 3 m on steel posts at the curb side, with a lit bulb under it.
 */
export function shedModel(len: number): Part[] {
  const key = Math.round(len * 10);
  let m = shedModels.get(key);
  if (m) return m;
  const h = len / 2, PLY: RGB = [55, 95, 60], PIPE: RGB = [120, 120, 125];
  m = [
    part(Box, -1.3, -h, 3, 1.3, h, 3.25, PLY, Solid, '=', '#'),
    part(Box, 1.25, -h, 3.25, 1.3, h, 4.1, PLY, Solid, '#', '='),
    part(Box, 1.15, -h + 0.05, 0, 1.25, -h + 0.15, 3, PIPE, Solid, '|'),
    part(Box, 1.15, h - 0.15, 0, 1.25, h - 0.05, 3, PIPE, Solid, '|'),
    part(Box, 1.15, -h, 2.85, 1.25, h, 2.95, PIPE, Solid, '-'),
    part(Ball, -0.08, -0.08, 2.75, 0.08, 0.08, 2.95, [255, 225, 160], Glow, 'o'),
  ];
  shedModels.set(key, m);
  return m;
}

const boards = new Map<string, Part[]>();
/**
 * Rooftop billboard facing +x, w wide and h tall, standing on a roof at height `base` with its
 * panel's foot at `top` (both world heights): a painted panel with `text` (fg on bg), steel legs and braces behind it, a catwalk along
 * its foot and gooseneck lamps over the catwalk, lit at `lamp` (0..1, in eighths).
 */
export function boardModel(text: string, w: number, h: number, base: number, top: number, bg: RGB, fg: RGB, lamp: number): Part[] {
  const key = `${text}|${w.toFixed(1)}|${h.toFixed(1)}|${base.toFixed(1)}|${top.toFixed(1)}|${bg.join()}|${fg.join()}|${lamp}`;
  let m = boards.get(key);
  if (m) return m;
  const hw = w / 2, z0 = top, z1 = top + h;
  m = [part(Box, -0.12, -hw, z0, 0.12, hw, z1, [70, 70, 75], Board, '#', '=', '#')];
  m[0].text = text; m[0].col = bg; m[0].col2 = fg; m[0].lamp = lamp;
  // legs and braces behind the panel
  const legs = Math.max(2, Math.round(w / 4) + 1);
  for (let k = 0; k < legs; k++) {
    const y = -hw + 0.4 + ((w - 0.8) * k) / (legs - 1);
    m.push(part(Box, -0.5, y - 0.1, base, -0.3, y + 0.1, z1 - 0.3, STEEL, Solid, '|', '.'));
    m.push(part(Box, -0.3, y - 0.05, z0 - 0.2, -0.12, y + 0.05, z1 - 0.3, STEEL, Solid, '|'));
  }
  m.push(part(Box, -0.5, -hw, (base + z0) / 2 - 0.06, -0.3, hw, (base + z0) / 2 + 0.06, STEEL, Solid, '-', '='));
  // catwalk with its rail, and the lamps on their arms
  m.push(part(Box, 0.12, -hw, z0 - 0.12, 0.95, hw, z0 - 0.02, STEEL, Solid, '=', '#'));
  m.push(part(Box, 0.9, -hw, z0 - 0.02, 0.95, hw, z0 + 0.06, STEEL, Solid, '-'));
  const lamps = Math.max(2, Math.round(w / 3.5));
  for (let k = 0; k < lamps && m.length < 31; k++) {
    const y = -hw + (w * (k + 0.5)) / lamps;
    m.push(part(Box, 0.75, y - 0.12, z0 + 0.06, 1.0, y + 0.12, z0 + 0.22, lamp > 0.05 ? [255 * lamp + 40, 235 * lamp + 38, 190 * lamp + 36] : [70, 70, 72], lamp > 0.05 ? Glow : Solid, lamp > 0.05 ? '*' : '-'));
  }
  if (boards.size > 2000) boards.clear();
  boards.set(key, m);
  return m;
}
