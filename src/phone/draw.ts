import { compass, cityName, diagonalName, districtName, landmarkName, roadName } from '../locale/names';
import en from '../locale/en.json';
import { type CharGrid } from '../render/grid';
import { fontRows } from '../render/signs';
import { diagS, districtAt, nearestRoad, SIDEWALK } from '../sim/city';
import { calendar } from '../sim/clock';
import { type World } from '../sim/world';
import { Ground, MAP_RES, mapRaster, type MapRaster } from './mapdata';
import { APPS, type Key, type Phone } from './phone';

/**
 * The phone drawn in the player's hand, over the bottom right of the view: a 2008 handset with a
 * colour screen above a d-pad, soft keys, call and end keys and the number keys, whose bottom row
 * runs off the screen. Keys light while the phone is on and sink when pressed. The screen is a
 * small character display of its own; its text types in and the map draws in, as on a slow phone.
 */
export const PHONE_W = 50;
const PHONE_H = 52;
/** How much of it shows when held up (the rest is below the screen edge). */
const SHOWN = 46;
const SX = 4, SY = 4, SW = 42, SH = 26;
/** Map scale: metres per screen row (a column is the cell aspect of that, so nothing is stretched). */
export const MAP_ROW_M = 8;
const MAP_ROWS = SH - 4;
/** Metres the map shows across and down, for a cell aspect (width / height). */
export const mapView = (aspect: number): [number, number] => [SW * MAP_ROW_M * aspect, MAP_ROWS * MAP_ROW_M];

type C3 = readonly [number, number, number];
const T = en.phone;
const BODY: C3 = [30, 32, 37], EDGE: C3 = [58, 61, 68], BEZEL: C3 = [7, 7, 9], CAP: C3 = [48, 50, 57], CAP_DOWN: C3 = [22, 23, 26];
const LCD: C3 = [8, 15, 20], INK: C3 = [170, 225, 245], DIM: C3 = [80, 120, 140], BAR: C3 = [28, 62, 82], HI: C3 = [255, 196, 90];
const ch = (s: string) => s.charCodeAt(0);

