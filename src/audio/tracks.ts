/**
 * The songs that come with the Tunes Player (15.9b): chiptune, written by hand, played by music.ts on
 * four channels as an old console would (a pulse lead, a pulse arpeggio, a triangle bass, noise drums).
 * Their bands and titles are in locale/music.en.json, by `id`.
 *
 * The notation, so the songs read as music:
 * - `prog`: the chords, one per bar, cycling all through the song (`Am`, `Bb`, `F#m`, `C`...);
 * - `bass`: one bar of steps (16ths), a semitone offset from the bar's chord root (octave 2) starts a
 *   note, `~` holds it, `.` is silence;
 * - `drums`: one bar, a character a step: `k` kick, `s` snare, `h` closed hat, `o` open hat, `.` none;
 * - `arp`: the chord's tones broken up (`up` or `updown`), a note every `rate` steps, at `oct`ave;
 * - `parts`: the melodies, `A4/4` a note lasting 4 steps, `r/2` a rest; each part a whole number of bars;
 * - `form`: the sections in order: a part's letter, `i` the band without lead or drums, `_` the band without lead.
 */
export interface Track {
  id: string;
  bpm: number;
  /** Steps (16ths) in a bar: 16 for 4/4, 12 for a waltz. */
  bar: number;
  prog: string;
  bass: string;
  drums: string;
  arp: { kind: 'up' | 'updown'; rate: number; oct: number };
  /** The lead's voice: a pulse of this duty (0.125, 0.25, 0.5), or the triangle's softer one. */
  lead: number | 'tri';
  parts: Record<string, string>;
  form: string;
}

