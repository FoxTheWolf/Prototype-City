/**
 * What the dialogue remembers and gives (14.9), in Node:
 *   npx rolldown tests/memory.ts --format esm --platform node -o tests/.out/memory.mjs && node tests/.out/memory.mjs [seed]
 * Someone who likes the player gives their number (a contact), a cold one does not; the next day they
 * recall what the player asked about, a week later they do not; a rudeness fades a step every five
 * days; a text to someone asleep is answered "just woke up"; a call from a bar starts "it's loud".
 */
import { createWorld } from '../src/sim/world';
import { Doing, whereIs } from '../src/sim/citizens';
import { FORGET, FORGIVE, reply, smsReply, Talk } from '../src/talk';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const P = w.pop, n = P.age.length;
const pick = (ok: (i: number) => boolean) => { for (let i = 1; i < n; i += 13) if (ok(i)) return i; return -1; };

// the number: a warm person gives it, a cold one keeps it
const warm = pick((i) => P.social[i] > 200 && !!P.mobile[i] && P.age[i] >= 20), cold = pick((i) => P.social[i] < 60 && !!P.mobile[i] && P.age[i] >= 20);
let T = new Talk(w, warm, -1), a = reply(w, T, 'could i get your phone number please?');
console.log(`  warm: ${a.text}`);
if (!a.contact || a.contact.number !== P.mobile[warm]) fail('someone warm did not give their number');
T = new Talk(w, cold, -1); a = reply(w, T, 'could i get your phone number please?');
console.log(`  cold: ${a.text}`);
if (a.contact) fail('someone cold gave their number at once');

// memory: the next day they recall the place asked about; a week later, nothing
const k = pick((i) => P.age[i] >= 20 && i !== warm && i !== cold);
T = new Talk(w, k, -1); a = reply(w, T, 'where is the nearest pharmacy?');
const topic = w.talks.get(k)?.topic ?? '';
if (!topic) fail('the place asked about was not remembered');
w.time += 86400;
T = new Talk(w, k, -1); a = reply(w, T, 'hi');
console.log(`  next day: ${a.text}`);
if (!a.text.includes(topic)) fail(`the next day they did not recall ${topic}`);
w.time += FORGET + 86400 * 5;
T = new Talk(w, k, -1); a = reply(w, T, 'hi');
console.log(`  a week later: ${a.text}`);
if (a.text.includes(topic)) fail('a week later they still recalled it');
// a rudeness fades
w.talks.get(k)!.rude = 2; w.time += FORGIVE * 2 + 60;
T = new Talk(w, k, -1);
if (w.talks.get(k)!.rude !== 0) fail(`ten days later the rudeness is still ${w.talks.get(k)!.rude}`);

// a text to someone asleep: "just woke up"; a call from a bar: "it's loud"
w.time = Math.floor(w.time / 86400) * 86400 + 4 * 3600;
const sleeper = pick((i) => P.age[i] >= 20 && whereIs(P, w.city, i, w.time).doing === Doing.Asleep);
T = new Talk(w, sleeper, -1, true);
w.talks.get(sleeper)!.num = true;
const s = smsReply(w, T, 'what do you do for work?') ?? '';
console.log(`  asleep: ${s}`);
if (!/woke|asleep|sleep/i.test(s)) fail('a text answered from sleep does not say so');
T = new Talk(w, warm, -1, true);
const c = smsReply(w, T, 'what do you do for work?', false, 'bar') ?? '';
console.log(`  call from a bar: ${c}`);
if (!/loud|bar|noisy|party|hear/i.test(c)) fail('a call from a bar does not hear it');
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
