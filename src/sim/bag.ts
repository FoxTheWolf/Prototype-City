import { post } from './bank';
import { logEvent } from './events';
import { PLACES } from './placeTypes';
import { type World } from './world';

/**
 * The player's backpack (13.4), in the spirit of Cairn's: what is carried is a pile of real things
 * seen from the side, each a box of its own size in centimetres, that fall and rest on each other.
 * What fits is what fits physically. The phone, the notebook and the SIM have slots of their own
 * (the drawing shows them beside the bag; they take no room in it).
 * Goods taken from a shop's shelves go in unpaid, tagged with the shop; paid at the till they are
 * the player's, and carried out of the shop unpaid they are stolen.
 */
export interface BagItem {
  /** A good (placeTypes / en.json "goods") or a piece of gear ('antenna', 'battery'). */
  good: string;
  /** Bottom-left corner over the bag's floor, and size, cm (y up). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Price, cents; the shop (business) it came from, or -1; paid for. */
  cents: number;
  shop: number;
  paid: boolean;
  /** A SIM's operator (13.6). */
  op?: number;
  /** Fall speed, cm/s (not saved). */
  vx?: number;
  vy?: number;
}

export interface Bag {
  items: BagItem[];
  /** The shop building the player stood in at the last step (to catch walking out unpaid). */
  shopIn: number;
  /** The last time something was carried out unpaid (game time), and how many things. */
  stolenAt: number;
  stolen: number;
}
export const newBag = (): Bag => ({ items: [], shopIn: -1, stolenAt: -1, stolen: 0 });

/** The bag's inside, cm. */
export const BAG_W = 40, BAG_H = 52;

/**
 * Size of each thing, cm (width x height, seen from the side as it would stand). Goods missing here
 * are not carried: services (a load of washing, an hour of internet, a motel room) and drinks
 * poured at the bar.
 */
const SIZE: Record<string, [number, number]> = {
  coffee: [9, 12], eggs_toast: [22, 6], burger: [12, 8], fries: [10, 12], milkshake: [9, 18], pie: [12, 6], meatloaf: [22, 6],
  drip_coffee: [9, 12], espresso: [6, 8], latte: [9, 14], muffin: [8, 8], bagel: [10, 5],
  slice: [20, 4], pepperoni_slice: [20, 4], garlic_knots: [14, 6], fountain_soda: [9, 16], whole_pie: [40, 5],
  pastrami: [16, 8], bagel_cc: [10, 6], chips: [15, 20], soda_can: [7, 12],
  combo: [25, 14], cheeseburger: [10, 6], nuggets: [12, 10], large_soda: [10, 20],
  bottled_beer: [7, 23], peanuts: [10, 12],
  bread: [28, 12], milk: [16, 27], eggs: [26, 8], canned_soup: [8, 11], noodles: [11, 4], candy: [9, 3], cigarettes: [6, 9], batteries: [8, 12], umbrella: [7, 28],
  cough_syrup: [6, 14], painkillers: [6, 10], bandages: [9, 7], shampoo: [7, 20], toothpaste: [19, 5], memory_card: [6, 8],
  used_watch: [10, 10], dvd_player: [36, 6], power_drill: [25, 22], guitar: [100, 35], gold_chain: [8, 8],
  headphones: [18, 20], usb_stick: [8, 12], charger: [10, 14], blank_cds: [13, 12], ethernet_cable: [15, 18], mp3_player: [10, 16],
  prepaid_card: [6, 9], hands_free: [10, 16], phone_case: [9, 15],
  detergent: [10, 14], vending_snack: [8, 12],
  antenna: [6, 22], battery: [20, 6], sim: [9, 5],
};
export const carried = (good: string) => good in SIZE;
export const sizeOf = (good: string): [number, number] => SIZE[good] ?? [10, 10];

const overlapX = (a: { x: number; w: number }, x: number, w: number) => a.x < x + w - 0.01 && x < a.x + a.w - 0.01;

/**
 * Where a thing of size w x h would come to rest dropped straight down, trying every spot across
 * the bag (and turned on its side): where its top stays lowest, leftmost; or null when it does not fit anywhere.
 */
export function placeFor(B: Bag, w: number, h: number): [number, number, number, number] | null {
  let best: [number, number, number, number] | null = null;
  for (const [W, H] of [[w, h], [h, w]]) {
    if (W > BAG_W) continue;
    for (let x = 0; x <= BAG_W - W + 1e-6; x += 1) {
      let y = 0;
      for (const it of B.items) if (overlapX(it, x, W)) y = Math.max(y, it.y + it.h);
      if (y + H > BAG_H + 0.5) continue;
      if (!best || y + H < best[1] + best[3] - 0.01) best = [x, y, W, H];
    }
  }
  return best;
}

/** Put a thing in the bag: false when it does not fit. It drops in from a little above where it comes to rest. */
export function addToBag(B: Bag, good: string, cents: number, shop: number, paid: boolean): boolean {
  const s = SIZE[good];
  if (!s) return false;
  const p = placeFor(B, s[0], s[1]);
  if (!p) return false;
  B.items.push({ good, x: p[0], y: p[1] + Math.min(4, BAG_H - p[3] - p[1]), w: p[2], h: p[3], cents, shop, paid, vx: 0, vy: 0 });
  return true;
}

