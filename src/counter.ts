import { type Sfx } from './phone/call';
import { type CharGrid } from './render/grid';
import { addToBag, carried, dropItem, pay, placeFor, sizeOf, unpaid } from './sim/bag';
import { post } from './sim/bank';
import { buy, itemsAt, owned, type Item } from './sim/gear';
import { staffOn } from './sim/citizens';
import { planOf } from './sim/interior';
import { eat, edible } from './sim/needs';
import { PLACES } from './sim/placeTypes';
import { BIZ_HOURS, isOpen } from './sim/telco';
import { type World } from './sim/world';
import { businessName } from './locale/names';
import en from './locale/en.json';

const T = en.counter;
const GOODS = en.goods as Record<string, string>;
/** How near the till the player must stand, m. */
const REACH = 1.8;
/** What a bank's teller pays out, cents. */
const WITHDRAW = [2000, 5000, 10000];

/** A line on the counter's list: pay for what was taken, leave it, ask for something, take cash out. */
type Row = { kind: 'pay' } | { kind: 'leave' } | { kind: 'gear'; item: Item } | { kind: 'menu'; good: string; cents: number } | { kind: 'cash'; cents: number };

/**
 * The counter at a shop's till (F.9, 13.4): F at the till of an open shop with someone on shift.
 * It takes payment for what was picked off the shelves, sells what is kept behind it (the gear) or
 * made to order (food), and at the player's own bank pays out cash. The arrows pick, left and
 * right choose cash or card, Enter does it, F or Esc leaves. A stand-in for talking to the clerk
 * until the dialogue exists (stage 14).
 */
export class Counter {
  /** The business at whose till the player stands, or -1. */
  k = -1;
  pick = 0;
  /** Paying in cash (else by card). */
  cash = false;
  /** At a place that serves food: eaten there (else to go, in the bag). */
  here = true;
  note = '';
  noteAt = -9;
  readonly sfx: Sfx[] = [];
  constructor(private world: World) {}

  get active() { return this.k >= 0; }
  /** Something was just eaten here (main plays the sound and clears it). */
  ate = false;
  /** The place makes food to order (a diner, a café, a bar). */
  serves() { return this.k >= 0 && !!PLACES[this.world.city.businesses[this.k].kind].order; }

  rows(): Row[] {
    if (this.k < 0) return [];
    const w = this.world, kind = w.city.businesses[this.k].kind, out: Row[] = [];
    if (unpaid(w.bag, this.k)[0].length) out.push({ kind: 'pay' }, { kind: 'leave' });
    for (const item of itemsAt(kind)) out.push({ kind: 'gear', item });
    if (PLACES[kind].order) for (const [good, cents] of PLACES[kind].sells) if (carried(good) || edible(good)) out.push({ kind: 'menu', good, cents });
    if (kind === 'bank' && w.city.banks[w.bank.bank].branches.includes(this.k)) for (const cents of WITHDRAW) out.push({ kind: 'cash', cents });
    return out;
  }

  /** The business whose till the player stands at, whether it is open and whether a clerk is there (13.3); or null. */
  near(): { k: number; open: boolean; staffed: boolean } | null {
    const w = this.world, p = w.player;
    if (p.inside < 0 || p.floor !== 0) return null;
    const B = w.city.buildings[p.inside];
    if (!B.shop || B.biz < 0) return null;
    const P = planOf(w.city, p.inside, 0);
    if (!P || !P.furn.some((f) => f.kind === 'till' && Math.hypot(f.x - p.x, f.y - p.y) < REACH + Math.max(f.hx, f.hy))) return null;
    const open = isOpen(w.city.businesses[B.biz].kind, (w.time / 3600) % 24);
    return { k: B.biz, open, staffed: open && staffOn(w.pop, w.city, B.biz, w.time).length > 0 };
  }

  open(k: number) { this.k = k; this.pick = 0; this.say(this.rows().length ? T.hello : T.nothing, -9); this.sfx.push(['beep']); }
  close() { this.k = -1; }
  private say(s: string, now: number) { this.note = s; this.noteAt = now; }

  /** A key while at the counter: true when it was the counter's. */
  key(code: string, now: number): boolean {
    if (!this.active) return false;
    const rows = this.rows(), n = rows.length;
    if (code === 'ArrowUp' && n) { this.pick = (this.pick + n - 1) % n; this.sfx.push(['beep']); }
    else if (code === 'ArrowDown' && n) { this.pick = (this.pick + 1) % n; this.sfx.push(['beep']); }
    else if (code === 'ArrowLeft' || code === 'ArrowRight') { this.cash = !this.cash; this.sfx.push(['beep']); }
    else if (code === 'Tab' && this.serves()) { this.here = !this.here; this.sfx.push(['beep']); }
    else if ((code === 'Enter' || code === 'Space') && n) {
      const r = this.act(rows[Math.min(this.pick, n - 1)]);
      this.say(r, now);
      this.sfx.push(r === T.ok || r === T.withdrew || r === T.left || r === T.enjoy ? ['coin'] : ['fail']);
      if (r === T.enjoy) this.ate = true;
      this.pick = Math.min(this.pick, Math.max(0, this.rows().length - 1));
    } else if (code === 'Escape' || code === 'KeyF') this.close();
    else return false;
    return true;
  }

