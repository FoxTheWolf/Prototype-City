import { type Rng } from '../core/rng';

export const BLOCKS = 12;
/** Tiles per block (road + sidewalk + lots). */
export const BS = 12;
/** City side in tiles. */
export const N = BLOCKS * BS;

export const Tile = { Road: 0, Walk: 1, Building: 2, Park: 3 } as const;

export type RGB = readonly [number, number, number];

export interface Building {
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

export interface City {
  tiles: Uint8Array;
  /** Building id per tile, -1 when none. */
  bid: Int32Array;
  buildings: Building[];
  props: Prop[];
}

const WIN: RGB[] = [[255, 206, 110], [120, 220, 255], [90, 150, 255], [255, 150, 70], [190, 255, 170], [255, 130, 200], [255, 240, 200]];
const FRAME: RGB[] = [[92, 72, 50], [58, 66, 88], [76, 60, 84], [52, 64, 62], [88, 80, 70]];

export function generateCity(rng: Rng): City {
  const tiles = new Uint8Array(N * N);
  const bid = new Int32Array(N * N).fill(-1);
  const buildings: Building[] = [];
  const props: Prop[] = [];
  const pick = <T>(a: T[]) => a[(rng() * a.length) | 0];
  const splits = () => {
    const r = rng();
    return r < 0.25 ? [7] : r < 0.5 ? [3, 4] : r < 0.75 ? [4, 3] : [2, 3, 2];
  };

  for (let by = 0; by < BLOCKS; by++) for (let bx = 0; bx < BLOCKS; bx++) {
    const isPark = rng() < 0.09 && !(bx === 6 && by === 6);
    for (let ly = 0; ly < BS; ly++) for (let lx = 0; lx < BS; lx++) {
      const i = (by * BS + ly) * N + bx * BS + lx;
      if (lx < 3 || ly < 3) tiles[i] = Tile.Road;
      else if (lx === 3 || lx === 11 || ly === 3 || ly === 11) tiles[i] = Tile.Walk;
      else tiles[i] = isPark ? Tile.Park : Tile.Building;
    }
    // street lamps at the four sidewalk corners
    for (const [ox, oy] of [[3.5, 3.5], [11.5, 3.5], [3.5, 11.5], [11.5, 11.5]]) {
      props.push({ kind: 'lamp', x: bx * BS + ox, y: by * BS + oy, w: 0.25, z1: 1.7, seed: 0 });
    }
    if (isPark) {
      for (let t = 0; t < 9; t++) {
        props.push({ kind: 'tree', x: bx * BS + 4.6 + rng() * 5.8, y: by * BS + 4.6 + rng() * 5.8, w: 1.3, z1: 1.9 + rng() * 0.8, seed: (rng() * 1e6) | 0 });
      }
      continue;
    }
    const d = Math.hypot(bx - 5.5, by - 5.5) / 7.8;
    let x0 = 4;
    for (const sw of splits()) {
      let y0 = 4;
      for (const sh of splits()) {
        const id = buildings.length;
        let h = 1.6 + Math.pow(Math.max(0, 1 - d), 2) * 20 * (0.35 + rng() * 0.9) + rng() * 2.5;
        if (rng() < 0.08) h *= 1.7;
        buildings.push({ h, win: pick(WIN), frame: pick(FRAME), lit: 0.18 + rng() * 0.5, shop: rng() < 0.6, sign: pick(WIN) });
        for (let yy = 0; yy < sh; yy++) for (let xx = 0; xx < sw; xx++) bid[(by * BS + y0 + yy) * N + bx * BS + x0 + xx] = id;
        y0 += sh;
      }
      x0 += sw;
    }
  }
  return { tiles, bid, buildings, props };
}

export function isSolid(city: City, x: number, y: number): boolean {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= N || ty >= N) return true;
  return city.tiles[ty * N + tx] === Tile.Building;
}
