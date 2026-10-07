/**
 * Ferret Mini, the phone's web browser (15.5; the Lodestar Mini renamed and given the manual's frame in
 * 15.17i, docs/identidade/ferret-manual.html part 11), a free app from the store: the city's web on a
 * 40-column screen (6 x 12 pixels a cell), over EDGE. A page comes down through the phone's radio (radio.ts), slow and out of
 * the prepaid bundle unless a Wi-Fi is joined; a site made for phones weighs a fifth of its page and
 * leaves its pictures out, the others come whole (pictures and all) squeezed into one column (page.ts
 * mobilePage), so they cost more, and before a heavy one comes over EDGE the browser says what it may
 * cost. The frame: the address on a thin earth-brown strip, the ferret a dot digging beside it. The
 * pages' pictures are painted by the notebook's 2D painter (web/ops.ts) and brought down to the phone's
 * HD pixels.
 * Keys: Up and Down go from link to link (scrolling when the next is out of sight), Left and Right a
 * screen up and down, OK follows a link or types into a box (multi-tap, OK to finish), the left soft
 * key opens Go to (type an address, words being a search, or pick a bookmark: the same ones the
 * notebook's Ferret comes with, 2026-10-07), the right one goes back (or leaves), * reloads, 0 the
 * start page. On the price question: the left soft key (or OK) goes on, the right one stays.
 */
import { type World } from '../sim/world';
import { fetchUrl, portalUrl, searchUrl, type Fetched } from '../web/sites';
import { layout, mobilePage, opKb, SUBMIT, type Field, type HdOp, type Laid, type Link } from '../web/page';
import { paintOps } from '../web/ops';
import { debugMarks, factoryMarks } from '../web/browser';
import { CH, CW } from '../web/chrome';
import { Img, Paint } from '../render/paint2d';
import { Editor } from './textinput';
import { type Radio } from './radio';
import { BUNDLES } from './ussd';
import { softKeys, type C3, type Lcd } from './lcd';
import { ptext, ptextW, SCR_H, SCR_W } from './pixui';
import { HITS, M, Y0, Y1 } from './pixpages';
import { artColors } from './hdicons';
import { type Key } from './phone';

/** The page on the phone (the manual): 40 columns of 6 x 12 pixels under the 16-pixel strip; the rows that fit. */
const COLS = 40, PX = 6, PY = 12, STRIP = 16, VIEW = Math.floor((Y1 - Y0 - STRIP) / PY);
/** Kilobytes of an answer that is only an error (no such host, a dead server). */
const ERR_KB = 0.5;
/** Over EDGE, a page heavier than this (KB) is asked about first. */
const ASK_KB = 30;
/** The frame's colors (the manual's): the earth strip and its cream letters, the question's box. */
const EARTH: C3 = [107, 74, 46], CREAM: C3 = [241, 228, 200], ASK_BG: C3 = [241, 243, 246], ASK_FG: C3 = [17, 17, 17];

/** A page ready to show: where, what came, how it is laid out on the phone, what it weighs coming down. */
interface Got { url: string; got: Fetched; laid: Laid | null; kb: number }
/** A page's pictures brought down to the phone's pixels: PX x PY per cell, RGBA, the back ones (under the text) and the front ones. */
interface Pix { rows: number; back: Uint8ClampedArray; front: Uint8ClampedArray }

export class WebApp {
  url = '';
  private back: string[] = [];
  private got: Fetched | null = null;
  private laid: Laid | null = null;
  private pix: Pix | null = null;
  private top = 0;
  private sel = -1;
  private vals = new Map<string, string>();
  /** Typing: into the address ('addr') or a box (its name), with the keypad's editor. */
  private edit: Editor | null = null;
  private editing = '';
  /** A heavy page waiting for a yes (its price asked over EDGE), and whether it goes in the history. */
  private ask: (Got & { remember: boolean }) | null = null;
  /** The Go to list open: the row picked (0 types an address, the others are the bookmarks). */
  private goSel = -1;

  constructor(private world: World, private radio: Radio, private online: () => boolean) {}

  /** Whether the keypad is being typed on (the phone is held higher). */
  get typing() { return !!this.edit; }

  /** The bookmarks in the Go to list (title, address). */
  private marks(): [string, string][] { return [...factoryMarks(this.world), ...debugMarks()]; }

  /** Opened from the menu: the page it was left on, or the start page. */
  open(now: number) { if (!this.url) this.go('', now, false); }

