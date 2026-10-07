/**
 * The city's web and the browser (15.1), in Node:
 *   npx rolldown tests/web.ts --format esm --platform node -o tests/.out/web.mjs && node tests/.out/web.mjs [seed]
 * The sites exist from the start (a share of the businesses, the small ones less); the portal and
 * every business's pages lay out with no hole ({ } # left from the grammar) and every link on them
 * leads to a page of the city; a site whose building is in a blackout times out; a host that does
 * not exist is not found; the browser brings a page down at the Wi-Fi's speed and follows links by
 * keys. The webmail (15.4): sign up by a code texted to the line, the box with the welcome, the bank's
 * statement and the newsletters of the shops paid at, delete, sign out and in, a reset that never
 * arrives once the SIM is changed, and the browser filling in a form by keys. Prints the start page
 * and the inbox as the browser draws them.
 */
import { createWorld } from '../src/sim/world';
import { subAt, switchSub } from '../src/sim/power';
import { logEvent } from '../src/sim/events';
import { placeAt } from '../src/phone/places';
import { fetchUrl, portalUrl, searchUrl, webOf } from '../src/web/sites';
import { businessName } from '../src/locale/names';
import { layout, SUBMIT } from '../src/web/page';
import { Browser } from '../src/web/browser';
import { mailHost } from '../src/web/webmail';
import { post } from '../src/sim/bank';

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
  for (const l of L.links) { links++; if (l.url !== SUBMIT && !seen.has(l.url)) queue.push(l.url); }
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

