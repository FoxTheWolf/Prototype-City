import T9_EN from '../locale/t9.en.json';
import { type Key } from './phone';

/**
 * Text typed on the keypad, as the phones of the time did it, in three modes switched with #:
 *  - Abc: multi-tap (a key tapped again within a second picks its next letter; 0 a space);
 *  - T9: one press a letter, the phone guessing the word from its dictionary (* the next guess,
 *    0 takes it and a space, 1 punctuation); words typed in Abc mode are learned into it;
 *  - 123: digits.
 * The dictionary is the locale's (t9.<lang>.json, most common words first) plus what the phone
 * learned. Deleting is the caller's (the right soft key): del().
 */
export type Mode = 'abc' | 't9' | '123';
const MODES: Mode[] = ['abc', 't9', '123'];
export const TAPS: Record<string, string> = { '1': '.,?!\'-@_:/&()"#$%1', '2': 'abc2', '3': 'def3', '4': 'ghi4', '5': 'jkl5', '6': 'mno6', '7': 'pqrs7', '8': 'tuv8', '9': 'wxyz9', '0': ' 0' };
const PUNCT = '.,?!\'-@_:/&()"#$%';

/** The key a letter is on. */
const keyOf: Record<string, string> = {};
for (const [k, s] of Object.entries(TAPS)) for (const c of s) if (c !== ' ' && !(c in keyOf)) keyOf[c] = k;
const seqOf = (w: string) => [...w].map((c) => keyOf[c] ?? '').join('');

/** The dictionary: key sequence to words, most likely first. */
const dict = new Map<string, string[]>();
const known = new Set<string>();
function learn(w: string, front = false) {
  w = w.toLowerCase();
  if (!w || known.has(w) || !/^[a-z']+$/.test(w)) return;
  known.add(w);
  const s = seqOf(w), L = dict.get(s) ?? [];
  if (front) L.unshift(w); else L.push(w);
  dict.set(s, L);
}
for (const w of T9_EN as string[]) learn(w);

export class Editor {
  text = '';
  mode: Mode = 'abc';
  /** T9: the keys of the word being typed, and which guess shows. */
  seq = '';
  ci = 0;
  private tapKey = '';
  private tapAt = 0;
  private tapN = 0;
  constructor(public max: number, private names = false) {}

  /** The text with the word being guessed. */
  value(): string { return this.text + this.word(); }
  /** The tapping key's letters, while a multi-tap is under way (for the hint). */
  tapping(now: number): string { return this.mode === 'abc' && this.tapKey && now - this.tapAt < 1 ? TAPS[this.tapKey] : ''; }

  /** T9's guess for the keys typed: the words with that sequence, or the start of a longer one, or the keys' first letters. */
  word(): string {
    if (!this.seq) return '';
    let L = dict.get(this.seq);
    if (!L?.length) {
      const longer: string[] = [];
      for (const [s, ws] of dict) if (s.startsWith(this.seq)) longer.push(...ws);
      longer.sort((a, b) => a.length - b.length);
      L = longer.map((w) => w.slice(0, this.seq.length));
    }
    const w = L.length ? L[this.ci % L.length] : [...this.seq].map((k) => TAPS[k][0]).join('');
    return this.cap(w);
  }

  /** Capital letters where they go: a name's words, or the start of a sentence. */
  private cap(w: string): string {
    const start = this.names ? !this.text || this.text.endsWith(' ') : !this.text.trim() || /[.!?]\s*$/.test(this.text);
    return start && w ? w[0].toUpperCase() + w.slice(1) : w;
  }

  private commit() {
    if (this.seq) { this.text = (this.text + this.word()).slice(0, this.max); this.seq = ''; this.ci = 0; }
    this.tapKey = '';
  }

  /** The word just finished in Abc mode goes into the dictionary, first for its keys. */
  private learnLast() {
    const m = /([A-Za-z']+)\s*$/.exec(this.text);
    if (m) learn(m[1], true);
  }

  /** A key; false when it does nothing here. */
  key(k: Key, now: number): boolean {
    if (k === '#') {
      if (this.mode === 'abc') this.learnLast();
      this.commit();
      this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
      return true;
    }
    if (this.mode === '123') {
      if (/^[0-9]$/.test(k) && this.text.length < this.max) { this.text += k; return true; }
      if (k === '*') { this.text += '*'; return true; }
      return false;
    }
    if (this.mode === 't9') {
      if (/^[2-9]$/.test(k)) { if (this.text.length + this.seq.length < this.max) { this.seq += k; this.ci = 0; } return true; }
      if (k === '*') { if (this.seq) { this.ci++; return true; } return false; }
      if (k === '0') { this.commit(); if (this.text.length < this.max) this.text += ' '; return true; }
      if (k === '1') {
        // punctuation: 1 again within a second picks the next mark
        if (this.tapKey === '1' && now - this.tapAt < 1) { this.tapN = (this.tapN + 1) % PUNCT.length; this.text = this.text.slice(0, -1); }
        else { this.commit(); this.tapN = 0; }
        if (this.text.length < this.max) this.text += PUNCT[this.tapN];
        this.tapKey = '1'; this.tapAt = now;
        return true;
      }
      return false;
    }
    // Abc: multi-tap
    if (k === '*') { this.del(); return true; }
    const letters = TAPS[k];
    if (!letters) return false;
    if (k === this.tapKey && now - this.tapAt < 1) { this.tapN = (this.tapN + 1) % letters.length; this.text = this.text.slice(0, -1); }
    else this.tapN = 0;
    let c = letters[this.tapN];
    if (c === ' ') this.learnLast();
    if (/[a-z]/.test(c) && this.cap('x') === 'X') c = c.toUpperCase();
    if (this.text.length < this.max) this.text += c;
    this.tapKey = k; this.tapAt = now;
    return true;
  }

  /** Delete: the last key of the word being guessed, or the last character. */
  del(): boolean {
    if (this.seq) { this.seq = this.seq.slice(0, -1); this.ci = 0; return true; }
    if (!this.text) return false;
    this.text = this.text.slice(0, -1); this.tapKey = '';
    return true;
  }

  set(s: string) { this.text = s; this.seq = ''; this.ci = 0; this.tapKey = ''; }
  label(): string { return this.mode === 'abc' ? 'Abc' : this.mode === 't9' ? 'T9' : '123'; }
}
