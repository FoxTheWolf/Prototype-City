/**
 * Ferret, the notebook's web browser (15.1; the Lodestar renamed and given its frame in 15.17c, by the
 * manual docs/identidade/ferret-manual.html): a program that owns a pane of the console. The frame's
 * pixels (the tabs, the round back button, the address, the Lookwise box, the bookmarks, the status
 * line, the ferret digging in the corner) are painted on the screen's HD layer by chrome.ts; the text
 * is in the cells, as is the page, laid out in its own colors. A page comes down the line as a 2008
 * one did: the host looked up, the connection made, then the page drawn from the top as its bytes
 * arrive, at the speed of the Wi-Fi it rides (sim/wifi.ts through the notebook's card); no network, no page.
 *
 * Keys: F6 (or Ctrl+L) types an address, Ctrl+K a search, the arrows scroll, Tab/Right and Left pick a
 * link or a text box, Enter follows it, Backspace goes back, F5 reloads, Home goes to the start page,
 * Ctrl+T opens a tab, Ctrl+Tab goes to the next, Ctrl+W closes one, Ctrl+D bookmarks the page, F10 (or
 * Ctrl+Q) closes the browser. In a text box (15.4) the keys type into it and Enter sends the page's form.
 * The bookmarks and the history are files on the notebook's disk (~/.ferret), so the save keeps them.
 */
import { Scr } from '../laptop/screen';
import { type World } from '../sim/world';
import { layout, opKb, SUBMIT, type C3, type Field, type HdOp, type Laid, type Link } from './page';
import { animated, paintOps, type OwlCtx } from './ops';
import { CH, CW } from './chrome';
import { certExpiry, fetchUrl, portalUrl, searchUrl, SEARCH_HOST, webOf, type Fetched } from './sites';
import { mailHost } from './webmail';
import { WIRE_HOST } from './streetwire';
import { GRID_HOST } from './gridlink';
import { FORUM_HOST } from './forum';
import { BURROW_HOST } from './burrow';
import { DEBUG } from '../debug';
import { ADDR_X, addrEnd, BACK, FWD, HOME, iconOf, MARKS_Y, NAV_TEXT_Y, NAV_Y, PAGE_Y, TAB_ROW, FR, RELOAD, SEARCH_W, searchX, TAB_TEXT, TAB_TEXT_W, TAB_W, TAB_X, paintChrome, type ChromeState, type FerretState, type Icon } from './chrome';
import { hash3 } from '../core/rng';
import { type Paint } from '../render/paint2d';

/** What the browser needs of the machine: whether the network is up, and its speed (kbit/s). */
export type Net = () => { up: boolean; kbps: number };
/** Its files on the notebook's disk (bookmarks, history), by name; none in a test. */
export interface Files { read(name: string): string | null; write(name: string, text: string): void }
/** The frame's pixels for the screen's HD layer: what they show (a key that changes when they do) and how to paint them. */
export interface Art { key: string; paint(P: Paint, ox: number): void }
export const NAME = 'Ferret 2.0';
/** Seconds to look a host up and to connect; how long a dead server is waited for. */
const LOOKUP = 0.5, CONNECT = 0.4, TIMEOUT = 8;
/** The ferret: frames a second digging; how long it takes to come out; how long it looks round when lost. */
const DIG_FPS = 8, OUT_S = 0.75, LOST_S = 1.5;
const HISTORY_MAX = 300;
/** The error page's words start this many cells in (the lost ferret is on their left). */
export const ERR_X = 22;

const INK: C3 = [0, 0, 0], WHITE: C3 = [255, 255, 255], ERR: C3 = [250, 250, 250], VISITED: C3 = [85, 26, 139];
const TAB_BG: C3 = [208, 192, 158], NAV_BG: C3 = [240, 230, 210], MARK_BG: C3 = [239, 228, 204], STATUS_BG: C3 = [228, 216, 190], GREY: C3 = [160, 148, 128];

/** One tab: its page and where it is in it, its own back and forward. */
interface Tab {
  url: string;
  back: string[];
  fwd: string[];
  got: Fetched | null;
  laid: Laid | null;
  at: number;
  kbps: number;
  offline: boolean;
  top: number;
  sel: number;
  vals: Map<string, string>;
}
const blank = (): Tab => ({ url: '', back: [], fwd: [], got: null, laid: null, at: -1e9, kbps: 0, offline: false, top: 0, sel: -1, vals: new Map() });

