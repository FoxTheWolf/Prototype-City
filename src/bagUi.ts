import { money } from './counter';
import { type CharGrid } from './render/grid';
import { goodColor } from './render/models';
import { BAG_H, BAG_W, dropItem, itemAt, settleBag, type BagItem } from './sim/bag';
import { type World } from './sim/world';
import { businessName } from './locale/names';
import en from './locale/en.json';

const T = en.bag;
const NAMES: Record<string, string> = { ...(en.goods as Record<string, string>), antenna: en.counter.items.antenna.name, battery: en.counter.items.battery.name };
/** Interface columns per centimetre; rows per centimetre follow the cells' shape (0.6 wide to 1 tall). */
const SX = 1.2, SY = SX * 0.6;

/**
 * The backpack open (13.4): B opens it, the cursor is free, a thing is dragged with the left button
 * (R turns it on its side while held), the right button puts it back on the shelf (unpaid, in its
 * shop) or throws it away. The slots for the phone, the notebook and the SIM stand beside it.
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
  constructor(private world: World) {}

  /** A cell of the interface to the bag's cm. */
  cm(cx: number, cy: number): [number, number] { return [(cx + 0.5 - this.bx) / SX, (this.by - (cy + 0.5)) / SY]; }

  grab(cx: number, cy: number) {
    const [x, y] = this.cm(cx, cy), i = itemAt(this.world.bag, x, y);
    if (!i) return;
    this.held = i; this.gx = x - i.x; this.gy = y - i.y;
  }
  release() { this.held = null; }
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
  private say(s: string, now: number) { this.note = s; this.noteAt = now; }

  /** The pile, a frame: the held thing follows the cursor at (cx, cy). */
  step(dt: number, cx: number, cy: number) {
    const [x, y] = this.cm(cx, cy);
    settleBag(this.world.bag, dt, this.open ? this.held : null, x - this.gx, y - this.gy);
  }

  draw(g: CharGrid, cx: number, cy: number, slots: [string, string][], now: number) {
    if (!this.open) return;
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
    for (const [label, what] of slots) {
      g.text(sx, sy, ` ${label.padEnd(SW - 1)}`, [230, 210, 170], CANVAS);
      g.text(sx, sy + 1, ` ${what.slice(0, SW - 2).padEnd(SW - 1)}`, [200, 200, 190], IN);
      sy += 3;
    }
    g.text(sx, sy, ` ${`${T.cash} ${money(w.player.cash)}`.padEnd(SW - 1)}`, [180, 230, 170], IN);
    // the thing under the cursor: what it is, and whose
    const info = over ? `${NAMES[over.good] ?? over.good}  ${over.paid ? '' : `${T.unpaid} ${money(over.cents)} (${businessName(w.city, over.shop)})`}` : '';
    const msg = now - this.noteAt < 2.5 ? this.note : info;
    if (msg) g.text(x0 - 2, this.by + 1, ` ${msg.slice(0, bw + 30)} `, [255, 225, 150], [20, 16, 10]);
    g.text(x0 - 2, this.by + 3, ` ${T.keys} `, [150, 140, 120], [20, 16, 10]);
  }
}
