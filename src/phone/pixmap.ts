import { hash3 } from '../core/rng';
import { diagS, districtAt, type City } from '../sim/city';
import { cellAt, DOOR, ROOM, type Plan, type RoomKind } from '../sim/interior';
import { type C3, type Paint } from '../render/paint2d';
import { Ground, groundAt, MAP_RES, type MapRaster } from './mapdata';
import { ICE, ptext, ptextW, SCR_H, SCR_W } from './pixui';
import { PICK, PICK_DIM, PICK_INK } from './ui';
import { appHeader, APP_COL, BG, ctext, DIM, HITS, INK, M, paintHint, Y0, Y1, type Rgb, type TypeHint } from './pixpages';

/**
 * Maps in pixels (the manual v2): the map itself is an image made once for each view (the streets
 * exact from the city's boundaries, the rest from the 2 m raster; the plan of the floor inside a
 * building), and over it, every frame, the route, the landmarks, the names, the GPS and the bars.
 */

/** The map's band of the screen: under the header, over the foot. */
export const MAP_T = Y0 + 28, MAP_B = Y1 - 24, MAP_W = SCR_W, MAP_H = MAP_B - MAP_T;
/** Metres a pixel of the map spans at a zoom: a row of the old map (its metres) was about 13 pixels. */
export const mapMpp = (rowM: number) => rowM / 13;

const MAPS = APP_COL[3];
// the ground as the phone maps of the time drew it: pale ground, white streets, yellow avenues,
// green parks, buildings grey turning blue-grey the taller they are; the burnt ground brown
const G_BG: C3[] = [[112, 84, 72], [255, 255, 255], [228, 224, 216], [238, 234, 224], [0, 0, 0], [186, 222, 164], [234, 228, 212], [208, 204, 198]];
const WIDE: C3 = [252, 226, 128], OUT: C3 = [238, 234, 224];
/** District tints for the far zooms, by type. */
const D_TINT: Record<string, C3> = { financial: [70, 110, 190], commercial: [200, 140, 60], residential: [90, 150, 90], historic: [170, 110, 80], industrial: [120, 120, 120], theater: [210, 80, 200] };

