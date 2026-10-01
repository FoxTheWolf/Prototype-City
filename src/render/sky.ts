import { hash3 } from '../core/rng';
import { type City } from '../sim/city';
import { moonDir, moonPhase, sunDir } from '../sim/clock';
import { lightning, type Weather } from '../sim/weather';
import { type PowerGrid } from '../sim/power';
import { power } from './power';
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
const MOON_GLYPH = [C('.'), C(':'), C('o'), C('%'), C('@')];

/** What every sky cell of this frame shares. */
export interface SkyFrame {
  /** 0 at night, 1 in daylight (the sun a few degrees up). */
  day: number;
  /** How much of the dusk or dawn color there is, and the sun's heading (world angle) and elevation. */
  dusk: number;
  sunA: number;
  sunEl: number;
  moonA: number;
  moonEl: number;
  phase: number;
  /** Moonlight 0..1 (up, bright phase), for the scene later (blackout). */
  moonlight: number;
  cloud: number;
  precip: number;
  /** Lightning flash 0..1. */
  flash: number;
  /** Wind drift of the cloud texture in metres. */
  driftX: number;
  driftY: number;
  city: City;
  grid: PowerGrid;
  sec: number;
  /** Share of the city with its lights on: the haze over it glows with them. */
  cityLit: number;
}

const tmp = new Float64Array(2);
/** Sky azimuth (from north, clockwise) to a world heading (north is -y). */
const heading = (az: number) => az - Math.PI / 2;

/** Daylight at game time t: 0 at night, 1 with the sun a few degrees up. */
export function daylight(t: number) {
  return smooth(-0.1, 0.1, sunDir(t, tmp)[0]);
}

const bolt = new Float64Array(2);
export function prepareSky(city: City, grid: PowerGrid, w: Weather, seed: number, t: number, sec: number): SkyFrame {
  buildLit(city, grid, sec);
  sunDir(t, tmp);
  const sunEl = tmp[0], sunA = heading(tmp[1]);
  moonDir(t, tmp);
  const moonEl = tmp[0], moonA = heading(tmp[1]), phase = moonPhase(t);
  const day = smooth(-0.1, 0.1, sunEl);
  // real-time drift, so clouds move at the wind's speed as you watch
  return {
    day, dusk: Math.exp(-((sunEl / 0.13) ** 2)), sunA, sunEl, moonA, moonEl, phase,
    moonlight: moonEl > 0 ? (1 - Math.cos(2 * Math.PI * phase)) / 2 * Math.min(1, moonEl * 5) * (1 - day) : 0,
    cloud: w.cloud, precip: w.precip, flash: lightning(seed, t, w.snow ? 0 : w.precip, bolt)[0], driftX: w.windX * sec * 3, driftY: w.windY * sec * 3, city, grid, sec,
    cityLit: grid.subs.reduce((a, s, k) => a + Math.min(1, power(grid, k, s.x, s.y, 7, 0, sec)[0]), 0) / grid.subs.length,
  };
}

/**
 * How much the ground under a point lights the clouds: the city (brighter downtown), fading over
 * the dark seam, and the seam's own fires in a ring outside the fence.
 */
function glowBelow(S0: SkyFrame, x: number, y: number, out: Float32Array) {
  const c = S0.city;
  const dx = Math.max(0, -x, x - c.w), dy = Math.max(0, -y, y - c.h), out_ = Math.hypot(dx, dy);
  // the city's glow, round and soft (following the city's square edge drew a square on the deck)
  const half = Math.min(c.w, c.h) / 2, rc = Math.hypot(x - c.w / 2, y - c.h / 2) / half;
  const spread = Math.exp(-(rc ** 2.4) * 0.9);
  const core = Math.exp(-((Math.hypot(x - c.cx, y - c.cy) / (Math.min(c.w, c.h) * 0.45)) ** 2));
  // a blacked-out district stops lighting the clouds over it, blended over the substations around
  // (light scatters: a hard switch at each substation's border showed as cut-out shapes)
  const lit = litAt(S0, x, y) * 0.88 + 0.12;
  const city = spread * (0.6 + 0.4 * core) * lit;
  // the seam's fires in a ring outside the fence, and the great crater under the Sarcophagus
  const S = c.sarcophagus, crater = Math.exp(-((Math.hypot(x - S.x, y - S.y) / (S.r * 1.3)) ** 2));
  const fire = Math.exp(-(((out_ - 450) / 420) ** 2)) + 1.6 * crater;
  // muted: a sodium city lights its overcast a dull brown-orange, not a bright one
  out[0] = 62 * city + 70 * fire; out[1] = 42 * city + 24 * fire; out[2] = 34 * city + 12 * fire;
}
const GLOW = new Float32Array(3);

