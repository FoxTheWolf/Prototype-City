import { castVox, shadeVox, Vox, type GBuf, type VoxLight, type VoxMat } from '../render/voxels';
import { HD } from '../render/hd';
import { BEZEL_MM, BODY_MM, COL_MM, CORNER_MM, DPAD_MM, KEYS_MM, PHONE_H, PHONE_W, RAIL_MM, ROW_MM, SCREEN_MM, type Case, type KeyMm, type Shell } from './shells';
import { hash3 } from '../core/rng';
import { type C3 } from './lcd';
import { type Key } from './phone';

/**
 * 15.19b: the phone's body in little cubes of 1 mm, as the phone's manual draws it
 * (docs/identidade/celular-manual.html: the slider, its colors and materials, its keys; section 9 for the
 * cubes), drawn into the HD layer under the interface. Two models of the same size, cast alike: the upper
 * plate (the look's color and material, the chrome edge, the earpiece, the screen's black surround, the soft
 * keys, call and end, the round d-pad with its chrome ring and OK, the volume on the right side) and the
 * graphite lower plate with the keypad, drawn shifted up under the upper as the rail shuts. The screen
 * itself is not cubes: its picture goes over the glass (draw.ts). Keys stand a millimetre proud and sink
 * when pressed. A case goes round both plates, 2.5 mm out.
 */
/** The plates' thickness (mm): the lower 8, the upper 7 over it; a key or the chrome ring stands 1 mm proud. */
const LOW = 8, UP = 7, NZ = LOW + UP + 1;
/** Room round the body in the model for the case (mm), and the model's size. */
const OFF = 3, NX = BODY_MM[0] + 2 * OFF + 1, NY = RAIL_MM + BODY_MM[1] + 2 * OFF;
/** The picture's margin round the phone's cells (HD pixels, about OFF mm), so the case shows. */
const MXP = Math.round(OFF / (COL_MM / HD)), MYP = Math.round(OFF / (ROW_MM / HD));
/** A slight tilt, its top toward the eye: the top edge and the keys' tops show, as held below the eye. */
const PITCH = 0.16, YAW = -0.05;

/** Palette indices. */
const enum P { Plate = 1, Low, LowGrain, Rim, Bezel, Glass, Slot, Lens, Ice, Send, End, Seg, Case, CaseAlt, Glitter }
const KEY0 = 32;
/** The manual's colors (section 4). */
const CHROME: C3 = [201, 206, 214], GRAPHITE: C3 = [43, 45, 49], CAP: C3 = [28, 30, 34], FRONT_CAP: C3 = [22, 24, 28], ICE: C3 = [143, 211, 255], ICE_OFF: C3 = [59, 111, 143];
const CALL: C3 = [47, 174, 90], END: C3 = [210, 58, 46], BEZEL: C3 = [5, 6, 7], SEG: C3 = [18, 19, 23], OK: C3 = [36, 38, 43];

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
  const [x0, y0, x1, y1] = K.box, D = DPAD_MM;
  if (K.shape === 'pill') return inRound(x, y, x0, y0, x1, y1, (y1 - y0) / 2);
  if (K.shape === 'box') return inRound(x, y, x0, y0, x1, y1, K.r ?? 1);
  if (K.shape === 'send') return inRound(x, y, x0, y0, x1, y1, [1.5, 1.5, 1.5, 5.5]);
  if (K.shape === 'end') return inRound(x, y, x0, y0, x1, y1, [1.5, 1.5, 5.5, 1.5]);
  const dx = x - D.x, dy = y - D.y, r = Math.hypot(dx, dy);
  if (K.shape === 'disc') return r <= D.ok;
  // an arrow: its quarter of the ring between the ice ring and the outer edge, a hair apart from the next
  if (r < D.ice || r > D.out || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.6) return false;
  return K.k === 'up' ? -dy > Math.abs(dx) : K.k === 'down' ? dy > Math.abs(dx) : K.k === 'left' ? -dx > Math.abs(dy) : dx > Math.abs(dy);
}

