import { CharGrid } from '../render/grid';
import { drawObjects, Mat, part, Shape, type Cam, type Obj, type Part } from '../render/objects';
import { type World } from '../sim/world';
import { bezelBits, drawScreen, hintOf, INKS, ROWS, type C3 } from './draw';
import { type Laptop } from './laptop';
import { TERM_H, TERM_W } from './shell';
import { computerMakerName } from '../locale/names';

/**
 * The notebook's 3D look: its body is an object with volume (render/objects.ts) set down in front of
 * the player where they sat, drawn into the interface's grid from the real camera, so it takes the
 * scene's light and stays put on the desk while the player looks around (right mouse). The lid
 * swings open as a stack of strips. The screen's characters cannot be drawn in perspective and stay
 * legible, so the terminal is the same 2D screen as the other looks, laid where the lid's glass falls
 * on screen while the player faces it; looking away, the glass is a glow of the screen's colour.
 */
/** Metres: the desk below the eye, how far the hinge is, the deck and the lid. */
const DESK = 0.45, HINGE_T = 0.5, DECK_D = 0.25, HALF_W = 0.2, DECK_H = 0.022, LID_H = 0.25, LID_T = 0.008;
/** The terminal's glass on the lid (from the hinge up, half width), sized so it falls on 80 x 22 cells at the hinge's distance. */
const GLASS_Z0 = 0.045, VFOV = Math.PI / 3;

let anchor = 0, wasOpen = false, tmp: CharGrid | null = null;
const L3 = new Float32Array(3);
/** Where the power button falls on the interface's grid (cells), for a click; null when not shown. */
export let power3d: [number, number, number, number] | null = null;

export interface View3d { yaw: number; pitch: number; aspect: number }

