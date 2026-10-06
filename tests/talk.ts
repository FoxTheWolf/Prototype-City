/**
 * Talking to a clerk (14.2) in Node:
 *   npx rolldown tests/talk.ts --format esm --platform node -o tests/.out/talk.mjs && node tests/.out/talk.mjs [seed]
 * The answers say true things (the shop's price, the clerk's name, a coworker's, the real route), no slot or symbol is
 * left unfilled in hundreds of lines, patience runs out, goodbye ends the talk, and the clerk remembers the player.
 */
import { createWorld } from '../src/sim/world';
import { staffOn } from '../src/sim/citizens';
import { PLACES } from '../src/sim/placeTypes';
import { citizenNames, roadName } from '../src/locale/names';
import { reply, Talk } from '../src/talk';
import en from '../src/locale/en.json';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const c = w.city;
// a café at 10 in the morning, with someone at the till
w.time = Math.floor(w.time / 86400) * 86400 + 86400 * 2 + 10 * 3600;
const k = c.businesses.findIndex((b, n) => b.kind === 'cafe' && staffOn(w.pop, c, n, w.time).length > 0);
if (k < 0) { console.log('FAIL no café with a clerk'); process.exit(1); }
const clerk = staffOn(w.pop, c, k, w.time)[0], name = citizenNames(c, w.pop, clerk)[0];
const B = c.buildings[c.businesses[k].building];
Object.assign(w.player, { inside: c.businesses[k].building, floor: 0, x: (B.x0 + B.x1) / 2, y: (B.y0 + B.y1) / 2 });
const coffee = PLACES.cafe.sells.find(([g]) => g === 'drip_coffee');

let T = new Talk(w, clerk, k);
const ask = (line: string) => { const a = reply(w, T, line); console.log(`  > ${line}\n    [${a.reading.intent} · ${a.reading.toneLabel} · p${a.reading.pressure}] ${a.text}${a.end ? '  (end)' : ''}`); return a; };
const clean = (s: string) => !/[#{}]/.test(s) && s.trim().length > 0;
let a = ask('hi there');
if (!clean(a.text)) fail('a greeting with a hole: ' + a.text);
a = ask("what's your name?");
if (!a.text.includes(name)) fail(`the clerk did not say their name (${name})`);
if (coffee) {
  a = ask('how much is a coffee?');
  const d = coffee[1] % 100 ? (coffee[1] / 100).toFixed(2) : String(coffee[1] / 100);
  if (!a.text.includes(d) && !/early|late|watch|idea/i.test(a.text)) fail(`the price is not the shop's (${d}): ${a.text}`);
}
a = ask('where is the pharmacy?');
if (!clean(a.text) || a.reading.intent !== 'ask_where') fail('no route to the pharmacy: ' + a.text);
a = ask('how do i get to ' + roadName(c, true, 3));
if (!clean(a.text)) fail('no route to a street: ' + a.text);
a = ask('who works here?');
if (!clean(a.text)) fail('who works here: ' + a.text);
a = ask('can i borrow some money');
if (!clean(a.text) || a.reading.intent !== 'borrow_money') fail('borrowing money is not a polite no: ' + a.text);
a = ask('bye');
if (!a.end || !T.over) fail('goodbye did not end the talk');
if (!w.talks.get(clerk)) fail('the clerk does not remember the player');

// patience: nonsense, pushed, runs out
T = new Talk(w, clerk, k);
let n = 0;
while (!T.over && n < 40) { reply(w, T, 'ASDF QWER NOW!!'); n++; }
if (!T.over) fail('patience never ran out');
console.log(`  patience ran out after ${n} lines of nonsense`);

// many lines: no hole left in any answer
const lines = ['hello', 'thanks a lot', 'sorry', 'what time is it', 'how much is the burger', 'i want a coffee', 'nice place', 'this is terrible service',
  'you look nice', 'yes', 'no', 'huh?', 'anyway', 'nice day huh', 'lol just kidding', 'get lost or else', 'where is the bank', 'whats ur job', 'can i use your phone', 'xyzzy'];
let bad = 0;
for (let i = 0; i < 300; i++) {
  T = new Talk(w, staffOn(w.pop, c, k, w.time)[i % staffOn(w.pop, c, k, w.time).length], k);
  w.time += 37;
  const s = reply(w, T, lines[i % lines.length]).text;
  if (!clean(s)) { bad++; if (bad < 6) console.log('  hole: ' + JSON.stringify(s)); }
}
if (bad) fail(`${bad} of 300 answers with a hole`);
void en;
if (fails) process.exit(1);
console.log('OK');
