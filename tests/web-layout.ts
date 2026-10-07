// 15.17e: the page's pixels as data. A page with every new block: the operations fall in the cells laid
// for them, no picture lies over text, the links stay where they were; and a picture of it
// (tests/.out/web-kit.png) to judge the kit by eye.
import { writeFileSync } from 'node:fs';
import { layout, type Page, type HdOp } from '../src/web/page';
import { paintOps } from '../src/web/ops';
import { HdLayer, HdOrder } from '../src/render/hd';
import { onHd, Paint } from '../src/render/paint2d';
import { CH, CW } from '../src/web/chrome';
import { png } from './png';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };
const theme = { page: [214, 230, 214], bg: [255, 255, 250], fg: [20, 50, 30], dim: [100, 130, 110], link: [0, 110, 60], head: [30, 110, 60], headFg: [240, 255, 240], bar: [200, 230, 200], barFg: [20, 80, 40], gloss: true, tile: 'dots' } as Page['theme'];
const P: Page = {
  url: 'http://www.test.com/', title: 'Kit', theme, kb: 20,
  blocks: [
    { t: 'banner', text: 'Harbor Savings', sub: 'Since 1962 - Old Holloway' },
    { t: 'tabs', links: [['Home', 'http://www.test.com/'], ['Accounts', 'http://www.test.com/a'], ['Loans', 'http://www.test.com/l']], on: 0 },
    { t: 'hero', title: 'BANKING THAT WORKS', sub: 'as hard as you do. Free checking with direct deposit.', subj: 'store', seed: 7, btn: ['Open an account', 'http://www.test.com/open'] },
    { t: 'cols', widths: [0.6, 0.4], cols: [
      [{ t: 'h', text: 'News' }, { t: 'burst', label: 'NEW!', text: 'Online banking is here: [sign up](http://www.test.com/s).' }, { t: 'photo', subj: 'room', seed: 3, h: 7, caption: 'Our new branch on 5th Ave.' }, { t: 'stars', n: 4, text: '4 of 5, 212 reviews' }],
      [{ t: 'box', title: 'Find us', blocks: [{ t: 'map', seed: 11, pins: ['A', 'B'], h: 6 }, { t: 'p', text: '5th Ave at 12th St' }] }, { t: 'rss', text: '[News feed](http://www.test.com/rss)' }],
    ] },
    { t: 'marquee', text: 'Rates from 4.10% APY - ask a teller today!' },
    { t: 'ad', name: 'Burger Barn', text: 'Two Double Barns for $3!', url: 'http://www.burgerbarn.com/', c1: [214, 104, 14], c2: [255, 255, 255] },
    { t: 'hr' },
    { t: 'foot', text: '(c) 2008 Harbor Savings' },
  ],
};
const W = 160, L = layout(P, W);
check('the kit lays out with pixels under and over', L.back.length > 4 && L.front.length >= 6);
const kinds = new Set([...L.back, ...L.front].map((o) => o.k));
for (const k of ['gloss', 'tab', 'fade', 'btn', 'box', 'tile', 'shadow', 'photo', 'map', 'stars', 'burst', 'rss', 'marquee', 'ad', 'big']) check(`an op of kind ${k}`, kinds.has(k as HdOp['k']));
// no picture over text: every cell under a front op (photo, map, ad) is blank
for (const o of L.front) {
  if (!('w' in o) || !('h' in o) || o.k === 'marquee' || o.k === 'big') continue;
  for (let y = Math.floor(o.y); y < Math.ceil(o.y + o.h); y++) for (let x = Math.floor(o.x); x < Math.ceil(o.x + o.w); x++) {
    const c = L.rows[y]?.[x];
    if (c && c.ch !== ' ') { check(`no text under the ${o.k} at ${x},${y} ("${c.ch}")`, false); y = 1e9; break; }
  }
}
check('the hero button is a link', L.links.some((l) => l.url.endsWith('/open')));
check('the ad is a link over its rows', L.links.filter((l) => l.url.includes('burgerbarn')).length >= 3);
check('the tabs are links', L.links.some((l) => l.url.endsWith('/l')));
const L2 = layout(P, W);
check('the same page lays out the same', JSON.stringify(L2.front) === JSON.stringify(L.front));

// the picture: the page from its top, 46 rows of it
const rows = 50, Hd = new HdLayer(W * CW, rows * CH), Pa = new Paint(onHd(Hd, HdOrder.Under));
paintOps(Pa, L.back, 0, 0, 0);
for (let r = 0; r < rows; r++) for (let c = 0; c < W; c++) {
  const cell = L.rows[r]?.[c];
  if (!cell) continue;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (Hd.at(c * CW + x, r * CH + y) < 0) Hd.put(c * CW + x, r * CH + y, cell.bg[0], cell.bg[1], cell.bg[2], HdOrder.Under);
  if (cell.ch !== ' ') Pa.text(c * CW + 1, r * CH + 4, cell.ch, 1, cell.fg);
}
paintOps(new Paint(onHd(Hd, HdOrder.Over)), L.front, 0, 0, 0);
writeFileSync('tests/.out/web-kit.png', png(Hd.px, Hd.w, Hd.h));
console.log(bad ? `${bad} failed` : 'web-layout: all passed (picture in tests/.out/web-kit.png)');
process.exit(bad ? 1 : 0);
