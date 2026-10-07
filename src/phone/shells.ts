import { SHAPE } from '../render/atlas';
import { type C3 } from './lcd';
import { type Key } from './phone';

/**
 * The phone's looks: the same handset inside (the same screen, the same system, see sim/device.ts)
 * in different bodies. A shell is the body around the screen: its outline, its material (how it
 * takes the scene's light), its keys and its d-pad. A case goes over the body and leaves only its
 * rim in sight. Every shell is lit by the same code in draw.ts, so they all answer the light alike.
 */
export type Material = 'matte' | 'gloss' | 'metal' | 'rubber';
export interface Shell {
  /** Its name in the settings (the series, after the maker's name). */
  name: string;
  /** The body; null: the color of the model (Device.body). */
  body: C3 | null;
  /** A second color: the screen's surround (the upper half of a slider), or null for the body's. */
  face: C3 | null;
  material: Material;
  /** Corner radius, in rows. */
  round: number;
  /** Number keys apart, flush in a grid with lines between, or round pebbles. */
  keys: 'spaced' | 'flush' | 'pebble';
  /** The d-pad: four keys around OK, or a ring. */
  dpad: 'cross' | 'ring';
  cap: C3;
  capTop: C3;
  /** Key labels: lit from behind while the phone is on, and unlit. */
  label: C3;
  labelOff: C3;
  /** Trim: the ring of a d-pad, a chrome surround, a rugged phone's bumpers. */
  trim: C3;
  /** A chrome ring around the screen. */
  chrome: boolean;
}

export const SHELLS: Shell[] = [
  { name: 'Classic', body: [58, 66, 80], face: null, material: 'matte', round: 2, keys: 'spaced', dpad: 'cross', cap: [48, 50, 57], capTop: [64, 67, 75], label: [150, 205, 255], labelOff: [125, 128, 138], trim: [90, 94, 104], chrome: false },
  { name: 'Slate', body: [14, 14, 17], face: null, material: 'gloss', round: 2, keys: 'flush', dpad: 'ring', cap: [24, 24, 28], capTop: [36, 36, 42], label: [235, 240, 255], labelOff: [120, 122, 130], trim: [170, 176, 188], chrome: true },
  { name: 'Brushed', body: [150, 154, 160], face: null, material: 'metal', round: 1, keys: 'pebble', dpad: 'cross', cap: [28, 29, 33], capTop: [44, 46, 52], label: [255, 190, 110], labelOff: [140, 140, 146], trim: [200, 204, 210], chrome: false },
  { name: 'Pebble', body: [226, 214, 220], face: null, material: 'matte', round: 5, keys: 'pebble', dpad: 'ring', cap: [244, 238, 242], capTop: [255, 252, 254], label: [210, 90, 150], labelOff: [150, 130, 140], trim: [236, 150, 190], chrome: false },
  { name: 'Rugged', body: [44, 46, 44], face: null, material: 'rubber', round: 1, keys: 'spaced', dpad: 'cross', cap: [70, 72, 70], capTop: [88, 90, 88], label: [255, 170, 60], labelOff: [150, 150, 140], trim: [230, 120, 30], chrome: false },
  { name: 'Slider', body: [120, 22, 30], face: null, material: 'gloss', round: 3, keys: 'flush', dpad: 'cross', cap: [40, 10, 14], capTop: [58, 16, 22], label: [255, 215, 220], labelOff: [150, 110, 116], trim: [210, 212, 220], chrome: true },
];

export interface Case {
  name: string;
  color: C3;
  material: Material | 'clear';
  /** Stitches, sparkles or ridges on the rim. */
  pattern: '' | 'stitch' | 'glitter' | 'ridge';
}
export const CASES: Case[] = [
  { name: 'None', color: [0, 0, 0], material: 'matte', pattern: '' },
  { name: 'Black silicone', color: [24, 24, 26], material: 'matte', pattern: '' },
  { name: 'Red silicone', color: [170, 30, 40], material: 'matte', pattern: '' },
  { name: 'Teal silicone', color: [30, 130, 140], material: 'matte', pattern: '' },
  { name: 'Leather', color: [96, 58, 32], material: 'matte', pattern: 'stitch' },
  { name: 'Bumper', color: [30, 30, 30], material: 'rubber', pattern: 'ridge' },
  { name: 'Clear', color: [200, 225, 240], material: 'clear', pattern: '' },
  { name: 'Glitter', color: [220, 110, 180], material: 'gloss', pattern: 'glitter' },
];

/**
 * The body, as the phone's manual draws it (docs/identidade/celular-manual.html v2, sections 1 to 3 and 9),
 * in millimetres: one slider for every look (a look is the upper plate's color and material). The upper
 * plate 51 x 103 with the touch screen, call, the round home button and end; the lower one the same size,
 * with the keypad, 43 mm under it when the rail is open. Coordinates are the open phone's, from the upper
 * plate's top left; the lower plate's top is at RAIL_MM.
 */
export const BODY_MM = [51, 103] as const, CORNER_MM = 6.5, RAIL_MM = 43;
/** The screen's black surround and the screen itself (a touch screen, 240 x 432 pixels on it, the manual's section 6). */
export const BEZEL_MM = [3, 6, 48, 85] as const, SCREEN_MM = [4.5, 7.5, 46.5, 83] as const;
/**
 * Millimetres a column and a row of the interface's grid span (the grid is 80 rows tall: at 1080p a cell is
 * 8 x 13 pixels, so the 42 mm screen is 240 pixels across, one to one).
 */
