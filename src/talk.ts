/**
 * Talking to someone (14.2): what they answer to a line the player typed. The line is read
 * (sim/intent.ts), and the answer comes from the grammar (locale/text/replies.en.json) in the
 * speaker's voice (their age, their work, the hour), its slots filled from the simulation: a
 * price is the shop's price, a name is the clerk's, the way to a place is the real route. What
 * the game has no system for yet (favors, money, getting in somewhere) gets a polite no, so
 * nobody promises what will not happen.
 *
 * The register (nice, plain, rude) follows the player's tone, the person's warmth and what they
 * remember of the player; their patience runs down with every line, faster when pushed or not
 * understood, and they end the talk when it runs out. They remember the essential (met before,
 * how rude the player was, whether they told their name) in world.talks, kept in the save.
 */
import { hash3 } from './core/rng';
import { routeTo } from './askWay';
import { type BusinessKind } from './sim/city';
import { readLine, words, indexNames, type Entity, type EntityIndex, type IntentId, type Reading } from './sim/intent';
import { PLACES } from './sim/placeTypes';
import { type World } from './sim/world';
import { placeAt, placeName } from './phone/places';
import { businessName, citizenNames, landmarkName, roadName, workplaceName } from './locale/names';
import { expand, rngOf, tidy } from './locale/gen';
import { TEXT } from './locale/text';
import { selFor, voice } from './locale/voice';
import { Doing, whereIs } from './sim/citizens';
import { calendar } from './sim/clock';
import en from './locale/en.json';
import NAMES from './locale/text/names.en.json';

/** What someone remembers of the player: when they last talked (game time), how rude the player has been, whether they gave their name. */
export interface TalkMem { met: number; rude: number; name: boolean; /** They know the player's number (14.6); they have talked face to face. */ num?: boolean; face?: boolean }

type Style = 'nice' | 'plain' | 'rude';
/** Intentions with no system behind them yet: a polite no. */
const LATER = new Set<IntentId>(['ask_about_person', 'ask_what_saw', 'ask_event', 'ask_favor', 'borrow_money', 'offer_money', 'claim_identity', 'ask_entry', 'ask_phone', 'ask_wifi_password']);
/** Asking these twice gets "I just told you". */
const FACTS = new Set<IntentId>(['ask_time', 'ask_name', 'ask_job', 'ask_who_works_here', 'ask_price', 'ask_where', 'ask_directions']);
const KINDS = Object.keys(en.phone.find.kinds) as BusinessKind[];
const GOODS = Object.keys(en.goods);

/** One conversation: with whom, where, what was asked, how much patience is left. */
export class Talk {
  readonly said: string[] = [];
  patience: number;
  over = false;
  /** Met before this talk (for "you again"). */
  readonly met: boolean;
  /** `sms`: by text message (14.6) or on the phone (14.7), where they cannot see where the player is. */
  constructor(private w: World, readonly who: number, readonly biz: number, readonly sms = false) {
    const warm = w.pop.social[who] / 255, mem = w.talks.get(who);
    this.met = !!mem;
    this.patience = 6 + Math.round(warm * 4) + (biz >= 0 ? 4 : 0) - (mem?.rude ?? 0);
  }
  get mem(): TalkMem {
    let m = this.w.talks.get(this.who);
    if (!m) this.w.talks.set(this.who, (m = { met: this.w.time, rude: 0, name: false }));
    return m;
  }
}

export interface Answer {
  text: string;
  reading: Reading;
  /** The talk is over (they said goodbye, or lost patience). */
  end: boolean;
  /** Open the counter (to pay or order). */
  counter?: boolean;
  /** Which way they point, for a route. */
  point?: [number, number];
}

const indexes = new WeakMap<object, EntityIndex>();
/** The names of the city the player may type: its businesses and landmarks, the kinds of place, its streets, the goods. */
export function cityNames(w: World): EntityIndex {
  const c = w.city;
  let I = indexes.get(c);
  if (I) return I;
  const L: Entity[] = [];
  const add = (name: string, kind: Entity['kind'], id: number) => { const ws = words(name).filter((x) => x !== '?' && x !== '!'); if (ws.length) L.push({ words: ws, kind, id }); };
  c.businesses.forEach((_, k) => add(businessName(c, k), 'place', k));
  c.landmarks.forEach((_, k) => add(landmarkName(c, k), 'place', -k - 1));
  const kinds = en.phone.find.kinds as Record<string, string>, also = en.phone.find.also as Record<string, string>;
  KINDS.forEach((k, n) => { add(kinds[k], 'kind', n); for (const x of words(also[k] ?? '')) add(x, 'kind', n); add(k, 'kind', n); });
  for (let i = 0; i < c.xb.length / 2; i++) add(roadName(c, true, i), 'street', i);
  for (let j = 0; j < c.yb.length / 2; j++) add(roadName(c, false, j), 'street', -j - 1);
  GOODS.forEach((g, n) => { add((en.goods as Record<string, string>)[g], 'thing', n); add(g.replace(/_/g, ' '), 'thing', n); });
  I = indexNames(L);
  indexes.set(c, I);
  return I;
}

