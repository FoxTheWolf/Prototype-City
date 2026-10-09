import { hash3 } from '../core/rng';
import { businessName, citizenNames, districtName, roadName } from '../locale/names';
import { Doing, whereIs } from '../sim/citizens';
import C from '../locale/calls.json';
import en from '../locale/en.json';
import { districtAt } from '../sim/city';
import { BIZ_HOURS, isOpen, lookup, type Callee } from '../sim/telco';
import { type World } from '../sim/world';
import { expand, pickW, rngOf, selOf, type Grammar, type Sel } from '../locale/gen';
import { TEXT } from '../locale/text';
import { momentTags, selFor } from '../locale/voice';

/** The pieces the call's lines are put together from (calls.json's own lists, and the city's words). */
const CALLG: Grammar[] = [C as unknown as Grammar, TEXT];

/**
 * A phone call from the player's handset. The exchange routes the number (sim/telco.ts); the far
 * phone rings (the ringback every 6 s) and someone answers, or not: a business during its hours (a
 * person, or a menu of options for the bigger ones), its recording when closed, the people of a
 * home or their answering machine, the operator's line. The player has no voice in the game, so
 * whoever answers hears silence and says so. The words come from the locale (calls.json), picked by
 * the number, the hour and the call, so a call made twice the same hour goes the same way. A home
 * or a mobile rings where its citizens are (see citizens.ts): someone awake at home picks up the
 * landline, a mobile is answered at work, out or at home, rarely in the middle of the night. Calls
 * cost credit by the started minute; 911 and the operator's line are free.
 */
