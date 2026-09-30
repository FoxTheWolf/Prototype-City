import { type City } from '../sim/city';

/** Side of the baked window in metres. */
const W = 1024;
/** Radius of one street lamp's pool of light on the ground. */
const R = 11;

/**
 * Street-lamp light on the ground, baked at 1 m resolution into a window around the viewer.
 * The window is re-baked when the viewer strays from its middle, so memory does not grow with the city.
 */
export class LightWindow {
  private map = new Float32Array(W * W);
  private ox = 0;
  private oy = 0;
  private city: City | null = null;

  ensure(city: City, x: number, y: number) {
    if (this.city === city && Math.abs(x - this.ox - W / 2) < W / 4 && Math.abs(y - this.oy - W / 2) < W / 4) return;
    this.city = city;
    const ox = (this.ox = Math.floor(x - W / 2)), oy = (this.oy = Math.floor(y - W / 2));
    const m = this.map;
    m.fill(0);
    for (const b of city.blocks) {
      if (b.x1 + R < ox || b.y1 + R < oy || b.x0 - R > ox + W || b.y0 - R > oy + W) continue;
      for (const p of b.props) {
        if (p.kind !== 'lamp') continue;
        const lx = p.x - ox, ly = p.y - oy;
        for (let gy = Math.max(0, Math.ceil(ly - R)); gy <= Math.min(W - 1, ly + R); gy++) {
          for (let gx = Math.max(0, Math.ceil(lx - R)); gx <= Math.min(W - 1, lx + R); gx++) {
            const g = 1 - ((gx - lx) ** 2 + (gy - ly) ** 2) / (R * R);
            const k = gy * W + gx;
            if (g > m[k]) m[k] = g;
          }
        }
      }
    }
  }

  /** Glow at a world point, bilinear between metres; 0 outside the window. */
  at(x: number, y: number): number {
    const fx = x - this.ox, fy = y - this.oy;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= W - 1) return 0;
    const tx = fx - ix, ty = fy - iy, k = iy * W + ix, m = this.map;
    return (m[k] * (1 - tx) + m[k + 1] * tx) * (1 - ty) + (m[k + W] * (1 - tx) + m[k + W + 1] * tx) * ty;
  }
}
