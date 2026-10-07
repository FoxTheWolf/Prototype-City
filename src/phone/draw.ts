import { compass, cityName, operatorName, diagonalName, districtName, landmarkName, roadName } from '../locale/names';
import { diagS, districtAt, nearestRoad, SIDEWALK } from '../sim/city';
import { calendar } from '../sim/clock';
import { app, appLabel, songInfo, volBars } from './apps';
import { box, CHROME, lerp, PICK, PICK_DIM, PICK_INK, vgrad } from './ui';
import { applyTheme, BAD, hdLayer, bigText, ch, DAYS, hhmm, INK, LCD, Lcd, MONTHS, SH, softKeys, statusBar, SW, T, typed, typeHint, type C3 } from './lcd';
import { type World } from '../sim/world';
import { Ground, groundAt, MAP_RES, mapRaster, type MapRaster } from './mapdata';
import { APPS, BOOT_LOG_S, fmtDist, INDOOR_ROW_M, ZOOM_ROW_M, type Key, type Phone } from './phone';
import { cellAt, DOOR, planOf, ROOM, type RoomKind } from '../sim/interior';
import { hash3 } from '../core/rng';
import { BOARDS } from '../sim/device';
import { HD, HdOrder } from '../render/hd';
import { EYE } from '../render/eye';
import { SHAPE } from '../render/atlas';
import { CASES, COL_MM, keysOf, PHONE_H, PHONE_W, ROW_MM, SCREEN_MM, SHELLS, UP_ROWS, type KeyRect } from './shells';
import { CharGrid } from '../render/grid';
import { HdLayer } from '../render/hd';
import { BODY_GPU, brandColor, drawBody3d, glassUv, nearRocker, pickBody } from './body3d';
import { CHROME as BARS, CONTENT_Y0, CONTENT_Y1, paintChrome, PHONE_PX, SCR_H } from './pixui';
import { APP_COL, HITS, paintDial, paintMenu, paintStandby, paintVolume, type Card, type Dial, type Standby, type Tile } from './pixpages';
import { artColors } from './hdicons';
import { type Paint } from '../render/paint2d';
import { phoneFam } from '../render/brands';
import { nextTurn, onRoute, placeAddress, placeAt, placeDistrict, placeHours, placeKind, placeName, type Place } from './places';
import { formatNumber } from '../sim/telco';

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
/** How much of it shows when held up (the rest is below the screen edge): the closed phone, whole. */
const SHOWN = UP_ROWS;
/** The screen on the phone, in cells from its top left (fractions: it lies in pixels, not on the grid; the phone's manual). */
const SX = SCREEN_MM[0] / COL_MM, SY = SCREEN_MM[1] / ROW_MM, SWC = (SCREEN_MM[2] - SCREEN_MM[0]) / COL_MM, SHC = (SCREEN_MM[3] - SCREEN_MM[1]) / ROW_MM;
/**
 * The screen's own picture (the manual: a texture of its own, upright, 240 x 400 at 1080p): the apps draw
 * on a grid of SW x SH cells and its pixel layer, and the compositor lays it on the glass (main passes it).
 * For now the apps of before (42 x 26 cells) go on it as they are, a cell ~5.7 x 15 pixels.
 */
/** How the screen's cells' shape compares to the interface's (width over height): the map keeps its scale with it. */
/** The cells' part of the screen (the content area between the pixel bars, pixui.ts): its top and height in interface cells. */
const CY = SY + (SHC * CONTENT_Y0) / SCR_H, CHC = (SHC * (CONTENT_Y1 - CONTENT_Y0)) / SCR_H;
const PIC_K = (SWC * SH) / (CHC * SW);
export const PHONE_PIC = { grid: new CharGrid(SW, SH), hd: new HdLayer(SW * HD, SH * HD), on: false, rect: [0, 0, 1, 1] as number[], full: [0, 0, 1, 1] as number[] };
const MAP_ROWS = SH - 4;
/** Metres the map shows across and down, for a cell aspect (width / height) and zoom (a column is the cell aspect of a row, so nothing is stretched). */
export const mapView = (aspect: number, zoom: number, indoor = false): [number, number] => {
  const r = (indoor ? INDOOR_ROW_M : ZOOM_ROW_M)[zoom];
  return [SW * r * aspect * PIC_K, MAP_ROWS * r];
};

const keyRects = new Map<number, KeyRect[]>();
const keysFor = (look: number) => { let k = keyRects.get(look); if (!k) keyRects.set(look, (k = keysOf(SHELLS[look]))); return k; };

/** The keypad's rows under the upper plate (the rail's run, in rows). */
const KP_ROWS = PHONE_H - UP_ROWS;
/**
 * How many of the keypad's rows the rail has out (15.19b), in whole rows so the key labels and the clicks
 * keep to the keys: eased out of the run into the spring's catch.
 */
export const railRows = (P: Phone) => Math.round(KP_ROWS * (1 - (1 - P.slide) ** 2));
/** Where a key is drawn and clicked: the keypad's rows ride up under the upper plate as the rail shuts (null: out of sight). */
const keyRow = (P: Phone, y0: number): number | null => {
  if (y0 < UP_ROWS) return y0;
  const y = y0 - (KP_ROWS - railRows(P));
  return y >= UP_ROWS ? y : null;
};

