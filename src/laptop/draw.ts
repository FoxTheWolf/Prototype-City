import { type CharGrid } from '../render/grid';
import { computerMakerName } from '../locale/names';
import { type World } from '../sim/world';
import L from '../locale/laptop.en.json';
import { type Laptop } from './laptop';
import { TERM_H, TERM_W } from './shell';

/**
 * The notebook drawn over the view, low in the middle as if set down in front of the player: the
 * lid with its screen (the terminal), the hinge, and the keyboard deck in perspective, wider toward
 * the viewer, its keys going down as they are typed. The body sits in the scene's light; the screen
 * makes its own, amber or green.
 */
type C3 = [number, number, number];
/** The screen: the terminal plus the bezel around it. */
const SCR_W = TERM_W + 4, SCR_H = TERM_H + 3;
/** The keyboard: rows of [code, label, width in units]; every row is 15 units. */
const ROWS: [string, string, number][][] = [
  [['Escape', 'Esc', 1], ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n): [string, string, number] => [`F${n}`, `F${n}`, 1]), ['Delete', 'Del', 2]],
  [['Backquote', '`', 1], ...'1234567890'.split('').map((d): [string, string, number] => [`Digit${d}`, d, 1]), ['Minus', '-', 1], ['Equal', '=', 1], ['Backspace', 'Bksp', 2]],
  [['Tab', 'Tab', 1.5], ...'QWERTYUIOP'.split('').map((c): [string, string, number] => [`Key${c}`, c, 1]), ['BracketLeft', '[', 1], ['BracketRight', ']', 1], ['Backslash', '\\', 1.5]],
  [['CapsLock', 'Caps', 1.75], ...'ASDFGHJKL'.split('').map((c): [string, string, number] => [`Key${c}`, c, 1]), ['Semicolon', ';', 1], ['Quote', "'", 1], ['Enter', 'Enter', 2.25]],
  [['ShiftLeft', 'Shift', 2.25], ...'ZXCVBNM'.split('').map((c): [string, string, number] => [`Key${c}`, c, 1]), ['Comma', ',', 1], ['Period', '.', 1], ['Slash', '/', 1], ['ShiftRight', 'Shift', 2.75]],
  [['ControlLeft', 'Ctrl', 1.25], ['Fn', 'Fn', 1], ['MetaLeft', 'Sup', 1.25], ['AltLeft', 'Alt', 1.25], ['Space', '', 4.75], ['AltRight', 'Alt', 1.25], ['ControlRight', 'Ctrl', 1.25],
    ['ArrowLeft', '<', 1], ['ArrowUp', '^', 1], ['ArrowRight', '>', 1]],
];
/** The terminal's inks: amber, green; each normal, dim, bright. */
const INKS: C3[][] = [[[255, 176, 48], [170, 110, 34], [255, 214, 140]], [[90, 255, 120], [44, 160, 70], [190, 255, 200]]];
const SCREEN_BG: C3[] = [[10, 6, 2], [3, 9, 4]];
/** The BIOS's screen: light gray on black, as the firmware draws it before the system's own colors. */
const BIOS_INK: C3 = [196, 196, 200], BIOS_BG: C3 = [2, 2, 4];
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
function biosArt(put: (x: number, y: number, ch: number, fg: readonly number[], bg: readonly number[]) => void, sx: number, sy: number) {
  RIBBON.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] !== ' ') put(sx + c, sy + r, row.charCodeAt(c), [60, 110, 255], BIOS_BG); });
  const px = sx + TERM_W - 31;
  POWER.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] !== ' ') put(px + c, sy + r, row.charCodeAt(c), r >= 5 ? [70, 220, 90] : [255, 230, 40], BIOS_BG);
  });
}

