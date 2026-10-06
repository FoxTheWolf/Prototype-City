import { type CharGrid } from '../render/grid';

/**
 * The earphones' inline remote (15.9d): a little capsule of black plastic on the cord, hanging at the
 * bottom of the view while the earphones are in and a song is loaded. Its buttons (volume down, back,
 * play or pause, forward, volume up) are clicked with the cursor free (Alt held, or the phone out), as a
 * thumb finds them on the wire. It takes the scene's light, as the watch does.
 */
export type RemoteBtn = 'vdown' | 'prev' | 'play' | 'next' | 'vup';
/** Where its buttons were drawn this frame: [x0, x1, y, button] on the interface grid. */
export const REMOTE_BTN: [number, number, number, RemoteBtn][] = [];
const PRESS_S = 0.15;
const press = { b: '' as RemoteBtn | '', at: -1 };
/** A button pressed (for its little flash). */
export function remotePressed(b: RemoteBtn, now: number) { press.b = b; press.at = now; }

type C3 = [number, number, number];
const SHELL: C3 = [26, 26, 30], RIM: C3 = [62, 62, 70], PRINT: C3 = [210, 210, 220], CORD: C3 = [40, 40, 44], LIT: C3 = [255, 255, 255];

export function drawRemote(g: CharGrid, playing: boolean, now: number, light: Float32Array) {
  REMOTE_BTN.length = 0;
  const L = [Math.max(0.25, light[0]), Math.max(0.25, light[1]), Math.max(0.25, light[2])];
  const lit = (c: readonly number[], k = 1): [number, number, number] => [c[0] * L[0] * k, c[1] * L[1] * k, c[2] * L[2] * k];
  // the printed symbols stay readable in the dark (white paint catches what little light there is)
  const ink: C3 = [PRINT[0] * Math.max(0.6, L[0]), PRINT[1] * Math.max(0.6, L[1]), PRINT[2] * Math.max(0.6, L[2])];
  const keys: [string, RemoteBtn][] = [['-', 'vdown'], ['|<', 'prev'], [playing ? '||' : '>', 'play'], ['>|', 'next'], ['+', 'vup']];
  const inner = keys.map(([s]) => s).join(' ');
  const w = inner.length + 4, x0 = (g.cols >> 1) + 4, y0 = g.rows - 5;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < g.cols && y < g.rows ? y * g.cols + x : -1);
  const cell = (x: number, y: number, c: string, fg: [number, number, number], bg?: [number, number, number]) => {
    const i = at(x, y);
    if (i < 0) return;
    if (bg) g.setBg(i, bg[0], bg[1], bg[2]);
    g.put(i, c.charCodeAt(0), fg[0], fg[1], fg[2]);
  };
  // the cord: down from the ears into the capsule's top, and on from its bottom to the pocket
  const cx = x0 + (w >> 1);
  for (let y = y0 - 3; y < y0; y++) cell(cx, y, '|', lit(CORD, 1.6));
  for (let y = y0 + 3; y < g.rows; y++) cell(cx, y, '|', lit(CORD, 1.6));
  // the capsule: rounded ends, its rim lit along the top
  for (let x = 0; x < w; x++) {
    const end = x === 0 || x === w - 1;
    cell(x0 + x, y0, end ? ' ' : '_', lit(RIM, 1.4), end ? undefined : lit(SHELL));
    cell(x0 + x, y0 + 2, end ? ' ' : '-', lit(RIM, 0.8), end ? undefined : lit(SHELL, 0.8));
  }
  cell(x0, y0 + 1, '(', lit(RIM, 1.3), lit(SHELL));
  cell(x0 + w - 1, y0 + 1, ')', lit(RIM, 0.9), lit(SHELL));
  cell(x0 + 1, y0 + 1, ' ', PRINT, lit(SHELL));
  cell(x0 + w - 2, y0 + 1, ' ', PRINT, lit(SHELL));
  let x = x0 + 2;
  for (const [s, b] of keys) {
    const flash = press.b === b && now - press.at < PRESS_S;
    for (let k = 0; k < s.length; k++) cell(x + k, y0 + 1, s[k], flash ? LIT : ink, lit(SHELL, flash ? 1.8 : 1));
    REMOTE_BTN.push([x, x + s.length - 1, y0 + 1, b]);
    x += s.length;
    if (x < x0 + w - 2) cell(x++, y0 + 1, ' ', PRINT, lit(SHELL));
  }
}