/** Where the phone's top left corner is on the grid: held up whole, as far as the rail is open (the lower plate stays put in the hand, the screen rides up). */
function origin(cols: number, rows: number, P: Phone): [number, number] {
  const e = 1 - (1 - P.raise) ** 3;
  // vibrating: the phone shakes in the hand in the same bursts as the buzz (0.47 s on every 0.8 s)
  const t = performance.now() / 1000, u = P.buzzUntil - t, on = u > 0 && (P.buzzLen - u) % 0.8 < 0.47;
  const sx = on ? (Math.floor(t * 34) % 2 ? 1 : -1) : 0, sy = on && Math.floor(t * 23) % 3 === 0 ? 1 : 0;
  // peeking for a notification, its top rows; Alt held in the pocket, just the music keys on top and a little of the body
  const peek = Math.max(Math.round(9 * (1 - (1 - P.peek) ** 3)), Math.round(3 * (1 - (1 - P.handy) ** 3)));
  const full = UP_ROWS + railRows(P), shown = Math.min(SHOWN, full);
  return [cols - PHONE_W - 6 + sx, rows - Math.max(peek, Math.round((shown + (full - shown) * P.lift) * e)) + sy];
}

/**
 * The music keys on the top edge, right of the centre (2026-10-06; they were on the left side, then five, then in the corner where the body rounds off):
 * previous, play/pause and next, each a rounded bump drawn in HD pixels standing out of the body
 * (columns from the phone's left), with the keyboard's shortcut that does the same (Alt held). The
 * volume is the earphones' thumbwheel on the cable (DIAL), or Alt with the arrows.
 */
const TOP_KEYS: [Key, number, number, string][] = [['prev', 8, 4, '<'], ['play', 16, 4, 'P'], ['next', 24, 4, '>']];
/** The earphones' volume wheel on the cable this frame: its centre (interface cells), or null when not drawn. */
export const DIAL: { at: [number, number] | null } = { at: null };
/** Whether a grid cell is over the wheel's grab area (wider and taller than the wheel, as the cable sways). */
export const onDial = (x: number, y: number) => !!DIAL.at && Math.abs(x - DIAL.at[0]) <= 5 && Math.abs(y - DIAL.at[1]) <= 3;

/** The key under a grid cell, if any. */
export function keyAt(cols: number, rows: number, P: Phone, x: number, y: number): Key | null {
  const [ox, oy] = origin(cols, rows, P);
  // the music keys on top: a row taller to hit than drawn
  if (y >= oy - 2 && y < oy) for (const [k, x0, w] of TOP_KEYS) if (x >= ox + x0 && x < ox + x0 + w) return k;
  // the arrows are thin: their hit areas reach a row (or two columns) further out than they are drawn
  const grow: Partial<Record<Key, [number, number, number, number]>> = { up: [0, -1, 0, 1], down: [0, 0, 0, 1], left: [-2, 0, 2, 0], right: [0, 0, 2, 0] };
  for (const [k, x0, ky, w, h] of keysFor(P.look)) {
    const y0 = keyRow(P, ky);
    if (y0 === null) continue;
    const [gx, gy, gw, gh] = grow[k] ?? [0, 0, 0, 0];
    if (x >= ox + x0 + gx && x < ox + x0 + gx + w + gw && y >= oy + y0 + gy && y < oy + y0 + gy + h + gh) return k;
  }
  return null;
}

/**
 * What the phone shows at a point (pixels from the interface's top-left; cw x ch pixels a cell): a key, 'body'
 * for the rest of it (a click there that hits no key and not the screen is a miss and does nothing, instead
 * of OK: playtest 2026-10-07), or null off it. With the body drawn in cubes, the same ray as the GPU's
 * (body3d.ts pickBody), so the keys' hit areas are what is drawn; else the keys' cells.
 */
export function pickPhone(cols: number, rows: number, P: Phone, px: number, py: number, cw: number, ch: number): Key | 'body' | null {
  const B = BODY_GPU;
  if (PHONE_BODY.on && B.w) {
    const i = Math.floor(px - PHONE_BODY.ox * cw - B.dx), j = Math.floor(py - PHONE_BODY.oy * ch - B.dy);
    return i >= 0 && j >= 0 && i < B.w && j < B.h ? pickBody(i, j) : null;
  }
  const x = Math.floor(px / cw), y = Math.floor(py / ch), [ox, oy] = origin(cols, rows, P);
  return keyAt(cols, rows, P, x, y) ?? (x >= ox && x < ox + PHONE_W && y >= oy - 2 && y < rows ? 'body' : null);
}

/** The phone screen's u, v (0..1 across it) at a point (pixels from the interface's top-left), on the leaning glass; null without the body drawn. */
export function screenUv(px: number, py: number, cw: number, ch: number): [number, number] | null {
  return PHONE_BODY.on && BODY_GPU.w ? glassUv(px - PHONE_BODY.ox * cw - BODY_GPU.dx, py - PHONE_BODY.oy * ch - BODY_GPU.dy) : null;
}

/** Whether a point (pixels from the interface's top-left) is on the phone's volume rocker, or near it (the wheel turns the volume there). */
export function onRocker(px: number, py: number, cw: number, ch: number): boolean {
  return PHONE_BODY.on && BODY_GPU.w > 0 && nearRocker(Math.floor(px - PHONE_BODY.ox * cw - BODY_GPU.dx), Math.floor(py - PHONE_BODY.oy * ch - BODY_GPU.dy));
}

