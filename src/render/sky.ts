import { hash3 } from '../core/rng';
import { type City } from '../sim/city';
import { moonDir, moonPhase, sunDir } from '../sim/clock';
import { type Weather } from '../sim/weather';
import { type CharGrid } from './grid';

/**
 * The sky: a gradient that follows the sun (night is the main look; dusk and dawn are colored,
 * the day pale and hazy), stars, the moon with its phase, and a cloud layer whose cover comes from
 * the weather. Clouds are lit from below by the city's sodium glow and by the burning seam, the way
 * a real city lights its overcast.
 */

/** Height of the cloud deck in metres. */
const CLOUD_H = 1200;
/** The moon drawn this big (the real one is 0.26 degrees across in radius terms; this reads on a grid). */
const MOON_R = (3.4 * Math.PI) / 180;

// a tileable field of smooth noise, sampled at several scales for the clouds
const N = 256, NOISE = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) NOISE[j * N + i] = hash3(i, j, 777);
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = ix & (N - 1), y0 = iy & (N - 1), x1 = (x0 + 1) & (N - 1), y1 = (y0 + 1) & (N - 1);
  const a = NOISE[y0 * N + x0], b = NOISE[y0 * N + x1], c = NOISE[y1 * N + x0], d = NOISE[y1 * N + x1];
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

const C = (s: string) => s.charCodeAt(0);
const CLOUD_GLYPH = [C('.'), C(':'), C('~'), C('-'), C('='), C('~'), C(':'), C('%')];
const MOON_GLYPH = [C('.'), C(':'), C('o'), C('%'), C('@')];

/** What every sky cell of this frame shares. */
export interface SkyFrame {
  /** 0 at night, 1 in daylight (the sun a few degrees up). */
  day: number;
  /** How much of the dusk or dawn color there is, and the sun's heading (world angle). */
  dusk: number;
  sunA: number;
  moonA: number;
  moonEl: number;
  phase: number;
  /** Moonlight 0..1 (up, bright phase), for the scene later (blackout). */
  moonlight: number;
  cloud: number;
  precip: number;
  /** Wind drift of the cloud texture in metres. */
  driftX: number;
  driftY: number;
  city: City;
}

const tmp = new Float64Array(2);
/** Sky azimuth (from north, clockwise) to a world heading (north is -y). */
const heading = (az: number) => az - Math.PI / 2;

/** Daylight at game time t: 0 at night, 1 with the sun a few degrees up. */
export function daylight(t: number) {
  return smooth(-0.1, 0.1, sunDir(t, tmp)[0]);
}

export function prepareSky(city: City, w: Weather, t: number, sec: number): SkyFrame {
  sunDir(t, tmp);
  const sunEl = tmp[0], sunA = heading(tmp[1]);
  moonDir(t, tmp);
  const moonEl = tmp[0], moonA = heading(tmp[1]), phase = moonPhase(t);
  const day = smooth(-0.1, 0.1, sunEl);
  // real-time drift, so clouds move at the wind's speed as you watch
  return {
    day, dusk: Math.exp(-((sunEl / 0.13) ** 2)), sunA, moonA, moonEl, phase,
    moonlight: moonEl > 0 ? (1 - Math.cos(2 * Math.PI * phase)) / 2 * Math.min(1, moonEl * 5) * (1 - day) : 0,
    cloud: w.cloud, precip: w.precip, driftX: w.windX * sec * 3, driftY: w.windY * sec * 3, city,
  };
}

/**
 * How much the ground under a point lights the clouds: the city (brighter downtown), fading over
 * the dark seam, and the seam's own fires in a ring outside the fence.
 */
