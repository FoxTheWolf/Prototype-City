/** Prints a lot's drawn stack (its floors as the manual's text, grown to the lot) and how the game reads floor f:
 *   npx rolldown tests/stack-print.ts --format esm --platform node -o tests/.out/stack-print.mjs && SEED=42 node tests/.out/stack-print.mjs <lot> [floor] */
import { generateCity } from '../src/sim/city';
import { DOOR, floorsOf, leavesOf, planOf, ROOM, stackOf, WALL } from '../src/sim/interior';
import { CITY_SIZE } from '../src/sim/world';
const city = generateCity(Number(process.env.SEED ?? 42), CITY_SIZE), k = Number(process.argv[2] ?? 2), f = Number(process.argv[3] ?? 1);
const B = city.buildings[k], St = stackOf(city, k);
console.log('lot', k, B.x0, B.y0, B.x1, B.y1, 'floors', floorsOf(B), 'shop', B.shop);
if (!St) { console.log('no drawn stack'); process.exit(0); }
console.log('face', St.face, 'W', St.W, 'D', St.D, 'mirror', St.mirror, 'ground', St.ground.id, 'upper', St.upper?.id, 'roof', St.roof?.id);
const Fl = f === 0 ? St.ground : St.upper ?? St.ground;
Fl.rooms.forEach((r, y) => console.log(r, ' ', Fl.furn[y]));
const P = planOf(city, k, f)!;
console.log('rooms', P.rooms.map((r, i) => `${i + 1}:${r.kind}/u${r.unit}`).join(' '));
for (let j = 0; j < P.ny; j++) {
  let s = '';
  for (let i = 0; i < P.nx; i++) { const v = P.cells[j * P.nx + i]; s += !v ? ' ' : v & WALL ? '#' : v & DOOR ? 'D' : String.fromCharCode(96 + (v & ROOM)); }
  console.log(s);
}
for (const q of P.furn) console.log(q.kind, q.x.toFixed(2), q.y.toFixed(2), 'c', q.c, 's', q.s, 'hx', q.hx.toFixed(2), 'hy', q.hy.toFixed(2));
for (const L of leavesOf(P)) console.log('leaf', P.rooms[L.ra]?.kind, '->', P.rooms[L.rb]?.kind, 'w', L.w, 'at', L.cx.toFixed(2), L.cy.toFixed(2), 'swing', L.nx, L.ny, 'kind', L.kind);
