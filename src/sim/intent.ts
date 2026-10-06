/**
 * Reading what the player types to a NPC (14.1), without any AI: weighted keywords per intention
 * (the lexicon in locale/intents.en.json), question marks, negation, and a tone in two axes, so a
 * line typed freely ("hey, where's the pharmacy?") becomes an intention the NPC answers through the
 * grammar. The names the city knows (places, streets, people, goods) are found in the line and fill
 * the answer's slots. It is deterministic and costs microseconds; the same reading shows above the
 * text box while the player types, so they can fix a line before sending it.
 */
import LEX from '../locale/intents.en.json';

export type IntentId = keyof typeof LEX.intents;
/** A business or landmark by name, a kind of place ("a pharmacy"), a street, a person, a good. */
export type SlotKind = 'place' | 'kind' | 'street' | 'person' | 'thing';
/** A name the city knows, as the player would type it (lowercase words), and what it is. */
export interface Entity { words: string[]; kind: SlotKind; id: number }
/** The names to look for, by their first word. */
export type EntityIndex = Map<string, Entity[]>;

export interface Reading {
  /** The strongest intention ('unrecognized' below the minimum), its label and its score. */
  intent: IntentId;
  label: string;
  score: number;
  /** A question (starts with a question word, or ends with '?'). */
  question: boolean;
  /** The names found in the line. */
  slots: Partial<Record<SlotKind, Entity>>;
  /** -3 hostile .. +3 respectful, and 0 calm .. 3 pressing (urgency, insistence: the lever of social engineering). */
  respect: number;
  pressure: number;
  toneLabel: string;
  /** Joking or chatter with no serious intention. */
  banter: boolean;
}

/** Below this, nothing was understood. */
const MIN = 2;
const Q_WORDS = new Set(['do', 'does', 'did', 'can', 'could', 'would', 'will', 'is', 'are', 'am', 'was', 'were', 'where', 'what', 'who', 'when', 'why', 'how', 'which', 'whats', "what's", "where's", "who's", 'may', 'have', 'has']);
const NEG = new Set(['not', 'no', 'never', "don't", "doesn't", "didn't", "can't", 'cannot', "won't", 'dont', 'cant', 'wont']);
/** 2008 shorthand and common spellings, to the words of the lexicon. */
const SHORT: Record<string, string> = {
  u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please', thx: 'thanks', thnx: 'thanks', ty: 'thank you', k: 'ok', kk: 'ok',
  whats: "what's", wheres: "where's", whos: "who's", im: "i'm", dont: "don't", cant: "can't", wont: "won't", doesnt: "doesn't", didnt: "didn't", isnt: 'is not', "isn't": 'is not', arent: 'are not', "aren't": 'are not', wasnt: 'was not', "wasn't": 'was not',
  ill: "i'll", id: "i'd", youre: "you're", thats: "that's", hows: "how's", ya: 'you', cuz: 'because', b4: 'before', '2day': 'today', '2nite': 'tonight', tonite: 'tonight',
};

interface Key { words: string[]; w: number }
const KEYS = new Map<IntentId, Key[]>();
const TONE = new Map<string, Key[]>();
const VOCAB = new Set<string>();
const split = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);
for (const [id, I] of Object.entries(LEX.intents) as [IntentId, (typeof LEX.intents)[IntentId]][]) {
  const ks = Object.entries(I.keywords as Record<string, number>).map(([k, w]) => ({ words: split(k), w }));
  ks.sort((a, b) => b.words.length - a.words.length || b.w - a.w);
  KEYS.set(id, ks);
  for (const k of ks) for (const x of k.words) VOCAB.add(x);
}
for (const [axis, M] of Object.entries(LEX.tone as Record<string, Record<string, number>>)) {
  TONE.set(axis, Object.entries(M).map(([k, w]) => ({ words: split(k), w })).sort((a, b) => b.words.length - a.words.length));
  for (const k of Object.keys(M)) for (const x of split(k)) VOCAB.add(x);
}
for (const s of Object.values(SHORT)) for (const x of split(s)) VOCAB.add(x);

/** One letter added, missing, changed or two swapped. */
function near1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  if (la === lb) {
    let i = 0;
    while (i < la && a[i] === b[i]) i++;
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  const [s, l] = la < lb ? [a, b] : [b, a];
  let i = 0;
  while (i < s.length && s[i] === l[i]) i++;
  return s.slice(i) === l.slice(i + 1);
}

