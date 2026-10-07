import { glyphBit, plainGlyph } from '../render/brands';
import { Img, Paint, type C3 } from '../render/paint2d';

/**
 * The phone's screen in pixels (the phone's manual v2, section 6): a picture of its own, 240 x 432, laid on
 * the glass by the compositor over the screen's cells. It holds what the manual draws in pixels: the status
 * bar (18 px) on top, the footer (26 px) at the foot with the two actions as touch buttons, and a touch's
 * answer (what was touched lit ice-blue a moment). The apps of before still draw on the cells, in the
 * content area between them (CONTENT_Y0 to CONTENT_Y1), until each is drawn again in pixels.
 */
export const SCR_W = 240, SCR_H = 432, STATUS_H = 18, FOOT_H = 26;
/** The content area between the bars, where the cells lie (pixels from the screen's top: 32 rows of 12). */
export const CONTENT_Y0 = 20, CONTENT_Y1 = 404;
/** The footer's two touch buttons (pixels). */
export const FOOT_L = { x: 0, y: SCR_H - FOOT_H, w: 84, h: FOOT_H }, FOOT_R = { x: SCR_W - 84, y: SCR_H - FOOT_H, w: 84, h: FOOT_H };
export const ICE: C3 = [143, 211, 255];

/** The picture the compositor lays on the glass; clear where the cells show through. */
export const PHONE_PX = { img: new Img(SCR_W, SCR_H), ver: 0 };

/** What the status bar shows this frame (set by lcd.ts statusBar), and the footer's labels (softKeys). */
export const CHROME = {
  status: null as null | { bars: number; service: boolean; search: boolean; edge: boolean; gps: string; unread: boolean; wifi: number; phones: boolean; time: string; batt: number; charging: boolean; blink: boolean },
  soft: ['', ''] as [string, string],
};

/** A touch's answer: the rectangle lit (pixels) and until when (seconds). */
export const TAP = { x: 0, y: 0, w: 0, h: 0, until: 0 };
export function tapFlash(r: { x: number; y: number; w: number; h: number }, now: number) { Object.assign(TAP, r, { until: now + 0.16 }); }

/** Small text in the dot font (5 x 8, lower case too), s pixels a dot; bold draws it twice a pixel apart. Returns its width. */
export function ptext(P: Paint, x: number, y: number, s: string, c: C3, k = 1, bold = false): number {
  let cx = x;
  for (const ch of s) {
    // the degree sign, which the dot font lacks: a small ring on top
    if (ch === '°') { for (const [i, j] of [[1, 0], [0, 1], [2, 1], [1, 2]]) P.rect(cx + i * k, y + j * k, k, k, c); cx += 4 * k; continue; }
    const g = plainGlyph(ch);
    if (g) for (let j = 0; j < 8; j++) for (let i = 0; i < g.w; i++) if (glyphBit(g, i, j)) P.rect(cx + i * k, y + j * k, k + (bold ? 1 : 0), k, c);
    cx += (g ? g.w + 1 : 4) * k + (bold ? 1 : 0);
  }
  return cx - x;
}
export const ptextW = (s: string, k = 1, bold = false) => [...s].reduce((w, ch) => w + ((plainGlyph(ch) && ch !== '°' ? 6 : 4) * k + (bold ? 1 : 0)), 0);

