import { money } from './counter';
import { type CharGrid } from './render/grid';
import { goodColor } from './render/models';
import { BAG_H, BAG_W, dropItem, itemAt, settleBag, type BagItem } from './sim/bag';
import { eat, edible, hungerStage } from './sim/needs';
import { type World } from './sim/world';
import { businessName, operatorName } from './locale/names';
import en from './locale/en.json';

const T = en.bag;
const NAMES: Record<string, string> = { ...(en.goods as Record<string, string>), antenna: en.counter.items.antenna.name, battery: en.counter.items.battery.name, sim: en.counter.items.sim.name };
/** The SIM swap's steps, seconds from its start: the cover off, the battery out, the old SIM out, the new one in, the battery and the cover back. */
const SWAP = [0.4, 1.0, 1.6, 2.2, 2.8, 3.4, 4.0, 4.4];
/** Interface columns per centimetre; rows per centimetre follow the cells' shape (0.6 wide to 1 tall). */
const SX = 1.2, SY = SX * 0.6;

/**
 * The backpack open (13.4): B opens it, the cursor is free, a thing is dragged with the left button
 * (R turns it on its side while held), the right button puts it back on the shelf (unpaid, in its
 * shop) or throws it away. The slots for the phone, the notebook and the SIM stand beside it: the
 * antenna or the battery let go over the notebook's slot is fitted to it, a new SIM over the phone's
 * or the SIM's goes in the phone, opening its back on the screen (13.6).
 */
export class BagView {
  open = false;
  held: BagItem | null = null;
  /** Where on the held thing it was grabbed, cm from its corner. */
  private gx = 0;
  private gy = 0;
  note = '';
  noteAt = -9;
  /** The bag's bottom-left on the interface grid (cells), from the last drawing. */
  private bx = 0;
  private by = 0;
  /** The slots' boxes on the interface grid (phone, notebook, SIM), from the last drawing. */
  private slotBox: [number, number, number, number][] = [];
  /** A SIM going into the phone: when it started (real seconds), its operator, the step reached; null when not. */
  swap: { at: number; op: number; step: number } | null = null;
  /** Sounds for main to play: a click, a part sliding. */
  readonly sfx: ('click' | 'slide')[] = [];
  /** What main does when gear is fitted to the notebook, and when the new SIM is in. */
  onFit: (id: 'antenna' | 'battery') => void = () => {};
  onSwap: (op: number) => void = () => {};
  constructor(private world: World) {}

  /** The slot under the cell, or -1. */
  private slotAt(cx: number, cy: number) { return this.slotBox.findIndex(([a, b, c, d]) => cx >= a && cx < c && cy >= b && cy < d); }
  /** Whether the held thing goes in slot k: a SIM in the phone (or its SIM slot), the antenna or the battery in the notebook. */
  private fits(k: number) { const g = this.held?.good; return g === 'sim' ? k === 0 || k === 2 : (g === 'antenna' || g === 'battery') && k === 1; }

  /** A cell of the interface to the bag's cm. */
  cm(cx: number, cy: number): [number, number] { return [(cx + 0.5 - this.bx) / SX, (this.by - (cy + 0.5)) / SY]; }

  grab(cx: number, cy: number) {
    if (this.swap) return;
    const [x, y] = this.cm(cx, cy), i = itemAt(this.world.bag, x, y);
    if (!i) return;
    this.held = i; this.gx = x - i.x; this.gy = y - i.y;
  }
  /** Let go: over a slot that takes it, the thing is used (fitted, or the SIM put in the phone). */
  release(cx = -1, cy = -1, now = 0) {
    const i = this.held, k = this.slotAt(cx, cy), ok = k >= 0 && this.fits(k);
    this.held = null;
    if (!i || k < 0) return;
    if (!ok) { this.say(T.notHere, now); return; }
    dropItem(this.world.bag, i);
    this.sfx.push('click');
    if (i.good === 'sim') { this.swap = { at: now, op: i.op ?? 0, step: 0 }; return; }
    this.onFit(i.good as 'antenna' | 'battery');
    this.say(T.fitted.replace('{x}', NAMES[i.good]), now);
  }
  /** Turn the held thing on its side, about the hand. */
  turn() {
    const i = this.held;
    if (!i) return;
    [i.w, i.h] = [i.h, i.w];
    [this.gx, this.gy] = [Math.min(this.gy, i.w), Math.min(this.gx, i.h)];
  }

