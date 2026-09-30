import { hash3, mulberry32, type Rng } from '../core/rng';

// 1 world unit = 1 metre.
export const FLOOR_H = 3.5;
/** Sidewalk ring inside every block, measured from the curb. */
export const SIDEWALK = 4;
export const LANE_W = 3.5;

export type RGB = readonly [number, number, number];

/** An axis-aligned box standing on the ground. Towers with setbacks are several nested boxes. */
export interface Building {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  h: number;
  win: RGB;
  frame: RGB;
  lit: number;
  shop: boolean;
  sign: RGB;
}

export interface Prop {
  kind: 'lamp' | 'tree';
  x: number;
  y: number;
  w: number;
  z1: number;
  seed: number;
}

export interface Block {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  park: boolean;
  /** This block's buildings are city.buildings[b0 .. b1). */
  b0: number;
  b1: number;
  /** Tallest building, so the renderer can skip blocks hidden behind nearer ones. */
  maxH: number;
  props: Prop[];
}

/**
 * The street grid is a list of boundaries per axis. Cell c spans [xb[c], xb[c+1]]:
 * even cells are roads, odd cells are blocks. The city starts and ends with a road.
 */
export interface City {
  w: number;
  h: number;
  xb: number[];
  yb: number[];
  /** Cell index for every whole metre, so a point lookup is one array read. */
  xCell: Uint16Array;
  yCell: Uint16Array;
  /** Blocks per row and per column. Block (i, j) is blocks[j * nbx + i]. */
  nbx: number;
  nby: number;
  blocks: Block[];
  buildings: Building[];
  /** Middle of downtown, where the towers are. */
  cx: number;
  cy: number;
}

const WIN: RGB[] = [[255, 206, 110], [120, 220, 255], [90, 150, 255], [255, 150, 70], [190, 255, 170], [255, 130, 200], [255, 240, 200]];
const FRAME: RGB[] = [[92, 72, 50], [58, 66, 88], [76, 60, 84], [52, 64, 62], [88, 80, 70]];

/** Road/block boundaries along one axis: a wide road every `wideEvery` roads, blocks of random length between. */
function layoutAxis(rng: Rng, size: number, blockMin: number, blockMax: number, road: number, wide: number, wideEvery: number): number[] {
  const b = [0, wide];
  let x = wide;
  for (let k = 1; ; k++) {
    const blk = blockMin + Math.round(rng() * (blockMax - blockMin));
    const w = k % wideEvery === 0 ? wide : road;
    if (x + blk + w > size) break;
    b.push(x + blk, x + blk + w);
    x += blk + w;
  }
  return b;
}

function cellTable(b: number[]): Uint16Array {
  const t = new Uint16Array(b[b.length - 1]);
  for (let c = 0; c < b.length - 1; c++) t.fill(c, b[c], b[c + 1]);
  return t;
}

/** Number of lanes in each direction of road k (the road is the even cell 2k). */
export function lanesOf(b: number[], k: number): number {
  return Math.floor((b[2 * k + 1] - b[2 * k]) / 2 / LANE_W);
}

export function roadCenter(b: number[], k: number): number {
  return (b[2 * k] + b[2 * k + 1]) / 2;
}

/**
 * American grid city of about size x size metres: avenues run north-south, streets east-west,
 * towers downtown and low houses at the edges. Every block draws from its own seed, taken from
 * the city seed and its position, so a building is the same whatever else changes.
 */