/** The bars and the touch's answer over the picture (cleared first: the cells show through the rest, unless `page` paints it). `gain`: the eye's adaptation. */
export function paintChrome(now: number, gain: number, plain: C3 | null = null, page: ((P: Paint) => void) | null = null) {
  const I = PHONE_PX.img, P = new Paint(I);
  I.px.fill(0);
  // a screen drawn in pixels (pixpages.ts) under the bars, over the cells
  if (page && !plain) page(P);
  // off, or starting: no bars, the screen's own dark round the cells
  if (plain) { P.rect(0, 0, SCR_W, CONTENT_Y0, plain); P.rect(0, CONTENT_Y1, SCR_W, SCR_H - CONTENT_Y1, plain); PHONE_PX.ver++; return; }
  const S = CHROME.status;
  const W: C3 = [232, 244, 255], OFF: C3 = [74, 85, 96];
  // the status bar: dark, the signal's bars, the network, GPS, mail, Wi-Fi, earphones, the hour, the battery
  P.rect(0, 0, SCR_W, CONTENT_Y0, [8, 15, 20]);
  P.rect(0, 0, SCR_W, STATUS_H, [6, 10, 14]);
  if (S) {
    if (S.service) for (let i = 0; i < 4; i++) P.rect(6 + i * 5, 12 - i * 2.5, 3, 3 + i * 2.5, i < S.bars ? W : OFF);
    else if (!S.search || S.blink) ptext(P, 6, 5, 'x', [255, 120, 90]);
    let x = 30;
    x += ptext(P, x, 5, S.edge ? 'EDGE' : '', S.blink ? [255, 196, 90] : W) + 4;
    if (S.gps) x += ptext(P, x, 5, 'GPS', S.gps === 'fix' ? [120, 255, 150] : S.gps === 'search' ? [255, 220, 120] : [110, 110, 110]) + 4;
    if (S.unread) { P.rect(x, 6, 9, 6, S.blink ? [255, 196, 90] : W); P.line(x, 6, x + 4.5, 9.5, 1, [6, 10, 14]); P.line(x + 9, 6, x + 4.5, 9.5, 1, [6, 10, 14]); x += 13; }
    if (S.wifi >= 0) { x += ptext(P, x, 5, 'W', [150, 230, 255]); for (let b = 0; b < 3; b++) P.rect(x + 1 + b * 3, 11 - b * 2, 2, 2 + b * 2, b < S.wifi ? [150, 230, 255] : OFF); x += 13; }
    if (S.phones) { P.ring(x + 4, 9, 4, 1.2, [200, 160, 255]); x += 12; }
    const tw = ptextW(S.time);
    ptext(P, 202 - tw, 5, S.time, W);
    // the battery: its outline, its nub, its level (red when low; climbing while it charges)
    const lv = S.charging ? (Math.floor(now * 2) % 5) / 4 : S.batt, BC: C3 = S.batt < 0.15 && !S.charging ? [255, 120, 90] : W;
    P.rect(208, 5, 22, 1, W); P.rect(208, 13, 22, 1, W); P.rect(208, 5, 1, 9, W); P.rect(229, 5, 1, 9, W); P.rect(230, 8, 2, 3, W);
    P.rect(210, 7, Math.round(18 * Math.max(0, Math.min(1, lv))), 5, BC);
  }
  // the footer: a gradient, the ice line on top, the two actions as buttons on the glass
  const [l, r] = CHROME.soft, y0 = SCR_H - FOOT_H;
  P.rect(0, CONTENT_Y1, SCR_W, y0 - CONTENT_Y1, [8, 15, 20]);
  P.grad(0, y0, SCR_W, FOOT_H, [[0, [27, 42, 54]], [1, [10, 17, 24]]]);
  P.rect(0, y0, SCR_W, 1, ICE);
  for (const [s, B] of [[l, FOOT_L], [r, FOOT_R]] as const) {
    if (!s) continue;
    P.rrect(B.x + 4, B.y + 4, B.w - 8, B.h - 8, 5, ICE, 0.12);
    ptext(P, B.x + Math.round((B.w - ptextW(s, 1, true)) / 2), B.y + 9, s, W, 1, true);
  }
  // the touch's answer
  if (now < TAP.until) for (let y = Math.max(0, TAP.y); y < Math.min(SCR_H, TAP.y + TAP.h); y++) for (let x = Math.max(0, TAP.x); x < Math.min(SCR_W, TAP.x + TAP.w); x++) {
    // over the bars, mixed in; over the cells (clear here), a see-through ice
    const k = (y * SCR_W + x) * 4, A = I.px;
    if (A[k + 3]) for (let c = 0; c < 3; c++) A[k + c] += (ICE[c] - A[k + c]) * 0.38;
    else { A[k] = ICE[0]; A[k + 1] = ICE[1]; A[k + 2] = ICE[2]; A[k + 3] = 97; }
  }
  // the eye: the same adaptation as the cells
  if (gain !== 1) for (let k = 0; k < I.px.length; k += 4) if (I.px[k + 3] === 255) { I.px[k] *= gain; I.px[k + 1] *= gain; I.px[k + 2] *= gain; }
  PHONE_PX.ver++;
}
