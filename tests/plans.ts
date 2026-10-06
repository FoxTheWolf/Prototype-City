/**
 * The plans' invariants, run in Node without the browser (13.10a):
 *   npx rolldown tests/plans.ts --format esm --platform node -o tests/.out/plans.mjs && node tests/.out/plans.mjs [seed]
 * One seed per run: the plans are kept in caches keyed by the building's index (sim/interior.ts).
 * For every building with an inside, on the ground floor and the first floor up: every room can be
 * walked into (from the street doors downstairs, from the lift upstairs) going round the furniture,
 * the way `blocked` lets the player walk; every street door opens into the plan; no piece of furniture
 * stands on a wall or a doorway; every till can be walked up to from the street (13.10c); every lot has a street door,
 * and every street door opens onto ground that reaches the street, not a yard closed in behind the buildings (13.10e).
 * Prints the failures and exits with 1 if there are any.
 */
import { BAY, generateCity, isSolid, type City } from '../src/sim/city';
import { CELL, DOOR, exitsOf, facePoint, floorsOf, habitable, inFurniture, planOf, ROOM, WALL, type Plan } from '../src/sim/interior';
import { CITY_SIZE } from '../src/sim/world';

const seeds = [Number(process.argv[2] ?? 42)];
let fails = 0, plans = 0, rooms = 0;
/** Known: lots closed in on every side (no street door at all); shops with no way in (none since 13.10c). */
let noDoor = 0, shutShops = 0, tills = 0;
const fail = (msg: string) => { if (++fails <= 40) console.log('FAIL ' + msg); };

for (const seed of seeds) {
  const city = generateCity(seed, CITY_SIZE);
  const reached = streetGround(city);
  // the buildings stand on the grid of the bays
  for (const B of city.buildings) if (B.tier === 1 && [B.x0, B.y0, B.x1, B.y1].some((v) => Math.abs(v / BAY - Math.round(v / BAY)) > 1e-6)) { fail(`seed ${seed}: a building off the grid of the bays (${B.x0}, ${B.y0}, ${B.x1}, ${B.y1})`); break; }
  city.buildings.forEach((B, k) => {
    if (!habitable(B)) return;
    for (const f of floorsOf(B) > 1 ? [0, 1] : [0]) {
      const P = planOf(city, k, f);
      if (!P) continue;
      plans++;
      const doors = f === 0 ? exitsOf(city, k).map((D) => facePoint(B, D.face, (D.a0 + D.a1) / 2)) : null;
      if (doors && !doors.length) { noDoor++; fail(`seed ${seed} lot ${k}: no street door`); continue; }
      if (doors) for (const [x, y, nx, ny] of doors) if (!reached(x + nx * 0.8, y + ny * 0.8)) fail(`seed ${seed} lot ${k}: a street door at (${x.toFixed(1)}, ${y.toFixed(1)}) opens onto a yard closed in`);
      check(P, `seed ${seed} lot ${k} floor ${f}`, doors);
    }
  });
}
console.log(`${plans} plans, ${rooms} rooms, ${tills} tills, ${fails} failures (known: ${noDoor} lots closed in with no street door, ${shutShops} shops with no way in)`);
process.exit(fails ? 1 : 0);


/** The open ground joined to the streets (a flood over a 0.5 m grid from the city's first open cell, on a road): is (x, y) on it? */
function streetGround(city: City): (x: number, y: number) => boolean {
  const S = 0.5, W = Math.ceil(city.w / S), H = Math.ceil(city.h / S), seen = new Uint8Array(W * H), open = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) open[j * W + i] = isSolid(city, (i + 0.5) * S, (j + 0.5) * S) ? 0 : 1;
  const q = [open.indexOf(1)];
  seen[q[0]] = 1;
  while (q.length) {
    const k = q.pop()!, i = k % W, j = (k - i) / W;
    for (const n of [i + 1 < W ? k + 1 : -1, i > 0 ? k - 1 : -1, j + 1 < H ? k + W : -1, j > 0 ? k - W : -1]) if (n >= 0 && open[n] && !seen[n]) { seen[n] = 1; q.push(n); }
  }
  return (x, y) => !!seen[Math.floor(y / S) * W + Math.floor(x / S)];
}

