import { compass, cityName, operatorName, diagonalName, districtName, landmarkName, roadName } from '../locale/names';
import { type CharGrid } from '../render/grid';
import { diagS, districtAt, nearestRoad, SIDEWALK } from '../sim/city';
import { calendar } from '../sim/clock';
import { app, menu } from './apps';
import { BAD, bigText, ch, DAYS, DIM, HI, hhmm, INK, LCD, Lcd, MONTHS, SH, softKeys, statusBar, SW, T, typed, type C3 } from './lcd';
import { type World } from '../sim/world';
import { Ground, groundAt, MAP_RES, mapRaster, type MapRaster } from './mapdata';
import { BOOT_LOG_S, INDOOR_ROW_M, ZOOM_ROW_M, type Key, type Phone } from './phone';
import { cellAt, DOOR, planOf, type RoomKind } from '../sim/interior';

/**
 * The phone drawn in the player's hand, over the bottom right of the view: a 2008 handset with a
 * colour screen above a d-pad, soft keys, call and end keys and the number keys, whose bottom row
 * runs off the screen. Keys light while the phone is on and sink when pressed. The screen is a
 * small character display of its own; its text types in and the map draws in, as on a slow phone.
 * It sits in the scene's light (VIEW_LIGHT: street lamps, signs, headlights, the room's lamps), with
 * a lit edge on top and left, and a sheen on its metal rim and its glass that slides as you turn.
 */
export const PHONE_W = 50;
const PHONE_H = 52;
/** How much of it shows when held up (the rest is below the screen edge). */
const SHOWN = 46;
const SX = 4, SY = 4;
const MAP_ROWS = SH - 4;
/** Metres the map shows across and down, for a cell aspect (width / height) and zoom (a column is the cell aspect of a row, so nothing is stretched). */
export const mapView = (aspect: number, zoom: number, indoor = false): [number, number] => {
  const r = (indoor ? INDOOR_ROW_M : ZOOM_ROW_M)[zoom];
  return [SW * r * aspect, MAP_ROWS * r];
};

/** The keys on the phone's face: key, column, row, width, height, label, label color. */
const CY = SY + SH + 2;
const KEYS: [Key, number, number, number, number, string, C3?][] = [
  ['lsoft', 3, CY, 10, 2, '--'], ['rsoft', 37, CY, 10, 2, '--'],
  ['send', 3, CY + 3, 10, 2, 'SEND', [80, 230, 120]], ['end', 37, CY + 3, 10, 2, 'END', [255, 80, 70]],
  ['up', 21, CY, 8, 1, '^'], ['left', 16, CY + 1, 4, 3, '<'], ['right', 30, CY + 1, 4, 3, '>'], ['ok', 21, CY + 1, 8, 3, 'OK'], ['down', 21, CY + 4, 8, 1, 'v'],
];
(['1 .,', '2 abc', '3 def', '4 ghi', '5 jkl', '6 mno', '7 pqrs', '8 tuv', '9 wxyz', '* +', '0 _', '# ^'] as const).forEach((label, n) =>
  KEYS.push([label[0] as Key, 3 + (n % 3) * 16, CY + 6 + Math.floor(n / 3) * 3, 12, 2, label]));

/** Where the phone's top left corner is on the grid: held up higher while typing, the whole keypad in sight. */
function origin(cols: number, rows: number, P: Phone): [number, number] {
  const e = 1 - (1 - P.raise) ** 3;
  return [cols - PHONE_W - 6, rows - Math.round((SHOWN + (PHONE_H - SHOWN) * P.lift) * e)];
}

/** The key under a grid cell, if any. */
export function keyAt(cols: number, rows: number, P: Phone, x: number, y: number): Key | null {
  const [ox, oy] = origin(cols, rows, P);
  for (const [k, x0, y0, w, h] of KEYS) if (x >= ox + x0 && x < ox + x0 + w && y >= oy + y0 && y < oy + y0 + h) return k;
  return null;
}

