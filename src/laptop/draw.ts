import L from '../locale/laptop.en.json';
import { type Laptop } from './laptop';
import { St } from './screen';
import { hash3 } from '../core/rng';

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
/**
 * The BIOS's logos (our own, after the old POST screens): the maker's blue ribbon top left, and top
 * right the power-saving program's: a yellow sweep with a star, a green rule and its name.
 */
const RIBBON = [' _ ', '(O)', '/V\\'];
const POWER = [
  '        _.--------._    /\\    ',
  '     .-\'            \'-_/  \\_  ',
  '    /    powersave    \\     / ',
  '   |    ~~~~~~~~~~~    > /\\ < ',
  '    \\                 /_/  \\_\\ ',
  '   ===========================',
  '     EFFICIENCY  PARTNER      ',
];
function biosArt(put: (x: number, y: number, ch: number, fg: readonly number[], bg: readonly number[]) => void, sx: number, sy: number, W: number) {
  RIBBON.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] !== ' ') put(sx + c, sy + r, row.charCodeAt(c), [60, 110, 255], BIOS_BG); });
  const px = sx + W - 31;
  POWER.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] !== ' ') put(px + c, sy + r, row.charCodeAt(c), r >= 5 ? [70, 220, 90] : [255, 230, 40], BIOS_BG);
  });
}

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
  const first = Math.max(0, lines.length - H - S.scroll);
  for (let r = 0; r < H; r++) {
    const ln = on ? lines[first + r] : undefined, scan = r & 1 ? 0.9 : 1;
    for (let c = 0; c < W; c++) {
      const ch = ln ? ln.text.charCodeAt(c) || 32 : 32, col = S.bios ? BIOS_INK : ink[ln?.ink ?? 0], k = scan, base = S.bios ? BIOS_BG : sbg;
      // the paper is the same under a letter as round it: the letters are lit dots on the glass, not a strip of their own
      const bg: C3 = on ? base : [12, 12, 14];
      put(sx + c, sy + r, ch, [col[0] * k, col[1] * k, col[2] * k], bg);
    }
  }
  if (on && S.bios) biosArt(put, sx, sy, W);
  // a program owning the whole screen (SETUP, the editor) draws instead of the lines
  if (full) {
    const F = full.scr;
    for (let r = 0; r < Math.min(H, F.h); r++) {
      const scan = r & 1 ? 0.9 : 1;
      for (let c = 0; c < Math.min(W, F.w); c++) {
        const st = F.st[r][c], ch = F.ch[r][c].charCodeAt(0);
        let fg: C3, bg: C3;
        if (st >= 10) [fg, bg] = FW[st];
        else if (st === St.Inverse) { fg = [sbg[0] + 4, sbg[1] + 4, sbg[2] + 4]; bg = [ink[0][0] * 0.85, ink[0][1] * 0.85, ink[0][2] * 0.85]; }
        else { fg = ink[st]; bg = sbg; }
        put(sx + c, sy + r, ch, [fg[0] * scan, fg[1] * scan, fg[2] * scan], [bg[0] * scan, bg[1] * scan, bg[2] * scan]);
      }
    }
    if (full.cy >= 0 && Math.floor(now * 2.5) & 1 && full.cx >= 0 && full.cx < W) put(sx + full.cx, sy + full.cy, 32, ink[0], ink[0]);
  }
  // the cursor: a block blinking where the next character goes
  if (on && !full && ready && S.scroll === 0 && Math.floor(now * 2.5) & 1) {
    const pos = S.prompt.length + S.cur, row = lines.length - 1 - (Math.floor((S.prompt.length + S.input.length) / W) - Math.floor(pos / W)) - first;
    if (row >= 0 && row < H) put(sx + (pos % W), sy + row, 32, ink[0], ink[0]);
  }
  if (on && S.scroll > 0) text(sx + W - 14, sy, ` SCROLLBACK ${S.scroll} `.slice(0, 14), sbg, ink[1]);
  // a status strip in the top-right corner, once the system has finished booting (not before the OS loads)
  if (S.state === 'ready' && !full) {
    const pc = P.pc, N = S.net, cpu = Math.round(pc.load * 100), temp = Math.round(pc.tempC);
    const mem = `${Math.round(pc.usedKB() / 1024)}/${Math.round(pc.hw.ramMB)}M`, batt = Math.round(pc.charge * 100);
    const bars = N.state === 'up' ? '|'.repeat(N.bars) + '.'.repeat(4 - N.bars) : N.state === 'assoc' || N.state === 'dhcp' ? '~~~~' : '----';
    const red: C3 = [255, 110, 80], grn: C3 = [120, 255, 150], dim = ink[1], val = ink[0], pbg: C3 = [sbg[0] + 10, sbg[1] + 14, sbg[2] + 10];
    const segs: [string, C3][] = [
      [' CPU ', dim], [`${String(cpu).padStart(3)}%`, cpu > 80 ? red : val], ['  ', dim],
      [`${temp}C`, temp > 70 ? red : val], ['  MEM ', dim], [mem, val],
      ['  NET ', dim], [bars, N.state === 'up' ? grn : dim],
      ['  BAT ', dim], [`${batt}%${pc.plugged ? (batt >= 100 ? ' AC' : '+') : ''}`, batt < 10 && !pc.plugged ? red : pc.plugged ? grn : val], [' ', dim],
    ];
    let x = sx + W - segs.reduce((n, g) => n + g[0].length, 0);
    for (const [t, c] of segs) { for (let k = 0; k < t.length; k++) put(x + k, sy, t.charCodeAt(k), c, pbg); x += t.length; }
  }
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