const lum = (c: C3) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

/** The glint, eased over time so it does not jump from frame to frame. */
const GL = { lat: 0, str: 0, r: 1, g: 1, b: 1, back: 0, at: 0 };

/**
 * The sway: the hand lags the eye, so as the view turns the body turns a little the other way and eases
 * back when it stops (yaw, pitch in rad, to body3d.ts), from the camera's last angles.
 */
const SWAY = { yaw: NaN, pitch: 0, ty: 0, tp: 0 };

/**
 * The body's picture this frame (body3d.ts BODY_PIC): whether it is drawn, the phone's top-left (interface
 * cells), and the interface's cell size in pixels (main sets it with the layout), which gives its resolution.
 */
export const PHONE_BODY = { on: false, ox: 0, oy: 0, cw: 0, ch: 0 };
/** Where this frame drew the phone's lit screen (interface cells: x, y, w, h), for the bloom; null when off or not drawn. */
export const SCREEN: { at: number[] | null } = { at: null };

export function drawPhone(g: CharGrid, P: Phone, world: World, aspect: number, now: number, light: Float32Array, glint: Float32Array, cam?: { yaw: number; pitch: number }) {
  if (P.raise < 0.01 && P.peek < 0.01 && P.handy < 0.01) { SWAY.yaw = NaN; return; }
  const [ox, oy] = origin(g.cols, g.rows, P);
  applyTheme(P.prefs.theme);
  const SHL = SHELLS[P.look];
  // the upper plate in the look's color (the manual's section 7)
  const BODY: C3 = SHL.body ?? P.device.body;
  const Lr = light[0], Lg = light[1], Lb = light[2];
  const dt = Math.min(0.1, Math.max(0, now - GL.at)), q = 1 - Math.exp(-dt / 0.25);
  GL.at = now;
  if (cam) {
    // the view's turn this frame (unwrapped), as a speed; the body leans with it, a fifth of a second behind
    const dy = Number.isNaN(SWAY.yaw) ? 0 : Math.atan2(Math.sin(cam.yaw - SWAY.yaw), Math.cos(cam.yaw - SWAY.yaw)), dp = Number.isNaN(SWAY.yaw) ? 0 : cam.pitch - SWAY.pitch;
    SWAY.yaw = cam.yaw; SWAY.pitch = cam.pitch;
    const inv = dt > 1e-4 ? 1 / dt : 0, k = 1 - Math.exp(-dt / 0.12);
    SWAY.ty += (Math.max(-0.06, Math.min(0.06, dy * inv * 0.012)) - SWAY.ty) * k;
    SWAY.tp += (Math.max(-0.045, Math.min(0.045, dp * inv * 0.012)) - SWAY.tp) * k;
  }
  GL.lat += (glint[0] - GL.lat) * q; GL.str += (glint[1] - GL.str) * q;
  GL.back += (glint[5] - GL.back) * q; GL.r += (glint[2] - GL.r) * q; GL.g += (glint[3] - GL.g) * q; GL.b += (glint[4] - GL.b) * q;
  // the world's eye (its exposure and adaptation): in the dark the screen looks brighter and blooms, by
  // day it looks dimmer (capped: a bright page must not wash out in the dark, see the ceiling on the glass below)
  const gain = Math.min(1.18, 0.85 + 0.35 * Math.min(1, EYE.k / 0.6)), bloom = EYE.k;
  // the glint: the brightest light nearby mirrored in the phone, a soft diagonal band on the side
  // it comes from, in its color, stronger for a light behind the player
  const s0 = 34 + GL.lat * 22, amp = GL.str * 55;
  const sheen = (x: number, y: number) => Math.exp(-(((x + y * 0.55 - s0) / 5) ** 2));
  const inG = (x: number, y: number) => { const gx = ox + x, gy = oy + y; return gx >= 0 && gy >= 0 && gx < g.cols && gy < g.rows ? gy * g.cols + gx : -1; };




  const on = P.screen !== 'off';
  const isDown = (k: Key) => { const t = P.pressed.get(k); return t !== undefined && now - t < 0.14; };
  // 15.19: the body in little cubes, as the phone's manual draws it (body3d.ts), in a picture of its own at the
  // monitor's resolution (the compositor lays it under the interface), with the keypad's legends and the maker's name on it
  if (PHONE_BODY.cw > 0) {
    const top = SHL.face ?? BODY, fam = phoneFam(P.device.maker);
    drawBody3d(PHONE_BODY.cw / COL_MM, PHONE_BODY.ch / ROW_MM, SHL, P.look, BODY, P.case ? CASES[P.case] : null, isDown, P.hover,
      { rgb: light, lat: GL.lat, str: GL.str, glint: [GL.r, GL.g, GL.b] }, [SWAY.ty, SWAY.tp], (railRows(P) - KP_ROWS) * PHONE_BODY.ch, on,
      { fam, name: P.maker, col: brandColor(fam, lum(top)) });
    PHONE_BODY.on = true; PHONE_BODY.ox = ox; PHONE_BODY.oy = oy;
  }
  // the earphones plugged in (2026-10-06), in HD pixels: a chrome plug in the jack on top, its black
  // housing (the manual's section 8: black earphones) and strain relief above, and the cable rising in a slack loop up and to the left, then
  // falling past the phone's side and out of sight at the bottom (2026-10-06: it went off the top before)
  const HL = hdLayer();
  const lit = (c: C3, k = 1): C3 => [c[0] * Lr * k, c[1] * Lg * k, c[2] * Lb * k];
  if (P.earphones && HL) {
    // the jack on the top edge, right of the music keys (the manual: 43.5 to 47 mm)
    const jc = ox + 45.25 / COL_MM, jx = Math.round(jc * HD) - 3, jy = oy * HD;
    for (let y = -13; y < 1; y++) {
      // the sleeve (metal, 4 wide), the housing (6 wide), the relief (2 wide) the cable leaves from
      const [x0, x1, c0]: [number, number, C3] = y > -4 ? [1, 5, [201, 206, 214]] : y > -11 ? [0, 6, [34, 35, 39]] : [2, 4, [26, 27, 30]];
      for (let x = x0; x < x1; x++) { const c = lit(c0, x === x0 ? 1.15 : x === x1 - 1 ? 0.7 : 1); HL.put(jx + x, jy + y, c[0], c[1], c[2], HdOrder.Over); }
    }
    // the cable: a smooth curve (Catmull-Rom) through points in cells, swaying a little
    const sway = Math.sin(now * 1.3) * 0.6, pts: [number, number][] = [
      [jc, oy - 13 / HD], [jc, oy - 13 / HD], [ox + 5, oy - 6 + sway * 0.5], [ox - 5 + sway, oy - 4], [ox - 13 + sway, oy + 10], [ox - 11, g.rows + 3], [ox - 11, g.rows + 3]];
    for (let s = 1; s < pts.length - 2; s++) {
      const [p0, p1, p2, p3] = [pts[s - 1], pts[s], pts[s + 1], pts[s + 2]];
      for (let i = 0; i <= 120; i++) {
        const u = i / 120, u2 = u * u, u3 = u2 * u;
        const cr = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (3 * b - a - 3 * c + d) * u3);
        const X = Math.round(cr(p0[0], p1[0], p2[0], p3[0]) * HD), Y = Math.round(cr(p0[1], p1[1], p2[1], p3[1]) * HD);
        const c = lit([30, 31, 35], 0.85 + 0.15 * Math.cos((s + u) * 3));
        HL.put(X, Y, c[0], c[1], c[2], HdOrder.Over);
        HL.put(X + 1, Y, c[0] * 0.7, c[1] * 0.7, c[2] * 0.7, HdOrder.Over);
      }
    }
    // the volume wheel on the cable (2026-10-06): a little black remote with a chrome thumbwheel on its
    // side, knurled (the manual), lit ice-blue under the cursor; the ridges move with the volume, as the wheel turns under the mouse's wheel
    const [dx, dy] = pts[3], X0 = Math.round(dx * HD) - 5, Y0 = Math.round(dy * HD) - 3, hot = P.dialHot;
    DIAL.at = [Math.round(dx), Math.round(dy)];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 11; x++) {
      const corner = (x === 0 || x === 10) && (y === 0 || y === 6);
      if (corner) continue;
      let c: C3;
      const wheel = x >= 7 && y >= 1 && y <= 5;
      if (wheel) c = (y + Math.round(P.tn.vol * 10)) % 2 ? [93, 98, 106] : [201, 206, 214];
      else c = x === 0 || y === 0 ? [44, 45, 50] : x === 10 || y === 6 ? [12, 12, 14] : [26, 27, 30];
      const q = wheel && hot ? [143, 211, 255] as C3 : lit(c);
      HL.put(X0 + x, Y0 + y, q[0], q[1], q[2], HdOrder.Over);
    }
  } else DIAL.at = null;
  // the music keys on top are cubes of the body (body3d.ts); with Alt held, the keyboard's shortcut for each above it, and the wheel's
  if (P.handy > 0.5) {
    const tag = (x: number, y: number, s: string) => { for (let n = 0; n < s.length; n++) { const i = inG(x + n, y); if (i >= 0) { g.setBg(i, 20, 16, 10); g.put(i, s.charCodeAt(n), 255, 220, 140); } } };
    tag(TOP_KEYS[0][1] - 5, -3, 'ALT+');
    for (const [, x0, w, alt] of TOP_KEYS) tag(x0 + (w >> 1), -3, alt);
    if (DIAL.at) tag(DIAL.at[0] - ox - 3, DIAL.at[1] - oy - 3, T.apps.tunes.wheel);
  }

  // the screen: the apps draw on its own grid and pixel layer (PHONE_PIC), which the compositor lays on the glass
  const PG = PHONE_PIC.grid, PH = PHONE_PIC.hd;
  PG.clear(); PH.wipe();
  let page: ((Pt: Paint) => void) | null = null;
  HITS.length = 0;
  const S = new Lcd(PG, 0, 0, PH);
  PHONE_PIC.on = true; PHONE_PIC.rect = [ox + SX, oy + CY, SWC, CHC]; PHONE_PIC.full = [ox + SX, oy + SY, SWC, SHC];
  SCREEN.at = on ? PHONE_PIC.full : null;
  BARS.status = null; BARS.soft = ['', ''];
  if (!on) for (let y = 0; y < SH; y++) S.fill(y, [5, 6, 8]);
  else {
    for (let y = 0; y < SH; y++) S.fill(y, LCD);
    const t = now - P.since;
    if (P.screen === 'boot') boot(S, P, world, t);
    else {
      statusBar(S, world, P.gps.state, now, P.radio, P.inbox.some((m) => !m.read), P.wifi, P.batt, P.charging, P.earphones);
      // the screens redrawn in pixels by the manual v2 (pixpages.ts) paint over the cells; the others still draw on them
      if (P.screen === 'standby') { const d = standbyData(P, world, t, now); page = (Pt) => paintStandby(Pt, d, now); softKeys(S, T.menu, T.hide); }
      else if (P.screen === 'menu') {
        const tiles = APPS.map((a, n): Tile => ({ label: appLabel(a), col: APP_COL[n], art: artColors(a), sel: n === P.sel, pre: () => { P.sel = n; } }));
        page = (Pt) => paintMenu(Pt, tiles, t); softKeys(S, T.open, T.back);
      }
      else if (P.screen === 'calls' && !P.call) { const d = dialData(P, world, t); page = (Pt) => paintDial(Pt, d, now); softKeys(S, P.dial ? T.apps.save : '', P.dial ? T.apps.clear : T.back); }
      else if (P.screen === 'map') map(S, P, world, aspect * PIC_K, t, now);
      else if (P.screen === 'places') places(S, P, world, t, now);
      else app(S, P, world, t, now);
      // the volume, for a moment after a side key moved it, over whatever is open
      if (now - P.volAt < 1.4 && page) { const pg = page; page = (Pt) => { pg(Pt); paintVolume(Pt, P.tn.vol, T.apps.vol); }; }
      else if (now - P.volAt < 1.4) {
        const y = SH - 3, B: C3 = [10, 14, 24];
        box(S, 11, y, SW - 12, y, B, B, 0);
        S.text(13, y, T.apps.vol, [150, 165, 190], B);
        volBars(S, 18, y, P.tn.vol, [200, 130, 255], [110, 120, 140], B);
      }
    }
  }
  // the glass over the screen: the eye's adaptation, a faint wash of the scene's light, and the glint
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const k = (y * SW + x) * 4, sh = sheen(SX + (x * SWC) / SW, CY + (y * CHC) / SH) * amp * 0.45, C = PG.cells, B = PG.bg;
    // the glass's ceiling: past 200 the light rolls off, so the brightest pages keep their detail
    const roll = (v: number) => (v > 200 ? 200 + (v - 200) * 0.35 : v);
    for (let c = 1; c < 4; c++) C[k + c] = roll(C[k + c] * gain);
    for (let c = 0; c < 3; c++) B[k + c] = roll(B[k + c] * gain);
    // (no fingerprints here: drawn a cell at a time they were grey blocks over the page; the manual puts them on the plate)
    B[k] += 3 * Lr + sh * GL.r; B[k + 1] += 3 * Lg + sh * GL.g; B[k + 2] += 4 * Lb + sh * GL.b;
    C[k + 1] += sh * 0.5 * GL.r; C[k + 2] += sh * 0.5 * GL.g; C[k + 3] += sh * 0.5 * GL.b;
    // the pixels over this cell (a photo) under the same glass
    for (let iy = 0; iy < HD; iy++) for (let ix = 0; ix < HD; ix++) {
      const q = PH.at(x * HD + ix, y * HD + iy);
      if (q < 0) continue;
      const X = PH.px;
      for (let c = 0; c < 3; c++) X[q + c] = roll(X[q + c] * gain);
      X[q] += 3 * Lr + sh * GL.r; X[q + 1] += 3 * Lg + sh * GL.g; X[q + 2] += 4 * Lb + sh * GL.b;
    }
  }
  // the bars and a touch's answer, in pixels over the cells (the manual's section 6), and the screens drawn in pixels
  paintChrome(now, on ? Math.min(1.1, gain) : 1, !on ? [5, 6, 8] : P.screen === 'boot' ? LCD : null, page);
  // under the picture, the interface's cells the glass covers get the screen's colors (the GPU's glow and
  // bloom read the screen's light from them; the picture hides them)
  const gx0 = Math.floor(ox + SX), gy0 = Math.floor(oy + SY), gx1 = Math.ceil(ox + SX + SWC), gy1 = Math.ceil(oy + SY + SHC);
  for (let gy = Math.max(0, gy0); gy < Math.min(g.rows, gy1); gy++) for (let gx = Math.max(0, gx0); gx < Math.min(g.cols, gx1); gx++) {
    const px = Math.min(SW - 1, Math.max(0, Math.floor(((gx + 0.5 - ox - SX) / SWC) * SW))), py = Math.min(SH - 1, Math.max(0, Math.floor(((gy + 0.5 - oy - SY) / SHC) * SH)));
    // (no letters: those peeked out under the picture's edge, a footer twice; a letter's light is mixed into the paper instead)
    const k = (py * SW + px) * 4, i = gy * g.cols + gx, gl = PG.cells[k] > 32 ? 0.3 : 0;
    // where the pixel picture covers the cells, its colour
    const X = PHONE_PX.img, q = (Math.min(SCR_H - 1, Math.max(0, Math.floor(((gy + 0.5 - oy - SY) / SHC) * SCR_H))) * X.w + Math.min(X.w - 1, Math.max(0, Math.floor(((gx + 0.5 - ox - SX) / SWC) * X.w)))) * 4;
    if (X.px[q + 3] === 255) { g.setBg(i, X.px[q], X.px[q + 1], X.px[q + 2]); g.put(i, 32, 0, 0, 0); continue; }
    g.setBg(i, PG.bg[k] + (PG.cells[k + 1] - PG.bg[k]) * gl, PG.bg[k + 1] + (PG.cells[k + 2] - PG.bg[k + 1]) * gl, PG.bg[k + 2] + (PG.cells[k + 3] - PG.bg[k + 2]) * gl);
    g.put(i, 32, 0, 0, 0);
  }
  void bloom;
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
  if (t >= BOOT_LOG_S) return splash(S, D.look, P.maker.toUpperCase(), D.model.toUpperCase(), t - BOOT_LOG_S);
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
 * The maker's splash: one per body (shells.ts; a maker has one or two bodies), in the spirit of its body.
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
 * What the standby screen shows (painted in pixels by pixpages.ts paintStandby): the wallpaper, the hour,
 * the date and the network it is on, a card for each thing waiting (missed calls, unread texts, the next
 * reminder; Phone.notices, the same list the arrows step through, the one picked lit), the music's panel.
 */
