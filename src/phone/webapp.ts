/**
 * Ferret Mini, the phone's web browser (15.5; the Lodestar Mini renamed and given the manual's frame in
 * 15.17i, docs/identidade/ferret-manual.html part 11), a free app from the store: the city's web on a
 * 42-column screen, over EDGE. A page comes down through the phone's radio (radio.ts), slow and out of
 * the prepaid bundle unless a Wi-Fi is joined; a site made for phones weighs a fifth of its page and
 * leaves its pictures out, the others come whole (pictures and all) squeezed into one column (page.ts
 * mobilePage), so they cost more, and before a heavy one comes over EDGE the browser says what it may
 * cost. The frame: the address on a thin earth-brown strip, the ferret a dot digging beside it. The
 * pages' pictures are painted by the notebook's 2D painter (web/ops.ts) and brought down to the phone's
 * HD pixels.
 * Keys: Up and Down go from link to link (scrolling when the next is out of sight), Left and Right a
 * screen up and down, OK follows a link or types into a box (multi-tap, OK to finish), the left soft
 * key types an address (words are a search), the right one goes back (or leaves), * reloads, 0 the
 * start page. On the price question: the left soft key (or OK) goes on, the right one stays.
 */
import { type World } from '../sim/world';
import { fetchUrl, portalUrl, searchUrl, type Fetched } from '../web/sites';
import { layout, mobilePage, opKb, SUBMIT, type Field, type HdOp, type Laid, type Link } from '../web/page';
import { paintOps } from '../web/ops';
import { CH, CW } from '../web/chrome';
import { Img, Paint } from '../render/paint2d';
import { HD } from '../render/hd';
import { Editor } from './textinput';
import { type Radio } from './radio';
import { BUNDLES } from './ussd';
import { BAD, DIM, LCD, SH, softKeys, SW, type C3, type Lcd } from './lcd';
import { type Key } from './phone';

/** The page's rows on the screen: between the title (the address) and the soft keys. */
const TOP = 2, VIEW = SH - 3;
/** Kilobytes of an answer that is only an error (no such host, a dead server). */
const ERR_KB = 0.5;
/** Over EDGE, a page heavier than this (KB) is asked about first. */
const ASK_KB = 30;
/** The frame's colors (the manual's): the earth strip and its cream letters, the ferret's fur; the question's box. */
const EARTH: C3 = [107, 74, 46], CREAM: C3 = [241, 228, 200], FUR: C3 = [214, 170, 120], ASK_BG: C3 = [241, 243, 246], ASK_FG: C3 = [17, 17, 17];

