/**
 * The city's web and the browser (15.1), in Node:
 *   npx rolldown tests/web.ts --format esm --platform node -o tests/.out/web.mjs && node tests/.out/web.mjs [seed]
 * The sites exist from the start (a share of the businesses, the small ones less); the portal and
 * every business's pages lay out with no hole ({ } # left from the grammar) and every link on them
 * leads to a page of the city; a site whose building is in a blackout times out; a host that does
 * not exist is not found; the browser brings a page down at the Wi-Fi's speed and follows links by
 * keys. Prints the start page as the browser draws it.
 */
import { createWorld } from '../src/sim/world';
import { subAt, switchSub } from '../src/sim/power';
import { logEvent } from '../src/sim/events';
import { placeAt } from '../src/phone/places';
import { fetchUrl, portalUrl, webOf } from '../src/web/sites';
import { layout } from '../src/web/page';
import { Browser } from '../src/web/browser';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { if (++fails <= 30) console.log('FAIL ' + m); };
const W = webOf(w), c = w.city;
const byKind = new Map<string, [number, number]>();
c.businesses.forEach((b, k) => { const e = byKind.get(b.kind) ?? [0, 0]; e[1]++; if (W.byBiz.has(k)) e[0]++; byKind.set(b.kind, e); });
console.log(`  ${W.hosts.size} sites; portal ${W.portal}`);
console.log('  ' + [...byKind].map(([k, [a, n]]) => `${k} ${a}/${n}`).join(', '));

// crawl from the portal: every link a page of the city, no hole in any text
const seen = new Set<string>(), queue = [portalUrl(w)];
let pages = 0, links = 0;
const kinds = new Set<string>();
while (queue.length && pages < 3000) {
  const u = queue.shift()!;
  if (seen.has(u)) continue;
  seen.add(u);
  const F = fetchUrl(w, u);
  if (!F.page) { fail(`a link leads nowhere: ${u} (${F.error})`); continue; }
  pages++;
  const L = layout(F.page, 159), text = L.rows.map((r) => r.map((x) => x.ch).join('')).join('\n');
  if (/[{}#]/.test(text.replace(/\[#+ *\]/g, '').replace(/[#]{2,}/g, ''))) { const m = text.split('\n').find((l) => /[{}]/.test(l)); if (m) fail(`a hole on ${u}: ${m.trim()}`); }
  for (const l of L.links) { links++; if (!seen.has(l.url)) queue.push(l.url); }
  const tail = u.split('/').slice(3).join('/'); if (tail) kinds.add(tail.replace(/\d+/g, 'N'));
}
console.log(`  crawled ${pages} pages, ${links} links; pages: ${[...kinds].sort().join(' ')}`);
for (const want of ['showtimes', 'rooms', 'rates', 'branches', 'menu', 'products', 'about', 'contact']) if (![...kinds].some((x) => x === want)) fail(`no ${want} page reached`);
if (pages < 20) fail('the crawl found too few pages');

// a blackout takes a site down; a host that does not exist is not found
const k = [...W.byBiz.keys()][0], host = W.byBiz.get(k)!;
const [x, y] = placeAt(c, k), s = subAt(w.power, c, x, y);
switchSub(w.power, s, false, w.tick, x, y);
if (fetchUrl(w, host).error !== 'down') fail('a site in a blackout still answers');
switchSub(w.power, s, true, w.tick, x, y);
logEvent(w.events, 'restored', w.tick, w.time, x, y, 0.8, [s]);
const back = fetchUrl(w, host).page;
if (!back) fail('the site did not come back with the power');
else if (!back.blocks.some((b) => b.t === 'ad' && /outage|blackout|back|lights/i.test(b.text))) fail('back after a blackout, the site says nothing');
if (fetchUrl(w, 'www.nosuchplaceatall.com').error !== 'dns') fail('a made-up host was found');

// the browser: the start page comes down at the line's speed, Tab picks a link, Enter follows it
let up = true;
const B = new Browser(w, () => ({ up, kbps: 900 }), () => {}, 160, 50);
B.go('', 0);
const S0 = B.cells(0.2).scr, loading = S0.ch[48].join('');
if (!/Looking up/.test(loading)) fail('no lookup at first: ' + loading.trim());
const S = B.cells(10).scr;
for (let r = 0; r < 26; r++) console.log('  |' + S.ch[r].join('').trimEnd());
B.key('Tab', false, 10); B.key('Tab', false, 10);
const before = B.url;
B.key('Enter', false, 10);
if (B.url === before) fail('Enter on a link went nowhere');
console.log(`  followed: ${before} -> ${B.url}`);
B.key('Backspace', false, 11);
if (B.url !== before) fail('Backspace did not go back');
up = false; B.go('', 12);
if (!/Not connected/.test(B.cells(13).scr.ch[48].join(''))) fail('no network, and still a page');
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
