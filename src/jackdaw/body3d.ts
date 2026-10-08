import { Vox, voxAxes } from '../render/voxels';
import { Img, Paint, type C3 } from '../render/paint2d';
import { VOXP_AT, VOXP_U_FLOATS } from '../render/gpu/voxWatch';
import { HandSway, type HandMotion, type HandView } from '../render/sway';
import { Vec } from './vec';
import { headVec, H, LCD_DAY, LCD_LIT, W, type Buf } from './screen';
import { type Jackdaw, type JKey } from './jackdaw';

/**
 * 15.22: the Jackdaw Mini in little cubes of 2 mm, as its manual lays it (docs/identidade/jackdaw-manual.html,
 * sections 1–3 and 9): the yellow slab of 110 x 50 x 22 mm with its corners in steps and its front edge
 * bevelled, the screen's dark frame with the LCD sunk into it, the darker yellow dish round the cross of
 * graphite keys and OK, the red BACK, the red LED, and on top the rubber cap and the aluminium lever in its
 * housing (leaning left off, right on). The logo and the print are painted over the front (a decal); the LCD
 * is its own picture (the 128 x 64 dots, 7 pixels each with the gap). The model's frame: x right, y down,
 * z out of the front toward the eye; the body's top-left corner at cell (0, TOP).
 */
export const NX = 56, NY = 30, NZ = 13;
/** The body's top row (cells; the lever and the cap stand above it), its thickness (the front at z = FRONT). */
const TOP = 4, FRONT = 10;
/** A point of the body in mm (the manual's front view, from the body's top-left) as model cells. */
const c = (mm: number) => mm / 2;
const cy = (mm: number) => TOP + mm / 2;
/** The LCD's window (cells, exactly the manual's 54 x 27 mm), and the dots' picture: 7 pixels a dot, the last one the gap. */
const LCD = { x0: c(9.7), y0: cy(8.5), w: c(54.2), h: c(27) };
const DOT = 7;
export const LCD_W = W * DOT, LCD_H = H * DOT;
/** The keys (cells): the cross, OK and BACK; their tops one cell proud of what they sit on. */
const KEYS: { k: JKey; x0: number; y0: number; x1: number; y1: number; round?: number }[] = [
  { k: 'up', x0: c(85.2), y0: cy(10.2), x1: c(92.8), y1: cy(17.3) },
  { k: 'down', x0: c(85.2), y0: cy(26.2), x1: c(92.8), y1: cy(33.4) },
  { k: 'left', x0: c(77.2), y0: cy(18.2), x1: c(84.4), y1: cy(25.8) },
  { k: 'right', x0: c(93.7), y0: cy(18.2), x1: c(100.9), y1: cy(25.8) },
  { k: 'ok', x0: c(89 - 3.6), y0: cy(21.8 - 3.6), x1: c(89 + 3.6), y1: cy(21.8 + 3.6), round: c(3.6) },
  { k: 'back', x0: c(102 - 3.2), y0: cy(40.6 - 3.2), x1: c(102 + 3.2), y1: cy(40.6 + 3.2), round: c(3.2) },
];
const DISH = { x: c(89), y: cy(21.8), r: c(14.6) };
/** Palette indices. */
const enum M { Body = 1, Edge, Dish, Frame, Lcd, Key, Ok, Back, Led, LedOff, Cap, Housing, Lever }

const inBody = (x: number, y: number, inset = 0) => {
  const r = 3 - inset, x0 = inset, y0 = TOP + inset, x1 = 55 - inset, y1 = TOP + 25 - inset;
  if (x < x0 || y < y0 || x >= x1 || y >= y1) return false;
  const qx = Math.min(Math.max(x, x0 + r), x1 - r), qy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - qx) ** 2 + (y - qy) ** 2 <= r * r;
};
const onKey = (K: (typeof KEYS)[number], x: number, y: number) => K.round ? (x - (K.x0 + K.x1) / 2) ** 2 + (y - (K.y0 + K.y1) / 2) ** 2 <= K.round ** 2 : x >= K.x0 && x < K.x1 && y >= K.y0 && y < K.y1;

