import { Vox, type VoxMat } from '../render/voxels';
import { Img, Paint, star, type C3 } from '../render/paint2d';
import { hash3 } from '../core/rng';

/**
 * 15.20b: the notebook's body in little cubes of 2 mm, as the notebook's manual draws it
 * (docs/identidade/notebook-manual.html, section 1 and its drawDeck: 310 x 225 mm, the keyboard of 84 keys
 * at 19 mm, the amber nub between G, H and B with its three buttons, the touchpad and its two, the strip
 * of volume, mute, the lamp's key and the power button with its ring, the metal hinges, the Osprey's seal).
 * This file builds the deck (the lid comes next); the model's frame: x to the right, y from the hinge
 * toward the player, z up; a cell is 2 mm. Keys are their own palette entries (KEY0 + n) so one can sink
 * and be picked, as the phone's.
 */
export const CELL_MM = 2;
const W_MM = 310, D_MM = 225;
/** The deck's size in cells; its top face at z = TOP (18 mm), the keys' caps one cell proud. */
export const NX = Math.round(W_MM / CELL_MM), NY = Math.round(D_MM / CELL_MM), TOP = 9, NZ = TOP + 2;

/** Palette indices. */
export const enum M { Shell = 1, ShellWorn, Well, Hinge, Nub, NubTip, Button, Pad, PadStrip, Seal, SealInk, LedOn, LedOff, Ring, Bezel, Glass, Lamp, Latch, LedDisk, LedRadio, LedBatt }
export const KEY0 = 32;
/** The manual's colors (section 3). */
const GRAPHITE: C3 = [28, 29, 32], CAP: C3 = [35, 37, 40], WELL: C3 = [14, 15, 16], AMBER: C3 = [255, 154, 31], HINGE: C3 = [85, 89, 95], SEAL: C3 = [233, 230, 220];

