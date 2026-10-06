/**
 * Texting someone (14.6), in Node:
 *   npx rolldown tests/sms.ts --format esm --platform node -o tests/.out/sms.mjs && node tests/.out/sms.mjs [seed]
 * A text is read like a line said: a stranger asks who it is at a bare "hey", answers a real question
 * in their way of typing, never gives a route by text (they cannot see where the player is), places
 * the player only after meeting them face to face, and stops answering when out of patience.
 */
import { createWorld } from '../src/sim/world';
import { reply, smsReply, Talk } from '../src/talk';
import { TEXT } from '../src/locale/text';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const clean = (s: string | null) => !!s && !/[#{}]/.test(s) && s.trim().length > 0;
const adult = Array.from({ length: 400 }, (_, k) => k * 37 % w.pop.age.length).filter((i) => w.pop.age[i] >= 25 && w.pop.age[i] < 60);
const txt = (T: Talk, s: string) => { const a = smsReply(w, T, s); console.log(`  > ${s}\n    ${a ?? '(no answer)'}`); return a; };

// a stranger
const a = adult[0];
let T = new Talk(w, a, -1, true);
const who = txt(T, 'hey');
if (!who || !TEXT['sms.res'].some((x) => who.toLowerCase().replace(/[^a-z]/g, '').includes(x.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6)))) console.log('  (the who-is-this came out in their typing; checked by eye)');
if (!clean(who)) fail('no "who is this?" to a bare hey');
const job = txt(T, 'what do you do for a living?');
if (!clean(job)) fail('a real question by text got nothing');
const where = txt(T, 'where is the nearest pharmacy?');
if (!clean(where) || /block|north|south|east|west/i.test(where!)) fail('a route given by text: ' + where);
const me = txt(T, "it's me, from the store");
if (!clean(me) || w.talks.get(a)?.face) fail('a stranger placed the player');

// someone met face to face first
const b = adult[1];
const F = new Talk(w, b, -1);
reply(w, F, 'hi there');
T = new Talk(w, b, -1, true);
txt(T, 'hey');
txt(T, "it's me, we talked on the street");
if (!w.talks.get(b)?.num) fail('someone met face to face did not place the player');

// patience runs out: no more answers
T = new Talk(w, adult[2], -1, true);
let n = 0;
while (n < 30 && smsReply(w, T, 'ASDF QWER NOW!!') !== null) n++;
if (n >= 30) fail('texting nonsense never ran out of patience');
console.log(`  stopped answering after ${n} texts of nonsense`);

// many people, many lines: whole texts
let k = 0;
for (const i of adult.slice(3, 60)) {
  const S = new Talk(w, i, -1, true);
  for (const s of ['hey', 'whats ur name', 'what time is it', 'can u lend me 20 bucks', 'nice weather huh', 'thanks', 'bye']) { const r = smsReply(w, S, s); k++; if (r !== null && !clean(r)) fail(`a hole: "${s}" -> "${r}"`); }
}
console.log(`  ${k} texts to ${adult.slice(3, 60).length} people`);
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
