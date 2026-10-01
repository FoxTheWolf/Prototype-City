import { type CharGrid } from './grid';

/**
 * Falling rain and snow, drawn over the finished world. Drops live on a few shells around the
 * viewer (1.5 to 28 m away). On each shell they sit in columns fixed to compass angles, so turning
 * does not drag them, and fall at their real speed, slanted by the wind. A drop is drawn only
 * where nothing nearer was, so it disappears behind walls and cars; near a lamp it lights up.
 */

const SHELLS = [1.6, 2.4, 3.5, 5, 7, 10, 14, 20, 28];

export interface Fall {
  /** 0 .. 1 */
  amount: number;
  snow: boolean;
  windX: number;
  windY: number;
  /** Seconds, real time. */
  sec: number;
  /** Lightning flash 0..1: the drops catch it too. */
  flash: number;
}

/** A fast hash of three ints to [0,1). */
function h3(a: number, b: number, c: number) {
  // murmur3's finalizer: neighbouring inputs must give unrelated outputs, or drops line up
  let h = Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c, 0x9e3779b1);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const C = (s: string) => s.charCodeAt(0);
let taken = new Uint8Array(0);

/**
 * Draw the fall. yaw, plane and scale are the camera's; light(x, y, z) is the light at a world
 * point (lamps, signs, headlights) as r, g, b.
 */
export function drawFall(grid: CharGrid, f: Fall, px: number, py: number, eye: number, yaw: number, plane: number, scale: number, hor: number, light: (x: number, y: number, z: number) => Float32Array, nearT?: Float32Array) {
  if (f.amount <= 0.01) return;
  const { cols, rows, depth, cells, bg } = grid;
  // cells already holding a nearer drop this frame (the depth buffer stays the world's)
  if (taken.length !== depth.length) taken = new Uint8Array(depth.length); else taken.fill(0);
  const dirX = Math.cos(yaw), dirY = Math.sin(yaw);
  // one column's angle at the screen center: the drops' angular grid on every shell
  const da = (2 * plane) / cols;
  const speed = f.snow ? 1.1 : 7 + 5 * Math.min(1, f.amount * 1.6);
  // streak length in metres (what the eye smears in a moment); flakes are points
  const streak = f.snow ? 0.06 : 0.25 + 0.35 * f.amount;
  // how often a column holds a drop, per 3 m of height
  const dens = f.snow ? 0.06 + 0.22 * f.amount : 0.03 + 0.3 * f.amount;
  const PERIOD = f.snow ? 1.2 : 3, TOP = 12, off = speed * f.sec;
  // the band of falling drops follows the eye up a building, from the ground at street level
  const base = Math.max(0, eye - 6);
  for (let x = 0; x < cols; x++) {
    const camX = (2 * (x + 0.5)) / cols - 1;
    const rdx = dirX - dirY * plane * camX, rdy = dirY + dirX * plane * camX, L = Math.hypot(rdx, rdy);
    const az = yaw + Math.atan(camX * plane);
    // wind across this line of sight: which way the rain's streaks lean
    const cross = (0.5 * ((-rdy * f.windX + rdx * f.windY) / L)) / speed;
    const glyph = f.snow ? 0 : Math.abs(cross) < 0.1 ? C('|') : cross > 0 ? C('/') : C('\\');
    for (let s = 0; s < SHELLS.length; s++) {
      const t = SHELLS[s], dist = t / L; // depth along the ray param
      if (nearT && dist <= nearT[x]) continue; // indoors: only beyond the window
      // the drops of this column in each 3 m band of the fall, from the ground up to TOP
      const cap = f.snow ? 1 : Math.max(1.5, 6 - s * 0.6);
      const near = 1 - s / SHELLS.length;
      for (let b = Math.floor((off + base) / PERIOD); b <= Math.floor((TOP + base + off) / PERIOD); b++) {
        // drop columns stay put on the compass (sliding them with the wind makes neighbouring
        // columns share a drop); the wind shows in the rain's slanted glyph, and flakes wander
        let a = az;
        if (f.snow) a += (0.25 * Math.sin(f.sec * 0.9 + b * 1.7 + s)) / t;
        const colI = Math.floor(a / da);
        if (h3(colI, b, s) > dens) continue;
        const zd = b * PERIOD + h3(colI, b, s + 17) * PERIOD - off;
        if (zd < base || zd > base + TOP) continue;
        // the streak in rows, from the drop's head upward: longer for near drops, which cross the view faster
        const yHead = hor - ((zd - eye) * scale) / dist, len = Math.min((streak * scale) / dist, cap);
        const y1 = Math.min(rows, Math.floor(yHead) + 1);
        let y0 = Math.max(0, Math.floor(yHead - len) + 1);
        if (y0 >= y1) y0 = y1 - 1;
        if (y0 < 0) continue;
        let lt: Float32Array | null = null;
        for (let y = y0; y < y1; y++) {
          const i = y * cols + x;
          if (depth[i] <= dist || taken[i]) continue;
          lt ??= light(px + (rdx / L) * t, py + (rdy / L) * t, zd);
          // see-through: the cell keeps what is behind it as its background, and the drop is that
          // color lightened (snow: whitened), plus the light it catches
          const k4 = i * 4, q = (0.5 + 0.5 * near) * (f.snow ? 1 : 0.8), lk = f.snow ? 1.4 : 2.2;
          const br = Math.max(bg[k4], cells[k4 + 1] * 0.5), bgc = Math.max(bg[k4 + 1], cells[k4 + 2] * 0.5), bb = Math.max(bg[k4 + 2], cells[k4 + 3] * 0.5);
          const add = (f.snow ? 120 : 60) * q + 200 * f.flash;
          const ch = f.snow ? (s < 3 ? C('*') : C('.')) : s > 5 ? C(':') : glyph;
          grid.put(i, ch, br * 1.2 + add + lt[0] * lk, bgc * 1.2 + add + lt[1] * lk, bb * 1.2 + add * 1.1 + lt[2] * lk);
          taken[i] = 1;
        }
      }
    }
  }
}
