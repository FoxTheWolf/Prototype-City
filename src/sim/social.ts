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

/**
 * How the author feels about it: the wording follows (a happy post is made of happy pieces).
 * Picked from what happened (a jam annoys, snow excites), the hour and the day, the weather, and the
 * author's temper (some are sunny, some grumble). The names are the locale's keys, in this order.
 */
export enum Mood { Happy, Excited, Calm, Bored, Tired, Sad, Annoyed, Worried, Playful }
export const MOOD_N = 9;
//                                        happy exc  calm  bored tired sad  annoy worry play
const MOOD_W: Record<PostKind, number[]> = {
  home:     [2,   0.5, 3,   2,   2,   0.6, 0.7, 0.3, 1.2],
  work:     [1.5, 0.6, 0.8, 3,   3,   0.5, 2,   1,   1],
  walk:     [2,   0.5, 2.5, 0.5, 1,   0.4, 1,   0.3, 1],
  out:      [3,   3,   1,   0.2, 0.5, 0.2, 0.5, 0,   2],
  errand:   [1,   0.2, 1.5, 2,   0.6, 0.2, 2,   0.2, 1],
  night:    [0.4, 0.2, 2,   1,   3,   1.5, 0.4, 1.5, 0.6],
  rain:     [0.8, 0.2, 2.5, 0.6, 0.8, 1.5, 2,   0.2, 1],
  snow:     [2.5, 3,   1,   0.2, 0.3, 0.2, 1.2, 0.2, 1],
  crash:    [0,   0,   0,   0,   0,   1.5, 1.5, 4,   0],
  jam:      [0,   0,   0,   2,   1,   0,   4,   0.2, 1],
  blackout: [0,   1.5, 0.5, 0,   0,   0,   2,   3,   1.2],
  restored: [3,   0.5, 1.5, 0,   0,   0,   0.5, 0,   1.5],
};
/** Kinds a phone camera can take a picture of (outdoors, or of what happened). */
const PHOTO_KINDS = new Set<PostKind>(['walk', 'out', 'errand', 'rain', 'snow', 'crash', 'jam', 'blackout', 'restored']);

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
  mood: Mood;
  /** A picture goes with it (taken on the author's phone, where they were). */
  photo: boolean;
}

/** A comment under a post: a friend of the author (mostly), when, how they take it, the wording's pick. */
export interface Comment { who: number; time: number; mood: Mood; pick: number }

export interface Feed {
  posts: Post[];
  next: number;
  /** The last event looked at; posts about events still waiting to go up (people take a while). */
  seen: number;
  pending: Post[];
}

export const newFeed = (): Feed => ({ posts: [], next: 0, seen: -1, pending: [] });

/** Posts kept; routine posts per game hour, at the busiest hour. */
const KEEP = 300, PER_HOUR = 70;
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
    for (let tries = 0; tries < 30; tries++) {
      const i = Math.floor(h(100 + n * 16 + tries) * P.n), W2 = whereIs(P, city, i, t), d = W2.doing;
      if (!canPost(P, i, d) || h(300 + n * 16 + tries) * 255 > P.talk[i]) continue;
      // most people are home most of the time; a post from out and about is the likelier one
      if (d === Doing.Home && hour >= 5 && h(400 + n * 16 + tries) < 0.6) continue;
      const [x, y] = spot(P, city, i, t);
      let kind: PostKind = d === Doing.Work ? 'work' : d === Doing.Walk ? 'walk' : d === Doing.Out ? 'out' : d === Doing.Errand ? 'errand' : 'home';
      if (hour < 5 && d === Doing.Home) kind = 'night';
      if (W.precip > 0.35 && h(500 + n) < 0.5) kind = W.snow ? 'snow' : 'rain';
      const pick = Math.floor(h(600 + n) * 1e6);
      add(F, { id: 0, who: i, time: t, kind, pick, biz: W2.biz, x, y, event: -1, mood: moodOf(P, i, kind, t, W, pick), photo: photoOf(P, i, kind, pick) });
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
  const h = (q: number) => hash3(seed ^ 0x3e17, e.id, q), r = SEEN_R[e.kind];
  // the city has a few crashes and jams a minute: only some get talked about
  if (!max || ((e.kind === 'crash' || e.kind === 'jam') && h(77) < 0.7)) return;
  let found = 0;
  // a sample of everyone: near enough for a crash or a jam, on the substation that went out for the power
  for (let tries = 0; tries < 3000 && found < max; tries++) {
    const i = Math.floor(h(tries) * P.n), [x, y, d, b] = spot(P, city, i, e.time);
    if (!canPost(P, i, d) || h(5000 + tries) * 255 > P.talk[i] * 1.5) continue;
    if (r !== undefined ? Math.hypot(x - e.x, y - e.y) > r : b < 0 || power.building[b] !== e.refs[0]) continue;
    // a minute to half an hour of game time later
    const kind = e.kind as PostKind, pick = Math.floor(h(9500 + tries) * 1e6);
    F.pending.push({ id: 0, who: i, time: e.time + 60 + h(9000 + tries) * 1700, kind, pick, biz: -1, x, y, event: e.id, mood: moodOf(P, i, kind, e.time, null, pick), photo: photoOf(P, i, kind, pick) });
    found++;
  }
}

