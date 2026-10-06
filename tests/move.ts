/**
 * Jumping and crouching (14.8), in Node:
 *   npx rolldown tests/move.ts --format esm --platform node -o tests/.out/move.mjs && node tests/.out/move.mjs [seed]
 * A jump goes up some decimetres and lands within a second; crouched, the steps are slow and there is
 * no running; standing up again, the pace is back.
 */
import { createWorld, stepWorld } from '../src/sim/world';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const p = w.player, go = { forward: 0, strafe: 0, run: false, heading: 0 };
stepWorld(w, { ...go, jump: true });
let top = 0, n = 0;
while ((p.hop || p.hopV) && n < 200) { stepWorld(w, go); top = Math.max(top, p.hop ?? 0); n++; }
console.log(`  jump: ${top.toFixed(2)} m high, ${(n / 60).toFixed(2)} s in the air`);
if (top < 0.4 || top > 1 || n > 60) fail('a jump is not a jump');
for (let k = 0; k < 30; k++) stepWorld(w, { ...go, crouch: true });
stepWorld(w, { ...go, crouch: true, forward: 1, run: true });
console.log(`  crouched: ${p.speed.toFixed(1)} m/s running, eye down ${(p.crouch ?? 0).toFixed(2)}`);
if (p.speed > 2 || (p.crouch ?? 0) < 0.9) fail('crouched, still fast or not down');
stepWorld(w, { ...go, crouch: true, jump: true });
if (p.hopV) fail('jumped while crouched');
for (let k = 0; k < 30; k++) stepWorld(w, go);
stepWorld(w, { ...go, forward: 1 });
if (Math.abs(p.speed - 3.5) > 0.01) fail('standing up, the pace did not come back: ' + p.speed);
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