function standbyData(P: Phone, world: World, t: number, now: number): Standby {
  const c = calendar(world.time), R = P.radio;
  const date = `${DAYS[c.weekday]} ${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${c.year}`;
  const op = R.state === 'service' ? operatorName(world.city, world.telco.player.op ?? 0).toUpperCase() : R.state === 'search' ? (Math.floor(now * 2) & 1 ? T.apps.searching : '') : T.noService;
  const unread = P.inbox.filter((m) => !m.read).length, N = P.notices(), sel = N[P.nsel];
  const rem = P.cal.reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at)[0];
  const pick = (n: string) => () => { P.nsel = N.indexOf(n as never); };
  const cards = N.filter((n) => n !== 'tune').map((n, k): Card => {
    // each card in its app's colour (the phone's, the messages', the calendar's); the first blinks while something waits
    const [text, col]: [string, C3] = n === 'missed' ? [(P.missed > 1 ? T.apps.missedN : T.apps.missed).replace('{n}', String(P.missed)), APP_COL[APPS.indexOf('calls')]]
      : n === 'sms' ? [`${unread} ${unread > 1 ? T.apps.newTexts : T.apps.newText}`, APP_COL[APPS.indexOf('messages')]]
      : [`${hhmm(calendar(rem.at).hour)} ${rem.text}`, APP_COL[APPS.indexOf('calendar')]];
    return { col, text, sel: sel === n, blink: k === 0 && n !== 'rem' && sel !== n, pre: pick(n) };
  });
  let tune: Standby['tune'] = null;
  if (N.includes('tune')) {
    const s = songInfo(P, P.tn.cur);
    tune = { title: s.title, band: s.band, at: P.tn.at, len: P.tn.len, playing: P.tn.playing, vol: P.tn.vol, shuffle: P.tn.shuffle ? T.apps.tunes.shuffle : '', spec: P.spec, sel: sel === 'tune', pre: pick('tune') };
  }
  return { wall: P.prefs.wall, time: world.time, t, hour: hhmm(c.hour), date, op, opOk: R.state === 'service', cards, tune, volLabel: T.apps.vol,
    hint: P.missed || unread ? T.apps.clearHint : '' };
}