function glowBelow(c: City, x: number, y: number, out: Float32Array) {
  const dx = Math.max(0, -x, x - c.w), dy = Math.max(0, -y, y - c.h), out_ = Math.hypot(dx, dy);
  const core = Math.exp(-((Math.hypot(x - c.cx, y - c.cy) / (Math.min(c.w, c.h) * 0.45)) ** 2));
  const city = (out_ > 0 ? Math.exp(-out_ / 500) : 1) * (0.55 + 0.45 * core);
  const fire = Math.exp(-(((out_ - 450) / 420) ** 2));
  out[0] = 105 * city + 90 * fire; out[1] = 60 * city + 28 * fire; out[2] = 38 * city + 12 * fire;
}
const GLOW = new Float32Array(3);

/**
 * The sky of one column, rows above the horizon. az is the column's world heading, (rdx, rdy) its
 * ray (forward component 1), slot the column's fixed star slot.
 */
export function skyColumn(grid: CharGrid, x: number, S: SkyFrame, az: number, rdx: number, rdy: number, px: number, py: number, eye: number, hor: number, scale: number, slot: number) {
  const { cols } = grid;
  const L = Math.hypot(rdx, rdy), night = 1 - S.day;
  // the moon's disk in angles: heading difference (wrapped) scaled by the cosine of its height
  let dA = az - S.moonA;
  dA -= Math.round(dA / (2 * Math.PI)) * 2 * Math.PI;
  const moonCol = S.moonEl > -MOON_R && Math.abs(dA) * Math.cos(S.moonEl) < MOON_R * 3;
  let dS = az - S.sunA;
  dS -= Math.round(dS / (2 * Math.PI)) * 2 * Math.PI;
  const toSun = 0.5 + 0.5 * Math.cos(dS);
  const top = Math.min(grid.rows, Math.ceil(hor - 0.5));
  for (let y = 0; y < top; y++) {
    const i = y * cols + x;
    const up = (hor - (y + 0.5)) / scale / L; // tan of the elevation
    const t = Math.max(0, Math.min(1, (y + 0.5) / Math.max(1, hor)));
    // gradient: night, day haze, and the dusk color low on the sun's side; the seam lights the low sky orange
    const t2 = t * t, t4 = t2 * t2;
    let r = (5 + 21 * t2 + 30 * t4) * night + (62 + 80 * t2) * S.day;
    let g = (6 + 10 * t2 + 8 * t4) * night + (84 + 72 * t2) * S.day;
    let b = (11 + 21 * t2 - 6 * t4) * night + (118 + 44 * t2) * S.day;
    const dk = S.dusk * t4 * (0.35 + 0.65 * toSun);
    r += 190 * dk; g += 80 * dk; b += 30 * dk - 10 * dk * toSun;
    let ch = 0, cr = 0, cg = 0, cb = 0;

    // stars, behind everything
    const hs = hash3(slot, Math.floor(y - hor), 7);
    let star = 0;
    if (hs < 0.012 && y < hor - 3) star = (120 + hs * 8000) * night * night;
    else if (y >= hor - 2 && night > 0.5) { ch = C('.'); cr = 70; cg = 40; cb = 60; }

    // the moon, with its phase: the lit side faces the sun (waxing: lit on the right)
    let moonA = 0;
    if (moonCol) {
      const el = Math.atan(up), dE = el - S.moonEl, u = (dA * Math.cos(el)) / MOON_R, v = dE / MOON_R, d2 = u * u + v * v;
      if (d2 < 1) {
        const wz = Math.sqrt(1 - d2), f = 2 * Math.PI * S.phase;
        let lit = Math.max(0, u * Math.sin(f) - wz * Math.cos(f));
        lit = lit * (0.72 + 0.28 * noise(u * 3 + 40, v * 3 + 40)) + 0.05; // maria, and faint earthshine
        const k = Math.min(1, lit) * (0.35 + 0.65 * night);
        ch = MOON_GLYPH[Math.min(4, Math.floor(k * 5))]; cr = 235 * k + 20; cg = 228 * k + 20; cb = 200 * k + 26;
        r += 13 + 40 * k; g += 12 + 38 * k; b += 11 + 34 * k;
        moonA = 1; star = 0;
      } else if (d2 < 9) {
        // halo around it, by how much of it is lit
        const hk = ((1 - Math.cos(2 * Math.PI * S.phase)) / 2) * night * Math.exp(-(Math.sqrt(d2) - 1) * 1.6) * 18;
        r += hk; g += hk; b += hk * 1.2;
      }
    }

    // the cloud deck: where this cell's ray meets it, the texture drifting with the wind
    if (S.cloud > 0.01 && up > 0.002) {
      const tc = (CLOUD_H - eye) / (up * L), wx = px + rdx * tc, wy = py + rdy * tc, D = tc * L;
      // the ground a cell covers on the deck grows fast toward the horizon: drop the fine octaves there
      const fp = (D * D) / ((CLOUD_H - eye) * scale);
      const ox = wx + S.driftX, oy = wy + S.driftY;
      const k1 = 1 - smooth(300, 900, fp), k2 = 1 - smooth(120, 360, fp);
      const n0 = noise(ox / 1100, oy / 1100), n1 = noise(ox / 420 + 71, oy / 420 + 13), n2 = noise(ox / 150 + 37, oy / 150 + 91);
      let d = 0.55 * n0 + 0.3 * (k1 * n1 + (1 - k1) * 0.5) + 0.15 * (k2 * n2 + (1 - k2) * 0.5);
      d += (0.5 - d) * smooth(8000, 30000, D); // far off, the deck averages out
      const lo = 1 - S.cloud;
      const a = smooth(lo - 0.18, lo + 0.12, d) * (0.55 + 0.45 * Math.min(1, S.cloud * 1.3));
      if (a > 0.02) {
        // lit from below by the city and the seam, grey in daylight; rain makes the deck lower and brighter
        glowBelow(S.city, wx, wy, GLOW);
        const thick = Math.min(1, a * (0.5 + d));
        const gk = (0.35 + 0.65 * thick) * (0.8 + 0.5 * S.precip) * night;
        let qr = 12 + GLOW[0] * gk, qg = 12 + GLOW[1] * gk, qb = 18 + GLOW[2] * gk;
        const grey = (150 - 60 * thick - 35 * S.precip) * S.day;
        qr += grey; qg += grey * 1.01; qb += grey * 1.06;
        // dusk paints the undersides on the sun's side; the moon silvers thin edges
        qr += 150 * S.dusk * toSun * (1 - thick * 0.5); qg += 60 * S.dusk * toSun; qb += 30 * S.dusk;
        const ml = S.moonlight * (1 - thick) * 60;
        qr += ml; qg += ml; qb += ml * 1.15;
        if (moonA) { qr += cr * 0.3 * (1 - thick); qg += cg * 0.3 * (1 - thick); qb += cb * 0.3 * (1 - thick); }
        // the far deck sinks into the haze, which the city's light warms too
        const hz = 1 - Math.exp(-D / 12000), hk = 0.4 * night * (0.6 + 0.6 * S.precip);
        qr += (26 + 55 * hk + 90 * S.day - qr) * hz; qg += (22 + 32 * hk + 95 * S.day - qg) * hz; qb += (26 + 22 * hk + 102 * S.day - qb) * hz;
        r += (qr - r) * a; g += (qg - g) * a; b += (qb - b) * a;
        star *= 1 - a;
        if (a > 0.35 && (!moonA || thick > 0.6)) {
          // a glyph fixed to the cloud texture, a little brighter than the cloud
          const gi = Math.floor(noise(ox / 60 + 5, oy / 60 + 9) * 8);
          ch = CLOUD_GLYPH[gi & 7]; cr = r * 1.45; cg = g * 1.45; cb = b * 1.45;
        } else if (moonA) { cr *= 1 - a * 0.8; cg *= 1 - a * 0.8; cb *= 1 - a * 0.8; }
      }
    }
    grid.setBg(i, r, g, b);
    if (star > r + 25 && !moonA) grid.put(i, hs < 0.003 ? C('*') : C('.'), star, star, star + 30);
    else if (ch) grid.put(i, ch, cr, cg, cb);
  }
}
