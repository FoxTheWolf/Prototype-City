/**
 * Talking on the phone (14.7), in Node:
 *   npx rolldown tests/call.ts --format esm --platform node -o tests/.out/call.mjs && node tests/.out/call.mjs [seed]
 * Calling someone's mobile: when they pick up they say hello and wait (the call keeps open for the
 * talk); what the player says is answered through the call; a bare "hi" from a number they do not
 * know gets "who is this?"; left silent, they ask if anyone is there, then hang up.
 */
import { createWorld } from '../src/sim/world';
import { Call, type Sfx } from '../src/phone/call';
import { smsReply, Talk } from '../src/talk';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const sfx: Sfx[] = [];
// in the afternoon, someone who picks up
w.time = Math.floor(w.time / 86400) * 86400 + 86400 + 17 * 3600;
let call: Call | null = null, now = 0;
for (let i = 0; i < 400 && !call; i += 7) {
  const c = new Call(w, w.pop.mobile[i], 0, false);
  for (now = 0; now < 60 && c.state !== 'ended' && !(c.state === 'talk' && c.lines.length); now += 0.1) c.update(now, sfx);
  if (c.chatWith >= 0 && c.lines.length) call = c;
}
if (!call) { console.log('FAIL nobody picked up'); process.exit(1); }
console.log(`  ${call.lines[0].text}`);
const T = new Talk(w, call.chatWith, -1, true);
const say = (s: string) => {
  const a = smsReply(w, T, s, false) ?? '';
  call!.answer(a, now, T.over);
  const n = call!.lines.length;
  for (const t = now + 15; now < t && call!.lines.length === n; now += 0.1) call!.update(now, sfx);
  const got = call!.lines[call!.lines.length - 1]?.text ?? '';
  console.log(`  > ${s}\n    ${got}`);
  return got;
};
const who = say('hi');
if (!who || /[#{}]/.test(who)) fail('no answer to hi: ' + who);
const job = say('what do you do for work?');
if (!job || /[#{}]/.test(job)) fail('no answer to a question: ' + job);
if (call.state !== 'talk') fail('the call ended in the middle of the talk');
// silence: they ask, then hang up
const n0 = call.lines.length;
for (const t = now + 40; now < t && call.state === 'talk'; now += 0.1) call.update(now, sfx);
console.log(`  (silence) ${call.lines.slice(n0).map((l) => l.text).join(' / ')}`);
if (call.state !== 'ended') fail('left silent, they never hung up');
if (call.lines.length - n0 < 2) fail('left silent, they hung up without a word');
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