const BODY: C3 = [30, 32, 37], EDGE: C3 = [58, 61, 68], BEZEL: C3 = [7, 7, 9], CAP: C3 = [48, 50, 57], CAP_TOP: C3 = [64, 67, 75], CAP_DOWN: C3 = [22, 23, 26];

/** The glint and the eye's adaptation, eased over time so they do not jump from frame to frame. */
const GL = { lat: 0, str: 0, r: 1, g: 1, b: 1, back: 0, adapt: 1, at: 0 };

export function drawPhone(g: CharGrid, P: Phone, world: World, aspect: number, now: number, light: Float32Array, glint: Float32Array) {
  if (P.raise < 0.01) return;
  const [ox, oy] = origin(g.cols, g.rows, P);
  const Lr = light[0], Lg = light[1], Lb = light[2], Lm = (Lr + Lg + Lb) / 3;
  const dt = Math.min(0.1, Math.max(0, now - GL.at)), q = 1 - Math.exp(-dt / 0.25);
  GL.at = now;
  GL.lat += (glint[0] - GL.lat) * q; GL.str += (glint[1] - GL.str) * q;
  GL.back += (glint[5] - GL.back) * q; GL.r += (glint[2] - GL.r) * q; GL.g += (glint[3] - GL.g) * q; GL.b += (glint[4] - GL.b) * q;
  // the eye adapts in a second or two: in the dark the screen looks brighter and blooms, under a
  // strong light it looks a little dimmer
  GL.adapt += (Lm - GL.adapt) * (1 - Math.exp(-dt / 1.5));
  const gain = Math.min(1.25, Math.max(0.8, 1.35 - 0.35 * GL.adapt)), bloom = Math.min(1, Math.max(0, (0.75 - GL.adapt) / 0.4));
  // the glint: the brightest light nearby mirrored in the phone, a soft diagonal band on the side
  // it comes from, in its color, stronger for a light behind the player
  const s0 = 34 + GL.lat * 22, amp = GL.str * 55;
  const sheen = (x: number, y: number) => Math.exp(-(((x + y * 0.55 - s0) / 5) ** 2));
  // a cell of the phone's surface: lit by the scene, darker toward the bottom, the glint on top in
  // proportion to its gloss; `glow` is light of its own (backlit key labels) the scene does not dim
  const cell = (x: number, y: number, c: number, fg: C3, bg: C3, gloss = 0.25, glow = false) => {
    const gx = ox + x, gy = oy + y;
    if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return;
    const i = gy * g.cols + gx, k = 1 - (y / PHONE_H) * 0.25, sh = sheen(x, y) * gloss * amp;
    g.setBg(i, bg[0] * Lr * k + sh * GL.r, bg[1] * Lg * k + sh * GL.g, bg[2] * Lb * k + sh * GL.b);
    if (glow) g.put(i, c, Math.max(fg[0], fg[0] * Lr), Math.max(fg[1], fg[1] * Lg), Math.max(fg[2], fg[2] * Lb));
    else g.put(i, c, fg[0] * Lr * k + sh * GL.r, fg[1] * Lg * k + sh * GL.g, fg[2] * Lb * k + sh * GL.b);
  };
  // the glint's light added to a cell's background; a cell darkened by a shadow
  const addBg = (x: number, y: number, v: number) => {
    const gx = ox + x, gy = oy + y;
    if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return;
    const k = (gy * g.cols + gx) * 4;
    g.bg[k] += v * GL.r; g.bg[k + 1] += v * GL.g; g.bg[k + 2] += v * GL.b;
  };
  const shade = (x: number, y: number, f: number) => {
    const gx = ox + x, gy = oy + y;
    if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return;
    const k = (gy * g.cols + gx) * 4;
    for (let c = 0; c < 3; c++) { g.bg[k + c] *= 1 - f; g.cells[k + c + 1] *= 1 - f; }
  };
  // the body, rounded at the corners: its rim catches the light on top and left, falls dark on the right
  for (let y = 0; y < PHONE_H; y++) {
    const inset = y === 0 || y === PHONE_H - 1 ? 3 : y === 1 || y === PHONE_H - 2 ? 1 : 0;
    for (let x = inset; x < PHONE_W - inset; x++) {
      const left = x === inset, right = x === PHONE_W - 1 - inset, top = y === 0 || (inset > 0 && (left || right));
      const col: C3 = top || left ? EDGE : right ? [20, 21, 25] : BODY;
      cell(x, y, 32, col, col, left || right || top ? 0.9 : 0.2);
    }
  }
  // earpiece, front camera, maker's name
  for (let x = 20; x < 30; x++) cell(x, 1, ch('='), [16, 16, 18], [20, 20, 23]);
  cell(38, 1, ch('o'), [70, 80, 100], [12, 12, 14]);
  const brand = P.device.maker.toUpperCase().split('').join(' ');
  for (let k = 0; k < brand.length; k++) cell(25 - (brand.length >> 1) + k, 2, brand.charCodeAt(k), [150, 156, 168], BODY);
  for (let y = SY - 1; y <= SY + SH; y++) for (let x = SX - 1; x <= SX + SW; x++) cell(x, y, 32, BEZEL, BEZEL);

  // keys: lit from behind while the phone is on, sunk for a moment when pressed
  const on = P.screen !== 'off';
  const isDown = (k: Key) => { const t = P.pressed.get(k); return t !== undefined && now - t < 0.14; };
  // first the keys' shadows on the body, cast away from the light: sideways by the light's side,
  // down for a light ahead (from above the phone), up for one behind (always some, from the room
  // around); then the caps over them, so a shadow never darkens a neighbouring key
  const vx = -GL.lat, vy = Math.max(-1, Math.min(1, 0.55 - 0.9 * GL.back)), dark = 0.2 + 0.4 * GL.str;
  const sx = Math.abs(vx) > 0.3 ? Math.sign(vx) : 0, sy = Math.abs(vy) > 0.3 ? Math.sign(vy) : 0;
  for (const [k, x0, y0, w, h] of KEYS) {
    if (isDown(k)) continue;
    const ex = sx > 0 ? x0 + w : x0 - 1, ey = sy > 0 ? y0 + h : y0 - 1;
    if (sx) for (let y = 0; y < h; y++) shade(ex, y0 + y, dark * Math.abs(vx));
    if (sy) for (let x = 0; x < w; x++) shade(x0 + x, ey, dark * Math.abs(vy));
    if (sx && sy) shade(ex, ey, dark * Math.min(Math.abs(vx), Math.abs(vy)));
  }
  // the caps in relief, unless pushed in: lit along the top edge; the edge facing the nearest light
  // catches its glint; lit from behind while the phone is on
  const side = GL.lat > 0 ? 1 : 0, rim = GL.str * Math.min(1, Math.abs(GL.lat) * 1.6) * 60;
  for (const [k, x0, y0, w, h, label, col] of KEYS) {
    const down = isDown(k), fg: C3 = col ?? (on ? [150, 205, 255] : [125, 128, 138]);
    const hov = P.hover === k && !down ? 1.35 : 1;
    const capAt = (y: number): C3 => { const c = down ? CAP_DOWN : y === 0 && h > 1 ? CAP_TOP : CAP; return [c[0] * hov, c[1] * hov, c[2] * hov]; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      cell(x0 + x, y0 + y, 32, fg, capAt(y), 0.5);
      if (!down && rim > 1 && x === side * (w - 1)) addBg(x0 + x, y0 + y, rim);
    }
    const lx = x0 + ((w - label.length) >> 1), ly = y0 + ((h - 1) >> 1);
    for (let n = 0; n < label.length; n++) if (label[n] !== ' ') cell(lx + n, ly, label.charCodeAt(n), down ? [fg[0] * 0.7, fg[1] * 0.7, fg[2] * 0.7] : fg, capAt(ly - y0), 0.5, on);
  }

  // the screen
  const S = new Lcd(g, ox + SX, oy + SY);
  if (!on) for (let y = 0; y < SH; y++) S.fill(y, [5, 6, 8]);
  else {
    for (let y = 0; y < SH; y++) S.fill(y, LCD);
    const t = now - P.since;
    if (P.screen === 'boot') boot(S, P, world, t);
    else {
      statusBar(S, world, P.gps.state, now, P.radio);
      if (P.screen === 'standby') standby(S, P, world, t, now);
      else if (P.screen === 'menu') menu(S, P, t);
      else if (P.screen === 'map') map(S, P, world, aspect, t, now);
      else if (P.screen === 'places') places(S, P, world, t);
      else app(S, P, world, t, now);
    }
  }
  // the glass over the screen: the eye's adaptation, a faint wash of the scene's light, and the glint
  let ar = 0, ag = 0, ab = 0, n = 0;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const gx = ox + SX + x, gy = oy + SY + y;
    if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) continue;
    const k = (gy * g.cols + gx) * 4, sh = sheen(SX + x, SY + y) * amp * 0.45, C = g.cells, B = g.bg;
    for (let c = 1; c < 4; c++) C[k + c] *= gain;
    for (let c = 0; c < 3; c++) B[k + c] *= gain;
    ar += B[k] + C[k + 1] * 0.3; ag += B[k + 1] + C[k + 2] * 0.3; ab += B[k + 2] + C[k + 3] * 0.3; n++;
    B[k] += 3 * Lr + sh * GL.r; B[k + 1] += 3 * Lg + sh * GL.g; B[k + 2] += 4 * Lb + sh * GL.b;
    C[k + 1] += sh * 0.5 * GL.r; C[k + 2] += sh * 0.5 * GL.g; C[k + 3] += sh * 0.5 * GL.b;
  }
  if (bloom > 0.01 && n && on) {
    // bloom in the dark: the screen's own light haloes over the glass and spills on the bezel around it
    ar /= n; ag /= n; ab /= n;
    for (let y = SY - 3; y <= SY + SH + 2; y++) for (let x = SX - 3; x <= SX + SW + 2; x++) {
      const gx = ox + x, gy = oy + y;
      if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) continue;
      const d = Math.max(SX - x, x - (SX + SW - 1), SY - y, y - (SY + SH - 1), 0);
      const w = bloom * (d === 0 ? 0.12 : 0.45 / (d + 0.5)), k = (gy * g.cols + gx) * 4;
      g.bg[k] += ar * w; g.bg[k + 1] += ag * w; g.bg[k + 2] += ab * w;
    }
  }
  // the mouse cursor: a cell in inverse, its glyph dark on white
  if (P.out && P.cx >= 0) {
    const x = Math.floor(P.cx), y = Math.floor(P.cy);
    if (x >= 0 && y >= 0 && x < g.cols && y < g.rows) {
      const i = y * g.cols + x, c = g.cells[i * 4];
      g.put(i, c > 32 ? c : ch('+'), 20, 20, 24); g.setBg(i, 240, 240, 235);
    }
  }
}

