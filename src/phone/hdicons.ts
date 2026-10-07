import { HD } from '../render/hd';
import { type C3, type Lcd } from './lcd';

/**
 * The phone's icons in HD: little pictures in pixels (HD x HD per cell), drawn over the screen in the
 * HD layer. An app's icon fills its 6 x 3 cell tile (18 x 9 pixels): a glossy rounded square in the
 * app's colour with the picture on it. The weather's pictures fill 5 x 3 cells (15 x 9). Each picture
 * is rows of letters, one per pixel: '.' shows what is under it, the others are colours (PAL).
 */
const PAL: Record<string, C3> = {
  w: [255, 255, 255], k: [24, 24, 28], y: [255, 214, 70], o: [255, 150, 40], r: [214, 50, 50], g: [60, 170, 80],
  b: [60, 110, 200], c: [120, 200, 255], s: [196, 202, 212], l: [150, 156, 168], d: [80, 82, 90], n: [150, 100, 40],
  p: [240, 120, 190], m: [200, 60, 150], e: [234, 238, 246], x: [140, 146, 160], z: [120, 180, 255], u: [236, 232, 196],
  i: [244, 250, 255], v: [40, 52, 30], t: [64, 70, 80],
};

export const APP_ART: Record<string, string[]> = {
  calls: [
    '..................',
    '...ww.............',
    '..wwww............',
    '..www.............',
    '...ww.............',
    '....ww......ww....',
    '.....www..wwww....',
    '......wwwwwww.....',
    '.......wwwww......',
  ],
  contacts: [
    '..................',
    '.......wwww.......',
    '......wwwwww......',
    '......wwwwww......',
    '.......wwww.......',
    '.....wwwwwwww.....',
    '....wwwwwwwwww....',
    '....wwwwwwwwww....',
    '..................',
  ],
  messages: [
    '..................',
    '..................',
    '...wwwwwwwwwwww...',
    '...wbwwwwwwwwbw...',
    '...wwbbwwwwbbww...',
    '...wwwwbbbbwwww...',
    '...wwwwwwwwwwww...',
    '...wwwwwwwwwwww...',
    '..................',
  ],
  camera: [
    '..................',
    '......kkkk........',
    '..kkkkkkkkkkkkkk..',
    '..kssssttttsssyk..',
    '..ksssttcctttssk..',
    '..ksssttcctttssk..',
    '..kssssttttssssk..',
    '..kkkkkkkkkkkkkk..',
    '..................',
  ],
  map: [
    '..................',
    '..wwwwwwwwwwwww...',
    '..wwywwwwwwwywr...',
    '..wwwyywwwyywrrr..',
    '..wwwwwyyyywwrrr..',
    '..wwwwyywwyywwr...',
    '..wwyywwwwwwyywr..',
    '..wwwwwwwwwwwww...',
    '..................',
  ],
  wire: [
    '..................',
    '..................',
    '...www..w.....w...',
    '..w.....w.....w...',
    '...ww...w..w..w...',
    '.....w..w.w.w.w...',
    '..www....w...w.oo.',
    '...............oo.',
    '..................',
  ],
  news: [
    '..................',
    '..kkkkkkkkkkkkkk..',
    '..................',
    '..kkkkk..llllll...',
    '..kkkkk..llllll...',
    '..kkkkk..llllll...',
    '..llllllllllllll..',
    '..llllllllllllll..',
    '..................',
  ],
  weather: [
    '..................',
    '....y..y..........',
    '.....yyyy.........',
    '...yyyyyyy........',
    '....yyyyeeeee.....',
    '.....yyeeeeeeee...',
    '....eeeeeeeeeeee..',
    '.....eeeeeeeeee...',
    '..................',
  ],
  calendar: [
    '..rrrrrrrrrrrrrr..',
    '..rrrwrrrrrrwrrr..',
    '..wwwwwwwwwwwwww..',
    '..wwwkkkwwwwkwww..',
    '..wwwwwkwwwkkwww..',
    '..wwwwkkwwwwkwww..',
    '..wwwwwkwwwwkwww..',
    '..wwwkkkwwwkkkww..',
    '..wwwwwwwwwwwwww..',
  ],
  bank: [
    '..................',
    '........yy........',
    '.....yyyyyyyy.....',
    '...yyyyyyyyyyyy...',
    '....y..y..y..y....',
    '....y..y..y..y....',
    '....y..y..y..y....',
    '...yyyyyyyyyyyy...',
    '..................',
  ],
  calc: [
    '..................',
    '..llllllllllllll..',
    '..lkkkkkkkkkkkcl..',
    '..llllllllllllll..',
    '..ww.ww.ww..oo....',
    '..................',
    '..ww.ww.ww..oo....',
    '..................',
    '..ww.ww.ww..oo....',
  ],
  notes: [
    '..................',
    '...r..............',
    '...rbbbbbbbbbbb...',
    '...r..............',
    '...rbbbbbbbbbbb...',
    '...r..............',
    '...rbbbbbbb.......',
    '...r..............',
    '..................',
  ],
  snake: [
    '..................',
    '..................',
    '...vvvvvvv........',
    '.........v....v...',
    '....vvvvvv........',
    '....v.............',
    '....vvvvvvvvvk....',
    '..................',
    '..................',
  ],
  folder: [
    '..................',
    '...nnnnn..........',
    '...nnnnnnyyyyyy...',
    '...yyyyyyyyyyyy...',
    '...yyyyyyyyyyyy...',
    '...yyyyyyyyyyyy...',
    '...yyyyyyyyyyyy...',
    '..................',
    '..................',
  ],
  store: [
    '..................',
    '.......pppp.......',
    '......p....p......',
    '....pppppppppp....',
    '....pwwwwwwwwp....',
    '....pwwwmmwwwp....',
    '....pwwwwwwwwp....',
    '....pppppppppp....',
    '..................',
  ],
  settings: [
    '..................',
    '.......ww.ww......',
    '.....wwwwwwwww....',
    '......ww...ww.....',
    '....www.....www...',
    '......ww...ww.....',
    '.....wwwwwwwww....',
    '.......ww.ww......',
    '..................',
  ],
  // (15.17i) the ferret's face: the ears, the dark mask, the cream muzzle
  web: [
    '..................',
    '...nn........nn...',
    '..nnnnnnnnnnnnnn..',
    '.nkkkkknnnnkkkkkn.',
    '.nkwkkuuuuuukkwkn.',
    '.nnkkuuuuuuuukknn.',
    '..nuuuuukkuuuuun..',
    '...uuuuuuuuuuuu...',
    '.....uuuuuuuu.....',
  ],
  torch: [
    '..................',
    '..........yy......',
    '.....sssssyyyy....',
    '..kkksssssyyyyy...',
    '..kkksssssyyyyy...',
    '.....sssssyyyy....',
    '..........yy......',
    '..................',
    '..................',
  ],
  convert: [
    '..................',
    '.....w............',
    '....wwwwwwwwww....',
    '.....w............',
    '..................',
    '............w.....',
    '....wwwwwwwwww....',
    '............w.....',
    '..................',
  ],
  tunes: [
    '..................',
    '.........wwwww....',
    '.........w...w....',
    '.........w...w....',
    '.........w...w....',
    '.......www.www....',
    '......wwww.www....',
    '.......ww.........',
    '..................',
  ],
  reynard: [
    '...o..........o...',
    '...oo........oo...',
    '...oooooooooooo...',
    '..oookooooookooo..',
    '..wwooooooooooww..',
    '...wwwwoooowwww...',
    '.....wwwkkwww.....',
    '.......wwww.......',
    '..................',
  ],
  atlas: [
    '..................',
    '.......wwww.......',
    '.....wwwwwwww.....',
    '....gwwwwwwwwg....',
    '....ggggwwgggg....',
    '....gggggggggg....',
    '.....gggggggg.....',
    '.......gggg.......',
    '..................',
  ],
};

