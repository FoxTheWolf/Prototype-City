/**
 * The playtest record (13.10p): with ?playtest (jogar-playtest.bat, and always in the packaged .exe),
 * one JSONL file per session in playtest/ (next to the game; never in git), written through the local
 * server (electron/playtest.cjs, also hooked into Vite). It only watches the world from outside: where
 * the player is every second, which places they go into, what they take and pay for, the money, texts
 * and calls, the events of the city, the heat's tier, hunger, where they got stuck, and the notes
 * (F8: the game pauses, the text is kept with the position, the time and a picture of the screen).
 * tests/playtest-report.ts reads it into a report; nobody reads the raw lines.
 * Every record: { k: kind, rt: real seconds since the session began, gt: game time (s since 2008-01-01), ... }.
 */
import { businessName } from './locale/names';
import { hungerStage } from './sim/needs';
import { tierOf } from './sim/heat'; // [HACKING] only the heat's tier, through its API
import type { World } from './sim/world';

/** What the logger reads of the phone: the texts and the calls, newest first. */
interface PhoneLogs { inbox: object[]; sent: object[]; log: object[] }

/** Seconds (real) between position samples, and between writes to the file. */
const SAMPLE_S = 1, FLUSH_S = 5;
/** Walking keys held this long with less than STUCK_M of progress: stuck (logged once per spot). */
const STUCK_S = 2.5, STUCK_M = 0.6;

const r1 = (v: number) => Math.round(v * 10) / 10;
const pad = (n: number) => String(n).padStart(2, '0');

export class Playtest {
  readonly file: string;
  private buf: string[] = [];
  private t0 = performance.now();
  private lastSample = -1e9;
  private lastFlush = 0;
  private notes = 0;
  /** Nothing is written until the player goes into the city (a title left unplayed leaves no file). */
  private primed = false;
  // what was already seen, so only the new is logged
  private seen = new WeakSet<object>();
  private paid = new WeakMap<object, boolean>();
  private ledger = 0;
  private eventId = 0;
  private inside = -2;
  private cash = NaN;
  private tier = -1;
  private hunger = -1;
  private stolenAt = -1;
  private bustAt = -1;
  private ui = '';
  private bizOf = new Map<number, number>();
  // stuck: how long the walking keys have been held, and where that began
  private held = 0;
  private heldX = 0;
  private heldY = 0;
  private stuckAt: [number, number] | null = null;