function check(P: Plan, at: string, doors: [number, number, number, number][] | null) {
  const { cells, nx, ny } = P, n = nx * ny;
  const free = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    const i = c % nx, j = (c - i) / nx;
    free[c] = cells[c] && !inFurniture(P, (P.gx + i + 0.5) * CELL, (P.gy + j + 0.5) * CELL) ? 1 : 0;
  }
  // where the walk starts: just inside each street door, or anywhere in the lift
  const seen = new Uint8Array(n), stack: number[] = [];
  const start = (c: number) => { if (c >= 0 && c < n && free[c] && !seen[c]) { seen[c] = 1; stack.push(c); } };
  if (doors) for (const [x, y, nX, nY] of doors) {
    const c = (Math.floor((y - nY * 0.4) / CELL) - P.gy) * nx + Math.floor((x - nX * 0.4) / CELL) - P.gx;
    if (!cells[c] || cells[c] & WALL) fail(`${at}: a street door at (${x.toFixed(1)}, ${y.toFixed(1)}) opens onto ${cells[c] ? 'a wall' : 'nothing'}`);
    start(c);
  } else for (let c = 0; c < n; c++) if (cells[c] && P.rooms[(cells[c] & ROOM) - 1].kind === 'lift' && !(cells[c] & WALL)) start(c);
  while (stack.length) {
    const c = stack.pop()!, i = c % nx, v = cells[c];
    for (const d of [1, -1, nx, -nx]) {
      if ((d === 1 && i === nx - 1) || (d === -1 && i === 0)) continue;
      const e = c + d, w = cells[e];
      if (e < 0 || e >= n || !free[e] || seen[e]) continue;
      if (w & WALL && !(v & WALL)) continue;
      if ((w & ROOM) !== (v & ROOM) && !(w & v & DOOR)) continue;
      seen[e] = 1; stack.push(e);
    }
  }
  P.rooms.forEach((R, r) => {
    rooms++;
    let has = false, got = false;
    for (let c = 0; c < n; c++) if ((cells[c] & ROOM) === r + 1 && !(cells[c] & WALL)) { has = true; if (seen[c]) { got = true; break; } }
    if (has && !got && (R.kind === 'shop' || R.kind === 'store')) shutShops++;
    else if (has && !got) fail(`${at}: room ${r} (${R.kind}, ${(R.x1 - R.x0).toFixed(1)} x ${(R.y1 - R.y0).toFixed(1)} m) cannot be walked into`);
  });
  // every till can be walked to from the street (13.10c)
  if (doors) for (const f of P.furn) if (f.kind === 'till') {
    const c = (Math.floor((f.y + f.s * (f.hx + 0.3)) / CELL) - P.gy) * nx + Math.floor((f.x + f.c * (f.hx + 0.3)) / CELL) - P.gx;
    tills++;
    if (!seen[c]) fail(`${at}: the till at (${f.x.toFixed(1)}, ${f.y.toFixed(1)}) cannot be walked up to`);
  }
  for (const f of P.furn) {
    const ex = Math.abs(f.c) * f.hx + Math.abs(f.s) * f.hy, ey = Math.abs(f.s) * f.hx + Math.abs(f.c) * f.hy;
    for (let y = f.y - ey + 0.05; y < f.y + ey; y += CELL) for (let x = f.x - ex + 0.05; x < f.x + ex; x += CELL) {
      const i = Math.floor(x / CELL) - P.gx, j = Math.floor(y / CELL) - P.gy, v = i >= 0 && j >= 0 && i < nx && j < ny ? cells[j * nx + i] : 0;
      if (v & (WALL | DOOR)) { fail(`${at}: a ${f.kind} on a ${v & WALL ? 'wall' : 'doorway'} at (${x.toFixed(1)}, ${y.toFixed(1)})`); return; }
    }
  }
}
