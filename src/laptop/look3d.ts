import { CharGrid } from '../render/grid';
import { drawObjects, Mat, part, Shape, type Cam, type Obj, type Part } from '../render/objects';
import { type World } from '../sim/world';
import { drawScreen, hintOf, INKS, ROWS, type C3 } from './draw';
import { type Laptop } from './laptop';
import { computerMakerName } from '../locale/names';

/**
 * The notebook's 3D look: its body is an object with volume (render/objects.ts) set down in front of
 * the player where they sat, drawn into the interface's grid from the real camera, so it takes the
 * scene's light and stays put while the player looks around (right mouse; let go, the view comes back
 * to it). It sits close: the screen fills most of the view and the keyboard is below it, seen by
 * looking down. Faced squarely, the screen's characters are a layer of their own (glRenderer.ts), as
 * big as a real screen's, laid where the lid's glass falls: the system's console (160 x 50) or the
 * firmware's text mode (80 x 25). From aside, they are painted onto the glass in perspective (not to be
 * read then anyway, and the screen stays alive). The screen's light falls on the deck and the keys.
 */
/** Metres: the eye over the desk, the glass's width (16:10, a 13" screen), the deck's depth and thickness, the lid's. */
const DESK = 0.3, GLASS_W = 0.29, DECK_D = 0.2, DECK_H = 0.02, LID_T = 0.007;
/** The bezel round the glass: at the bottom (over the hinge), at the top, at the sides. */
const BEZ_B = 0.014, BEZ_T = 0.01, BEZ_S = 0.007;
/** The keyboard: depth of a row, of a key; keys are wider than deep, as they look on a real deck. */
const ROW_D = 0.0135, KEY_D = 0.0105, KEYS_W = 0.28;
const VFOV = Math.PI / 3;

let anchor = 0, pitch0 = -0.6, wasOpen = false, tmp: CharGrid | null = null;
const L3 = new Float32Array(3);
/** The glint and the eye's adaptation on the screen, eased over time (as on the phone, see phone/draw.ts; stronger here). */
const GL = { lat: 0, str: 0, r: 1, g: 1, b: 1, back: 0, adapt: 1, at: 0, bloom: 0, mean: [0, 0, 0] as C3 };
/** Where the power button falls on the interface's grid (cells), for a click; null when not shown. */
export let power3d: [number, number, number, number] | null = null;
/** The view's yaw the notebook was set down facing, and the pitch that centres its screen: where the view comes back to. */
export const laptopAnchor = () => anchor;
export const laptopPitch = () => pitch0;
/** Where the screen layer's top-left falls on the interface's grid (cells, fractional) while it is faced squarely; null otherwise. */
export let screenAt: [number, number] | null = null;

/** The view; termW and termH: the screen layer's size on the interface's grid (cells, fractional). */
export interface View3d { yaw: number; pitch: number; aspect: number; still: boolean; termW: number; termH: number }

