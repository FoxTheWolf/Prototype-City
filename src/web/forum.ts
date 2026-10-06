/**
 * Switchboard (15.8), at www.switchboard.net: an obscure message board the city's hackers and fixers
 * trade on. Three boards -- Guides (how things are done), Contracts (open gigs, no names), and the
 * Lounge (noise) -- as thread lists you read, with each thread its posts under handles. You get here
 * because someone passed you the address, not by searching: it is not in Lookwise's index.
 *
 * This file is the framework only -- pages, routing, and the benign Lounge chatter. The Guides and
 * Contracts text (which reads like hacking) lives in src/locale/forum.ts, a [HACKING] module this
 * file only imports from, so a normal session never opens that content. Read-only for now; signing
 * in (by number, confirmed by text) and posting are the next step (15.8c), like Streetwire's own.
 */
import { hash3 } from '../core/rng';
import { type World } from '../sim/world';
import { GUIDES, gigs, type ForumThread } from '../locale/forum';
import { type Block, type Page, type Theme } from './page';

export const FORUM_HOST = 'www.switchboard.net';
const THEME: Theme = { page: [16, 18, 22], bg: [26, 29, 35], fg: [198, 204, 210], dim: [120, 126, 136], link: [120, 198, 142], head: [28, 38, 32], headFg: [184, 230, 192], bar: [34, 46, 38], barFg: [190, 235, 200] };

/** A board: its path slug, its name on the tabs, and a line under it. */
const BOARDS: { slug: string; name: string; blurb: string }[] = [
  { slug: 'guides', name: 'Guides', blurb: 'how things are done. read the stickies first.' },
  { slug: 'work', name: 'Contracts', blurb: 'open work. no names, no faces.' },
  { slug: 'lounge', name: 'Lounge', blurb: 'noise. keep it here.' },
];

/** The Lounge: plain chatter, nothing technical. Authored here (not the grammar), kept clean. */
const LOUNGE: ForumThread[] = [
  { id: 'l1', title: 'best late coffee downtown?', agoDays: 1, posts: [
    { by: 'cold_wire', body: ['anywhere open past 2am that is not the bus station. asking for a friend who is me at 3am.'] },
    { by: 'quiet_fuse', body: ['the 24h cafe by the old exchange. terrible coffee, nobody bothers you, outlets under every table.'] },
    { by: 'spare_ping', body: ['+1. sit at the back.'] },
  ] },
  { id: 'l2', title: 'rain again', agoDays: 0, posts: [
    { by: 'patch_moth', body: ['third night straight. the whole city smells like wet concrete and the buses are a mess.'] },
    { by: 'low_crow', body: ['good. nobody looks up in the rain.'] },
  ] },
  { id: 'l3', title: 'do not post real numbers, again', agoDays: 4, posts: [
    { by: 'dead_relay', body: ['saw three people this week drop a real line in a thread. do not. you are a handle here. that is the whole deal.'] },
    { by: 'dark_jack', body: ['and stop screenshotting the board. if i see it on streetwire i know who.'] },
  ] },
];

/** Every thread the board holds right now, by board slug. */
function threads(w: World, slug: string): ForumThread[] {
  return slug === 'guides' ? GUIDES : slug === 'work' ? gigs(w) : slug === 'lounge' ? LOUNGE : [];
}

const bump = (d: number) => (d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`);

/** A page of the board. */
export function forumPage(w: World, path: string): Page {
  const url = (p: string) => `http://${FORUM_HOST}${p}`;
  const nav: [string, string][] = [['Index', url('/')], ...BOARDS.map((b) => [b.name, url(`/b/${b.slug}`)] as [string, string])];
  const online = 20 + Math.floor(hash3(w.seed, Math.floor(w.time / 3600), 0x5b) * 40); // a plausible "users online" for flavor
  const page = (p: string, title: string, body: Block[]): Page => ({
    url: url(p), title: title ? `switchboard :: ${title}` : 'switchboard', theme: THEME, mobile: false, kb: 24 + body.length * 2,
    blocks: [{ t: 'banner', text: 'switchboard', sub: 'you got the address from someone. keep it that way.', art: ['[ :: ]', ' |__| '] },
      { t: 'nav', links: nav }, ...body, { t: 'hr' }, { t: 'foot', text: `${online} lurking - no names - no logs we can help - est. 2003` }],
  });
  const row = (t: ForumThread, slug: string): Block => ({ t: 'p', text: `[${t.title}](${url(`/t/${slug}/${t.id}`)}) - ${t.posts.length} post${t.posts.length === 1 ? '' : 's'} - ${bump(t.agoDays)}` });

  // a thread: /t/<board>/<id>
  const mt = path.match(/^\/t\/([a-z]+)\/([a-z0-9-]+)$/);
  if (mt) {
    const slug = mt[1], th = threads(w, slug).find((x) => x.id === mt[2]);
    const board = BOARDS.find((b) => b.slug === slug);
    if (!th || !board) return page(path, 'Not found', [{ t: 'h', text: 'That thread is gone.' }, { t: 'p', text: `[Back to the index](${url('/')})` }]);
    const body: Block[] = [{ t: 'p', text: `${board.name} /` }, { t: 'h', text: th.title }];
    th.posts.forEach((p, k) => {
      body.push({ t: 'p', text: `${p.by}${k === 0 ? ' (op)' : ''}:` });
      for (const line of p.body) body.push({ t: 'p', text: `  ${line}` });
      body.push({ t: 'hr' });
    });
    body.push({ t: 'p', text: `[Back to ${board.name}](${url(`/b/${slug}`)}) - sign in to reply (soon)` });
    return page(path, th.title, body);
  }

  // a board: /b/<slug>
  const mb = path.match(/^\/b\/([a-z]+)$/);
  if (mb) {
    const board = BOARDS.find((b) => b.slug === mb[1]);
    if (!board) return page(path, 'Not found', [{ t: 'h', text: 'No such board.' }, { t: 'p', text: `[Back to the index](${url('/')})` }]);
    const list = threads(w, board.slug);
    return page(path, board.name, [{ t: 'h', text: board.name }, { t: 'p', text: board.blurb },
      ...(list.length ? list.map((t) => row(t, board.slug)) : [{ t: 'p', text: 'Nothing here right now.' } as Block])]);
  }

  // the index: the boards, and the latest across them
  if (path !== '/') return page(path, 'Not found', [{ t: 'h', text: 'Page not found.' }, { t: 'p', text: `[Back to the index](${url('/')})` }]);
  const latest = BOARDS.flatMap((b) => threads(w, b.slug).map((t) => ({ t, slug: b.slug }))).sort((a, c) => a.t.agoDays - c.t.agoDays).slice(0, 6);
  return page('/', '', [
    { t: 'h', text: 'Boards' },
    ...BOARDS.map((b): Block => ({ t: 'p', text: `[${b.name}](${url(`/b/${b.slug}`)}) - ${b.blurb}` })),
    { t: 'hr' }, { t: 'h', text: 'Latest' },
    ...latest.map(({ t, slug }) => row(t, slug)),
  ]);
}
