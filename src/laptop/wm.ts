/**
 * The notebook's window manager (15.7): the terminal and the web browser (Lodestar) side by side on
 * the one console, the way a tiling manager of 2008 split an xterm and a browser. The shell owns it
 * while Lodestar runs (shell.wm); it composes both panes into the one screen the firmware draws.
 *
 * Layout: the terminal on the left, the browser on the right, a '|' divider between with a '<'/'>'
 * marker pointing at the pane that has the keys. F11 maximizes the focused pane; Ctrl+Left/Right (or
 * Ctrl+Tab) moves the focus. The focused pane takes the keys; while the terminal has them, PageUp and
 * PageDown walk its scrollback. The browser keeps its own keys (F6 address, Tab link, F10 closes).
 *
 * This file is NOT hacking: it reads the terminal through a small interface (TermIO) and the browser
 * through its own class, and knows nothing of the shell's commands.
 */
import { Browser } from '../web/browser';
import { Scr, St } from './screen';

/** What the window manager needs of the terminal: its visible state, and a way to feed it keys and a paste. */
export interface TermIO {
  readonly lines: { text: string; ink: number }[];
  readonly prompt: string;
  input: string;
  cur: number;
  mask: boolean;
  scroll: number;
  readonly ready: boolean;
  /** A key for the prompt only (the shell's own routing has already picked the terminal). */
  termKey(key: string, ctrl: boolean, now: number): void;
  /** Drop text into the prompt at the cursor (15.7c). */
  paste(text: string): void;
}

const GAP = 1;

export class WM {
  /** Which pane has the keys. */
  focus: 'term' | 'web' = 'web';
  /** A pane maximized over the other (F11), or null for the split. */
  private max: null | 'term' | 'web' = null;
  /** The terminal pane's width in the split. */
  private split: number;
  /** The width the browser was last laid out at, so it is re-laid only when the pane changes. */
  private bw = -1;

  constructor(private term: TermIO, private browser: Browser, private w: number, private h: number) {
    this.split = Math.floor((w - GAP) / 2);
  }

  /** The panes' rectangles for the current layout: a pane with width 0 is hidden. */
  private rects(): { tx: number; tw: number; wx: number; ww: number } {
    if (this.max === 'term') return { tx: 0, tw: this.w, wx: -1, ww: 0 };
    if (this.max === 'web') return { tx: -1, tw: 0, wx: 0, ww: this.w };
    const tw = this.split, ww = this.w - tw - GAP;
    return { tx: 0, tw, wx: tw + GAP, ww };
  }

  key(key: string, ctrl: boolean, now: number) {
    if (key === 'F11') { this.max = this.max ? null : this.focus; return; }
    if (ctrl && (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Tab')) { this.focus = this.focus === 'term' ? 'web' : 'term'; return; }
    if (this.focus === 'web') { this.browser.key(key, ctrl, now); return; }
    if (key === 'PageUp' || key === 'PageDown') {
      const page = this.h - 2, cap = Math.max(0, this.term.lines.length - 4);
      this.term.scroll = Math.max(0, Math.min(cap, this.term.scroll + (key === 'PageUp' ? page : -page)));
      return;
    }
    this.term.termKey(key, ctrl, now);
  }

  /** A click at a composited cell (x, y): focus the pane it lands in, and pass it on to the browser. */
  click(x: number, y: number, now: number) {
    const R = this.rects();
    if (R.ww > 0 && x >= R.wx && x < R.wx + R.ww) { this.focus = 'web'; this.browser.click(x - R.wx, y, now); return; }
    if (R.tw > 0 && x >= R.tx && x < R.tx + R.tw) this.focus = 'term';
  }

  /** The mouse wheel over a composited cell: scroll the pane it is over. */
  wheel(dy: number, x: number) {
    const R = this.rects(), step = 3;
    if (R.ww > 0 && x >= R.wx && x < R.wx + R.ww) { this.browser.scroll(dy > 0 ? step : -step); return; }
    const cap = Math.max(0, this.term.lines.length - 4);
    this.term.scroll = Math.max(0, Math.min(cap, this.term.scroll + (dy > 0 ? -step : step)));
  }

  /** The whole console now, composed, and the caret of the focused pane. */
  cells(now: number): { scr: Scr; cx: number; cy: number } {
    const S = new Scr(this.w, this.h, St.Ink), R = this.rects();
    let cx = -1, cy = -1;
    if (R.tw > 0) { const t = this.drawTerm(S, R.tx, R.tw); if (this.focus === 'term') { cx = t.cx; cy = t.cy; } }
    if (R.ww > 0) {
      if (R.ww !== this.bw) { this.browser.resize(R.ww, this.h); this.bw = R.ww; }
      const b = this.browser.cells(now);
      this.blit(S, b.scr, R.wx, R.ww);
      if (this.focus === 'web' && b.cx >= 0) { cx = R.wx + b.cx; cy = b.cy; }
    }
    if (R.tw > 0 && R.ww > 0) {
      const dx = R.tx + R.tw, mid = this.h >> 1;
      for (let r = 0; r < this.h; r++) S.text(dx, r, '|', St.Dim);
      S.text(dx, mid, this.focus === 'term' ? '<' : '>', St.Bright);
    }
    return { scr: S, cx, cy };
  }

  /** The terminal's visible lines (re-wrapped to the pane's width), prompt and caret, drawn into S. */
  private drawTerm(S: Scr, x0: number, w: number): { cx: number; cy: number } {
    const T = this.term, H = this.h, disp: { t: string; ink: number }[] = [];
    const wrap = (text: string, ink: number) => { for (let k = 0; k === 0 || k < text.length; k += w) disp.push({ t: text.slice(k, k + w), ink }); };
    for (const ln of T.lines) wrap(ln.text, ln.ink);
    let caretRow = -1, caretCol = -1;
    if (T.ready) {
      const s = T.prompt + (T.mask ? '*'.repeat(T.input.length) : T.input), start = disp.length;
      wrap(s, 0);
      const pos = T.prompt.length + T.cur;
      caretRow = start + Math.floor(pos / w); caretCol = pos % w;
    }
    const first = Math.max(0, disp.length - H - T.scroll);
    for (let r = 0; r < H; r++) { const ln = disp[first + r]; if (ln) S.text(x0, r, ln.t, ln.ink); }
    const cy = caretRow - first;
    const show = caretRow >= 0 && cy >= 0 && cy < H && T.scroll === 0;
    return { cx: show ? x0 + caretCol : -1, cy: show ? cy : -1 };
  }

  /** Copy a pane's own screen into the composite at (x0, 0), clipped to the pane's width. */
  private blit(S: Scr, src: Scr, x0: number, w: number) {
    for (let r = 0; r < Math.min(S.h, src.h); r++) {
      for (let c = 0; c < Math.min(w, src.w); c++) {
        S.ch[r][x0 + c] = src.ch[r][c]; S.st[r][x0 + c] = src.st[r][c]; S.fg[r][x0 + c] = src.fg[r][c]; S.bg[r][x0 + c] = src.bg[r][c];
      }
    }
  }
}
