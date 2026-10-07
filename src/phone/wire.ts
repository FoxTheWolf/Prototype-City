import { hash3 } from '../core/rng';
import { CharGrid } from '../render/grid';
import { type Paint } from '../render/paint2d';
import { HD } from '../render/hd';
import { cover } from './camera';
import { districtAt, isSolid, type City } from '../sim/city';
import { comments, likes, type Post } from '../sim/social';
import { type World } from '../sim/world';
import { citizenNames, districtName } from '../locale/names';
import { commentText, postAge, postText, profileOf, SOCIAL } from '../locale/social';
import { type C3, type Lcd, softKeys } from './lcd';
import { paintWireFeed, paintWirePost, paintWireProfile, WIRE_VIEW, wireRowsH, type WFace, type WireFeed, type WirePostPage, type WireProfile, type WRow } from './pixpages';
import { type Key, type Phone } from './phone';

/**
 * Streetwire, the city's social network, as its own site would look in 2008: a navy bar with the
 * lowercase logo, white cards on a pale page, a colored square for each person's picture. The feed
 * (up and down pick a post, * likes it, OK opens it), a post with its photo and its comments (#
 * opens the author's profile), and a profile (who they are, what they like, their posts).
 *
 * A photo is a small render of the city from where the author stood, looking at what they posted
 * about, made once when the post is first opened (see Phone.shoot) and kept with the post.
 */
const W = SOCIAL;

export type WireView = 'feed' | 'post' | 'profile';
export interface WireState {
  view: WireView;
  /** Picked post in the feed (0 = newest), and in a profile's list. */
  sel: number;
  psel: number;
  /** The post open, the profile open (a citizen), and where Back goes from the profile. */
  post: Post | null;
  who: number;
  from: WireView;
  liked: Set<number>;
  scroll: number;
}
export const newWire = (): WireState => ({ view: 'feed', sel: 0, psel: 0, post: null, who: -1, from: 'feed', liked: new Set(), scroll: 0 });

/** A picture the size of the post's photo, kept by post id: its cells (the average of each), and its HD pixels (HD x HD per cell, r g b). */
export interface Pic { w: number; h: number; cells: Uint8ClampedArray; bg: Uint8ClampedArray; hd: Uint8ClampedArray }
const pics = new Map<number, Pic>();
const PIC_W = 42, PIC_H = 14;

/** A spot on the street near the post, and the way to look (toward the place it is about). */
function viewpoint(city: City, p: Post): [number, number, number] {
  for (let d = 12; d <= 60; d += 6) for (let a = 0; a < 12; a++) {
    const ang = (a / 12) * Math.PI * 2 + hash3(p.id, 3, 1) * 6.283, x = p.x + Math.cos(ang) * d, y = p.y + Math.sin(ang) * d;
    if (!isSolid(city, x, y)) return [x, y, Math.atan2(p.y - y, p.x - x)];
  }
  return [p.x, p.y, hash3(p.id, 4, 1) * 6.283];
}

/** The post's photo: taken now if not yet (main renders it through P.shoot). */
function picOf(P: Phone, world: World, p: Post): Pic | null {
  const [x, y, yaw] = viewpoint(world.city, p);
  return takePic(P, p.id, x, y, yaw, PIC_W, PIC_H);
}

/**
 * A photo of the city, w x h cells, kept by `id`: taken now if not yet (main renders it through
 * P.shoot) from (x, y) looking along yaw, at an eye height and a pitch (a street photo by default).
 * Null while it cannot be taken.
 */
export function takePic(P: Phone, id: number, x: number, y: number, yaw: number, PIC_W: number, PIC_H: number, eye?: number, pitch?: number): Pic | null {
  let pic = pics.get(id);
  if (pic || !P.shoot) return pic ?? null;
  // rendered with one cell per HD pixel (the same shape as a cell, a third of it each way), each
  // pixel the cell's glyph colour mixed into its background by how much of the cell the glyph covers
  const W = PIC_W * HD, H = PIC_H * HD, g = new CharGrid(W, H);
  if (!P.shoot(g, x, y, yaw, eye, pitch)) return null;
  const hd = new Uint8ClampedArray(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    // a phone camera of 2008: a little soft, a little noisy
    const k = i * 4, f = cover(g.cells[k]), n = (hash3(id, i, 9) - 0.5) * 22;
    for (let c = 0; c < 3; c++) hd[i * 3 + c] = g.bg[k + c] + (g.cells[k + 1 + c] - g.bg[k + c]) * f + n;
  }
  const cells = new Uint8ClampedArray(PIC_W * PIC_H * 4), bg = new Uint8ClampedArray(PIC_W * PIC_H * 4);
  for (let cy = 0; cy < PIC_H; cy++) for (let cx = 0; cx < PIC_W; cx++) {
    const o = (cy * PIC_W + cx) * 4;
    cells[o] = 32;
    for (let c = 0; c < 3; c++) {
      let v = 0;
      for (let iy = 0; iy < HD; iy++) for (let ix = 0; ix < HD; ix++) v += hd[((cy * HD + iy) * W + cx * HD + ix) * 3 + c];
      bg[o + c] = v / (HD * HD);
    }
    bg[o + 3] = 255;
  }
  pic = { w: PIC_W, h: PIC_H, cells, bg, hd };
  pics.set(id, pic);
  if (pics.size > 120) pics.delete(pics.keys().next().value!);
  return pic;
}

