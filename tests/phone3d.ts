// 15.19: the phone's body in little cubes (phone/body3d.ts; drawn by the GPU, render/gpu/voxBody.ts). Here the
// models and the palette body3d hands the GPU, cast and lit by the CPU's twin (render/voxels.ts) for a picture
// (no legends: those are the GPU's decal): tests/.out/phone3d.png, each look open and shut, and the checks.
import { writeFileSync } from 'node:fs';
import { BODY_GPU, drawBody3d } from '../src/phone/body3d';
import { SHELLS } from '../src/phone/shells';
import { castVox, shadeVox, Vox, type VoxMat } from '../src/render/voxels';
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

const K = 4, L = { rgb: [1, 0.97, 0.92], lat: 0.4, str: 0.4, glint: [1, 0.9, 0.7] as const };
/** The two models body3d last built, out of the GPU's buffer. */
function models(): [Vox, Vox] {
  const B = BODY_GPU, n = B.nx * B.ny * B.nz, bytes = new Uint8Array(B.vox.buffer);
  return [0, 1].map((m) => { const V = new Vox(B.nx, B.ny, B.nz); V.cells.set(bytes.subarray(m * n, (m + 1) * n)); return V; }) as [Vox, Vox];
}
/** The palette out of the uniform (voxBody.ts BodyU.pal). */
function palette(): VoxMat[] {
  const U = BODY_GPU.uni;
  return Array.from({ length: 256 }, (_, i) => {
    const o = 36 + i * 8, f = U[o + 4];
    return { col: [U[o], U[o + 1], U[o + 2]] as const, gloss: U[o + 3], metal: !!(f & 1), glow: !!(f & 2), chrome: f & 4 ? [U[o + 5], U[o + 6]] as const : undefined };
  });
}
const count = (V: Vox) => V.cells.reduce((a, c) => a + (c ? 1 : 0), 0);

const W = 0, looks = SHELLS.map((S, look) => {
  const shots: [Uint8ClampedArray, number, number][] = [];
  for (const rail of [0, -43 * K]) {
    const t = performance.now();
    drawBody3d(K, K, S, look, [120, 124, 132], null, () => false, null, L, [0, 0], rail, true, null);
    const ms = performance.now() - t, [lo, up] = models(), pal = palette(), B = BODY_GPU;
    check(`${S.name}: built in ${ms.toFixed(1)} ms`, ms < 200);
    const view = { w: B.w, h: B.h, sx: 1 / K, sy: 1 / K, x0: 0, y0: 0, yaw: -0.05, pitch: 0.16 };
    const img = new Uint8ClampedArray(B.w * B.h * 4);
    const put = (dy: number) => (x: number, y: number, r: number, g: number, b: number) => { const Y = y + dy; if (Y < 0 || Y >= B.h) return; const k = (Y * B.w + x) * 4; img[k] = r; img[k + 1] = g; img[k + 2] = b; img[k + 3] = 255; };
    shadeVox(castVox(lo, view), pal, L, put(rail));
    shadeVox(castVox(up, view), pal, L, put(0));
    shots.push([img, B.w, B.h]);
  }
  return shots;
});
void W;
// a key pressed sinks: the model loses a layer of cubes under it
{
  drawBody3d(K, K, SHELLS[1], 1, [0, 0, 0], null, () => false, null, L);
  const up0 = count(models()[1]);
  drawBody3d(K, K, SHELLS[1], 1, [0, 0, 0], null, (k) => k === 'home', null, L);
  check('the home button sinks when pressed', count(models()[1]) < up0);
}
// the picture: the looks side by side, open on top and shut below
const [w, h] = [looks[0][0][1], looks[0][0][2]], GAP = 8, IW = (w + GAP) * looks.length, IH = h * 2 + GAP, out = new Uint8ClampedArray(IW * IH * 4);
looks.forEach((shots, i) => shots.forEach(([img], j) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 4, d = ((y + j * (h + GAP)) * IW + x + i * (w + GAP)) * 4;
    if (img[s + 3]) { out[d] = img[s]; out[d + 1] = img[s + 1]; out[d + 2] = img[s + 2]; }
    else { out[d] = 40; out[d + 1] = 46; out[d + 2] = 58; }
    out[d + 3] = 255;
  }
}));
writeFileSync('tests/.out/phone3d.png', png(out, IW, IH));
console.log(bad ? `${bad} failed` : 'phone3d: all passed (picture in tests/.out/phone3d.png)');
