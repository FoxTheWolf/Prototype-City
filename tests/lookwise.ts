// 15.17h: Lookwise and its owl. What went up during the day (a post, a headline) is only found after the
// night's crawl at 3 am; local results are the places of the kind asked for nearest to the player; a site
// in the dark stays listed and does not open; Owl's Pick opens the first result; ten results a page, the
// pages as eyes; "Hoo?" when nothing matches; the owl flies on the start page from 2 to 5 am. Pictures of
// each page in tests/.out/lookwise-*.png.
import { writeFileSync } from 'node:fs';
import { createWorld, stepWorld } from '../src/sim/world';
import { calendar } from '../src/sim/clock';
import { subAt } from '../src/sim/power';
import { placeAt } from '../src/phone/places';
import { businessName, citizenNames } from '../src/locale/names';
import { newsStories } from '../src/locale/news';
import { crawl, fetchUrl, searchUrl, webOf } from '../src/web/sites';
import { layout, type Block, type HdOp, type Page } from '../src/web/page';
import { Browser } from '../src/web/browser';
import { shot } from './png';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };
const w = createWorld(42), Wb = webOf(w);
let t0 = performance.now();
crawl(w);
console.log(`first crawl (the sites): ${(performance.now() - t0).toFixed(1)} ms, ${crawl(w).index.length} pages`);
// a stretch of the city, the crawler looking every game minute as the game does
let min = -1;
for (let i = 0; i < 20000; i++) { stepWorld(w, { forward: 0, strafe: 0, run: false, heading: 0 }); if (Math.floor(w.time / 60) !== min) { min = Math.floor(w.time / 60); crawl(w); } }
const blocks = (P: Page): Block[] => P.blocks.flatMap(function f(B: Block): Block[] { return B.t === 'cols' ? B.cols.flat().flatMap(f) : B.t === 'box' ? [B, ...B.blocks.flatMap(f)] : [B]; });
const search = (q: string, p = 1) => fetchUrl(w, searchUrl(q, p));
const urls = (P: Page) => blocks(P).filter((B): B is Extract<Block, { t: 'hit' }> => B.t === 'hit').map((B) => B.url);

// a post of today: not found today, found after the night
const C = crawl(w), post = w.feed.posts[w.feed.posts.length - 1];
check(`posts wait for the night (${C.pending.length} pending)`, C.pending.length > 0);
const who = post ? citizenNames(w.city, w.pop, post.who).join(' ') : '';
const purl = post ? `http://www.streetwire.com/post/${post.id}` : '';
check('a post of today is not found yet', !!post && !urls(search(who).page!).includes(purl));
const story = newsStories(w).find((S) => S.kind !== 'date' && S.kind !== 'weather');
console.log(`clock ${calendar(w.time).hour.toFixed(2)} h, ${w.feed.posts.length} posts, story: ${story?.head ?? '(none)'}`);
// past the next 3 am
const D = 86400, next = Math.floor((w.time - 3 * 3600) / D + 1) * D + 3 * 3600 + 30;
w.time = next;
t0 = performance.now();
crawl(w);
console.log(`the night's crawl: ${(performance.now() - t0).toFixed(1)} ms, found ${crawl(w).found}, ${crawl(w).index.length} pages`);
check('the night found the day\'s pages', crawl(w).found > 0);
check('the post is found after the night', urls(search(who).page!).includes(purl));
if (story) {
  const id = `${story.kind}-${story.key}`, r = search(story.district || story.head.split(' ').slice(0, 3).join(' '));
  check(`the headline is in the index (${id})`, crawl(w).index.some((d) => d.url.endsWith(`/story/${id}`)));
  const sp = fetchUrl(w, `${Wb.portal}/story/${id}`).page!;
  check('its story opens on the portal', JSON.stringify(sp.blocks).includes(story.head));
  void r;
}

