import { castVox, shadeVox, Vox, type GBuf, type VoxLight, type VoxMat } from '../render/voxels';
import { HD } from '../render/hd';
import { type Case, KEYS_Y, PHONE_H, PHONE_W, type KeyRect, type Shell } from './shells';
import { hash3 } from '../core/rng';
import { type C3 } from './lcd';
import { type Key } from './phone';

/**
 * 15.19b: the phone's body in little cubes (docs/identidade/celular-manual.html, section 9), drawn into
 * the HD layer under the interface: the key labels, the screen and the case are still the interface's
 * (draw.ts) on top. One body for every look, the slider: the upper plate (the look's color and
 * material) with the screen, its chrome ring, the soft, call and end keys and the d-pad; under it the
 * graphite lower plate with the number keys. A cube is 1 mm; a column of the phone is 1 mm across and a
 * row 2 mm down (the phone is 50 x 104 mm), so the keys fall on the cells they are clicked on. The keys
 * stand a millimetre proud and sink when pressed.
 */
const MMX = 1, MMY = 2;
const NX = PHONE_W * MMX, NY = PHONE_H * MMY;
/** The plates' thickness (mm): the lower 8, the upper 7 over it; the keys stand 1 mm proud of their plate. */
const LOW = 8, UP = 7, NZ = LOW + UP + 1;
/** The screen (cells), as draw.ts puts it, and the rows the upper plate covers (down to the d-pad's foot and a row more). */
const SX = 4, SY = 4, SW = 42, SH = 26, UP_ROWS = KEYS_Y + 6;
/** A slight tilt, its top toward the eye: the top edge and the keys' tops show, as held below the eye. */
const PITCH = 0.16, YAW = -0.05;

/** Palette indices. */
const enum P { Plate = 1, Low, Rim, Bezel, Glass, Slot, Lens, Send, End, Case, CaseAlt, Glitter }
const KEY0 = 16;
const GRAPHITE: C3 = [43, 45, 49], CHROME: C3 = [201, 206, 214], BEZEL: C3 = [7, 7, 9];

/** Whether (x, y), in mm, lies in a box with corners rounded to r mm (r in rows on draw.ts's scale: x2 across). */
const inRound = (x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const rx = r, ry = r, cx = Math.min(Math.max(x, x0 + rx), x1 - rx), cy = Math.min(Math.max(y, y0 + ry), y1 - ry);
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
};

/**
 * The two plates, without their keys (they are stamped on per frame, up or sunk), as two models of the
 * same size so they cast alike: the lower one as it lies with the rail open (the same length as the
 * upper, the keypad's rows below the upper plate's foot), drawn shifted up under the upper as it shuts.
 */
function base(S: Shell, K: Case | null): [Vox, Vox] {
  const lo = new Vox(NX, NY, NZ), V = new Vox(NX, NY, NZ), R = Math.max(2, S.round * 2.2);
  const upY = UP_ROWS * MMY;
  lo.draw(0, LOW, (x, y) => (inRound(x, y, 0, NY - upY, NX, NY, R) ? P.Low : 0));
  V.draw(LOW, LOW + UP, (x, y) => (inRound(x, y, 0, 0, NX, upY, R) ? P.Plate : 0));
  if (K) { caseOn(lo, K, NY - upY, NY, 0, LOW, R); caseOn(V, K, 0, upY, LOW, LOW + UP, R); }
  // the upper plate's front edge, a millimetre in all round: the rim of a rounded edge
  const top = LOW + UP - 1;
  for (let y = 0; y < upY; y++) for (let x = 0; x < NX; x++) {
    if (!V.at(x, y, top)) continue;
    if (!V.at(x - 1, y, top) || !V.at(x + 1, y, top) || !V.at(x, y - 1, top) || !V.at(x, y + 1, top)) V.set(x, y, top, 0);
  }
  // the screen: the chrome ring (on the looks that have one) a millimetre proud, the black bezel, the glass sunk a millimetre
  const sx0 = SX * MMX, sy0 = SY * MMY, sx1 = (SX + SW) * MMX, sy1 = (SY + SH) * MMY;
  if (S.chrome) for (let y = sy0 - 4; y < sy1 + 4; y++) for (let x = sx0 - 2; x < sx1 + 2; x++) {
    const ring = inRound(x + 0.5, y + 0.5, sx0 - 2, sy0 - 4, sx1 + 2, sy1 + 4, 3) && !inRound(x + 0.5, y + 0.5, sx0 - 1, sy0 - 2, sx1 + 1, sy1 + 2, 2);
    if (ring) { V.set(x, y, top, P.Rim); V.set(x, y, top + 1, P.Rim); }
  }
  for (let y = sy0 - 2; y < sy1 + 2; y++) for (let x = sx0 - 1; x < sx1 + 1; x++) {
    if (!inRound(x + 0.5, y + 0.5, sx0 - 1, sy0 - 2, sx1 + 1, sy1 + 2, 2)) continue;
    const glass = x >= sx0 && x < sx1 && y >= sy0 && y < sy1;
    V.set(x, y, top, glass ? 0 : P.Bezel);
    V.set(x, y, top - 1, glass ? P.Glass : P.Bezel);
  }
  // the earpiece (a slot) right of the middle, the maker's name being left of it (draw.ts), and the front camera (a lens)
  for (let x = 30; x < 39; x++) for (let y = 2; y < 4; y++) { V.set(x, y, top, 0); V.set(x, y, top - 1, P.Slot); }
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { V.set(43 + dx, 2 + dy, top, 0); V.set(43 + dx, 2 + dy, top - 1, P.Lens); }
  return [lo, V];
}

