import { castVox, voxAxes, Vox, type VoxLight, type VoxMat } from '../render/voxels';
import { BODY_U_FLOATS } from '../render/gpu/voxBody';
import { BEZEL_MM, BODY_MM, CORNER_MM, HOME_MM, KEY_LEGEND, KEYS_MM, RAIL_MM, SCREEN_MM, type Case, type KeyMm, type Shell } from './shells';
import { hash3 } from '../core/rng';
import { type C3 } from './lcd';
import { type Key } from './phone';
import { FAMILIES, paintBrandText } from '../render/brands';
import { Img, Paint, type Px } from '../render/paint2d';

/**
 * 15.19b: the phone's body in little cubes of 1 mm, as the phone's manual v2 draws it
 * (docs/identidade/celular-manual.html: the slider, its colors and materials, its keys; section 9 for the
 * cubes). Two models of the same size, cast alike: the upper plate (the look's color and material, the
 * chrome edge, the earpiece, the touch screen's black surround, call, the round home button and end, the
 * music keys on the top edge, the volume on the right side) and the graphite lower plate with the keypad,
 * drawn shifted up under the upper as the rail shuts. The screen itself is not cubes: its picture goes over
 * the glass. Keys stand a millimetre proud and sink when pressed. A case goes round both plates, 2.5 mm out.
 *
 * Drawn by the GPU in square pixels at the monitor's resolution (the manual's section 9: the interface's HD
 * layer, 3 x 3 pixels a cell, blurred the keys), each pixel a ray through the cubes (render/gpu/voxBody.ts),
 * with the keypad's legends and the maker's name from a decal; here only the models, the palette and the view.
 */
/** The plates' thickness (mm): the lower 8, the upper 7 over it; a key stands 1 mm proud. */
const LOW = 8, UP = 7, NZ = LOW + UP + 1;
/** Room round the body in the model for the case and the music keys (mm), and the model's size. */
const OFF = 3, NX = BODY_MM[0] + 2 * OFF + 1, NY = RAIL_MM + BODY_MM[1] + 2 * OFF;
/** A slight tilt, its top toward the eye: the top edge and the keys' tops show, as held below the eye. */
const PITCH = 0.16, YAW = -0.05;

/** Palette indices. */
const enum P { Plate = 1, Low, LowGrain, Rim, RimHome, RimVol, Bezel, Glass, Slot, Lens, Ice, Send, End, Case, CaseAlt, Glitter, Jack }
const KEY0 = 32;
/** The glass's palette index: the compositor lays the screen's picture where the body's ray meets it (so it leans with the body). */
export const GLASS_MAT: number = P.Glass;
/** The manual's colors (section 4). */
const GRAPHITE: C3 = [43, 45, 49], CAP: C3 = [28, 30, 34], FRONT_CAP: C3 = [22, 24, 28], ICE: C3 = [143, 211, 255], ICE_OFF: C3 = [59, 111, 143];
const CALL: C3 = [47, 174, 90], END: C3 = [210, 58, 46], BEZEL: C3 = [5, 6, 7], HOME: C3 = [30, 32, 37];

/** Whether (x, y) (mm) lies in a box with corners rounded: r, or [top-left, top-right, bottom-right, bottom-left]. */
function inRound(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number | readonly number[]): boolean {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const left = x < (x0 + x1) / 2, top = y < (y0 + y1) / 2, R = typeof r === 'number' ? r : r[top ? (left ? 0 : 1) : left ? 3 : 2];
  if (R <= 0) return true;
  const cx = left ? Math.max(x, x0 + R) : Math.min(x, x1 - R), cy = top ? Math.max(y, y0 + R) : Math.min(y, y1 - R);
  return (x - cx) ** 2 + (y - cy) ** 2 <= R * R;
}
/** A voxel's centre in the phone's millimetres (the model is shifted by OFF for the case). */
const mm = (v: number) => v - OFF + 0.5;

/** Whether the phone's point (x, y) (mm, the open phone's) is on a key's outline. */
function onKey(K: KeyMm, x: number, y: number): boolean {
  const [x0, y0, x1, y1] = K.box;
  if (K.shape === 'box') return inRound(x, y, x0, y0, x1, y1, K.r ?? 1);
  if (K.shape === 'top') return inRound(x, y, x0, y0, x1, y1 + 1, [0.8, 0.8, 0, 0]);
  if (K.shape === 'send') return inRound(x, y, x0, y0, x1, y1, [1.5, 1.5, 1.5, 6]);
  if (K.shape === 'end') return inRound(x, y, x0, y0, x1, y1, [1.5, 1.5, 6, 1.5]);
  return Math.hypot(x - HOME_MM.x, y - HOME_MM.y) <= HOME_MM.disc;
}