/** The most common ground over a w x h patch (buildings win ties; at most 4x4 samples), and the tallest building in it (m). */
function sample(m: MapRaster, x0: number, y0: number, w: number, h: number, out: Int32Array) {
  const counts = [0, 0, 0, 0, 0, 0, 0, 0], sx = Math.max(MAP_RES, w / 4), sy = Math.max(MAP_RES, h / 4);
  let hmax = 0;
  for (let y = y0 + Math.min(sy, h) / 2; y < y0 + h; y += sy) for (let x = x0 + Math.min(sx, w) / 2; x < x0 + w; x += sx) {
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

export const isWideRoad = (b: number[], k: number) => b[2 * k + 1] - b[2 * k] >= b[1] - b[0];
/** Whether a road runs inside [a0, a1) along one axis (b: its boundaries, cells: the cell of every metre); wide: only the wide ones. */
function roadIn(b: number[], cells: Uint16Array, a0: number, a1: number, wide: boolean): boolean {
  const n = cells.length - 1;
  if (a1 < 0 || a0 > n) return false;
  const c0 = cells[Math.max(0, Math.min(n, Math.floor(a0)))], c1 = cells[Math.max(0, Math.min(n, Math.floor(a1)))];
  for (let c = c0; c <= c1; c++) if (!(c & 1) && (!wide || isWideRoad(b, c >> 1))) return true;
  return false;
}
/** The roads crossing [a0, a1): [index, middle] of the avenues (x) or streets (y). */
export function roadsIn(b: number[], a0: number, a1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let c = 0; c + 1 < b.length; c += 2) { const mid = (b[c] + b[c + 1]) / 2; if (mid >= a0 && mid < a1) out.push([c >> 1, mid]); }
  return out;
}

const img = (w: number, h: number): Rgb => ({ hd: new Uint8ClampedArray(w * h * 3), w, h });
/**
 * A map's picture and where the view starts in it. The picture reaches PAD pixels past the view on
 * every side, from an origin on a grid of PAD pixels, so walking (the view follows the GPS) only
 * makes it again every PAD pixels instead of every frame.
 */
export interface MapPic { pic: Rgb; ox: number; oy: number }
const PAD = 64, IW = MAP_W + 2 * PAD, IH = MAP_H + 2 * PAD;
/** The picture's origin for a view at (X0, Y0): one PAD step before the grid line under it. */
const padOrigin = (v: number, mpp: number) => (Math.floor(v / (PAD * mpp)) - 1) * PAD * mpp;
const placed = (pic: Rgb, sx: number, sy: number, X0: number, Y0: number, mpp: number): MapPic => ({ pic, ox: Math.round((X0 - sx) / mpp), oy: Math.round((Y0 - sy) / mpp) });
const set = (R: Rgb, i: number, c: C3) => { R.hd[i * 3] = c[0]; R.hd[i * 3 + 1] = c[1]; R.hd[i * 3 + 2] = c[2]; };
const shade = (c: C3, k: number): C3 => [c[0] * k, c[1] * k, c[2] * k];

let streetCache: { key: string; pic: Rgb } | null = null;
/**
 * The street map from (X0, Y0), mpp metres a pixel: the roads exact (a line where they are thinner
 * than a pixel), the ground by its most common kind, the buildings outlined and darker the taller,
 * parks and plazas with a fine pattern, the districts tinted on the far zooms. Kept until the view moves.
 */
export function streetMap(city: City, m: MapRaster, VX: number, VY: number, mpp: number, zoom: number): MapPic {
  const X0 = padOrigin(VX, mpp), Y0 = padOrigin(VY, mpp), key = `${X0.toFixed(2)},${Y0.toFixed(2)},${mpp},${zoom}`;
  if (streetCache?.key === key) return placed(streetCache.pic, X0, Y0, VX, VY, mpp);
  const W = IW, H = IH, R = img(W, H), kinds = new Uint8Array(W * H), out = new Int32Array(2), D = city.diagonal;
  const colRoad: boolean[] = [], rowRoad: boolean[] = [], colWide: boolean[] = [], rowWide: boolean[] = [];
  for (let c = 0; c < W; c++) { colWide[c] = roadIn(city.xb, city.xCell, X0 + c * mpp, X0 + (c + 1) * mpp, true); colRoad[c] = roadIn(city.xb, city.xCell, X0 + c * mpp, X0 + (c + 1) * mpp, false); }
  for (let r = 0; r < H; r++) { rowWide[r] = roadIn(city.yb, city.yCell, Y0 + r * mpp, Y0 + (r + 1) * mpp, true); rowRoad[r] = roadIn(city.yb, city.yCell, Y0 + r * mpp, Y0 + (r + 1) * mpp, zoom === 3); }
  const diagHalf = Math.max(D.w / 2, 0.6 * mpp);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = r * W + c, x0 = X0 + c * mpp, y0 = Y0 + r * mpp, mx = x0 + mpp / 2, my = y0 + mpp / 2;
    const inCity = mx >= 0 && my >= 0 && mx < city.w && my < city.h, diag = inCity && Math.abs(diagS(D, mx, my)) < diagHalf;
    let col: C3, k: number;
    if (inCity && (colRoad[c] || rowRoad[r] || diag) && (zoom > 0 || groundAt(m, mx, my) === Ground.Road)) { k = Ground.Road; col = colWide[c] || rowWide[r] || diag ? WIDE : G_BG[Ground.Road]; }
    else {
      sample(m, x0, y0, mpp, mpp, out);
      k = out[0] === Ground.Road && zoom > 0 ? Ground.Walk : out[0];
      if (k === Ground.Building) { const f = Math.min(1, out[1] / 120); col = [214 - 64 * f, 210 - 56 * f, 202 - 28 * f]; }
      else if (k === Ground.Road) col = colWide[c] || rowWide[r] || diag ? WIDE : G_BG[k];
      else col = G_BG[k];
      // a fine pattern on parks (leaves), plazas (paving) and the burnt ground, fixed to the ground
      const gx = Math.floor(mx / Math.max(1.5, mpp * 2)), gy = Math.floor(my / Math.max(1.5, mpp * 2));
      if (k === Ground.Park && hash3(gx, gy, 41) < 0.3) col = shade(col, 0.9);
      else if (k === Ground.Plaza && (gx + gy) % 2 === 0) col = shade(col, 0.97);
      else if (k === Ground.Out && hash3(gx, gy, 42) < 0.25) col = shade(col, 1.15);
    }
    if (zoom >= 2 && inCity && k !== Ground.Out && k !== Ground.Road) {
      const t = D_TINT[city.districts[districtAt(city, mx, my)].type];
      col = [col[0] * 0.8 + t[0] * 0.2, col[1] * 0.8 + t[1] * 0.2, col[2] * 0.8 + t[2] * 0.2];
    }
    kinds[i] = k; set(R, i, col);
  }
  // the buildings' outlines up close (a building pixel next to anything else darkens); farther out they would only be noise
  if (mpp < 2) for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = r * W + c;
    if (kinds[i] !== Ground.Building) continue;
    const edge = (c > 0 && kinds[i - 1] !== Ground.Building) || (c < W - 1 && kinds[i + 1] !== Ground.Building) || (r > 0 && kinds[i - W] !== Ground.Building) || (r < H - 1 && kinds[i + W] !== Ground.Building);
    if (edge) for (let q = 0; q < 3; q++) R.hd[i * 3 + q] *= 0.72;
  }
  streetCache = { key, pic: R };
  return placed(R, X0, Y0, VX, VY, mpp);
}

