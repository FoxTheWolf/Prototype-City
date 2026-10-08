/**
 * The interiors manual's floors and room arrangements against its rules R1-R9, in Node without the browser:
 *   npx rolldown tests/floorplans.ts --format esm --platform node -o tests/.out/floorplans.mjs && node tests/.out/floorplans.mjs
 * Every drawn floor (at each depth it serves), every building's stack of floors and every arrangement must pass;
 * then a few plans broken on purpose must fail, so a rule that stops catching its error is noticed. Exits with 1 on a failure.
 */
import { ARRANGEMENTS, BUILDINGS, checkArrangement, checkBuilding, checkFloor, FLOORS, grow, type Floor } from '../src/sim/floorplans';

let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };

for (const F of FLOORS) for (const d of F.depths ?? [0]) {
  const e = checkFloor(d ? grow(F, d) : F);
  if (e.length) fail(`${F.id}${d ? ` (${d} m)` : ''}: ${e.join('; ')}`);
}
for (const B of BUILDINGS) for (const e of checkBuilding(B)) fail(e);
for (const A of ARRANGEMENTS) {
  const e = checkArrangement(A);
  if (e.length) fail(`${A.room} · ${A.who}: ${e.join('; ')}`);
}
console.log(`${FLOORS.length} floors, ${BUILDINGS.length} building stacks, ${ARRANGEMENTS.length} arrangements checked`);

// broken on purpose: each must be caught by its rule
const A1 = FLOORS.find((F) => F.id === 'A1')!;
const edit = (F: Floor, layer: 'rooms' | 'furn', y: number, row: string): Floor => ({ ...F, [layer]: F[layer].map((r, i) => (i === y ? row : r)) });
const broken: [string, Floor, string][] = [
  ['a window off the bay', edit(A1, 'rooms', 0, '#WW##WW##WW##W##'.slice(0, 15) + 'W'), 'R1'],
  ['a door half on a wall', edit(A1, 'rooms', 14, '#+EE++++++DD+++#'), 'R5'],
  ['a sofa in a doorway', edit(A1, 'furn', 13, '..FF............'), 'R5'],
  ['a pocket behind the shower', edit(A1, 'furn', 16, '..............C.'), 'R4'],
  ['a wardrobe at the window', edit(A1, 'furn', 1, '.AAAQQ..TTTT....'), 'R7'],
  ['a bedroom walled off', edit(edit(A1, 'rooms', 3, '#bbbbbb+lllllll#'), 'rooms', 4, '#bbbbbb+lllllll#'), 'R4'],
];
for (const [what, F, rule] of broken) {
  const e = checkFloor(F);
  if (!e.some((m) => m.startsWith(rule))) fail(`${what}: ${rule} did not catch it (${e.join('; ') || 'passed'})`);
}
const stack = { name: 'moved stair', floors: ['A0', 'A1'] };
const moved = FLOORS.map((F) => (F.id === 'A1' ? edit(F, 'rooms', 15, '#+SSSSSSSSS+hhh#') : F));
if (!checkBuilding(stack, moved).length) fail('a stair moved between floors: R9 did not catch it');
const bed = ARRANGEMENTS.find((A) => A.room === 'A1 quarto')!;
if (!checkArrangement({ ...bed, rows: ['......', 'BBB...', 'BBB...', 'BBB..A', 'BBB..A', '......', 'AAA...'] }).length) fail('an arrangement blocking its door passed');

console.log(fails ? `${fails} failure(s)` : 'ok');
process.exit(fails ? 1 : 0);
