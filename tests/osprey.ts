/**
 * 15.20a, the Osprey's console in Node (no GPU):
 *   npx rolldown tests/osprey.ts --format esm --platform node -o tests/.out/osprey.mjs && node tests/.out/osprey.mjs [seed]
 * The bar on the top row (desktops, title, network, cpu, memory, battery, hour), the console under it,
 * the panes' edges in pixels with the browser open, the desktops (Ctrl+1..3, Ctrl+Shift sends a window),
 * and the self test's badges in pixels. Pictures: tests/.out/osprey-term.png, osprey-split.png, osprey-post.png.
 */
import { writeFileSync } from 'node:fs';
import { createWorld } from '../src/sim/world';
import { Laptop } from '../src/laptop/laptop';
import { drawScreen } from '../src/laptop/draw';
import { WM } from '../src/laptop/wm';
import { Browser } from '../src/web/browser';
import { HdLayer, HdOrder } from '../src/render/hd';
import { onHd, Paint } from '../src/render/paint2d';
import { png } from './png';

const w = createWorld(Number(process.argv[2] ?? 42));
const P = new Laptop(w), S = P.shell;
let fails = 0;
const fail = (m: string) => { if (++fails <= 30) console.log('FAIL ' + m); };

/** The screen as cells (W x H) and its pixels, then a picture: the paper, the pixels, the text in the 5 x 7 font. */
function frame(W: number, H: number) {
  const ch = new Uint16Array(W * H), fg: number[][] = [], bg: number[][] = [];
  const put = (x: number, y: number, c: number, f: readonly number[], b: readonly number[]) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; ch[i] = c; fg[i] = [...f]; bg[i] = [...b]; };
  S.art = null;
  drawScreen(put, (x, y, s, f, b) => { for (let k = 0; k < s.length; k++) put(x + k, y, s.charCodeAt(k), f, b); }, 0, 0, P, 1, (c) => [c[0], c[1], c[2]], new Float32Array(3), W, H);
  const L = new HdLayer(1280, 800), art = S.art as { key: string; paint(p: Paint): void } | null;
  art?.paint(new Paint(onHd(L, HdOrder.Under)));
  const cw = 1280 / W, chh = 800 / H, T = new Paint({ w: 1280, h: 800, px: L.px, has: (x, y) => L.at(x, y) >= 0, set: (x, y, r, g, b) => L.put(x, y, r, g, b, HdOrder.Over) });
  const rows: string[] = [];
  for (let r = 0; r < H; r++) {
    let line = '';
    for (let c = 0; c < W; c++) {
      const i = r * W + c, b = bg[i] ?? [0, 0, 0], f = fg[i] ?? [0, 0, 0], code = ch[i] || 32;
      line += String.fromCharCode(code);
      for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) if (L.at(c * cw + x, r * chh + y) < 0) L.put(c * cw + x, r * chh + y, b[0], b[1], b[2], HdOrder.Under);
      if (code > 32 && code < 127) T.text(c * cw + (cw - 5 * (chh / 16)) / 2, r * chh + chh * 0.25, String.fromCharCode(code), chh / 16, [f[0], f[1], f[2]]);
    }
    rows.push(line);
  }
  return { rows, L, key: art?.key ?? '' };
}

// --- the console, ready: the bar on top, the lines under it ---
P.pc.bootAt = 0; S.state = 'ready';
for (let i = 0; i < 70; i++) S.lines.push({ text: `line ${i}`, ink: i % 3 === 0 ? 1 : 0 });
S.lines.push({ text: '         `-.__/ \\__.-\'        OSprey', ink: 0, rgb: [[31, 35, 0xe8e6df]] });
let F = frame(160, 50);
const bar = F.rows[0];
for (const s of [' 1 ', 'term: ~', 'wlan0', 'cpu', 'mem', 'bat', ':']) if (!bar.includes(s)) fail(`the bar shows "${s}" (got "${bar.trimEnd()}")`);
if (!F.rows.some((r) => r.includes('OSprey'))) fail('the console lines sit under the bar');
if (!F.key.startsWith('bar')) fail(`the bar has its pixels (key "${F.key}")`);
// a rule between the bar's fields, in pixels at the middle of column 10
const k = F.L.at(10 * 8 + 4, 8);
if (k < 0 || F.L.px[k] !== 58) fail('the bar\'s rules are pixels');
writeFileSync('tests/.out/osprey-term.png', png(F.L.px, 1280, 800));

// --- the browser open beside it: edges in pixels, the page's title on the bar when it has the focus ---
S.browser = new Browser(w, () => ({ up: true, kbps: 600 }), () => { S.browser = null; S.wm = null; }, 160, 50);
S.browser.go('', 0);
S.wm = new WM(S, S.browser, 160, 50);
F = frame(160, 50);
if (!F.key.includes('edges')) fail(`the split has its edges in pixels (key "${F.key}")`);
if (!F.rows[0].includes('ferret:')) fail(`the focused browser's title is on the bar (got "${F.rows[0].trimEnd()}")`);
writeFileSync('tests/.out/osprey-split.png', png(F.L.px, 1280, 800));

// --- desktops: Ctrl+2 shows an empty one; Ctrl+Shift+2 sends the focused window there ---
S.goDesk(1, false);
F = frame(160, 50);
if (F.rows.slice(1).some((r) => r.trim())) fail('an empty desktop shows nothing under the bar');
if (!F.rows[0].includes(' 2 ')) fail('the bar marks desktop 2');
S.goDesk(0, false);
S.goDesk(1, true); // the browser has the focus: it goes to 2
if (S.webDesk !== 1 || S.termDesk !== 0) fail('Ctrl+Shift+2 sends the focused browser to desktop 2');
F = frame(160, 50);
if (F.key.includes('edges')) fail('alone on its desktop, the terminal has no edges');
if (!F.rows[0].includes('term: ~')) fail('the terminal alone: its title on the bar');
S.goDesk(1, false); F = frame(160, 50);
if (!F.rows[0].includes('ferret:')) fail('on desktop 2, the browser fills the screen');
S.goDesk(0, false); S.webDesk = 0;
S.browser = null; S.wm = null;

// --- the self test: the firmware's text mode, the badges in pixels, no bar ---
S.state = 'boot'; S.bios = true;
S.lines = ['', '     HALDEN BIOS (C) 2007 HALDEN Systems, Inc.', '     HALDEN N400 BIOS Revision 1.27', '', '', '  Main Processor  : Core 2 Duo T7300 @ 2.00GHz', '  Memory Test     : 1048576K OK'].map((t) => ({ text: t, ink: 0 as const }));
F = frame(80, 25);
if (F.key !== 'post') fail('the self test paints its badges');
const y = F.L.at(80 * 16 - 16 * 6, 32 * 4);
void y;
writeFileSync('tests/.out/osprey-post.png', png(F.L.px, 1280, 800));

console.log(fails ? `\n${fails} FAILED` : 'osprey: all passed (pictures in tests/.out/osprey-term.png, osprey-split.png, osprey-post.png)');
console.log(bar.trimEnd());
