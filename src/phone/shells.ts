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
  { name: 'Classic', body: null, face: null, material: 'matte', round: 2, keys: 'spaced', dpad: 'cross', cap: [48, 50, 57], capTop: [64, 67, 75], label: [150, 205, 255], labelOff: [125, 128, 138], trim: [90, 94, 104], chrome: false },
  { name: 'Slate', body: [14, 14, 17], face: null, material: 'gloss', round: 2, keys: 'flush', dpad: 'ring', cap: [24, 24, 28], capTop: [36, 36, 42], label: [235, 240, 255], labelOff: [120, 122, 130], trim: [170, 176, 188], chrome: true },
  { name: 'Brushed', body: [150, 154, 160], face: null, material: 'metal', round: 1, keys: 'pebble', dpad: 'cross', cap: [28, 29, 33], capTop: [44, 46, 52], label: [255, 190, 110], labelOff: [140, 140, 146], trim: [200, 204, 210], chrome: false },
  { name: 'Pebble', body: [226, 214, 220], face: null, material: 'matte', round: 5, keys: 'pebble', dpad: 'ring', cap: [244, 238, 242], capTop: [255, 252, 254], label: [210, 90, 150], labelOff: [150, 130, 140], trim: [236, 150, 190], chrome: false },
  { name: 'Rugged', body: [44, 46, 44], face: null, material: 'rubber', round: 1, keys: 'spaced', dpad: 'cross', cap: [70, 72, 70], capTop: [88, 90, 88], label: [255, 170, 60], labelOff: [150, 150, 140], trim: [230, 120, 30], chrome: false },
  { name: 'Slider', body: [120, 22, 30], face: [12, 12, 15], material: 'gloss', round: 3, keys: 'flush', dpad: 'cross', cap: [40, 10, 14], capTop: [58, 16, 22], label: [255, 215, 220], labelOff: [150, 110, 116], trim: [210, 212, 220], chrome: true },
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

/** The phone's size in cells (every shell); the screen's place on it (see draw.ts) is the same for all. */
export const PHONE_W = 50, PHONE_H = 52;
/** The top of the keys' area. */
export const KEYS_Y = 32;

export type KeyRect = [Key, number, number, number, number, string, C3?];
const GREEN: C3 = [80, 230, 120], RED: C3 = [255, 80, 70];
const LABELS = ['1 .,', '2 abc', '3 def', '4 ghi', '5 jkl', '6 mno', '7 pqrs', '8 tuv', '9 wxyz', '* +', '0 _', '# ^'];

/** The keys on a shell's face: key, column, row, width, height, label, label color. */
export function keysOf(S: Shell): KeyRect[] {
  const CY = KEYS_Y;
  const K: KeyRect[] = [
    ['lsoft', 3, CY, 10, 2, '--'], ['rsoft', 37, CY, 10, 2, '--'],
    ['send', 3, CY + 3, 10, 2, 'SEND', GREEN], ['end', 37, CY + 3, 10, 2, 'END', RED],
    ['up', 21, CY, 8, 1, '^'], ['left', 16, CY + 1, 4, 3, '<'], ['right', 30, CY + 1, 4, 3, '>'], ['ok', 21, CY + 1, 8, 3, 'OK'], ['down', 21, CY + 4, 8, 1, 'v'],
  ];
  // flush keys fill the width in a grid, a line of the body between them; the others stand apart
  LABELS.forEach((label, n) => {
    const c = n % 3, r = Math.floor(n / 3);
    if (S.keys === 'flush') K.push([label[0] as never, 3 + c * 15, CY + 6 + r * 3, 14, 2, label]);
    else K.push([label[0] as never, 3 + c * 16, CY + 6 + r * 3, 12, 2, label]);
  });
  return K;
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
  // the corner's ellipse, its center inside the box; test the cell's four corners against it
  const cx = left ? x0 + rx : x1 + 1 - rx, cy = top ? y0 + ry : y1 + 1 - ry;
  let n = 0;
  for (const [px, py] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) if (((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1.0001) n++;
  if (n === 4) return 1;
  if (n === 0) return 0;
  return top ? (left ? SHAPE.tl : SHAPE.tr) : left ? SHAPE.bl : SHAPE.br;
}