/** The model; `down` the keys pressed (they sink a cell), `on` where the lever leans, `led` lit. */
function model(down: (k: JKey) => boolean, on: boolean, led: boolean): Vox {
  const V = new Vox(NX, NY, NZ);
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const mx = x + 0.5, my = y + 0.5;
    if (!inBody(mx, my)) continue;
    const edge = !inBody(mx, my, 1), dish = (mx - DISH.x) ** 2 + (my - DISH.y) ** 2 <= DISH.r ** 2;
    const frame = mx >= c(5.1) && mx < c(68.5) && my >= cy(4.2) && my < cy(39.7), lcd = mx >= LCD.x0 && mx < LCD.x0 + LCD.w && my >= LCD.y0 && my < LCD.y0 + LCD.h;
    const top = edge ? FRONT - 1 : dish || lcd ? FRONT - 1 : FRONT;
    for (let z = 0; z < top; z++) V.set(x, y, z, edge ? M.Edge : z === top - 1 ? (lcd ? M.Lcd : frame ? M.Frame : dish ? M.Dish : M.Body) : M.Body);
    // the LED, beside the screen's frame
    if (Math.abs(mx - c(72.3)) < 0.6 && Math.abs(my - cy(6.3)) < 0.6) V.set(x, y, FRONT - 1, led ? M.Led : M.LedOff);
    // the keys: on the dish's floor (the cross and OK) or the body (BACK), one cell proud; pressed, flush
    for (const K of KEYS) if (onKey(K, mx, my)) {
      const base = K.k === 'back' ? FRONT : FRONT - 1, h = down(K.k) ? 0 : 1, m = K.k === 'back' ? M.Back : K.k === 'ok' ? M.Ok : M.Key;
      for (let z = base - 1; z < base + h; z++) V.set(x, y, z, m);
    }
  }
  // on top: the rubber cap, and the lever's housing with the lever leaning left (off) or right (on)
  for (let x = Math.round(c(12.7)); x < Math.round(c(46.5)); x++) for (let z = 3; z < 8; z++) { V.set(x, TOP - 1, z, M.Cap); if (z > 3 && z < 7 && x > Math.round(c(12.7)) && x < Math.round(c(46.5)) - 1) V.set(x, TOP - 2, z, M.Cap); }
  for (let x = Math.round(c(91.4)); x < Math.round(c(101.1)); x++) for (let z = 3; z < 8; z++) V.set(x, TOP - 1, z, M.Housing);
  const lx = Math.round(c(96)), lean = on ? 1 : -1;
  for (let j = 0; j < 3; j++) for (let z = 4; z < 7; z++) V.set(lx + (j === 2 ? lean : 0), TOP - 2 - j, z, M.Lever);
  return V;
}

/** The front's print (8 pixels a cell): the logo (the head, JACKDAW, MINI in its box) under the screen, JKD-M · REV.C, the keys' arrows. */
function paintFace(): Img {
  const k = 8, I = new Img(NX * k, NY * k), P = new Paint(I), INK: C3 = [0x1d, 0x1e, 0x20], ARROW: C3 = [0x7d, 0x81, 0x88];
  const mm = (v: number) => v * (k / 2), Y = (v: number) => (TOP + v / 2) * k;
  // the logo as the manual's front lays it (42 mm from x 5.5, y 40.6): the head 5.6 mm tall (a stamp: its cuts the
  // body's color), JACKDAW from 12.6 to 40.8 mm, MINI in its box from 41.6 to 47.6 mm
  const V = new Vec(I.w, I.h);
  headVec(V, mm(5.8), Y(41.2), mm(5.6) / 40);
  for (let i = 0; i < V.g.length; i++) if (V.g[i] < 128) P.dot(i % I.w, (i / I.w) | 0, INK);
  const base = Y(46.1);
  if (typeof OffscreenCanvas !== 'undefined') {
    const cv = new OffscreenCanvas(I.w, I.h), g = cv.getContext('2d')!, ink = () => {
      const d = g.getImageData(0, 0, I.w, I.h).data;
      for (let i = 0; i < I.w * I.h; i++) if (d[i * 4 + 3] > 110) P.dot(i % I.w, (i / I.w) | 0, INK);
      g.clearRect(0, 0, I.w, I.h);
    };
    // the word sized to its 28.2 mm (the heavy wide face, not stretched)
    g.fillStyle = '#fff'; g.font = '900 100px "Arial Black", Archivo, "Segoe UI", sans-serif';
    const f = (100 * mm(28.2)) / g.measureText('JACKDAW').width;
    g.font = `900 ${f.toFixed(1)}px "Arial Black", Archivo, "Segoe UI", sans-serif`; g.fillText('JACKDAW', mm(12.6), base); ink();
    P.rrect(mm(41.6), Y(42.6), mm(6), mm(3), 3, INK); P.rrect(mm(41.6) + 2, Y(42.6) + 2, mm(6) - 4, mm(3) - 4, 2, [0xff, 0xd0, 0x2e]);
    g.font = '800 100px "Arial Black", Archivo, sans-serif';
    const fm = (100 * mm(4.2)) / g.measureText('MINI').width;
    g.font = `800 ${fm.toFixed(1)}px "Arial Black", Archivo, sans-serif`; g.textAlign = 'center'; g.fillText('MINI', mm(44.6), Y(44.6) + fm * 0.36); ink();
    // the model's mark, small, right-aligned under the screen's frame
    g.textAlign = 'right'; g.font = `400 ${mm(1.6).toFixed(1)}px "IBM Plex Mono", monospace`; g.fillText('JKD-M · REV.C', mm(67.7), Y(44.4)); 
    const d = g.getImageData(0, 0, I.w, I.h).data;
    for (let i = 0; i < I.w * I.h; i++) if (d[i * 4 + 3] > 90) P.dot(i % I.w, (i / I.w) | 0, [60, 50, 14], d[i * 4 + 3] / 255 * 0.6);
  } else { P.text(mm(12.6), base - 7, 'JACKDAW MINI', 1, INK); P.text(mm(67.7) - Paint.textW('JKD-M REV.C', 1), Y(43), 'JKD-M REV.C', 1, [70, 60, 20]); }
  // the arrows in relief on the cross (as print here), BACK's curved arrow
  const tri = (cx: number, cy2: number, dx: number, dy: number) => { const a = mm(1.5); P.poly([cx + dx * a, cy2 + dy * a, cx - dy * a - dx * a * 0.6, cy2 + dx * a - dy * a * 0.6, cx + dy * a - dx * a * 0.6, cy2 - dx * a - dy * a * 0.6], ARROW); };
  tri(mm(89), Y(13.2), 0, -1); tri(mm(89), Y(30.2), 0, 1); tri(mm(80.4), Y(22), -1, 0); tri(mm(97.4), Y(22), 1, 0);
  P.poly([mm(100.4), Y(40.6), mm(101.7), Y(39.5), mm(101.7), Y(40.1), mm(103.4), Y(40.1), mm(103.4), Y(41.1), mm(101.7), Y(41.1), mm(101.7), Y(41.7)], [0xf6, 0xd8, 0xd0]);
  return I;
}

