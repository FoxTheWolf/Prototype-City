import { hash3 } from '../core/rng';
import { CharGrid } from '../render/grid';
import { HD } from '../render/hd';
import { cover } from './camera';
import { districtAt, isSolid, type City } from '../sim/city';
import { comments, likes, type Post } from '../sim/social';
import { type World } from '../sim/world';
import { citizenNames, districtName } from '../locale/names';
import { commentText, postAge, postText, profileOf, SOCIAL } from '../locale/social';
import { ch, type C3, type Lcd, SH, softKeys, SW } from './lcd';
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
const PAGE: C3 = [228, 233, 240], CARD: C3 = [250, 251, 253], NAVY: C3 = [28, 52, 102], NAVY2: C3 = [44, 74, 136];
const TEXT: C3 = [28, 32, 42], DIM: C3 = [112, 120, 134], ORANGE: C3 = [255, 140, 40], LINK: C3 = [40, 90, 180], LOVE: C3 = [214, 52, 86];
/** The picked card: the bar's navy with light words. */
const PICK: C3 = [36, 64, 124], PTEXT: C3 = [255, 255, 255], PDIM: C3 = [176, 192, 226], PLINK: C3 = [255, 200, 130];
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

/** Someone's picture: two cells in a color of their own, with their initials. */
function avatar(S: Lcd, x: number, y: number, world: World, who: number) {
  const h = hash3(who, 0xa7a, 1), col: C3 = [90 + Math.floor(h * 140), 80 + Math.floor(hash3(who, 0xa7a, 2) * 130), 100 + Math.floor(hash3(who, 0xa7a, 3) * 130)];
  const [f, l] = citizenNames(world.city, world.pop, who);
  S.put(x, y, ch(f[0] ?? '?'), [255, 255, 255], col);
  S.put(x + 1, y, ch(l[0] ?? '?'), [255, 255, 255], col);
}

/** The site's bar: the logo, and what page this is. */
function header(S: Lcd, right: string, loading: boolean, now: number) {
  for (let y = 1; y <= 2; y++) S.fill(y, y === 1 ? NAVY : NAVY2);
  S.text(1, 1, 'streetwire', [255, 255, 255], NAVY);
  S.put(11, 1, ch('.'), ORANGE, NAVY);
  S.text(SW - right.length - 1, 1, right, [180, 200, 235], NAVY);
  S.text(1, 2, loading ? `${W.wait.slice(0, -3)}${'.'.repeat(Math.floor(now * 3) % 4)}` : W.tagline, [170, 190, 225], NAVY2);
}

const page = (S: Lcd, y0 = 3) => { for (let y = y0; y < SH - 1; y++) S.fill(y, PAGE); };

/** The posts as the feed lists them: newest first. */
const feedPosts = (P: Phone) => P.wire.slice().reverse();

export function drawWire(S: Lcd, P: Phone, world: World, now: number, loading: boolean) {
  const V = P.wst;
  page(S);
  if (V.view === 'post' && V.post) return postPage(S, P, world, V.post, now, loading);
  if (V.view === 'profile' && V.who >= 0) return profilePage(S, P, world, now, loading);
  header(S, 'Home', loading, now);
  const L = feedPosts(P);
  if (!L.length) {
    S.center(10, loading || P.online() ? W.wait : W.none, loading || P.online() ? DIM : LOVE, PAGE);
    return softKeys(S, P.online() ? W.refresh : '', 'Back');
  }
  V.sel = Math.min(V.sel, L.length - 1);
  // the cards, laid out as rows; the picked one kept in sight
  const rows: { text: string; fg: C3; bg: C3; card: number; av?: number; x?: number }[] = [];
  const c = world.city, Pop = world.pop;
  L.forEach((p, k) => {
    const sel = k === V.sel, bg = sel ? PICK : CARD;
    const name = citizenNames(c, Pop, p.who).join(' '), age = postAge(world.time, p.time);
    rows.push({ text: `${name}`.slice(0, SW - 6 - age.length), fg: sel ? PLINK : LINK, bg, card: k, av: p.who });
    rows[rows.length - 1].x = 3;
    for (const l of wrap(postText(c, Pop, p), SW - 3)) rows.push({ text: l, fg: sel ? PTEXT : TEXT, bg, card: k });
    if (p.photo) rows.push({ text: W.photo, fg: sel ? PDIM : DIM, bg, card: k });
    const n = likes(Pop, p, world.time) + (V.liked.has(p.id) ? 1 : 0), cm = comments(Pop, p, world.time).length;
    rows.push({ text: `${V.liked.has(p.id) ? '<3' : '<3'} ${n}   ${W.comments.replace('{n}', String(cm))}   ${age}`, fg: sel ? PDIM : DIM, bg, card: k });
    rows.push({ text: '', fg: DIM, bg: PAGE, card: -1 });
  });
  const view = SH - 4, first = rows.findIndex((r) => r.card === V.sel), last = rows.length - 1 - [...rows].reverse().findIndex((r) => r.card === V.sel);
  let top = Math.max(0, Math.min(first, rows.length - view));
  if (last - top >= view) top = last - view + 1;
  if (first < top) top = first;
  rows.slice(top, top + view).forEach((r, k) => {
    const y = 3 + k;
    if (r.card < 0) return;
    for (let x = 0; x < SW; x++) S.put(x, y, 32, r.bg, r.bg);
    S.put(0, y, 32, r.card === V.sel ? ORANGE : [200, 206, 218], r.card === V.sel ? ORANGE : [200, 206, 218]);
    if (r.av !== undefined) avatar(S, 1, y, world, r.av);
    S.text(r.x ?? 2, y, r.text, r.fg, r.bg);
    if (r.text.startsWith('<3')) {
      const p = L[r.card];
      S.text(2, y, '<3', V.liked.has(p.id) ? (r.card === V.sel ? [255, 130, 160] : LOVE) : r.fg, r.bg);
    }
  });
  softKeys(S, W.refresh, 'Back');
  S.text((SW - W.hint.length) >> 1, SH - 1, W.hint, [150, 160, 180], [28, 62, 82]);
}