/** Text wrapped to a width. */
function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    if (line && line.length + 1 + word.length > w) { out.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

/** Someone's picture: a square in a color of their own, with their initials. */
function faceOf(world: World, who: number): WFace {
  const col: C3 = [90 + Math.floor(hash3(who, 0xa7a, 1) * 140), 80 + Math.floor(hash3(who, 0xa7a, 2) * 130), 100 + Math.floor(hash3(who, 0xa7a, 3) * 130)];
  const [f, l] = citizenNames(world.city, world.pop, who);
  return { col, ini: `${f[0] ?? '?'}${l[0] ?? '?'}` };
}
/** A picture as the painter takes it (its HD pixels). */
const rgb = (pic: Pic | null | undefined) => (pic ? { hd: pic.hd, w: pic.w * HD, h: pic.h * HD } : null);
/** Under the bar: the tagline, or the dots while the wire downloads. */
const tagline = (loading: boolean, now: number) => (loading ? `${W.wait.slice(0, -3)}${'.'.repeat(Math.floor(now * 3) % 4)}` : W.tagline);

/** The posts as the feed lists them: newest first. */
const feedPosts = (P: Phone) => P.wire.slice().reverse();

export function drawWire(S: Lcd, P: Phone, world: World, now: number, loading: boolean, t: number): (Pt: Paint) => void {
  const V = P.wst;
  if (V.view === 'post' && V.post) return postPage(S, P, world, V.post, now, loading, t);
  if (V.view === 'profile' && V.who >= 0) return profilePage(S, P, world, now, loading, t);
  const L = feedPosts(P), c = world.city, Pop = world.pop;
  const d: WireFeed = { tab: 'Home', tagline: tagline(loading, now), wait: '', bad: false, photoWord: 'photo', posts: [], t };
  if (!L.length) {
    d.wait = loading || P.online() ? W.wait : W.none; d.bad = !(loading || P.online());
    softKeys(S, P.online() ? W.refresh : '', 'Back');
    return (Pt) => paintWireFeed(Pt, d);
  }
  V.sel = Math.min(V.sel, L.length - 1);
  d.posts = L.map((p, k) => ({
    face: faceOf(world, p.who), name: citizenNames(c, Pop, p.who).join(' '), age: postAge(world.time, p.time), lines: wrap(postText(c, Pop, p), 33),
    // the photo shows once it has been taken (opening the post takes it)
    hasPhoto: !!p.photo, photo: p.photo ? rgb(pics.get(p.id)) : null,
    likes: String(likes(Pop, p, world.time) + (V.liked.has(p.id) ? 1 : 0)), liked: V.liked.has(p.id), comments: W.comments.replace('{n}', String(comments(Pop, p, world.time).length)),
    sel: k === V.sel, pre: () => { V.sel = k; },
  }));
  softKeys(S, W.refresh, 'Back');
  return (Pt) => paintWireFeed(Pt, d);
}

/** A post: who wrote it, the words, the photo, the like button, and the comments as they came in. */
function postPage(S: Lcd, P: Phone, world: World, p: Post, now: number, loading: boolean, t: number): (Pt: Paint) => void {
  const V = P.wst, c = world.city, Pop = world.pop;
  const rows: WRow[] = [];
  const name = citizenNames(c, Pop, p.who).join(' ');
  rows.push({ kind: 'who', face: faceOf(world, p.who), name, sub: `${postAge(world.time, p.time)} ${W.at.replace('{place}', districtName(c, districtAt(c, p.x, p.y)))}`, author: true });
  for (const l of wrap(postText(c, Pop, p), 35)) rows.push({ kind: 'text', text: l });
  if (p.photo) rows.push({ kind: 'photo' });
  const n = likes(Pop, p, world.time) + (V.liked.has(p.id) ? 1 : 0), cm = comments(Pop, p, world.time);
  rows.push({ kind: 'like', label: V.liked.has(p.id) ? W.liked : W.like, count: W.likes.replace('{n}', String(n)), liked: V.liked.has(p.id) });
  rows.push({ kind: 'gap' });
  if (!cm.length && !(world.feed.mine ?? []).some((m) => m.post === p.id)) rows.push({ kind: 'note', text: W.noComments });
  cm.forEach((cmt, k) => {
    rows.push({ kind: 'who', face: faceOf(world, cmt.who), name: citizenNames(c, Pop, cmt.who).join(' '), sub: postAge(world.time, cmt.time) });
    for (const l of wrap(commentText(c, Pop, p, cmt, k), 35)) rows.push({ kind: 'text', text: l });
    rows.push({ kind: 'gap' });
  });
  // what the player wrote on the site (15.6), and the author's answer once it is up
  const you = world.feed.me?.user ?? 'you';
  for (const m of world.feed.mine ?? []) if (m.post === p.id) {
    rows.push({ kind: 'who', face: { col: [255, 140, 40], ini: you.slice(0, 2).toUpperCase() }, name: you, sub: postAge(world.time, m.time), you: true });
    for (const l of wrap(m.text, 35)) rows.push({ kind: 'text', text: l });
    rows.push({ kind: 'gap' });
    if (!m.reply || world.time < m.at) continue;
    rows.push({ kind: 'who', face: faceOf(world, p.who), name, sub: postAge(world.time, m.at), author: true });
    for (const l of wrap(`@${you} ${m.reply}`, 35)) rows.push({ kind: 'text', text: l });
    rows.push({ kind: 'gap' });
  }
  // up and down scroll 12 px a step, to the end
  V.scroll = Math.max(0, Math.min(V.scroll, Math.ceil(Math.max(0, wireRowsH(rows) - WIRE_VIEW) / 12)));
  const d: WirePostPage = { tab: 'Post', tagline: tagline(loading, now), rows, photo: p.photo ? rgb(picOf(P, world, p)) : null, loadingPhoto: W.loadingPhoto, scroll: V.scroll * 12, t };
  softKeys(S, W.profileTab, 'Back');
  return (Pt) => paintWirePost(Pt, d);
}

/** A profile: the picture, who they are, their bio and likes, and their posts on the wire. */
function profilePage(S: Lcd, P: Phone, world: World, now: number, loading: boolean, t: number): (Pt: Paint) => void {
  const V = P.wst, c = world.city, Pop = world.pop, pr = profileOf(c, Pop, V.who);
  const PR = W.profile, info: [string, string][] = [[PR.age, String(pr.age)], [PR.lives, pr.home], [PR.work, pr.work]];
  if (pr.status) info.push([PR.status, pr.status]);
  info.push([PR.likes, pr.likes.join(', ')]);
  const mine = feedPosts(P).filter((p) => p.who === V.who);
  V.psel = Math.min(V.psel, Math.max(0, mine.length - 1));
  const d: WireProfile = { tab: W.profileTab, tagline: tagline(loading, now), face: faceOf(world, V.who), name: pr.name, handle: `@${pr.handle}`, friends: W.friendsN.replace('{n}', String(pr.friends)), joined: pr.joined,
    info, bio: wrap(pr.bio, 36).slice(0, 3), postsBy: W.postsBy, noPosts: W.noPosts,
    posts: mine.map((p, k) => ({ age: postAge(world.time, p.time), text: postText(c, Pop, p), sel: k === V.psel, pre: () => { V.psel = k; } })), t };
  softKeys(S, '', 'Back');
  return (Pt) => paintWireProfile(Pt, d);
}

/** The keys on Streetwire; false when one does nothing. `refresh` downloads the wire again. */
export function wireKey(P: Phone, k: Key, now: number, refresh: () => void): boolean {
  const V = P.wst, L = feedPosts(P);
  if (V.view === 'feed') {
    if (k === 'up' || k === 'down') { V.sel = Math.max(0, Math.min(L.length - 1, V.sel + (k === 'up' ? -1 : 1))); return true; }
    if (k === '*' && L[V.sel]) { toggle(V, L[V.sel].id); return true; }
    if (k === 'ok' && L[V.sel]) { V.post = L[V.sel]; V.view = 'post'; V.scroll = 0; return true; }
    if (k === 'lsoft') { refresh(); return true; }
    return false;
  }
  if (V.view === 'post' && V.post) {
    if (k === 'up' || k === 'down') { V.scroll = Math.max(0, V.scroll + (k === 'up' ? -2 : 2)); return true; }
    if (k === '*') { toggle(V, V.post.id); return true; }
    if (k === 'lsoft' || k === '#' || k === 'ok') { V.who = V.post.who; V.from = 'post'; V.view = 'profile'; V.psel = 0; return true; }
    if (k === 'rsoft') { V.view = 'feed'; return true; }
    return false;
  }
  if (V.view === 'profile') {
    const mine = L.filter((p) => p.who === V.who);
    if ((k === 'up' || k === 'down') && mine.length) { V.psel = Math.max(0, Math.min(mine.length - 1, V.psel + (k === 'up' ? -1 : 1))); return true; }
    if (k === 'ok' && mine[V.psel]) { V.post = mine[V.psel]; V.view = 'post'; V.scroll = 0; return true; }
    if (k === 'rsoft') { V.view = V.from === 'post' && V.post ? 'post' : 'feed'; return true; }
    return false;
  }
  void now;
  return false;
}

function toggle(V: WireState, id: number) { if (V.liked.has(id)) V.liked.delete(id); else V.liked.add(id); }