/** The handsets on the call and end keys ('#' a cube, 1 mm): the receiver lifted, tilted; and laid down, an arch (the manual's, small). */
const HANDSET: Record<string, string[]> = {
  send: ['##...', '#....', '#....', '.#.##', '..##.'],
  end: ['.####.', '##..##', '#....#'],
};

/**
 * The two plates without their keys (stamped on per frame, up or sunk), as two models of the same size: the
 * lower one as it lies with the rail open (RAIL_MM down), the upper over it.
 */
function base(K: Case | null): [Vox, Vox] {
  const lo = new Vox(NX, NY, NZ), V = new Vox(NX, NY, NZ), [W, H] = BODY_MM, R = CORNER_MM, Hm = HOME_MM;
  const top = LOW + UP - 1;
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const X = mm(x), Y = mm(y);
    // the lower plate: graphite, matte and grainy
    if (inRound(X, Y, 0, RAIL_MM, W, RAIL_MM + H, R)) for (let z = 0; z < LOW; z++) lo.set(x, y, z, hash3(x, y, z) < 0.3 ? P.LowGrain : P.Low);
    if (!inRound(X, Y, 0, 0, W, H, R)) continue;
    // the upper plate, its front edge chrome (the manual's thin ring round it)
    for (let z = LOW; z < top; z++) V.set(x, y, z, P.Plate);
    V.set(x, y, top, inRound(X, Y, 0.9, 0.9, W - 0.9, H - 0.9, R - 0.9) ? P.Plate : P.Rim);
    // the earpiece (a slot) and the front camera, above the screen
    if (X >= 18 && X < 33 && Y >= 2.5 && Y < 4) { V.set(x, y, top, 0); V.set(x, y, top - 1, P.Slot); }
    if (Math.hypot(X - 39, Y - 3.5) < 0.9) { V.set(x, y, top, 0); V.set(x, y, top - 1, P.Lens); }
    // the screen's black surround, the glass sunk in it (its picture lies over it)
    const [bx0, by0, bx1, by1] = BEZEL_MM, [sx0, sy0, sx1, sy1] = SCREEN_MM;
    if (inRound(X, Y, bx0, by0, bx1, by1, 1.5)) {
      const glass = X >= sx0 && X < sx1 && Y >= sy0 && Y < sy1;
      V.set(x, y, top, glass ? 0 : P.Bezel);
      V.set(x, y, top - 1, glass ? P.Glass : P.Bezel);
    }
    // the home button's chrome ring, a millimetre proud, with the ice ring inside it round the button's well
    const r = Math.hypot(X - Hm.x, Y - Hm.y);
    if (r <= Hm.chrome) {
      if (r > Hm.ice) { V.set(x, y, top, P.RimHome); V.set(x, y, top + 1, P.RimHome); }
      else V.set(x, y, top, r > Hm.disc ? P.Ice : P.Bezel);
    }
    // the earphone jack on the top edge, right of the music keys
    if (X >= 43.5 && X < 47 && Y < 1) for (let z = LOW + 2; z < LOW + 5; z++) V.set(x, y, z, P.Jack);
  }
  // the volume on the right side: a chrome rocker standing out of the upper plate's edge
  for (let y = 0; y < NY; y++) { const Y = mm(y); if (Y >= 17.5 && Y < 31.5) for (let z = LOW + 2; z < LOW + 6; z++) V.set(OFF + BODY_MM[0], y, z, P.RimVol); }
  if (K) { caseOn(lo, K, RAIL_MM, 0, LOW); caseOn(V, K, 0, LOW, LOW + UP); }
  return [lo, V];
}

/**
 * A case round a plate (one piece a plate: they slide apart), as the manual draws it: a rounded band 2.5 mm
 * out round the body, as thick as the plate, the front left free. Leather is stitched along it, glitter sparkles.
 */
