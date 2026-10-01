import { hash3 } from '../core/rng';
import { type PowerGrid } from '../sim/power';

/**
 * How much power one element (a building's lights, a lamp) has at a moment, from its substation's
 * state: a pure function, like the signs' flicker, so picture and sound agree.
 *
 * Going down: a wave runs out from the substation and crosses a district in under a second. Just
 * before it arrives the lights surge a little brighter; then each one flickers and dies on its
 * own. Coming back: element by element over some fifteen seconds, each flickering before it holds.
 * Buildings on a generator fall dark and then come back dimmer a few seconds later.
 */

/** Speed of the blackout wave, metres per second. */
const WAVE = 1400;
/** Out: [level 0 .. ~1.3, seconds since this element came back on (for warm-up), or -1]. */
export const PW = new Float32Array(2);

export function power(p: PowerGrid, sub: number, x: number, y: number, id: number, gen: number, sec: number): Float32Array {
  const S = p.subs[sub];
  PW[1] = -1;
  if (S.changed < 0) { PW[0] = 1; return PW; }
  const since = sec - S.changed / 60, d = Math.hypot(x - S.x, y - S.y), h = hash3(id, sub, 404);
  if (!S.on) {
    const t = since - d / WAVE - h * 0.25;
    if (t < -0.6) PW[0] = 1;
    else if (t < 0) PW[0] = 1 + 0.35 * (1 + t / 0.6); // the surge before it burns out
    else if (t < 0.32) PW[0] = hash3(id, Math.floor(t * 28), 405) < 0.45 ? 1.25 : 0.05; // sparks and flicker
    else PW[0] = gen && t > 3 ? Math.min(0.55, (t - 3) * 0.4) : 0;
    return PW;
  }
  // restored: each element at its own moment, nearer ones first
  const t = since - (0.4 + h * 13 + d / 500);
  if (t < 0) { PW[0] = gen ? 0.55 : 0; return PW; }
  PW[1] = t;
  PW[0] = t < 0.7 && hash3(id, Math.floor(t * 18), 406) < 0.5 ? 0.15 : 1;
  return PW;
}
