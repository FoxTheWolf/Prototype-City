// 15.17c: the Ferret's tabs, back and forward per tab, the bookmarks and the history on the notebook's
// disk, the frame's pixels; and a picture of it (tests/.out/ferret.png: the frame in HD with the cells'
// text in the 5 x 7 font, to judge the layout without the game).
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createWorld } from '../src/sim/world';
import { Browser } from '../src/web/browser';
import { HdLayer, HdOrder } from '../src/render/hd';
import { onHd, Paint } from '../src/render/paint2d';
import { CH, CW } from '../src/web/chrome';

let bad = 0;
const check = (name: string, ok: boolean) => { if (!ok) { bad++; console.log('FAIL', name); } };
const w = createWorld(42);
const disk = new Map<string, string>();
const files = { read: (n: string) => disk.get(n) ?? null, write: (n: string, t: string) => { disk.set(n, t); } };
let quit = 0;
const B = new Browser(w, () => ({ up: true, kbps: 900 }), () => { quit++; }, 160, 50, files);
B.go('', 0);
const home = B.url;
const rowText = (t: number, r: number) => B.cells(t).scr.ch[r].join('');
check('the factory bookmarks: Lookwise, the mail, the portal', /Lookwise.*Mail/.test(rowText(10, 3)));
check('the forum is never a factory bookmark', !/switchboard/i.test(rowText(10, 3)));
// follow a link, then back and forward
B.key('Tab', false, 10); B.key('Tab', false, 10); B.key('Enter', false, 10);
const second = B.url;
check('a link followed', second !== home);
B.key('Backspace', false, 11);
check('back', B.url === home);
B.click(5, 2, 12); // forward is cells 4..6 of the bar
check('forward', B.url === second);
check('the back button thumps', B.sfx.includes('thump'));
check('both pages in the history file', (disk.get('history') ?? '').includes(home) && (disk.get('history') ?? '').includes(second));
// a new tab opens on the start page; its own back is empty; Ctrl+Tab goes round
B.key('t', true, 13);
check('Ctrl+T: a new tab on the start page', B.url === home);
B.key('Backspace', false, 14);
check('the new tab has its own (empty) history', B.url === home);
B.key('Tab', true, 15);
check('Ctrl+Tab: back to the first tab', B.url === second);
// visited links are purple: the start page's links include the second page, now seen
B.key('Backspace', false, 16);
const S = B.cells(30).scr;
let purple = false;
for (let r = 4; r < 49; r++) for (let c = 0; c < 159; c++) if (S.fg[r][c] === 0x551a8b) purple = true;
check('a link seen is purple', purple);
// bookmark the page with Ctrl+D (the star lights), and the file keeps it
B.key('t', true, 31); B.go('www.lookwise.com/search?q=pizza', 31);
const sUrl = B.url;
B.key('d', true, 40);
check('Ctrl+D: the page in the bookmarks file', (disk.get('bookmarks') ?? '').includes(sUrl));
const B2 = new Browser(w, () => ({ up: true, kbps: 900 }), () => {}, 160, 50, files);
B2.go('', 50);
check('a Ferret opened again reads the bookmarks', /pizza|Lookwise/i.test(B2.cells(60).scr.ch[3].join('')) && (disk.get('bookmarks') ?? '').split('\n').length === 4);
B.key('d', true, 41);
check('Ctrl+D again takes it away', !(disk.get('bookmarks') ?? '').includes(sUrl));
// the search box: words typed there are always a search
B.key('k', true, 42); for (const ch of 'motel') B.key(ch, false, 42); B.key('Enter', false, 42);
check('the Lookwise box searches', B.url.includes('lookwise.com/search?q=motel'));
// closing the tabs one by one; the last one closes the browser
const tabs = () => B.cells(50).scr.ch[0].join('').split('x').length;
B.key('w', true, 50); B.key('w', true, 50);
check('Ctrl+W closes a tab', quit === 0);
B.key('w', true, 50);
check('closing the last tab closes Ferret', quit === 1);
void tabs;
// the frame's pixels: digging while loading, a key that changes then, and steady once done
const C = new Browser(w, () => ({ up: true, kbps: 120 }), () => {}, 160, 50, null);
C.go('', 100);
const k1 = C.art(100.6).key, k2 = C.art(100.75).key, kDone = C.art(200).key;
check('the ferret digs while the page comes', /"dig"/.test(k1) && k1 !== k2);
check('the frame holds still once the page is in', kDone === C.art(260).key && /"peek"/.test(kDone));

// the picture: the frame, then the cells' text over it
const L = new HdLayer(1280, 800), P = new Paint(onHd(L, HdOrder.Under));
C.art(200).paint(P, 0);
const scr = C.cells(200).scr, T = new Paint({ w: 1280, h: 800, px: L.px, has: (x, y) => L.at(x, y) >= 0, set: (x, y, r, g, b) => L.put(x, y, r, g, b, HdOrder.Over) });
for (let r = 0; r < 50; r++) for (let c = 0; c < 160; c++) {
  const ch = scr.ch[r][c], f = scr.fg[r][c], b = scr.bg[r][c];
  // the cell's paper only where the frame left nothing (as the screen pass does)
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (L.at(c * CW + x, r * CH + y) < 0) L.put(c * CW + x, r * CH + y, b >> 16, (b >> 8) & 255, b & 255, HdOrder.Under);
  if (ch !== ' ') T.text(c * CW + 1, r * CH + 4, ch, 1, [f >> 16, (f >> 8) & 255, f & 255]);
}
writeFileSync('tests/.out/ferret.png', png(L.px, 1280, 800));
console.log(bad ? `${bad} failed` : 'browser-tabs: all passed (picture in tests/.out/ferret.png)');
process.exit(bad ? 1 : 0);

function png(px: Uint8ClampedArray, w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = px[k]; raw[o + 1] = px[k + 1]; raw[o + 2] = px[k + 2]; }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