/** The time as one says it: "9:40", "noon". */
function sayTime(t: number): string {
  const c = calendar(t), h = Math.floor(c.hour), m = Math.floor((c.hour - h) * 60);
  if (m === 0 && h === 12) return 'noon';
  if (m === 0 && h === 0) return 'midnight';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
}
const dollars = (cents: number) => (cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100));

/** The player says `line` in talk T: what the other answers. */
export function reply(w: World, T: Talk, line: string): Answer {
  const P = w.pop, c = w.city, who = T.who, me = w.player, W = w.weather;
  const R = readLine(line, cityNames(w)), mem = T.mem;
  const r = rngOf(who, T.said.length, Math.floor(w.time));
  // the register: the player's tone, the person's warmth, what they remember; a clerk at work stays civil
  const warm = P.social[who] / 255;
  let st = R.respect >= 1 ? 2 : R.respect <= -1 ? 0 : 1;
  if (st === 1 && warm > 0.75 && R.pressure < 2) st = 2;
  if (warm < 0.3 && R.pressure >= 2) st--;
  if (mem.rude >= 2) st--;
  if (T.biz >= 0 && st < 1 && R.respect > -1) st = 1;
  const style: Style = st >= 2 ? 'nice' : st <= 0 ? 'rude' : 'plain';
  if (R.respect <= -1) mem.rude++;
  // patience: every line costs some, more when pushed, rude or not understood
  T.patience -= 1 + (R.intent === 'unrecognized' ? 1 : 0) + (R.pressure >= 2 ? 1 : 0) + (R.respect <= -1 ? 1 : 0);
  const tags = [...(T.met ? ['met'] : []), ...(mem.rude >= 2 ? ['wasrude'] : []), ...(T.biz >= 0 ? ['atwork'] : [])];
  const sel = selFor(P, who, w.time, W.temp, W.precip, W.snow, tags);
  // (spoken: no typing habits, so not voice())
  const say = (key: string, ctx: Record<string, string> = {}) => tidy(expand(`#${key}#`, TEXT, r, { first: citizenNames(c, P, who)[0], ...ctx }, sel));
  const done = (text: string, extra: Partial<Answer> = {}): Answer => {
    mem.met = w.time;
    if (!T.sms) mem.face = true;
    if (T.patience <= 0 && !extra.end) { text += ' ' + say('reply.leave'); extra.end = true; }
    if (extra.end) T.over = true;
    return { text, reading: R, end: !!extra.end, ...extra };
  };
  if (T.over) return done('', { end: true });
  // the same thing asked again
  const key = `${R.intent}:${R.slots.place?.id ?? ''}:${R.slots.kind?.id ?? ''}:${R.slots.thing?.id ?? ''}:${R.slots.street?.id ?? ''}`;
  const again = FACTS.has(R.intent) && T.said.includes(key);
  T.said.push(key);
  if (again) return done(say('reply.again'));
  const kind = T.biz >= 0 ? c.businesses[T.biz].kind : null;
  const ws = words(line), you = ws.includes('you') || ws.includes('your');
  switch (R.intent) {
    case 'goodbye': return done(say(`reply.goodbye.${style}`), { end: true });
    case 'threaten': mem.rude += 2; return done(say(`reply.threaten.${style}`), { end: true });
    case 'ask_time': return done(say(`reply.ask_time.${style}`, { time: sayTime(w.time) }));
    case 'ask_age': return done(say(`reply.ask_age.${style}`, { age: String(P.age[who]) }));
    case 'ask_name': mem.name = true; return done(say(`reply.ask_name.${style}`, T.biz >= 0 ? { biz: businessName(c, T.biz) } : {}));
    case 'ask_job':
      if (P.job[who] < 0) return done(say('reply.nojob'));
      return done(say(`reply.ask_job.${style}`, { biz: workplaceName(c, P, P.job[who]) }));
    case 'ask_who_works_here': {
      if (T.biz < 0) return done(say(`reply.deflect.${style}`));
      const staff = P.job[who] >= 0 ? P.workplaces[P.job[who]].staff.filter((i) => i !== who) : [];
      if (!staff.length) return done(say('reply.justme'));
      return done(say(`reply.ask_who_works_here.${style}`, { first: citizenNames(c, P, staff[Math.floor(hash3(who, T.biz, 77) * staff.length)])[0] }));
    }
    case 'ask_price': case 'buy_request': {
      if (!kind) return done(say(`reply.deflect.${style}`));
      // the good named, or one sold here whose name has the words typed ("coffee" at a café is its drip coffee)
      const G = en.goods as Record<string, string>, typed = R.slots.thing?.words;
      const g = R.slots.thing ? GOODS[R.slots.thing.id] : null;
      const sold = g ? PLACES[kind].sells.find(([s]) => s === g) ?? PLACES[kind].sells.find(([s]) => typed!.every((x) => words(G[s] ?? s.replace(/_/g, ' ')).includes(x))) : null;
      const thing = sold ? (G[sold[0]] ?? sold[0]).toLowerCase() : g ? G[g].toLowerCase() : '';
      if (g && !sold) return done(say('reply.notsold', { thing }));
      if (R.intent === 'ask_price') return sold ? done(say(`reply.ask_price.${style}`, { number: dollars(sold[1]), thing })) : done(say('reply.whatthing'));
      // to buy: made to order at the counter, else it is on the shelves
      if (!sold && (ws.includes('pay') || /check ?out|ring (me|this|it) up/.test(ws.join(' ')))) return done(say('reply.pay'), { counter: true });
      if (PLACES[kind].order) return done(say('reply.order'), { counter: true });
      if (sold) return done(say('reply.onshelf', { thing }));
      return done(say(`reply.buy_request.${style}`), { counter: true });
    }
    case 'ask_where': case 'ask_directions': {
      // by text they do not know where the player is
      if (T.sms) return done(say(`reply.sms.where.${style}`));
      const S = R.slots;
      // "where do you live?": about them, not a place to go
      if (you && !S.place && !S.kind && !S.street && ws.some((x) => ['live', 'from', 'home', 'house', 'stay', 'apartment'].includes(x))) return done(say(`reply.personal.${style}`));
      let pl: number | null = null, to: [number, number] | undefined;
      if (S.place) pl = S.place.id;
      else if (S.kind) {
        let bd = Infinity;
        c.businesses.forEach((b, n) => { if (b.kind !== KINDS[S.kind!.id]) return; const [x, y] = placeAt(c, n), d = Math.hypot(x - me.x, y - me.y); if (d < bd) { bd = d; pl = n; } });
      } else if (S.street) {
        const id = S.street.id;
        to = id >= 0 ? [(c.xb[2 * id] + c.xb[2 * id + 1]) / 2, me.y] : [me.x, (c.yb[-2 * id - 2] + c.yb[-2 * id - 1]) / 2];
      } else return done(say('reply.whatplace'));
      if (pl === null && !to) return done(say('dir.dunno'));
      const D = routeTo(w, who, pl, me.x, me.y, to);
      if (S.street) D.ctx.road = roadName(c, S.street.id >= 0, S.street.id >= 0 ? S.street.id : -S.street.id - 1);
      return done(say(D.key, { ...D.ctx, place: pl === null ? (S.street ? roadName(c, S.street.id >= 0, S.street.id >= 0 ? S.street.id : -S.street.id - 1) : '') : placeName(c, pl) }), { point: [D.px, D.py] });
    }
    case 'unrecognized': return done(say(`reply.unrecognized.${style}`));
    default:
      if (LATER.has(R.intent)) return done(say(`reply.deflect.${style}`));
      return done(say(`reply.${R.intent}.${style}`));
  }
}