/** Floor colours of the rooms on the indoor map, by kind. */
export const ROOM_BG: Record<RoomKind, C3> = {
  lobby: [222, 214, 196], hall: [210, 204, 194], stair: [190, 196, 206], lift: [184, 196, 220], foyer: [230, 214, 190], living: [240, 216, 180],
  bedroom: [214, 204, 236], kitchen: [214, 230, 196], bath: [190, 226, 234], office: [204, 214, 230], open: [212, 222, 236], shop: [248, 226, 170], store: [222, 208, 180],
};
let indoorCache: { key: string; pic: Rgb } | null = null;
/**
 * The plan of a floor from (X0, Y0), mpp metres a pixel: each room in its kind's colour (the stairs
 * striped, the lift crossed), a wall where two rooms meet (open where both sides are a doorway), and
 * past the outer walls the street or the neighbours' walls.
 */
export function indoorMap(m: MapRaster, plan: Plan | null, id: string, VX: number, VY: number, mpp: number): MapPic {
  const X0 = padOrigin(VX, mpp), Y0 = padOrigin(VY, mpp), key = `${id},${X0.toFixed(2)},${Y0.toFixed(2)},${mpp}`;
  if (indoorCache?.key === key) return placed(indoorCache.pic, X0, Y0, VX, VY, mpp);
  const W = IW, H = IH, R = img(W, H), room = new Int16Array(W * H), door = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const v = plan ? cellAt(plan, X0 + (c + 0.5) * mpp, Y0 + (r + 0.5) * mpp) : 0;
    room[r * W + c] = v & ROOM; door[r * W + c] = v & DOOR ? 1 : 0;
  }
  const WALL: C3 = [86, 90, 102], wallPx = Math.max(1, Math.round(0.25 / mpp));
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = r * W + c, n = room[i], mx = X0 + (c + 0.5) * mpp, my = Y0 + (r + 0.5) * mpp;
    if (!n) {
      set(R, i, groundAt(m, mx, my) === Ground.Building ? [214, 210, 202] : OUT);
      continue;
    }
    // a wall: another room (or the outside) within the wall's thickness, unless both are a doorway
    let wall = false;
    for (let d = 1; d <= wallPx && !wall; d++) for (const j of [c + d < W ? i + d : -1, c - d >= 0 ? i - d : -1, r + d < H ? i + d * W : -1, r - d >= 0 ? i - d * W : -1]) if (j >= 0 && room[j] !== n && !(door[i] && door[j])) wall = true;
    const K = plan!.rooms[n - 1]?.kind;
    let col: C3 = K ? ROOM_BG[K] : WALL;
    if (K === 'stair' && Math.floor(my / 0.5) % 2) col = shade(col, 0.88);
    if (K === 'lift' && Math.abs((mx % 2) - (my % 2)) < 0.15) col = shade(col, 0.75);
    set(R, i, wall ? WALL : col);
  }
  indoorCache = { key, pic: R };
  return placed(R, X0, Y0, VX, VY, mpp);
}

