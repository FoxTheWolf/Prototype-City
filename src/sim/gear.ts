import { hash3 } from '../core/rng';
import { addToBag, pay, placeFor, sizeOf } from './bag';
import { OPERATORS, START_CREDIT, START_DATA_KB } from './telco';
import { dropLine } from './heat'; // [HACKING] a SIM swap drops the old line's phone traces (ver CLAUDE.md > Arquivos de hacking)
import { type World } from './world';

/**
 * What the player carries besides the phone and the notebook, and what the shops sell of it (F.9).
 * For now a counter at the till of a pawn shop or an electronics store sells three things, paid by
 * card from the bank account; the counter stands in for talking to the clerk until the dialogue
 * exists (13c). Each one changes how a job can be done:
 * - a prepaid SIM: a new number on the phone (the old line, and whatever was traced to it, left behind);
 * - a directional antenna for the notebook's Wi-Fi: a network from further away;
 * - a second battery for the notebook.
 */
export type ItemId = 'sim' | 'antenna' | 'battery';
export interface Item { id: ItemId; cents: number; kinds: string[]; once: boolean }
export const ITEMS: Item[] = [
  { id: 'sim', cents: 2500, kinds: ['electronics', 'pawn', 'phones'], once: false },
  { id: 'antenna', cents: 8900, kinds: ['electronics'], once: true },
  { id: 'battery', cents: 6500, kinds: ['electronics', 'pawn'], once: true },
];

export interface Gear {
  antenna: boolean;
  battery: boolean;
  /** Prepaid SIMs bought: the line in use is the n-th since the start. */
  sims: number;
  /** SIMs put in the phone (13.6; missing before). */
  swaps?: number;
}
export const newGear = (): Gear => ({ antenna: false, battery: false, sims: 0 });

/** The second battery's capacity, Wh (a new pack, not worn). */
export const SPARE_WH = 48;

/** What a shop of this kind sells. */
export const itemsAt = (kind: string) => ITEMS.filter((i) => i.kinds.includes(kind));
/** Bought already: fitted to the notebook, or still in the bag (13.6). */
export const owned = (w: World, i: Item) => i.once && (w.gear[i.id as 'antenna' | 'battery'] || w.bag.items.some((b) => b.good === i.id));

/**
 * Buy an item at business k, in cash or by card: 'ok', or why not. It goes in the bag (13.6): the
 * antenna and the battery are fitted by taking them to the notebook, the SIM by putting it in the
 * phone; the SIM's operator is drawn when it is bought (any of the city's, by the seed).
 */
export function buy(w: World, i: Item, k: number, cash = false): 'ok' | 'owned' | 'funds' | 'room' {
  if (owned(w, i)) return 'owned';
  if (!placeFor(w.bag, ...sizeOf(i.id))) return 'room';
  if (!pay(w, i.cents, k, cash)) return 'funds';
  addToBag(w.bag, i.id, i.cents, k, true);
  if (i.id === 'sim') w.bag.items[w.bag.items.length - 1].op = Math.floor(hash3(w.seed, 556, ++w.gear.sims) * OPERATORS);
  return 'ok';
}

/** Fit the antenna or the battery from the bag to the notebook. */
export function fit(w: World, id: 'antenna' | 'battery') { w.gear[id] = true; }

/** Put a bought SIM (of operator op) in the phone: the line becomes a new one. */
export function swapSim(w: World, op: number) { newLine(w, op, 100 + (w.gear.swaps = (w.gear.swaps ?? 0) + 1)); }

/** A new prepaid line, of operator op: a number of its own (the fiction's 555-01xx block), its starting credit and bundle; the old line's are gone. */
function newLine(w: World, op: number, n: number) {
  const T = w.telco, old = T.player.number;
  let num = old;
  for (let t = 0; num === old && t < 50; t++) num = `555-01${String(Math.floor(hash3(w.seed, 555, 2 + n * 7 + t) * 100)).padStart(2, '0')}`;
  dropLine(w.heat, old); // [HACKING] the mast logs tied to the old line go cold with the number
  Object.assign(T.player, { number: num, credit: START_CREDIT, dataKB: START_DATA_KB, usedKB: 0, op });
}
