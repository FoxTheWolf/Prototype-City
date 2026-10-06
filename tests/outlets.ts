/**
 * Wall outlets (13.9c) in Node without the browser:
 *   npx rolldown tests/outlets.ts --format esm --platform node -o tests/.out/outlets.mjs && node tests/.out/outlets.mjs [seed]
 * Every place that lets customers plug in and has a shop floor has two outlets on its blind walls; standing
 * at one and facing it, F's target is that outlet; the phone plugged there charges, and walking off past
 * the cable's reach pulls the plug. Exits with 1 on a failure.
 */
import { planOf } from '../src/sim/interior';
import { CABLE, outletAhead, outletNear, outletPower } from '../src/sim/outlets';
import { OUTLETS } from '../src/sim/placeTypes';
import { createWorld, stepWorld } from '../src/sim/world';
import { Phone } from '../src/phone/phone';

const seed = Number(process.argv[2] ?? 42);
const w = createWorld(seed);
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };

// the places that should have them
let places = 0, missing = 0;
w.city.businesses.forEach((b) => {
  if (!OUTLETS.has(b.kind)) return;
  const P = planOf(w.city, b.building, 0);
  if (!P?.rooms.some((R) => R.kind === 'shop')) return;
  places++;
  if (P.furn.filter((f) => f.kind === 'outlet').length < 2) missing++;
});
if (!places) fail('no place with a shop floor and outlets');
if (missing) fail(`${missing} of ${places} places with fewer than two outlets`);

// stand in front of the first outlet of the first powered place, facing it
const b = w.city.businesses.find((b) => OUTLETS.has(b.kind) && planOf(w.city, b.building, 0)?.furn.some((f) => f.kind === 'outlet') && w.power.subs[w.power.building[b.building]].on)!;
const o = planOf(w.city, b.building, 0)!.furn.find((f) => f.kind === 'outlet')!;
const p = w.player;
Object.assign(p, { inside: b.building, floor: 0, z: 0, x: o.x + o.c * 0.9, y: o.y + o.s * 0.9 });
p.px = p.x; p.py = p.y;
const yaw = Math.atan2(-o.s, -o.c);
if (outletAhead(w, yaw) !== o) fail('facing the outlet, it is not the one F would plug into');
if (outletAhead(w, yaw + Math.PI) !== null) fail('an outlet behind the player is in front');
if (outletNear(w, p.x, p.y) !== o) fail('the outlet is not near');
if (!outletPower(w)) fail('no power at the outlet of a powered building');

// the phone plugged in charges; past the cable it comes out
const phone = new Phone(w);
phone.batt = 0.3;
phone.plug = { f: o, b: b.building, floor: 0 };
for (let i = 0; i < 60 * 60; i++) phone.update(1 / 60, i / 60);
if (!phone.charging || phone.batt <= 0.3) fail(`plugged in for a minute, the phone did not charge (${phone.batt.toFixed(3)})`);
p.x = o.x + o.c * (CABLE + 0.5); p.y = o.y + o.s * (CABLE + 0.5);
phone.update(1 / 60, 61);
if (phone.plug || !phone.pulled || phone.charging) fail('walking off past the cable did not pull the plug');
stepWorld(w, { forward: 0, strafe: 0, run: false, heading: yaw });
console.log(`${places} places with outlets; charged to ${Math.round(phone.batt * 100)}% in a real minute`);
if (fails) process.exit(1);
console.log('OK');
