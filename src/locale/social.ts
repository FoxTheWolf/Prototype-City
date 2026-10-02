import { type Rng } from '../core/rng';
import { districtAt, type City } from '../sim/city';
import { Role, type Population } from '../sim/citizens';
import { type Comment, type Post } from '../sim/social';
import { businessName, cityName, citizenNames, districtName, workplaceName } from './names';
import { cap, expand, Fresh, pickW, rngOf, tidy, type Ctx, type Grammar } from './gen';
import { lifeCtx, selFor, usesSmileys, voice } from './voice';
import { forecast, newWeather } from '../sim/weather';
import S from './social.en.json';
import WORDS from './text/words.en.json';
import { TEXT } from './text';
import PROFILES from './text/profiles.en.json';

/**
 * The words of Streetwire (see sim/social.ts): each post, comment and profile is put together from
 * short pieces (locale/text/*.json) by the grammar of gen.ts, from the post's kind and its mood: a
 * happy post is made of happy pieces, an annoyed one of grumbles. The places that are real are
 * filled in, and each author types in their own way (some never capitalize, some write "u" for
 * "you", some drop the full stop, a few make typos). The words are made once per post and kept.
 */
export const MOOD_KEYS = ['happy', 'excited', 'calm', 'bored', 'tired', 'sad', 'annoyed', 'worried', 'playful'];
export const BASE: Grammar = TEXT;
/** How a sentence ends, by mood. */
const STOP: Record<string, string[]> = {
  happy: ['4|.', '3|!', '1|!!'], excited: ['1|!', '2|!!', '1|!!!'], calm: ['6|.', '1|...'], bored: ['3|.', '2|...'], tired: ['3|.', '3|...'],
  sad: ['3|.', '3|...'], annoyed: ['3|.', '2|!', '1|?!'], worried: ['3|.', '1|...', '1|?'], playful: ['3|.', '2|!'],
};

const layers = new Map<string, Grammar>();
/** The grammar of a post: its kind's and mood's lists in place of the generic names. */
function postGrammar(kind: string, mood: string): Grammar {
  const key = `${kind}.${mood}`;
  let L = layers.get(key);
  if (L) return L;
  const core = BASE[`core.${kind}.${mood}`];
  L = {
    // a post told in its mood when there are such lines; else what happened, with a feeling after
    core: core ? ['#coreraw##stop#'] : ['#factraw##stop#'],
    coreraw: core ?? BASE[`fact.${kind}`],
    fact: ['#factraw##stop#'],
    factraw: BASE[`fact.${kind}`],
    open: BASE[`open.${mood}`], feel: BASE[`feel.${mood}`], close: BASE[`close.${mood}`], emo: BASE[`emo.${mood}`],
    stop: STOP[mood],
  };
  layers.set(key, L);
  return L;
}