  /** The right button on a thing: back on the shelf if unpaid (in its shop), else thrown away; the gear is kept. */
  remove(cx: number, cy: number, now: number) {
    const w = this.world, [x, y] = this.cm(cx, cy), i = itemAt(w.bag, x, y);
    if (!i) return;
    if (i.good === 'antenna' || i.good === 'battery') { this.say(T.keep, now); return; }
    if (this.held === i) this.held = null;
    dropItem(w.bag, i);
    this.say((i.paid ? T.thrown : T.back).replace('{x}', NAMES[i.good] ?? i.good), now);
  }
  /** Eat the thing under the cursor (only paid things: an unpaid one is the shop's until it is). True when it was eaten. */
  eatAt(cx: number, cy: number, now: number): boolean {
    const w = this.world, [x, y] = this.cm(cx, cy), i = itemAt(w.bag, x, y);
    if (!i) return false;
    const name = NAMES[i.good] ?? i.good;
    if (!edible(i.good)) { this.say(T.notFood, now); return false; }
    if (!eat(w, i.good)) { this.say(T.fullUp, now); return false; }
    if (this.held === i) this.held = null;
    dropItem(w.bag, i);
    this.say(T.ate.replace('{x}', name), now);
    return true;
  }
  private say(s: string, now: number) { this.note = s; this.noteAt = now; }

  /** The pile, a frame: the held thing follows the cursor at (cx, cy). */
  step(dt: number, cx: number, cy: number) {
    const [x, y] = this.cm(cx, cy);
    settleBag(this.world.bag, dt, this.open ? this.held : null, x - this.gx, y - this.gy);
  }

