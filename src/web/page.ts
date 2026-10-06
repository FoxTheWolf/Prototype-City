/**
 * A web page of the city (15.1): blocks a site is made of (a banner, a menu, headings, paragraphs,
 * lists, tables, columns, ASCII pictures, ad boxes), laid out into colored cells the width of the
 * browser, the way a 2008 site sat in a fixed-width column on a gray page. Links are written inside
 * the text as [label](url); the layout returns where each one landed, for the browser to pick.
 * Pure data and layout: no DOM, no simulation (sites.ts fills the pages from the city).
 */
export type C3 = [number, number, number];

/** A site's colors: the page, its text and links, the banner, the menu bar. */
export interface Theme { page: C3; bg: C3; fg: C3; dim: C3; link: C3; head: C3; headFg: C3; bar: C3; barFg: C3 }

export type Block =
  | { t: 'banner'; text: string; sub?: string; art?: string[] }
  | { t: 'nav'; links: [string, string][] }
  | { t: 'h'; text: string }
  | { t: 'p'; text: string }
  | { t: 'list'; items: string[] }
  | { t: 'table'; rows: string[][]; head?: boolean }
  | { t: 'cols'; cols: Block[][]; widths?: number[] }
  | { t: 'art'; lines: string[]; col?: C3 }
  | { t: 'ad'; text: string; url: string }
  | { t: 'hr' }
  | { t: 'foot'; text: string }
  | { t: 'space' }
  /** A text box of the page's form (15.4): its label, the name it is sent by, and whether it shows stars. */
  | { t: 'input'; name: string; label: string; secret?: boolean; size?: number }
  /** The form's button: Enter on it (or in a box) sends the boxes to the page's form. */
  | { t: 'submit'; label: string };

export interface Page {
  url: string; title: string; theme: Theme; blocks: Block[]; /** Its weight, for the time it takes to come down the line. */ kb: number;
  /** Where the page's boxes are sent (a page with input blocks has one). */
  form?: string;
}

export interface Cell { ch: string; fg: C3; bg: C3 }
export interface Link { x: number; y: number; w: number; url: string }
/** Where a text box landed (the browser writes what is typed into it). */
export interface Field { x: number; y: number; w: number; name: string; secret: boolean }
/** The url a submit button stands for, among the links. */
export const SUBMIT = 'submit:';
export interface Laid { rows: Cell[][]; links: Link[]; fields: Field[] }

type Seg = { text: string; url?: string };
/** A text box's paper and ink, the same on every site (the browser's own widget). */
const BOX: C3 = [255, 255, 255], BOX_FG: C3 = [0, 0, 0];

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

/** Lay page P out `width` cells wide. */
export function layout(P: Page, width: number): Laid {
  const T = P.theme, rows: Cell[][] = [], links: Link[] = [], fields: Field[] = [];
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
  /** Blocks stacked in a column at x, w wide, from y: the row after them. */
  const column = (bs: Block[], x: number, w: number, y: number): number => {
    for (const B of bs) {
      switch (B.t) {
        case 'banner': {
          const h = Math.max(5, (B.art?.length ?? 0) + 2);
          for (let k = 0; k < h; k++) fill(x, y + k, w, T.head);
          const ax = x + 2;
          B.art?.forEach((l, k) => put(ax, y + 1 + k, l, T.headFg, T.head));
          const tx = x + (B.art ? Math.max(...B.art.map((l) => l.length)) + 5 : 3), big = B.text.toUpperCase().split('').join(' ');
          put(tx, y + Math.floor(h / 2) - (B.sub ? 1 : 0), big.length < w - tx + x - 2 ? big : B.text.toUpperCase(), T.headFg, T.head);
          if (B.sub) put(tx, y + Math.floor(h / 2) + 1, B.sub, T.bar, T.head);
          y += h;
          break;
        }
        case 'nav': {
          fill(x, y, w, T.bar);
          let cx = x + 2;
          for (const [label, url] of B.links) {
            put(cx, y, label, T.barFg, T.bar);
            links.push({ x: cx, y, w: label.length, url });
            cx += label.length + 3;
            put(cx - 3, y, ' | ', T.barFg.map((c) => c * 0.6) as C3, T.bar);
          }
          put(cx - 3, y, '   ', T.barFg, T.bar);
          y += 2;
          break;
        }
        case 'h': fill(x, y, w, T.bg); put(x + 2, y, B.text, T.head, T.bg); fill(x, y + 1, w, T.bg); put(x + 2, y + 1, '~'.repeat(Math.min(w - 4, B.text.length)), T.dim, T.bg); y += 2; break;
        case 'p': y += rich(x + 2, y, w - 4, B.text, T.fg, T.bg); fill(x, y, w, T.bg); y += 1; break;
        case 'list': for (const it of B.items) y += rich(x + 2, y, w - 4, it, T.fg, T.bg, '* '); fill(x, y, w, T.bg); y += 1; break;
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
          const t = ` ${B.text} `, bw = Math.min(w - 4, t.length + 4);
          fill(x, y, w, T.bg); put(x + 2, y, '+' + '-'.repeat(bw - 2) + '+', T.dim, T.bg);
          fill(x, y + 1, w, T.bg); put(x + 2, y + 1, '|', T.dim, T.bg); put(x + 3, y + 1, t.padEnd(bw - 2).slice(0, bw - 2), T.headFg, T.head); put(x + bw + 1, y + 1, '|', T.dim, T.bg);
          links.push({ x: x + 4, y: y + 1, w: Math.min(bw - 4, B.text.length), url: B.url });
          fill(x, y + 2, w, T.bg); put(x + 2, y + 2, '+' + '-'.repeat(bw - 2) + '+', T.dim, T.bg);
          fill(x, y + 3, w, T.bg);
          y += 4;
          break;
        }
        case 'hr': fill(x, y, w, T.bg); put(x + 1, y, '-'.repeat(w - 2), T.dim, T.bg); y++; break;
        case 'foot': fill(x, y, w, T.bar); put(x + Math.max(1, Math.floor((w - B.text.length) / 2)), y, B.text.slice(0, w - 2), T.barFg, T.bar); y++; break;
        case 'space': fill(x, y, w, T.bg); y++; break;
        case 'input': {
          // a white box with a sunken edge, the label before it
          const fw = Math.min(B.size ?? 24, w - B.label.length - 8);
          fill(x, y, w, T.bg); put(x + 2, y, B.label, T.fg, T.bg);
          const bx = x + 3 + Math.max(B.label.length, 16);
          put(bx, y, '[', T.dim, T.bg); put(bx + 1, y, ' '.repeat(fw), BOX_FG, BOX); put(bx + 1 + fw, y, ']', T.dim, T.bg);
          fields.push({ x: bx + 1, y, w: fw, name: B.name, secret: !!B.secret });
          fill(x, y + 1, w, T.bg);
          y += 2;
          break;
        }
        case 'submit': {
          const t = `[ ${B.label} ]`;
          fill(x, y, w, T.bg); put(x + 3 + 16, y, t, T.barFg, T.bar);
          links.push({ x: x + 3 + 16, y, w: t.length, url: SUBMIT });
          fill(x, y + 1, w, T.bg);
          y += 2;
          break;
        }
      }
    }
    return y;
  };
  // a 2008 site: a fixed-width column in the middle of the page's own color
  const W = Math.min(width - 4, 124), x0 = Math.floor((width - W) / 2);
  const end = column(P.blocks, x0, W, 1);
  row(end + 1, T.page);
  return { rows, links, fields };
}
