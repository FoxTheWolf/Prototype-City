/**
 * The balloons on the street and talking to someone on the sidewalk (14.4), in Node:
 *   npx rolldown tests/barks.ts --format esm --platform node -o tests/.out/barks.mjs && node tests/.out/barks.mjs [seed]
 * Every bark key says something whole (no slot or symbol left) for many people; the rain starting
 * makes the nearest speak up; running into someone makes them say so; a balloon's point straight
 * ahead lands in the middle of the screen, higher when higher; a talk on the sidewalk answers whole lines.
 */
import { createWorld, stepWorld } from '../src/sim/world';
import { Barks, toUi, type Screen } from '../src/barks';
import { reply, Talk } from '../src/talk';
import { TEXT } from '../src/locale/text';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { if (++fails <= 30) console.log('FAIL ' + m); };
const clean = (s: string) => !/[#{}]/.test(s) && s.trim().length > 0;

// an evening on the street, people around
w.time = Math.floor(w.time / 86400) * 86400 + 86400 + 18 * 3600;
for (let i = 0; i < 600; i++) stepWorld(w, { forward: 0, strafe: 0, run: false, heading: 0 });
const B = new Barks(w);
console.log(`  ${w.peds.length} people on the street, ${B.near().length} within hearing`);
if (!B.near().length) fail('nobody near the player to hear');

// every key, for many people: whole lines
const keys = Object.keys(TEXT).filter((k) => k.startsWith('bark.')).concat('dir.busy');
const people = w.peds.slice(0, 40).map((q) => q.id);
let said = 0;
for (const k of keys) for (const who of people) { const s = B.line(who, k); said++; if (!clean(s)) fail(`${k} by ${who}: "${s}"`); }
console.log(`  ${said} lines from ${keys.length} keys, e.g. "${B.line(people[0], 'bark.phone')}"`);

// the rain starting: the nearest speak up within a few seconds
let now = 10;
w.weather.precip = 0; B.update(now, 0);
w.weather.precip = 0.6; w.weather.snow = false;
for (let k = 0; k < 20; k++) { now += 0.25; B.update(now, 0); }
const rain = B.list.length;
console.log(`  rain: ${rain} balloon(s): ${B.list.map((b) => `"${b.text}"`).join(' ')}`);
if (B.near().length && !rain) fail('nobody said a word when the rain started');

// running into someone
const q = B.near()[0]?.q;
if (q) {
  Object.assign(w.player, { x: q.x + 0.5, y: q.y, speed: 9 });
  now += 30; B.update(now, Math.PI);
  if (!B.list.some((b) => b.who === q.id)) fail('running into someone, they said nothing');
  w.player.speed = 0;
}

// the screen: straight ahead in the middle, a head higher than the feet
const S: Screen = { cols: 400, rows: 225, cellW: 4.8, cellH: 4.8, originX: 0, originY: 0 }, U: Screen = { cols: 237, rows: 80, cellW: 8.1, cellH: 13.5, originX: 0, originY: 0 };
const v = { x: 0, y: 0, eye: 1.7, yaw: 0, pitch: 0 };
const mid = toUi(v, 10, 0, 1.7, S, U)!, head = toUi(v, 10, 0, 2.05, S, U)!, right = toUi(v, 10, 2, 1.7, S, U)!;
if (Math.abs(mid[0] - 118.5) > 0.6 || Math.abs(mid[1] - 40) > 0.6) fail(`straight ahead is not the middle: ${mid}`);
if (!(head[1] < mid[1])) fail('a head is not above the eye line');
if (!(right[0] > mid[0])) fail('a point to the right (+y with yaw 0) is not to the right');
if (toUi(v, -5, 0, 1.7, S, U)) fail('a point behind is on the screen');

// talking on the sidewalk: whole answers, no shop
const who = people[1] ?? people[0];
const T = new Talk(w, who, -1);
for (const line of ['hi', "what's your name", 'where is the nearest bar', 'how much is a coffee', 'where do you live', 'what do you do', 'nice weather', 'bye']) {
  const a = reply(w, T, line);
  console.log(`  > ${line}\n    [${a.reading.intent}] ${a.text}`);
  if (!clean(a.text) && !T.over) fail(`a hole on the sidewalk: "${line}" -> "${a.text}"`);
}

console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