/** Saves from 13.4 kept the fitted antenna and battery in the bag too: fitted gear is on the notebook (13.6). */
export function bagGear(w: World) {
  for (const g of ['antenna', 'battery'] as const) if (w.gear[g]) w.bag.items = w.bag.items.filter((i) => i.good !== g);
}

/** The unpaid things from shop k, and what they come to. */
export function unpaid(B: Bag, k: number): [BagItem[], number] {
  const l = B.items.filter((i) => !i.paid && i.shop === k);
  return [l, l.reduce((s, i) => s + i.cents, 0)];
}

/** Pay cents to business k, in cash from the pocket or by card from the account: false (nothing paid) when there is not enough. */
export function pay(w: World, cents: number, k: number, cash: boolean): boolean {
  if (cash) {
    if (w.player.cash < cents) return false;
    w.player.cash -= cents;
    return true;
  }
  return post(w.bank, w.time, 'card', -cents, k);
}

/** The price of a good at business k, cents (0 when it does not sell it). */
export const priceAt = (k: number, w: World, good: string) => PLACES[w.city.businesses[k].kind].sells.find(([g]) => g === good)?.[1] ?? 0;

/**
 * Each step: walking out of a shop's building with its goods unpaid makes them the player's
 * (stolen), logged as a fact for whoever reads the events (the heat, later).
 */
export function stepBag(w: World) {
  const B = w.bag, p = w.player, here = p.inside >= 0 && w.city.buildings[p.inside].biz >= 0 ? p.inside : -1;
  if (B.shopIn >= 0 && here !== B.shopIn) {
    const k = w.city.buildings[B.shopIn].biz, [gone] = unpaid(B, k);
    if (gone.length) {
      for (const i of gone) i.paid = true;
      B.stolenAt = w.time; B.stolen = gone.length;
      logEvent(w.events, 'shoplift', w.tick, w.time, p.x, p.y, 0.2, [k]);
    }
  }
  B.shopIn = here;
}

/** Gravity, cm/s^2, and the substeps of the pile per frame. */
const G = 980, SUB = 4;

/**
 * The pile, a frame of dt seconds: things fall and rest on each other and on the bag's floor and
 * sides; `held` (if any) follows the hand to (hx, hy) and pushes the others aside.
 */
export function settleBag(B: Bag, dt: number, held: BagItem | null, hx: number, hy: number) {
  const L = B.items, h = Math.min(dt, 0.05) / SUB;
  for (let s = 0; s < SUB; s++) {
    for (const i of L) {
      if (i === held) { i.x = hx; i.y = hy; i.vx = i.vy = 0; }
      else { i.vy = (i.vy ?? 0) - G * h; i.vx = (i.vx ?? 0) * 0.9; i.x += i.vx * h; i.y += i.vy * h; }
      wall(i);
    }
    for (let it = 0; it < 3; it++) for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
      const A = L[a], C = L[b];
      const ox = Math.min(A.x + A.w, C.x + C.w) - Math.max(A.x, C.x), oy = Math.min(A.y + A.h, C.y + C.h) - Math.max(A.y, C.y);
      if (ox <= 0 || oy <= 0) continue;
      if (oy < ox) {
        // one on the other: the upper one rests on the lower (the held one pushes it down instead)
        const [lo, up] = A.y + A.h / 2 < C.y + C.h / 2 ? [A, C] : [C, A];
        if (up === held) lo.y -= oy; else up.y += oy;
        if ((up.vy ?? 0) < 0) up.vy = 0;
        if ((lo.vy ?? 0) > 0) lo.vy = 0;
      } else {
        // side by side: both give way (all of it the one not held)
        const [l, r] = A.x + A.w / 2 < C.x + C.w / 2 ? [A, C] : [C, A];
        const kl = l === held ? 0 : r === held ? 1 : 0.5;
        l.x -= ox * kl; r.x += ox * (1 - kl);
        l.vx = r.vx = 0;
      }
      wall(A); wall(C);
    }
  }
}
function wall(i: BagItem) {
  if (i.x < 0) { i.x = 0; i.vx = 0; }
  if (i.x + i.w > BAG_W) { i.x = Math.max(0, BAG_W - i.w); i.vx = 0; }
  if (i.y < 0) { i.y = 0; if ((i.vy ?? 0) < 0) i.vy = 0; }
  if (i.y + i.h > BAG_H) i.y = Math.max(0, BAG_H - i.h);
}

/** The thing at (x, y) cm in the bag, the topmost drawn, or null. */
export function itemAt(B: Bag, x: number, y: number): BagItem | null {
  for (let k = B.items.length - 1; k >= 0; k--) {
    const i = B.items[k];
    if (x >= i.x && x < i.x + i.w && y >= i.y && y < i.y + i.h) return i;
  }
  return null;
}

/** Take a thing out of the bag (put back on the shelf, thrown away). */
export function dropItem(B: Bag, i: BagItem) { B.items.splice(B.items.indexOf(i), 1); }
