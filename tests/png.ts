// A picture of the Ferret for the tests (no game, no GPU): the frame painted on an HD layer, then the cells'
// paper where the frame left nothing and their text in the 5 x 7 font; and a tiny PNG writer.
import { deflateSync } from 'node:zlib';
import { HdLayer, HdOrder } from '../src/render/hd';
import { onHd, Paint } from '../src/render/paint2d';
import { CH, CW } from '../src/web/chrome';
import { type Browser } from '../src/web/browser';

export function shot(B: Browser, now: number): Buffer {
  const L = new HdLayer(1280, 800);
  B.cells(now); // the error page's buttons are placed by the cells
  B.art(now).paint(new Paint(onHd(L, HdOrder.Under)), 0);
  const scr = B.cells(now).scr, T = new Paint({ w: 1280, h: 800, px: L.px, has: (x, y) => L.at(x, y) >= 0, set: (x, y, r, g, b) => L.put(x, y, r, g, b, HdOrder.Over) });
  for (let r = 0; r < scr.h; r++) for (let c = 0; c < scr.w; c++) {
    const ch = scr.ch[r][c], f = scr.fg[r][c], b = scr.bg[r][c];
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (L.at(c * CW + x, r * CH + y) < 0) L.put(c * CW + x, r * CH + y, b >> 16, (b >> 8) & 255, b & 255, HdOrder.Under);
    if (ch !== ' ') T.text(c * CW + 1, r * CH + 4, ch, 1, [f >> 16, (f >> 8) & 255, f & 255]);
  }
  return png(L.px, 1280, 800);
}

export function png(px: Uint8ClampedArray, w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = px[k]; raw[o + 1] = px[k + 1]; raw[o + 2] = px[k + 2]; }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