/**
 * A case over a plate (one piece a plate: they slide apart), from y0 to y1 and z0 to z1 (mm): the plate's
 * outer 2 mm in the case's color, its lip a millimetre proud over the front's outer edge, so only the face
 * is left free. Leather is stitched round the lip, a bumper ridged on its sides, glitter sparkles.
 */
function caseOn(V: Vox, K: Case, y0: number, y1: number, z0: number, z1: number, R: number) {
  for (let y = y0; y < y1; y++) for (let x = 0; x < NX; x++) {
    const cx = x + 0.5, cy = y + 0.5;
    if (!inRound(cx, cy, 0, y0, NX, y1, R) || inRound(cx, cy, 2, y0 + 2, NX - 2, y1 - 2, Math.max(1, R - 2))) continue;
    const lip = !inRound(cx, cy, 1, y0 + 1, NX - 1, y1 - 1, Math.max(1, R - 1));
    const side = x < 2 || x >= NX - 2;
    let c = P.Case;
    if (K.pattern === 'ridge' && side && y % 4 < 2) c = P.CaseAlt;
    else if (K.pattern === 'glitter' && hash3(x, y, 93) < 0.14) c = P.Glitter;
    for (let z = z0; z < z1; z++) V.set(x, y, z, c);
    // the lip, and the stitches along it (a stitch every third millimetre)
    if (lip) V.set(x, y, z1, K.pattern === 'stitch' && (x + y) % 3 === 0 ? P.CaseAlt : c);
  }
}

/** The handsets on the call and end keys (8 x 3 mm, '#' a cube): the receiver lifted, and laid down. */
const HANDSET: Record<string, string[]> = { send: ['.######.', '##....##', '#......#'], end: ['#......#', '##....##', '.######.'] };

/** The keys stamped on a copy of the base: a cap per key rect, 1 mm proud of its plate (or flush when pressed); its top edge shows by the tilt. */
function withKeys([lo0, up0]: [Vox, Vox], S: Shell, keys: KeyRect[], down: (k: Key) => boolean, ids: Map<number, Key>): [Vox, Vox] {
  const lo = lo0.copy(), up = up0.copy(), upY = UP_ROWS * MMY;
  keys.forEach(([k, cx, cy, cw, ch], n) => {
    const x0 = cx * MMX, y0 = cy * MMY, x1 = (cx + cw) * MMX, y1 = (cy + ch) * MMY, onUp = y0 < upY, V = onUp ? up : lo;
    const face = onUp ? LOW + UP - 1 : LOW - 1, z = down(k) ? face : face + 1;
    const col = KEY0 + n;
    ids.set(col, k);
    const r = S.keys === 'pebble' || (S.dpad === 'ring' && k === 'ok') ? 1.6 : 0.8;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      // a hair of the plate between keys side by side; the corners rounded
      if (!inRound(x + 0.5, y + 0.5, x0 + 0.15, y0 + 0.3, x1 - 0.15, y1 - 0.3, r)) continue;
      for (let zz = face; zz <= z; zz++) V.set(x, y, zz, col);
    }
    // the green and red handsets, in the cap's top (they sink with it)
    const icon = HANDSET[k];
    if (icon) icon.forEach((row, j) => [...row].forEach((c, i) => { if (c === '#') V.set(x0 + ((x1 - x0 - row.length) >> 1) + i, y0 + j, z, k === 'send' ? P.Send : P.End); }));
  });
  return [lo, up];
}

/** The sway's step (rad) and how far it goes either way: small, so the screen and the labels (still drawn flat over it) stay on their keys. */
const TILT_STEP = 0.015, TILT_MAX = 0.06;
let cache: { key: string; V: [Vox, Vox]; ids: Map<number, Key>; poses: Map<string, [GBuf, GBuf]> } | null = null;
/** The palette and the keys' light, kept while the look, its color and the keys under the cursor or pressed stay the same. */
let paint: { key: string; pal: VoxMat[]; mul: Float32Array } | null = null;
/** The plates as last lit (x, y, r, g, b per pixel met; the lower plate's first, n0 of them), kept while the light stays the same (standing still). */
let lit: { key: string; px: Float32Array; n0: number; n: number } | null = null;

