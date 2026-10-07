import { dark, hex, Img, lite, mixC, Paint, paintMap, photoOf, star, type C3 } from '../render/paint2d';
import { CH, CW, icon } from './chrome';
import { type Face, type HdOp } from './page';

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
        // (a longer word, "25 MB!", in the small letters, to fit inside the star)
        const s = o.text.length > 4 ? 1 : 2, w = Paint.textW(o.text, s);
        P.text(cx - w / 2, cy - 3.5 * s, o.text, s, [255, 255, 255]);
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
        P.image(o.ground ? groundMap(o.ground, o.gw!, o.gh!) : paintMap(Math.round(o.w * 3), Math.round(o.h * 5), o.seed), x0, y0, W, H);
        o.pins.forEach((p, i) => {
          // the city's own map has its pin in the middle (the place); a made-up one scatters them
          const fx = o.ground ? 0.5 : 0.2 + ((o.seed * (i + 3) * 0.37) % 1) * 0.6, fy = o.ground ? 0.55 : 0.35 + ((o.seed * (i + 7) * 0.23) % 1) * 0.45, x = x0 + W * fx, y = y0 + H * fy, s = CH * 0.55;
          P.poly([x, y, x - s * 0.7, y - s * 1.3, x - s * 0.5, y - s * 1.8, x, y - s * 2, x + s * 0.5, y - s * 1.8, x + s * 0.7, y - s * 1.3], hex('#8e1a12'));
          P.disc(x, y - s * 1.35, s * 0.62, hex('#e2352a'));
          P.text(x - 2, y - s * 1.35 - 3, p, 1, [255, 255, 255]);
        });
        break;
      }
      case 'broken': {
        const x0 = px(o.x), y0 = py(o.y), W = o.w * CW, H = o.h * CH;
        P.rect(x0, y0, W, 1, hex('#a0a0a0')); P.rect(x0, y0 + H - 1, W, 1, hex('#a0a0a0')); P.rect(x0, y0, 1, H, hex('#a0a0a0')); P.rect(x0 + W - 1, y0, 1, H, hex('#a0a0a0'));
        const ix = x0 + 3, iy = y0 + 3;
        P.rect(ix, iy, 10, 11, hex('#8a8a8a')); P.rect(ix + 1, iy + 1, 8, 9, [255, 255, 255]);
        P.line(ix + 2.5, iy + 3, ix + 7.5, iy + 8, 1.5, hex('#d01010')); P.line(ix + 7.5, iy + 3, ix + 2.5, iy + 8, 1.5, hex('#d01010'));
        break;
      }
      case 'blink': {
        if (Math.floor(now * 2) % 2) break;
        const tw = Paint.textW(o.text, 1);
        P.text(px(o.x) + (o.w * CW - tw) / 2, py(o.y) + 4, o.text, 1, o.col);
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
        const s = R * 0.5, wh: C3 = [255, 255, 255];
        if (o.kind === 'star') P.poly(star(cx, cy, s * 1.1, s * 0.45, 5), wh);
        else if (o.kind === 'pin') { P.poly([cx, cy + s * 1.1, cx - s * 0.75, cy - s * 0.1, cx - s * 0.55, cy - s * 0.8, cx, cy - s * 1.1, cx + s * 0.55, cy - s * 0.8, cx + s * 0.75, cy - s * 0.1], wh); P.disc(cx, cy - s * 0.35, s * 0.3, o.col); }
        else if (o.kind === 'phone') { P.rrect(cx - s * 0.55, cy - s, s * 1.1, s * 2, s * 0.25, wh); P.rect(cx - s * 0.35, cy - s * 0.75, s * 0.7, s * 1.05, o.col); P.disc(cx, cy + s * 0.65, s * 0.13, o.col); }
        else if (o.kind === 'lock') { P.ring(cx, cy - s * 0.15, s * 0.5, s * 0.18, wh); P.rrect(cx - s * 0.8, cy - s * 0.1, s * 1.6, s * 1.1, s * 0.2, wh); }
        else { P.rect(cx - s, cy - s * 0.65, s * 2, s * 1.3, wh); P.line(cx - s, cy - s * 0.6, cx, cy + s * 0.1, s * 0.15, o.col); P.line(cx + s, cy - s * 0.6, cx, cy + s * 0.1, s * 0.15, o.col); }
        P.disc(cx, cy - R * 0.48, R * 0.72, [255, 255, 255], 0.3, R * 0.38);
        break;
      }
      case 'ribbon': {
        // a little red tag tilted 14 degrees, the word in white over it
        const cx = px(o.x), cy = py(o.y), hw = CH * 1.2, hh = CH * 0.38, a = (-14 * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
        const pt = (u: number, v: number) => [cx + u * c - v * s, cy + u * s + v * c];
        const quad = (k: number) => [...pt(-hw - k, -hh - k), ...pt(hw + k, -hh - k), ...pt(hw + k, hh + k), ...pt(-hw - k, hh + k)];
        P.poly(quad(0.8), dark(o.col, 0.35)); P.poly(quad(0), o.col); P.poly([...pt(-hw, -hh), ...pt(hw, -hh), ...pt(hw, -hh * 0.1), ...pt(-hw, -hh * 0.1)], [255, 255, 255], 0.22);
        P.text(cx - Paint.textW(o.text, 1) / 2, cy - 3 - s * 2, o.text, 1, [255, 255, 255]);
        break;
      }
      case 'face': paintFace(P, o.face, px(o.x), py(o.y), o.w * CW, o.h * CH); break;
      case 'wx': {
        const R = CH * 0.9, cx = px(o.x) + R, cy = py(o.y) + R;
        const cloud = (x: number, y: number, k: number, col: C3) => { P.disc(x - k * 0.45, y + k * 0.1, k * 0.42, col); P.disc(x + k * 0.05, y - k * 0.2, k * 0.55, col); P.disc(x + k * 0.55, y + k * 0.12, k * 0.38, col); P.rect(x - k * 0.45, y + k * 0.1, k, k * 0.42, col); };
        if (o.sky === 'sun') { for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; P.line(cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62, cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95, 1.6, hex('#f0a800')); } P.disc(cx, cy, R * 0.5, hex('#e0a000')); P.disc(cx, cy, R * 0.44, hex('#f6c21c')); }
        else if (o.sky === 'moon') { P.disc(cx, cy, R * 0.66, hex('#f4e3a0')); P.disc(cx + R * 0.3, cy - R * 0.2, R * 0.56, o.bg); }
        else {
          if (o.sky === 'cloud') P.disc(cx + R * 0.35, cy - R * 0.35, R * 0.4, hex('#f6c21c'));
          cloud(cx, cy - R * 0.1, R * 1.05, hex('#9aa6bc')); cloud(cx, cy - R * 0.14, R * 0.98, o.sky === 'cloud' ? [255, 255, 255] : hex('#d8dee8'));
          if (o.sky === 'rain') for (let i = 0; i < 4; i++) P.line(cx - R * 0.5 + i * R * 0.34, cy + R * 0.45, cx - R * 0.62 + i * R * 0.34, cy + R * 0.85, 1.2, hex('#3a78d8'));
          if (o.sky === 'snow') for (let i = 0; i < 4; i++) P.disc(cx - R * 0.5 + i * R * 0.34, cy + R * (i % 2 ? 0.55 : 0.8), 1.4, hex('#7fa6d8'));
        }
        break;
      }
      case 'owl': icon(P, { k: 'look' }, px(o.x), py(o.y)); break;
      case 'folder': {
        // the phpBB folder: a tab on the left, the body; amber when there is something new
        const x0 = px(o.x), y0 = py(o.y) + CH * 0.35, s = CH * 0.95, col = o.lit ? hex('#e6b04a') : hex('#5a6068'), ink = o.lit ? hex('#8a6010') : hex('#2a2e34');
        const shape = (k: number) => [x0 - k, y0 - k, x0 + s * 0.4 + k, y0 - k, x0 + s * 0.52 + k, y0 + s * 0.14 - k, x0 + s * 1.22 + k, y0 + s * 0.14 - k, x0 + s * 1.22 + k, y0 + s * 0.9 + k, x0 - k, y0 + s * 0.9 + k];
        P.poly(shape(0.8), ink); P.poly(shape(0), col);
        P.rect(x0, y0 + s * 0.3, s * 1.22, s * 0.12, [255, 255, 255], o.lit ? 0.3 : 0.12);
        break;
      }
      case 'sectors': {
        const x0 = px(o.x), y0 = py(o.y), W = o.w * CW, H = o.h * CH, rws = Math.ceil(o.on.length / o.cols), bw = W / o.cols, bh = H / rws, NAVY = hex('#1d3a6e');
        P.rect(x0 - 2, y0 - 2, W + 4, H + 4, NAVY);
        o.on.forEach((on, k) => {
          const bx = x0 + (k % o.cols) * bw, by = y0 + Math.floor(k / o.cols) * bh;
          P.grad(bx + 1, by + 1, bw - 2, bh - 2, on ? [[0, hex('#7dd0f2')], [1, hex('#3aa6d8')]] : [[0, hex('#2a2e38')], [1, hex('#14161c')]]);
          if (!on) for (let i = 0; i < 3; i++) P.disc(bx + bw * (0.3 + i * 0.2), by + bh * 0.72, 1.5, hex('#ff6a13'));
          const lw = Paint.textW(o.labels[k] ?? '', 2);
          P.text(bx + (bw - lw) / 2, by + bh * 0.22, o.labels[k] ?? '', 2, on ? NAVY : hex('#8d8b84'));
        });
        break;
      }
      case 'gridlink': {
        // GRID in white over LINK in cyan; LINK starts under the I, and the I's stem runs down into the L's
        const s = o.s, x0 = px(o.x), y0 = py(o.y), step = 6 * s, lx = x0 + 2 * step + 2 * s;
        P.text(x0, y0, 'GRID', s, [255, 255, 255]);
        P.text(lx, y0 + 8 * s, 'LINK', s, hex('#3aa6d8'));
        P.rect(lx, y0 + 7 * s, s, s, hex('#3aa6d8'));
        break;
      }
    }
  }
}