function caseOn(V: Vox, K: Case, y0: number, z0: number, z1: number) {
  const [W, H] = BODY_MM, R = CORNER_MM;
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const X = mm(x), Y = mm(y);
    if (!inRound(X, Y, -2.5, y0 - 2.5, W + 2.5, y0 + H + 2.5, R + 2.5) || inRound(X, Y, 0, y0, W, y0 + H, R)) continue;
    // the music keys and the jack come through the case's top
    if (y0 === 0 && Y < 0 && ((X > 11 && X < 17.5) || (X > 22.25 && X < 28.75) || (X > 33.5 && X < 40) || (X > 43 && X < 47.5))) continue;
    let c = P.Case;
    if (K.pattern === 'glitter' && hash3(x, y, 93) < 0.16) c = P.Glitter;
    for (let z = z0; z < z1; z++) V.set(x, y, z, c);
    // the stitches: dashes along the band's middle, on its front
    if (K.pattern === 'stitch' && !inRound(X, Y, -1.2, y0 - 1.2, W + 1.2, y0 + H + 1.2, R + 1.2) && inRound(X, Y, -1.9, y0 - 1.9, W + 1.9, y0 + H + 1.9, R + 1.9) && (x + y) % 3 !== 0) V.set(x, y, z1 - 1, P.CaseAlt);
  }
}

/** A key's top: the plate it is on, its face's layer, the layer its top is at (sunk when pressed). */
function keyZ(K: KeyMm, down: boolean): [onUp: boolean, face: number, z: number] {
  const onUp = K.box[1] < BODY_MM[1], face = onUp ? LOW + UP - 1 : LOW - 1;
  return [onUp, face, down ? face : face + 1];
}