/** A page ready to show: where, what came, how it is laid out on the phone, what it weighs coming down. */
interface Got { url: string; got: Fetched; laid: Laid | null; kb: number }
/** A page's pictures brought down to the phone's pixels: HD x HD per cell, RGBA, the back ones (under the text) and the front ones. */
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

  constructor(private world: World, private radio: Radio, private online: () => boolean) {}

  /** Whether the keypad is being typed on (the phone is held higher). */
  get typing() { return !!this.edit; }

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
    const got = fetchUrl(this.world, url, form), P = got.page ? mobilePage(got.page, SW) : null, laid = P ? layout(P, SW, true) : null;
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
    if (k === 'lsoft') { this.edit = new Editor(120, false, true); this.editing = 'addr'; return true; }
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
   * size (CW x CH a cell), then each cell's pixels averaged down to HD x HD (a pixel drawn where at least
   * half of what it covers was).
   */
  private picture(L: Laid): Pix {
    const rows = L.rows.length, w = SW * HD, h = rows * HD;
    const down = (ops: HdOp[]) => {
      const out = new Uint8ClampedArray(w * h * 4);
      if (!ops.length) return out;
      const img = new Img(SW * CW, rows * CH), P = new Paint(img);
      paintOps(P, ops, 0, 0, 0);
      const sx = CW / HD, sy = CH / HD;
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

  /** The title row: the earth strip with the address (or what is typed, or how much has come), the ferret a dot that digs. */
  private strip(S: Lcd, loading: boolean, now: number) {
    const J = this.radio.job;
    S.fill(1, EARTH);
    const text = this.edit && this.editing === 'addr' ? `> ${this.edit.value()}_`.slice(-(SW - 4)) : this.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const right = loading ? (J?.state === 'connecting' ? 'Connecting' : `${Math.floor((J?.done ?? 0) + 0.5)}/${Math.ceil(J?.kb ?? 0)} KB`) : '';
    S.text(3, 1, text.slice(0, SW - 4 - (right ? right.length + 1 : 0)), CREAM, EARTH);
    if (right) S.text(SW - right.length - 1, 1, right, [200, 170, 130], EARTH);
    // the ferret: a dot that bobs while it digs, still on top when the page is in
    const dy = loading ? [2, 1, 0, 1][Math.floor(now * 8) % 4] : 0;
    if (S.hd) for (const [ix, iy] of [[1, 0], [2, 0], [1, 1], [2, 1]]) S.pixel(0, 1, ix, Math.min(HD - 1, iy + dy), FUR[0], FUR[1], FUR[2]);
    else S.put(1, 1, loading ? '.:'.charCodeAt(Math.floor(now * 4) % 2) : 'o'.charCodeAt(0), FUR, EARTH);
  }

  draw(S: Lcd, now: number) {
    const [f, err] = this.progress();
    const loading = f < 1 && !err;
    this.strip(S, loading, now);
    const L = this.laid, on = this.items()[this.sel];
    if (L && f > 0) {
      const upto = f >= 1 ? L.rows.length : Math.floor(L.rows.length * f);
      if (S.hd && !this.pix) this.pix = this.picture(L);
      for (let r = 0; r < VIEW; r++) {
        const y = this.top + r, row = L.rows[y];
        if (!row || y >= upto) { S.fill(TOP + r, [255, 255, 255]); continue; }
        for (let x = 0; x < SW; x++) {
          const c = row[x], hit = on && 'url' in on && on.y === y && x >= on.x && x < on.x + on.w;
          S.put(x, TOP + r, c.ch.charCodeAt(0), hit ? c.bg : c.fg, hit ? c.fg : c.bg);
        }
        for (const F of L.fields) {
          if (F.y !== y) continue;
          const live = this.edit && this.editing === F.name, v = live ? this.edit!.value() + (Math.floor(now * 2) & 1 ? '_' : ' ') : this.vals.get(F.name) ?? '';
          const secret = F.secret && !live ? '*'.repeat(v.length) : F.secret && live ? '*'.repeat(Math.max(0, v.length - 2)) + v.slice(-2) : v;
          S.text(F.x, TOP + r, secret.slice(-F.w).padEnd(F.w), [0, 0, 0], on === F ? [255, 255, 200] : [255, 255, 255]);
        }
        // the pictures: what goes under the text as the text comes, the pictures once it has all come
        if (this.pix) this.pixRow(S, this.pix, y, TOP + r, f >= 1);
      }
    } else for (let r = 0; r < VIEW; r++) S.fill(TOP + r, LCD);
    const say = (lines: string[]) => lines.forEach((l, k) => S.text(1, 6 + k, l.slice(0, SW - 2), k ? DIM : BAD, LCD));
    if (err === 'offline') say(['No connection.', 'No network signal and no Wi-Fi.', '* to try again']);
    else if (err === 'nosignal') say(['Connection lost.', 'The signal dropped.', '* to try again']);
    else if (err === 'nodata') say(['Out of data.', 'Your data bundle is used up.', 'Dial *100# to buy more.']);
    else if (f >= 1 && this.got?.error && this.radio.job?.what === 'web') say(this.got.error === 'dns' ? ['Server not found:', this.got.host] : ['The server is not responding:', this.got.host]);
    if (this.ask) {
      // the price, before a heavy page comes over EDGE
      const lines = [`This page is about ${Math.round(this.ask.kb)} KB`, `and may cost ${WebApp.price(this.ask.kb)} of data.`, 'Continue?'], y0 = 8;
      for (let r = y0 - 1; r <= y0 + lines.length; r++) { S.fill(r, [255, 255, 255]); for (let x = 3; x < SW - 3; x++) S.put(x, r, 32, ASK_FG, ASK_BG); S.put(2, r, 32, EARTH, EARTH); S.put(SW - 3, r, 32, EARTH, EARTH); }
      for (let x = 2; x < SW - 2; x++) { S.put(x, y0 - 2, 32, EARTH, EARTH); S.put(x, y0 + lines.length + 1, 32, EARTH, EARTH); }
      lines.forEach((l, k) => S.text(5, y0 + k, l, ASK_FG, ASK_BG));
      softKeys(S, 'Yes', 'No');
      return;
    }
    if (this.edit) softKeys(S, 'OK', this.edit.value() ? 'Del' : 'Cancel');
    else softKeys(S, 'Go to', this.back.length ? 'Back' : 'Exit');
  }

  /** Page row y's pictures on screen row sy. */
  private pixRow(S: Lcd, X: Pix, y: number, sy: number, front: boolean) {
    const w = SW * HD;
    for (const [buf, under] of front ? [[X.back, true], [X.front, false]] as const : [[X.back, true]] as const) {
      for (let iy = 0; iy < HD; iy++) {
        const Y = y * HD + iy;
        for (let x = 0; x < w; x++) {
          const o = (Y * w + x) * 4;
          if (buf[o + 3]) S.pixel(Math.floor(x / HD), sy, x % HD, iy, buf[o], buf[o + 1], buf[o + 2], under);
        }
      }
    }
  }
}
