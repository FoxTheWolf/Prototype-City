import { hash3 } from '../core/rng';
import { blockAt, diagS } from '../sim/city';
import { outletNear, outletPower } from '../sim/outlets';
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
  // already seated (13.10f): the same seat; on the table or the bar in front of it if there is one, else on the lap
  if (p.sit) {
    const S = p.sit, c = Math.cos(S.yaw), s = Math.sin(S.yaw);
    const near = p.inside >= 0 && planOf(city, p.inside, p.floor)?.furn.some((f) => (f.kind === 'table' || f.kind === 'desk' || f.kind === 'bar' || f.kind === 'coffee')
      && Math.hypot(f.x - S.x - c * 0.6, f.y - S.y - s * 0.6) < Math.max(f.hx, f.hy) + 0.5);
    return { kind: near ? 'table' : S.kind === 'bench' ? 'bench' : 'sofa', eye: S.eye };
  }
  if (p.inside >= 0) {
    const P = planOf(city, p.inside, p.floor);
    let best: Seat | null = null, bd = 0.9;
    for (const f of P?.furn ?? []) {
      // distance to the piece's footprint
      const dx = p.x - f.x, dy = p.y - f.y, u = Math.abs(dx * f.c + dy * f.s) - f.hx, v = Math.abs(-dx * f.s + dy * f.c) - f.hy, d = Math.hypot(Math.max(0, u), Math.max(0, v));
      const kind: SeatKind | null = f.kind === 'desk' || f.kind === 'table' || f.kind === 'coffee' ? 'desk'
        : f.kind === 'counter' || f.kind === 'reception' || f.kind === 'till' || f.kind === 'bar' || f.kind === 'case' ? 'counter' : f.kind === 'sofa' || f.kind === 'chair' || f.kind === 'stool' ? 'sofa' : f.kind === 'bed' ? 'bed' : null;
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
  /** The drive's last seek (real seconds): its activity light flickers with them. */
  hddAt = -9;
  /** The power button pressed with a flat battery and no outlet: the charge light blinks, nothing else. */
  deadAt = -9;
  private lowSaid = false;
  private critSaid = false;

  constructor(private world: World) {
    this.pc = new Computer(playerLaptop(world.seed));
    this.pc.charge = 0.55 + hash3(world.seed, 402, 1) * 0.4;
    install(this.pc, world.time);
    this.shell = new Shell(this.pc, world);
  }
  /** What the save keeps of the notebook (F.6): its disk, its firmware's settings and its battery; it comes back off, in the backpack. */
  snapshot() { return { kids: this.pc.root.kids, bios: { ...this.pc.bios }, charge: this.pc.charge }; }
  restore(d: ReturnType<Laptop['snapshot']>) { this.pc.root.kids = d.kids; this.pc.bios = { ...this.pc.bios, ...d.bios }; this.pc.charge = d.charge; }
  /**
   * Is there a live outlet where the player sits: a wall outlet within the adapter's cable (13.9c),
   * in a building whose power is on (its substation, or a generator that feeds more than the
   * emergency lights). Elsewhere, outside, on a fire escape or in a blackout, it runs on its battery.
   */
  private outlet(): boolean {
    const w = this.world, p = w.player;
    if (p.inside < 0 || !this.seat || this.seat.kind === 'escape') return false;
    // a wall outlet within the adapter's cable (13.9c)
    return !!outletNear(w, p.x, p.y) && outletPower(w);
  }
  /** Flat and unplugged: the power button does nothing. */
  private get dead() { return !this.pc.plugged && this.pc.charge <= 0.005; }
  /** A program that owns the whole screen wants the keys a terminal would not (Esc, PageUp/PageDown). */
  get owns() { return !!this.shell.fw.mode || !!this.shell.editor || !!this.shell.browser; }
  /** N: take it out where it can be used (true), or say why not. */
  take(now: number): boolean {
    if (this.open) return false;
    const s = findSeat(this.world);
    this.noticeAt = now;
    if (typeof s === 'string') { this.notice = L.seat[s]; return false; }
    this.seat = s; this.notice = L.seat[s.kind];
    if (this.outlet()) this.notice += ' ' + L.seat.plug;
    this.open = true; this.openedAt = now; this.woke = false;
    this.sfx.push('zip');
    return true;
  }
  /** Esc: close the lid and stand up (or stay on the seat the player sat on first, 13.10f); the system sleeps where it was. */
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
        this.pc.plugged = this.outlet();
        if (this.shell.state === 'off' && !this.shell.halted) { this.sfx.push('power'); if (this.dead) { this.deadAt = now; this.shell.halted = true; } else this.shell.boot(now); }
        else if (this.shell.state !== 'off') this.shell.resume(now);
      }
    } else {
      this.lid = Math.max(0, this.lid - dt / 0.3);
      if (this.lid === 0) this.raise = Math.max(0, this.raise - dt / 0.4);
      if (this.raise === 0) this.seat = null;
    }
    this.shell.update(now);
    // the processor's load, always moving a little: the boot works it hard, a heavy command maxes it,
    // and at idle the kernel and daemons keep it jittering with the odd small blip
    const S = this.shell, w = this.world, off = S.state === 'off' || this.pc.bootAt < 0;
    const jit = 0.5 + 0.5 * Math.sin(now * 0.8), blip = Math.sin(now * 2.3) > 0.9 ? 0.12 : 0;
    this.pc.load = off ? 0 : S.state === 'boot' ? 0.5 + 0.35 * Math.abs(Math.sin(now * 4))
      : now < S.heavyUntil ? 0.86 + 0.14 * Math.abs(Math.sin(now * 9))
      : now < S.busyUntil ? 0.28 + 0.1 * jit : 0.03 + 0.05 * jit + blip;
    // a rough resident-memory model: the kernel and system take a baseline, buffers and cache drift
    this.pc.bgKB = off ? 0 : Math.round((36 + 24 * (0.5 + 0.5 * Math.sin(now * 0.17))) * 1024);
    this.pc.heat(dt, w.player.inside >= 0 ? 22 : w.weather.temp);
    // the battery: on the mains only while open where there is an outlet; asleep in the bag it barely drains
    const pc = this.pc, st = S.state === 'off' ? 'off' : this.open && this.lid >= 1 ? 'on' : 'sleep';
    pc.plugged = this.open && this.outlet();
    pc.drain(dt, st);
    if (!pc.plugged && st !== 'off') {
      if (pc.charge <= 0) S.powerLoss();
      else if (pc.charge < 0.03 && st === 'on' && !this.critSaid) { this.critSaid = true; S.battCritical(now); }
      else if (pc.charge < 0.1 && st === 'on' && !this.lowSaid) { this.lowSaid = true; S.broadcast(now, `Battery low (${Math.round(pc.charge * 100)}%): plug in the adapter or save your work.`); }
    }
    if (pc.charge > 0.12) this.lowSaid = this.critSaid = false;
    for (const s of this.shell.sfx) { this.sfx.push(s); if (s === 'seek') this.hddAt = now; }
    this.shell.sfx.length = 0;
  }
  /** A key of the player's keyboard, typed on the notebook. */
  key(code: string, key: string, ctrl: boolean, now: number) {
    if (this.lid < 1) return;
    this.pressed.set(code, now);
    this.sfx.push(code === 'Space' ? 'space' : code === 'Enter' || code === 'Backspace' || code.startsWith('Shift') ? 'enter' : 'key');
    // powered off (shut down): Enter is the power button
    if (this.shell.state === 'off') {
      if (code === 'Enter' || code === 'Space') { this.sfx.push('power'); if (this.dead) { this.deadAt = now; return; } this.shell.halted = false; this.shell.boot(now); }
      return;
    }
    if ((code === 'PageUp' || code === 'PageDown') && !this.owns) { this.scroll(code === 'PageUp' ? TERM_H - 2 : -(TERM_H - 2)); return; }
    this.shell.key(key, ctrl, now);
  }
  scroll(d: number) { const S = this.shell; S.scroll = Math.max(0, Math.min(Math.max(0, S.lines.length - 4), S.scroll + d)); }
  /** How far the eye has gone down to the seat, 0 .. 1. */
  get sitting() { return this.raise; }
}
