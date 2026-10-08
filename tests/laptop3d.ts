/**
 * 15.20b, the notebook's deck in little cubes, in Node (no GPU):
 *   npx rolldown tests/laptop3d.ts --format esm --platform node -o tests/.out/laptop3d.mjs && node tests/.out/laptop3d.mjs
 * Builds the deck from the manual's measures, checks its size, the keys and the parts, a key sinking, and
 * draws it in perspective from the player's eye (tests/.out/laptop3d.png) and from straight above (laptop3d-top.png).
 */
import { writeFileSync } from 'node:fs';
import { castVox, castVoxPersp, shadeVox, voxLookAt } from '../src/render/voxels';
import { CELL_MM, deckModel, deckPalette, KEYS, lidModel, lidPalette, NX, NY, NZ, TOP } from '../src/laptop/body3d';
import { Img } from '../src/render/paint2d';
import { png } from './png';

let fails = 0;
const fail = (m: string) => { if (++fails <= 30) console.log('FAIL ' + m); };

if (NX * CELL_MM !== 310 || Math.abs(NY * CELL_MM - 225) > 1) fail(`the deck is 310 x 225 mm (got ${NX * CELL_MM} x ${NY * CELL_MM})`);
// the manual's drawing has 80 keys (its table says 84; the drawing rules)
if (KEYS.length !== 80) fail(`80 keys, as the manual draws them (got ${KEYS.length})`);
const { V, ids } = deckModel();
const idOf = (code: string) => [...ids].find(([, c]) => c === code)?.[0] ?? -1;
// the G key's middle, its cap one cell over the deck; pressed, it sinks to the deck
const G = KEYS.find((k) => k.code === 'KeyG')!, gx = Math.floor((G.x0 + G.x1) / 2 / CELL_MM), gy = Math.floor((G.y0 + G.y1) / 2 / CELL_MM);
if (V.at(gx, gy, TOP) !== idOf('KeyG')) fail('the G key stands one cell over the deck');
const down = deckModel((id) => id === 'KeyG').V;
if (down.at(gx, gy, TOP) !== 0 || down.at(gx, gy, TOP - 1) !== idOf('KeyG')) fail('a pressed key sinks one cell');
for (const p of ['nubL', 'nubM', 'nubR', 'padL', 'padR', 'volDown', 'volUp', 'mute', 'lamp', 'power']) if (idOf(p) < 0) fail(`the part ${p} has its own entry`);

const light = { rgb: [1, 0.95, 0.85], lat: 0.3, str: 0.05, glint: [0, 0, 0] as const };
const shot = (G2: ReturnType<typeof castVox>, file: string) => {
  const img = new Img(G2.w, G2.h);
  img.px.fill(0); for (let k = 3; k < img.px.length; k += 4) img.px[k] = 255;
  for (let k = 0; k < img.px.length; k += 4) { img.px[k] = 12; img.px[k + 1] = 12; img.px[k + 2] = 14; }
  shadeVox(G2, lidPalette(deckPalette(ids, true, false), { on: true, lamp: true, disk: true, radio: true, charging: false }), light, (x, y, r, g, b) => img.set(x, y, r, g, b));
  writeFileSync(file, png(img.px, G2.w, G2.h));
};
// from the eye: 40 cm in front of the hinge and 35 cm over the deck, looking at its middle
const cam = voxLookAt(960, 600, [NX / 2, NY + 140, NZ + 190], [NX / 2, NY * 0.55, TOP], 1.0);
const t = performance.now();
const GP = castVoxPersp(V, cam);
console.log(`perspective cast: ${(performance.now() - t).toFixed(0)} ms for ${cam.w * cam.h} rays`);
let hit = 0; for (const m of GP.mat) if (m) hit++;
if (hit < GP.mat.length * 0.2) fail(`the deck fills a good part of the view (${hit} pixels)`);
shot(GP, 'tests/.out/laptop3d.png');
shot(castVox(V, { w: NX * 4, h: NY * 4, sx: 0.25, sy: 0.25, yaw: 0, pitch: 0 }), 'tests/.out/laptop3d-top.png');
shot(castVox(lidModel(), { w: NX * 4, h: NY * 4, sx: 0.25, sy: 0.25, yaw: 0, pitch: 0 }), 'tests/.out/laptop3d-lid.png');
console.log(fails ? `\n${fails} FAILED` : 'laptop3d: all passed (pictures in tests/.out/laptop3d.png, laptop3d-top.png)');
