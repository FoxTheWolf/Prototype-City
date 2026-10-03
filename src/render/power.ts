import { hash3 } from '../core/rng';
import { type PowerGrid } from '../sim/power';

/**
 * How much power one element (a window, a building's signs, a lamp) has at a moment, from its
 * substation's state: a pure function, like the signs' flicker, so picture and sound agree.
 *
 * Going down (L.12, after Watch Dogs): for SURGE seconds every light on the substation swells
 * brighter at once (and some video screens crash), then a ring runs out from where the switch was
 * thrown, slow enough to watch, and reaches the nearest buildings first; when it
 * reaches a building, its lights go out within half a second, a flicker each, by groups (the
 * shader's winGroup: whole floors, or runs of 4..8 windows). Coming back: a ring again, out from
 * the switch (the player), each building within a couple of seconds of it, and inside each one the
 * groups come on within a second, flickering before they hold. Buildings on a
 * generator fall dark and come back dimmer a few seconds later.
 */

/** Speed of the blackout ring, metres per second. */
const WAVE = 120;
/** (L.12) The surge before the ring starts: seconds, and how much brighter it gets (the shader's power() keeps the same). */
export const SURGE = 1.8, SURGE_K = 1;
/** (L.12) How long the eye stays as it was after the light comes back round the viewer, before it adapts again. */
const EYE_BRIGHT_S = 2.5;
/** Out: [level 0 .. 2 (the surge), seconds since this element came back on (for warm-up), or -1]. */
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
    // the surge: everything swells together, and holds a little brighter until the ring arrives
    if (since < SURGE) { const k = since / SURGE; PW[0] = 1 + SURGE_K * k * k * (3 - 2 * k); return PW; }
    const t = since - SURGE - d / WAVE - hb * 0.3 - hw * spread;
    if (t < 0) PW[0] = 1 + SURGE_K;
    else if (t < 0.32) PW[0] = hash3(id, Math.floor(t * 28), 405) < 0.45 ? 1.25 : 0.05; // sparks and flicker
    else PW[0] = gen && t > 3 ? Math.min(0.55, (t - 3) * 0.4) : 0;
    return PW;
  }
  // restored: out from the switch in a ring, building by building, then light by light
  const t = since - upDelay(d, hb, hw, spread);
  if (t < 0) { PW[0] = gen ? 0.55 : 0; return PW; }
  PW[1] = t;
  PW[0] = t < 0.7 && hash3(id, Math.floor(t * 18), 406) < 0.5 ? 0.15 : 1;
  return PW;
}

/** When an element at distance d from the switch comes back (hb: its building's, hw: its own hash). */
function upDelay(d: number, hb: number, hw: number, spread: number) { return 0.4 + d / WAVE + hb * 2 + hw * spread * 2; }

/** Whether a video screen of building id shows the crash screen now (as the shader's bsod): some of
 *  them through the surge, all of them half a second before the ring reaches them, and a few seconds
 *  after they come back, as they reboot. */
export function bsod(p: PowerGrid, sub: number, x: number, y: number, id: number, sec: number, spread = 0.25): boolean {
  const S = p.subs[sub];
  if (S.changed < 0) return false;
  const since = sec - S.changed / 60, d = Math.hypot(x - S.ox, y - S.oy);
  const hb = hash3(id, sub, 404), hw = hash3(id, sub, 407);
  if (!S.on) {
    if (since < SURGE + 0.5 && hash3(id, sub, 410) < 0.35 && since > 0.3 + hash3(id, sub, 411) * 1.2) return true;
    const t = since - SURGE - d / WAVE - hb * 0.3 - hw * spread;
    return t > -0.5 && t < 0.32;
  }
  const t = since - upDelay(d, hb, hw, spread);
  return t >= 0 && t < 2.5 + hash3(id, sub, 409) * 3;
}

/**
 * (L.12) The eye through a blackout at (x, y): how much it is held where it was (0 free .. 1 held).
 * Going down it is held through the surge, until the dark reaches the viewer (then eyePush darkens
 * it, L.13). Coming back, held as the
 * lights return round the viewer and for EYE_BRIGHT_S after: everything is blown bright for a moment.
 */
export function eyeHold(p: PowerGrid, sub: number, x: number, y: number, sec: number): number {
  const S = p.subs[sub];
  if (S.changed < 0) return 0;
  const since = sec - S.changed / 60, d = Math.hypot(x - S.ox, y - S.oy);
  // going down, held only through the surge: then eyePush takes over
  if (!S.on) return since >= 0 && since < SURGE + d / WAVE + 0.3 ? 1 : 0;
  const at = upDelay(d, 0.5, 0.5, 0.25) + 0.7, hold = EYE_BRIGHT_S;
  if (since < 0 || since > at + hold) return 0;
  return since < at ? 1 : 1 - (since - at) / hold;
}

/** (L.13) After the dark reaches the viewer, the eye is pushed darker within EYE_PUSH_S seconds (the dark comes fast), down to EYE_PUSH_K of where it was, held there EYE_PUSH_HOLD seconds, before it is let go. */
const EYE_PUSH_S = 1, EYE_PUSH_K = 0.2, EYE_PUSH_HOLD = 1;

/**
 * (L.13) Going down, how much darker the eye is pushed now (1 = not at all): from the moment the
 * dark reaches (x, y), smoothly down to EYE_PUSH_K over EYE_PUSH_S, held for EYE_PUSH_HOLD; 1 again
 * after that (the eye then adapts on from where it was left). Only at night (`night` 0 day .. 1 night):
 * by day the sky stays as bright, so there is nothing to push the eye.
 */
export function eyePush(p: PowerGrid, sub: number, x: number, y: number, sec: number, night: number): number {
  const S = p.subs[sub];
  if (S.changed < 0 || S.on) return 1;
  const k = (sec - S.changed / 60 - (SURGE + Math.hypot(x - S.ox, y - S.oy) / WAVE + 0.3)) / EYE_PUSH_S;
  if (k < 0 || k > 1 + EYE_PUSH_HOLD / EYE_PUSH_S || night <= 0) return 1;
  const m = Math.min(1, k);
  return 1 - (1 - EYE_PUSH_K) * m * m * (3 - 2 * m) * Math.min(1, night);
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
  if (!S.on) return 1 - Math.min(1, Math.max(0, (since - SURGE) / (far / WAVE + 0.9)));
  return Math.min(1, Math.max(0, (since - 0.4) / (3.4 + far / WAVE)));
}
