// 15.17j: the 88 x 31 seals and Burrow Labs. The seals by the template (the 1998 home page always has the
// counter and two or three more, the free-hosted page the "under construction", the corporate never one,
// the portal its "powered by"); the counter grows as the city lives; "Get Ferret"/"Best viewed" lead to
// burrow-labs.net, which lists its team (real citizens of an office tower), comes down with that tower's
// sector, is in Lookwise and in the factory bookmarks. Pictures: tests/.out/seals-<page>.png.
//   npx rolldown tests/web-seals.ts --format esm --platform node -o tests/.out/web-seals.mjs && node tests/.out/web-seals.mjs
import { writeFileSync } from 'node:fs';
import { createWorld } from '../src/sim/world';
import { subAt } from '../src/sim/power';
import { fetchUrl, searchUrl, webOf } from '../src/web/sites';
import { layout, type HdOp, type Page } from '../src/web/page';
import { BURROW_HOST, burrowHome } from '../src/web/burrow';
import { Browser, factoryMarks } from '../src/web/browser';
import { shot } from './png';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };
const w = createWorld(42), Wb = webOf(w);
const seals = (P: Page) => layout(P, 159).front.filter((o): o is Extract<HdOp, { k: 'seal' }> => o.k === 'seal');

// every business's front page: which seals, and how many sites have each
const count: Record<string, number> = {};
let center = '', bare = '', none = 0, sites = 0;
for (const [host, S] of Wb.hosts) {
  if (S.kind !== 'biz') continue;
  const P = fetchUrl(w, host).page;
  if (!P) continue;
  sites++;
  const K = seals(P);
  if (!K.length) none++;
  for (const s of K) count[s.kind] = (count[s.kind] ?? 0) + 1;
  if (!center && K.some((s) => s.kind === 'counter')) center = host;
  if (!bare && K.some((s) => s.kind === 'uc')) bare = host;
}
console.log(`  ${sites} sites, ${none} without seals:`, count);
check('a 1998 home page has a counter', !!center);
check('a free-hosted page is under construction', !!bare);
check('nobody but the portal says powered by', !count.powered);
check('the portal is powered by its provider', seals(fetchUrl(w, Wb.portal).page!).some((s) => s.kind === 'powered' && !!s.text));
// the counter grows with the days, and "Best viewed" goes to the maker
const n0 = seals(fetchUrl(w, center).page!).find((s) => s.kind === 'counter')!.n!;
w.time += 3 * 86400;
const n1 = seals(fetchUrl(w, center).page!).find((s) => s.kind === 'counter')!.n!;
w.time -= 3 * 86400;
check(`the counter grows (${n0} -> ${n1})`, n1 > n0);
const L = layout(fetchUrl(w, center).page!, 159);
check('a seal links to burrow-labs.net', L.links.some((l) => l.url.includes(BURROW_HOST)));

// Burrow Labs
const B = burrowHome(w), about = fetchUrl(w, `${BURROW_HOST}/about`).page!;
check(`the team is ten real people (${B.staff.length})`, B.staff.length === 10);
check('the about page lists the team', JSON.stringify(about.blocks).includes('The team'));
for (const p of ['/', '/download', '/notes', '/bugs', '/about', '/nope']) check(`burrow ${p} lays out`, layout(fetchUrl(w, BURROW_HOST + p).page!, 159).rows.length > 5);
check('Lookwise finds the Ferret', JSON.stringify(fetchUrl(w, searchUrl('ferret browser')).page!.blocks).includes(BURROW_HOST));
check('Ferret Help is a factory bookmark', factoryMarks(w).some(([t, u]) => t === 'Ferret Help' && u.includes(BURROW_HOST)));
const sub = subAt(w.power, w.city, ...B.at);
w.power.subs[sub].on = false;
check('burrow-labs.net is down with its block', fetchUrl(w, BURROW_HOST).error === 'down');
w.power.subs[sub].on = true;

// the pictures (the bottom of the long pages, where the seals are)
for (const [name, u, end] of [['center', center, true], ['bare', bare, false], ['portal', Wb.portal, true], ['burrow', BURROW_HOST, false], ['burrow-about', `${BURROW_HOST}/about`, false]] as [string, string, boolean][]) {
  const Br = new Browser(w, () => ({ up: true, kbps: 9000 }), () => {}, 160, 50, { read: () => null, write: () => {} });
  Br.go(u, 0);
  if (end) Br.scroll(999);
  writeFileSync(`tests/.out/seals-${name}.png`, shot(Br, 100));
}
console.log(bad ? `${bad} failed` : 'web-seals: all passed (pictures in tests/.out/seals-*.png)');
process.exit(bad ? 1 : 0);
