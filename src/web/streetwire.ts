/**
 * Streetwire's own site (15.6), at www.streetwire.com: the same feed the phone's app reads (the
 * newest posts, a post with its comments, a citizen's profile), and the player's place on it. To
 * comment the player joins with a name, a password and an e-mail address; the site e-mails a link
 * to confirm (it arrives in the city's webmail, 15.4; to any other address it goes nowhere). A
 * comment is read like a line said (sim/intent.ts) and the post's author may answer it a while later
 * in their own way of typing: thanks for a kind word, the place for "where is that?", where it
 * happened for "what happened?", "do I know you?" to a stranger asking their name, and a block for
 * a hostile one (no more comments on their posts). Strangers answer less than people met.
 */
import { hash3 } from '../core/rng';
import { districtAt } from '../sim/city';
import { Doing, whereIs } from '../sim/citizens';
import { comments, likes, type Feed, type Post } from '../sim/social';
import { accountOf, deliverMail } from '../sim/mail';
import { readLine } from '../sim/intent';
import { type World } from '../sim/world';
import { businessName, citizenNames, districtName } from '../locale/names';
import { commentText, postAge, postText, profileOf } from '../locale/social';
import { expand, rngOf, tidy } from '../locale/gen';
import { TEXT } from '../locale/text';
import { selFor, voice } from '../locale/voice';
import { cityNames } from '../talk';
import { type Block, type Page, type Theme } from './page';
import { mailDomain } from './webmail';

export const WIRE_HOST = 'www.streetwire.com';
const THEME: Theme = { page: [228, 233, 240], bg: [250, 251, 253], fg: [28, 32, 42], dim: [112, 120, 134], link: [40, 90, 180], head: [28, 52, 102], headFg: [255, 255, 255], bar: [44, 74, 136], barFg: [255, 255, 255] };
/** Posts on the front page. */
const FRONT = 25;

type Me = NonNullable<Feed['me']>;

/** The author's answer to the player's comment `text` on post p (null: they let it be), and whether they block the player. */
function answer(w: World, p: Post, text: string, me: Me, n: number): { reply: string | null; block: boolean } {
  const P = w.pop, who = p.who, R = readLine(text, cityNames(w)), W = w.weather;
  const knows = !!w.talks.get(who)?.face, hostile = R.respect <= -1 || R.intent === 'threaten';
  const h = (q: number) => hash3(w.seed ^ p.id, n, q);
  if (!hostile && !knows && h(1) > 0.35 + (P.social[who] / 255) * 0.5) return { reply: null, block: false };
  const block = hostile && (R.respect <= -2 || R.intent === 'threaten');
  const asks = (...ids: string[]) => ids.includes(R.intent);
  const key = block ? 'blocked' : hostile ? 'cold'
    : asks('thank', 'compliment', 'greet', 'yes') ? 'thanks'
    : asks('apologize') ? 'sorry'
    : asks('flirt') ? 'flirt'
    : asks('ask_how') ? 'how'
    : asks('ask_where', 'ask_directions') ? (p.biz >= 0 ? 'where' : 'wherearea')
    : asks('ask_event', 'ask_what_saw') ? (p.event >= 0 ? 'saw' : 'huh')
    : asks('ask_name', 'ask_number', 'ask_phone', 'claim_identity', 'ask_about_person') ? (knows ? 'friend' : 'who')
    : asks('complaint') ? 'complaint'
    : R.banter || asks('talk_sports', 'talk_weather') ? 'laugh'
    : asks('unrecognized', 'not_understood') ? 'huh' : 'okay';
  const r = rngOf(who, p.id, n), sel = selFor(P, who, w.time, W.temp, W.precip, W.snow, knows ? ['met'] : []);
  const c = w.city, ctx = { name: me.user, place: p.biz >= 0 ? businessName(c, p.biz) : '', district: districtName(c, districtAt(c, p.x, p.y)) };
  return { reply: voice(tidy(expand(`#wire.reply.${key}#`, TEXT, r, ctx, sel)), P, who, r), block };
}

