import { hash3, mulberry32, type Rng } from '../core/rng';

// 1 world unit = 1 metre.
export const FLOOR_H = 3.5;
/** Sidewalk ring inside every block, measured from the curb. */
export const SIDEWALK = 4;
export const LANE_W = 3.5;

export type RGB = readonly [number, number, number];

/** How a facade looks. Chosen per lot from the district type; drawn by the renderer. */
export type Facade = 'office' | 'glass' | 'brick' | 'historic' | 'residential' | 'warehouse';

/** An axis-aligned box standing on the ground. Towers with setbacks are several nested boxes. */
export interface Building {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  h: number;
  style: Facade;
  win: RGB;
  frame: RGB;
  lit: number;
  shop: boolean;
  sign: RGB;
  /** Random per lot, for variants within a style (balconies, fire escapes). Shared by all tiers of a tower. */
  feat: number;
}

export interface Prop {
  kind: 'lamp' | 'tree';
  x: number;
  y: number;
  w: number;
  z1: number;
  seed: number;
}

export type DistrictType = 'financial' | 'commercial' | 'residential' | 'historic' | 'industrial';

/** A named part of the city. Its blocks are the ones closer to (x, y) than to any other district's point. */
export interface District {
  type: DistrictType;
  x: number;
  y: number;
  /** Random number the name formatter uses to choose a name pattern. */
  pick: number;
}

/** How each district type shapes its blocks. */
const KIND: Record<DistrictType, { base: number; tall: number; cap: number; lot: number; lotCore: number; park: number; empty: number; shop: number }> = {
  //            floors at the edge, x downtown growth, max floors, lot size (+ downtown), park/empty/shop chance
  financial: { base: 3, tall: 1, cap: 999, lot: 14, lotCore: 36, park: 0.02, empty: 0.04, shop: 0.6 },
  commercial: { base: 3, tall: 0.7, cap: 30, lot: 14, lotCore: 20, park: 0.03, empty: 0.06, shop: 0.8 },
  residential: { base: 3, tall: 0.5, cap: 14, lot: 12, lotCore: 10, park: 0.08, empty: 0.05, shop: 0.12 },
  historic: { base: 4, tall: 0.3, cap: 9, lot: 10, lotCore: 8, park: 0.07, empty: 0.02, shop: 0.5 },
  industrial: { base: 1.5, tall: 0.1, cap: 4, lot: 30, lotCore: 20, park: 0.01, empty: 0.15, shop: 0.04 },
};

/** Map sectors per side (the city is split into sectors x sectors squares for map codes like "C3"). */
const SECTORS = 4;
/** Rough side of a district in metres. */
const DISTRICT_SIZE = 400;

export interface Block {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  district: number;
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
  districts: District[];
  sectors: number;
  /** Chooses the words of every place name (see locale/names.ts). */
  nameSeed: number;
}

/**
 * Districts on a jittered grid. Downtown is financial, the ring around it commercial with one or
 * two historic districts, the outskirts residential, except for an industrial wedge on one side.
 */