/** The weather's pictures, 15 x 9 pixels. */
const WX_ART: Record<string, string[]> = {
  sun: ['.......y.......', '...y...y...y...', '.....yyyyy.....', '....yyyyyyy....', '.yy.yyyyyyy.yy.', '....yyyyyyy....', '.....yyyyy.....', '...y...y...y...', '.......y.......'],
  moon: ['...............', '.....uuuu......', '....uuu........', '...uuu.........', '...uuu.........', '...uuu.........', '....uuu........', '.....uuuu......', '...............'],
  partlyDay: ['..y..y.........', '...yyyy........', '.yyyyyy........', '..yyyyeeeee....', '...yyeeeeeeee..', '..eeeeeeeeeeee.', '.eeeeeeeeeeeeee', '..eeeeeeeeeeee.', '...............'],
  partlyNight: ['..uuu..........', '.uu............', '.uu....eeee....', '.uu..eeeeeeee..', '..uueeeeeeeeee.', '..eeeeeeeeeeee.', '.eeeeeeeeeeeeee', '..eeeeeeeeeeee.', '...............'],
  cloudy: ['...............', '......eeee.....', '....eeeeeeee...', '..eeeeeeeeeeee.', '.eeeeeeeeeeeeee', '.eeeeeeeeeeeeee', '..eeeeeeeeeeee.', '...............', '...............'],
  drizzle: ['.....eeee......', '...eeeeeeee....', '.eeeeeeeeeeee..', 'eeeeeeeeeeeeee.', '.eeeeeeeeeeee..', '...............', '....z.....z....', '.......z.......', '...............'],
  rain: ['.....eeee......', '...eeeeeeee....', '.eeeeeeeeeeee..', 'eeeeeeeeeeeeee.', '.eeeeeeeeeeee..', '...z...z...z...', '..z...z...z....', '.z...z...z.....', '...............'],
  storm: ['.....xxxx......', '...xxxxxxxx....', '.xxxxxxxxxxxx..', 'xxxxxxxxxxxxxx.', '.xxxxyyyxxxx...', '.....yyy.......', '....yyyyy......', '......yy.......', '......y........'],
  snow: ['.....eeee......', '...eeeeeeee....', '.eeeeeeeeeeee..', 'eeeeeeeeeeeeee.', '.eeeeeeeeeeee..', '...i...i...i...', '.....i...i.....', '...i...i...i...', '...............'],
};