/** The dots into the LCD's picture: each dot 6 x 6 pixels and a gap, lit or a ghost, on the paper (the backlight's green when lit). */
export function paintLcd(I: Img, b: Buf, lit: boolean) {
  const pal = lit ? LCD_LIT : LCD_DAY, p = I.px;
  for (let y = 0; y < LCD_H; y++) for (let x = 0; x < LCD_W; x++) {
    const gap = x % DOT === DOT - 1 || y % DOT === DOT - 1, on = b.p[((y / DOT) | 0) * W + ((x / DOT) | 0)];
    const col = gap ? pal.bg : on ? pal.on : pal.ghost, o = (y * LCD_W + x) * 4;
    p[o] = col[0]; p[o + 1] = col[1]; p[o + 2] = col[2]; p[o + 3] = 255;
  }
}

/** What the GPU needs this frame (the same pass as the watch's, render/gpu/voxWatch.ts with the prefix j). */
export interface JackGpu { vox: Uint32Array; voxVer: number; face: Img; faceVer: number; lcd: Img; lcdVer: number; uni: Float32Array }
export const JACK_GPU: JackGpu = { vox: new Uint32Array(Math.ceil((NX * NY * NZ) / 4)), voxVer: 0, face: new Img(1, 1), faceVer: 0, lcd: new Img(LCD_W, LCD_H), lcdVer: 0, uni: new Float32Array(VOXP_U_FLOATS) };
let builtKey = '';

/** Its pose in the hand: the top toward the eye (the lever and the cap show), turned a little. */
const YAW = -0.1, PITCH = 0.24;
const POSE = { yaw: YAW, pitch: PITCH };

/**
 * The body for this frame into JACK_GPU: its middle on the monitor (cx, cy, pixels), k pixels a cell, the
 * scene's light, the backlight lit, the keys down, the lever on, the LED lit, the hand's motion. The LCD's
 * picture is painted by the caller (paintLcd) into JACK_GPU.lcd, bumping lcdVer.
 */