/** The lit-share grid over the city and a margin around it, rebuilt every frame (cheap: LG x LG points). */
const LG = 32, MARGIN = 1500, LIT = new Float32Array(LG * LG);
function buildLit(c: City, grid: PowerGrid, sec: number) {
  const pw = grid.subs.map((s, k) => Math.min(1, power(grid, k, s.x, s.y, 7, 0, sec)[0]));
  for (let j = 0; j < LG; j++) for (let i = 0; i < LG; i++) {
    const x = -MARGIN + ((c.w + 2 * MARGIN) * i) / (LG - 1), y = -MARGIN + ((c.h + 2 * MARGIN) * j) / (LG - 1);
    let lw = 0, ls = 0;
    grid.subs.forEach((s, k) => { const w = Math.exp(-((s.x - x) ** 2 + (s.y - y) ** 2) / (2 * 450 * 450)) + 1e-9; lw += w; ls += w * pw[k]; });
    LIT[j * LG + i] = ls / lw;
  }
}
/** Bilinear lookup in the lit-share grid (1 outside it). */
function litAt(S: SkyFrame, x: number, y: number) {
  const c = S.city, fx = ((x + MARGIN) / (c.w + 2 * MARGIN)) * (LG - 1), fy = ((y + MARGIN) / (c.h + 2 * MARGIN)) * (LG - 1);
  if (fx < 0 || fy < 0 || fx >= LG - 1 || fy >= LG - 1) return 1;
  const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, k = j * LG + i;
  return (LIT[k] * (1 - tx) + LIT[k + 1] * tx) * (1 - ty) + (LIT[k + LG] * (1 - tx) + LIT[k + LG + 1] * tx) * ty;
}

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
    let sunK = 0, cover = 0;
    if (S.sunEl > -0.15) {
      // a soft glow where the sun is (no disk: it would be a white blot), added after the clouds
      const el = Math.atan(up), ang = Math.hypot(dS * Math.cos(el), el - S.sunEl);
      // computed over the whole sky: the wide halo has no edge to cut it off
      sunK = (Math.exp(-ang / 0.09) * 0.8 + Math.exp(-ang / 0.35) * 0.25) * Math.min(1, (S.sunEl + 0.15) / 0.2);
    }

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
        lit = lit * (0.72 + 0.28 * noise(u * 3 + 40, v * 3 + 40)) + 0.05 * night * night; // maria, and faint earthshine at night
        // by day only the sunlit part shows, pale against the blue; the dark side is just sky
        if (lit > 0.04 + 0.2 * S.day) {
          const k = Math.min(1, lit) * (0.35 + 0.65 * night);
          ch = MOON_GLYPH[Math.min(4, Math.floor(k * 5))]; cr = 235 * k + 20 + r * S.day; cg = 228 * k + 20 + g * S.day; cb = 200 * k + 26 + b * S.day;
          r += (13 + 40 * k) * night + 60 * k * S.day; g += (12 + 38 * k) * night + 60 * k * S.day; b += (11 + 34 * k) * night + 55 * k * S.day;
          moonA = 1; star = 0;
        }
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
        glowBelow(S, wx, wy, GLOW);
        const thick = Math.min(1, a * (0.5 + d));
        const gk = (0.35 + 0.65 * thick) * (0.8 + 0.5 * S.precip) * night;
        let qr = 12 + GLOW[0] * gk, qg = 12 + GLOW[1] * gk, qb = 18 + GLOW[2] * gk;
        const grey = (150 - 60 * thick - 35 * S.precip) * S.day;
        qr += grey; qg += grey * 1.01; qb += grey * 1.06;
        // dusk paints the undersides on the sun's side; the moon silvers thin edges
        qr += 150 * S.dusk * toSun * (1 - thick * 0.5); qg += 60 * S.dusk * toSun; qb += 30 * S.dusk;
        // lightning lights the deck from inside, white-violet
        qr += 190 * S.flash; qg += 185 * S.flash; qb += 230 * S.flash;
        const ml = S.moonlight * (1 - thick) * 60;
        qr += ml; qg += ml; qb += ml * 1.15;
        if (moonA) { qr += cr * 0.3 * (1 - thick); qg += cg * 0.3 * (1 - thick); qb += cb * 0.3 * (1 - thick); }
        // the far deck sinks into the haze, which the city's light warms too
        const hz = 1 - Math.exp(-D / 12000), hk = 0.4 * night * (0.6 + 0.6 * S.precip) * (0.25 + 0.75 * S.cityLit);
        qr += (26 + 55 * hk + 90 * S.day - qr) * hz; qg += (22 + 32 * hk + 95 * S.day - qg) * hz; qb += (26 + 22 * hk + 102 * S.day - qb) * hz;
        r += (qr - r) * a; g += (qg - g) * a; b += (qb - b) * a;
        cover = a;
        star *= 1 - a;
        // clouds are color only (glyphs on them looked dirty); they hide the moon as they thicken
        if (moonA) { if (thick > 0.6) ch = 0; else { cr *= 1 - a * 0.8; cg *= 1 - a * 0.8; cb *= 1 - a * 0.8; } }
      }
    }
    if (sunK > 0.003) {
      // through clouds the glow dims but spreads: a bright patch and lit edges near the sun
      const sk = sunK * (1 - 0.55 * cover);
      r += 230 * sk; g += (205 - 60 * S.dusk) * sk; b += (170 - 90 * S.dusk) * sk;
    }
    grid.setBg(i, r, g, b);
    if (star > r + 25 && !moonA) grid.put(i, hs < 0.003 ? C('*') : C('.'), star, star, star + 30);
    else if (ch) grid.put(i, ch, cr, cg, cb);
  }
}
