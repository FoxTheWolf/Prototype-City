import { hash3 } from '../core/rng';
import { calendar } from './clock';

/**
 * The weather over the city. The sky itself (clouds, rain or snow, temperature, wind) is a pure
 * function of the seed and the game time, so the same seed gives the same weather and a forecast
 * is just a look ahead. What the weather leaves behind (wet streets, snow on the ground) is summed
 * up tick by tick.
 */
export interface Weather {
  /** Share of the sky covered, 0..1. */
  cloud: number;
  /** (16.1c) The high thin cloud (cirrus, ~8 km) over it, 0..1: the veil that keeps the sun's red after the sunset. */
  high: number;
  /** Rain or snow falling, 0 (none) .. 1 (a storm). */
  precip: number;
  /** Air temperature in degrees C; below about 1 degree it snows. */
  temp: number;
  snow: boolean;
  /** Wind in m/s along x and y. */
  windX: number;
  windY: number;
  /** How wet the streets are, 0..1, and how much snow lies on the ground, 0..1. */
  wet: number;
  snowCover: number;
  /** Debug: a fixed sky instead of the forecast (see PRESETS), or -1. */
  preset: number;
}

/** Fixed skies to test with: [name, cloud, precip, temperature, high cloud]. */
export const PRESETS: [string, number, number, number, number][] = [
  ['clear', 0, 0, 12, 0], ['partly', 0.45, 0, 12, 0.3], ['overcast', 1, 0, 10, 0], ['drizzle', 1, 0.2, 9, 0],
  ['rain', 1, 0.55, 9, 0], ['storm', 1, 1, 8, 0], ['snow', 1, 0.5, -3, 0], ['high', 0.12, 0, 14, 0.85],
];

export function newWeather(): Weather {
  return { cloud: 0, high: 0, precip: 0, temp: 10, snow: false, windX: 0, windY: 0, wet: 0, snowCover: 0, preset: -1 };
}

/** Smooth 1D noise 0..1 over x, a different curve for every k. */
function wave(seed: number, k: number, x: number) {
  const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
  return hash3(seed, i, k) * (1 - s) + hash3(seed, i + 1, k) * s;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** The sky at game time t: clouds, precipitation, temperature and wind. */
export function forecast(seed: number, t: number, out: Weather) {
  const h = t / 3600, c = calendar(t);
  const season = Math.cos((2 * Math.PI * (c.doy - 15)) / 365.25); // 1 mid-January, -1 mid-July
  // weather systems pass every half day or so; showers come and go within them
  const system = wave(seed, 1, h / 14), local = wave(seed, 2, h / 3);
  out.cloud = clamp(0.1 + 1.2 * (system - 0.35) + 0.5 * (local - 0.5) + 0.1 * season);
  out.precip = clamp((wave(seed, 3, h / 4) - 0.45) * 2.2) * clamp((out.cloud - 0.75) * 5);
  // the high veil comes and goes on its own (often ahead of a system), hidden when the low deck closes
  out.high = clamp((wave(seed, 7, h / 9) - 0.45) * 2.5) * (1 - 0.7 * clamp((out.cloud - 0.6) * 2.5));
  // New York-like seasons: about -1 C in January and 25 C in July, warmest mid-afternoon
  out.temp = 12 - 13 * season + 4 * Math.cos((2 * Math.PI * (c.hour - 15)) / 24) + 10 * (wave(seed, 4, h / 30) - 0.5) - 3 * out.precip;
  const speed = 1.5 + 9 * wave(seed, 5, h / 8) + 8 * out.precip, dir = 4 * Math.PI * wave(seed, 6, h / 40);
  out.windX = Math.cos(dir) * speed; out.windY = Math.sin(dir) * speed;
  if (out.preset >= 0) { const P = PRESETS[out.preset]; out.cloud = P[1]; out.precip = P[2]; out.temp = P[3]; out.high = P[4]; }
  out.snow = out.temp < 1;
}

/** Advance by dt game seconds: the forecast for now, and what it leaves on the streets. */
export function stepWeather(w: Weather, seed: number, t: number, dt: number) {
  forecast(seed, t, w);
  const rain = w.snow ? 0 : w.precip, fall = w.snow ? w.precip : 0;
  // rain soaks the streets in minutes; they dry over a few hours, faster when warm and windy
  w.wet = clamp(w.wet + dt * (rain > 0 ? rain / 600 : -(1 + Math.max(0, w.temp) / 10) / 10800));
  // snow builds up over a couple of hours of steady snowfall and melts above freezing
  w.snowCover = clamp(w.snowCover + dt * (fall / 7200 - Math.max(0, w.temp) / 36000 - rain / 3600));
}

/**
 * Lightning in a storm, from the seed and the game time: in every 5-minute slot a bolt may strike
 * at a random moment, flashing twice. Returns the flash 0..1 in out[0] and the bolt's number in
 * out[1] (-1 when none is flashing), so the thunder can follow it once.
 */
export function lightning(seed: number, t: number, precip: number, out: Float64Array) {
  out[0] = 0; out[1] = -1;
  const p = Math.max(0, (precip - 0.7) / 0.3) * 0.6;
  if (p <= 0) return out;
  const slot = Math.floor(t / 300);
  for (const k of [slot, slot - 1]) {
    if (hash3(seed, k, 31) >= p) continue;
    const dt = t - (k * 300 + hash3(seed, k, 32) * 290);
    if (dt < 0 || dt > 9) continue; // a flash lasts about a third of a real second
    out[0] = Math.max(dt < 3 ? 1 - dt / 3 : 0, dt > 4.5 && dt < 9 ? 0.7 * (1 - (dt - 4.5) / 4.5) : 0);
    out[1] = k;
  }
  return out;
}
