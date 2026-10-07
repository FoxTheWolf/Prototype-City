/**
 * A web page of the city (15.1): blocks a site is made of (a banner, a menu, headings, paragraphs,
 * lists, tables, columns, ASCII pictures, ad boxes), laid out into colored cells the width of the
 * browser, the way a 2008 site sat in a fixed-width column on a gray page. Links are written inside
 * the text as [label](url); the layout returns where each one landed, for the browser to pick.
 * Pure data and layout: no DOM, no simulation (sites.ts fills the pages from the city).
 */
import { logoW, type Mood } from './owl';
import { CH, CW } from './chrome';
export type C3 = [number, number, number];

/**
 * A site's colors: the page, its text and links, the banner, the menu bar; and (15.17e) the year of the
 * web it looks like: `gloss` (the Web 2.0 shine on its banner and menu), `tile` (the pattern on the
 * page round its column, which then casts a soft shadow).
 */
export interface Theme { page: C3; bg: C3; fg: C3; dim: C3; link: C3; head: C3; headFg: C3; bar: C3; barFg: C3; gloss?: boolean; tile?: TileKind }
export type TileKind = 'stripes' | 'dots' | 'checks' | 'diag' | 'stars';
/** What a photo shows (render/paint2d.ts paints it). */
export type PhotoSubj = 'store' | 'food' | 'room' | 'bar' | 'tech' | 'sky' | 'blackout' | 'face';
/** 15.17g: a face for an avatar, from how a citizen looks (render/models faceOf): the blocky head of the city's people. */
type RC3 = readonly [number, number, number];
export interface Face { skin: RC3; hair: RC3; shirt: RC3; eyes: RC3; /** 0 bald, 1 short, 2 long. */ hairLen: number; beard: boolean }
/** The sky of a weather icon. */
export type Sky = 'sun' | 'moon' | 'cloud' | 'rain' | 'snow';

/**
 * 15.17e: what a page paints in pixels, as data (the layout stays pure): in the page's cells (fractions
 * allowed), from its top-left. The `back` ones go under the text (shine, gradients, bevels, tabs, boxes,
 * tiles, shadows, fields, rules); the `front` ones over empty cells only (photos, ads, maps, stars, the
 * starburst, the RSS icon, the marquee, big headlines, round icons).
 */
export type HdOp =
  | { k: 'gloss'; x: number; y: number; w: number; h: number; col: C3; r?: number }
  | { k: 'fade'; x: number; y: number; w: number; h: number; c1: C3; c2: C3 }
  | { k: 'bevel'; x: number; y: number; w: number; h: number; col: C3; down?: boolean }
  | { k: 'box'; x: number; y: number; w: number; h: number; fill: C3; stroke: C3; head?: C3 }
  | { k: 'tab'; x: number; y: number; w: number; col: C3; on: boolean }
  | { k: 'shadow'; x: number; y: number; w: number; h: number }
  | { k: 'tile'; x: number; y: number; w: number; h: number; col: C3; kind: TileKind; /** The column left clear of it (from x0, w0 wide). */ x0: number; w0: number }
  | { k: 'btn'; x: number; y: number; w: number; col: C3 }
  | { k: 'field'; x: number; y: number; w: number }
  | { k: 'hr'; x: number; y: number; w: number; kind: 'groove' | 'rainbow' | 'dots'; col: C3 }
  | { k: 'photo'; x: number; y: number; w: number; h: number; subj: PhotoSubj; seed: number; frame?: 'white' | 'line'; reflect?: boolean }
  | { k: 'ad'; x: number; y: number; w: number; h: number; name: string; slogan: string; c1: C3; c2: C3 }
  | { k: 'burst'; x: number; y: number; text: string; col: C3 }
  | { k: 'rss'; x: number; y: number }
  | { k: 'stars'; x: number; y: number; n: number }
  /** A street map; `ground` (gw x gh, one digit a spot: render/../phone/mapdata Ground) is the city's own, round the pin. */
  | { k: 'map'; x: number; y: number; w: number; h: number; seed: number; pins: string[]; ground?: string; gw?: number; gh?: number; /** 15.17h: where each pin is (fractions of the map), else in the middle. */ spots?: [number, number][] }
  | { k: 'broken'; x: number; y: number; w: number; h: number }
  | { k: 'blink'; x: number; y: number; w: number; text: string; col: C3 }
  | { k: 'marquee'; x: number; y: number; w: number; text: string; col: C3 }
  | { k: 'big'; x: number; y: number; text: string; size: number; kind: 'word' | 'hero'; col: C3 }
  | { k: 'icon'; x: number; y: number; kind: 'star' | 'pin' | 'lock' | 'mail' | 'phone'; col: C3 }
  /** 15.17g: the tilted "beta" badge of every new site. */
  | { k: 'ribbon'; x: number; y: number; text: string; col: C3 }
  /** An avatar: a citizen's face, w x h cells. */
  | { k: 'face'; x: number; y: number; w: number; h: number; face: Face }
  /** The weather's icon (bg: the paper, for the moon's cut). */
  | { k: 'wx'; x: number; y: number; sky: Sky; bg: C3 }
  /** Lookwise's owl, 16 px. */
  | { k: 'owl'; x: number; y: number }
  /** 15.17h: Lookwise's name with the owl's eyes, s pixels a bulb (its eyes on the text being typed when idle). */
  | { k: 'lwlogo'; x: number; y: number; s: number; mood: Mood }
  /** The owl's head, size rows tall, in a mood. */
  | { k: 'owlface'; x: number; y: number; size: number; mood: Mood }
  /** 15.17h: a banner's picture, size rows square: a badge with a pictogram (web/logos.ts). */
  | { k: 'badge'; x: number; y: number; size: number; kind: string; fg: C3; bg: C3 }
  /** A pair of the owl's eyes (Lookwise's pages: open on the page you are on). */
  | { k: 'eyes'; x: number; y: number; on: boolean }
  /** A forum's folder: lit for new posts. */
  | { k: 'folder'; x: number; y: number; lit: boolean }
  /** The power company's map of its sectors (cols x rows, row by row): lit or dark, with their codes. */
  | { k: 'sectors'; x: number; y: number; w: number; h: number; cols: number; on: boolean[]; labels: string[] }
  /** The GridLink mark in its negative (on the navy): GRID over LINK, the I's stem running down into the L; s pixels a bulb. */
  | { k: 'gridlink'; x: number; y: number; s: number };
