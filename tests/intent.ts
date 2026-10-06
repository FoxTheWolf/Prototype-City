/**
 * The free-text reading (14.1) in Node:
 *   npx rolldown tests/intent.ts --format esm --platform node -o tests/.out/intent.mjs && node tests/.out/intent.mjs
 * Every example of the lexicon reads as its own intention (at least 90% of them; the misses are printed),
 * plus lines with typos, shorthand, negation, places of the city and the tone's two axes.
 */
import { examples, indexNames, readLine, type IntentId } from '../src/sim/intent';

let fails = 0, ok = 0, all = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
for (const [id, line] of examples()) {
  all++;
  const r = readLine(line);
  if (r.intent === id) ok++; else console.log(`  miss: "${line}" → ${r.intent} (want ${id})`);
}
if (ok / all < 0.9) fail(`only ${ok} of ${all} examples read right`);

const idx = indexNames([
  { words: ['pharmacy'], kind: 'place', id: 1 }, { words: ['5th', 'ave'], kind: 'street', id: 2 },
  { words: ['blue', 'moon', 'diner'], kind: 'place', id: 3 }, { words: ['marta', 'reyes'], kind: 'person', id: 4 }, { words: ['coffee'], kind: 'thing', id: 5 },
]);
const want = (line: string, id: IntentId, check?: (r: ReturnType<typeof readLine>) => boolean, why = '') => {
  const r = readLine(line, idx);
  if (r.intent !== id || (check && !check(r))) fail(`"${line}" → ${r.intent} ${JSON.stringify(r.slots)} r${r.respect} p${r.pressure} (want ${id}${why ? ', ' + why : ''})`);
};
want('wheres the pharmacy?', 'ask_where', (r) => r.slots.place?.id === 1, 'the place');
want('the blue moon diner?', 'ask_where', (r) => r.slots.place?.id === 3, 'a name alone, asked');
want('how do i get to 5th ave', 'ask_where', (r) => r.slots.street?.id === 2);
want('do you know marta reyes', 'ask_about_person', (r) => r.slots.person?.id === 4);
want('how much is the coffee', 'ask_price', (r) => r.slots.thing?.id === 5);
want('thx a lot', 'thank');
want('helo there', 'greet', undefined, 'a typo');
want('wher is the pharmacy', 'ask_where', undefined, 'a typo');
want('asdf qwer', 'unrecognized');
want('haha just kidding', 'banter', (r) => r.banter);
want('could you please tell me where the pharmacy is, sir?', 'ask_where', (r) => r.respect >= 2, 'respectful');
want('WHERE IS THE PHARMACY RIGHT NOW!!', 'ask_where', (r) => r.pressure >= 2, 'pressing');
want('back off or else', 'threaten', (r) => r.respect <= -2, 'hostile');
want('no way', 'no');
want('i want to pay', 'buy_request');
want('can you ring this up please', 'buy_request');
console.log(`${ok} of ${all} examples read right`);
if (fails) process.exit(1);
console.log('OK');