export function drawLaptop(g: CharGrid, P: Laptop, world: World, now: number, light: Float32Array) {
  if (P.raise < 0.01) return;
  const S = P.shell, H = P.pc.hw, ink = INKS[S.ink], sbg = SCREEN_BG[S.ink];
  const Lr = Math.min(1.4, 0.25 + light[0]), Lg = Math.min(1.4, 0.25 + light[1]), Lb = Math.min(1.4, 0.25 + light[2]);
  const lit = (c: readonly number[], k = 1): C3 => [c[0] * Lr * k, c[1] * Lg * k, c[2] * Lb * k];
  // the whole object slides up from below the view; the deck runs off the bottom edge
  const ease = 1 - (1 - P.raise) ** 3, deckRows = 2 * ROWS.length + 5, total = SCR_H + 1 + deckRows;
  const y0 = Math.round(g.rows - total + 4 + (1 - ease) * (total + 2)), x0 = (g.cols - SCR_W) >> 1;
  const put = (x: number, y: number, ch: number, fg: readonly number[], bg: readonly number[]) => {
    if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return;
    const i = y * g.cols + x;
    g.put(i, ch, fg[0], fg[1], fg[2]); g.setBg(i, bg[0], bg[1], bg[2]);
  };
  const text = (x: number, y: number, s: string, fg: readonly number[], bg: readonly number[]) => { for (let k = 0; k < s.length; k++) put(x + k, y, s.charCodeAt(k), fg, bg); };
  const BODY = H.body, bodyC = lit(BODY), bezel = lit(BODY, 0.55), edgeC = lit([BODY[0] * 1.4 + 20, BODY[1] * 1.4 + 20, BODY[2] * 1.4 + 20]);

  const hingeY = y0 + SCR_H;
  // ---- the hinge and the deck ----
  for (let x = 0; x < SCR_W; x++) put(x0 + x, hingeY, 95, lit([BODY[0] * 0.4, BODY[1] * 0.4, BODY[2] * 0.4]), lit(BODY, 0.75));
  const deckTop = hingeY + 1;
  for (let r = 0; r < deckRows; r++) {
    // wider toward the viewer
    const w = SCR_W + 2 + Math.round(r * 1.1), dx = (g.cols - w) >> 1;
    for (let x = 0; x < w; x++) put(dx + x, deckTop + r, 32, bodyC, x === 0 || x === w - 1 ? edgeC : bodyC);
  }
  const keyFace = lit([34, 34, 38]), keySide = lit([16, 16, 18]), label = lit([190, 190, 196]);
  // the keys' shadows on the deck first (to their right, away from the light), then the keys over them
  const shade = lit(BODY, 0.5);
  ROWS.forEach((row, ri) => {
    const r = 1 + ri * 2, w = SCR_W - 2 + Math.round(r * 1.1), U = w / 15, dx = (g.cols - w) >> 1;
    let u = 0;
    for (const [, , wu] of row) {
      const a = dx + Math.round(u * U), b = dx + Math.round((u + wu) * U) - 1;
      u += wu;
      if (b > a) { put(b, deckTop + r, 32, shade, shade); put(b, deckTop + r + 1, 32, shade, shade); }
    }
  });
  ROWS.forEach((row, ri) => {
    const r = 1 + ri * 2, w = SCR_W - 2 + Math.round(r * 1.1), U = w / 15, dx = (g.cols - w) >> 1;
    let u = 0;
    for (const [code, lab, wu] of row) {
      const a = dx + Math.round(u * U), b = dx + Math.round((u + wu) * U) - 1, down = now - (P.pressed.get(code) ?? -9) < 0.12;
      u += wu;
      if (b <= a) continue;
      // a key: its face with the label on top, its side under it; pressed, the face sinks a row
      const fy = deckTop + r + (down ? 1 : 0), lx = a + ((b - a - lab.length) >> 1);
      for (let x = a; x < b; x++) {
        if (!down) put(x, deckTop + r + 1, 32, keySide, keySide);
        put(x, fy, 32, label, down ? lit([28, 28, 31]) : keyFace);
      }
      text(Math.max(a, lx), fy, lab.slice(0, b - a), down ? lit([255, 255, 255]) : label, down ? lit([28, 28, 31]) : keyFace);
    }
  });
  // the touchpad and its buttons
  const ty = deckTop + 2 * ROWS.length + 1, tw = 22, tx = (g.cols - tw) >> 1;
  for (let r = 0; r < 3; r++) for (let x = 0; x < tw; x++) put(tx + x, ty + r, 32, bodyC, r === 2 ? lit(BODY, 0.6) : lit(BODY, 0.85));
  for (let x = 0; x < tw; x++) put(tx + x, ty + 2, x === tw >> 1 ? 124 : 32, lit(BODY, 0.4), lit(BODY, 0.6));

  // ---- the lid: hinged at the back of the deck. Shut, it lies over the keyboard (its back, with the
  // maker's name, toward the viewer); it swings up through an angle, its far edge rising from near the
  // viewer (wide) past the hinge to upright (as wide as the screen) ----
  const th = (P.lid * Math.PI) / 2, D = 2 * ROWS.length + 1;
  const edge = hingeY - SCR_H * Math.sin(th) + D * Math.cos(th);
  const deckW = (y: number) => SCR_W + 2 + Math.round((y - hingeY - 1) * 1.1);
  const brand = computerMakerName(world.city, H.maker).toUpperCase();
  if (P.lid < 1) {
    if (edge > hingeY) {
      // its back, over the keys, wider toward the viewer
      const top = hingeY + 1, bot = Math.round(edge);
      for (let y = top; y <= bot; y++) {
        const w = deckW(y), dx = (g.cols - w) >> 1;
        for (let x = 0; x < w; x++) put(dx + x, y, 32, bodyC, y === bot || x === 0 || x === w - 1 ? edgeC : lit(BODY, 0.9 + 0.1 * ((y - top) / Math.max(1, bot - top))));
      }
      if (bot - top > 2) text((g.cols - brand.length) >> 1, (top + bot) >> 1, brand, lit([BODY[0] * 0.6 + 60, BODY[1] * 0.6 + 60, BODY[2] * 0.6 + 60]), lit(BODY, 0.95));
    } else {
      // past the hinge: its face, the bezel round a dark glass, foreshortened
      const top = Math.round(edge), n = hingeY - top;
      for (let y = top; y < hingeY; y++) {
        const f = (y - top) / Math.max(1, n), inGlass = f > 1.8 / Math.max(2, n) && f < 1 - 1 / Math.max(2, n);
        for (let x = 0; x < SCR_W; x++) {
          const glass = inGlass && x >= 2 && x < SCR_W - 2;
          put(x0 + x, y, 32, bodyC, y === top || x === 0 || x === SCR_W - 1 ? edgeC : glass ? lit([16 + 20 * f, 16 + 20 * f, 20 + 22 * f]) : bezel);
        }
      }
    }
  } else {
    for (let y = y0; y < hingeY; y++) for (let x = 0; x < SCR_W; x++) put(x0 + x, y, 32, bodyC, x === 0 || x === SCR_W - 1 || y === y0 ? edgeC : bezel);
  }
  if (P.lid >= 1) {
    const sx = x0 + 2, sy = y0 + 2, on = S.state !== 'off' && P.pc.bootAt >= 0;
    // the visible lines: the scrollback, then the prompt and what is being typed
    const lines = S.lines.slice(), ready = S.ready;
    let promptRow = -1;
    if (ready) {
      const s = S.prompt + S.input;
      for (let k = 0; k === 0 || k < s.length + 1; k += TERM_W) { lines.push({ text: s.slice(k, k + TERM_W), ink: 0 }); if (promptRow < 0) promptRow = lines.length - 1; }
    }
    const first = Math.max(0, lines.length - TERM_H - S.scroll);
    for (let r = 0; r < TERM_H; r++) {
      const ln = on ? lines[first + r] : undefined, scan = r & 1 ? 0.9 : 1;
      for (let c = 0; c < TERM_W; c++) {
        const ch = ln ? ln.text.charCodeAt(c) || 32 : 32, col = S.bios ? BIOS_INK : ink[ln?.ink ?? 0], k = scan, base = S.bios ? BIOS_BG : sbg;
        // a faint glow behind lit characters, as a CRT's phosphor spreads
        const bg: C3 = on ? (ch !== 32 ? [base[0] + col[0] * 0.07, base[1] + col[1] * 0.07, base[2] + col[2] * 0.07] : base) : [12, 12, 14];
        put(sx + c, sy + r, ch, [col[0] * k, col[1] * k, col[2] * k], bg);
      }
    }
    if (on && S.bios) biosArt(put, sx, sy);
    // the cursor: a block blinking where the next character goes
    if (on && ready && S.scroll === 0 && Math.floor(now * 2.5) & 1) {
      const pos = S.prompt.length + S.cur, row = lines.length - 1 - (Math.floor((S.prompt.length + S.input.length) / TERM_W) - Math.floor(pos / TERM_W)) - first;
      if (row >= 0 && row < TERM_H) put(sx + (pos % TERM_W), sy + row, 32, ink[0], ink[0]);
    }
    if (on && S.scroll > 0) text(sx + TERM_W - 14, sy, ` SCROLLBACK ${S.scroll} `.slice(0, 14), sbg, ink[1]);
    // powered off: a dark glass with the room in it, and the power button's hint
    if (!on) {
      text(sx + ((TERM_W - 24) >> 1), sy + (TERM_H >> 1), S.halted ? '[ENTER] POWER BUTTON' : '', [70, 70, 76], [12, 12, 14]);
      for (let r = 0; r < TERM_H; r++) put(sx + ((r * 3 + 10) % TERM_W), sy + r, 47, lit([60, 60, 70]), [14, 14, 16]);
    }
    // the bezel: the webcam on top, the maker's name below
    put(x0 + (SCR_W >> 1), y0, 111, [40, 40, 44], bezel);
    text(x0 + ((SCR_W - brand.length) >> 1), y0 + SCR_H - 1, brand, lit([150, 150, 156]), bezel);
    // the power light
    put(x0 + SCR_W - 4, y0 + SCR_H - 1, 46, on ? [120, 255, 140] : Math.floor(now * 0.8) & 1 ? [255, 170, 60] : [60, 40, 20], bezel);
    // the drive's activity light beside it: it flickers with every seek
    const busy = on && now - P.hddAt < 0.07 + 0.05 * ((now * 37) % 1);
    put(x0 + SCR_W - 6, y0 + SCR_H - 1, 46, busy ? [255, 190, 70] : [50, 36, 18], bezel);
  }

  // what to do, and where the player sat
  if (P.open && now - P.noticeAt < 3) text((g.cols - P.notice.length - 2) >> 1, Math.max(1, y0 - 2), ` ${P.notice} `, [255, 220, 140], [20, 16, 10]);
  else if (P.open && P.lid >= 1) text((g.cols - L.seat.close.length - 2) >> 1, Math.max(1, y0 - 2), ` ${L.seat.close} `, [150, 140, 120], [14, 12, 10]);
}