export function jackGpu(cx: number, cy2: number, k: number, light: ArrayLike<number>, lit: boolean, down: (b: JKey) => boolean, on: boolean, led: boolean, mo: HandMotion): JackGpu {
  const B = JACK_GPU, U = B.uni;
  const key = `${KEYS.filter((K) => down(K.k)).map((K) => K.k).join()}|${on}|${led}`;
  if (key !== builtKey) { builtKey = key; new Uint8Array(B.vox.buffer).set(model(down, on, led).cells); B.voxVer++; }
  if (!B.faceVer) { B.face = paintFace(); B.faceVer++; }
  POSE.yaw = YAW + mo.tilt[0]; POSE.pitch = PITCH + mo.tilt[1];
  const [R, D, dir] = voxAxes(POSE.yaw, POSE.pitch), m = [NX / 2, NY / 2, NZ / 2], far = NX + NY + NZ;
  const eye = [0, 1, 2].map((i) => m[i] - (R[i] * cx + D[i] * cy2) / k - dir[i] * far);
  U.set([cx - NX * k * 0.6, cy2 - NY * k * 0.75, cx + NX * k * 0.6, cy2 + NY * k * 0.75], VOXP_AT.rect);
  U.set([eye[0], eye[1], eye[2], NX, dir[0], dir[1], dir[2], NY, R[0] / k, R[1] / k, R[2] / k, NZ, D[0] / k, D[1] / k, D[2] / k, 0], VOXP_AT.eye);
  // the light from above and a little behind the hand; the LCD reads by it below the knee as the watch's does
  U.set([-0.3 + mo.lat * 0.5, -0.7, 0.65, 0, light[0], light[1], light[2], lit ? 1 : 0, LCD.x0, LCD.y0, LCD.w, LCD.h, 0.8, 1.15, 0.6 + mo.lat * 0.4 - mo.tilt[1] * 9 + mo.tilt[0] * 5, mo.str,
    mo.glint[0], mo.glint[1], mo.glint[2], 0, 0, TOP, 55, 25, 0xc4, 0xdc, 0x62, 3], VOXP_AT.ldir);
  const pal = (i: number, col: C3, gloss: number, flags: number, mul = 1) => U.set([col[0], col[1], col[2], gloss, flags, 0, 0, mul], VOXP_AT.pal + i * 8);
  const SIG: C3 = [0xff, 0xd0, 0x2e];
  // matte plastic (a weak wide sheen), its print; the dish a darker yellow; the keys graphite rubber, OK lighter; BACK glossy red
  pal(M.Body, SIG, 0.12, 8);
  pal(M.Edge, [0xe6, 0xb8, 0x22], 0.12, 0);
  pal(M.Dish, [0xc4, 0x9a, 0x10], 0.1, 8);
  pal(M.Frame, [0x15, 0x16, 0x18], 0.3, 0);
  pal(M.Lcd, [0xaa, 0xb8, 0x6a], 0, 4);
  const kd = (b: JKey) => (down(b) ? 0.75 : 1);
  pal(M.Key, [0x33, 0x36, 0x3b], 0.08, 8);
  pal(M.Ok, [0x3e, 0x42, 0x47], 0.08, 8, kd('ok'));
  pal(M.Back, [0xb8, 0x32, 0x1f], 0.5, 8, kd('back'));
  pal(M.Led, [0xff, 0x5a, 0x36], 0, 2);
  pal(M.LedOff, [0x6a, 0x22, 0x18], 0.4, 0);
  pal(M.Cap, [0x33, 0x36, 0x3b], 0, 0);
  pal(M.Housing, [0x1a, 0x1b, 0x1d], 0.2, 0);
  pal(M.Lever, [0xc6, 0xc9, 0xce], 0.6, 1);
  return B;
}

/** The hand's sway and the arm's swing (render/sway.ts); the LCD last painted (the screen's version, lit). */
const SWAY = new HandSway();
let lcdFor = '';
/** A key shows pressed this long after it was (s). */
const PRESS_S = 0.12;
/**
 * The Jackdaw for this frame (15.22): held up in the middle of the view's bottom, about 60 % of its width,
 * rising from below as it comes out (the manual's "two thirds"); its LCD painted when the screen changed, the
 * LED blinking while it is on (the manual's 1.6 s). `px`: the interface's origin and cell (pixels), `cols` and
 * `rows` the grid's size. Null when it is in the pocket.
 */
export function drawJack(J: Jackdaw, now: number, light: ArrayLike<number>, px: readonly number[], cols: number, rows: number, view?: HandView): JackGpu | null {
  if (J.raise < 0.01) { SWAY.reset(); return null; }
  const e = 1 - (1 - J.raise) ** 3, [ox, oy, cw, ch] = px, wide = cols * cw, k = (wide * 0.6) / NX;
  const mo = SWAY.step(now, view);
  const cx = ox + wide * 0.5, cy2 = oy + rows * ch + NY * k * 0.5 - NY * k * 0.82 * e + SWAY.lift * k * 1.2;
  const lit = J.lit, key = `${J.ver}|${lit}`;
  if (key !== lcdFor) { lcdFor = key; paintLcd(JACK_GPU.lcd, J.screen, lit); JACK_GPU.lcdVer++; }
  const L = [Math.max(0.03, light[0]), Math.max(0.03, light[1]), Math.max(0.03, light[2])];
  return jackGpu(cx, cy2, k, L, lit, (b) => now - (J.pressed.get(b) ?? -9) < PRESS_S, J.on, J.on && now % 1.6 < 0.96, mo);
}
