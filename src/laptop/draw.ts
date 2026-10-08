import L from '../locale/laptop.en.json';
import { type Laptop } from './laptop';
import { St } from './screen';
import { hash3 } from '../core/rng';
import { barOn, drawBar } from './osprey';

/** The notebook's shared pieces: its keyboard, the terminal's inks, and the screen's content (look3d.ts draws the body). */
export type C3 = [number, number, number];
/** The keyboard: rows of [code, label, width in units]; every row is 15 units. */
export const ROWS: [string, string, number][][] = [
  [['Escape', 'Esc', 1], ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n): [string, string, number] => [`F${n}`, `F${n}`, 1]), ['Delete', 'Del', 2]],
  [['Backquote', '`', 1], ...'1234567890'.split('').map((d): [string, string, number] => [`Digit${d}`, d, 1]), ['Minus', '-', 1], ['Equal', '=', 1], ['Backspace', 'Bksp', 2]],
  [['Tab', 'Tab', 1.5], ...'QWERTYUIOP'.split('').map((c): [string, string, number] => [`Key${c}`, c, 1]), ['BracketLeft', '[', 1], ['BracketRight', ']', 1], ['Backslash', '\\', 1.5]],
  [['CapsLock', 'Caps', 1.75], ...'ASDFGHJKL'.split('').map((c): [string, string, number] => [`Key${c}`, c, 1]), ['Semicolon', ';', 1], ['Quote', "'", 1], ['Enter', 'Enter', 2.25]],
  [['ShiftLeft', 'Shift', 2.25], ...'ZXCVBNM'.split('').map((c): [string, string, number] => [`Key${c}`, c, 1]), ['Comma', ',', 1], ['Period', '.', 1], ['Slash', '/', 1], ['ShiftRight', 'Shift', 2.75]],
  [['ControlLeft', 'Ctrl', 1.25], ['Fn', 'Fn', 1], ['MetaLeft', 'Sup', 1.25], ['AltLeft', 'Alt', 1.25], ['Space', '', 4.75], ['AltRight', 'Alt', 1.25], ['ControlRight', 'Ctrl', 1.25],
    ['ArrowLeft', '<', 1], ['ArrowUp', '^', 1], ['ArrowRight', '>', 1]],
];
/** The terminal's inks: amber, green; each normal, dim, bright. */
export const INKS: C3[][] = [[[255, 176, 48], [170, 110, 34], [255, 214, 140]], [[90, 255, 120], [44, 160, 70], [190, 255, 200]]];
const SCREEN_BG: C3[] = [[10, 6, 2], [3, 9, 4]];
/** The BIOS's screen: light gray on black, as the firmware draws it before the system's own colors. */
const BIOS_INK: C3 = [196, 196, 200], BIOS_BG: C3 = [2, 2, 4];
/** The firmware's SETUP colors (screen.ts, St): navy body, gray bars, a teal pick. */
const NAVY: C3 = [0, 0, 120], GRAY: C3 = [176, 176, 184];
const FW: Record<number, [C3, C3]> = {
  [St.Body]: [[184, 188, 200], NAVY], [St.Bar]: [[0, 0, 0], GRAY], [St.Tab]: [[0, 0, 120], [224, 224, 232]], [St.Pick]: [[255, 255, 255], [0, 110, 170]],
  [St.Help]: [[110, 200, 230], NAVY], [St.Box]: [[0, 0, 0], GRAY], [St.BoxPick]: [[255, 255, 255], NAVY], [St.White]: [[250, 250, 255], NAVY],
  [St.Gray]: [[120, 124, 160], NAVY], [St.Yellow]: [[255, 230, 80], NAVY],
};
/** The keys' hint over the notebook: how to close it, and while it is off, that Enter is the power button. */
export const hintOf = (P: Laptop) => (P.shell.halted ? `${L.seat.power}   ${L.seat.close}` : L.seat.close);

/** A cell writer on the interface's grid (glyph, ink, paper), and a string writer. */
export type Put = (x: number, y: number, ch: number, fg: readonly number[], bg: readonly number[]) => void;
export type Text = (x: number, y: number, s: string, fg: readonly number[], bg: readonly number[]) => void;

/**
 * The screen's content, its top-left character at (sx, sy): the terminal's lines (or a program that
 * owns the screen: SETUP, the editor), the cursor, the status strip; off, a dark glass. The glass
 * follows the scene: a faint wash of the light at the player's hands over it, smudges of fingerprints
 * that catch that light, and off, the light's reflection across it. Every look of the notebook draws its screen with this.
 */