/** The line as words: lowercase, straight apostrophes, shorthand spelled out, '?' and '!' kept apart. */
export function words(line: string): string[] {
  const t = line.toLowerCase().replace(/[‘’`]/g, "'").replace(/([?!])/g, ' $1 ').replace(/[^a-z0-9'?!\- ]+/g, ' ');
  const out: string[] = [];
  for (let w of t.split(/\s+/)) {
    w = w.replace(/^'+|'+$/g, '');
    if (!w) continue;
    const s = SHORT[w];
    if (s) out.push(...s.split(' '));
    else out.push(w);
  }
  return out;
}

/** Fix a word one typo off a word of the lexicon or a name of the city (only words of 4 letters or more). */
function spell(w: string, names: Set<string>): string {
  if (w.length < 4 || VOCAB.has(w) || names.has(w)) return w;
  // more than one fits: the longer one (a letter left out is the commonest slip: "helo", "wher")
  let hit = '';
  for (const v of [...VOCAB, ...names]) if (v.length >= 4 && near1(w, v) && v.length > hit.length) hit = v;
  return hit || w;
}

/** Where a key's words appear in the line (the first start not yet taken), or -1. */
function find(ws: string[], k: string[], taken: Uint8Array): number {
  outer: for (let i = 0; i + k.length <= ws.length; i++) {
    for (let j = 0; j < k.length; j++) if (ws[i + j] !== k[j] || taken[i + j]) continue outer;
    return i;
  }
  return -1;
}

/** The names of the city in the line, longest first. */
function entities(ws: string[], idx: EntityIndex | undefined): Partial<Record<SlotKind, Entity>> {
  const out: Partial<Record<SlotKind, Entity>> = {};
  if (!idx) return out;
  const taken = new Uint8Array(ws.length);
  for (let i = 0; i < ws.length; i++) {
    // the longest names starting here; one word can be two things ("coffee": a good, and what a café is)
    let n = 0;
    const hits: Entity[] = [];
    for (const e of idx.get(ws[i]) ?? []) {
      if (e.words.length > ws.length - i || e.words.length < n || !e.words.every((x, j) => ws[i + j] === x && !taken[i + j])) continue;
      if (e.words.length > n) { n = e.words.length; hits.length = 0; }
      hits.push(e);
    }
    for (const e of hits) if (!out[e.kind]) out[e.kind] = e;
    if (n) { taken.fill(1, i, i + n); i += n - 1; }
  }
  return out;
}

/** The weights of an axis's keys found in the line. */
function axis(ws: string[], keys: Key[]): number {
  const taken = new Uint8Array(ws.length);
  let s = 0;
  for (const k of keys) {
    const at = find(ws, k.words, taken);
    if (at >= 0) { s += k.w; taken.fill(1, at, at + k.words.length); }
  }
  return s;
}

/** What a line probably is. `idx`: the names the city knows (none: no slots). */
export function readLine(line: string, idx?: EntityIndex): Reading {
  const names = new Set<string>();
  if (idx) for (const es of idx.values()) for (const e of es) for (const x of e.words) names.add(x);
  const raw = words(line), ws = raw.map((w) => spell(w, names));
  const text = ws.filter((w) => w !== '?' && w !== '!');
  const question = ws.includes('?') || (text.length > 0 && Q_WORDS.has(text[0]));
  const slots = entities(text, idx);
  // every intention's keys, the longer ones first so a phrase's words are not counted again on their own
  let best: IntentId = 'unrecognized', bestS = 0, bestTop = 0;
  const scores = new Map<IntentId, number>();
  for (const [id, keys] of KEYS) {
    const I = LEX.intents[id];
    const taken = new Uint8Array(text.length);
    let s = 0, top = 0;
    for (const k of keys) {
      const at = find(text, k.words, taken);
      if (at < 0) continue;
      taken.fill(1, at, at + k.words.length);
      // "not" or "don't" just before a key turns it down (except for the "no" keys, which carry it)
      const neg = id !== 'no' && (NEG.has(text[at - 1]) || NEG.has(text[at - 2]));
      const w = neg ? k.w * 0.3 : k.w;
      s += w; top = Math.max(top, w * (1 + 0.1 * k.words.length));
    }
    if (s > 0) {
      if (I.question && question) s += 1;
      // a name of the city pulls toward what is asked about it
      if (slots.place || slots.street || slots.kind) { if (id === 'ask_where' || id === 'ask_directions') s += 2; }
      if (slots.person && id === 'ask_about_person') s += 2;
      if (slots.thing && (id === 'ask_price' || id === 'buy_request')) s += 1.5;
    }
    scores.set(id, s);
    if (s > bestS || (s === bestS && top > bestTop)) { best = id; bestS = s; bestTop = top; }
  }
  // a known place alone ("the pharmacy?") is a question about where it is
  if (bestS < MIN && (slots.place || slots.street || slots.kind) && question) { best = 'ask_where'; bestS = MIN; }
  if (bestS < MIN) best = 'unrecognized';
  // the tone: please and thanks against "hey you"; urgency from its words, '!', capitals and repeating
  const T = (a: string) => axis(text, TONE.get(a) ?? []);
  let respect = T('polite') + T('formal') * 0.5 - T('rude') * 1.5;
  if (best === 'threaten') respect -= 2;
  if (best === 'thank' || best === 'apologize' || best === 'compliment') respect += 1;
  const letters = line.replace(/[^A-Za-z]/g, ''), caps = letters.length >= 6 ? letters.replace(/[^A-Z]/g, '').length / letters.length : 0;
  const repeats = text.length - new Set(text).size;
  let pressure = T('urgent') + (raw.filter((w) => w === '!').length > 1 ? 1 : 0) + (caps > 0.6 ? 2 : 0) + Math.min(1, repeats * 0.34);
  respect = Math.max(-3, Math.min(3, respect));
  pressure = Math.max(0, Math.min(3, pressure));
  const banter = best === 'banter' || (scores.get('banter') ?? 0) >= MIN;
  const lab = LEX.toneLabels as Record<string, string>;
  return { intent: best, label: LEX.intents[best].label, score: bestS, question, slots, respect, pressure, toneLabel: lab[String(Math.round(respect))], banter };
}

/** The examples of the lexicon, for the tests: every intention's own lines. */
export function examples(): [IntentId, string][] {
  return (Object.entries(LEX.intents) as [IntentId, (typeof LEX.intents)[IntentId]][]).flatMap(([id, I]) => I.examples.map((e) => [id, e] as [IntentId, string]));
}

/** An index of the names to look for. */
export function indexNames(list: Entity[]): EntityIndex {
  const M: EntityIndex = new Map();
  for (const e of list) { const k = e.words[0]; if (!M.has(k)) M.set(k, []); M.get(k)!.push(e); }
  return M;
}