/**
 * Power on, in two stages: the hardware check scrolls by fast, listing what it finds; then the
 * splash screen, the maker's logo drawing in over the model's name and a loading bar.
 */
function boot(S: Lcd, P: Phone, world: World, t: number) {
  if (t < 0) { for (let y = 0; y < SH; y++) S.fill(y, [5, 6, 8]); return; }
  const D = P.device;
  if (t >= BOOT_LOG_S) return splash(S, D.maker.toUpperCase(), D.model.toUpperCase(), t - BOOT_LOG_S);
  mapRaster(world.city); // the map database loads during the check (built once per city)
  const line = (a: string, b: string) => a + ' ' + '.'.repeat(Math.max(2, SW - 4 - a.length - b.length)) + ' ' + b;
  const L = [
    `${D.os}  ${D.maker} ${D.model}`,
    '',
    line(`CPU ${D.cpu} ${D.cpuMHz} MHz`, T.ok),
    line(`RAM ${D.ramMB} MB`, T.ok),
    line(`FLASH ${D.flashMB} MB`, T.ok),
    line(`LCD ${D.screen}`, T.ok),
    line(`GPS ${D.gps}`, T.ok),
    line(`WLAN ${D.wlan}`, T.off),
    line(`RADIO ${D.radio}`, T.ok),
    line(`${T.mapsDb} ${cityName(world.city).toUpperCase()}`, T.ok),
    '',
    T.ready,
  ];
  let left = Math.floor(t * 320);
  for (let k = 0; k < L.length && left >= 0; k++) {
    const s = L[k].slice(0, left), bad = L[k].endsWith(T.noService) || L[k].endsWith(T.off);
    S.text(1, 1 + k, s, k === 0 ? HI : bad && s.length === L[k].length ? [255, 120, 90] : DIM, LCD);
    left -= L[k].length + 3;
    if (left < 0 && Math.floor(t * 8) & 1) S.put(1 + s.length, 1 + k, ch('_'), INK, LCD);
  }
}

