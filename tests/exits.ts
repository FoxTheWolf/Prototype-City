/** The way out (13.19, Plan.exitTo): no EXIT inside a home or a shop; every common room of a drawn plan finds the
 *  street (ground floor) or the stair (above) through the common parts; the way never loops. One seed a run:
 *   npx rolldown tests/exits.ts --format esm --platform node -o tests/.out/exits.mjs && SEED=42 node tests/.out/exits.mjs */
import { generateCity } from '../src/sim/city';
import { floorsOf, planOf, stackOf } from '../src/sim/interior';
import { CITY_SIZE } from '../src/sim/world';
const seed = Number(process.env.SEED ?? 42), city = generateCity(seed, CITY_SIZE);
let plans = 0, signs = 0, lost = 0, bad = 0;
const fails: string[] = [];
for (let k = 0; k < city.buildings.length; k++) {
  const B = city.buildings[k];
  if (B.tier !== 1 || !stackOf(city, k)) continue;
  for (const f of floorsOf(B) > 1 ? [0, 1] : [0]) {
    const P = planOf(city, k, f);
    if (!P?.exitTo) continue;
    plans++;
    P.rooms.forEach((R, r) => {
      const nx = P.exitTo![r];
      if (nx) signs++;
      if (nx && R.unit >= 0) { bad++; if (fails.length < 12) fails.push(`lot ${k} floor ${f}: EXIT in ${R.kind} (unit ${R.unit})`); }
      if (R.unit >= 0) return;
      // a common room: follow the way to its end, which must be at the street door or the stair
      let r2 = r, n = 0;
      while (P.exitTo![r2] && n < 64) { r2 = P.exitTo![r2] - 1; n++; }
      const end = P.rooms[r2], ok = f === 0 ? n > 0 || r2 === r : end.kind === 'stair';
      if (n >= 64 || (f > 0 && end.kind !== 'stair') || !ok) { lost++; if (fails.length < 12) fails.push(`lot ${k} floor ${f}: ${R.kind} ends in ${end.kind} after ${n}`); }
    });
  }
}
console.log(`seed ${seed}: ${plans} drawn plans, ${signs} rooms with a sign over their way out, ${bad} inside a home/shop, ${lost} common rooms with no way out`);
for (const s of fails) console.log('  ', s);
process.exit(bad ? 1 : 0);
