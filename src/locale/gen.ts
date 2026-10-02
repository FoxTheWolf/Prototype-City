import { hash3, mulberry32, type Rng } from '../core/rng';

/**
 * The text generator: short pieces written by hand, put together by a small grammar (as Tracery
 * does), so a post, a line on the phone or a headline is a mix that is almost never the same twice.
 *
 * - A grammar is a set of named lists. `#name#` in a piece is replaced by a pick from that list,
 *   expanded again (pieces can nest). `#name.cap#` capitalizes the first letter.
 * - A piece can start with a weight, `3|text`, to come up more often (1 when it has none).
 * - Then with conditions in brackets, `[old evening]text`: the piece is only picked when they hold
 *   for whoever speaks and the moment (see Sel.tags). Space means and, `/` means or, `!` means not:
 *   `[teen/young !morning]`. So the old don't write like teenagers, nobody complains of the heat in
 *   January, and only someone with a dog talks about walking it.
 * - `{key}` slots are filled from the context the caller gives (a business, a district, a name).
 * - Everything is picked from a seeded Rng, so the same seed gives the same words.
 * - A persona (a number per speaker) makes each person lean to their own habits: of every list,
 *   some pieces are theirs, and they come back to them more often (their catchphrases, the way
 *   they open, the smiley they use), so a citizen sounds like the same person post after post.
 *
 * `Fresh` remembers the texts already given and draws again when one comes back, so a player never
 * sees the same line twice in a session.
 */
export type Grammar = Record<string, string[]>;
export type Ctx = Record<string, string>;
/** Who speaks and when: the conditions true now, and their persona (0: none). */
export interface Sel { tags: Set<string>; key: string; persona: number }

interface Piece { text: string; w: number; cond: string[][] | null }
interface Table { items: string[]; cum: number[]; total: number; id: number }

const parsed = new WeakMap<string[], Piece[]>();
let nextId = 1;
function piecesOf(list: string[]): Piece[] {
  let P = parsed.get(list);
  if (P) return P;
  P = list.map((s) => {
    let w = 1, cond: string[][] | null = null;
    const m = /^(\d+(?:\.\d+)?)\|/.exec(s);
    if (m) { w = +m[1]; s = s.slice(m[0].length); }
    const c = /^\[([^\]]*)\]/.exec(s);
    if (c) { cond = c[1].trim().split(/\s+/).filter(Boolean).map((g) => g.split('/')); s = s.slice(c[0].length); }
    return { text: s, w, cond };
  });
  parsed.set(list, P);
  return P;
}

const holds = (cond: string[][] | null, tags: Set<string> | null) =>
  !cond || cond.every((any) => any.some((t) => (t[0] === '!' ? !tags?.has(t.slice(1)) : !!tags?.has(t))));

const tables = new WeakMap<string[], Map<string, Table>>();
/** The pieces of a list that fit the conditions, with their weights (cached by list and conditions). */
function table(list: string[], sel: Sel | null): Table {
  let M = tables.get(list);
  if (!M) tables.set(list, (M = new Map()));
  const key = sel?.key ?? '';
  let t = M.get(key);
  if (t) return t;
  const items: string[] = [], cum: number[] = [];
  let total = 0;
  for (const p of piecesOf(list)) {
    if (!holds(p.cond, sel?.tags ?? null)) continue;
    total += p.w; items.push(p.text); cum.push(total);
  }
  // nothing fits: fall back to the pieces without conditions, or else to everything
  if (!items.length) for (const p of piecesOf(list)) if (!p.cond || !sel) { total += p.w; items.push(p.text); cum.push(total); }
  t = { items, cum, total, id: nextId++ };
  M.set(key, t);
  return t;
}

function draw(t: Table, r: Rng): number {
  const x = r() * t.total;
  let lo = 0, hi = t.cum.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (t.cum[m] > x) hi = m; else lo = m + 1; }
  return lo;
}

/** A piece of a list, by weight, among those that fit; a persona leans to its own habits. */
export function pickW(list: string[], r: Rng, sel: Sel | null = null): string {
  const t = table(list, sel);
  if (!t.items.length) return '';
  let k = draw(t, r);
  if (sel?.persona && t.items.length > 3 && r() < 0.6) {
    // a few tries for one of this person's own pieces (about one in four of each list)
    for (let n = 0; n < 6 && hash3(sel.persona, t.id, k) >= 0.26; n++) k = draw(t, r);
  }
  return t.items[k];
}

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Expand `#name#` from the grammars (the first that has it) and fill `{key}` from the context. */
export function expand(s: string, G: Grammar | Grammar[], r: Rng, ctx: Ctx = {}, sel: Sel | null = null, depth = 0): string {
  const gs = Array.isArray(G) ? G : [G];
  if (depth < 9) s = s.replace(/#([a-zA-Z0-9_.]+?)(\.cap)?#/g, (_, name: string, c?: string) => {
    const list = gs.find((g) => g[name])?.[name];
    if (!list) return '';
    const out = expand(pickW(list, r, sel), gs, r, ctx, sel, depth + 1);
    return c ? cap(out) : out;
  });
  return s.replace(/\{([a-zA-Z0-9_]+)\}/g, (m, k: string) => ctx[k] ?? m);
}

/** A seeded Rng from a few numbers. */
export const rngOf = (a: number, b: number, c: number) => mulberry32(Math.floor(hash3(a, b, c) * 4294967296));

/** The conditions as a Sel (its key sorts them, for the caches). */
export function selOf(tags: string[], persona: number): Sel {
  const s = [...new Set(tags)].sort();
  return { tags: new Set(s), key: s.join(' '), persona };
}

/** Tidy a mix: single spaces, no space before punctuation, no doubled stops. Smileys keep their space. */
export function tidy(s: string): string {
  return s.replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])(?=\s|$|[,.!?])/g, '$1')
    .replace(/([.!?])\.+(?!\.)/g, '$1').replace(/\.([!?])/g, '$1').replace(/,([.!?])/g, '$1').replace(/([!?]),/g, '$1')
    .replace(/([a-z0-9])([:;][-]?[()DPp/|S])/g, '$1 $2').replace(/\(\s+/g, '(').trim();
}

/** Remembers texts handed out, so none comes back: `take` draws again (up to a few times) on a repeat. */
export class Fresh {
  private seen = new Set<string>();
  private order: string[] = [];
  constructor(private keep = 20000) {}
  take(make: (r: Rng) => string, a: number, b: number, c: number): string {
    let s = '';
    for (let k = 0; k < 8; k++) {
      s = make(rngOf(a + k * 7919, b, c));
      if (!this.seen.has(s)) break;
    }
    this.seen.add(s);
    this.order.push(s);
    if (this.order.length > this.keep) this.seen.delete(this.order.shift()!);
    return s;
  }
}
