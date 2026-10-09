import { AD_BG, AD_FG, AD_LETTER, FRAME_AD, LETTER_W, NETS, RAMP, SCAF_BOARD, SCAF_D, SCAF_STEEL, SCREEN_PAL, SHED_Z, SIGN_Z0, SIGN_Z1, TICK_LW, TICK_SPEED, TICK_Z0, TICK_Z1 } from '../../raycaster';
import { BULB_COLS, BULB_ROWS } from '../../signs';
import { CEIL, CELL as PCELL, DOOR, DOOR_H, WALL } from '../../../sim/interior';
import { FX_TAB, SG_BIZ, SG_FONT, SG_STARS, f, v3 } from './common';
import STARS from '../../stars.json';
import { SURGE } from '../../power';

export const signsWGSL = (): string => /* wgsl */ `// ---- signs (signs.ts and wallColumn): shop signs, painted ads, video screens, the news ticker
const LETTER_W = ${f(LETTER_W)}; const SIGN_Z0 = ${f(SIGN_Z0)}; const SIGN_Z1 = ${f(SIGN_Z1)}; const AD_LETTER = ${f(AD_LETTER)};
const TICK_Z0 = ${f(TICK_Z0)}; const TICK_Z1 = ${f(TICK_Z1)}; const TICK_LW = ${f(TICK_LW)}; const TICK_SPEED = ${f(TICK_SPEED)};
const BULB_COLS = ${f(BULB_COLS)}; const BULB_ROWS = ${f(BULB_ROWS)};
const SG_FONT = ${SG_FONT}u; const SG_BIZ = ${SG_BIZ}u; const SG_STARS = ${SG_STARS}u; const N_STARS = ${STARS.length}u;
const AD_BG = array<vec3f, ${AD_BG.length}>(${AD_BG.map(v3).join(', ')});
const AD_FG = array<vec3f, ${AD_FG.length}>(${AD_FG.map(v3).join(', ')});
const FRAME_AD = ${v3(FRAME_AD)};
const SCREEN_PAL = array<vec3f, ${SCREEN_PAL.length}>(${SCREEN_PAL.map(v3).join(', ')});
const RAMP = array<u32, ${RAMP.length}>(${RAMP.map((c) => `${c}u`).join(', ')});
const DOOR_H = ${f(DOOR_H)}; const FX_TAB = ${FX_TAB}u; const PCELL = ${f(PCELL)}; const CEIL = ${f(CEIL)}; const PDOOR = ${DOOR}u; const PWALL = ${WALL}u; const PEEK_FAR = 80.0;
// a window lit from afar keeps a glow of its color up close: how strong, and where it is gone
const DET_FADE = 2.0; // the far look gives way to the detailed one over a long band (0.7 to DET_FADE x tCut), so it never jumps
const WIN_GLOW = 0.45; const GLOW_NEAR = 35.0; const GLOW_FULL = 72.0;
const SCAF_D = ${f(SCAF_D)}; const SHED_Z = ${f(SHED_Z)}; const SCAF_STEEL = ${v3(SCAF_STEEL)}; const SCAF_BOARD = ${v3(SCAF_BOARD)};
const NETS = array<vec3f, ${NETS.length}>(${NETS.map(v3).join(', ')});
fn bulbOn(c: u32, bx: i32, by: i32) -> bool {
  if (bx < 0 || bx > 4 || by < 0 || by > 6) { return false; }
  return ((sgU(u32(SG_FONT + min(c, 255u) * 7u + u32(by))) >> u32(4 - bx)) & 1u) == 1u;
}
// the bulbs of letter c whose centers fall in a cell's footprint (center px, pz, half sizes hx, hz, in bulb units)
fn bulbsIn(c: u32, px: f32, pz: f32, hx: f32, hz: f32) -> u32 {
  var n = 0u;
  for (var by = max(0, i32(ceil(pz - hz - 0.5))); by <= min(6, i32(ceil(pz + hz - 0.5)) - 1); by++) {
    for (var bx = max(0, i32(ceil(px - hx - 0.5))); bx <= min(4, i32(ceil(px + hx - 0.5)) - 1); bx++) { if (bulbOn(c, bx, by)) { n++; } }
  }
  return n;
}
fn bulbGlyph(n: u32, hx: f32, hz: f32) -> u32 {
  if (n == 0u) { return 0u; }
  let spots = 4.0 * hx * hz;
  if (spots <= 1.5) { return select(111u, 64u, n > 1u); }
  let fr = f32(n) / spots;
  return select(select(58u, 111u, fr > 0.22), 64u, fr > 0.5);
}
fn bulbHue(c: vec3f) -> vec3f {
  let lo = min(c.x, min(c.y, c.z)) * 0.75; let hi = max(1.0, max(c.x, max(c.y, c.z)) - lo);
  return (c - vec3f(lo)) * (255.0 / hi);
}
// a business's sign text for a face that fits \`fit\` letters (signText): (pool offset, length)
fn bizText(biz: i32, fit: i32) -> vec2u {
  let o = SG_BIZ + u32(biz) * 3u; let full = sgU(u32(o));
  if (i32(full & 255u) <= fit) { return vec2u(full >> 8u, full & 255u); }
  let w = sgU(u32(o + 1u));
  return vec2u(w >> 8u, u32(min(i32(w & 255u), max(0, fit))));
}
fn signStutter(biz: i32, sec: f32) -> bool {
  return hash3(biz, ifloor(sec / 1.7), 5) < 0.35 && hash3(biz, ifloor(sec * 14.0), 6) < 0.5;
}
// brightness of letter k (-1: the whole sign) of a sign of mode \`mode\` whose full name is n letters (signLight)
fn signLight(biz: i32, mode: u32, k: i32, n: f32, sec: f32) -> f32 {
  let OFF = 0.12;
  if (mode == 1u) {
    let st = 0.22; let cycle = n * st + 2.2; let p = (sec + hash3(biz, 1, 1) * cycle) % cycle;
    if (p < n * st) { return select(select(OFF, 1.0, f32(k) <= p / st), 1.0, k < 0); }
    return select(OFF, 1.0, p < n * st + 1.6);
  }
  if (mode == 2u) { return select(OFF, 1.0, (sec + hash3(biz, 2, 2) * 1.3) % 1.3 < 0.85); }
  if (mode == 3u && k >= 0) {
    if (k == ifloor(hash3(biz, 3, 3) * n) && hash3(biz, 3, 4) < 0.5) { return OFF; }
    if (k == ifloor(hash3(biz, 4, 3) * n)) { return select(1.0, OFF, signStutter(biz, sec)); }
  }
  return 1.0;
}
struct Px { ch: u32, c: vec3f };
// one cell of video screen \`id\`, W x H metres, uu metres from its left edge (as read) and v down from its top (screenPixel)
fn screenPix(id: i32, uu: f32, v: f32, W: f32, H: f32, dAlong: f32, dz: f32) -> Px {
  let sec = u.sec;
  let scene = ifloor(sec / 6.0 + hash3(id, 0, 91) * 7.0);
  let kind = ifloor(hash3(id, scene, 92) * 3.0);
  let NP = ${SCREEN_PAL.length}.0;
  let a = SCREEN_PAL[ifloor(hash3(id, scene, 94) * NP)]; let b = SCREEN_PAL[ifloor(hash3(id, scene, 95) * NP)];
  let st = sec % 6.0;
  let px = floor(uu / 0.3) * 0.3; let pz = floor(v / 0.3) * 0.3;
  let nb = sgU(u32(2));
  if (kind == 0 && nb > 0u) {
    let tx = bizText(ifloor(hash3(id, scene, 93) * f32(nb)), max(1, ifloor((W - 1.0) / 1.2)));
    let n = f32(max(1u, tx.y)); let lw = min((W - 1.0) / n, (H * 0.55) / 1.4); let lh = lw * 1.4;
    let x0 = (W - n * lw) / 2.0; let y0 = (H - lh) / 2.0;
    let li = ifloor((uu - x0) / lw); let fu = ((uu - x0) / lw - f32(li)) * 1.25 - 0.12; let fv = (v - y0) / lh;
    let typed = li >= 0 && li < i32(tx.y) && f32(li) < st / 0.12;
    var lc = 32u; if (typed) { lc = sgU(u32(tx.x + u32(li))); }
    let on = typed && fu >= 0.0 && fu < 1.0 && fv >= 0.0 && fv < 1.0 && bulbOn(lc, ifloor(fu * 5.0), ifloor(fv * 7.0));
    let glyphs = lw / dAlong >= 3.0 && lh / dz >= 2.6;
    if (!glyphs && lw / dAlong >= 0.9 && typed && abs(uu - x0 - (f32(li) + 0.5) * lw) < dAlong / 2.0 && abs(v - H / 2.0) < dz / 2.0 + 0.01) {
      return Px(lc, vec3f(255.0, 250.0, 235.0));
    }
    let lit = on && glyphs;
    return Px(select(COL, HASH, lit), select(a, vec3f(255.0, 250.0, 235.0), lit) * select(0.3 + 0.25 * (pz / H), 1.0, lit));
  } else if (kind == 1) {
    // plasma: three moving waves, mapped to a ramp of glyphs and blended between two colors
    let val = (sin(px * 0.9 + sec * 1.3 + f32(scene)) + sin(pz * 1.1 - sec * 0.9) + sin((px + pz) * 0.6 + sec * 2.1)) / 6.0 + 0.5;
    return Px(RAMP[min(${RAMP.length - 1}, ifloor(val * ${RAMP.length}.0))], (a * (1.0 - val) + b * val) * (0.25 + 0.75 * val));
  }
  // diagonal bars of color sweeping across, with a bright band
  let s = (px + pz * 0.6 - sec * 3.0) / 1.5; let band = ((s % 3.0) + 3.0) % 3.0;
  var col = vec3f(30.0, 30.0, 40.0); if (band < 1.0) { col = a; } else if (band < 2.0) { col = b; }
  return Px(select(COL, select(HASH, AT, band % 1.0 < 0.15), band < 2.0), col * select(0.6, 0.75 + 0.25 * sin(s * 3.0), band < 2.0));
}
/** Whether a video screen on substation sub's power shows the crash screen now: for half a second before the
 *  power goes (and through its flicker), and for a few seconds after it comes back, as it reboots (timed as power()). */
fn bsod(sub: i32, x: f32, y: f32, id: i32, spread: f32) -> bool {
  let o = u32(sub) * 4u;
  let changed = subsF(u32(o));
  if (changed < 0.0) { return false; }
  let since = u.sec - changed; let d = length(vec2f(x - subsF(u32(o + 2u)), y - subsF(u32(o + 3u))));
  let hb = hash3(id, sub, 404); let hw = hash3(id, sub, 407);
  if (subsF(u32(o + 1u)) < 0.5) {
    // (L.12) some of them crash through the surge already
    if (since < ${SURGE + 0.5} && hash3(id, sub, 410) < 0.35 && since > 0.3 + hash3(id, sub, 411) * 1.2) { return true; }
    let t = since - ${SURGE} - d / 120.0 - hb * 0.3 - hw * spread; return t > -0.5 && t < 0.32;
  }
  let t = since - (0.4 + d / 120.0 + hb * 2.0 + hw * spread * 2.0);
  return t >= 0.0 && t < 2.5 + hash3(id, sub, 409) * 3.0;
}
/** The crash screen: white text on blue under a grey title, as screenPix lays out a screen W x H (uu, v from its top left). */
fn bsodPix(id: i32, uu: f32, v: f32, W: f32, H: f32, dA: f32, dz: f32) -> Px {
  let blue = vec3f(20.0, 45.0, 210.0); let white = vec3f(235.0, 235.0, 245.0); let grey = vec3f(175.0, 175.0, 180.0);
  let lh = max(0.3, H / 13.0); let cw = lh * 0.62;
  let cols = max(1, ifloor(W / cw) - 2); let row = ifloor(v / lh); let ci = ifloor((uu - cw) / cw);
  var txt = false; var inv = false;
  if (ci >= 0 && ci < cols) {
    if (row == 1) { let t0 = (cols - 8) / 2; inv = ci >= t0 && ci < t0 + 8; txt = inv && ci > t0 && ci < t0 + 7; }
    else if (row >= 3 && row <= 9 && row != 6) { let L = ifloor(f32(cols) * (0.45 + 0.55 * hash3(id, row, 31))); txt = ci < L && hash3(id, row * 97 + ci, 32) > 0.16; }
    else if (row == 11) { let L = min(cols, 22); let t0 = (cols - L) / 2; txt = ci >= t0 && ci < t0 + L && hash3(id, ci, 33) > 0.14; }
  }
  let bg = select(blue, grey, inv); let fg = select(white, blue, inv);
  if (cw / dA >= 0.9 && lh / dz >= 0.9) {
    // a letter per cell holding its center, as the screens' and signs' letters
    let center = abs(uu - cw - (f32(ci) + 0.5) * cw) < dA / 2.0 && abs(v - (f32(row) + 0.5) * lh) < dz / 2.0 + 0.01;
    if (txt && center) { return Px(65u + u32(hash3(id, row * 131 + ci, 34) * 26.0), fg); }
    return Px(HASH, bg * 0.8);
  }
  return Px(select(HASH, EQ, txt), select(bg * 0.8, mix(bg, fg, 0.5), txt));
}

`;