/** What a front op weighs coming down the line (KB): the pictures come after the text, one by one. */
/** Whether a front op is a picture that has to come down the line (the others are drawn by the browser itself). */
export function opKb(o: HdOp): number {
  if (o.k === 'photo') return Math.max(4, Math.round(o.w * o.h * 0.6));
  if (o.k === 'map') return 12;
  if (o.k === 'ad') return 9;
  return 1;
}

export type Block =
  | { t: 'banner'; text: string; sub?: string; art?: string[]; /** 15.17f: the 2001 bevel or the Web 2.0 shine (the theme's by default). */ look?: 'bevel' | 'gloss' | 'flat';
    /** 15.17g: the tilted badge after the name ("beta"); the GridLink mark in place of the art. */ badge?: string;
    /** The GridLink mark, the mail's envelope, or (15.17h) a badge with a pictogram: 'portal', 'wire', 'board', or a kind of place (web/logos.ts). */ logo?: string }
  | { t: 'nav'; links: [string, string][]; look?: 'bevel' | 'gloss' | 'flat' }
  | { t: 'h'; text: string }
  | { t: 'p'; text: string; /** 15.17h: no blank line after it (a listing's lines). */ tight?: boolean }
  | { t: 'list'; items: string[] }
  | { t: 'table'; rows: string[][]; head?: boolean }
  | { t: 'cols'; cols: Block[][]; widths?: number[] }
  | { t: 'art'; lines: string[]; col?: C3 }
  /** A banner ad (15.17e: drawn, 468 x 60 in the column's proportion, with a blinking button): whose, its line, its colors (the theme's by default). */
  | { t: 'ad'; text: string; url: string; name?: string; c1?: C3; c2?: C3 }
  /** A line framed in a box, in the site's colors (an outage notice: the old text ad). */
  | { t: 'notice'; text: string; url?: string }
  /** 15.17e: a photo the column's width (or w cells), h rows tall, with a caption under it. */
  | { t: 'photo'; subj: PhotoSubj; seed: number; h?: number; w?: number; caption?: string; reflect?: boolean; center?: boolean; frame?: 'white' | 'line' | 'none' }
  /** A street map with pins (A, B, C...). */
  | { t: 'map'; seed: number; pins?: string[]; h?: number; ground?: string; gw?: number; gh?: number; spots?: [number, number][] }
  /** A rating: n of 5 stars, and a line after them. */
  | { t: 'stars'; n: number; text?: string }
  /** The "NEW!" starburst with a line beside it. */
  | { t: 'burst'; label: string; text: string; col?: C3 }
  /** The orange RSS icon and a link. */
  | { t: 'rss'; text: string }
  /** The Web 2.0 hero: a big headline and a line on the left, a photo with its reflection on the right, a glossy button. */
  | { t: 'hero'; title: string; sub?: string; subj: PhotoSubj; seed: number; btn?: [string, string] }
  /** The menu as tabs (the one at `on` is the page's). */
  | { t: 'tabs'; links: [string, string][]; on: number }
  /** A rounded box with a gradient title, its blocks inside. */
  | { t: 'box'; title: string; blocks: Block[]; /** 15.17g: Lookwise's owl before the title. */ owl?: boolean }
  /** The <marquee>: a line sliding right to left. */
  | { t: 'marquee'; text: string }
  /** 15.17f: a big title in pixels, `rows` tall: the 1998 WordArt or the Web 2.0 headline; centered or not. */
  | { t: 'big'; text: string; kind: 'word' | 'hero'; rows?: number; center?: boolean; col?: C3 }
  /** A rule: the 1998 rainbow, the 2001 groove, a dotted line. */
  | { t: 'rule'; kind: 'rainbow' | 'groove' | 'dots' }
  /** The <blink> tag: a line that blinks, centered. */
  | { t: 'blink'; text: string; col?: C3 }
  /** The picture that never loaded: a grey frame, the red X, its file name. */
  | { t: 'broken'; name: string; text?: string }
  /** The 2003 menu: bevelled buttons one under the other (the one at `on` pressed, the next lit as if the mouse were on it). */
  | { t: 'buttons'; links: [string, string][]; on: number }
  /** A glossy round icon with a title and a line beside it. */
  | { t: 'icon'; icon: 'star' | 'pin' | 'lock' | 'mail' | 'phone'; title: string; text: string }
  /** 15.17g: a post with its author's face: the line with the name, the words, the photo if any, a line under them. */
  | { t: 'avatar'; face: Face; title: string; text: string; photo?: { subj: PhotoSubj; seed: number }; foot?: string }
  /** The weather: its icon, a title and a line under it. */
  | { t: 'weather'; sky: Sky; title: string; text: string }
  /** A forum's row: the folder (lit for new posts), the title and a line under it, the counts on the right. */
  | { t: 'folder'; lit: boolean; title: string; text: string; right?: string }
  /** A forum's category bar: its name, the columns' names on the right. */
  | { t: 'catbar'; text: string; right?: string }
  /** The power company's map of its sectors. */
  | { t: 'sectors'; cols: number; on: boolean[]; labels: string[] }
  | { t: 'hr' }
  | { t: 'foot'; text: string }
  | { t: 'space' }
  /** A text box of the page's form (15.4): its label, the name it is sent by, and whether it shows stars. */
  | { t: 'input'; name: string; label: string; secret?: boolean; size?: number; /** Letters it takes (40). */ max?: number; /** What it holds when the page comes. */ value?: string }
  /** The form's button: Enter on it (or in a box) sends the boxes to the page's form. */
  | { t: 'submit'; label: string }
  /** 15.17h, Lookwise: its name with the owl's eyes, s pixels a bulb, centered or on the left. */
  | { t: 'lwlogo'; s: number; center?: boolean; mood?: Mood }
  /** A line of rich text centered in the column. */
  | { t: 'center'; text: string; col?: C3 }
  /** A search box in the middle and its buttons under it (the first sends the form; the others send it with their name set). */
  | { t: 'lookbox'; name: string; size: number; value?: string; buttons: [string, string?][] }
  /** The results' head: the small logo on the left, the box with the words searched, the button. */
  | { t: 'lookhead'; name: string; value: string; button: string }
  /** The owl's head on the left (rows tall) in a mood, lines of text beside it. */
  | { t: 'owl'; mood: Mood; rows: number; lines: string[]; /** The owl and its one line in the middle of the column. */ center?: boolean }
  /** A search result: the title (a link), the snippet with the words searched lit, a line under it. */
  | { t: 'hit'; title: string; url: string; snippet: string; terms: string[]; foot: string }
  /** Pages of results as pairs of eyes (the one you are on open), a number under each, and Next. */
  | { t: 'eyes'; pages: string[]; on: number; next?: string };