export function drawScreen(put: Put, text: Text, sx: number, sy: number, P: Laptop, now: number, lit: (c: readonly number[], k?: number) => C3, light: Float32Array, W: number, H: number) {
  const S = P.shell, ink = INKS[S.ink], sbg = SCREEN_BG[S.ink];
  // the glass over every cell: the light's wash, the smudges, and (off) the reflection
  const Lr = Math.min(1.6, light[0]), Lg = Math.min(1.6, light[1]), Lb = Math.min(1.6, light[2]);
  // what the glass adds lies over the letters as much as over the paper: they are inside it
  const glass = (c: number, r: number, off: boolean): number => {
    const sm = smudge(c / W, r / H), band = off ? Math.max(0, 1 - Math.abs(((c * 0.6 - r * 1.4 + 18) % 40) - 20) / 5) : 0;
    return 3 + sm * 22 + band * 26;
  };
  const raw = put;
  put = (x, y, ch, fg, bg) => {
    const c = x - sx, r = y - sy;
    if (c >= 0 && r >= 0 && c < W && r < H) {
      const k = glass(c, r, !on);
      raw(x, y, ch, [fg[0] + k * Lr, fg[1] + k * Lg, fg[2] + k * Lb], [bg[0] + k * Lr, bg[1] + k * Lg, bg[2] + k * Lb]);
    } else raw(x, y, ch, fg, bg);
  };
  text = (x, y, s2, fg, bg) => { for (let k = 0; k < s2.length; k++) put(x + k, y, s2.charCodeAt(k), fg, bg); };
  void lit;
  const on = S.state !== 'off' && P.pc.bootAt >= 0;
  // the visible lines: the scrollback, then the prompt and what is being typed
  const full = on ? S.screen() : null;
  const lines = full ? [] : S.lines.slice(), ready = S.ready && !full;
  let promptRow = -1;
  if (ready) {
    const s = S.prompt + (S.mask ? '*'.repeat(S.input.length) : S.input);
    for (let k = 0; k === 0 || k < s.length + 1; k += W) { lines.push({ text: s.slice(k, k + W), ink: 0 }); if (promptRow < 0) promptRow = lines.length - 1; }
  }
  // the Osprey's bar takes the top row once the system runs (15.20a); the console's lines sit under it
  const bar = on && barOn(S), top = bar ? 1 : 0, HR = H - top;
  const first = Math.max(0, lines.length - HR - S.scroll);
  for (let r = 0; r < HR; r++) {
    const ln = on ? lines[first + r] : undefined, base = S.bios ? BIOS_BG : sbg;
    for (let c = 0; c < W; c++) {
      const ch = ln ? ln.text.charCodeAt(c) || 32 : 32;
      let col: readonly number[] = S.bios ? BIOS_INK : ink[ln?.ink ?? 0];
      if (ln && 'rgb' in ln && ln.rgb) for (const [a, b, v] of ln.rgb) if (c >= a && c < b) col = [v >> 16, (v >> 8) & 255, v & 255];
      // the paper is the same under a letter as round it: the letters are lit dots on the glass, not a strip of their own
      const bg: C3 = on ? base : [12, 12, 14];
      put(sx + c, sy + top + r, ch, col, bg);
    }
  }
  // a program owning the whole screen (SETUP, the editor) draws instead of the lines
  if (full) {
    const F = full.scr;
    for (let r = 0; r < Math.min(H, F.h); r++) {
      for (let c = 0; c < Math.min(W, F.w); c++) {
        const st = F.st[r][c], ch = F.ch[r][c].charCodeAt(0);
        let fg: C3, bg: C3;
        if (st === St.Rgb) { const a = F.fg[r][c], b = F.bg[r][c]; fg = [a >> 16, (a >> 8) & 255, a & 255]; bg = [b >> 16, (b >> 8) & 255, b & 255]; }
        else if (st >= 10) [fg, bg] = FW[st];
        else if (st === St.Inverse) { fg = [sbg[0] + 4, sbg[1] + 4, sbg[2] + 4]; bg = [ink[0][0] * 0.85, ink[0][1] * 0.85, ink[0][2] * 0.85]; }
        else { fg = ink[st]; bg = sbg; }
        put(sx + c, sy + r, ch, fg, bg);
      }
    }
    if (full.cy >= 0 && Math.floor(now * 2.5) & 1 && full.cx >= 0 && full.cx < W) put(sx + full.cx, sy + full.cy, 32, ink[0], ink[0]);
  }
  // syntax colours over the input, and the fish-style ghost text after it (QoL, Bloco 1). The line
  // was drawn in one ink above; here each typed character is recoloured by its token kind, and the
  // suggested continuation is painted dim in the blank that follows. Masked input is left alone.
  if (on && !full && ready && S.scroll === 0 && !S.mask && promptRow >= 0) {
    const bad: C3 = [255, 110, 80], str: C3 = [150, 205, 120], net: C3 = [110, 200, 240];
    const tokCol = (k: string): C3 => (k === 'cmd' ? ink[2] : k === 'bad' ? bad : k === 'str' ? str : k === 'net' ? net : k === 'flag' || k === 'op' ? ink[1] : ink[0]);
    const istr = S.input, plen = S.prompt.length;
    const kindAt = new Array<string>(istr.length).fill('arg');
    for (const t of S.hiTokens(istr)) for (let j = t.s; j < t.e && j < istr.length; j++) kindAt[j] = t.k;
    const cell = (idx: number, ch: number, fg: C3) => {
      const row = promptRow + Math.floor(idx / W) - first, col = idx % W;
      if (row >= 0 && row < HR && col >= 0 && col < W) put(sx + col, sy + top + row, ch, fg, sbg);
    };
    for (let j = 0; j < istr.length; j++) cell(plen + j, istr.charCodeAt(j), tokCol(kindAt[j]));
    const g = S.ghost(), dim: C3 = [ink[1][0] * 0.8, ink[1][1] * 0.8, ink[1][2] * 0.8];
    for (let j = 0; j < g.length; j++) cell(plen + istr.length + j, g.charCodeAt(j), dim);
    // the completion drop-up (Bloco 2): a little list sitting just above the prompt, the choice
    // highlighted. It grows upward from the prompt row, left-aligned under the word being completed.
    const M = S.menu;
    if (M) {
      const pr = promptRow - first; // the prompt's row on screen
      const rows = Math.min(8, M.items.length, Math.max(0, pr));
      const top = Math.max(0, Math.min(M.sel - (rows >> 1), M.items.length - rows));
      const wide = Math.max(...M.items.slice(top, top + rows).map((s) => s.length)) + 2;
      let bx = (plen + M.start) % W;
      bx = Math.max(0, Math.min(bx, W - Math.min(wide, W)));
      const box = Math.min(wide, W - bx);
      const lit: C3 = [sbg[0] + 16, sbg[1] + 18, sbg[2] + 16];
      for (let r = 0; r < rows; r++) {
        const srow = pr - rows + r, it = M.items[top + r], on2 = top + r === M.sel;
        if (srow < 0 || srow >= HR) continue;
        const fg: C3 = on2 ? sbg : ink[0], bg: C3 = on2 ? ink[0] : lit;
        for (let c = 0; c < box; c++) put(sx + bx + c, sy + top + srow, c >= 1 && c <= it.length ? it.charCodeAt(c - 1) : 32, fg, bg);
      }
    }
  }
  // the cursor: a block blinking where the next character goes
  if (on && !full && ready && S.scroll === 0 && Math.floor(now * 2.5) & 1) {
    const pos = S.prompt.length + S.cur, row = lines.length - 1 - (Math.floor((S.prompt.length + S.input.length) / W) - Math.floor(pos / W)) - first;
    if (row >= 0 && row < HR) put(sx + (pos % W), sy + top + row, 32, ink[0], ink[0]);
  }
  if (on && S.scroll > 0) text(sx + W - 14, sy + top, ` SCROLLBACK ${S.scroll} `.slice(0, 14), sbg, ink[1]);
  // the Osprey's bar over the console, the window manager and an empty desktop alike
  if (bar && !(full && (S.editor || S.fw.mode))) drawBar(S, (x, ch, fg, bg) => put(sx + x, sy, ch, fg, bg), W, now, ink);
  // powered off: a dark glass (the light's reflection lies on it, see glass above)
  if (!on) for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) put(sx + c, sy + r, 32, [0, 0, 0], [10, 10, 12]);
}

/** Fingerprints on the glass: a few oval smudges, 0..1 at (u, v), fractions of the screen's width and height. */
function smudge(u: number, v: number): number {
  let s = 0;
  for (let k = 0; k < 7; k++) {
    const cx = hash3(k, 41, 1), cy = hash3(k, 41, 2), rx = (2.5 + hash3(k, 41, 3) * 4) / 80, ry = (1 + hash3(k, 41, 4) * 1.6) / 22;
    const d = ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2;
    if (d < 1) s += (1 - d) * (0.5 + 0.5 * hash3(Math.floor(u * 400), Math.floor(v * 200), k + 90));
  }
  return Math.min(1, s);
}
