import { CharGrid } from '../render/grid';
import { drawObjects, Mat, part, Shape, type Cam, type Obj, type Part } from '../render/objects';
import { type World } from '../sim/world';
import { drawScreen, hintOf, type C3 } from './draw';
import { type Laptop } from './laptop';
import { businessName, computerMakerName } from '../locale/names';
import { EYE } from '../render/eye';
import { CELL_MM, GLASS, KEY_TOP, LID_NZ, NX, NY, TOP, laptopGpu, type LapCam, type LapGpu } from './body3d';
import SONGS from '../locale/music.en.json';

/**
 * The notebook's 3D look: its body in little cubes (laptop/body3d.ts, drawn on the GPU by
 * render/gpu/voxLap.ts, 15.20b) set down in front of the player where they sat, seen from the real
 * camera, so it takes the scene's light and stays put while the player looks around (right mouse; let
 * go, the view comes back to it). It sits close: the screen fills most of the view and the keyboard is
 * below it, seen by looking down. Faced squarely, the screen's picture is laid pixel for pixel where the
 * lid's glass falls: the system's console (160 x 50) or the firmware's text mode (80 x 25). From aside,
 * it is laid onto the glass in perspective. The screen's light falls on the deck and the keys.
 */
/** Metres: the eye over the desk; a cube; the deck's width and depth (the manual's 310 x 225 mm), the keys' top. */
const DESK = 0.3, C = CELL_MM / 1000, W = NX * C, DD = NY * C, ZH = KEY_TOP * C;
/** The glass's width (the lid model's: 286 mm). */
const GW = (GLASS.x1 - GLASS.x0) / 1000;
const VFOV = Math.PI / 3;
/** What the GPU draws of the body this frame (null when nothing). */
export let lapGpu: LapGpu | null = null;

let anchor = 0, pitch0 = -0.6, wasOpen = false, tmp: CharGrid | null = null, tmp2: CharGrid | null = null;
const L3 = new Float32Array(3);
/** The glint on the screen, eased over time (as on the phone, see phone/draw.ts; stronger here). */
const GL = { lat: 0, str: 0, r: 1, g: 1, b: 1, back: 0, at: 0, mean: [0, 0, 0] as C3 };
/** Where the power button falls on the interface's grid (cells), for a click; null when not shown. */
export let power3d: [number, number, number, number] | null = null;
/** The view's yaw the notebook was set down facing, and the pitch that centres its screen: where the view comes back to. */
export const laptopAnchor = () => anchor;
export const laptopPitch = () => pitch0;
/** Where the screen layer's top-left falls on the interface's grid (cells, fractional) while it is faced squarely; null otherwise. */
export let screenAt: [number, number] | null = null;
/** The glass's corners on the interface's grid (cells: x, y from the top-left, clockwise), faced or from aside, while the lid is open; null otherwise. */
export let glassBox: number[] | null = null;
/** The gear fitted from the bag (13.6) waiting to be seen going in, and when each slid in (seconds). */
const pending = new Set<string>(), plugAt: Record<string, number> = { antenna: -9, battery: -9 };
/** Gear just fitted: it slides into place the next time the notebook comes up. */
export function plugIn(id: 'antenna' | 'battery') { pending.add(id); plugAt[id] = Infinity; }

/** The view; termW and termH: the screen layer's size on the interface's grid (cells, fractional); px: the grid's origin and cell on the monitor (pixels: x, y, w, h). */
export interface View3d { yaw: number; pitch: number; aspect: number; still: boolean; termW: number; termH: number; px: readonly number[] }