/** A label on the map: its text, where (the middle of its left edge), its colours; placed in order, skipped where it would overlap one before it. */
export interface MapLabel { x: number; y: number; text: string; ink: C3; back: C3 | null; bold?: boolean; center?: boolean }
/** Under the map: the street at its middle (and the way back when moved off), a place's card, the route's next turn, or nothing. */
export type MapFoot = { kind: 'street'; text: string; back: string }
  | { kind: 'card'; name: string; sub: string; open: boolean | null; openLabel: string; hours: string; number: string; hasNumber: boolean; far: string; address: string; route: string; call: string }
  | { kind: 'nav'; line: string; sub: string; turn: 'left' | 'right' | null };
export interface MapPage {
  title: string; scale: string; scalePx: number; acc: string; accBad: boolean; pic: MapPic; t: number; now: number;
  route: number[]; stars: { x: number; y: number }[]; labels: MapLabel[]; pin: { x: number; y: number } | null; halo: { x: number; y: number; r: number } | null;
  me: { x: number; y: number; fix: boolean; heading: number } | null;
  gps: { lost: boolean; line: string; sub: string; bar: number | null } | null; foot: MapFoot; zoomIn: boolean; zoomOut: boolean;
}

/** The map: the header (where, the scale), the picture drawing in from the top, what goes over it, the foot. */
export function paintMap(P: Paint, d: MapPage) {
  P.rect(0, 0, SCR_W, Y1, OUT);
  appHeader(P, d.title.slice(0, 22), '', MAPS);
  // the scale: a bar of so many metres and north, on the header's right
  const sx = SCR_W - M - d.scalePx, sw = ptextW(d.scale);
  P.rect(sx, Y0 + 16, d.scalePx, 2, [255, 255, 255]); P.rect(sx, Y0 + 12, 1, 6, [255, 255, 255]); P.rect(sx + d.scalePx - 1, Y0 + 12, 1, 6, [255, 255, 255]);
  ptext(P, sx - sw - 6, Y0 + 10, d.scale, [235, 242, 250]);
  // the picture, row by row as the slow phone draws it in
  const shown = Math.max(0, Math.min(MAP_H, Math.floor(((d.t - 0.15) / 0.03) * 13)));
  P.clip(0, MAP_T, SCR_W, MAP_T + shown);
  const px = d.pic.pic.hd, { ox, oy } = d.pic;
  for (let r = 0; r < shown; r++) for (let c = 0; c < MAP_W; c++) { const q = ((r + oy) * IW + c + ox) * 3; P.s.set(c, MAP_T + r, px[q], px[q + 1], px[q + 2]); }
  // the GPS's accuracy: a pale blue disc around the position
  if (d.halo) P.disc(d.halo.x, MAP_T + d.halo.y, d.halo.r, [60, 140, 255], 0.16);
  // the route: a blue line along its legs
  for (let k = 0; k + 3 < d.route.length; k += 2) P.line(d.route[k], MAP_T + d.route[k + 1], d.route[k + 2], MAP_T + d.route[k + 3], 4, [70, 140, 250]);
  // landmarks: a white star on a red disc
  const used: number[][] = [];
  for (const s of d.stars) { P.disc(s.x, MAP_T + s.y, 5, [210, 60, 50]); ptext(P, s.x - 2, MAP_T + s.y - 4, '*', [255, 255, 255]); used.push([s.x - 6, s.y - 6, 12, 12]); }
  // the names, never over each other or a star
  for (const L of d.labels) {
    const w = ptextW(L.text, 1, !!L.bold) + 4, x = Math.max(1, Math.min(SCR_W - w - 1, Math.round(L.center ? L.x - w / 2 : L.x))), y = Math.round(L.y - 6);
    if (y < 0 || y + 12 > MAP_H || used.some(([a, b, cw, ch]) => x < a + cw + 2 && a < x + w + 2 && y < b + ch && b < y + 12)) continue;
    used.push([x, y, w, 12]);
    if (L.back) P.rect(x, MAP_T + y, w, 12, L.back);
    ptext(P, x + 2, MAP_T + y + 2, L.text, L.ink, 1, !!L.bold);
  }
  // the place shown: a red pin, blinking
  if (d.pin) {
    const red: C3 = Math.floor(d.now * 2) & 1 ? [230, 50, 40] : [180, 30, 24], x = d.pin.x, y = MAP_T + d.pin.y;
    P.disc(x, y - 10, 6, red); P.poly([x - 5, y - 7, x + 5, y - 7, x, y], red); P.disc(x, y - 10, 2.2, [255, 255, 255]);
  }
  // where the GPS puts the player: an arrow the way they move, a dot standing still; a dim '?' with no fix
  if (d.me) {
    const x = d.me.x, y = MAP_T + d.me.y, blink = Math.floor(d.now * 3) & 1;
    if (!d.me.fix) { if (blink) { P.disc(x, y, 6, [140, 146, 160]); ptext(P, x - 2, y - 4, '?', [255, 255, 255], 1, true); } }
    else if (Number.isNaN(d.me.heading)) { P.disc(x, y, 6, [255, 255, 255]); P.disc(x, y, 4.5, blink ? [60, 140, 255] : [30, 100, 220]); }
    else {
      const a = d.me.heading, c = Math.cos(a), s = Math.sin(a), pt = (f: number, l: number) => [x + c * f - s * l, y + s * f + c * l];
      P.poly([...pt(9, 0), ...pt(-6, 6), ...pt(-3, 0), ...pt(-6, -6)], [255, 255, 255]);
      P.poly([...pt(7, 0), ...pt(-4, 4), ...pt(-2, 0), ...pt(-4, -4)], blink ? [60, 140, 255] : [30, 100, 220]);
    }
  }
  P.clip(0, 0, SCR_W, SCR_H);
  // zoom, as buttons on the map's right
  for (const [sym, key, on, y] of [['+', '*', d.zoomIn, MAP_T + 8], ['-', '#', d.zoomOut, MAP_T + 40]] as const) {
    HITS.push({ x: SCR_W - 40, y: y - 2, w: 38, h: 30, key });
    P.rrect(SCR_W - 34, y, 26, 26, 4, [255, 255, 255], 0.92); P.rrect(SCR_W - 34, y + 25, 26, 1, 0, [0, 0, 0], 0.15);
    ptext(P, SCR_W - 21 - ptextW(sym, 2, true) / 2, y + 5, sym, on ? [40, 44, 56] : [190, 194, 204], 2, true);
  }
  // the GPS searching, or lost
  if (d.gps) {
    const w = 190, h = d.gps.bar === null ? 46 : 56, x = (SCR_W - w) >> 1, y = MAP_T + 110;
    P.rrect(x, y, w, h, 6, [252, 252, 254]); P.rrect(x, y + h, w, 2, 0, [0, 0, 0], 0.15);
    ctext(P, y + 9, d.gps.line, d.gps.lost ? [200, 60, 50] : [40, 90, 170], 1, true);
    ctext(P, y + 24, d.gps.sub, [110, 118, 132]);
    if (d.gps.bar !== null) { P.rrect(x + 20, y + 40, w - 40, 6, 3, [220, 224, 232]); P.rrect(x + 20, y + 40, Math.max(6, Math.round((w - 40) * d.gps.bar)), 6, 3, [60, 140, 255]); }
  }
  if (d.acc) ptext(P, M, MAP_B - 12, d.acc, d.accBad ? [200, 60, 50] : [90, 96, 110]);
  paintFoot(P, d.foot);
}

