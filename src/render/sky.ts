import { hash3 } from '../core/rng';
import { type City } from '../sim/city';
import { moonDir, moonPhase, sunDir } from '../sim/clock';
import { lightning, type Weather } from '../sim/weather';
import { type PowerGrid } from '../sim/power';
import { smoothPower } from './power';
import {  } from './grid';

/**
 * The sky: a gradient that follows the sun (night is the main look; dusk and dawn are colored,
 * the day pale and hazy), stars, the moon with its phase, and a cloud layer whose cover comes from
 * the weather. Clouds are lit from below by the city's sodium glow and by the burning seam, the way
 * a real city lights its overcast.
 */



// a tileable field of smooth noise, sampled at several scales for the clouds
const N = 256, NOISE = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) NOISE[j * N + i] = hash3(i, j, 777);
const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };


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
  /** The earth's shadow (its umbra's center) from the moon's center, in moon radii, along the sky (u) and up (v): far off but at an eclipse. */
  eclU: number;
  eclV: number;
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
/** The moon's true radius in the sky, and the earth's umbra and penumbra there (in moon radii; the shader draws them on its larger disc). */
const MOON_REAL = 0.259 * (Math.PI / 180);
export const UMBRA = 2.7, PENUMBRA = 4.7;
/** Sky azimuth (from north, clockwise) to a world heading (north is -y). */
const heading = (az: number) => az - Math.PI / 2;

/** Daylight at game time t: 0 at night, 1 with the sun a few degrees up. */
export function daylight(t: number) {
  return smooth(-0.1, 0.1, sunDir(t, tmp)[0]);
}

const bolt = new Float64Array(2);
export function prepareSky(city: City, grid: PowerGrid, w: Weather, seed: number, t: number, sec: number): SkyFrame {
  sunDir(t, tmp);
  const sunEl = tmp[0], sunA = heading(tmp[1]);
  moonDir(t, tmp);
  const moonEl = tmp[0], moonA = heading(tmp[1]), phase = moonPhase(t);
  const day = smooth(-0.1, 0.1, sunEl);
  // the earth's shadow, opposite the sun, against the moon as the earth's center sees it (its parallax taken off)
  const geoEl = moonEl + 0.951 * (Math.PI / 180) * Math.cos(moonEl);
  let dA = sunA + Math.PI - moonA; dA -= Math.round(dA / (2 * Math.PI)) * 2 * Math.PI;
  const eclU = (dA * Math.cos(moonEl)) / MOON_REAL, eclV = (-sunEl - geoEl) / MOON_REAL;
  // in the umbra the moon dims to a copper glow (and the night with it)
  const umbra = 1 - smooth(UMBRA - 0.8, UMBRA + 1, Math.hypot(eclU, eclV));
  // real-time drift, so clouds move at the wind's speed as you watch
  return {
    day, dusk: Math.exp(-((sunEl / 0.13) ** 2)), sunA, sunEl, moonA, moonEl, phase, eclU, eclV,
    moonlight: moonEl > 0 ? (1 - Math.cos(2 * Math.PI * phase)) / 2 * Math.min(1, moonEl * 5) * (1 - day) * (1 - 0.92 * umbra) : 0,
    cloud: w.cloud, precip: w.precip, flash: lightning(seed, t, w.snow ? 0 : w.precip, bolt)[0], driftX: w.windX * sec * 3, driftY: w.windY * sec * 3, city, grid, sec,
    cityLit: grid.subs.reduce((a, _, k) => a + smoothPower(grid, k, sec, city.w, city.h), 0) / grid.subs.length,
  };
}



