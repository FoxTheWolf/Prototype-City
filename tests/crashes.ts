/**
 * How often cars crash (C3a), in Node:
 *   npx rolldown tests/crashes.ts --format esm --platform node -o tests/.out/crashes.mjs && node tests/.out/crashes.mjs [seed] [real minutes]
 * Runs the city with the player standing where the game starts and counts the crash events (each counted once),
 * per real minute and per game hour; to compare versions (git worktree of an old commit, same script).
 */
import { createWorld, stepWorld } from '../src/sim/world';

const seed = Number(process.argv[2] ?? 42), mins = Number(process.argv[3] ?? 5);
const w = createWorld(seed) as any;
const go = { forward: 0, strafe: 0, run: false, heading: 0 };
const seen = new Set<unknown>();
let crashes = 0, near = 0;
const start = Date.now(), N = mins * 3600;
for (let n = 0; n < N; n++) {
  stepWorld(w, go);
  for (const e of w.events?.list ?? []) if (e.kind === 'crash' && !seen.has(e)) { seen.add(e); crashes++; if (Math.hypot(e.x - w.player.x, e.y - w.player.y) < 300) near++; }
}
const free = (w.cars ?? []).filter((c: any) => c.wreck).length;
console.log(`seed ${seed}: ${mins} real min, ${w.cars?.length} cars, ${crashes} crashes (${(crashes / mins).toFixed(2)}/real min), ${near} within 300 m (${(near / mins).toFixed(2)}/real min), wrecks now ${free}, run ${((Date.now() - start) / 1000).toFixed(0)} s`);
