/**
 * A full screen of the terminal drawn by a program that owns it (the BIOS's SETUP, the editor),
 * instead of the scrolling lines: a character and a style per cell. draw.ts turns the styles into
 * colors (see STYLE there): 0..2 the terminal's inks, 3 inverse, 10+ the firmware's colors.
 */
export const St = {
  Ink: 0, Dim: 1, Bright: 2, Inverse: 3,
  /** The firmware: body text, the bars, a highlighted tab or item, help, a dialog and its choice, white, gray, yellow. */
  Body: 10, Bar: 11, Tab: 12, Pick: 13, Help: 14, Box: 15, BoxPick: 16, White: 17, Gray: 18, Yellow: 19,
} as const;

export class Scr {
  readonly ch: string[][];
  readonly st: Uint8Array[];
  constructor(readonly w: number, readonly h: number, fill: number) {
    this.ch = Array.from({ length: h }, () => new Array<string>(w).fill(' '));
    this.st = Array.from({ length: h }, () => new Uint8Array(w).fill(fill));
  }
  text(x: number, y: number, s: string, st: number) {
    if (y < 0 || y >= this.h) return;
    for (let k = 0; k < s.length; k++) { const c = x + k; if (c >= 0 && c < this.w) { this.ch[y][c] = s[k]; this.st[y][c] = st; } }
  }
  fill(x: number, y: number, w: number, h: number, st: number, ch = ' ') {
    for (let r = y; r < y + h; r++) this.text(x, r, ch.repeat(w), st);
  }
  /** A box with a border (+-|), filled. */
  box(x: number, y: number, w: number, h: number, st: number) {
    this.fill(x, y, w, h, st);
    this.text(x, y, '+' + '-'.repeat(w - 2) + '+', st);
    this.text(x, y + h - 1, '+' + '-'.repeat(w - 2) + '+', st);
    for (let r = y + 1; r < y + h - 1; r++) { this.text(x, r, '|', st); this.text(x + w - 1, r, '|', st); }
  }
}