/** The keys stamped on a copy of the base: each a millimetre proud of its plate (flush when pressed), with its marks. */
function withKeys([lo0, up0]: [Vox, Vox], down: (k: Key) => boolean, ids: Map<number, Key>): [Vox, Vox] {
  const lo = lo0.copy(), up = up0.copy();
  KEYS_MM.forEach((K, n) => {
    const [onUp, face, z] = keyZ(K, down(K.k)), V = onUp ? up : lo, col = KEY0 + n;
    ids.set(col, K.k);
    const [x0, y0, x1, y1] = K.box;
    if (K.shape === 'top') {
      // a music key: a chrome bump out of the top edge, across most of the upper plate's depth; pressed, it sinks into the edge
      const sink = down(K.k) ? 1 : 0;
      for (let y = Math.floor(y0) + OFF + sink; y < OFF; y++) for (let x = Math.floor(x0) + OFF; x <= Math.ceil(x1) + OFF; x++) {
        if (!onKey(K, mm(x), mm(y))) continue;
        for (let zz = LOW + 1; zz < LOW + UP - 1; zz++) V.set(x, y, zz, col);
      }
      return;
    }
    for (let y = Math.floor(y0) + OFF; y <= Math.ceil(y1) + OFF; y++) for (let x = Math.floor(x0) + OFF; x <= Math.ceil(x1) + OFF; x++) {
      if (!onKey(K, mm(x), mm(y))) continue;
      for (let zz = face; zz <= z; zz++) V.set(x, y, zz, col);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, at = (X: number, Y: number, c: number) => V.set(Math.floor(X) + OFF, Math.floor(Y) + OFF, z, c);
    // the handsets; the home button's ice square
    const icon = HANDSET[K.k];
    if (icon) icon.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') at(cx - row.length / 2 + i, cy - icon.length / 2 + j, K.k === 'send' ? P.Send : P.End); }));
    if (K.k === 'home') {
      const s = HOME_MM.icon;
      for (let Y = -s; Y <= s; Y++) for (let X = -s; X <= s; X++) if (Math.max(Math.abs(X), Math.abs(Y)) === s) at(HOME_MM.x + X, HOME_MM.y + Y, P.Ice);
    }
  });
  return [lo, up];
}

/** The sway's limit either way (rad): small, so the screen (drawn flat over it) stays on its glass. */
const TILT_MAX = 0.06;
/** The decal's pixels a cell (1 mm): the legends and the maker's name are painted on the models' front at this resolution. */
const DK = 8;

/**
 * What the GPU needs to draw the body this frame (render/gpu/voxBody.ts): the two models' cells (the lower
 * plate's, then the upper's, a byte each), the decal, the uniform (the view, the light, the palette), each
 * with a version that changes when it must go up again; the rectangle's size, and where its top-left lies
 * from the phone's top-left (pixels).
 */
export interface BodyGpu {
  nx: number; ny: number; nz: number;
  vox: Uint32Array; voxVer: number;
  decal: Img; decalVer: number;
  uni: Float32Array;
  w: number; h: number; dx: number; dy: number;
}
export const BODY_GPU: BodyGpu = {
  nx: NX, ny: NY, nz: NZ, vox: new Uint32Array(Math.ceil((2 * NX * NY * NZ) / 4)), voxVer: 0,
  decal: new Img(1, 1), decalVer: 0, uni: new Float32Array(BODY_U_FLOATS),
  w: 0, h: 0, dx: 0, dy: 0,
};
// the uniform starts with the models' size, as integers (voxBody.ts BodyU.dim)
new Int32Array(BODY_GPU.uni.buffer, 0, 4).set([NX, NY, NZ, NX * NY * NZ]);

let models: { key: string; V: [Vox, Vox]; ids: Map<number, Key> } | null = null;
let decalKey = '';

/** A legend's letters as coverage (0..255), drawn once by the browser's canvas (none without one, as in the tests). */
type Mask = { w: number; h: number; base: number; a: Uint8Array };
function legend(text: string, px: number, weight: number): Mask | null {
  if (typeof OffscreenCanvas === 'undefined' || !text) return null;
  const w = Math.ceil(px * text.length * 0.8 + 4), h = Math.ceil(px * 1.4), base = Math.ceil(px * 1.05);
  const g = new OffscreenCanvas(w, h).getContext('2d')!;
  g.font = `${weight} ${px}px "Segoe UI", Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff';
  g.fillText(text, w / 2, base);
  const d = g.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3];
  return { w, h, base, a };
}
/** The decal: the keypad's legends (red: ice-blue coverage) and the maker's name (green), over the models' front, DK pixels a cell. */
function paintDecal(brand: { fam: number; name: string } | null): Img {
  const D = new Img(NX * DK, NY * DK), P = D.px;
  const put = (m: Mask, x: number, y: number, k: number) => {
    const X0 = Math.round(x - m.w / 2), Y0 = Math.round(y - m.base);
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) {
      const X = X0 + i, Y = Y0 + j;
      if (X < 0 || Y < 0 || X >= D.w || Y >= D.h) continue;
      const q = (Y * D.w + X) * 4;
      P[q] = Math.max(P[q], m.a[j * m.w + i] * k); P[q + 3] = 255;
    }
  };
  // the number big on the left, the letters small on the right (the manual's lower slab)
  for (const K of KEYS_MM) {
    const lg = KEY_LEGEND[K.k];
    if (!lg) continue;
    const [x0, y0] = K.box, big = legend(lg[0], 4 * DK, 700), small = legend(lg[1], Math.round(1.9 * DK), 600);
    if (big) put(big, (x0 + 4.25 + OFF) * DK, (y0 + 5.5 + OFF) * DK, 1);
    if (small) put(small, (x0 + 9.25 + OFF) * DK, (y0 + 5.25 + OFF) * DK, 0.75);
  }
  // the maker's name above the screen, left of the earpiece, in its family's dot font (15.18), inside the chrome ring
  if (brand) {
    const surf: Px = { w: D.w, h: D.h, px: P, has: () => true, set: (x, y) => { if (x < 0 || y < 0 || x >= D.w || y >= D.h) return; const q = (y * D.w + x) * 4; P[q + 1] = 255; P[q + 3] = 255; } };
    paintBrandText(new Paint(surf), Math.round((4.5 + OFF) * DK), Math.round((1.9 + OFF) * DK), brand.fam, brand.name, 2, [255, 255, 255]);
  }
  return D;
}

/**
 * The body for this frame into BODY_GPU, at kx x ky pixels a millimetre. Keys sunk come from `down`; a key
 * under the cursor is lit a little (`hover`). `tilt` sways it a little off its pose (yaw, pitch in rad, as
 * the hand lags the eye). `railPx` (pixels, 0 open .. minus the rail's run shut) is how far the lower plate
 * is drawn up under the upper. `on`: the screen lit, the keys' marks glow. `brand`: the maker's name (its
 * family, the name, its color).
 */
export function drawBody3d(kx: number, ky: number, S: Shell, look: number, body: C3, K: Case | null,
  down: (k: Key) => boolean, hover: Key | null, L: VoxLight, tilt: readonly [number, number] = [0, 0], railPx = 0, on = true,
  brand: { fam: number; name: string; col: C3 } | null = null): BodyGpu {
  const B = BODY_GPU;
  // the models: built again when a key sinks or rises, or the case changes
  const mk = `${KEYS_MM.filter(({ k }) => down(k)).map(({ k }) => k).join(',')}|${K?.name ?? ''}`;
  if (!models || models.key !== mk) {
    const ids = new Map<number, Key>();
    models = { key: mk, ids, V: withKeys(base(K), down, ids) };
    const n = NX * NY * NZ, bytes = new Uint8Array(B.vox.buffer);
    bytes.set(models.V[0].cells, 0); bytes.set(models.V[1].cells, n);
    B.voxVer++;
  }
  const dk = `${brand?.fam}|${brand?.name}`;
  if (dk !== decalKey) { decalKey = dk; B.decal = paintDecal(brand); B.decalVer++; }
  // the palette
  const plate: C3 = S.face ?? S.body ?? body, gloss = { matte: 0.2, gloss: 0.6, metal: 0.42, rubber: 0.05 }[S.material];
  const U = B.uni, pal = (i: number, m: VoxMat, mul = 1) => {
    const o = 40 + i * 8;
    U[o] = m.col[0]; U[o + 1] = m.col[1]; U[o + 2] = m.col[2]; U[o + 3] = m.gloss;
    U[o + 4] = (m.metal ? 1 : 0) | (m.glow ? 2 : 0) | (m.chrome ? 4 : 0); U[o + 5] = m.chrome?.[0] ?? 0; U[o + 6] = m.chrome?.[1] ?? 0; U[o + 7] = mul;
  };
  const CHROME: C3 = [201, 206, 214];
  pal(P.Plate, { col: plate, gloss, metal: S.material === 'metal' });
  pal(P.Low, { col: GRAPHITE, gloss: 0.05 });
  pal(P.LowGrain, { col: [GRAPHITE[0] * 0.86, GRAPHITE[1] * 0.86, GRAPHITE[2] * 0.86], gloss: 0.05 });
  // the chrome parts: each its own mirror gradient down its height (the manual's chrome)
  pal(P.Rim, { col: CHROME, gloss: 0.5, chrome: [OFF, OFF + BODY_MM[1]] });
  pal(P.RimHome, { col: CHROME, gloss: 0.5, chrome: [OFF + HOME_MM.y - HOME_MM.chrome, OFF + HOME_MM.y + HOME_MM.chrome] });
  pal(P.RimVol, { col: CHROME, gloss: 0.5, chrome: [OFF + 17.5, OFF + 31.5] });
  pal(P.Bezel, { col: BEZEL, gloss: 0.7 });
  pal(P.Glass, { col: BEZEL, gloss: 0.9 });
  pal(P.Slot, { col: [29, 31, 35], gloss: 0.1 });
  pal(P.Lens, { col: [21, 23, 27], gloss: 0.9 });
  pal(P.Jack, { col: [9, 10, 11], gloss: 0.1 });
  // the keys' marks: lit from behind while the screen is on
  pal(P.Ice, { col: on ? ICE : ICE_OFF, gloss: 0.3, glow: on });
  pal(P.Send, { col: CALL, gloss: 0.3, glow: on });
  pal(P.End, { col: END, gloss: 0.3, glow: on });
  if (K) {
    // clear plastic: the plates' color through it, a little tinted; the rest in the case's own
    const cc: C3 = K.material === 'clear' ? [plate[0] * 0.65 + K.color[0] * 0.35, plate[1] * 0.65 + K.color[1] * 0.35, plate[2] * 0.65 + K.color[2] * 0.35] : K.color;
    const cg = { matte: 0.15, gloss: 0.6, metal: 0.42, rubber: 0.05, clear: 0.9 }[K.material];
    pal(P.Case, { col: cc, gloss: cg });
    pal(P.CaseAlt, { col: [201, 160, 112], gloss: cg });
    pal(P.Glitter, { col: [255, 236, 248], gloss: 1 });
  }
  // the keys: rubber caps (the front ones a shade darker), the home button glossy, the music keys chrome; one under the cursor lit, one pressed darker
  for (const [id, k] of models.ids) {
    const m: VoxMat = k === 'prev' || k === 'play' || k === 'next' ? { col: CHROME, gloss: 0.5, chrome: [OFF - 2, OFF] }
      : { col: k === 'home' ? HOME : /^[0-9*#]$/.test(k) ? CAP : FRONT_CAP, gloss: k === 'home' ? 0.6 : 0.15 };
    pal(id, m, down(k) ? 0.6 : hover === k ? 1.5 : 1);
  }
  // the view: the pose, swayed; a pixel's size in cells; the rail
  const yaw = YAW + Math.max(-TILT_MAX, Math.min(TILT_MAX, tilt[0])), pitch = PITCH + Math.max(-TILT_MAX, Math.min(TILT_MAX, tilt[1]));
  const [R, D, dir] = voxAxes(yaw, pitch);
  B.w = Math.round(NX * kx); B.h = Math.round(NY * ky); B.dx = -Math.round(OFF * kx); B.dy = -Math.round(OFF * ky);
  U.set([R[0], R[1], R[2], 1 / kx, D[0], D[1], D[2], 1 / ky, dir[0], dir[1], dir[2], Math.round(railPx)], 4);
  U.set([B.w, B.h, DK, 0.68 + L.lat * 0.44, L.rgb[0], L.rgb[1], L.rgb[2], L.lat, L.glint[0], L.glint[1], L.glint[2], L.str], 16);
  const ice = on ? ICE : ICE_OFF, bc = brand?.col ?? [0, 0, 0];
  U.set([ice[0], ice[1], ice[2], on ? 1 : 0, bc[0], bc[1], bc[2], 0], 28);
  // the glass's cells (model cells: x0, y0, width, height): those whose centre is on SCREEN_MM, as base() lays them
  const [s0, t0, s1, t1] = SCREEN_MM, g = (v: number) => Math.ceil(v + OFF - 0.5);
  U.set([g(s0), g(t0), g(s1) - g(s0), g(t1) - g(t0)], 36);
  VIEW.kx = kx; VIEW.ky = ky; VIEW.yaw = yaw; VIEW.pitch = pitch; VIEW.rail = Math.round(railPx);
  void look;
  return B;
}

/** The last frame's view of the body, for the picks. */
const VIEW = { kx: 0, ky: 0, yaw: 0, pitch: 0, rail: 0 };
/**
 * What the body shows at pixel (i, j) of its rectangle (as the GPU casts it: the upper plate, then the lower
 * one drawn down by the rail): a key, 'body' for the rest of it, or null off it. The keys' hit areas are
 * so exactly what is drawn, leaning and swaying with it.
 */
export function pickBody(i: number, j: number): Key | 'body' | null {
  if (!models || !VIEW.kx) return null;
  const sx = 1 / VIEW.kx, sy = 1 / VIEW.ky, at = (V: Vox, jj: number) => castVox(V, { w: 1, h: 1, sx, sy, yaw: VIEW.yaw, pitch: VIEW.pitch, x0: i * sx, y0: jj * sy });
  let G = at(models.V[1], j);
  if (!G.mat[0]) G = at(models.V[0], j - VIEW.rail);
  const m = G.mat[0];
  if (!m) return null;
  const k = models.ids.get(m);
  if (k) return k;
  // the marks on the keys (the handsets, the home button's square and ring) are the key under them
  const X = mm(G.vx[0]), Y = mm(G.vy[0]);
  return KEYS_MM.find((K) => (K.k === 'home' ? Math.hypot(X - HOME_MM.x, Y - HOME_MM.y) <= HOME_MM.chrome : onKey(K, X, Y)))?.k ?? 'body';
}

/** The maker's name color on a plate: its family's color for a light or a dark face. */
export function brandColor(fam: number, plateLum: number): C3 { return FAMILIES[fam][plateLum > 130 ? 'light' : 'dark'][2] as unknown as C3; }

/**
 * Where the ray of pixel (i, j) of the body's rectangle meets the glass's plane, as the screen's u, v (0..1
 * across it: the compositor lays the picture by the same), or null without a body drawn.
 */
export function glassUv(i: number, j: number): [number, number] | null {
  if (!VIEW.kx) return null;
  const [R, D, d] = voxAxes(VIEW.yaw, VIEW.pitch), mx = NX / 2, my = NY / 2, mz = NZ / 2, far = NX + NY + NZ;
  const u = (i + 0.5) / VIEW.kx - mx, v = (j + 0.5) / VIEW.ky - my;
  const o = [mx + R[0] * u + D[0] * v - d[0] * far, my + R[1] * u + D[1] * v - d[1] * far, mz + R[2] * u + D[2] * v - d[2] * far];
  // the glass's top face (base(): its cells one under the plate's top layer)
  const t = (LOW + UP - 1 - o[2]) / d[2], U = BODY_GPU.uni;
  return [(o[0] + d[0] * t - U[36]) / U[38], (o[1] + d[1] * t - U[37]) / U[39]];
}
