import { hash3 } from '../core/rng';
import { businessName, districtName, roadName } from '../locale/names';
import C from '../locale/calls.json';
import en from '../locale/en.json';
import { districtAt } from '../sim/city';
import { calendar } from '../sim/clock';
import { BIZ_HOURS, isOpen, lookup, type Callee } from '../sim/telco';
import { type World } from '../sim/world';

/**
 * A phone call from the player's handset. The exchange routes the number (sim/telco.ts); the far
 * phone rings (the ringback every 6 s) and someone answers, or not: a business during its hours (a
 * person, or a menu of options for the bigger ones), its recording when closed, the people of a
 * home or their answering machine, the operator's line. The player has no voice in the game, so
 * whoever answers hears silence and says so. The words come from the locale (calls.json), picked by
 * the number, the hour and the call, so a call made twice the same hour goes the same way. Calls
 * cost credit by the started minute; 911 and the operator's line are free.
 */
export type Sfx = ['fail'] | ['stop'] | ['ringback'] | ['busy'] | ['intercept'] | ['click'] | ['beep'] | ['hold', number] | ['voice', number, number, boolean];
export interface Line { who: 'them' | 'rec' | 'sys'; text: string; at: number; dur: number }
type Step = { who: Line['who'] | 'act'; text: string; gap: number };

/** Cents per started minute, and for a directory request. */
const PER_MIN = 10, DIRECTORY = 149;
/** Rings before giving up on an unanswered number. */
const MAX_RINGS = 8;
const IVR_KINDS = ['bank', 'cinema', 'hotel'];

export class Call {
  state: 'dialing' | 'ringing' | 'talk' | 'ended' = 'dialing';
  /** Why it ended (shown on the screen). */
  reason = '';
  readonly lines: Line[] = [];
  readonly callee: Callee;
  connectAt = -1;
  endAt = -1;
  rings = 0;
  /** Listings a directory call sends by text, when it ends: [name, number]. */
  listings: [string, string][] = [];
  private q: Step[] = [];
  private nextAt = 0;
  private ringAt = 0;
  private answerAt = Infinity;
  private menu = '';
  private waitUntil = -1;
  private repeats = 0;
  private holdUntil = -1;
  private h: (q: number) => number;

  constructor(private world: World, readonly number: string, private start: number, noNetwork: boolean) {
    this.callee = lookup(world.telco, world.seed, number);
    const hour = Math.floor(world.time / 3600);
    this.h = (q) => hash3(world.seed ^ hour, number.length * 1000 + +number.replace(/\D/g, '').slice(-6), q);
    if (noNetwork && this.callee.kind !== 'emergency') { this.end(start, en.phone.apps.noNetwork); return; }
  }

  /** Advance the call; sounds to play go into `sfx`. */
  update(now: number, sfx: Sfx[]) {
    if (this.state === 'ended') return;
    if (this.state === 'dialing') {
      if (now < this.start + 1.5) return;
      const c = this.callee;
      if (c.kind === 'self' || (c.kind === 'biz' && isOpen(this.kindOf(), this.hour()) && this.h(1) < 0.08)) { sfx.push(['busy']); this.end(now, C.busy); return; }
      if (c.kind === 'none') {
        sfx.push(['intercept']);
        this.state = 'talk'; this.connectAt = now;
        this.q = [{ who: 'rec', text: C.notInService[0], gap: 1 }, { who: 'act', text: 'end', gap: 0.5 }];
        this.nextAt = now;
        return;
      }
      this.state = 'ringing'; this.ringAt = now;
      const n = this.ringsBefore();
      this.answerAt = n < 0 ? Infinity : now + (n - 1) * 6 + 3;
    }
    if (this.state === 'ringing') {
      if (now >= this.answerAt) { this.state = 'talk'; this.connectAt = now; this.q = this.script(); this.nextAt = now + 0.4; }
      else if (now >= this.ringAt) {
        if (this.rings >= MAX_RINGS) { this.end(now, en.phone.apps.noAnswer); return; }
        this.rings++; this.ringAt += 6; sfx.push(['ringback']);
        return;
      }
      else return;
    }
    // talking: the next line when its time has come; waiting for a key on a menu; on hold
    if (this.holdUntil >= 0) { if (now >= this.holdUntil) { this.holdUntil = now + 8; sfx.push(['hold', 8]); } return; }
    if (this.waitUntil >= 0) {
      if (now < this.waitUntil) return;
      this.waitUntil = -1;
      if (this.repeats++ < 1) this.q = this.menuSteps();
      else this.q = [{ who: 'rec', text: C.ivr.bye, gap: 0.5 }, { who: 'act', text: 'end', gap: 0.6 }];
    }
    if (!this.q.length || now < this.nextAt) return;
    const s = this.q.shift()!;
    if (s.who === 'act') {
      if (s.text === 'end') { sfx.push(['click']); this.end(now, en.phone.apps.callEnded); return; }
      if (s.text === 'beep') sfx.push(['beep']);
      if (s.text === 'wait') this.waitUntil = now + 8;
      if (s.text === 'hold') { this.holdUntil = now; }
      this.nextAt = now + 0.3 + (this.q[0]?.gap ?? 0);
      return;
    }
    const text = this.fill(s.text), dur = s.who === 'sys' ? 1.5 : Math.max(1.2, text.length * 0.065);
    this.lines.push({ who: s.who, text, at: now, dur });
    if (s.who !== 'sys') sfx.push(['voice', dur, 0.8 + this.h(9) * 0.5, s.who === 'rec']);
    this.nextAt = now + dur + (this.q[0]?.gap ?? 0);
  }

