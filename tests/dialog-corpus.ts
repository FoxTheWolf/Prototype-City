/**
 * The lines typed in the playtests, read and answered (C3b), in Node:
 *   npx rolldown tests/dialog-corpus.ts --format esm --platform node -o tests/.out/dialog-corpus.mjs && node tests/.out/dialog-corpus.mjs [seed]
 * Every line the player really typed (playtest/*.jsonl, 2026-10) with the intention it should be read
 * as; a new line that fails in a playtest goes here. Then end to end: the menu of a café with its
 * prices, a room at the motel opens the counter, a room asked on the street points to a motel, an
 * insult is answered clean, and "Mel" after "And yours?" is the player's name.
 */
import { createWorld } from '../src/sim/world';
import { readLine } from '../src/sim/intent';
import { cityNames, reply, Talk } from '../src/talk';

const w = createWorld(Number(process.argv[2] ?? 42)), I = cityNames(w);
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const CORPUS: [string, string][] = [
  ['I wanna pay', 'buy_request'], ['whats your name? Please', 'ask_name'], ['Hi Terri', 'greet'], ['where do you live', 'ask_where'],
  ['hey', 'greet'], ['wheres the nearest pharmay', 'ask_where'], ['thanks', 'thank'], ['how are you today', 'ask_how'],
  ['huh?', 'not_understood'], ['did you wath the game yesterday?', 'talk_sports'], ['whats your age', 'ask_age'],
  ['excuse me, where can I get wifi?', 'ask_wifi_password'], ['do you know where there\'s any motels nearby?', 'ask_where'],
  ['thanks, whats your name?', 'ask_name'], ['thanks, fernando, wanna share numbers?', 'ask_number'], ['wheres vega coffee?', 'ask_where'],
  ['okay thanks', 'thank'], ['excuse me, whats the time?', 'ask_time'], ['is it gonna rain today?', 'talk_weather'],
  ['did you catch the game?', 'talk_sports'], ['where is nolan and santos bank', 'ask_where'], ['fuck you', 'insult'], ['FUCK YOU', 'insult'],
  ['who are you', 'ask_name'], ['i wanna be your friend', 'compliment'], ['what do you do', 'ask_job'], ['where is that', 'ask_where'],
  ['have you got work for me', 'ask_favor'], ['are you a hacker', 'ask_job'], ['whats your number', 'ask_number'], ['whats your name?', 'ask_name'],
  ['where can i get some food', 'ask_where'], ['hello, hows your night going?', 'ask_how'], ['Ming? Thats a lovely name', 'compliment'],
  ['what do you serve here?', 'ask_menu'], ['can I see the menu?', 'ask_menu'], ['what do you sell', 'ask_menu'], ['whats on offer?', 'ask_menu'],
  ['Is there a menu?', 'ask_menu'], ['I wanna eat something', 'ask_menu'], ['where can I stay the night here?', 'buy_request'], ['a motel, where?', 'ask_where'],
  ['whats you name?', 'ask_name'], ['Can I have you number?', 'ask_number'], ['I wanna stay for a night', 'buy_request'], ['can I rent a room?', 'buy_request'],
  ['bitch', 'insult'], ['pay', 'buy_request'], ['buddy, wheres the nearest grocer', 'ask_where'], ['is there a motel around here?', 'ask_where'],
];
let ok = 0;
for (const [line, want] of CORPUS) { const got = readLine(line, I).intent; if (got === want) ok++; else fail(`"${line}" read as ${got}, not ${want}`); }
console.log(`  corpus: ${ok}/${CORPUS.length}`);

const c = w.city, P = w.pop;
const at = (k: string) => { const b = c.businesses.findIndex((x) => x.kind === k); return b; };
const staff = (b: number) => { for (let i = 0; i < P.job.length; i++) if (P.job[i] >= 0 && P.workplaces[P.job[i]].staff.includes(i) && P.age[i] >= 20) { return i; } return 1; };
const UNREC = /don't follow|what do you mean|rephrase|understand|catch that|another way|differently|a little lost|what are you asking|say that again|not sure what/i;
// the café's menu, with its prices
const cafe = at('cafe');
let T = new Talk(w, staff(cafe), cafe), a = reply(w, T, 'what do you sell?');
console.log(`  café menu: ${a.text}`);
if (!/\d/.test(a.text) || !a.counter) fail('the café menu has no prices or does not open the counter');
// a room at the motel opens the counter; on the street, the way to a motel
const motel = at('motel');
T = new Talk(w, staff(motel), motel); a = reply(w, T, 'can I rent a room?');
console.log(`  motel room: ${a.text}`);
if (!a.counter) fail('a room at the motel does not open the counter');
T = new Talk(w, 21, -1); a = reply(w, T, 'where can I stay the night?');
console.log(`  room on the street: ${a.text}`);
if (!a.point) fail('a room asked on the street does not point to a motel');
// an insult: answered, not "I don't follow"
T = new Talk(w, 33, -1); a = reply(w, T, 'fuck you');
console.log(`  insult: ${a.text}`);
if (UNREC.test(a.text) || /fuck|bitch/i.test(a.text)) fail('the insult was not understood, or answered dirty');
// the player's name after theirs
T = new Talk(w, 45, -1); reply(w, T, 'whats your name?'); a = reply(w, T, 'Mel');
console.log(`  name: ${a.text}`);
if (!a.text.includes('Mel')) fail('"Mel" after their name was not taken as the player\'s');
console.log(fails ? `${fails} FAIL` : 'OK');
process.exit(fails ? 1 : 0);
