import { hash3 } from '../core/rng';
import { type Population } from './citizens';

/** Skin tones, light to dark; hair colors; eye colors; the clothes' colors (the render has the RGB of each, in this order). */
export const TONES = ['pale', 'fair', 'olive', 'tan', 'brown', 'dark'] as const;
export const HAIRS = ['black', 'dark brown', 'brown', 'light brown', 'blond', 'red', 'grey', 'white'] as const;
export const EYES = ['brown', 'hazel', 'green', 'blue'] as const;
export const CLOTHS = ['red', 'navy', 'grey', 'beige', 'green', 'brown', 'white', 'black'] as const;

/**
 * How someone looks (13.11e): part of who they are in the simulation, so a mission can describe a
 * person ("a blond woman in a red coat") and the player can find them by sight. From the seed,
 * like everything else about them, and from their age, gender and family: a household mostly
 * shares a skin tone, hair greys with age, beards are men's, long hair is mostly women's.
 */
export interface Looks {
  /** Index into TONES. */
  tone: number;
  /** Index into HAIRS. */
  hair: number;
  /** 0 bald, 1 short, 2 long. */
  hairLen: number;
  /** Index into EYES. */
  eyes: number;
  beard: boolean;
  /** Slim arms (3 pixels wide). */
  slim: boolean;
  /** Indices into CLOTHS; a jacket over the shirt or not, sleeves short or long, and the shirt plain or striped. */
  shirt: number;
  pants: number;
  jacket: number;
  jacketOn: boolean;
  shortSleeves: boolean;
  striped: boolean;
  /** 0 black, 1 brown, 2 white, 3 tan. */
  shoes: number;
}

export function looksOf(P: Population, i: number): Looks {
  const h = (k: number) => hash3(P.seed, i, 0x100c + k);
  const known = i >= 0 && i < P.n;
  const age = known ? P.age[i] : 20 + Math.floor(h(0) * 50), man = known ? P.gender[i] === 1 : h(1) < 0.5;
  const fam = known ? P.home[i] : i;
  // the family's tone, most people share it; the rest one step either way
  const famTone = Math.floor(hash3(P.seed, fam, 0x100b) * TONES.length);
  const tone = h(2) < 0.75 ? famTone : Math.max(0, Math.min(TONES.length - 1, famTone + (h(3) < 0.5 ? -1 : 1)));
  const dark = tone >= 3;
  // hair: darker skins mostly black or dark brown; then greying from the fifties
  const hr = h(4);
  let hair = dark ? (hr < 0.7 ? 0 : hr < 0.95 ? 1 : 2) : hr < 0.2 ? 0 : hr < 0.45 ? 1 : hr < 0.68 ? 2 : hr < 0.8 ? 3 : hr < 0.95 ? 4 : 5;
  const grey = Math.max(0, (age - 45) / 35);
  if (h(5) < grey) hair = age > 72 && h(6) < 0.5 ? 7 : 6;
  // length: mostly long for women, short for men; men bald more often with age
  const lr = h(7), bald = man ? 0.03 + Math.max(0, age - 35) / 120 : 0.01;
  const hairLen = lr < bald ? 0 : man ? (lr < 0.92 ? 1 : 2) : lr < 0.28 ? 1 : 2;
  const er = h(8), eyes = dark ? (er < 0.9 ? 0 : 1) : er < 0.45 ? 0 : er < 0.65 ? 1 : er < 0.78 ? 2 : 3;
  const beard = man && age >= 18 && hairLen !== 2 && h(9) < 0.25;
  const pick = (k: number) => Math.floor(h(k) * CLOTHS.length);
  const jacketOn = h(10) < 0.45, striped = !jacketOn && h(10) < 0.6;
  return {
    tone, hair, hairLen, eyes, beard, slim: man ? h(11) < 0.1 : h(11) < 0.8,
    shirt: pick(12), pants: pick(13), jacket: pick(14), jacketOn, striped,
    shortSleeves: !jacketOn && h(15) < 0.35, shoes: Math.floor(h(16) * 4),
  };
}

