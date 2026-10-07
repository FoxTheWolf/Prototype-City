/**
 * The phone's map in pixels (0.15.38) on a real city, without the browser:
 *   npx rolldown tests/phone-map.ts --format esm --platform node -o tests/.out/phone-map.mjs && node tests/.out/phone-map.mjs [seed]
 * Paints the street map at the four zooms around the city's middle, and the plan of a shop's ground
 * floor, into tests/.out/map-*.png, and times making each picture (it is made again whenever the view moves).
 */
import { writeFileSync } from 'node:fs';
import { Img, Paint } from '../src/render/paint2d';
import { createWorld } from '../src/sim/world';
import { planOf } from '../src/sim/interior';
import { mapRaster } from '../src/phone/mapdata';
import { ZOOM_ROW_M, INDOOR_ROW_M } from '../src/phone/phone';
import { roadName } from '../src/locale/names';
import { indoorMap, mapMpp, MAP_H, MAP_W, paintMap, roadsIn, streetMap, type MapPage } from '../src/phone/pixmap';
import { png } from './png';

const seed = Number(process.argv[2] ?? 42), w = createWorld(seed), city = w.city, m = mapRaster(city);
const shot = (name: string, paint: (P: Paint) => void) => {
  const J = new Img(240, 432), Q = new Paint(J); paint(Q);
  const o = new Uint8ClampedArray(J.px.length); for (let k = 0; k < J.px.length; k += 4) { const a = J.px[k + 3] / 255; o[k] = J.px[k] * a; o[k + 1] = J.px[k + 1] * a; o[k + 2] = J.px[k + 2] * a; o[k + 3] = 255; }
  writeFileSync(`tests/.out/${name}.png`, png(o, 240, 432));
};
const base = (pic: MapPage['pic']): MapPage => ({ title: 'Midtown', scale: '1  100m', scalePx: 40, pic, t: 9, now: 0, route: [], stars: [], labels: [], pin: null, halo: null, me: null, gps: null, acc: '+-8m', accBad: false,
  foot: { kind: 'street', text: '5th Avenue & Mercer Street', back: '' }, zoomIn: true, zoomOut: true });
const cx = city.w / 2, cy = city.h / 2;
for (let z = 0; z < 4; z++) {
  const mpp = mapMpp(ZOOM_ROW_M[z]), X0 = cx - (MAP_W / 2) * mpp, Y0 = cy - (MAP_H / 2) * mpp, t0 = performance.now();
  const pic = streetMap(city, m, X0, Y0, mpp, z);
  console.log(`zoom ${z}: ${mpp.toFixed(2)} m/px, made in ${(performance.now() - t0).toFixed(1)} ms`);
  const d = base(pic);
  d.me = { x: MAP_W / 2, y: MAP_H / 2, fix: true, heading: 0.6 }; d.halo = { x: MAP_W / 2, y: MAP_H / 2, r: 12 / mpp };
  if (z <= 1) {
    for (const [k, x] of roadsIn(city.xb, X0, X0 + MAP_W * mpp)) d.labels.push({ x: (x - X0) / mpp, y: 8, text: roadName(city, true, k), ink: [70, 76, 92], back: [255, 255, 255], center: true });
    for (const [k, y] of roadsIn(city.yb, Y0 + 20 * mpp, Y0 + MAP_H * mpp)) d.labels.push({ x: 4, y: (y - Y0) / mpp, text: roadName(city, false, k), ink: [70, 76, 92], back: [255, 255, 255] });
  }
  if (z === 0) { d.route = [MAP_W / 2, MAP_H / 2, MAP_W / 2, 60, 200, 60]; d.pin = { x: 200, y: 60 }; d.foot = { kind: 'nav', line: 'In 120m turn right onto 9th St', sub: '340m to go - Kell Street Diner', turn: 'right' }; }
  if (z === 2) d.gps = { lost: false, line: 'SEARCHING SATELLITES', sub: 'IN VIEW 4/11', bar: 0.4 };
  shot(`map-z${z}`, (Q) => paintMap(Q, d));
}
// a place's card over the closest zoom
{
  const mpp = mapMpp(ZOOM_ROW_M[0]), d = base(streetMap(city, m, cx - (MAP_W / 2) * mpp, cy - (MAP_H / 2) * mpp, mpp, 0));
  d.pin = { x: 120, y: 120 };
  d.foot = { kind: 'card', name: 'Kell Street Diner', sub: 'Diner - Midtown', open: true, openLabel: 'OPEN', hours: 'until midnight', number: '(555) 014-2233', hasNumber: true, far: '340m NE', address: '120 Kell Street', route: 'Route', call: 'Call' };
  shot('map-card', (Q) => paintMap(Q, d));
}
// inside: the ground floor of the first shop that has a plan
const b = city.businesses.find((q) => planOf(city, q.building, 0)?.rooms.length)!, B = city.buildings[b.building], plan = planOf(city, b.building, 0);
for (const z of [0, 2]) {
  const mpp = mapMpp(INDOOR_ROW_M[z]), X0 = (B.x0 + B.x1) / 2 - (MAP_W / 2) * mpp, Y0 = (B.y0 + B.y1) / 2 - (MAP_H / 2) * mpp, t0 = performance.now();
  const pic = indoorMap(m, plan, `${b.building}:0`, X0, Y0, mpp);
  console.log(`indoor zoom ${z}: made in ${(performance.now() - t0).toFixed(1)} ms`);
  const d = base(pic); d.title = 'Floor G';
  shot(`map-in${z}`, (Q) => paintMap(Q, d));
}
