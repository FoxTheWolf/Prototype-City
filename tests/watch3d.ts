/**
 * 15.21, the wristwatch in little cubes and its LCD in pixels, in Node (no GPU):
 *   npx rolldown tests/watch3d.ts --format esm --platform node -o tests/.out/watch3d.mjs && node tests/.out/watch3d.mjs
 * Builds the model, checks a button sinking, cycles DISPLAY through the four faces and paints the LCD of each
 * (tests/.out/watch-lcd-<face>.png, 3 times bigger), and the body from the front (watch3d.png).
 */
import { writeFileSync } from 'node:fs';
import { Watch, drawWatch, WATCH_LCD } from '../src/watch/watch';
import { WATCH_GPU, NX, NY } from '../src/watch/body3d';
import { CharGrid } from '../src/render/grid';
import { png } from './png';

let fails = 0;
const fail = (m: string) => { if (++fails <= 30) console.log('FAIL ' + m); };
const W = new Watch(), g = new CharGrid(240, 80), px = [0, 0, 8, 16], light = new Float32Array([0.8, 0.75, 0.7]);
W.raise = 1;
const t0 = 1.2e9;
const draw = (now: number) => drawWatch(g, W, t0 + now, now, light, 'Tolliver', 0.4, px);
const G = draw(10);
if (!G) fail('the watch is drawn when up');
const cells = new Uint8Array(G!.vox.buffer).slice(0, NX * NY * 13);
let n = 0; for (const c of cells) if (c) n++;
if (n < 15000) fail(`the model has its cubes (${n})`);
// a button pressed sinks: the model's cells change
const v0 = G!.voxVer;
W.modeKey(20); draw(20.05);
if (G!.voxVer === v0) fail('MODE sinks when pressed');
draw(21); if (W.mode !== 'alarm') fail('MODE went to the alarm');
W.modeKey(22); W.modeKey(23); draw(24);
// the four faces, each LCD to a PNG
for (const f of ['compass', 'sun', 'moon', 'pulse']) {
  if (W.face !== f) fail(`face ${f} (got ${W.face})`);
  draw(30);
  const I = WATCH_GPU.lcd, s = 3, big = new Uint8ClampedArray(I.w * s * I.h * s * 4);
  for (let y = 0; y < I.h * s; y++) for (let x = 0; x < I.w * s; x++) { const a = (Math.floor(y / s) * I.w + Math.floor(x / s)) * 4, b = (y * I.w * s + x) * 4; for (let c = 0; c < 4; c++) big[b + c] = c === 3 ? 255 : I.px[a + c]; }
  writeFileSync(`tests/.out/watch-lcd-${f}.png`, png(big, I.w * s, I.h * s));
  W.displayKey(31 + Math.random());
}
// lit: the LCD's paper goes blue, and its rectangle is given for the glow
W.light(40); draw(40.2);
if (!WATCH_LCD.at) fail('the lit LCD gives its rectangle for the glow');
if (WATCH_GPU.lcd.px[2] < 150) fail('the lit LCD is blue');
console.log(fails ? `\n${fails} FAILED` : 'watch3d: all passed (tests/.out/watch-lcd-*.png)');