/** The screen's cells, clipped to the grid: (x, y) are screen columns and rows. */
class Lcd {
  constructor(private g: CharGrid, private x0: number, private y0: number) {}
  put(x: number, y: number, c: number, fg: C3, bg: C3) {
    const gx = this.x0 + x, gy = this.y0 + y, g = this.g;
    if (x < 0 || y < 0 || x >= SW || y >= SH || gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return;
    const i = gy * g.cols + gx;
    g.put(i, c, fg[0], fg[1], fg[2]); g.setBg(i, bg[0], bg[1], bg[2]);
  }
  text(x: number, y: number, s: string, fg: C3, bg: C3) { for (let k = 0; k < s.length; k++) this.put(x + k, y, s.charCodeAt(k), fg, bg); }
  fill(y: number, bg: C3) { for (let x = 0; x < SW; x++) this.put(x, y, 32, bg, bg); }
}

/** Text that types in: as much of s as `cps` characters a second have written since t = 0. */
const typed = (s: string, t: number, cps = 60) => s.slice(0, Math.max(0, Math.floor(t * cps)));

export function drawPhone(g: CharGrid, P: Phone, world: World, yaw: number, aspect: number, now: number) {
  if (P.raise < 0.01) return;
  const e = 1 - (1 - P.raise) ** 3;
  const ox = g.cols - PHONE_W - 6, oy = g.rows - Math.round(SHOWN * e);
  const cell = (x: number, y: number, c: number, fg: C3, bg: C3) => {
    const gx = ox + x, gy = oy + y;
    if (gx < 0 || gy < 0 || gx >= g.cols || gy >= g.rows) return;
    const i = gy * g.cols + gx;
    g.put(i, c, fg[0], fg[1], fg[2]); g.setBg(i, bg[0], bg[1], bg[2]);
  };
  // the body, rounded at the corners, a lighter rim along its sides
  for (let y = 0; y < PHONE_H; y++) {
    const inset = y === 0 || y === PHONE_H - 1 ? 3 : y === 1 || y === PHONE_H - 2 ? 1 : 0;
    for (let x = inset; x < PHONE_W - inset; x++) {
      const rim = x === inset || x === PHONE_W - 1 - inset || y === 0;
      cell(x, y, 32, BODY, rim ? EDGE : BODY);
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
  const key = (k: Key, x0: number, y0: number, w: number, h: number, label: string, col?: C3) => {
    const t = P.pressed.get(k), down = t !== undefined && now - t < 0.14;
    const fg: C3 = col ?? (on ? [150, 205, 255] : [125, 128, 138]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cell(x0 + x, y0 + y, 32, fg, down ? CAP_DOWN : CAP);
    const lx = x0 + ((w - label.length) >> 1), ly = y0 + ((h - 1) >> 1);
    for (let n = 0; n < label.length; n++) if (label[n] !== ' ') cell(lx + n, ly, label.charCodeAt(n), down ? [fg[0] * 0.7, fg[1] * 0.7, fg[2] * 0.7] : fg, down ? CAP_DOWN : CAP);
  };
  const CY = SY + SH + 2;
  key('lsoft', 3, CY, 10, 2, '--');
  key('rsoft', 37, CY, 10, 2, '--');
  key('send', 3, CY + 3, 10, 2, 'SEND', [80, 230, 120]);
  key('end', 37, CY + 3, 10, 2, 'END', [255, 80, 70]);
  key('up', 21, CY, 8, 1, '^');
  key('down', 21, CY + 4, 8, 1, 'v');
  key('left', 16, CY + 1, 4, 3, '<');
  key('right', 30, CY + 1, 4, 3, '>');
  key('ok', 21, CY + 1, 8, 3, 'OK');
  const KEYS: [Key, string][] = [['1', '1 .,'], ['2', '2 abc'], ['3', '3 def'], ['4', '4 ghi'], ['5', '5 jkl'], ['6', '6 mno'], ['7', '7 pqrs'], ['8', '8 tuv'], ['9', '9 wxyz'], ['*', '* +'], ['0', '0 _'], ['#', '# ^']];
  KEYS.forEach(([k, label], n) => key(k, 3 + (n % 3) * 16, CY + 6 + Math.floor(n / 3) * 3, 12, 2, label));

  // the screen
  const S = new Lcd(g, ox + SX, oy + SY);
  if (!on) { for (let y = 0; y < SH; y++) S.fill(y, [5, 6, 8]); return; }
  for (let y = 0; y < SH; y++) S.fill(y, LCD);
  const t = now - P.since;
  if (P.screen === 'boot') return boot(S, P, world, t);
  statusBar(S, world, P.screen === 'map');
  if (P.screen === 'standby') standby(S, world, t);
  else if (P.screen === 'menu') menu(S, P, t);
  else if (P.screen === 'map') map(S, P, world, yaw, aspect, t, now);
}

function statusBar(S: Lcd, world: World, gps: boolean) {
  S.fill(0, BAR);
  // no cellular network yet (the city's antennas come with stage 9)
  S.text(1, 0, 'Y', INK, BAR); S.text(2, 0, 'x', [255, 110, 90], BAR);
  if (gps) S.text(5, 0, 'GPS', [120, 255, 150], BAR);
  const c = calendar(world.time), hm = `${String(Math.floor(c.hour)).padStart(2, '0')}:${String(Math.floor((c.hour % 1) * 60)).padStart(2, '0')}`;
  S.text(SW - 13, 0, hm, INK, BAR);
  S.text(SW - 6, 0, '[###]', [150, 230, 150], BAR);
}

function softKeys(S: Lcd, left: string, right: string) {
  S.fill(SH - 1, BAR);
  S.text(1, SH - 1, left, INK, BAR);
  S.text(SW - 1 - right.length, SH - 1, right, INK, BAR);
}

/** Big 5x7 characters made of lit cells, centered on row y. */
function bigText(S: Lcd, y: number, s: string, col: C3, t = 1e9) {
  const x0 = (SW - (s.length * 6 - 1)) >> 1;
  for (let n = 0; n < s.length; n++) {
    const rows = fontRows(s.charCodeAt(n));
    if (!rows) continue;
    for (let r = 0; r < 7; r++) {
      if (r > t * 30) break; // draws in from the top
      for (let b = 0; b < 5; b++) if ((rows[r] >> (4 - b)) & 1) S.put(x0 + n * 6 + b, y + r, 32, col, col);
    }
  }
}

/** Power on: the maker's logo, then the boot log listing the hardware as it is found. */
function boot(S: Lcd, P: Phone, world: World, t: number) {
  if (t < 0) { for (let y = 0; y < SH; y++) S.fill(y, [5, 6, 8]); return; }
  const D = P.device;
  if (t < 1.3) { bigText(S, 9, D.maker.toUpperCase(), [Math.min(255, t * 400), Math.min(196, t * 300), Math.min(90, t * 140)], t); return; }
  mapRaster(world.city); // the map database loads during the boot (built once per city)
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
    line(`RADIO ${D.radio}`, T.noService),
    line(`${T.mapsDb} ${cityName(world.city).toUpperCase()}`, T.ok),
    '',
    T.ready,
  ];
  let left = Math.floor((t - 1.3) * 90);
  for (let k = 0; k < L.length && left >= 0; k++) {
    const s = L[k].slice(0, left), bad = L[k].endsWith(T.noService) || L[k].endsWith(T.off);
    S.text(1, 1 + k, s, k === 0 ? HI : bad && s.length === L[k].length ? [255, 120, 90] : INK, LCD);
    left -= L[k].length + 3;
    if (left < 0 && Math.floor(t * 3) & 1) S.put(1 + s.length, 1 + k, ch('_'), INK, LCD);
  }
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function standby(S: Lcd, world: World, t: number) {
  const c = calendar(world.time);
  bigText(S, 4, `${String(Math.floor(c.hour)).padStart(2, '0')}:${String(Math.floor((c.hour % 1) * 60)).padStart(2, '0')}`, INK, t);
  const date = `${DAYS[c.weekday]} ${String(c.day).padStart(2, '0')} ${MONTHS[c.month - 1]} ${c.year}`;
  S.text((SW - date.length) >> 1, 13, typed(date, t - 0.2), DIM, LCD);
  S.text((SW - T.noService.length) >> 1, 16, typed(T.noService, t - 0.5), [255, 120, 90], LCD);
  softKeys(S, T.menu, '');
}

function menu(S: Lcd, P: Phone, t: number) {
  S.text(1, 1, typed(T.menuTitle, t), HI, LCD);
  APPS.forEach((a, n) => {
    const sel = n === P.sel, bg = sel ? [40, 90, 120] as C3 : LCD, s = ` ${n + 1}  ${(T.app as Record<string, string>)[a]}`;
    if (sel) S.fill(3 + n, bg);
    S.text(1, 3 + n, typed(s, t - 0.1 - n * 0.05), sel ? [255, 255, 255] : INK, bg);
  });
  softKeys(S, T.open, T.back);
}

// map colours: what lies on the ground, and buildings brighter the taller they are
const G_BG: C3[] = [[18, 8, 6], [24, 28, 36], [44, 48, 56], [30, 30, 30], [0, 0, 0], [24, 58, 34], [56, 56, 60], [42, 36, 32]];
const G_CH = [ch('.'), 32, 32, ch('.'), 32, ch('"'), ch('+'), ch('=')];
const G_FG: C3[] = [[110, 46, 22], [0, 0, 0], [0, 0, 0], [58, 58, 56], [0, 0, 0], [60, 130, 72], [84, 84, 90], [96, 84, 72]];
const ARROWS = ['>', '\\', 'v', '/', '<', '\\', '^', '/'];

/** What a map cell shows: the most common ground over its 2 m squares (buildings win ties), and the tallest building in it. */
function sample(m: MapRaster, x0: number, y0: number, w: number, h: number, out: Int32Array) {
  const counts = [0, 0, 0, 0, 0, 0, 0, 0];
  let hmax = 0;
  for (let y = y0 + MAP_RES / 2; y < y0 + h; y += MAP_RES) for (let x = x0 + MAP_RES / 2; x < x0 + w; x += MAP_RES) {
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

/** The map app: north up, centered on the GPS position (or moved off it with the d-pad), drawing in row by row. */
function map(S: Lcd, P: Phone, world: World, yaw: number, aspect: number, t: number, now: number) {
  const { city, player } = world, m = mapRaster(city), rowM = MAP_ROW_M, colM = MAP_ROW_M * aspect;
  const cx = player.x + P.panX, cy = player.y + P.panY;
  const X0 = cx - (SW / 2) * colM, Y0 = cy - (MAP_ROWS / 2) * rowM;
  // title: the district at the view's middle, the scale and north
  const d = districtAt(city, cx, cy), bar = 6, scale = `|${'-'.repeat(bar - 2)}| ${Math.round(bar * colM)}m  N^`;
  S.fill(1, [16, 30, 40]);
  S.text(1, 1, typed(districtName(city, d).toUpperCase().slice(0, SW - scale.length - 3), t), HI, [16, 30, 40]);
  S.text(SW - scale.length - 1, 1, scale, DIM, [16, 30, 40]);
  const out = new Int32Array(2);
  for (let r = 0; r < MAP_ROWS; r++) {
    if (t < 0.15 + r * 0.03) break; // the slow phone draws the map in from the top
    for (let c = 0; c < SW; c++) {
      sample(m, X0 + c * colM, Y0 + r * rowM, colM, rowM, out);
      const k = out[0];
      if (k === Ground.Building) {
        const f = Math.min(1, out[1] / 120);
        const bg: C3 = [70 + 150 * f, 58 + 110 * f, 44 + 50 * f];
        // the skyline's few giants get a mark, to steer by
        S.put(c, 2 + r, out[1] > 200 ? ch('^') : 32, [255, 240, 200], bg);
      } else S.put(c, 2 + r, G_CH[k], G_FG[k], G_BG[k]);
    }
  }
  const drawn = Math.max(0, Math.floor((t - 0.15) / 0.03));
  const at = (x: number, y: number) => [Math.floor((x - X0) / colM), Math.floor((y - Y0) / rowM)];
  // landmarks: a star, and the name where it fits
  city.landmarks.forEach((L, k) => {
    const [c, r] = at(L.x, L.y);
    if (c < 0 || c >= SW || r < 0 || r >= MAP_ROWS || r >= drawn) return;
    S.put(c, 2 + r, ch('*'), [255, 230, 90], [60, 40, 10]);
    const name = landmarkName(city, k).toUpperCase(), room = SW - c - 2;
    if (room >= 5) S.text(c + 2, 2 + r, name.slice(0, room), [255, 220, 120], [30, 22, 8]);
  });
  // where the player is, pointing the way they face; blinking
  const [pc, pr] = at(player.x, player.y);
  if (pc >= 0 && pc < SW && pr >= 0 && pr < MAP_ROWS && pr < drawn) {
    const blink = Math.floor(now * 3) & 1, o = Math.round((yaw / (Math.PI / 4))) & 7;
    S.put(pc, 2 + pr, ch(ARROWS[o]), blink ? [255, 255, 255] : [90, 255, 255], blink ? [0, 120, 150] : [0, 60, 80]);
  }
  // the street at the view's middle
  const onDiag = Math.abs(diagS(city.diagonal, cx, cy)) < city.diagonal.w / 2 + SIDEWALK;
  const street = `${onDiag ? diagonalName(city) : roadName(city, true, nearestRoad(city.xb, city.xCell, cx))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, cy))}`;
  S.fill(SH - 2, [16, 30, 40]);
  S.text(1, SH - 2, typed(street.slice(0, SW - 2), t - 0.3), INK, [16, 30, 40]);
  const panned = P.panX !== 0 || P.panY !== 0;
  if (panned) {
    // moved off the position: which way back to it
    const back = `${Math.round(Math.hypot(P.panX, P.panY))}m ${compass(-P.panX, -P.panY)}`;
    S.text(SW - back.length - 1, SH - 2, back, DIM, [16, 30, 40]);
  }
  softKeys(S, panned ? T.center : '', T.back);
}
