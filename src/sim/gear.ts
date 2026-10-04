import { hash3 } from '../core/rng';
import { post } from './bank';
import { START_CREDIT, START_DATA_KB } from './telco';
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
  { id: 'sim', cents: 2500, kinds: ['electronics', 'pawn'], once: false },
  { id: 'antenna', cents: 8900, kinds: ['electronics'], once: true },
  { id: 'battery', cents: 6500, kinds: ['electronics', 'pawn'], once: true },
];

export interface Gear {
  antenna: boolean;
  battery: boolean;
  /** Prepaid SIMs bought: the line in use is the n-th since the start. */
  sims: number;
}
export const newGear = (): Gear => ({ antenna: false, battery: false, sims: 0 });

/** The second battery's capacity, Wh (a new pack, not worn). */
export const SPARE_WH = 48;

/** What a shop of this kind sells. */
export const itemsAt = (kind: string) => ITEMS.filter((i) => i.kinds.includes(kind));
export const owned = (g: Gear, i: Item) => i.once && g[i.id as 'antenna' | 'battery'];

/** Buy an item at business k: paid by card. 'ok', or why not. */
export function buy(w: World, i: Item, k: number): 'ok' | 'owned' | 'funds' {
  if (owned(w.gear, i)) return 'owned';
  if (w.bank.balance < i.cents) return 'funds';
  post(w.bank, w.time, 'card', -i.cents, k);
  if (i.id === 'sim') newLine(w);
  else w.gear[i.id] = true;
  return 'ok';
}

/** A new prepaid line: a number of its own (the fiction's 555-01xx block), its starting credit and bundle; the old line's are gone. */
function newLine(w: World) {
  const T = w.telco, old = T.player.number;
  let n = ++w.gear.sims, num = old;
  for (let t = 0; num === old && t < 50; t++) num = `555-01${String(Math.floor(hash3(w.seed, 555, 2 + n * 7 + t) * 100)).padStart(2, '0')}`;
  Object.assign(T.player, { number: num, credit: START_CREDIT, dataKB: START_DATA_KB, usedKB: 0 });
}
