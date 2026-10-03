import { hash3 } from '../core/rng';
import { type PowerGrid } from '../sim/power';

/**
 * How much power one element (a window, a building's signs, a lamp) has at a moment, from its
 * substation's state: a pure function, like the signs' flicker, so picture and sound agree.
 *
 * Going down: a ring runs out from where the switch was thrown, slow enough to watch, and reaches
 * the nearest buildings first. Just before it arrives the lights surge a little brighter; when it
 * reaches a building, its lights go out within half a second, a flicker each, by groups (the
 * shader's winGroup: whole floors, or runs of 4..8 windows). Coming back: buildings return in random
 * order over some ten seconds, and inside each one the groups come on within a second, flickering
 * before they hold. Buildings on a
 * generator fall dark and come back dimmer a few seconds later.
 */

/** Speed of the blackout ring, metres per second. */
const WAVE = 120;
/** Out: [level 0 .. ~1.35, seconds since this element came back on (for warm-up), or -1]. */
export const PW = new Float32Array(2);

/**
 * Element id at (x, y) on substation sub. Elements of one building share a group (and its
 * position): the ring reaches them together, then they go within `spread` seconds of each other.
 */
export function power(p: PowerGrid, sub: number, x: number, y: number, id: number, gen: number, sec: number, group = id, spread = 0.25): Float32Array {
  const S = p.subs[sub];
  PW[1] = -1;
  if (S.changed < 0) { PW[0] = 1; return PW; }
  const since = sec - S.changed / 60, d = Math.hypot(x - S.ox, y - S.oy);
  const hb = hash3(group, sub, 404), hw = hash3(id, sub, 407);
  if (!S.on) {
    const t = since - d / WAVE - hb * 0.3 - hw * spread;
    if (t < -0.6) PW[0] = 1;
    else if (t < 0) PW[0] = 1 + 0.35 * (1 + t / 0.6); // the surge before it burns out
    else if (t < 0.32) PW[0] = hash3(id, Math.floor(t * 28), 405) < 0.45 ? 1.25 : 0.05; // sparks and flicker
    else PW[0] = gen && t > 3 ? Math.min(0.55, (t - 3) * 0.4) : 0;
    return PW;
  }
  // restored: building by building in random order, out from the switch, then light by light
  const t = since - (0.4 + hb * 10 + hw * spread * 2 + d / WAVE / 2);
  if (t < 0) { PW[0] = gen ? 0.55 : 0; return PW; }
  PW[1] = t;
  PW[0] = t < 0.7 && hash3(id, Math.floor(t * 18), 406) < 0.5 ? 0.15 : 1;
  return PW;
}

/**
 * The share of one substation's elements lit now, without the flicker: a straight line from the
 * switch to the moment the ring has crossed the whole city (w x h) going down, or the last building
 * has come back going up. For the light over everything (the city's glow), which should fall and
 * rise at a steady rate instead of following each lamp's sparks.
 */
export function smoothPower(p: PowerGrid, sub: number, sec: number, w: number, h: number): number {
  const S = p.subs[sub];
  if (S.changed < 0) return 1;
  const since = sec - S.changed / 60;
  const far = Math.hypot(Math.max(S.ox, w - S.ox), Math.max(S.oy, h - S.oy));
  if (!S.on) return 1 - Math.min(1, Math.max(0, since / (far / WAVE + 0.9)));
  return Math.min(1, Math.max(0, (since - 0.4) / (11.4 + far / WAVE / 2)));
}
