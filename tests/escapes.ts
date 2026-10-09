/**
 * Fire escapes against the plans (13.24), in Node; one seed a run:
 *   npx rolldown tests/escapes.ts --format esm --platform node -o tests/.out/escapes.mjs && SEED=42 node tests/.out/escapes.mjs
 * Each escape's two windows give, on every floor it serves, onto a home's room (living, bedroom, kitchen) through an
 * opening in the outer wall; and how many brick walk-ups have one.
 */
import { generateCity } from '../src/sim/city';
import { BAY } from '../src/sim/city';
import { cellAt, CELL, escapesOf, facePoint, floorsOf, planOf, ROOM, WALL } from '../src/sim/interior';
import { CITY_SIZE } from '../src/sim/world';

const seed = Number(process.env.SEED ?? 42), city = generateCity(seed, CITY_SIZE);
let lots = 0, withEsc = 0, escs = 0, fails = 0;
const fail = (m: string) => { if (fails++ < 12) console.log('FAIL ' + m); };
const t0 = Date.now();
for (let k = 0; k < city.buildings.length; k++) {
  const B = city.buildings[k];
  if (B.tier !== 1 || B.style !== 'brick' || B.feat >= 0.45 || B.h <= 12) continue;
  lots++;
  // the ground plan first, as the game has it (the shops' doors move the escapes)
  planOf(city, k, 0);
  const E = escapesOf(city, k);
  if (E.length) withEsc++;
  escs += E.length;
  for (const e of E) for (let f = 1; f <= Math.min(e.top, floorsOf(B) - 1); f++) {
    const P = planOf(city, k, f);
    if (!P) { fail(`lot ${k} floor ${f}: no plan`); continue; }
    for (const a of [e.a0 + 0.5 * BAY, e.a0 + 1.5 * BAY]) {
      const [x, y, nx, ny] = facePoint(B, e.face, a);
      // through the opening: no wall from the face in, until a room
      let kind = '', wall = false;
      for (let d = CELL / 2; d < 1.2; d += CELL) {
        const c = cellAt(P, x - nx * d, y - ny * d);
        if (c & WALL) { wall = true; continue; }
        const r = (c & ROOM) - 1; kind = r >= 0 ? P.rooms[r].kind : 'none'; break;
      }
      if (wall) fail(`lot ${k} floor ${f} face ${e.face} at ${a}: the window is walled`);
      if (!['living', 'bedroom', 'kitchen'].includes(kind)) fail(`lot ${k} floor ${f} face ${e.face} at ${a}: gives onto ${kind || 'nothing'}`);
    }
  }
}
console.log(`seed ${seed}: ${lots} brick walk-ups, ${withEsc} with an escape, ${escs} escapes, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