/** term: the screen layer's characters, filled here (its size: the console's or the text mode's). */
export function drawLaptop3d(g: CharGrid, term: CharGrid, P: Laptop, world: World, now: number, light: Float32Array, glint: Float32Array, view: View3d) {
  power3d = null; screenAt = null; glassBox = null; lapGpu = null;
  if (P.open && !wasOpen) anchor = view.yaw;
  wasOpen = P.open;
  if (P.raise < 0.01) return;
  const H = P.pc.hw, S = P.shell, BODY = H.body;
  const rows = g.rows, cols = g.cols, scale = rows / 2 / Math.tan(VFOV / 2), plane = ((cols / 2) * view.aspect) / scale;
  // the glass: a real screen's width, as near as it must be to cover the screen layer
  const T = (GW * scale) / (view.aspect * view.termW), xh = DD / 2, x0 = -xh, HALF_W = W / 2;
  // the lid turns on the hinge (at the deck's back, at the keys' top): u along it from its top edge to the hinge, n out of its inside
  const a = (P.lid * Math.PI) / 2, ux = Math.cos(a), uz = -Math.sin(a), nx = -Math.sin(a), nz = -Math.cos(a);
  const lidPt = (lx: number, ly: number, lz: number): [number, number, number] =>
    [xh + (ux * (ly - NY) + nx * (lz - LID_NZ)) * C, lx * C - HALF_W, ZH + (uz * (ly - NY) + nz * (lz - LID_NZ)) * C];
  // the glass's rows standing (open): its foot and top over the desk
  const glass0 = ZH + (NY - GLASS.y1 / CELL_MM) * C, glass1 = ZH + (NY - GLASS.y0 / CELL_MM) * C;
  // the pitch that puts the glass's middle a little above the middle of the view: row = hor + (eye - z) * scale / T
  pitch0 = Math.max(-0.69, Math.atan((rows * 0.47 - (DESK - (glass0 + glass1) / 2) * scale / T - rows / 2) / scale));
  const off = view.yaw - anchor, dirX = Math.cos(off), dirY = Math.sin(off);
  // the object comes up from below as it is taken out
  const ease = 1 - (1 - P.raise) ** 3, eye = DESK + (1 - ease) * 0.3;
  const cam: Cam = { x: 0, y: 0, eye, dirX, dirY, plX: -dirY * plane, plY: dirX * plane, plane, scale, hor: rows / 2 + Math.tan(view.pitch) * scale, far: 500, light: () => L3, mul: true };
  L3[0] = Math.min(1.5, 0.3 + light[0]); L3[1] = Math.min(1.5, 0.3 + light[1]); L3[2] = Math.min(1.5, 0.3 + light[2]);
  const lit = (c: readonly number[], k = 1): C3 => [c[0] * L3[0] * k, c[1] * L3[1] * k, c[2] * L3[2] * k];
  const on = S.state !== 'off' && P.pc.bootAt >= 0 && P.lid >= 1;
  // the glass one cell behind the lid's face: that plane at the distance T
  const obj: Obj = { x: T - xh - C, y: 0, c: 1, s: 0, parts: [], r: Math.hypot(DD, HALF_W), h: ZH + DD + 0.02, seed: 7, z0: 0 };

  // ---- the screen's place: faced squarely, the screen layer goes over the glass ----
  const gz = LID_NZ - 1, gx0 = GLASS.x0 / CELL_MM, gx1 = GLASS.x1 / CELL_MM, gy0 = GLASS.y0 / CELL_MM, gy1 = GLASS.y1 / CELL_MM;
  const pj = (q: [number, number, number]) => project(cam, obj, q[0], q[1], q[2], cols);
  const tl = P.lid >= 1 ? pj(lidPt(gx0, gy0, gz)) : null, br = P.lid >= 1 ? pj(lidPt(gx1, gy1, gz)) : null;
  if (tl && br) {
    const tr = pj(lidPt(gx1, gy0, gz)), bl = pj(lidPt(gx0, gy1, gz));
    if (tr && bl) glassBox = [tl[0], tl[1], tr[0], tr[1], br[0], br[1], bl[0], bl[1]];
  }
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

  // ---- the body, in little cubes on the GPU: each model's camera from the eye's rays ----
  const [ox, oy, cw, ch] = view.px;
  // the ray through monitor pixel (px, py), in the object's frame (as project() sees it)
  const ray = (px: number, py: number) => {
    const camX = (2 * (px - ox)) / (cw * cols) - 1;
    return [dirX + cam.plX * camX, dirY + cam.plY * camX, (cam.hor - (py - oy) / ch) / scale];
  };
  const r0 = ray(0, 0), r1 = ray(1, 0), r2 = ray(0, 1), RX = r1.map((v, k) => v - r0[k]), DY = r2.map((v, k) => v - r0[k]);
  // the eye in the object's frame; the light from above, a little from behind the player and from the glint's side
  const E = [-obj.x, 0, eye], Lo = [-0.35, GL.lat * 0.5, 1];
  const deckDir = (d: number[]) => [d[1] / C, -d[0] / C, d[2] / C];
  const lidDir = (d: number[]) => [d[1] / C, (d[0] * ux + d[2] * uz) / C, (d[0] * nx + d[2] * nz) / C];
  const deck: LapCam = { eye: [(E[1] + HALF_W) / C, (xh - E[0]) / C, E[2] / C], F: deckDir(r0), R: deckDir(RX), D: deckDir(DY), light: deckDir(Lo) };
  const lid: LapCam = {
    eye: [(E[1] + HALF_W) / C, NY + ((E[0] - xh) * ux + (E[2] - ZH) * uz) / C, LID_NZ + ((E[0] - xh) * nx + (E[2] - ZH) * nz) / C],
    F: lidDir(r0), R: lidDir(RX), D: lidDir(DY), light: lidDir(Lo),
  };
  // where on the monitor: the box round both (the whole view if a corner is behind the eye)
  let rect = [0, 0, 1e5, 1e5];
  {
    let c0 = Infinity, c1 = -Infinity, w0 = Infinity, w1 = -Infinity, behind = false;
    for (const bx of [x0, xh + 0.012]) for (const by of [-HALF_W, HALF_W]) for (const bz of [0, ZH + DD + 0.012]) {
      const p = project(cam, obj, bx, by, bz, cols);
      if (!p) { behind = true; continue; }
      c0 = Math.min(c0, p[0]); c1 = Math.max(c1, p[0]); w0 = Math.min(w0, p[1]); w1 = Math.max(w1, p[1]);
    }
    if (!behind) rect = [Math.floor(ox + c0 * cw) - 2, Math.floor(oy + w0 * ch) - 2, Math.ceil(ox + c1 * cw) + 2, Math.ceil(oy + w1 * ch) + 2];
  }
  const pc = P.pc, blink = Math.floor(now * 3) & 1, busy = on && now - P.hddAt < 0.07 + 0.05 * ((now * 37) % 1);
  const shops: string[] = [];
  for (let k = 0; k < Math.min(24, world.city.businesses.length); k++) shops.push(businessName(world.city, k));
  lapGpu = laptopGpu(deck, lid, rect, L3, {
    on, lamp: false, disk: busy, radio: on, charging: (pc.plugged && pc.charge < 0.995) || (on && pc.charge < 0.1 && !!blink), ink: GL.mean,
    down: (code) => now - (P.pressed.get(code) ?? -9) < 0.12,
    maker: computerMakerName(world.city, H.maker), seed: world.seed, bands: Object.values(SONGS).map((s) => s.band), shops,
  });

  // ---- the gear fitted to it (13.6), still boxes in the interface's cells, hidden where the body is nearer ----
  // a USB Wi-Fi stick with its whip in the right side's port, the extended battery standing out behind the
  // hinge; each slides in the first time it is seen
  for (const id of pending) if (P.raise > 0.9) { plugAt[id] = now; pending.delete(id); }
  const slid = (id: string) => { const k = Math.max(0, Math.min(1, (now - plugAt[id]) / 0.7)); return 1 - (1 - k) ** 3; };
  const col = (k: number): [number, number, number] => [BODY[0] * k, BODY[1] * k, BODY[2] * k];
  const gear: Part[] = [];
  if (world.gear.antenna) {
    const o = (1 - slid('antenna')) * 0.06, y0 = HALF_W - 0.004 + o, blinkOn = on && Math.floor(now * 3) % 2 === 0;
    gear.push(part(Shape.Box, -0.012, y0, 0.004, 0.01, y0 + 0.036, 0.013, [28, 28, 32], Mat.Solid, '=', '-', '#'));
    gear.push(part(Shape.Box, -0.004, y0 + 0.008, 0.013, 0.0, y0 + 0.012, 0.0145, blinkOn ? [90, 160, 255] : [50, 60, 80], blinkOn ? Mat.Glow : Mat.Solid, '.', '.', '.'));
    gear.push(part(Shape.Cyl, -0.003, y0 + 0.03, 0.013, 0.003, y0 + 0.036, 0.15, [22, 22, 25], Mat.Solid, '|', 'o', '|'));
  }
  if (world.gear.battery) {
    const o = (1 - slid('battery')) * 0.08;
    gear.push(part(Shape.Box, xh + 0.004 + o, -HALF_W * 0.8, 0, xh + 0.03 + o, HALF_W * 0.8, 0.017, col(0.55), Mat.Solid, '#', '=', '#'));
  }
  if (gear.length) {
    if (!tmp || !tmp2 || tmp.cols !== cols || tmp.rows !== rows) { tmp = new CharGrid(cols, rows); tmp2 = new CharGrid(cols, rows); }
    // the body as plain boxes, only for its depth: the deck, and the lid in strips along its length
    const body: Part[] = [part(Shape.Box, x0, -HALF_W, 0, xh, HALF_W, TOP * C, col(1), Mat.Solid, '#', '.', '#')];
    for (let k = 0; k < 6; k++) {
      const p0 = lidPt(0, (k / 6) * NY, LID_NZ), p1 = lidPt(NX, ((k + 1) / 6) * NY, 0);
      body.push(part(Shape.Box, Math.min(p0[0], p1[0]), -HALF_W, Math.min(p0[2], p1[2]), Math.max(p0[0], p1[0]), HALF_W, Math.max(p0[2], p1[2]), col(1), Mat.Solid, '#', '#', '#'));
    }
    tmp.depth.fill(1e9); tmp2.depth.fill(1e9);
    drawObjects(tmp, [{ ...obj, parts: body }], cam);
    drawObjects(tmp2, [{ ...obj, parts: gear }], cam);
    for (let i = 0; i < cols * rows; i++) {
      if (tmp2.depth[i] > 1e8 || tmp2.depth[i] > tmp.depth[i]) continue;
      const k = i * 4, c = tmp2.cells;
      g.put(i, c[k], c[k + 1] * 0.85, c[k + 2] * 0.85, c[k + 3] * 0.85);
      g.setBg(i, c[k + 1] * 0.72, c[k + 2] * 0.72, c[k + 3] * 0.72);
    }
  }
  const put = (x: number, y: number, chr: number, fg: readonly number[], bg: readonly number[]) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const i = y * cols + x;
    g.put(i, chr, fg[0], fg[1], fg[2]); g.setBg(i, bg[0], bg[1], bg[2]);
  };
  const text = (x: number, y: number, s: string, fg: readonly number[], bg: readonly number[]) => { for (let k = 0; k < s.length; k++) put(x + k, y, s.charCodeAt(k), fg, bg); };
  // the power button (the manual: 275, 9 mm on the deck's top strip), for a click
  { const p = project(cam, obj, xh - 0.009, 0.275 - HALF_W, KEY_TOP * C, cols); if (p) power3d = [Math.floor(p[0]) - 2, Math.floor(p[1]) - 1, Math.floor(p[0]) + 3, Math.floor(p[1]) + 2]; }
  if (square) screenAt = [tl![0], tl![1]];
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
 * screen looks brighter, and the compositor blooms it; under a strong light it looks washed and dimmer),
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
  // the world's eye (its exposure and adaptation): in the dark the screen looks brighter and blooms, by day dimmer
  const gain = Math.min(1.3, 0.55 + 0.65 * Math.min(1, EYE.k / 0.6));
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
  // the screen's mean light: what it casts on the keys (a dark console a little, a white page a lot)
  GL.mean = [ar / (W * H), ag / (W * H), ab / (W * H)];
}