/**
 * What the dialer shows (painted in pixels by pixpages.ts paintDial): the number typed and whose it is, and
 * the calls of late, the one picked lit (seven at a time, scrolled to keep it in view).
 */
function dialData(P: Phone, world: World, t: number): Dial {
  const A = T.apps, d = P.dial, view = 7, sel = Math.min(P.lsel, P.log.length - 1), top = Math.max(0, Math.min(sel - view + 1, P.log.length - view));
  const log = P.log.slice(top, top + view).map((e, n) => {
    const k = top + n, nm = P.contacts.find((x) => x.number === e.number)?.name, num = /^[0-9]{7}$/.test(e.number) ? formatNumber(world.telco, e.number) : e.number;
    const picked = k === sel && !d;
    return { who: nm ?? num, kind: e.kind, when: `${A.log[e.kind]} ${hhmm(calendar(e.at).hour)}`, sel: picked, call: picked, pre: () => { P.dial = ''; P.lsel = k; } };
  });
  return { t, dial: d, who: P.contacts.find((x) => x.number === d)?.name ?? '', missed: P.missed ? `${P.missed} missed` : '', hint: A.dialHint,
    tabs: [A.tabCalls, A.tabContacts], toContacts: () => { P.open('contacts', performance.now() / 1000); }, recent: A.recent, log };
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
const ROAD: C3 = [255, 255, 255], LABEL: C3 = [70, 76, 92], TB: C3 = CHROME.top, FOOT: C3 = [248, 249, 252], ROUTE: C3 = [70, 140, 250];
const F = T.find, A = T.apps;

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
  // the route: a blue line along its legs; the destination (or the place shown): a red pin, drawn last
  const N = P.nav, dest = N ? N.to : P.pin;
  if (N?.R.length) {
    const step = 0.5 * Math.min(colM, rowM), R = N.R;
    for (let k = 0; k + 3 < R.length; k += 2) {
      const L = Math.hypot(R[k + 2] - R[k], R[k + 3] - R[k + 1]);
      for (let d = 0; d <= L; d += step) {
        const [c, r] = at(R[k] + ((R[k + 2] - R[k]) * d) / (L || 1), R[k + 1] + ((R[k + 3] - R[k + 1]) * d) / (L || 1));
        if (c >= 0 && c < SW && r >= 0 && r < MAP_ROWS && r < drawn) S.put(c, 2 + r, 32, ROUTE, ROUTE);
      }
    }
  }
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
  if (dest !== null) {
    const [px, py] = placeAt(city, dest), [c, r] = at(px, py);
    if (c >= 0 && c < SW && r >= 0 && r < MAP_ROWS && r < drawn) S.put(c, 2 + r, ch('v'), [255, 255, 255], Math.floor(now * 2) & 1 ? [230, 50, 40] : [180, 30, 24]);
  }
  marker(S, P, at, drawn, now);
  if (P.pin !== null) return placeCard(S, P, world, P.pin, t);
  if (N) return navBar(S, P, world, N, t, now);
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
  softKeys(S, panned ? T.center : F.search, T.back);
}