/** The handsets on the call and end keys ('#' a cube, 1 mm): the receiver lifted, tilted; and laid down, an arch. */
const HANDSET: Record<string, string[]> = {
  send: ['.##.....', '###.....', '##......', '.##.....', '..###.##', '...#####', '....###.'],
  end: ['..######..', '.########.', '##......##', '##......##'],
};
/** The ice-blue arrows on the d-pad: their cubes from the centre (mm). */
const ARROWS: Record<string, [number, number][]> = {
  up: [[0, -6.4], [-1, -5.4], [0, -5.4], [1, -5.4]], down: [[0, 6.4], [-1, 5.4], [0, 5.4], [1, 5.4]],
  left: [[-6.4, 0], [-5.4, -1], [-5.4, 0], [-5.4, 1]], right: [[6.4, 0], [5.4, -1], [5.4, 0], [5.4, 1]],
};

/**
 * The two plates without their keys (stamped on per frame, up or sunk), as two models of the same size: the
 * lower one as it lies with the rail open (RAIL_MM down), the upper over it.
 */
function base(K: Case | null): [Vox, Vox] {
  const lo = new Vox(NX, NY, NZ), V = new Vox(NX, NY, NZ), [W, H] = BODY_MM, R = CORNER_MM;
  const top = LOW + UP - 1;
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const X = mm(x), Y = mm(y);
    // the lower plate: graphite, matte and grainy
    if (inRound(X, Y, 0, RAIL_MM, W, RAIL_MM + H, R)) for (let z = 0; z < LOW; z++) lo.set(x, y, z, hash3(x, y, z) < 0.3 ? P.LowGrain : P.Low);
    if (!inRound(X, Y, 0, 0, W, H, R)) continue;
    // the upper plate, its front edge chrome (the manual's ring round it)
    for (let z = LOW; z < top; z++) V.set(x, y, z, P.Plate);
    V.set(x, y, top, inRound(X, Y, 1, 1, W - 1, H - 1, R - 1) ? P.Plate : P.Rim);
    // the earpiece (a slot) and the front camera, above the screen
    if (X >= 18 && X < 33 && Y >= 3 && Y < 5) { V.set(x, y, top, 0); V.set(x, y, top - 1, P.Slot); }
    if (Math.hypot(X - 39, Y - 4) < 1) { V.set(x, y, top, 0); V.set(x, y, top - 1, P.Lens); }
    // the screen's black surround, the glass sunk in it (its picture lies over it)
    const [bx0, by0, bx1, by1] = BEZEL_MM, [sx0, sy0, sx1, sy1] = SCREEN_MM;
    if (inRound(X, Y, bx0, by0, bx1, by1, 1.5)) {
      const glass = X >= sx0 && X < sx1 && Y >= sy0 && Y < sy1;
      V.set(x, y, top, glass ? 0 : P.Bezel);
      V.set(x, y, top - 1, glass ? P.Glass : P.Bezel);
    }
    // the d-pad: its chrome ring a millimetre proud, the dark well inside, an ice ring round OK
    const D = DPAD_MM, r = Math.hypot(X - D.x, Y - D.y);
    if (r <= D.chrome) {
      if (r > D.out - 0.2) { V.set(x, y, top, P.Rim); V.set(x, y, top + 1, P.Rim); }
      else V.set(x, y, top, r > D.ok && r < D.ice ? P.Ice : P.Seg);
    }
  }
  // the volume on the right side: a chrome rocker standing out of the upper plate's edge
  for (let y = 0; y < NY; y++) { const Y = mm(y); if (Y >= 17.5 && Y < 31.5) for (let z = LOW + 2; z < LOW + 6; z++) V.set(OFF + BODY_MM[0], y, z, P.Rim); }
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
    let c = P.Case;
    if (K.pattern === 'glitter' && hash3(x, y, 93) < 0.16) c = P.Glitter;
    for (let z = z0; z < z1; z++) V.set(x, y, z, c);
    // the stitches: dashes along the band's middle, on its front
    if (K.pattern === 'stitch' && !inRound(X, Y, -1.2, y0 - 1.2, W + 1.2, y0 + H + 1.2, R + 1.2) && inRound(X, Y, -1.9, y0 - 1.9, W + 1.9, y0 + H + 1.9, R + 1.9) && (x + y) % 3 !== 0) V.set(x, y, z1 - 1, P.CaseAlt);
  }
}