/** A page of the site; a page sent by a form brings its boxes in `form`. */
export function wirePage(w: World, path: string, form?: Map<string, string>): Page {
  const F = w.feed, c = w.city, P = w.pop, me = F.me, on = !!me?.on && me.ok, f = (k: string) => (form?.get(k) ?? '').trim();
  const url = (p: string) => `http://${WIRE_HOST}${p}`;
  const nav: [string, string][] = on ? [['Home', url('/')], [`Signed in as ${me!.user}`, url('/')], ['Sign out', url('/logout')]] : [['Home', url('/')], ['Join', url('/join')], ['Sign in', url('/login')]];
  const page = (p: string, title: string, body: Block[], action?: string): Page => ({
    url: url(p), title: title ? `streetwire - ${title}` : 'streetwire', theme: THEME, form: action ? url(action) : undefined, mobile: true, kb: 30 + body.length * 2,
    blocks: [{ t: 'banner', text: 'streetwire', sub: "What's happening in your city, right now.", art: [' _/\\_ ', '<(sw)>', ' \\/\\/ '] }, { t: 'nav', links: nav }, ...body, { t: 'foot', text: '(c) 2008 Streetwire - About - Privacy - Help' }],
  });
  const note = (s: string): Block[] => (s ? [{ t: 'p', text: `>> ${s}` }] : []);
  const name = (i: number) => citizenNames(c, P, i).join(' ');
  const card = (p: Post): Block[] => [
    { t: 'p', text: `[${name(p.who)}](${url(`/u/${p.who}`)}) - ${postAge(w.time, p.time)} in ${districtName(c, districtAt(c, p.x, p.y))}` },
    { t: 'p', text: postText(c, P, p) + (p.photo ? ' [photo]' : '') },
    { t: 'p', text: `[${comments(P, p, w.time).length + (F.mine ?? []).filter((m) => m.post === p.id).length} comments](${url(`/post/${p.id}`)}) - ${likes(P, p, w.time)} likes` }, { t: 'hr' },
  ];
  const login = (msg = '') => page('/login', 'Sign in', [{ t: 'h', text: 'Sign in' }, ...note(msg), { t: 'input', name: 'user', label: 'Username:', size: 20 }, { t: 'input', name: 'pass', label: 'Password:', secret: true, size: 20 }, { t: 'submit', label: 'Sign In' }, { t: 'p', text: `Not on Streetwire yet? [Join now](${url('/join')})` }], '/login');
  const join = (msg = '') => page('/join', 'Join', [{ t: 'h', text: 'Join Streetwire' }, ...note(msg),
    { t: 'p', text: "It's free. Pick a username and a password, and give us your e-mail address: we will send you a link to confirm it." },
    { t: 'input', name: 'user', label: 'Username:', size: 16 }, { t: 'input', name: 'pass', label: 'Password:', secret: true, size: 20 }, { t: 'input', name: 'email', label: 'E-mail:', size: 32 }, { t: 'submit', label: 'Join' }], '/join');

  const post = (id: number, msg = ''): Page => {
    const p = F.posts.find((x) => x.id === id);
    if (!p) return page(`/post/${id}`, 'Not found', [{ t: 'h', text: 'This post is no longer available.' }, { t: 'p', text: `[Back to the feed](${url('/')})` }]);
    // their comments and the player's, in the order they went up
    const items: { t: number; b: Block[] }[] = comments(P, p, w.time).map((cm, k) => ({ t: cm.time, b: [{ t: 'p', text: `[${name(cm.who)}](${url(`/u/${cm.who}`)}) - ${postAge(w.time, cm.time)}` }, { t: 'p', text: `  ${commentText(c, P, p, cm, k)}` }] as Block[] }));
    for (const m of F.mine ?? []) if (m.post === id) {
      items.push({ t: m.time, b: [{ t: 'p', text: `${me?.user ?? 'you'} (you) - ${postAge(w.time, m.time)}` }, { t: 'p', text: `  ${m.text}` }] });
      if (m.reply && w.time >= m.at) items.push({ t: m.at, b: [{ t: 'p', text: `[${name(p.who)}](${url(`/u/${p.who}`)}) - ${postAge(w.time, m.at)}` }, { t: 'p', text: `  @${me?.user ?? 'you'} ${m.reply}` }] });
    }
    items.sort((a, b) => a.t - b.t);
    const blocked = !!me?.blocked.includes(p.who);
    const box: Block[] = !on ? [{ t: 'p', text: `[Sign in](${url('/login')}) or [join](${url('/join')}) to comment.` }]
      : blocked ? [{ t: 'p', text: "You can't comment on this person's posts." }]
      : [{ t: 'input', name: 'text', label: 'Your comment:', size: 60, max: 140 }, { t: 'submit', label: 'Comment' }];
    return page(`/post/${id}`, name(p.who), [...card(p).slice(0, 2), { t: 'p', text: `${likes(P, p, w.time)} likes` }, { t: 'h', text: 'Comments' }, ...note(msg),
      ...(items.length ? items.flatMap((x) => x.b) : [{ t: 'p', text: 'No comments yet.' } as Block]), { t: 'hr' }, ...box], on && !blocked ? `/comment/${id}` : undefined);
  };

  if (path === '/login') {
    if (!form) return login();
    if (!me || me.user !== f('user').toLowerCase() || me.pass !== (form.get('pass') ?? '')) return login('Wrong username or password.');
    if (!me.ok) return login(`Confirm your e-mail first: we sent a link to ${me.email}.`);
    me.on = true;
    return wirePage(w, '/');
  }
  if (path === '/logout') { if (me) me.on = false; return login('You are signed out.'); }
  if (path === '/join') {
    if (!form) return join();
    const user = f('user').toLowerCase(), email = f('email').toLowerCase();
    if (!/^[a-z0-9._]{3,20}$/.test(user)) return join('The username must be 3 to 20 letters, numbers, dots or underscores.');
    if ((form.get('pass') ?? '').length < 6) return join('The password must have at least 6 characters.');
    if (!/^[a-z0-9._]+@[a-z0-9.-]+\.[a-z]+$/.test(email)) return join('That does not look like an e-mail address.');
    const code = String(Math.floor(w.rng() * 1e8)).padStart(8, '0');
    F.me = { user, pass: form.get('pass')!, email, code, ok: false, on: false, blocked: me?.blocked ?? [] };
    // the link goes to the address given: only the city's own webmail receives it
    const [box, dom] = email.split('@');
    if (dom === mailDomain(w) && accountOf(w.mail, box)) deliverMail(w.mail, box, w.time, 'noreply@streetwire.com', 'Streetwire', 'Confirm your Streetwire account',
      [`Hi ${user},`, 'Thanks for joining Streetwire! Click the link below to confirm your e-mail address:', `[${url(`/confirm/${code}`)}](${url(`/confirm/${code}`)})`, 'If you did not join Streetwire, you can ignore this message.', 'The Streetwire Team']);
    return page('/join', 'Check your e-mail', [{ t: 'h', text: 'Almost there!' }, { t: 'p', text: `We sent a confirmation link to ${email}. Open it to finish joining.` }]);
  }
  const m = path.match(/^\/(post|u|confirm|comment)\/([0-9]+)$/);
  if (m?.[1] === 'confirm') {
    if (!me || me.code !== m[2]) return page(path, 'Link expired', [{ t: 'h', text: 'This link is not valid anymore.' }]);
    me.ok = true; me.on = true;
    return page(path, 'Welcome', [{ t: 'h', text: `Welcome to Streetwire, ${me.user}!` }, { t: 'p', text: `Your account is ready. [See what's happening](${url('/')})` }]);
  }
  if (m?.[1] === 'comment') {
    const id = +m[2], p = F.posts.find((x) => x.id === id), text = f('text');
    if (!on || !p || me!.blocked.includes(p.who)) return post(id);
    if (!text) return post(id, 'Write something first.');
    const mine = (F.mine ??= []), n = mine.length, A = answer(w, p, text, me!, n);
    // they answer a while later (after they wake up, if asleep)
    const asleep = whereIs(P, c, p.who, w.time).doing === Doing.Asleep;
    mine.push({ post: id, time: w.time, text, reply: A.reply, at: w.time + 300 + hash3(w.seed, id, n) * 2700 + (asleep ? 6 * 3600 : 0) });
    if (A.block) me!.blocked.push(p.who);
    return post(id);
  }
  if (m?.[1] === 'post') return post(+m[2]);
  if (m?.[1] === 'u') {
    const i = +m[2];
    if (!(i >= 0 && i < P.n)) return page(path, 'Not found', [{ t: 'h', text: 'No such person.' }]);
    const pr = profileOf(c, P, i), theirs = F.posts.filter((p) => p.who === i).slice(-10).reverse();
    return page(path, pr.name, [{ t: 'h', text: `${pr.name} (@${pr.handle})` },
      { t: 'table', rows: [['Age', String(pr.age)], ['Lives in', pr.home], ['Work', pr.work], ...(pr.status ? [['Status', pr.status]] : []), ['Likes', pr.likes.join(', ')], ['Friends', String(pr.friends)], ['Member since', pr.joined]] },
      { t: 'p', text: pr.bio }, { t: 'h', text: 'Posts' }, ...(theirs.length ? theirs.flatMap(card) : [{ t: 'p', text: 'Nothing posted lately.' } as Block])]);
  }
  if (path !== '/') return page(path, 'Not found', [{ t: 'h', text: 'Page not found.' }, { t: 'p', text: `[Back to the feed](${url('/')})` }]);
  const top = F.posts.slice(-FRONT).reverse();
  return page('/', '', [{ t: 'h', text: on ? `Hi ${me!.user}! What's happening now` : "What's happening now" }, ...(top.length ? top.flatMap(card) : [{ t: 'p', text: 'Quiet day. Nobody has posted yet.' } as Block])]);
}
