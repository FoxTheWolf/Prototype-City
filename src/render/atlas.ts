/** Glyph slots are indexed by char code: slot n sits at column n % 16, row n / 16. */
export const ATLAS_COLS = 16;
const ATLAS_ROWS = 16;

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
  // printable ASCII, and Latin-1 from 160 (accented letters in names: the slots below are the blocks')
  for (let code = 33; code < 256; code++) {
    if (code >= 127 && code < 161) continue;
    const sx = (code % ATLAS_COLS) * cellW, sy = Math.floor(code / ATLAS_COLS) * cellH;
    ctx.fillText(String.fromCharCode(code), sx + cellW / 2, sy + cellH / 2);
  }
  drawBlocks(ctx, cellW, cellH);
  return cv;
}

/** Block and box glyphs (█▓▒░ ─│┼═ ╱╲╳) live in free slots from 128 up. */
export const BLOCK = { full: 128, dark: 129, mid: 130, light: 131, h: 132, v: 133, cross: 134, dh: 135, up: 136, down: 137, x: 138 };
/**
 * Shapes for drawn interfaces (the phone): half and partial blocks (two pixels per cell, the signal
 * bars), and the four rounded corners of a box, each filled inside a quarter ellipse.
 */
export const SHAPE = { top: 139, bottom: 140, left: 141, right: 142, q1: 143, q3: 144, tl: 145, tr: 146, bl: 147, br: 148, dot: 149 };

/**
 * Drawn as exact shapes instead of font glyphs, so they fill the whole cell and tile without gaps.
 * Shades are ordered dithers: 3/4, 1/2 and 1/4 of the pixels.
 */
function drawBlocks(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const at = (slot: number) => [(slot % ATLAS_COLS) * w, Math.floor(slot / ATLAS_COLS) * h];
  const t = Math.max(1, Math.round(w / 6)); // line thickness
  const cx = Math.floor((w - t) / 2), cy = Math.floor((h - t) / 2);
  ctx.fillStyle = '#fff';
  const rect = (slot: number, x: number, y: number, rw: number, rh: number) => { const [sx, sy] = at(slot); ctx.fillRect(sx + x, sy + y, rw, rh); };
  rect(BLOCK.full, 0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = (x & 1) + 2 * (y & 1); // 0..3 over a 2x2 tile
    if (d !== 3) rect(BLOCK.dark, x, y, 1, 1);
    if (d === 0 || d === 3) rect(BLOCK.mid, x, y, 1, 1);
    if (d === 0) rect(BLOCK.light, x, y, 1, 1);
  }
  rect(BLOCK.h, 0, cy, w, t);
  rect(BLOCK.v, cx, 0, t, h);
  rect(BLOCK.cross, 0, cy, w, t); rect(BLOCK.cross, cx, 0, t, h);
  const g = Math.max(t, Math.round(h / 5));
  rect(BLOCK.dh, 0, cy - g, w, t); rect(BLOCK.dh, 0, cy + g, w, t);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = t;
  const line = (slot: number, x0: number, y0: number, x1: number, y1: number) => {
    const [sx, sy] = at(slot);
    ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, w, h); ctx.clip();
    ctx.beginPath(); ctx.moveTo(sx + x0, sy + y0); ctx.lineTo(sx + x1, sy + y1); ctx.stroke(); ctx.restore();
  };
  line(BLOCK.up, 0, h, w, 0);
  line(BLOCK.down, 0, 0, w, h);
  line(BLOCK.x, 0, h, w, 0); line(BLOCK.x, 0, 0, w, h);
  const hh = Math.round(h / 2), hw = Math.round(w / 2);
  rect(SHAPE.top, 0, 0, w, hh); rect(SHAPE.bottom, 0, hh, w, h - hh);
  rect(SHAPE.left, 0, 0, hw, h); rect(SHAPE.right, hw, 0, w - hw, h);
  rect(SHAPE.q1, 0, h - Math.round(h / 4), w, Math.round(h / 4)); rect(SHAPE.q3, 0, h - Math.round((h * 3) / 4), w, Math.round((h * 3) / 4));
  // rounded corners: the inside of a quarter ellipse whose center is the box's inner corner
  const corner = (slot: number, cx: number, cy: number) => {
    const [sx, sy] = at(slot);
    ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, w, h); ctx.clip();
    ctx.beginPath(); ctx.ellipse(sx + cx, sy + cy, w, h, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  corner(SHAPE.tl, w, h); corner(SHAPE.tr, 0, h); corner(SHAPE.bl, w, 0); corner(SHAPE.br, 0, 0);
  const [dx, dy] = at(SHAPE.dot);
  ctx.beginPath(); ctx.ellipse(dx + w / 2, dy + h / 2, w * 0.36, w * 0.36, 0, 0, Math.PI * 2); ctx.fill();
}
