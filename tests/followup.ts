/**
 * The follow-up (C3b): a short question after small talk is read in its context, in Node:
 *   npx rolldown tests/followup.ts --format esm --platform node -o tests/.out/followup.mjs && node tests/.out/followup.mjs [seed]
 * "did you catch the game?" then "who won?" gets an answer about the game (not "I don't follow");
 * whoever saw it names the same winner as anyone else that day; whoever missed it says so again.
 * "nice weather" then "are you sure?" stays on the weather. A "who won?" with no game before is not understood.
 */
import { createWorld } from '../src/sim/world';
import { reply, Talk } from '../src/talk';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const P = w.pop, n = P.age.length;
const winners = new Set<string>();
let saw = 0, missed = 0;
for (let i = 1, tried = 0; i < n && tried < 40; i += 97) {
  if (P.age[i] < 18) continue;
  tried++;
  const T = new Talk(w, i, -1), a = reply(w, T, 'did you catch the game last night?'), b = reply(w, T, 'who won?');
  if (tried <= 6) console.log(`  ${a.text} / ${b.text}`);
  if (/don't follow|what do you mean|rephrase|understand|catch that|another way|differently|a little lost|what are you asking|say that again|not sure what/i.test(b.text)) fail(`"who won?" fell out of the game: ${b.text}`);
  const m = /\b(Comets|Hawks|Titans|Ironmen|Mariners|Knights|Falcons|Giants|Rockets|Bulldogs|Lightning|Stallions)\b/.exec(b.text);
  if (m) { winners.add(m[1]); saw++; } else missed++;
}
console.log(`  saw it ${saw}, missed it ${missed}, winners named: ${[...winners].join(', ')}`);
if (winners.size > 1) fail('two people named different winners for the same game');
if (!saw || !missed) fail('everyone saw it, or nobody did');
// the weather
const k = 5;
let T = new Talk(w, k, -1);
reply(w, T, 'nice weather today, huh?');
const c = reply(w, T, 'are you sure?');
console.log(`  weather: ${c.text}`);
if (/don't follow|what do you mean|rephrase|understand|catch that|again/i.test(c.text)) fail('"are you sure?" after the weather was not understood');
// no game before: not a follow-up
T = new Talk(w, 9, -1);
const d = reply(w, T, 'who won?');
if (/\b(won|took it|beat)\b/.test(d.text)) fail(`"who won?" out of nowhere got a result: ${d.text}`);
console.log(fails ? `${fails} FAIL` : 'OK');
process.exit(fails ? 1 : 0);
