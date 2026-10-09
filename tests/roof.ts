/**
 * The roofs of the drawn stacks (13.23; the manual's T plans), in Node:
 *   npx rolldown tests/roof.ts --format esm --platform node -o tests/.out/roof.mjs && node tests/.out/roof.mjs [seed]
 * In walk-ups of every family: from the top floor's landing up the U to the roof (its plan, the stair house); across
 * the roof to the parapet, which holds (nobody walks off a roof); back down the same way.
 */
import { FLOOR_H } from '../src/sim/city';
import { feetZ, floorsOf, planOf, stackOf } from '../src/sim/interior';
import { createWorld, stepWorld } from '../src/sim/world';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0, tried = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const p = w.player, seen = new Set<string>();
const put = (k: number, x: number, y: number, z: number) => { p.inside = k; p.x = p.px = x; p.y = p.py = y; p.z = feetZ(w.city, k, x, y, z); p.floor = Math.floor((p.z + 0.01) / FLOOR_H); p.liftTo = -1; };
for (let k = 0; k < w.city.buildings.length && seen.size < 6; k++) {
  const St = stackOf(w.city, k), B = w.city.buildings[k];
  if (!St?.roof || seen.has(St.roof.id + St.ground.id) || floorsOf(B) < 3) continue;
  seen.add(St.roof.id + St.ground.id);
  tried++;
  const top = floorsOf(B), at = `${St.roof.id} over ${St.ground.id} (lot ${k}, ${top} floors)`;
  const R = planOf(w.city, k, top);
  if (!R || !R.rooms.some((r) => r.kind === 'roof')) { fail(`${at}: no roof plan`); continue; }
  if (R.furn.some((f) => f.kind === 'stair')) fail(`${at}: a stair going up from the roof`);
  const S = planOf(w.city, k, top - 1)!.furn.find((f) => f.kind === 'stair')!;
  const P = (u: number, v: number): [number, number] => [S.x + S.c * u - S.s * v, S.y + S.s * u + S.c * v];
  const toward = (x: number, y: number) => Math.atan2(y - p.y, x - p.x);
  const lane = (S.hy + 0.05) / 2 + 0.05, n = Math.ceil((S.hx * 2 + 1) / 3.5 * 60) + 20;
  const go = (u: number, v: number) => { for (let t = 0; t < n && Math.hypot(P(u, v)[0] - p.x, P(u, v)[1] - p.y) > 0.08; t++) stepWorld(w, { forward: 1, strafe: 0, run: false, heading: toward(...P(u, v)) }); };
  // up from the top floor's landing
  put(k, ...P(-S.hx - 0.5, -lane), (top - 1) * FLOOR_H);
  go(-S.hx + 0.1, -lane); go(S.hx - 0.4, -lane); go(S.hx - 0.4, lane); go(-S.hx + 0.1, lane); go(-S.hx - 0.5, lane);
  if (Math.abs(p.z - top * FLOOR_H) > 0.05 || p.floor !== top) { fail(`${at}: up the last stair the feet are at ${p.z.toFixed(2)} m, floor ${p.floor}`); continue; }
  // out of the stair house through its door, and across the roof toward the far side: the parapet holds
  const roofRoom = R.rooms.findIndex((r) => r.kind === 'roof'), RR = R.rooms[roofRoom];
  const cx = (RR.x0 + RR.x1) / 2, cy = (RR.y0 + RR.y1) / 2;
  for (let t = 0; t < 900 && Math.hypot(cx - p.x, cy - p.y) > 0.3; t++) stepWorld(w, { forward: 1, strafe: 0, run: false, heading: toward(cx, cy) });
  const out = Math.hypot(cx - p.x, cy - p.y);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let t = 0; t < 600; t++) stepWorld(w, { forward: 1, strafe: 0, run: true, heading: Math.atan2(dy, dx) });
    // (walking back into the stair house and down its flight is allowed: only leaving the lot, or rising, is not)
    if (p.x < B.x0 || p.x > B.x1 || p.y < B.y0 || p.y > B.y1 || p.z > top * FLOOR_H + 0.05) { fail(`${at}: walked off the roof toward (${dx}, ${dy}): at ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(2)} m`); break; }
  }
  console.log(`  ${at}: up to the roof${out > 0.3 ? ` (got within ${out.toFixed(1)} m of its middle)` : ', out to its middle'}, the parapet holds`);
  // and back down
  put(k, ...P(-S.hx - 0.5, lane), top * FLOOR_H);
  go(-S.hx + 0.1, lane); go(S.hx - 0.4, lane); go(S.hx - 0.4, -lane); go(-S.hx + 0.1, -lane); go(-S.hx - 0.5, -lane);
  if (Math.abs(p.z - (top - 1) * FLOOR_H) > 0.05 || p.floor !== top - 1) fail(`${at}: down from the roof the feet are at ${p.z.toFixed(2)} m, floor ${p.floor}`);
}
if (!tried) fail('no drawn stack with a roof');
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
