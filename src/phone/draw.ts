import { compass, cityName, operatorName, diagonalName, districtName, landmarkName, roadName } from '../locale/names';
import { type CharGrid } from '../render/grid';
import { diagS, districtAt, nearestRoad, SIDEWALK } from '../sim/city';
import { calendar } from '../sim/clock';
import { app, menu } from './apps';
import { box, CHROME, lerp, PICK, PICK_DIM, PICK_INK, vgrad, wallpaper } from './ui';
import { applyTheme, BAD, BAR, hdLayer, bigText, ch, DAYS, hhmm, INK, LCD, Lcd, MONTHS, SH, softKeys, statusBar, SW, T, typed, type C3 } from './lcd';
import { type World } from '../sim/world';
import { Ground, groundAt, MAP_RES, mapRaster, type MapRaster } from './mapdata';
import { BOOT_LOG_S, fmtDist, INDOOR_ROW_M, ZOOM_ROW_M, type Key, type Phone } from './phone';
import { cellAt, DOOR, planOf, type RoomKind } from '../sim/interior';
import { hash3 } from '../core/rng';
import { BOARDS } from '../sim/device';
import { HD } from '../render/hd';
import { BLOCK, SHAPE } from '../render/atlas';
import { CASES, inBox, KEYS_Y, keysOf, PHONE_H, PHONE_W, SHELLS, type Case, type KeyRect } from './shells';

/**
 * The phone drawn in the player's hand, over the bottom right of the view: a 2008 handset with a
 * colour screen above a d-pad, soft keys, call and end keys and the number keys, whose bottom row
 * runs off the screen. Its body is one of the shells (shells.ts), maybe in a case. Keys light while
 * the phone is on and sink when pressed. The screen is a small character display of its own; its
 * text types in and the map draws in, as on a slow phone. It sits in the scene's light (VIEW_LIGHT:
 * street lamps, signs, headlights, the room's lamps), with a lit rim on top and left, and a sheen on
 * its body and its glass that slides as you turn, stronger the glossier the material.
 */
export { PHONE_W };
/** How much of it shows when held up (the rest is below the screen edge). */
const SHOWN = 46;
const SX = 4, SY = 4;
const MAP_ROWS = SH - 4;
/** Metres the map shows across and down, for a cell aspect (width / height) and zoom (a column is the cell aspect of a row, so nothing is stretched). */
export const mapView = (aspect: number, zoom: number, indoor = false): [number, number] => {
  const r = (indoor ? INDOOR_ROW_M : ZOOM_ROW_M)[zoom];
  return [SW * r * aspect, MAP_ROWS * r];
};

const keyRects = new Map<number, KeyRect[]>();
const keysFor = (look: number) => { let k = keyRects.get(look); if (!k) keyRects.set(look, (k = keysOf(SHELLS[look]))); return k; };

/** Where the phone's top left corner is on the grid: held up higher while typing, the whole keypad in sight. */
function origin(cols: number, rows: number, P: Phone): [number, number] {
  const e = 1 - (1 - P.raise) ** 3;
  // vibrating: the phone shakes in the hand in the same bursts as the buzz (0.47 s on every 0.8 s)
  const t = performance.now() / 1000, u = P.buzzUntil - t, on = u > 0 && (P.buzzLen - u) % 0.8 < 0.47;
  const sx = on ? (Math.floor(t * 34) % 2 ? 1 : -1) : 0, sy = on && Math.floor(t * 23) % 3 === 0 ? 1 : 0;
  const peek = Math.round(9 * (1 - (1 - P.peek) ** 3));
  return [cols - PHONE_W - 6 + sx, rows - Math.max(peek, Math.round((SHOWN + (PHONE_H - SHOWN) * P.lift) * e)) + sy];
}

/** The key under a grid cell, if any. */
export function keyAt(cols: number, rows: number, P: Phone, x: number, y: number): Key | null {
  const [ox, oy] = origin(cols, rows, P);
  // the arrows are thin: their hit areas reach a row (or two columns) further out than they are drawn
  const grow: Partial<Record<Key, [number, number, number, number]>> = { up: [0, -1, 0, 1], down: [0, 0, 0, 1], left: [-2, 0, 2, 0], right: [0, 0, 2, 0] };
  for (const [k, x0, y0, w, h] of keysFor(P.look)) {
    const [gx, gy, gw, gh] = grow[k] ?? [0, 0, 0, 0];
    if (x >= ox + x0 + gx && x < ox + x0 + gx + w + gw && y >= oy + y0 + gy && y < oy + y0 + gy + h + gh) return k;
  }
  return null;
}

const BEZEL: C3 = [7, 7, 9];
const mul = (c: C3, k: number): C3 => [c[0] * k, c[1] * k, c[2] * k];
const lum = (c: C3) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
/** How much of the scene's glint a material gives back. */
const GLOSS: Record<string, number> = { matte: 0.2, gloss: 0.6, metal: 0.42, rubber: 0.05, clear: 0.9 };

/** The glint and the eye's adaptation, eased over time so they do not jump from frame to frame. */
const GL = { lat: 0, str: 0, r: 1, g: 1, b: 1, back: 0, adapt: 1, at: 0 };

/** Where this frame drew the phone's lit screen (interface cells: x, y, w, h), for the bloom; null when off or not drawn. */
export const SCREEN: { at: number[] | null } = { at: null };

