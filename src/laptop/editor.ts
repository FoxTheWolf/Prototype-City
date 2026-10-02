import { Scr, St } from './screen';

/**
 * A full-screen text editor in the style of the small editors of the time (nano): the file in the
 * middle, a title bar, a status line and the shortcuts at the bottom. ^O (or F3) writes the file,
 * ^X (or F2) leaves (asking first if there are changes), ^K cuts the line, ^U pastes it back, ^C
 * says where the cursor is, ^G shows the help. Ctrl+W and Ctrl+N belong to the browser, so the
 * editor does not use them. Writing goes through the shell (permissions, disk space, the drive).
 */
/** The whole console (160 x 50, as TERM_W x TERM_H in shell.ts): a title bar, the file, the status line and two rows of keys. */
const W = 160, H = 50, TOP = 1, ROWS = H - 4, STATUS = H - 3;
const HELP = [
  'Help for the editor',
  '',
  'Type to insert text where the cursor is. The arrows, Home, End, PageUp and',
  'PageDown move it. Enter breaks the line, Backspace and Delete remove.',
  '',
  '  ^O  F3   Write the file (asks for its name; Enter keeps it)',
  '  ^X  F2   Leave the editor (asks to save if there are changes)',
  '  ^K       Cut the current line (several in a row cut together)',
  '  ^U       Paste back the lines cut last',
  '  ^C       Show the cursor position',
  '  ^G  F1   This help',
  '',
  'Only your home and /tmp can be written. A system file opens read-only.',
  '',
  'Press any key to go back to the file.',
];

export class Editor {
  private L: string[];
  private x = 0;
  private y = 0;
  private top = 0;
  private left = 0;
  private dirty = false;
  private cut: string[] = [];
  private cutting = false;
  private msg = '';
  private help = false;
  /** A question on the status line: the file's name to write, or whether to save before leaving. */
  private ask: null | { kind: 'name' | 'save'; input: string; exitAfter: boolean } = null;

  /**
   * `write` stores the text under a path and returns an error, or null; `exit` closes the editor.
   * `path` is '' for a new buffer with no name yet.
   */
  constructor(private path: string, text: string, private readonly ro: boolean,
    private write: (path: string, text: string) => string | null, private exit: () => void, private abs: (p: string) => string) {
    this.L = text.replace(/\n$/, '').split('\n');
    if (!this.L.length) this.L = [''];
    this.msg = !path ? 'New Buffer' : ro ? `File '${path}' is unwritable` : text ? `Read ${this.L.length} line${this.L.length === 1 ? '' : 's'}` : 'New File';
  }

  key(key: string, ctrl: boolean) {
    if (this.help) { this.help = false; return; }
    if (this.ask) { this.askKey(key, ctrl); return; }
    const k = ctrl ? key.toLowerCase() : key;
    const line = this.L[this.y];
    if (ctrl) {
      this.msg = '';
      if (k === 'o') this.ask = { kind: 'name', input: this.path, exitAfter: false };
      else if (k === 'x') this.leave();
      else if (k === 'g') this.help = true;
      else if (k === 'c') this.msg = `line ${this.y + 1}/${this.L.length} (${Math.round(((this.y + 1) / this.L.length) * 100)}%), col ${this.x + 1}/${line.length + 1}`;
      else if (k === 'k') {
        if (!this.cutting) this.cut = [];
        this.cut.push(line);
        if (this.L.length > 1) this.L.splice(this.y, 1); else this.L[0] = '';
        this.y = Math.min(this.y, this.L.length - 1); this.x = 0; this.dirty = true; this.cutting = true;
        this.fit(); return;
      } else if (k === 'u') { if (this.cut.length) { this.L.splice(this.y, 0, ...this.cut); this.y += this.cut.length; this.x = 0; this.dirty = true; } }
      this.cutting = false;
      this.fit(); return;
    }
    this.cutting = false;
    if (key === 'F1') { this.help = true; return; }
    if (key === 'F2') { this.leave(); return; }
    if (key === 'F3') { this.ask = { kind: 'name', input: this.path, exitAfter: false }; return; }
    switch (key) {
      case 'ArrowLeft': if (this.x > 0) this.x--; else if (this.y > 0) { this.y--; this.x = this.L[this.y].length; } break;
      case 'ArrowRight': if (this.x < line.length) this.x++; else if (this.y < this.L.length - 1) { this.y++; this.x = 0; } break;
      case 'ArrowUp': if (this.y > 0) this.y--; break;
      case 'ArrowDown': if (this.y < this.L.length - 1) this.y++; break;
      case 'Home': this.x = 0; break;
      case 'End': this.x = line.length; break;
      case 'PageUp': this.y = Math.max(0, this.y - (ROWS - 2)); break;
      case 'PageDown': this.y = Math.min(this.L.length - 1, this.y + (ROWS - 2)); break;
      case 'Enter': this.L.splice(this.y, 1, line.slice(0, this.x), line.slice(this.x)); this.y++; this.x = 0; this.dirty = true; break;
      case 'Backspace':
        if (this.x > 0) { this.L[this.y] = line.slice(0, this.x - 1) + line.slice(this.x); this.x--; this.dirty = true; }
        else if (this.y > 0) { const p = this.L[this.y - 1]; this.L.splice(this.y - 1, 2, p + line); this.y--; this.x = p.length; this.dirty = true; }
        break;
      case 'Delete':
        if (this.x < line.length) { this.L[this.y] = line.slice(0, this.x) + line.slice(this.x + 1); this.dirty = true; }
        else if (this.y < this.L.length - 1) { this.L.splice(this.y, 2, line + this.L[this.y + 1]); this.dirty = true; }
        break;
      case 'Tab': { const n = 8 - (this.x % 8); this.L[this.y] = line.slice(0, this.x) + ' '.repeat(n) + line.slice(this.x); this.x += n; this.dirty = true; break; }
      default:
        if (key.length === 1) { this.L[this.y] = line.slice(0, this.x) + key + line.slice(this.x); this.x++; this.dirty = true; }
    }
    this.fit();
  }
  private leave() {
    if (this.dirty) this.ask = { kind: 'save', input: '', exitAfter: true };
    else this.exit();
  }
  private askKey(key: string, ctrl: boolean) {
    const A = this.ask!;
    if ((ctrl && (key === 'c' || key === 'C')) || key === 'Escape') { this.ask = null; this.msg = 'Cancelled'; return; }
    if (A.kind === 'save') {
      if (key === 'y' || key === 'Y') this.ask = { kind: 'name', input: this.path, exitAfter: true };
      else if (key === 'n' || key === 'N') { this.ask = null; this.exit(); }
      return;
    }
    if (key === 'Enter') {
      const name = A.input.trim();
      if (!name) { this.ask = null; this.msg = 'Cancelled'; return; }
      const p = this.abs(name), err = this.write(p, this.L.join('\n') + '\n');
      this.ask = null;
      if (err) { this.msg = `Error writing ${name}: ${err}`; return; }
      this.path = name; this.dirty = false;
      this.msg = `Wrote ${this.L.length} line${this.L.length === 1 ? '' : 's'}`;
      if (A.exitAfter) this.exit();
      return;
    }
    if (key === 'Backspace') A.input = A.input.slice(0, -1);
    else if (key.length === 1 && A.input.length < 60) A.input += key;
  }
  /** Keep the cursor on its line and in view. */
  private fit() {
    this.x = Math.min(this.x, this.L[this.y].length);
    if (this.y < this.top) this.top = this.y;
    if (this.y >= this.top + ROWS) this.top = this.y - ROWS + 1;
    if (this.x < this.left) this.left = Math.max(0, this.x - 20);
    if (this.x >= this.left + W - 1) this.left = this.x - W + 21;
  }

