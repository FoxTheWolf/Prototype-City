/**
 * Sitting (13.10f) in Node without the browser:
 *   npx rolldown tests/seats.ts --format esm --platform node -o tests/.out/seats.mjs && node tests/.out/seats.mjs [seed]
 * Facing a café's chair, F's target is that chair; seated, walking input does not move the player and the
 * notebook opens on the table in front; standing up puts them back where they stood. Outside, the same with a bench.
 */
import { blockAt } from '../src/sim/city';
import { planOf } from '../src/sim/interior';
import { seatAhead, sitDown, standUp } from '../src/sim/seats';
import { createWorld, stepWorld } from '../src/sim/world';
import { findSeat } from '../src/laptop/laptop';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const p = w.player;

// a café's chair at a table
const b = w.city.businesses.find((b) => b.kind === 'cafe' && planOf(w.city, b.building, 0)?.furn.some((f) => f.kind === 'chair'))!;
const P = planOf(w.city, b.building, 0)!, ch = P.furn.find((f) => f.kind === 'chair')!;
// stand behind the chair's back, a metre off, facing the way it faces
Object.assign(p, { inside: b.building, floor: 0, z: 0, x: ch.x - ch.c * 1.0, y: ch.y - ch.s * 1.0 });
p.px = p.x; p.py = p.y;
const yaw = Math.atan2(ch.s, ch.c), from = [p.x, p.y];
const s = seatAhead(w, yaw);
if (!s || s.kind !== 'chair' || Math.hypot(s.x - ch.x, s.y - ch.y) > 0.01) fail(`facing the chair, F does not sit on it (${JSON.stringify(s)})`);
if (seatAhead(w, yaw + Math.PI)?.x === ch.x) fail('a chair behind the player is in front');
sitDown(w, s!);
for (let i = 0; i < 30; i++) stepWorld(w, { forward: 1, strafe: 0, run: false, heading: yaw });
if (Math.hypot(p.x - ch.x, p.y - ch.y) > 0.01) fail('seated, walking input moved the player');
const seat = findSeat(w);
const nearTable = P.furn.some((f) => f.kind === 'table' && Math.hypot(f.x - ch.x - ch.c * 0.6, f.y - ch.y - ch.s * 0.6) < Math.max(f.hx, f.hy) + 0.5);
if (typeof seat === 'string' || seat.eye !== s!.eye || seat.kind !== (nearTable ? 'table' : 'sofa')) fail(`the notebook does not use the seat (${JSON.stringify(seat)})`);
standUp(w);
if (p.sit || p.x !== from[0] || p.y !== from[1]) fail('standing up did not put the player back where they stood');

// a bench on a sidewalk
let bench: { x: number; y: number; a: number } | null = null;
for (const blk of w.city.blocks) { const q = blk.props.find((q) => q.kind === 'bench'); if (q) { bench = q; break; } }
if (!bench) fail('no bench in the city');
else {
  Object.assign(p, { inside: -1, floor: 0, z: 0, x: bench.x + Math.cos(bench.a) * 1.0, y: bench.y + Math.sin(bench.a) * 1.0 });
  const t = seatAhead(w, bench.a + Math.PI);
  if (!t || t.kind !== 'bench' || Math.hypot(t.x - bench.x, t.y - bench.y) > 0.7) fail(`facing the bench, F does not sit on it (${JSON.stringify(t)})`);
  else if (Math.abs(Math.atan2(Math.sin(t.yaw - bench.a), Math.cos(t.yaw - bench.a))) > 1e-6) fail('on the bench the player does not face its way');
  if (!blockAt(w.city, bench.x, bench.y)) fail('the bench is off its block');
}
if (fails) process.exit(1);
console.log('OK');