/** The card of a place shown on the map: name, kind, open or not, phone, address, how far; OK walks there. */
function placeCard(S: Lcd, P: Phone, world: World, p: Place, t: number) {
  const { city } = world, CARD: C3 = [252, 252, 254], INK2: C3 = [30, 34, 44], GREY: C3 = [110, 118, 132], y0 = SH - 8;
  box(S, 0, y0, SW - 1, SH - 2, CARD, CARD, 0);
  for (let x = 0; x < SW; x++) S.put(x, y0, 32, [200, 204, 214], [200, 204, 214]);
  S.put(1, y0 + 1, ch('v'), [255, 255, 255], [220, 46, 38]);
  S.text(3, y0 + 1, typed(placeName(city, p).slice(0, SW - 4), t), INK2, CARD);
  S.text(3, y0 + 2, typed(`${placeKind(city, p)} - ${placeDistrict(city, p)}`.slice(0, SW - 4), t - 0.1), GREY, CARD);
  const h = placeHours(city, p, calendar(world.time).hour);
  if (h) {
    const tag = h.open ? F.openNow : F.closed, col: C3 = h.open ? [40, 150, 70] : [200, 50, 40];
    S.text(3, y0 + 3, tag, [255, 255, 255], col);
    S.text(4 + tag.length, y0 + 3, typed(h.text, t - 0.15), GREY, CARD);
  }
  const num = p >= 0 ? formatNumber(world.telco, world.telco.bizNum[p]) : F.noPhone;
  S.text(3, y0 + 4, typed(num, t - 0.2), p >= 0 ? [40, 90, 170] : GREY, CARD);
  const [hx, hy] = P.gps.known ? [P.gps.x, P.gps.y] : [NaN, NaN], [px, py] = placeAt(city, p);
  const far = P.gps.known ? `${fmtDist(Math.hypot(px - hx, py - hy), P.prefs.dist)} ${compass(px - hx, py - hy)}` : '--';
  S.text(SW - far.length - 1, y0 + 4, far, INK2, CARD);
  S.text(3, y0 + 5, typed(placeAddress(city, p).slice(0, SW - 4), t - 0.25), INK2, CARD);
  softKeys(S, F.route, T.back);
}