export type Sfx = ['bell', number] | ['shutter'] | ['fail'] | ['stop'] | ['sms'] | ['sent'] | ['hook'] | ['coin'] | ['coins'] | ['ringback'] | ['busy'] | ['intercept'] | ['click'] | ['rail', boolean] | ['beep'] | ['hold', number] | ['voice', number, number, boolean];
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
  /** The citizen who picks up (a home's or a mobile's), or -1; and how they are when they do. */
  private who = -1;
  /** A call to the player: the citizen calling (a wrong number), or -1. */
  caller = -1;
  /** Citizens who called the player by mistake (calling them back, they say so). */
  static calledUs = new Set<number>();
  private mood: 'hello' | 'work' | 'out' | 'sleepy' | 'machine' = 'hello';
  /** A conversation (14.7): the citizen who picked up and said hello, waiting for what the player says (main opens the talk); -1 none. */
  chatWith = -1;
  private heardAt = -1;
  private nudged = false;
  /** Calls and texts from the player to this number lately (this one included): from 3 they are annoyed, from 6 they stop answering. */
  pester = 0;

  /** landline: made from a payphone (the player's own mobile number then rings the handset in the pocket). */
  constructor(private world: World, readonly number: string, private start: number, noNetwork: boolean, readonly landline = false) {
    this.callee = lookup(world.telco, number);
    const hour = Math.floor(world.time / 3600);
    this.h = (q) => hash3(world.seed ^ hour, number.length * 1000 + +number.replace(/\D/g, '').slice(-6), q);
    if (noNetwork && this.callee.kind !== 'emergency') { this.end(start, en.phone.apps.noNetwork); return; }
  }

  /** A citizen dialing the player's number by mistake: it rings in the pocket until answered or they give up. */
  static from(world: World, i: number, now: number): Call {
    const c = new Call(world, world.pop.mobile[i], now, false, true);
    c.caller = i; c.who = i; c.state = 'ringing'; c.ringAt = now; c.answerAt = Infinity;
    Call.calledUs.add(i);
    return c;
  }

  /** Advance the call; sounds to play go into `sfx`. */
  update(now: number, sfx: Sfx[]) {
    if (this.state === 'ended') return;
    if (this.state === 'dialing') {
      if (now < this.start + 1.5) return;
      const c = this.callee;
      if ((c.kind === 'self' && !this.landline) || (c.kind === 'biz' && isOpen(this.kindOf(), this.world.time) && this.h(1) < 0.08)) { sfx.push(['busy']); this.end(now, C.busy); return; }
      if (c.kind === 'none') {
        sfx.push(['intercept']);
        this.state = 'talk'; this.connectAt = now;
        this.q = [{ who: 'rec', text: C.notInService[0], gap: 1 }, { who: 'act', text: 'end', gap: 0.5 }];
        this.nextAt = now;
        return;
      }
      this.state = 'ringing'; this.ringAt = now;
      const n = this.ringsBefore();
      // the player's own mobile, called from a payphone: only the player can pick it up
      this.answerAt = c.kind === 'self' ? Infinity : n < 0 ? Infinity : now + (n - 1) * 6 + 3;
    }
    if (this.state === 'ringing') {
      if (now >= this.answerAt) { this.state = 'talk'; this.connectAt = now; this.q = this.script(); this.nextAt = now + 0.4; }
      else if (now >= this.ringAt) {
        if (this.rings >= (this.caller >= 0 ? 5 : MAX_RINGS)) { this.end(now, en.phone.apps.noAnswer); return; }
        this.rings++; this.ringAt += 6; sfx.push(['ringback']);
        // a payphone being called rings out on its street
        if (this.callee.kind === 'payphone') sfx.push(['bell', this.callee.k]);
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
    // in a conversation, silence: "Hello? Are you there?", then they hang up
    if (this.chatWith >= 0 && !this.q.length && now >= this.nextAt) {
      if (this.heardAt < 0) this.heardAt = now;
      if (now - this.heardAt > 10) {
        this.q = this.nudged ? [{ who: 'them', text: this.pick(C.res.hangup, 41), gap: 0 }, { who: 'act', text: 'end', gap: 0.8 }] : [{ who: 'them', text: this.pick(C.silence, 40), gap: 0 }];
        this.nudged = true; this.heardAt = now;
      }
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

  /** Answered at the other end by the player (a payphone they picked up): the line between their two phones. */
  answerHere(now: number) {
    if (this.state !== 'ringing') return;
    this.state = 'talk'; this.connectAt = now;
    this.q = this.caller >= 0
      ? [{ who: 'them', text: this.pick(C.wrong.ask, 70), gap: 0.4 }, { who: 'them', text: this.pick(C.res.who, 71), gap: 3 }, { who: 'them', text: this.pick(C.wrong.sorry, 72), gap: 2 }, { who: 'act', text: 'end', gap: 0.8 }]
      : [{ who: 'sys', text: C.selfLine, gap: 0.5 }];
    this.nextAt = now;
  }

  /** The far phone cannot take the call (the mobile out of service, or already on a call). */
  refuse(now: number, why: string, sfx: Sfx[]) { if (this.state === 'ringing') { sfx.push(['busy']); this.end(now, why); } }

  /** Hang up (the player), or the far end did. */
  hangUp(now: number) { if (this.state !== 'ended') this.end(now, en.phone.apps.callEnded); }

  /** The player said something in the conversation (14.7): they answer `text`, and hang up after it when `last`. */
  answer(text: string, now: number, last: boolean) {
    if (this.state !== 'talk') return;
    this.heardAt = now + text.length * 0.065; this.nudged = false;
    this.q = [{ who: 'them', text, gap: 0 }, ...(last ? [{ who: 'act' as const, text: 'end', gap: 1.2 }] : [])];
    this.nextAt = now + 0.5;
  }

  /** Seconds talked, and what the call costs in cents. */
  talked(now: number) { return this.connectAt < 0 ? 0 : (this.endAt >= 0 ? this.endAt : now) - this.connectAt; }
  cost(): number {
    const k = this.callee.kind;
    if (k === 'emergency' || k === 'operator' || this.connectAt < 0) return 0;
    return Math.ceil(this.talked(0) / 60) * PER_MIN + (k === 'directory' ? DIRECTORY : 0);
  }

  private end(now: number, why: string) { this.state = 'ended'; this.endAt = now; this.reason = why; this.q = []; this.holdUntil = -1; this.waitUntil = -1; }
  private kindOf() { const c = this.callee; return c.kind === 'biz' ? this.world.city.businesses[c.k].kind : ''; }
  /**
   * A line from a list, put together by the text grammar (see locale/gen.ts): pieces fit for who is
   * speaking (their age, family, the hour) and the slots inside it filled; the same call, the same words.
   */
  private pick(a: string[], q: number): string {
    const r = rngOf(Math.floor(this.h(q) * 2147483647), q, 0xca11), sel = this.sel();
    return expand(pickW(a, r, sel), CALLG, r, {}, sel);
  }
  private selCache: Sel | null = null;
  private sel(): Sel {
    if (this.selCache) return this.selCache;
    const w = this.world;
    if (this.who >= 0) return (this.selCache = selFor(w.pop, this.who, w.time, w.weather.temp, w.weather.precip, w.weather.snow));
    return selOf(momentTags(w.time, w.weather.temp, w.weather.precip, w.weather.snow), 0);
  }

  /** How many rings before someone picks up (-1: nobody does). */
  private ringsBefore(): number {
    const c = this.callee;
    if (c.kind === 'operator' || c.kind === 'emergency' || c.kind === 'directory') return 1;
    if (c.kind === 'payphone') {
      // someone walking by may pick it up
      const ph = this.world.telco.payphones[c.k];
      let best = 12;
      for (const p of this.world.peds) { const d = Math.hypot(p.x - ph.x, p.y - ph.y); if (d < best) { best = d; this.who = p.id; } }
      return this.who >= 0 && this.h(5) < 0.7 ? 3 + Math.floor(this.h(2) * 3) : -1;
    }
    if (c.kind === 'biz') return isOpen(this.kindOf(), this.world.time) ? 1 + Math.floor(this.h(2) * 3) : 2 + Math.floor(this.h(2) * 3);
    if (c.kind === 'home' || c.kind === 'cell') return this.pickUp();
    return -1;
  }

  /**
   * Who answers a citizen's phone, from where its people are now: for a home, the first grown-up
   * awake there (a sleeper after many rings, now and then), else its answering machine; for a mobile,
   * its owner unless asleep (or busy, now and then), else the voicemail.
   */
  private pickUp(): number {
    const w = this.world, P = w.pop, c = this.callee, t = w.time;
    if (c.kind === 'home') {
      const H = P.households[c.h];
      let sleeper = -1;
      for (let k = 0; k < H.n; k++) {
        const i = H.m0 + k, d = whereIs(P, w.city, i, t).doing;
        if (P.age[i] < 10) continue;
        // called too often, nobody at home picks it up any more (the machine does, if there is one)
        if (d === Doing.Home && this.pester < 6) { this.who = i; this.mood = 'hello'; return 2 + Math.floor(this.h(2) * 3); }
        if (d === Doing.Asleep && sleeper < 0 && P.age[i] >= 18) sleeper = i;
      }
      if (this.pester < 6 && sleeper >= 0 && this.h(4) < 0.3) { this.who = sleeper; this.mood = 'sleepy'; return 5 + Math.floor(this.h(2) * 2); }
      if (!H.machine) return -1;
      this.who = H.m0; this.mood = 'machine';
      return 4;
    }
    if (c.kind !== 'cell') return -1;
    const i = c.i, d = whereIs(P, w.city, i, t).doing, r = this.h(4);
    this.who = i;
    // called too often: they send it to the voicemail after a ring or two
    if (this.pester >= 6) { this.mood = 'machine'; return 2; }
    const answers = d === Doing.Asleep ? r < 0.12 : d === Doing.Work ? r < 0.5 : d === Doing.Out ? r < 0.65 : r < 0.85;
    if (!answers) { this.mood = 'machine'; return 5; }
    this.mood = d === Doing.Asleep ? 'sleepy' : d === Doing.Work ? 'work' : d === Doing.Out ? 'out' : 'hello';
    return d === Doing.Asleep ? 5 : 1 + Math.floor(this.h(2) * 3);
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
        if (!isOpen(kind, this.world.time)) return [rec(this.pick(C.closed, 20)), end];
        if (IVR_KINDS.includes(kind)) { this.menu = kind; return this.menuSteps(true); }
        const G = C.greet as Record<string, string[]>, B = C.background as Record<string, string[]>;
        const steps = [them(this.pick([...(G[kind] ?? []), ...C.greet.generic], 21))];
        if (this.h(22) < 0.4) steps.push({ who: 'sys', text: this.pick([...(B[kind] ?? []), ...C.background.generic], 23), gap: 1 });
        return [...steps, ...silence()];
      }
      case 'home': case 'cell': {
        const L = c.kind === 'home' ? C.res : C.cell;
        if (this.mood === 'machine') {
          return [rec(c.kind === 'home' ? this.pick(C.res.machine, 34) : this.pick(C.cell.voicemail, 34)), { who: 'act', text: 'beep', gap: 0.2 }, { who: 'act', text: 'end', gap: 10 }];
        }
        if (c.kind === 'cell' && Call.calledUs.has(c.i) && this.mood !== 'sleepy') return [them(this.pick(C.wrong.back, 31)), them(this.pick(C.res.hangup, 33), 2.5), end];
        // called again and again: they say so, and hang up
        if (this.pester >= 3) return [them(this.pick(C.pester.first, 38)), them(this.pick(C.pester.stop, 39), 1.5), end];
        const first = this.mood === 'hello' ? this.pick(L.hello, 31) : this.pick((C.cell as Record<string, string[]>)[this.mood] ?? L.hello, 31);
        // then they wait for the player to speak: the talk at the bottom of the screen (14.7)
        this.chatWith = this.who;
        return [them(this.mood === 'sleepy' && c.kind === 'home' ? this.pick(C.res.sleepy, 31) : first)];
      }
      case 'payphone': return [them(this.pick(C.payphone.hello, 35)), them(this.pick(C.payphone.who, 36), 3), them(this.pick(C.payphone.bye, 37), 2.5), end];
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
    const [name, surname] = this.who >= 0 ? citizenNames(w.city, w.pop, this.who) : [this.pick(C.first, 60), this.pick(en.surnames, 61)];
    return s.replace('{biz}', biz).replace('{name}', name).replace('{surname}', surname).replace('{other}', this.pick(C.first, 66))
      .replace('{open}', open).replace('{close}', close).replace('{road}', road).replace('{district}', district)
      .replace('{film}', this.pick(C.films, 62)).replace('{film2}', this.pick(C.films, 63)).replace('{t1}', hh(18 + Math.floor(this.h(64) * 2))).replace('{t2}', hh(20 + Math.floor(this.h(65) * 3)))
      .replace('{credit}', `$${(acc.credit / 100).toFixed(2)}`).replace('{data}', `${(acc.dataKB / 1024).toFixed(1)} MB`);
  }
}
