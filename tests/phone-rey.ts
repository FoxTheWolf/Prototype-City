/**
 * Reynard's pages in pixels (0.15.40), in Node:
 *   npx rolldown tests/phone-rey.ts --format esm --platform node -o tests/.out/phone-rey.mjs && node tests/.out/phone-rey.mjs
 * Registers, opens the debug's chat, writes in it, and paints each page into tests/.out/rey-*.png.
 */
import { writeFileSync } from 'node:fs';
import { Img, Paint } from '../src/render/paint2d';
import { createWorld } from '../src/sim/world';
import { Phone } from '../src/phone/phone';
import { CharGrid } from '../src/render/grid';
import { Lcd } from '../src/phone/lcd';
import { debugChat, drawRey, keyOf, rv } from '../src/phone/reynard';
import { png } from './png';

const w = createWorld(42), P = new Phone(w), S = new Lcd(new CharGrid(80, 40), 0, 0);
const shot = (name: string) => {
  const J = new Img(240, 432), Q = new Paint(J); drawRey(S, P, w, 5, 1)(Q);
  const o = new Uint8ClampedArray(J.px.length); for (let k = 0; k < o.length; k += 4) { const a = J.px[k + 3] / 255; o[k] = J.px[k] * a; o[k + 1] = J.px[k + 1] * a; o[k + 2] = J.px[k + 2] * a; o[k + 3] = 255; }
  writeFileSync(`tests/.out/rey-${name}.png`, png(o, 240, 432));
};
rv.view = 'reg'; shot('reg');
P.rey.reg = 'wait'; P.rey.typed = '41'; shot('code');
P.rey.reg = 'ok'; P.rey.mine = keyOf(w.seed, w.telco.player.number, 1);
const C = debugChat(w); P.rey.chats.push(C, { ...debugChat(w), name: 'magpie', verified: true });
C.msgs.push({ me: true, text: 'Sure, call me after nine.', at: w.time - 60, st: 2 });
rv.view = 'list'; rv.sel = 0; shot('list');
rv.view = 'chat'; rv.open = 0; rv.ed.set('on my w'); shot('chat');
rv.view = 'opts'; rv.sel = 1; shot('opts');
rv.view = 'key'; shot('key');
rv.view = 'wipe'; shot('wipe');
console.log('OK');