/** term: the screen layer's characters, filled here (its size: the console's or the text mode's). */
export function drawLaptop3d(g: CharGrid, term: CharGrid, P: Laptop, world: World, now: number, light: Float32Array, glint: Float32Array, view: View3d) {
  power3d = null; screenAt = null;
  if (P.open && !wasOpen) anchor = view.yaw;
  wasOpen = P.open;
  if (P.raise < 0.01) return;
  const H = P.pc.hw, S = P.shell, ink = INKS[S.ink][0], BODY = H.body;
  const rows = g.rows, cols = g.cols, scale = rows / 2 / Math.tan(VFOV / 2), plane = ((cols / 2) * view.aspect) / scale;
  // the glass: a real screen's width, as near as it must be to cover the screen layer; its height follows
  const T = (GLASS_W * scale) / (view.aspect * view.termW), GW = GLASS_W, GH = (view.termH * T) / scale;
  const halfLid = GW / 2 + BEZ_S, LID_H = BEZ_B + GH + BEZ_T, HALF_W = halfLid + 0.006;
  const glass0 = DECK_H + BEZ_B, glass1 = glass0 + GH;
  // the pitch that puts the glass's middle a little above the middle of the view: row = hor + (eye - z) * scale / T
  pitch0 = Math.max(-0.69, Math.atan((rows * 0.47 - (DESK - (glass0 + glass1) / 2) * scale / T - rows / 2) / scale));
  const off = view.yaw - anchor, dirX = Math.cos(off), dirY = Math.sin(off);
  // the object comes up from below as it is taken out
  const ease = 1 - (1 - P.raise) ** 3, eye = DESK + (1 - ease) * 0.3;
  const cam: Cam = { x: 0, y: 0, eye, dirX, dirY, plX: -dirY * plane, plY: dirX * plane, plane, scale, hor: rows / 2 + Math.tan(view.pitch) * scale, far: 500, light: () => L3, mul: true };
  L3[0] = Math.min(1.5, 0.3 + light[0]); L3[1] = Math.min(1.5, 0.3 + light[1]); L3[2] = Math.min(1.5, 0.3 + light[2]);
  const lit = (c: readonly number[], k = 1): C3 => [c[0] * L3[0] * k, c[1] * L3[1] * k, c[2] * L3[2] * k];
  const on = S.state !== 'off' && P.pc.bootAt >= 0 && P.lid >= 1;

  // ---- the model, in the object's frame: +x away from the player, +y to the right, z up from the desk (at 0) ----
  const parts: Part[] = [], xh = DECK_D / 2, x0 = -DECK_D / 2; // the hinge and the deck's near edge, about the middle
  const col = (k: number): [number, number, number] => [BODY[0] * k, BODY[1] * k, BODY[2] * k];
  parts.push(part(Shape.Box, x0, -HALF_W, 0, xh, HALF_W, DECK_H, col(1), Mat.Solid, '#', '.', '#'));
  const U = KEYS_W / 15, keyCells: [number, number, string, boolean][] = [];
  ROWS.forEach((row, ri) => {
    const kx1 = xh - 0.022 - ri * ROW_D, kx0 = kx1 - KEY_D;
    let u = 0;
    for (const [code, lab, wu] of row) {
      const y0 = -KEYS_W / 2 + u * U + 0.0015, y1 = -KEYS_W / 2 + (u + wu) * U - 0.0015, down = now - (P.pressed.get(code) ?? -9) < 0.12;
      u += wu;
      parts.push(part(Shape.Box, kx0, y0, DECK_H, kx1, y1, DECK_H + (down ? 0.0012 : 0.0035), down ? [22, 22, 25] : [34, 34, 38], Mat.Solid, ' ', ' ', ' '));
      if (lab) keyCells.push([(kx0 + kx1) / 2, (y0 + y1) / 2, lab, down]);
    }
  });
  // the touchpad; the power button at the back right, beside the keys, its ring lit while the system runs
  const padX1 = xh - 0.022 - ROWS.length * ROW_D - 0.008;
  parts.push(part(Shape.Box, padX1 - 0.05, -0.045, DECK_H, padX1, 0.045, DECK_H + 0.0006, col(0.78), Mat.Solid, ' ', ' ', ' '));
  const PB: [number, number] = [xh - 0.02, KEYS_W / 2 + (HALF_W - KEYS_W / 2) / 2];
  parts.push(part(Shape.Cyl, PB[0] - 0.005, PB[1] - 0.005, DECK_H, PB[0] + 0.005, PB[1] + 0.005, DECK_H + 0.0015, on ? [80, 220, 120] : [110, 112, 120], on ? Mat.Glow : Mat.Solid, ' ', 'o', ' '));
  parts.push(part(Shape.Cyl, PB[0] - 0.003, PB[1] - 0.003, DECK_H, PB[0] + 0.003, PB[1] + 0.003, DECK_H + 0.004, [44, 44, 50], Mat.Solid, ' ', 'O', ' '));
  // the lid: lying over the keys when shut, upright when open; strips along its length
  const a = (P.lid * Math.PI) / 2, N = P.lid >= 1 ? 1 : 10, zh = DECK_H;
  for (let k = 0; k < N; k++) {
    const s0 = (k / N) * LID_H, s1 = ((k + 1) / N) * LID_H;
    const ax = xh - Math.cos(a) * s0, bx = xh - Math.cos(a) * s1, az = zh + Math.sin(a) * s0, bz = zh + Math.sin(a) * s1;
    const face = a > Math.PI / 4;
    parts.push(part(Shape.Box, Math.min(ax, bx), -halfLid, Math.min(az, bz), Math.max(ax, bx) + LID_T, halfLid, Math.max(az, bz) + (face ? 0 : LID_T),
      face ? [BODY[0] * 0.4, BODY[1] * 0.4, BODY[2] * 0.4] : col(0.95), Mat.Solid, face ? ' ' : '#', ' ', ' '));
  }
  const obj: Obj = { x: T - xh, y: 0, c: 1, s: 0, parts, r: Math.hypot(DECK_D, HALF_W), h: DECK_H + LID_H + 0.02, seed: 7, z0: 0 };

  // ---- the screen's place: faced squarely, the screen layer goes over the glass ----
  const tl = P.lid >= 1 ? project(cam, obj, xh - 0.0005, -GW / 2, glass1, cols) : null, br = P.lid >= 1 ? project(cam, obj, xh - 0.0005, GW / 2, glass0, cols) : null;
  const square = !!tl && !!br && view.still && Math.abs(br[0] - tl[0] - view.termW) < 1.5 && Math.abs(br[1] - tl[1] - view.termH) < 1;
  // the screen's characters: the console, or the firmware's text mode
  const TW = term.cols, TH = term.rows;
  if (P.lid >= 1) {
    const tput = (x: number, y: number, ch: number, fg: readonly number[], bg: readonly number[]) => {
      if (x < 0 || y < 0 || x >= TW || y >= TH) return;
      const i = y * TW + x;
      term.put(i, ch, fg[0], fg[1], fg[2]); term.setBg(i, bg[0], bg[1], bg[2]);
    };
    drawScreen(tput, (x, y, s, fg, bg) => { for (let k = 0; k < s.length; k++) tput(x + k, y, s.charCodeAt(k), fg, bg); }, 0, 0, P, now, lit, light, TW, TH);
    glassOver(term, light, glint, now, on);
  }

  // ---- the body, drawn into a grid of the interface's size, copied over it as solid blocks (the soft look) ----
  if (!tmp || tmp.cols !== cols || tmp.rows !== rows) tmp = new CharGrid(cols, rows);
  tmp.depth.fill(1e9);
  drawObjects(tmp, [obj], cam);
  // the cells the screen layer shows through: every cell it touches (rounded out, so no row of the
  // body cuts its edge; the renderer fills the sliver round the layer with its edge's color)
  const gx0 = square ? Math.floor(tl![0]) : 0, gy0 = square ? Math.floor(tl![1]) : 0, gx1 = square ? Math.ceil(tl![0] + view.termW) : 0, gy1 = square ? Math.ceil(tl![1] + view.termH) : 0;
  for (let i = 0; i < cols * rows; i++) {
    if (tmp.depth[i] > 1e8) continue;
    const k = i * 4, x = i % cols, y = Math.floor(i / cols);
    if (square && x >= gx0 && x < gx1 && y >= gy0 && y < gy1) continue; // the screen layer shows there
    let r = tmp.cells[k + 1], gg = tmp.cells[k + 2], b = tmp.cells[k + 3];
    const t = tmp.depth[i], camX = (2 * (x + 0.5)) / cols - 1, rx = dirX + cam.plX * camX, ry = dirY + cam.plY * camX, z = eye + ((cam.hor - (y + 0.5)) * t) / scale;
    const ox = rx * t - obj.x, wy = ry * t;
    if (!square && P.lid >= 1 && Math.abs(ox - xh) < 0.002 && rx > 0.05) {
      // from aside: the lid's glass shows the screen's characters where the ray meets it
      const u = (wy + GW / 2) / GW, v = (glass1 - z) / GH;
      if (u >= 0 && u < 1 && v >= 0 && v < 1) {
        const q = (Math.floor(v * TH) * TW + Math.floor(u * TW)) * 4;
        g.put(i, term.cells[q], term.cells[q + 1], term.cells[q + 2], term.cells[q + 3]);
        g.setBg(i, term.bg[q], term.bg[q + 1], term.bg[q + 2]);
        continue;
      }
    }
    if (on && ox < xh - 0.001) {
      // the screen's light, falling off with the distance to the glass
      const d = Math.hypot(xh - ox, Math.max(0, Math.abs(wy) - halfLid), Math.max(0, glass0 - z, z - glass1));
      const f = 0.32 / (1 + (d / 0.05) ** 2);
      r += ink[0] * f; gg += ink[1] * f; b += ink[2] * f;
    }
    g.put(i, tmp.cells[k], r * 0.85, gg * 0.85, b * 0.85);
    g.setBg(i, r * 0.72, gg * 0.72, b * 0.72);
  }
  const put = (x: number, y: number, ch: number, fg: readonly number[], bg: readonly number[]) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const i = y * cols + x;
    g.put(i, ch, fg[0], fg[1], fg[2]); g.setBg(i, bg[0], bg[1], bg[2]);
  };
  const text = (x: number, y: number, s: string, fg: readonly number[], bg: readonly number[]) => { for (let k = 0; k < s.length; k++) put(x + k, y, s.charCodeAt(k), fg, bg); };
  const glyph = (x: number, y: number, ch: number, c: readonly number[]) => { if (x >= 0 && y >= 0 && x < cols && y < rows && tmp!.depth[y * cols + x] < 1e8) g.put(y * cols + x, ch, c[0], c[1], c[2]); };
  // key labels: a glyph where each key's top falls
  for (const [kx, ky, lab, down] of keyCells) {
    const p = project(cam, obj, kx, ky, DECK_H + 0.0035, cols);
    if (!p || p[1] >= rows) continue;
    const x = Math.round(p[0]) - (lab.length >> 1), y = Math.floor(p[1]), c = down ? lit([255, 255, 255]) : lit([200, 200, 206]);
    for (let n = 0; n < Math.min(lab.length, 3); n++) glyph(x + n, y, lab.charCodeAt(n), c);
  }
  { const p = project(cam, obj, PB[0], PB[1], DECK_H, cols); if (p) power3d = [Math.floor(p[0]) - 2, Math.floor(p[1]) - 1, Math.floor(p[0]) + 3, Math.floor(p[1]) + 2]; }
  if (square) {
    screenAt = [tl![0], tl![1]];
    // bloom in the dark: the screen's light haloes over the bezel round it
    if (on && GL.bloom > 0.01) {
      const x0 = Math.round(tl![0]), y0 = Math.round(tl![1]), x1 = Math.round(br![0]), y1 = Math.round(br![1]), [ar, ag, ab] = GL.mean;
      for (let y = y0 - 4; y <= y1 + 3; y++) for (let x = x0 - 6; x <= x1 + 5; x++) {
        if (x < 0 || y < 0 || x >= cols || y >= rows || tmp.depth[y * cols + x] > 1e8) continue;
        const d = Math.max(x0 - x, x - x1 + 1, (y0 - y) * 1.6, (y - y1 + 1) * 1.6, 0);
        if (d <= 0) continue;
        const w = GL.bloom * 1.1 / (d + 0.6), k = (y * cols + x) * 4;
        g.bg[k] += ar * w; g.bg[k + 1] += ag * w; g.bg[k + 2] += ab * w;
        g.cells[k + 1] += ar * w; g.cells[k + 2] += ag * w; g.cells[k + 3] += ab * w;
      }
    }
    // the bezel: the webcam over the glass; the maker's name and the lights under it
    const cx = Math.round((tl![0] + br![0]) / 2), below = Math.round(br![1]);
    glyph(cx, Math.round(tl![1]) - 1, 111, [40, 40, 44]);
    const brand = computerMakerName(world.city, H.maker).toUpperCase();
    for (let n = 0; n < brand.length; n++) glyph(cx - (brand.length >> 1) + n, below, brand.charCodeAt(n), lit([150, 150, 156]));
    const pc = P.pc, blink = Math.floor(now * 3) & 1, busy = on && now - P.hddAt < 0.07 + 0.05 * ((now * 37) % 1);
    const chg: C3 = pc.plugged ? (pc.charge >= 0.995 ? [120, 255, 140] : [255, 170, 50]) : on && pc.charge < 0.1 ? (blink ? [255, 150, 40] : [50, 30, 10]) : [40, 30, 16];
    const rx = Math.round(br![0]) - 2;
    glyph(rx, below, 46, on ? [120, 255, 140] : [60, 40, 20]);
    glyph(rx - 2, below, 46, busy ? [255, 190, 70] : [50, 36, 18]);
    glyph(rx - 4, below, 46, chg);
  }
  if (P.open && now - P.noticeAt < 3) text((cols - P.notice.length - 2) >> 1, 1, ` ${P.notice} `, [255, 220, 140], [20, 16, 10]);
  else if (P.open && P.lid >= 1) { const hh = hintOf(P); text((cols - hh.length - 2) >> 1, 1, ` ${hh} `, [150, 140, 120], [14, 12, 10]); }
}