/** The bookmarks a new Ferret (and the Ferret Mini) comes with: the search, the mail, the city's portal, the maker's help (never the forum). */
export function factoryMarks(w: World): [string, string][] {
  return [['Lookwise', `http://${SEARCH_HOST}/`], ['Mail', `http://${mailHost(w)}/`], [siteTitle(webOf(w).portal), portalUrl(w)], ['Ferret Help', `http://${BURROW_HOST}/`]];
}
const siteTitle = (host: string) => host.replace(/^www\./, '').replace(/\.(com|net|org)$/, '').replace(/^\w/, (c) => c.toUpperCase());
/** (Debug, DEBUG.webMarks) The canonical sites a click away, marked '(dbg)'. */
export function debugMarks(): [string, string][] {
  return DEBUG.webMarks ? [['(dbg) Streetwire', `http://${WIRE_HOST}/`], ['(dbg) GridLink', `http://${GRID_HOST}/`], ['(dbg) Switchboard', `http://${FORUM_HOST}/`]] : [];
}

export class Browser {
  private tabs: Tab[] = [blank()];
  private cur = 0;
  /** Typing an address (or a search, in the Lookwise box). */
  editing: false | 'addr' | 'search' = false;
  private addr = '';
  /** The bookmarks (title, address) and the addresses seen (the history: visited links are purple). */
  private marks: [string, string][];
  private seen: Set<string>;
  /** Hosts whose lapsed certificate the player let through (Add Exception..., 15.17d), kept on the disk. */
  private trusted: Set<string>;
  /** The error page's buttons on screen (cells in the pane), for a click. */
  private errBtns: { x: number; y: number; w: number; act: () => void }[] = [];
  /** Sounds for the notebook to play: the back button's thump, a tab's click. */
  readonly sfx: ('thump' | 'tick')[] = [];

  constructor(private world: World, private net: Net, private quit: () => void, private W: number, private H: number, private files: Files | null = null) {
    const m = files?.read('bookmarks');
    this.marks = m === null || m === undefined ? this.factoryMarks() : m.split('\n').filter((l) => l.includes('\t')).map((l) => l.split('\t') as [string, string]);
    // (debug) the canonical sites a click away, added once if missing
    for (const [t, u] of debugMarks()) if (!this.marks.some(([, x]) => x === u)) this.marks.push([t, u]);
    this.seen = new Set((files?.read('history') ?? '').split('\n').filter(Boolean));
    this.trusted = new Set((files?.read('exceptions') ?? '').split('\n').filter(Boolean));
  }

  /** The current page's address (the tab in front). */
  get url() { return this.T.url; }
  private get T() { return this.tabs[this.cur]; }
  private get view() { return this.H - PAGE_Y - 1; }

  /** The bookmarks a new Ferret comes with: the search, the mail, the city's portal (never the forum). */
  private factoryMarks(): [string, string][] { return factoryMarks(this.world); }

  /** The page's pictures in the order they come down (top first), and what they weigh (KB) together. */
  private items(T: Tab): HdOp[] { return T.laid ? [...T.laid.front].sort((a, b) => a.y - b.y) : []; }
  private itemsKb(T: Tab) { return this.items(T).reduce((n, o) => n + opKb(o), 0); }
  /** How many of the page's pictures have come (after the text), at overall progress f. */
  private arrived(T: Tab, f: number): number {
    const kb = T.got?.page?.kb ?? 0, I = this.items(T), total = kb + this.itemsKb(T);
    let got = f * total - kb, n = 0;
    for (const o of I) { got -= opKb(o); if (got < 0) break; n++; }
    return f >= 1 ? I.length : n;
  }

  /** The pane's size changed (the window manager, 15.7): re-lay the current page to the new width, keeping its state. */
  resize(w: number, h: number) {
    if (w === this.W && h === this.H) return;
    this.W = w; this.H = h;
    for (const T of this.tabs) {
      T.laid = T.got?.page ? layout(T.got.page, w - 1) : null;
      T.top = Math.max(0, Math.min(T.top, Math.max(0, (T.laid?.rows.length ?? 0) - this.view)));
    }
  }

  /** Scroll the page by d rows (the mouse wheel, 15.7). */
  scroll(d: number) {
    const T = this.T, rows = T.laid?.rows.length ?? 0;
    T.top = Math.max(0, Math.min(Math.max(0, rows - this.view), T.top + d));
  }