export interface Page {
  url: string; title: string; theme: Theme; blocks: Block[]; /** Its weight, for the time it takes to come down the line. */ kb: number;
  /** Where the page's boxes are sent (a page with input blocks has one). */
  form?: string;
  /** The site has a page made for phones (15.5): light and plain; without one a phone gets the whole page, squeezed. */
  mobile?: boolean;
}

export interface Cell { ch: string; fg: C3; bg: C3 }
export interface Link { x: number; y: number; w: number; url: string }
/** Where a text box landed (the browser writes what is typed into it). */
export interface Field { x: number; y: number; w: number; name: string; secret: boolean; max: number; /** What it holds when the page comes (15.17h). */ init?: string }
/** The url a submit button stands for, among the links. */
export const SUBMIT = 'submit:';
export interface Laid { rows: Cell[][]; links: Link[]; fields: Field[]; back: HdOp[]; front: HdOp[] }

type Seg = { text: string; url?: string };
/** A text box's paper and ink, the same on every site (the browser's own widget). */
const BOX: C3 = [255, 255, 255], BOX_FG: C3 = [0, 0, 0], AQUA: C3 = [40, 110, 210];
/** 15.17h: the grey of a form's plain button; the yellow the words searched are lit with; a result's address in green. */
const SOFT: C3 = [228, 228, 228], LIT: C3 = [255, 236, 140], URL_INK: C3 = [0, 128, 0];

/** Text with [label](url) links, as segments. */
export function segments(s: string): Seg[] {
  const out: Seg[] = [], re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let at = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > at) out.push({ text: s.slice(at, m.index) });
    out.push({ text: m[1], url: m[2] });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ text: s.slice(at) });
  return out;
}

/** Text without its links' markup (the labels stay). */
export const plain = (s: string) => segments(s).map((g) => g.text).join('');

/** Rich text wrapped at w letters: lines of segments (a link may break across lines). */
function wrapRich(s: string, w: number): Seg[][] {
  const words: Seg[] = [];
  for (const g of segments(s)) for (const [k, part] of g.text.split(' ').entries()) words.push({ text: (k ? ' ' : '') + part, url: g.url });
  const lines: Seg[][] = [[]];
  let n = 0;
  for (const word of words) {
    const t = word.text.startsWith(' ') && n === 0 ? word.text.slice(1) : word.text;
    if (n && n + t.length > w) { lines.push([]); n = 0; const u = t.replace(/^ /, ''); lines[lines.length - 1].push({ text: u, url: word.url }); n = u.length; continue; }
    lines[lines.length - 1].push({ text: t, url: word.url }); n += t.length;
  }
  return lines;
}