/** The splash: a deep blue field brightening from the top, the logo drawing in, the model's name, a bar filling. */
function splash(S: Lcd, maker: string, model: string, u: number) {
  const f = Math.min(1, u / 0.5);
  for (let y = 0; y < SH; y++) { const k = f * (1 - y / SH); S.fill(y, [8 + 12 * k, 12 + 28 * k, 22 + 60 * k]); }
  bigText(S, 6, maker, [Math.min(255, u * 500), Math.min(196, u * 400), Math.min(90, u * 180)], u - 0.2);
  S.text((SW - model.length) >> 1, 15, typed(model, u - 0.6, 30), INK, [12, 22, 44]);
  const n = Math.round(Math.max(0, Math.min(1, (u - 0.9) / 1.5)) * 24);
  for (let x = 0; x < 24; x++) S.put(9 + x, 19, x < n ? 32 : ch('.'), DIM, x < n ? HI : [10, 17, 34]);
}

function standby(S: Lcd, P: Phone, world: World, t: number, now: number) {
  const c = calendar(world.time);
  bigText(S, 4, hhmm(c.hour), INK, t);
  const date = `${DAYS[c.weekday]} ${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${c.year}`;
  S.text((SW - date.length) >> 1, 13, typed(date, t - 0.2), DIM, LCD);
  // the network it is on, as phones then showed it under the clock
  const R = P.radio, op = R.state === 'service' ? operatorName(world.city).toUpperCase() : R.state === 'search' ? (Math.floor(now * 2) & 1 ? T.apps.searching : '') : T.noService;
  S.text((SW - op.length) >> 1, 16, typed(op, t - 0.5), R.state === 'service' ? INK : [255, 120, 90], LCD);
  softKeys(S, T.menu, T.hide);
}

