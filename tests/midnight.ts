/**
 * The hitch at midnight (16.1): the slowest ticks across the turn of the day, on the night street of the golden positions.
 * Prints the five worst ticks with their game time; a tick past ~8 ms is felt at 180 Hz.
 *   npx rolldown tests/midnight.ts --format esm --platform node -o tests/.out/midnight.mjs && node tests/.out/midnight.mjs
 */
import { createWorld, stepWorld } from '../src/sim/world';

const W = createWorld(Number(process.env.SEED ?? 42));
W.player.x = W.player.px = 828; W.player.y = W.player.py = 800;
const day = Math.floor(15978114 / 86400);
W.time = (day + 1) * 86400 - 3700; // just before the day's last hour, when tomorrow's plans start being made
const still = { forward: 0, strafe: 0, run: false, heading: 0 };
while (W.time < (day + 1) * 86400 - 30) stepWorld(W, still); // the last hour played through (tomorrow made ahead)
const ticks: [number, number][] = [];
while (W.time < (day + 1) * 86400 + 60) {
  const t0 = performance.now(); stepWorld(W, still); ticks.push([performance.now() - t0, W.time - (day + 1) * 86400]);
}
const avg = ticks.reduce((s, [ms]) => s + ms, 0) / ticks.length;
ticks.sort((a, b) => b[0] - a[0]);
console.log(`${ticks.length} ticks, ${avg.toFixed(2)} ms on average; the worst:`);
for (const [ms, at] of ticks.slice(0, 5)) console.log(`  ${ms.toFixed(1)} ms at ${at >= 0 ? '+' : ''}${at.toFixed(0)} s from midnight`);
