/**
 * The phone's browser (15.5), in Node:
 *   npx rolldown tests/phoneweb.ts --format esm --platform node -o tests/.out/phoneweb.mjs && node tests/.out/phoneweb.mjs [seed]
 * Ferret Mini from the store: the start page comes down over EDGE out of the data bundle (free on
 * Wi-Fi), a site made for phones weighs a fifth of a whole page, every page of the city fits the
 * 40-column screen in one column, the keys follow links and go back, an address is typed by
 * multi-tap, a box of the webmail is filled and sent, and no bundle left means no page.
 */
import { createWorld } from '../src/sim/world';
import { Phone } from '../src/phone/phone';
import { STORE } from '../src/phone/phone';
import { fetchUrl, portalUrl, searchUrl, webOf } from '../src/web/sites';
import { writeFileSync } from 'node:fs';
import { Img, Paint } from '../src/render/paint2d';
import { png } from './png';
import { layout, mobilePage, SUBMIT } from '../src/web/page';
import { mailHost } from '../src/web/webmail';
import { CharGrid } from '../src/render/grid';
import { Lcd } from '../src/phone/lcd';
import { type FerretMini } from '../src/phone/webapp';

/** The phone's browser lays pages out in 40 columns (the manual). */
const SW = 40;

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { if (++fails <= 30) console.log('FAIL ' + m); };

// every page of the city fits the phone's screen, in one column
const seen = new Set<string>(), queue = [portalUrl(w)];
let pages = 0, lite = 0, kbAll = 0, kbPhone = 0;
while (queue.length && pages < 600) {
  const u = queue.shift()!;
  if (seen.has(u)) continue;
  seen.add(u);
  const F = fetchUrl(w, u);
  if (!F.page) continue;
  pages++;
  const M = mobilePage(F.page, SW), L = layout(M, SW, true);
  kbAll += F.page.kb; kbPhone += M.kb; if (F.page.mobile) lite++;
  if (L.rows.some((r) => r.length !== SW)) fail(`a row not ${SW} wide on ${u}`);
  if (M.blocks.some((b) => b.t === 'cols')) fail(`columns left on ${u}`);
  for (const l of L.links) { if (l.x + l.w > SW) fail(`a link off the screen on ${u}: ${l.url}`); if (!l.url.startsWith(SUBMIT) && !seen.has(l.url)) queue.push(l.url); }
}
console.log(`  ${pages} pages on the phone, ${lite} made for phones; ${kbAll} KB whole, ${kbPhone} KB to the phone`);
if (kbPhone >= kbAll) fail('the phone pages are no lighter');

