import { castVox, shadeVox, Vox, type GBuf, type VoxLight, type VoxMat } from '../render/voxels';
import { HD } from '../render/hd';
import { KEYS_Y, PHONE_H, PHONE_W, type KeyRect, type Shell } from './shells';
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
const enum P { Plate = 1, Low, Rim, Bezel, Glass, Slot, Lens }
const KEY0 = 16;
const GRAPHITE: C3 = [43, 45, 49], CHROME: C3 = [201, 206, 214], BEZEL: C3 = [7, 7, 9];

/** Whether (x, y), in mm, lies in a box with corners rounded to r mm (r in rows on draw.ts's scale: x2 across). */
const inRound = (x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const rx = r, ry = r, cx = Math.min(Math.max(x, x0 + rx), x1 - rx), cy = Math.min(Math.max(y, y0 + ry), y1 - ry);
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
};

/** The model, without its keys (they are stamped on per frame, up or sunk). */
function base(S: Shell): Vox {
  const V = new Vox(NX, NY, NZ), R = Math.max(2, S.round * 2.2);
  const upY = UP_ROWS * MMY;
  // the lower plate, the whole length; the upper over it down to the seam
  V.draw(0, LOW, (x, y) => (inRound(x, y, 0, 0, NX, NY, R) ? P.Low : 0));
  V.draw(LOW, LOW + UP, (x, y) => (inRound(x, y, 0, 0, NX, upY, R) ? P.Plate : 0));
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
  return V;
}

/** The keys stamped on a copy of the base: a cap per key rect, 1 mm proud of its plate (or flush when pressed); its top edge shows by the tilt. */
function withKeys(V0: Vox, S: Shell, keys: KeyRect[], down: (k: Key) => boolean, ids: Map<number, Key>): Vox {
  const V = V0.copy(), upY = UP_ROWS * MMY;
  keys.forEach(([k, cx, cy, cw, ch], n) => {
    const x0 = cx * MMX, y0 = cy * MMY, x1 = (cx + cw) * MMX, y1 = (cy + ch) * MMY, onUp = y0 < upY;
    const face = onUp ? LOW + UP - 1 : LOW - 1, z = down(k) ? face : face + 1;
    const col = KEY0 + n;
    ids.set(col, k);
    const r = S.keys === 'pebble' || (S.dpad === 'ring' && k === 'ok') ? 1.6 : 0.8;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      // a hair of the plate between keys side by side; the corners rounded
      if (!inRound(x + 0.5, y + 0.5, x0 + 0.15, y0 + 0.3, x1 - 0.15, y1 - 0.3, r)) continue;
      for (let zz = face; zz <= z; zz++) V.set(x, y, zz, col);
    }
  });
  return V;
}

let cache: { key: string; G: GBuf; ids: Map<number, Key> } | null = null;
/** The palette and the keys' light, kept while the look, its color and the keys under the cursor or pressed stay the same. */
let paint: { key: string; pal: VoxMat[]; mul: Float32Array } | null = null;
/** The body as last lit (x, y, r, g, b per pixel met), kept while the light stays the same (standing still). */
let lit: { key: string; px: Float32Array; n: number } | null = null;

/**
 * The body into the HD layer (put: x, y in the layer's pixels), its top-left at cell (ox, oy). Keys
 * sunk come from `down`; a key under the cursor is lit a little (`hover`). The geometry is cast again
 * only when the look or the keys pressed change.
 */
export function drawBody3d(put: (x: number, y: number, r: number, g: number, b: number) => void, ox: number, oy: number, S: Shell, look: number, body: C3,
  keys: KeyRect[], down: (k: Key) => boolean, hover: Key | null, L: VoxLight) {
  const pressed = keys.filter(([k]) => down(k)).map(([k]) => k).join(',');
  const ck = `${look}|${pressed}`;
  if (!cache || cache.key !== ck) {
    const ids = new Map<number, Key>();
    const V = withKeys(base(S), S, keys, down, ids);
    cache = { key: ck, ids, G: castVox(V, { w: PHONE_W * HD, h: PHONE_H * HD, sx: MMX / HD, sy: MMY / HD, yaw: YAW, pitch: PITCH }) };
  }
  const pk = `${ck}|${hover}|${body}`;
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
    // the keys: their caps, the arrows of a ring d-pad in its trim; one under the cursor lit, one pressed darker
    const mul = new Float32Array(256).fill(1);
    for (const [id, k] of cache.ids) {
      pal[id] = { col: S.dpad === 'ring' && (k === 'up' || k === 'down' || k === 'left' || k === 'right') ? S.trim : S.cap, gloss: 0.5 };
      mul[id] = down(k) ? 0.6 : hover === k ? 1.3 : 1;
    }
    paint = { key: pk, pal, mul };
  }
  const q = (v: number) => Math.round(v * 64);
  const lk = `${pk}|${q(L.rgb[0])},${q(L.rgb[1])},${q(L.rgb[2])},${q(L.lat)},${q(L.str)},${q(L.glint[0])},${q(L.glint[1])},${q(L.glint[2])}`;
  if (!lit || lit.key !== lk) {
    const G = cache.G, px = lit?.px.length === G.w * G.h * 5 ? lit.px : new Float32Array(G.w * G.h * 5);
    let n = 0;
    shadeVox(G, paint.pal, L, (x, y, r, g, b) => { px[n++] = x; px[n++] = y; px[n++] = r; px[n++] = g; px[n++] = b; }, paint.mul);
    lit = { key: lk, px, n };
  }
  const X0 = ox * HD, Y0 = oy * HD, A = lit.px;
  for (let i = 0; i < lit.n; i += 5) put(X0 + A[i], Y0 + A[i + 1], A[i + 2], A[i + 3], A[i + 4]);
}