  draw(g: CharGrid, cx: number, cy: number, slots: [string, string][], now: number) {
    if (!this.open) return;
    if (this.swap) { this.drawSwap(g, now); return; }
    const w = this.world, B = w.bag, bw = Math.round(BAG_W * SX), bh = Math.round(BAG_H * SY);
    const x0 = ((g.cols - bw) >> 1) - 16, y0 = Math.max(2, ((g.rows - bh) >> 1) - 4);
    this.bx = x0; this.by = y0 + bh;
    const CANVAS = [70, 58, 40], SEAM = [150, 125, 85], IN = [24, 20, 16];
    // the bag: a canvas body around its dark inside, a flap on top
    for (let y = -3; y <= bh; y++) g.text(x0 - 2, y0 + y, ' '.repeat(bw + 4), SEAM, CANVAS);
    g.text(x0 + ((bw - T.title.length) >> 1), y0 - 2, T.title, [230, 210, 170], CANVAS);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = (y0 + y) * g.cols + x0 + x; g.put(i, 32, 0, 0, 0); g.setBg(i, IN[0], IN[1], IN[2]); }
    // the things, each a box of its color with its name, the unpaid ones with a price tag
    const [hx, hy] = this.cm(cx, cy), over = itemAt(B, hx, hy);
    for (const it of B.items) {
      const c = goodColor(it.good), lit = it === over || it === this.held ? 1.15 : 1;
      const ax = Math.round(x0 + it.x * SX), az = Math.round(this.by - (it.y + it.h) * SY);
      const iw = Math.max(1, Math.round(it.w * SX)), ih = Math.max(1, Math.round(it.h * SY));
      const bg = c.map((v) => Math.min(255, v * 0.45 * lit)), fg = c.map((v) => Math.min(255, v * lit));
      for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
        const X = ax + x, Y = az + y;
        if (X < 0 || Y < 0 || X >= g.cols || Y >= g.rows) continue;
        const edge = y === 0 || y === ih - 1 ? '-' : x === 0 || x === iw - 1 ? '|' : ' ';
        const i = Y * g.cols + X;
        g.put(i, (ih > 1 && iw > 1 ? edge : '#').charCodeAt(0), fg[0], fg[1], fg[2]);
        g.setBg(i, bg[0], bg[1], bg[2]);
      }
      // the name, a word to a line when it is too narrow for it whole
      const name = NAMES[it.good] ?? it.good, room = iw - 2;
      if (room >= 3) {
        const lines = name.length <= room || ih < 4 ? [name] : name.split(' ').slice(0, Math.max(1, ih - 2));
        lines.forEach((l, n) => { const t = l.slice(0, room); g.text(ax + 1 + ((room - t.length) >> 1), az + ((ih - lines.length) >> 1) + n, t, [240, 235, 225], bg); });
      }
    }
    // the price tags on what is not paid for yet, over everything
    for (const it of B.items) if (!it.paid) g.text(Math.round(x0 + it.x * SX), Math.round(this.by - (it.y + it.h) * SY), '$', [20, 16, 8], [255, 210, 60]);
    // the slots of their own, to the right
    let sy = y0 - 2;
    const sx = x0 + bw + 4, SW = 30;
    this.slotBox = [];
    for (const [label, what] of slots) {
      const take = this.held && this.fits(this.slotBox.length), hot = take && this.slotAt(cx, cy) === this.slotBox.length;
      this.slotBox.push([sx, sy, sx + SW, sy + 2]);
      g.text(sx, sy, ` ${label.padEnd(SW - 1)}`, hot ? [40, 30, 10] : [230, 210, 170], hot ? [255, 210, 90] : take ? [130, 105, 50] : CANVAS);
      g.text(sx, sy + 1, ` ${what.slice(0, SW - 2).padEnd(SW - 1)}`, [200, 200, 190], IN);
      sy += 3;
    }
    g.text(sx, sy, ` ${`${T.cash} ${money(w.player.cash)}`.padEnd(SW - 1)}`, [180, 230, 170], IN);
    const st = hungerStage(w.needs.food);
    g.text(sx, sy + 2, ` ${`${T.stomach} ${T.stages[st]}`.padEnd(SW - 1)}`, st >= 2 ? [255, 150, 110] : [200, 200, 190], IN);
    // the thing under the cursor: what it is, and whose
    const info = over ? `${NAMES[over.good] ?? over.good}${over.good === 'sim' ? ` (${operatorName(w.city, over.op ?? 0)})` : ''}  ${over.paid ? '' : `${T.unpaid} ${money(over.cents)} (${businessName(w.city, over.shop)})`}` : '';
    const msg = now - this.noteAt < 2.5 ? this.note : info;
    if (msg) g.text(x0 - 2, this.by + 1, ` ${msg.slice(0, bw + 30)} `, [255, 225, 150], [20, 16, 10]);
    g.text(x0 - 2, this.by + 3, ` ${T.keys} `, [150, 140, 120], [20, 16, 10]);
  }

  /**
   * The SIM going in, drawn over the bag: the phone's back seen from behind, its cover sliding off,
   * the battery lifted out, the old card pushed out of its slot and the new one in, then all back.
   */
  private drawSwap(g: CharGrid, now: number) {
    const S = this.swap!, t = now - S.at, k = (a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
    const W = 26, H = 28, x0 = ((g.cols - W) >> 1) - 16, y0 = Math.max(2, ((g.rows - H) >> 1) - 2);
    const rect = (x: number, y: number, w: number, h: number, bg: readonly number[], ch = ' ', fg: readonly number[] = bg) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const X = Math.round(x) + i, Y = Math.round(y) + j;
        if (X < 0 || Y < 0 || X >= g.cols || Y >= g.rows) continue;
        const n = Y * g.cols + X;
        g.put(n, ch.charCodeAt(0), fg[0], fg[1], fg[2]); g.setBg(n, bg[0], bg[1], bg[2]);
      }
    };
    const label = (x: number, y: number, s: string, fg: readonly number[], bg: readonly number[]) => { if (y >= 0 && y < g.rows) g.text(Math.max(0, Math.round(x)), Math.round(y), s, fg, bg); };
    // each part makes its sound once, as it starts to move
    const step = SWAP.findIndex((e) => t < e);
    if (step !== S.step) { S.step = step; if (step > 0) this.sfx.push(step === 1 || step === 6 ? 'slide' : 'click'); }
    const cover = k(SWAP[0], SWAP[1]) - k(SWAP[5], SWAP[6]), batt = k(SWAP[1], SWAP[2]) - k(SWAP[4], SWAP[5]);
    const oldOut = k(SWAP[2], SWAP[3]), newIn = k(SWAP[3], SWAP[4]);
    rect(x0 - 4, y0 - 3, W + 44, H + 8, [18, 16, 14]);
    rect(x0, y0, W, H, [38, 38, 44], '#', [52, 52, 60]);
    // the bay: the SIM's slot at the top, the battery's place below it
    rect(x0 + 3, y0 + 3, W - 6, H - 6, [70, 72, 78]);
    rect(x0 + 8, y0 + 4, 10, 5, [30, 30, 34], '=', [60, 60, 66]);
    const card = (dy: number, op: number, fresh: boolean) => {
      const bg = fresh ? [225, 225, 215] : [200, 200, 190];
      rect(x0 + 8, y0 + 4 + dy, 10, 5, bg);
      rect(x0 + 9, y0 + 5 + dy, 4, 3, [205, 170, 70], '+', [150, 120, 40]);
      label(x0 + 14, y0 + 6 + dy, operatorName(this.world.city, op).slice(0, 3).toUpperCase(), [60, 60, 70], bg);
    };
    if (t < SWAP[3]) card(-Math.round(oldOut * 9), this.world.telco.player.op ?? 0, false);
    else card(-Math.round((1 - newIn) * 9), S.op, true);
    // the battery, lifted out to the side
    const bx = x0 + 4 + batt * 30;
    rect(bx, y0 + 10, W - 8, H - 13, [40, 70, 130]);
    label(bx + 2, y0 + 12, 'Li-ion 3.7V', [210, 220, 240], [40, 70, 130]);
    label(bx + 2, y0 + 13, '1100 mAh', [170, 185, 215], [40, 70, 130]);
    // the cover, sliding down off the back
    const cy = y0 + cover * (H + 2);
    if (cover < 1) { rect(x0, cy, W, H, [58, 58, 66], '.', [70, 70, 80]); label(x0 + 3, cy + 3, 'O', [140, 150, 170], [30, 30, 36]); }
    label(x0 + W + 4, y0 + 2, T.swapping, [255, 225, 150], [18, 16, 14]);
    label(x0 + W + 4, y0 + 4, operatorName(this.world.city, S.op), [200, 200, 190], [18, 16, 14]);
    if (t >= SWAP[SWAP.length - 1]) {
      this.swap = null;
      this.onSwap(S.op);
      this.say(T.swapped.replace('{n}', this.world.telco.player.number).replace('{op}', operatorName(this.world.city, S.op)), now);
    }
  }
}
