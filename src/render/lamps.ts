import { hash3 } from '../core/rng';
import { type City, type Prop } from '../sim/city';

/**
 * Street-lamp failures, like the neon signs: pure functions of the lamp and the time. Most lamps
 * burn steady; some are sodium lamps at the end of their life, which go out, cool down and strike
 * again, warming from a dim red to full amber; some stutter; a few are dead. The same warm-up is
 * what every lamp will do when the power comes back after a blackout (stage 5b).
 */
export const LampMode = { Steady: 0, Cycling: 1, Stutter: 2, Dead: 3 } as const;

export function lampMode(id: number): number {
  const h = hash3(id, 11, 5);
  return h < 0.88 ? LampMode.Steady : h < 0.94 ? LampMode.Cycling : h < 0.97 ? LampMode.Stutter : LampMode.Dead;
}

/** Warm-up of a sodium lamp after it strikes, in seconds. */
const WARM = 9;

/**
 * State of lamp `id` at time `sec`: writes brightness (0..1) and warmth (0 = the red glow of a lamp
 * just struck, 1 = full amber) into out[0], out[1].
 */
export function lampState(id: number, sec: number, out: Float32Array) {
  const mode = lampMode(id);
  out[0] = 1; out[1] = 1;
  if (mode === LampMode.Dead) out[0] = 0;
  else if (mode === LampMode.Stutter) out[0] = lampStutter(id, sec) ? 0.05 : 1;
  else if (mode === LampMode.Cycling) {
    // burns for a while, flickers out, stays dark while it cools, then strikes and warms up
    const period = 25 + 30 * hash3(id, 12, 5), p = (sec + period * hash3(id, 13, 5)) % period;
    const on = period - WARM - 4;
    if (p < on) out[0] = p > on - 1 && hash3(id, Math.floor(sec * 12), 14) < 0.5 ? 0.2 : 1;
    else if (p < on + 4) out[0] = 0;
    else { const w = (p - on - 4) / WARM; out[0] = 0.15 + 0.85 * w; out[1] = w * w; }
  }
}

/** True while a stuttering lamp is out, so its hum can cut out with it. */
export function lampStutter(id: number, sec: number): boolean {
  return hash3(id, Math.floor(sec / 2.3), 15) < 0.4 && hash3(id, Math.floor(sec * 9), 16) < 0.55;
}

const ids = new WeakMap<City, Map<Prop, number>>();
/** A lamp prop's identity, its index in city.lamps. */
export function lampId(city: City, p: Prop): number {
  let m = ids.get(city);
  if (!m) { m = new Map(city.lamps.map((l, k) => [l, k])); ids.set(city, m); }
  return m.get(p) ?? -1;
}
