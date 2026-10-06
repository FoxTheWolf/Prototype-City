/**
 * Streetwire's site (15.6), in Node:
 *   npx rolldown tests/wire-web.ts --format esm --platform node -o tests/.out/wire-web.mjs && node tests/.out/wire-web.mjs [seed]
 * A few hours of posts, then: the front page and every post and profile it links to lay out with
 * no hole; joining sends the confirming link to the city's webmail (and nowhere for another
 * address); the link signs the player in; a comment is read and the author answers some of them in
 * kind (the place for "where is that?", thanks for a kind word), later; a hostile one gets the player
 * blocked from that author's posts. Prints a post with its comments.
 */
import { createWorld } from '../src/sim/world';
import { stepSocial } from '../src/sim/social';
import { fetchUrl } from '../src/web/sites';
import { layout, SUBMIT } from '../src/web/page';
import { WIRE_HOST } from '../src/web/streetwire';
import { letters, mailDomain } from '../src/web/webmail';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { if (++fails <= 30) console.log('FAIL ' + m); };
for (let k = 0; k < 6 * 60; k++) { w.time += 60; stepSocial(w.feed, w.pop, w.city, w.events, w.power, w.weather, w.seed, w.time, 60); }
console.log(`  ${w.feed.posts.length} posts`);
const U = `http://${WIRE_HOST}`;
const text = (u: string, form?: Record<string, string>) => {
  const P = fetchUrl(w, u, form && new Map(Object.entries(form))).page!;
  return layout(P, 159).rows.map((r) => r.map((x) => x.ch).join('').trimEnd()).join('\n');
};

// the front page, its posts and profiles
const seen = new Set<string>(), queue = [U + '/'];
let pages = 0;
while (queue.length && pages < 120) {
  const u = queue.shift()!;
  if (seen.has(u)) continue;
  seen.add(u);
  const F = fetchUrl(w, u);
  if (!F.page) { fail('nowhere: ' + u); continue; }
  pages++;
  const L = layout(F.page, 159), t = L.rows.map((r) => r.map((x) => x.ch).join('')).join('\n');
  const hole = t.split('\n').find((l) => /[{}]|#[a-z]/.test(l));
  if (hole) fail(`a hole on ${u}: ${hole.trim()}`);
  for (const l of L.links) if (l.url !== SUBMIT && l.url.includes(WIRE_HOST) && !seen.has(l.url) && !/logout|confirm/.test(l.url)) queue.push(l.url);
}
console.log(`  crawled ${pages} pages`);

// join: a link to an address outside the city's webmail goes nowhere; to the webmail, it arrives
text(U + '/join', { user: 'zed', pass: 'secret1', email: 'zed@elsewhere.com' });
if (w.feed.me?.ok) fail('confirmed with no link');
w.mail.accounts.push({ user: 'zed01', pass: 'x', num: w.telco.player.number, made: w.time, read: new Set(), gone: new Set(), extra: [] });
text(U + '/join', { user: 'Zed_01', pass: 'secret1', email: `zed01@${mailDomain(w)}` });
const L1 = letters(w, w.mail.accounts[0]).find((l) => /Streetwire/.test(l.subject));
const link = L1?.body.join(' ').match(/\((http:\/\/www\.streetwire\.com\/confirm\/\d+)\)/)?.[1];
if (!link) fail('no confirming link in the webmail');
if (!/sign in or join/i.test(text(U + `/post/${w.feed.posts.at(-1)!.id}`))) fail('a post asks nothing of a player signed out');
if (!/Welcome to Streetwire/.test(text(link!))) fail('the link did not confirm');
if (!w.feed.me?.on) fail('the link did not sign in');

// comments: kind words, a question about the place, a hostile one
const withBiz = w.feed.posts.filter((p) => p.biz >= 0).slice(-12), plain = w.feed.posts.filter((p) => p.biz < 0).slice(-12);
for (const p of plain) text(U + `/comment/${p.id}`, { text: 'love this, thanks for sharing!' });
for (const p of withBiz) text(U + `/comment/${p.id}`, { text: 'where is that?' });
const mine = w.feed.mine!;
const kind = mine.slice(0, plain.length).filter((m) => m.reply), where = mine.slice(plain.length).filter((m) => m.reply);
console.log(`  answers: ${kind.length}/${plain.length} to kind words, ${where.length}/${withBiz.length} to "where is that?"`);
console.log('  e.g. ' + kind.slice(0, 3).map((m) => m.reply).join(' / ') + ' / ' + where.slice(0, 3).map((m) => m.reply).join(' / '));
if (!kind.length || !where.length) fail('nobody answered');
const P0 = mine[plain.length], before = text(U + `/post/${P0.post}`);
if (P0.reply && before.includes(P0.reply)) fail('the answer showed before its time');
w.time += 86400;
const after = text(U + `/post/${P0.post}`);
if (P0.reply && !after.includes(P0.reply.slice(0, 12))) fail('the answer did not show:\n' + after);
for (const l of after.split('\n').filter((l) => l.trim()).slice(6, 40)) console.log('  |' + l);
// hostile: the author blocks the player from their posts
const target = w.feed.posts.at(-1)!;
text(U + `/comment/${target.id}`, { text: 'you are a stupid idiot, shut up' });
const blocked = w.feed.me!.blocked.includes(target.who);
console.log(`  hostile: ${blocked ? 'blocked' : 'not blocked'}; reply: ${w.feed.mine!.at(-1)!.reply}`);
if (!blocked) fail('a hostile comment did not get the player blocked');
if (!/can't comment/.test(text(U + `/post/${target.id}`))) fail('a blocked player can still comment');
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
