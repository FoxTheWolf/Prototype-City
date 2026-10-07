// 15.17g: the canonical pages. The portal (the top story with its photo, the weather's icon, the search
// box with the owl sent to Lookwise, the ads of the day from businesses that exist), Streetwire (the
// beta badge, every post with its author's face, what is trending, a tag's page), the webmail's sign-in
// (the box, the sunken boxes, the aqua button, 25 MB!), GridLink (the sector map lit as the grid is,
// down with its own sector), the Switchboard's shell (folders, category bars, who is online); and a
// picture of each (tests/.out/canon-<page>.png).
import { writeFileSync } from 'node:fs';
import { createWorld, stepWorld } from '../src/sim/world';
import { fetchUrl, webOf } from '../src/web/sites';
import { layout, type HdOp, type Page } from '../src/web/page';
import { mailHost } from '../src/web/webmail';
import { WIRE_HOST } from '../src/web/streetwire';
import { FORUM_HOST } from '../src/web/forum';
import { GRID_HOST, gridHome, sectorOf } from '../src/web/gridlink';
import { Browser } from '../src/web/browser';
import { looksOf } from '../src/sim/looks';
import { shot } from './png';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };
const w = createWorld(42), Wb = webOf(w);
// a day of the city, for the feed and the news
for (let i = 0; i < 20000; i++) stepWorld(w, { forward: 0, strafe: 0, run: false, heading: 0 });
const ops = (P: Page): HdOp[] => { const L = layout(P, 159); return [...L.back, ...L.front]; };
const has = (P: Page, k: HdOp['k']) => ops(P).some((o) => o.k === k);

// the portal
const portal = fetchUrl(w, Wb.portal).page!;
check('portal has a weather icon', has(portal, 'wx'));
check('portal has the owl', has(portal, 'owl'));
check('portal has its shine and tiles', has(portal, 'gloss') && has(portal, 'tile'));
check('portal sends its search to Lookwise', portal.form === 'http://www.lookwise.com/search');
const res = fetchUrl(w, portal.form!, new Map([['q', 'pizza']])).page!;
check('the portal search finds pizza', JSON.stringify(res.blocks).includes('Results 1 -'));
const ads = ops(portal).filter((o): o is Extract<HdOp, { k: 'ad' }> => o.k === 'ad');
check('portal has the provider ad and a business ad', ads.length >= 2 && ads.some((a) => a.name !== ads[0].name));

// Streetwire
const wire = fetchUrl(w, WIRE_HOST).page!;
check('streetwire has the beta badge', has(wire, 'ribbon'));
const faces = ops(wire).filter((o): o is Extract<HdOp, { k: 'face' }> => o.k === 'face');
check(`streetwire posts have faces (${faces.length} of ${Math.min(25, w.feed.posts.length)})`, faces.length === Math.min(25, w.feed.posts.length));
const top = w.feed.posts.slice(-1)[0];
if (top && faces[0]) {
  const L = looksOf(w.pop, top.who);
  check('the face is the author\'s (hair length, beard)', faces[0].face.hairLen === L.hairLen && faces[0].face.beard === L.beard);
}
const tag = JSON.stringify(wire.blocks).match(/\/tag\/([a-z]+)/)?.[1];
if (tag) check(`the tag page #${tag} lists posts`, JSON.stringify(fetchUrl(w, `${WIRE_HOST}/tag/${tag}`).page!.blocks).includes('"t":"avatar"'));
else console.log('(no trending word yet)');

// the webmail's sign-in
const mail = fetchUrl(w, mailHost(w)).page!;
check('mail has sunken boxes and the aqua button', has(mail, 'field') && has(mail, 'btn'));
check('mail says 25 MB!', has(mail, 'burst'));

// GridLink
const grid = fetchUrl(w, GRID_HOST + '/outages').page!, sec = ops(grid).find((o): o is Extract<HdOp, { k: 'sectors' }> => o.k === 'sectors')!;
check('gridlink maps every sector', !!sec && sec.labels.length === w.power.subs.length && sec.labels[0] === '1A');
check('gridlink has nine sectors', w.power.subs.length === 9 && sectorOf(w, 4) === '2B');
const other = gridHome(w) === 0 ? 1 : 0;
w.power.subs[other].on = false;
check('a dark sector shows on the map', JSON.stringify(fetchUrl(w, GRID_HOST + '/outages').page!.blocks).includes('OUTAGE'));
w.power.subs[gridHome(w)].on = false;
check('gridlink is down with its own sector', fetchUrl(w, GRID_HOST).error === 'down');
w.power.subs[gridHome(w)].on = true;

// the Switchboard's shell
const forum = fetchUrl(w, FORUM_HOST).page!;
check('forum has folders and category bars', has(forum, 'folder') && JSON.stringify(forum.blocks).includes('Who is online'));

// every canonical page lays out, on the notebook and on the phone
for (const u of [Wb.portal, `${Wb.portal}/news`, `${Wb.portal}/weather`, WIRE_HOST, mailHost(w), `${mailHost(w)}/signup`, GRID_HOST, `${GRID_HOST}/outages`, `${GRID_HOST}/report`, `${GRID_HOST}/about`, FORUM_HOST, `${FORUM_HOST}/b/lounge`]) {
  const G = fetchUrl(w, u);
  try { check(`${u} lays out`, !!G.page && layout(G.page, 159).rows.length > 3); } catch (e) { check(`${u} lays out (${(e as Error).message})`, false); }
}

for (const [name, u] of [['portal', Wb.portal], ['wire', WIRE_HOST], ['mail', mailHost(w)], ['grid', GRID_HOST], ['grid-outages', `${GRID_HOST}/outages`], ['forum', FORUM_HOST]]) {
  const B = new Browser(w, () => ({ up: true, kbps: 9000 }), () => {}, 160, 50, { read: (n: string) => (n === 'exceptions' ? FORUM_HOST : null), write: () => {} });
  B.go(u, 0);
  writeFileSync(`tests/.out/canon-${name}.png`, shot(B, 100));
}
console.log(bad ? `${bad} failed` : 'web-canon: all passed (pictures in tests/.out/canon-*.png)');
process.exit(bad ? 1 : 0);
