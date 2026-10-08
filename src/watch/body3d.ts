import { Vox } from '../render/voxels';
import { Img, Paint, type C3 } from '../render/paint2d';
import { WATCH_AT, WATCH_U_FLOATS } from '../render/gpu/voxWatch';
import { voxAxes } from '../render/voxels';

/**
 * 15.21: the wristwatch in little cubes of 1 mm, as its manual draws it (docs/identidade/relogio-manual.html):
 * a case of 46 x 40 mm, brushed steel over black resin, its face dark inside the steel's ring with the
 * buttons' names and the maker printed on it (a decal), the LCD of 32 x 16 mm sunk a millimetre into it,
 * the four buttons on its sides (LIGHT and MODE on the left, START and DISPLAY on the right), the resin strap
 * above and below with its holes. The model's frame: x to the right, y down the arm, z out of the face toward
 * the eye. The LCD is a picture of its own (paintLcd, by watch.ts), 8 pixels a millimetre.
 */
export const NX = 52, NY = 96, NZ = 13;
/** The case (mm in the model): its outline and corner radius; the LCD's window; the buttons. */
const CASE = { x0: 3, y0: 28, x1: 49, y1: 68, r: 8 }, RING = 4, LCD = { x0: 10, y0: 39, w: 32, h: 16 };
export const LCD_PX = 8, LCD_W = LCD.w * LCD_PX, LCD_H = LCD.h * LCD_PX;
export type WBtn = 'light' | 'mode' | 'start' | 'display';
export const BTNS: { b: WBtn; left: boolean; y0: number }[] = [
  { b: 'light', left: true, y0: 34 }, { b: 'mode', left: true, y0: 56 }, { b: 'start', left: false, y0: 34 }, { b: 'display', left: false, y0: 56 },
];
/** Palette indices. */
const enum M { Steel = 1, Chamfer, Face, Resin, Strap, Lcd, Btn0 }

const inCase = (x: number, y: number, inset = 0) => {
  const r = Math.max(1, CASE.r - inset), x0 = CASE.x0 + inset, y0 = CASE.y0 + inset, x1 = CASE.x1 - inset, y1 = CASE.y1 - inset;
  if (x < x0 || y < y0 || x >= x1 || y >= y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};

/** The model; `down`: which buttons are pressed (they sink into the case, one cell proud instead of three). */
function model(down: (b: WBtn) => boolean): Vox {
  const V = new Vox(NX, NY, NZ);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const mx = x + 0.5, my = y + 0.5;
    // the strap, a little of it above the case and down to the view's edge below, ribbed across, with its holes down the lower one
    if (mx >= 15 && mx < 37 && ((my >= CASE.y0 - 7 && my < CASE.y0 + 4) || my >= CASE.y1 - 4)) {
      const hole = my > CASE.y1 + 6 && Math.abs(mx - 26) < 1.2 && Math.round(my - CASE.y1) % 6 === 0, rib = y % 3 === 0 ? 1 : 0;
      if (!hole) for (let z = 1; z < 4 + rib; z++) V.set(x, y, z, M.Strap);
    }
    if (!inCase(mx, my)) continue;
    for (let z = 0; z < 7; z++) V.set(x, y, z, M.Resin);
    if (!inCase(mx, my, RING)) {
      // the steel ring, its outer millimetre a step lower (the bevel)
      const outer = !inCase(mx, my, 1);
      for (let z = 7; z < (outer ? 10 : 11); z++) V.set(x, y, z, outer ? M.Chamfer : M.Steel);
      continue;
    }
    const lcd = mx >= LCD.x0 && mx < LCD.x0 + LCD.w && my >= LCD.y0 && my < LCD.y0 + LCD.h;
    for (let z = 7; z < (lcd ? 9 : 10); z++) V.set(x, y, z, lcd ? M.Lcd : M.Face);
  }
  BTNS.forEach(({ b, left, y0 }, i) => {
    const out = down(b) ? 1 : 3, x0 = left ? CASE.x0 - out : CASE.x1 - 1, x1 = left ? CASE.x0 + 1 : CASE.x1 + out;
    for (let y = y0; y < y0 + 5; y++) for (let x = x0; x < x1; x++) for (let z = 3; z < 7; z++) V.set(x, y, z, M.Btn0 + i);
  });
  return V;
}

