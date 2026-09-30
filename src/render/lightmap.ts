import { type City } from '../sim/city';
import { LAMP_LIGHT, lampState, photocell } from './lamps';

/** Side of the baked window in metres. */
const W = 1024;
/** Radius of one street lamp's pool of light on the ground. */
const R = 11;

/**
 * Street-lamp light on the ground, baked at 1 m resolution into a window around the viewer.
 * The window is re-baked when the viewer strays from its middle, so memory does not grow with the city.
 * Each metre remembers which lamp lights it, so a lamp that fails dims its own pool every frame.
 */
export class LightWindow {
  private map = new Float32Array(W * W);
  private lamp = new Int32Array(W * W);
  /** Brightness of every lamp this frame, by lamp id; only the lamps in the window are updated. */
  level = new Float32Array(0);
  /** Warmth of every lamp this frame (0 just struck, 1 warmed up). */
  warm = new Float32Array(0);
  /** Color every lamp throws this frame, by lamp id: r, g, b. */
  private col = new Float32Array(0);
  private inWindow: number[] = [];
  private ox = 0;
  private oy = 0;
  private city: City | null = null;
  private st = new Float32Array(2);

  ensure(city: City, x: number, y: number) {
    if (this.city === city && Math.abs(x - this.ox - W / 2) < W / 4 && Math.abs(y - this.oy - W / 2) < W / 4) return;
    if (this.city !== city) {
      this.level = new Float32Array(city.lamps.length).fill(1);
      this.warm = new Float32Array(city.lamps.length).fill(1);
      this.col = new Float32Array(city.lamps.length * 3);
    }
    this.city = city;
    const ox = (this.ox = Math.floor(x - W / 2)), oy = (this.oy = Math.floor(y - W / 2));
    const m = this.map, id = this.lamp;
    m.fill(0);
    this.inWindow = [];
    city.lamps.forEach((p, n) => {
      const lx = p.x - ox, ly = p.y - oy;
      if (lx < -R || ly < -R || lx > W + R || ly > W + R) return;
      this.inWindow.push(n);
      for (let gy = Math.max(0, Math.ceil(ly - R)); gy <= Math.min(W - 1, ly + R); gy++) {
        for (let gx = Math.max(0, Math.ceil(lx - R)); gx <= Math.min(W - 1, lx + R); gx++) {
          const g = 1 - ((gx - lx) ** 2 + (gy - ly) ** 2) / (R * R);
          const k = gy * W + gx;
          if (g > m[k]) { m[k] = g; id[k] = n; }
        }
      }
    });
  }

  /** Update the lamps' failures and photocells for this frame (day: 0 night .. 1 daylight). */
  update(sec: number, day: number) {
    const lamps = this.city!.lamps, c = this.col;
    for (const n of this.inWindow) {
      const t = lamps[n].lampType ?? 'hps', L = LAMP_LIGHT[t];
      lampState(n, sec, this.st, t);
      photocell(n, day, this.st);
      const lv = (this.level[n] = this.st[0]), w = (this.warm[n] = this.st[1]);
      for (let k = 0; k < 3; k++) c[n * 3 + k] = (L.cold[k] + (L.warm[k] - L.cold[k]) * w) * lv;
    }
  }

  /** Add the lamps' light at a world point, times k, to out[0..2]: bilinear between metres, nothing outside the window. */
  add(x: number, y: number, k: number, out: Float32Array) {
    const fx = x - this.ox, fy = y - this.oy;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= W - 1) return;
    const tx = fx - ix, ty = fy - iy, i0 = iy * W + ix, m = this.map, id = this.lamp, c = this.col;
    const corner = (i: number, f: number) => {
      const g = m[i] * f * k;
      if (g <= 0) return;
      const n = id[i] * 3;
      out[0] += c[n] * g; out[1] += c[n + 1] * g; out[2] += c[n + 2] * g;
    };
    corner(i0, (1 - tx) * (1 - ty)); corner(i0 + 1, tx * (1 - ty)); corner(i0 + W, (1 - tx) * ty); corner(i0 + W + 1, tx * ty);
  }
}