export const COL_MM = 1.4, ROW_MM = 2.275;
/** The phone's size in cells: its width, the closed phone's rows (the upper plate), the open one's. */
export const PHONE_W = Math.ceil(BODY_MM[0] / COL_MM), UP_ROWS = Math.ceil(BODY_MM[1] / ROW_MM), PHONE_H = UP_ROWS + Math.round(RAIL_MM / ROW_MM);
/** The home button (manual v2): its centre, the chrome ring's outer radius, the ice ring's, the button's, the ice square's half side (mm). */
// x and y on a cube's centre (n + 0.5), so the disc and the square are an odd number of cubes wide and share their middle cube
export const HOME_MM = { x: 25.5, y: 93.5, chrome: 6, ice: 5.4, disc: 5, icon: 1 } as const;

/** A key's place (mm, x0, y0, x1, y1, the open phone's) and its outline: a box rounded at r, the call or end key, the home button's disc, a music key on the top edge. */
export type KeyShape = 'box' | 'send' | 'end' | 'disc' | 'top';
export interface KeyMm { k: Key; box: readonly [number, number, number, number]; shape: KeyShape; r?: number; label: string }
/** The keypad's legends: the number, and the letters (T9) or the sign beside it (the manual's lower slab). */
export const KEY_LEGEND: Record<string, [string, string]> = {
  '1': ['1', ''], '2': ['2', 'ABC'], '3': ['3', 'DEF'], '4': ['4', 'GHI'], '5': ['5', 'JKL'], '6': ['6', 'MNO'],
  '7': ['7', 'PQRS'], '8': ['8', 'TUV'], '9': ['9', 'WXYZ'], '*': ['*', '+'], '0': ['0', '_'], '#': ['#', '^'],
};
const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const H = HOME_MM;
export const KEYS_MM: KeyMm[] = [
  { k: 'send', box: [2, 88, 15.5, 100], shape: 'send', label: '' }, { k: 'end', box: [35.5, 88, 49, 100], shape: 'end', label: '' },
  { k: 'home', box: [H.x - H.disc, H.y - H.disc, H.x + H.disc, H.y + H.disc], shape: 'disc', label: '' },
  // the music keys: chrome bumps standing 2 mm out of the top edge
  { k: 'prev', box: [11.5, -2, 17, 0], shape: 'top', label: '' }, { k: 'play', box: [22.75, -2, 28.25, 0], shape: 'top', label: '' },
  { k: 'next', box: [34, -2, 39.5, 0], shape: 'top', label: '' },
  // the keypad on the lower plate: 3 x 4 keys of 13 x 8 mm (the manual's lower slab, 61 mm down it)
  ...PAD.map((k, n): KeyMm => {
    const x = 3.5 + (n % 3) * 15.5, y = RAIL_MM + 61 + Math.floor(n / 3) * 10;
    return { k: k as Key, box: [x, y, x + 13, y + 8], shape: 'box', r: 1.75, label: k };
  }),
];

export type KeyRect = [Key, number, number, number, number, string, C3?];

/** The keys in cells (key, column, row, width, height, label), for the clicks and the labels: each key's box rounded to the grid. */
export function keysOf(_S: Shell): KeyRect[] {
  return KEYS_MM.map(({ k, box: [x0, y0, x1, y1], label }): KeyRect => {
    const c0 = Math.round(x0 / COL_MM), r0 = Math.round(y0 / ROW_MM);
    return [k, c0, r0, Math.max(1, Math.round(x1 / COL_MM) - c0), Math.max(1, Math.round(y1 / ROW_MM) - r0), label];
  });
}

/**
 * A rounded box drawn in cells: whether cell (x, y) lies in the box from (x0, y0) to (x1, y1)
 * (inclusive) with corners of r rows (columns are narrower: about 1.6 to a row). 0 outside, 1
 * inside, or the corner glyph that fills it partly.
 */
export function inBox(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number): number {
  if (x < x0 || x > x1 || y < y0 || y > y1) return 0;
  if (r <= 0) return 1;
  const rx = r * 1.6, ry = r;
  const left = x < x0 + rx, right = x > x1 - rx, top = y < y0 + ry, bottom = y > y1 - ry;
  if (!(left || right) || !(top || bottom)) return 1;
  // the corner's ellipse, its center inside the box: how much of the cell it covers (4x4 samples), and
  // which half. A corner wider than a cell crosses several cells: only the one the curve turns in gets
  // the rounded glyph; those along its flatter part are full, empty or half cells (a single rounded
  // glyph in each of them made the edge scalloped)
  const cx = left ? x0 + rx : x1 + 1 - rx, cy = top ? y0 + ry : y1 + 1 - ry;
  let n = 0, inV = 0, inH = 0;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const px = x + (i + 0.5) / 4, py = y + (j + 0.5) / 4;
    if (((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 > 1) continue;
    n++;
    if (top ? j >= 2 : j < 2) inV++;
    if (left ? i >= 2 : i < 2) inH++;
  }
  if (n >= 14) return 1;
  if (n <= 2) return 0;
  // most of it in the inner half and little in the outer: a half cell
  if (inV >= 7 && n - inV <= 2) return top ? SHAPE.bottom : SHAPE.top;
  if (inH >= 7 && n - inH <= 2) return left ? SHAPE.right : SHAPE.left;
  return top ? (left ? SHAPE.tl : SHAPE.tr) : left ? SHAPE.bl : SHAPE.br;
}
