import { hash3 } from '../core/rng';
import { CharGrid } from '../render/grid';
import { SHAPE } from '../render/atlas';

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
function gridOf(w: number, h: number, tag = '') {
  const k = `${tag}${w}x${h}`;
  let g = grids.get(k);
  if (!g) { g = new CharGrid(w, h); grids.set(k, g); }
  return g;
}

/** How much of a cell a glyph covers, roughly: a cell's color is its background mixed toward its glyph's by this. */
function cover(c: number): number {
  if (c === 0 || c === 32) return 0;
  if (c >= 128 && c <= 131) return [1, 0.75, 0.5, 0.25][c - 128];
  if (c >= 128) return 0.5;
  const s = String.fromCharCode(c);
  if ('.,`\''.includes(s)) return 0.12;
  if (':;-_\'^'.includes(s)) return 0.22;
  if ('=+~"*<>/\\|!()[]{}'.includes(s)) return 0.32;
  if ('@#%&8MWB$0Q'.includes(s)) return 0.6;
  return 0.42;
}

/**
 * Render the view into a w x h grid, as the sensor sees it: in poor light (`light`, about 0..1.5)
 * darker and grainy, the grain changing with `frame` (live) or fixed (a photo). In blocks, the view
 * is rendered at twice the rows and each cell shows two pixels (its glyph's colour mixed with its
 * background's): a picture, not characters.
 */
export function expose(render: (g: CharGrid, k?: number) => void, w: number, h: number, light: number, frame: number, blocks = false): CharGrid {
  const g = blocks ? gridOf(w, h * 2, 'b') : gridOf(w, h);
  render(g, blocks ? 2 : 1);
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
  if (!blocks) return g;
  const o = gridOf(w, h), px = (i: number, c: number) => { const k = i * 4, f = cover(g.cells[k]); return g.bg[k + c] + (g.cells[k + 1 + c] - g.bg[k + c]) * f; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = (y * 2) * w + x, b = a + w, k = (y * w + x) * 4;
    o.cells[k] = SHAPE.top;
    for (let c = 0; c < 3; c++) { o.cells[k + 1 + c] = px(a, c); o.bg[k + c] = px(b, c); }
    o.bg[k + 3] = 255;
  }
  return o;
}

export function takePhoto(render: (g: CharGrid, k?: number) => void, mp: number, light: number, at: number, x: number, y: number, seed: number, blocks = false): Photo {
  const w = photoCols(mp), h = Math.round(w / 2), g = expose(render, w, h, light, seed ^ Math.floor(at), blocks);
  return { w, h, cells: g.cells.slice(), bg: g.bg.slice(), at, x, y, kb: Math.round(mp * 280 + hash3(seed, at, 5) * 120) };
}