// local results: the three pizzerias nearest to the player, in order
const pz = search('pizza').page!, pzB = blocks(pz);
const near = w.city.businesses.map((b, k) => ({ b, k })).filter(({ b }) => b.kind === 'pizza').map(({ k }) => { const [x, y] = placeAt(w.city, k); return { k, d: Math.hypot(x - w.player.x, y - w.player.y) }; }).sort((a, b) => a.d - b.d).slice(0, 3);
const listed = pzB.filter((B): B is Extract<Block, { t: 'p' }> => B.t === 'p' && /^[ABC]  /.test(B.text)).map((B) => B.text.slice(3).replace(/^\[([^\]]+)\].*$/, '$1'));
check(`locals by distance (${listed.join(' / ')})`, listed.length === near.length && listed.every((n, i) => n === businessName(w.city, near[i].k)));
const L = layout(pz, 159), map = L.front.find((o): o is Extract<HdOp, { k: 'map' }> => o.k === 'map');
check('the local map has its pins where they are', !!map && map.spots?.length === near.length && map.spots.every(([x, y]) => x > 0 && x < 1 && y > 0 && y < 1));
check('sponsored links on the right', JSON.stringify(pz.blocks).includes('Sponsored Links'));
check('the words searched are lit', L.rows.some((r) => r.some((c) => c.bg[0] === 255 && c.bg[1] === 236)));

// a site in the dark: still listed, does not open
const first = urls(pz).find((u) => u.includes('pizza') || true)!, host = first.replace(/^http:\/\//, '').split('/')[0], S = Wb.hosts.get(host);
if (S?.kind === 'biz') {
  const [x, y] = placeAt(w.city, S.k), sub = subAt(w.power, w.city, x, y);
  w.power.subs[sub].on = false;
  check('a site in the dark is still listed', urls(search('pizza').page!).includes(first));
  check('and does not open', fetchUrl(w, first).error === 'down');
  w.power.subs[sub].on = true;
}

// Owl's Pick: the first result's own page
const pick = fetchUrl(w, `http://www.lookwise.com/search`, new Map([['q', 'pizza'], ['pick', '1']]));
check(`Owl's Pick opens the first result (${pick.page?.url})`, pick.page?.url === urls(pz)[0]);

// pages of ten, as eyes
const many = search('food'), m2 = search('food', 2);
const eyes = blocks(many.page!).find((B) => B.t === 'eyes');
check('ten a page, the pages as eyes', urls(many.page!).length === 10 && !!eyes && layout(many.page!, 159).front.some((o) => o.k === 'eyes'));
check('page 2 is other results', urls(m2.page!).length > 0 && !urls(m2.page!).some((u) => urls(many.page!).includes(u)));
check('a search makes the owl think', (many.think ?? 0) > 0.4);

// nothing found: Hoo?
const none = search('zzqx').page!;
check('nothing: the owl tilts its head', blocks(none).some((B) => B.t === 'owl' && B.mood === 'hoo'));

// the start page: the owl out between 2 and 5 am
const home = fetchUrl(w, 'http://www.lookwise.com/').page!;
check('the start page has the logo and two buttons', layout(home, 159).front.some((o) => o.k === 'lwlogo') && layout(home, 159).links.filter((l) => l.url.startsWith('submit:')).length === 2);
const night = blocks(home).find((B): B is Extract<Block, { t: 'owl' }> => B.t === 'owl');
check(`at 3 am the owl is out (${night?.lines[0]})`, night?.mood === 'fly');

// every Lookwise page lays out on the phone too
for (const P of [home, pz, none]) { try { layout(P, 30, true); } catch (e) { check(`phone layout (${(e as Error).message})`, false); } }

const B = (u: string, at = 100) => { const b = new Browser(w, () => ({ up: true, kbps: 9000 }), () => {}, 160, 50, null); b.go(u, 0); return shot(b, at); };
writeFileSync('tests/.out/lookwise-night.png', B('http://www.lookwise.com/'));
w.time += 9 * 3600;
writeFileSync('tests/.out/lookwise-home.png', B('http://www.lookwise.com/'));
writeFileSync('tests/.out/lookwise-pizza.png', B(searchUrl('pizza')));
writeFileSync('tests/.out/lookwise-hoo.png', B(searchUrl('zzqx')));
writeFileSync('tests/.out/lookwise-searching.png', B(searchUrl('pizza'), 1.1));
console.log(bad ? `${bad} failed` : 'lookwise: all passed (pictures in tests/.out/lookwise-*.png)');
process.exit(bad ? 1 : 0);
