/** Prints a ground plan as text (one letter per room, # wall, D doorway) and the cells around one kind of furniture:
 *   npx rolldown tests/plan-print.ts --format esm --platform node -o tests/.out/print.mjs && SEED=42 node tests/.out/print.mjs <lot> [kind] */
import { generateCity } from '../src/sim/city';
import { CELL, DOOR, exitsOf, facePoint, planOf, ROOM, WALL } from '../src/sim/interior';
import { CITY_SIZE } from '../src/sim/world';
const city = generateCity(Number(process.env.SEED ?? 42), CITY_SIZE), k = Number(process.argv[2] ?? 2), B = city.buildings[k], P = planOf(city, k, 0)!;
console.log(B.x0, B.y0, B.x1, B.y1, 'shop', B.shop, 'exits', JSON.stringify(exitsOf(city, k)), 'gx', P.gx, P.gy, P.nx, P.ny);
for (const D of exitsOf(city, k)) console.log('door at', facePoint(B, D.face, (D.a0 + D.a1) / 2));
for (let j = 0; j < P.ny; j++) {
  let s = '';
  for (let i = 0; i < P.nx; i++) { const v = P.cells[j * P.nx + i]; s += !v ? ' ' : v & WALL ? '#' : v & DOOR ? 'D' : String.fromCharCode(96 + (v & ROOM)); }
  console.log(s);
}
for (const f of P.furn) if (f.kind === (process.argv[3] ?? 'toilet')) {
  console.log(JSON.stringify({ ...f, stock: undefined }));
  const ex = Math.abs(f.c) * f.hx + Math.abs(f.s) * f.hy, ey = Math.abs(f.s) * f.hx + Math.abs(f.c) * f.hy;
  console.log('x', f.x - ex, f.x + ex, 'y', f.y - ey, f.y + ey);
  for (let y = Math.floor((f.y - ey) / CELL) - 1; y <= Math.floor((f.y + ey) / CELL) + 1; y++) {
    let s = (y * CELL).toFixed(2) + ' ';
    for (let x = Math.floor((f.x - ex) / CELL) - 1; x <= Math.floor((f.x + ex) / CELL) + 1; x++) { const v = P.cells[(y - P.gy) * P.nx + x - P.gx]; s += v & WALL ? '#' : v & DOOR ? 'D' : String.fromCharCode(96 + (v & ROOM)); }
    console.log(s, 'x0', ((Math.floor((f.x - ex) / CELL) - 1) * CELL).toFixed(2));
  }
}
