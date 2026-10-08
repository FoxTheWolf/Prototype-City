// How long the phone's busiest pages take to paint on the CPU (they are painted again every frame while the
// phone is in the hand): the standby screen by night and by day, the apps' grid, the Tunes player.
// node tests/.out/paint-bench.mjs  (ms a page, the mean of 200)
import { Img, Paint } from '../src/render/paint2d';
import { artColors } from '../src/phone/hdicons';
import { paintMenu, paintStandby, paintTunes } from '../src/phone/pixpages';
import { SCR_H, SCR_W } from '../src/phone/pixui';

const I = new Img(SCR_W, SCR_H), P = new Paint(I), f = () => {};
const spec = new Float32Array(32).map((_, k) => 0.5 + 0.4 * Math.sin(k));
const tune = { title: 'Night Shift', band: 'The Overpass Kids', at: 42, len: 180, playing: true, vol: 0.7, shuffle: '', spec, sel: false, pre: f };
const standby = (time: number) => ({ wall: 0, time, t: 5, hour: '21:07', date: 'Fri, Sep 26', op: 'OREON', opOk: true, volLabel: 'VOL', hint: 'Menu',
  cards: [{ col: [120, 200, 255] as const, text: '2 new messages', sel: true, blink: true, pre: f }], tune: { ...tune, at: 42 } });
const tiles = ['Phone', 'Messages', 'Contacts', 'Tunes', 'Ferret', 'Wire', 'Maps', 'Camera', 'Photos', 'Bank', 'Notes', 'Calc', 'Weather', 'Store', 'Settings', 'My Apps']
  .map((label, n) => ({ label, col: [40 + n * 12, 90, 160] as const, art: artColors(label.toLowerCase()), sel: n === 3, pre: f }));
const DAY = 12 * 3600, NIGHT = 22 * 3600;
const run = (name: string, paint: (now: number) => void) => {
  for (let k = 0; k < 20; k++) paint(k / 60);
  const t0 = performance.now();
  for (let k = 0; k < 200; k++) { I.px.fill(0); paint(k / 60); }
  console.log(`${name.padEnd(14)} ${((performance.now() - t0) / 200).toFixed(3)} ms`);
};
run('standby night', (now) => paintStandby(P, standby(NIGHT), now));
run('standby day', (now) => paintStandby(P, standby(DAY), now));
run('menu', () => paintMenu(P, tiles, 5));
run('tunes', (now) => paintTunes(P, { title: 'Tunes', out: 'SPEAKER', idle: 'Nothing playing', tune, volLabel: 'VOL', keys: '< > skip', rows: [], t: 5 }, now));