export function drawPhone(g: CharGrid, P: Phone, world: World, aspect: number, now: number, light: Float32Array, glint: Float32Array) {
  if (P.raise < 0.01 && P.peek < 0.01) return;
  const [ox, oy] = origin(g.cols, g.rows, P);
  applyTheme(P.prefs.theme);
  const SHL = SHELLS[P.look], KEYS = keysFor(P.look), CY = KEYS_Y;
  // the body in the shell's color (or the model's), the face of a slider above its seam
  const BODY: C3 = SHL.body ?? P.device.body, FACE: C3 = SHL.face ?? BODY;
  const Lr = light[0], Lg = light[1], Lb = light[2], Lm = (Lr + Lg + Lb) / 3;
  const dt = Math.min(0.1, Math.max(0, now - GL.at)), q = 1 - Math.exp(-dt / 0.25);
  GL.at = now;
  GL.lat += (glint[0] - GL.lat) * q; GL.str += (glint[1] - GL.str) * q;
  GL.back += (glint[5] - GL.back) * q; GL.r += (glint[2] - GL.r) * q; GL.g += (glint[3] - GL.g) * q; GL.b += (glint[4] - GL.b) * q;
  // the eye adapts in a second or two: in the dark the screen looks brighter and blooms, under a
  // strong light it looks a little dimmer
  GL.adapt += (Lm - GL.adapt) * (1 - Math.exp(-dt / 1.5));
  // (capped: a bright page must not wash out in the dark, see the ceiling on the glass below)
  const gain = Math.min(1.18, Math.max(0.6, 1.6 - 0.7 * GL.adapt)), bloom = 0.6 * Math.min(1, Math.max(0, (0.9 - GL.adapt) / 0.5));
  // the glint: the brightest light nearby mirrored in the phone, a soft diagonal band on the side
  // it comes from, in its color, stronger for a light behind the player
  const s0 = 34 + GL.lat * 22, amp = GL.str * 55;
  const sheen = (x: number, y: number) => Math.exp(-(((x + y * 0.55 - s0) / 5) ** 2));
  const inG = (x: number, y: number) => { const gx = ox + x, gy = oy + y; return gx >= 0 && gy >= 0 && gx < g.cols && gy < g.rows ? gy * g.cols + gx : -1; };
  // a cell of the phone's surface: lit by the scene, darker toward the bottom, the glint on top in
  // proportion to its gloss; `glow` is light of its own (backlit key labels) the scene does not dim
  const cell = (x: number, y: number, c: number, fg: C3, bg: C3, gloss = 0.25, glow = false) => {
    const i = inG(x, y);
    if (i < 0) return;
    const k = 1 - (y / PHONE_H) * 0.25, sh = sheen(x, y) * gloss * amp;
    g.setBg(i, bg[0] * Lr * k + sh * GL.r, bg[1] * Lg * k + sh * GL.g, bg[2] * Lb * k + sh * GL.b);
    if (glow) g.put(i, c, Math.max(fg[0], fg[0] * Lr), Math.max(fg[1], fg[1] * Lg), Math.max(fg[2], fg[2] * Lb));
    else g.put(i, c, fg[0] * Lr * k + sh * GL.r, fg[1] * Lg * k + sh * GL.g, fg[2] * Lb * k + sh * GL.b);
  };
  // a glyph alone, lit the same way, over what is behind it (a rounded corner: outside it, the world)
  const over = (x: number, y: number, c: number, fg: C3, gloss = 0.25) => {
    const i = inG(x, y);
    if (i < 0) return;
    const k = 1 - (y / PHONE_H) * 0.25, sh = sheen(x, y) * gloss * amp;
    g.put(i, c, fg[0] * Lr * k + sh * GL.r, fg[1] * Lg * k + sh * GL.g, fg[2] * Lb * k + sh * GL.b);
  };
  // the glint's light added to a cell's background; a cell darkened by a shadow
  const addBg = (x: number, y: number, v: number) => {
    const i = inG(x, y);
    if (i < 0) return;
    const k = i * 4;
    g.bg[k] += v * GL.r; g.bg[k + 1] += v * GL.g; g.bg[k + 2] += v * GL.b;
  };
  const shade = (x: number, y: number, f: number) => {
    const i = inG(x, y);
    if (i < 0) return;
    const k = i * 4;
    for (let c = 0; c < 3; c++) { g.bg[k + c] *= 1 - f; g.cells[k + c + 1] *= 1 - f; }
  };
  const gl = GLOSS[SHL.material], W1 = PHONE_W - 1, H1 = PHONE_H - 1, R = SHL.round;
  const inBody = (x: number, y: number) => inBox(x, y, 0, 0, W1, H1, R);
  const surface = (_x: number, y: number): C3 => (SHL.face && y < CY - 1 ? FACE : BODY);
  // the body, rounded at the corners: its rim catches the light on top and left, falls dark on the right
  for (let y = 0; y < PHONE_H; y++) for (let x = 0; x < PHONE_W; x++) {
    const v = inBody(x, y);
    if (!v) continue;
    const base = surface(x, y);
    const rimL = !inBody(x - 1, y), rimR = !inBody(x + 1, y), rimT = !inBody(x, y - 1);
    let col: C3 = rimT || rimL ? [base[0] * 1.5 + 18, base[1] * 1.5 + 18, base[2] * 1.5 + 18] : rimR ? mul(base, 0.6) : base;
    let glyph = 32, fg = col;
    if (SHL.material === 'metal' && !rimL && !rimR && !rimT) {
      // brushed metal: rows of slightly different shades, a fine streak now and then
      const s = 1 + (hash3(y, x >> 3, 91) - 0.5) * 0.1;
      col = mul(col, s);
      if (hash3(y, x, 92) < 0.18) { glyph = ch('-'); fg = mul(col, 1.12); }
    } else if (SHL.material === 'rubber' && (x < 3 || x > W1 - 3) && y > 4 && !rimL && !rimR) { glyph = ch('='); fg = mul(col, 0.7); }
    if (v === 1) cell(x, y, glyph, fg, col, rimL || rimR || rimT ? 0.9 : gl);
    else over(x, y, v, col, 0.9);
  }
  // a slider's seam: the upper half's edge, its shadow on the lower
  if (SHL.face) for (let x = 0; x < PHONE_W; x++) if (inBody(x, CY - 1) === 1) { cell(x, CY - 2, 32, mul(FACE, 1.6), mul(FACE, 1.6), 0.9); shade(x, CY - 1, 0.45); }
  // a rugged phone's bumpers and screws
  if (SHL.material === 'rubber') {
    for (const [x0, y0] of [[0, 0], [W1 - 4, 0]]) for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) { const v = inBody(x0 + x, y0 + y); if (v === 1) cell(x0 + x, y0 + y, 32, SHL.trim, SHL.trim, 0.3); else if (v) over(x0 + x, y0 + y, v, SHL.trim, 0.3); }
    for (const [x, y] of [[2, 4], [W1 - 2, 4]]) cell(x, y, ch('+'), [150, 150, 150], mul(BODY, 0.8), 0.6);
  }
  // earpiece, front camera, maker's name (dark on a light body)
  const top = surface(0, 1), dark = lum(top) > 130;
  if (SHL.name === 'Pebble') for (let x = 21; x < 29; x += 2) cell(x, 1, SHAPE.dot, mul(top, 0.55), top, gl);
  else for (let x = 20; x < 30; x++) cell(x, 1, ch('='), [16, 16, 18], [20, 20, 23], 0.6);
  cell(38, 1, ch('o'), [70, 80, 100], [12, 12, 14], 0.8);
  const brand = P.maker.toUpperCase().split('').join(' ');
  for (let k = 0; k < brand.length; k++) cell(25 - (brand.length >> 1) + k, 2, brand.charCodeAt(k), dark ? [80, 76, 84] : [150, 156, 168], top, gl);
  // the screen's surround: a chrome ring on some, then the black bezel, rounded
  if (SHL.chrome) for (let y = SY - 2; y <= SY + SH + 1; y++) for (let x = SX - 2; x <= SX + SW + 1; x++) {
    const v = inBox(x, y, SX - 2, SY - 2, SX + SW + 1, SY + SH + 1, 1);
    if (v === 1) cell(x, y, 32, SHL.trim, SHL.trim, 0.95); else if (v) cell(x, y, v, SHL.trim, surface(x, y), 0.95);
  }
  for (let y = SY - 1; y <= SY + SH; y++) for (let x = SX - 1; x <= SX + SW; x++) {
    const v = inBox(x, y, SX - 1, SY - 1, SX + SW, SY + SH, 1);
    if (v === 1) cell(x, y, 32, BEZEL, BEZEL, 0.7); else if (v) cell(x, y, v, BEZEL, SHL.chrome ? SHL.trim : surface(x, y), 0.7);
  }

  // keys: lit from behind while the phone is on, sunk for a moment when pressed
  const on = P.screen !== 'off';
  const isDown = (k: Key) => { const t = P.pressed.get(k); return t !== undefined && now - t < 0.14; };
  const ring = SHL.dpad === 'ring', onRing = (k: Key) => ring && (k === 'up' || k === 'down' || k === 'left' || k === 'right');
  // a ring d-pad: a rounded ring of trim around OK, its four sides the arrows
  if (ring) for (let y = CY; y <= CY + 4; y++) for (let x = 16; x <= 33; x++) {
    const v = inBox(x, y, 16, CY, 33, CY + 4, 2);
    const k: Key | null = y === CY ? 'up' : y === CY + 4 ? 'down' : x < 21 ? 'left' : x > 28 ? 'right' : null;
    const hot = k && (isDown(k) ? 0.55 : P.hover === k ? 1.25 : 1);
    const c = mul(SHL.trim, hot || 1);
    if (v === 1) cell(x, y, 32, c, c, 0.8); else if (v) cell(x, y, v, c, surface(x, y), 0.8);
  }
  // first the keys' shadows on the body, cast away from the light: sideways by the light's side,
  // down for a light ahead (from above the phone), up for one behind (always some, from the room
  // around); then the caps over them, so a shadow never darkens a neighbouring key. Flush keys
  // have no shadows: dark lines run between them instead.
  const vx = -GL.lat, vy = Math.max(-1, Math.min(1, 0.55 - 0.9 * GL.back)), darkS = 0.2 + 0.4 * GL.str;
  const sx = Math.abs(vx) > 0.3 ? Math.sign(vx) : 0, sy = Math.abs(vy) > 0.3 ? Math.sign(vy) : 0;
  const flush = SHL.keys === 'flush';
  for (const [k, x0, y0, w, h] of KEYS) {
    if (isDown(k) || onRing(k) || (flush && k.length === 1 && /[0-9*#]/.test(k))) continue;
    const ex = sx > 0 ? x0 + w : x0 - 1, ey = sy > 0 ? y0 + h : y0 - 1;
    if (sx) for (let y = 0; y < h; y++) shade(ex, y0 + y, darkS * Math.abs(vx));
    if (sy) for (let x = 0; x < w; x++) shade(x0 + x, ey, darkS * Math.abs(vy));
    if (sx && sy) shade(ex, ey, darkS * Math.min(Math.abs(vx), Math.abs(vy)));
  }
  if (flush) {
    for (let y = CY + 6; y < CY + 18; y++) for (const x of [17, 32]) shade(x, y, 0.5);
    for (const y of [CY + 8, CY + 11, CY + 14]) for (let x = 3; x < 47; x++) shade(x, y, 0.5);
  }
  // the caps in relief, unless pushed in: lit along the top edge; the edge facing the nearest light
  // catches its glint; lit from behind while the phone is on; pebbles rounded at the corners
  const side = GL.lat > 0 ? 1 : 0, rim = GL.str * Math.min(1, Math.abs(GL.lat) * 1.6) * 60;
  for (const [k, x0, y0, w, h, label, col] of KEYS) {
    const down = isDown(k), fg: C3 = col ?? (on ? SHL.label : SHL.labelOff);
    if (onRing(k)) { cell(x0 + (w >> 1), y0 + ((h - 1) >> 1), ch(label), down ? mul(fg, 0.7) : fg, mul(SHL.trim, down ? 0.55 : P.hover === k ? 1.25 : 1), 0.8, on); continue; }
    const hov = P.hover === k && !down ? 1.3 : 1;
    const capAt = (y: number): C3 => mul(down ? mul(SHL.cap, 0.45) : y === 0 && h > 1 ? SHL.capTop : SHL.cap, hov);
    const pebble = (SHL.keys === 'pebble' || (ring && k === 'ok')) && h > 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = pebble ? inBox(x, y, 0, 0, w - 1, h - 1, 1) : 1;
      if (v === 1) cell(x0 + x, y0 + y, 32, fg, capAt(y), 0.5);
      else if (v) cell(x0 + x, y0 + y, v, capAt(y), ring && k === 'ok' ? SHL.trim : surface(x0 + x, y0 + y), 0.5);
      if (!down && rim > 1 && x === side * (w - 1) && v === 1) addBg(x0 + x, y0 + y, rim);
    }
    const lx = x0 + ((w - label.length) >> 1), ly = y0 + ((h - 1) >> 1);
    for (let n = 0; n < label.length; n++) if (label[n] !== ' ') cell(lx + n, ly, label.charCodeAt(n), down ? mul(fg, 0.7) : fg, capAt(ly - y0), 0.5, on);
  }
  // the case: over the body's rim and around it, so only its own rim shows from the front
  if (P.case) drawCase(CASES[P.case], R, now, cell, over, inG, g);

  // the screen
  const S = new Lcd(g, ox + SX, oy + SY);
  SCREEN.at = on ? [ox + SX, oy + SY, SW, SH] : null;
  if (!on) for (let y = 0; y < SH; y++) S.fill(y, [5, 6, 8]);
  else {
    for (let y = 0; y < SH; y++) S.fill(y, LCD);
    const t = now - P.since;
    if (P.screen === 'boot') boot(S, P, world, t);
    else {
      statusBar(S, world, P.gps.state, now, P.radio, P.inbox.some((m) => !m.read), P.wifi);
      if (P.screen === 'standby') standby(S, P, world, t, now);
      else if (P.screen === 'menu') menu(S, P, t);
      else if (P.screen === 'map') map(S, P, world, aspect, t, now);
      else if (P.screen === 'places') places(S, P, world, t);
      else app(S, P, world, t, now);
    }
  }
  // the glass over the screen: the eye's adaptation, a faint wash of the scene's light, and the glint
  let ar = 0, ag = 0, ab = 0, n = 0;
  const H = hdLayer();
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const gx = ox + SX + x, gy = oy + SY + y;
    if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) continue;
    const k = (gy * g.cols + gx) * 4, sh = sheen(SX + x, SY + y) * amp * 0.45, C = g.cells, B = g.bg;
    // the glass's ceiling: past 200 the light rolls off, so the brightest pages keep their detail
    const roll = (v: number) => (v > 200 ? 200 + (v - 200) * 0.35 : v);
    for (let c = 1; c < 4; c++) C[k + c] = roll(C[k + c] * gain);
    for (let c = 0; c < 3; c++) B[k + c] = roll(B[k + c] * gain);
    ar += B[k] + C[k + 1] * 0.3; ag += B[k + 1] + C[k + 2] * 0.3; ab += B[k + 2] + C[k + 3] * 0.3; n++;
    // fingerprints: smudges on the glass that catch the scene's light (and the glint)
    const fp = smudge(x, y) * (14 + sh * 0.6);
    B[k] += 3 * Lr + sh * GL.r + fp * Lr; B[k + 1] += 3 * Lg + sh * GL.g + fp * Lg; B[k + 2] += 4 * Lb + sh * GL.b + fp * Lb;
    C[k + 1] += sh * 0.5 * GL.r; C[k + 2] += sh * 0.5 * GL.g; C[k + 3] += sh * 0.5 * GL.b;
    // the HD pixels over this cell (a photo) under the same glass
    if (H) for (let iy = 0; iy < HD; iy++) for (let ix = 0; ix < HD; ix++) {
      const q = H.at(gx * HD + ix, gy * HD + iy);
      if (q < 0) continue;
      const X = H.px;
      for (let c = 0; c < 3; c++) X[q + c] = roll(X[q + c] * gain);
      X[q] += 3 * Lr + sh * GL.r + fp * Lr; X[q + 1] += 3 * Lg + sh * GL.g + fp * Lg; X[q + 2] += 4 * Lb + sh * GL.b + fp * Lb;
    }
  }
  if (bloom > 0.01 && n && on) {
    // bloom in the dark: the screen's own light haloes over the glass and spills on the bezel around it
    ar /= n; ag /= n; ab /= n;
    for (let y = SY - 3; y <= SY + SH + 2; y++) for (let x = SX - 3; x <= SX + SW + 2; x++) {
      const gx = ox + x, gy = oy + y;
      if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) continue;
      const d = Math.max(SX - x, x - (SX + SW - 1), SY - y, y - (SY + SH - 1), 0);
      const w = bloom * (d === 0 ? 0.22 : 0.85 / (d + 0.5)), k = (gy * g.cols + gx) * 4;
      g.bg[k] += ar * w; g.bg[k + 1] += ag * w; g.bg[k + 2] += ab * w;
      // the glyphs there too (the bezel's rounded corners), so the halo does not leave them dark
      if (d > 0) { g.cells[k + 1] += ar * w; g.cells[k + 2] += ag * w; g.cells[k + 3] += ab * w; }
    }
  }
}