  /** A click at (x, y) in the browser's own pane (the window manager maps it, 15.7). */
  click(x: number, y: number, now: number) {
    if (y < NAV_Y) {
      // a tab: its close box, or picking it; the "+" after the last
      const i = Math.floor((x - 1) / TAB_W), off = x - 1 - i * TAB_W;
      if (i >= 0 && i < this.tabs.length) { if (i === this.cur && off === TAB_X) this.closeTab(); else if (i !== this.cur) { this.cur = i; this.sfx.push('tick'); } }
      else if (i === this.tabs.length && off >= 0 && off < 3) this.newTab(now);
      return;
    }
    if (y >= NAV_Y && y < MARKS_Y) {
      const on = ([a, b]: [number, number]) => x >= a && x < b;
      this.editing = false;
      if (on(BACK)) this.goBack(now);
      else if (on(FWD)) this.goFwd(now);
      else if (on(RELOAD)) { if (this.loading(now)) this.stop(); else this.go(this.url, now, false); }
      else if (on(HOME)) this.go('', now);
      else if (x >= addrEnd(this.W) - 3 && x < addrEnd(this.W)) this.toggleMark();
      else if (x >= ADDR_X && x < addrEnd(this.W)) { this.editing = 'addr'; this.addr = this.url; }
      else if (x >= searchX(this.W) && x < searchX(this.W) + SEARCH_W) { this.editing = 'search'; this.addr = ''; }
      return;
    }
    if (y === MARKS_Y) {
      let mx = 1;
      for (const [title, url] of this.marks) { const w = Math.min(18, title.length); if (x >= mx && x < mx + 3 + w) { this.go(url, now); return; } mx += w + 5; }
      return;
    }
    const eb = this.errBtns.find((b) => b.y === y && x >= b.x && x < b.x + b.w);
    if (eb) { eb.act(); return; }
    if (y >= PAGE_Y && y < PAGE_Y + this.view) {
      const T = this.T, py = T.top + (y - PAGE_Y), L = this.picks();
      const on = L.find((it) => it.y === py && x >= it.x && x < it.x + it.w);
      this.editing = false;
      if (!on) return;
      T.sel = L.indexOf(on);
      if ('url' in on) { if (on.url.startsWith(SUBMIT)) this.submit(now, on.url.slice(SUBMIT.length)); else this.go(on.url, now); }
      // a text box: picking it (sel) is enough; keys and a paste now go into it
    }
  }

  /** Drop text into the address box or the focused text box (paste, 15.7c). */
  paste(text: string) {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (this.editing) { this.addr = (this.addr + t).slice(0, 120); return; }
    const on = this.picks()[this.T.sel];
    if (on && 'name' in on) { const v = this.T.vals.get(on.name) ?? ''; this.T.vals.set(on.name, (v + t).slice(0, on.max)); }
  }