/**
 * The body into the HD layer (put: x, y in the layer's pixels), its top-left at cell (ox, oy). Keys
 * sunk come from `down`; a key under the cursor is lit a little (`hover`). `tilt` sways it a little off
 * its pose (yaw, pitch in rad, as the hand lags the eye), in steps: each step's geometry is cast once
 * and kept until the look or the keys pressed change. `rail` (rows, 0 open .. minus the keypad's rows
 * shut) is how far the lower plate is drawn up under the upper.
 */
export function drawBody3d(put: (x: number, y: number, r: number, g: number, b: number) => void, ox: number, oy: number, S: Shell, look: number, body: C3, K: Case | null,
  keys: KeyRect[], down: (k: Key) => boolean, hover: Key | null, L: VoxLight, tilt: readonly [number, number] = [0, 0], rail = 0, on = true) {
  const pressed = keys.filter(([k]) => down(k)).map(([k]) => k).join(',');
  const ck = `${look}|${pressed}|${K?.name ?? ''}`;
  if (!cache || cache.key !== ck) {
    const ids = new Map<number, Key>();
    cache = { key: ck, ids, V: withKeys(base(S, K), S, keys, down, ids), poses: new Map() };
  }
  const step = (a: number) => Math.round(Math.max(-TILT_MAX, Math.min(TILT_MAX, a)) / TILT_STEP);
  const ty = step(tilt[0]), tp = step(tilt[1]), posk = `${ty},${tp}`;
  let G = cache.poses.get(posk);
  if (!G) {
    const view = { w: PHONE_W * HD, h: PHONE_H * HD, sx: MMX / HD, sy: MMY / HD, yaw: YAW + ty * TILT_STEP, pitch: PITCH + tp * TILT_STEP };
    G = [castVox(cache.V[0], view), castVox(cache.V[1], view)];
    cache.poses.set(posk, G);
  }
  const pk = `${ck}|${hover}|${body}|${on}`;
  if (!paint || paint.key !== pk) {
    const plate: C3 = S.face ?? S.body ?? body, gloss = { matte: 0.2, gloss: 0.6, metal: 0.42, rubber: 0.05 }[S.material];
    const pal: VoxMat[] = Array.from({ length: 256 }, () => ({ col: [0, 0, 0], gloss: 0 }));
    pal[P.Plate] = { col: plate, gloss, metal: S.material === 'metal' };
    pal[P.Low] = { col: S.face ? (S.body ?? body) : GRAPHITE, gloss: 0.12 };
    pal[P.Rim] = { col: S.chrome ? CHROME : S.trim, gloss: 0.95 };
    pal[P.Bezel] = { col: BEZEL, gloss: 0.7 };
    pal[P.Glass] = { col: [5, 6, 8], gloss: 0.9 };
    pal[P.Slot] = { col: [16, 16, 18], gloss: 0.1 };
    pal[P.Lens] = { col: [60, 72, 96], gloss: 0.9 };
    // the handsets: lit from behind while the phone is on, as the labels are
    pal[P.Send] = { col: on ? [80, 230, 120] : [40, 90, 56], gloss: 0.3, glow: on };
    pal[P.End] = { col: on ? [255, 80, 70] : [110, 44, 40], gloss: 0.3, glow: on };
    if (K) {
      // clear plastic: the plate's color through it, a little tinted; the rest in the case's own
      const cc: C3 = K.material === 'clear' ? [plate[0] * 0.7 + K.color[0] * 0.3, plate[1] * 0.7 + K.color[1] * 0.3, plate[2] * 0.7 + K.color[2] * 0.3] : K.color;
      const cg = { matte: 0.15, gloss: 0.6, metal: 0.42, rubber: 0.05, clear: 0.9 }[K.material];
      pal[P.Case] = { col: cc, gloss: cg };
      pal[P.CaseAlt] = { col: K.pattern === 'stitch' ? [196, 150, 100] : [cc[0] * 0.55, cc[1] * 0.55, cc[2] * 0.55], gloss: cg };
      pal[P.Glitter] = { col: [255, 225, 245], gloss: 1 };
    }
    // the keys: their caps, the arrows of a ring d-pad in its trim; one under the cursor lit, one pressed darker
    const mul = new Float32Array(256).fill(1);
    for (const [id, k] of cache.ids) {
      pal[id] = { col: S.dpad === 'ring' && (k === 'up' || k === 'down' || k === 'left' || k === 'right') ? S.trim : S.cap, gloss: 0.5 };
      mul[id] = down(k) ? 0.6 : hover === k ? 1.3 : 1;
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
  const X0 = ox * HD, Y0 = oy * HD, A = lit.px, dy = rail * HD;
  for (let i = 0; i < lit.n0; i += 5) put(X0 + A[i], Y0 + dy + A[i + 1], A[i + 2], A[i + 3], A[i + 4]);
  for (let i = lit.n0; i < lit.n; i += 5) put(X0 + A[i], Y0 + A[i + 1], A[i + 2], A[i + 3], A[i + 4]);
}
