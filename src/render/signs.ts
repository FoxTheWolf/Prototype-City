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

/** Marquee bulbs around the sign: every third one lit, running along. */
export function marqueeBulb(u: number, sec: number): boolean {
  return (Math.floor(u / 0.3) + Math.floor(sec * 7)) % 3 === 0;
}