type CellFn = (x: number, y: number, c: number, fg: C3, bg: C3, gloss?: number, glow?: boolean) => void;
type OverFn = (x: number, y: number, c: number, fg: C3, gloss?: number) => void;
/**
 * A case: a rounded rim two columns and a row wider than the body, over the body's outer cells,
 * lit like the body. Leather is stitched, a bumper ridged, glitter twinkles as the light moves;
 * clear plastic tints the body under it and lies over the world as a thin film.
 */
function drawCase(K: Case, R: number, now: number, cell: CellFn, over: OverFn, inG: (x: number, y: number) => number, g: CharGrid) {
  const W1 = PHONE_W - 1, H1 = PHONE_H - 1, gl = GLOSS[K.material], col = K.color;
  for (let y = -1; y <= H1 + 1; y++) for (let x = -2; x <= W1 + 2; x++) {
    const o = inBox(x, y, -2, -1, W1 + 2, H1 + 1, R + 1);
    if (!o) continue;
    const n = inBox(x, y, 1, 1, W1 - 1, H1, Math.max(1, R));
    if (n === 1) continue;
    const i = inG(x, y);
    if (i < 0) continue;
    if (K.material === 'clear') {
      // over the body: its color tinted; past it, a film over the world
      if (g.bg[i * 4 + 3] === 255 && !(x < 0 || x > W1 || y < 0)) { const k = i * 4; for (let c = 0; c < 3; c++) g.bg[k + c] = g.bg[k + c] * 0.8 + col[c] * 0.12; }
      else over(x, y, BLOCK.light, col, gl);
      continue;
    }
    const h = hash3(x, y, 93), solid = o === 1 && !n;
    let glyph = 32, fg: C3 = col;
    if (K.pattern === 'stitch' && solid && (x === -1 || x === W1 + 1 || y === 0) && (x + y) % 2 === 0) { glyph = ch(y === 0 ? '-' : ':'); fg = [196, 150, 100]; }
    else if (K.pattern === 'ridge' && solid && (x < 0 || x > W1) && y % 2 === 0) { glyph = ch('='); fg = mul(col, 2.2); }
    else if (K.pattern === 'glitter' && solid && h < 0.3) { const tw = 0.5 + 0.5 * Math.sin(now * 3 + h * 40); glyph = ch(h < 0.08 ? '*' : h < 0.18 ? '+' : '.'); fg = [255, 200 + 55 * tw, 240]; }
    if (o !== 1) over(x, y, o, col, gl);
    else if (n) {
      // the body's corner shows through the case's: its color over the case's
      const k = i * 4, b: C3 = [g.bg[k], g.bg[k + 1], g.bg[k + 2]];
      cell(x, y, n, [0, 0, 0], col, gl);
      g.put(i, n, b[0], b[1], b[2]);
    } else cell(x, y, glyph, fg, col, gl, glyph !== 32 && K.pattern === 'glitter');
  }
}

