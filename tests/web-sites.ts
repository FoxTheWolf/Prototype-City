// 15.17f: the six templates as years of the web. 200 business sites of seed 42: every page of each lays
// out, every template shows up, the photos follow the kind of place, no site carries its own ad; and a
// picture of one site per template (tests/.out/site-<template>.png).
import { writeFileSync } from 'node:fs';
import { createWorld } from '../src/sim/world';
import { certOf, fetchUrl, webOf } from '../src/web/sites';
import { layout, type Block, type Page } from '../src/web/page';
import { Browser } from '../src/web/browser';
import { shot } from './png';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };
const w = createWorld(42), Wb = webOf(w);
const tplOf = (P: Page): string => {
  const B = P.blocks;
  if (B[0]?.t === 'marquee') return 'center';
  if (B[0]?.t === 'ad') return 'bare';
  if (B[0]?.t === 'photo') return 'leftnav';
  if (B.some((x) => x.t === 'tabs')) return 'side';
  if (B.some((x) => x.t === 'cols' && false) || JSON.stringify(B).includes('"t":"hero"')) return 'corporate';
  return 'classic';
};
const all = (bs: Block[]): Block[] => bs.flatMap((b) => [b, ...(b.t === 'cols' ? all(b.cols.flat()) : b.t === 'box' ? all(b.blocks) : [])]);
const FOOD = ['diner', 'cafe', 'pizza', 'deli', 'fastfood'];
const seen = new Map<string, string>();
let n = 0;
for (const [k, host] of [...Wb.byBiz.entries()].slice(0, 200)) {
  const G = fetchUrl(w, host);
  if (!G.page) continue; // a site in the dark
  n++;
  const P = G.page, kind = w.city.businesses[k].kind, t = tplOf(P);
  if (!seen.has(t) && certOf(w, host) !== 'bad') seen.set(t, host);
  for (const path of ['/', '/menu', '/products', '/about', '/contact', '/rooms', '/rates', '/showtimes', '/branches', '/nothere']) {
    const Q = fetchUrl(w, host + path).page;
    try { const L = layout(Q!, 159); if (!L.rows.length) check(`${host}${path} has rows`, false); } catch (e) { check(`${host}${path} lays out (${(e as Error).message})`, false); }
  }
  const photos = all(P.blocks).filter((b): b is Extract<Block, { t: 'photo' }> => b.t === 'photo' && b.subj !== 'sky');
  for (const ph of photos) check(`${host}: a ${kind} shows ${ph.subj}`, FOOD.includes(kind) ? ph.subj === 'food' : kind === 'bar' || kind === 'liquor' ? ph.subj === 'bar' : true);
  for (const ad of all(P.blocks).filter((b) => b.t === 'ad')) check(`${host} carries no ad of its own`, !(ad as { url: string }).url.includes(host));
}
check('some sites were up', n > 50);
for (const t of ['center', 'classic', 'leftnav', 'side', 'corporate', 'bare']) check(`the ${t} template shows up`, seen.has(t));
for (const [t, host] of seen) {
  const B = new Browser(w, () => ({ up: true, kbps: 9000 }), () => {}, 160, 50, null);
  B.go(host, 0);
  writeFileSync(`tests/.out/site-${t}.png`, shot(B, 100));
}
console.log(bad ? `${bad} failed` : `web-sites: all passed (${n} sites; ${[...seen.keys()].join(', ')}; pictures in tests/.out/site-*.png)`);
process.exit(bad ? 1 : 0);