function paintFoot(P: Paint, F: MapFoot) {
  if (F.kind === 'street') {
    P.rect(0, MAP_B, SCR_W, Y1 - MAP_B, [248, 249, 252]); P.rect(0, MAP_B, SCR_W, 1, [210, 214, 222]);
    const bw = ptextW(F.back);
    ptext(P, M, MAP_B + 8, F.text.slice(0, Math.floor((SCR_W - 2 * M - bw - 8) / 6)), [30, 34, 44]);
    if (F.back) ptext(P, SCR_W - M - bw, MAP_B + 8, F.back, [40, 90, 170]);
    return;
  }
  if (F.kind === 'nav') {
    const y = MAP_B - 22;
    P.rect(0, y, SCR_W, Y1 - y, PICK);
    ptext(P, M, y + 7, F.line.slice(0, 30), PICK_INK, 1, true);
    ptext(P, M, y + 24, F.sub.slice(0, 36), PICK_DIM);
    if (F.turn) {
      // the next turn's way: a bent arrow
      const x = SCR_W - M - 16, ay = y + 4, dir = F.turn === 'right' ? 1 : -1, c: C3 = [255, 220, 120];
      P.rect(x + 6, ay + 6, 3, 12, c); P.rect(dir > 0 ? x + 6 : x + 2, ay + 6, 7, 3, c);
      P.poly(dir > 0 ? [x + 13, ay + 2, x + 18, ay + 7.5, x + 13, ay + 13] : [x + 2, ay + 2, x - 3, ay + 7.5, x + 2, ay + 13], c);
    }
    return;
  }
  // a place's card: name, kind and district, open or not, its number, how far, its address; Route and Call
  const h = 112, y = Y1 - h;
  P.rect(0, y, SCR_W, h, [252, 252, 254]); P.rect(0, y, SCR_W, 2, [200, 204, 214]);
  P.disc(M + 6, y + 12, 5, [220, 46, 38]); P.poly([M + 2, y + 15, M + 10, y + 15, M + 6, y + 21], [220, 46, 38]);
  ptext(P, M + 18, y + 8, F.name.slice(0, 30), [30, 34, 44], 1, true);
  ptext(P, M + 18, y + 21, F.sub.slice(0, 34), [110, 118, 132]);
  let ly = y + 36;
  if (F.open !== null) {
    const tw = ptextW(F.openLabel, 1, true) + 8;
    P.rrect(M, ly - 2, tw, 12, 2, F.open ? [40, 150, 70] : [200, 50, 40]);
    ptext(P, M + 4, ly, F.openLabel, [255, 255, 255], 1, true);
    ptext(P, M + tw + 6, ly, F.hours.slice(0, 26), [110, 118, 132]);
    ly += 15;
  }
  const fw = ptextW(F.far);
  ptext(P, M, ly, F.number, F.hasNumber ? [40, 90, 170] : [110, 118, 132]);
  ptext(P, SCR_W - M - fw, ly, F.far, [30, 34, 44]);
  ptext(P, M, ly + 14, F.address.slice(0, 36), [30, 34, 44]);
  // the buttons
  const by = Y1 - 30, bw = (SCR_W - 2 * M - 8) / 2;
  HITS.push({ x: M, y: by, w: Math.round(bw), h: 26, key: 'ok' });
  P.rrect(M, by, Math.round(bw), 24, 4, [40, 90, 170]);
  ptext(P, Math.round(M + (bw - ptextW(F.route, 1, true)) / 2), by + 8, F.route, [255, 255, 255], 1, true);
  if (F.hasNumber) {
    const x = Math.round(M + bw + 8);
    HITS.push({ x, y: by, w: Math.round(bw), h: 26, key: 'send' });
    P.rrect(x, by, Math.round(bw), 24, 4, [40, 150, 70]);
    ptext(P, Math.round(x + (bw - ptextW(F.call, 1, true)) / 2), by + 8, F.call, [255, 255, 255], 1, true);
  }
}