/**
 * Power on, in two stages. First the board's bootloader checks the hardware (the board is bought in,
 * so its screen is the same on phones of different makers: three loaders, three looks); only what is
 * fitted is listed, and a part shows a fault only when it fails. Then the maker's splash, in the
 * maker's own style.
 */
function boot(S: Lcd, P: Phone, world: World, t: number) {
  if (t < 0) { for (let y = 0; y < SH; y++) S.fill(y, [5, 6, 8]); return; }
  const D = P.device;
  if (t >= BOOT_LOG_S) return splash(S, D.maker, P.maker.toUpperCase(), D.model.toUpperCase(), t - BOOT_LOG_S);
  mapRaster(world.city); // the map database loads during the check (built once per city)
  // the parts the board finds, each with whether it passed (all do, until something can break)
  const L: [string, boolean][] = [
    ['bootrom: signature', true],
    [`cpu0: ${D.cpu} @ ${D.cpuMHz}MHz`, true],
    [`mem: ${D.ramMB}MB SDRAM`, true],
    [`nand: ${D.flashMB}MB, 0 bad blocks`, true],
    ['fs: mounting /system /data', true],
    [`lcd: ${D.screen} 18bpp`, true],
    ['keypad: 21 keys, backlight', true],
    ['audio: codec, vibra motor', true],
  ];
  if (D.cameraMP) L.push([`cam: ${D.cameraMP.toFixed(1)}MP sensor`, true]);
  if (D.gps) L.push([`gps: ${D.gps}`, true]);
  if (D.wlan) L.push([`wlan: ${D.wlan} module`, true]);
  L.push([`modem: ${D.radio}`, true], ['sim: card present, PIN off', true], [`maps: ${cityName(world.city).toLowerCase()}`, true], ['ui: starting shell', true]);
  const loader = BOARDS[D.board];
  // how far the check has got: each line typed in, then its result
  let left = Math.floor(t * (D.board === 1 ? 360 : 420)), shown = 0;
  const out: [string, boolean, boolean][] = [];
  for (let k = 0; k < L.length && left >= 0; k++) {
    const full = D.board === 0 ? `${(0.04 + k * 0.137 + (k * k) * 0.011).toFixed(3).padStart(6)} ${L[k][0]}` : L[k][0];
    out.push([full.slice(0, left), L[k][1], left >= full.length]);
    left -= full.length + 4; shown = k + 1;
  }
  const f = shown / L.length, cursor = Math.floor(t * 8) & 1;
  if (D.board === 1) {
    // a plain loader: grey text on black, dot leaders to the result, a bar of hashes with a percentage
    const BG: C3 = [0, 0, 0];
    for (let y = 0; y < SH; y++) S.fill(y, BG);
    const head = `${loader} v1.07`;
    S.center(1, head, [220, 220, 220], BG);
    S.center(2, '-'.repeat(head.length + 4), [90, 90, 90], BG);
    const rows = SH - 8;
    out.slice(-rows).forEach(([txt, ok, done], n) => {
      const y = 4 + n, name = txt.slice(0, SW - 8);
      S.text(1, y, name, [170, 170, 170], BG);
      if (done) {
        for (let x = 2 + name.length; x < SW - 6; x++) S.put(x, y, ch('.'), [70, 70, 70], BG);
        S.text(SW - 5, y, ok ? 'OK' : 'FAIL', ok ? [240, 240, 240] : [255, 80, 60], BG);
      } else if (cursor) S.put(1 + name.length, y, ch('_'), [200, 200, 200], BG);
    });
    const w = SW - 10, n = Math.round(f * w), pct = `${Math.round(f * 100)}%`.padStart(4);
    S.text(1, SH - 2, `[${'#'.repeat(n)}${'.'.repeat(w - n)}]${pct}`, [150, 150, 150], BG);
    return;
  }
  if (D.board === 2) {
    // a framed loader: teal on deep blue, a prompt per part, results in brackets, a segmented bar
    const BG: C3 = [4, 16, 28], TEAL: C3 = [70, 200, 210];
    for (let y = 0; y < SH; y++) S.fill(y, BG);
    for (let x = 1; x < SW - 1; x++) { S.put(x, 0, ch('='), [30, 90, 110], BG); S.put(x, 2, ch('='), [30, 90, 110], BG); }
    S.center(1, ` ${loader.toUpperCase()} `, TEAL, BG);
    const rows = SH - 7;
    out.slice(-rows).forEach(([txt, ok, done], n) => {
      const y = 3 + n;
      S.text(1, y, '>', TEAL, BG);
      S.text(3, y, txt.slice(0, SW - 12), [190, 220, 230], BG);
      if (done) { S.text(SW - 8, y, '[    ]', [70, 110, 130], BG); S.text(SW - 6, y, ok ? 'OK' : '!!', ok ? [90, 230, 120] : [255, 90, 70], BG); }
      else if (cursor) S.put(3 + Math.min(txt.length, SW - 12), y, ch('_'), TEAL, BG);
    });
    const segs = 16, n = Math.round(f * segs), x0 = (SW - segs * 2) >> 1;
    for (let k = 0; k < segs; k++) S.put(x0 + k * 2, SH - 2, 32, BG, k < n ? lerp([40, 150, 170], [120, 240, 230], k / segs) : [12, 34, 50]);
    return;
  }
  // the first loader: a dark panel, each part with its timestamp and a colored tag, a bar filling under it
  vgrad(S, 0, SH - 1, [14, 20, 34], [2, 3, 6]);
  S.fill(1, CHROME.top);
  S.text(1, 1, loader.toUpperCase(), CHROME.accent, CHROME.top);
  const ver = `${D.cpu} ${D.cpuMHz}MHz`;
  S.text(SW - ver.length - 1, 1, ver, CHROME.dim, CHROME.top);
  const y0 = 3, rows = SH - y0 - 4;
  box(S, 0, y0 - 1, SW - 1, y0 + rows, [6, 9, 16], (_x, y) => lerp([14, 20, 34], [2, 3, 6], y / (SH - 1)), 1);
  out.slice(-rows).forEach(([txt, ok, done], n) => {
    const y = y0 + n, bg: C3 = [6, 9, 16];
    S.text(1, y, txt.slice(0, 7), [90, 110, 140], bg);
    S.text(8, y, txt.slice(7, SW - 8), [200, 214, 232], bg);
    if (done) { const tag = ok ? T.ok : 'FAIL', tc: C3 = ok ? [40, 150, 80] : [180, 50, 40]; S.text(SW - tag.length - 3, y, ` ${tag} `, [240, 250, 245], tc); }
    else if (cursor) S.put(1 + Math.min(txt.length, SW - 3), y, ch('_'), INK, bg);
  });
  const w = SW - 6, n = Math.round(f * w), yb = SH - 2;
  for (let x = 0; x < w; x++) S.put(3 + x, yb, x < n ? 32 : SHAPE.dot, [60, 70, 90], x < n ? lerp([60, 140, 230], [120, 220, 255], x / w) : [4, 5, 8]);
}

/**
 * The maker's splash: one maker per body (shells.ts), each with its own, in the spirit of its body.
 * Classic: a deep blue field, the logo in amber with a gloss. Slate (glossy black, chrome): the logo
 * swept in by a white scan line, mirrored below as on black glass. Brushed (metal): a silver plate
 * with streaks, the logo stamped into it and lit along its lower edge. Pebble (soft, round): white,
 * pink circles swelling out, the logo in magenta, dots taking turns. Rugged (rubber, orange trim):
 * hazard stripes, the logo in orange stencil, a system check counting up. Slider (red gloss): the
 * logo slides in from the right over a red sweep, as the phone slides open. A name too long for the
 * big letters is spelled out.
 */