export const TRACKS: Track[] = [
  {
    id: 'sodium', bpm: 100, bar: 16, prog: 'Am F C G',
    bass: '0 ~ . 0 12 . 0 . 0 ~ . 0 7 . 5 .', drums: 'k.h.s.h.k.hks.h.',
    arp: { kind: 'up', rate: 2, oct: 4 }, lead: 0.25,
    parts: {
      A: 'E5/4 A4/2 C5/2 E5/4 D5/2 C5/2  C5/6 A4/2 F4/4 A4/4  G4/2 C5/2 E5/2 G5/6 E5/4  D5/8 B4/4 G4/4 '
       + 'E5/4 A5/4 G5/2 E5/2 C5/4  A4/4 C5/4 F5/4 E5/2 D5/2  E5/6 D5/2 C5/4 G4/4  B4/4 D5/4 G4/8',
      B: 'A5/2 G5/2 E5/2 C5/2 A4/4 E5/4  F5/8 E5/4 C5/4  G5/2 E5/2 C5/2 G4/2 E5/4 G5/4  B5/6 A5/2 G5/4 D5/4 '
       + 'C6/4 B5/2 A5/2 E5/8  F5/4 A5/4 C6/4 A5/4  G5/4 E5/4 G5/2 E5/2 C5/4  D5/4 B4/4 D5/4 E5/4',
    },
    form: 'iAABA_',
  },
  {
    id: 'nightshift', bpm: 120, bar: 16, prog: 'Dm Bb C Am',
    bass: '0 . 12 . 0 . 12 . 0 . 12 . 0 . 12 .', drums: 'k.h.s.hkk.h.s.hh',
    arp: { kind: 'updown', rate: 1, oct: 5 }, lead: 0.25,
    parts: {
      A: 'D5/4 F5/4 A5/4 F5/4  D5/4 F5/2 D5/2 Bb4/8  C5/4 E5/4 G5/4 E5/2 C5/2  A4/8 C5/4 E5/4 '
       + 'F5/2 E5/2 D5/4 A5/8  Bb5/4 A5/4 F5/4 D5/4  E5/4 G5/4 C6/4 G5/4  A5/12 r/4',
      B: 'A5/2 A5/2 G5/2 F5/2 E5/2 F5/2 D5/4  F5/2 F5/2 E5/2 D5/2 C5/2 D5/2 Bb4/4 '
       + 'E5/2 G5/2 C6/2 G5/2 E5/2 G5/2 C5/4  C5/4 E5/4 A5/8',
    },
    form: 'iAABBA_',
  },
  {
    id: 'static', bpm: 144, bar: 16, prog: 'Em C G D',
    bass: '0 0 . 0 . 0 7 . 0 0 . 0 . 0 5 7', drums: 'k.h.s.h.k.k.s.hs',
    arp: { kind: 'up', rate: 2, oct: 4 }, lead: 0.5,
    parts: {
      A: 'B4/4 E5/4 G5/4 E5/4  C5/4 E5/4 G5/6 E5/2  D5/4 B4/4 D5/4 G5/4  F#5/8 A5/4 F#5/4 '
       + 'G5/4 F#5/4 E5/4 B4/4  C5/4 G5/4 E5/4 C5/4  B4/2 D5/2 G5/4 B5/4 G5/4  A5/8 F#5/8',
      B: 'E5/2 r/2 E5/2 r/2 G5/2 r/2 B5/4  C6/2 r/2 B5/2 r/2 G5/2 r/2 E5/4 '
       + 'D5/2 r/2 G5/2 r/2 B5/2 r/2 D6/4  D6/4 A5/4 F#5/8',
    },
    form: 'iAABAB_A',
  },
  {
    id: 'rails', bpm: 78, bar: 16, prog: 'Cm Ab Eb Bb',
    bass: '0 ~ ~ ~ ~ ~ . . 7 ~ ~ ~ 5 ~ ~ ~', drums: 'k...h...s...h..h',
    arp: { kind: 'updown', rate: 2, oct: 4 }, lead: 'tri',
    parts: {
      A: 'G4/8 C5/4 Eb5/4  Eb5/12 C5/4  Bb4/8 G4/4 Bb4/4  D5/16 '
       + 'Eb5/4 D5/4 C5/4 G4/4  Ab4/8 C5/8  G5/6 F5/2 Eb5/8  F5/8 D5/8',
      B: 'C6/8 Bb5/4 G5/4  Ab5/8 Eb5/8  G5/4 Bb5/4 Eb6/8  D6/8 F5/8 '
       + 'Eb5/4 G5/4 C6/4 G5/4  Ab5/4 F5/4 Eb5/4 C5/4  Bb4/4 Eb5/4 G5/8  F5/16',
    },
    form: 'iABA_',
  },
  {
    id: 'waltz', bpm: 132, bar: 12, prog: 'Fm Db Eb C',
    bass: '0 ~ ~ ~ 7 ~ . . 7 ~ . .', drums: 'k...h...h...',
    arp: { kind: 'up', rate: 2, oct: 4 }, lead: 0.125,
    parts: {
      A: 'C5/8 F5/4  Ab5/8 F5/4  G5/4 Bb5/4 G5/4  E5/12 '
       + 'F5/4 Ab5/4 C6/4  Db6/8 Ab5/4  Bb5/4 G5/4 Eb5/4  C5/8 E5/4',
      B: 'Ab5/2 G5/2 F5/4 C5/4  F5/2 Eb5/2 Db5/4 Ab4/4  G4/4 Bb4/4 Eb5/4  G5/4 E5/4 C5/4',
    },
    form: 'iAABA_ABA',
  },
  {
    id: 'lasttrain', bpm: 112, bar: 16, prog: 'G Em C D',
    bass: '0 . 7 . 12 . 7 . 0 . 7 . 12 . 7 .', drums: 'k.h.s.h.k.h.s.h.',
    arp: { kind: 'up', rate: 1, oct: 5 }, lead: 0.25,
    parts: {
      A: 'D5/4 G5/4 B5/4 G5/4  E5/6 G5/2 B5/8  C6/4 B5/4 A5/4 G5/4  F#5/8 A5/4 D5/4 '
       + 'B4/2 D5/2 G5/4 B5/4 D6/4  E6/8 D6/4 B5/4  C6/4 E5/4 G5/4 A5/4  F#5/4 E5/4 D5/8',
      B: 'G5/2 A5/2 B5/4 D6/4 B5/4  G5/2 F#5/2 E5/4 B4/8  E5/2 F#5/2 G5/4 C6/4 E5/4  D5/16',
    },
    form: 'iAABA_BA',
  },
];

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** `A4` → MIDI 69; `Bb3`, `F#5`. */
export function midi(n: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
/** A chord's tones as pitch classes from its root: `Am` → [9, 12, 16] (root, third, fifth). */
export function chord(c: string): number[] {
  const m = /^([A-G])(#|b)?(m)?$/.exec(c);
  if (!m) throw new Error(`bad chord ${c}`);
  const r = PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return [r, r + (m[3] ? 3 : 4), r + 7];
}

/** A note or drum hit of a compiled song: on step `at`, for `len` steps. */
export interface Ev { at: number; len: number; ch: 'lead' | 'arp' | 'bass' | 'drum'; n: number; d?: string }
export interface Song { track: Track; events: Ev[]; steps: number; stepS: number }

/** The song laid out step by step (pure: the tests compile them all in Node). */
export function compile(T: Track): Song {
  const prog = T.prog.split(/\s+/).map(chord), bassT = T.bass.split(/\s+/), events: Ev[] = [];
  if (bassT.length !== T.bar || T.drums.length !== T.bar) throw new Error(`${T.id}: bass/drums not a bar long`);
  // the melodies, as [midi or -1, steps]
  const parts: Record<string, [number, number][]> = {};
  for (const [k, s] of Object.entries(T.parts)) parts[k] = s.trim().split(/\s+/).map((t) => { const [n, l] = t.split('/'); return [n === 'r' ? -1 : midi(n), +l]; });
  let step = 0;
  for (const sec of T.form) {
    const P = parts[sec], len = P ? P.reduce((a, [, l]) => a + l, 0) : prog.length * T.bar;
    if (len % T.bar) throw new Error(`${T.id}: part ${sec} is ${len} steps, not whole bars of ${T.bar}`);
    const bars = len / T.bar;
    if (P) { let at = step; for (const [n, l] of P) { if (n >= 0) events.push({ at, len: l, ch: 'lead', n }); at += l; } }
    for (let b = 0; b < bars; b++) {
      const s0 = step + b * T.bar, bar = Math.round(s0 / T.bar), C = prog[bar % prog.length], root = 36 + (C[0] % 12);
      // the bass: a note runs until the next token that is not a hold
      for (let k = 0; k < T.bar; k++) {
        const t = bassT[k];
        if (t === '~' || t === '.') continue;
        let l = 1;
        while (k + l < T.bar && bassT[k + l] === '~') l++;
        events.push({ at: s0 + k, len: l, ch: 'bass', n: root + +t });
      }
      // the arpeggio, from the chord's three tones (and the root an octave up)
      const tones = [...C, C[0] + 12].map((p) => 12 * (T.arp.oct + 1) + p);
      const seq = T.arp.kind === 'up' ? tones : [...tones, tones[2], tones[1]];
      for (let k = 0, i = 0; k < T.bar; k += T.arp.rate, i++) events.push({ at: s0 + k, len: T.arp.rate, ch: 'arp', n: seq[i % seq.length] });
      if (sec !== 'i') for (let k = 0; k < T.bar; k++) if (T.drums[k] !== '.') events.push({ at: s0 + k, len: 1, ch: 'drum', n: 0, d: T.drums[k] });
    }
    step += len;
  }
  events.sort((a, b) => a.at - b.at);
  return { track: T, events, steps: step, stepS: 60 / T.bpm / 4 };
}
