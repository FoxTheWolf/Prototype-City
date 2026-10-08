import { CharGrid } from '../render/grid';
import { type World } from '../sim/world';
import { drawScreen, hintOf, type C3 } from './draw';
import { type Laptop } from './laptop';
import { businessName, computerMakerName } from '../locale/names';
import { EYE } from '../render/eye';
import { CELL_MM, GLASS, KEY_TOP, LID_NZ, NX, NY, laptopGpu, type LapCam, type LapGpu } from './body3d';
import SONGS from '../locale/music.en.json';

/**
 * The notebook's 3D look: its body in little cubes (laptop/body3d.ts, drawn on the GPU by
 * render/gpu/voxLap.ts, 15.20b) set down in front of the player where they sat, seen from the world's
 * own true 3D camera (turned by the pitch, as render/gpu/shader.ts's cam3d), so it takes the scene's
 * light and stays put while the player looks around (right mouse; let go, the view comes back to it).
 * It sits close: the screen fills most of the view and the keyboard is below it, seen by looking down.
 * The lid opens tilted back until the glass faces the eye squarely (as one sets a screen), so the
 * screen's picture is laid pixel for pixel where the glass falls: the system's console (160 x 50) or the
 * firmware's text mode (80 x 25). From aside, it is laid onto the glass in perspective.
 */
/** Metres: a cube; the deck's width and depth (the manual's 310 x 225 mm), the keys' top. */
const C = CELL_MM / 1000, W = NX * C, DD = NY * C, ZH = KEY_TOP * C;
/** The glass's width (the lid model's: 286 mm). */
const GW = (GLASS.x1 - GLASS.x0) / 1000;
const VFOV = Math.PI / 3;
/** The pitch the screen is looked at by (rad, down): the lid opens until its glass faces that view (about 114 degrees). */
const PITCH0 = -0.42;
/** What the GPU draws of the body this frame (null when nothing). */
export let lapGpu: LapGpu | null = null;

let anchor = 0, wasOpen = false;
const L3 = new Float32Array(3);
/** The glint on the screen, eased over time (as on the phone, see phone/draw.ts; stronger here). */
const GL = { lat: 0, str: 0, r: 1, g: 1, b: 1, back: 0, at: 0, mean: [0, 0, 0] as C3 };
/** The view's yaw the notebook was set down facing, and the pitch that centres its screen: where the view comes back to. */
export const laptopAnchor = () => anchor;
export const laptopPitch = () => PITCH0;
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

type V3 = [number, number, number];
/** The lid's point (lx, ly, lz: its cells) in the object's frame (+x away from the player, +y right, z up from the desk), open by the angle a. */
function lidAt(a: number, lx: number, ly: number, lz: number): V3 {
  // it turns on the hinge (at the deck's back, at the keys' top): u along it from its top edge to the hinge, n out of its inside
  const ux = Math.cos(a), uz = -Math.sin(a), nx = -Math.sin(a), nz = -Math.cos(a), xh = DD / 2;
  return [xh + (ux * (ly - NY) + nx * (lz - LID_NZ)) * C, lx * C - W / 2, ZH + (uz * (ly - NY) + nz * (lz - LID_NZ)) * C];
}