  /** Do what a row says; what the clerk answers. */
  private act(r: Row): string {
    const w = this.world, k = this.k;
    const broke = this.cash ? T.noCash : T.funds;
    switch (r.kind) {
      case 'pay': {
        const [l, sum] = unpaid(w.bag, k);
        if (!pay(w, sum, k, this.cash)) return broke;
        for (const i of l) i.paid = true;
        return T.ok;
      }
      case 'leave': for (const i of unpaid(w.bag, k)[0]) dropItem(w.bag, i); return T.left;
      case 'gear': { const res = buy(w, r.item, k, this.cash); return res === 'ok' ? T.ok : res === 'funds' ? broke : T[res]; }
      case 'menu':
        if (this.here && edible(r.good)) {
          if (w.needs.food > 0.97) return T.full;
          if (!pay(w, r.cents, k, this.cash)) return broke;
          eat(w, r.good);
          return T.enjoy;
        }
        if (!carried(r.good)) return T.servedHere;
        if (!placeFor(w.bag, ...sizeOf(r.good))) return T.room;
        if (!pay(w, r.cents, k, this.cash)) return broke;
        addToBag(w.bag, r.good, r.cents, k, true);
        return T.ok;
      case 'cash':
        if (!post(w.bank, w.time, 'atm', -r.cents, k)) return T.funds;
        w.player.cash += r.cents;
        return T.withdrew;
    }
  }
}

/** The prompt at a till: how to use the counter, that nobody is at it, or when the shop opens. */
export function counterPrompt(world: World, n: { k: number; open: boolean; staffed: boolean }): string {
  return n.staffed ? T.use : n.open ? T.nobody : T.closed.replace('{h}', String(BIZ_HOURS[world.city.businesses[n.k].kind]?.[0] ?? 9));
}

export const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** The counter's panel: a printed price list on the counter, in the middle of the interface grid. */
export function drawCounter(g: CharGrid, C: Counter, world: World, now: number) {
  if (!C.active) return;
  const rows = C.rows(), W = 62, H = 13 + rows.length * 2, x0 = (g.cols - W) >> 1, y0 = Math.max(1, (g.rows - H) >> 1) - 4;
  const PAPER = [228, 222, 200], INK = [40, 36, 30], DIM = [120, 112, 96], SEL = [30, 26, 20];
  for (let y = 0; y < H; y++) g.text(x0, y0 + y, ' '.repeat(W), INK, PAPER);
  const name = businessName(world.city, C.k).toUpperCase();
  g.text(x0 + ((W - name.length) >> 1), y0 + 1, name, INK, PAPER);
  g.text(x0 + 2, y0 + 2, '-'.repeat(W - 4), DIM, PAPER);
  const [taken, sum] = unpaid(world.bag, C.k);
  rows.forEach((r, n) => {
    const y = y0 + 3 + n * 2, on = n === C.pick;
    const bg = on ? SEL : PAPER, fg = on ? [255, 230, 160] : INK;
    let label = '', price = '';
    if (r.kind === 'pay') { label = T.pay.replace('{n}', String(taken.length)); price = money(sum); }
    else if (r.kind === 'leave') label = T.leave;
    else if (r.kind === 'gear') { label = T.items[r.item.id].name; price = owned(world.gear, r.item) ? T.have : money(r.item.cents); }
    else if (r.kind === 'menu') { label = GOODS[r.good] ?? r.good; price = money(r.cents); }
    else { label = T.withdraw; price = money(r.cents); }
    g.text(x0 + 1, y, ' '.repeat(W - 2), fg, bg);
    g.text(x0 + 2, y, `${on ? '>' : ' '} ${label}`.slice(0, W - 4 - price.length), fg, bg);
    g.text(x0 + W - 2 - price.length, y, price, fg, bg);
    if (r.kind === 'gear' && on) g.text(x0 + 4, y + 1, T.items[r.item.id].what.slice(0, W - 6), DIM, PAPER);
  });
  const yb = y0 + 3 + rows.length * 2;
  g.text(x0 + 2, yb, '-'.repeat(W - 4), DIM, PAPER);
  // how to pay: cash from the pocket, or the card (the account's balance)
  const cash = `${T.cash} ${money(world.player.cash)}`, card = `${T.card} ${money(world.bank.balance)}`;
  g.text(x0 + 2, yb + 1, ` ${cash} `, C.cash ? [255, 230, 160] : DIM, C.cash ? SEL : PAPER);
  g.text(x0 + W - 3 - card.length, yb + 1, ` ${card} `, !C.cash ? [255, 230, 160] : DIM, !C.cash ? SEL : PAPER);
  if (C.serves()) {
    const here = ` ${T.here} `, go = ` ${T.toGo} `;
    g.text(x0 + 2, yb + 2, here, C.here ? [255, 230, 160] : DIM, C.here ? SEL : PAPER);
    g.text(x0 + 3 + here.length, yb + 2, go, !C.here ? [255, 230, 160] : DIM, !C.here ? SEL : PAPER);
  }
  const note = now - C.noteAt < 3 ? C.note : rows.length ? T.hello : T.nothing;
  g.text(x0 + 2, yb + 4, note.slice(0, W - 4), INK, PAPER);
  g.text(x0 + 2, yb + 6, (C.serves() ? T.keysFood : T.keys).slice(0, W - 4), DIM, PAPER);
}