/**
 * A text message to citizen T.who (14.6), or a line said on the phone (14.7, `typed` false), read like
 * a line said face to face (the same intents, the same answers); a text written as they type (voice()). A number they do not know gets "who is this?" to a bare greeting,
 * and saying who it is only works on someone who has met the player; at work some say so first.
 * Null: no answer (they are tired of the talk).
 */
export function smsReply(w: World, T: Talk, text: string, typed = true): string | null {
  if (T.over) return null;
  const P = w.pop, who = T.who, mem = T.mem, R = readLine(text, cityNames(w)), r = rngOf(who, T.said.length + 77, Math.floor(w.time));
  const W = w.weather, sel = selFor(P, who, w.time, W.temp, W.precip, W.snow, T.met ? ['met'] : []);
  // (who they take the texter for, in "Is this {other}?")
  const N = r() < 0.5 ? NAMES.female.mid : NAMES.male.mid;
  const say = (key: string) => tidy(expand(`#${key}#`, TEXT, r, { first: citizenNames(w.city, P, who)[0], other: N[Math.floor(r() * N.length)] }, sel));
  const tire = () => { if (--T.patience <= 0) T.over = true; };
  let s: string;
  if (R.intent === 'claim_identity' || /\b(it'?s me|this is|remember me|we (met|talked|spoke))\b/i.test(text)) {
    // "it's me, from the shop": only someone who has met the player places them
    const known = !!mem.face;
    s = say(known ? 'reply.sms.knowyou' : 'reply.sms.dontknow');
    if (known) mem.num = true;
    T.said.push('claim'); tire();
  } else if (!mem.num && (R.intent === 'greet' || R.intent === 'unrecognized' || R.banter)) {
    s = say('sms.res');
    T.said.push('who'); tire();
  } else {
    s = reply(w, T, text).text;
    if (!s) return null;
    if (typed && whereIs(P, w.city, who, w.time).doing === Doing.Work && r() < 0.4) s = say('reply.sms.atwork') + ' ' + s;
  }
  return typed ? voice(s, P, who, r) : s;
}
