import { hash3 } from '../core/rng';
import { type City } from './city';
import { Doing, whereIs, type Population } from './citizens';
import { type EventLog, type SimEvent } from './events';
import { type PowerGrid } from './power';
import { type Weather } from './weather';

/**
 * The city's social network: what citizens post, from what really happens to them. Nothing is
 * made up apart from the sim (see CLAUDE.md, "Design: rede social da cidade"): a routine post comes
 * from where its author is now (at work, out at a bar, walking somewhere, home in the rain), and an
 * event post from someone who was there when it happened (a crash or a jam near them, the power
 * going out where they are). Only numbers are kept: the words are the locale's (social.en.json).
 * It all comes from the seed and the clock, so the same city and the same actions give the same feed.
 */
export type PostKind = 'home' | 'work' | 'walk' | 'out' | 'errand' | 'night' | 'rain' | 'snow' | 'crash' | 'jam' | 'blackout' | 'restored';

export interface Post {
  id: number;
  /** The citizen who posted it. */
  who: number;
  /** Game time it went up. */
  time: number;
  kind: PostKind;
  /** Picks the wording. */
  pick: number;
  /** Where: a business it is about (or -1), and the point (for the district name). */
  biz: number;
  x: number;
  y: number;
  /** The event it is about, or -1. */
  event: number;
}

export interface Feed {
  posts: Post[];
  next: number;
  /** The last event looked at; posts about events still waiting to go up (people take a while). */
  seen: number;
  pending: Post[];
}

export const newFeed = (): Feed => ({ posts: [], next: 0, seen: -1, pending: [] });

/** Posts kept; routine posts per game hour, at the busiest hour. */
const KEEP = 300, PER_HOUR = 40;
/** Share of the posting wanted at each hour of the day. */
const ACTIVE = [0.25, 0.15, 0.08, 0.05, 0.05, 0.1, 0.3, 0.6, 0.8, 0.7, 0.6, 0.7, 0.9, 0.8, 0.7, 0.7, 0.8, 0.9, 1, 1, 1, 0.9, 0.7, 0.45];
/** How far people notice an event (m), and at most how many post about one. */
const SEEN_R: Partial<Record<string, number>> = { crash: 120, jam: 180 };
const MAX_ABOUT: Record<string, number> = { crash: 2, jam: 1, blackout: 6, restored: 3 };

/** Whether someone can post now: old enough, a phone that can (the middle and top models), or at home (the family computer). */
function canPost(P: Population, i: number, d: Doing) {
  if (P.age[i] < 14 || d === Doing.Asleep) return false;
  return (P.phone[i] !== 255 && P.phone[i] % 3 > 0) || d === Doing.Home;
}

/** Where citizen i is, as a point: the building they are in, or along their way. */
function spot(P: Population, city: City, i: number, t: number): [number, number, Doing, number] {
  const W = whereIs(P, city, i, t), B = city.buildings[W.building];
  let x = (B.x0 + B.x1) / 2, y = (B.y0 + B.y1) / 2;
  if (W.doing === Doing.Walk) { const F = city.buildings[W.from]; x = (F.x0 + F.x1) / 2 + (x - (F.x0 + F.x1) / 2) * W.prog; y = (F.y0 + F.y1) / 2 + (y - (F.y0 + F.y1) / 2) * W.prog; }
  return [x, y, W.doing, W.doing === Doing.Walk ? -1 : W.building];
}

/**
 * Every 30 game seconds or so: a few routine posts by whoever feels like it (the talkative more
 * often), and, for each new event, the people around who saw it, posting a little later.
 */
export function stepSocial(F: Feed, P: Population, city: City, events: EventLog, power: PowerGrid, W: Weather, seed: number, t: number, dt: number) {
  if (!P.n) return;
  const slot = Math.floor(t / 30), h = (q: number) => hash3(seed ^ 0x50c1a1, slot, q);
  const hour = Math.floor((t / 3600) % 24);
  // routine posts: the expected number in this stretch, rounded by chance
  let want = (PER_HOUR * ACTIVE[hour] * dt) / 3600;
  for (let n = 0; want > 0 && n < 12; n++, want--) {
    if (want < 1 && h(n) >= want) break;
    for (let tries = 0; tries < 12; tries++) {
      const i = Math.floor(h(100 + n * 16 + tries) * P.n), W2 = whereIs(P, city, i, t), d = W2.doing;
      if (!canPost(P, i, d) || h(300 + n * 16 + tries) * 255 > P.talk[i]) continue;
      // most people are home most of the time; a post from out and about is the likelier one
      if (d === Doing.Home && hour >= 5 && h(400 + n * 16 + tries) < 0.6) continue;
      const [x, y] = spot(P, city, i, t);
      let kind: PostKind = d === Doing.Work ? 'work' : d === Doing.Walk ? 'walk' : d === Doing.Out ? 'out' : d === Doing.Errand ? 'errand' : 'home';
      if (hour < 5 && d === Doing.Home) kind = 'night';
      if (W.precip > 0.35 && h(500 + n) < 0.5) kind = W.snow ? 'snow' : 'rain';
      add(F, { id: 0, who: i, time: t, kind, pick: Math.floor(h(600 + n) * 1e6), biz: W2.biz, x, y, event: -1 });
      break;
    }
  }
  // events not yet looked at: who was there
  for (const e of events.list) {
    if (e.id <= F.seen) continue;
    F.seen = e.id;
    witnesses(F, P, city, power, e, seed);
  }
  // posts about events go up when their time comes
  for (let k = F.pending.length - 1; k >= 0; k--) if (F.pending[k].time <= t) add(F, F.pending.splice(k, 1)[0]);
}

function add(F: Feed, p: Post) {
  p.id = F.next++;
  F.posts.push(p);
  if (F.posts.length > KEEP) F.posts.splice(0, F.posts.length - KEEP);
}

/** The people who saw an event and post about it (a sample of the city, the talkative first), a few minutes after. */
function witnesses(F: Feed, P: Population, city: City, power: PowerGrid, e: SimEvent, seed: number) {
  const max = Math.round((MAX_ABOUT[e.kind] ?? 0) * (0.5 + e.weight));
  if (!max) return;
  const h = (q: number) => hash3(seed ^ 0x3e17, e.id, q), r = SEEN_R[e.kind];
  let found = 0;
  // a sample of everyone: near enough for a crash or a jam, on the substation that went out for the power
  for (let tries = 0; tries < 3000 && found < max; tries++) {
    const i = Math.floor(h(tries) * P.n), [x, y, d, b] = spot(P, city, i, e.time);
    if (!canPost(P, i, d) || h(5000 + tries) * 255 > P.talk[i] * 1.5) continue;
    if (r !== undefined ? Math.hypot(x - e.x, y - e.y) > r : b < 0 || power.building[b] !== e.refs[0]) continue;
    // a minute to half an hour of game time later
    F.pending.push({ id: 0, who: i, time: e.time + 60 + h(9000 + tries) * 1700, kind: e.kind as PostKind, pick: Math.floor(h(9500 + tries) * 1e6), biz: -1, x, y, event: e.id });
    found++;
  }
}

/** Likes a post has at time t: they come in over the first hours, more for someone with friends and for news. */
export function likes(P: Population, p: Post, t: number): number {
  const friends = P.friendAt[p.who + 1] - P.friendAt[p.who], age = Math.max(0, t - p.time);
  const top = friends * 1.5 + (p.event >= 0 ? 6 : 0) + hash3(p.id, p.who, 7) * 4;
  return Math.floor(top * (1 - Math.exp(-age / 2400)));
}
