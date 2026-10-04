import type { BusinessKind } from './city';
import type { FurnKind } from './interior';

/**
 * Shop floors drawn as text (13.10c). One character is half a metre; the first row is the back wall,
 * the last the shop front with its street door (always left empty, so the door and the till's front
 * stay clear). The header row marks with `*` the columns that repeat to fill a wider shop, and a row
 * starting with `*` repeats to fill a deeper one (each band may also be left out when the shop is
 * small). The plan (sim/interior.ts) turns the model to face the street, mirrors it by its dice,
 * drops what does not fit and keeps the model only if the till can be walked to from the door.
 *
 * A rectangle of one letter is one piece (cut into lengths for the kinds that come in units);
 * h, s and P are one piece per letter. X is what the shop displays: cases or shelves.
 */
export interface Layout {
  for: BusinessKind[] | 'default';
  rows: string[];
}

export const PIECES: Record<string, FurnKind> = {
  T: 'till', C: 'case', B: 'bar', O: 'oven', K: 'cooler', S: 'shelf', L: 'bottles', W: 'washer', Y: 'dryer',
  D: 'desk', F: 'sofa', P: 'plant', t: 'table', h: 'chair', s: 'stool',
};
/** One piece per letter. */
export const SINGLE = new Set(['h', 's', 'P']);
/** Pieces that face the street whatever wall they touch (counters face the customers). */
export const FRONT = new Set(['T', 'B', 'C', 'X']);
/** Longest run of one piece, in letters, and the gap left between runs. */
export const MAXLEN: Record<string, [number, number]> = { K: [2, 0], W: [2, 0], Y: [2, 0], S: [10, 1], X: [8, 1], C: [4, 0], L: [6, 0], D: [3, 1] };

export const LAYOUTS: Layout[] = [
  {
    for: ['diner', 'fastfood'],
    rows: [
      '|   ******    ',
      '|OO.........KK',
      '|OO.........KK',
      '|.............',
      '|.BBBBBBBBBB..',
      '|.BBBBBBBBBB..',
      '|..s.s.s.s....',
      '|.............',
      '*...htth......',
      '*....tt.......',
      '*.............',
      '|TT...........',
      '|TT...........',
      '|.............',
    ],
  },
  {
    // a shallow one: the counter and its stools, no tables
    for: ['diner', 'fastfood'],
    rows: [
      '|  ****      ',
      '|OO........KK',
      '|............',
      '|.BBBBBBB....',
      '|.BBBBBBB....',
      '|..s.s.s...TT',
      '|..........TT',
      '|............',
    ],
  },
  {
    for: ['cafe', 'deli'],
    rows: [
      '|  *****    ',
      '|KK.........',
      '|KK.........',
      '|...........',
      '|..CCCCCCTT.',
      '|..CCCCCCTT.',
      '|...........',
      '*..htth.....',
      '*...tt......',
      '*...........',
      '|...........',
    ],
  },
  {
    for: ['pizza'],
    rows: [
      '|  *****    ',
      '|OOO........',
      '|OOO........',
      '|...........',
      '|..CCCCCCTT.',
      '|..CCCCCCTT.',
      '|...........',
      '*..htth.....',
      '*...tt......',
      '*...........',
      '|...........',
    ],
  },
  {
    for: ['bar'],
    rows: [
      '| ****   ',
      '|.LLLLLL.',
      '|........',
      '|.BBBBBTT',
      '|.BBBBBTT',
      '|.s.s.s..',
      '|........',
      '*.htth...',
      '*..tt....',
      '*........',
      '|........',
    ],
  },
  {
    for: ['grocery', 'liquor'],
    rows: [
      '|  ***  ',
      '|KKKKKKK',
      '|KKKKKKK',
      '|.......',
      '*...S...',
      '|.......',
      '|TT.....',
      '|TT.....',
      '|.......',
    ],
  },
  {
    for: ['laundry'],
    rows: [
      '|  **   ',
      '|YYYYYY.',
      '|YYYYYY.',
      '|.......',
      '*WW.....',
      '*WW.....',
      '|.......',
      '|....TT.',
      '|....TT.',
      '|.......',
    ],
  },
  {
    for: ['cyber'],
    rows: [
      '|  ****  ',
      '|........',
      '*..DDD...',
      '*..DDD...',
      '*...h....',
      '*........',
      '|TT......',
      '|TT......',
      '|........',
    ],
  },
  {
    for: 'default',
    rows: [
      '| ****    ',
      '|.........',
      '|.XXXXXXTT',
      '|.XXXXXXTT',
      '|.........',
      '*S..XX...S',
      '*S..XX...S',
      '*S.......S',
      '|........P',
      '|.........',
    ],
  },
];

/** The models for a business: its own, or the default one for the shops that sell off shelves and cases. */
export function layoutsFor(biz: BusinessKind | undefined): Layout[] {
  const own = LAYOUTS.filter((L) => L.for !== 'default' && biz && L.for.includes(biz));
  if (own.length) return own;
  const none: (BusinessKind | undefined)[] = ['bank', 'hotel', 'motel', 'cinema', 'parking', undefined];
  return none.includes(biz) ? [] : LAYOUTS.filter((L) => L.for === 'default');
}

/** A model stretched to `cols` x `rows` letters (the extra in the bands), or null if it does not fit. */
export function stretch(L: Layout, cols: number, rows: number): string[] | null {
  const head = L.rows[0].slice(1), body = L.rows.slice(1);
  const b0 = head.indexOf('*'), b1 = head.lastIndexOf('*') + 1, bw = b1 - b0;
  const w0 = head.length - bw, rb = body.filter((r) => r[0] === '*'), h0 = body.length - rb.length;
  if (cols < w0 || rows < h0) return null;
  const kc = bw ? Math.floor((cols - w0) / bw) : 0, kr = rb.length ? Math.floor((rows - h0) / rb.length) : 0;
  const padC = bw ? cols - w0 - kc * bw : 0, padR = rows - h0 - kr * rb.length;
  const wide = (r: string) => {
    const s = r.slice(1);
    // the spare width carries on what the band starts with when it is a run (a counter, coolers), else floor
    const c = s[b0], pad = c && c !== '.' && !SINGLE.has(c) ? c : '.';
    return s.slice(0, b0) + s.slice(b0, b1).repeat(kc) + pad.repeat(padC) + s.slice(b1);
  };
  const out: string[] = [];
  let done = false;
  for (let i = 0; i < body.length; i++) {
    const r = body[i];
    if (r[0] !== '*') { out.push(wide(r)); continue; }
    if (done) continue;
    done = true;
    for (let k = 0; k < kr; k++) for (const q of rb) out.push(wide(q));
    for (let k = 0; k < padR; k++) out.push(wide('|' + '.'.repeat(head.length)));
  }
  if (!rb.length) for (let k = 0; k < padR; k++) out.splice(out.length - 1, 0, '.'.repeat(cols));
  return out;
}
