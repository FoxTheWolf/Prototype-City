// The phone's pages drawn in pixels (phone/pixpages.ts), painted with made-up data into PNGs to look at without the
// game or a GPU: tests/.out/tunes.png (the Tunes Player). The bars on top are pixui.ts's, not drawn here.
import { writeFileSync } from 'node:fs';
import { Img, Paint } from '../src/render/paint2d';
import { paintTunes } from '../src/phone/pixpages';
import { png } from './png';
const I = new Img(240, 432), P = new Paint(I);
const spec = new Float32Array(16).map((_, k) => 0.2 + 0.6 * Math.abs(Math.sin(k)));
const rows = [{ kind: 'head' as const, label: 'Songs', size: '', mark: '' as const, sel: false },
  ...['Night Shift - The Overpass Kids', 'Sodium Glow - Kimara Sound', 'Last Train - Grid People'].map((l, i) => ({ kind: 'song' as const, label: l, size: '3.1 MB', mark: (i === 0 ? 'play' : '') as '' | 'play', sel: i === 1, pre: () => {} })),
  { kind: 'head' as const, label: 'SD card', size: '', mark: '' as const, sel: false }, { kind: 'note' as const, label: 'No songs on the card', size: '', mark: '' as const, sel: false }];
paintTunes(P, { title: 'Tunes', out: 'SPEAKER', idle: 'Nothing playing', tune: { title: 'Night Shift', band: 'The Overpass Kids', at: 42, len: 180, playing: true, vol: 0.7, shuffle: '', spec, sel: false, pre: () => {} }, volLabel: 'VOL', keys: '< > skip  * # volume  0 shuffle', rows, t: 5 }, 1);
const out = new Uint8ClampedArray(I.px.length); for (let k = 0; k < I.px.length; k += 4) { const a = I.px[k + 3] / 255; out[k] = I.px[k] * a; out[k + 1] = I.px[k + 1] * a; out[k + 2] = I.px[k + 2] * a; out[k + 3] = 255; }
writeFileSync('tests/.out/tunes.png', png(out, 240, 432));
