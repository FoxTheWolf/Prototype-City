/**
 * The Osprey/UX console's own look (15.20a, manual `docs/identidade/notebook-manual.html`, sections 7-9):
 * the bar on the top row (desktops, the focused window's title, the network, cpu, memory, battery,
 * the hour; every number from the virtual machine or the world), the panes' edges as fine lines on the
 * screen's pixel layer, and the firmware's two badges (the maker's ribbon, the power-saving program's)
 * in pixels on the self test. Text stays in the cells; lines, bars and badges are pixels.
 *
 * Not hacking: it reads the shell's public state (net, pc, desks), nothing of its commands.
 */
import { Paint, star, type C3, type Px } from '../render/paint2d';
import { calendar } from '../sim/clock';
import { type Shell } from './shell';

/** The console's cell on the screen's pixels (1280 x 800 / 160 x 50), and the firmware's (80 x 25). */
const CW = 8, CH = 16, FW_CW = 16, FW_CH = 32;
/** Per ink (amber, green): the bar's paper and its rules. */
const BAR_BG: C3[] = [[20, 12, 4], [6, 16, 8]];
const RULE: C3[] = [[58, 36, 16], [18, 56, 26]];

type Cell = (x: number, ch: number, fg: readonly number[], bg: readonly number[]) => void;
const p2 = (n: number) => String(n).padStart(2, '0');

/** The bar's fixed columns, so its rules stay put while the numbers change (and the pixels are not repainted). */
const DESK_X = 1, TITLE_X = 12, TITLE_W = 40, NET_X = 55, ESSID_W = 18, SIG_X = NET_X + 6 + ESSID_W + 1, CPU_X = 85, MEM_X = 96, BOLT_X = 113, BAT_X = 115, RULES = [10, 53, 83, 94, 111, 152];

/** The bar is up once the system runs, over the console (not over the firmware or the editor). */
export const barOn = (S: Shell) => S.state === 'ready' && !S.bios && !S.fw.mode && !S.editor;

/** The bar's text, on the top row: put(x, char, ink, paper). */
export function drawBar(S: Shell, put: Cell, W: number, now: number, ink: readonly C3[]) {
  const bg = BAR_BG[S.ink], pc = S.pc, N = S.net;
  for (let x = 0; x < W; x++) put(x, 32, ink[0], bg);
  const text = (x: number, s: string, fg: readonly number[], b: readonly number[] = bg) => { for (let k = 0; k < s.length && x + k < W; k++) put(x + k, s.charCodeAt(k), fg, b); };
  const empty: C3 = [ink[1][0] * 0.55, ink[1][1] * 0.55, ink[1][2] * 0.55];
  // the desktops: the one on screen in full amber, those with a window in amber, the empty ones faint
  for (let d = 0; d < 3; d++) {
    const cur = d === S.desk, used = S.deskUsed(d);
    text(DESK_X + d * 3, ` ${d + 1} `, cur ? bg : used ? ink[0] : empty, cur ? ink[0] : bg);
  }
  text(TITLE_X, S.deskTitle(now).slice(0, TITLE_W), ink[2]);
  // the network: the card's name and the joined network's (the signal is pixels, see barArt)
  const net = !pc.bios.wlan ? 'wlan0 off' : N.state === 'up' || N.state === 'assoc' || N.state === 'dhcp' ? `wlan0 ${S.netName.slice(0, ESSID_W)}` : 'wlan0 --';
  text(NET_X, net, ink[1]);
  text(CPU_X, `cpu ${String(Math.round(pc.load * 100)).padStart(3)}%`, ink[1]);
  const usedM = Math.round(pc.usedKB() / 1024), totM = pc.hw.ramMB;
  text(MEM_X, `mem ${String(usedM).padStart(4)}/${totM}M`, usedM / totM > 0.85 ? ink[2] : ink[1]);
  // the battery: its charge and the time left (a bolt on the mains, in pixels); it blinks below 10%
  const pct = Math.round(pc.charge * 100), left = pc.battLeftS();
  const tail = pc.plugged ? (pct >= 100 ? '   AC' : ' chrg') : Number.isFinite(left) ? `${Math.floor(left / 3600)}:${p2(Math.floor(left / 60) % 60)}`.padStart(5) : '--:--';
  if (pc.plugged || pct >= 10 || Math.floor(now * 2) & 1) text(BAT_X, `bat ${String(pct).padStart(3)}% ${tail}`, pct < 10 && !pc.plugged ? ink[2] : ink[1]);
  const c = calendar(S.clock);
  text(W - 6, `${p2(Math.floor(c.hour))}:${p2(Math.floor((c.hour % 1) * 60))}`, ink[2]);
}

/** The bar's pixels: the rules between its fields, the line under it, the signal's four bars, the bolt. */
export function barArt(S: Shell, W: number, ink: readonly C3[]): { key: string; paint(P: Paint): void } {
  const N = S.net, rule = RULE[S.ink], up = S.pc.bios.wlan && N.state === 'up', bars = up ? N.bars : 0, bolt = S.pc.plugged;
  return {
    key: `bar${S.ink}:${bars}:${up ? 1 : 0}:${bolt ? 1 : 0}`,
    paint(P) {
      P.rect(0, CH - 1, W * CW, 1, rule);
      for (const x of RULES) P.rect(x * CW + (CW >> 1), 3, 1, CH - 6, rule);
      if (S.pc.bios.wlan) for (let k = 0; k < 4; k++) { const h = 3 + k * 3; P.rect(SIG_X * CW + k * 4, 13 - h, 3, h, k < bars ? ink[0] : rule); }
      if (bolt) P.poly([BOLT_X * CW + 5, 2, BOLT_X * CW + 1, 9, BOLT_X * CW + 4, 9, BOLT_X * CW + 2, 14, BOLT_X * CW + 7, 6, BOLT_X * CW + 4, 6], ink[2]);
    },
  };
}

