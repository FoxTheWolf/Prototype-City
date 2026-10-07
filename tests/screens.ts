// 15.16: the glass's homography, inverted (render/screens.ts): every monitor point of a projected rectangle
// maps back to its own u, v; a square quad is plain scaling.
import { quadInverse } from '../src/render/screens';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };
const uvOf = (qi: number[], x: number, y: number) => {
  const w = qi[6] * x + qi[7] * y + qi[8];
  return [(qi[0] * x + qi[1] * y + qi[2]) / w, (qi[3] * x + qi[4] * y + qi[5]) / w];
};
// a rectangle in 3D projected by a pinhole camera: the forward map is a homography, so the inverse must be exact
const proj = (X: number, Y: number, Z: number) => [800 + (900 * X) / Z, 450 - (900 * Y) / Z];
for (let t = 0; t < 200; t++) {
  const yaw = (t / 200 - 0.5) * 1.6, d = 0.4 + (t % 7) * 0.1;
  const corner = (u: number, v: number) => { const lx = (u - 0.5) * 0.29, ly = (0.5 - v) * 0.18; return proj(lx * Math.cos(yaw), ly, d + lx * Math.sin(yaw)); };
  const q = [...corner(0, 0), ...corner(1, 0), ...corner(1, 1), ...corner(0, 1)];
  const qi = quadInverse(q);
  check(`quad ${t} has an inverse`, !!qi);
  if (!qi) continue;
  for (const [u, v] of [[0, 0], [1, 1], [0.25, 0.7], [0.5, 0.5], [0.9, 0.1]]) {
    const [x, y] = corner(u, v), [uu, vv] = uvOf(qi, x, y);
    check(`quad ${t} (${u}, ${v}) -> (${uu.toFixed(4)}, ${vv.toFixed(4)})`, Math.abs(uu - u) < 1e-6 && Math.abs(vv - v) < 1e-6);
  }
}
{
  const qi = quadInverse([100, 50, 1380, 50, 1380, 850, 100, 850])!;
  const [u, v] = uvOf(qi, 740, 450);
  check('square: the middle', Math.abs(u - 0.5) < 1e-9 && Math.abs(v - 0.5) < 1e-9);
}
check('a flat quad has none', quadInverse([0, 0, 10, 0, 20, 0, 30, 0]) === null);
console.log(bad ? `${bad} failed` : 'screens: all passed');
process.exit(bad ? 1 : 0);