// the phone, with the browser from the store and service
const P = new Phone(w), idx = STORE.findIndex((a) => a[0] === 'web');
if (idx < 0) fail('no browser in the store');
P.apps.push(idx);
P.radio.state = 'service'; P.radio.bars = 3;
const g = new CharGrid(80, 40), S = new Lcd(g, 0, 0);
/** What the screen says: the strip, the page's rows, then any message, price question or Go to list. */
const screen = () => { const d = (P.web as unknown as { last: FerretMini }).last; return [d.right || d.url, ...d.rows.map((r) => (r ?? []).map((c) => c.ch).join('')), ...d.say, ...(d.ask ?? []), ...(d.go?.rows ?? [])]; };
/** The screen in pixels, to a PNG. */
const shotPng = (file: string) => { const J = new Img(240, 432), Q = new Paint(J); P.web.draw(S, now)(Q); const o = new Uint8ClampedArray(J.px.length); for (let k = 0; k < o.length; k += 4) { const a = J.px[k + 3] / 255; o[k] = J.px[k] * a; o[k + 1] = J.px[k + 1] * a; o[k + 2] = J.px[k + 2] * a; o[k + 3] = 255; } writeFileSync(file, png(o, 240, 432)); return J; };
let now = 100;
const run = (s: number) => { for (let t = 0; t < s; t += 0.1) { now += 0.1; P.radio.update(w, true, now, 0.1); P.radio.state = 'service'; P.radio.bars = 3; } };
const key = (k: string) => (P as unknown as { appKey(k: string, n: number): boolean }).appKey(k, now);
(P as unknown as { openApp(i: number, n: number, f: string): void }).openApp(idx, now, 'menu');
const kb0 = w.telco.player.dataKB;
run(1); P.web.draw(S, now);
if (!/Connecting|KB/.test(screen()[0])) fail('no loading at first: ' + screen()[0]);
run(20); P.web.draw(S, now);
for (const l of screen()) console.log('  |' + l);
const used = kb0 - w.telco.player.dataKB;
console.log(`  start page: ${used.toFixed(1)} KB of the bundle`);
if (used <= 0) fail('the page came free over EDGE');
// down to a link, OK follows it, Back comes back
const start = P.web.url;
// (to the first link elsewhere: the portal's first stops are its own Home and its search box)
const W = P.web as unknown as { items(): ({ url?: string })[]; sel: number; ask: unknown };
for (let i = 0; i < 12 && (!W.items()[W.sel]?.url || W.items()[W.sel]?.url === start); i++) key('down');
key('ok'); if (W.ask) key('lsoft'); run(20);
if (P.web.url === start) fail('OK on a link went nowhere');
console.log(`  followed: ${start} -> ${P.web.url}`);
key('rsoft'); run(20);
if (P.web.url !== start) fail('Back did not go back');
// Go to: the list with the bookmarks; the second one is the mail, picked with its number
key('lsoft'); P.web.draw(S, now); shotPng('tests/.out/phone-goto.png');
if (!screen().some((l) => l.includes('Lookwise'))) fail('no bookmarks in Go to');
key('2'); run(30);
if (!P.web.url.includes(mailHost(w))) fail('the Mail bookmark was not followed: ' + P.web.url);
key('rsoft'); run(20);
// an address by multi-tap: "mail" goes to a search; the webmail's host typed in full
key('lsoft'); key('ok');
const tap = (s: string) => { for (const c of s) { const k = { a: '2', b: '22', c: '222', d: '3', e: '33', f: '333', g: '4', h: '44', i: '444', j: '5', k: '55', l: '555', m: '6', n: '66', o: '666', p: '7', q: '77', r: '777', s: '7777', t: '8', u: '88', v: '888', w: '9', x: '99', y: '999', z: '9999', '.': '1', '0': '', '1': '', '2': '' }[c] ?? ''; for (const d of k) key(d); now += 1.2; } };
tap(mailHost(w));
key('ok'); run(30);
if (!P.web.url.includes(mailHost(w))) fail('the typed address was not followed: ' + P.web.url);
P.web.draw(S, now);
for (const l of screen().slice(0, 18)) console.log('  |' + l);
// the sign-in box: OK to type, OK to finish; the wrong password says so
key('ok'); tap('nobody'); key('ok');
key('down'); key('ok'); tap('wrongpass'); key('ok');
key('down'); key('ok'); run(30);
P.web.draw(S, now);
if (!screen().join('\n').includes('incorrect')) fail('the sign-in form did not go:\n' + screen().join('\n'));
// 15.17i: a whole page over EDGE asks its price first; No stays, Yes brings it with its pictures
const heavy = [...webOf(w).hosts.entries()].find(([h, S]) => S.kind === 'biz' && !fetchUrl(w, h).page?.mobile && JSON.stringify(fetchUrl(w, h).page?.blocks).includes('"photo"'))?.[0];
if (heavy) {
  const here = P.web.url;
  P.web.go(heavy, now);
  P.web.draw(S, now);
  if (!W.ask || !screen().join('\n').includes('may cost')) fail('a whole page came without asking its price');
  console.log('  asked: ' + ((P.web as unknown as { last: FerretMini }).last.ask ?? []).join(' / '));
  key('rsoft');
  if (W.ask || P.web.url !== here) fail('No did not stay');
  P.web.go(heavy, now); key('lsoft'); run(60);
  shotPng('tests/.out/phone-site.png');
  const X = (P.web as unknown as { last: FerretMini }).last.pix;
  let n = 0; if (X) for (let k = 3; k < X.front.length; k += 4) if (X.front[k] || X.back[k]) n++;
  if (!n) fail('the whole page brought no pictures');
  console.log(`  ${heavy}: ${n} pixels of pictures`);
}
P.web.go(portalUrl(w), now, false); run(20); shotPng('tests/.out/phone-portal.png');
P.web.go(searchUrl('pizza'), now, false); if (W.ask) key('lsoft'); run(30); shotPng('tests/.out/phone-lookwise.png');
// Wi-Fi: free; no bundle: no page
const kb1 = w.telco.player.dataKB;
P.radio.wifiKbps = 2000; key('*'); run(5); P.radio.wifiKbps = 0;
if (w.telco.player.dataKB !== kb1) fail('a page over Wi-Fi took from the bundle');
w.telco.player.dataKB = 0;
key('0'); run(20); P.web.draw(S, now);
if (!screen().join('\n').includes('Out of data')) fail('no bundle, and still a page');
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