/** The face's print: the buttons' names by them, the maker between the top two over the gold rule, WATER RESIST (8 px a mm). */
function paintFace(brand: string): Img {
  const k = LCD_PX, I = new Img(NX * k, NY * k), P = new Paint(I), LAB: C3 = [150, 150, 150];
  const y0 = (CASE.y0 + RING + 1.6) * k, y1 = (LCD.y0 + LCD.h + 1.4) * k, xl = (CASE.x0 + RING + 2.6) * k, xr = (CASE.x1 - RING - 2.6) * k;
  P.text(xl, y0, 'LIGHT', 2, LAB);
  P.text(xr - Paint.textW('START', 2), y0, 'START', 2, LAB);
  P.text(xl, y1, 'MODE', 2, LAB);
  P.text(xr - Paint.textW('DISPLAY', 2), y1, 'DISPLAY', 2, LAB);
  P.text(NX * k / 2 - Paint.textW('WATER RESIST', 2) / 2, y1 + 20, 'WATER RESIST', 2, [120, 120, 120]);
  const b = brand.toUpperCase().slice(0, 12), bw = Paint.textW(b, 2, 4);
  P.text(NX * k / 2 - bw / 2, y0, b, 2, [230, 226, 214], 1, 4);
  // the gold rule, dashed, under the top row
  const gy = (LCD.y0 - 1.3) * k;
  for (let x = xl; x < xr; x += 9) P.rect(x, gy, 6, 3, [170, 140, 70]);
  return I;
}

/** What the GPU needs this frame (render/gpu/voxWatch.ts): the model's cells, the face's print, the LCD's picture, the uniform; each with a version. */
export interface WatchGpu { vox: Uint32Array; voxVer: number; face: Img; faceVer: number; lcd: Img; lcdVer: number; uni: Float32Array }
export const WATCH_GPU: WatchGpu = { vox: new Uint32Array(Math.ceil((NX * NY * NZ) / 4)), voxVer: 0, face: new Img(1, 1), faceVer: 0, lcd: new Img(LCD_W, LCD_H), lcdVer: 0, uni: new Float32Array(WATCH_U_FLOATS) };
let built: { up: Uint8Array; dn: Uint8Array; cols: Map<WBtn, number[]>; sunk: Set<WBtn> } | null = null, faceFor = '';

/** The watch's pose: tilted a little (its lower side shows), as the hand holds it up. */
const YAW = 0.05, PITCH = -0.16;
/** This frame's pose (the rest pose swayed by the view's turn and the arm's swing), for watchProject. */
const POSE = { yaw: YAW, pitch: PITCH };
/** The light glinting off it (as the phone's VoxLight: side, strength, color) and the sway off its pose (yaw, pitch, rad). */
export interface WatchMotion { lat: number; str: number; glint: readonly [number, number, number]; tilt: readonly [number, number] }
/**
 * The body for this frame into WATCH_GPU: its middle on the monitor (cx, cy, pixels), k pixels a millimetre,
 * the scene's light (rgb), the backlight on, the buttons pressed, the maker. The LCD's picture is painted by
 * the caller into WATCH_GPU.lcd (bumping lcdVer when it changed).
 */