function placeDistricts(rng: Rng, w: number, h: number, cx: number, cy: number, radius: number): District[] {
  const nx = Math.max(1, Math.round(w / DISTRICT_SIZE)), ny = Math.max(1, Math.round(h / DISTRICT_SIZE));
  const pts: { x: number; y: number; core: number }[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = ((i + 0.2 + rng() * 0.6) * w) / nx, y = ((j + 0.2 + rng() * 0.6) * h) / ny;
    pts.push({ x, y, core: coreAt(x, y, cx, cy, radius) });
  }
  const types: DistrictType[] = pts.map((p) => (p.core > 0.5 ? 'financial' : p.core > 0.12 ? 'commercial' : 'residential'));
  let center = 0;
  pts.forEach((p, k) => { if (p.core > pts[center].core) center = k; });
  types[center] = 'financial';
  const ring = types.map((t, k) => (t === 'commercial' ? k : -1)).filter((k) => k >= 0);
  for (let n = rng() < 0.5 ? 2 : 1; n > 0 && ring.length; n--) types[ring.splice((rng() * ring.length) | 0, 1)[0]] = 'historic';
  const wedge = rng() * 2 * Math.PI;
  pts.forEach((p, k) => {
    const da = Math.abs(((Math.atan2(p.y - cy, p.x - cx) - wedge + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    if (types[k] === 'residential' && da < 0.7) types[k] = 'industrial';
  });
  return pts.map((p, k) => ({ type: types[k], x: p.x, y: p.y, pick: (rng() * 1e9) | 0 }));
}

/** 1 downtown, ~0 at the edges of the city. */
function coreAt(x: number, y: number, cx: number, cy: number, radius: number) {
  return Math.exp(-((Math.hypot(x - cx, y - cy) / radius / 0.35) ** 2));
}

const WIN: RGB[] = [[255, 206, 110], [120, 220, 255], [90, 150, 255], [255, 150, 70], [190, 255, 170], [255, 130, 200], [255, 240, 200]];
const WARM: RGB[] = [[255, 206, 110], [255, 170, 90], [255, 240, 200], [150, 190, 255]];
const FRAME: RGB[] = [[92, 72, 50], [58, 66, 88], [76, 60, 84], [52, 64, 62], [88, 80, 70]];

/** Per style: wall colors, window colors, share of lit windows [min, max]. */
const LOOK: Record<Facade, { frame: RGB[]; win: RGB[]; lit: [number, number] }> = {
  office: { frame: FRAME, win: WIN, lit: [0.18, 0.68] },
  glass: { frame: [[40, 90, 120], [30, 105, 100], [50, 70, 130], [85, 60, 115], [30, 85, 70], [110, 95, 60]], win: WIN, lit: [0.15, 0.55] },
  brick: { frame: [[120, 52, 38], [100, 60, 45], [130, 72, 50], [85, 45, 40], [110, 80, 60]], win: WARM, lit: [0.2, 0.55] },
  historic: { frame: [[140, 125, 100], [120, 110, 95], [150, 130, 110], [110, 100, 90], [130, 100, 80]], win: WARM, lit: [0.15, 0.45] },
  residential: { frame: [[90, 95, 110], [110, 90, 80], [80, 100, 90], [120, 110, 90], [100, 85, 100]], win: WARM, lit: [0.2, 0.6] },
  warehouse: { frame: [[80, 85, 90], [95, 80, 65], [70, 78, 72], [100, 70, 55]], win: [[200, 220, 180], [255, 200, 120]], lit: [0.05, 0.25] },
};

/** Facade styles per district type, as [style, weight]. */
const MIX: Record<DistrictType, [Facade, number][]> = {
  financial: [['glass', 45], ['office', 40], ['historic', 15]],
  commercial: [['office', 40], ['brick', 25], ['glass', 15], ['residential', 20]],
  residential: [['residential', 55], ['brick', 45]],
  historic: [['historic', 65], ['brick', 35]],
  industrial: [['warehouse', 75], ['brick', 25]],
};

function pickStyle(r: number, mix: [Facade, number][]): Facade {
  let total = 0;
  for (const [, w] of mix) total += w;
  r *= total;
  for (const [s, w] of mix) { if (r < w) return s; r -= w; }
  return mix[0][0];
}

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
  const districts = placeDistricts(rng, w, h, cx, cy, radius);
  const nameSeed = (rng() * 1e9) | 0;
  const blocks: Block[] = [];
  const buildings: Building[] = [];

  for (let j = 0; j < nby; j++) for (let i = 0; i < nbx; i++) {
    const br = mulberry32((hash3(seed, i, j) * 4294967296) | 0);
    const pick = <T>(a: T[]) => a[(br() * a.length) | 0];
    const x0 = xb[2 * i + 1], x1 = xb[2 * i + 2], y0 = yb[2 * j + 1], y1 = yb[2 * j + 2];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const core = coreAt(mx, my, cx, cy, radius);
    let district = 0;
    districts.forEach((d, k) => { if (Math.hypot(d.x - mx, d.y - my) < Math.hypot(districts[district].x - mx, districts[district].y - my)) district = k; });
    const K = KIND[districts[district].type];
    const park = br() < K.park;
    const block: Block = { x0, y0, x1, y1, district, park, b0: buildings.length, b1: 0, maxH: 0, props: [] };
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
    const maxLot = K.lot + K.lotCore * core;
    const lot = (ax0: number, ay0: number, ax1: number, ay1: number) => {
      const lw = ax1 - ax0, lh = ay1 - ay0;
      if (Math.max(lw, lh) > maxLot) {
        const t = 0.35 + br() * 0.3;
        if (lw >= lh) { const s = Math.round(ax0 + lw * t); lot(ax0, ay0, s, ay1); lot(s, ay0, ax1, ay1); }
        else { const s = Math.round(ay0 + lh * t); lot(ax0, ay0, ax1, s); lot(ax0, s, ax1, ay1); }
        return;
      }
      if (br() < K.empty) return; // empty lot
      let floors = Math.max(1, Math.round((K.base + 55 * K.tall * core ** 1.5) * (0.35 + br() * 0.9)));
      if (br() < 0.05) floors = Math.round(floors * 1.5);
      floors = Math.min(floors, K.cap);
      const facade = pickStyle(br(), MIX[districts[district].type]), look = LOOK[facade];
      const style = {
        style: facade, win: pick(look.win), frame: pick(look.frame), lit: look.lit[0] + br() * (look.lit[1] - look.lit[0]),
        shop: facade !== 'warehouse' && br() < K.shop, sign: pick(WIN), feat: br(),
      };
      // warehouses have one or two tall open floors
      if (facade === 'warehouse') floors = Math.min(floors, 2);
      // towers stand back from the lot edge and step in as they rise
      let inset = floors > 25 && Math.min(lw, lh) > 20 ? 2 + br() * 3 : 0;
      const tiers = floors > 30 ? 1 + ((br() * 3) | 0) : 1;
      for (let k = 1; k <= tiers; k++) {
        if (Math.min(lw, lh) - 2 * inset < 8) break;
        const f = k === tiers ? floors : Math.round(floors * (0.3 + (0.6 * k) / tiers) * (0.8 + br() * 0.2));
        const bh = f * (facade === 'warehouse' ? 5 : FLOOR_H) + 1;
        buildings.push({ x0: ax0 + inset, y0: ay0 + inset, x1: ax1 - inset, y1: ay1 - inset, h: bh, ...style, shop: style.shop && k === 1 });
        block.maxH = Math.max(block.maxH, bh);
        inset += 3 + br() * 3;
      }
    };
    lot(ix0, iy0, ix1, iy1);
    block.b1 = buildings.length;
  }

  return { w, h, xb, yb, xCell: cellTable(xb), yCell: cellTable(yb), nbx, nby, blocks, buildings, cx, cy, districts, sectors: SECTORS, nameSeed };
}

/** District of the block nearest to a point (roads belong to the block beside them). */
export function districtAt(city: City, x: number, y: number): number {
  const i = Math.min(city.nbx - 1, (city.xCell[Math.min(city.w - 1, Math.max(0, x | 0))] - 1) >> 1);
  const j = Math.min(city.nby - 1, (city.yCell[Math.min(city.h - 1, Math.max(0, y | 0))] - 1) >> 1);
  return city.blocks[Math.max(0, j) * city.nbx + Math.max(0, i)].district;
}

/** Index of the road nearest to coordinate v along one axis (b = city.xb gives avenues, city.yb streets). */
export function nearestRoad(b: number[], cells: Uint16Array, v: number): number {
  const c = cells[Math.min(cells.length - 1, Math.max(0, v | 0))];
  if (!(c & 1)) return c >> 1;
  return v - b[c] < b[c + 1] - v ? c >> 1 : (c >> 1) + 1;
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