  /** A key pressed during the call: a choice on a menu. */
  key(k: string, now: number) {
    if (this.state !== 'talk' || !this.menu) return;
    const pick = this.choice(k);
    if (!pick) return;
    this.waitUntil = -1; this.q = pick; this.nextAt = now + 0.5;
  }

  /** Hang up (the player), or the far end did. */
  hangUp(now: number) { if (this.state !== 'ended') this.end(now, en.phone.apps.callEnded); }

  /** Seconds talked, and what the call costs in cents. */
  talked(now: number) { return this.connectAt < 0 ? 0 : (this.endAt >= 0 ? this.endAt : now) - this.connectAt; }
  cost(): number {
    const k = this.callee.kind;
    if (k === 'emergency' || k === 'operator' || this.connectAt < 0) return 0;
    return Math.ceil(this.talked(0) / 60) * PER_MIN + (k === 'directory' ? DIRECTORY : 0);
  }

  private end(now: number, why: string) { this.state = 'ended'; this.endAt = now; this.reason = why; this.q = []; this.holdUntil = -1; this.waitUntil = -1; }
  private hour() { return calendar(this.world.time).hour; }
  private kindOf() { const c = this.callee; return c.kind === 'biz' ? this.world.city.businesses[c.k].kind : ''; }
  private pick<T>(a: T[], q: number): T { return a[Math.floor(this.h(q) * a.length)]; }

  /** How many rings before someone picks up (-1: nobody does). */
  private ringsBefore(): number {
    const c = this.callee;
    if (c.kind === 'operator' || c.kind === 'emergency' || c.kind === 'directory') return 1;
    if (c.kind === 'biz') return isOpen(this.kindOf(), this.hour()) ? 1 + Math.floor(this.h(2) * 3) : 2 + Math.floor(this.h(2) * 3);
    return this.h(3) < 0.85 ? 2 + Math.floor(this.h(2) * 4) : -1;
  }

  /** What is said once the call is answered. */
  private script(): Step[] {
    const c = this.callee, them = (text: string, gap = 0.3): Step => ({ who: 'them', text, gap }), rec = (text: string, gap = 0.3): Step => ({ who: 'rec', text, gap });
    const end: Step = { who: 'act', text: 'end', gap: 0.8 };
    const silence = (): Step[] => {
      const s = [them(this.pick(C.silence, 10), 3)];
      if (this.h(11) < 0.5) s.push(them(this.pick(C.silence, 12), 2.5));
      s.push(them(this.pick(C.hangup, 13), 2), end);
      return s;
    };
    switch (c.kind) {
      case 'biz': {
        const kind = this.kindOf();
        if (!isOpen(kind, this.hour())) return [rec(this.pick(C.closed, 20)), end];
        if (IVR_KINDS.includes(kind)) { this.menu = kind; return this.menuSteps(true); }
        const G = C.greet as Record<string, string[]>, B = C.background as Record<string, string[]>;
        const steps = [them(this.pick([...(G[kind] ?? []), ...C.greet.generic], 21))];
        if (this.h(22) < 0.4) steps.push({ who: 'sys', text: this.pick([...(B[kind] ?? []), ...C.background.generic], 23), gap: 1 });
        return [...steps, ...silence()];
      }
      case 'res': {
        if (this.h(30) < 0.65) return [them(this.pick(C.res.hello, 31)), them(this.pick(C.res.who, 32), 3), them(this.pick(C.res.hangup, 33), 2.5), end];
        return [rec(this.pick(C.res.machine, 34)), { who: 'act', text: 'beep', gap: 0.2 }, { who: 'act', text: 'end', gap: 10 }];
      }
      case 'operator': this.menu = 'operator'; return this.menuSteps(true);
      case 'emergency': return [them(C.emergency[0])];
      case 'directory': this.listings = this.nearby(); return [rec(C.directory[0]), rec(C.directory[1], 1), end];
    }
    return [end];
  }