/** term: the screen layer's characters, filled here (its size: the console's or the text mode's). */
export function drawLaptop3d(g: CharGrid, term: CharGrid, P: Laptop, world: World, now: number, light: Float32Array, glint: Float32Array, view: View3d) {
  screenAt = null; glassBox = null; lapGpu = null;
  if (P.open && !wasOpen) anchor = view.yaw;
  wasOpen = P.open;
  if (P.raise < 0.01) return;
  const S = P.shell, rows = g.rows, cols = g.cols, scale = rows / 2 / Math.tan(VFOV / 2), plane = ((cols / 2) * view.aspect) / scale;
  const xh = DD / 2, HALF_W = W / 2;
  // the glass's middle and corners (lid cells)
  const gz = LID_NZ - 1, gx0 = GLASS.x0 / CELL_MM, gx1 = GLASS.x1 / CELL_MM, gy0 = GLASS.y0 / CELL_MM, gy1 = GLASS.y1 / CELL_MM;
  // the glass a real screen's width, as near as it must be to cover the screen layer (its depth along the view)
  const T = (GW * scale) / (view.aspect * view.termW);
  // where it rests and how high the eye is over it: the lid open square to the view at PITCH0, the glass's middle
  // at the depth T along it and a little above the view's middle (X: the object's middle ahead of the eye)
  const aOpen = Math.PI / 2 - PITCH0, lift = Math.atan((rows * 0.03) / scale), G = lidAt(aOpen, (gx0 + gx1) / 2, (gy0 + gy1) / 2, gz);
  const toG = T / Math.cos(lift), X = Math.cos(PITCH0 + lift) * toG - G[0], DESK = G[2] - Math.sin(PITCH0 + lift) * toG;
  const a = P.lid * aOpen;
  const off = view.yaw - anchor, dirX = Math.cos(off), dirY = Math.sin(off);
  // the object comes up from below as it is taken out
  const ease = 1 - (1 - P.raise) ** 3, eye = DESK + (1 - ease) * 0.3;
  // the world's camera: forward, right, up (as the GPU world's cam3d)
  const cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const fw: V3 = [dirX * cp, dirY * cp, sp], rt: V3 = [-dirY, dirX, 0], up: V3 = [-dirX * sp, -dirY * sp, cp];
  /** Where a point of the object (its frame) falls on the interface's grid: [column, row], or null behind the eye. */
  const project = (p: V3): [number, number] | null => {
    const w = [X + p[0], p[1], p[2] - eye], f = w[0] * fw[0] + w[1] * fw[1] + w[2] * fw[2];
    if (f < 0.05) return null;
    return [(cols / 2) * (1 + (w[0] * rt[0] + w[1] * rt[1]) / (f * plane)), rows / 2 - ((w[0] * up[0] + w[1] * up[1] + w[2] * up[2]) / f) * scale];
  };
  L3[0] = Math.min(1.5, 0.3 + light[0]); L3[1] = Math.min(1.5, 0.3 + light[1]); L3[2] = Math.min(1.5, 0.3 + light[2]);
  const lit = (c: readonly number[], k = 1): C3 => [c[0] * L3[0] * k, c[1] * L3[1] * k, c[2] * L3[2] * k];
  const on = S.state !== 'off' && P.pc.bootAt >= 0 && P.lid >= 1;

  // ---- the screen's place: faced squarely, the screen layer goes over the glass ----
  const tl = P.lid >= 1 ? project(lidAt(a, gx0, gy0, gz)) : null, br = P.lid >= 1 ? project(lidAt(a, gx1, gy1, gz)) : null;
  if (tl && br) {
    const tr = project(lidAt(a, gx1, gy0, gz)), bl = project(lidAt(a, gx0, gy1, gz));
    if (tr && bl) glassBox = [tl[0], tl[1], tr[0], tr[1], br[0], br[1], bl[0], bl[1]];
  }
  const square = !!glassBox && view.still && Math.abs(br![0] - tl![0] - view.termW) < 1.5 && Math.abs(br![1] - tl![1] - view.termH) < 1
    && Math.abs(glassBox[2] - glassBox[4]) < 0.5 && Math.abs(glassBox[1] - glassBox[3]) < 0.5;
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
  // the ray through monitor pixel (px, py), in the object's frame
  const ray = (px: number, py: number): V3 => {
    const h = ((2 * (px - ox)) / (cw * cols) - 1) * plane, v = (rows / 2 - (py - oy) / ch) / scale;
    return [fw[0] + rt[0] * h + up[0] * v, fw[1] + rt[1] * h + up[1] * v, fw[2] + rt[2] * h + up[2] * v];
  };
  const r0 = ray(0, 0), r1 = ray(1, 0), r2 = ray(0, 1), RX = r1.map((v, k) => v - r0[k]), DY = r2.map((v, k) => v - r0[k]);
  // the eye in the object's frame; the light from above, a little from behind the player and from the glint's side
  const E: V3 = [-X, 0, eye], Lo: V3 = [-0.35, GL.lat * 0.5, 1];
  // a model laid as the deck (its x to the right, its y toward the player, z up) with its cell (0, 0, 0) at the object's point O
  const flat = (O: V3): LapCam => {
    const d = (v: readonly number[]) => [v[1] / C, -v[0] / C, v[2] / C];
    return { eye: [(E[1] - O[1]) / C, (O[0] - E[0]) / C, (E[2] - O[2]) / C], F: d(r0), R: d(RX), D: d(DY), light: d(Lo) };
  };
  const ux = Math.cos(a), uz = -Math.sin(a), nx = -Math.sin(a), nz = -Math.cos(a);
  const ld = (v: readonly number[]) => [v[1] / C, (v[0] * ux + v[2] * uz) / C, (v[0] * nx + v[2] * nz) / C];
  const lid: LapCam = {
    eye: [(E[1] + HALF_W) / C, NY + ((E[0] - xh) * ux + (E[2] - ZH) * uz) / C, LID_NZ + ((E[0] - xh) * nx + (E[2] - ZH) * nz) / C],
    F: ld(r0), R: ld(RX), D: ld(DY), light: ld(Lo),
  };
  // the gear fitted to it (13.6): the USB Wi-Fi stick in the right side's port, the extended battery behind the hinge; each slides in the first time it is seen
  for (const id of pending) if (P.raise > 0.9) { plugAt[id] = now; pending.delete(id); }
  const slid = (id: string) => { const k = Math.max(0, Math.min(1, (now - plugAt[id]) / 0.7)); return 1 - (1 - k) ** 3; };
  const ant = world.gear.antenna ? flat([0.012, HALF_W - 0.004 + (1 - slid('antenna')) * 0.06, 0]) : null;
  const bat = world.gear.battery ? flat([xh + 0.03 + (1 - slid('battery')) * 0.08, -0.124, 0]) : null;
  // where on the monitor: the box round all of it (the whole view if a corner is behind the eye)
  let rect = [0, 0, 1e5, 1e5];
  {
    let c0 = Infinity, c1 = -Infinity, w0 = Infinity, w1 = -Infinity, behind = false;
    for (const bx of [-xh, xh + 0.12]) for (const by of [-HALF_W - 0.01, HALF_W + 0.1]) for (const bz of [0, Math.max(ZH + DD + 0.012, ant ? 0.16 : 0)]) {
      const p = project([bx, by, bz]);
      if (!p) { behind = true; continue; }
      c0 = Math.min(c0, p[0]); c1 = Math.max(c1, p[0]); w0 = Math.min(w0, p[1]); w1 = Math.max(w1, p[1]);
    }
    if (!behind) rect = [Math.floor(ox + c0 * cw) - 2, Math.floor(oy + w0 * ch) - 2, Math.ceil(ox + c1 * cw) + 2, Math.ceil(oy + w1 * ch) + 2];
  }
  const pc = P.pc, blink = Math.floor(now * 3) & 1, busy = on && now - P.hddAt < 0.07 + 0.05 * ((now * 37) % 1);
  const shops: string[] = [];
  for (let k = 0; k < Math.min(24, world.city.businesses.length); k++) shops.push(businessName(world.city, k));
  lapGpu = laptopGpu([flat([xh, -HALF_W, 0]), lid, ant, bat], rect, L3, {
    on, lamp: P.lamp && on, disk: busy, radio: on, charging: (pc.plugged && pc.charge < 0.995) || (on && pc.charge < 0.1 && !!blink),
    usb: on && !!blink, ink: GL.mean, down: (code) => now - (P.pressed.get(code) ?? -9) < 0.12,
    maker: computerMakerName(world.city, P.pc.hw.maker), seed: world.seed, bands: Object.values(SONGS).map((s) => s.band), shops,
  });

  const put = (x: number, y: number, chr: number, fg: readonly number[], bg: readonly number[]) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const i = y * cols + x;
    g.put(i, chr, fg[0], fg[1], fg[2]); g.setBg(i, bg[0], bg[1], bg[2]);
  };
  const text = (x: number, y: number, s: string, fg: readonly number[], bg: readonly number[]) => { for (let k = 0; k < s.length; k++) put(x + k, y, s.charCodeAt(k), fg, bg); };
  if (square) screenAt = [tl![0], tl![1]];
  if (P.open && now - P.noticeAt < 3) text((cols - P.notice.length - 2) >> 1, 1, ` ${P.notice} `, [255, 220, 140], [20, 16, 10]);
  else if (P.open && P.lid >= 1) { const hh = hintOf(P); text((cols - hh.length - 2) >> 1, 1, ` ${hh} `, [150, 140, 120], [14, 12, 10]); }
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
