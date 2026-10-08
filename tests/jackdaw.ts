/**
 * 15.22, the Jackdaw Mini's shell in Node (no GPU):
 *   npx rolldown tests/jackdaw.ts --format esm --platform node -o tests/.out/jackdaw.mjs && node tests/.out/jackdaw.mjs
 * Switches it on, waits out the opening, opens every factory app through the menu and back, checks the
 * sounds and the low battery, and paints a sheet of the screens (tests/.out/jackdaw.png, 4 times bigger,
 * in the LCD's day palette with the ghost and the gap between the dots, as the manual's section 6).
 */
import { writeFileSync } from 'node:fs';
import { Jackdaw, type JKey } from '../src/jackdaw/jackdaw';
import { H, LCD_DAY, W } from '../src/jackdaw/screen';
import { png } from './png';

let fails = 0;
const fail = (m: string) => { if (++fails <= 30) console.log('FAIL ' + m); };
const D = new Jackdaw(), t0 = 1.2e9 + 21.78 * 3600;
let time = t0;
const run = (s: number) => { for (let i = 0; i < s * 20; i++) { time += 0.05 * 12; D.update(0.05, time); } };
const key = (k: JKey) => { D.press(k); run(0.15); };
const shots: [string, Uint8Array][] = [];
const shot = (n: string) => shots.push([n, D.screen.p.slice()]);

D.owned = true;
D.lever(); run(0.5); shot('opening');
run(8);
if (D.mode !== 'home') fail(`the opening ends at home (${D.mode})`);
shot('home');
if (!D.sfx.includes('boot') || !D.sfx.includes('lever')) fail('the lever and the opening sound');
key('ok');
if (D.mode !== 'menu') fail('OK opens the menu');
shot('menu');
for (let i = 0; i < D.apps.length; i++) {
  D.sel = i; key('ok'); run(1.2);
  if (D.mode !== 'app' || D.app !== D.apps[i]) fail(`${D.apps[i].id} opens`);
  if (i === 1 || i === 3) shot(`${D.apps[i].id} scene`);
  run(1); shot(D.apps[i].id);
  key('back');
  if (D.mode !== 'menu') fail(`BACK from ${D.apps[i].id} returns to the menu`);
}
key('back');
if (D.mode !== 'home') fail('BACK from the menu returns home');
D.sfx.length = 0;
key('down');
if (!D.sfx.includes('err')) fail('a key with nothing to do sounds "can\'t"');
D.collect('ring'); D.collect('key'); run(0.5); shot('home 2 shinies');
// a dozen minutes of nothing: it dozes
run(125); shot('dozing');
// low battery: the sheet, then off when flat
D.batt = 0.04; run(0.3); shot('low battery');
if (!D.lowSheet) fail('the low battery sheet shows');
D.batt = 0.00001; run(1);
if (D.on) fail('flat, it switches off');
const ver = D.ver; run(1);
if (D.ver !== ver) fail('off, the screen does not change');

// the sheet: 3 columns of screens, 4x, the LCD's dots with their ghosts and gaps
const S = 4, cols = 3, rows = Math.ceil(shots.length / cols), PW = W * S + 16, PH = H * S + 16, out = new Uint8ClampedArray(cols * PW * rows * PH * 4);
shots.forEach(([, p], k) => {
  const ox = (k % cols) * PW + 8, oy = Math.floor(k / cols) * PH + 8;
  for (let y = 0; y < H * S; y++) for (let x = 0; x < W * S; x++) {
    const dx = x % S, dy = y % S, gap = dx === S - 1 || dy === S - 1, on = (p as Uint8Array)[Math.floor(y / S) * W + Math.floor(x / S)];
    const c = gap ? LCD_DAY.bg : on ? LCD_DAY.on : LCD_DAY.ghost, o = ((oy + y) * cols * PW + ox + x) * 4;
    out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
  }
});
writeFileSync('tests/.out/jackdaw.png', png(out, cols * PW, rows * PH));
console.log(shots.map(([n], k) => `${k + 1}. ${n}`).join('  '));
console.log(fails ? `\n${fails} FAILED` : 'jackdaw: all passed (tests/.out/jackdaw.png)');