/** Where a point of the object (its frame) falls on the grid: [column, row], or null behind the eye. */
function project(v: Cam, o: Obj, x: number, y: number, z: number, cols: number): [number, number] | null {
  const wx = o.x + x * o.c - y * o.s - v.x, wy = o.y + x * o.s + y * o.c - v.y;
  const inv = 1 / (v.plX * v.dirY - v.dirX * v.plY);
  const tY = inv * (-v.plY * wx + v.plX * wy), tX = inv * (v.dirY * wx - v.dirX * wy);
  if (tY < 0.05) return null;
  return [(cols / 2) * (1 + tX / tY), v.hor - ((z - v.eye) * v.scale) / tY];
}

/**
 * The glass over the screen, as on the phone but stronger: the eye's adaptation (in the dark the
 * screen looks brighter and blooms on the bezel; under a strong light it looks washed and dimmer),
 * and the glint: the brightest light nearby mirrored as a soft diagonal band on the side it comes
 * from, in its color, stronger for a light behind the player (the glass faces them). Off, the glint
 * shows plainly on the dark glass.
 */
function glassOver(T: CharGrid, light: Float32Array, glint: Float32Array, now: number, on: boolean) {
  const dt = Math.min(0.1, Math.max(0, now - GL.at)), q = 1 - Math.exp(-dt / 0.25);
  GL.at = now;
  GL.lat += (glint[0] - GL.lat) * q; GL.str += (glint[1] - GL.str) * q;
  GL.back += (glint[5] - GL.back) * q; GL.r += (glint[2] - GL.r) * q; GL.g += (glint[3] - GL.g) * q; GL.b += (glint[4] - GL.b) * q;
  const Lm = (light[0] + light[1] + light[2]) / 3;
  GL.adapt += (Lm - GL.adapt) * (1 - Math.exp(-dt / 1.5));
  const gain = Math.min(1.3, Math.max(0.5, 1.75 - 0.85 * GL.adapt));
  GL.bloom = 0.9 * Math.min(1, Math.max(0, (0.95 - GL.adapt) / 0.5));
  // the band: across the glass, leaning; where it lies follows the side the light comes from
  const W = T.cols, H = T.rows, s0 = 0.5 + GL.lat * 0.38, amp = (on ? 70 : 110) * GL.str * (0.6 + 0.6 * GL.back);
  // a broad veil of the light too, whatever its direction: a lit room washes the glass
  const veil = Math.min(1.6, Lm) * (on ? 6 : 9);
  const roll = (v: number) => (v > 200 ? 200 + (v - 200) * 0.35 : v);
  let ar = 0, ag = 0, ab = 0;
  for (let r = 0; r < H; r++) {
    const v = r / H;
    for (let c = 0; c < W; c++) {
      const u = c / W, k = (r * W + c) * 4, C = T.cells, B = T.bg;
      const band = Math.exp(-(((u + (v - 0.5) * 0.45 - s0) / 0.11) ** 2)) + 0.35 * Math.exp(-(((u + (v - 0.5) * 0.45 - s0 - 0.2) / 0.04) ** 2));
      const sh = band * amp;
      for (let n = 1; n < 4; n++) C[k + n] = roll(C[k + n] * gain);
      for (let n = 0; n < 3; n++) B[k + n] = roll(B[k + n] * gain);
      ar += B[k] + C[k + 1] * 0.25; ag += B[k + 1] + C[k + 2] * 0.25; ab += B[k + 2] + C[k + 3] * 0.25;
      // the reflection adds the same over a letter as over the paper (the letters are under the glass)
      const ar2 = sh * GL.r + veil * light[0], ag2 = sh * GL.g + veil * light[1], ab2 = sh * GL.b + veil * light[2];
      B[k] += ar2; B[k + 1] += ag2; B[k + 2] += ab2;
      C[k + 1] += ar2; C[k + 2] += ag2; C[k + 3] += ab2;
    }
  }
  const n = W * H;
  GL.mean = [ar / n, ag / n, ab / n];
}