  go(url: string, now: number, remember = true, form?: Map<string, string>) {
    url = url.trim() || portalUrl(this.world);
    if (!/^https?:\/\//.test(url)) url = 'http://' + url;
    this.ask = null;
    if (!this.online()) {
      if (remember && this.url && this.url !== url) this.back.push(this.url);
      this.url = url; this.top = 0; this.sel = -1; this.vals = new Map(); this.got = null; this.laid = null; this.pix = null;
      return;
    }
    const got = fetchUrl(this.world, url, form), P = got.page ? mobilePage(got.page, COLS) : null, laid = P ? layout(P, COLS, true) : null;
    // a page made for phones is light; a whole one brings its pictures too
    const kb = P ? P.kb + (P.mobile ? 0 : (laid?.front ?? []).reduce((n, o) => n + opKb(o), 0)) : ERR_KB;
    const G: Got = { url: P ? P.url : url, got, laid, kb };
    if (this.radio.wifiKbps <= 0 && kb > ASK_KB) { this.ask = { ...G, remember }; return; }
    this.show(G, remember, now);
  }

  /** Show page G (its bytes start coming down now). */
  private show(G: Got, remember: boolean, now: number) {
    if (remember && this.url && this.url !== G.url) this.back.push(this.url);
    this.url = G.url; this.top = 0; this.sel = -1; this.vals = new Map();
    this.got = G.got; this.laid = G.laid; this.pix = null;
    for (const F of this.laid?.fields ?? []) if (F.init) this.vals.set(F.name, F.init);
    this.radio.fetch('web', G.kb, now);
    const I = this.items();
    if (this.laid?.fields.length) this.sel = I.findIndex((it) => 'name' in it);
  }

  /** What `kb` kilobytes of data cost, at the smallest bundle's price (dollars, never under a cent). */
  static price(kb: number) { const [bkb, cents] = BUNDLES[0]; return `$${Math.max(0.01, (kb * cents) / bkb / 100).toFixed(2)}`; }

  private items(): (Link | Field)[] {
    const L = this.laid;
    return L ? [...L.links, ...L.fields].sort((a, b) => a.y - b.y || a.x - b.x) : [];
  }

  /** How much of the page has come: 0..1, and whether the transfer failed (and why). */
  private progress(): [number, string] {
    const J = this.radio.job;
    if (!this.got) return [1, 'offline'];
    if (!J || J.what !== 'web') return [1, ''];
    if (J.state === 'nosignal') return [J.done / J.kb, 'nosignal'];
    if (J.state === 'nodata') return [J.done / J.kb, 'nodata'];
    return [J.state === 'done' ? 1 : J.done / J.kb, ''];
  }

  /** A key; null when it is the app's Back (to leave it). */
  key(k: Key, now: number): boolean | null {
    if (this.ask) {
      const A = this.ask;
      if (k === 'lsoft' || k === 'ok') { this.ask = null; this.show(A, A.remember, now); }
      else if (k === 'rsoft') this.ask = null;
      return true;
    }
    if (this.goSel >= 0) {
      const M = this.marks(), n = M.length + 1;
      if (k === 'up' || k === 'down') this.goSel = (this.goSel + (k === 'down' ? 1 : n - 1)) % n;
      else if (k === 'rsoft') this.goSel = -1;
      else if (k === 'ok' || k === 'lsoft' || /^[1-9]$/.test(k)) {
        const i = /^[1-9]$/.test(k) ? +k : this.goSel;
        if (i > n - 1) return true;
        this.goSel = -1;
        if (i === 0) { this.edit = new Editor(120, false, true); this.editing = 'addr'; }
        else this.go(M[i - 1][1], now);
      }
      return true;
    }
    if (this.edit) {
      const E = this.edit;
      if (k === 'ok' || k === 'lsoft') {
        const v = E.value().trim();
        this.edit = null;
        if (this.editing === 'addr') { if (v) this.go(/\s/.test(v) || !v.includes('.') ? searchUrl(v) : v, now); }
        else this.vals.set(this.editing, E.value());
        return true;
      }
      if (k === 'rsoft') { if (!E.del()) this.edit = null; return true; }
      return E.key(k, now);
    }
    const I = this.items(), on = I[this.sel], rows = this.laid?.rows.length ?? 0, maxTop = Math.max(0, rows - VIEW);
    const seen = (y: number) => y >= this.top && y < this.top + VIEW;
    if (k === 'lsoft') { this.goSel = 0; return true; }
    if (k === 'rsoft') { const u = this.back.pop(); if (!u) return null; this.go(u, now, false); return true; }
    if (k === '*') { this.go(this.url, now, false); return true; }
    if (k === '0') { this.go('', now); return true; }
    if (k === 'down' || k === 'up') {
      // the next link if it is in sight (or just below), else a few rows on
      const d = k === 'down' ? 1 : -1, n = I[this.sel + d] ?? (this.sel < 0 && d > 0 ? I.find((it) => it.y >= this.top) : undefined);
      if (n && (seen(n.y) || (d > 0 ? n.y < this.top + VIEW + 2 : n.y > this.top - 3))) {
        this.sel = I.indexOf(n);
        if (n.y < this.top) this.top = n.y; else if (n.y >= this.top + VIEW) this.top = n.y - VIEW + 1;
      } else {
        this.top = Math.max(0, Math.min(maxTop, this.top + d * 4));
        if (on && !seen(on.y)) this.sel = -1;
      }
      return true;
    }
    if (k === 'left' || k === 'right') { this.top = Math.max(0, Math.min(maxTop, this.top + (k === 'right' ? VIEW - 2 : 2 - VIEW))); if (on && !seen(on.y)) this.sel = -1; return true; }
    if (k === 'ok' && on) {
      if ('name' in on) { this.edit = new Editor(on.max, false, true); this.edit.set(this.vals.get(on.name) ?? ''); this.editing = on.name; }
      else if (on.url.startsWith(SUBMIT)) {
        const to = this.got?.page?.form, vals = new Map(this.vals), name = on.url.slice(SUBMIT.length);
        if (name) vals.set(name, '1');
        if (to) this.go(to, now, true, vals);
      }
      else this.go(on.url, now);
      return true;
    }
    return false;
  }

  /**
   * The page's pictures for the phone: its ops painted by the notebook's painter at the notebook's cell
   * size (CW x CH a cell), then brought down to the phone's (PX x PY a cell, a pixel drawn where at
   * least half of what it covers was).
   */
  private picture(L: Laid): Pix {
    const rows = L.rows.length, w = COLS * PX, h = rows * PY;
    const down = (ops: HdOp[]) => {
      const out = new Uint8ClampedArray(w * h * 4);
      if (!ops.length) return out;
      const img = new Img(COLS * CW, rows * CH), P = new Paint(img);
      paintOps(P, ops, 0, 0, 0);
      const sx = CW / PX, sy = CH / PY;
      for (let Y = 0; Y < h; Y++) for (let X = 0; X < w; X++) {
        let r = 0, g = 0, b = 0, n = 0, all = 0;
        for (let y = Math.floor(Y * sy); y < Math.floor((Y + 1) * sy); y++) for (let x = Math.floor(X * sx); x < Math.floor((X + 1) * sx); x++) {
          all++;
          const k = (y * img.w + x) * 4;
          if (img.px[k + 3]) { r += img.px[k]; g += img.px[k + 1]; b += img.px[k + 2]; n++; }
        }
        if (n * 2 < all) continue;
        const o = (Y * w + X) * 4;
        out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
      }
      return out;
    };
    return { rows, back: down(L.back), front: down(L.front) };
  }

  /** What the screen shows now (kept for the tests), and what paints it. */
  last: FerretMini | null = null;
  draw(S: Lcd, now: number): (Pt: Paint) => void {
    const [f, err] = this.progress(), loading = f < 1 && !err, J = this.radio.job;
    const addr = this.edit && this.editing === 'addr' ? `> ${this.edit.value()}${Math.floor(now * 2) & 1 ? '_' : ' '}` : this.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const d: FerretMini = { url: addr, right: loading ? (J?.state === 'connecting' ? 'Connecting' : `${Math.floor((J?.done ?? 0) + 0.5)}/${Math.ceil(J?.kb ?? 0)} KB`) : '', loading, now,
      rows: [], items: [], fields: [], pix: null, pixTop: this.top, pixFront: f >= 1, say: [], ask: null, go: null, bar: loading ? f : null };
    const L = this.laid, I = this.items(), on = I[this.sel];
    if (L && f > 0) {
      const upto = f >= 1 ? L.rows.length : Math.floor(L.rows.length * f);
      if (!this.pix) this.pix = this.picture(L);
      d.pix = this.pix;
      for (let r = 0; r < VIEW; r++) { const y = this.top + r; d.rows.push(y < upto ? L.rows[y] ?? null : null); }
      I.forEach((it, n) => {
        const r = it.y - this.top;
        if (r < 0 || r >= VIEW || it.y >= upto) return;
        d.items.push({ x: it.x, y: r, w: it.w, sel: n === this.sel, link: 'url' in it, pre: () => { this.sel = n; } });
      });
      for (const F of L.fields) {
        const r = F.y - this.top;
        if (r < 0 || r >= VIEW || F.y >= upto) continue;
        const live = this.edit && this.editing === F.name, v = live ? this.edit!.value() + (Math.floor(now * 2) & 1 ? '_' : ' ') : this.vals.get(F.name) ?? '';
        const secret = F.secret && !live ? '*'.repeat(v.length) : F.secret && live ? '*'.repeat(Math.max(0, v.length - 2)) + v.slice(-2) : v;
        d.fields.push({ x: F.x, y: r, w: F.w, text: secret.slice(-F.w), on: on === F });
      }
    }
    if (err === 'offline') d.say = ['No connection.', 'No network signal and no Wi-Fi.', '* to try again'];
    else if (err === 'nosignal') d.say = ['Connection lost.', 'The signal dropped.', '* to try again'];
    else if (err === 'nodata') d.say = ['Out of data.', 'Your data bundle is used up.', 'Dial *100# to buy more.'];
    else if (f >= 1 && this.got?.error && J?.what === 'web') d.say = this.got.error === 'dns' ? ['Server not found:', this.got.host] : ['The server is not responding:', this.got.host];
    if (this.ask) {
      // the price, before a heavy page comes over EDGE
      d.ask = [`This page is about ${Math.round(this.ask.kb)} KB`, `and may cost ${WebApp.price(this.ask.kb)} of data.`, 'Continue?'];
      softKeys(S, 'Yes', 'No');
    } else if (this.goSel >= 0) {
      // Go to: "Enter address" and the bookmarks, numbered for the keypad
      d.go = { rows: ['Enter address...', ...this.marks().map(([t]) => t)], sel: this.goSel, pick: (k) => { this.goSel = k; } };
      softKeys(S, 'Select', 'Cancel');
    } else if (this.edit) softKeys(S, 'OK', this.edit.value() ? 'Del' : 'Cancel');
    else softKeys(S, 'Go to', this.back.length ? 'Back' : 'Exit');
    this.last = d;
    return (Pt) => paintFerretMini(Pt, d);
  }
}

/** The page's cells and what goes over them, as the screen shows them now. */
export interface FerretMini {
  /** The earth strip: the address (or what is typed), how much has come, the ferret digging while it comes. */
  url: string; right: string; loading: boolean; now: number;
  /** The rows in sight (null: not come yet, or past the page). */
  rows: ({ ch: string; fg: C3; bg: C3 }[] | null)[];
  /** The links and boxes in sight (to touch, and the picked link drawn inverted), the boxes' contents. */
  items: { x: number; y: number; w: number; sel: boolean; link: boolean; pre: () => void }[];
  fields: { x: number; y: number; w: number; text: string; on: boolean }[];
  /** The page's pictures, the row they start at, and whether the ones over the text have come. */
  pix: Pix | null; pixTop: number; pixFront: boolean;
  say: string[]; ask: string[] | null; go: { rows: string[]; sel: number; pick: (k: number) => void } | null; bar: number | null;
}

/** Ferret Mini (the manual, part 11): the address on a thin earth strip, the page in cells of 6 x 12 under it, the price asked in a box, Go to over the page. */
export function paintFerretMini(P: Paint, d: FerretMini) {
  const top = Y0 + STRIP;
  P.rect(0, 0, SCR_W, Y1, [255, 255, 255]);
  // the strip, and the ferret's face beside the address: it peeks, and digs while the page comes
  P.rect(0, Y0, SCR_W, STRIP, EARTH);
  const art = artColors('web'), dy = d.loading ? [3, 5, 7, 5][Math.floor(d.now * 8) % 4] : 3;
  P.clip(0, Y0, SCR_W, top);
  art?.forEach((row, j) => row.forEach((c, i) => { if (c) P.rect(2 + i, Y0 + dy + j, 1, 1, c); }));
  P.clip(0, 0, SCR_W, SCR_H);
  const rw = d.right ? ptextW(d.right) + 6 : 0;
  ptext(P, 24, Y0 + 4, d.url.slice(-Math.floor((SCR_W - 28 - rw) / 6)), CREAM);
  if (d.right) ptext(P, SCR_W - 4 - ptextW(d.right), Y0 + 4, d.right, [200, 170, 130]);
  // the page, as the manual layers it: each cell's back, the pictures under the text (gloss, tabs),
  // the letters (the picked link inverted), then the pictures over empty cells (photos, ads)
  P.clip(0, top, SCR_W, Y1);
  const sel = d.items.find((it) => it.sel && it.link), inv = (r: number, x: number) => !!sel && sel.y === r && x >= sel.x && x < sel.x + sel.w;
  const pics = (buf: Uint8ClampedArray, emptyOnly: boolean) => {
    const w = COLS * PX, X = d.pix!;
    d.rows.forEach((row, r) => {
      if (!row) return;
      for (let iy = 0; iy < PY; iy++) {
        const Y = (d.pixTop + r) * PY + iy;
        if (Y >= X.rows * PY) return;
        for (let x = 0; x < w; x++) {
          const o = (Y * w + x) * 4;
          if (buf[o + 3] && !(emptyOnly && row[Math.floor(x / PX)]?.ch !== ' ')) P.s.set(x, top + r * PY + iy, buf[o], buf[o + 1], buf[o + 2]);
        }
      }
    });
  };
  d.rows.forEach((row, r) => row?.forEach((c, x) => { const bg = inv(r, x) ? c.fg : c.bg; if (bg[0] !== 255 || bg[1] !== 255 || bg[2] !== 255) P.rect(x * PX, top + r * PY, PX, PY, bg); }));
  if (d.pix) pics(d.pix.back, false);
  d.rows.forEach((row, r) => row?.forEach((c, x) => { if (c.ch !== ' ') ptext(P, x * PX, top + r * PY + 2, c.ch, inv(r, x) ? c.bg : c.fg); }));
  if (d.pix && d.pixFront) pics(d.pix.front, true);
  // the boxes, with what is typed in them
  for (const F of d.fields) {
    const y = top + F.y * PY;
    P.rect(F.x * PX, y, F.w * PX, PY, F.on ? [255, 255, 200] : [255, 255, 255]);
    P.rect(F.x * PX, y + PY - 1, F.w * PX, 1, [150, 150, 150]);
    ptext(P, F.x * PX + 1, y + 2, F.text, [0, 0, 0]);
  }
  for (const it of d.items) HITS.push({ x: it.x * PX - 2, y: top + it.y * PY - 2, w: it.w * PX + 4, h: PY + 4, pre: it.pre, key: it.sel ? 'ok' : undefined });
  P.clip(0, 0, SCR_W, SCR_H);
  if (d.say.length) {
    P.rect(0, top, SCR_W, Y1 - top, [255, 255, 255]);
    d.say.forEach((l, k) => ptext(P, M, top + 60 + k * 14, l.slice(0, 36), k ? [110, 110, 110] : [190, 40, 30], 1, !k));
  }
  // loading: the bar at the foot
  if (d.bar !== null) {
    const y = Y1 - 26;
    P.rect(0, y - 6, SCR_W, Y1 - y + 6, [255, 255, 255]);
    P.rect(10, y, SCR_W - 20, 8, [138, 146, 157]); P.rect(11, y + 1, SCR_W - 22, 6, [255, 255, 255]);
    P.rect(11, y + 1, Math.max(2, Math.round((SCR_W - 22) * Math.min(1, d.bar))), 6, [162, 122, 82]);
  }
  if (d.ask) {
    // the price: a box with the earth's border, Yes and No
    const x = 16, y = top + 110, w = SCR_W - 32, h = 98;
    P.rrect(x - 2, y - 2, w + 4, h + 4, 5, EARTH); P.rrect(x, y, w, h, 4, ASK_BG);
    d.ask.forEach((l, k) => ptext(P, x + 10, y + 12 + k * 16, l, ASK_FG, 1, !k));
    HITS.push({ x, y: y + h - 30, w: 70, h: 30, key: 'lsoft' }); HITS.push({ x: x + w - 70, y: y + h - 30, w: 70, h: 30, key: 'rsoft' });
    ptext(P, x + 10, y + h - 20, 'Yes', EARTH, 1, true); ptext(P, x + w - 10 - ptextW('No', 1, true), y + h - 20, 'No', EARTH, 1, true);
  }
  if (d.go) {
    // Go to, over the page: its title on the earth, the rows numbered for the keypad
    const x = 10, w = SCR_W - 20, rh = 24, h = 22 + d.go.rows.length * rh + 6, y = top + 8;
    P.rrect(x - 2, y - 2, w + 4, h + 4, 5, EARTH); P.rrect(x, y + 20, w, h - 20, 3, ASK_BG);
    ptext(P, x + 8, y + 6, 'Go to', CREAM, 1, true);
    d.go.rows.forEach((l, k) => {
      const ry = y + 22 + k * rh, picked = k === d.go!.sel;
      HITS.push({ x, y: ry, w, h: rh, pre: () => d.go!.pick(k), key: 'ok' });
      if (picked) P.rect(x, ry, w, rh, EARTH);
      if (k) ptext(P, x + 8, ry + 8, String(k), picked ? CREAM : [150, 120, 90], 1, true);
      ptext(P, x + 22, ry + 8, l.slice(0, 31), picked ? CREAM : k ? ASK_FG : EARTH, 1, !k);
    });
  }
}
