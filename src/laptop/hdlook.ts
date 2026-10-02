import { hash3 } from '../core/rng';
import { type CharGrid } from '../render/grid';
import { HD, HdOrder, type HdLayer } from '../render/hd';
import { computerMakerName } from '../locale/names';
import { type World } from '../sim/world';
import { bezelBits, drawScreen, hintOf, INKS, ROWS, SCR_H, SCR_W, type C3 } from './draw';
import { type Laptop } from './laptop';

/**
 * The notebook's 2D look in HD: the same layout as the classic one (lid upright over the deck, the
 * deck in perspective running off the bottom), but its body drawn in the HD layer's pixels, under the
 * interface: smooth edges, a finish of its own (brushed metal, matte or glossy plastic, by the maker),
 * keycaps with a lit top and a shadow, speaker grilles, a touchpad, a hinge and a power button. The
 * key labels, the bezel's lights and the screen are the interface's characters over it, at 80 rows.
 */
const FINISH = ['metal', 'matte', 'gloss'] as const;
/** Where the power button is on the interface's grid (cells), for a click; null when not shown. */
export let powerAt: [number, number, number, number] | null = null;

export function drawLaptopHd(g: CharGrid, hd: HdLayer, P: Laptop, world: World, now: number, light: Float32Array, glint: number) {
  powerAt = null;
  if (P.raise < 0.01) return;
  const H = P.pc.hw, S = P.shell, ink = INKS[S.ink][0], fin = FINISH[H.maker % FINISH.length];
  const Lr = Math.min(1.4, 0.25 + light[0]), Lg = Math.min(1.4, 0.25 + light[1]), Lb = Math.min(1.4, 0.25 + light[2]);
  const lit = (c: readonly number[], k = 1): C3 => [c[0] * Lr * k, c[1] * Lg * k, c[2] * Lb * k];
  const put = (x: number, y: number, ch: number, fg: readonly number[], bg: readonly number[]) => {
    if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return;
    const i = y * g.cols + x;
    g.put(i, ch, fg[0], fg[1], fg[2]); g.setBg(i, bg[0], bg[1], bg[2]);
  };
  const text = (x: number, y: number, s: string, fg: readonly number[], bg: readonly number[]) => { for (let k = 0; k < s.length; k++) put(x + k, y, s.charCodeAt(k), fg, bg); };
  // a glyph only, over the HD body (the cell stays see-through)
  const glyph = (x: number, y: number, s: string, fg: readonly number[]) => {
    for (let k = 0; k < s.length; k++) {
      const xx = x + k;
      if (xx < 0 || y < 0 || xx >= g.cols || y >= g.rows || s[k] === ' ') continue;
      g.put(y * g.cols + xx, s.charCodeAt(k), fg[0], fg[1], fg[2]);
    }
  };
  const px = (x: number, y: number, c: readonly number[]) => hd.put(x, y, c[0], c[1], c[2], HdOrder.Under);

  // the same placement as the classic look, in cells; the body a little bigger round it
  const ease = 1 - (1 - P.raise) ** 3, deckRows = 2 * ROWS.length + 5, total = SCR_H + 1 + deckRows;
  const y0 = Math.round(g.rows - total + 4 + (1 - ease) * (total + 2)), x0 = (g.cols - SCR_W) >> 1;
  const hingeY = y0 + SCR_H, deckTop = hingeY + 1;
  const BODY = H.body, brand = computerMakerName(world.city, H.maker).toUpperCase();
  // the finish: a colour at an HD pixel, by the surface's own light k
  const surf = (x: number, y: number, k: number): C3 => {
    let n = 0;
    if (fin === 'metal') n = (hash3(y, 7, 3) - 0.5) * 16 + (hash3(x >> 2, y, 5) - 0.5) * 4; // brushed: streaks along the rows
    else if (fin === 'matte') n = (hash3(x, y, 9) - 0.5) * 7; // a fine speckle
    else { const b = ((x * 0.35 + y * 0.9 + glint * 120) % 140 + 140) % 140; n = b < 18 ? 26 * (1 - Math.abs(b - 9) / 9) : 0; } // gloss: a sheen across
    return lit([BODY[0] * k + n, BODY[1] * k + n, BODY[2] * k + n]);
  };
  const glow = (y: number): number => Math.max(0, 1 - (y - deckTop * HD) / (HD * 9)); // the screen's light on the deck near the hinge
  const on = S.state !== 'off' && P.pc.bootAt >= 0 && P.lid >= 1;

  // ---- the deck: wider toward the viewer, rounded at the back corners ----
  const deckW = (hy: number) => (SCR_W + 6) * HD + (hy / HD - deckTop) * 1.1 * HD;
  for (let hy = deckTop * HD; hy < g.rows * HD; hy++) {
    const w = deckW(hy), l = (g.cols * HD - w) / 2, r = l + w, back = hy - deckTop * HD;
    for (let hx = Math.floor(l); hx < Math.ceil(r); hx++) {
      if (back < 3 && (hx - l < 3 - back || r - hx < 3 - back)) continue; // the corners
      const edge = hx - l < 1.5 || r - hx < 1.5 || back < 1;
      let c = surf(hx, hy, edge ? 1.25 : 1);
      const gl = on ? glow(hy) * 0.18 : 0;
      if (gl) c = [c[0] + ink[0] * gl, c[1] + ink[1] * gl, c[2] + ink[2] * gl];
      px(hx, hy, c);
    }
  }
  // the keyboard well, then the keys: a lit top, the face, a shadow below; down while typed
  const keyFace = lit([30, 30, 34]), keyTop = lit([58, 58, 64]), keySide = lit([12, 12, 14]), well = lit(BODY, 0.55), label = lit([200, 200, 206]);
  const rowSpan = (ri: number) => { const r = 1 + ri * 2, w = SCR_W - 2 + Math.round(r * 1.1); return [(g.cols - w) / 2, w / 15, r] as const; };
  ROWS.forEach((_, ri) => {
    const [dx, U, r] = rowSpan(ri);
    for (let hy = (deckTop + r) * HD - 2; hy < (deckTop + r + 2) * HD; hy++) for (let hx = Math.floor(dx * HD) - 3; hx < (dx + 15 * U) * HD + 3; hx++) px(hx, hy, well);
  });
  ROWS.forEach((row, ri) => {
    const [dx, U, r] = rowSpan(ri);
    let u = 0;
    for (const [code, lab, wu] of row) {
      const a = (dx + u * U) * HD + 1, b = (dx + (u + wu) * U) * HD - 1, down = now - (P.pressed.get(code) ?? -9) < 0.12;
      u += wu;
      const top = (deckTop + r) * HD - 1 + (down ? 1 : 0), face = down ? lit([24, 24, 27]) : keyFace;
      for (let hy = top; hy < top + 5; hy++) for (let hx = Math.ceil(a); hx < b; hx++) {
        const corner = (hx === Math.ceil(a) || hx === Math.ceil(b) - 1) && (hy === top || hy === top + 4);
        if (corner) continue;
        px(hx, hy, hy === top && !down ? keyTop : hy >= top + 4 - (down ? 1 : 0) ? keySide : face);
      }
      // the label on the key's cell, a glyph over the cap
      const cx = Math.floor((a + b) / 2 / HD), lx = cx - (lab.length >> 1), ly = deckTop + r;
      if (lab) glyph(Math.max(Math.floor(a / HD), lx), ly, lab.slice(0, Math.max(1, Math.floor((b - a) / HD))), down ? lit([255, 255, 255]) : label);
    }
  });
  // speaker grilles either side of the keys, a dot grid
  const [la] = rowSpan(0);
  for (const side of [-1, 1]) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const hx = Math.round(side < 0 ? la * HD - 16 + i * 3 : (g.cols * HD - la * HD) + 4 + i * 3), hy = (deckTop + 1) * HD + j * 3 + 1;
    px(hx, hy, lit(BODY, 0.35));
  }
  // the power button: a small round key at the deck's back right, its ring lit while the system runs
  const pbx = Math.round(g.cols * HD - la * HD + 7), pby = deckTop * HD + 1;
  for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) {
    const d = (x / 3.2) ** 2 + (y / 2.2) ** 2;
    if (d > 1) continue;
    px(pbx + x, pby + y, d > 0.55 ? (on ? [80, 220, 120] : lit([70, 70, 76])) : lit([40, 40, 44]));
  }
  powerAt = [Math.floor((pbx - 3) / HD), Math.floor((pby - 2) / HD), Math.ceil((pbx + 4) / HD), Math.ceil((pby + 3) / HD)];
  // the touchpad, sunk into the deck, and its button bar
  const ty = (deckTop + 2 * ROWS.length + 1) * HD + 1, tw = 26 * HD, tx = (g.cols * HD - tw) >> 1;
  for (let hy = ty; hy < ty + 9; hy++) for (let hx = tx; hx < tx + tw; hx++) {
    if ((hx === tx || hx === tx + tw - 1) && (hy === ty || hy === ty + 8)) continue;
    const c = hy === ty ? lit(BODY, 0.55) : hy === ty + 8 ? lit(BODY, 1.2) : hy >= ty + 6 ? surf(hx, hy, hx === (tx + tw / 2 | 0) ? 0.6 : 0.82) : surf(hx, hy, 0.9);
    px(hx, hy, c);
  }

  // ---- the hinge: a bar shaded as a cylinder ----
  const lidL = (x0 - 2) * HD, lidR = (x0 + SCR_W + 2) * HD;
  for (let k = 0; k < HD; k++) for (let hx = lidL + 6; hx < lidR - 6; hx++) px(hx, hingeY * HD + k, lit(BODY, [0.45, 0.9, 0.55][k]));

  // ---- the lid ----
  const th = (P.lid * Math.PI) / 2, D = 2 * ROWS.length + 1;
  const edge = hingeY - SCR_H * Math.sin(th) + D * Math.cos(th);
  const bez = (x: number, y: number, k = 1): C3 => {
    // a darker bezel than the body, a lighter rim, a matte finish of its own
    const n = (hash3(x, y, 13) - 0.5) * 4;
    return lit([BODY[0] * 0.42 * k + n, BODY[1] * 0.42 * k + n, BODY[2] * 0.42 * k + n]);
  };
  if (P.lid < 1) {
    if (edge > hingeY) {
      // shut or opening: its back over the keys, wider toward the viewer, the maker's name on it
      const top = (hingeY + 1) * HD, bot = Math.round(edge * HD);
      for (let hy = top; hy <= bot; hy++) {
        const w = deckW(hy) - 2 * HD, l = (g.cols * HD - w) / 2;
        for (let hx = Math.floor(l); hx < l + w; hx++) px(hx, hy, surf(hx, hy, hy >= bot - 1 || hx - l < 1.5 || l + w - hx < 1.5 ? 1.3 : 0.92 + 0.12 * ((hy - top) / Math.max(1, bot - top))));
      }
      if (bot - top > 6 * HD / 2) glyph((g.cols - brand.length) >> 1, Math.round((top + bot) / 2 / HD), brand, lit([BODY[0] * 0.6 + 70, BODY[1] * 0.6 + 70, BODY[2] * 0.6 + 70]));
    } else {
      // past the hinge: its face, foreshortened, the glass dark
      const top = Math.round(edge * HD), n = hingeY * HD - top;
      for (let hy = top; hy < hingeY * HD; hy++) {
        const f = (hy - top) / Math.max(1, n), inGlass = f > 0.12 && f < 0.92;
        for (let hx = lidL; hx < lidR; hx++) {
          const glass = inGlass && hx >= lidL + 4 * HD && hx < lidR - 4 * HD;
          px(hx, hy, hy === top ? bez(hx, hy, 1.6) : glass ? lit([14 + 18 * f, 14 + 18 * f, 18 + 20 * f]) : bez(hx, hy));
        }
      }
    }
  } else {
    // upright: the bezel round the screen (which the interface draws), rounded top corners, a lit rim
    const top = (y0 - 2) * HD + 1;
    for (let hy = top; hy < hingeY * HD; hy++) for (let hx = lidL; hx < lidR; hx++) {
      const t = hy - top, ex = Math.min(hx - lidL, lidR - 1 - hx);
      if (t < 4 && ex < 4 - t) continue;
      const rim = t === 0 || ex === 0;
      // a dark ring of glass round the screen's characters
      const inR = hx >= (x0 + 1) * HD + 1 && hx < (x0 + SCR_W - 1) * HD - 1 && hy >= (y0 + 1) * HD + 1 && hy < (y0 + SCR_H - 1) * HD - 1;
      px(hx, hy, rim ? bez(hx, hy, 1.9) : inR ? lit([8, 8, 10]) : bez(hx, hy, 1 - 0.15 * (t / ((hingeY - y0 + 2) * HD))));
    }
    drawScreen(put, text, x0 + 2, y0 + 2, P, now, lit, light);
    // the bezel's bits as glyphs over the HD bezel
    const gput = (x: number, y: number, ch: number, fg: readonly number[]) => { if (x >= 0 && y >= 0 && x < g.cols && y < g.rows) g.put(y * g.cols + x, ch, fg[0], fg[1], fg[2]); };
    bezelBits((x, y, ch, fg) => gput(x, y, ch, fg), (x, y, s, fg) => glyph(x, y, s, fg), x0, y0, P, now, lit, [0, 0, 0], brand);
  }
  // what to do
  if (P.open && now - P.noticeAt < 3) text((g.cols - P.notice.length - 2) >> 1, Math.max(1, y0 - 4), ` ${P.notice} `, [255, 220, 140], [20, 16, 10]);
  else if (P.open && P.lid >= 1) { const h = hintOf(P); text((g.cols - h.length - 2) >> 1, Math.max(1, y0 - 4), ` ${h} `, [150, 140, 120], [14, 12, 10]); }
}
