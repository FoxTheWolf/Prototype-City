/**
 * The furniture by the library (13.20): how many home rooms of the drawn floors the manual's arrangements fit
 * (turned or flipped, passing the rules in the room's real frame), and which rooms still have none.
 *   npx rolldown tests/furnish.ts --format esm --platform node -o tests/.out/furnish.mjs && node tests/.out/furnish.mjs
 */
import { FLOORS, fitArrangements } from '../src/sim/floorplans';

let rooms = 0, fitted = 0;
const none: string[] = [];
for (const F of FLOORS) {
  const R = F.rooms, H = R.length, W = R[0].length, seen = new Set<number>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = R[y][x];
    if (!'lkbhs'.includes(ch) || seen.has(y * W + x)) continue;
    let x1 = x, y1 = y;
    while (R[y][x1 + 1] === ch) x1++;
    while (R[y1 + 1]?.[x] === ch) y1++;
    for (let b = y; b <= y1; b++) for (let a = x; a <= x1; a++) seen.add(b * W + a);
    rooms++;
    const fit = fitArrangements(F, x, y, x1, y1);
    if (fit.length) fitted++; else none.push(`${F.id} ${ch} ${x1 - x + 1}x${y1 - y + 1} at ${x},${y}`);
  }
}
console.log(`home rooms ${rooms}, with an arrangement ${fitted}`);
for (const n of none) console.log('  none:', n);

// in a city (SEED, default 42): every drawn floor read by the game; every piece with a posto has one, and a standing
// posto is on free floor of a room. Run once with no people and once with made-up residents (the scoring path).
import { generateCity } from '../src/sim/city';
import { cellAt, floorsOf, inFurniture, planOf, ROOM, setResidents, stackOf, WALL } from '../src/sim/interior';
import { CITY_SIZE } from '../src/sim/world';
const city = generateCity(Number(process.env.SEED ?? 42), CITY_SIZE);
const WANT: Record<string, string> = { bed: 'sleep', sofa: 'sofa', oven: 'cook', tub: 'shower', desk: 'desk', table: 'eat' };
let bad = 0;
for (const who of [null, (k: number, f: number, u: number) => [['renda baixa', 'renda média', 'renda alta'][(k + f + u) % 3], 'casal', 'gamer']]) {
  setResidents(who);
  let lots = 0, pieces = 0, postos = 0, standing = 0;
  for (let k = 0; k < city.buildings.length; k++) {
    if (!stackOf(city, k)) continue;
    lots++;
    for (let f = 0; f < floorsOf(city.buildings[k]); f++) {
      const P = planOf(city, k, f);
      if (!P) continue;
      for (const q of P.furn) {
        if (!WANT[q.kind] || P.rooms[(cellAt(P, q.x, q.y) & ROOM) - 1]?.kind === 'shop') continue;
        pieces++;
        if (!q.posto) { if (bad++ < 10) console.log(`  no posto: lot ${k} floor ${f} ${q.kind} at ${q.x.toFixed(1)},${q.y.toFixed(1)}`); continue; }
        postos++;
        if (q.posto.kind !== 'cook' && q.posto.kind !== 'dishes' && !(q.posto.x === q.x && q.posto.y === q.y) && q.kind !== 'desk' && q.kind !== 'table') continue;
        if (q.posto.x === q.x && q.posto.y === q.y) continue;
        if (q.posto.kind === 'cook' || q.posto.kind === 'dishes') {
          standing++;
          const c = cellAt(P, q.posto.x, q.posto.y);
          if (!(c & ROOM) || c & WALL || inFurniture(P, q.posto.x, q.posto.y)) { if (bad++ < 10) console.log(`  posto blocked: lot ${k} floor ${f} ${q.kind}`); }
        }
      }
    }
  }
  console.log(`${who ? 'with residents' : 'no people'}: ${lots} drawn lots, ${pieces} pieces with a posto, ${postos} given, ${standing} standing`);
}
console.log(bad ? `FAIL ${bad}` : 'ok');