  /** A menu: the welcome (the first time), its options, then wait for a key. */
  private menuSteps(first = false): Step[] {
    const M = C.ivr.menu as Record<string, string[]>, s: Step[] = [];
    if (first) s.push({ who: 'rec', text: C.ivr.welcome, gap: 0.3 });
    for (const l of M[this.menu]) s.push({ who: 'rec', text: l, gap: 0.3 });
    s.push({ who: 'act', text: 'wait', gap: 0 });
    return s;
  }

  /** What a key does on the menu. */
  private choice(k: string): Step[] | null {
    const I = C.ivr, rec = (text: string): Step => ({ who: 'rec', text, gap: 0.4 }), bye: Step[] = [rec(I.bye), { who: 'act', text: 'end', gap: 0.6 }];
    const hold: Step[] = [rec(I.agent), { who: 'act', text: 'hold', gap: 0.3 }];
    switch (this.menu + k) {
      case 'bank1': case 'cinema2': return [rec(this.menu === 'bank' ? I.hours : I.address), ...bye];
      case 'cinema1': return [rec(I.showtimes), ...bye];
      case 'bank2': case 'bank0': case 'hotel1': case 'operator0': return hold;
      case 'hotel0': return [{ who: 'them', text: (C.greet.hotel)[0], gap: 0.4 }, { who: 'them', text: this.pick(C.silence, 40), gap: 3 }, { who: 'them', text: this.pick(C.hangup, 41), gap: 2.5 }, { who: 'act', text: 'end', gap: 0.6 }];
      case 'operator1': return [rec(I.balance), ...bye];
      case 'operator2': return [rec(I.dataInfo), ...bye];
    }
    return /^[0-9*#]$/.test(k) ? [rec(I.invalid), ...this.menuSteps()] : null;
  }

  /** The five businesses nearest the player, for directory assistance. */
  private nearby(): [string, string][] {
    const w = this.world, p = w.player, B = w.city.buildings;
    return w.city.businesses.map((b, k) => [k, Math.hypot((B[b.building].x0 + B[b.building].x1) / 2 - p.x, (B[b.building].y0 + B[b.building].y1) / 2 - p.y)] as const)
      .sort((a, b) => a[1] - b[1]).slice(0, 5).map(([k]) => [businessName(w.city, k), w.telco.bizNum[k]]);
  }

  /** The words' slots filled with what exists in the city. */
  private fill(s: string): string {
    const w = this.world, c = this.callee, hh = (h: number) => `${((h + 11) % 12) + 1} ${h % 24 < 12 ? 'am' : 'pm'}`;
    let biz = '', open = '', close = '', road = '', district = '';
    if (c.kind === 'biz') {
      const b = w.city.businesses[c.k], B = w.city.buildings[b.building], [a, z] = BIZ_HOURS[b.kind] ?? [9, 17];
      biz = businessName(w.city, c.k); open = hh(a); close = hh(z);
      const mx = (B.x0 + B.x1) / 2, my = (B.y0 + B.y1) / 2;
      district = districtName(w.city, districtAt(w.city, mx, my));
      road = roadName(w.city, this.h(50) < 0.5, Math.floor(this.h(51) * (w.city.xb.length / 2)));
    } else if (c.kind === 'operator') biz = en.phone.apps.care;
    const acc = w.telco.player;
    return s.replace('{biz}', biz).replace('{name}', this.pick(C.first, 60)).replace('{surname}', this.pick(en.surnames, 61))
      .replace('{open}', open).replace('{close}', close).replace('{road}', road).replace('{district}', district)
      .replace('{film}', this.pick(C.films, 62)).replace('{film2}', this.pick(C.films, 63)).replace('{t1}', hh(18 + Math.floor(this.h(64) * 2))).replace('{t2}', hh(20 + Math.floor(this.h(65) * 3)))
      .replace('{credit}', `$${(acc.credit / 100).toFixed(2)}`).replace('{data}', `${(acc.dataKB / 1024).toFixed(1)} MB`);
  }
}