/** A post: the photo, the words, its likes, and the comments as they came in. */
function postPage(S: Lcd, P: Phone, world: World, p: Post, now: number, loading: boolean) {
  const V = P.wst, c = world.city, Pop = world.pop;
  header(S, 'Post', loading, now);
  const rows: [string, C3, C3, number?][] = [];
  const name = citizenNames(c, Pop, p.who).join(' ');
  rows.push([`   ${name}`, LINK, CARD, p.who]);
  rows.push([`   ${postAge(world.time, p.time)} ${W.at.replace('{place}', districtName(c, districtAt(c, p.x, p.y)))}`, DIM, CARD]);
  for (const l of wrap(postText(c, Pop, p), SW - 3)) rows.push([` ${l}`, TEXT, CARD]);
  const picRows = p.photo ? PIC_H + 1 : 0;
  for (let k = 0; k < picRows; k++) rows.push(['', TEXT, PAGE, -2]);
  const n = likes(Pop, p, world.time) + (V.liked.has(p.id) ? 1 : 0), cm = comments(Pop, p, world.time);
  rows.push([` ${V.liked.has(p.id) ? `<3 ${W.liked}` : `<3 ${W.like}`}  ${W.likes.replace('{n}', String(n))}`, V.liked.has(p.id) ? LOVE : LINK, CARD]);
  rows.push(['', TEXT, PAGE]);
  if (!cm.length && !(world.feed.mine ?? []).some((m) => m.post === p.id)) rows.push([` ${W.noComments}`, DIM, PAGE]);
  cm.forEach((cmt, k) => {
    rows.push([`   ${citizenNames(c, Pop, cmt.who).join(' ')}  ${postAge(world.time, cmt.time)}`, LINK, CARD, cmt.who]);
    for (const l of wrap(commentText(c, Pop, p, cmt, k), SW - 4)) rows.push([`   ${l}`, TEXT, CARD]);
    rows.push(['', TEXT, PAGE]);
  });
  // what the player wrote on the site (15.6), and the author's answer once it is up
  const you = world.feed.me?.user ?? 'you';
  for (const m of world.feed.mine ?? []) if (m.post === p.id) {
    rows.push([`   ${you}  ${postAge(world.time, m.time)}`, ORANGE, CARD]);
    for (const l of wrap(m.text, SW - 4)) rows.push([`   ${l}`, TEXT, CARD]);
    rows.push(['', TEXT, PAGE]);
    if (!m.reply || world.time < m.at) continue;
    rows.push([`   ${name}  ${postAge(world.time, m.at)}`, LINK, CARD, p.who]);
    for (const l of wrap(`@${you} ${m.reply}`, SW - 4)) rows.push([`   ${l}`, TEXT, CARD]);
    rows.push(['', TEXT, PAGE]);
  }
  const view = SH - 4;
  V.scroll = Math.max(0, Math.min(V.scroll, rows.length - view));
  let picAt = -1;
  rows.slice(V.scroll, V.scroll + view).forEach(([text, fg, bg, who], k) => {
    const y = 3 + k;
    for (let x = 0; x < SW; x++) S.put(x, y, 32, bg, bg);
    if (who === -2) { if (picAt < 0) picAt = y; return; }
    if (who !== undefined && who >= 0) avatar(S, 1, y, world, who);
    S.text(0, y, text, fg, bg);
    if (who !== undefined && who >= 0) avatar(S, 1, y, world, who);
  });
  // the photo, where its rows came up (it may be partly scrolled off)
  if (p.photo) {
    const first = rows.findIndex((r) => r[3] === -2), off = V.scroll - first;
    const pic = picOf(P, world, p);
    for (let r = Math.max(0, off); r < PIC_H; r++) {
      const y = 3 + first + r - V.scroll;
      if (y < 3 || y >= SH - 1) continue;
      for (let x = 0; x < PIC_W && x < SW; x++) {
        if (!pic) { S.put(x, y, r === 6 && x > 12 && x < 30 ? W.loadingPhoto.charCodeAt(x - 13) || 32 : 32, DIM, [200, 205, 214]); continue; }
        const q = (r * pic.w + x) * 4;
        S.put(x, y, pic.cells[q] || 32, [pic.cells[q + 1], pic.cells[q + 2], pic.cells[q + 3]], [pic.bg[q], pic.bg[q + 1], pic.bg[q + 2]]);
        // in HD: the cell's nine pixels over it
        for (let iy = 0; iy < HD; iy++) for (let ix = 0; ix < HD; ix++) {
          const h = ((r * HD + iy) * pic.w * HD + x * HD + ix) * 3;
          S.pixel(x, y, ix, iy, pic.hd[h], pic.hd[h + 1], pic.hd[h + 2]);
        }
      }
    }
  }
  softKeys(S, W.profileTab, 'Back');
  S.text((SW - 9) >> 1, SH - 1, '* Like', [150, 160, 180], [28, 62, 82]);
}

