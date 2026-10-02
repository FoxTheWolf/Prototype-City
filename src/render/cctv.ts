import { hash3 } from '../core/rng';
import { type CharGrid } from './grid';

/**
 * A security camera's picture, over a world frame drawn from its lens: a cheap camera of 2008 into a
 * monitor. Monochrome with a cold green cast and a little crushed contrast, scan lines, the grain of
 * a noisy sensor (worse in the dark), a slow bright roll bar of interference, a darker corner
 * vignette, and now and then a torn line. `sec` is real time; `seed` changes the grain per camera.
 */
export function cctvLook(g: CharGrid, sec: number, seed: number) {
  const { cols, rows, cells, bg } = g, f = Math.floor(sec * 15);
  const roll = ((sec * 0.09 + seed * 0.37) % 1.3) * rows - rows * 0.15;
  // a torn line every few seconds: one row slid sideways for a frame or two
  const tear = hash3(seed, f >> 1, 3) < 0.04 ? Math.floor(hash3(seed, f, 4) * rows) : -1;
  for (let y = 0; y < rows; y++) {
    const scan = y & 1 ? 0.78 : 1, bar = 1 + 0.22 * Math.exp(-(((y - roll) / (rows * 0.05)) ** 2)), vy = (2 * y) / rows - 1;
    const shift = y === tear ? 2 + Math.floor(hash3(seed, f, 5) * 4) : 0;
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x, k = i * 4, vx = (2 * x) / cols - 1;
      const vig = Math.max(0.35, 1 - 0.32 * (vx * vx + vy * vy));
      const n = hash3(x * 7 + seed, y * 13 + f, 11) - 0.5;
      // the glyph's and the paper's luminance, through the camera's curve, then tinted
      const lf = 0.3 * cells[k + 1] + 0.55 * cells[k + 2] + 0.15 * cells[k + 3];
      const lb = 0.3 * bg[k] + 0.55 * bg[k + 1] + 0.15 * bg[k + 2];
      const grain = (1 - Math.min(1, lb / 90)) * 26;
      const cf = Math.max(0, curve(lf) * vig * scan * bar + n * grain);
      const cb = Math.max(0, curve(lb) * vig * scan * bar * 0.9 + n * grain * 0.6);
      cells[k + 1] = cf * 0.86; cells[k + 2] = cf; cells[k + 3] = cf * 0.88;
      bg[k] = cb * 0.84; bg[k + 1] = cb; bg[k + 2] = cb * 0.9;
      // grain flecks in the dark parts
      if (cells[k] === 32 && n > 0.47 && lb < 40) { cells[k] = 46; cells[k + 1] = 70; cells[k + 2] = 80; cells[k + 3] = 72; }
    }
    if (shift) {
      const row = cells.slice(y * cols * 4, (y + 1) * cols * 4), rb = bg.slice(y * cols * 4, (y + 1) * cols * 4);
      for (let x = 0; x < cols; x++) {
        const s = Math.max(0, x - shift) * 4, d = (y * cols + x) * 4;
        for (let c = 0; c < 4; c++) { cells[d + c] = row[s + c]; bg[d + c] = rb[s + c]; }
      }
    }
  }
}

/** The camera's response: the darks lifted a little and crushed, the lights clipped early. */
function curve(l: number): number {
  const v = Math.min(1, l / 230);
  return 255 * Math.min(1, 0.03 + 1.05 * v ** 1.15);
}