  /** The screen, and where the cursor is on it (column, row). */
  cells(): { scr: Scr; cx: number; cy: number } {
    const s = new Scr(W, H, St.Ink);
    s.fill(0, 0, W, 1, St.Inverse);
    s.text(2, 0, 'OSPREY nano 2.0.7', St.Inverse);
    const name = this.path ? `File: ${this.path}` : 'New Buffer';
    s.text((W - name.length) >> 1, 0, name, St.Inverse);
    if (this.dirty) s.text(W - 10, 0, 'Modified', St.Inverse);
    else if (this.ro) s.text(W - 11, 0, 'Read-Only', St.Inverse);
    if (this.help) HELP.forEach((l, k) => s.text(0, TOP + k, l, k === 0 ? St.Bright : St.Ink));
    else for (let r = 0; r < ROWS; r++) {
      const l = this.L[this.top + r];
      if (l === undefined) break;
      const vis = l.slice(this.left, this.left + W);
      s.text(0, TOP + r, vis, St.Ink);
      if (this.left > 0 && l.length > this.left) s.text(0, TOP + r, '$', St.Dim);
      if (l.length > this.left + W) s.text(W - 1, TOP + r, '$', St.Dim);
    }
    let cx = this.x - this.left, cy = TOP + this.y - this.top;
    if (this.ask) {
      const q = this.ask.kind === 'save' ? 'Save modified buffer (ANSWERING "No" WILL DESTROY CHANGES) ? ' : `File Name to Write: ${this.ask.input}`;
      s.fill(0, STATUS, W, 1, St.Inverse);
      s.text(0, STATUS, q, St.Inverse);
      if (this.ask.kind === 'save') { this.keys(s, [['Y', 'Yes'], ['N', 'No'], ['^C', 'Cancel']], []); cx = q.length - 1; }
      else { this.keys(s, [['Enter', 'Write'], ['^C', 'Cancel']], []); cx = Math.min(W - 1, q.length); }
      cy = STATUS;
    } else {
      if (this.msg) { const m = `[ ${this.msg} ]`; s.text((W - m.length) >> 1, STATUS, m, St.Inverse); }
      this.keys(s, [['^G', 'Get Help'], ['^O', 'WriteOut'], ['^K', 'Cut Text'], ['^C', 'Cur Pos']], [['^X', 'Exit'], ['^U', 'UnCut Text'], ['F2', 'Exit'], ['F3', 'WriteOut']]);
    }
    if (this.help) { cx = -1; cy = -1; }
    return { scr: s, cx, cy };
  }
  private keys(s: Scr, a: [string, string][], b: [string, string][]) {
    [a, b].forEach((row, r) => row.forEach(([k, label], i) => {
      const x = i * 16;
      s.text(x, H - 2 + r, k, St.Inverse);
      s.text(x + k.length + 1, H - 2 + r, label, St.Ink);
    }));
  }
}
