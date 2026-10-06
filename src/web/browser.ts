/**
 * Lodestar, the notebook's web browser (15.1): a program that owns the whole console, like the
 * editor. A title bar, the address, the page laid out in colors, a status line with the transfer
 * and the keys. A page comes down the line as a 2008 one did: the host looked up, the connection
 * made, then the page drawn from the top as its bytes arrive, at the speed of the Wi-Fi it rides
 * (sim/wifi.ts through the notebook's card); no network, no page. Keys: F6 (or Ctrl+L) types an
 * address, the arrows scroll and Tab, Right and Left pick a link or a text box, Enter follows it,
 * Backspace goes back, F5 reloads, Home goes to the start page, F10 (or Ctrl+Q) closes it. In a text
 * box (15.4) the keys type into it, Backspace rubs out and Enter sends the page's form.
 */
import { Scr } from '../laptop/screen';
import { type World } from '../sim/world';
import { layout, SUBMIT, type C3, type Field, type Laid, type Link } from './page';
import { fetchUrl, portalUrl, searchUrl, type Fetched } from './sites';

/** What the browser needs of the machine: whether the network is up, and its speed (kbit/s). */
export type Net = () => { up: boolean; kbps: number };
const NAME = 'Lodestar 2.0';
/** Seconds to look a host up and to connect; how long a dead server is waited for. */
const LOOKUP = 0.5, CONNECT = 0.4, TIMEOUT = 8;

const CHROME: C3 = [212, 208, 200], CHROME_DK: C3 = [128, 124, 116], INK: C3 = [0, 0, 0], WHITE: C3 = [255, 255, 255], TITLE: C3 = [10, 36, 106], TITLE_FG: C3 = [255, 255, 255], ERR: C3 = [250, 250, 250];

export class Browser {
  url = '';
  private back: string[] = [];
  private got: Fetched | null = null;
  private laid: Laid | null = null;
  private at = 0;
  private kbps = 0;
  private offline = false;
  private top = 0;
  private sel = -1;
  /** What has been typed in the page's text boxes, by name. */
  private vals = new Map<string, string>();
  /** Typing an address: what is in the box. */
  editing = false;
  private addr = '';

  constructor(private world: World, private net: Net, private quit: () => void, private W: number, private H: number) {}

