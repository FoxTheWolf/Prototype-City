/** Glyph slots are indexed by char code: slot n sits at column n % 16, row n / 16. */
export const ATLAS_COLS = 16;
export const ATLAS_ROWS = 16;

export const FONT = '"IBM Plex Mono", ui-monospace, Consolas, monospace';

/**
 * Draw every printable ASCII glyph, white on black, into slots of exactly one cell
 * in device pixels, so the GPU can copy them 1:1 without any filtering.
 */
export function buildAtlas(cellW: number, cellH: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = cellW * ATLAS_COLS;
  cv.height = cellH * ATLAS_ROWS;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cv.width, cv.height);

  // Largest font size whose advance fits the cell width and whose line fits the height.
  ctx.font = `100px ${FONT}`;
  const adv = ctx.measureText('M').width / 100;
  const px = Math.min(cellW / adv, cellH / 1.2);
  ctx.font = `${px}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  for (let code = 33; code < 127; code++) {
    const sx = (code % ATLAS_COLS) * cellW, sy = Math.floor(code / ATLAS_COLS) * cellH;
    ctx.fillText(String.fromCharCode(code), sx + cellW / 2, sy + cellH / 2);
  }
  return cv;
}
