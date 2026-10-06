/**
 * The close-up of a shelf's price tag (14.5, docs/mapa-da-tela.md zone F): looking at a good for
 * half a second, within arm's reach, a drawn 2D version of its tag appears beside it (never a zoom on
 * the 3D model): the shop's name, the good's, the price in big digits on the yellow strip, a barcode.
 * It takes the place of the old price box; F still takes the good. Lit by the scene like the payphone:
 * in a dark shop it is hard to read.
 */
import { type CharGrid } from './render/grid';
import { hash3 } from './core/rng';
import { type Aimed } from './shop';
import { type World } from './sim/world';
import { businessName } from './locale/names';
import { toUi, type Eye, type Screen } from './barks';
import en from './locale/en.json';

type C3 = [number, number, number];
/** How long the sight rests on a good before its tag shows (s), and from how near (m). */
export const TAG_WAIT = 0.5, TAG_NEAR = 1.5;
const W = 30, H = 12;
/** Big digits, 3 x 5. */
const DIGITS = ['###,#.#,#.#,#.#,###', '.#.,##.,.#.,.#.,###', '###,..#,###,#..,###', '###,..#,###,..#,###', '#.#,#.#,###,..#,..#',
  '###,#..,###,..#,###', '###,#..,###,#.#,###', '###,..#,..#,..#,..#', '###,#.#,###,#.#,###', '###,#.#,###,..#,###'].map((d) => d.split(','));

const PAPER: C3 = [232, 229, 218], STRIP: C3 = [236, 198, 58], INK: C3 = [28, 24, 20], DIM: C3 = [110, 104, 92], RED: C3 = [170, 40, 30];

/** The tag of good `A`, beside the point (ax, ay) of the interface's grid where the sight meets it. */
export function drawTag(g: CharGrid, A: Aimed, w: World, v: Eye, world: Screen, ui: Screen, light: Float32Array) {
  const at = toUi(v, A.x, A.y, A.z, world, ui);
  if (!at) return;
  const [ax, ay] = at, L = light;
  // beside the good, to the right of the sight (it is always the middle of the screen: choosing a side by it
  // flipped the tag from side to side); to the left only if the right has no room; above the conversation's strip
  let x0 = Math.round(ax) + 6 + W <= g.cols - 2 ? Math.round(ax) + 6 : Math.round(ax) - 6 - W;
  x0 = Math.max(2, Math.min(g.cols - W - 2, x0));
  const y0 = Math.max(2, Math.min(g.rows - 16 - H, Math.round(ay) - (H >> 1)));
  const put = (x: number, y: number, s: string, fg: C3, bg: C3) => {
    for (let k = 0; k < s.length; k++) {
      const gx = x0 + x + k, gy = y0 + y;
      if (x + k < 0 || x + k >= W || gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) continue;
      const i = gy * g.cols + gx;
      g.setBg(i, bg[0] * L[0], bg[1] * L[1], bg[2] * L[2]);
      g.put(i, s.charCodeAt(k), fg[0] * L[0], fg[1] * L[1], fg[2] * L[2]);
    }
  };
  for (let y = 0; y < H; y++) put(0, y, ' '.repeat(W), INK, y >= 4 && y < 9 ? STRIP : PAPER);
  // the shop and the good
  put(2, 1, businessName(w.city, A.k).toUpperCase().slice(0, W - 4), DIM, PAPER);
  const name = (en.goods as Record<string, string>)[A.good] ?? A.good.replace(/_/g, ' ');
  const words = name.split(' '), lines: string[] = [''];
  for (const s of words) { if ((lines[lines.length - 1] + ' ' + s).trim().length > W - 4) lines.push(s); else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + s).trim(); }
  lines.slice(0, 2).forEach((l, k) => put(2, 2 + k, l, INK, PAPER));
  // the price: dollars in big digits, the cents small beside them
  const d = String(Math.floor(A.cents / 100)), c = String(A.cents % 100).padStart(2, '0');
  let x = 2;
  put(x, 4, '$', INK, STRIP); x += 2;
  for (const ch of d) {
    const D = DIGITS[+ch];
    for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (D[r][q] === '#') put(x + q, 4 + r, ' ', INK, INK);
    x += 4;
  }
  put(x, 4, c, INK, STRIP);
  put(W - 7, 8, en.tag.each, DIM, STRIP);
  // the barcode and the shop's code for it
  let bars = '';
  for (let k = 0; k < 18; k++) bars += hash3(A.k, A.good.length * 31 + A.good.charCodeAt(k % A.good.length), k) < 0.55 ? '|' : hash3(k, A.cents, 7) < 0.5 ? ':' : ' ';
  put(2, 10, bars, INK, PAPER);
  put(W - 7, 10, String(1000 + Math.floor(hash3(A.k, A.cents, A.good.length) * 9000)), DIM, PAPER);
  put(W - 3, 1, '*', RED, PAPER);
  // what F does, under it
  const hint = ` ${en.tag.take} `;
  for (let k = 0; k < hint.length; k++) {
    const gx = x0 + k, gy = y0 + H;
    if (gx < g.cols && gy < g.rows) { const i = gy * g.cols + gx; g.put(i, hint.charCodeAt(k), 255, 220, 140); g.setBg(i, 20, 16, 10); }
  }
}