/** Maps' search: the field typed on the keypad (framed in ice while it is the one picked, its typing under it), then what came back: the search under way, nothing, or the places, nearest first. */
export interface PlacesPage { title: string; mode: string; query: string; placeholder: string; on: boolean; blink: boolean; hint: TypeHint; goField: () => void;
  status: string; statusBad: boolean; status2: string; count: string;
  rows: { name: string; far: string; kind: string; open: boolean | null; openLabel: string; landmark: boolean; sel: boolean; pre: () => void }[]; t: number }
export function paintPlaces(P: Paint, d: PlacesPage) {
  P.rect(0, 0, SCR_W, Y1, BG);
  appHeader(P, d.title, d.mode, MAPS);
  const fy = Y0 + 36;
  HITS.push({ x: M, y: fy, w: SCR_W - 2 * M, h: 28, pre: d.goField });
  P.rrect(M, fy, SCR_W - 2 * M, 28, 5, d.on ? [22, 36, 50] : [19, 31, 42]);
  if (d.on) { P.rrect(M, fy, SCR_W - 2 * M, 1, 0, ICE); P.rrect(M, fy + 27, SCR_W - 2 * M, 1, 0, ICE); P.rect(M, fy, 1, 28, ICE); P.rect(SCR_W - M - 1, fy, 1, 28, ICE); }
  // a magnifier, then the words
  P.ring(M + 13, fy + 12, 5, 1.6, d.on ? ICE : DIM); P.line(M + 17, fy + 16, M + 21, fy + 20, 2, d.on ? ICE : DIM);
  const room = Math.floor((SCR_W - 2 * M - 40) / 6);
  if (d.query) ptext(P, M + 28, fy + 10, d.query.slice(-room) + (d.on && d.blink ? '_' : ''), INK);
  else ptext(P, M + 28, fy + 10, d.on && d.blink ? '_' : d.placeholder.slice(0, room), DIM);
  if (d.on) paintHint(P, fy + 34, d.hint);
  const top = fy + 54;
  if (d.status) { ctext(P, top + 60, d.status, d.statusBad ? [255, 110, 90] : ICE, 1, true); if (d.status2) ctext(P, top + 76, d.status2, DIM); return; }
  ptext(P, M, top, d.count, DIM);
  const rh = 38, fit = Math.max(1, Math.floor((Y1 - 4 - top - 14) / rh)), s = Math.max(0, d.rows.findIndex((r) => r.sel));
  const first = Math.max(0, Math.min(s - fit + 1, d.rows.length - fit));
  d.rows.slice(first, first + fit).forEach((r, k) => {
    const y = top + 14 + k * rh;
    HITS.push({ x: 6, y, w: SCR_W - 12, h: rh - 4, pre: r.pre, key: r.sel ? 'ok' : undefined });
    if (d.t < 0.1 + k * 0.04) return;
    if (r.sel) P.rrect(6, y, SCR_W - 12, rh - 4, 5, PICK); else P.rect(M, y + rh - 3, SCR_W - 2 * M, 1, [24, 36, 48]);
    // a red pin for a place, a star for a landmark
    const ix = M + 6, iy = y + 10;
    if (r.landmark) { P.disc(ix, iy + 2, 5, [210, 60, 50]); ptext(P, ix - 2, iy - 2, '*', [255, 255, 255]); }
    else { P.disc(ix, iy, 4.5, [220, 46, 38]); P.poly([ix - 4, iy + 2, ix + 4, iy + 2, ix, iy + 8], [220, 46, 38]); }
    const fw = ptextW(r.far);
    ptext(P, M + 18, y + 6, r.name.slice(0, Math.floor((SCR_W - 2 * M - 26 - fw) / 7)), r.sel ? PICK_INK : INK, 1, true);
    ptext(P, SCR_W - M - 4 - fw, y + 6, r.far, r.sel ? PICK_DIM : DIM);
    const kw = ptext(P, M + 18, y + 20, r.kind.slice(0, 22), r.sel ? PICK_DIM : DIM);
    if (r.open !== null) ptext(P, M + 18 + kw + 8, y + 20, r.openLabel, r.sel ? [255, 255, 255] : r.open ? [90, 200, 120] : [255, 110, 90]);
  });
}