function splash(S: Lcd, style: number, maker: string, model: string, u: number) {
  const big = maker.length * 5 <= SW, sp = maker.split('').join(' ');
  const word = (y: number, col: C3, bg: (y: number) => C3, t = 1e9, dx = 0) => {
    if (big) bigText(S, y, maker, col, t, dx);
    else S.text(((SW - sp.length) >> 1) + dx, y + 3, typed(sp, t, 30), col, bg(y + 3));
  };
  const k = style % 6;
  if (k === 1) {
    // Slate: black glass; a white scan line reveals the logo, its reflection fainter below
    const BG: C3 = [0, 0, 0], W: C3 = [235, 240, 250];
    for (let y = 0; y < SH; y++) S.fill(y, BG);
    const sweep = Math.floor(Math.max(0, (u - 0.2) / 1.1) * (SW + 2));
    word(6, W, () => BG);
    // the reflection: the letters' lower rows mirrored, dim, fading
    if (big) for (let r = 0; r < 4; r++) for (let x = 0; x < SW; x++) {
      const cell = S.peek(x, 12 - r);
      if (cell) S.put(x, 13 + r, 32, BG, [cell[0] * (0.28 - r * 0.06), cell[1] * (0.28 - r * 0.06), cell[2] * (0.28 - r * 0.06)]);
    }
    for (let y = 5; y <= 17; y++) for (let x = Math.max(0, sweep); x < SW; x++) S.put(x, y, 32, BG, BG);
    if (sweep < SW) for (let y = 5; y <= 12; y++) S.put(sweep, y, 32, BG, [255, 255, 255]);
    if (u > 1.4) S.center(19, typed(model.split('').join(' '), u - 1.4, 40), [120, 126, 140], BG);
    const n = Math.round(Math.max(0, Math.min(1, (u - 1.2) / 1.4)) * 20);
    for (let x = 0; x < 20; x++) S.put(11 + x, 22, SHAPE.top, x < n ? W : [30, 32, 36], BG);
    return;
  }
  if (k === 2) {
    // Brushed: a silver plate with streaks; the logo stamped in, light catching its lower edge
    const plate = (x: number, y: number): C3 => { const v = 150 + (y / SH) * 30 + (hash3(y, 21, 4) - 0.5) * 22 + (hash3(x >> 3, y, 6) - 0.5) * 6; return [v, v + 3, v + 8]; };
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) S.put(x, y, 32, [0, 0, 0], plate(x, y));
    const press = Math.min(1, u / 0.8);
    if (big) { const e = 160 + 80 * press, s = 160 - 90 * press; bigText(S, 7, maker, [e, e + 2, e + 6]); bigText(S, 6, maker, [s, s + 4, s + 10]); }
    else S.text((SW - sp.length) >> 1, 9, sp, [60, 64, 72], plate(0, 9));
    if (u > 0.8) S.center(16, typed(model, u - 0.8, 30), [200, 130, 40], plate(0, 16));
    const n = Math.round(Math.max(0, Math.min(1, (u - 1) / 1.4)) * 24);
    for (let x = 0; x < 24; x++) S.put(9 + x, 20, 32, [0, 0, 0], x < n ? [255, 180, 80] : [110, 112, 118]);
    return;
  }
  if (k === 3) {
    // Pebble: white, soft pink circles swelling out from the middle, the logo in magenta, three dots
    const bgAt = (y: number): C3 => lerp([255, 255, 255], [250, 236, 244], y / SH);
    for (let y = 0; y < SH; y++) S.fill(y, bgAt(y));
    for (let c = 0; c < 3; c++) {
      const r = ((u * 9 + c * 6) % 18);
      for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
        const d = Math.hypot((x - SW / 2) * 0.55, y - 10);
        if (Math.abs(d - r) < 0.5) S.put(x, y, 32, [0, 0, 0], lerp(bgAt(y), [250, 190, 220], 0.5 * (1 - r / 18)));
      }
    }
    word(6, [210, 50, 140], bgAt, u - 0.3);
    if (u > 1) S.center(16, typed(model.toLowerCase(), u - 1, 30), [170, 110, 140], bgAt(16));
    const on = Math.floor(u * 3) % 3;
    if (u > 1.2) for (let q = 0; q < 3; q++) S.put((SW >> 1) - 2 + q * 2, 20, SHAPE.dot, q === on ? [230, 80, 160] : [235, 200, 220], bgAt(20));
    return;
  }
  if (k === 4) {
    // Rugged: hazard stripes top and bottom, the logo in orange stencil, a system check counting up
    const BG: C3 = [18, 18, 16], OR: C3 = [240, 130, 30];
    for (let y = 0; y < SH; y++) S.fill(y, BG);
    for (const y of [1, 2, SH - 3, SH - 2]) for (let x = 0; x < SW; x++) S.put(x, y, 32, BG, ((x + y + Math.floor(u * 8)) >> 1) % 3 === 0 ? OR : [30, 30, 26]);
    if (big) { bigText(S, 7, maker, [0, 0, 0], u - 0.2); bigText(S, 6, maker, OR, u - 0.2); for (let x = 0; x < SW; x++) S.put(x, 9, 32, BG, BG); } // the stencil's bridge across the letters
    else S.text((SW - sp.length) >> 1, 9, typed(sp, u - 0.2, 30), OR, BG);
    if (u > 0.8) S.center(15, typed(`${model}  //  FIELD READY`, u - 0.8, 40), [200, 196, 180], BG);
    const pct = Math.min(100, Math.max(0, Math.round((u - 1) / 1.4 * 100)));
    if (u > 1) S.center(18, `SYSTEM CHECK ${String(pct).padStart(3)}%`, pct === 100 ? [140, 220, 90] : OR, BG);
    return;
  }
  if (k === 5) {
    // Slider: a dark field warming to red; the logo slides in from the right over a red sweep
    const bgAt = (y: number): C3 => lerp([8, 4, 6], [70, 10, 18], Math.min(1, u / 1.2) * (y / SH));
    for (let y = 0; y < SH; y++) S.fill(y, bgAt(y));
    const slide = Math.max(0, 1 - Math.min(1, (u - 0.2) / 0.7)), dx = Math.round(slide * slide * SW);
    for (let x = 0; x < SW; x++) if (x > SW - dx - 6 && x < SW - dx) S.put(x, 12, SHAPE.top, [220, 30, 50], bgAt(12));
    word(5, [245, 235, 238], bgAt, 1e9, dx);
    if (u > 1) S.center(15, typed(model, u - 1, 30), [220, 150, 160], bgAt(15));
    const n = Math.round(Math.max(0, Math.min(1, (u - 1.1) / 1.3)) * 26);
    for (let x = 0; x < 26; x++) S.put(8 + x, 20, 32, [0, 0, 0], x < n ? lerp([180, 20, 40], [255, 90, 100], x / 26) : [30, 8, 12]);
    return;
  }
  // Classic: a deep blue field brightening from the top, the logo in amber with a shadow and a gloss, the model on a chip, a rounded bar
  const f = Math.min(1, u / 0.5);
  const bgAt = (y: number): C3 => { const q = f * (1 - y / SH); return [6 + 18 * q, 10 + 34 * q, 20 + 70 * q]; };
  for (let y = 0; y < SH; y++) S.fill(y, bgAt(y));
  const g = Math.min(1, u * 2), lo: C3 = [255 * g, 170 * g, 60 * g], hi: C3 = [255 * g, 226 * g, 150 * g];
  if (big) {
    bigText(S, 7, maker, [0, 0, 0], u - 0.2, 1);
    bigText(S, 6, maker, lo, u - 0.2);
    bigText(S, 6, maker, hi, Math.min(u - 0.2, 2.5 / 30));
  } else S.text((SW - sp.length) >> 1, 9, typed(sp, u - 0.2, 30), lo, bgAt(9));
  if (u > 0.6) { const m = typed(model, u - 0.6, 30), x0 = ((SW - model.length) >> 1) - 2; box(S, x0, 15, x0 + model.length + 3, 15, [20, 30, 52], bgAt(15), 1); S.text(x0 + 2, 15, m, [210, 222, 240], [20, 30, 52]); }
  const w = 26, x0 = (SW - w) >> 1, n = Math.round(Math.max(0, Math.min(1, (u - 0.9) / 1.5)) * (w - 2));
  box(S, x0, 19, x0 + w - 1, 19, [14, 20, 34], bgAt(19), 1);
  for (let x = 0; x < n; x++) S.put(x0 + 1 + x, 19, 32, [0, 0, 0], lerp([255, 150, 50], [255, 220, 120], x / w));
}

/**
 * The standby screen: the wallpaper, the time big over it with a shadow, the date and the network
 * on glass chips, and cards for what is waiting (missed calls, unread texts, the next reminder).
 */