/**
 * The mood of a post: the kind's weights, tired late at night, grumpier on Mondays and brighter on
 * Fridays, gloomier under rain, and the author's own temper (a mood they lean to, from their id).
 */
function moodOf(P: Population, i: number, kind: PostKind, t: number, W: Weather | null, pick: number): Mood {
  const w = MOOD_W[kind].slice(), hour = (t / 3600) % 24, wd = (Math.floor(t / 86400) + 2) % 7; // 2008-01-01 was a Tuesday
  if (hour >= 23 || hour < 5) w[Mood.Tired] *= 1.6;
  if (wd === 1) { w[Mood.Annoyed] *= 1.4; w[Mood.Tired] *= 1.3; }
  if (wd === 5) { w[Mood.Happy] *= 1.4; w[Mood.Excited] *= 1.5; }
  if (W && W.precip > 0.3 && kind !== 'rain' && kind !== 'snow') { w[Mood.Sad] *= 1.3; w[Mood.Calm] *= 1.2; }
  const lean = Math.floor(hash3(i, 0x6d00d, 1) * MOOD_N);
  w[lean] *= 2.2;
  if (P.talk[i] > 180) w[Mood.Playful] *= 1.4;
  let tot = 0;
  for (const x of w) tot += x;
  let r = hash3(pick, i, 0x6d1) * tot;
  for (let m = 0; m < MOOD_N; m++) { r -= w[m]; if (r < 0) return m; }
  return Mood.Calm;
}

/** Whether a picture goes with the post: a phone with a camera (the middle and top models), more often for news. */
function photoOf(P: Population, i: number, kind: PostKind, pick: number): boolean {
  if (!PHOTO_KINDS.has(kind) || P.phone[i] === 255 || P.phone[i] % 3 === 0) return false;
  const news = kind === 'crash' || kind === 'jam' || kind === 'blackout';
  return hash3(pick, i, 0x9407) < (news ? 0.55 : 0.22);
}

/**
 * The comments under a post by time t: friends of the author (the talkative more often), each a
 * while after the post, more under news and under posts of people with many friends. Most take
 * the post as it was meant (a sad post gets kind words); some answer in their own mood.
 */
export function comments(P: Population, p: Post, t: number): Comment[] {
  const f0 = P.friendAt[p.who], nf = P.friendAt[p.who + 1] - f0, h = (q: number) => hash3(p.id ^ 0x3c3c, p.who, q);
  const most = Math.min(14, Math.floor(nf * 0.9 + (p.event >= 0 ? 3 : 0) + h(0) * 3.5 - 0.8));
  const out: Comment[] = [];
  for (let k = 0; k < most; k++) {
    const at = p.time + 120 + Math.pow(h(10 + k), 1.6) * 9000 + k * 240;
    if (at > t) continue;
    let who = nf ? P.friendList[f0 + Math.floor(h(30 + k) * nf)] : Math.floor(h(30 + k) * P.n);
    if (who === p.who) who = (who + 1) % P.n;
    // under news, the others are worried or take it the author's way; else now and then their own mood
    const own = p.event >= 0 ? Mood.Worried : Math.floor(h(60 + k) * MOOD_N);
    out.push({ who, time: at, mood: h(50 + k) < 0.8 ? p.mood : own, pick: Math.floor(h(70 + k) * 1e6) });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Likes a post has at time t: they come in over the first hours, more for someone with friends and for news. */
export function likes(P: Population, p: Post, t: number): number {
  const friends = P.friendAt[p.who + 1] - P.friendAt[p.who], age = Math.max(0, t - p.time);
  const top = friends * 1.5 + (p.event >= 0 ? 6 : 0) + hash3(p.id, p.who, 7) * 4;
  return Math.floor(top * (1 - Math.exp(-age / 2400)));
}