/** Lay page P out `width` cells wide (all of it on a phone's screen, `full`). */
export function layout(P: Page, width: number, full = false): Laid {
  const T = P.theme, rows: Cell[][] = [], links: Link[] = [], fields: Field[] = [], back: HdOp[] = [], front: HdOp[] = [];
  // a heading in the banner's color, unless that is the paper's (a white banner): then in its ink
  const near = (a: C3, b: C3) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 90, HEAD = near(T.head, T.bg) ? T.headFg : T.head;
  const blank = (bg: C3): Cell[] => Array.from({ length: width }, () => ({ ch: ' ', fg: T.fg, bg }));
  const row = (y: number, _bg?: C3) => { while (rows.length <= y) rows.push(blank(T.page)); return rows[y]; };
  const put = (x: number, y: number, s: string, fg: C3, bg: C3) => { const r = row(y, bg); for (let k = 0; k < s.length; k++) if (x + k >= 0 && x + k < width) r[x + k] = { ch: s[k], fg, bg }; };
  const fill = (x: number, y: number, w: number, bg: C3) => put(x, y, ' '.repeat(Math.max(0, w)), T.fg, bg);
  /** Rich text at (x, y), w wide, on bg: how many rows it took. */
  const rich = (x: number, y: number, w: number, s: string, fg: C3, bg: C3, indent = ''): number => {
    const L = wrapRich(s, w - indent.length);
    L.forEach((segs, k) => {
      fill(x, y + k, w, bg);
      let cx = x;
      if (indent) { put(cx, y + k, k ? ' '.repeat(indent.length) : indent, T.dim, bg); cx += indent.length; }
      for (const g of segs) {
        put(cx, y + k, g.text, g.url ? T.link : fg, bg);
        if (g.url) { const lead = g.text.length - g.text.trimStart().length; links.push({ x: cx + lead, y: y + k, w: g.text.trim().length, url: g.url }); }
        cx += g.text.length;
      }
    });
    return L.length;
  };
  const edges = (x: number, y0: number, y1: number, w: number) => { for (let k = y0; k < y1; k++) { fill(x, k, 2, T.bg); fill(x + w - 2, k, 2, T.bg); } };
  /** Blocks stacked in a column at x, w wide, from y: the row after them. */
  const column = (bs: Block[], x: number, w: number, y: number): number => {
    for (const B of bs) {
      switch (B.t) {
        case 'banner': {
          const h = Math.max(5, (B.art?.length ?? 0) + 2);
          for (let k = 0; k < h; k++) fill(x, y + k, w, T.head);
          const look = B.look ?? (T.gloss ? 'gloss' : 'flat');
          if (look === 'gloss') back.push({ k: 'gloss', x, y, w, h, col: T.head });
          else if (look === 'bevel') back.push({ k: 'bevel', x, y, w, h, col: T.head });
          const ax = x + 2;
          B.art?.forEach((l, k) => put(ax, y + 1 + k, l, T.headFg, T.head));
          if (B.logo === 'gridlink') front.push({ k: 'gridlink', x: ax, y: y + 0.6, s: 4 });
          if (B.logo && B.logo !== 'gridlink' && B.logo !== 'mail') front.push({ k: 'badge', x: ax, y: y + (h - 3) / 2, size: 3, kind: B.logo, fg: T.headFg, bg: T.head });
          if (B.logo === 'mail') front.push({ k: 'icon', x: ax, y: y + Math.floor(h / 2) - 1.2, kind: 'mail', col: [240, 170, 0] });
          const tx = x + (B.logo === 'gridlink' ? 24 : B.logo === 'mail' ? 8 : B.logo ? 10 : B.art ? Math.max(...B.art.map((l) => l.length)) + 5 : 3), spaced = B.text.toUpperCase().split('').join(' ');
          const big = spaced.length < w - tx + x - 2 ? spaced : B.text.toUpperCase(), ty = y + Math.floor(h / 2) - (B.sub ? 1 : 0);
          put(tx, ty, big, T.headFg, T.head);
          if (B.badge) front.push({ k: 'ribbon', x: tx + big.length + 3, y: ty + 0.5, text: B.badge, col: [230, 70, 30] });
          if (B.sub) put(tx, y + Math.floor(h / 2) + 1, B.sub, near(T.bar, T.head) ? T.headFg : T.bar, T.head);
          y += h;
          break;
        }
        case 'nav': {
          fill(x, y, w, T.bar);
          const look = B.look ?? (T.gloss ? 'gloss' : 'flat');
          if (look === 'gloss') back.push({ k: 'gloss', x, y, w, h: 1, col: T.bar });
          let cx = x + 2;
          for (const [label, url] of B.links) {
            // 2001: each link a bevelled button (the first pressed: the page you are on)
            if (look === 'bevel') back.push({ k: 'bevel', x: cx - 1, y, w: label.length + 2, h: 1, col: T.bar, down: cx === x + 2 });
            put(cx, y, label, T.barFg, T.bar);
            links.push({ x: cx, y, w: label.length, url });
            cx += label.length + 3;
            put(cx - 3, y, ' | ', T.barFg.map((c) => c * 0.6) as C3, T.bar);
          }
          put(cx - 3, y, '   ', T.barFg, T.bar);
          y += 2;
          break;
        }
        case 'h': fill(x, y, w, T.bg); put(x + 2, y, B.text, HEAD, T.bg); fill(x, y + 1, w, T.bg); put(x + 2, y + 1, '~'.repeat(Math.min(w - 4, B.text.length)), T.dim, T.bg); y += 2; break;
        // (the margins of the text's own rows in the paper too, not the page's color)
        case 'p': { const y0 = y; y += rich(x + 2, y, w - 4, B.text, T.fg, T.bg); edges(x, y0, y, w); if (!B.tight) { fill(x, y, w, T.bg); y += 1; } break; }
        case 'list': { const y0 = y; for (const it of B.items) y += rich(x + 2, y, w - 4, it, T.fg, T.bg, '* '); edges(x, y0, y, w); fill(x, y, w, T.bg); y += 1; break; }
        case 'table': {
          const n = Math.max(...B.rows.map((r) => r.length)), cw = Array.from({ length: n }, (_, c) => Math.max(...B.rows.map((r) => plain(r[c] ?? '').length)) + 3);
          B.rows.forEach((r, k) => {
            const bg: C3 = B.head && k === 0 ? T.bar : k % 2 ? T.bg : (T.bg.map((v) => Math.min(255, v + (v > 128 ? -10 : 12))) as C3);
            fill(x, y, w, T.bg); fill(x + 2, y, Math.min(w - 4, cw.reduce((a, b) => a + b, 0)), bg);
            let cx = x + 3;
            r.forEach((cell, c) => { rich(cx, y, cw[c], cell, B.head && k === 0 ? T.barFg : T.fg, bg); cx += cw[c]; });
            y++;
          });
          fill(x, y, w, T.bg); y++;
          break;
        }
        case 'cols': {
          const ws = B.widths ?? B.cols.map(() => 1 / B.cols.length);
          let cx = x, end = y;
          B.cols.forEach((C, k) => { const cw = k === B.cols.length - 1 ? x + w - cx : Math.floor(w * ws[k]); end = Math.max(end, column(C, cx, cw, y)); cx += cw; });
          // the shorter columns' paper down to the longest
          for (let yy = y; yy < end; yy++) for (let xx = x; xx < x + w; xx++) { const r = row(yy, T.bg); if (r[xx].bg === T.page) r[xx] = { ch: ' ', fg: T.fg, bg: T.bg }; }
          y = end;
          break;
        }
        case 'art': B.lines.forEach((l) => { fill(x, y, w, T.bg); put(x + 2, y, l, B.col ?? T.fg, T.bg); y++; }); break;
        case 'ad': {
          // the banner of 2008 (468 x 60): in the column's proportion, at most 58 cells by 4 rows
          const bw = Math.min(w - 4, 58), bx = x + Math.floor((w - bw) / 2);
          for (let k = 0; k < 6; k++) fill(x, y + k, w, T.bg);
          put(bx + bw - 13, y, 'Advertisement', T.dim, T.bg);
          front.push({ k: 'ad', x: bx, y: y + 1, w: bw, h: 3.75, name: B.name ?? B.text, slogan: B.name ? B.text : '', c1: B.c1 ?? T.head, c2: B.c2 ?? T.headFg });
          for (let k = 1; k < 5; k++) links.push({ x: bx, y: y + k, w: bw, url: B.url });
          y += 6;
          break;
        }
        case 'notice': {
          const t = ` ${B.text} `, bw = Math.min(w - 4, t.length + 4);
          fill(x, y, w, T.bg); put(x + 2, y, '+' + '-'.repeat(bw - 2) + '+', T.dim, T.bg);
          fill(x, y + 1, w, T.bg); put(x + 2, y + 1, '|', T.dim, T.bg); put(x + 3, y + 1, t.padEnd(bw - 2).slice(0, bw - 2), T.headFg, T.head); put(x + bw + 1, y + 1, '|', T.dim, T.bg);
          if (B.url) links.push({ x: x + 4, y: y + 1, w: Math.min(bw - 4, B.text.length), url: B.url });
          fill(x, y + 2, w, T.bg); put(x + 2, y + 2, '+' + '-'.repeat(bw - 2) + '+', T.dim, T.bg);
          fill(x, y + 3, w, T.bg);
          y += 4;
          break;
        }
        case 'photo': {
          // (a strip with no frame runs the column's whole width, as the 2003 sites' top picture did)
          const strip = B.frame === 'none', ph = B.h ?? 8, pw = strip ? w : Math.min(w - 4, B.w ?? Math.round(ph * 3.2)), px = strip ? x : B.center ? x + Math.floor((w - pw) / 2) : x + 2;
          for (let k = 0; k < ph + (B.reflect ? 3 : 1); k++) fill(x, y + k, w, T.bg);
          front.push({ k: 'photo', x: px, y, w: pw, h: ph, subj: B.subj, seed: B.seed, frame: B.frame === 'none' ? undefined : B.frame ?? 'white', reflect: B.reflect });
          y += ph + (B.reflect ? 3 : 1);
          if (B.caption) { y += rich(x + 2, y, w - 4, B.caption, T.dim, T.bg); fill(x, y, w, T.bg); y++; }
          break;
        }
        case 'map': {
          const mh = B.h ?? 8, mw = Math.min(w - 4, Math.round(mh * 3.4));
          for (let k = 0; k <= mh; k++) fill(x, y + k, w, T.bg);
          front.push({ k: 'map', x: x + 2, y, w: mw, h: mh, seed: B.seed, pins: B.pins ?? ['A'], ground: B.ground, gw: B.gw, gh: B.gh, spots: B.spots });
          y += mh + 1;
          break;
        }
        case 'stars': {
          fill(x, y, w, T.bg);
          front.push({ k: 'stars', x: x + 2, y, n: B.n });
          if (B.text) rich(x + 10, y, w - 12, B.text, T.fg, T.bg);
          fill(x, y + 1, w, T.bg);
          y += 2;
          break;
        }
        case 'burst': {
          for (let k = 0; k < 4; k++) fill(x, y + k, w, T.bg);
          front.push({ k: 'burst', x: x + 5, y: y + 1.6, text: B.label, col: B.col ?? [226, 30, 30] });
          rich(x + 11, y + 1, w - 13, B.text, T.fg, T.bg);
          y += 4;
          break;
        }
        case 'rss': fill(x, y, w, T.bg); front.push({ k: 'rss', x: x + 2, y }); rich(x + 5, y, w - 7, B.text, T.fg, T.bg); fill(x, y + 1, w, T.bg); y += 2; break;
        case 'hero': {
          const hh = 9, pw = Math.min(30, Math.floor(w * 0.42)), tw = w - pw - 8;
          for (let k = 0; k < hh; k++) fill(x, y + k, w, T.head);
          back.push({ k: 'fade', x, y, w, h: hh, c1: T.head, c2: T.head.map((v) => v * 0.55) as C3 });
          front.push({ k: 'big', x: x + 3, y: y + 1, text: B.title, size: 2, kind: 'hero', col: T.headFg });
          if (B.sub) rich(x + 3, y + 4, tw, B.sub, T.headFg, T.head);
          if (B.btn) {
            const [label, url] = B.btn, bw = label.length + 4;
            put(x + 3, y + 7, `  ${label}  `, [255, 255, 255], T.head);
            back.push({ k: 'btn', x: x + 3, y: y + 7, w: bw, col: [40, 150, 60] });
            links.push({ x: x + 3, y: y + 7, w: bw, url });
          }
          front.push({ k: 'photo', x: x + w - pw - 3, y: y + 1, w: pw, h: 5.4, subj: B.subj, seed: B.seed, reflect: true });
          y += hh + 1;
          fill(x, y - 1, w, T.bg);
          break;
        }
        case 'tabs': {
          fill(x, y, w, T.bg);
          let cx = x + 2;
          B.links.forEach(([label, url], i) => {
            const tw = label.length + 4, on = i === B.on;
            back.push({ k: 'tab', x: cx, y, w: tw, col: on ? T.bg : T.bar, on });
            put(cx + 2, y, label, on ? T.fg : T.barFg, on ? T.bg : T.bar);
            links.push({ x: cx + 2, y, w: label.length, url });
            cx += tw + 1;
          });
          y++;
          fill(x, y, w, T.bg);
          back.push({ k: 'hr', x, y: y - 0.5, w, kind: 'groove', col: T.bar });
          y++;
          break;
        }
        case 'box': {
          const y0 = y;
          fill(x, y, w, T.bg); put(x + (B.owl ? 6 : 3), y, B.title.toUpperCase(), T.headFg, T.head);
          if (B.owl) front.push({ k: 'owl', x: x + 3, y });
          // the box goes under what is inside it (its height is known after them)
          const at = back.length;
          y = column(B.blocks, x + 1, w - 2, y + 1);
          fill(x, y, w, T.bg);
          back.splice(at, 0, { k: 'box', x: x + 1, y: y0, w: w - 2, h: y - y0, fill: T.bg, stroke: T.dim, head: T.head });
          y++;
          break;
        }
        case 'marquee': fill(x, y, w, T.bg); front.push({ k: 'marquee', x: x + 2, y, w: w - 4, text: B.text, col: T.link }); fill(x, y + 1, w, T.bg); y += 2; break;
        case 'big': {
          // the bulb font at s pixels a bulb (6 s a letter with its gap): rows * 2 bulbs tall at most, narrower to fit
          const rows = B.rows ?? 3, s = Math.max(2, Math.min(Math.floor((rows * 16) / 8), Math.floor(((w - 4) * 8) / (6 * Math.max(1, B.text.length))))), tw = (B.text.length * 6 * s) / 8;
          for (let k = 0; k < rows; k++) fill(x, y + k, w, T.bg);
          front.push({ k: 'big', x: B.center ? x + (w - tw) / 2 : x + 2, y: y + (rows - (7 * s) / 16) / 2, text: B.text, size: (s * 8) / 16, kind: B.kind, col: B.col ?? T.head });
          y += rows;
          break;
        }
        case 'rule': fill(x, y, w, T.bg); back.push({ k: 'hr', x: x + 2, y, w: w - 4, kind: B.kind, col: T.dim }); y++; break;
        case 'blink': fill(x, y, w, T.bg); front.push({ k: 'blink', x: x + 2, y, w: w - 4, text: B.text, col: B.col ?? [255, 60, 60] }); y++; break;
        case 'broken': {
          const bw = 14, bh = 4;
          for (let k = 0; k <= bh; k++) fill(x, y + k, w, T.bg);
          back.push({ k: 'broken', x: x + 2, y, w: bw, h: bh });
          put(x + 5, y, B.name, T.dim, T.bg);
          if (B.text) rich(x + bw + 4, y, w - bw - 6, B.text, T.fg, T.bg);
          y += bh + 1;
          break;
        }
        case 'buttons': {
          B.links.forEach(([label, url], i) => {
            const col: C3 = i === B.on + 1 ? T.head.map((v) => Math.min(255, v + 50)) as C3 : T.head;
            fill(x, y, w, T.bg); put(x + 2, y, label.padEnd(w - 4).slice(0, w - 4), T.headFg, col);
            back.push({ k: 'bevel', x: x + 1, y, w: w - 2, h: 1, col, down: i === B.on });
            links.push({ x: x + 2, y, w: Math.min(w - 4, label.length), url });
            fill(x, y + 1, w, T.bg);
            y += 2;
          });
          break;
        }
        case 'icon': {
          fill(x, y, w, T.bg); fill(x, y + 1, w, T.bg);
          front.push({ k: 'icon', x: x + 1, y, kind: B.icon, col: T.link });
          put(x + 6, y, B.title, T.fg, T.bg);
          const n = rich(x + 6, y + 1, w - 8, B.text, T.dim, T.bg);
          y += Math.max(3, n + 2);
          fill(x, y - 1, w, T.bg);
          break;
        }
        case 'avatar': {
          // the face 4 x 2 cells (a square), the name's line beside it, the words under that
          const y0 = y, tx = x + 7, tw = w - 9;
          fill(x, y, w, T.bg);
          front.push({ k: 'face', x: x + 2, y, w: 4, h: 2, face: B.face });
          rich(tx, y, tw, B.title, T.dim, T.bg);
          y += 1;
          y += rich(tx, y, tw, B.text, T.fg, T.bg);
          if (B.photo) {
            for (let k = 0; k < 5; k++) fill(x, y + k, w, T.bg);
            front.push({ k: 'photo', x: tx, y: y + 0.3, w: 14, h: 4, subj: B.photo.subj, seed: B.photo.seed, frame: 'white' });
            y += 5;
          }
          if (B.foot) y += rich(tx, y, tw, B.foot, T.dim, T.bg);
          while (y < y0 + 3) { fill(x, y, w, T.bg); y++; }
          fill(x, y, w, T.bg); back.push({ k: 'hr', x: x + 2, y, w: w - 4, kind: 'dots', col: T.dim }); y++;
          break;
        }
        case 'weather': {
          fill(x, y, w, T.bg); fill(x, y + 1, w, T.bg);
          front.push({ k: 'wx', x: x + 1, y, sky: B.sky, bg: T.bg });
          put(x + 6, y, B.title, T.fg, T.bg);
          const n = rich(x + 6, y + 1, w - 8, B.text, T.dim, T.bg);
          y += Math.max(3, n + 2);
          fill(x, y - 1, w, T.bg);
          break;
        }
        case 'folder': {
          const bg: C3 = Math.floor(y / 2) % 2 ? T.bg : (T.bg.map((v) => Math.min(255, v + 8)) as C3), rw = B.right ? B.right.length + 2 : 0;
          fill(x, y, w, T.bg); fill(x + 1, y, w - 2, bg); fill(x, y + 1, w, T.bg); fill(x + 1, y + 1, w - 2, bg);
          front.push({ k: 'folder', x: x + 2, y, lit: B.lit });
          rich(x + 6, y, w - 8 - rw, B.title, T.fg, bg);
          rich(x + 6, y + 1, w - 8 - rw, B.text, T.dim, bg);
          if (B.right) put(x + w - rw, y, B.right, T.fg, bg);
          y += 2;
          break;
        }
        case 'catbar': {
          fill(x, y, w, T.bg); fill(x + 1, y, w - 2, T.bar);
          back.push({ k: 'gloss', x: x + 1, y, w: w - 2, h: 1, col: T.bar });
          put(x + 2, y, B.text.toUpperCase(), T.barFg, T.bar);
          if (B.right) put(x + w - B.right.length - 2, y, B.right, T.barFg, T.bar);
          y++;
          break;
        }
        case 'sectors': {
          // a square map: cols x rows boxes, each 6 cells by 3 rows
          const rws = Math.ceil(B.on.length / B.cols), mw = B.cols * 6, mh = rws * 3;
          for (let k = 0; k <= mh; k++) fill(x, y + k, w, T.bg);
          front.push({ k: 'sectors', x: x + 2, y, w: mw, h: mh, cols: B.cols, on: B.on, labels: B.labels });
          y += mh + 1;
          break;
        }
        case 'lwlogo': {
          const rows = Math.ceil((10 * B.s) / CH) + 1, lw = logoW(B.s) / CW;
          for (let k = 0; k < rows; k++) fill(x, y + k, w, T.bg);
          front.push({ k: 'lwlogo', x: B.center ? x + (w - lw) / 2 : x + 2, y: y + 0.5, s: B.s, mood: B.mood ?? 'idle' });
          y += rows;
          break;
        }
        case 'center': { const n = plain(B.text).length, cx = x + Math.max(1, Math.floor((w - n) / 2)); fill(x, y, w, T.bg); rich(cx, y, Math.min(n, w - 2), B.text, B.col ?? T.fg, T.bg); y++; break; }
        case 'lookbox': {
          const fw = Math.min(B.size, w - 6), bx = x + Math.floor((w - fw) / 2);
          fill(x, y, w, T.bg); put(bx, y, ' '.repeat(fw), BOX_FG, BOX);
          back.push({ k: 'field', x: bx, y, w: fw });
          fields.push({ x: bx + 1, y, w: fw - 1, name: B.name, secret: false, max: 60, init: B.value });
          fill(x, y + 1, w, T.bg); fill(x, y + 2, w, T.bg);
          const tw = B.buttons.reduce((n, [l]) => n + l.length + 4, -2);
          let cx = x + Math.floor((w - tw) / 2);
          for (const [label, name] of B.buttons) {
            put(cx, y + 2, ` ${label} `, BOX_FG, SOFT);
            back.push({ k: 'bevel', x: cx, y: y + 2, w: label.length + 2, h: 1, col: SOFT });
            links.push({ x: cx, y: y + 2, w: label.length + 2, url: SUBMIT + (name ?? '') });
            cx += label.length + 4;
          }
          fill(x, y + 3, w, T.bg);
          y += 4;
          break;
        }
        case 'lookhead': {
          // the logo 2 pixels a bulb (20 px: about a row and a half), the box after it
          const lw = Math.ceil(logoW(2) / CW) + 3, fw = Math.min(40, w - lw - B.button.length - 8), bx = x + 1 + lw;
          for (let k = 0; k < 3; k++) fill(x, y + k, w, T.bg);
          front.push({ k: 'lwlogo', x: x + 2, y: y + 0.3, s: 2, mood: 'found' });
          put(bx, y + 1, ' '.repeat(fw), BOX_FG, BOX);
          back.push({ k: 'field', x: bx, y: y + 1, w: fw });
          fields.push({ x: bx + 1, y: y + 1, w: fw - 1, name: B.name, secret: false, max: 60, init: B.value });
          const sx = bx + fw + 2;
          put(sx, y + 1, ` ${B.button} `, BOX_FG, SOFT);
          back.push({ k: 'bevel', x: sx, y: y + 1, w: B.button.length + 2, h: 1, col: SOFT });
          links.push({ x: sx, y: y + 1, w: B.button.length + 2, url: SUBMIT });
          y += 3;
          break;
        }
        case 'owl': {
          const rows = Math.max(B.rows, B.lines.length), ow = Math.ceil((B.rows * CH) / CW);
          for (let k = 0; k <= rows; k++) fill(x, y + k, w, T.bg);
          const ox = B.center ? x + Math.max(2, Math.floor((w - ow - 3 - Math.max(...B.lines.map((l) => plain(l).length))) / 2)) : x + 2;
          front.push({ k: 'owlface', x: ox, y, size: B.rows, mood: B.mood });
          B.lines.forEach((l, k) => rich(ox + ow + 3, y + k + Math.max(0, Math.floor((B.rows - B.lines.length) / 2)), w - ow - 7, l, k ? T.fg : HEAD, T.bg));
          y += rows + 1;
          break;
        }
        case 'hit': {
          const y0 = y, words = B.terms.filter((t) => t.length > 1);
          fill(x, y, w, T.bg); rich(x + 2, y, w - 4, `[${B.title}](${B.url})`, T.link, T.bg); y++;
          const n = rich(x + 2, y, w - 4, B.snippet, T.fg, T.bg);
          // the words searched, lit in the snippet (the whole word that starts with one)
          for (let k = 0; k < n; k++) {
            const r = row(y + k), line = r.slice(x + 2, x + w - 2).map((c) => c.ch).join('').toLowerCase();
            const re = /[a-z0-9]+/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(line))) if (words.some((t) => m![0].startsWith(t))) for (let j = 0; j < m[0].length; j++) r[x + 2 + m.index + j] = { ch: r[x + 2 + m.index + j].ch, fg: BOX_FG, bg: LIT };
          }
          y += n;
          y += rich(x + 2, y, w - 4, B.foot, URL_INK, T.bg);
          edges(x, y0, y, w); fill(x, y, w, T.bg); y++;
          break;
        }
        case 'eyes': {
          // a pair of eyes 3 cells wide a page, its number under it; Next after them
          const n = B.pages.length, pw = 4, tw = n * pw + (B.next ? 6 : 0);
          let cx = x + Math.max(2, Math.floor((w - tw) / 2));
          fill(x, y, w, T.bg); fill(x, y + 1, w, T.bg); fill(x, y + 2, w, T.bg);
          B.pages.forEach((u, i) => {
            front.push({ k: 'eyes', x: cx + 0.5, y, on: i === B.on });
            const lab = String(i + 1);
            put(cx + 1, y + 1, lab, i === B.on ? T.fg : T.link, T.bg);
            if (i !== B.on) links.push({ x: cx + 1, y: y + 1, w: lab.length, url: u });
            cx += pw;
          });
          if (B.next) { put(cx + 1, y + 1, 'Next', T.link, T.bg); links.push({ x: cx + 1, y: y + 1, w: 4, url: B.next }); }
          y += 3;
          break;
        }
        case 'hr': fill(x, y, w, T.bg); if (T.gloss) back.push({ k: 'hr', x: x + 1, y, w: w - 2, kind: 'groove', col: T.bar }); else put(x + 1, y, '-'.repeat(w - 2), T.dim, T.bg); y++; break;
        case 'foot': fill(x, y, w, T.bar); put(x + Math.max(1, Math.floor((w - B.text.length) / 2)), y, B.text.slice(0, w - 2), T.barFg, T.bar); y++; break;
        case 'space': fill(x, y, w, T.bg); y++; break;
        case 'input': {
          // a white box with a sunken edge, the label before it (above it in a narrow column, a phone's)
          const narrow = w < 60, fw = Math.min(B.size ?? 24, narrow ? w - 6 : w - B.label.length - 8);
          fill(x, y, w, T.bg); put(x + 2, y, B.label, T.fg, T.bg);
          if (narrow) { y++; fill(x, y, w, T.bg); }
          const bx = narrow ? x + 2 : x + 3 + Math.max(B.label.length, 16);
          // (a Web 2.0 site's box is sunken, in pixels; the older ones keep their brackets)
          const br = T.gloss ? [' ', ' '] : ['[', ']'];
          put(bx, y, br[0], T.dim, T.bg); put(bx + 1, y, ' '.repeat(fw), BOX_FG, BOX); put(bx + 1 + fw, y, br[1], T.dim, T.bg);
          if (T.gloss) back.push({ k: 'field', x: bx + 1, y, w: fw });
          fields.push({ x: bx + 1, y, w: fw, name: B.name, secret: !!B.secret, max: B.max ?? 40, init: B.value });
          fill(x, y + 1, w, T.bg);
          y += 2;
          break;
        }
        case 'submit': {
          // (the Web 2.0 button is the glossy pill, "aqua", in pixels)
          const t = T.gloss ? `  ${B.label}  ` : `[ ${B.label} ]`, bx = x + (w < 60 ? 2 : 3 + 16);
          fill(x, y, w, T.bg); put(bx, y, t, T.gloss ? [255, 255, 255] : T.barFg, T.gloss ? AQUA : T.bar);
          if (T.gloss) back.push({ k: 'btn', x: bx, y, w: t.length, col: AQUA });
          links.push({ x: bx, y, w: t.length, url: SUBMIT });
          fill(x, y + 1, w, T.bg);
          y += 2;
          break;
        }
      }
    }
    return y;
  };
  // a 2008 site: a fixed-width column in the middle of the page's own color
  const W = full ? width : Math.min(width - 4, 124), x0 = Math.floor((width - W) / 2);
  const end = column(P.blocks, x0, W, 1);
  row(end + 1, T.page);
  // round the column: the page's tile pattern, and the column's soft shadow on it
  if (T.tile && !full) {
    back.unshift({ k: 'tile', x: 0, y: 0, w: width, h: rows.length, col: T.page, kind: T.tile, x0, w0: W });
    back.push({ k: 'shadow', x: x0, y: 0, w: W, h: rows.length });
  }
  return { rows, links, fields, back, front };
}

