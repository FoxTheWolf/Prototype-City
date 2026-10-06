/**
 * The city's invariants that the story leans on, run in Node without the browser (13.10e):
 *   npx rolldown tests/city.ts --format esm --platform node -o tests/.out/city.mjs && node tests/.out/city.mjs [seed...]
 * For each seed: a motel with a cybercafé 300 to 500 m away by the streets (the first night: the player
 * arrives at a motel and finds the cybercafé by its address, 2 to 3 game hours on foot). Exits with 1 on a failure.
 */
import { generateCity } from '../src/sim/city';
import { CITY_SIZE } from '../src/sim/world';

const seeds = process.argv.length > 2 ? process.argv.slice(2).map(Number) : [42, 711445483, 7, 1, 2, 3, 4, 5, 99, 1234];
let fails = 0;
for (const seed of seeds) {
  const city = generateCity(seed, CITY_SIZE);
  const at = (k: number) => { const B = city.buildings[city.businesses[k].building]; return [(B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2]; };
  const of = (kind: string) => city.businesses.flatMap((b, k) => (b.kind === kind ? [k] : []));
  const cybers = of('cyber');
  // by the streets: the grid's walk, along x then y
  const pairs = of('motel').filter((m) => cybers.some((q) => { const [a, b] = at(m), [x, y] = at(q), d = Math.abs(a - x) + Math.abs(b - y); return d >= 300 && d <= 500; }));
  if (!pairs.length) { fails++; console.log(`FAIL seed ${seed}: no motel with a cybercafé 300-500 m away by the streets`); }
  else console.log(`seed ${seed}: ${pairs.length} motels with a cybercafé 300-500 m away`);
}
process.exit(fails ? 1 : 0);