// the search engine (15.3): finds the sites by what they are and their name; a shop without a site is not in it
const res = (q: string) => { const P = fetchUrl(w, searchUrl(q)).page!; return P.blocks.filter((b) => b.t === 'p' && /^\[/.test(b.text)).map((b) => (b as { text: string }).text); };
const pz = res('pizza');
console.log(`  "pizza": ${pz.length} results, first ${pz[0]}`);
if (!pz.length || !pz.slice(0, 5).some((t) => /pizz|slice/i.test(t) || /pizza/.test(t))) fail('a search for pizza found no pizzeria first');
const sited = [...W.byBiz.keys()][3], nameS = businessName(c, sited);
if (!res(nameS).some((t) => t.includes(nameS))) fail(`a site not found by its own name: ${nameS}`);
// (a name of its own: "Beer Wine Liquor" is the name of several shops, some of them online)
const sitedNames = new Set([...W.byBiz.keys()].map((k) => businessName(c, k)));
const unsited = c.businesses.findIndex((b, k) => !W.byBiz.has(k) && (b.hq ?? k) === k && !sitedNames.has(businessName(c, k))), nameU = businessName(c, unsited);
if (res(nameU).some((t) => t.startsWith(`[${nameU}]`))) fail(`a shop without a site found: ${nameU}`);
if (res('zzqqxx').length) fail('nonsense found something');

// the browser: the start page comes down at the line's speed, Tab picks a link, Enter follows it
let up = true;
const B = new Browser(w, () => ({ up, kbps: 900 }), () => {}, 160, 50);
B.go('', 0);
const S0 = B.cells(0.2).scr, loading = S0.ch[49].join('');
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
B.key('F6', false, 11.5); for (const ch of 'cheap pizza') B.key(ch, false, 11.5); B.key('Enter', false, 11.5);
if (!B.url.includes('lookwise.com/search?q=cheap+pizza')) fail('words in the address are not a search: ' + B.url);
up = false; B.go('', 12);
if (!/Not connected/.test(B.cells(13).scr.ch[49].join(''))) fail('no network, and still a page');

// the webmail (15.4)
const MH = `http://${mailHost(w)}`, M = w.mail;
const send = (path: string, f: Record<string, string>) => fetchUrl(w, MH + path, new Map(Object.entries(f))).page!;
const txt = (P: { blocks: { t: string; text?: string }[] }) => P.blocks.map((b) => b.text ?? '').join(' ');
if (!/Sign in/.test(txt(fetchUrl(w, MH).page!))) fail('the webmail does not ask to sign in');
if (!/taken/.test(txt(send('/signup', { user: 'admin', pass: 'secret1', pass2: 'secret1' })))) fail('a taken name was let through');
if (!/match/.test(txt(send('/signup', { user: 'zed', pass: 'secret1', pass2: 'secret2' })))) fail('different passwords were let through');
send('/signup', { user: 'Zed01', pass: 'secret1', pass2: 'secret1' });
const sms = M.sms[0]?.text ?? '', code = sms.match(/\d{6}/)?.[0] ?? '';
console.log(`  sign-up text: ${sms}`);
if (!code) fail('no code texted on sign-up');
M.sms.length = 0;
if (!/not right/.test(txt(send('/confirm', { code: '000000' })))) fail('a wrong code was taken');
const IN = send('/confirm', { code });
if (!M.accounts.length || M.session !== 'zed01') fail('the right code made no account');
const subj = (P: { blocks: { t: string; rows?: string[][] }[] }) => P.blocks.find((b) => b.t === 'table')?.rows?.slice(1).map((r) => r[2]) ?? [];
if (subj(IN).length < 1) fail('the new box is empty (no welcome)');
// a week and a half on, with a payment at a shop that has a site
const shop = [...W.byBiz.keys()].find((k) => W.hosts.get(W.byBiz.get(k)!)?.kind === 'biz')!;
w.time += 3600; post(w.bank, w.time, 'transfer', 100000, 0); post(w.bank, w.time, 'card', -1250, shop);
w.time += 10 * 86400;
const box = fetchUrl(w, MH + '/inbox').page!, S2 = subj(box);
console.log(`  after 10 days: ${S2.length} letters; ${S2.slice(0, 6).join(' / ')}`);
if (!S2.some((t) => t.includes(businessName(c, shop)) || /mailing list|stopping by/i.test(t))) fail('no newsletter from the shop paid at');
if (!S2.some((t) => /statement/i.test(t))) fail('no bank statement');
// the statement of the week the payment was in
const stmts = box.blocks.find((b) => b.t === 'table')!.rows!.slice(1).filter((r) => /statement/i.test(r[2])).map((r) => r[2].match(/read\/([a-z0-9.]+)/)![1]);
const art = (id: string) => fetchUrl(w, MH + '/read/' + id).page!.blocks.map((b) => (b as { lines?: string[] }).lines?.join('\n') ?? '').join('\n');
const stmtId = stmts.find((id) => art(id).includes('-$12.50')) ?? stmts[0];
const R = fetchUrl(w, MH + '/read/' + stmtId).page!, rtext = art(stmtId);
if (!rtext.includes(businessName(c, shop).slice(0, 30)) || !rtext.includes('-$12.50')) fail('the statement does not show the card payment:\n' + rtext);
if (!M.accounts[0].read.has(stmtId!)) fail('reading did not mark it read');
fetchUrl(w, MH + '/delete/' + stmtId);
if (subj(fetchUrl(w, MH + '/inbox').page!).some((t) => t.includes(`read/${stmtId})`))) fail('a deleted letter is still in the box');
const L2 = layout(fetchUrl(w, MH + '/inbox').page!, 159);
for (const r of L2.rows.slice(0, 22)) console.log('  |' + r.map((x) => x.ch).join('').trimEnd());
const L3 = layout(R, 159);
for (const r of L3.rows.slice(8, 30)) console.log('  |' + r.map((x) => x.ch).join('').trimEnd());
fetchUrl(w, MH + '/logout');
if (M.session) fail('sign out kept the session');
if (!/incorrect/.test(txt(send('/login', { user: 'zed01', pass: 'nope' })))) fail('a wrong password signed in');
send('/login', { user: 'zed01', pass: 'secret1' });
if (M.session !== 'zed01') fail('the right password did not sign in');
// a new SIM: the reset code goes to the old number and never arrives
w.telco.player.number = '555-0199';
send('/forgot', { user: 'zed01', pass: 'another1', pass2: 'another1' });
if (M.sms.length) fail('the reset code came to the new SIM');
if (!M.pending || M.pending.num.slice(-4) === '0199') fail('the reset was not sent to the number on the account');

// the browser fills in a form by keys: the sign-up of a second account
M.session = null; M.pending = null;
up = true;
const B2 = new Browser(w, () => ({ up: true, kbps: 900 }), () => {}, 160, 50);
B2.go(MH + '/signup', 20);
const typ = (s: string) => { for (const ch of s) B2.key(ch, false, 30); };
typ('kay22'); B2.key('Tab', false, 30); typ('hunter22'); B2.key('Tab', false, 30); typ('hunter22'); B2.key('Enter', false, 30);
const shown = B2.cells(40).scr.ch.map((r) => r.join('')).join('\n');
if (!/Check your phone/.test(shown)) fail('typing in the form and Enter did not send it:\n' + shown.split('\n').slice(0, 30).join('\n'));
if (/hunter22/.test(B2.cells(25).scr.ch.map((r) => r.join('')).join('\n'))) fail('a password shows in clear');
const code2 = M.sms[0]?.text.match(/\d{6}/)?.[0] ?? '';
typ(code2); B2.key('Enter', false, 41);
if (M.session !== 'kay22' || !B2.url.endsWith('/inbox')) fail(`the code typed in the browser did not sign up (${M.session}, ${B2.url})`);
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
