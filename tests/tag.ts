/**
 * The price tag close up (14.5), in Node:
 *   npx rolldown tests/tag.ts --format esm --platform node -o tests/.out/tag.mjs && node tests/.out/tag.mjs [seed]
 * Standing at a shelf of a shop and looking at a good: the sight finds it, says where it meets it
 * (within reach), and its tag drawn on the interface's grid says the shop's price, beside the good,
 * above the conversation's strip. Prints the tag.
 */
import { createWorld } from '../src/sim/world';
import { planOf } from '../src/sim/interior';
import { aimedGood } from '../src/shop';
import { drawTag } from '../src/tag';
import { type Screen } from '../src/barks';
import { CharGrid } from '../src/render/grid';

const w = createWorld(Number(process.argv[2] ?? 42));
let fails = 0;
const fail = (m: string) => { fails++; console.log('FAIL ' + m); };
const c = w.city, p = w.player;
let A = null as ReturnType<typeof aimedGood>, yaw = 0, pitch = 0;
search: for (const kind of ['grocery', 'pharmacy', 'phones', 'liquor']) for (const [n, b] of c.businesses.entries()) {
  if (b.kind !== kind) continue;
  const P = planOf(c, b.building, 0);
  for (const f of P?.furn ?? []) {
    if (!f.stock?.length) continue;
    // in front of the piece, a metre from its face, looking at it
    Object.assign(p, { inside: b.building, floor: 0, z: 0, x: f.x + f.c * (f.hx + 0.9), y: f.y + f.s * (f.hx + 0.9) });
    yaw = Math.atan2(f.y - p.y, f.x - p.x);
    for (pitch = -0.6; pitch < 0.4; pitch += 0.05) { A = aimedGood(w, yaw, pitch, 1.6); if (A) { console.log(`  ${kind} ${n}: ${A.good} at ${A.d.toFixed(2)} m`); break search; } }
  }
}
if (!A) { console.log('FAIL no good found under the sight'); process.exit(1); }
if (A.d > 2.2 || Math.hypot(A.x - p.x, A.y - p.y) > 2.2) fail('the point met is out of reach');
const S: Screen = { cols: 400, rows: 225, cellW: 4.8, cellH: 4.8, originX: 0, originY: 0 }, U: Screen = { cols: 160, rows: 80, cellW: 12, cellH: 13.5, originX: 0, originY: 0 };
const g = new CharGrid(U.cols, U.rows);
drawTag(g, A, w, { x: p.x, y: p.y, eye: 1.6, yaw, pitch }, S, U, new Float32Array([1, 1, 1]));
let rows: [number, string][] = [];
for (let y = 0; y < g.rows; y++) { let s = ''; for (let x = 0; x < g.cols; x++) { const i = y * g.cols + x, ch = g.cells[i * 4], dark = g.bg[i * 4 + 3] && g.bg[i * 4] < 60; s += dark && ch === 32 ? '#' : ch ? String.fromCharCode(ch) : ' '; } if (s.trim()) rows.push([y, s]); }
for (const [y, s] of rows) console.log(String(y).padStart(2), s.trimEnd());
const all = rows.map((r) => r[1]).join('\n'), dollars = String(Math.floor(A.cents / 100)), cents = String(A.cents % 100).padStart(2, '0');
if (!all.includes(cents)) fail(`the cents (${cents}) are not on the tag`);
if (!rows.length || rows[rows.length - 1][0] > U.rows - 14) fail('the tag reaches into the conversation strip');
console.log(`  price ${dollars}.${cents}`);
console.log(fails ? `${fails} failure(s)` : 'OK');
process.exit(fails ? 1 : 0);
