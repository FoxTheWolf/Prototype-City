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
import { readLine } from '../sim/intent';
import { type World } from '../sim/world';
import { cityNames } from '../talk';
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

/** The op's short answer to the player's reply `text`, in the board's terse voice (read like a line
 *  said). Clean and generic -- no technical content, so it stays in this framework file. */
function opReply(w: World, text: string): string {
  const R = readLine(text, cityNames(w));
  if (R.respect <= -1 || R.intent === 'threaten') return "take it somewhere else. you're a handle here, act like one.";
  const q = R.intent;
  if (q === 'thank' || q === 'compliment' || q === 'greet' || q === 'yes') return 'np. good luck out there.';
  if (q === 'ask_how') return "it's in the thread. read it again, slower.";
  if (q === 'ask_where' || q === 'ask_directions') return 'no locations on the board. you know why.';
  if (R.question) return 'asked and answered already -- search before you post.';
  if (q === 'flirt') return 'lol. no.';
  return 'noted.';
}

/** A page of the board; a page sent by a form brings its boxes in `form`. */
export function forumPage(w: World, path: string, form?: Map<string, string>): Page {
  const url = (p: string) => `http://${FORUM_HOST}${p}`;
  const fo = w.forum, me = fo.me, on = !!me?.ok, f = (k: string) => (form?.get(k) ?? '').trim();
  const nav: [string, string][] = [['Index', url('/')], ...BOARDS.map((b) => [b.name, url(`/b/${b.slug}`)] as [string, string]), ...(on ? [[`@${me!.handle}`, url('/')] as [string, string]] : [['Sign up', url('/join')] as [string, string]])];
  const online = 20 + Math.floor(hash3(w.seed, Math.floor(w.time / 3600), 0x5b) * 40); // a plausible "users online" for flavor
  const page = (p: string, title: string, body: Block[], action?: string): Page => ({
    url: url(p), title: title ? `switchboard :: ${title}` : 'switchboard', theme: THEME, mobile: false, form: action ? url(action) : undefined, kb: 24 + body.length * 2,
    blocks: [{ t: 'banner', text: 'switchboard', sub: 'you got the address from someone. keep it that way.', logo: 'board' },
      { t: 'nav', links: nav }, ...body, { t: 'hr' }, { t: 'foot', text: `${online} lurking - no names - no logs we can help - est. 2003` }],
  });
  const note = (s: string): Block[] => (s ? [{ t: 'p', text: `>> ${s}` }] : []);
  // a thread's row (15.17g, the phpBB look): the folder lit when it moved today or yesterday
  const row = (t: ForumThread, slug: string): Block => ({ t: 'folder', lit: t.agoDays <= 1, title: `[${t.title}](${url(`/t/${slug}/${t.id}`)})`, text: `by ${t.posts[0]?.by ?? 'anon'} - last post ${bump(t.agoDays)}`, right: `${String(t.posts.length).padStart(5)} posts` });

  // sign up: bound to your phone number, confirmed by a text (you are a handle on the board)
  if (path === '/join') {
    if (on) return page('/join', 'Signed in', [{ t: 'h', text: `You're in as @${me!.handle}.` }, { t: 'p', text: `[Back to the index](${url('/')})` }]);
    if (!form) return page('/join', 'Sign up', [{ t: 'h', text: 'Make a handle' },
      { t: 'p', text: 'No e-mail, no name. Pick a handle; we text a code to your number to keep the bots out. Lose the number, lose the handle.' },
      { t: 'input', name: 'handle', label: 'Handle:', size: 20 }, { t: 'submit', label: 'Get code' }], '/join');
    const handle = f('handle').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) return page('/join', 'Sign up', [{ t: 'h', text: 'Make a handle' }, ...note('3 to 20 letters, numbers or underscores.'), { t: 'input', name: 'handle', label: 'Handle:', size: 20 }, { t: 'submit', label: 'Get code' }], '/join');
    const num = w.telco.player.number, code = String(Math.floor(w.rng() * 1e6)).padStart(6, '0');
    fo.me = { handle, num, code, ok: false };
    w.mail.sms.push({ from: 'Switchboard', text: `Switchboard code: ${code}` });
    return page('/join', 'Check your phone', [{ t: 'h', text: 'We texted you a code.' }, { t: 'p', text: `A 6-digit code is on its way to ${num}. Enter it below.` },
      { t: 'input', name: 'code', label: 'Code:', size: 8 }, { t: 'submit', label: 'Confirm' }], '/confirm');
  }
  if (path === '/confirm') {
    if (!me) return page('/confirm', 'Sign up', [{ t: 'h', text: 'Start over.' }, { t: 'p', text: `[Sign up](${url('/join')})` }]);
    if (on) return page('/confirm', 'Signed in', [{ t: 'h', text: `You're in as @${me.handle}.` }, { t: 'p', text: `[Back to the index](${url('/')})` }]);
    if (f('code') !== me.code) return page('/confirm', 'Check your phone', [{ t: 'h', text: 'That code did not match.' }, ...note('Check the text again.'), { t: 'input', name: 'code', label: 'Code:', size: 8 }, { t: 'submit', label: 'Confirm' }], '/confirm');
    me.ok = true;
    return page('/confirm', 'Welcome', [{ t: 'h', text: `You're in, @${me.handle}.` }, { t: 'p', text: `Lurk, then post. [To the boards](${url('/')})` }]);
  }

  // posting a reply: /reply/<board>/<id>
  const mr = path.match(/^\/reply\/([a-z]+)\/([a-z0-9-]+)$/);
  if (mr) {
    const slug = mr[1], id = mr[2], th = threads(w, slug).find((x) => x.id === id);
    if (on && th && f('text')) {
      const n = fo.mine.length;
      fo.mine.push({ tid: `${slug}/${id}`, time: w.time, text: f('text'), reply: opReply(w, f('text')), at: w.time + 600 + hash3(w.seed, n, 0x5c) * 3000 });
    }
    return forumPage(w, `/t/${slug}/${id}`, undefined);
  }

  // a thread: /t/<board>/<id>
  const mt = path.match(/^\/t\/([a-z]+)\/([a-z0-9-]+)$/);
  if (mt) {
    const slug = mt[1], th = threads(w, slug).find((x) => x.id === mt[2]);
    const board = BOARDS.find((b) => b.slug === slug);
    if (!th || !board) return page(path, 'Not found', [{ t: 'h', text: 'That thread is gone.' }, { t: 'p', text: `[Back to the index](${url('/')})` }]);
    const body: Block[] = [{ t: 'p', text: `${board.name} /` }, { t: 'h', text: th.title }];
    const op = th.posts[0]?.by ?? 'op';
    th.posts.forEach((p, k) => {
      body.push({ t: 'p', text: `${p.by}${k === 0 ? ' (op)' : ''}:` });
      for (const line of p.body) body.push({ t: 'p', text: `  ${line}` });
      body.push({ t: 'hr' });
    });
    // the player's replies in this thread, each with the op's later answer
    for (const m of fo.mine.filter((x) => x.tid === `${slug}/${mt[2]}`)) {
      body.push({ t: 'p', text: `@${me!.handle}:` }, { t: 'p', text: `  ${m.text}` }, { t: 'hr' });
      if (m.reply && w.time >= m.at) body.push({ t: 'p', text: `${op}:` }, { t: 'p', text: `  @${me!.handle} ${m.reply}` }, { t: 'hr' });
    }
    if (on) { body.push({ t: 'input', name: 'text', label: 'Reply:', size: 60, max: 200 }, { t: 'submit', label: 'Post' }); }
    else body.push({ t: 'p', text: `[Sign up](${url('/join')}) to reply.` });
    body.push({ t: 'p', text: `[Back to ${board.name}](${url(`/b/${slug}`)})` });
    return page(path, th.title, body, on ? `/reply/${slug}/${mt[2]}` : undefined);
  }

  // a board: /b/<slug>
  const mb = path.match(/^\/b\/([a-z]+)$/);
  if (mb) {
    const board = BOARDS.find((b) => b.slug === mb[1]);
    if (!board) return page(path, 'Not found', [{ t: 'h', text: 'No such board.' }, { t: 'p', text: `[Back to the index](${url('/')})` }]);
    const list = threads(w, board.slug);
    return page(path, board.name, [{ t: 'h', text: board.name }, { t: 'p', text: board.blurb }, { t: 'catbar', text: 'Topics', right: 'Posts' },
      ...(list.length ? list.map((t) => row(t, board.slug)) : [{ t: 'p', text: 'Nothing here right now.' } as Block])]);
  }

  // the index: the boards, and the latest across them
  if (path !== '/') return page(path, 'Not found', [{ t: 'h', text: 'Page not found.' }, { t: 'p', text: `[Back to the index](${url('/')})` }]);
  const latest = BOARDS.flatMap((b) => threads(w, b.slug).map((t) => ({ t, slug: b.slug }))).sort((a, c) => a.t.agoDays - c.t.agoDays).slice(0, 6);
  // who is online: the handles that posted lately (and the player's), the rest guests
  const recent = [...new Set([...(on ? [me!.handle] : []), ...latest.flatMap(({ t }) => (t.agoDays <= 1 ? t.posts.map((p) => p.by) : []))])].slice(0, 8);
  return page('/', '', [
    { t: 'catbar', text: 'Boards', right: 'Topics  Posts' },
    ...BOARDS.map((b): Block => {
      const T = threads(w, b.slug), n = T.reduce((a, t) => a + t.posts.length, 0);
      return { t: 'folder', lit: T.some((t) => t.agoDays <= 1), title: `[${b.name}](${url(`/b/${b.slug}`)})`, text: b.blurb, right: `${String(T.length).padStart(6)}  ${String(n).padStart(5)}` };
    }),
    { t: 'space' }, { t: 'catbar', text: 'Latest' },
    ...latest.map(({ t, slug }) => row(t, slug)),
    { t: 'space' }, { t: 'catbar', text: 'Who is online' },
    { t: 'p', text: `In total there are ${online} users online :: ${recent.length} registered and ${Math.max(0, online - recent.length)} guests` },
    { t: 'p', text: recent.length ? recent.join(', ') : 'nobody you would know' },
  ]);
}