  constructor(private w: World, seed: number, version: string) {
    const d = new Date();
    this.file = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}_seed${seed}`;
    w.city.businesses.forEach((b, k) => { if (!this.bizOf.has(b.building)) this.bizOf.set(b.building, k); });
    this.log('start', { seed, version, ua: navigator.userAgent, screen: [screen.width, screen.height, devicePixelRatio] });
    addEventListener('pagehide', () => this.flush(true));
    addEventListener('visibilitychange', () => { if (document.hidden) this.flush(true); });
  }

  /** The playtest server answers here (Electron, or Vite in development): false when nothing would keep the file. */
  static async available(): Promise<boolean> {
    try { return (await fetch('/playtest/ping')).ok; } catch { return false; }
  }

  log(k: string, data: Record<string, unknown> = {}) {
    this.buf.push(JSON.stringify({ k, rt: r1((performance.now() - this.t0) / 1000), gt: Math.round(this.w.time), ...data }));
  }

  /** What the player already has (a save just loaded, or the start) counts as seen, not as new. */
  prime(phone: PhoneLogs, continued: boolean) {
    const w = this.w;
    this.primed = true;
    for (const l of [phone.inbox, phone.sent, phone.log]) for (const o of l) this.seen.add(o);
    for (const it of w.bag.items) { this.seen.add(it); this.paid.set(it, it.paid); }
    this.lastItems = new Set(w.bag.items);
    this.ledger = w.bank.ledger.length;
    this.eventId = w.events.next;
    this.cash = w.player.cash;
    this.stolenAt = w.bag.stolenAt;
    this.bustAt = w.heat.bust?.at ?? -1;
    this.log('begin', { continued, cash: w.player.cash, bank: w.bank.balance, x: r1(w.player.x), y: r1(w.player.y) });
  }

  private place(b: number) {
    if (b < 0) return {};
    const k = this.bizOf.get(b);
    return k === undefined ? { b } : { b, biz: businessName(this.w.city, k), kind: this.w.city.businesses[k].kind };
  }

  /**
   * Every frame (cheap): what changed since the last one. ui names what has the player's hands
   * ('' walking; 'phone', 'laptop', 'counter', 'pause'...), moving whether the walking keys are held.
   */
  frame(dt: number, phone: PhoneLogs, yaw: number, pitch: number, ui: string, moving: boolean) {
    const w = this.w, p = w.player, now = (performance.now() - this.t0) / 1000;
    if (p.inside !== this.inside) { this.log('place', { from: this.inside, ...this.place(p.inside), x: r1(p.x), y: r1(p.y) }); this.inside = p.inside; }
    if (ui !== this.ui) { this.log('ui', { ui, was: this.ui }); this.ui = ui; }
    // the money: the bank's new entries, and the pocket's changes with where they happened
    const L = w.bank.ledger;
    for (; this.ledger < L.length; this.ledger++) {
      const E = L[this.ledger], biz = E.kind === 'card' && E.ref >= 0 && E.ref < w.city.businesses.length ? businessName(w.city, E.ref) : undefined;
      this.log('bank', { kind: E.kind, cents: E.amount, ref: E.ref, biz, balance: w.bank.balance });
    }
    if (p.cash !== this.cash) { this.log('cash', { cents: p.cash - this.cash, cash: p.cash, ui, ...this.place(p.inside) }); this.cash = p.cash; }
    // the bag: taken from a shelf, paid for, gone (eaten, left, dropped)
    const items = new Set<object>(w.bag.items);
    for (const it of w.bag.items) {
      if (!this.seen.has(it)) { this.seen.add(it); this.log('take', { good: it.good, cents: it.cents, paid: it.paid, ...this.place(w.city.businesses[it.shop]?.building ?? -1) }); }
      if (it.paid && this.paid.get(it) === false) this.log('buy', { good: it.good, cents: it.cents, ...this.place(w.city.businesses[it.shop]?.building ?? -1) });
      this.paid.set(it, it.paid);
    }
    for (const it of this.lastItems) if (!items.has(it)) this.log('drop', { good: (it as { good: string }).good });
    this.lastItems = items;
    if (w.bag.stolenAt !== this.stolenAt) { this.stolenAt = w.bag.stolenAt; this.log('theft', { items: w.bag.stolen }); }
    // the phone: texts in and out, calls
    for (const m of phone.inbox) if (!this.seen.has(m)) { this.seen.add(m); this.log('sms_in', m as Record<string, unknown>); }
    for (const m of phone.sent) if (!this.seen.has(m)) { this.seen.add(m); this.log('sms_out', m as Record<string, unknown>); }
    for (const c of phone.log) if (!this.seen.has(c)) { this.seen.add(c); this.log('call', c as Record<string, unknown>); }
    // the city's events, with how far from the player
    for (const E of w.events.list) if (E.id >= this.eventId) this.log('event', { kind: E.kind, x: r1(E.x), y: r1(E.y), d: Math.round(Math.hypot(E.x - p.x, E.y - p.y)), refs: E.refs.slice(0, 4) });
    this.eventId = w.events.next;
    // [HACKING] the heat, only its tier and the arrests (the API's numbers, nothing of how they are made)
    const tier = tierOf(w.heat);
    if (tier !== this.tier) { this.log('heat', { tier, points: Math.round(w.heat.points * 100) / 100 }); this.tier = tier; }
    if (w.heat.bust && w.heat.bust.at !== this.bustAt) { this.bustAt = w.heat.bust.at; this.log('bust', { fine: w.heat.bust.fine, lostPay: w.heat.bust.lostPay }); }
    const hs = hungerStage(w.needs.food);
    if (hs !== this.hunger) { this.log('hunger', { stage: hs }); this.hunger = hs; }
    // stuck: the walking keys held, the player hardly moving
    if (moving && !ui && p.liftTo < 0) {
      if (this.held === 0) { this.heldX = p.x; this.heldY = p.y; }
      this.held += dt;
      if (this.held > STUCK_S) {
        if (Math.hypot(p.x - this.heldX, p.y - this.heldY) < STUCK_M) {
          if (!this.stuckAt || Math.hypot(p.x - this.stuckAt[0], p.y - this.stuckAt[1]) > 3) { this.stuckAt = [p.x, p.y]; this.log('stuck', { x: r1(p.x), y: r1(p.y), floor: p.floor, ...this.place(p.inside), yaw: r1(yaw) }); }
        }
        this.held = 0;
      }
    } else this.held = 0;
    if (now - this.lastSample >= SAMPLE_S) {
      this.lastSample = now;
      this.buf.push(JSON.stringify({ k: 'pos', rt: r1(now), gt: Math.round(w.time), x: r1(p.x), y: r1(p.y), z: r1(p.z), f: p.floor, in: p.inside, sp: r1(p.speed), mv: moving ? 1 : 0, ui, yaw: r1(yaw), pitch: r1(pitch), cash: p.cash, bank: w.bank.balance }));
    }
    if (now - this.lastFlush >= FLUSH_S) { this.lastFlush = now; this.flush(); }
  }
  /** The bag's things at the last frame (to see what went). */
  private lastItems = new Set<object>();

  /** A note (F8): its text, where and when, and the screen's picture (a PNG data URL), kept beside the log. */
  note(text: string, png: string | null) {
    const w = this.w, p = w.player, img = png ? `${this.file}_note${++this.notes}.png` : null;
    if (png && img) void fetch(`/playtest/${img}`, { method: 'POST', body: png }).catch(() => {});
    this.log('note', { text, img, x: r1(p.x), y: r1(p.y), z: r1(p.z), floor: p.floor, ...this.place(p.inside) });
    this.flush();
  }

  flush(leaving = false) {
    if (!this.buf.length || !this.primed) return;
    const body = this.buf.join('\n') + '\n';
    this.buf = [];
    // keepalive lets the last lines out as the window closes (it takes up to 64 KB)
    void fetch(`/playtest/${this.file}.jsonl`, { method: 'POST', body, keepalive: leaving && body.length < 60000 }).catch(() => {});
  }
}

/**
 * The note's panel (F8): a text box over the paused game. Enter keeps it, Shift+Enter a new line, Esc throws it away.
 */
export class NotePanel {
  private el: HTMLDivElement;
  private box: HTMLTextAreaElement;
  private done: ((text: string | null) => void) | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'note';
    this.el.hidden = true;
    this.el.innerHTML = '<div class="panel"><h2>PLAYTEST NOTE</h2><textarea rows="5" spellcheck="false"></textarea><p class="note">ENTER SAVES (WITH POSITION, TIME AND A SCREENSHOT) · SHIFT+ENTER NEW LINE · ESC CANCELS</p></div>';
    document.body.appendChild(this.el);
    this.box = this.el.querySelector('textarea')!;
    for (const ev of ['mousedown', 'mouseup', 'click'] as const) this.el.addEventListener(ev, (e) => e.stopPropagation());
    this.box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.code === 'Escape') { e.preventDefault(); this.close(null); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.close(this.box.value.trim() || null); }
    });
  }

  get isOpen() { return !this.el.hidden; }

  open(done: (text: string | null) => void) {
    this.done = done;
    this.box.value = '';
    this.el.hidden = false;
    this.box.focus();
  }

  private close(text: string | null) {
    this.el.hidden = true;
    const d = this.done;
    this.done = null;
    d?.(text);
  }
}