/** A weather picture as colours a pixel (null: clear), for the screens drawn in pixels (pixpages.ts). */
export function wxColors(kind: string): (C3 | null)[][] {
  return (WX_ART[kind] ?? WX_ART.cloudy).map((r) => [...r].map((c) => (c === '.' ? null : PAL[c] ?? null)));
}

/** Which picture the weather is (the same choice as the characters' version in skins.ts). */
export function wxArt(precip: number, snow: boolean, cloud: number, night: boolean): string {
  if (precip > 0.02) return snow ? 'snow' : precip > 0.75 ? 'storm' : precip < 0.25 ? 'drizzle' : 'rain';
  if (cloud > 0.75) return 'cloudy';
  if (cloud > 0.35) return night ? 'partlyNight' : 'partlyDay';
  return night ? 'moon' : 'sun';
}

/** A picture's pixels from cell (x, y): '.' takes `under` (a colour at a pixel), or is left alone when under is null. */
function art(S: Lcd, x: number, y: number, rows: string[], under: ((px: number, py: number) => C3) | null) {
  rows.forEach((row, py) => {
    for (let px = 0; px < row.length; px++) {
      const c = PAL[row[px]] ?? (under ? under(px, py) : null);
      if (c) S.pixel(x + Math.floor(px / HD), y + Math.floor(py / HD), px % HD, py % HD, c[0], c[1], c[2]);
    }
  });
}

/** An app's picture as colours a pixel (null: clear), for the screens drawn in pixels (pixpages.ts); null without one. */
export function artColors(id: string): (C3 | null)[][] | null {
  const rows = APP_ART[id];
  return rows ? rows.map((r) => [...r].map((c) => (c === '.' ? null : PAL[c] ?? null))) : null;
}

/**
 * An app's icon on its tile, the tile's top-left cell at (x, y) (6 x 3 cells): a rounded square
 * shading from light to dark with a gloss over its top, the picture on it; `under` is what shows in
 * the rounded corners (the menu, or the picked tile's panel), by cell row.
 */
export function appIcon(S: Lcd, x: number, y: number, id: string, col: C3, under: (cellRow: number) => C3) {
  const rows = APP_ART[id];
  if (!rows || !S.hd) return false;
  const W = 6 * HD, H = 3 * HD, r = 3;
  const bg = (px: number, py: number): C3 => {
    // the rounded corners show what is under the tile
    const cx = px < r ? r - px : px >= W - r ? px - (W - r - 1) : 0, cy = py < r ? r - py : py >= H - r ? py - (H - r - 1) : 0;
    if (cx * cx + cy * cy > r * r) return under(Math.floor(py / HD));
    const k = 1.2 - (py / H) * 0.45, gloss = py < H / 2 ? 0.22 * (1 - py / (H / 2)) : 0;
    return [col[0] * k + (255 - col[0] * k) * gloss, col[1] * k + (255 - col[1] * k) * gloss, col[2] * k + (255 - col[2] * k) * gloss];
  };
  // the tile under the picture, then the picture
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const c = bg(px, py); S.pixel(x + Math.floor(px / HD), y + Math.floor(py / HD), px % HD, py % HD, c[0], c[1], c[2]); }
  art(S, x, y, rows, null);
  return true;
}
