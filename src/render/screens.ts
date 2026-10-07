import type { HdLayer } from './hd';
import { HdOrder } from './hd';

/**
 * 15.16: the devices' screens as textures of their own. Each screen is drawn into a picture of its own
 * on the GPU (its cells, its text and its pixels) and that picture is laid on the glass in perspective,
 * from the glass's four corners on the monitor: square and crisp faced, leaning with the device from
 * aside. The pixel layer of each screen is an HdLayer of the device's own resolution.
 */
export const SCREEN_PX = { laptop: [1280, 800], phone: [240, 400], jackdaw: [128, 64] } as const;

/**
 * The homography taking a point of the glass (u, v: 0 to 1 from its top-left) to the monitor, for a quad
 * x0, y0 ... x3, y3 (top-left, top-right, bottom-right, bottom-left), inverted: the 3 x 3 rows that take a
 * monitor pixel back to (u, v) (u = row0 · (x, y, 1) / row2 · (x, y, 1)). Null for a quad with no area.
 */
export function quadInverse(q: readonly number[]): number[] | null {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-9) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / det, h = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  // the inverse by the adjugate (any scale will do: u and v are ratios)
  const A = e - f * h, B = c * h - b, C = b * f - c * e;
  const D = f * g - d, E = a - c * g, F = c * d - a * f;
  const G = d * h - e * g, H = b * g - a * h, I = a * e - b * d;
  if (Math.abs(I) < 1e-12 && Math.abs(G) < 1e-12 && Math.abs(H) < 1e-12) return null;
  return [A, B, C, D, E, F, G, H, I];
}

/** DEBUG.screenTest: a pattern on a screen's pixel layer, to judge it faced, from aside and from afar. */
export function testPattern(hd: HdLayer) {
  const { w, h } = hd;
  const on = (x: number, y: number, r: number, g: number, b: number) => hd.put(x, y, r, g, b, HdOrder.Over);
  // the edge, one pixel; a grid every 80; the diagonals
  for (let x = 0; x < w; x++) { on(x, 0, 255, 255, 255); on(x, h - 1, 255, 255, 255); }
  for (let y = 0; y < h; y++) { on(0, y, 255, 255, 255); on(w - 1, y, 255, 255, 255); }
  for (let y = 80; y < h; y += 80) for (let x = 0; x < w; x += 2) on(x, y, 90, 90, 90);
  for (let x = 80; x < w; x += 80) for (let y = 0; y < h; y += 2) on(x, y, 90, 90, 90);
  for (let k = 0; k < w; k++) { const y = Math.round((k * (h - 1)) / (w - 1)); on(k, y, 255, 80, 80); on(k, h - 1 - y, 80, 160, 255); }
  // a circle, and color bars along the bottom, under the text
  const cx = w >> 1, cy = h >> 1, R = Math.min(w, h) * 0.3;
  for (let t = 0; t < 2400; t++) { const a = (t / 2400) * Math.PI * 2; on(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R), 255, 220, 120); }
  const bars = [[255, 255, 255], [255, 255, 0], [0, 255, 255], [0, 255, 0], [255, 0, 255], [255, 0, 0], [0, 0, 255], [0, 0, 0]];
  const bw = Math.floor(w / bars.length);
  for (let y = h - 60; y < h - 20; y++) for (let x = 0; x < bars.length * bw; x++) { const c = bars[Math.floor(x / bw)]; hd.put(x, y, c[0], c[1], c[2], HdOrder.Under); }
}
