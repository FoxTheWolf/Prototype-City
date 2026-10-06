/**
 * The playtest record end to end without the browser (13.10p): a world, the logger watching it while
 * the player walks for a few minutes (with a clock of its own, 60 frames a second), a text in, a thing
 * taken and paid for, a note; the lines go to tests/.out/playtest/ and are checked, then the report is made from them.
 *   npx rolldown tests/playtest.ts --format esm --platform node -o tests/.out/playtest.mjs && node tests/.out/playtest.mjs [seed]
 */
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { createWorld, stepWorld } from '../src/sim/world';
import { Playtest } from '../src/playtest';
import { TIME_SCALE } from '../src/sim/clock';

// the browser's pieces the logger touches: a clock we drive, the page's events, the server
let ms = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => ms }, configurable: true });
Object.assign(globalThis, { addEventListener: () => {}, screen: { width: 1920, height: 1080 }, devicePixelRatio: 1 });
const DIR = 'tests/.out/playtest';
mkdirSync(DIR, { recursive: true });
globalThis.fetch = (async (url: string, init?: { body?: string }) => {
  const name = String(url).replace('/playtest/', '');
  if (name !== 'ping' && init?.body) { if (name.endsWith('.png')) writeFileSync(`${DIR}/${name}`, 'png'); else appendFileSync(`${DIR}/${name}`, init.body); }
  return { ok: true } as Response;
}) as typeof fetch;


const seed = Number(process.argv[2] ?? 42);
const w = createWorld(seed);
const pt = new Playtest(w, seed, 'test');
const phone = { inbox: [] as object[], sent: [] as object[], log: [] as object[] };
pt.prime(phone, false);
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };

const FRAMES = 60 * 150; // 2.5 real minutes
let heading = 0;
for (let f = 0; f < FRAMES; f++) {
  ms += 1000 / 60;
  // walk, turning a quarter now and then; stand still in the middle stretch
  if (f % 1200 === 0) heading += Math.PI / 2;
  const walking = f < 3000 || f > 6000;
  stepWorld(w, { forward: walking ? 1 : 0, strafe: 0, run: false, heading });
  if (f === 1000) phone.inbox.unshift({ from: '555-0101', text: 'hello from the test', at: w.time, read: false });
  if (f === 2000) { const it = { good: 'coffee', x: 0, y: 0, w: 5, h: 5, cents: 250, shop: 0, paid: false, vx: 0, vy: 0 }; w.bag.items.push(it); }
  if (f === 2100) { w.bag.items[w.bag.items.length - 1].paid = true; w.player.cash -= 250; }
  if (f === 4000) pt.note('a test note\nsecond line', 'data:image/png;base64,AAAA');
  pt.frame(1 / 60, phone, heading, 0, '', walking);
}
pt.flush();

const recs = readFileSync(`${DIR}/${pt.file}.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const n = (k: string) => recs.filter((r) => r.k === k).length;
if (n('start') !== 1) fail('one start record');
if (n('begin') !== 1) fail('one begin record');
if (Math.abs(n('pos') - 150) > 2) fail(`a position a second (${n('pos')} for 150 s)`);
if (n('sms_in') !== 1) fail(`the text in (${n('sms_in')})`);
if (n('take') !== 1 || n('buy') !== 1) fail(`taken ${n('take')}, bought ${n('buy')}`);
if (n('cash') < 1) fail('the cash paid');
if (n('note') !== 1) fail('the note');
const g = recs.filter((r) => r.k === 'pos'), dt = g[g.length - 1].gt - g[0].gt;
// 150 s real at the clock's pace (TIME_SCALE game seconds a real one)
if (Math.abs(dt - 150 * TIME_SCALE) > 3 * TIME_SCALE) fail(`game time over the session: ${dt} s`);
console.log(`${recs.length} records (${n('pos')} positions, ${n('place')} places, ${n('event')} events, ${n('stuck')} stuck), game ${Math.round(dt / 60)} min`);
console.log(`${DIR}/${pt.file}.jsonl`);
if (fails) process.exit(1);
console.log('OK');
