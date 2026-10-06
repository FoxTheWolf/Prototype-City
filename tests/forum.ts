/**
 * Switchboard, the hackers' board (15.8), in Node:
 *   npx rolldown tests/forum.ts --format esm --platform node -o tests/.out/forum.mjs && node tests/.out/forum.mjs [seed]
 * Crawl from the index through every board and thread it links to; each page must lay out with no
 * hole (no stray {} or #id from an unfilled template) and the crawl must reach the three boards and
 * the sticky guides. Prints a guide thread and a contract so the text can be eyeballed.
 */
import { createWorld } from '../src/sim/world';
import { fetchUrl } from '../src/web/sites';
import { layout, SUBMIT } from '../src/web/page';
import { FORUM_HOST } from '../src/web/forum';

const w = createWorld(Number(process.argv[2] ?? 42));
w.time += 11 * 3600; // mid-evening, so "latest" and the generated contracts have a day to sit on
let fails = 0;
const fail = (m: string) => { if (++fails <= 30) console.log('FAIL ' + m); };
const U = `http://${FORUM_HOST}`;

const seen = new Set<string>(), queue = [U + '/'];
let pages = 0, threads = 0;
while (queue.length && pages < 200) {
  const u = queue.shift()!;
  if (seen.has(u)) continue;
  seen.add(u);
  const F = fetchUrl(w, u);
  if (!F.page) { fail('nowhere: ' + u); continue; }
  pages++;
  if (/\/t\//.test(u)) threads++;
  const L = layout(F.page, 159), t = L.rows.map((r) => r.map((x) => x.ch).join('')).join('\n');
  const hole = t.split('\n').find((l) => /[{}]|#[a-z]/.test(l));
  if (hole) fail(`a hole on ${u}: ${hole.trim()}`);
  for (const l of L.links) if (l.url !== SUBMIT && l.url.includes(FORUM_HOST) && !seen.has(l.url)) queue.push(l.url);
}
console.log(`  crawled ${pages} pages, ${threads} threads`);
if (threads < 6) fail(`too few threads reached: ${threads}`);
for (const slug of ['guides', 'work', 'lounge']) if (!seen.has(`${U}/b/${slug}`)) fail(`board not linked: ${slug}`);
if (![...seen].some((u) => /\/t\/guides\/g2$/.test(u))) fail('the mmap sticky was not reached');

const show = (u: string) => fetchUrl(w, u).page!.blocks.filter((b) => b.t === 'p' || b.t === 'h').map((b) => (b as { text: string }).text).filter((s) => s.trim());
console.log('  --- a guide ---');
for (const l of show(U + '/t/guides/g3').slice(0, 10)) console.log('  |' + l);
console.log('  --- a contract board ---');
for (const l of show(U + '/b/work').slice(0, 8)) console.log('  |' + l);

console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