// map colours: what lies on the ground, and buildings brighter the taller they are
const G_BG: C3[] = [[18, 8, 6], [24, 28, 36], [44, 48, 56], [30, 30, 30], [0, 0, 0], [24, 58, 34], [56, 56, 60], [42, 36, 32]];
const G_CH = [ch('.'), 32, 32, ch('.'), 32, ch('"'), ch('+'), ch('=')];
const G_FG: C3[] = [[110, 46, 22], [0, 0, 0], [0, 0, 0], [58, 58, 56], [0, 0, 0], [60, 130, 72], [84, 84, 90], [96, 84, 72]];
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
const ROAD: C3 = [52, 58, 72], LABEL: C3 = [150, 195, 215], TB: C3 = [16, 30, 40];

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
  const bar = 6, scale = `${T.zoom[zoom]} |${'-'.repeat(bar - 2)}| ${Math.round(bar * colM)}m N^`;
  S.fill(1, TB);
  const title = zoom === 3 ? cityName(city) : districtName(city, districtAt(city, cx, cy));
  S.text(1, 1, typed(title.toUpperCase().slice(0, Math.max(0, SW - scale.length - 3)), t), HI, TB);
  S.text(SW - scale.length - 1, 1, scale, DIM, TB);
  const out = new Int32Array(2);
  const colRoad: boolean[] = [], rowRoad: boolean[] = [];
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
      if (zoom > 0 && inCity && (colRoad[c] || rowRoad[r] || Math.abs(diagS(D, mx, my)) < diagHalf)) { S.put(c, 2 + r, 32, ROAD, ROAD); continue; }
      sample(m, x0, y0, colM, rowM, out);
      const k = out[0];
      let bg: C3, fg: C3 = G_FG[k], glyph = G_CH[k];
      if (k === Ground.Building) {
        const f = Math.min(1, out[1] / 120);
        bg = [70 + 150 * f, 58 + 110 * f, 44 + 50 * f]; fg = [255, 240, 200];
        // the skyline's few giants get a mark, to steer by
        glyph = out[1] > 200 ? ch('^') : 32;
      } else bg = G_BG[k];
      if (zoom >= 2 && inCity && k !== Ground.Out) {
        // the districts, tinted by type
        const tint = D_TINT[city.districts[districtAt(city, mx, my)].type];
        bg = [bg[0] * 0.7 + tint[0] * 0.3, bg[1] * 0.7 + tint[1] * 0.3, bg[2] * 0.7 + tint[2] * 0.3];
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
    S.put(c, 2 + r, ch('*'), [255, 230, 90], [60, 40, 10]);
    used[r * SW + c] = 1;
    stars.push([k, c, r]);
  });
  // up close, their names beside them, before any street name
  if (zoom <= 1) for (const [k, c, r] of stars) {
    const room = SW - c - 2;
    if (room >= 5) label(c + 2, r, landmarkName(city, k).toUpperCase().slice(0, room), [255, 220, 120], [30, 22, 8]);
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
      if (c >= 0 && c < SW) label(c - (n.length >> 1), r, n, [255, 236, 200], [30, 34, 40]);
    });
  }
  marker(S, P, at, drawn, now);
  // the street at the view's middle
  const onDiag = Math.abs(diagS(D, cx, cy)) < D.w / 2 + SIDEWALK;
  const street = `${onDiag ? diagonalName(city) : roadName(city, true, nearestRoad(city.xb, city.xCell, cx))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, cy))}`;
  S.fill(SH - 2, TB);
  S.text(1, SH - 2, typed(street.slice(0, SW - 2), t - 0.3), INK, TB);
  const panned = P.panX !== 0 || P.panY !== 0;
  if (panned) {
    // moved off the position: which way back to it
    const back = `${Math.round(Math.hypot(P.panX, P.panY))}m ${compass(-P.panX, -P.panY)}`;
    S.text(SW - back.length - 1, SH - 2, back, DIM, TB);
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
  if (g.state !== 'fix') { if (blink) S.put(c, 2 + r, ch('?'), [200, 200, 200], [60, 60, 70]); return; }
  const glyph = Number.isNaN(g.heading) ? ch('o') : ch(ARROWS[Math.round(g.heading / (Math.PI / 4)) & 7]);
  S.put(c, 2 + r, glyph, blink ? [255, 255, 255] : [90, 255, 255], blink ? [0, 120, 150] : [0, 60, 80]);
}