/** The keys stamped on a copy of the base: each a millimetre proud of its plate (flush when pressed), with its marks. */
function withKeys([lo0, up0]: [Vox, Vox], down: (k: Key) => boolean, ids: Map<number, Key>): [Vox, Vox] {
  const lo = lo0.copy(), up = up0.copy();
  KEYS_MM.forEach((K, n) => {
    const onUp = K.box[1] < BODY_MM[1], V = onUp ? up : lo, face = onUp ? LOW + UP - 1 : LOW - 1, z = down(K.k) ? face : face + 1;
    const col = KEY0 + n;
    ids.set(col, K.k);
    const [x0, y0, x1, y1] = K.box;
    for (let y = Math.floor(y0) + OFF; y <= Math.ceil(y1) + OFF; y++) for (let x = Math.floor(x0) + OFF; x <= Math.ceil(x1) + OFF; x++) {
      if (!onKey(K, mm(x), mm(y))) continue;
      for (let zz = face; zz <= z; zz++) V.set(x, y, zz, col);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, at = (X: number, Y: number, c: number) => V.set(Math.floor(X) + OFF, Math.floor(Y) + OFF, z, c);
    // the soft keys' ice line; the handsets; the d-pad's arrows
    if (K.shape === 'pill') for (let X = x0 + 2.5; X < x1 - 2.5; X++) at(X, cy, P.Ice);
    const icon = HANDSET[K.k];
    if (icon) icon.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') at(cx - row.length / 2 + i, cy - icon.length / 2 + j, K.k === 'send' ? P.Send : P.End); }));
    for (const [dx, dy] of ARROWS[K.k] ?? []) at(DPAD_MM.x + dx, DPAD_MM.y + dy, P.Ice);
  });
  return [lo, up];
}

/** The sway's step (rad) and how far it goes either way: small, so the screen and the labels (drawn flat over it) stay on their keys. */
const TILT_STEP = 0.015, TILT_MAX = 0.06;
let cache: { key: string; V: [Vox, Vox]; ids: Map<number, Key>; poses: Map<string, [GBuf, GBuf]> } | null = null;
/** The palette and the keys' light, kept while the look, its color and the keys under the cursor or pressed stay the same. */
let paint: { key: string; pal: VoxMat[]; mul: Float32Array } | null = null;
/** The plates as last lit (x, y, r, g, b per pixel met; the lower plate's first, n0 of them), kept while the light stays the same (standing still). */
let lit: { key: string; px: Float32Array; n0: number; n: number } | null = null;

/**
 * The body into the HD layer (put: x, y in the layer's pixels), its top-left at cell (ox, oy) (the case
 * reaches a little past it). Keys sunk come from `down`; a key under the cursor is lit a little (`hover`).
 * `tilt` sways it a little off its pose (yaw, pitch in rad, as the hand lags the eye), in steps: each
 * step's geometry is cast once and kept until the look or the keys pressed change. `rail` (rows, 0 open ..
 * minus the keypad's rows shut) is how far the lower plate is drawn up under the upper. `on`: the screen
 * lit, the keys' marks glow.
 */
export function drawBody3d(put: (x: number, y: number, r: number, g: number, b: number) => void, ox: number, oy: number, S: Shell, look: number, body: C3, K: Case | null,
  down: (k: Key) => boolean, hover: Key | null, L: VoxLight, tilt: readonly [number, number] = [0, 0], rail = 0, on = true) {
  const pressed = KEYS_MM.filter(({ k }) => down(k)).map(({ k }) => k).join(',');
  const ck = `${pressed}|${K?.name ?? ''}`;
  if (!cache || cache.key !== ck) {
    const ids = new Map<number, Key>();
    cache = { key: ck, ids, V: withKeys(base(K), down, ids), poses: new Map() };
  }
  const step = (a: number) => Math.round(Math.max(-TILT_MAX, Math.min(TILT_MAX, a)) / TILT_STEP);
  const ty = step(tilt[0]), tp = step(tilt[1]), posk = `${ty},${tp}`;
  let G = cache.poses.get(posk);
  if (!G) {
    const sx = COL_MM / HD, sy = ROW_MM / HD;
    const view = { w: PHONE_W * HD + 2 * MXP, h: PHONE_H * HD + 2 * MYP, sx, sy, x0: OFF - MXP * sx, y0: OFF - MYP * sy, yaw: YAW + ty * TILT_STEP, pitch: PITCH + tp * TILT_STEP };
    G = [castVox(cache.V[0], view), castVox(cache.V[1], view)];
    cache.poses.set(posk, G);
  }
  const pk = `${ck}|${look}|${hover}|${body}|${on}`;
  if (!paint || paint.key !== pk) {
    const plate: C3 = S.face ?? S.body ?? body, gloss = { matte: 0.2, gloss: 0.6, metal: 0.42, rubber: 0.05 }[S.material];
    const pal: VoxMat[] = Array.from({ length: 256 }, () => ({ col: [0, 0, 0], gloss: 0 }));
    pal[P.Plate] = { col: plate, gloss, metal: S.material === 'metal' };
    pal[P.Low] = { col: GRAPHITE, gloss: 0.05 };
    pal[P.LowGrain] = { col: [GRAPHITE[0] * 0.86, GRAPHITE[1] * 0.86, GRAPHITE[2] * 0.86], gloss: 0.05 };
    pal[P.Rim] = { col: CHROME, gloss: 0.95, metal: true };
    pal[P.Bezel] = { col: BEZEL, gloss: 0.7 };
    pal[P.Glass] = { col: BEZEL, gloss: 0.9 };
    pal[P.Slot] = { col: [29, 31, 35], gloss: 0.1 };
    pal[P.Lens] = { col: [21, 23, 27], gloss: 0.9 };
    pal[P.Seg] = { col: SEG, gloss: 0.3 };
    // the keys' marks: lit from behind while the screen is on
    pal[P.Ice] = { col: on ? ICE : ICE_OFF, gloss: 0.3, glow: on };
    pal[P.Send] = { col: CALL, gloss: 0.3, glow: on };
    pal[P.End] = { col: END, gloss: 0.3, glow: on };
    if (K) {
      // clear plastic: the plates' color through it, a little tinted; the rest in the case's own
      const cc: C3 = K.material === 'clear' ? [plate[0] * 0.65 + K.color[0] * 0.35, plate[1] * 0.65 + K.color[1] * 0.35, plate[2] * 0.65 + K.color[2] * 0.35] : K.color;
      const cg = { matte: 0.15, gloss: 0.6, metal: 0.42, rubber: 0.05, clear: 0.9 }[K.material];
      pal[P.Case] = { col: cc, gloss: cg };
      pal[P.CaseAlt] = { col: [201, 160, 112], gloss: cg };
      pal[P.Glitter] = { col: [255, 236, 248], gloss: 1 };
    }
    // the keys: rubber caps (the front ones a shade darker), OK a little lighter; one under the cursor lit, one pressed darker
    const mul = new Float32Array(256).fill(1);
    for (const [id, k] of cache.ids) {
      pal[id] = { col: k === 'ok' ? OK : /^[0-9*#]$/.test(k) ? CAP : FRONT_CAP, gloss: k === 'ok' ? 0.5 : 0.15 };
      mul[id] = down(k) ? 0.6 : hover === k ? 1.5 : 1;
    }
    paint = { key: pk, pal, mul };
  }
  const q = (v: number) => Math.round(v * 64);
  const lk = `${pk}|${posk}|${q(L.rgb[0])},${q(L.rgb[1])},${q(L.rgb[2])},${q(L.lat)},${q(L.str)},${q(L.glint[0])},${q(L.glint[1])},${q(L.glint[2])}`;
  if (!lit || lit.key !== lk) {
    const size = G[0].w * G[0].h * 10, px = lit?.px.length === size ? lit.px : new Float32Array(size);
    let n = 0;
    const keep = (x: number, y: number, r: number, g: number, b: number) => { px[n++] = x; px[n++] = y; px[n++] = r; px[n++] = g; px[n++] = b; };
    shadeVox(G[0], paint.pal, L, keep, paint.mul);
    const n0 = n;
    shadeVox(G[1], paint.pal, L, keep, paint.mul);
    lit = { key: lk, px, n0, n };
  }
  // the lower plate first (shifted up by the rail), the upper over it
  const X0 = ox * HD - MXP, Y0 = oy * HD - MYP, A = lit.px, dy = rail * HD;
  for (let i = 0; i < lit.n0; i += 5) put(X0 + A[i], Y0 + dy + A[i + 1], A[i + 2], A[i + 3], A[i + 4]);
  for (let i = lit.n0; i < lit.n; i += 5) put(X0 + A[i], Y0 + A[i + 1], A[i + 2], A[i + 3], A[i + 4]);
}