/** The keyboard as the manual lays it: rows of [label, width in units] (0 = a gap); 15.5 units across. */
const ROWS: [string, number][][] = [
  [['Esc', 1], ['', 0.5], ['F1', 1], ['F2', 1], ['F3', 1], ['F4', 1], ['', 0.5], ['F5', 1], ['F6', 1], ['F7', 1], ['F8', 1], ['', 0.5], ['F9', 1], ['F10', 1], ['F11', 1], ['F12', 1], ['Del', 1]],
  [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['Bksp', 1.5], ['Home', 1]],
  [['Tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1], ['End', 1]],
  [['Caps', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['Enter', 1.75], ['PgUp', 1]],
  [['Shift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1], ['.', 1], ['/', 1], ['ShiftR', 2.25], ['PgDn', 1]],
  [['Fn', 1], ['Ctrl', 1.25], ['Alt', 1.25], [' ', 5.5], ['AltR', 1.25], ['CtrlR', 1.25], ['', 0.25], ['Left', 1], ['UpDown', 1], ['Right', 1]],
];
/** A label's key code (KeyboardEvent.code), so a key typed on the PC sinks on the model. */
const CODE: Record<string, string> = {
  Esc: 'Escape', Del: 'Delete', '`': 'Backquote', '-': 'Minus', '=': 'Equal', Bksp: 'Backspace', Home: 'Home', Tab: 'Tab', '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash',
  End: 'End', Caps: 'CapsLock', ';': 'Semicolon', "'": 'Quote', Enter: 'Enter', PgUp: 'PageUp', Shift: 'ShiftLeft', ShiftR: 'ShiftRight', ',': 'Comma', '.': 'Period', '/': 'Slash',
  PgDn: 'PageDown', Fn: 'Fn', Ctrl: 'ControlLeft', Alt: 'AltLeft', ' ': 'Space', AltR: 'AltRight', CtrlR: 'ControlRight', Left: 'ArrowLeft', UpDown: 'ArrowUp', Right: 'ArrowRight',
};
const codeOf = (l: string) => CODE[l] ?? (/^F\d+$/.test(l) ? l : /^\d$/.test(l) ? `Digit${l}` : `Key${l}`);
/** The keys most pressed by the previous owner: their caps shine (the manual, section 4). */
export const WORN = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Enter', 'Space', 'Backspace', 'ControlLeft']);

/** A key on the deck (mm): its code, its box, whether it is in the function row. */
export interface KeyBox { code: string; label: string; x0: number; y0: number; x1: number; y1: number }
/** The keyboard (manual: 15 mm from the left, 20 mm from the hinge, 280 mm wide; the function row 0.62 high). */
const KB_X = 15, KB_Y = 20, KB_W = 280, U = KB_W / 15.5, KH = U * 0.92;
export const KEYS: KeyBox[] = [];
{
  let y = KB_Y;
  ROWS.forEach((row, r) => {
    const h = r === 0 ? KH * 0.62 : KH;
    let x = KB_X;
    // each key inset 1 mm: a 2 mm gap, always one cell
    for (const [lab, w] of row) { if (lab) KEYS.push({ code: codeOf(lab), label: lab, x0: x + 1, y0: y + 1, x1: x + w * U - 1, y1: y + h - 1 }); x += w * U; }
    y += h;
  });
}
const KB_Y1 = KB_Y + KH * 5.62;
/** The nub, its buttons, the touchpad and its buttons, the top strip, the hinges, the seal (mm, from the manual's drawDeck). */
// between G, H and B, as the manual's text says (its drawing puts it a row lower, by the space bar)
const NUB = { x: KB_X + 6.75 * U, y: KB_Y + KH * 3.62, r: 2.6 };
const NUB_BY = KB_Y1 + 6, PAD = { x0: W_MM / 2 - 35, y0: NUB_BY + 11, x1: W_MM / 2 + 35, y1: NUB_BY + 55 };
export const PARTS: { id: string; x0: number; y0: number; x1: number; y1: number; round?: boolean }[] = [
  { id: 'nubL', x0: W_MM / 2 - 27, y0: NUB_BY, x1: W_MM / 2 - 5, y1: NUB_BY + 6 },
  { id: 'nubM', x0: W_MM / 2 - 4, y0: NUB_BY, x1: W_MM / 2 + 4, y1: NUB_BY + 6 },
  { id: 'nubR', x0: W_MM / 2 + 5, y0: NUB_BY, x1: W_MM / 2 + 27, y1: NUB_BY + 6 },
  { id: 'padL', x0: PAD.x0, y0: PAD.y1 + 2, x1: W_MM / 2 - 1, y1: PAD.y1 + 9 },
  { id: 'padR', x0: W_MM / 2 + 1, y0: PAD.y1 + 2, x1: PAD.x1, y1: PAD.y1 + 9 },
  { id: 'volDown', x0: 20, y0: 6, x1: 33, y1: 11.5 },
  { id: 'volUp', x0: 36, y0: 6, x1: 49, y1: 11.5 },
  { id: 'mute', x0: 52, y0: 6, x1: 65, y1: 11.5 },
  { id: 'lamp', x0: 244, y0: 6, x1: 257, y1: 11.5 },
  { id: 'power', x0: 270, y0: 4, x1: 280, y1: 14, round: true },
];

const inBox = (x: number, y: number, b: { x0: number; y0: number; x1: number; y1: number }) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1;
/** Whether (x, y) (mm) lies in the deck's outline, its corners rounded 4.5 mm. */
function inDeck(x: number, y: number) {
  const r = 4.5, cx = Math.min(Math.max(x, r), W_MM - r), cy = Math.min(Math.max(y, r), D_MM - r);
  return x >= 0 && y >= 0 && x < W_MM && y < D_MM && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** The deck's model; ids: the palette entry of every key and part, by its code or id. `down`: which sink. */
export function deckModel(down: (id: string) => boolean = () => false): { V: Vox; ids: Map<number, string> } {
  const V = new Vox(NX, NY, NZ), ids = new Map<number, string>(), C = CELL_MM;
  let next = KEY0;
  const idOf = new Map<string, number>();
  for (const k of KEYS) { if (!idOf.has(k.code)) { idOf.set(k.code, next); ids.set(next, k.code); next++; } }
  for (const p of PARTS) { idOf.set(p.id, next); ids.set(next, p.id); next++; }
  const wellX0 = KB_X - 3, wellX1 = KB_X + KB_W + 3, wellY0 = KB_Y - 3, wellY1 = KB_Y1 + 3;
  // the shell, solid to its top face; the keyboard's well sunk one cell
  V.draw(0, TOP, (x, y) => (inDeck(x * C, y * C) ? M.Shell : 0));
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const mx = (x + 0.5) * C, my = (y + 0.5) * C;
    if (mx > wellX0 && mx < wellX1 && my > wellY0 && my < wellY1) { V.set(x, y, TOP - 1, 0); V.set(x, y, TOP - 2, M.Well); }
    // the touchpad, a hair lower than the deck, its scroll strip at the right
    if (inBox(mx, my, PAD)) V.set(x, y, TOP - 1, mx > PAD.x1 - 5 ? M.PadStrip : M.Pad);
  }
  // the keys: a cap in the well, its top one cell over the deck (flush when pressed)
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const mx = (x + 0.5) * C, my = (y + 0.5) * C;
    const k = KEYS.find((b) => inBox(mx, my, b));
    if (k) { const id = idOf.get(k.code)!, z1 = down(k.code) ? TOP : TOP + 1; for (let z = TOP - 1; z < z1; z++) V.set(x, y, z, id); continue; }
    for (const p of PARTS) {
      if (p.round ? (mx - (p.x0 + p.x1) / 2) ** 2 + (my - (p.y0 + p.y1) / 2) ** 2 > ((p.x1 - p.x0) / 2) ** 2 : !inBox(mx, my, p)) continue;
      const id = idOf.get(p.id)!;
      if (p.id === 'power') {
        // the power button: a ring of light round a cap
        const ring = (mx - 275) ** 2 + (my - 9) ** 2 > 3.4 ** 2;
        V.set(x, y, TOP, ring ? M.Ring : id);
      } else if (down(p.id)) V.set(x, y, TOP - 1, id); else V.set(x, y, TOP, id);
    }
  }
  // the nub: amber, standing up between G, H and B
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const d = ((x + 0.5) * C - NUB.x) ** 2 + ((y + 0.5) * C - NUB.y) ** 2;
    if (d <= NUB.r ** 2) { V.set(x, y, TOP + 1, M.Nub); V.set(x, y, TOP, M.Nub); }
  }
  // the hinges at the back: two metal barrels standing over the deck
  for (const hx of [20, 264]) for (let x = Math.round(hx / C); x < Math.round((hx + 26) / C); x++) for (let y = 0; y < 2; y++) for (let z = TOP; z < TOP + 2; z++) V.set(x, y, z, M.Hinge);
  // the Osprey's seal on the palm rest (a decal will print the bird and the name on it)
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const mx = (x + 0.5) * C, my = (y + 0.5) * C; if (mx > 262 && mx < 290 && my > PAD.y1 - 12 && my < PAD.y1 - 1) V.set(x, y, TOP - 1, M.Seal); }
  return { V, ids };
}

/** The palette: the deck's materials, and each key and part (a pressed one darker, worn caps shining). */
export function deckPalette(ids: Map<number, string>, on: boolean, lampOn: boolean): VoxMat[] {
  const pal: VoxMat[] = [];
  pal[M.Shell] = { col: GRAPHITE, gloss: 0.12 };
  pal[M.ShellWorn] = { col: [34, 35, 38], gloss: 0.3 };
  pal[M.Well] = { col: WELL, gloss: 0.05 };
  pal[M.Hinge] = { col: HINGE, gloss: 0.55, metal: true };
  pal[M.Nub] = { col: AMBER, gloss: 0.05 };
  pal[M.NubTip] = { col: [255, 208, 138], gloss: 0.05 };
  pal[M.Button] = { col: [21, 22, 24], gloss: 0.1 };
  pal[M.Pad] = { col: [20, 21, 23], gloss: 0.08 };
  pal[M.PadStrip] = { col: [27, 28, 31], gloss: 0.08 };
  pal[M.Seal] = { col: SEAL, gloss: 0.2 };
  pal[M.LedOn] = { col: [90, 255, 120], gloss: 0.3, glow: true };
  pal[M.LedOff] = { col: [27, 42, 30], gloss: 0.3 };
  pal[M.Ring] = on ? { col: [90, 255, 120], gloss: 0.3, glow: true } : { col: [46, 48, 52], gloss: 0.2 };
  for (const [i, id] of ids) {
    pal[i] = id === 'lamp' && lampOn ? { col: [58, 51, 38], gloss: 0.2 } : /^(nub|pad)[LMR]$|^vol|^mute|^lamp|^power/.test(id) ? { col: [16, 17, 19], gloss: 0.12 }
      : { col: CAP, gloss: WORN.has(id) ? 0.4 : 0.15 };
  }
  return pal;
}

/**
 * The lid seen from inside (open), in the same frame: x to the right, y from its top edge down to the
 * hinge, z toward the eye; 8 mm thick (4 cells). The glass (286 x 179 mm, 12 mm from the sides, 20 from the
 * top) sunk one cell: the screen's picture is laid there (its own palette entry, as the phone's GLASS_MAT);
 * over it the keyboard's lamp and the two latches; under it, at the right, the four status LEDs (power,
 * disk, radio, battery). The maker's name goes on a decal at the left.
 */
export const LID_NZ = 4;
export const GLASS = { x0: 12, y0: 20, x1: 298, y1: 199 };
export function lidModel(): Vox {
  const V = new Vox(NX, NY, LID_NZ), C = CELL_MM;
  V.draw(0, LID_NZ - 1, (x, y) => (inDeck(x * C, y * C) ? M.Shell : 0));
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const mx = (x + 0.5) * C, my = (y + 0.5) * C;
    if (!inDeck(mx, my)) continue;
    const glass = inBox(mx, my, GLASS), rim = inBox(mx, my, { x0: GLASS.x0 - 1.5, y0: GLASS.y0 - 1.5, x1: GLASS.x1 + 1.5, y1: GLASS.y1 + 1.5 });
    // the frame stands one cell over the glass; a thin black bezel round it
    V.set(x, y, LID_NZ - 1, glass ? 0 : rim ? M.Bezel : M.Shell);
    if (glass) V.set(x, y, LID_NZ - 2, M.Glass);
    // the keyboard's lamp (top middle), the latches
    if (inBox(mx, my, { x0: 148, y0: 4, x1: 162, y1: 8 })) V.set(x, y, LID_NZ - 1, M.Lamp);
    if (inBox(mx, my, { x0: 35, y0: 2, x1: 45, y1: 5 }) || inBox(mx, my, { x0: 265, y0: 2, x1: 275, y1: 5 })) V.set(x, y, LID_NZ - 1, M.Latch);
    // the status LEDs under the glass, at the right: power, disk, radio, battery
    const leds = [M.LedOn, M.LedDisk, M.LedRadio, M.LedBatt];
    for (let i = 0; i < 4; i++) if ((mx - (205 + i * 13)) ** 2 + (my - 207.5) ** 2 <= 1.6 ** 2) V.set(x, y, LID_NZ - 1, leds[i]);
  }
  return V;
}
/** The lid's own entries over the deck's palette: the lamp lit or not, the LEDs by the machine's state. */
export function lidPalette(pal: VoxMat[], o: { on: boolean; lamp: boolean; disk: boolean; radio: boolean; charging: boolean }) {
  const led = (c: C3, lit: boolean, dim: C3): VoxMat => (lit ? { col: c, gloss: 0.3, glow: true } : { col: dim, gloss: 0.3 });
  pal[M.Bezel] = { col: [11, 11, 12], gloss: 0.4 };
  pal[M.Glass] = { col: o.on ? [10, 6, 2] : [18, 19, 21], gloss: 0.9 };
  pal[M.Lamp] = led([255, 233, 196], o.lamp, [42, 43, 46]);
  pal[M.Latch] = { col: [15, 16, 17], gloss: 0.2 };
  pal[M.LedOn] = led([90, 255, 120], o.on, [27, 42, 30]);
  pal[M.LedDisk] = led([255, 176, 48], o.on && o.disk, [43, 36, 22]);
  pal[M.LedRadio] = led([90, 255, 120], o.on && o.radio, [27, 42, 30]);
  pal[M.LedBatt] = led([255, 176, 48], o.charging, [43, 36, 22]);
  return pal;
}

/**
 * The lid's outside (the manual, section 4): grafite with wear (scratches, a rubbed corner), the maker's
 * name, and the one or two stickers the previous owner left, by the seed: a band of the city (circle,
 * banner or starburst), a business that exists in the simulation (a pill), or a symbol (a bolt, NO SIGNAL,
 * the waves); and the ghost of glue where one was peeled off. 1 pixel a millimetre (310 x 225); the GPU
 * lays it on the lid's back as a decal. Not turned yet (the manual tilts them up to 20 degrees).
 */
export function paintLidOutside(seed: number, maker: string, bands: readonly string[], shops: readonly string[]): { img: Img; names: string[] } {
  const img = new Img(W_MM, D_MM), P = new Paint(img), r = (k: number) => hash3(seed, 911, k);
  for (let y = 0; y < D_MM; y++) for (let x = 0; x < W_MM; x++) if (inDeck(x + 0.5, y + 0.5)) img.set(x, y, GRAPHITE[0], GRAPHITE[1], GRAPHITE[2]);
  for (let i = 0; i < 14; i++) { const x = 10 + r(i) * (W_MM - 30), y = 10 + r(i + 20) * (D_MM - 20), l = 3 + r(i + 40) * 20, a = r(i + 60) * Math.PI; P.line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 0.6, [52, 54, 59]); }
  // a rubbed corner: a quarter arc at the bottom left
  P.clip(0, D_MM - 20, 20, D_MM); P.ring(20, D_MM - 20, 18, 1.5, [58, 60, 65], 0.6); P.clip(0, 0, W_MM, D_MM);
  const mw = Paint.textW(maker.toUpperCase(), 1, 3);
  P.text(W_MM - 15 - mw, D_MM - 17, maker.toUpperCase(), 1, [123, 127, 134], 1, 3);
  const PALS: [C3, C3][] = [[[255, 106, 19], [26, 27, 30]], [[94, 200, 232], [13, 34, 48]], [[242, 213, 60], [26, 27, 30]], [[233, 75, 123], [255, 255, 255]], [[126, 224, 138], [16, 48, 26]]];
  const WHITE: C3 = [250, 248, 240], spots = [[80, 60], [240, 150], [70, 165]], names: string[] = [];
  const n = 1 + Math.floor(r(1) * 2);
  const lid = P;
  for (let i = 0; i < n; i++) {
    // each sticker drawn on its own little picture, then laid on the lid turned up to 20 degrees
    const S = new Img(100, 100), P = new Paint(S), cx = 50, cy = 50;
    const [bg, fg] = PALS[Math.floor(r(10 + i) * PALS.length)], kind = r(20 + i);
    const center = (s: string, y: number, sz: number, c: C3) => P.text(cx - Paint.textW(s, sz, sz) / 2, y, s, sz, c);
    if (kind < 0.45 && bands.length) {
      const name = bands[Math.floor(r(30 + i) * bands.length)], words = name.replace(/^The /, '').toUpperCase().split(' ');
      // round shapes hold words of up to 6 letters; a longer name goes on the banner, as wide as it needs
      const shape = words.some((w) => w.length > 6) ? 1 : Math.floor(r(40 + i) * 3);
      if (shape === 0) { P.disc(cx, cy, 22, WHITE); P.disc(cx, cy, 20, bg); words.forEach((w, k) => center(w, cy - 8 + k * 9, 1, fg)); }
      else if (shape === 1) { const t = words.join(' ').slice(0, 14), hw = Paint.textW(t, 1, 1) / 2 + 6; P.rrect(cx - hw - 2, cy - 10, hw * 2 + 4, 20, 3, WHITE); P.rrect(cx - hw, cy - 8, hw * 2, 16, 2, fg); center(t, cy - 3, 1, bg); }
      else { P.poly(star(cx, cy, 25, 20, 12), WHITE); P.disc(cx, cy, 17, bg); words.forEach((w, k) => center(w, cy - 8 + k * 9, 1, fg)); }
      names.push(name);
    } else if (kind < 0.8 && shops.length) {
      const name = shops[Math.floor(r(50 + i) * shops.length)];
      P.rrect(cx - 32, cy - 12, 64, 24, 12, WHITE); P.rrect(cx - 30, cy - 10, 60, 20, 10, bg); center(name.toUpperCase().slice(0, 9), cy - 3, 1, fg);
      names.push(name);
    } else {
      const sym = Math.floor(r(60 + i) * 3);
      if (sym === 0) { const b = [cx + 4, cy - 20, cx - 11, cy + 3, cx - 1, cy + 3, cx - 5, cy + 20, cx + 12, cy - 4, cx + 2, cy - 4]; P.poly(b.map((v, k) => v + (k & 1 ? 0 : 0)), WHITE); P.poly(b, bg); names.push('bolt'); }
      else if (sym === 1) { P.rrect(cx - 20, cy - 13, 40, 26, 3, WHITE); P.rect(cx - 18, cy - 11, 36, 22, [26, 27, 30]); [[255, 255, 255], [242, 213, 60], [94, 200, 232], [126, 224, 138], [233, 75, 123], [255, 106, 19]].forEach((c, k) => P.rect(cx - 15 + k * 5, cy - 7, 5, 11, c as unknown as C3)); names.push('NO SIGNAL'); }
      else { P.disc(cx, cy, 15, WHITE); P.disc(cx, cy, 13, bg); P.clip(0, 0, 100, cy + 5); for (const rr of [4, 7.5, 11]) P.ring(cx, cy + 5, rr, 1.5, fg); P.clip(0, 0, 100, 100); P.disc(cx, cy + 5, 1.5, fg); names.push('waves'); }
    }
    const [ox, oy] = spots[i], a = ((r(70 + i) - 0.5) * 40 * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    for (let y = oy - 60; y < oy + 60; y++) for (let x = ox - 60; x < ox + 60; x++) {
      const u = Math.round(ca * (x - ox) + sa * (y - oy) + 50), v = Math.round(-sa * (x - ox) + ca * (y - oy) + 50);
      if (!S.has(u, v)) continue;
      const k = (v * 100 + u) * 4;
      lid.dot(x, y, [S.px[k], S.px[k + 1], S.px[k + 2]]);
    }
  }
  // the ghost of a peeled sticker: a darker patch of glue
  lid.rrect(200, 70, 35, 23, 4, [42, 43, 47], 0.7);
  return { img, names };
}