/** The GPS's state over the map: searching (satellites in view, time to the fix), signal lost, or the accuracy. */
function gpsInfo(S: Lcd, P: Phone, now: number, indoor: boolean) {
  const g = P.gps, G = T.gps, box: C3 = [10, 18, 26];
  if (g.state === 'search' || g.state === 'lost') {
    for (let y = 9; y <= 14; y++) for (let x = 6; x < SW - 6; x++) S.put(x, y, 32, box, box);
    S.center(10, g.state === 'search' ? G.search : G.lost, g.state === 'search' ? HI : BAD, box);
    S.center(12, `${G.inView} ${g.sats}/11${indoor ? '  ' + G.indoor : ''}`, DIM, box);
    if (g.state === 'search') {
      const n = Math.round(Math.max(0, 1 - g.wait / g.waitOf) * 20);
      for (let x = 0; x < 20; x++) S.put(11 + x, 13, x < n ? 32 : ch('.'), DIM, x < n ? HI : box);
    } else if (g.known && Math.floor(now * 2) & 1) S.center(13, G.lastKnown, DIM, box);
  } else if (g.state === 'fix') {
    const a = G.acc.replace('{n}', String(g.acc));
    S.text(SW - a.length - 1, 1, a, g.acc > 30 ? BAD : DIM, [16, 30, 40]);
  }
}