export function drawLaptop3d(g: CharGrid, P: Laptop, world: World, now: number, light: Float32Array, view: View3d) {
  power3d = null;
  if (P.open && !wasOpen) anchor = view.yaw;
  wasOpen = P.open;
  if (P.raise < 0.01) return;
  const H = P.pc.hw, S = P.shell, ink = INKS[S.ink][0], BODY = H.body;
  const rows = g.rows, cols = g.cols, scale = rows / 2 / Math.tan(VFOV / 2), plane = ((cols / 2) * view.aspect) / scale;
  const off = view.yaw - anchor, dirX = Math.cos(off), dirY = Math.sin(off);
  // the object comes up from below as it is taken out
  const ease = 1 - (1 - P.raise) ** 3, eye = DESK + (1 - ease) * 0.35;
  const cam: Cam = { x: 0, y: 0, eye, dirX, dirY, plX: -dirY * plane, plY: dirX * plane, plane, scale, hor: rows / 2 + Math.tan(view.pitch) * scale, far: 500, light: () => L3, mul: true };
  L3[0] = Math.min(1.5, 0.3 + light[0]); L3[1] = Math.min(1.5, 0.3 + light[1]); L3[2] = Math.min(1.5, 0.3 + light[2]);
  const lit = (c: readonly number[], k = 1): C3 => [c[0] * L3[0] * k, c[1] * L3[1] * k, c[2] * L3[2] * k];

  // ---- the model, in the object's frame: +x away from the player, +y to the right, z up from the desk (at 0) ----
  const parts: Part[] = [], xh = HINGE_T - DECK_D / 2, x0 = -DECK_D / 2; // hinge and the deck's near edge, about the middle
  const col = (k: number): [number, number, number] => [BODY[0] * k, BODY[1] * k, BODY[2] * k];
  parts.push(part(Shape.Box, x0, -HALF_W, 0, xh, HALF_W, DECK_H, col(1), Mat.Solid, '#', '.', '#'));
  // the keys, rows from the back; 15 units a row over 0.3 m
  const U = 0.3 / 15, keyCells: [number, number, string, boolean][] = [];
  ROWS.forEach((row, ri) => {
    const kx1 = xh - 0.03 - ri * 0.022, kx0 = kx1 - 0.017;
    let u = 0;
    for (const [code, lab, wu] of row) {
      const y0 = -0.15 + u * U + 0.0015, y1 = -0.15 + (u + wu) * U - 0.0015, down = now - (P.pressed.get(code) ?? -9) < 0.12;
      u += wu;
      parts.push(part(Shape.Box, kx0, y0, DECK_H, kx1, y1, DECK_H + (down ? 0.0015 : 0.005), down ? [22, 22, 25] : [34, 34, 38], Mat.Solid, ' ', ' ', ' '));
      if (lab) keyCells.push([(kx0 + kx1) / 2, (y0 + y1) / 2, lab, down]);
    }
  });
  // the touchpad, the power button (at the back right, lit while the system runs)
  const on = S.state !== 'off' && P.pc.bootAt >= 0 && P.lid >= 1;
  parts.push(part(Shape.Box, x0 + 0.015, -0.05, DECK_H, x0 + 0.075, 0.05, DECK_H + 0.0008, col(0.8), Mat.Solid, ' ', ' ', ' '));
  const PB: [number, number] = [xh - 0.012, 0.17];
  parts.push(part(Shape.Cyl, PB[0] - 0.006, PB[1] - 0.006, DECK_H, PB[0] + 0.006, PB[1] + 0.006, DECK_H + 0.003, on ? [80, 220, 120] : [60, 60, 66], on ? Mat.Glow : Mat.Solid, ' ', 'o', ' '));
  // the lid: lying over the keys when shut, upright when open; strips along its length
  const a = (P.lid * Math.PI) / 2, N = P.lid >= 1 ? 1 : 10, zh = DECK_H;
  for (let k = 0; k < N; k++) {
    const s0 = (k / N) * LID_H, s1 = ((k + 1) / N) * LID_H;
    const ax = xh - Math.cos(a) * s0, bx = xh - Math.cos(a) * s1, az = zh + Math.sin(a) * s0, bz = zh + Math.sin(a) * s1;
    const face = a > Math.PI / 4;
    parts.push(part(Shape.Box, Math.min(ax, bx) - (face ? 0 : 0), -HALF_W, Math.min(az, bz), Math.max(ax, bx) + LID_T, HALF_W, Math.max(az, bz) + (face ? 0 : LID_T),
      face ? [BODY[0] * 0.4, BODY[1] * 0.4, BODY[2] * 0.4] : col(0.95), Mat.Solid, face ? ' ' : '#', ' ', ' '));
  }
  const obj: Obj = { x: HINGE_T - xh, y: 0, c: 1, s: 0, parts, r: Math.hypot(DECK_D, HALF_W), h: DECK_H + LID_H + 0.02, seed: 7, z0: 0 };

  // ---- drawn into a grid of the interface's size, then copied over it as solid blocks (the soft look) ----
  if (!tmp || tmp.cols !== cols || tmp.rows !== rows) tmp = new CharGrid(cols, rows);
  tmp.depth.fill(1e9);
  drawObjects(tmp, [obj], cam);
  const glowRow = (() => { const p = project(cam, obj, xh, 0, zh, cols, rows); return p ? p[1] : rows; })();
  for (let i = 0; i < cols * rows; i++) {
    if (tmp.depth[i] > 1e8) continue;
    const k = i * 4, y = Math.floor(i / cols);
    let r = tmp.cells[k + 1], gg = tmp.cells[k + 2], b = tmp.cells[k + 3];
    // the screen's light on the deck near the hinge
    if (on && y > glowRow) { const f = Math.max(0, 1 - (y - glowRow) / 10) * 0.2; r += ink[0] * f; gg += ink[1] * f; b += ink[2] * f; }
    g.put(i, tmp.cells[k], r * 0.85, gg * 0.85, b * 0.85);
    g.setBg(i, r * 0.72, gg * 0.72, b * 0.72);
  }
  const put = (x: number, y: number, ch: number, fg: readonly number[], bg: readonly number[]) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const i = y * cols + x;
    g.put(i, ch, fg[0], fg[1], fg[2]); g.setBg(i, bg[0], bg[1], bg[2]);
  };
  const text = (x: number, y: number, s: string, fg: readonly number[], bg: readonly number[]) => { for (let k = 0; k < s.length; k++) put(x + k, y, s.charCodeAt(k), fg, bg); };
  // key labels: a glyph where each key's top falls
  for (const [kx, ky, lab, down] of keyCells) {
    const p = project(cam, obj, kx, ky, DECK_H + 0.005, cols, rows);
    if (!p || p[1] >= rows) continue;
    const x = Math.round(p[0]) - (lab.length >> 1), y = Math.floor(p[1]);
    for (let n = 0; n < Math.min(lab.length, 3); n++) {
      const xx = x + n;
      if (xx < 0 || xx >= cols || y < 0 || tmp.depth[y * cols + xx] > 1e8) continue;
      g.put(y * cols + xx, lab.charCodeAt(n), ...(down ? lit([255, 255, 255]) : lit([200, 200, 206])) as [number, number, number]);
    }
  }
  { const p = project(cam, obj, PB[0], PB[1], DECK_H, cols, rows); if (p) power3d = [Math.floor(p[0]) - 1, Math.floor(p[1]) - 1, Math.floor(p[0]) + 2, Math.floor(p[1]) + 2]; }

  // ---- the screen: the terminal where the glass falls, while the player faces it ----
  if (P.lid >= 1) {
    const tl = project(cam, obj, xh - 0.0005, -0.5 * glassW(), zh + GLASS_Z0 + glassH(), cols, rows), br = project(cam, obj, xh - 0.0005, 0.5 * glassW(), zh + GLASS_Z0, cols, rows);
    if (tl && br) {
      const sx = Math.round(tl[0]), sy = Math.round(tl[1]), w = br[0] - tl[0], h = br[1] - tl[1];
      if (Math.abs(w - TERM_W) < 4 && Math.abs(h - TERM_H) < 2) {
        drawScreen(put, text, sx, sy, P, now, lit, light);
        bezelBits((x, y, ch, fg) => { if (x >= 0 && y >= 0 && x < cols && y < rows) g.put(y * cols + x, ch, fg[0], fg[1], fg[2]); },
          (x, y, s, fg) => { for (let k = 0; k < s.length; k++) if (s[k] !== ' ' && x + k >= 0 && x + k < cols && y >= 0 && y < rows) g.put(y * cols + x + k, s.charCodeAt(k), fg[0], fg[1], fg[2]); },
          sx - 2, sy - 2, P, now, lit, [0, 0, 0], computerMakerName(world.city, H.maker).toUpperCase());
      } else {
        // turned away: the glass glows in the screen's colour
        const c: C3 = on ? [ink[0] * 0.18, ink[1] * 0.18, ink[2] * 0.18] : lit([14, 14, 16]);
        for (let y = Math.max(0, Math.round(tl[1])); y < Math.min(rows, Math.round(br[1])); y++)
          for (let x = Math.max(0, Math.round(Math.min(tl[0], br[0]))); x < Math.min(cols, Math.round(Math.max(tl[0], br[0]))); x++) put(x, y, 32, c, c);
      }
    }
    if (P.open && now - P.noticeAt >= 3) { const hh = hintOf(P); text((cols - hh.length - 2) >> 1, 1, ` ${hh} `, [150, 140, 120], [14, 12, 10]); }
  }
  if (P.open && now - P.noticeAt < 3) text((cols - P.notice.length - 2) >> 1, 1, ` ${P.notice} `, [255, 220, 140], [20, 16, 10]);

  function glassW() { return (TERM_W * view.aspect * HINGE_T) / scale; }
  function glassH() { return (TERM_H * HINGE_T) / scale; }
}

/** Where a point of the object (its frame) falls on the grid: [column, row], or null behind the eye. */
function project(v: Cam, o: Obj, x: number, y: number, z: number, cols: number, _rows: number): [number, number] | null {
  const wx = o.x + x * o.c - y * o.s - v.x, wy = o.y + x * o.s + y * o.c - v.y;
  const inv = 1 / (v.plX * v.dirY - v.dirX * v.plY);
  const tY = inv * (-v.plY * wx + v.plX * wy), tX = inv * (v.dirY * wx - v.dirX * wy);
  if (tY < 0.05) return null;
  return [(cols / 2) * (1 + tX / tY), v.hor - ((z - v.eye) * v.scale) / tY];
}
