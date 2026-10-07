// 15.19: the phone's body in little cubes (phone/body3d.ts over render/voxels.ts). Every look drawn into
// pixels, a key pressed sinks (the geometry is cast again), the time it takes. Picture:
// tests/.out/phone3d.png (the six looks; under each, the one with the OK key pressed).
import { writeFileSync } from 'node:fs';
import { drawBody3d } from '../src/phone/body3d';
import { keysOf, PHONE_H, PHONE_W, SHELLS } from '../src/phone/shells';
import { HD } from '../src/render/hd';
import { castVox, Vox } from '../src/render/voxels';
import { png } from './png';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };

// the caster on a cube: met from the front, its face toward the eye
{
  const V = new Vox(4, 4, 4);
  V.set(1, 1, 3, 7);
  const G = castVox(V, { w: 4, h: 4, sx: 1, sy: 1, yaw: 0, pitch: 0 });
  check('a cube in front', G.mat[1 * 4 + 1] === 7 && G.face[5] === 5 && G.mat[0] === 0);
  const T = castVox(V, { w: 4, h: 4, sx: 1, sy: 1, yaw: 0, pitch: 1.2 });
  check('tilted toward the eye, its top face shows', [...T.face].some((f, k) => T.mat[k] && f === 2));
}

const W = PHONE_W * HD, H = PHONE_H * HD, GAP = 12, img = new Uint8ClampedArray((W + GAP) * SHELLS.length * (H * 2 + GAP) * 4), IW = (W + GAP) * SHELLS.length;
const L = { rgb: [1, 0.95, 0.85], lat: 0.4, str: 0.6, glint: [1, 0.9, 0.7] as const };
let ms = 0;
SHELLS.forEach((S, look) => {
  for (const pressOk of [false, true]) {
    const y0 = pressOk ? H + GAP : 0;
    let n = 0;
    const t = performance.now();
    drawBody3d((x, y, r, g, b) => {
      const X = look * (W + GAP) + x, Y = y0 + y, k = (Y * IW + X) * 4;
      img[k] = r; img[k + 1] = g; img[k + 2] = b; img[k + 3] = 255; n++;
    }, 0, 0, S, look, [120, 124, 132], keysOf(S), (k) => pressOk && k === 'ok', null, L);
    ms += performance.now() - t;
    check(`${S.name}${pressOk ? ' (OK pressed)' : ''}: drawn`, n > W * H * 0.7);
  }
});
console.log(`12 bodies cast and lit in ${ms.toFixed(0)} ms (${(ms / 12).toFixed(1)} each)`);
// a frame with nothing changed: only the light
{
  const S = SHELLS[0], K = keysOf(S);
  drawBody3d(() => {}, 0, 0, S, 0, [1, 1, 1], K, () => false, null, L);
  const t = performance.now();
  for (let i = 0; i < 200; i++) drawBody3d(() => {}, 0, 0, S, 0, [1, 1, 1], K, () => false, null, L);
  const per = (performance.now() - t) / 200;
  console.log(`light only: ${per.toFixed(2)} ms a frame`);
  check('light only under 2 ms', per < 2);
}
for (let k = 3; k < img.length; k += 4) if (!img[k]) { img[k - 3] = 40; img[k - 2] = 46; img[k - 1] = 58; }
writeFileSync('tests/.out/phone3d.png', png(img, IW, H * 2 + GAP));
console.log(bad ? `${bad} failed` : 'phone3d: all passed (picture in tests/.out/phone3d.png)');
