import { compass, cityName, operatorName, diagonalName, districtName, landmarkName, roadName } from '../locale/names';
import { diagS, districtAt, nearestRoad, SIDEWALK } from '../sim/city';
import { calendar } from '../sim/clock';
import { app, appLabel, songInfo, tunesData, volBars } from './apps';
import { box, CHROME, lerp, vgrad } from './ui';
import { applyTheme, hdLayer, bigText, ch, DAYS, hhmm, INK, LCD, Lcd, MONTHS, SH, softKeys, statusBar, SW, T, typed, type C3 } from './lcd';
import { type World } from '../sim/world';
import { mapRaster } from './mapdata';
import { APPS, BOOT_LOG_S, STORE, fmtDist, INDOOR_ROW_M, ZOOM_ROW_M, type Key, type Phone } from './phone';
import { cellAt, planOf, ROOM } from '../sim/interior';
import { hash3 } from '../core/rng';
import { BOARDS } from '../sim/device';
import { HD, HdOrder } from '../render/hd';
import { EYE } from '../render/eye';
import { SHAPE } from '../render/atlas';
import { CASES, COL_MM, keysOf, PHONE_H, PHONE_W, ROW_MM, SCREEN_MM, SHELLS, UP_ROWS, type KeyRect } from './shells';
import { CharGrid } from '../render/grid';
import { HdLayer } from '../render/hd';
import { BODY_GPU, brandColor, drawBody3d, glassUv, nearRocker, pickBody } from './body3d';
import { CHROME as BARS, CONTENT_Y0, CONTENT_Y1, paintChrome, PHONE_PX, ptextW, SCR_H } from './pixui';
import { APP_COL, HITS, PAGED, paintCall, paintCompose, paintDial, paintMenu, paintContactEdit, paintContacts, paintMsgHome, paintMsgList, paintMsgRead, paintTunes, paintStandby, paintVolume, edHint, type CallPage, type Card, type Dial, type Standby, type Tile } from './pixpages';
import { artColors } from './hdicons';
import { type Paint } from '../render/paint2d';
import { phoneFam } from '../render/brands';
import { nextTurn, onRoute, placeAddress, placeAt, placeDistrict, placeHours, placeKind, placeName, type Place } from './places';
import { formatNumber } from '../sim/telco';
import { indoorMap, isWideRoad, mapMpp, MAP_H, MAP_W, paintMap, paintPlaces, roadsIn, streetMap, type MapFoot, type MapLabel, type MapPage, type PlacesPage } from './pixmap';

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
/** The cells' part of the screen (the content area between the pixel bars, pixui.ts): its top and height in interface cells. */
const CY = SY + (SHC * CONTENT_Y0) / SCR_H, CHC = (SHC * (CONTENT_Y1 - CONTENT_Y0)) / SCR_H;
export const PHONE_PIC = { grid: new CharGrid(SW, SH), hd: new HdLayer(SW * HD, SH * HD), on: false, rect: [0, 0, 1, 1] as number[], full: [0, 0, 1, 1] as number[] };
/** Metres the map shows across and down at a zoom (its pixels are square). */
export const mapView = (zoom: number, indoor = false): [number, number] => {
  const mpp = mapMpp((indoor ? INDOOR_ROW_M : ZOOM_ROW_M)[zoom]);
  return [MAP_W * mpp, MAP_H * mpp];
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

export function drawPhone(g: CharGrid, P: Phone, world: World, now: number, light: Float32Array, glint: Float32Array, cam?: { yaw: number; pitch: number }) {
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
      else if (P.screen === 'calls' && P.call) {
        const d = callData(P, world, now), c = P.call;
        page = (Pt) => paintCall(Pt, d, now);
        if (P.callIn && c.state === 'ringing') softKeys(S, T.apps.answer, T.apps.end); else softKeys(S, '', c.state === 'ended' ? '' : T.apps.end);
      }
      else if (P.screen === 'calls' && !P.call) { const d = dialData(P, world, t); page = (Pt) => paintDial(Pt, d, now); softKeys(S, P.dial ? T.apps.save : '', P.dial ? T.apps.clear : T.back); }
      else if (P.screen === 'contacts' || P.screen === 'contact') page = contactsPage(S, P, t, now);
      else if (P.screen === 'app' && STORE[P.appId][0] === 'tunes') {
        const d = tunesData(P, t);
        page = (Pt) => paintTunes(Pt, d, now); softKeys(S, P.tn.cur === P.tn.sel && P.tn.playing ? T.apps.tunes.pause : T.apps.tunes.play, T.back);
      }
      else if (P.screen === 'messages' || P.screen === 'msglist' || P.screen === 'msg' || P.screen === 'compose') page = msgPage(S, P, t, now);
      else if (P.screen === 'map') page = mapPage(S, P, world, t, now);
      else if (P.screen === 'places') page = placesPage(S, P, world, t, now);
      else page = app(S, P, world, t, now) ?? null;
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
  PAGED.on = page !== null;
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

/** What a call's screen shows (painted in pixels by pixpages.ts paintCall): who, how it stands, what is said so far. */
function callData(P: Phone, world: World, now: number): CallPage {
  const A = T.apps, c = P.call!, d = P.dial, who = P.contacts.find((x) => x.number === d)?.name;
  const num = d.replace(/\D/g, '').length === 7 ? formatNumber(world.telco, d) : d;
  const u = Math.max(0, now - (c.connectAt >= 0 ? c.connectAt : now)), tm = `${String(Math.floor(u / 60)).padStart(2, '0')}:${String(Math.floor(u % 60)).padStart(2, '0')}`;
  const ringIn = P.callIn && c.state === 'ringing';
  const state = ringIn ? A.incoming : c.state === 'dialing' ? `${A.calling}${'.'.repeat(Math.floor(now * 3) % 4)}` : c.state === 'ringing' ? `${A.ringing} (${c.rings})` : c.state === 'talk' ? tm : c.reason;
  const stateCol: C3 = c.state === 'ended' ? [255, 120, 90] : c.state === 'talk' ? [120, 255, 150] : [143, 211, 255];
  const cost = c.state === 'ended' && !P.callIn && c.cost() ? A.cost.replace('{c}', `$${(c.cost() / 100).toFixed(2)}`) : '';
  const lines = c.lines.map((L) => ({ who: L.who, text: L.text.slice(0, Math.ceil(((now - L.at) / L.dur) * L.text.length)) })).filter((L) => L.text);
  return { label: who ?? num, number: who ? num : '', state, stateCol, cost, ringingIn: ringIn, lines };
}

/** Contacts and a new contact, painted in pixels (pixpages.ts); sets the footer's actions, returns the page's painter. */
function contactsPage(S: Lcd, P: Phone, t: number, now: number): (Pt: Paint) => void {
  const A = T.apps;
  if (P.screen === 'contacts') {
    const view = 9, top = Math.max(0, Math.min(P.csel - view + 1, P.contacts.length - view));
    const rows = P.contacts.slice(top, top + view).map((c, n) => ({ name: c.name, number: c.number, sel: top + n === P.csel, pre: () => { P.csel = top + n; } }));
    softKeys(S, A.new, T.back);
    return (Pt) => paintContacts(Pt, { tabs: [A.tabCalls, A.tabContacts], toCalls: () => { P.dial = ''; P.open('calls', performance.now() / 1000); }, note: A.sim.replace('{n}', String(P.contacts.length)), empty: A.noContacts, rows, t });
  }
  const E = P.edit, title = `${(T.app as Record<string, string>).contacts} +`;
  softKeys(S, E.name && E.number ? A.save : '', (E.step === 0 ? E.name : E.number) ? A.clear : T.back);
  return (Pt) => paintContactEdit(Pt, { title, note: E.step === 0 ? P.nameEd.label() : '123', nameLabel: A.name, name: E.name, numLabel: A.numberF, number: E.number, step: E.step,
    blink: (Math.floor(now * 2) & 1) === 1, hint: E.step === 0 ? edHint(P.nameEd, now, A.modeHint) : 'v number', goName: () => { E.step = 0; }, goNum: () => { E.step = 1; } });
}

/**
 * The messages' screens, painted in pixels (pixpages.ts): the boxes, a box's list, a message open, writing one.
 * Sets the footer's actions as the cells' screens did; returns the page's painter.
 */
function msgPage(S: Lcd, P: Phone, t: number, now: number): (Pt: Paint) => void {
  const A = T.apps, nameOf = (n: string) => P.contacts.find((c) => c.number === n)?.name ?? n;
  const when = (at: number) => { const c = calendar(at); return `${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${hhmm(c.hour)}`; };
  if (P.screen === 'messages') {
    const unread = P.inbox.filter((m) => !m.read).length;
    const R: [string, string, string, boolean, C3][] = [['v', A.inbox, unread ? `${unread} new` : `${P.inbox.length}`, unread > 0, [63, 143, 224]], ['^', A.sent, `${P.sent.length}`, false, [110, 118, 132]], ['+', A.newMsg, '', false, [47, 174, 90]], ['x', A.clearAll, '', false, [210, 58, 46]]];
    const rows = R.map(([mark, label, count, hot, col], k) => ({ mark, label, count, hot, col, sel: k === P.box, pre: () => { P.box = k; } }));
    softKeys(S, T.open, T.back);
    return (Pt) => paintMsgHome(Pt, { title: (T.app as Record<string, string>).messages, rows, t });
  }
  if (P.screen === 'msglist') {
    const L = P.box === 0 ? P.inbox.map((m) => [m.from, m.text, m.read, m.at] as const) : P.sent.map((m) => [m.to, m.text, true, m.at] as const);
    const view = 7, top = Math.max(0, Math.min(P.msel - view + 1, L.length - view));
    const rows = L.slice(top, top + view).map(([who, text, read, at], n) => ({ who: nameOf(who), when: when(at), text, read, sel: top + n === P.msel, pre: () => { P.msel = top + n; } }));
    softKeys(S, A.new, T.back);
    return (Pt) => paintMsgList(Pt, { title: P.box === 0 ? A.inbox : A.sent, count: `${L.length}`, empty: A.noMsgs, rows, t });
  }
  if (P.screen === 'msg') {
    const m = P.box === 0 ? P.inbox[P.msel] : null, s2 = P.box === 1 ? P.sent[P.msel] : null;
    const who = m ? m.from : s2?.to ?? '', text = m ? m.text : s2?.text ?? '', at = m ? m.at : s2?.at ?? 0;
    softKeys(S, /^[0-9*#]+$/.test(who) ? A.replyK : '', T.back);
    return (Pt) => paintMsgRead(Pt, { head: `${P.box === 0 ? A.from : A.to}: ${nameOf(who)}`, when: when(at), text, mine: P.box === 1, t });
  }
  const D = P.draft, ed = P.smsEd, hint = D.step === 0 ? '* <-   v text' : edHint(ed, now, A.modeHint);
  softKeys(S, D.step === 0 ? T.ok : D.to && D.text ? A.send : '', D.step === 1 && D.text ? A.clear : T.back);
  return (Pt) => paintCompose(Pt, { title: A.newMsg, note: `${D.step === 1 ? ed.label() : '123'} ${D.text.length}/160`, toLabel: A.to, to: nameOf(D.to), text: D.text, textLabel: A.text,
    step: D.step, blink: (Math.floor(now * 2) & 1) === 1, hint, goTo: () => { D.step = 0; }, goText: () => { D.step = 1; } });
}

const ROAD: C3 = [255, 255, 255], LABEL: C3 = [70, 76, 92];
const F = T.find, A = T.apps;

/** The GPS over the map: where it puts the player, the accuracy's disc, and the box while it searches (or has lost the sky). */
function gpsParts(P: Phone, at: (x: number, y: number) => number[], mpp: number, now: number, indoor: boolean): Pick<MapPage, 'me' | 'halo' | 'gps' | 'acc' | 'accBad'> {
  const g = P.gps, G = T.gps, [x, y] = at(g.x, g.y);
  const me = g.known ? { x, y, fix: g.state === 'fix', heading: g.heading } : null;
  const halo = g.state === 'fix' && g.acc > 0 ? { x, y, r: g.acc / mpp } : null;
  let gps: MapPage['gps'] = null;
  if (g.state === 'search') gps = { lost: false, line: G.search, sub: `${G.inView} ${g.sats}/11${indoor ? '  ' + G.indoor : ''}`, bar: Math.max(0, 1 - g.wait / g.waitOf) };
  else if (g.state === 'lost') gps = { lost: true, line: G.lost, sub: g.known && Math.floor(now * 2) & 1 ? G.lastKnown : `${G.inView} ${g.sats}/11${indoor ? '  ' + G.indoor : ''}`, bar: null };
  return { me, halo, gps, acc: g.state === 'fix' ? G.acc.replace('{n}m', fmtDist(g.acc, P.prefs.dist)) : '', accBad: g.acc > 30 };
}

/**
 * The map app: north up, centered on the GPS position (or moved off it with the d-pad), drawing in
 * from the top, at one of four zooms. Up close it names the streets; farther out the districts,
 * tinted by type; landmarks are stars, named while there is room.
 */
function mapPage(S: Lcd, P: Phone, world: World, t: number, now: number): (Pt: Paint) => void {
  if (world.player.inside >= 0) return indoorPage(S, P, world, t, now);
  const { city } = world, zoom = P.zoom, mpp = mapMpp(ZOOM_ROW_M[zoom]);
  const [hx, hy] = P.here(), cx = hx + P.panX, cy = hy + P.panY;
  const X0 = cx - (MAP_W / 2) * mpp, Y0 = cy - (MAP_H / 2) * mpp, D = city.diagonal;
  const at = (x: number, y: number) => [(x - X0) / mpp, (y - Y0) / mpp];
  const inView = ([x, y]: number[]) => x >= 0 && x < MAP_W && y >= 0 && y < MAP_H;
  const labels: MapLabel[] = [], stars: MapPage['stars'] = [];
  city.landmarks.forEach((L, k) => {
    const p = at(L.x, L.y);
    if (!inView(p)) return;
    stars.push({ x: p[0], y: p[1] });
    // up close, their names beside them, before any street name
    if (zoom <= 1) labels.push({ x: p[0] + 8, y: p[1], text: landmarkName(city, k), ink: [160, 40, 30], back: [255, 244, 238] });
  });
  if (zoom <= 1) {
    // street names: the avenues across the top, the streets along their own rows (zoomed out, only the wide ones)
    for (const [k, x] of roadsIn(city.xb, X0, X0 + MAP_W * mpp)) if (zoom === 0 || isWideRoad(city.xb, k)) labels.push({ x: (x - X0) / mpp, y: 8, text: roadName(city, true, k), ink: LABEL, back: ROAD, center: true });
    for (const [k, y] of roadsIn(city.yb, Y0 + 20 * mpp, Y0 + MAP_H * mpp)) if (zoom === 0 || isWideRoad(city.yb, k)) labels.push({ x: 4, y: (y - Y0) / mpp, text: roadName(city, false, k), ink: LABEL, back: ROAD });
    // the diagonal, named at the point of it nearest the view's middle
    const s = diagS(D, cx, cy), [dx, dy] = at(cx - s * D.nx, cy - s * D.ny);
    if (dx >= 0 && dx < MAP_W) labels.push({ x: dx, y: dy, text: diagonalName(city), ink: LABEL, back: ROAD, center: true });
  } else {
    // district names at their middles, the ones nearest the view's middle first
    city.districts.map((Dd, k) => [k, Math.hypot(Dd.x - cx, Dd.y - cy)]).sort((a, b) => a[1] - b[1]).forEach(([k]) => {
      const [x, y] = at(city.districts[k].x, city.districts[k].y);
      labels.push({ x, y, text: districtName(city, k).toUpperCase(), ink: [40, 44, 56], back: [255, 255, 255], bold: true, center: true });
    });
  }
  // the route, the destination (or the place shown)
  const N = P.nav, dest = N ? N.to : P.pin, route: number[] = [];
  if (N?.R.length) for (let k = 0; k + 1 < N.R.length; k += 2) route.push(...at(N.R[k], N.R[k + 1]));
  let pin: MapPage['pin'] = null;
  if (dest !== null) { const [px, py] = placeAt(city, dest), p = at(px, py); if (inView(p)) pin = { x: p[0], y: p[1] }; }
  // the scale: a bar of 40 pixels
  const title = zoom === 3 ? cityName(city) : districtName(city, districtAt(city, cx, cy));
  const d: MapPage = { title, scale: `${T.zoom[zoom]}  ${fmtDist(40 * mpp, P.prefs.dist)}`, scalePx: 40, pic: streetMap(city, mapRaster(city), X0, Y0, mpp, zoom), t, now,
    route, stars, labels, pin, ...gpsParts(P, at, mpp, now, false), foot: { kind: 'street', text: '', back: '' }, zoomIn: zoom > 0, zoomOut: zoom < 3 };
  const panned = P.panX !== 0 || P.panY !== 0;
  if (P.pin !== null) { d.foot = placeCard(P, world, P.pin); softKeys(S, F.route, T.back); }
  else if (N) { d.foot = navFoot(P, world, N, now); softKeys(S, F.end, T.back); }
  else {
    // the street at the view's middle, and which way back when moved off the position
    const onDiag = Math.abs(diagS(D, cx, cy)) < D.w / 2 + SIDEWALK;
    const street = `${onDiag ? diagonalName(city) : roadName(city, true, nearestRoad(city.xb, city.xCell, cx))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, cy))}`;
    d.foot = { kind: 'street', text: typed(street, t - 0.3), back: panned ? `${fmtDist(Math.hypot(P.panX, P.panY), P.prefs.dist)} ${compass(-P.panX, -P.panY)}` : '' };
    softKeys(S, panned ? T.center : F.search, T.back);
  }
  return (Pt) => paintMap(Pt, d);
}

/** The card of a place shown on the map: name, kind, open or not, phone, address, how far; Route walks there, Call calls it. */
function placeCard(P: Phone, world: World, p: Place): MapFoot {
  const { city } = world, h = placeHours(city, p, calendar(world.time).hour);
  const [hx, hy] = [P.gps.x, P.gps.y], [px, py] = placeAt(city, p);
  return { kind: 'card', name: placeName(city, p), sub: `${placeKind(city, p)} - ${placeDistrict(city, p)}`, open: h ? h.open : null, openLabel: h?.open ? F.openNow : F.closed, hours: h?.text ?? '',
    number: p >= 0 ? formatNumber(world.telco, world.telco.bizNum[p]) : F.noPhone, hasNumber: p >= 0, far: P.gps.known ? `${fmtDist(Math.hypot(px - hx, py - hy), P.prefs.dist)} ${compass(px - hx, py - hy)}` : '--',
    address: placeAddress(city, p), route: F.route, call: F.call };
}

/** Under the map while a route is followed: the next turn (or how it stands) and the way left. */
function navFoot(P: Phone, world: World, N: NonNullable<Phone['nav']>, now: number): MapFoot {
  const { city } = world, g = P.gps, d = (m: number) => fmtDist(m, P.prefs.dist);
  let line = '', sub = placeName(city, N.to), turn: 'left' | 'right' | null = null;
  if (N.state === 'arrived') line = F.arrived;
  else if (N.state === 'none') line = F.noRoute;
  else if (N.state === 'routing') {
    const J = P.radio.job;
    line = N.R.length || N.off > 0 ? F.rerouting : F.routing;
    if (!g.known) sub = T.gps.search;
    else if (J?.what === 'route' && J.state === 'loading') sub = A.wx.kb.replace('{a}', J.done.toFixed(1)).replace('{b}', J.kb.toFixed(1));
    else if (!P.online()) sub = F.offline;
    line += '.'.repeat(Math.floor(now * 3) % 4);
  } else if (g.known) {
    const o = onRoute(N.R, g.x, g.y), next = nextTurn(city, N.R, o.leg, o.px, o.py);
    line = next ? F.turn.replace('{d}', d(next.dist)).replace('{side}', next.right ? F.right : F.left).replace('{road}', next.road) : F.straight.replace('{d}', d(o.left));
    sub = `${F.togo.replace('{d}', d(o.left))} - ${sub}`;
    if (next) turn = next.right ? 'right' : 'left';
  }
  return { kind: 'nav', line, sub, turn };
}

/**
 * The map inside a building: the plan of the floor the player is on, around them (rooms tinted by
 * what they are and named where they fit, walls, doorways, the stairs and the lift), and the street
 * past the outer walls. The same zoom keys pick the scale.
 */
function indoorPage(S: Lcd, P: Phone, world: World, t: number, now: number): (Pt: Paint) => void {
  const { city, player } = world, B = city.buildings[player.inside], plan = planOf(city, player.inside, player.floor);
  const mpp = mapMpp(INDOOR_ROW_M[P.zoom]), [hx, hy] = P.here(), cx = hx + P.panX, cy = hy + P.panY;
  const X0 = cx - (MAP_W / 2) * mpp, Y0 = cy - (MAP_H / 2) * mpp, at = (x: number, y: number) => [(x - X0) / mpp, (y - Y0) / mpp];
  const labels: MapLabel[] = [];
  // the rooms' names, at their middles, where they fit
  if (plan) plan.rooms.forEach((R, n) => {
    const mx = (R.x0 + R.x1) / 2, my = (R.y0 + R.y1) / 2, name = (T.room as Record<string, string>)[R.kind];
    if ((cellAt(plan, mx, my) & ROOM) !== n + 1 || ptextW(name) + 6 > (R.x1 - R.x0) / mpp) return;
    const [x, y] = at(mx, my);
    labels.push({ x, y, text: name, ink: [50, 54, 66], back: null, center: true });
  });
  const addr = `${roadName(city, true, nearestRoad(city.xb, city.xCell, (B.x0 + B.x1) / 2))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, (B.y0 + B.y1) / 2))}`;
  const d: MapPage = { title: `${T.floor} ${player.floor === 0 ? T.ground : player.floor}`, scale: fmtDist(40 * mpp, P.prefs.dist), scalePx: 40,
    pic: indoorMap(mapRaster(city), plan, `${player.inside}:${player.floor}`, X0, Y0, mpp), t, now, route: [], stars: [], labels, pin: null,
    ...gpsParts(P, at, mpp, now, true), foot: { kind: 'street', text: typed(addr, t - 0.3), back: '' }, zoomIn: P.zoom > 0, zoomOut: P.zoom < 3 };
  softKeys(S, P.panX || P.panY ? T.center : P.nav ? F.end : F.search, T.back);
  return (Pt) => paintMap(Pt, d);
}

/**
 * Maps' search: a field typed on the keypad (Abc, T9 or 123, as messages are), and under it the
 * places the server sent back, nearest first, each with its kind, whether it is open and how far.
 */
function placesPage(S: Lcd, P: Phone, world: World, t: number, now: number): (Pt: Paint) => void {
  const { city } = world, ed = P.findEd, q = ed.value(), on = P.psel < 0, J = P.radio.job;
  const d: PlacesPage = { title: F.title, mode: ed.label(), query: q, placeholder: F.hint, on, blink: (Math.floor(now * 2) & 1) === 1, hint: edHint(ed, now, T.apps.modeHint),
    goField: () => { P.psel = -1; }, status: '', statusBad: false, status2: '', count: '', rows: [], t };
  if (P.places === null) {
    if (P.findNote === 'offline') { d.status = F.offline; d.statusBad = true; }
    else if (J?.what === 'find') {
      const bad = J.state === 'nodata' || J.state === 'nosignal';
      d.status = J.state === 'nodata' ? T.apps.wx.noData : J.state === 'nosignal' ? T.apps.wx.lost : `${F.searching}${'.'.repeat(Math.floor(now * 3) % 4)}`; d.statusBad = bad;
      if (J.state === 'loading') d.status2 = T.apps.wx.kb.replace('{a}', J.done.toFixed(1)).replace('{b}', J.kb.toFixed(1));
    }
    softKeys(S, q ? F.search : '', q ? T.apps.clear : T.back);
    return (Pt) => paintPlaces(Pt, d);
  }
  if (!P.places.length) { d.status = F.none; softKeys(S, F.search, T.back); return (Pt) => paintPlaces(Pt, d); }
  d.count = F.results.replace('{n}', String(P.places.length));
  const [hx, hy] = P.here(), hour = calendar(world.time).hour;
  d.rows = P.places.map((p, n) => {
    const [px, py] = placeAt(city, p), h = placeHours(city, p, hour);
    return { name: placeName(city, p), far: P.gps.known ? `${fmtDist(Math.hypot(px - hx, py - hy), P.prefs.dist)} ${compass(px - hx, py - hy)}` : '--', kind: placeKind(city, p),
      open: h ? h.open : null, openLabel: h?.open ? F.openNow : F.closed, landmark: p < 0, sel: n === P.psel, pre: () => { P.psel = n; } };
  });
  softKeys(S, P.psel >= 0 ? T.show : F.search, T.back);
  return (Pt) => paintPlaces(Pt, d);
}