/** Floor colors of the rooms on the indoor map, by kind; the stairs and the lift get a glyph. */
const ROOM_BG: Record<RoomKind, C3> = {
  lobby: [92, 88, 80], hall: [70, 64, 56], stair: [58, 62, 70], lift: [64, 70, 84], foyer: [86, 74, 60], living: [110, 86, 60],
  bedroom: [84, 76, 104], kitchen: [96, 100, 84], bath: [70, 104, 112], office: [74, 84, 98], open: [80, 90, 102], shop: [118, 96, 54],
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
  const where = `${T.floor} ${player.floor === 0 ? T.ground : player.floor}`, scale = `|${'--'}| ${(4 * colM).toFixed(0)}m N^`;
  S.fill(1, TB);
  S.text(1, 1, typed(where, t), HI, TB);
  S.text(SW - scale.length - 1, 1, scale, DIM, TB);
  const WALL: C3 = [30, 32, 36], OUT: C3 = [14, 16, 20];
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
        S.put(c, 2 + r, k === Ground.Building ? ch(':') : 32, [50, 46, 40], k === Ground.Building ? [36, 32, 28] : OUT);
      } else if (mixed && !door) S.put(c, 2 + r, ch('#'), [70, 72, 78], WALL);
      else {
        const R = plan!.rooms[first - 1], bg = R ? ROOM_BG[R.kind] : WALL;
        S.put(c, 2 + r, mixed ? 32 : R ? ROOM_CH[R.kind] ?? 32 : 32, [200, 205, 215], mixed ? [bg[0] * 1.3, bg[1] * 1.3, bg[2] * 1.3] : bg);
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
    S.text(c, 2 + r, name, [235, 235, 240], ROOM_BG[R.kind]);
  });
  marker(S, P, (x, y) => [Math.floor((x - X0) / colM), Math.floor((y - Y0) / rowM)], drawn, now);
  // the address: the building's corner
  const addr = `${roadName(city, true, nearestRoad(city.xb, city.xCell, (B.x0 + B.x1) / 2))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, (B.y0 + B.y1) / 2))}`;
  S.fill(SH - 2, TB);
  S.text(1, SH - 2, typed(addr.slice(0, SW - 2), t - 0.3), INK, TB);
  gpsInfo(S, P, now, true);
  softKeys(S, P.panX || P.panY ? T.center : T.places, T.back);
}

/** The list of places: the city's landmarks, nearest first, with how far and which way. */
function places(S: Lcd, P: Phone, world: World, t: number) {
  const { city } = world, [hx, hy] = P.here();
  S.text(1, 1, typed(T.placesTitle, t), HI, LCD);
  const rows = SH - 5, top = Math.max(0, Math.min(P.psel - (rows >> 1), P.places.length - rows));
  for (let n = 0; n < rows && top + n < P.places.length; n++) {
    const k = P.places[top + n], L = city.landmarks[k], sel = top + n === P.psel, bg: C3 = sel ? [40, 90, 120] : LCD;
    const far = P.gps.known ? `${Math.round(Math.hypot(L.x - hx, L.y - hy))}m ${compass(L.x - hx, L.y - hy)}` : '--';
    const name = landmarkName(city, k).slice(0, SW - far.length - 5);
    if (sel) S.fill(3 + n, bg);
    S.text(1, 3 + n, typed(`* ${name}`, t - 0.1 - n * 0.04), sel ? [255, 255, 255] : INK, bg);
    S.text(SW - far.length - 1, 3 + n, typed(far, t - 0.2 - n * 0.04), sel ? [255, 255, 255] : DIM, bg);
  }
  softKeys(S, T.show, T.back);
}
