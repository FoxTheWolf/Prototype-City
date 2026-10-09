/**
 * The rooms' lights (13.22, sim/lights.ts): over a day in July, the share of homes with someone up and of offices working
 * (what the far facades use), how long lightsOf takes for the lots near a point (what gpu/world.ts asks for every game
 * minute), and that a switch the player turned wins.
 *   npx rolldown tests/lights.ts --format esm --platform node -o tests/.out/lights.mjs && node tests/.out/lights.mjs
 */
import { createWorld } from '../src/sim/world';
import { cellAt, floorsOf, planOf, ROOM, WALL } from '../src/sim/interior';
import { lightShares, lightsOf, switchKey, HOME_UP } from '../src/sim/lights';

const W = createWorld(Number(process.env.SEED ?? 42));
const day = 185 * 86400; // July 4th 2008, midnight
let bad = 0;
const row: string[] = [];
for (let h = 0; h < 24; h += 2) { const s = lightShares(W.pop, W.city, day + h * 3600); row.push(`${String(h).padStart(2)}h ${Math.round(s.home * 100)}%/${Math.round(s.work * 100)}%`); }
console.log('homes up / offices working:\n  ' + row.join('  '));
const night = lightShares(W.pop, W.city, day + 3.5 * 3600), eve = lightShares(W.pop, W.city, day + 21 * 3600), noon = lightShares(W.pop, W.city, day + 12 * 3600);
if (!(eve.home > night.home * 2)) { bad++; console.log('  FAIL: homes no more lit at 21h than at 3h30'); }
if (!(noon.work > 0.5 && night.work < 0.3)) { bad++; console.log('  FAIL: offices do not follow the working day'); }

// the lots within 250 m of the middle, as the GPU's near buffer would look them up
const cx = W.city.w / 2, cy = W.city.h / 2, near: number[] = [];
W.city.buildings.forEach((B, k) => { if (B.tier === 1 && Math.max(B.x0 - cx, cx - B.x1, B.y0 - cy, cy - B.y1) < 250) near.push(k); });
let t0 = performance.now(), lit = 0, homes = 0;
for (const k of near) {
  const L = lightsOf(W.pop, W.city, W.lights, k, floorsOf(W.city.buildings[k]), day + 21 * 3600);
  for (let f = 0; f < (L.length - 1) / 3; f++) for (let u = 0; u < 16; u++) { const s = (L[1 + f * 3] >> (2 * u)) & 3; if (s) homes++; if (s & HOME_UP) lit++; }
}
console.log(`${near.length} lots near the middle in ${(performance.now() - t0).toFixed(1)} ms; ${lit} homes with someone up at 21h`);
if (!lit) { bad++; console.log('  FAIL: no home lit near the middle at 21h'); }

// a switch wins
const k = near[0];
W.lights.set(switchKey(k, 1, 3), false);
const L = lightsOf(W.pop, W.city, W.lights, k, 3, day);
if (!((L[1 + 3 + 1] >> 3) & 1) || ((L[1 + 3 + 2] >> 3) & 1)) { bad++; console.log('  FAIL: the switch is not in the floor\'s words'); }
// the switches (R10): one in each room but the ways out, on a wall, facing into its own room
let rooms = 0, withSw = 0, wrong = 0;
const miss = new Map<string, number>();
for (const k of near) for (const f of [0, 1]) {
  const P = planOf(W.city, k, f);
  if (!P) continue;
  const sw = new Map<number, number>();
  for (const F of P.furn) if (F.kind === 'switch') {
    sw.set(F.seed, (sw.get(F.seed) ?? 0) + 1);
    const front = cellAt(P, F.x + F.c * 0.1, F.y + F.s * 0.1), back = cellAt(P, F.x - F.c * 0.06, F.y - F.s * 0.06);
    if ((front & ROOM) !== F.seed + 1 || (front & WALL) || !(back & WALL)) { wrong++; if (wrong < 4) console.log(`  bad switch: lot ${k} floor ${f} room ${F.seed} (${P.rooms[F.seed].kind})`); }
  }
  P.rooms.forEach((R, r) => { if (['hall', 'lobby', 'stair', 'lift'].includes(R.kind)) return; rooms++; if (sw.has(r)) withSw++; else miss.set(R.kind, (miss.get(R.kind) ?? 0) + 1); if ((sw.get(r) ?? 0) > 1) wrong++; });
}
console.log(`switches: ${withSw} of ${rooms} rooms (${Math.round((100 * withSw) / Math.max(1, rooms))}%), ${wrong} misplaced`);
console.log('  without: ' + [...miss].map(([k, n]) => `${k} ${n}`).join(', '));
if (wrong) bad++;
if (withSw < rooms * 0.6) { bad++; console.log('  FAIL: fewer than 60% of the rooms have a switch'); }
console.log(bad ? `${bad} FAILED` : 'ok');
process.exit(bad ? 1 : 0);
