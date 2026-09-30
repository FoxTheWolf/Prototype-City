import { hash3 } from '../core/rng';
import { businessName } from '../locale/names';
import { type City } from '../sim/city';

/**
 * Neon shop signs. The text is the name of the business in the building (sim data, words from the
 * locale); the light effects are pure functions of the business and the time, so the sound of a
 * failing tube can follow the same flicker.
 */
export const SignMode = { Steady: 0, Chase: 1, Blink: 2, Broken: 3, Marquee: 4 } as const;

const texts = new Map<number, string>();
/**
 * Upper-case sign text of a business, for a face that fits `fit` letters: the full name, or when it
 * is too long its longest word, cut to fit.
 */
export function signText(city: City, biz: number, fit: number): string {
  const key = biz * 256 + Math.max(0, Math.min(255, fit));
  let s = texts.get(key);
  if (s === undefined) {
    s = businessName(city, biz).toUpperCase();
    if (s.length > fit) s = s.split(' ').sort((a, b) => b.length - a.length)[0].slice(0, Math.max(0, fit));
    texts.set(key, s);
  }
  return s;
}

export function signMode(city: City, biz: number): number {
  const kind = city.businesses[biz].kind;
  if (kind === 'cinema' || kind === 'hotel') return SignMode.Marquee;
  const h = hash3(biz, 7, 3);
  return h < 0.4 ? SignMode.Steady : h < 0.62 ? SignMode.Chase : h < 0.72 ? SignMode.Blink : SignMode.Broken;
}

/**
 * Brightness 0..1 of letter k at time `sec` (seconds). Unlit tubes stay faintly visible.
 * k = -1 asks for the whole sign (used for the frame). n is the length of the full name, so the
 * timing is the same on every face (a narrow face shows a shortened name) and for the sound.
 */
export function signLight(biz: number, mode: number, k: number, n: number, sec: number): number {
  const OFF = 0.12;
  if (mode === SignMode.Chase) {
    // letters light up one by one, then the whole word holds and goes dark for a beat
    const step = 0.22, cycle = n * step + 2.2, p = (sec + hash3(biz, 1, 1) * cycle) % cycle;
    if (p < n * step) return k < 0 ? 1 : k <= p / step ? 1 : OFF;
    return p < n * step + 1.6 ? 1 : OFF;
  }
  if (mode === SignMode.Blink) {
    const p = (sec + hash3(biz, 2, 2) * 1.3) % 1.3;
    return p < 0.85 ? 1 : OFF;
  }
  if (mode === SignMode.Broken && k >= 0) {
    // one dead tube, one failing tube that stutters in bursts
    if (k === Math.floor(hash3(biz, 3, 3) * n) && hash3(biz, 3, 4) < 0.5) return OFF;
    if (k === Math.floor(hash3(biz, 4, 3) * n)) return signStutter(biz, sec) ? OFF : 1;
  }
  return 1;
}

/** True while a Broken sign's failing tube is out (for its buzz to cut out with it). */
export function signStutter(biz: number, sec: number): boolean {
  const burst = hash3(biz, Math.floor(sec / 1.7), 5) < 0.35;
  return burst && hash3(biz, Math.floor(sec * 14), 6) < 0.5;
}

/**
 * 5x7 bulb patterns for the letters when seen up close: seven rows from the top, 5 bits each
 * (the high bit is the left column).
 */
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  '&': [12, 18, 20, 8, 21, 18, 13], "'": [4, 4, 8, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], '-': [0, 0, 0, 31, 0, 0, 0],
};

/** Whether the bulb at column bx (0..4, from the left) and row by (0..6, from the top) of a letter is there. */
export function bulbOn(c: number, bx: number, by: number): boolean {
  const rows = FONT[String.fromCharCode(c)];
  return !!rows && ((rows[by] >> (4 - bx)) & 1) === 1;
}

/** Marquee bulbs around the sign: every third one lit, running along. */
export function marqueeBulb(u: number, sec: number): boolean {
  return (Math.floor(u / 0.3) + Math.floor(sec * 7)) % 3 === 0;
}
