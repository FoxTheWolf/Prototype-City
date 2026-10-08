/**
 * The stairs of the drawn plans (rework of the interiors, step 4), in Node:
 *   npx rolldown tests/stairs.ts --format esm --platform node -o tests/.out/stairs.mjs && node tests/.out/stairs.mjs [seed]
 * In walk-ups of every family: from the landing, walk onto the flight's low end and up it to the next floor; the
 * feet climb step by step and arrive a storey up; walking into the flight's side (its rail) is stopped; back down
 * again to the ground. Exits with 1 on a failure.
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
  // on the first step, then up the flight to its flat top, and off it onto the landing beside (the rail's side)
  const lx = S.seed === 1 ? S.s : -S.s, ly = S.seed === 1 ? -S.c : S.c, steps = Math.ceil(((2 * S.hx) / 3.5) * 60) + 30;
  put(k, S.x - S.c * (S.hx - 0.35), S.y - S.s * (S.hx - 0.35), 0);
  stepWorld(w, { forward: 0, strafe: 0, run: false, heading: up });
  walk(up, steps);
  walk(Math.atan2(ly, lx), 40);
  if (Math.abs(p.z - FLOOR_H) > 0.05 || p.floor !== 1) fail(`${at}: up the flight the feet are at ${p.z.toFixed(2)} m, floor ${p.floor}`);
  // back down: from the flat top's middle down the flight to its foot (the last step's 2 cm included: the foot may be a
  // corridor narrower than the flight, D, where walking straight on meets its wall)
  put(k, S.x + S.c * (S.hx - 0.25), S.y + S.s * (S.hx - 0.25), FLOOR_H);
  walk(up + Math.PI, steps);
  if (Math.abs(p.z) > 0.1 || p.floor !== 0) fail(`${at}: down again the feet are at ${p.z.toFixed(2)} m, floor ${p.floor} (u ${((p.x - S.x) * S.c + (p.y - S.y) * S.s).toFixed(2)}, v ${(-(p.x - S.x) * S.s + (p.y - S.y) * S.c).toFixed(2)})`);
  // from beside the flight's middle, walking into its side: stopped (the rail), at the floor's level
  const rx = -S.s, ry = S.c;
  for (const side of [1, -1]) {
    put(k, S.x + rx * side * (S.hy + 0.5), S.y + ry * side * (S.hy + 0.5), 0);
    const [lo, hi] = walk(Math.atan2(-ry * side, -rx * side), 60);
    if (hi > 0.05 || lo < -0.05) fail(`${at}: walking into the flight's side from ${side > 0 ? 'the right' : 'the left'}, the feet went to ${hi.toFixed(2)} m`);
  }
  console.log(`  ${at}: up and down the flight, its side holds`);
}
if (!tried) fail('no walk-up of three floors or more on a drawn plan');
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
