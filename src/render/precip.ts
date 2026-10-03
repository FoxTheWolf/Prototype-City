import {  } from './grid';

/**
 * Falling rain and snow, drawn over the finished world. Drops live on a few shells around the
 * viewer (1.5 to 28 m away). On each shell they sit in columns fixed to compass angles, so turning
 * does not drag them, and fall at their real speed, slanted by the wind. A drop is drawn only
 * where nothing nearer was, so it disappears behind walls and cars; near a lamp it lights up.
 */

export const SHELLS = [1.6, 2.4, 3.5, 5, 7, 10, 14, 20, 28];

interface Fall {
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


/** A roof that keeps the rain off (bus shelters, for now): center, heading, half sizes, underside height. */
export interface Roof { x: number; y: number; c: number; s: number; hx: number; hy: number; z: number }


/**
 * How far the drops have fallen, integrated frame by frame: speed x time would run backwards
 * (the rain stopping in the air and rising) whenever the speed drops as the rain eases.
 */
let fallen = 0, lastSec = -1;

/**
 * The fall's shape: the drops' speed (m/s), streak length (m), how often a column holds one per band,
 * and the band's height (m); and how far they have fallen by now (integrated once per frame).
 */
export function fallShape(f: Fall) {
  const speed = f.snow ? 1.1 : 7 + 5 * Math.min(1, f.amount * 1.6);
  // streak length in metres (what the eye smears in a moment); flakes are points
  const streak = f.snow ? 0.06 : 0.25 + 0.35 * f.amount;
  // how often a column holds a drop, per 3 m of height
  const dens = f.snow ? 0.06 + 0.22 * f.amount : 0.03 + 0.3 * f.amount;
  // (a second view drawn in the same frame, the camera's, does not add to it)
  if (f.sec > lastSec) { if (lastSec >= 0) fallen += speed * Math.min(0.25, f.sec - lastSec); lastSec = f.sec; }
  return { speed, streak, dens, period: f.snow ? 1.2 : 3, fallen };
}

