import { hash3 } from '../core/rng';
import { BLOCK } from './atlas';
import { type CharGrid } from './grid';

/**
 * The opening, over the first seconds in the city: a terminal on black types where and when the
 * player is (TYPE_S); then the city shows as solid blocks of its own colors, which come apart into
 * glyphs cell by cell, from the middle out with a scatter (DISSOLVE_S). Drawn over the rendered
 * frame; `t` is seconds since entering.
 */
export const TYPE_S = 1.8, DISSOLVE_S = 2.6, INTRO_S = TYPE_S + DISSOLVE_S;

export function intro(g: CharGrid, t: number, lines: string[]) {
  if (t >= INTRO_S) return;
  const { cols, rows, cells, bg } = g, n = cols * rows;
  if (t < TYPE_S) {
    // black, and the lines typing in
    for (let i = 0; i < n; i++) { cells[i * 4] = 32; bg[i * 4] = bg[i * 4 + 1] = bg[i * 4 + 2] = 0; }
    let left = Math.floor(t * 70);
    lines.forEach((l, k) => {
      const s = l.slice(0, Math.max(0, left)), y = (rows >> 1) - lines.length + k * 2, x = (cols - l.length) >> 1;
      left -= l.length + 4;
      g.text(x, y, s, k === 0 ? [255, 196, 90] : [120, 220, 255], [0, 0, 0]);
      if (left < 0 && left > -l.length - 4 && Math.floor(t * 8) & 1) g.text(x + s.length, y, '_', [255, 196, 90], [0, 0, 0]);
    });
    return;
  }
  const p = (t - TYPE_S) / DISSOLVE_S;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x, k = i * 4;
    // when this cell comes apart: earlier toward the middle, with a scatter
    const d = Math.hypot((x - cols / 2) / cols, (y - rows / 2) / rows) * 1.2, at = Math.min(0.95, d * 0.6 + hash3(x, y, 0x1a7) * 0.4);
    if (p >= at + 0.06) continue;
    if (p >= at) { cells[k] = 35; continue; } // breaking: a glyph flashes
    // still solid: the cell filled with its own color (the glyph's, or the background's if empty)
    const empty = cells[k] === 32, r = empty ? bg[k] : cells[k + 1], gg = empty ? bg[k + 1] : cells[k + 2], b = empty ? bg[k + 2] : cells[k + 3];
    cells[k] = BLOCK.full; cells[k + 1] = r; cells[k + 2] = gg; cells[k + 3] = b;
    bg[k] = r; bg[k + 1] = gg; bg[k + 2] = b;
  }
}