/** Under the map while a route is followed: the next turn (or how it stands) and the way left. */
function navBar(S: Lcd, P: Phone, world: World, N: NonNullable<Phone['nav']>, t: number, now: number) {
  const { city } = world, BAR2: C3 = [30, 66, 140], W2: C3 = [255, 255, 255], DIM2: C3 = [176, 196, 232], g = P.gps, d = (m: number) => fmtDist(m, P.prefs.dist);
  S.fill(SH - 3, BAR2); S.fill(SH - 2, BAR2);
  let line = '', sub = placeName(city, N.to);
  if (N.state === 'arrived') line = F.arrived;
  else if (N.state === 'none') line = F.noRoute;
  else if (N.state === 'routing') {
    const J = P.radio.job;
    line = (N.R.length || N.off > 0 ? F.rerouting : F.routing).slice(0, SW - 2);
    if (!g.known) sub = T.gps.search;
    else if (J?.what === 'route' && J.state === 'loading') sub = A.wx.kb.replace('{a}', J.done.toFixed(1)).replace('{b}', J.kb.toFixed(1));
    else if (!P.online()) sub = F.offline;
    line += '.'.repeat(Math.floor(now * 3) % 4);
  } else if (g.known) {
    const o = onRoute(N.R, g.x, g.y), turn = nextTurn(city, N.R, o.leg, o.px, o.py);
    line = turn ? F.turn.replace('{d}', d(turn.dist)).replace('{side}', turn.right ? F.right : F.left).replace('{road}', turn.road) : F.straight.replace('{d}', d(o.left));
    sub = `${F.togo.replace('{d}', d(o.left))} - ${sub}`;
    // which way the next turn goes
    if (turn) S.text(SW - 3, SH - 3, turn.right ? '->' : '<-', [255, 220, 120], BAR2);
  }
  S.text(1, SH - 3, typed(line.slice(0, SW - 5), t - 0.2), W2, BAR2);
  S.text(1, SH - 2, typed(sub.slice(0, SW - 2), t - 0.3), DIM2, BAR2);
  softKeys(S, F.end, T.back);
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
  bedroom: [214, 204, 236], kitchen: [214, 230, 196], bath: [190, 226, 234], office: [204, 214, 230], open: [212, 222, 236], shop: [248, 226, 170], store: [222, 208, 180],
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
        const v = plan ? cellAt(plan, x0 + ((i + 0.5) / 3) * colM, y0 + ((j + 0.5) / 3) * rowM) : 0, room = v & ROOM;
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
    if ((cellAt(plan, mx, my) & ROOM) !== n + 1) return;
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
  softKeys(S, P.panX || P.panY ? T.center : P.nav ? F.end : F.search, T.back);
}

