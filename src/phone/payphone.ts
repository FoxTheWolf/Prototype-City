import en from '../locale/en.json';
import { type CharGrid } from '../render/grid';
import { formatNumber } from '../sim/telco';
import { type World } from '../sim/world';
import { Call, type Sfx } from './call';
import { ch, type C3 } from './lcd';
import { type Key } from './phone';

/**
 * A street payphone, used where it stands: lift the handset, drop coins, dial. A local call costs
 * 50 cents in coins from the pocket (the coins come back if nobody answers); 911 is free. It is a
 * landline: it works without the phone network's signal, through the same exchange (see call.ts).
 * Every payphone has its own number (sim/telco.ts). On screen: the steel box, a small display, the
 * chrome keypad, the coin slot and the hook.
 */
const PAY = en.phone.payphone;
export const PAY_W = 36, PAY_H = 44;
/** Cents a call takes, and a coin. */
const FARE = 50, COIN = 25;

const KEYS: [Key, number, number, number, number, string][] = [];
['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].forEach((k, n) => KEYS.push([k as Key, 4 + (n % 3) * 10, 13 + Math.floor(n / 3) * 4, 8, 3, k]));
KEYS.push(['ok', 4, 30, 13, 3, PAY.coin], ['send', 19, 30, 13, 3, PAY.dial], ['end', 4, 35, 28, 3, PAY.hang]);

export class Payphone {
  /** The payphone in use (index into telco.payphones), or -1. */
  k = -1;
  dial = '';
  /** Coins dropped in, cents. */
  coins = 0;
  call: Call | null = null;
  note = '';
  readonly sfx: Sfx[] = [];
  readonly pressed = new Map<Key, number>();
  hover: Key | null = null;
  constructor(private world: World) {}

  get active() { return this.k >= 0; }

  /** The nearest payphone the player stands at, facing its front, or -1. */
  near(): number {
    const p = this.world.player;
    if (p.inside >= 0) return -1;
    let best = -1, bd = 1.6;
    this.world.telco.payphones.forEach((q, k) => {
      const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
      // the phone faces -x of its prop
      if (d < bd && dx * -Math.cos(q.a) + dy * -Math.sin(q.a) > 0) { bd = d; best = k; }
    });
    return best;
  }

  open(k: number) { this.k = k; this.dial = ''; this.coins = 0; this.call = null; this.note = PAY.lift; this.sfx.push(['hook']); }

  /** Put the handset back: unused coins come back. */
  close() {
    if (this.call && this.call.state !== 'ended') this.call.hangUp(0);
    this.world.player.cash += this.coins;
    this.k = -1; this.call = null; this.coins = 0;
    this.sfx.push(['stop'], ['hook']);
  }

  update(now: number) {
    if (!this.active) return;
    // walking away hangs up
    const q = this.world.telco.payphones[this.k], p = this.world.player;
    if (Math.hypot(p.x - q.x, p.y - q.y) > 2.5) { this.close(); return; }
    const c = this.call;
    if (!c) return;
    c.update(now, this.sfx);
    if (c.state === 'ended' && now > c.endAt + 2) {
      // answered: the fare is kept; not answered: the coins drop back
      if (c.connectAt >= 0 && c.callee.kind !== 'emergency') this.coins = Math.max(0, this.coins - FARE);
      else this.sfx.push(['coins']);
      this.world.player.cash += this.coins; this.coins = 0;
      this.call = null; this.dial = ''; this.note = PAY.lift;
    }
  }

  /** A key of the payphone. */
  press(k: Key, now: number) {
    this.pressed.set(k, now);
    const c = this.call;
    if (k === 'end') { if (c && c.state !== 'ended') { c.hangUp(now); this.sfx.push(['stop']); } else this.close(); return; }
    if (c) { if (/^[0-9*#]$/.test(k)) c.key(k, now); else if (k === 'rsoft' && c.state !== 'ended') { c.hangUp(now); this.sfx.push(['stop']); } return; }
    if (/^[0-9*#]$/.test(k)) { if (this.dial.length < 11) this.dial += k; return; }
    if (k === 'rsoft') { this.dial = this.dial.slice(0, -1); return; }
    if (k === 'ok') {
      if (this.world.player.cash < COIN) { this.note = PAY.noCoins; return; }
      this.world.player.cash -= COIN; this.coins += COIN; this.sfx.push(['coin']);
      return;
    }
    if (k === 'send' && this.dial) {
      if (this.dial !== '911' && this.coins < FARE) { this.note = PAY.deposit; return; }
      this.call = new Call(this.world, this.dial, now, false);
    }
  }

  /** The key under a grid cell, if any. */
  keyAt(cols: number, rows: number, x: number, y: number): Key | null {
    const [ox, oy] = origin(cols, rows);
    for (const [k, x0, y0, w, h] of KEYS) if (x >= ox + x0 && x < ox + x0 + w && y >= oy + y0 && y < oy + y0 + h) return k;
    return null;
  }
}

const origin = (cols: number, rows: number): [number, number] => [cols - PAY_W - 12, rows - PAY_H - 3];

/** The payphone on screen, lit by the scene. */
export function drawPayphone(g: CharGrid, P: Payphone, world: World, now: number, light: Float32Array) {
  if (!P.active) return;
  const [ox, oy] = origin(g.cols, g.rows), L = light;
  const put = (x: number, y: number, c: number, fg: C3, bg: C3, glow = false) => {
    const gx = ox + x, gy = oy + y;
    if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return;
    const i = gy * g.cols + gx, k = glow ? 1 : 1;
    g.setBg(i, bg[0] * L[0] * k, bg[1] * L[1] * k, bg[2] * L[2] * k);
    if (glow) g.put(i, c, fg[0], fg[1], fg[2]); else g.put(i, c, fg[0] * L[0], fg[1] * L[1], fg[2] * L[2]);
  };
  const STEEL: C3 = [120, 124, 130], DARK: C3 = [40, 42, 46];
  for (let y = 0; y < PAY_H; y++) for (let x = 0; x < PAY_W; x++) {
    const edge = x === 0 || y === 0 || x === PAY_W - 1 || y === PAY_H - 1;
    put(x, y, edge ? ch('#') : (x + y) % 7 === 0 ? ch('.') : 32, [160, 165, 170], edge ? [90, 94, 100] : STEEL);
  }
  // the display: the number dialed, the deposit, what is going on
  const LCD: C3 = [30, 50, 30], INK: C3 = [150, 255, 150];
  for (let y = 4; y < 10; y++) for (let x = 4; x < 32; x++) put(x, y, 32, INK, LCD, true);
  const text = (x: number, y: number, s: string, col: C3 = INK) => { for (let n = 0; n < s.length && x + n < 31; n++) put(x + n, y, s.charCodeAt(n), col, LCD, true); };
  const c = P.call;
  text(5, 5, c ? (c.state === 'talk' ? `${Math.floor(c.talked(now))}s` : c.state === 'ended' ? c.reason : c.state === 'ringing' ? `${en.phone.apps.ringing} ${c.rings}` : en.phone.apps.calling) : P.dial || P.note);
  text(5, 7, `${PAY.deposited} ${P.coins}c`);
  text(5, 8, `${PAY.cash} $${(world.player.cash / 100).toFixed(2)}`, [110, 180, 110]);
  if (c?.lines.length) { const l = c.lines[c.lines.length - 1]; text(5, 6, l.text.slice(Math.max(0, Math.floor((now - l.at) * 12) - 25), Math.floor((now - l.at) * 12)), [220, 255, 200]); }
  // the payphone's own number, on a card under the display
  const num = formatNumber(world.telco, world.telco.payphones[P.k].num);
  for (let n = 0; n < num.length; n++) put(5 + n, 11, num.charCodeAt(n), [30, 30, 30], [220, 215, 190]);
  // keys: chrome, sunk when pressed, brighter under the cursor
  for (const [k, x0, y0, w, h, label] of KEYS) {
    const down = now - (P.pressed.get(k) ?? -9) < 0.14, hov = P.hover === k && !down;
    const cap: C3 = down ? DARK : hov ? [225, 228, 235] : [185, 190, 198];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x0 + x, y0 + y, 32, DARK, cap);
    const lx = x0 + ((w - label.length) >> 1);
    for (let n = 0; n < label.length; n++) put(lx + n, y0 + (h >> 1), label.charCodeAt(n), k === 'end' ? [150, 20, 20] : [20, 22, 26], cap);
  }
  // the coin slot and the coin return
  for (let x = 26; x < 32; x++) put(x, 11, ch('='), [30, 30, 30], DARK);
  for (let y = 40; y < 42; y++) for (let x = 13; x < 23; x++) put(x, y, ch('_'), [80, 80, 80], DARK);
}
