import { type Sfx } from './phone/call';
import { type CharGrid } from './render/grid';
import { buy, itemsAt, owned, type Item } from './sim/gear';
import { planOf } from './sim/interior';
import { BIZ_HOURS, isOpen } from './sim/telco';
import { type World } from './sim/world';
import { businessName } from './locale/names';
import en from './locale/en.json';

const T = en.counter;
/** How near the till the player must stand, m. */
const REACH = 1.8;

/**
 * The counter of a shop that sells gear (F.9): F at the till of an open pawn shop or electronics
 * store lists what it sells, the arrows pick, Enter buys by card, F or Esc leaves. A stand-in for
 * talking to the clerk until the dialogue exists (13c).
 */
export class Counter {
  /** The business at whose till the player stands, or -1. */
  k = -1;
  pick = 0;
  note = '';
  noteAt = -9;
  readonly sfx: Sfx[] = [];
  constructor(private world: World) {}

  get active() { return this.k >= 0; }
  items(): Item[] { return this.k < 0 ? [] : itemsAt(this.world.city.businesses[this.k].kind); }

  /** The business whose till the player stands at, if it sells gear, and whether it is open; or null. */
  near(): { k: number; open: boolean } | null {
    const w = this.world, p = w.player;
    if (p.inside < 0 || p.floor !== 0) return null;
    const B = w.city.buildings[p.inside];
    if (!B.shop || B.biz < 0 || !itemsAt(w.city.businesses[B.biz].kind).length) return null;
    const P = planOf(w.city, p.inside, 0);
    if (!P || !P.furn.some((f) => f.kind === 'till' && Math.hypot(f.x - p.x, f.y - p.y) < REACH + Math.max(f.hx, f.hy))) return null;
    return { k: B.biz, open: isOpen(w.city.businesses[B.biz].kind, (w.time / 3600) % 24) };
  }

  open(k: number) { this.k = k; this.pick = 0; this.note = T.hello; this.noteAt = -9; this.sfx.push(['beep']); }
  close() { this.k = -1; }

  /** A key while at the counter: true when it was the counter's. */
  key(code: string, now: number): boolean {
    if (!this.active) return false;
    const n = this.items().length;
    if (code === 'ArrowUp') { this.pick = (this.pick + n - 1) % n; this.sfx.push(['beep']); }
    else if (code === 'ArrowDown') { this.pick = (this.pick + 1) % n; this.sfx.push(['beep']); }
    else if (code === 'Enter' || code === 'Space') {
      const r = buy(this.world, this.items()[this.pick], this.k);
      this.note = T[r]; this.noteAt = now;
      this.sfx.push(r === 'ok' ? ['coin'] : ['fail']);
    } else if (code === 'Escape' || code === 'KeyF') this.close();
    else return false;
    return true;
  }
}

/** The prompt at a till: how to use the counter, or when the shop opens. */
export function counterPrompt(world: World, n: { k: number; open: boolean }): string {
  return n.open ? T.use : T.closed.replace('{h}', String(BIZ_HOURS[world.city.businesses[n.k].kind]?.[0] ?? 9));
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** The counter's panel: a printed price list on the counter, in the middle of the interface grid. */
export function drawCounter(g: CharGrid, C: Counter, world: World, now: number) {
  if (!C.active) return;
  const items = C.items(), W = 46, H = 10 + items.length * 3, x0 = (g.cols - W) >> 1, y0 = Math.max(1, (g.rows - H) >> 1) - 4;
  const PAPER = [228, 222, 200], INK = [40, 36, 30], DIM = [120, 112, 96], SEL = [30, 26, 20];
  for (let y = 0; y < H; y++) g.text(x0, y0 + y, ' '.repeat(W), INK, PAPER);
  const name = businessName(world.city, C.k).toUpperCase();
  g.text(x0 + ((W - name.length) >> 1), y0 + 1, name, INK, PAPER);
  g.text(x0 + 2, y0 + 2, '-'.repeat(W - 4), DIM, PAPER);
  items.forEach((it, n) => {
    const y = y0 + 3 + n * 3, on = n === C.pick, have = owned(world.gear, it);
    const bg = on ? SEL : PAPER, fg = on ? [255, 230, 160] : INK;
    g.text(x0 + 1, y, ' '.repeat(W - 2), fg, bg);
    const label = `${on ? '>' : ' '} ${T.items[it.id].name}`, price = have ? T.have : money(it.cents);
    g.text(x0 + 2, y, label, fg, bg);
    g.text(x0 + W - 2 - price.length, y, price, fg, bg);
    g.text(x0 + 4, y + 1, T.items[it.id].what.slice(0, W - 6), DIM, PAPER);
  });
  const yb = y0 + 3 + items.length * 3;
  g.text(x0 + 2, yb, '-'.repeat(W - 4), DIM, PAPER);
  const bal = `${T.balance} ${money(world.bank.balance)}`;
  g.text(x0 + 2, yb + 1, bal, INK, PAPER);
  const note = now - C.noteAt < 3 ? C.note : T.hello;
  g.text(x0 + 2, yb + 3, note.slice(0, W - 4), INK, PAPER);
  g.text(x0 + 2, yb + 5, T.keys.slice(0, W - 4), DIM, PAPER);
}