/** The panes' edges in a split: a fine rule between them, the focused one ringed in light amber. */
export function edgesArt(R: { tx: number; tw: number; wx: number; ww: number }, focus: 'term' | 'web', top: number, rows: number, ink: readonly C3[]): { key: string; paint(P: Paint): void } | null {
  if (R.tw <= 0 || R.ww <= 0) return null;
  return {
    key: `edges:${R.tw}:${focus}:${ink[2].join()}`,
    paint(P) {
      const y0 = top * CH + 2, y1 = (top + rows) * CH - 2, mid = (R.tx + R.tw) * CW + (CW >> 1);
      P.rect(mid, y0, 1, y1 - y0, ink[2], 0.8);
      const [x, w] = focus === 'term' ? [R.tx, R.tw] : [R.wx, R.ww], X0 = x * CW + 1, X1 = (x + w) * CW - 2;
      for (const [a, b, c, d] of [[X0, y0, X1 - X0, 1], [X0, y1 - 1, X1 - X0, 1], [X0, y0, 1, y1 - y0], [X1, y0, 1, y1 - y0]]) P.rect(a, b, c, d, ink[2], 0.5);
    },
  };
}

/** A surface moved down by dy pixels (a window painted under the bar). */
export const below = (s: Px, dy: number): Px => ({ w: s.w, h: s.h - dy, px: s.px, has: (x, y) => s.has(x, y + dy), set: (x, y, r, g, b) => s.set(x, y + dy, r, g, b) });
/** A surface slanted to the right as it rises from row y0 (italic letters). */
const slant = (s: Px, y0: number, k: number): Px => ({ w: s.w, h: s.h, px: s.px, has: (x, y) => s.has(x + Math.round((y0 - y) * k), y), set: (x, y, r, g, b) => s.set(x + Math.round((y0 - y) * k), y, r, g, b) });

/**
 * The self test's two badges in pixels (manual, section 9): top left the maker's blue ribbon (a medal,
 * its disc and two tails), top right the power-saving program's: a yellow sweep ending in a star, the
 * slanted name, a green rule and EFFICIENCY PARTNER. Laid out on the firmware's 80 x 25 cells.
 */
export const postArt = { key: 'post', paint: paintPost };
function paintPost(P: Paint) {
  // the ribbon: 24 x 32 units from the manual, at 2 px a unit, by the first rows' left edge
  const rx = FW_CW * 0.6, ry = FW_CH * 0.9, u = FW_CH / 16, at = (pts: number[]) => pts.map((v, i) => (i & 1 ? ry + v * u : rx + v * u));
  P.poly(at([5, 13, 1, 30, 7, 26, 10, 32, 12, 16]), [42, 79, 224]);
  P.poly(at([19, 13, 23, 30, 17, 26, 14, 32, 12, 16]), [42, 79, 224]);
  P.disc(rx + 12 * u, ry + 10 * u, 9 * u, [60, 110, 255]);
  P.ring(rx + 12 * u, ry + 10 * u, 5.7 * u, 1.4 * u, [169, 192, 255]);
  // the badge: 270 x 135 units across 29 cells, from the right edge
  const s = (FW_CW * 29) / 270, bx = 80 * FW_CW - FW_CW * 30, by = FW_CH * 0.6, X = (v: number) => bx + v * s, Y = (v: number) => by + v * s;
  const yel: C3 = [255, 230, 40], grn: C3 = [70, 220, 90];
  // the sweep: a cubic from the lower left over to the star
  const B = [18, 92, 10, 40, 70, 6, 140, 8], B2 = [140, 8, 190, 9, 226, 22, 240, 40];
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of [B, B2]) {
    let px = X(x0), py = Y(y0);
    for (let k = 1; k <= 24; k++) {
      const t = k / 24, m = 1 - t, qx = m * m * m * x0 + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3, qy = m * m * m * y0 + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3;
      P.line(px, py, X(qx), Y(qy), 5 * s, yel); px = X(qx); py = Y(qy);
    }
  }
  const st = star(X(238), Y(68), 26 * s, 11 * s, 5);
  for (let k = 0; k < st.length; k += 2) P.line(st[k], st[k + 1], st[(k + 2) % st.length], st[(k + 3) % st.length], 4.5 * s, yel);
  // the program's name, slanted like a hand's (the bulb font, leaning right)
  const ty = Y(50), ts = 6, lean = new Paint(slant(P.s, ty + 7 * ts, 0.28));
  lean.text(X(26), ty, 'powersave', ts, yel, 1, 3);
  P.rect(X(14), Y(106), 252 * s, Math.max(2, 3 * s), grn);
  const label = 'EFFICIENCY PARTNER', ls = 2, lw = Paint.textW(label, ls, 3);
  P.text(X(140) - lw / 2, Y(116), label, ls, grn, 1, 3);
}
