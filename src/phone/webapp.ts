/**
 * Lodestar Mini, the phone's web browser (15.5), a free app from the store: the city's web on a
 * 42-column screen, over EDGE. A page comes down through the phone's radio (radio.ts), slow and out
 * of the prepaid bundle unless a Wi-Fi is joined; a site made for phones weighs a fifth of its page,
 * the others come whole and are squeezed into one column (page.ts mobilePage), so they cost more.
 * Keys: Up and Down go from link to link (scrolling when the next is out of sight), Left and Right a
 * screen up and down, OK follows a link or types into a box (multi-tap, OK to finish), the left soft
 * key types an address (words are a search), the right one goes back (or leaves), * reloads, 0 the
 * start page.
 */
import { type World } from '../sim/world';
import { fetchUrl, portalUrl, searchUrl, type Fetched } from '../web/sites';
import { layout, mobilePage, SUBMIT, type Field, type Laid, type Link } from '../web/page';
import { Editor } from './textinput';
import { type Radio } from './radio';
import { BAD, DIM, LCD, SH, softKeys, SW, title, type Lcd } from './lcd';
import { type Key } from './phone';

/** The page's rows on the screen: between the title (the address) and the soft keys. */
const TOP = 2, VIEW = SH - 3;
/** Kilobytes of an answer that is only an error (no such host, a dead server). */
const ERR_KB = 0.5;

export class WebApp {
  url = '';
  private back: string[] = [];
  private got: Fetched | null = null;
  private laid: Laid | null = null;
  private top = 0;
  private sel = -1;
  private vals = new Map<string, string>();
  /** Typing: into the address ('addr') or a box (its name), with the keypad's editor. */
  private edit: Editor | null = null;
  private editing = '';

  constructor(private world: World, private radio: Radio, private online: () => boolean) {}

  /** Whether the keypad is being typed on (the phone is held higher). */
  get typing() { return !!this.edit; }

  /** Opened from the menu: the page it was left on, or the start page. */
  open(now: number) { if (!this.url) this.go('', now, false); }

  go(url: string, now: number, remember = true, form?: Map<string, string>) {
    url = url.trim() || portalUrl(this.world);
    if (!/^https?:\/\//.test(url)) url = 'http://' + url;
    if (remember && this.url && this.url !== url) this.back.push(this.url);
    this.url = url; this.top = 0; this.sel = -1; this.vals = new Map();
    if (!this.online()) { this.got = null; this.laid = null; return; }
    this.got = fetchUrl(this.world, url, form);
    const P = this.got.page ? mobilePage(this.got.page, SW) : null;
    this.laid = P ? layout(P, SW, true) : null;
    for (const F of this.laid?.fields ?? []) if (F.init) this.vals.set(F.name, F.init);
    if (P) this.url = P.url;
    this.radio.fetch('web', P ? P.kb : ERR_KB, now);
    const I = this.items();
    if (this.laid?.fields.length) this.sel = I.findIndex((it) => 'name' in it);
  }

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
      else if (on.url.startsWith(SUBMIT)) { const to = this.got?.page?.form; if (to) this.go(to, now, true, new Map(this.vals)); }
      else this.go(on.url, now);
      return true;
    }
    return false;
  }

  draw(S: Lcd, now: number) {
    const [f, err] = this.progress(), J = this.radio.job;
    const loading = f < 1 && !err;
    title(S, this.edit && this.editing === 'addr' ? `> ${this.edit.value()}_`.slice(-(SW - 2)) : loading ? `${J?.state === 'connecting' ? 'Connecting...' : `Loading ${Math.floor((J?.done ?? 0) + 0.5)}/${Math.ceil(J?.kb ?? 0)} KB`}` : (this.got?.page?.title ?? this.url.replace(/^http:\/\//, '')).slice(0, SW - 2), 1e9);
    const L = this.laid, on = this.items()[this.sel];
    if (L && f > 0) {
      const upto = f >= 1 ? L.rows.length : Math.floor(L.rows.length * f);
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
      }
    } else for (let r = 0; r < VIEW; r++) S.fill(TOP + r, LCD);
    const say = (lines: string[]) => lines.forEach((l, k) => S.text(1, 6 + k, l.slice(0, SW - 2), k ? DIM : BAD, LCD));
    if (err === 'offline') say(['No connection.', 'No network signal and no Wi-Fi.', '* to try again']);
    else if (err === 'nosignal') say(['Connection lost.', 'The signal dropped.', '* to try again']);
    else if (err === 'nodata') say(['Out of data.', 'Your data bundle is used up.', 'Dial *100# to buy more.']);
    else if (f >= 1 && this.got?.error && J?.what === 'web') say(this.got.error === 'dns' ? ['Server not found:', this.got.host] : ['The server is not responding:', this.got.host]);
    if (this.edit) softKeys(S, 'OK', this.edit.value() ? 'Del' : 'Cancel');
    else softKeys(S, 'Go to', this.back.length ? 'Back' : 'Exit');
  }
}
