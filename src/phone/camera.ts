import { hash3 } from '../core/rng';
import { CharGrid } from '../render/grid';

/**
 * The phone's camera. A photo is a small render of what the player sees, kept as glyph data (a few
 * KB): the same idea the city's social network will use for its citizens' photos (stage 12). Its
 * size follows the camera's megapixels, and in the dark it turns grainy and dim, as phone cameras
 * of 2008 did. The phone sees the world through `render` (main hands it the player's view).
 */
export interface Photo {
  w: number;
  h: number;
  cells: Uint8ClampedArray;
  bg: Uint8ClampedArray;
  /** Game time it was taken, where, and its size on the phone's storage. */
  at: number;
  x: number;
  y: number;
  kb: number;
}

/** Columns of a photo for a camera of so many megapixels (rows follow at half, as the cells are tall). */
export const photoCols = (mp: number) => (mp >= 3 ? 84 : mp >= 2 ? 64 : mp >= 1 ? 52 : 32);

const grids = new Map<string, CharGrid>();
function gridOf(w: number, h: number) {
  const k = `${w}x${h}`;
  let g = grids.get(k);
  if (!g) { g = new CharGrid(w, h); grids.set(k, g); }
  return g;
}

/**
 * Render the view into a w x h grid, as the sensor sees it: in poor light (`light`, about 0..1.5)
 * darker and grainy, the grain changing with `frame` (live) or fixed (a photo).
 */
export function expose(render: (g: CharGrid) => void, w: number, h: number, light: number, frame: number): CharGrid {
  const g = gridOf(w, h);
  render(g);
  const dark = Math.max(0, Math.min(1, (0.7 - light) / 0.6)), gain = 1 + dark * 0.6;
  if (dark > 0.02) for (let i = 0; i < w * h; i++) {
    const n = hash3(frame, i, 77), k = i * 4;
    // sensor noise: the dim picture pushed brighter, specks of color, glyphs lost to grain
    for (let c = 0; c < 3; c++) {
      const sp = (hash3(frame, i, 78 + c) - 0.5) * 90 * dark;
      g.cells[k + 1 + c] = g.cells[k + 1 + c] * gain + sp;
      g.bg[k + c] = g.bg[k + c] * gain + sp * 0.5;
    }
    if (n < dark * 0.25) g.cells[k] = n < dark * 0.1 ? 58 : 46;
  }
  return g;
}

export function takePhoto(render: (g: CharGrid) => void, mp: number, light: number, at: number, x: number, y: number, seed: number): Photo {
  const w = photoCols(mp), h = Math.round(w / 2), g = expose(render, w, h, light, seed ^ Math.floor(at));
  return { w, h, cells: g.cells.slice(), bg: g.bg.slice(), at, x, y, kb: Math.round(mp * 280 + hash3(seed, at, 5) * 120) };
}