export function watchGpu(cx: number, cy: number, k: number, light: ArrayLike<number>, lit: boolean, down: (b: WBtn) => boolean, brand: string,
  mo: WatchMotion = { lat: 0, str: 0, glint: [1, 1, 1], tilt: [0, 0] }): WatchGpu {
  const B = WATCH_GPU, U = B.uni, bytes = new Uint8Array(B.vox.buffer);
  if (!built) {
    const up = model(() => false).cells, dn = model(() => true).cells, cols = new Map<WBtn, number[]>();
    for (let i = 0; i < up.length; i++) {
      const a = up[i] >= M.Btn0 ? up[i] : dn[i] >= M.Btn0 ? dn[i] : 0;
      if (a) { const id = BTNS[a - M.Btn0].b; let l = cols.get(id); if (!l) cols.set(id, (l = [])); l.push(i); }
    }
    built = { up, dn, cols, sunk: new Set() };
    bytes.set(up); B.voxVer++;
  }
  for (const [b, idx] of built.cols) {
    const d = down(b);
    if (d === built.sunk.has(b)) continue;
    if (d) built.sunk.add(b); else built.sunk.delete(b);
    const src = d ? built.dn : built.up;
    for (const i of idx) bytes[i] = src[i];
    B.voxVer++;
  }
  if (faceFor !== brand) { faceFor = brand; B.face = paintFace(brand); B.faceVer++; }
  // an orthographic view of the model's middle at (cx, cy): a pixel is 1 / k cells along the screen's right and down
  POSE.yaw = YAW + mo.tilt[0]; POSE.pitch = PITCH + mo.tilt[1];
  const [R, D, dir] = voxAxes(POSE.yaw, POSE.pitch), m = [NX / 2, NY / 2, NZ / 2], far = NX + NY + NZ;
  const eye = [0, 1, 2].map((i) => m[i] - (R[i] * cx + D[i] * cy) / k - dir[i] * far);
  U.set([cx - NX * k * 0.55, cy - NY * k * 0.55, cx + NX * k * 0.55, cy + NY * k * 0.55], WATCH_AT.rect);
  U.set([eye[0], eye[1], eye[2], NX, dir[0], dir[1], dir[2], NY, R[0] / k, R[1] / k, R[2] / k, NZ, D[0] / k, D[1] / k, D[2] / k, 0], WATCH_AT.eye);
  U.set([-0.55 + mo.lat * 0.5, -0.6, 0.75, 0, light[0], light[1], light[2], lit ? 1 : 0, LCD.x0, LCD.y0, LCD.w, LCD.h, LCD_KNEE, LCD_GAIN, glintAt(mo), mo.str,
    mo.glint[0], mo.glint[1], mo.glint[2], 0], WATCH_AT.ldir);
  const pal = (i: number, col: C3, gloss: number, flags: number, mul = 1) => { U.set([col[0], col[1], col[2], gloss, flags, 0, 0, mul], WATCH_AT.pal + i * 8); };
  pal(M.Steel, [92, 94, 100], 0.6, 1);
  pal(M.Chamfer, [70, 72, 77], 0.5, 1);
  pal(M.Face, [26, 26, 29], 0.1, 8);
  pal(M.Resin, [22, 22, 24], 0.1, 0);
  pal(M.Strap, [24, 24, 26], 0.05, 0);
  pal(M.Lcd, [66, 72, 58], 0, 4);
  BTNS.forEach(({ b }, i) => pal(M.Btn0 + i, [120, 123, 130], 0.5, 1, down(b) ? 0.75 : 1));
  return B;
}
/** Where a point of the model (mm) falls on the monitor, as watchGpu laid it (cx, cy, k as given there). */
export function watchProject(x: number, y: number, z: number, cx: number, cy: number, k: number): [number, number] {
  const [R, D] = voxAxes(POSE.yaw, POSE.pitch), d = [x - NX / 2, y - NY / 2, z - NZ / 2];
  return [cx + k * (d[0] * R[0] + d[1] * R[1] + d[2] * R[2]), cy + k * (d[0] * D[0] + d[1] * D[1] + d[2] * D[2])];
}
/**
 * The unlit LCD only reflects (the manual's section 5): below LCD_KNEE of the scene's light it goes dark
 * faster than the scene (as the light's share of the knee to the power 1.6), so under a street lamp it is
 * dim and in a dark street it is lost: the light (L) is needed. Above it (day, a lit shop) it reads paler than the scene by LCD_GAIN.
 */
const LCD_KNEE = 0.8, LCD_GAIN = 1.3;
/**
 * Where the glint's diagonal band crosses the case (0 its top-left corner .. ~1.5 its bottom-right): on the
 * light's side, and sliding as the watch tilts off its pose (the view's turn, the arm swinging as one runs),
 * as a mirror's highlight does.
 */
const glintAt = (mo: WatchMotion) => 0.75 + mo.lat * 0.45 - mo.tilt[1] * 9 + mo.tilt[0] * 5;
/** The case's middle, its width (mm) and the LCD's window (mm), for the layout. */
export const WATCH_CASE = { cx: (CASE.x0 + CASE.x1) / 2, cy: (CASE.y0 + CASE.y1) / 2, w: CASE.x1 - CASE.x0, h: CASE.y1 - CASE.y0 };
export const WATCH_LCD_MM = LCD;
