import { type City } from '../sim/city';
import { LAMP_LIGHT, lampState, photocell } from './lamps';
import { power } from './power';
import { type PowerGrid } from '../sim/power';

/** Side of the baked window in metres. */
export const LIGHT_W = 1024;
const W = LIGHT_W;
/** Radius of one street lamp's pool of light on the ground. */
export const LAMP_R = 11;
const R = LAMP_R;

/**
 * Street-lamp light on the ground, baked at 1 m resolution into a window around the viewer.
 * The window is re-baked when the viewer strays from its middle, so memory does not grow with the city.
 * Each metre remembers which lamp lights it, so a lamp that fails dims its own pool every frame.
 */
export class LightWindow {
  // the two strongest lamps on each metre (a second layer at W * W): with only the strongest, where two
  // pools of a different color or level met there was a straight seam on the ground and the walls
  private map = new Float32Array(W * W * 2);
  private lamp = new Int32Array(W * W * 2);
  /** Brightness of every lamp this frame, by lamp id; only the lamps in the window are updated. */
  level = new Float32Array(0);
  /** Warmth of every lamp this frame (0 just struck, 1 warmed up). */
  warm = new Float32Array(0);
  /** Color every lamp throws this frame, by lamp id: r, g, b. */
  private col = new Float32Array(0);
  private inWindow: number[] = [];
  ox = 0;
  oy = 0;
  /**
   * The share of the lamps around (nearer weigh more) that have power, 1 when none is out: how much of
   * the city's glow is left, for the light over everything in a blackout (it follows the lamps going out).
   */
  litShare = 1;
  /** Bumped at every re-bake, so the GPU's copy knows when to go up again. */
  version = 0;
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
    this.version++;
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
          if (g > m[k]) { m[k + W * W] = m[k]; id[k + W * W] = id[k]; m[k] = g; id[k] = n; }
          else if (g > m[k + W * W]) { m[k + W * W] = g; id[k + W * W] = n; }
        }
      }
    });
  }

  /** Update the lamps' failures and photocells for this frame (day: 0 night .. 1 daylight). */
  update(sec: number, day: number, grid: PowerGrid) {
    const lamps = this.city!.lamps, c = this.col, cx = this.ox + W / 2, cy = this.oy + W / 2;
    let on = 0, all = 0;
    for (const n of this.inWindow) {
      const t = lamps[n].lampType ?? 'hps', L = LAMP_LIGHT[t];
      lampState(n, sec, this.st, t);
      photocell(n, day, this.st);
      // the power grid: dark in a blackout; when it comes back a discharge lamp warms up again
      const pw = power(grid, grid.lamp[n], lamps[n].x, lamps[n].y, n + 100000, 0, sec);
      this.st[0] *= Math.min(1.3, pw[0]);
      const wd = 1 / (1 + ((lamps[n].x - cx) ** 2 + (lamps[n].y - cy) ** 2) / (120 * 120));
      on += wd * Math.min(1, pw[0]); all += wd;
      if (pw[1] >= 0 && t !== 'led') this.st[1] = Math.min(this.st[1], pw[1] / 9);
      const lv = (this.level[n] = this.st[0]), w = (this.warm[n] = this.st[1]);
      for (let k = 0; k < 3; k++) c[n * 3 + k] = (L.cold[k] + (L.warm[k] - L.cold[k]) * w) * lv;
    }
    this.litShare = all > 0 ? on / all : 1;
  }

  /** The baked window for the GPU: per metre, (lamp id + 1) << 8 | the pool's strength x 255 (0: unlit). */
  packMap(): Uint32Array {
    const out = new Uint32Array(W * W * 2), m = this.map, id = this.lamp;
    for (let k = 0; k < W * W * 2; k++) if (m[k] > 0) out[k] = ((id[k] + 1) << 8) | Math.min(255, Math.round(m[k] * 255));
    return out;
  }
  /** Every lamp's color this frame (r, g, b per lamp id). */
  get colors(): Float32Array { return this.col; }

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
    for (const j of [i0, i0 + W * W]) { corner(j, (1 - tx) * (1 - ty)); corner(j + 1, tx * (1 - ty)); corner(j + W, (1 - tx) * ty); corner(j + W + 1, tx * ty); }
  }
}