/**
 * Maps' search: a field typed on the keypad (Abc, T9 or 123, as messages are), and under it the
 * places the server sent back, nearest first, each with its kind, whether it is open and how far.
 */
function places(S: Lcd, P: Phone, world: World, t: number, now: number) {
  const { city } = world, PG: C3 = [244, 246, 250], W: C3 = [255, 255, 255], INK2: C3 = [30, 34, 44], GREY: C3 = [110, 118, 132], BLUE: C3 = [40, 90, 170];
  for (let y = 1; y < SH - 1; y++) S.fill(y, PG);
  S.fill(1, CHROME.top);
  S.text(1, 1, '?', [255, 196, 90], CHROME.top);
  S.text(3, 1, typed(F.title, t), CHROME.text, CHROME.top);
  const ed = P.findEd, mode = ed.label();
  S.text(SW - mode.length - 1, 1, mode, CHROME.dim, CHROME.top);
  // the field, outlined while it is the one picked
  const on = P.psel < 0, q = ed.value(), blink = Math.floor(now * 2) & 1;
  box(S, 1, 3, SW - 2, 3, on ? W : [234, 236, 242], PG, 0);
  S.put(2, 3, ch('>'), on ? BLUE : GREY, on ? W : [234, 236, 242]);
  if (q) S.text(4, 3, q.slice(-(SW - 7)) + (on && blink ? '_' : ''), INK2, on ? W : [234, 236, 242]);
  else S.text(4, 3, on && blink ? '_' : F.hint.slice(0, SW - 7), GREY, on ? W : [234, 236, 242]);
  if (on) typeHint(S, 1, 4, ed, now, T.apps.modeHint, GREY, PG);
  // what came back: the search under way, nothing, or the list
  const J = P.radio.job;
  if (P.places === null) {
    if (P.findNote === 'offline') S.center(9, F.offline, BAD, PG);
    else if (J?.what === 'find') {
      const msg = J.state === 'nodata' ? T.apps.wx.noData : J.state === 'nosignal' ? T.apps.wx.lost : `${F.searching}${'.'.repeat(Math.floor(now * 3) % 4)}`;
      S.center(9, msg, J.state === 'nodata' || J.state === 'nosignal' ? BAD : BLUE, PG);
      if (J.state === 'loading') S.center(10, T.apps.wx.kb.replace('{a}', J.done.toFixed(1)).replace('{b}', J.kb.toFixed(1)), GREY, PG);
    }
    return softKeys(S, q ? F.search : '', q ? T.apps.clear : T.back);
  }
  if (!P.places.length) { S.center(9, F.none, GREY, PG); return softKeys(S, F.search, T.back); }
  S.text(1, 5, F.results.replace('{n}', String(P.places.length)), GREY, PG);
  const [hx, hy] = P.here(), hour = calendar(world.time).hour, rows = Math.floor((SH - 8) / 2), sel = Math.max(0, P.psel);
  const top = Math.max(0, Math.min(sel - (rows >> 1), P.places.length - rows));
  for (let n = 0; n < rows && top + n < P.places.length; n++) {
    const p = P.places[top + n], y = 6 + 2 * n, picked = top + n === P.psel, bg: C3 = picked ? PICK : PG;
    const [px, py] = placeAt(city, p), far = P.gps.known ? `${fmtDist(Math.hypot(px - hx, py - hy), P.prefs.dist)} ${compass(px - hx, py - hy)}` : '--';
    if (picked) { S.fill(y, bg); S.fill(y + 1, bg); }
    S.put(1, y, ch(p >= 0 ? 'v' : '*'), W, p >= 0 ? [220, 46, 38] : [210, 60, 50]);
    S.text(3, y, typed(placeName(city, p).slice(0, SW - far.length - 5), t - 0.1 - n * 0.04), picked ? PICK_INK : INK2, bg);
    S.text(SW - far.length - 1, y, far, picked ? PICK_DIM : GREY, bg);
    const h = placeHours(city, p, hour), kind = placeKind(city, p);
    S.text(3, y + 1, kind, picked ? PICK_DIM : GREY, bg);
    if (h) S.text(4 + kind.length, y + 1, h.open ? F.openNow : F.closed, picked ? W : h.open ? [40, 150, 70] : [200, 50, 40], bg);
  }
  softKeys(S, P.psel >= 0 ? T.show : F.search, T.back);
}

