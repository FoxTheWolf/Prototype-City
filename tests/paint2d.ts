// 15.17b: the 2D painter (render/paint2d.ts). Each shape on a small layer: the pixels where they should be,
// clipped, blended; the same seed paints the same photo, another seed another one.
import { HdLayer, HdOrder } from '../src/render/hd';
import { Img, onHd, Paint, paintMap, paintPhoto, photoOf, star, stopAt } from '../src/render/paint2d';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };
const sum = (px: Uint8ClampedArray) => { let h = 2166136261; for (const v of px) h = Math.imul(h ^ v, 16777619) >>> 0; return h; };
const at = (L: HdLayer, x: number, y: number) => { const k = L.at(x, y); return k < 0 ? null : [L.px[k], L.px[k + 1], L.px[k + 2], L.px[k + 3]]; };

{
  const L = new HdLayer(40, 30), P = new Paint(onHd(L, HdOrder.Under));
  P.rect(2, 3, 5, 4, [200, 10, 10]);
  check('rect inside', at(L, 2, 3)?.[0] === 200 && at(L, 6, 6)?.[3] === HdOrder.Under);
  check('rect not past its edge', at(L, 7, 3) === null && at(L, 2, 7) === null);
  P.rect(2, 3, 1, 1, [0, 0, 200], 0.5);
  check('blend at half', at(L, 2, 3)?.[0] === 100 && at(L, 2, 3)?.[2] === 105);
  P.clip(10, 0, 20, 30).rect(5, 5, 30, 2, [9, 9, 9]);
  check('clip', at(L, 9, 5) === null && at(L, 10, 5) !== null && at(L, 19, 6) !== null && at(L, 20, 5) === null);
}
{
  const L = new HdLayer(40, 40), P = new Paint(onHd(L));
  P.disc(20, 20, 8, [255, 255, 0]);
  check('disc: middle and edge', at(L, 20, 20) !== null && at(L, 27, 20) !== null && at(L, 29, 20) === null && at(L, 13, 13) === null);
  P.ring(20, 20, 15, 2, [0, 255, 0]);
  check('ring: hollow', at(L, 20, 6) !== null && at(L, 20, 9)?.[0] === undefined);
  P.rrect(0, 0, 12, 12, 5, [1, 2, 3]);
  check('rrect: corner cut, side kept', at(L, 0, 0) === null && at(L, 0, 6) !== null);
  P.line(30, 30, 39, 39, 1, [7, 7, 7]);
  check('line on its diagonal', at(L, 35, 35)?.[0] === 7);
  const L2 = new HdLayer(40, 40);
  new Paint(onHd(L2)).poly(star(20, 20, 15, 6, 5), [255, 0, 0]);
  check('star: the middle and a tip, not between tips', at(L2, 20, 20) !== null && at(L2, 20, 6) !== null && at(L2, 30, 8) === null);
}
{
  const L = new HdLayer(60, 30), P = new Paint(onHd(L));
  P.grad(0, 0, 10, 20, [[0, [0, 0, 0]], [1, [200, 200, 200]]]);
  check('gradient runs down', at(L, 0, 0)![0] < at(L, 0, 10)![0] && at(L, 0, 10)![0] < at(L, 0, 19)![0]);
  check('stopAt halfway', Math.round(stopAt([[0, [0, 0, 0]], [1, [100, 50, 0], 0]], 0.5)[0][0]) === 50 && stopAt([[0, [0, 0, 0]], [1, [0, 0, 0], 0]], 0.5)[1] === 0.5);
  const w = P.text(12, 1, 'HI', 2, [255, 255, 255]);
  check('text width', w === Paint.textW('HI', 2) && w === 2 * 10 + 2);
  check('H drawn: its posts, not its hole', at(L, 12, 1) !== null && at(L, 14, 1) === null);
  check('lower case as upper', sum(Uint8ClampedArray.from(L.px)) !== 0 && (() => { const A = new HdLayer(20, 20), B = new HdLayer(20, 20); new Paint(onHd(A)).text(0, 0, 'a', 2, [9, 9, 9]); new Paint(onHd(B)).text(0, 0, 'A', 2, [9, 9, 9]); return sum(A.px) === sum(B.px); })());
}
{
  const a = paintPhoto(48, 28, 'store', 7), b = paintPhoto(48, 28, 'store', 7), c = paintPhoto(48, 28, 'store', 8);
  check('same seed, same photo', sum(a.px) === sum(b.px));
  check('another seed, another photo', sum(a.px) !== sum(c.px));
  for (const s of ['store', 'food', 'room', 'bar', 'tech', 'sky', 'blackout', 'face'] as const) {
    const p = paintPhoto(40, 24, s, 3);
    let filled = 0; for (let k = 3; k < p.px.length; k += 4) if (p.px[k]) filled++;
    check(`${s}: every pixel painted`, filled === 40 * 24);
  }
  check('the photo cache gives the same picture', photoOf(30, 20, 'bar', 5) === photoOf(30, 20, 'bar', 5));
  const m = paintMap(30, 20, 11);
  check('map: the sea along the bottom', m.px[((19 * 30 + 5) * 4) + 2] === 0xe6);
  const L = new HdLayer(20, 20), img = new Img(2, 2);
  img.set(0, 0, 255, 0, 0); img.set(1, 1, 0, 0, 255);
  new Paint(onHd(L)).image(img, 0, 0, 10, 10);
  check('image: scaled with hard pixels', at(L, 4, 4)?.[0] === 255 && at(L, 9, 9)?.[2] === 255 && at(L, 9, 0) === null);
}
console.log(bad ? `${bad} failed` : 'paint2d: all passed');
process.exit(bad ? 1 : 0);