/** A profile: the picture, who they are, their bio and likes, and their posts on the wire. */
function profilePage(S: Lcd, P: Phone, world: World, now: number, loading: boolean) {
  const V = P.wst, c = world.city, Pop = world.pop, pr = profileOf(c, Pop, V.who);
  header(S, W.profileTab, loading, now);
  // the picture: a 4x2 block in their color, the initials in it
  const h = hash3(V.who, 0xa7a, 1), col: C3 = [90 + Math.floor(h * 140), 80 + Math.floor(hash3(V.who, 0xa7a, 2) * 130), 100 + Math.floor(hash3(V.who, 0xa7a, 3) * 130)];
  for (let y = 4; y <= 6; y++) for (let x = 1; x <= 6; x++) S.put(x, y, 32, col, col);
  const [f, l] = citizenNames(c, Pop, V.who);
  S.put(3, 5, ch(f[0]), [255, 255, 255], col); S.put(4, 5, ch(l[0]), [255, 255, 255], col);
  S.text(8, 4, pr.name.slice(0, SW - 9), TEXT, PAGE);
  S.text(8, 5, `@${pr.handle}`.slice(0, SW - 9), DIM, PAGE);
  S.text(8, 6, `${W.friendsN.replace('{n}', String(pr.friends))}  ${pr.joined}`.slice(0, SW - 9), DIM, PAGE);
  const PR = W.profile, rows: [string, string][] = [[PR.age, String(pr.age)], [PR.lives, pr.home], [PR.work, pr.work]];
  if (pr.status) rows.push([PR.status, pr.status]);
  rows.push([PR.likes, pr.likes.join(', ')]);
  let y = 8;
  for (const [a, b] of rows) { S.text(1, y, a, DIM, PAGE); S.text(10, y, b.slice(0, SW - 11), TEXT, PAGE); y++; }
  for (const ln of wrap(pr.bio, SW - 2).slice(0, 3)) { y++; S.text(1, y, ln, [60, 66, 80], PAGE); }
  y += 2;
  S.text(1, y, W.postsBy, NAVY, PAGE);
  for (let x = 1 + W.postsBy.length + 1; x < SW - 1; x++) S.put(x, y, ch('-'), [190, 196, 208], PAGE);
  const mine = feedPosts(P).filter((p) => p.who === V.who);
  if (!mine.length) S.text(1, y + 1, W.noPosts, DIM, PAGE);
  V.psel = Math.min(V.psel, Math.max(0, mine.length - 1));
  mine.slice(0, SH - 2 - (y + 1)).forEach((p, k) => {
    const sel = k === V.psel, bg = sel ? PICK : CARD, yy = y + 1 + k;
    for (let x = 0; x < SW; x++) S.put(x, yy, 32, bg, bg);
    S.text(1, yy, `${postAge(world.time, p.time).padEnd(9)}${postText(c, Pop, p)}`.slice(0, SW - 2), sel ? PTEXT : TEXT, bg);
  });
  softKeys(S, '', 'Back');
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
