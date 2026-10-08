/**
 * The stairs of the drawn plans (rework of the interiors, step 4; the U stair of 2026-10-08), in Node:
 *   npx rolldown tests/stairs.ts --format esm --platform node -o tests/.out/stairs.mjs && node tests/.out/stairs.mjs [seed]
 * In walk-ups of every family: from the landing, up the first flight to the half landing, across, up the second to
 * the next floor's landing, at the same end; back down the same way; the rail between the flights holds; from the
 * ground's landing the second flight (over the head) is out of reach.
 */
import { FLOOR_H } from '../src/sim/city';
import { feetZ, floorsOf, planOf, stackOf } from '../src/sim/interior';
import { createWorld, stepWorld } from '../src/sim/world';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0, tried = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const p = w.player, seen = new Set<string>();
const put = (k: number, x: number, y: number, z: number) => { p.inside = k; p.x = p.px = x; p.y = p.py = y; p.z = feetZ(w.city, k, x, y, z); p.floor = Math.floor((p.z + 0.01) / FLOOR_H); p.liftTo = -1; };
/** Walk toward heading h for n ticks; the highest and lowest feet on the way. */
const walk = (h: number, n: number) => { let hi = -1e9, lo = 1e9; for (let k = 0; k < n; k++) { stepWorld(w, { forward: 1, strafe: 0, run: false, heading: h }); hi = Math.max(hi, p.z); lo = Math.min(lo, p.z); } return [lo, hi]; };
for (let k = 0; k < w.city.buildings.length && seen.size < 6; k++) {
  const St = stackOf(w.city, k);
  if (!St || seen.has(St.ground.id) || floorsOf(w.city.buildings[k]) < 3) continue;
  seen.add(St.ground.id);
  tried++;
  const S = planOf(w.city, k, 0)!.furn.find((f) => f.kind === 'stair');
  if (!S) { fail(`${St.ground.id} (lot ${k}): no stair`); continue; }
  const up = Math.atan2(S.s, S.c), at = `${St.ground.id} (lot ${k})`;
  // a point of the piece's frame (u along the first flight's climb, v across: the first flight on v < 0)
  const P = (u: number, v: number): [number, number] => [S.x + S.c * u - S.s * v, S.y + S.s * u + S.c * v];
  const toward = (u: number, v: number) => Math.atan2(P(u, v)[1] - p.y, P(u, v)[0] - p.x);
  const lane = (S.hy + 0.05) / 2 + 0.05, n = Math.ceil((S.hx * 2 + 1) / 3.5 * 60) + 20;
  /** Walk to the piece point (u, v) in a straight line (n ticks at most). */
  const go = (u: number, v: number) => { let lo = 1e9, hi = -1e9; for (let t = 0; t < n && Math.hypot(P(u, v)[0] - p.x, P(u, v)[1] - p.y) > 0.08; t++) { stepWorld(w, { forward: 1, strafe: 0, run: false, heading: toward(u, v) }); lo = Math.min(lo, p.z); hi = Math.max(hi, p.z); } return [lo, hi]; };
  // up: the landing, the first flight, the half landing, the second flight, the next floor's landing
  put(k, ...P(-S.hx - 0.5, -lane), 0);
  go(-S.hx + 0.1, -lane); go(S.hx - 0.4, -lane);
  if (Math.abs(p.z - FLOOR_H / 2) > 0.05) fail(`${at}: on the half landing the feet are at ${p.z.toFixed(2)} m`);
  go(S.hx - 0.4, lane); go(-S.hx + 0.1, lane); go(-S.hx - 0.5, lane);
  if (Math.abs(p.z - FLOOR_H) > 0.05 || p.floor !== 1) fail(`${at}: up the stair the feet are at ${p.z.toFixed(2)} m, floor ${p.floor}`);
  // and down the same way
  go(-S.hx + 0.1, lane); go(S.hx - 0.4, lane); go(S.hx - 0.4, -lane); go(-S.hx + 0.1, -lane); go(-S.hx - 0.5, -lane);
  if (Math.abs(p.z) > 0.05 || p.floor !== 0) fail(`${at}: down again the feet are at ${p.z.toFixed(2)} m, floor ${p.floor}`);
  // the rail: from the first flight's middle, walking across to the second: stopped at the first's height
  put(k, ...P(-S.hx + 1.1, -lane), 0.9);
  const z1 = p.z, [lo1, hi1] = go(-S.hx + 1.1, lane);
  if (hi1 - lo1 > 0.05 || Math.abs(p.z - z1) > 0.05) fail(`${at}: across the rail the feet went from ${z1.toFixed(2)} to ${p.z.toFixed(2)} m`);
  // from the ground's landing into the second flight (it starts at the next floor): stopped
  put(k, ...P(-S.hx - 0.5, lane), 0);
  const [, hi2] = go(-S.hx + 1, lane);
  if (hi2 > 0.05) fail(`${at}: from the landing under the second flight the feet went to ${hi2.toFixed(2)} m`);
  console.log(`  ${at}: up and down the U, the rail holds, the second flight out of reach from below`);
}
if (!tried) fail('no walk-up of three floors or more on a drawn plan');
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