/** Capital letters at the start of each sentence (the pieces nest, so a piece may start mid-sentence). */
const sentences = (s: string) => s.replace(/(^|[.!?]\s+)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
/** After an opener that runs on ("Is it just me, or", "Ugh,"), the next word goes on in lower case (not "I", not a name). */
const runOn = (s: string, names: string[]) => s.replace(/([,:]|\bor|\band|\bjust) ([A-Z][a-z']+)/g, (m, a: string, w: string) => (/^I('|$)/.test(w) || names.includes(w) || /^[A-Z][a-z]+(day|ville)$/.test(w) ? m : `${a} ${w.toLowerCase()}`));

const fresh = new Fresh();
const postCache = new Map<number, string>();
const commentCache = new Map<string, string>();
const wx = newWeather();

/** The context a post is told in: the places that are real, the names of the author's life, the day. */
function ctxOf(city: City, P: Population, p: Post, who: number, r: Rng): Ctx {
  const c = lifeCtx(city, P, who, r);
  c.biz = p.biz >= 0 ? businessName(city, p.biz) : p.kind === 'work' && c.job ? c.job : pickW(WORDS.place, r);
  c.district = districtName(city, districtAt(city, p.x, p.y));
  c.city = cityName(city);
  c.friend = c.friend ?? pickW(WORDS.family, r);
  c.weekday = WORDS.weekday[(Math.floor(p.time / 86400) + 2) % 7];
  return c;
}

/** The conditions of someone speaking at the time of a post (their life, the hour, the weather then). */
function selAt(P: Population, who: number, t: number, news: boolean) {
  forecast(P.seed, t, wx);
  const extra: string[] = [];
  if (usesSmileys(P, who)) extra.push('smiley');
  if (news) extra.push('news');
  if (P.friendAt[who + 1] > P.friendAt[who]) extra.push('friend');
  return selFor(P, who, t, wx.temp, wx.precip, wx.snow, extra);
}

/** Finish a mix: tidy, capitals, run-on openers, then the author's own way of typing. */
function finish(s: string, P: Population, who: number, c: Ctx, r: Rng) {
  return voice(runOn(sentences(tidy(s)), [c.first, c.partner, c.kid, c.petname, c.colleague, c.friend, c.name].filter(Boolean)), P, who, r, c.first);
}

/** The words of a post, made once (no two posts read the same). */
export function postText(city: City, P: Population, p: Post): string {
  let s = postCache.get(p.id);
  if (s !== undefined) return s;
  const mood = MOOD_KEYS[p.mood] ?? 'calm', G = [postGrammar(p.kind, mood), BASE], sel = selAt(P, p.who, p.time, p.event >= 0);
  s = fresh.take((r) => {
    const c = ctxOf(city, P, p, p.who, r);
    return finish(expand(pickW(BASE.shapes, r, sel), G, r, c, sel), P, p.who, c, r);
  }, p.pick, p.who, p.id);
  postCache.set(p.id, s);
  if (postCache.size > 4000) postCache.delete(postCache.keys().next().value!);
  return s;
}

/** A comment's words: how the commenter takes the post (its mood), sometimes about what it is about. */
export function commentText(city: City, P: Population, p: Post, c: Comment, k: number): string {
  const key = `${p.id}:${k}`;
  let s = commentCache.get(key);
  if (s !== undefined) return s;
  const mood = MOOD_KEYS[c.mood] ?? 'calm', topic = BASE[`reply.topic.${p.kind}`] ?? [];
  // how the author is addressed ("girl", "dude") follows who they are
  const sel = selAt(P, c.who, c.time, p.event >= 0), to = P.gender[p.who] ? 'tom' : 'tof';
  sel.tags.add(to); sel.key += ` ${to}`;
  const L: Grammar = { reply: [...BASE[`reply.${mood}`], ...topic.map((t) => `2|${t}`)] };
  s = fresh.take((r) => {
    const ctx = ctxOf(city, P, p, c.who, r);
    ctx.name = citizenNames(city, P, p.who)[0];
    return finish(expand(pickW(BASE.cshapes, r, sel), [L, BASE], r, ctx, sel), P, c.who, ctx, r);
  }, c.pick, c.who, p.id * 31 + k);
  commentCache.set(key, s);
  if (commentCache.size > 8000) commentCache.delete(commentCache.keys().next().value!);
  return s;
}

/**
 * A citizen's profile on Streetwire, made from the seed and the sim when someone opens it (nothing
 * is kept for the 40 thousand): who they are, where they live and work, a bio and interests in
 * their voice. Later stages hang more off it (the documents about them: records, messages, logs).
 */
export interface Profile { name: string; handle: string; age: number; home: string; work: string; bio: string; likes: string[]; status: string; joined: string; friends: number }
const PROF = S.profile;
export function profileOf(city: City, P: Population, i: number): Profile {
  const r = rngOf(i, 0x9f0f, P.seed), [first, last] = citizenNames(city, P, i), H = P.households[P.home[i]], B = city.buildings[H.building];
  const home = districtName(city, districtAt(city, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2));
  const role = P.role[i], work = P.job[i] >= 0 ? workplaceName(city, P, P.job[i]) : '';
  const roleText = role === Role.Worker ? PROF.worksAt.replace('{place}', work) : (PROF.roles as string[])[role];
  const ctx: Ctx = { role: cap(roleText), age: String(P.age[i]), district: home, city: cityName(city) };
  const bio = voice(sentences(tidy(expand('#bio#', BASE, r, { ...lifeCtx(city, P, i, r), ...ctx }, selFor(P, i, P.seed)))), P, i, r);
  const likes: string[] = [];
  for (let k = 0; k < 8 && likes.length < 3; k++) { const x = pickW(PROFILES.interest, r); if (!likes.includes(x)) likes.push(x); }
  const status = P.spouse[i] >= 0 ? PROFILES.status[1] : P.age[i] < 18 ? '' : PROFILES.status[[0, 0, 2, 3, 4, 5][Math.floor(r() * 6)]];
  const sep = ['', '.', '_'][Math.floor(r() * 3)], num = r() < 0.5 ? String(Math.floor(r() * 99)) : '';
  const handle = (r() < 0.5 ? `${first}${sep}${last}` : `${first[0]}${last}`).toLowerCase().replace(/[^a-z0-9._]/g, '') + num;
  const joined = PROF.joined.replace('{m}', PROF.months[Math.floor(r() * 12)]).replace('{y}', String(r() < 0.6 ? 2007 : 2006));
  return { name: `${first} ${last}`, handle, age: P.age[i], home, work: roleText, bio, likes, status, joined, friends: P.friendAt[i + 1] - P.friendAt[i] };
}

/** How long ago a post went up, as the feed shows it. */
export function postAge(t: number, at: number): string {
  const m = Math.floor((t - at) / 60);
  if (m < 1) return S.ago.now;
  return m < 60 ? S.ago.m.replace('{n}', String(m)) : S.ago.h.replace('{n}', String(Math.floor(m / 60)));
}

export const SOCIAL = S;