/**
 * The page as a phone gets it (15.5), `width` cells wide: the columns one under the other, the menu
 * and the tables too wide for the screen as lines of text, the pictures that do not fit left out;
 * a site made for phones also leaves out its banner's picture and its ads, and weighs a fifth.
 */
export function mobilePage(P: Page, width: number): Page {
  const W = width - 4;
  const flat = (bs: Block[]): Block[] => bs.flatMap((B): Block[] => {
    switch (B.t) {
      case 'banner': return [{ t: 'foot', text: B.text.toUpperCase() }, ...(B.sub ? [{ t: 'p', text: B.sub } as Block] : [])];
      case 'nav': return [{ t: 'p', text: B.links.map(([l, u]) => `[${l}](${u})`).join(' | ') }];
      case 'cols': return flat(B.cols.flat());
      // (the phone paints no pixels yet, 15.17i: the ad as a line, the pictures left out, the rest as text)
      case 'ad': return P.mobile ? [] : [{ t: 'notice', text: B.name ? `${B.name}: ${B.text}` : B.text, url: B.url }];
      case 'hero': return [{ t: 'h', text: B.title }, ...(B.sub ? [{ t: 'p', text: B.sub } as Block] : [])];
      case 'photo': case 'map': case 'marquee': return B.t === 'marquee' ? [{ t: 'p', text: B.text }] : [];
      case 'stars': return [{ t: 'p', text: `${'*'.repeat(B.n)}${'.'.repeat(5 - B.n)} ${B.text ?? ''}` }];
      case 'big': return [{ t: 'h', text: B.text }];
      case 'rule': return [{ t: 'hr' }];
      case 'blink': return [{ t: 'p', text: B.text }];
      case 'broken': return B.text ? [{ t: 'p', text: B.text }] : [];
      case 'buttons': return [{ t: 'p', text: B.links.map(([l, u]) => `[${l}](${u})`).join(' | ') }];
      case 'icon': return [{ t: 'h', text: B.title }, { t: 'p', text: B.text }];
      case 'burst': return [{ t: 'p', text: `${B.label} ${B.text}` }];
      case 'avatar': return [{ t: 'p', text: B.title }, { t: 'p', text: B.text }, ...(B.foot ? [{ t: 'p', text: B.foot } as Block] : []), { t: 'hr' }];
      case 'weather': return [{ t: 'h', text: B.title }, { t: 'p', text: B.text }];
      case 'folder': return [{ t: 'p', text: `${B.lit ? '* ' : ''}${B.title} - ${B.text}` }];
      case 'catbar': return [{ t: 'foot', text: B.text.toUpperCase() }];
      case 'sectors': return [{ t: 'list', items: B.labels.map((l, i) => `${l}: ${B.on[i] ? 'normal' : 'OUTAGE'}`) }];
      case 'lwlogo': return [{ t: 'h', text: 'Lookwise' }];
      case 'center': return [{ t: 'p', text: B.text }];
      case 'lookbox': return [{ t: 'input', name: B.name, label: '', size: W - 6, value: B.value }, { t: 'submit', label: B.buttons[0][0] }];
      case 'lookhead': return [{ t: 'input', name: B.name, label: 'Lookwise', size: W - 6, value: B.value }, { t: 'submit', label: B.button }];
      case 'owl': return B.lines.map((l) => ({ t: 'p', text: l }) as Block);
      case 'hit': return [{ t: 'p', text: `[${B.title}](${B.url})` }, { t: 'p', text: B.snippet }];
      case 'eyes': return [{ t: 'p', text: [...B.pages.map((u, i) => (i === B.on ? String(i + 1) : `[${i + 1}](${u})`)), ...(B.next ? [`[Next](${B.next})`] : [])].join(' ') }];
      case 'rss': return [{ t: 'p', text: B.text }];
      case 'box': return [{ t: 'h', text: B.title }, ...flat(B.blocks)];
      case 'tabs': return [{ t: 'p', text: B.links.map(([l, u]) => `[${l}](${u})`).join(' | ') }];
      case 'art': return B.lines.every((l) => l.length <= W - 2) ? [B] : [];
      case 'table': {
        const n = Math.max(...B.rows.map((r) => r.length)), cw = Array.from({ length: n }, (_, c) => Math.max(...B.rows.map((r) => plain(r[c] ?? '').length)) + 3);
        if (cw.reduce((a, b) => a + b, 0) <= W - 2) return [B];
        const rows = B.head ? B.rows.slice(1) : B.rows;
        return [{ t: 'list', items: rows.map((r) => r.map((c) => c.trim()).filter(Boolean).join(' - ')) }];
      }
      default: return [B];
    }
  });
  return { ...P, blocks: flat(P.blocks), kb: P.mobile ? Math.max(2, Math.round(P.kb / 5)) : P.kb };
}