  /** Ask for `url` (the start page when empty). */
  go(url: string, now: number, remember = true, form?: Map<string, string>) {
    url = url.trim() || portalUrl(this.world);
    if (!/^https?:\/\//.test(url)) url = 'http://' + url;
    if (remember && this.url && this.url !== url) this.back.push(this.url);
    this.url = url; this.at = now; this.top = 0; this.sel = -1; this.editing = false; this.vals = new Map();
    const n = this.net();
    this.offline = !n.up; this.kbps = n.kbps;
    this.got = this.offline ? null : fetchUrl(this.world, url, form);
    this.laid = this.got?.page ? layout(this.got.page, this.W - 1) : null;
    if (this.got?.page) this.url = this.got.page.url;
    // a form's first box takes the keys at once, as the sign-in pages of 2008 did
    const I = this.items();
    if (I.length && this.laid?.fields.length) this.sel = I.findIndex((it) => 'name' in it);
  }

  /** What Tab goes through: the links and the text boxes, in reading order. */
  private items(): (Link | Field)[] {
    const L = this.laid;
    return L ? [...L.links, ...L.fields].sort((a, b) => a.y - b.y || a.x - b.x) : [];
  }

  /** Send the page's boxes to its form. */
  private submit(now: number) {
    const to = this.got?.page?.form;
    if (to) this.go(to, now, true, new Map(this.vals));
  }

  /** Where the page is in coming down: 0..1 of it arrived (1 also for an error shown), and what the status line says. */
  private progress(now: number): [number, string] {
    const t = now - this.at, G = this.got, host = G?.host ?? '';
    if (this.offline) return [1, 'Not connected: no network'];
    if (t < LOOKUP) return [0, `Looking up ${host}...`];
    if (G?.error === 'dns') return [1, 'Done'];
    if (t < LOOKUP + CONNECT) return [0, `Connecting to ${host}...`];
    if (G?.error === 'down') return t < LOOKUP + CONNECT + TIMEOUT ? [0, `Waiting for ${host}...`] : [1, 'Done'];
    const dur = ((G!.page!.kb * 8) / Math.max(1, this.kbps)), f = Math.min(1, (t - LOOKUP - CONNECT) / dur);
    return f < 1 ? [f, `Transferring data from ${host}... ${Math.floor(f * G!.page!.kb)} of ${G!.page!.kb} KB`] : [1, 'Done'];
  }

  key(key: string, ctrl: boolean, now: number) {
    const k = key.toLowerCase();
    if (key === 'F10' || (ctrl && k === 'q')) { this.quit(); return; }
    if (key === 'F6' || (ctrl && k === 'l')) { this.editing = true; this.addr = ''; return; }
    if (this.editing) {
      // words that are not an address are a search (as the browsers of 2008 did)
      if (key === 'Enter') this.go(/\s/.test(this.addr.trim()) || !this.addr.includes('.') && this.addr.trim() ? searchUrl(this.addr) : this.addr, now);
      else if (key === 'Backspace') this.addr = this.addr.slice(0, -1);
      else if (key.length === 1 && !ctrl && this.addr.length < 120) this.addr += key;
      return;
    }
    const L = this.items(), view = this.H - 4, rows = this.laid?.rows.length ?? 0, on = L[this.sel];
    const seen = () => { const y = L[this.sel]?.y ?? 0; if (y < this.top) this.top = y; if (y >= this.top + view) this.top = y - view + 1; };
    if (on && 'name' in on && key !== 'Tab' && !key.startsWith('Arrow') && !key.startsWith('Page') && !key.startsWith('F')) {
      const v = this.vals.get(on.name) ?? '';
      if (key === 'Enter') this.submit(now);
      else if (key === 'Backspace') this.vals.set(on.name, v.slice(0, -1));
      else if (key.length === 1 && !ctrl && v.length < on.max) this.vals.set(on.name, v + key);
      return;
    }
    if (key === 'F5' || (ctrl && k === 'r')) this.go(this.url, now, false);
    else if (key === 'Home') this.go('', now);
    else if (key === 'Backspace') { const u = this.back.pop(); if (u) this.go(u, now, false); }
    else if (key === 'ArrowDown') this.top = Math.min(Math.max(0, rows - view), this.top + 1);
    else if (key === 'ArrowUp') this.top = Math.max(0, this.top - 1);
    else if (key === 'PageDown' || key === ' ') this.top = Math.min(Math.max(0, rows - view), this.top + view - 2);
    else if (key === 'PageUp') this.top = Math.max(0, this.top - view + 2);
    else if ((key === 'Tab' || key === 'ArrowRight') && L.length) { this.sel = (this.sel + 1) % L.length; seen(); }
    else if (key === 'ArrowLeft' && L.length) { this.sel = (this.sel - 1 + L.length) % L.length; seen(); }
    else if (key === 'Enter' && on && 'url' in on) { if (on.url === SUBMIT) this.submit(now); else this.go(on.url, now); }
  }

  /** The whole screen now, and the cursor (in the address box while typing). */
  cells(now: number): { scr: Scr; cx: number; cy: number } {
    const W = this.W, H = this.H, S = new Scr(W, H, 0), view = H - 4;
    const [f, status] = this.progress(now), G = this.got;
    // the title bar and the address
    const title = G?.page && f >= 1 ? G.page.title : G?.error || this.offline ? 'Problem loading page' : 'Loading...';
    S.paint(0, 0, ` ${title} - ${NAME}`.padEnd(W).slice(0, W), TITLE_FG, TITLE);
    S.paint(0, 1, ' [<] [>] [R] [H]  Address '.padEnd(W), INK, CHROME);
    const shown = this.editing ? this.addr : this.url;
    S.paint(27, 1, ` ${shown}`.padEnd(W - 30).slice(0, W - 30), INK, WHITE);
    // the page, as much of it as has arrived
    if (this.laid && f > 0) {
      const R = this.laid.rows, upto = f >= 1 ? R.length : Math.floor(R.length * f), on = this.items()[this.sel];
      for (let r = 0; r < view; r++) {
        const y = this.top + r, row = R[y];
        if (!row || y >= upto) { S.paint(0, 2 + r, ' '.repeat(W - 1), INK, WHITE); continue; }
        for (let x = 0; x < W - 1; x++) {
          const c = row[x], hit = on && on.y === y && x >= on.x && x < on.x + on.w;
          S.paint(x, 2 + r, c.ch, hit && 'url' in on ? c.bg : c.fg, hit && 'url' in on ? c.fg : c.bg);
        }
        // what is typed in the boxes on this row (stars for a password)
        for (const F of this.laid.fields) {
          if (F.y !== y) continue;
          const v = this.vals.get(F.name) ?? '', t = (F.secret ? '*'.repeat(v.length) : v).slice(-(F.w - 1));
          S.paint(F.x, 2 + r, t.padEnd(F.w), INK, on === F ? [255, 255, 224] : WHITE);
        }
      }
      // the scroll bar
      const n = Math.max(1, R.length), bar = Math.max(1, Math.round((view * view) / Math.max(view, n))), at = Math.round(((view - bar) * this.top) / Math.max(1, n - view));
      for (let r = 0; r < view; r++) S.paint(W - 1, 2 + r, r >= at && r < at + bar ? '#' : ':', CHROME_DK, CHROME);
    } else {
      for (let r = 0; r < view; r++) S.paint(0, 2 + r, ' '.repeat(W), INK, f >= 1 && (G?.error || this.offline) ? ERR : WHITE);
      if (f >= 1 && (G?.error || this.offline)) {
        const lines = this.offline
          ? ['Unable to connect', '', 'The notebook is not connected to a network.', 'Join a wireless network first (iwlist, iwconfig, dhclient), then try again.']
          : G!.error === 'dns'
            ? ['Server not found', '', `${NAME} can't find the server at ${G!.host}.`, 'Check the address for typing errors such as ww.example.com instead of www.example.com.']
            : ['The connection has timed out', '', `The server at ${G!.host} is taking too long to respond.`, 'The site could be temporarily unavailable or too busy. Try again in a few moments.'];
        lines.forEach((l, k) => S.paint(8, 6 + k, l, k === 0 ? [140, 20, 20] : [40, 40, 40], ERR));
      }
    }
    // the status line and the keys
    S.paint(0, H - 2, ` ${status}`.padEnd(W), INK, CHROME);
    if (f < 1 && !this.offline && !G?.error) { const pw = 30, n = Math.floor(f * pw); S.paint(W - pw - 3, H - 2, `[${'#'.repeat(n)}${' '.repeat(pw - n)}]`, [10, 36, 106], CHROME); }
    S.paint(0, H - 1, ' F6 address or search   Enter follow   Tab/Right next link   Left previous   Backspace back   F5 reload   Home start page   F10 close'.padEnd(W).slice(0, W), CHROME_DK, CHROME);
    // the cursor: in the address box while typing, else at the end of the text box picked
    const F = this.items()[this.sel];
    if (!this.editing && F && 'name' in F && this.laid && f >= 1 && F.y >= this.top && F.y < this.top + view) {
      const n = Math.min(F.w - 1, (this.vals.get(F.name) ?? '').length);
      return { scr: S, cx: F.x + n, cy: 2 + F.y - this.top };
    }
    return { scr: S, cx: this.editing ? Math.min(W - 4, 28 + this.addr.length) : -1, cy: this.editing ? 1 : -1 };
  }
}
