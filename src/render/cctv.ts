import { hash3 } from '../core/rng';
import { type CamModel } from '../sim/cctv';
import { type CharGrid } from './grid';

/**
 * A security camera's picture, over a world frame drawn from its lens: a camera of the time into a
 * recorder. Each model sees in its own way (sim/cctv.ts, CAMS: black and white or color, a tint, a
 * gain and a curve), and each unit strays a little from its model with age (`wear`, 0..1: a shift
 * of the tint, a flatter picture, more grain). Then the recorder's marks: scan lines, the grain of
 * a noisy sensor (worse in the dark), a slow bright roll bar of interference, a darker corner
 * vignette, and now and then a torn line. `sec` is real time; `seed` sets the grain per camera.
 * Every model is kept within a picture one can see: the darks lifted, the lights clipped.
 */
export function cctvLook(g: CharGrid, sec: number, seed: number, M: CamModel, wear: number) {
  const { cols, rows, cells, bg } = g, f = Math.floor(sec * 15), B = M.bias;
  const tr = B.tint[0] * (1 + (wear - 0.5) * 0.12), tg = B.tint[1], tb = B.tint[2] * (1 - (wear - 0.5) * 0.12);
  const gain = B.gain * (1 - wear * 0.1), flat = wear * 0.12, grainK = 22 * B.grain * (0.8 + wear * 0.5);
  const roll = ((sec * 0.09 + seed * 0.37) % 1.3) * rows - rows * 0.15;
  // a torn line every few seconds: one row slid sideways for a frame or two
  const tear = hash3(seed, f >> 1, 3) < 0.04 ? Math.floor(hash3(seed, f, 4) * rows) : -1;
  const out = [0, 0, 0];
  const tone = (r: number, gg: number, b: number, k: number, n: number, into: Uint8ClampedArray, o: number) => {
    const l = 0.3 * r + 0.55 * gg + 0.15 * b;
    for (let c = 0; c < 3; c++) {
      const v = l + ((c === 0 ? r : c === 1 ? gg : b) - l) * B.sat, t = c === 0 ? tr : c === 1 ? tg : tb;
      out[c] = Math.max(0, curve(v * gain * t, B.gamma, flat) * k + n);
    }
    into[o] = out[0]; into[o + 1] = out[1]; into[o + 2] = out[2];
  };
  for (let y = 0; y < rows; y++) {
    const scan = y & 1 ? 0.8 : 1, bar = 1 + 0.2 * Math.exp(-(((y - roll) / (rows * 0.05)) ** 2)), vy = (2 * y) / rows - 1;
    const shift = y === tear ? 2 + Math.floor(hash3(seed, f, 5) * 4) : 0;
    for (let x = 0; x < cols; x++) {
      const k = (y * cols + x) * 4, vx = (2 * x) / cols - 1;
      const vig = Math.max(0.4, 1 - 0.3 * (vx * vx + vy * vy)) * scan * bar;
      const n = hash3(x * 7 + seed, y * 13 + f, 11) - 0.5;
      const lb = 0.3 * bg[k] + 0.55 * bg[k + 1] + 0.15 * bg[k + 2], grain = (1 - Math.min(1, lb / 90)) * grainK * n;
      tone(cells[k + 1], cells[k + 2], cells[k + 3], vig, grain, cells, k + 1);
      tone(bg[k], bg[k + 1], bg[k + 2], vig * 0.9, grain * 0.6, bg, k);
      // grain flecks in the dark parts
      if (cells[k] === 32 && n > 0.47 && lb < 40) { cells[k] = 46; cells[k + 1] = 70 * tr; cells[k + 2] = 72 * tg; cells[k + 3] = 70 * tb; }
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

/** The camera's response: the darks lifted a little, the lights clipped early; `flat` lifts the blacks more (an old unit). */
function curve(l: number, gamma: number, flat: number): number {
  const v = Math.min(1, l / 230);
  return 255 * Math.min(1, 0.03 + flat + (1.05 - flat) * v ** (1.15 * gamma));
}