function standby(S: Lcd, P: Phone, world: World, t: number, now: number) {
  wallpaper(S, P.prefs.wall, 1, SH - 2, world.time, now);
  const c = calendar(world.time), CHIP: C3 = [10, 14, 24];
  bigText(S, 4, hhmm(c.hour), [0, 0, 0], t, 1);
  bigText(S, 3, hhmm(c.hour), [255, 255, 255], t);
  const date = `${DAYS[c.weekday]} ${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${c.year}`;
  // the network it is on, as phones then showed it under the clock
  const R = P.radio, op = R.state === 'service' ? operatorName(world.city).toUpperCase() : R.state === 'search' ? (Math.floor(now * 2) & 1 ? T.apps.searching : '') : T.noService;
  const chip = (y: number, s: string, fg: C3) => {
    if (!s) return;
    const x0 = ((SW - s.length) >> 1) - 2;
    box(S, x0, y, x0 + s.length + 3, y, CHIP, CHIP, 0);
    S.text(x0 + 2, y, s, fg, CHIP);
  };
  if (t > 0.2) chip(11, typed(date, t - 0.2), [220, 228, 240]);
  if (t > 0.5) chip(13, typed(op, t - 0.5), R.state === 'service' ? [150, 200, 255] : [255, 120, 90]);
  // what is waiting, as cards
  const cards: [string, string, C3][] = [];
  if (P.missed) cards.push([')))', (P.missed > 1 ? T.apps.missedN : T.apps.missed).replace('{n}', String(P.missed)), [255, 120, 90]]);
  const unread = P.inbox.filter((m) => !m.read).length;
  if (unread) cards.push(['[=]', `${unread} ${unread > 1 ? T.apps.newTexts : T.apps.newText}`, [150, 200, 255]]);
  const rem = P.cal.reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at)[0];
  if (rem) cards.push(['31', `${hhmm(calendar(rem.at).hour)} ${rem.text}`, [255, 200, 120]]);
  cards.slice(0, 3).forEach(([icon, s, col], k) => {
    const y = 16 + k * 2;
    if (t < 0.6 + k * 0.1) return;
    box(S, 2, y, SW - 3, y, [24, 32, 50], [0, 0, 0], 0);
    S.text(3, y, icon, col, [24, 32, 50]);
    S.text(8, y, s.slice(0, SW - 12), Math.floor(now * 2) & 1 || k ? [235, 240, 250] : col, [24, 32, 50]);
  });
  softKeys(S, T.menu, T.hide);
  // how to clear them (calls and texts; a reminder stays until its time), on the bar between the soft keys
  if ((P.missed || unread) && t > 0.9) { const h = T.apps.clearHint; S.text((SW - h.length) >> 1, SH - 1, h, [170, 185, 210], [BAR[0] * 0.55, BAR[1] * 0.55, BAR[2] * 0.55]); }
}

// map colours, as the phone maps of the time drew them: pale ground, white streets, yellow avenues,
// green parks, buildings in grey that turns blue-grey the taller they are; the burning ground brown
const G_BG: C3[] = [[112, 84, 72], [255, 255, 255], [228, 224, 216], [238, 234, 224], [0, 0, 0], [186, 222, 164], [234, 228, 212], [208, 204, 198]];
const G_CH = [ch('.'), 32, 32, ch('.'), 32, ch('"'), ch('+'), ch('=')];
const G_FG: C3[] = [[160, 90, 60], [0, 0, 0], [0, 0, 0], [214, 208, 196], [0, 0, 0], [130, 186, 116], [212, 202, 182], [172, 166, 160]];
const WIDE: C3 = [252, 226, 128];
const ARROWS = ['>', '\\', 'v', '/', '<', '\\', '^', '/'];

/**
 * What a map cell shows: the most common ground over its 2 m squares (buildings win ties; at most
 * 4x4 samples, so the far zooms stay cheap), and the tallest building in it.
 */
function sample(m: MapRaster, x0: number, y0: number, w: number, h: number, out: Int32Array) {
  const counts = [0, 0, 0, 0, 0, 0, 0, 0], sx = Math.max(MAP_RES, w / 4), sy = Math.max(MAP_RES, h / 4);
  let hmax = 0;
  for (let y = y0 + sy / 2; y < y0 + h; y += sy) for (let x = x0 + sx / 2; x < x0 + w; x += sx) {
    const i = Math.floor(x / MAP_RES), j = Math.floor(y / MAP_RES);
    if (i < 0 || j < 0 || i >= m.w || j >= m.h) { counts[Ground.Out]++; continue; }
    const q = j * m.w + i, k = m.kind[q];
    counts[k]++;
    if (k === Ground.Building && m.height[q] > hmax) hmax = m.height[q];
  }
  let best = 0;
  for (let k = 1; k < 8; k++) if (counts[k] > counts[best] || (counts[k] === counts[best] && k === Ground.Building)) best = k;
  out[0] = best; out[1] = hmax * 2;
}

const isWideRoad = (b: number[], k: number) => b[2 * k + 1] - b[2 * k] >= b[1] - b[0];

/**
 * Whether a road runs inside [a0, a1) along one axis (b: its boundaries, cells: the cell of every
 * metre); wide: only the wide ones. Zoomed out, a road is far thinner than a cell, so it is drawn
 * as a line where it falls instead of being outvoted by the blocks around it.
 */
function roadIn(b: number[], cells: Uint16Array, a0: number, a1: number, wide: boolean): boolean {
  const n = cells.length - 1;
  if (a1 < 0 || a0 > n) return false;
  const c0 = cells[Math.max(0, Math.min(n, Math.floor(a0)))], c1 = cells[Math.max(0, Math.min(n, Math.floor(a1)))];
  for (let c = c0; c <= c1; c++) if (!(c & 1) && (!wide || isWideRoad(b, c >> 1))) return true;
  return false;
}

/** The roads crossing the view: [index, middle] of the avenues (x) or streets (y) whose middle is in [a0, a1). */
function roadsIn(b: number[], a0: number, a1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let c = 0; c + 1 < b.length; c += 2) { const m = (b[c] + b[c + 1]) / 2; if (m >= a0 && m < a1) out.push([c >> 1, m]); }
  return out;
}

/** District tints for the far zooms, by type. */
const D_TINT: Record<string, C3> = { financial: [70, 110, 190], commercial: [200, 140, 60], residential: [90, 150, 90], historic: [170, 110, 80], industrial: [120, 120, 120], theater: [210, 80, 200] };
const ROAD: C3 = [255, 255, 255], LABEL: C3 = [70, 76, 92], TB: C3 = CHROME.top, FOOT: C3 = [248, 249, 252];

/**
 * The map app: north up, centered on the GPS position (or moved off it with the d-pad), drawing in
 * row by row, at one of four zooms. Up close it names the streets; farther out the districts, tinted
 * by type; landmarks are stars, named while there is room.
 */
