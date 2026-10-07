import { dark, hex, lite, mixC, Paint, paintMap, photoOf, star } from '../render/paint2d';
import { CH, CW } from './chrome';
import { type HdOp } from './page';

/**
 * 15.17e: a page's pixels (the operations its layout returned, page.ts) painted by the 2D painter, from
 * the manual's kit (docs/identidade/ferret-manual.html, "K"): the Web 2.0 shine, the 2001 bevels, the
 * tabs, the boxes, the tiles round the column, the photos and the banner ads. (x, y): the page cell
 * (0, 0) on the screen in pixels; `now` runs the blinking button and the marquee.
 */
export function paintOps(P: Paint, ops: readonly HdOp[], X: number, Y: number, now: number) {
  const px = (x: number) => X + x * CW, py = (y: number) => Y + y * CH;
  for (const o of ops) {
    switch (o.k) {
      case 'gloss':
        P.grad(px(o.x), py(o.y), o.w * CW, o.h * CH, [[0, lite(o.col, 0.34)], [0.5, lite(o.col, 0.1)], [0.5, o.col], [1, dark(o.col, 0.16)]], true, o.r ?? 0);
        if (!o.r) P.rect(px(o.x), py(o.y + o.h) - 1, o.w * CW, 1, dark(o.col, 0.35));
        break;
      case 'fade': P.grad(px(o.x), py(o.y), o.w * CW, o.h * CH, [[0, o.c1], [1, o.c2]]); break;
      case 'bevel': {
        const x0 = px(o.x), y0 = py(o.y), W = o.w * CW, H = o.h * CH, hi = lite(o.col, 0.6), lo = dark(o.col, 0.5);
        P.grad(x0, y0, W, H, [[0, lite(o.col, o.down ? 0 : 0.18)], [1, dark(o.col, o.down ? 0.1 : 0.06)]]);
        P.rect(x0, y0, W, 1, o.down ? lo : hi); P.rect(x0, y0, 1, H, o.down ? lo : hi);
        P.rect(x0, y0 + H - 1, W, 1, o.down ? hi : lo); P.rect(x0 + W - 1, y0, 1, H, o.down ? hi : lo);
        break;
      }
      case 'box': {
        const x0 = px(o.x), y0 = py(o.y), W = o.w * CW, H = o.h * CH;
        P.rrect(x0, y0, W, H, 4, o.stroke); P.rrect(x0 + 1, y0 + 1, W - 2, H - 2, 3, o.fill);
        if (o.head) { P.grad(x0 + 1, y0 + 1, W - 2, CH - 1, [[0, lite(o.head, 0.3)], [1, o.head]], true, 3); P.rect(x0 + 1, y0 + CH - 4, W - 2, 3, o.head); }
        break;
      }
      case 'tab': {
        const x0 = px(o.x) - CW / 2, x1 = px(o.x + o.w) + CW / 2, y0 = py(o.y) + (o.on ? 0 : 2), y1 = py(o.y + 1) + (o.on ? 1 : 0), r = 5;
        // (only the top corners round: the tab stands on the line under it; the open one runs into the page)
        const save = P.y1;
        P.y1 = Math.min(P.y1, y1);
        P.rrect(x0, y0, x1 - x0, y1 - y0 + r, r, dark(o.col, o.on ? 0.25 : 0.35));
        if (o.on) P.rrect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 + r, r - 1, o.col);
        else P.grad(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 + r, [[0, lite(o.col, 0.3)], [1, o.col]], true, r - 1);
        P.y1 = save;
        break;
      }
      case 'shadow': {
        const y0 = py(o.y), H = o.h * CH;
        for (let i = 0; i < 10; i++) { const a = 0.3 * (1 - i / 10); P.rect(px(o.x) - 1 - i, y0, 1, H, [0, 0, 0], a); P.rect(px(o.x + o.w) + i, y0, 1, H, [0, 0, 0], a); }
        break;
      }
      case 'tile': {
        const c2 = (o.col[0] * 0.3 + o.col[1] * 0.59 + o.col[2] * 0.11) > 128 ? dark(o.col, 0.08) : lite(o.col, 0.1), s = CH;
        const cx0 = px(o.x0), cx1 = px(o.x0 + o.w0);
        // only the pixels inside the clip (the page in view), not the whole page
        for (let y = Math.max(P.y0, py(o.y)); y < Math.min(P.y1, py(o.y + o.h)); y++) for (let x = Math.max(P.x0, px(o.x)); x < Math.min(P.x1, px(o.x + o.w)); x++) {
          if (x >= cx0 && x < cx1) continue;
          const i = ((x % s) + s) % s, j = ((y % s) + s) % s;
          let on = false;
          if (o.kind === 'stripes') on = i < s / 2;
          else if (o.kind === 'dots') on = (i - s / 2) ** 2 + (j - s / 2) ** 2 < (s * 0.13) ** 2;
          else if (o.kind === 'checks') on = (i < s / 2) !== (j < s / 2);
          else if (o.kind === 'diag') on = Math.abs(((i + j) % s) - s / 2) < s * 0.08;
          else on = ((x * 7 + y * 13) % 97) === 0 || ((x * 3 + y * 5) % 211) === 0;
          if (on) P.dot(x, y, o.kind === 'stars' ? [255, 246, 168] : c2);
        }
        break;
      }
      case 'btn': {
        const x0 = px(o.x) - CW * 0.4, y0 = py(o.y) + 1, W = (o.w + 0.8) * CW, H = CH - 2;
        P.rrect(x0, y0, W, H, H / 2, dark(o.col, 0.4));
        P.grad(x0 + 1, y0 + 1, W - 2, H - 2, [[0, lite(o.col, 0.35)], [0.48, o.col], [0.52, dark(o.col, 0.12)], [1, lite(o.col, 0.1)]], true, H / 2 - 1);
        P.rrect(x0 + H * 0.45, y0 + 2, W - H * 0.9, H * 0.22, H * 0.11, [255, 255, 255], 0.32);
        break;
      }
      case 'field': P.rect(px(o.x) - 1, py(o.y) + 1, o.w * CW + 2, CH - 2, hex('#7f9db9')); P.rect(px(o.x), py(o.y) + 2, o.w * CW, CH - 4, [255, 255, 255]); P.rect(px(o.x), py(o.y) + 2, o.w * CW, 1, [0, 0, 0], 0.12); break;
      case 'hr': {
        const y0 = py(o.y) + CH / 2, x0 = px(o.x), W = o.w * CW;
        if (o.kind === 'rainbow') P.grad(x0, y0 - 2, W, 4, [[0, hex('#ff2a2a')], [0.2, hex('#ffa020')], [0.4, hex('#fff020')], [0.6, hex('#20d040')], [0.8, hex('#2080ff')], [1, hex('#c040ff')]], false);
        else if (o.kind === 'dots') for (let x = x0; x < x0 + W; x += 4) P.dot(x, Math.round(y0), o.col);
        else { P.rect(x0, y0 - 1, W, 1, dark(o.col, 0.2)); P.rect(x0, y0, W, 1, lite(o.col, 0.75)); }
        break;
      }
      case 'photo': {
        const x0 = px(o.x), y0 = py(o.y), W = o.w * CW, H = o.h * CH, img = photoOf(Math.max(10, Math.round(o.w * 4)), Math.max(8, Math.round(o.h * 7)), o.subj, o.seed);
        if (o.frame === 'white') { P.rect(x0 + 1, y0 + 2, W + 2, H + 2, [0, 0, 0], 0.22); P.rect(x0 - 2, y0 - 2, W + 4, H + 4, hex('#c4c4c4')); P.rect(x0 - 1, y0 - 1, W + 2, H + 2, [255, 255, 255]); }
        else if (o.frame === 'line') P.rect(x0 - 1, y0 - 1, W + 2, H + 2, hex('#888888'));
        P.image(img, x0, y0, W, H);
        // the Web 2.0 reflection: the picture upside down under it, fading out
        if (o.reflect) {
          const rh = Math.round(H * 0.45);
          for (let j = 0; j < rh; j++) {
            const sy = img.h - 1 - Math.floor((j * img.h) / H), a = 0.4 * (1 - j / rh);
            for (let i = 0; i < Math.round(W); i++) { const k = (sy * img.w + Math.floor((i * img.w) / W)) * 4; P.dot(Math.round(x0) + i, Math.round(y0 + H) + 1 + j, [img.px[k], img.px[k + 1], img.px[k + 2]], a); }
          }
        }
        break;
      }
      case 'ad': {
        const x0 = px(o.x), y0 = py(o.y), W = o.w * CW, H = o.h * CH;
        P.rect(x0, y0, W, H, dark(o.c1, 0.5));
        P.grad(x0 + 1, y0 + 1, W - 2, H - 2, [[0, lite(o.c1, 0.25)], [1, dark(o.c1, 0.2)]]);
        P.rect(x0 + 1, y0 + 1, W - 2, H * 0.45, [255, 255, 255], 0.12);
        for (let k = 0; k < 6; k++) P.poly(star(x0 + W * (0.42 + k * 0.07), y0 + H * (k % 2 ? 0.3 : 0.7), H * 0.09, H * 0.035, 4), [255, 255, 255], 0.35);
        const big = H > 50 ? 3 : 2;
        P.text(x0 + H * 0.3, y0 + H * 0.16, o.name.toUpperCase().slice(0, Math.floor((W * 0.66) / (6 * big))), big, o.c2);
        if (o.slogan) P.text(x0 + H * 0.3, y0 + H * 0.66, o.slogan.toUpperCase().slice(0, Math.floor((W * 0.66) / 6)), 1, [255, 255, 255]);
        // the button that blinks (half a second on, half off, by the game's clock)
        const bw = Math.min(W * 0.28, H * 2.3), bx = x0 + W - bw - H * 0.2, on = Math.floor(now * 2) % 2 === 0;
        P.rrect(bx, y0 + H * 0.22, bw, H * 0.56, H * 0.28, on ? o.c2 : mixC(o.c2, o.c1, 0.6));
        const lab = 'CLICK HERE!', lw = Paint.textW(lab, 1);
        P.text(bx + (bw - lw) / 2, y0 + H * 0.5 - 3, lab, 1, o.c1);
        break;
      }
      case 'burst': {
        const cx = px(o.x), cy = py(o.y), R = 1.6 * CH;
        P.poly(star(cx, cy, R, R * 0.76, 14), dark(o.col, 0.4));
        P.poly(star(cx, cy, R - 1.5, R * 0.76 - 1.5, 14), o.col);
        const w = Paint.textW(o.text, 2);
        P.text(cx - w / 2, cy - 7, o.text, 2, [255, 255, 255]);
        break;
      }
      case 'rss': {
        const s = CH * 0.8, x0 = px(o.x), y0 = py(o.y) + CH * 0.1;
        P.grad(x0, y0, s, s, [[0, hex('#f8a53a')], [1, hex('#e2650f')]], true, s * 0.2);
        P.disc(x0 + s * 0.28, y0 + s * 0.72, s * 0.1, [255, 255, 255]);
        // the two waves: quarter rings, cut to the icon's square
        const save = [P.x0, P.y0, P.x1, P.y1];
        P.x0 = Math.max(P.x0, Math.round(x0 + s * 0.2)); P.y0 = Math.max(P.y0, Math.round(y0 + s * 0.12)); P.x1 = Math.min(P.x1, Math.round(x0 + s * 0.9)); P.y1 = Math.min(P.y1, Math.round(y0 + s * 0.8));
        P.ring(x0 + s * 0.22, y0 + s * 0.78, s * 0.45, s * 0.12, [255, 255, 255]);
        P.ring(x0 + s * 0.22, y0 + s * 0.78, s * 0.7, s * 0.12, [255, 255, 255]);
        [P.x0, P.y0, P.x1, P.y1] = save;
        break;
      }
      case 'stars': for (let i = 0; i < 5; i++) { const cx = px(o.x) + CW * (i * 1.4 + 0.7), cy = py(o.y) + CH * 0.52; P.poly(star(cx, cy, CH * 0.44, CH * 0.19, 5), i < o.n ? hex('#b47a00') : hex('#aaaaaa')); P.poly(star(cx, cy, CH * 0.44 - 1, CH * 0.19 - 0.5, 5), i < o.n ? hex('#f2b51c') : hex('#d4d4d4')); } break;
      case 'map': {
        const x0 = px(o.x), y0 = py(o.y), W = o.w * CW, H = o.h * CH;
        P.rect(x0 - 1, y0 - 1, W + 2, H + 2, hex('#99aaaa'));
        P.image(paintMap(Math.round(o.w * 3), Math.round(o.h * 5), o.seed), x0, y0, W, H);
        o.pins.forEach((p, i) => {
          const fx = 0.2 + ((o.seed * (i + 3) * 0.37) % 1) * 0.6, fy = 0.35 + ((o.seed * (i + 7) * 0.23) % 1) * 0.45, x = x0 + W * fx, y = y0 + H * fy, s = CH * 0.55;
          P.poly([x, y, x - s * 0.7, y - s * 1.3, x - s * 0.5, y - s * 1.8, x, y - s * 2, x + s * 0.5, y - s * 1.8, x + s * 0.7, y - s * 1.3], hex('#8e1a12'));
          P.disc(x, y - s * 1.35, s * 0.62, hex('#e2352a'));
          P.text(x - 2, y - s * 1.35 - 3, p, 1, [255, 255, 255]);
        });
        break;
      }
      case 'marquee': {
        const x0 = px(o.x), W = o.w * CW, len = Paint.textW(o.text, 2), off = ((now * 60) % (W + len)), save = [P.x0, P.x1];
        P.x0 = Math.max(P.x0, x0); P.x1 = Math.min(P.x1, x0 + W);
        P.text(x0 + W - off, py(o.y) + 1, o.text, 2, o.col);
        [P.x0, P.x1] = save;
        break;
      }
      case 'big': {
        const s = Math.max(2, Math.round((o.size * CH) / 8)), x0 = px(o.x), y0 = py(o.y);
        if (o.kind === 'word') { P.text(x0 + 3, y0 + 3, o.text, s, [0, 0, 0], 0.6); P.text(x0, y0, o.text, s, hex('#ffa21a')); }
        else { P.text(x0 + 1, y0 + 2, o.text, s, [0, 0, 0], 0.25); P.text(x0, y0, o.text, s, o.col); }
        break;
      }
      case 'icon': {
        const R = CH * 0.92, cx = px(o.x) + R, cy = py(o.y) + R * 1.05;
        P.disc(cx, cy, R, dark(o.col, 0.35));
        P.grad(cx - R + 1, cy - R + 1, R * 2 - 2, R * 2 - 2, [[0, lite(o.col, 0.45)], [1, dark(o.col, 0.15)]], true, R - 1);
        const sym = { star: '*', pin: 'V', lock: 'L', mail: 'M', phone: 'T' }[o.kind];
        if (o.kind === 'star') P.poly(star(cx, cy, R * 0.55, R * 0.22, 5), [255, 255, 255]);
        else P.text(cx - 5, cy - 7, sym, 2, [255, 255, 255]);
        P.disc(cx, cy - R * 0.48, R * 0.72, [255, 255, 255], 0.3, R * 0.38);
        break;
      }
    }
  }
}

/** Whether ops are moving now (a blinking ad, a marquee): the frame's key then changes with the clock. */
export const animated = (ops: readonly HdOp[]) => ops.some((o) => o.k === 'ad' || o.k === 'marquee');