/**
 * An avatar: the city's blocky head (the same 8 x 8 skin the people wear, 13.8) and shoulders, in the
 * person's own skin, hair, eyes and shirt, on a pale ground, framed; w x h pixels.
 */
function paintFace(P: Paint, F: Face, x0: number, y0: number, W: number, H: number) {
  const u = Math.min(W, H) / 8, ox = x0 + (W - u * 8) / 2, oy = y0 + (H - u * 8) / 2;
  const cell = (i: number, j: number, c: C3) => P.rect(ox + i * u, oy + j * u, u, u, c);
  P.rect(x0 - 1, y0 - 1, W + 2, H + 2, hex('#8a94a6'));
  P.rect(x0, y0, W, H, lite(F.shirt, 0.78));
  for (let j = 0; j < 6; j++) for (let i = 1; i < 7; i++) cell(i, j, F.skin);
  // the hair: a cap of it, down the sides when long; a bald head keeps its skin
  if (F.hairLen > 0) { for (let i = 1; i < 7; i++) cell(i, 0, F.hair); cell(1, 1, F.hair); cell(6, 1, F.hair); }
  if (F.hairLen > 1) for (let j = 1; j < 6; j++) { cell(0, j, F.hair); cell(7, j, F.hair); cell(1, j, F.hair); cell(6, j, F.hair); }
  // the eyes: white and the color, looking a little to the side
  cell(2, 3, [245, 245, 245]); cell(3, 3, F.eyes); cell(4, 3, [245, 245, 245]); cell(5, 3, F.eyes);
  if (F.beard) { cell(2, 5, F.hair); cell(5, 5, F.hair); cell(1, 4, F.hair); cell(6, 4, F.hair); }
  P.rect(ox + 3 * u, oy + 5 * u + u * 0.35, u * 2, u * 0.35, dark(F.skin, 0.35));
  // the neck and the shoulders in the shirt
  cell(3, 6, dark(F.skin, 0.12)); cell(4, 6, dark(F.skin, 0.12));
  for (let i = 0; i < 8; i++) { if (i < 3 || i > 4) cell(i, 6, F.shirt); cell(i, 7, F.shirt); }
}

/** Whether ops are moving now (a blinking ad or line, a marquee): the frame's key then changes with the clock. */
export const animated = (ops: readonly HdOp[]) => ops.some((o) => o.k === 'ad' || o.k === 'marquee' || o.k === 'blink');

/** The colors of the city's own map (the Lookwise Local look): out of the city (the sea), road, sidewalk, lot, building, park, plaza, yard. */
const GROUND: C3[] = [hex('#a7c8e6'), hex('#fbfaf5'), hex('#ece8de'), hex('#e8e1cf'), hex('#ddd0b4'), hex('#c6dfa8'), hex('#efe9dc'), hex('#e3dccb')];
const grounds = new Map<string, Img>();
/** A map picture from the city's ground (gw x gh digits), kept while the page is open. */
function groundMap(g: string, gw: number, gh: number): Img {
  let img = grounds.get(g);
  if (img) return img;
  img = new Img(gw, gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const c = GROUND[+g[j * gw + i]] ?? GROUND[0]; img.set(i, j, c[0], c[1], c[2]); }
  grounds.set(g, img);
  if (grounds.size > 16) grounds.delete(grounds.keys().next().value!);
  return img;
}