export function generateCity(seed: number, size: number): City {
  const rng = mulberry32(seed);
  const xb = layoutAxis(rng, size, 150, 200, 21, 28, 4);
  const yb = layoutAxis(rng, size, 60, 80, 14, 21, 5);
  const w = xb[xb.length - 1], h = yb[yb.length - 1];
  const nbx = (xb.length - 2) / 2, nby = (yb.length - 2) / 2;
  const cx = w * (0.4 + rng() * 0.2), cy = h * (0.4 + rng() * 0.2);
  const radius = Math.min(w, h) / 2;
  const blocks: Block[] = [];
  const buildings: Building[] = [];

  for (let j = 0; j < nby; j++) for (let i = 0; i < nbx; i++) {
    const br = mulberry32((hash3(seed, i, j) * 4294967296) | 0);
    const pick = <T>(a: T[]) => a[(br() * a.length) | 0];
    const x0 = xb[2 * i + 1], x1 = xb[2 * i + 2], y0 = yb[2 * j + 1], y1 = yb[2 * j + 2];
    // 1 downtown, ~0 at the edges of the city
    const core = Math.exp(-((Math.hypot((x0 + x1) / 2 - cx, (y0 + y1) / 2 - cy) / radius / 0.35) ** 2));
    const park = br() < 0.02 + 0.05 * (1 - core);
    const block: Block = { x0, y0, x1, y1, park, b0: buildings.length, b1: 0, maxH: 0, props: [] };
    blocks.push(block);

    // street lamps along the curb, about every 28 m
    const L = 0.8;
    const corners = [[x0 + L, y0 + L], [x1 - L, y0 + L], [x1 - L, y1 - L], [x0 + L, y1 - L]];
    for (let e = 0; e < 4; e++) {
      const [ax, ay] = corners[e], [bx, by] = corners[(e + 1) % 4];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 28));
      for (let k = 0; k < n; k++) block.props.push({ kind: 'lamp', x: ax + ((bx - ax) * k) / n, y: ay + ((by - ay) * k) / n, w: 0.3, z1: 6.5, seed: 0 });
    }

    const ix0 = x0 + SIDEWALK, iy0 = y0 + SIDEWALK, ix1 = x1 - SIDEWALK, iy1 = y1 - SIDEWALK;
    if (park) {
      const trees = Math.round(((ix1 - ix0) * (iy1 - iy0)) / 140);
      for (let t = 0; t < trees; t++) {
        block.props.push({ kind: 'tree', x: ix0 + 2 + br() * (ix1 - ix0 - 4), y: iy0 + 2 + br() * (iy1 - iy0 - 4), w: 3.5 + br() * 2, z1: 5 + br() * 4, seed: (br() * 1e6) | 0 });
      }
      block.b1 = buildings.length;
      continue;
    }

    // split the block into lots; downtown lots are bigger, for towers
    const maxLot = 14 + 36 * core;
    const lot = (ax0: number, ay0: number, ax1: number, ay1: number) => {
      const lw = ax1 - ax0, lh = ay1 - ay0;
      if (Math.max(lw, lh) > maxLot) {
        const t = 0.35 + br() * 0.3;
        if (lw >= lh) { const s = Math.round(ax0 + lw * t); lot(ax0, ay0, s, ay1); lot(s, ay0, ax1, ay1); }
        else { const s = Math.round(ay0 + lh * t); lot(ax0, ay0, ax1, s); lot(ax0, s, ax1, ay1); }
        return;
      }
      if (br() < 0.06) return; // empty lot
      let floors = Math.max(1, Math.round((3 + 55 * core ** 1.5) * (0.35 + br() * 0.9)));
      if (br() < 0.05) floors = Math.round(floors * 1.5);
      const style = { win: pick(WIN), frame: pick(FRAME), lit: 0.18 + br() * 0.5, shop: br() < 0.3 + 0.4 * core, sign: pick(WIN) };
      // towers stand back from the lot edge and step in as they rise
      let inset = floors > 25 && Math.min(lw, lh) > 20 ? 2 + br() * 3 : 0;
      const tiers = floors > 30 ? 1 + ((br() * 3) | 0) : 1;
      for (let k = 1; k <= tiers; k++) {
        if (Math.min(lw, lh) - 2 * inset < 8) break;
        const f = k === tiers ? floors : Math.round(floors * (0.3 + (0.6 * k) / tiers) * (0.8 + br() * 0.2));
        const bh = f * FLOOR_H + 1;
        buildings.push({ x0: ax0 + inset, y0: ay0 + inset, x1: ax1 - inset, y1: ay1 - inset, h: bh, ...style, shop: style.shop && k === 1 });
        block.maxH = Math.max(block.maxH, bh);
        inset += 3 + br() * 3;
      }
    };
    lot(ix0, iy0, ix1, iy1);
    block.b1 = buildings.length;
  }

  return { w, h, xb, yb, xCell: cellTable(xb), yCell: cellTable(yb), nbx, nby, blocks, buildings, cx, cy };
}

/** The block containing a point, or null on a road or outside the city. */
export function blockAt(city: City, x: number, y: number): Block | null {
  if (x < 0 || y < 0 || x >= city.w || y >= city.h) return null;
  const cx = city.xCell[x | 0], cy = city.yCell[y | 0];
  if (!(cx & 1) || !(cy & 1)) return null;
  return city.blocks[(cy >> 1) * city.nbx + (cx >> 1)];
}

export function isSolid(city: City, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= city.w || y >= city.h) return true;
  const b = blockAt(city, x, y);
  if (!b) return false;
  for (let k = b.b0; k < b.b1; k++) {
    const B = city.buildings[k];
    if (x >= B.x0 && x < B.x1 && y >= B.y0 && y < B.y1) return true;
  }
  return false;
}
