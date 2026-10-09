/**
 * The posts on the sidewalk are solid (C3c), in Node:
 *   npx rolldown tests/posts.ts --format esm --platform node -o tests/.out/posts.mjs && node tests/.out/posts.mjs [seed]
 * Walking straight at a street lamp, a bus shelter's post and a sidewalk shed's post, the player stops
 * short of it; walking the free sidewalk between them, they do not.
 */
import { createWorld, stepWorld, type World } from '../src/sim/world';
import { postAt, shedFaces } from '../src/sim/city';

const w = createWorld(Number(process.argv[2] ?? 42)), c = w.city;
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const p = w.player;
/** From (x, y) walk 3 s toward (tx, ty): how close to it the player got. */
function walk(W: World, x: number, y: number, tx: number, ty: number): number {
  p.x = p.px = x; p.y = p.py = y; p.z = 0; p.floor = 0; p.inside = -1;
  const heading = Math.atan2(ty - y, tx - x);
  for (let k = 0; k < 180; k++) stepWorld(W, { forward: 1, strafe: 0, run: false, heading });
  return Math.hypot(p.x - tx, p.y - ty);
}
const props = c.blocks.flatMap((b) => b.props);
const lamp = props.find((q) => q.kind === 'lamp')!, shelter = props.find((q) => q.kind === 'shelter')!;
// a lamp: from 2 m away along the sidewalk
let d = walk(w, lamp.x - 2, lamp.y, lamp.x, lamp.y);
console.log(`  lamp: stopped ${d.toFixed(2)} m from the pole`);
if (d < 0.2) fail('walked through a lamp');
// the shelter's post (local 0.85, -1.95)
const sc = Math.cos(shelter.a), ss = Math.sin(shelter.a), px = shelter.x + 0.85 * sc + 1.95 * ss, py = shelter.y + 0.85 * ss - 1.95 * sc;
if (!postAt(c, px, py, 0)) fail('the shelter post is not where the model draws it');
d = walk(w, px + 2 * ss, py - 2 * sc, px, py);
console.log(`  shelter post: stopped ${d.toFixed(2)} m from it`);
if (d < 0.2) fail('walked through a shelter post');
// a shed's post
let found = false;
for (const b of c.blocks) {
  for (let k = b.b0; k < b.b1 && !found; k++) {
    const F = shedFaces(b, c.buildings[k])[0];
    if (!F) continue;
    const a = F.lo + F.seg, at = (al: number, out: number): [number, number] => (F.f < 2 ? [F.edge + F.nx * out, al] : [al, F.edge + F.ny * out]);
    const [qx, qy] = at(a, 2.5), [sx, sy] = at(a - 2, 2.5);
    if (!postAt(c, qx, qy, 0)) { fail('a shed post is not where the model draws it'); found = true; break; }
    d = walk(w, sx, sy, qx, qy);
    console.log(`  shed post: stopped ${d.toFixed(2)} m from it`);
    if (d < 0.2) fail('walked through a shed post');
    // under the shed, along the wall: free
    const [fx, fy] = at(a - 2, 1.0), [gx, gy] = at(a + 2, 1.0);
    walk(w, fx, fy, gx, gy);
    const went = Math.hypot(p.x - fx, p.y - fy);
    console.log(`  under the shed, by the wall: walked ${went.toFixed(1)} m`);
    if (went < 4) fail(`under the shed, by the wall, the way is blocked after ${went.toFixed(2)} m`);
    found = true;
  }
  if (found) break;
}
if (!found) console.log('  (no shed in this city)');
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