function map(S: Lcd, P: Phone, world: World, aspect: number, t: number, now: number) {
  if (world.player.inside >= 0) return indoorMap(S, P, world, aspect, t, now);
  const { city } = world, m = mapRaster(city), zoom = P.zoom, rowM = ZOOM_ROW_M[zoom], colM = rowM * aspect;
  const [hx, hy] = P.here(), cx = hx + P.panX, cy = hy + P.panY;
  const X0 = cx - (SW / 2) * colM, Y0 = cy - (MAP_ROWS / 2) * rowM, D = city.diagonal;
  // title: the district at the view's middle (the city, all zoomed out), the zoom, the scale and north
  const bar = 6, scale = `${T.zoom[zoom]} |${'-'.repeat(bar - 2)}| ${fmtDist(bar * colM, P.prefs.dist)} N^`;
  S.fill(1, TB);
  const title = zoom === 3 ? cityName(city) : districtName(city, districtAt(city, cx, cy));
  S.text(1, 1, '+N', [120, 230, 150], TB);
  S.text(4, 1, typed(title.slice(0, Math.max(0, SW - scale.length - 6)), t), CHROME.text, TB);
  S.text(SW - scale.length - 1, 1, scale, CHROME.dim, TB);
  const out = new Int32Array(2);
  const colRoad: boolean[] = [], rowRoad: boolean[] = [], colWide: boolean[] = [], rowWide: boolean[] = [];
  for (let c = 0; c < SW; c++) colWide[c] = roadIn(city.xb, city.xCell, X0 + c * colM, X0 + (c + 1) * colM, true);
  for (let r = 0; r < MAP_ROWS; r++) rowWide[r] = roadIn(city.yb, city.yCell, Y0 + r * rowM, Y0 + (r + 1) * rowM, true);
  const G = P.gps, halo = G.state === 'fix' ? G.acc : 0;
  if (zoom > 0) {
    // zoomed out, the roads are lines: all of them up to the sector zoom; for the city, the avenues and the wide streets
    for (let c = 0; c < SW; c++) colRoad[c] = roadIn(city.xb, city.xCell, X0 + c * colM, X0 + (c + 1) * colM, false);
    for (let r = 0; r < MAP_ROWS; r++) rowRoad[r] = roadIn(city.yb, city.yCell, Y0 + r * rowM, Y0 + (r + 1) * rowM, zoom === 3);
  }
  const diagHalf = Math.max(D.w / 2, 0.45 * Math.max(colM, rowM));
  for (let r = 0; r < MAP_ROWS; r++) {
    if (t < 0.15 + r * 0.03) break; // the slow phone draws the map in from the top
    for (let c = 0; c < SW; c++) {
      const x0 = X0 + c * colM, y0 = Y0 + r * rowM, mx = x0 + colM / 2, my = y0 + rowM / 2;
      const inCity = mx >= 0 && my >= 0 && mx < city.w && my < city.h;
      const diag = inCity && Math.abs(diagS(D, mx, my)) < diagHalf;
      let bg: C3, fg: C3, glyph: number, k: number;
      if (zoom > 0 && inCity && (colRoad[c] || rowRoad[r] || diag)) { k = Ground.Road; bg = colWide[c] || rowWide[r] || diag ? WIDE : ROAD; fg = bg; glyph = 32; }
      else {
        sample(m, x0, y0, colM, rowM, out);
        k = out[0]; fg = G_FG[k]; glyph = G_CH[k];
        if (k === Ground.Building) {
          const f = Math.min(1, out[1] / 120);
          bg = [214 - 64 * f, 210 - 56 * f, 202 - 28 * f]; fg = [80, 86, 110];
          // the skyline's few giants get a mark, to steer by
          glyph = out[1] > 200 ? ch('^') : 32;
        } else bg = k === Ground.Road && (colWide[c] || rowWide[r] || diag) ? WIDE : G_BG[k];
      }
      // the GPS's accuracy: a pale blue ring around the position
      if (halo && Math.hypot(mx - G.x, my - G.y) < halo) bg = [bg[0] * 0.75 + 30, bg[1] * 0.75 + 46, bg[2] * 0.75 + 64];
      if (zoom >= 2 && inCity && k !== Ground.Out) {
        // the districts, tinted by type
        const tint = D_TINT[city.districts[districtAt(city, mx, my)].type];
        if (k !== Ground.Road) bg = [bg[0] * 0.8 + tint[0] * 0.2, bg[1] * 0.8 + tint[1] * 0.2, bg[2] * 0.8 + tint[2] * 0.2];
      }
      S.put(c, 2 + r, glyph, fg, bg);
    }
  }
  const drawn = Math.max(0, Math.floor((t - 0.15) / 0.03));
  const at = (x: number, y: number) => [Math.floor((x - X0) / colM), Math.floor((y - Y0) / rowM)];
  // labels never overlap each other or a landmark's star (one cell apart); the ones placed first win
  const used = new Uint8Array(SW * MAP_ROWS);
  const free = (x: number, r: number, n: number) => { for (let c = Math.max(0, x - 1); c < Math.min(SW, x + n + 1); c++) if (used[r * SW + c]) return false; return true; };
  const label = (c: number, r: number, s: string, fg: C3, bg: C3) => {
    if (r < 0 || r >= MAP_ROWS || r >= drawn) return;
    s = s.slice(0, SW);
    const x = Math.max(0, Math.min(SW - s.length, c));
    if (!free(x, r, s.length)) return;
    for (let k = 0; k < s.length; k++) used[r * SW + x + k] = 1;
    S.text(x, 2 + r, s, fg, bg);
  };
  // landmarks: a star (named below, where there is room)
  const stars: [number, number, number][] = [];
  city.landmarks.forEach((L, k) => {
    const [c, r] = at(L.x, L.y);
    if (c < 0 || c >= SW || r < 0 || r >= MAP_ROWS || r >= drawn) return;
    S.put(c, 2 + r, ch('*'), [255, 255, 255], [210, 60, 50]);
    used[r * SW + c] = 1;
    stars.push([k, c, r]);
  });
  // up close, their names beside them, before any street name
  if (zoom <= 1) for (const [k, c, r] of stars) {
    const room = SW - c - 2;
    if (room >= 5) label(c + 2, r, landmarkName(city, k).slice(0, room), [160, 40, 30], [255, 244, 238]);
  }
  if (zoom <= 1) {
    // street names: the avenues across the top, the streets along their own rows (zoomed out, only the wide ones)
    for (const [k, x] of roadsIn(city.xb, X0, X0 + SW * colM)) {
      if (zoom === 1 && !isWideRoad(city.xb, k)) continue;
      const name = roadName(city, true, k);
      label(Math.floor((x - X0) / colM) - (name.length >> 1), 0, name, LABEL, ROAD);
    }
    for (const [k, y] of roadsIn(city.yb, Y0 + rowM, Y0 + MAP_ROWS * rowM)) {
      if (zoom === 1 && !isWideRoad(city.yb, k)) continue;
      label(2, Math.floor((y - Y0) / rowM), roadName(city, false, k), LABEL, ROAD);
    }
    // the diagonal, named at the point of it nearest the view's middle
    const s = diagS(D, cx, cy), [dc, dr] = at(cx - s * D.nx, cy - s * D.ny);
    if (dc >= 0 && dc < SW) { const n = diagonalName(city); label(dc - (n.length >> 1), dr, n, LABEL, ROAD); }
  } else {
    // district names at their middles, the ones nearest the view's middle first
    city.districts.map((Dd, k) => [k, Math.hypot(Dd.x - cx, Dd.y - cy)]).sort((a, b) => a[1] - b[1]).forEach(([k]) => {
      const Dd = city.districts[k], [c, r] = at(Dd.x, Dd.y), n = districtName(city, k).toUpperCase();
      if (c >= 0 && c < SW) label(c - (n.length >> 1), r, n, [40, 44, 56], [255, 255, 255]);
    });
  }
  marker(S, P, at, drawn, now);
  // the street at the view's middle
  const onDiag = Math.abs(diagS(D, cx, cy)) < D.w / 2 + SIDEWALK;
  const street = `${onDiag ? diagonalName(city) : roadName(city, true, nearestRoad(city.xb, city.xCell, cx))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, cy))}`;
  S.fill(SH - 2, FOOT);
  S.text(1, SH - 2, typed(street.slice(0, SW - 2), t - 0.3), [30, 34, 44], FOOT);
  const panned = P.panX !== 0 || P.panY !== 0;
  if (panned) {
    // moved off the position: which way back to it
    const back = `${fmtDist(Math.hypot(P.panX, P.panY), P.prefs.dist)} ${compass(-P.panX, -P.panY)}`;
    S.text(SW - back.length - 1, SH - 2, back, [40, 90, 170], FOOT);
  }
  gpsInfo(S, P, now, false);
  softKeys(S, panned ? T.center : T.places, T.back);
}

/**
 * Where the GPS puts the player: an arrow along the way they move (there is no compass), a ring
 * standing still, blinking; with no fix, the last known position as a dim '?'.
 */
function marker(S: Lcd, P: Phone, at: (x: number, y: number) => number[], drawn: number, now: number) {
  const g = P.gps;
  if (!g.known) return;
  const [c, r] = at(g.x, g.y);
  if (c < 0 || c >= SW || r < 0 || r >= MAP_ROWS || r >= drawn) return;
  const blink = Math.floor(now * 3) & 1;
  if (g.state !== 'fix') { if (blink) S.put(c, 2 + r, ch('?'), [255, 255, 255], [140, 146, 160]); return; }
  const glyph = Number.isNaN(g.heading) ? SHAPE.dot : ch(ARROWS[Math.round(g.heading / (Math.PI / 4)) & 7]);
  S.put(c, 2 + r, glyph, [255, 255, 255], blink ? [60, 140, 255] : [30, 100, 220]);
}

