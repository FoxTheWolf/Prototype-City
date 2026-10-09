/**
 * What the simulation allocates in its hottest calls (16.1): bytes a call, with the heap measured exactly around a pass
 * over the whole population. The pedestrians' scan asks whereIs for ~3 000 people a tick: a few bytes a call there is
 * tens of MB a second for the garbage collector, felt as hitches. Each must stay at ~0.
 *   npx rolldown tests/alloc.ts --format esm --platform node -o tests/.out/alloc.mjs && node --expose-gc --max-semi-space-size=256 tests/.out/alloc.mjs
 */
import { createWorld, stepWorld } from '../src/sim/world';
import { whereIs, dayPlan } from '../src/sim/citizens';

const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) { console.log('run with node --expose-gc (see the header)'); process.exit(1); }
const W = createWorld(Number(process.env.SEED ?? 42)), P = W.pop, C = W.city, t = 185 * 86400 + 22 * 3600 + 0.123, d = Math.floor(t / 86400);
for (let i = 0; i < P.n; i++) whereIs(P, C, i, t); // the plans made first: what is measured is the lookups
let bad = 0;
function per(label: string, f: () => void) {
  for (let k = 0; k < 3; k++) f(); // optimized first
  gc!(); const a = process.memoryUsage().heapUsed; f(); const b = process.memoryUsage().heapUsed;
  const B = (b - a) / P.n;
  console.log(`${label.padEnd(10)} ${B.toFixed(1)} B a call`);
  if (B > 4) { bad++; console.log(`  FAIL: ${label} allocates on every call`); }
}
per('whereIs', () => { for (let i = 0; i < P.n; i++) whereIs(P, C, i, t); });
per('dayPlan', () => { for (let i = 0; i < P.n; i++) dayPlan(P, C, i, d); });
// a whole tick on the night street of the golden positions (cars driven near the player, people walking): for now only
// reported, the traffic and the people still allocate (the next to shrink)
W.player.x = W.player.px = 828; W.player.y = W.player.py = 800; W.time = 15978114;
const still = { forward: 0, strafe: 0, run: false, heading: 0 };
for (let k = 0; k < 1200; k++) stepWorld(W, still);
gc(); { const a = process.memoryUsage().heapUsed, t0 = performance.now(); for (let k = 0; k < 600; k++) stepWorld(W, still); const b = process.memoryUsage().heapUsed;
  console.log(`stepWorld  ${((b - a) / 600 / 1024).toFixed(1)} KB a tick, ${((performance.now() - t0) / 600).toFixed(2)} ms (${W.cars.length} cars, ${W.peds.length} people)`); }
console.log(bad ? `${bad} FAILED` : 'ok');
process.exit(bad ? 1 : 0);
