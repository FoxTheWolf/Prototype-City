import { blockAt, diagS } from '../sim/city';
import { Computer, playerLaptop } from '../sim/computer';
import { planOf } from '../sim/interior';
import { type World } from '../sim/world';
import L from '../locale/laptop.en.json';
import { install, Shell, TERM_H, type LapSfx } from './shell';

/**
 * The player's notebook as an object: out of the backpack only where it can be used, sitting or
 * leaning (a bench, a table, a desk, steps, the floor or the curb), never while walking. It opens,
 * the screen wakes or the system boots, and the keyboard is the player's: every key typed shows on
 * the notebook's own keys, with its click. The world keeps going meanwhile. Times are real seconds.
 *
 * N takes it out (choosing the place); Esc closes the lid (the system sleeps) and the player stands.
 */
export type SeatKind = 'bench' | 'table' | 'steps' | 'desk' | 'counter' | 'sofa' | 'bed' | 'escape' | 'floor' | 'ground';
export interface Seat { kind: SeatKind; /** Eye height over the feet while sitting or leaning there. */ eye: number }

/** Where the notebook can be used from here, or why not. */
export function findSeat(w: World): Seat | 'road' | 'lift' {
  const p = w.player, city = w.city;
  if (p.liftTo >= 0) return 'lift';
  if (p.inside >= 0) {
    const P = planOf(city, p.inside, p.floor);
    let best: Seat | null = null, bd = 0.9;
    for (const f of P?.furn ?? []) {
      // distance to the piece's footprint
      const dx = p.x - f.x, dy = p.y - f.y, u = Math.abs(dx * f.c + dy * f.s) - f.hx, v = Math.abs(-dx * f.s + dy * f.c) - f.hy, d = Math.hypot(Math.max(0, u), Math.max(0, v));
      const kind: SeatKind | null = f.kind === 'desk' || f.kind === 'table' || f.kind === 'coffee' ? 'desk'
        : f.kind === 'counter' || f.kind === 'reception' || f.kind === 'till' ? 'counter' : f.kind === 'sofa' || f.kind === 'chair' ? 'sofa' : f.kind === 'bed' ? 'bed' : null;
      if (kind && d < bd) { bd = d; best = { kind, eye: kind === 'counter' ? 1.6 : kind === 'bed' ? 1.0 : kind === 'desk' && f.kind === 'coffee' ? 1.1 : 1.2 }; }
    }
    return best ?? { kind: 'floor', eye: 0.85 };
  }
  if (p.z > 0.5) return { kind: 'escape', eye: 0.85 };
  let best: Seat | null = null, bd = 1.4;
  const seen = new Set<object>();
  for (const [ox, oy] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
    const B = blockAt(city, p.x + ox, p.y + oy);
    if (!B || seen.has(B)) continue;
    seen.add(B);
    for (const q of B.props) {
      const kind: SeatKind | null = q.kind === 'bench' || q.kind === 'shelter' ? 'bench' : q.kind === 'table' ? 'table' : q.kind === 'steps' ? 'steps' : null;
      if (!kind) continue;
      const d = Math.hypot(q.x - p.x, q.y - p.y) - (kind === 'steps' ? 3 : 0.6);
      if (d < bd) { bd = d; best = { kind, eye: kind === 'table' ? 1.2 : 1.15 }; }
    }
  }
  if (best) return best;
  // the roadway: no block here, or the diagonal avenue's lanes
  if (!blockAt(city, p.x, p.y) || Math.abs(diagS(city.diagonal, p.x, p.y)) < city.diagonal.w / 2) return 'road';
  return { kind: 'ground', eye: 0.9 };
}

export type LapSound = LapSfx | 'zip' | 'open' | 'close' | 'key' | 'space' | 'enter' | 'power';

export class Laptop {
  readonly pc: Computer;
  readonly shell: Shell;
  /** Out and open (or opening), the place it is used from. */
  open = false;
  seat: Seat | null = null;
  /** 0 in the backpack .. 1 in front of the player; the lid 0 shut .. 1 open. */
  raise = 0;
  lid = 0;
  private openedAt = 0;
  private woke = false;
  /** A line about the place (or why not here), and since when. */
  notice = '';
  noticeAt = -9;
  /** When each key (by its code) was last pressed: it shows pressed down for a moment. */
  readonly pressed = new Map<string, number>();
  readonly sfx: LapSound[] = [];

  constructor(private world: World) {
    this.pc = new Computer(playerLaptop(world.seed));
    install(this.pc, world.time);
    this.shell = new Shell(this.pc, world);
  }
  /** N: take it out where it can be used (true), or say why not. */
  take(now: number): boolean {
    if (this.open) return false;
    const s = findSeat(this.world);
    this.noticeAt = now;
    if (typeof s === 'string') { this.notice = L.seat[s]; return false; }
    this.seat = s; this.notice = L.seat[s.kind];
    this.open = true; this.openedAt = now; this.woke = false;
    this.sfx.push('zip');
    return true;
  }
  /** Esc: close the lid and stand up; the system sleeps where it was. */
  close(now: number) {
    if (!this.open) return;
    this.open = false; this.openedAt = now;
    this.sfx.push('close');
  }
  update(dt: number, now: number) {
    const t = now - this.openedAt;
    if (this.open) {
      // out of the bag, set down, then the lid opens
      this.raise = Math.min(1, this.raise + dt / 0.6);
      if (t > 0.6) { if (this.lid === 0) this.sfx.push('open'); this.lid = Math.min(1, this.lid + dt / 0.45); }
      if (this.lid >= 1 && !this.woke) {
        this.woke = true;
        if (this.shell.state === 'off' && !this.shell.halted) { this.sfx.push('power'); this.shell.boot(now); }
        else if (this.shell.state !== 'off') this.shell.resume(now);
      }
    } else {
      this.lid = Math.max(0, this.lid - dt / 0.3);
      if (this.lid === 0) this.raise = Math.max(0, this.raise - dt / 0.4);
      if (this.raise === 0) this.seat = null;
    }
    this.shell.update(now);
    for (const s of this.shell.sfx) this.sfx.push(s);
    this.shell.sfx.length = 0;
  }
  /** A key of the player's keyboard, typed on the notebook. */
  key(code: string, key: string, ctrl: boolean, now: number) {
    if (this.lid < 1) return;
    this.pressed.set(code, now);
    this.sfx.push(code === 'Space' ? 'space' : code === 'Enter' || code === 'Backspace' || code.startsWith('Shift') ? 'enter' : 'key');
    // powered off (shut down): Enter is the power button
    if (this.shell.state === 'off') { if (code === 'Enter' || code === 'Space') { this.shell.halted = false; this.sfx.push('power'); this.shell.boot(now); } return; }
    if (code === 'PageUp' || code === 'PageDown') { this.scroll(code === 'PageUp' ? TERM_H - 2 : -(TERM_H - 2)); return; }
    this.shell.key(key, ctrl, now);
  }
  scroll(d: number) { const S = this.shell; S.scroll = Math.max(0, Math.min(Math.max(0, S.lines.length - 4), S.scroll + d)); }
  /** How far the eye has gone down to the seat, 0 .. 1. */
  get sitting() { return this.raise; }
}