/** The GPS's state over the map: searching (satellites in view, time to the fix), signal lost, or the accuracy. */
function gpsInfo(S: Lcd, P: Phone, now: number, indoor: boolean) {
  const g = P.gps, G = T.gps, card: C3 = [252, 252, 254], ink: C3 = [30, 34, 44], grey: C3 = [110, 118, 132];
  if (g.state === 'search' || g.state === 'lost') {
    box(S, 5, 9, SW - 6, 14, card, [200, 200, 200], 1);
    S.center(10, g.state === 'search' ? G.search : G.lost, g.state === 'search' ? [40, 90, 170] : [200, 60, 50], card);
    S.center(12, `${G.inView} ${g.sats}/11${indoor ? '  ' + G.indoor : ''}`, grey, card);
    if (g.state === 'search') {
      const n = Math.round(Math.max(0, 1 - g.wait / g.waitOf) * 20);
      for (let x = 0; x < 20; x++) S.put(11 + x, 13, 32, ink, x < n ? [60, 140, 255] : [220, 224, 232]);
    } else if (g.known && Math.floor(now * 2) & 1) S.center(13, G.lastKnown, grey, card);
  } else if (g.state === 'fix') {
    const a = G.acc.replace('{n}m', fmtDist(g.acc, P.prefs.dist));
    S.text(SW - a.length - 1, 1, a, g.acc > 30 ? BAD : CHROME.dim, CHROME.top);
  }
}

/** Floor colors of the rooms on the indoor map, by kind; the stairs and the lift get a glyph. */
const ROOM_BG: Record<RoomKind, C3> = {
  lobby: [222, 214, 196], hall: [210, 204, 194], stair: [190, 196, 206], lift: [184, 196, 220], foyer: [230, 214, 190], living: [240, 216, 180],
  bedroom: [214, 204, 236], kitchen: [214, 230, 196], bath: [190, 226, 234], office: [204, 214, 230], open: [212, 222, 236], shop: [248, 226, 170],
};
const ROOM_CH: Partial<Record<RoomKind, number>> = { stair: ch('='), lift: ch('X') };

/**
 * The map inside a building: the plan of the floor the player is on, around them (rooms tinted by
 * what they are and named where they fit, walls, doorways, the stairs and the lift), and the street
 * past the outer walls. The same zoom keys pick the scale.
 */
function indoorMap(S: Lcd, P: Phone, world: World, aspect: number, t: number, now: number) {
  const { city, player } = world, B = city.buildings[player.inside], plan = planOf(city, player.inside, player.floor);
  const rowM = INDOOR_ROW_M[P.zoom], colM = rowM * aspect, [hx, hy] = P.here(), cx = hx + P.panX, cy = hy + P.panY;
  const X0 = cx - (SW / 2) * colM, Y0 = cy - (MAP_ROWS / 2) * rowM, m = mapRaster(city);
  const where = `${T.floor} ${player.floor === 0 ? T.ground : player.floor}`, scale = `|${'--'}| ${fmtDist(4 * colM, P.prefs.dist)} N^`;
  S.fill(1, TB);
  S.text(1, 1, typed(where, t), CHROME.text, TB);
  S.text(SW - scale.length - 1, 1, scale, CHROME.dim, TB);
  const WALL: C3 = [86, 90, 102], OUT: C3 = [238, 234, 224];
  for (let r = 0; r < MAP_ROWS; r++) {
    if (t < 0.15 + r * 0.03) break;
    for (let c = 0; c < SW; c++) {
      const x0 = X0 + c * colM, y0 = Y0 + r * rowM;
      // 3x3 points per cell: one room all over is its floor; two rooms meeting is a wall, unless both sides are a doorway
      let first = -1, mixed = false, door = true, any = false;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
        const v = plan ? cellAt(plan, x0 + ((i + 0.5) / 3) * colM, y0 + ((j + 0.5) / 3) * rowM) : 0, room = v & 127;
        if (room) any = true;
        if (!(v & DOOR)) door = false;
        if (first < 0) first = room; else if (room !== first) mixed = true;
      }
      if (!any) {
        // past the outer walls: the street, or a neighbor's wall
        const k = groundAt(m, x0 + colM / 2, y0 + rowM / 2);
        S.put(c, 2 + r, k === Ground.Building ? ch(':') : 32, [190, 186, 178], k === Ground.Building ? [214, 210, 202] : OUT);
      } else if (mixed && !door) S.put(c, 2 + r, 32, WALL, WALL);
      else {
        const R = plan!.rooms[first - 1], bg = R ? ROOM_BG[R.kind] : WALL;
        S.put(c, 2 + r, mixed ? 32 : R ? ROOM_CH[R.kind] ?? 32 : 32, [90, 96, 110], mixed ? [Math.min(255, bg[0] * 1.08), Math.min(255, bg[1] * 1.08), Math.min(255, bg[2] * 1.08)] : bg);
      }
    }
  }
  const drawn = Math.max(0, Math.floor((t - 0.15) / 0.03));
  // the rooms' names, at their middles, where they fit
  if (plan && P.zoom <= 1) plan.rooms.forEach((R, n) => {
    const mx = (R.x0 + R.x1) / 2, my = (R.y0 + R.y1) / 2;
    if ((cellAt(plan, mx, my) & 127) !== n + 1) return;
    const name = (T.room as Record<string, string>)[R.kind], c = Math.floor((mx - X0) / colM) - (name.length >> 1), r = Math.floor((my - Y0) / rowM);
    if (r < 0 || r >= MAP_ROWS || r >= drawn || c < 0 || c + name.length > SW || name.length * colM > R.x1 - R.x0 + 0.5) return;
    S.text(c, 2 + r, name, [50, 54, 66], ROOM_BG[R.kind]);
  });
  marker(S, P, (x, y) => [Math.floor((x - X0) / colM), Math.floor((y - Y0) / rowM)], drawn, now);
  // the address: the building's corner
  const addr = `${roadName(city, true, nearestRoad(city.xb, city.xCell, (B.x0 + B.x1) / 2))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, (B.y0 + B.y1) / 2))}`;
  S.fill(SH - 2, FOOT);
  S.text(1, SH - 2, typed(addr.slice(0, SW - 2), t - 0.3), [30, 34, 44], FOOT);
  gpsInfo(S, P, now, true);
  softKeys(S, P.panX || P.panY ? T.center : T.places, T.back);
}

/** The list of places: the city's landmarks, nearest first, with how far and which way. */
function places(S: Lcd, P: Phone, world: World, t: number) {
  const { city } = world, [hx, hy] = P.here();
  for (let y = 1; y < SH - 1; y++) S.fill(y, [244, 246, 250]);
  S.fill(1, CHROME.top);
  S.text(1, 1, '*', [255, 120, 100], CHROME.top);
  S.text(3, 1, typed(T.placesTitle, t), CHROME.text, CHROME.top);
  const rows = SH - 5, top = Math.max(0, Math.min(P.psel - (rows >> 1), P.places.length - rows)), INK2: C3 = [30, 34, 44], GREY: C3 = [110, 118, 132];
  for (let n = 0; n < rows && top + n < P.places.length; n++) {
    const k = P.places[top + n], L = city.landmarks[k], sel = top + n === P.psel, bg: C3 = sel ? PICK : [244, 246, 250];
    const far = P.gps.known ? `${fmtDist(Math.hypot(L.x - hx, L.y - hy), P.prefs.dist)} ${compass(L.x - hx, L.y - hy)}` : '--';
    const name = landmarkName(city, k).slice(0, SW - far.length - 5);
    if (sel) S.fill(3 + n, bg);
    S.put(1, 3 + n, ch('*'), [255, 255, 255], [210, 60, 50]);
    S.text(3, 3 + n, typed(name, t - 0.1 - n * 0.04), sel ? PICK_INK : INK2, bg);
    S.text(SW - far.length - 1, 3 + n, typed(far, t - 0.2 - n * 0.04), sel ? PICK_DIM : GREY, bg);
  }
  softKeys(S, T.show, T.back);
}

/** Fingerprints on the phone's glass: a few oval smudges where a thumb goes (low and to the right), 0..1 at screen cell (x, y). */
function smudge(x: number, y: number): number {
  let v = 0;
  for (let k = 0; k < 6; k++) {
    const cx = SW * (0.35 + hash3(k, 51, 1) * 0.6), cy = SH * (0.3 + hash3(k, 51, 2) * 0.65), rx = 2 + hash3(k, 51, 3) * 3.5, ry = 1 + hash3(k, 51, 4) * 1.8;
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    if (d < 1) v += (1 - d) * (0.5 + 0.5 * hash3(x, y, k + 60));
  }
  return Math.min(1, v);
}