  /** Ask for `url` (the start page when empty), in the tab in front. */
  go(url: string, now: number, remember = true, form?: Map<string, string>) {
    const T = this.T;
    url = url.trim() || portalUrl(this.world);
    if (!/^https?:\/\//.test(url)) url = 'http://' + url;
    if (remember && T.url && T.url !== url) { T.back.push(T.url); T.fwd = []; }
    T.url = url; T.at = now; T.top = 0; T.sel = -1; T.vals = new Map();
    this.editing = false;
    const n = this.net();
    T.offline = !n.up; T.kbps = n.kbps;
    T.got = T.offline ? null : fetchUrl(this.world, url, form);
    T.laid = T.got?.page ? layout(T.got.page, this.W - 1) : null;
    for (const F of T.laid?.fields ?? []) if (F.init) T.vals.set(F.name, F.init);
    if (T.got?.page) { T.url = T.got.cert ? T.got.page.url.replace(/^http:/, 'https:') : T.got.page.url; this.remember(T.url); }
    else if (T.got?.cert) T.url = T.url.replace(/^http:/, 'https:');
    // a form's first box takes the keys at once, as the sign-in pages of 2008 did
    const I = this.picks();
    if (I.length && T.laid?.fields.length) T.sel = I.findIndex((it) => 'name' in it);
  }
  private goBack(now: number) { const T = this.T, u = T.back.pop(); if (u === undefined) return; T.fwd.push(T.url); this.go(u, now, false); this.sfx.push('thump'); }
  private goFwd(now: number) { const T = this.T, u = T.fwd.pop(); if (u === undefined) return; T.back.push(T.url); this.go(u, now, false); }
  /** Stop a page coming down: what has arrived is all there is (an error page stays as it was). */
  private stop() { const T = this.T; T.at = -1e9; }
  private newTab(now: number) { this.tabs.push(blank()); this.cur = this.tabs.length - 1; this.sfx.push('tick'); this.go('', now); }
  private closeTab() {
    if (this.tabs.length === 1) { this.quit(); return; }
    this.tabs.splice(this.cur, 1);
    this.cur = Math.min(this.cur, this.tabs.length - 1);
    this.sfx.push('tick');
  }

  /** An address seen goes in the history (kept on the disk, the newest last). */
  private remember(url: string) {
    if (this.seen.has(url)) return;
    this.seen.add(url);
    if (this.seen.size > HISTORY_MAX) this.seen.delete(this.seen.values().next().value!);
    this.files?.write('history', [...this.seen].join('\n'));
  }
  /** Bookmark the page in front, or take its bookmark away. */
  private toggleMark() {
    const T = this.T, i = this.marks.findIndex(([, u]) => u === T.url);
    if (i >= 0) this.marks.splice(i, 1);
    else if (T.url) this.marks.push([T.got?.page?.title ?? siteTitle(T.got?.host ?? T.url), T.url]);
    this.files?.write('bookmarks', this.marks.map(([t, u]) => `${t.replace(/\t/g, ' ')}\t${u}`).join('\n'));
  }

  /** What Tab goes through: the links and the text boxes, in reading order. */
  private picks(): (Link | Field)[] {
    const L = this.T.laid;
    return L ? [...L.links, ...L.fields].sort((a, b) => a.y - b.y || a.x - b.x) : [];
  }

  /** Send the page's boxes to its form (with the button's name set, when it has one: Owl's Pick). */
  private submit(now: number, name = '') {
    const to = this.T.got?.page?.form, vals = new Map(this.T.vals);
    if (name) vals.set(name, '1');
    if (to) this.go(to, now, true, vals);
  }

  /** Where the tab's page is in coming down: 0..1 of it arrived (1 also for an error shown), what the status line says, and when it ended. */
  private progress(now: number, T = this.T): [number, string, number] {
    const t = now - T.at, G = T.got, host = G?.host ?? '';
    if (T.offline) return [1, 'Not connected: no network', T.at];
    if (!G) return [1, 'Done', T.at];
    if (t < LOOKUP) return [0, `Looking up ${host}...`, 0];
    if (G.error === 'dns') return [1, 'Done', T.at + LOOKUP];
    if (t < LOOKUP + CONNECT) return [0, `Connecting to ${host}...`, 0];
    // (a server that thinks first: Lookwise searching, its owl at work on the empty page)
    const think = G.think ?? 0;
    if (t < LOOKUP + CONNECT + think) return [0, `Waiting for ${host}...`, 0];
    if (G.error === 'down') return t < LOOKUP + CONNECT + TIMEOUT ? [0, `Waiting for ${host}...`, 0] : [1, 'Done', T.at + LOOKUP + CONNECT + TIMEOUT];
    if (this.untrusted(T)) return [1, 'Done', T.at + LOOKUP + CONNECT];
    // the text first, then the pictures one by one (as a page of 2008 came down)
    const kb = G.page!.kb, total = kb + this.itemsKb(T), dur = (total * 8) / Math.max(1, T.kbps), f = Math.min(1, (t - LOOKUP - CONNECT - think) / dur);
    if (f >= 1) return [1, 'Done', T.at + LOOKUP + CONNECT + think + dur];
    if (f * total < kb) return [f, `Transferring data from ${host}... ${Math.floor(f * total)} of ${kb} KB`, 0];
    return [f, `Loading ${this.arrived(T, f)} of ${this.items(T).length} items...`, 0];
  }
  private loading(now: number) { return this.progress(now)[0] < 1; }
  /** A page on https whose certificate has lapsed, not let through (yet). */
  private untrusted(T: Tab) { return T.got?.cert === 'bad' && !this.trusted.has(T.got.host); }
  /** What has gone wrong with the tab's page, once it shows: no network, no such server, no answer, a lapsed certificate; null if none. */
  private errOf(T: Tab, now: number): 'offline' | 'dns' | 'down' | 'cert' | null {
    if (this.progress(now, T)[0] < 1) return null;
    if (T.offline) return 'offline';
    if (T.got?.error) return T.got.error;
    return this.untrusted(T) ? 'cert' : null;
  }
  /** Let a lapsed certificate through for this host from now on, and show its page. */
  private trust(now: number) {
    const host = this.T.got?.host;
    if (!host) return;
    this.trusted.add(host);
    this.files?.write('exceptions', [...this.trusted].join('\n'));
    this.go(this.url, now, false);
  }

  key(key: string, ctrl: boolean, now: number) {
    const k = key.toLowerCase(), T = this.T;
    if (key === 'F10' || (ctrl && k === 'q')) { this.quit(); return; }
    if (key === 'F6' || (ctrl && k === 'l')) { this.editing = 'addr'; this.addr = ''; return; }
    if (ctrl && k === 'k') { this.editing = 'search'; this.addr = ''; return; }
    if (ctrl && k === 't') { this.newTab(now); return; }
    if (ctrl && k === 'w') { this.closeTab(); return; }
    if (ctrl && key === 'Tab') { this.cur = (this.cur + 1) % this.tabs.length; this.editing = false; this.sfx.push('tick'); return; }
    if (ctrl && k === 'd') { this.toggleMark(); return; }
    if (this.editing) {
      // words that are not an address are a search (as the browsers of 2008 did); the Lookwise box always searches
      const a = this.addr.trim();
      if (key === 'Enter') this.go(this.editing === 'search' || /\s/.test(a) || (!a.includes('.') && a) ? searchUrl(a) : a, now);
      else if (key === 'Backspace') this.addr = this.addr.slice(0, -1);
      else if (key.length === 1 && !ctrl && this.addr.length < 120) this.addr += key;
      return;
    }
    const L = this.picks(), view = this.view, rows = T.laid?.rows.length ?? 0, on = L[T.sel];
    const seen = () => { const y = L[T.sel]?.y ?? 0; if (y < T.top) T.top = y; if (y >= T.top + view) T.top = y - view + 1; };
    if (on && 'name' in on && key !== 'Tab' && !key.startsWith('Arrow') && !key.startsWith('Page') && !key.startsWith('F')) {
      const v = T.vals.get(on.name) ?? '';
      if (key === 'Enter') this.submit(now);
      else if (key === 'Backspace') T.vals.set(on.name, v.slice(0, -1));
      else if (key.length === 1 && !ctrl && v.length < on.max) T.vals.set(on.name, v + key);
      return;
    }
    if (key === 'F5' || (ctrl && k === 'r')) this.go(this.url, now, false);
    else if (key === 'Home') this.go('', now);
    else if (key === 'Backspace') this.goBack(now);
    else if (key === 'ArrowDown') T.top = Math.min(Math.max(0, rows - view), T.top + 1);
    else if (key === 'ArrowUp') T.top = Math.max(0, T.top - 1);
    else if (key === 'PageDown' || key === ' ') T.top = Math.min(Math.max(0, rows - view), T.top + view - 2);
    else if (key === 'PageUp') T.top = Math.max(0, T.top - view + 2);
    else if ((key === 'Tab' || key === 'ArrowRight') && L.length) { T.sel = (T.sel + 1) % L.length; seen(); }
    else if (key === 'ArrowLeft' && L.length) { T.sel = (T.sel - 1 + L.length) % L.length; seen(); }
    else if (key === 'Enter' && on && 'url' in on) { if (on.url.startsWith(SUBMIT)) this.submit(now, on.url.slice(SUBMIT.length)); else this.go(on.url, now); }
  }

  /** A page's icon by its host (the search's owl, the mail's envelope, else its letter). */
  private iconFor(T: Tab): Icon {
    const host = T.got?.host ?? '', S = host ? webOf(this.world).hosts.get(host) : undefined;
    return iconOf(S?.kind ?? (host ? 'other' : 'ferret'), host.replace(/^www\./, ''), hash3(host.length, host.charCodeAt(4) || 0, host.charCodeAt(host.length - 5) || 0));
  }
  /** The open tab's title (the Osprey bar shows it). */
  title(now: number) { return this.titleOf(this.T, now); }
  private titleOf(T: Tab, now: number) {
    const [f] = this.progress(now, T), G = T.got;
    return G?.page && f >= 1 ? G.page.title : G?.error || T.offline ? 'Problem loading page' : !G ? 'New Tab' : 'Loading...';
  }

  /** The frame's pixels as they are now (chrome.ts paints them). */
  art(now: number): Art {
    const T = this.T, [f, , end] = this.progress(now), ek = this.errOf(T, now), err = !!ek;
    let ferret: [FerretState, number] = ['peek', 0];
    if (f < 1) ferret = ['dig', Math.floor((now - T.at) * DIG_FPS)];
    else if (err && now - end < LOST_S) ferret = ['lost', Math.floor((now - end) * 4)];
    else if (err) ferret = ['lost', 5];
    else if (T.got && now - end < OUT_S) ferret = ['out', Math.min(5, Math.floor(((now - end) / OUT_S) * 6))];
    const rows = T.laid?.rows.length ?? 0;
    const S: ChromeState = {
      W: this.W, H: this.H,
      tabs: this.tabs.map((t, i) => ({ icon: this.iconFor(t), on: i === this.cur })),
      canBack: T.back.length > 0, canFwd: T.fwd.length > 0, loading: f < 1, secure: !!T.got?.cert && !this.untrusted(T),
      icon: this.iconFor(T),
      scroll: T.laid && rows > this.view ? [T.top / Math.max(1, rows - this.view), this.view / rows] : null,
      ferret, progress: f < 1 && !T.offline ? f : null, marked: this.marks.some(([, u]) => u === T.url),
      marks: this.marks.map(([t, u]) => ({ icon: this.markIcon(u), w: Math.min(18, t.length) })),
      err: ek ? { kind: ek, btns: this.errBtns.map((b) => [b.x, b.y, b.w] as [number, number, number]) } : null,
    };
    // the page's pixels: those on the rows in view, the pictures only once they have come
    const top = T.top, bottom = top + this.view, inView = (o: HdOp) => o.y < bottom && o.y + ('h' in o ? o.h + 3 : 2) > top - 1;
    const back = !ek && T.laid && f > 0 ? T.laid.back.filter(inView) : [], front = !ek && T.laid ? this.items(T).slice(0, this.arrived(T, f)).filter(inView) : [];
    // Lookwise's owl (15.17h): working while the search thinks (on the empty page); its eyes on the text being typed; wide a moment when the results come
    const thinking = f === 0 && !!T.got?.think && now - T.at > LOOKUP + CONNECT;
    const F = this.picks()[T.sel], ctx: OwlCtx = { since: f >= 1 ? now - end : 0 };
    if (F && 'name' in F && F.name === 'q') ctx.cursor = [F.x + Math.min(F.w - 1, (T.vals.get(F.name) ?? '').length), F.y];
    const owlish = thinking || front.some((o) => o.k === 'owlface' && (o.mood === 'fly' || o.mood === 'search'));
    const moving = animated(front) || thinking ? `${Math.floor(now * 2)}:${front.some((o) => o.k === 'marquee') || owlish ? Math.floor(now * 10) : 0}` : '';
    const key = `${JSON.stringify(S)}|${T.url}|${this.W}|${top}|${back.length}|${front.length}|${ctx.cursor ?? ''}|${(ctx.since ?? 9) < 0.6}|${thinking}|${moving}`;
    return {
      key,
      paint: (P, ox) => {
        paintChrome(P, S, ox);
        // clipped to the page's rows and the pane's width (not the scroll bar's column)
        const save = [P.x0, P.y0, P.x1, P.y1];
        P.x0 = ox * CW; P.y0 = PAGE_Y * CH; P.x1 = (ox + this.W - 1) * CW; P.y1 = (PAGE_Y + this.view) * CH;
        paintOps(P, back, ox * CW, (PAGE_Y - top) * CH, now, ctx);
        paintOps(P, front, ox * CW, (PAGE_Y - top) * CH, now, ctx);
        if (thinking) paintOps(P, [{ k: 'owlface', x: Math.floor(this.W / 2) - 6, y: Math.floor(this.view / 2) - 4, size: 6, mood: 'search' }], ox * CW, PAGE_Y * CH, now);
        [P.x0, P.y0, P.x1, P.y1] = save;
      },
    };
  }
  private markIcon(url: string): Icon {
    const host = url.replace(/^https?:\/\//, '').split(/[/?]/)[0], S = webOf(this.world).hosts.get(host);
    return iconOf(S?.kind ?? 'other', host.replace(/^www\./, ''), hash3(host.length, host.charCodeAt(4) || 0, host.charCodeAt(host.length - 5) || 0));
  }

  /** The whole pane now (the text over the frame's pixels), and the cursor (in the address box while typing). */
  cells(now: number): { scr: Scr; cx: number; cy: number } {
    const W = this.W, H = this.H, S = new Scr(W, H, 0), view = this.view, T = this.T;
    const [f, status] = this.progress(now);
    // the tabs: each one's title, the active one's close box, the "+"
    S.paint(0, 0, ' '.repeat(W), INK, TAB_BG); S.paint(0, TAB_ROW, ' '.repeat(W), INK, TAB_BG);
    if (W > 40) S.paint(W - 7, 0, 'Ferret', FR.brand, TAB_BG);
    this.tabs.forEach((t, i) => {
      const x = 1 + i * TAB_W, on = i === this.cur;
      if (x + TAB_W > W) return;
      S.paint(x + TAB_TEXT, TAB_ROW, this.titleOf(t, now).slice(0, TAB_TEXT_W), on ? [17, 17, 17] : [60, 50, 40], on ? FR.tabOn : FR.tabOff);
      if (on) S.paint(x + TAB_X, TAB_ROW, 'x', [120, 100, 80], FR.tabOn);
    });
    if (1 + this.tabs.length * TAB_W + 2 < W) S.paint(2 + this.tabs.length * TAB_W, TAB_ROW, '+', [70, 50, 30], TAB_BG);
    // the navigation bar: the address (or what is typed), the search box
    for (let r = NAV_Y; r < MARKS_Y; r++) S.paint(0, r, ' '.repeat(W), INK, NAV_BG);
    const a0 = ADDR_X + 4, aw = addrEnd(W) - 4 - a0, shown = this.editing === 'addr' ? this.addr : this.url;
    S.paint(a0, NAV_TEXT_Y, shown.slice(this.editing === 'addr' ? Math.max(0, shown.length - aw + 1) : 0).padEnd(aw).slice(0, aw), INK, T.url.startsWith('https:') ? [255, 248, 196] : WHITE);
    const s0 = searchX(W) + 4, sw = SEARCH_W - 5;
    S.paint(s0, NAV_TEXT_Y, (this.editing === 'search' ? this.addr.slice(-sw + 1) : 'Lookwise').padEnd(sw).slice(0, sw), this.editing === 'search' ? INK : GREY, WHITE);
    // the bookmarks
    S.paint(0, MARKS_Y, ' '.repeat(W), INK, MARK_BG);
    let mx = 1;
    for (const [title] of this.marks) { const w = Math.min(18, title.length); if (mx + 3 + w > W) break; S.paint(mx + 3, MARKS_Y, title.slice(0, w), [40, 30, 20], MARK_BG); mx += w + 5; }
    // the page, as much of it as has arrived
    if (T.laid && f > 0) {
      const kb = T.got?.page?.kb ?? 1, tf = Math.min(1, (f * (kb + this.itemsKb(T))) / kb);
      const R = T.laid.rows, upto = tf >= 1 ? R.length : Math.floor(R.length * tf), on = this.picks()[T.sel];
      // a link lit whole: its pieces on the rows round it too (a headline broken over two lines)
      const lit = on && 'url' in on ? T.laid.links.filter((l) => l.url === on.url && Math.abs(l.y - on.y) <= 2) : [];
      for (let r = 0; r < view; r++) {
        const y = T.top + r, row = R[y];
        if (!row || y >= upto) { S.paint(0, PAGE_Y + r, ' '.repeat(W), INK, WHITE); continue; }
        for (let x = 0; x < W - 1; x++) {
          const c = row[x], hit = lit.some((l) => l.y === y && x >= l.x && x < l.x + l.w);
          S.paint(x, PAGE_Y + r, c.ch, hit ? c.bg : c.fg, hit ? c.fg : c.bg);
        }
        S.paint(W - 1, PAGE_Y + r, ' ', INK, row[W - 2]?.bg ?? WHITE);
        // a link already seen is purple (the history), as in every browser of the time: the links written
        // in the site's link color (a menu button keeps its own colors, as the sites' CSS made it)
        const LC = T.got?.page?.theme.link, linkInk = (c: C3) => !!LC && c[0] === LC[0] && c[1] === LC[1] && c[2] === LC[2];
        for (const l of T.laid.links) {
          if (l.y !== y || l.url.startsWith(SUBMIT) || !this.seen.has(this.abs(l.url)) || lit.includes(l)) continue;
          for (let x = l.x; x < Math.min(W - 1, l.x + l.w); x++) { const c = row[x]; if (c && c.ch !== ' ' && linkInk(c.fg)) S.paint(x, PAGE_Y + r, c.ch, VISITED, c.bg); }
        }
        // what is typed in the boxes on this row (stars for a password)
        for (const F of T.laid.fields) {
          if (F.y !== y) continue;
          const v = T.vals.get(F.name) ?? '', t = (F.secret ? '*'.repeat(v.length) : v).slice(-(F.w - 1));
          S.paint(F.x, PAGE_Y + r, t.padEnd(F.w), INK, on === F ? [255, 255, 224] : WHITE);
        }
      }
    } else {
      for (let r = 0; r < view; r++) S.paint(0, PAGE_Y + r, ' '.repeat(W), INK, WHITE);
    }
    // an error: the browser's own page (the manual's: the lost ferret, a title, why, what to try)
    this.errBtns = [];
    const ek = this.errOf(T, now);
    if (ek) this.errPage(S, ek, now);
    // the status line: what is happening, and the line's speed
    S.paint(0, H - 1, ` ${T.offline ? 'no network' : status}`.padEnd(W).slice(0, W), [34, 34, 34], STATUS_BG);
    if (!T.offline) { const kb = `${(T.kbps / 8).toFixed(1)} kB/s `; S.paint(W - kb.length, H - 1, kb, [51, 51, 51], STATUS_BG); }
    // the cursor: in the address or search box while typing, else at the end of the text box picked
    const F = this.picks()[T.sel];
    if (!this.editing && F && 'name' in F && T.laid && f >= 1 && F.y >= T.top && F.y < T.top + view) {
      const n = Math.min(F.w - 1, (T.vals.get(F.name) ?? '').length);
      return { scr: S, cx: F.x + n, cy: PAGE_Y + F.y - T.top };
    }
    if (this.editing === 'addr') return { scr: S, cx: a0 + Math.min(aw - 1, this.addr.length), cy: NAV_TEXT_Y };
    if (this.editing === 'search') return { scr: S, cx: s0 + Math.min(sw - 1, this.addr.length), cy: NAV_TEXT_Y };
    return { scr: S, cx: -1, cy: -1 };
  }
  /** The error page over the page's rows: the words at ERR_X, wrapped; the button under them. */
  private errPage(S: Scr, kind: 'offline' | 'dns' | 'down' | 'cert', now: number) {
    const host = this.T.got?.host ?? '', W = this.W, x0 = ERR_X, ww = W - x0 - 6;
    const T = {
      dns: ['Server not found', `${NAME} can't find the server at ${host}.`, ['Check the address for typing errors such as ww.example.com instead of www.example.com.', "If you are unable to load any pages, check your computer's network connection."], 'Try Again'],
      offline: ['Offline', `${NAME} is not connected to a network.`, ['Turn on the wireless radio, or move closer to an access point.', 'Then try again.'], 'Try Again'],
      down: ['The connection has timed out', `The server at ${host} is taking too long to respond.`, ['The site could be temporarily unavailable or too busy. Try again in a few moments.', 'A weak wireless signal can also cause this.'], 'Try Again'],
      cert: ['This Connection is Untrusted', `You have asked ${NAME} to connect securely to ${host}, but we can't confirm that your connection is secure.`, ['If you usually connect to this site without problems, this error could mean that someone is trying to impersonate the site.', `The certificate expired on ${certExpiry(this.world, host)}.`], 'Get me out of here!'],
    }[kind] as [string, string, string[], string];
    for (let r = PAGE_Y; r < PAGE_Y + this.view; r++) S.paint(0, r, ' '.repeat(W), INK, ERR);
    const wrap = (y: number, x: number, w: number, s: string, c: C3) => {
      let line = '', n = 0;
      for (const wd of s.split(' ')) { if ((line + ' ' + wd).trim().length > w) { S.paint(x, y + n++, line, c, ERR); line = wd; } else line = (line + ' ' + wd).trim(); }
      if (line) S.paint(x, y + n++, line, c, ERR);
      return n;
    };
    let y = PAGE_Y + 4;
    S.paint(x0, y, T[0], [30, 30, 30], ERR); y += 2;
    y += wrap(y, x0, ww, T[1], [40, 40, 40]) + 1;
    for (const s of T[2]) { S.paint(x0, y, '*', [90, 90, 90], ERR); y += wrap(y, x0 + 2, ww - 2, s, [60, 60, 60]) + 1; }
    y++;
    S.paint(x0, y, ` ${T[3]} `, INK, [228, 228, 228]);
    this.errBtns.push({ x: x0, y, w: T[3].length + 2, act: kind === 'cert' ? () => this.go('', now) : () => this.go(this.url, now, false) });
    if (kind === 'cert') {
      const ax = x0 + T[3].length + 5, lab = 'Add Exception...';
      S.paint(ax, y, lab, [0, 0, 204], ERR);
      this.errBtns.push({ x: ax, y, w: lab.length, act: () => this.trust(now) });
    }
  }
  /** A link's address as the history keeps it (with its scheme). */
  private abs(url: string) { return /^https?:\/\//.test(url) ? url : 'http://' + url; }
}
