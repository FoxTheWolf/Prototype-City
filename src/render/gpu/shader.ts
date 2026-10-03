import { BAY, BURN_START, FLOOR_H, LANE_W, SIDEWALK } from '../../sim/city';
import { CEIL, CELL as PCELL, DOOR, DOOR_H } from '../../sim/interior';
import { LITTER, LITTER_FAR, AD_BG, AD_FG, AD_LETTER, BLOCKS, FRAME_AD, LETTER_W, NETS, RAMP, SCAF_BOARD, SCAF_D, SCAF_STEEL, SCREEN_PAL, SHED_Z, SIGN_Z0, SIGN_Z1, TICK_LW, TICK_SPEED, TICK_Z0, TICK_Z1 } from '../raycaster';
import { BULB_COLS, BULB_ROWS } from '../signs';
import { CELL, SIDE } from '../lights';
import { LAMP_R, LIGHT_W } from '../lightmap';
import { objectsWGSL } from './objects';
import { SHELLS } from '../precip';

/**
 * The world's compute shader (stage R): one invocation per cell. The walk through the street grid and
 * the shading port raycaster.ts (renderWorld, wallColumn, roofRows, the ground, lightAt, finish) and
 * keep its numbers, so the two can be compared with J. What is not ported yet is listed in world.ts.
 */

/** The uniform block, one f32 each, in this order (world.ts fills it by these names). */
export const UNIFORMS = [
  'px', 'py', 'eye', 'dirX', 'dirY', 'plX', 'plY', 'hor',
  'scale', 'cols', 'rows', 'sec', 'day', 'solid', 'sharp', 'fuse',
  'nbx', 'nxb', 'nyb', 'curveR', 'dox', 'doy', 'dex', 'dey',
  'dnx', 'dny', 'dw', 'blocks', 'lox', 'loy', 'dbx', 'dby',
  'sunX', 'sunY', 'sunZ', 'sunEl', 'cloud', 'moonlight', 'cityLit', 'flash',
  'snow', 'wet', 'rain', 'cam3d', 'pitch', 'colW', 'plane', 'pad0',
  'dusk', 'sunA', 'moonA', 'moonEl', 'phase', 'precip', 'driftX', 'driftY',
  'cityW', 'cityH', 'ccx', 'ccy', 'sarX', 'sarY', 'sarR', 'starSlots',
  'tickN', 'sarH', 'towX', 'towY', 'towR', 'towH', 'yaw', 'fall',
  'fallSnow', 'windX', 'windY', 'fallB', 'fallR', 'fallSpeed', 'fallStreak', 'fallDens',
  'fallPeriod', 'inX0', 'inY0', 'inX1', 'inY1', 'hand',
] as const;

/** Words of the floor's block (world.ts) before its rooms' lamps. */
export const IN_LAMPS = 16;

/** Floats per building in the buildings buffer (see world.ts for the layout). */
export const BLD = 64;
/** The signs' buffer (world.ts, signData): where the font and the businesses start, and the ticker's room. */
export const SG_FONT = 8, SG_BIZ = SG_FONT + 256 * 7, TICK_MAX = 4096;
export const BLK = 8;
/** Where the per-building table of facade features starts in the near buffer (world.ts, facades). */
export const FX_TAB = 8;
export const STYLES = ['office', 'glass', 'brick', 'historic', 'residential', 'warehouse', 'crown', 'spire', 'dome', 'tank', 'chimney', 'mech', 'clock', 'mast', 'gasholder'];

const C = (s: string) => s.charCodeAt(0);
const v3 = (c: readonly number[]) => `vec3f(${c.map((x) => x.toFixed(1)).join(', ')})`;
const f = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : `${x}`);
const G = {
  DOT: C('.'), COM: C(','), TICK: C('`'), COL: C(':'), SEMI: C(';'), DASH: C('-'), EQ: C('='), PLUS: C('+'),
  HASH: C('#'), PCT: C('%'), AT: C('@'), BAR: C('|'), US: C('_'), STAR: C('*'), QUO: C('"'),
  O: C('o'), TILDE: C('~'), LB: C('['), RB: C(']'), SL: C('/'), BS: C('\\'), CARET: C('^'), X: C('x'),
};

export function worldWGSL(): string {
  const glyphs = Object.entries(G).map(([k, v]) => `const ${k} = ${v}u;`).join('\n');
  return /* wgsl */ `
struct U { ${UNIFORMS.map((n) => `${n}: f32`).join(', ')} };
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> xb: array<f32>;
@group(0) @binding(2) var<storage, read> yb: array<f32>;
@group(0) @binding(3) var<storage, read> xc: array<u32>;
@group(0) @binding(4) var<storage, read> yc: array<u32>;
@group(0) @binding(5) var<storage, read> blk: array<f32>;
@group(0) @binding(6) var<storage, read> bld: array<f32>;
@group(0) @binding(7) var<storage, read_write> outp: array<u32>;
@group(0) @binding(8) var<storage, read> subs: array<f32>;
@group(0) @binding(9) var<storage, read> lmap: array<u32>;
@group(0) @binding(10) var<storage, read> lampCol: array<f32>;
@group(0) @binding(11) var<storage, read> dl: array<f32>;
@group(0) @binding(12) var<storage, read> dlv: array<f32>;
@group(0) @binding(13) var<storage, read> doff: array<u32>;
@group(0) @binding(14) var<storage, read> didx: array<u32>;
@group(0) @binding(15) var<storage, read> sg: array<u32>;
@group(0) @binding(16) var<storage, read> fx: array<u32>;

${glyphs}
const FLOOR_H = ${FLOOR_H};
const BAY = ${BAY};
const SIDEWALK = ${SIDEWALK};
const LANE_W = ${LANE_W};
const FOG = 1500.0;
// how much of a far thing the city's orange glow covers at night (finish)
const NIGHT_HAZE = 0.42;
const LIT_H = 9.0;
const LIT_FAR = 600.0;
const GROUND_FAR = 600.0;
const LIGHT_KNEE = 150.0;
/** How much of a lamp's light a surface sends back once tinted by its color (finish), and how strongly a lit room's light spills onto the wall around its window. */
const SIGN_BACK = 2.5;
const LAMP_REFL = 1.5; const WIN_SPILL = 70.0;
const CROWN_H = 16.0;
const FLOOD_GAP = 6.0;
const LW = ${LIGHT_W};
const DSIDE = ${SIDE};
const DCELL = ${CELL}.0;
const BLOCKS = array<u32, 256>(${Array.from(BLOCKS).map((b) => `${b}u`).join(',')});
const PATS = array<vec3u, 5>(vec3u(AT, HASH, PCT), vec3u(56u, O, COL), vec3u(88u, 90u, PLUS), vec3u(48u, O, EQ), vec3u(72u, HASH, EQ));
const KIND_OTHER = 0u; const KIND_GROUND = 1u; const KIND_WALL = 2u; const KIND_BLOCK = 3u; const KIND_OBJECT = 4u; const KIND_ROOM = 5u;
const BURN_START = ${f(BURN_START)};
const LIT_A = array<vec4f, ${LITTER.length}>(${LITTER.map((L) => `vec4f(${L.slice(0, 4).map(f).join(', ')})`).join(', ')});
const LIT_B = array<vec3f, ${LITTER.length}>(${LITTER.map((L) => `vec3f(${L.slice(4).map(f).join(', ')})`).join(', ')});
const LITTER_FAR = ${f(LITTER_FAR)};
// (lamp pool radius ${LAMP_R} m: baked into the light map on the CPU)

// the same hash as core/rng.ts's hash3 (32-bit wrapping products)
fn hash3(a: i32, b: i32, c: i32) -> f32 {
  var h = (u32(a) * 374761393u) ^ (u32(b) * 668265263u) ^ (u32(c) * 2147483647u);
  h = (h ^ (h >> 13u)) * 1274126177u;
  h = h ^ (h >> 16u);
  return f32(h) / 4294967296.0;
}
fn ifloor(x: f32) -> i32 { return i32(floor(x)); }

// ---- power (render/power.ts): one element's light level now, from its substation's state
fn power(sub: i32, x: f32, y: f32, id: i32, gen: bool, group: i32, spread: f32) -> f32 {
  let o = u32(sub) * 4u;
  let changed = subs[o];
  if (changed < 0.0) { return 1.0; }
  let since = u.sec - changed; let d = length(vec2f(x - subs[o + 2u], y - subs[o + 3u]));
  let hb = hash3(group, sub, 404); let hw = hash3(id, sub, 407);
  if (subs[o + 1u] < 0.5) {
    let t = since - d / 120.0 - hb * 0.3 - hw * spread;
    if (t < -0.6) { return 1.0; }
    if (t < 0.0) { return 1.0 + 0.35 * (1.0 + t / 0.6); }
    if (t < 0.32) { return select(0.05, 1.25, hash3(id, ifloor(t * 28.0), 405) < 0.45); }
    if (gen && t > 3.0) { return min(0.55, (t - 3.0) * 0.4); }
    return 0.0;
  }
  let t = since - (0.4 + hb * 10.0 + hw * spread * 2.0 + d / 240.0);
  if (t < 0.0) { return select(0.0, 0.55, gen); }
  return select(1.0, 0.15, t < 0.7 && hash3(id, ifloor(t * 18.0), 406) < 0.5);
}

// ---- light (lightmap.ts, lights.ts, lightAt): the street lamps' pools and this frame's dynamic lights
fn lampCorner(i: u32, f: f32) -> vec3f {
  let w = lmap[i];
  if (w == 0u || f <= 0.0) { return vec3f(0.0); }
  let n = ((w >> 8u) - 1u) * 3u; let g = f32(w & 255u) / 255.0 * f;
  return vec3f(lampCol[n], lampCol[n + 1u], lampCol[n + 2u]) * g;
}
fn lvSum(o: u32, n: u32, p: f32) -> f32 {
  let k = u32(floor(p));
  if (k >= n) { return dlv[o + k]; }
  return dlv[o + k] + (dlv[o + k + 1u] - dlv[o + k]) * (p - f32(k));
}
fn lightAt(px: f32, py: f32, pz: f32) -> vec3f {
  var L = vec3f(0.0);
  let zk = select(1.0 - (pz - 1.0) / (LIT_H - 1.0), 1.0, pz <= 1.0);
  if (zk > 0.0) {
    let fx = px - u.lox; let fy = py - u.loy; let ix = ifloor(fx); let iy = ifloor(fy);
    if (ix >= 0 && iy >= 0 && ix < LW - 1 && iy < LW - 1) {
      let tx = fx - f32(ix); let ty = fy - f32(iy);
      // the two strongest lamps on each metre (the second layer at LW * LW), summed
      for (var ly = 0u; ly < 2u; ly++) {
        let i0 = u32(iy * LW + ix) + ly * u32(LW * LW);
        L += (lampCorner(i0, (1.0 - tx) * (1.0 - ty)) + lampCorner(i0 + 1u, tx * (1.0 - ty)) + lampCorner(i0 + u32(LW), (1.0 - tx) * ty) + lampCorner(i0 + u32(LW) + 1u, tx * ty)) * zk;
      }
    }
  }
  let bi = ifloor(px / DCELL) - i32(u.dbx); let bj = ifloor(py / DCELL) - i32(u.dby);
  if (bi >= 0 && bj >= 0 && bi < DSIDE && bj < DSIDE) {
    let c = u32(bj * DSIDE + bi);
    for (var q = doff[c]; q < doff[c + 1u]; q++) {
      let o = didx[q] * 16u;
      let zf = dl[o + 8u]; let zt = dl[o + 9u];
      let lz = select((zt - pz) / (zt - zf), 1.0, pz <= zf);
      if (lz <= 0.0) { continue; }
      let kind = u32(dl[o]); let R = dl[o + 7u];
      var dx = px - dl[o + 1u]; var dy = py - dl[o + 2u]; var lvl = 1.0;
      if (kind == 2u) {
        if (dx * dl[o + 5u] + dy * dl[o + 6u] < -SIGN_BACK) { continue; }
        let sx = dl[o + 3u] - dl[o + 1u]; let sy = dl[o + 4u] - dl[o + 2u];
        let t = clamp((dx * sx + dy * sy) / (sx * sx + sy * sy), 0.0, 1.0);
        dx -= sx * t; dy -= sy * t;
        let n = u32(dl[o + 14u]);
        if (n > 0u) {
          let h = (0.3 + 0.5 * length(vec2f(dx, dy))) * dl[o + 15u]; let cc = t * f32(n);
          let a = max(0.0, cc - h); let b = min(f32(n), cc + h); let lo = u32(dl[o + 13u]);
          lvl = (lvSum(lo, n, b) - lvSum(lo, n, a)) / (b - a);
        }
      }
      let d = length(vec2f(dx, dy));
      if (d >= R) { continue; }
      var f = (1.0 - d / R) * (1.0 - d / R);
      // a sign lights what is in front of its wall, fading out over SIGN_BACK m behind the wall's plane
      // (a hard cut there drew a straight seam from the building's corner across the street)
      if (kind == 2u) { f *= smoothK(-SIGN_BACK, 0.0, dx * dl[o + 5u] + dy * dl[o + 6u]); }
      if (kind == 1u) {
        let cs = (dx * dl[o + 3u] + dy * dl[o + 4u]) / select(d, 1.0, d == 0.0); let c0 = dl[o + 5u];
        if (cs <= c0) { continue; }
        f *= min(1.0, (cs - c0) / ((1.0 - c0) * 0.5));
      }
      f *= lz * lvl;
      L += vec3f(dl[o + 10u], dl[o + 11u], dl[o + 12u]) * f;
    }
  }
  let m = max(L.x, max(L.y, L.z));
  if (m > LIGHT_KNEE) { L *= (LIGHT_KNEE + (m - LIGHT_KNEE) * 0.3) / m; }
  if (u.day > 0.0) { L *= 1.0 - 0.85 * u.day; }
  return L;
}

// what a cell ends up with before the finish
struct Cell { ch: u32, c: vec3f, bg: vec3f, depth: f32, kind: u32, sun: f32 };
fn sat(c: vec3f) -> vec3f { return clamp(c, vec3f(0.0), vec3f(255.0)); }
fn colAt(o: u32) -> vec3f { return vec3f(bld[o], bld[o + 1u], bld[o + 2u]); }

// ---- a roof seen from above (roofRows)
fn roofCell(q: u32, t: f32, wx: f32, wy: f32) -> Cell {
  let fogK = 1.0 - exp(-t / FOG); let k = 1.0 - fogK * 0.6 * (1.0 - u.day);
  let x0 = bld[q]; let y0 = bld[q + 1u]; let x1 = bld[q + 2u]; let y1 = bld[q + 3u];
  var edge = min(min(wx - x0, x1 - wx), min(wy - y0, y1 - wy));
  if (bld[q + 6u] > 0.5) { edge = min(edge, bld[q + 9u] - bld[q + 7u] * wx - bld[q + 8u] * wy); }
  if (bld[q + 5u] > 0.5) { edge = min(edge, (x1 - x0) * 0.5 - length(vec2f(wx - (x0 + x1) * 0.5, wy - (y0 + y1) * 0.5))); }
  let h = hash3(ifloor(wx * 2.0), ifloor(wy * 2.0), 61);
  var ch = select(select(COL, COM, h < 0.8), DOT, h < 0.5); var c = vec3f(50.0, 50.0, 56.0);
  if (edge < 0.35) { ch = EQ; c = colAt(q + 15u) * 1.2; }
  if (u.snow > 0.05) { c += (vec3f(200.0, 205.0, 218.0) - c) * (u.snow * 0.9); }
  return Cell(ch, sat(c * k), vec3f(7.0, 8.0, 12.0), t, KIND_GROUND, 0.0);
}

// ---- signs (signs.ts and wallColumn): shop signs, painted ads, video screens, the news ticker
const LETTER_W = ${f(LETTER_W)}; const SIGN_Z0 = ${f(SIGN_Z0)}; const SIGN_Z1 = ${f(SIGN_Z1)}; const AD_LETTER = ${f(AD_LETTER)};
const TICK_Z0 = ${f(TICK_Z0)}; const TICK_Z1 = ${f(TICK_Z1)}; const TICK_LW = ${f(TICK_LW)}; const TICK_SPEED = ${f(TICK_SPEED)};
const BULB_COLS = ${f(BULB_COLS)}; const BULB_ROWS = ${f(BULB_ROWS)};
const SG_FONT = ${SG_FONT}u; const SG_BIZ = ${SG_BIZ}u;
const AD_BG = array<vec3f, ${AD_BG.length}>(${AD_BG.map(v3).join(', ')});
const AD_FG = array<vec3f, ${AD_FG.length}>(${AD_FG.map(v3).join(', ')});
const FRAME_AD = ${v3(FRAME_AD)};
const SCREEN_PAL = array<vec3f, ${SCREEN_PAL.length}>(${SCREEN_PAL.map(v3).join(', ')});
const RAMP = array<u32, ${RAMP.length}>(${RAMP.map((c) => `${c}u`).join(', ')});
const DOOR_H = ${f(DOOR_H)}; const FX_TAB = ${FX_TAB}u; const PCELL = ${f(PCELL)}; const CEIL = ${f(CEIL)}; const PDOOR = ${DOOR}u; const PEEK_FAR = 80.0;
const SCAF_D = ${f(SCAF_D)}; const SHED_Z = ${f(SHED_Z)}; const SCAF_STEEL = ${v3(SCAF_STEEL)}; const SCAF_BOARD = ${v3(SCAF_BOARD)};
const NETS = array<vec3f, ${NETS.length}>(${NETS.map(v3).join(', ')});
fn bulbOn(c: u32, bx: i32, by: i32) -> bool {
  if (bx < 0 || bx > 4 || by < 0 || by > 6) { return false; }
  return ((sg[SG_FONT + min(c, 255u) * 7u + u32(by)] >> u32(4 - bx)) & 1u) == 1u;
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
  let o = SG_BIZ + u32(biz) * 3u; let full = sg[o];
  if (i32(full & 255u) <= fit) { return vec2u(full >> 8u, full & 255u); }
  let w = sg[o + 1u];
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
  let nb = sg[2];
  if (kind == 0 && nb > 0u) {
    let tx = bizText(ifloor(hash3(id, scene, 93) * f32(nb)), max(1, ifloor((W - 1.0) / 1.2)));
    let n = f32(max(1u, tx.y)); let lw = min((W - 1.0) / n, (H * 0.55) / 1.4); let lh = lw * 1.4;
    let x0 = (W - n * lw) / 2.0; let y0 = (H - lh) / 2.0;
    let li = ifloor((uu - x0) / lw); let fu = ((uu - x0) / lw - f32(li)) * 1.25 - 0.12; let fv = (v - y0) / lh;
    let typed = li >= 0 && li < i32(tx.y) && f32(li) < st / 0.12;
    var lc = 32u; if (typed) { lc = sg[tx.x + u32(li)]; }
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

// ---- the rooms behind the windows (render/interior.ts: peekInto, roomLamp, peekCell), from the plans in fx
const PAINT = array<vec3f, 6>(vec3f(190.0, 170.0, 135.0), vec3f(150.0, 170.0, 160.0), vec3f(175.0, 150.0, 165.0), vec3f(185.0, 185.0, 175.0), vec3f(150.0, 160.0, 185.0), vec3f(195.0, 160.0, 120.0));
const R_LOBBY = 0u; const R_HALL = 1u; const R_STAIR = 2u; const R_LIFT = 3u; const R_KITCHEN = 7u; const R_BATH = 8u; const R_OFFICE = 9u; const R_OPEN = 10u; const R_SHOP = 11u;
/** Cell (i, j) of the plan at o: its room + 1 (0 outside), with the DOOR bit. */
fn planCell(o: u32, i: i32, j: i32) -> u32 {
  let nx = i32(fx[o + 2u]);
  if (i < 0 || j < 0 || i >= nx || j >= i32(fx[o + 3u])) { return 0u; }
  let b = u32(j * nx + i);
  return (fx[o + 6u + fx[o + 4u] * 6u + b / 4u] >> ((b % 4u) * 8u)) & 255u;
}
fn roomAt(o: u32, x: f32, y: f32) -> u32 { return planCell(o, ifloor(x / PCELL) - i32(fx[o]), ifloor(y / PCELL) - i32(fx[o + 1u])) & 127u; }
struct Peek { ok: bool, d: f32, r: i32, uu: f32, shade: f32 };
/** From the glass at (hx, hy), on through the plan to the first wall between two rooms (no doorway), or the far side of box q. */
fn peekInto(o: u32, q: u32, hx: f32, hy: f32, rdx: f32, rdy: f32) -> Peek {
  var pk = Peek(false, 0.0, 0, 0.0, 0.0);
  var tEnd = 1e9;
  if (rdx > 0.0) { tEnd = min(tEnd, (bld[q + 2u] - hx) / rdx); } else if (rdx < 0.0) { tEnd = min(tEnd, (bld[q] - hx) / rdx); }
  if (rdy > 0.0) { tEnd = min(tEnd, (bld[q + 3u] - hy) / rdy); } else if (rdy < 0.0) { tEnd = min(tEnd, (bld[q + 1u] - hy) / rdy); }
  if (bld[q + 6u] > 0.5) { let dn = bld[q + 7u] * rdx + bld[q + 8u] * rdy; if (dn > 0.0) { tEnd = min(tEnd, (bld[q + 9u] - bld[q + 7u] * hx - bld[q + 8u] * hy) / dn); } }
  let e = 0.03 / length(vec2f(rdx, rdy)); let sx = hx + rdx * e; let sy = hy + rdy * e;
  let gx = i32(fx[o]); let gy = i32(fx[o + 1u]);
  var i = ifloor(sx / PCELL) - gx; var j = ifloor(sy / PCELL) - gy;
  let stX = select(1, -1, rdx < 0.0); let stY = select(1, -1, rdy < 0.0);
  let dX = select(1e12, abs(PCELL / rdx), rdx != 0.0); let dY = select(1e12, abs(PCELL / rdy), rdy != 0.0);
  var tX = 1e12; if (rdx != 0.0) { tX = (f32(gx + i + select(0, 1, rdx > 0.0)) * PCELL - sx) / rdx; }
  var tY = 1e12; if (rdy != 0.0) { tY = (f32(gy + j + select(0, 1, rdy > 0.0)) * PCELL - sy) / rdy; }
  var cur = planCell(o, i, j);
  if (cur == 0u) { return pk; }
  for (var g = 0; g < 300; g++) {
    let xs = tX < tY; let tn = select(tY, tX, xs);
    if (tn + e >= tEnd) { pk.ok = true; pk.d = tEnd; pk.r = i32(cur & 127u) - 1; pk.uu = 0.0; pk.shade = 0.8; return pk; }
    if (xs) { i += stX; tX += dX; } else { j += stY; tY += dY; }
    let nv = planCell(o, i, j);
    if (nv == 0u) { continue; }
    if ((nv & 127u) != (cur & 127u) && (cur & nv & PDOOR) == 0u) {
      pk.ok = true; pk.d = tn + e; pk.r = i32(cur & 127u) - 1; pk.uu = select(sx + rdx * tn, sy + rdy * tn, xs); pk.shade = select(0.82, 1.0, xs);
      return pk;
    }
    cur = nv;
  }
  return pk;
}
/** Room r's record in the plan at o (its box as four f32, its kind and unit). */
fn roomRec(o: u32, r: i32) -> u32 { return o + 6u + u32(r) * 6u; }
/** The lamp of room r on floor f of box boxId as seen from outside (0..1 per channel, times the power), as roomLamp. */
fn roomLamp(lot: i32, boxId: i32, ro: u32, r: i32, f: i32, elecIn: f32) -> vec3f {
  let kind = fx[ro + 4u]; let commonPart = bitcast<i32>(fx[ro + 5u]) < 0; let h = hash3(boxId, r * 31 + f, 12);
  let lq = u32(lot * ${BLD});
  let backup = i32(bld[lq + 63u]);
  var elec = elecIn;
  if (elec < 0.8 && backup == 3) { elec = 0.85; }
  else if (elec < 0.8) {
    // off the mains: the generator's amber, the emergency lamps (white, a few red), or dark
    if (backup == 0 || (backup == 1 && !commonPart)) { return vec3f(0.0); }
    let gen = backup == 2 && elec > 0.25;
    if (!(commonPart || (gen && h < 0.25))) { return vec3f(0.0); }
    let c = select(select(vec3f(70.0, 85.0, 110.0), vec3f(190.0, 120.0, 60.0), gen), vec3f(150.0, 22.0, 16.0), commonPart && h < select(0.4, 0.3, gen));
    return c / 255.0 * select(0.6, min(1.0, elec * 1.1), gen);
  }
  if (!(commonPart || hash3(boxId, r * 31 + f, 11) < select(bld[lq + 11u] * (1.0 - 0.75 * u.day) * 1.3, 0.8, kind == R_SHOP))) { return vec3f(0.0); }
  let st = i32(bld[lq + 10u]); let office = st == 0 || st == 1;
  let c = select(select(vec3f(255.0, 205.0, 140.0), vec3f(215.0, 232.0, 255.0), office || kind == R_STAIR || kind == R_LIFT), vec3f(255.0, 222.0, 165.0), kind == R_LOBBY);
  return c / 255.0 * elec;
}
fn lampD2(ro: u32, x: f32, y: f32) -> f32 {
  let x0 = bitcast<f32>(fx[ro]); let y0 = bitcast<f32>(fx[ro + 1u]); let w = bitcast<f32>(fx[ro + 2u]) - x0; let h = bitcast<f32>(fx[ro + 3u]) - y0;
  // (floor(x + 0.5): JS rounds halves up, WGSL round() to even)
  let sx = w / max(1.0, floor(w / 4.0 + 0.5)); let sy = h / max(1.0, floor(h / 4.0 + 0.5));
  let dx = (((x - x0) % sx) + sx) % sx - sx / 2.0; let dy = (((y - y0) % sy) + sy) % sy - sy / 2.0;
  return dx * dx + dy * dy;
}
/** A room's floor at (x, y) (floorPaint). */
fn floorPx(kind: u32, office: bool, x: f32, y: f32) -> Px {
  if (kind == R_BATH || kind == R_KITCHEN) {
    let ix = ifloor(x / 0.3); let iy = ifloor(y / 0.3); let seam = x / 0.3 - f32(ix) < 0.12 || y / 0.3 - f32(iy) < 0.12;
    let dark = kind == R_KITCHEN && ((ix + iy) & 1) == 1;
    return Px(select(DOT, PLUS, seam), select(vec3f(165.0, 165.0, 158.0), vec3f(60.0, 58.0, 62.0), dark));
  }
  if (kind == R_LOBBY) {
    let ix = ifloor(x / 0.8); let iy = ifloor(y / 0.8); let seam = x / 0.8 - f32(ix) < 0.05 || y / 0.8 - f32(iy) < 0.05;
    return Px(select(DOT, PLUS, seam), vec3f(175.0, 165.0, 145.0) * select(0.8, 1.0, ((ix + iy) & 1) == 1));
  }
  if (kind == R_HALL) { return Px(select(COM, DOT, office), select(vec3f(120.0, 45.0, 45.0), vec3f(95.0, 95.0, 100.0), office)); }
  if (kind == R_OFFICE || kind == R_OPEN) {
    let kk = select(0.85, 1.0, ((ifloor(x / 0.6) + ifloor(y / 0.6)) & 1) == 1);
    return Px(select(DOT, COM, hash3(ifloor(x * 6.0), ifloor(y * 6.0), 3) < 0.5), vec3f(72.0, 78.0, 95.0) * kk);
  }
  if (kind == R_STAIR) { return Px(EQ, vec3f(125.0, 125.0, 120.0)); }
  if (kind == R_LIFT) { return Px(HASH, vec3f(100.0, 100.0, 108.0)); }
  if (kind == R_SHOP) { return Px(DOT, vec3f(110.0)); }
  // wooden boards, staggered
  let row = ifloor(y / 0.2); let al = x / 1.2 + f32(row & 1) * 0.5; let seam = al - floor(al) < 0.06;
  return Px(select(DASH, BAR, seam), vec3f(130.0, 85.0, 50.0) * (0.8 + 0.3 * hash3(row, ifloor(al), 4)));
}
/** A room's ceiling at (x, y) (ceilPaint): tiles with light panels in offices, a lamp in the middle of the rooms at home. */
fn ceilPx(ro: u32, kind: u32, office: bool, on: bool, x: f32, y: f32) -> Px {
  if (office || kind == R_STAIR || kind == R_LIFT) {
    let fxx = ((x / 2.4) % 1.0 + 1.0) % 1.0; let fyy = ((y / 1.2) % 1.0 + 1.0) % 1.0;
    if (fxx > 0.3 && fxx < 0.7 && fyy > 0.25 && fyy < 0.75) { return Px(EQ, vec3f(200.0, 210.0, 220.0) * select(0.6, 2.2, on)); }
    if (x / 0.6 - floor(x / 0.6) < 0.06 || y / 0.6 - floor(y / 0.6) < 0.06) { return Px(PLUS, vec3f(150.0, 148.0, 142.0)); }
  } else if (lampD2(ro, x, y) < 0.05) { return Px(O, vec3f(255.0, 220.0, 160.0) * select(0.5, 2.4, on)); }
  return Px(DOT, vec3f(150.0, 148.0, 142.0));
}
/** A room's wall at zr above its floor, uu along it (wallPaint). */
fn wallPx(kind: u32, unit: i32, zr: f32, uu: f32) -> Px {
  if (zr < 0.12) { return Px(US, vec3f(70.0, 52.0, 40.0)); } // skirting board
  if (zr > CEIL - 0.1) { return Px(DASH, vec3f(120.0)); } // cornice
  if (kind == R_BATH || kind == R_KITCHEN) {
    // tiles up to shoulder height in the bathroom, a splashback in the kitchen
    let top = select(1.5, 2.0, kind == R_BATH);
    if (zr < top && zr > select(0.9, 0.0, kind == R_BATH)) {
      let seam = ((uu / 0.3) % 1.0 + 1.0) % 1.0 < 0.15 || (zr / 0.3) % 1.0 < 0.15;
      return Px(select(DOT, PLUS, seam), vec3f(180.0, 190.0, 188.0));
    }
    return Px(COL, vec3f(200.0, 196.0, 180.0));
  }
  if (kind == R_LOBBY || kind == R_HALL) {
    // wainscot of wood panels below a plaster wall
    if (zr < 1.0) { let pp = ((uu / 0.8) % 1.0 + 1.0) % 1.0; return Px(select(select(COL, EQ, zr > 0.92), BAR, pp < 0.08), vec3f(110.0, 76.0, 50.0)); }
    return Px(COL, vec3f(165.0, 155.0, 135.0));
  }
  if (kind == R_STAIR) { return Px(SEMI, vec3f(135.0, 135.0, 130.0)); }
  if (kind == R_LIFT) { return Px(BAR, vec3f(165.0, 170.0, 175.0)); }
  if (kind == R_OFFICE || kind == R_OPEN || kind == R_SHOP) { return Px(COL, vec3f(165.0, 165.0, 160.0)); }
  // homes: each one papered or painted in its own way
  let c = PAINT[u32((((unit * 7 + 3) % 6) + 6) % 6)]; let h = hash3(unit, 5, 9); let pu = ((uu / 0.4) % 1.0 + 1.0) % 1.0;
  var ch = COL;
  if (h < 0.35) { ch = select(COL, BAR, pu < 0.5); }
  else if (h < 0.6) { ch = select(QUO, DOT, ((i32(uu / 0.3) + i32(zr / 0.3)) & 1) == 1); }
  return Px(ch, c);
}
/**
 * The furniture of the plan at o on storey f, along the ray from t0 to t1 (the glass to the room's far
 * surface): the nearest piece's hit (t = t1: none), its glyph and color, lit by the faces as the street
 * objects are (the room's lamps are applied by peekCell; a glowing part keeps its own color).
 */
struct FHit { t: f32, ch: u32, c: vec3f, glow: bool };
fn furnHit(o: u32, f: i32, rdx: f32, rdy: f32, kz: f32, t0: f32, t1: f32) -> FHit {
  var h = FHit(t1, 0u, vec3f(0.0), false);
  let fo = o + 6u + fx[o + 4u] * 6u + (fx[o + 2u] * fx[o + 3u] + 3u) / 4u;
  let n = fx[fo]; let oz = u.eye - f32(f) * FLOOR_H;
  // parts thinner than a cell at this distance are widened to half a cell (as in objectsOver)
  let mh = 0.5 * u.colW * t0; let mz = 0.5 * t0 / u.scale;
  var hp = 0u; var face = 0; var nrm = vec3f(0.0); var hc = 1.0; var hs0 = 0.0;
  for (var k = 0u; k < n; k++) {
    let e = fo + 1u + k * 6u;
    let x = fxf(e); let y = fxf(e + 1u); let c = fxf(e + 2u); let s = fxf(e + 3u); let r = fxf(e + 4u); let mo = fx[e + 5u];
    let ox = (u.px - x) * c + (u.py - y) * s; let oy = -(u.px - x) * s + (u.py - y) * c;
    let dx = rdx * c + rdy * s; let dy = -rdx * s + rdy * c;
    let qa = dx * dx + dy * dy; let qb = ox * dx + oy * dy; let disc = qb * qb - qa * (ox * ox + oy * oy - r * r);
    if (disc < 0.0) { continue; }
    let sq = sqrt(disc);
    if ((-qb + sq) / qa < t0 || (-qb - sq) / qa > h.t) { continue; }
    let o3 = vec3f(ox, oy, oz); let d0 = vec3f(dx, dy, kz); let d3 = select(d0, vec3f(1e-9), abs(d0) < vec3f(1e-9));
    for (var pi = 0u; pi < fx[mo]; pi++) {
      let p = mo + 1u + pi * PW;
      let shape = fx[p]; let q0 = fx3(p + 1u); let q1 = fx3(p + 4u);
      let cen = (q0 + q1) * 0.5; let hs = max((q1 - q0) * 0.5, vec3f(mh, mh, mz));
      var t = 1e9; var fc = 0; var nn = vec3f(0.0);
      if (shape == 0u) {
        let ta = (cen - hs - o3) / d3; let tb = (cen + hs - o3) / d3;
        let lo = min(ta, tb); let hi = max(ta, tb);
        let tn = max(lo.x, max(lo.y, lo.z)); let tf = min(hi.x, min(hi.y, hi.z));
        if (tn > tf || tn <= t0) { continue; }
        t = tn; fc = select(select(2, 1, tn == lo.y), 0, tn == lo.x); nn = vec3f(0.0); nn[fc] = -sign(d3[fc]);
      } else {
        let X = (o3.x - cen.x) / hs.x; let Y = (o3.y - cen.y) / hs.y; let DX = d3.x / hs.x; let DY = d3.y / hs.y;
        let Z = select(0.0, (o3.z - cen.z) / hs.z, shape != 1u); let DZ = select(0.0, d3.z / hs.z, shape != 1u);
        let a = DX * DX + DY * DY + DZ * DZ; let b = X * DX + Y * DY + Z * DZ; let ds = b * b - a * (X * X + Y * Y + Z * Z - 1.0);
        if (ds < 0.0) { continue; }
        t = (-b - sqrt(ds)) / a;
        if (shape == 1u) {
          if (abs(o3.z + d3.z * t - cen.z) > hs.z) {
            // the cylinder's top, seen from above
            if (d3.z >= 0.0 || o3.z <= cen.z + hs.z) { continue; }
            t = (cen.z + hs.z - o3.z) / d3.z; let uu = X + DX * t; let w = Y + DY * t;
            if (uu * uu + w * w > 1.0) { continue; }
            fc = 2; nn = vec3f(0.0, 0.0, 1.0);
          } else { fc = 1; nn = vec3f(X + DX * t, Y + DY * t, 0.0); }
        } else { nn = vec3f(X + DX * t, Y + DY * t, Z + DZ * t); fc = select(1, 2, nn.z > 0.75); }
        if (t <= t0) { continue; }
      }
      if (t < h.t) { h.t = t; hp = p; face = fc; nrm = nn; hc = c; hs0 = s; }
    }
  }
  if (hp == 0u) { return h; }
  let mat = fx[hp + 10u]; let shape = fx[hp];
  h.c = fx3(hp + 7u);
  if (mat == M_GLOW) { h.ch = fx[hp + 11u]; h.glow = true; return h; }
  let wn = abs(nrm.x * hc - nrm.y * hs0) / select(length(nrm.xy), 1.0, length(nrm.xy) == 0.0);
  h.c *= select(0.72 + 0.28 * wn, 1.15, face == 2);
  h.ch = select(select(fx[hp + 11u], fx[hp + 13u], face == 0 && shape == 0u), fx[hp + 12u], face == 2);
  return h;
}
/**
 * One window cell's view of the room behind it (peekCell): the ray goes on from the glass at distance t,
 * rising kz per unit, to the back wall, or down to the floor or up to the ceiling of storey f; under the glass.
 */
fn peekCell(o: u32, lot: i32, boxId: i32, pk: Peek, f: i32, rdx: f32, rdy: f32, kz: f32, t: f32, elec: f32, sheen: f32) -> Px {
  let z0 = f32(f) * FLOOR_H; let zc = z0 + CEIL; let tw = t + pk.d; let zw = u.eye + kz * tw;
  let st = i32(bld[u32(lot * ${BLD}) + 10u]); let office = st == 0 || st == 1;
  var r = pk.r; var x = 0.0; var y = 0.0; var part = 1; var tEnd = tw;
  if (zw < z0 || zw > zc) {
    part = select(2, 0, zw < z0);
    tEnd = (select(zc, z0, part == 0) - u.eye) / kz;
  }
  // the furniture in front of the floor, the ceiling or the wall
  let F = furnHit(o, f, rdx, rdy, kz, t, tEnd);
  if (F.t < tEnd) { part = 3; tEnd = F.t; }
  x = u.px + rdx * tEnd; y = u.py + rdy * tEnd;
  if (part != 1) { let cc = roomAt(o, x, y); if (cc > 0u) { r = i32(cc) - 1; } }
  if (r < 0 || u32(r) >= fx[o + 4u]) { return Px(EQ, vec3f(20.0, 24.0, 40.0)); }
  let ro = roomRec(o, r); let kind = fx[ro + 4u]; let unit = bitcast<i32>(fx[ro + 5u]);
  let lp = roomLamp(lot, boxId, ro, r, f, elec);
  let k = 0.5 + 0.9 / (1.0 + lampD2(ro, x, y) / 5.0); let a = 0.14 + 0.5 * u.day;
  let L = lp * k + vec3f(a, a * 1.05, a * 1.25);
  var p = Px(DOT, vec3f(0.0));
  if (part == 3) { p = Px(F.ch, F.c); }
  else if (part == 0) { p = floorPx(kind, office, x, y); }
  else if (part == 2) { p = ceilPx(ro, kind, office, lp.x + lp.y > 0.05, x, y); }
  else { p = wallPx(kind, unit, zw - z0, pk.uu); }
  let ch = p.ch; let c = p.c;
  let sh = select(1.0, pk.shade, part == 1);
  // under the glass: a faint tint, and the sky and the city mirrored in soft bands (by day the reflection wins)
  let s2 = sheen * sheen; let gk = 0.55 - 0.2 * u.day - 0.3 * s2;
  var lc = c * L * sh;
  if (part == 3 && F.glow) { lc = c * select(0.25, 1.0, lp.x + lp.y > 0.05); } // a lamp: lit when the room is
  return Px(ch, lc * gk + vec3f(16.0 + s2 * 95.0 + u.day * 55.0, 30.0 + s2 * 110.0 + u.day * 65.0, 40.0 + s2 * 130.0 + u.day * 80.0));
}
/** Window openings of a facade style, as wallColumn draws them (windowHole). */
fn windowHole(S: i32, shop: bool, fw: f32, fz: f32, z: f32, ground: bool) -> bool {
  if (ground && shop) { return fw > 0.12 && fw < 0.88 && z > 0.2 && z < 2.6; }
  if (S == 1) { return fw >= 0.07 && fz >= 0.08; }
  if (S == 4) { return fw > 0.25 && fw < 0.75 && fz > 0.3 && fz < 0.78; }
  if (S == 2) { return fw > 0.3 && fw < 0.7 && fz > 0.3 && fz < 0.78; }
  if (S == 3) { return !ground && fw > 0.3 && fw < 0.7 && fz > 0.18 && fz < 0.82; }
  return fw > 0.2 && fw < 0.8 && fz > 0.28 && fz < 0.8;
}

// ---- the floor the viewer stands in (render/interior.ts: interiorColumn, glassPass), from the block world.ts packs
// after the frame's objects: the IN_ words, then the rooms' lamps, the door leaves, the street doors. A span of a
// wall from za to zb covers this cell where za < z <= zb (z: the ray's height there), as the CPU's rows.
const IN_LAMPS = ${IN_LAMPS}u;
const PANEL_W = 0.44; const PANEL_Z0 = 0.85; const PANEL_Z1 = 1.65;
const EXIT_CH = array<u32, 4>(69u, 88u, 73u, 84u);
/** What the floor drew in a cell: state 0 nothing (the city), 1 drawn, 2 a window; the window's glass; where the rain starts. */
struct InC { cl: Cell, state: u32, gt: f32, ga: f32, gl: vec3f, gdoor: bool, gc: f32, gh: f32, gz0: f32, nearT: f32 };
fn inBlock() -> u32 {
  let OB = fx[1];
  if (OB == 0u || fx[OB + 6u] == 0u) { return 0u; }
  return OB + fx[OB + 6u];
}
fn inLamp(IB: u32, r: i32) -> vec3f { let w = IB + IN_LAMPS + u32(r) * 3u; return vec3f(fxf(w), fxf(w + 1u), fxf(w + 2u)); }
/** The light at a point of room r (lit3): its lamps, falling off with the distance to the nearest and along the ray; and the ambient. */
fn litIn(IB: u32, ro: u32, r: i32, x: f32, y: f32, t: f32) -> vec3f {
  let k = (0.5 + 0.9 / (1.0 + lampD2(ro, x, y) / 5.0)) / (1.0 + t * 0.03); let a = 0.14 + 0.5 * u.day;
  return inLamp(IB, r) * k + vec3f(a, a * 1.05, a * 1.25);
}
/** The light on the floor's furniture (insideLight), as a multiplier. */
fn insideLight(x: f32, y: f32) -> vec3f {
  let IB = inBlock();
  if (IB == 0u) { return vec3f(0.3); }
  let o = fx[IB]; let c = roomAt(o, x, y); let r = select(0, i32(c) - 1, c > 0u);
  if (u32(r) >= fx[o + 4u]) { return vec3f(0.3); }
  return litIn(IB, roomRec(o, r), r, x, y, 0.0);
}
// (clamped as the CPU stores it, before the finish)
fn roomCell(ch: u32, c: vec3f, t: f32) -> Cell { return Cell(ch, sat(c), vec3f(7.0, 8.0, 12.0), t, KIND_ROOM, 0.0); }
fn zrOf(z: f32, z0: f32) -> f32 { return (((z - z0) % FLOOR_H) + FLOOR_H) % FLOOR_H; }
/** Whether a reading direction along a wall runs to the viewer's right. */
fn toRight(ax: f32, ay: f32, rdx: f32, rdy: f32) -> bool { return ax * -rdy + ay * rdx >= 0.0; }
fn ndig(v: i32) -> i32 { var n = 1; var x = v; loop { if (x < 10) { break; } x = x / 10; n++; } return n; }
fn digitOf(v: i32, nd: i32, k: i32) -> u32 { var p = 1; for (var q = 0; q < nd - 1 - k; q++) { p *= 10; } return 48u + u32((v / p) % 10); }
/** The lamps of the nd digits of v laid out in u0..u1 by zTop..zBot, at a cell (uu, z) of size cu x cz (digitLamps); 0 where none. */
fn digitLamps(v: i32, nd: i32, u0: f32, u1: f32, zTop: f32, zBot: f32, uu: f32, z: f32, cu: f32, cz: f32) -> u32 {
  let bw = (u1 - u0) / (6.0 * f32(nd) - 1.0); let bh = (zTop - zBot) / 7.0; let hx = cu / bw / 2.0; let hz = cz / bh / 2.0;
  let px = (uu - u0) / bw; let pz = (zTop - z) / bh;
  // a digit under 3 rows tall: its ASCII glyph, in the cell holding its middle
  if ((zTop - zBot) / cz < 3.0) {
    let k = ifloor(px / 6.0); let mu = u0 + (f32(k) * 6.0 + 2.5) * bw; let mz = (zTop + zBot) / 2.0;
    if (k >= 0 && k < nd && abs(uu - mu) <= cu / 2.0 && abs(z - mz) <= cz / 2.0) { return digitOf(v, nd, k); }
    return 32u;
  }
  var nb = 0u;
  for (var k = 0; k < nd; k++) { nb += bulbsIn(digitOf(v, nd, k), px - 6.0 * f32(k), pz, hx, hz); }
  return bulbGlyph(nb, hx, hz);
}
struct Pan { b: i32, p: Px };
/** The lift car's panel (panelPaint) at pu across it and zr up: -2 off it, -1 on it, else the button's floor. */
fn panelPaint(IB: u32, pu: f32, zr: f32, cu: f32, cz: f32) -> Pan {
  let fl = i32(fx[IB + 3u]); let n = i32(fx[IB + 6u]); let to = bitcast<i32>(fx[IB + 7u]);
  let cols = select(2, 4, n > 12); let rows = (n + cols - 1) / cols;
  if (pu < 0.0 || pu > 1.0 || zr < PANEL_Z0 || zr > PANEL_Z1 + 0.14) { return Pan(-2, Px(0u, vec3f(0.0))); }
  var o = Pan(-1, Px(HASH, vec3f(70.0, 72.0, 80.0)));
  if (zr > PANEL_Z1 + 0.02) {
    // the floor display: amber lamp digits on black
    let g = digitLamps(fl, max(2, ndig(fl)), 0.3, 0.7, PANEL_Z1 + 0.135, PANEL_Z1 + 0.035, pu, zr, cu, cz);
    if (g != 0u) { o.p = Px(g, vec3f(255.0, 140.0, 40.0)); } else { o.p = Px(DOT, vec3f(60.0, 25.0, 10.0)); }
    return o;
  }
  let bu = pu * f32(cols); let bz = (zr - PANEL_Z0) / (PANEL_Z1 - PANEL_Z0) * f32(rows);
  let col = ifloor(bu); let row = ifloor(bz); let f = row * cols + col; let fu = bu - f32(col); let fz = bz - f32(row);
  if (f >= n) { return o; }
  let lit = f == to || (to < 0 && f == fl);
  // the button's number in little lamps, behind the steel plate: amber on the floor it goes to
  let nd = ndig(f); let w = min(0.66, 0.3 * f32(nd));
  let g = digitLamps(f, nd, 0.5 - w / 2.0, 0.5 + w / 2.0, 0.8, 0.2, fu, fz, cu * f32(cols), cz / (PANEL_Z1 - PANEL_Z0) * f32(rows));
  o.b = f;
  if (g != 0u) { o.p = Px(g, select(vec3f(200.0, 205.0, 210.0), vec3f(255.0, 160.0, 50.0), lit)); return o; }
  if (fu < 0.12 || fu > 0.88 || fz < 0.15 || fz > 0.85) { return o; }
  o.p = Px(DOT, select(vec3f(95.0, 98.0, 105.0), vec3f(120.0, 80.0, 40.0), lit));
  return o;
}
/** An EXIT sign's cell (exitCell): uu 0..1 across as read, v 0..1 down, du and dv the share of the sign the cell covers. */
fn exitPx(uu: f32, v: f32, du: f32, dv: f32) -> Px {
  let slots = 6.0; let n = ifloor(uu * slots) - 1; let cc = (f32(n) + 1.5) / slots;
  var o = Px(EQ, vec3f(25.0, 120.0, 55.0));
  if (n < 0 || n >= 4 || v < 0.1 || v > 0.9) { return o; }
  let ch = EXIT_CH[n];
  if (0.8 / dv >= 4.0 && 1.0 / slots / du >= 3.0) {
    // points: the bulbs in this cell
    let px = (uu * slots - f32(n + 1)) * 6.0 - 1.0; let pz = (v - 0.1) / 0.8 * 7.0 - 0.5;
    let hx = du * slots * 6.0 / 2.0; let hz = dv / 0.8 * 7.0 / 2.0; let b = bulbsIn(ch, px, pz, hx, hz);
    if (b > 0u) { o = Px(bulbGlyph(b, hx, hz), vec3f(225.0, 255.0, 230.0)); }
    return o;
  }
  if (abs(uu - cc) < du / 2.0) { o = Px(ch, vec3f(235.0, 255.0, 235.0)); }
  return o;
}
/** Whether a building stands at (x, y) taller than z (builtUp). */
fn builtUp(x: f32, y: f32, z: f32) -> bool {
  if (x < 0.0 || y < 0.0 || x >= u.cityW || y >= u.cityH) { return false; }
  let gx = i32(xc[u32(x)]); let gy = i32(yc[u32(y)]);
  if ((gx & 1) == 0 || (gy & 1) == 0) { return false; }
  let o = u32(((gy >> 1) * i32(u.nbx) + (gx >> 1)) * ${BLK});
  for (var k = i32(blk[o + 4u]); k < i32(blk[o + 5u]); k++) {
    let q = u32(k * ${BLD});
    if (bld[q + 4u] > z && x >= bld[q] && x < bld[q + 2u] && y >= bld[q + 1u] && y < bld[q + 3u] && (bld[q + 6u] < 0.5 || bld[q + 7u] * x + bld[q + 8u] * y <= bld[q + 9u])) { return true; }
  }
  return false;
}
/** Both sides of the wall a door cell q along it (the doorway's run). */
fn doorBoth(o: u32, xs: bool, wi: i32, wj: i32, i: i32, j: i32, q: i32) -> bool {
  if (xs) { return (planCell(o, wi, j + q) & planCell(o, i, j + q) & PDOOR) != 0u; }
  return (planCell(o, i + q, wj) & planCell(o, i + q, j) & PDOOR) != 0u;
}

fn interiorCell(IB: u32, rdx: f32, rdy: f32, m: f32) -> InC {
  var res = InC(Cell(32u, vec3f(0.0), vec3f(7.0, 8.0, 12.0), 1e9, KIND_OTHER, 0.0), 0u, 0.0, 0.0, vec3f(0.0), false, 0.0, 0.0, 0.0, 0.0);
  let o = fx[IB]; let lot = i32(fx[IB + 1u]); let boxId = i32(fx[IB + 2u]); let fl = i32(fx[IB + 3u]);
  let z0 = fxf(IB + 4u); let shut = fx[IB + 5u] == 1u; let zc = z0 + CEIL; let nRooms = fx[IB + 15u];
  let q = u32(boxId * ${BLD}); let lq = u32(lot * ${BLD});
  let st = i32(bld[lq + 10u]); let shop = bld[lq + 19u] > 0.5; let office = st == 0 || st == 1;
  let rl = sqrt(rdx * rdx + rdy * rdy);
  res.gz0 = f32(fl) * FLOOR_H;
  // where the ray leaves the box (and the cut): that outer wall closes the column
  var tExit = 1e9; var face = 0;
  if (rdx > 0.0) { let t = (bld[q + 2u] - u.px) / rdx; if (t < tExit) { tExit = t; face = 1; } } else if (rdx < 0.0) { let t = (bld[q] - u.px) / rdx; if (t < tExit) { tExit = t; face = 0; } }
  if (rdy > 0.0) { let t = (bld[q + 3u] - u.py) / rdy; if (t < tExit) { tExit = t; face = 3; } } else if (rdy < 0.0) { let t = (bld[q + 1u] - u.py) / rdy; if (t < tExit) { tExit = t; face = 2; } }
  let knx = bld[q + 7u]; let kny = bld[q + 8u];
  if (bld[q + 6u] > 0.5) { let dn = knx * rdx + kny * rdy; if (dn > 0.0) { let t = (bld[q + 9u] - knx * u.px - kny * u.py) / dn; if (t < tExit) { tExit = t; face = 4; } } }
  tExit = max(tExit, 0.02);
  // the nearest door leaf the ray meets (hinge, along, out, width, swing), drawn once the walk gets that far
  let nL = fx[IB + 8u]; let lb = IB + IN_LAMPS + nRooms * 3u;
  var lt = 1e9; var lu = 0.0; var lk = 1.0;
  for (var n = 0u; n < nL; n++) {
    let w = lb + n * 8u; let ang = fxf(w + 7u); let c = cos(ang); let s = sin(ang); let dw = fxf(w + 6u);
    let ex = (fxf(w + 2u) * c + fxf(w + 4u) * s) * dw; let ey = (fxf(w + 3u) * c + fxf(w + 5u) * s) * dw; let den = rdx * ey - rdy * ex;
    if (abs(den) < 1e-9) { continue; }
    let qx = fxf(w) - u.px; let qy = fxf(w + 1u) - u.py; let t = (qx * ey - qy * ex) / den; let uu = (qx * rdy - qy * rdx) / den;
    if (t > 0.05 && t < lt && uu >= 0.0 && uu <= 1.0) { lt = t; lu = uu; lk = 0.7 + 0.3 * abs(-ey * rdx + ex * rdy) / (dw * rl); }
  }
  // walk the plan's cells; a change of room is a wall, unless both cells are a doorway
  let gx = i32(fx[o]); let gy = i32(fx[o + 1u]);
  var i = ifloor(u.px / PCELL) - gx; var j = ifloor(u.py / PCELL) - gy;
  let stX = select(1, -1, rdx < 0.0); let stY = select(1, -1, rdy < 0.0);
  let dX = select(1e12, abs(PCELL / rdx), rdx != 0.0); let dY = select(1e12, abs(PCELL / rdy), rdy != 0.0);
  var tX = 1e12; if (rdx != 0.0) { tX = (f32(gx + i + select(0, 1, rdx > 0.0)) * PCELL - u.px) / rdx; }
  var tY = 1e12; if (rdy != 0.0) { tY = (f32(gy + j + select(0, 1, rdy > 0.0)) * PCELL - u.py) / rdy; }
  var cur = planCell(o, i, j); var wall = false;
  for (var g = 0; g < 400; g++) {
    let xs = tX < tY; let tn = select(tY, tX, xs);
    if (lt < min(tn, tExit)) {
      let z = u.eye - m * lt;
      if (z > z0 && z <= z0 + DOOR_H - 0.02) {
        // a panel door: its edges, two recessed panels, and the knob near the far edge
        let hx = u.px + rdx * lt; let hy = u.py + rdy * lt; let rr = max(0, i32(roomAt(o, hx, hy)) - 1);
        let Lt = litIn(IB, roomRec(o, rr), rr, hx, hy, lt); let zz = z - z0;
        let edge = lu < 0.06 || lu > 0.94 || zz > DOOR_H - 0.1 || zz < 0.06;
        let knob = lu > 0.82 && lu < 0.9 && zz > 0.92 && zz < 1.06;
        let panel = !edge && lu > 0.16 && lu < 0.84 && ((zz > 0.25 && zz < 0.85) || (zz > 1.2 && zz < DOOR_H - 0.3));
        let col = select(vec3f(118.0, 78.0, 46.0), vec3f(118.0, 122.0, 130.0), office) * lk * select(select(1.0, 1.1, panel), 0.8, edge);
        if (knob) { res.cl = roomCell(O, vec3f(210.0, 175.0, 90.0) * Lt, lt); } else { res.cl = roomCell(select(select(EQ, COL, panel), BAR, edge), col * Lt, lt); }
        res.state = 1u; return res;
      }
      lt = 1e9;
    }
    if (tn >= tExit) { break; }
    if (xs) { i += stX; tX += dX; } else { j += stY; tY += dY; }
    let nv = planCell(o, i, j);
    if (nv == 0u) { continue; }
    if (cur == 0u) { cur = nv; continue; }
    if ((nv & 127u) != (cur & 127u)) {
      let r = i32(cur & 127u) - 1; let ro = roomRec(o, r); let kind = fx[ro + 4u]; let unit = bitcast<i32>(fx[ro + 5u]);
      let hx = u.px + rdx * tn; let hy = u.py + rdy * tn; let uu = select(hx, hy, xs); let shade = select(0.82, 1.0, xs);
      let z = u.eye - m * tn;
      if ((cur & nv & PDOOR) != 0u && !shut) {
        // a doorway: the lintel above it, and on through; over the way out to the lobby (or the stairs), a green EXIT sign
        if (z > z0 + DOOR_H && z <= zc) {
          let k2 = fx[roomRec(o, i32(nv & 127u) - 1) + 4u];
          let toExit = k2 == R_STAIR || (k2 == R_LOBBY && kind != R_LOBBY);
          let zz = z - z0;
          if (toExit && zz > DOOR_H + 0.06 && zz < DOOR_H + 0.32) {
            // the doorway's extent along the wall: the run of door cells on both sides
            let wi = select(i, i - stX, xs); let wj = select(j - stY, j, xs);
            var a = 0; var b = 0;
            loop { if (a <= -8 || !doorBoth(o, xs, wi, wj, i, j, a - 1)) { break; } a--; }
            loop { if (b >= 8 || !doorBoth(o, xs, wi, wj, i, j, b + 1)) { break; } b++; }
            let base = select(f32(gx + i), f32(gy + j), xs) * PCELL;
            let s0 = base + f32(a) * PCELL; let s1 = base + f32(b + 1) * PCELL;
            let ww = (uu - s0) / (s1 - s0); let mm = 0.5 - 0.3 / (s1 - s0);
            if (ww > 0.5 - mm && ww < 0.5 + mm) {
              let rd = select(toRight(1.0, 0.0, rdx, rdy), toRight(0.0, 1.0, rdx, rdy), xs);
              let du = u.colW * tn / max(1e-6, abs(select(rdy, rdx, xs))) / ((s1 - s0) * 2.0 * mm);
              let ep = exitPx(select((0.5 + mm - ww) / (2.0 * mm), (ww - 0.5 + mm) / (2.0 * mm), rd), (DOOR_H + 0.32 - zz) / 0.26, du, tn / u.scale / 0.26);
              res.cl = roomCell(ep.ch, ep.c, tn); res.state = 1u; return res;
            }
          }
          let k = select(1.0, 1.3, z < z0 + DOOR_H + 0.08);
          res.cl = roomCell(EQ, vec3f(120.0, 95.0, 70.0) * litIn(IB, ro, r, hx, hy, tn) * k, tn); res.state = 1u; return res;
        }
      } else {
        if (z > z0 && z <= zc) {
          // the wall; on the lift car's long wall at the low coordinate, its panel
          var pw = -1.0;
          if (kind == R_LIFT && fx[IB + 6u] > 0u) {
            let x0 = fxf(ro); let y0 = fxf(ro + 1u); let x1 = fxf(ro + 2u); let y1 = fxf(ro + 3u); let longX = x1 - x0 >= y1 - y0;
            if (longX && !xs && abs(hy - y0) < 0.05) { pw = (hx - ((x0 + x1) / 2.0 - PANEL_W / 2.0)) / PANEL_W; }
            else if (!longX && xs && abs(hx - x0) < 0.05) { pw = ((y0 + y1) / 2.0 + PANEL_W / 2.0 - hy) / PANEL_W; }
          }
          var p = Px(0u, vec3f(0.0)); var b = -2;
          if (pw >= 0.0 && pw <= 1.0) { let pp = panelPaint(IB, pw, z - z0, u.colW * tn / max(1e-6, abs(select(rdy, rdx, xs))) / PANEL_W, tn / u.scale); b = pp.b; p = pp.p; }
          if (b == -2) { p = wallPx(kind, unit, zrOf(z, z0), uu); }
          res.cl = roomCell(p.ch, p.c * litIn(IB, ro, r, hx, hy, tn) * shade, tn); res.state = 1u; return res;
        }
        wall = true; break;
      }
    }
    cur = nv;
  }
  if (wall) { res.nearT = 1e9; }
  else if (nRooms > 0u) {
    // the outer wall: windows on the facade's grid, the street doors on the ground floor
    let r0 = select(0, i32(cur & 127u) - 1, cur != 0u); let ro = roomRec(o, r0); let kind = fx[ro + 4u]; let unit = bitcast<i32>(fx[ro + 5u]);
    let t = tExit; let hx = u.px + rdx * t; let hy = u.py + rdy * t;
    let along = select(select(hx * kny - hy * knx, hx, face < 4), hy, face < 2);
    let corner = along - bld[q + 36u + u32(face) * 2u] < 0.35 || bld[q + 37u + u32(face) * 2u] - along < 0.35;
    let bay = along / BAY; let fw = bay - floor(bay); let ground = fl == 0;
    var isDoor = false; var du = 0.0; var doorW = 1.0;
    if (ground) {
      let eb = lb + nL * 8u;
      for (var e = 0u; e < fx[IB + 9u]; e++) {
        let w = eb + e * 3u; let a0 = fxf(w + 1u); let a1 = fxf(w + 2u);
        if (i32(fx[w]) == face && along > a0 && along < a1) { isDoor = true; du = (along - a0) / (a1 - a0); doorW = a1 - a0; }
      }
    }
    // metres of wall one column covers there, and reading left to right from inside
    let colA = u.colW * t / max(1e-6, abs(select(select(knx * rdx + kny * rdy, rdy, face < 4), rdx, face < 2)));
    let rdF = toRight(select(select(kny, 1.0, face < 4), 0.0, face < 2), select(select(-knx, 0.0, face < 4), 1.0, face < 2), rdx, rdy);
    var nX = 0.0; var nY = 0.0;
    if (face == 0) { nX = -1.0; } else if (face == 1) { nX = 1.0; } else if (face == 2) { nY = -1.0; } else if (face == 3) { nY = 1.0; } else { nX = knx; nY = kny; }
    // a wall against the next building has no windows, up to that building's roof
    let blind = builtUp(hx + nX * 0.3, hy + nY * 0.3, z0 + 1.0);
    // a panoramic lift: glass from the car's floor to its ceiling
    var liftGlass = false;
    let gk = fx[IB + 10u];
    if (kind == R_LIFT && gk != 0u) { let gu = select(hy, hx, gk == 1u); let gv = select(hx, hy, gk == 1u); liftGlass = gu > fxf(IB + 11u) && gu < fxf(IB + 12u) && gv > fxf(IB + 13u) && gv < fxf(IB + 14u); }
    let shade = select(select(0.82, 1.0, face < 2), 0.9, face == 4);
    let Lt = litIn(IB, ro, r0, hx, hy, t);
    res.nearT = t; res.gt = t; res.ga = along; res.gdoor = isDoor; res.gl = Lt; res.gc = abs(nX * rdx + nY * rdy) / rl; res.gh = atan2(rdy, rdx);
    let z = u.eye - m * t;
    if (z > z0 && z <= zc) {
      let fz = z / FLOOR_H - floor(z / FLOOR_H);
      if (isDoor) {
        // the street door from inside: a metal frame, the middle stile, a push bar and the top rail around
        // its two glass leaves; over it the green EXIT sign
        let zz = z - z0;
        if (zz > DOOR_H + 0.06 && zz < DOOR_H + 0.34 && du > 0.25 && du < 0.75) {
          let ep = exitPx(select((0.75 - du) * 2.0, (du - 0.25) * 2.0, rdF), (DOOR_H + 0.34 - zz) / 0.28, colA / (doorW * 0.5), t / u.scale / 0.28);
          res.cl = roomCell(ep.ch, ep.c, t); res.state = 1u; return res;
        }
        if (zz < DOOR_H) {
          let frame = du < 0.05 || du > 0.95 || abs(du - 0.5) < 0.025 || zz > DOOR_H - 0.1 || zz < 0.08;
          let bar = zz > 0.95 && zz < 1.08 && abs(du - 0.5) > 0.08 && abs(du - 0.5) < 0.42;
          if (frame || bar) { res.cl = roomCell(select(EQ, BAR, frame), select(vec3f(95.0, 98.0, 105.0), vec3f(190.0, 190.0, 195.0), bar) * Lt, t); res.state = 1u; return res; }
          res.state = 2u; return res;
        }
        // above the door and its sign: wall, never a window
        let p = wallPx(kind, unit, zrOf(z, z0), along);
        res.cl = roomCell(p.ch, p.c * Lt * shade, t); res.state = 1u; return res;
      }
      if ((liftGlass && z > z0 + 0.12 && z < zc - 0.08) || (!corner && !blind && !liftGlass && windowHole(st, shop, fw, fz, z - z0, ground))) { res.state = 2u; return res; }
      let zr = zrOf(z, z0);
      // the sill: just under a window
      if (!corner && !blind && zr < 1.5 && windowHole(st, shop, fw, fz + 0.1 / FLOOR_H, zr + 0.1, ground)) { res.cl = roomCell(EQ, vec3f(150.0, 140.0, 125.0) * Lt, t); res.state = 1u; return res; }
      let p = wallPx(kind, unit, zr, along);
      res.cl = roomCell(p.ch, p.c * Lt * shade, t); res.state = 1u; return res;
    }
  }
  // floor and ceiling in what is left: each row meets them at its own distance
  let below = m > 0.0;
  let t = select((zc - u.eye) / -m, (u.eye - z0) / m, below);
  if (!(t > 0.0) || t > 200.0) { return res; }
  let wx = u.px + rdx * t; let wy = u.py + rdy * t;
  var c = planCell(o, ifloor(wx / PCELL) - gx, ifloor(wy / PCELL) - gy);
  if (c == 0u) { c = select(1u, cur, cur != 0u); }
  let r = i32(c & 127u) - 1;
  if (r < 0 || u32(r) >= nRooms) { return res; }
  let ro = roomRec(o, r); let kind = fx[ro + 4u];
  var p = Px(0u, vec3f(0.0));
  if (below) { p = floorPx(kind, office, wx, wy); } else { let lp = inLamp(IB, r); p = ceilPx(ro, kind, office, lp.x + lp.y > 0.05, wx, wy); }
  res.cl = roomCell(p.ch, p.c * litIn(IB, ro, r, wx, wy, t), t); res.state = 1u;
  return res;
}
/**
 * The window glass seen from inside, over what is behind it (glassPass): a little darker, the room's light reflected
 * more the more it is seen edge on, following the view; in the rain, drops sliding down and beads that stay.
 */
fn glassOver(cl: Cell, g: InC, m: f32) -> Cell {
  var o = cl;
  if (o.depth < g.gt - 0.05) { return o; } // the furniture in front of the window
  let col = ifloor(g.ga * 9.0); let speed = 0.25 + hash3(col, 1, 7) * 0.5; let ph = hash3(col, 2, 7) * 9.0; let slides = hash3(col, 3, 7) < u.rain * 0.5;
  let fres = 0.14 + 0.6 * pow(max(1e-6, 1.0 - g.gc), 3.0); let keep = 1.0 - 0.55 * fres;
  let e = -m; let z = u.eye + e * g.gt;
  let streak = pow(max(1e-6, 0.5 + 0.5 * sin(g.gh * 2.2 + e * 1.7 + 0.6)), 10.0); let mm = fres * (60.0 + 150.0 * streak);
  o.c = sat(o.c) * keep * vec3f(0.8, 0.88, 0.95) + vec3f(10.0, 16.0, 22.0) + mm * g.gl;
  if (u.rain > 0.0 && !g.gdoor) {
    let dzr = (z - g.gz0) + u.sec * speed + ph; let dz = dzr - 3.0 * floor(dzr / 3.0);
    let slide = slides && dz < (g.gt / u.scale) * 1.2;
    let bead = hash3(ifloor(g.ga * 14.0), ifloor(z * 14.0), 8) < u.rain * 0.06;
    if (slide || bead) { o.ch = select(DOT, COM, slide); o.c += vec3f(50.0, 55.0, 65.0); }
  }
  return o;
}

// ---- a wall (wallColumn): the facade by its style, its windows, and the lights on it
// (m and A: the ray's drop and the curve's, to find heights on it a little nearer, at a relief or the scaffolding)
fn wallCell(bk: i32, t: f32, side: i32, rdx: f32, rdy: f32, zw: f32, dz: f32, m: f32, A: f32) -> Cell {
  let q = u32(bk * ${BLD});
  let x0 = bld[q]; let y0 = bld[q + 1u]; let x1 = bld[q + 2u]; let y1 = bld[q + 3u]; let H = bld[q + 4u];
  let hx = u.px + t * rdx; let hy = u.py + t * rdy;
  let style = i32(bld[q + 10u]); let lit = bld[q + 11u]; let feat = bld[q + 18u];
  let shop = bld[q + 19u] > 0.5;
  let win = colAt(q + 12u); let frame = colAt(q + 15u); let sign = colAt(q + 21u);
  // where along the face, its light, the face's span
  var along = 0.0; var lightK = 1.0; var face = 0; var dn = 1.0; var wsun = 0.0;
  if (side == 2) {
    let rr = (x1 - x0) * 0.5; let nx = (hx - x0 - rr) / rr; let ny = (hy - y0 - rr) / rr;
    along = (atan2(ny, nx) + 3.14159265) * rr; lightK = 0.72 + 0.28 * abs(nx);
    wsun = nx * u.sunX + ny * u.sunY;
  } else if (side == 3) {
    let kx = bld[q + 7u]; let ky = bld[q + 8u];
    along = hx * ky - hy * kx; lightK = 0.72 + 0.28 * abs(kx); face = 4; dn = kx * rdx + ky * rdy;
    wsun = kx * u.sunX + ky * u.sunY;
  } else {
    along = select(hx, hy, side == 0); lightK = select(0.72, 1.0, side == 0);
    if (side == 0) { face = select(0, 1, rdx < 0.0); dn = rdx; } else { face = select(3, 2, rdy > 0.0); dn = rdy; }
    wsun = select(select(select(u.sunY, -u.sunY, face == 2), u.sunX, face == 1), -u.sunX, face == 0);
  }
  var f0 = -1e9; var f1 = 1e9;
  if (side != 2) { f0 = bld[q + 36u + u32(face) * 2u]; f1 = bld[q + 37u + u32(face) * 2u]; }
  let dAlong = u.colW * t / max(1e-6, abs(dn));
  let fogK = 1.0 - exp(-t / FOG);
  let shade0 = lightK * (1.0 - fogK * 0.6 * (1.0 - u.day)); var shade = shade0; // by day the haze is the finish's
  let winLight = 1.0 - fogK * 0.45;
  // the building's power now, its signs' (never on the generator), and each window's
  let sub = i32(bld[q + 46u]); let gen = bld[q + 47u] > 0.5;
  let cx = (x0 + x1) * 0.5; let cy = (y0 + y1) * 0.5;
  let pw = power(sub, cx, cy, bk, gen, bk, 0.25);
  let ad = select(pw, power(sub, cx, cy, bk, false, bk, 0.25), gen);
  let elec = winLight * pw; let adElec = winLight * ad;
  let switched = subs[u32(sub) * 4u] >= 0.0;
  let litK = lit * (1.0 - 0.75 * u.day);
  let rpf = FLOOR_H * u.scale / t; let cpb = BAY / (u.colW * t);
  let detailed = rpf >= 2.2 && cpb >= 1.5;
  // how fast the hit moves along the face, per unit of t
  var da = 0.0;
  if (side == 0) { da = rdy; } else if (side == 1) { da = rdx; } else if (side == 3) { da = rdx * bld[q + 8u] - rdy * bld[q + 7u]; }
  let along0 = along; var z = zw; var T = t;
  // a bay, pilaster or pier in front of the wall plane (reliefOf): where the ray meets it first, its
  // front (rs 1) or its side (rs 2); there it is nearer, at its own spot along the face, lit by its own side
  var rs = 0;
  if (detailed && side != 2 && bld[q + 62u] > 0.5) {
    let per = bld[q + 55u] * BAY; let o = bld[q + 56u] * BAY + bld[q + 57u]; let rw = bld[q + 58u];
    let sb = bld[q + 59u] / max(1e-6, abs(dn)); let af = along - da * sb;
    let lo = min(af, along); let hi = max(af, along);
    var bl = 2.0;
    let k0 = ifloor((lo - o - rw) / per); let k1 = min(ifloor((hi - o) / per), k0 + 64);
    for (var k = k0; k <= k1; k++) {
      let s0 = f32(k) * per + o; let s1 = s0 + rw;
      if (s0 < f0 + 0.5 || s1 > f1 - 0.5) { continue; }
      var l0 = 0.0; var l1 = 1.0;
      if (abs(along - af) < 1e-9) { if (af < s0 || af > s1) { continue; } }
      else { let a = (s0 - af) / (along - af); let b = (s1 - af) / (along - af); l0 = max(0.0, min(a, b)); l1 = min(1.0, max(a, b)); }
      if (l0 <= l1 && l0 < bl) { bl = l0; }
    }
    if (bl <= 1.0) {
      let rT = t - sb + sb * bl; let zr = u.eye - m * rT + A * rT * rT;
      if (zr > bld[q + 60u] && zr < bld[q + 61u]) {
        rs = select(2, 1, bl < 1e-6); T = rT; z = zr; along = af + (along - af) * bl;
        shade = shade0 * select(0.68, 1.08, rs == 1);
      }
    }
  }
  let kv = select(u32(ceil(log2(1.0 / rpf))), 0u, rpf >= 1.0); let kh = select(u32(ceil(log2(1.0 / cpb))), 0u, cpb >= 1.0);
  let bay = along / BAY; let wi = ifloor(bay); let fw = bay - f32(wi);
  let corner = along - f0 < 0.35 || f1 - along < 0.35;
  // the street doors on this face (the main one, and the shops' once the ground plan is made), and a
  // fire escape two bays wide over this spot (only drawn where there is one)
  var dA0 = 0.0; var dA1 = -1.0; var esc = false;
  let fo = fx[FX_TAB + u32(bk)];
  if (fo > 0u) {
    for (var e = 0u; e < fx[fo]; e++) {
      let w = fo + 1u + e * 3u; let kf = fx[w]; let a0 = bitcast<f32>(fx[w + 1u]); let a1 = bitcast<f32>(fx[w + 2u]);
      if (i32(kf >> 4u) != face || side == 2) { continue; }
      if ((kf & 15u) == 0u) { if (along0 > a0 && along0 < a1) { dA0 = a0; dA1 = a1; } }
      else if (along >= a0 && along < a1 && !corner) { esc = true; }
    }
  }
  // a clock tower is a historic facade with a clock face near the top of each side
  var S = style; if (style == 12) { S = 3; }
  let clockR = select(0.0, min(3.0, (f1 - f0) * 0.32), style == 12 && side != 2); let clockZ = H - clockR - 2.0;
  let du = along - (f0 + f1) * 0.5;
  let farWall = select(select(COL, BAR, S == 5), EQ, S == 2);
  let farK = select(1.0, 1.6, S == 1); // the curtain wall up close averages ~1.6x its frame (sheen, mullions)
  let balcony = S == 4 && feat < 0.5; let balK = ifloor(fract(feat * 131.0) * 4.0);
  let pIdx = ifloor(fract(feat * 977.0) * 5.0); let pat = PATS[pIdx];
  let band = select(0, 1 + ifloor(fract(feat * 53.0) * 3.0), fract(feat * 311.0) < 0.35);
  // the glass mirrors the sky: bands slide over it as the viewer moves
  var tang = 0.0;
  if (side == 0) { tang = rdy; } else if (side == 1) { tang = rdx; } else if (side == 3) { tang = rdx * bld[q + 8u] - rdy * bld[q + 7u]; }
  else { let nx = hx - cx; let ny = hy - cy; let n = max(1e-6, length(vec2f(nx, ny))); tang = (rdx * -ny + rdy * nx) / n; }
  let sheen = 0.5 + 0.5 * sin(tang * 6.0 + ((z - u.eye) / t) * 4.0 + f32(bk % 7));
  let fl = ifloor(z / FLOOR_H); let fz = z / FLOOR_H - f32(fl);
  let escU = (f32(wi % 7) - 2.0 + fw) / 2.0;
  // the room behind the wall here, near enough to make out: this floor's plan (the ground floor's or the
  // upper floors' of this box), entered where the ray met the wall
  var po = 0u; var pk = Peek(false, 0.0, 0, 0.0, 0.0); var lot = -1;
  if (detailed && t < PEEK_FAR && side != 2 && fl >= 0 && f32(fl) < floor((H - 1.0) / FLOOR_H + 0.5)) {
    po = fx[FX_TAB + fx[0] + u32(bk) * 2u + select(1u, 0u, fl == 0)];
    if (po > 0u) { lot = i32(fx[po + 5u]); pk = peekInto(po, q, hx, hy, rdx, rdy); }
  }
  let winPw = select(winLight, power(sub, cx, cy, bk * 131 + wi * 977 + fl * 7, gen, bk, 1.5) * winLight, switched);
  var isWin = false;
  let escCell = esc && z > FLOOR_H && (fz < 0.08 || escU < 0.04 || escU > 0.96 || abs(select(escU, 1.0 - escU, (fl & 1) == 1) - fz) < 0.1);
  var ch = 0u; var c = vec3f(0.0); var em = false; var il = vec3f(0.0); var glowK = 1.0;
  // seen from the other side, text reads mirrored along the face (rev in wallColumn)
  let rev = side < 2 && (face == 1 || face == 2);
  let sec = u.sec; let scol = sign;
  // the shop sign on this face: the business name centered on it, if at least 3 letters fit
  let biz = i32(bld[q + 48u]);
  var signN = 0; var signU = 0.0; var stx = vec2u(0u); var smode = 0u; var sfull = 0.0;
  if (biz >= 0 && side != 2) {
    stx = bizText(biz, ifloor((f1 - f0 - 1.2) / LETTER_W) - 2);
    signN = select(0, i32(stx.y), stx.y >= 3u);
    signU = along - (f0 + f1) * 0.5 + f32(signN + 2) * LETTER_W * 0.5;
    if (signU < 0.0 || signU >= f32(signN + 2) * LETTER_W) { signN = 0; }
    smode = sg[SG_BIZ + u32(biz) * 3u + 2u]; sfull = f32(sg[SG_BIZ + u32(biz) * 3u] & 255u);
  }
  let letters = LETTER_W / dAlong >= 0.9;
  // a painted ad high on one face: the business's name in big block letters on a colored board
  let adB = i32(bld[q + 49u]);
  var adN = 0; var adTx = vec2u(0u); var adA0 = 0.0; var adA1 = 0.0; var adZ0 = 0.0; var adZ1 = 0.0;
  if (adB >= 0 && side != 2 && face == ifloor(hash3(bk, 7, 77) * select(4.0, 5.0, bld[q + 6u] > 0.5))) {
    let w = min(f1 - f0 - 2.0, 16.0); let mid = (f0 + f1) * 0.5;
    if (w > 5.0) {
      adTx = bizText(adB, ifloor((w - 1.0) / AD_LETTER)); adN = i32(adTx.y);
      adA0 = mid - w / 2.0; adA1 = mid + w / 2.0; adZ1 = H - 1.6; adZ0 = max(FLOOR_H * 1.5, adZ1 - 5.5);
    }
  }
  // a video screen on this face, above the shop sign (and the ticker), as wide as the face allows
  let ticker = bld[q + 51u] > 0.5;
  var scA0 = 0.0; var scA1 = 0.0; var scZ0 = 0.0; var scZ1 = 0.0;
  if (side != 2 && ((u32(bld[q + 50u]) >> u32(face)) & 1u) == 1u) {
    let w = min(f1 - f0 - 1.5, 16.0); let mid = (f0 + f1) * 0.5;
    if (w > 4.0) { scA0 = mid - w / 2.0; scA1 = mid + w / 2.0; scZ0 = select(5.2, TICK_Z1 + 1.2, ticker); scZ1 = min(H - 1.5, scZ0 + min(12.0, w * 0.75)); }
  }
  // a window's color: lit in the building's window color (or its band's), dark ones deep blue glass
  var wc = win; if (band > 0 && ((fl / band) & 1) == 1) { wc = sign; }
  let hh = hash3(bk, wi, fl);
  var wp = 0.0;
  if (hh < litK) { wp = select(winLight, power(sub, cx, cy, bk * 131 + wi * 977 + fl * 7, gen, bk, 1.5) * winLight, switched); }
  let wk = wp * (0.65 + 0.35 * hash3(wi, fl, bk));
  let darkPane = vec3f(30.0 * shade + 8.0, 36.0 * shade + 8.0, 58.0 * shade + 12.0);
  if (S == 7 || S == 10) {
    if (z > H - 1.0) { ch = STAR; c = win * winLight; em = true; }
    else if (S == 10 && ((z > H - 6.0 && z < H - 4.5) || (z > H - 10.0 && z < H - 8.5))) { ch = EQ; c = frame * 1.9 * shade; }
    else { ch = select(BAR, EQ, S == 10 && detailed); c = frame * select(1.0, 1.2, S == 7) * shade; }
  } else if (z > H - max(0.6, dz)) {
    ch = US; c = frame * 1.5 * shade;
    if (u.snow > 0.05) { c += (vec3f(190.0, 195.0, 205.0) - c) * (u.snow * 0.8); }
  } else if (rs == 2) { ch = select(BAR, EQ, S == 2); c = frame * shade; } // the side of a bay or pier
  else if (clockR > 0.0 && length(vec2f(du, z - clockZ)) < clockR) {
    let cz = z - clockZ; let d = length(vec2f(du, cz));
    let a1 = 150.0 * 3.14159265 / 180.0; let a2 = 30.0 * 3.14159265 / 180.0;
    let s1 = du * cos(a1) + cz * sin(a1); let s2 = du * cos(a2) + cz * sin(a2);
    let hand = (s1 > 0.0 && s1 < clockR * 0.5 && abs(-du * sin(a1) + cz * cos(a1)) < 0.22) || (s2 > 0.0 && s2 < clockR * 0.75 && abs(-du * sin(a2) + cz * cos(a2)) < 0.22);
    if (d > clockR * 0.82) { ch = O; c = frame * 1.6 * shade; }
    else if (hand) { ch = HASH; c = vec3f(40.0, 30.0, 20.0); }
    else { ch = select(COL, O, d < 0.3); c = vec3f(250.0, 230.0, 170.0) * elec; em = true; }
  } else if (S == 13) {
    if (z % 30.0 < 1.0 && corner) { ch = STAR; c = win * winLight; em = true; }
    else if (!detailed) { ch = BAR; c = frame * shade; }
    else if (corner) { ch = BAR; c = frame * 1.3 * shade; }
    else {
      let a = ((along + z) % 3.0 + 3.0) % 3.0 < 0.35; let b = ((along - z) % 3.0 + 3.0) % 3.0 < 0.35;
      ch = select(select(select(DOT, BS, b), SL, a), X, a && b); c = frame * select(0.35, 1.2, a || b) * shade;
    }
  } else if (S == 14) {
    if (along % 7.0 < 0.5) { ch = BAR; c = frame * 1.4 * shade; }
    else if (z % 6.0 < 0.45) { ch = EQ; c = frame * 1.3 * shade; }
    else { ch = select(DOT, COL, detailed); c = frame * 0.75 * shade; }
  } else if (S == 6) {
    if ((ifloor(along / select(1.6, 0.8, detailed)) & 1) == 1) { ch = BAR; c = win * adElec * 0.9; em = true; }
    else { ch = BAR; c = frame * 1.2 * shade; }
  } else if (S == 8) { ch = select(COL, BAR, detailed && along % 2.0 < 0.3); c = frame * 1.2 * shade; }
  else if (S == 11) { ch = select(HASH, EQ, detailed && fw < 0.5); c = frame * 0.9 * shade; }
  else if (S == 9) {
    let tr = (x1 - x0) * 0.5; let lid = H - 0.6 * tr; let base = lid - 1.7 * tr;
    if (z < base) { ch = select(DOT, BAR, along % 1.6 < 0.3); c = frame * 0.6 * shade; }
    else if (z > lid) { ch = CARET; c = frame * shade; }
    else { ch = select(BAR, EQ, abs(z - (base + 0.33 * (lid - base))) < 0.2 || abs(z - (base + 0.7 * (lid - base))) < 0.2); c = frame * shade; }
  } else if (signN > 0 && z > SIGN_Z0 && z < SIGN_Z1) {
    // neon sign: letters on the middle row, a frame (or marquee bulbs) around them
    em = true;
    let col = ifloor(signU / LETTER_W) - 1; let inText = col >= 0 && col < signN && z > 2.75 && z < 3.25;
    let kk = select(col, signN - 1 - col, rev);
    var cc = 32u; if (col >= 0 && col < signN) { cc = sg[stx.x + u32(kk)]; }
    let lit = signLight(biz, smode, select(-1, kk, inText), sfull, sec) * adElec;
    // up close a letter covers several cells: the glyph goes in the one holding its center, the others glow
    let center = abs((signU / LETTER_W - f32(col) - 1.5) * LETTER_W) < dAlong / 2.0 && abs(z - 3.0) < dz / 2.0 + 0.01;
    // big enough, a letter is drawn as its 5x7 pattern of bulbs
    let bulbs = LETTER_W / dAlong >= BULB_COLS && 0.56 / dz >= BULB_ROWS;
    if (bulbs && col >= 0 && col < signN && z > 2.72 && z < 3.28) {
      var fu = signU / LETTER_W - f32(col) - 1.0;
      if (rev) { fu = 1.0 - fu; }
      let on = signLight(biz, smode, kk, sfull, sec) * adElec;
      let px = (fu * LETTER_W - 0.05) / 0.09; let pz = (3.28 - z) / 0.08; let hx = dAlong / 0.18; let hz = dz / 0.16;
      let nn = bulbsIn(cc, px, pz, hx, hz);
      let hue = bulbHue(scol);
      if (nn > 0u) { ch = bulbGlyph(nn, hx, hz); c = hue * on; }
      else if (bulbOn(cc, ifloor(px), ifloor(pz))) { ch = 32u; c = hue * (on * 0.35); }
      else { ch = 32u; c = vec3f(14.0, 12.0, 16.0); }
    } else if (inText && cc != 32u && (!letters || center)) { ch = select(EQ, cc, letters); c = scol * lit; }
    else if (inText) { ch = 32u; c = scol * (lit * 0.35); }
    else if (smode == 4u) {
      // the marquee's white bulbs are on the building's power too
      let on = (ifloor(signU / 0.3) + ifloor(sec * 7.0)) % 3 == 0 && ad > 0.05;
      ch = select(DOT, O, on); c = vec3f(255.0, 225.0, 150.0) * (select(0.3, 1.0, on) * min(ad, 1.3));
    } else if (z < 2.72 || z > 3.28) { ch = DASH; c = scol * (lit * 0.45); }
    else { ch = DOT; c = vec3f(14.0, 12.0, 16.0); }
  } else if (ticker && side != 2 && z > TICK_Z0 - 0.15 && z < TICK_Z1 + 0.15) {
    // the news ticker: headlines in amber bulbs running right to left around the building
    if (z < TICK_Z0 || z > TICK_Z1) { ch = EQ; c = frame * 0.7 * shade; }
    else {
      em = true;
      let n = i32(u.tickN); let p = select(along, -along, rev) + sec * TICK_SPEED; let li = ifloor(p / TICK_LW); let fu = p / TICK_LW - f32(li);
      var lc = 32u; if (n > 0) { lc = sg[sg[0] + u32(((li % n) + n) % n)]; }
      let lh = TICK_Z1 - TICK_Z0; let on = adElec;
      if (TICK_LW / dAlong >= BULB_COLS && lh / dz >= BULB_ROWS) {
        // up close, bulbs (0.14 m apart), counted per cell like the shop signs'
        let bz = (lh - 0.2) / 7.0; let hx = dAlong / 0.28; let hz = dz / bz / 2.0;
        let nb = bulbsIn(lc, (fu * TICK_LW - 0.08) / 0.14, (TICK_Z1 - 0.1 - z) / bz, hx, hz);
        if (nb > 0u) { ch = bulbGlyph(nb, hx, hz); c = vec3f(255.0, 150.0, 45.0) * on; } else { ch = DOT; c = vec3f(34.0, 20.0, 12.0); }
      } else if (TICK_LW / dAlong >= 0.9) {
        let center = abs(fu - 0.45) * TICK_LW < dAlong / 2.0 && abs(z - (TICK_Z0 + TICK_Z1) / 2.0) < dz / 2.0 + 0.01;
        ch = select(32u, lc, center); c = vec3f(255.0, 150.0, 45.0) * select(0.12 * on, on, center);
      } else { ch = EQ; c = vec3f(160.0, 95.0, 30.0) * on; }
    }
  } else if (scZ1 > scZ0 && along > scA0 && along < scA1 && z > scZ0 && z < scZ1) {
    // a video screen behind a dark bezel
    if (along - scA0 < 0.25 || scA1 - along < 0.25 || z - scZ0 < 0.25 || scZ1 - z < 0.25) { ch = HASH; c = frame * 0.45 * shade; }
    else {
      let P = screenPix(bk, select(along - scA0, scA1 - along, rev), scZ1 - z, scA1 - scA0, scZ1 - scZ0, dAlong, dz);
      ch = P.ch; c = P.c * adElec; em = true;
    }
  } else if (dA1 > dA0 && z < DOOR_H + 0.35) {
    // the street door: a frame, two glass leaves and a transom, lit from the lobby
    let e = min(along - dA0, dA1 - along);
    if (e < 0.12 || z > DOOR_H + 0.22) { ch = select(EQ, BAR, e < 0.12); c = frame * 1.5 * shade; }
    else { ch = select(select(COL, BAR, abs(along - (dA0 + dA1) * 0.5) < 0.06), DASH, z > DOOR_H); c = vec3f(255.0, 220.0, 160.0) * (0.4 * elec); em = true; glowK = 0.3; }
  } else if (adN > 0 && along > adA0 && along < adA1 && z > adZ0 && z < adZ1) {
    // the ad: a frame, then the letters (5 x 7 blocks each) centered on the board, weathered paint
    let lw = AD_LETTER; let start = (adA0 + adA1) * 0.5 - f32(adN) * lw * 0.5; let zc = (adZ0 + adZ1) * 0.5;
    let col = ifloor((along - start) / lw); let kk = select(col, adN - 1 - col, rev);
    let fu = ((along - start) / lw - f32(col)) * 1.25 - 0.12; let fzz = (zc + 1.1 - z) / 2.2;
    var on = false;
    if (col >= 0 && col < adN && fu >= 0.0 && fu < 1.0 && fzz >= 0.0 && fzz < 1.0) { on = bulbOn(sg[adTx.x + u32(kk)], ifloor(select(fu, 1.0 - fu, rev) * 5.0), ifloor(fzz * 7.0)); }
    let edge = along - adA0 < 0.25 || adA1 - along < 0.25 || z - adZ0 < 0.25 || adZ1 - z < 0.25;
    let hp = ifloor(hash3(bk, 8, 77) * ${AD_BG.length}.0);
    var ac = select(AD_BG[hp], AD_FG[hp], on); if (edge) { ac = FRAME_AD; }
    ch = select(select(select(DOT, COL, hash3(ifloor(along * 2.0), ifloor(z * 2.0), 5) < 0.2), HASH, on), EQ, edge);
    c = ac * ((0.75 + 0.25 * hash3(ifloor(along * 3.0), ifloor(z * 3.0), bk)) * shade);
    // lit from below by gooseneck lamps at night
    let al = vec3f(120.0, 105.0, 80.0) * ((1.0 - u.day) * ad * max(0.0, 1.0 - (z - adZ0) / (adZ1 - adZ0)) * 0.9); c += al; il += al;
  } else if (pk.ok && !escCell && !corner && windowHole(style, shop, fw, fz, z - f32(fl) * FLOOR_H, fl == 0)) {
    // a window: the room behind it, lit by its own lamps
    let P = peekCell(po, lot, bk, pk, fl, rdx, rdy, -m, t, winPw, sheen);
    ch = P.ch; c = P.c; isWin = true;
  } else if (detailed && S != 1 && S != 5 && S != 3 && z > H - 1.3) {
    // cornice with dentils
    ch = select(select(DOT, QUO, (i32(along * 4.0) & 1) == 1), EQ, z > H - 0.95); c = frame * 1.4 * shade;
  } else if (detailed && (S == 0 || S == 2 || S == 4) && fl > 1 && fl % (4 + i32(feat * 3.0)) == 0 && fz < 0.07) {
    ch = EQ; c = frame * 1.3 * shade; // a belt course every few floors
  } else if (detailed && S == 2 && !corner && fw > 0.27 && fw < 0.73 && ((fz > 0.78 && fz < 0.86) || (fz > 0.25 && fz < 0.3))) {
    ch = select(US, DASH, fz > 0.5); c = frame * 1.3 * shade; // stone lintel and sill
  } else if (detailed && S == 0 && feat > 0.6 && wi % 2 == 0 && fw < 0.18) {
    ch = BAR; c = frame * 1.3 * shade; // art deco piers
  } else if (detailed && (S == 0 || S == 4) && z < FLOOR_H && !shop && !corner) {
    ch = select(HASH, EQ, (ifloor(z / 0.5) & 1) == 1); c = frame * 0.95 * shade; // a stone base
  } else if (!detailed) {
    // far: several floors and bays share a cell, grouped in powers of two so the pattern holds still
    let gw = wi >> kh; let gf = fl >> kv;
    let h2 = hash3(bk, gw, gf);
    var p2 = 0.0;
    if (h2 < litK) { p2 = select(winLight, power(sub, cx, cy, bk * 131 + gw * 977 + gf * 7, gen, bk, 1.5) * winLight, switched); }
    if (p2 > 0.04) {
      ch = select(COL, O, h2 < litK * 0.4);
      var w2 = win; let gfl = gf << kv; if (band > 0 && ((gfl / band) & 1) == 1) { w2 = sign; }
      c = w2 * p2 * (0.65 + 0.35 * hash3(gw, bk, 5)); em = true;
    } else {
      // the average of what up close is wall and dark panes, so the color holds when the detail comes in
      let paneK = select(select(select(0.3, 0.2, S == 2), 0.24, S == 4), 0.0, S == 1 || S == 5);
      ch = farWall; c = mix(frame * farK * shade, darkPane, paneK);
    }
  } else if (z < FLOOR_H && shop) {
    if (fw > 0.12 && fw < 0.88 && z > 0.2 && z < 2.6 && !corner) { ch = select(select(COL, RB, fw > 0.8), LB, fw < 0.2); c = vec3f(180.0, 150.0, 100.0) * elec; em = true; }
    else { ch = BAR; c = frame * shade; }
  } else if (S == 1) {
    // curtain wall: mullions and floor slabs over tinted glass with a diagonal sheen
    if (fz < 0.08) { ch = DASH; c = frame * 0.8 * shade; }
    else if (fw < 0.07 || corner) { ch = BAR; c = frame * 1.5 * shade; }
    else if (hh < litK) {
      if (wp > 0.04) { ch = select(select(COL, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; em = true; } else { ch = EQ; c = darkPane; }
    } else { ch = select(select(DOT, COL, sheen > 0.4), SL, sheen > 0.85); c = frame * (1.3 + 0.9 * sheen) * shade; }
  } else if (S == 5) {
    let dp = along % 6.0;
    if (z > H - 3.2 && z < H - 1.4) {
      if (fw > 0.08 && fw < 0.92) {
        let p0 = select(winLight, power(sub, cx, cy, bk * 131 + wi * 977, gen, bk, 1.5) * winLight, switched);
        if (hash3(bk, wi, 0) < litK * 2.0 && p0 > 0.04) { ch = HASH; c = win * p0 * 0.75; em = true; }
        else { ch = EQ; c = vec3f(22.0 * shade + 8.0, 26.0 * shade + 8.0, 36.0 * shade + 10.0); }
      } else { ch = BAR; c = frame * 1.2 * shade; }
    } else if (z < 4.5 && ifloor(along / 6.0) % 3 == 1 && !corner) {
      let edge = dp < 0.4 || dp > 5.6;
      ch = select(select(DASH, EQ, z > 4.1), BAR, edge); c = frame * select(1.15, 1.3, edge) * shade;
    } else { ch = BAR; c = frame * select(0.78, 1.0, (ifloor(along / 0.6) & 1) == 1) * shade; }
  } else if (escCell) {
    // fire escape: landings, rails and a zigzag stair between floors
    ch = select(select(select(SL, BS, (fl & 1) == 1), BAR, escU < 0.04 || escU > 0.96), EQ, fz < 0.08);
    c = vec3f(95.0, 95.0, 105.0) * shade;
  } else if (S == 3) {
    if (z > H - 2.2) { ch = select(select(QUO, COL, (i32(fw * 4.0) & 1) == 1), EQ, z > H - 1.2); c = frame * 1.3 * shade; }
    else if (z < FLOOR_H * 1.2) { ch = select(HASH, EQ, (ifloor(z / 0.7) & 1) == 1); c = frame * 0.9 * shade; }
    else if ((wi % 3 == 0 && fw < 0.28) || corner) { ch = BAR; c = frame * 1.25 * shade; }
    else if (fz < 0.08) { ch = DASH; c = frame * 1.1 * shade; }
    else if (fw > 0.3 && fw < 0.7 && fz > 0.18 && fz < 0.82) {
      if (fz > 0.7) { ch = CARET; c = frame * 1.3 * shade; }
      else if (wp > 0.04) { ch = select(select(HASH, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; em = true; } else { ch = EQ; c = darkPane; }
    } else { ch = COL; c = frame * shade; }
  } else if (S == 2) {
    if (fw > 0.3 && fw < 0.7 && fz > 0.3 && fz < 0.78 && !corner) {
      if (wp > 0.04) { ch = select(select(HASH, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; em = true; } else { ch = EQ; c = darkPane; }
    } else {
      let course = ifloor(z / 0.5); let off = f32(course & 1) * 0.6;
      ch = select(EQ, BAR, corner); c = frame * (0.8 + 0.35 * hash3(course, ifloor((along + off) / 1.2), bk)) * shade;
    }
  } else if (S == 4) {
    let balAt = balK == 3 || select(fw > 0.1 && fw < 0.9 && (balK != 1 || (fl & 1) == 1), wi % 4 < 2 && fw > 0.04 && fw < 0.96, balK == 2);
    if (balcony && z > FLOOR_H && fz < 0.25 && balAt) {
      if (fz < 0.07) { ch = EQ; c = frame * 1.35 * shade; }
      else if (balK == 1) { ch = HASH; c = frame * 1.1 * shade; }
      else if (balK == 2) { ch = COL; c = vec3f(110.0 * shade + 10.0, 140.0 * shade + 10.0, 160.0 * shade + 12.0); }
      else { ch = select(BAR, DASH, balK == 3); c = frame * 1.3 * shade; }
    } else if (fw > 0.25 && fw < 0.75 && fz > 0.3 && fz < 0.78 && !corner) {
      if (wp > 0.04) { ch = select(select(HASH, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; em = true; } else { ch = EQ; c = darkPane; }
    } else { ch = select(DOT, BAR, corner); c = frame * shade; }
  } else if (fw > 0.2 && fw < 0.8 && fz > 0.28 && fz < 0.8 && !corner) {
    if (wp > 0.04) { ch = select(select(pat.z, pat.y, hh < litK * 0.7), pat.x, hh < litK * 0.3); c = wc * wk; em = true; } else { ch = EQ; c = darkPane; }
  } else { ch = select(select(COL, DOT, t > 60.0), BAR, corner); c = frame * shade; }
  var emC = select(vec3f(0.0), c, em);
  // a lit room's light spills onto the wall around its window
  // (only where this floor has a window in this bay: a stone base or a blind wall has none to spill from)
  if (pk.ok && !isWin && !corner && z < H - 0.6 && pk.r >= 0 && windowHole(style, shop, 0.5, 0.54, 0.54 * FLOOR_H, fl == 0)) {
    let GL = roomLamp(lot, bk, roomRec(po, pk.r), pk.r, fl, winPw);
    if (GL.x + GL.y + GL.z > 0.02) {
      let d = length(vec2f((fw - 0.5) * BAY, (fz - 0.54) * FLOOR_H)); let e = max(0.0, 1.0 - d / 1.5);
      c += GL * (WIN_SPILL * e * e); il += GL * (WIN_SPILL * e * e);
    }
  }
  // neon tubes up the corners and along the roof line, and their glow on the wall
  if (bld[q + 27u] > 0.5) {
    let neon = colAt(q + 24u);
    let eA = min(along - f0, f1 - along); let dTop = abs(z - (H - 0.3));
    let tw = max(0.1, dAlong * 0.6); let tz = max(0.1, dz * 0.6);
    let onTube = (eA < tw && z < H - 0.3 + tz) || dTop < tz;
    let s = select(along, z, eA < tw);
    let chase = hash3(bk, 3, 31) < 0.35 && ifloor((s - u.sec * 5.0) / 1.4) % 3 == 0;
    let k = ad * (1.0 - 0.55 * u.day) * select(1.0, 0.25, chase);
    if (onTube) { ch = select(DASH, BAR, eA < tw); c = neon * k + vec3f(70.0 * k); emC = c; il = vec3f(0.0); }
    else { let e = max(0.0, 1.0 - min(eA, dTop) / 1.6); c += neon * (e * e * 0.5 * k); il += neon * (e * e * 0.5 * k); }
  }
  // the top washed in light at night
  if (bld[q + 31u] > 0.5 && z > H - CROWN_H) {
    let cw = colAt(q + 28u) * (pow((z - (H - CROWN_H)) / CROWN_H, 1.4) * 0.95 * ad * (1.0 - 0.85 * u.day)); c += cw; il += cw;
  }
  // floodlights at the foot of the wall, each a cone of light widening upward
  let floodH = bld[q + 35u];
  if (floodH > 0.0 && z < floodH) {
    let w = 1.4 + 0.55 * z; let fzz = min(1.0, z / 1.5) * pow(max(0.0, 1.0 - z / floodH), 1.2);
    var I = 0.0;
    if (dAlong > FLOOD_GAP * 0.4) { I = fzz * (0.3 + 0.7 * min(1.0, 1.77 * w / FLOOD_GAP)); }
    else {
      let fb = select(f0, 0.0, side == 2);
      let fr = (((along - fb) / FLOOD_GAP) % 1.0 + 1.0) % 1.0; let d = abs(fr - 0.5) * FLOOD_GAP; let d2 = FLOOD_GAP - d;
      // each lamp's cone, and some light between them, so the wall is scalloped and never left dark
      I = fzz * (0.3 + 0.7 * min(1.2, exp(-(d / w) * (d / w)) + exp(-(d2 / w) * (d2 / w))));
      if (z < 0.35 && d < 0.3) { ch = STAR; c = vec3f(200.0, 190.0, 165.0); emC = c; il = vec3f(0.0); glowK = 0.3; }
    }
    // the light takes the wall's color (light times albedo, plus a little of its own): a stone wall glows warm, not white
    let fl = colAt(q + 32u) * (I * adElec) * (vec3f(0.2) + 1.5 * frame / 255.0); c += fl; il += fl;
  }
  // the scaffolding 1 m out from a street face: steel tubes (standards every 2.4 m, ledgers every 2 m,
  // a brace in every other bay), boards on each lift, and over the rest a mesh net or nothing
  let scH = bld[q + 52u];
  if (scH > 0.0 && side != 2 && face < 4 && ((u32(bld[q + 54u]) >> u32(face)) & 1u) == 1u) {
    let sb = SCAF_D / max(1e-6, abs(dn)); let sA = along0 - da * sb; let sT = t - sb;
    let zs = u.eye - m * sT + A * sT * sT;
    if (sA > f0 + 0.1 && sA < f1 - 0.1 && zs > SHED_Z + 1.1 && zs < scH) {
      let uu = sA - f0; let tw = max(0.05, dAlong * 0.5); let tz = max(0.05, dz * 0.5); let lz = (zs - SHED_Z) % 2.0;
      let upright = uu % 2.4 < tw || f1 - sA < tw; let led = lz < tz || zs > scH - tz; let board = lz < 0.14 + tz;
      let brace = ifloor(uu / 2.4) % 2 == 0 && abs(((uu % 2.4) / 2.4) * 2.0 - lz) < max(0.08, tw * 1.5);
      if (upright || led || brace || board) {
        let plank = board && !led && !upright;
        ch = select(select(select(DASH, SL, brace), EQ, plank), BAR, upright);
        c = select(SCAF_STEEL * 1.1, SCAF_BOARD * 0.9, plank) * shade0; T = sT; emC = vec3f(0.0); il = vec3f(0.0);
      } else if (bld[q + 53u] > 0.5) {
        // the net veils the wall behind it
        c = c * 0.45 + NETS[u32(bld[q + 53u]) - 1u] * (0.55 * shade0); emC *= 0.45; il *= 0.45;
        if (t < 40.0 && ch != AT && ch != HASH) { ch = select(DOT, COL, ((ifloor(uu / 0.3) + ifloor(zs / 0.3)) & 1) == 1); }
      }
    }
  }
  // (not clamped here: the finish takes the light back out to tint it by the wall's color)
  // street lamps, headlights and signs light the lower floors
  if (z < LIT_H && t < LIT_FAR) { let L = lightAt(hx, hy, z) * (1.3 * shade); c += L; il += L; }
  if (!isWin) { gEm = sat(emC); gIl = il; gTag = T; gGlowK = glowK; }
  // a room seen through a window keeps its own lamps' light: by day the sun on the facade is not on it
  return Cell(ch, c, vec3f(7.0, 8.0, 12.0), T, select(KIND_WALL, KIND_ROOM, isWin), select(max(0.0, wsun), 0.0, isWin));
}

// ---- scorched ground outside the fence, split by cracks that glow where the coal burns (burnGround)
fn burnGround(wx: f32, wy: f32, rd: f32, W: f32, Hh: f32) -> Cell {
  let out = max(max(-wx, wx - W), max(-wy, wy - Hh));
  let fog = 1.0 - min(1.0, rd / 2500.0) * 0.85; let day = u.day;
  let hv = hash3(ifloor(wx / 6.0), ifloor(wy / 6.0), 5); let tex = (0.9 + 0.15 * hv) * fog * (0.45 + 0.55 * day);
  var ch = 32u; var c = vec3f(42.0 - 14.0 * day, 32.0 - 5.0 * day, 30.0 - 2.0 * day) * tex;
  let heat = clamp((out - BURN_START) / 200.0, 0.0, 1.0);
  if (heat > 0.0) {
    // cracks are the edges of a cellular pattern: where the two nearest feature points are almost equally far
    let S = 14.0; let gx = ifloor(wx / S); let gy = ifloor(wy / S);
    var d1 = 1e9; var d2 = 1e9; var near = 0.0;
    for (var j = -1; j <= 1; j++) {
      for (var k = -1; k <= 1; k++) {
        let cx = gx + k; let cy = gy + j;
        let d = length(vec2f((f32(cx) + hash3(cx, cy, 11)) * S - wx, (f32(cy) + hash3(cx, cy, 12)) * S - wy));
        if (d < d1) { d2 = d1; d1 = d; near = hash3(cx, cy, 13); } else if (d < d2) { d2 = d; }
      }
    }
    let width = 0.6 + rd * 0.0025;
    if (d2 - d1 < width && near < 0.75) {
      let kk = heat * (0.55 + 0.45 * sin(u.sec * 60.0 * 0.05 + near * 40.0)) * (0.6 + 0.4 * fog) * min(1.0, 1.2 / (1.0 + rd * 0.002)) * (1.0 - 0.6 * day);
      if (d2 - d1 < width * 0.4 && rd < 150.0 && kk > 0.5) { ch = STAR; }
      let dk = 0.97 * day;
      c = vec3f(24.0 + 130.0 * kk, 10.0 + 50.0 * kk * kk, 8.0 + 10.0 * kk) * (1.0 - dk) + c * (0.7 * dk);
    }
  }
  return Cell(ch, c, vec3f(7.0, 8.0, 12.0), rd, KIND_BLOCK, u.sunZ);
}

// ---- the ground (renderWorld's ground loop)
fn groundCell(rd: f32, rdx: f32, rdy: f32) -> Cell {
  let wx = u.px + rdx * rd; let wy = u.py + rdy * rd;
  let W = f32(arrayLength(&xc)); let Hh = f32(arrayLength(&yc));
  let bg = vec3f(7.0, 8.0, 12.0);
  if (wx < 0.0 || wy < 0.0 || wx >= W || wy >= Hh) { return burnGround(wx, wy, rd, W, Hh); }
  if (rd > GROUND_FAR) { return Cell(DOT, mix(vec3f(28.0, 24.0, 32.0), vec3f(70.0, 72.0, 78.0), u.day), bg, rd, KIND_GROUND, 0.0); }
  let fog = 1.0 - (rd / GROUND_FAR) * 0.9 * (1.0 - 0.8 * u.day);
  let gx = i32(xc[u32(wx)]); let gy = i32(yc[u32(wy)]);
  let hv = hash3(ifloor(wx * 1.2), ifloor(wy * 1.2), 3);
  var ch = DOT; var c = vec3f(38.0, 38.0, 46.0);
  var dens = 0.0; // litter per 0.5 m square
  let roadX = (gx & 1) == 0; let roadY = (gy & 1) == 0;
  let sD = (wx - u.dox) * u.dnx + (wy - u.doy) * u.dny; let aD = abs(sD); let pastD = aD - u.dw * 0.5;
  let diagGlyph = select(SL, BS, u.dex * u.dey > 0.0);
  let asphalt = select(select(TICK, COM, hv < 0.8), DOT, hv < 0.5);
  if (pastD < 0.0) {
    ch = asphalt;
    if (!roadY && rd < 200.0) {
      let al = (wx - u.dox) * u.dex + (wy - u.doy) * u.dey; let m = aD % LANE_W;
      if (aD < 0.3) { ch = diagGlyph; c = vec3f(210.0, 170.0, 60.0); }
      else if (pastD > -1.2) { dens = 0.07; }
      else if (min(m, LANE_W - m) < 0.12 && aD < floor(u.dw * 0.5 / LANE_W) * LANE_W - 1.0 && ifloor(al / 3.0) % 2 == 0) { ch = diagGlyph; c = vec3f(150.0); }
    }
  } else if (roadX || roadY) {
    ch = asphalt;
    if (roadX != roadY && rd < 200.0) {
      var b0a = 0.0; var b0b = 0.0; var e0a = 0.0; var e0b = 0.0; var across = 0.0; var along = 0.0;
      if (roadX) { b0a = xb[gx]; b0b = xb[gx + 1]; e0a = yb[gy]; e0b = yb[gy + 1]; across = wx - (b0a + b0b) * 0.5; along = wy; }
      else { b0a = yb[gy]; b0b = yb[gy + 1]; e0a = xb[gx]; e0b = xb[gx + 1]; across = wy - (b0a + b0b) * 0.5; along = wx; }
      var dEnd = 1e9;
      if (!roadX && abs(u.dnx) > 0.05) {
        let hw = (b0b - b0a) * 0.5; let ycn = (b0a + b0b) * 0.5; let sg = select(-1.0, 1.0, sD > 0.0);
        let s1 = (wx - u.dox) * u.dnx + (ycn - hw - u.doy) * u.dny; let s2 = (wx - u.dox) * u.dnx + (ycn + hw - u.doy) * u.dny;
        dEnd = (min(sg * s1, sg * s2) - u.dw * 0.5) / abs(u.dnx);
      }
      let a = abs(across); let end = min(min(along - e0a, e0b - along), dEnd); let m = a % LANE_W;
      let lanes = floor((b0b - b0a) * 0.5 / LANE_W);
      let mark = select(DASH, BAR, roadX); let markX = select(BAR, EQ, roadX);
      // an avenue the diagonal crosses in an X: where the diagonal's lanes end, and the stop lines before it
      var xa0 = 0.0; var xa1 = 0.0;
      if (roadX) { let xo = sg[7] + u32(gx >> 1) * 2u; xa0 = bitcast<f32>(sg[xo]); xa1 = bitcast<f32>(sg[xo + 1u]); }
      let hasX = xa1 > xa0;
      if (hasX && pastD < 0.25 && along > xa0 && along < xa1) { ch = BAR; c = vec3f(175.0); }
      else if (dEnd < 1.0) { }
      else if (end > 1.0 && end < 4.5) { if (ifloor((across + 100.0) / 0.9) % 2 == 0) { ch = markX; c = vec3f(150.0); } }
      else if (hasX && (a < (b0b - b0a) * 0.5 - 0.3) && (((across < 0.0) && (xa0 - along > 4.6) && (xa0 - along < 5.05)) || ((across > 0.0) && (along - xa1 > 4.6) && (along - xa1 < 5.05)))) { ch = EQ; c = vec3f(170.0); }
      else if ((end > 4.6) && (end < 5.05) && (a < (b0b - b0a) * 0.5 - 0.3) && (select((across < 0.0), (across > 0.0), (along - e0a) < (e0b - along)) == roadX)) { ch = markX; c = vec3f(170.0); }
      else if (a < 0.3) { ch = mark; c = vec3f(210.0, 170.0, 60.0); }
      else if ((b0b - b0a) * 0.5 - a < 1.2) { dens = 0.07; } // the gutter collects what the wind blows
      else if (min(m, LANE_W - m) < 0.12 && a < lanes * LANE_W - 1.0 && ifloor(along / 3.0) % 2 == 0) { ch = mark; c = vec3f(150.0); }
    }
  } else {
    let o = u32(((gy >> 1) * i32(u.nbx) + (gx >> 1)) * ${BLK});
    let flags = u32(blk[o + 7u]); let opk = flags & 3u; let diag = (flags >> 2u) & 7u; let square = (flags & 64u) != 0u;
    var edge = min(min(wx - blk[o], blk[o + 2u] - wx), min(wy - blk[o + 1u], blk[o + 3u] - wy));
    if (diag != 0u) { edge = min(edge, pastD); }
    if (edge < SIDEWALK) {
      let fx = fract(wx / 1.5); let fy = fract(wy / 1.5);
      ch = select(COL, PLUS, fx < 0.08 || fy < 0.08); c = vec3f(78.0, 74.0, 78.0);
      dens = select(0.025, 0.06, (flags & 32u) != 0u);
    } else if ((diag & select(2u, 4u, sD > 0.0)) != 0u) {
      let fx = fract(wx / 2.5); let fy = fract(wy / 2.5);
      ch = select(COL, PLUS, fx < 0.06 || fy < 0.06); c = vec3f(92.0, 86.0, 80.0);
      if (square) { let dark = ((ifloor(wx / 2.5) + ifloor(wy / 2.5)) & 1) == 1; c = select(vec3f(108.0, 104.0, 108.0), vec3f(62.0, 60.0, 66.0), dark); if (!dark && fx > 0.45 && fx < 0.55 && fy > 0.45 && fy < 0.55) { ch = O; } }
    } else if (opk == 1u) {
      dens = 0.01;
      let mx = (blk[o] + blk[o + 2u]) * 0.5; let my = (blk[o + 1u] + blk[o + 3u]) * 0.5;
      if (abs(wx - mx) < 1.5 || abs(wy - my) < 1.5) { ch = select(COM, DOT, hv < 0.5); c = vec3f(95.0, 85.0, 70.0); }
      else { ch = select(select(SEMI, COM, hv < 0.7), QUO, hv < 0.4); c = vec3f(40.0, 95.0 + hv * 40.0, 45.0); }
    } else if (opk == 2u) {
      let fx = fract(wx / 2.5); let fy = fract(wy / 2.5);
      ch = select(COL, PLUS, fx < 0.06 || fy < 0.06); c = vec3f(92.0, 86.0, 80.0);
    } else if (opk == 3u) {
      let long = blk[o + 2u] - blk[o] > blk[o + 3u] - blk[o + 1u];
      let a = (select(wx, wy, long) - select(blk[o], blk[o + 1u], long)) % 4.5; let uu = select(wy, wx, long);
      if (abs(a - 1.5) < 0.12 || abs(a - 2.95) < 0.12) { ch = select(BAR, EQ, long); c = vec3f(120.0, 115.0, 115.0); }
      else if (a > 1.2 && a < 3.3 && uu % 0.8 < 0.25) { ch = select(EQ, BAR, long); c = vec3f(70.0, 52.0, 40.0); }
      else { ch = select(COM, DOT, hv < 0.6); c = vec3f(55.0, 50.0, 48.0); }
    } else { ch = select(COM, DOT, hv < 0.7); c = vec3f(50.0, 48.0, 52.0); }
  }
  if (dens > 0.0 && rd < LITTER_FAR) {
    // litter: at most one item per 0.5 m square, at a random spot and turn inside it; at a distance an
    // item grows to the ground one row covers, so it does not slip between rows
    let lx = ifloor(wx * 2.0); let ly = ifloor(wy * 2.0);
    if (hash3(lx, ly, 17) < dens) {
      let k = min(u32(hash3(lx, ly, 18) * ${LITTER.length}.0), ${LITTER.length - 1}u); let La = LIT_A[k]; let Lb = LIT_B[k];
      let half = max(Lb.y, Lb.z); let room = max(0.0, 0.5 - 2.0 * half);
      let ux = wx - (f32(lx) * 0.5 + half + room * hash3(lx, ly, 19)); let uy = wy - (f32(ly) * 0.5 + half + room * hash3(lx, ly, 20));
      let ang = hash3(lx, ly, 21) * 3.14159265; let ca = cos(ang); let sa = sin(ang);
      let lu = abs(ux * ca + uy * sa); let lw = abs(-ux * sa + uy * ca);
      let e = rd * rd / (u.eye * u.scale) * 0.5;
      let hit = select((lu < max(Lb.y, e)) && (lw < max(Lb.z, e)), length(vec2f(lu, lw)) < max(Lb.y, e), Lb.x == 0.0);
      if (hit) { ch = u32(La.x); c = La.yzw; }
    }
  }
  var lk = 1.0;
  if (u.snow > 0.02) {
    let sk = u.snow * select(1.0, 0.5, roadX || roadY || pastD < 0.0);
    c += (vec3f(200.0, 205.0, 218.0) - c) * sk;
    if (sk > 0.35) { ch = select(select(DOT, SEMI, hv < 0.85), COL, hv < 0.55); }
  }
  if (u.wet > 0.02) {
    let wk = u.wet * (1.0 - u.snow);
    c *= vec3f(1.0 - 0.35 * wk, 1.0 - 0.35 * wk, 1.0 - 0.3 * wk);
    lk = 1.0 + 1.1 * wk * select(1.0, 0.75 + 0.25 * sin(u.sec * 7.0 + hv * 30.0), u.rain > 0.0);
    if (u.rain > 0.0 && rd < 22.0 && !underRoof(wx, wy, 0.1)) {
      // splashes: a ring that grows from a random spot of each 0.33 m square, for a blink, more in a
      // downpour; a cell at a distance covers more ground (e), so there it shrinks to a dot
      let sx = ifloor(wx * 3.0); let sy = ifloor(wy * 3.0); let ph = fract(u.sec * 2.3 + hash3(sx, sy, 41));
      if (hash3(sx, sy, 42) < u.rain * 0.3 && ph < 0.09) {
        let d = length(vec2f(wx - (f32(sx) + 0.2 + 0.6 * hash3(sx, sy, 43)) / 3.0, wy - (f32(sy) + 0.2 + 0.6 * hash3(sx, sy, 44)) / 3.0));
        let e = rd * rd / (u.eye * u.scale) * 0.5; let rr = 0.02 + ph * 1.1;
        if (abs(d - rr) < max(0.015, e)) { ch = select(O, TICK, rr < 0.05 || e > 0.04); c = vec3f(150.0, 150.0, 165.0); }
      }
    }
  }
  c = sat(c);
  let gl = lightAt(wx, wy, 0.0) * (lk * fog);
  gEm = vec3f(0.0); gIl = gl; gTag = rd;
  return Cell(ch, c * fog + gl, bg, rd, KIND_GROUND, 0.0);
}

/** The day's light (finish): how the surface's color reads as albedo, and the sky's and the sun's strength. */
const DAY_ALBEDO = 2.0; const DAY_SKY = 1.1; const DAY_SUN = 3.0; const DAY_GROUND = 1.8;
/** The brightest a surface reflects (its hue kept), how much more saturated the day shows the colors, and the exposure. */
const DAY_ALB_MAX = 0.8; const DAY_SAT = 1.3; const DAY_EXPO = 0.75;
/** By day, how strongly the lamps' light reaches a surface, and how bright what glows reads. */
const DAY_LAMP = 1.5; const DAY_EMIT = 1.6;
/** Night: how light a surface's color must be (strongest channel, 0-255) to take a lamp's full light, and where the highlights start to roll off. */
const NIGHT_ALB_REF = 85.0; const NIGHT_KNEE = 0.3;
/** The night's curve, in linear light on the luminance: untouched below the knee (the night's look), above it an
 *  exponential shoulder toward 1; a channel still past 1 goes toward white, as in tone(). In 0-255 sRGB. */
fn nightTone(c: vec3f) -> vec3f {
  let x = pow(max(c, vec3f(0.0)) / 255.0, vec3f(2.2));
  let L = dot(x, vec3f(0.2126, 0.7152, 0.0722));
  let mx0 = max(x.x, max(x.y, x.z));
  if (L <= NIGHT_KNEE && mx0 <= 1.0) { return c; }
  var Lt = L;
  if (L > NIGHT_KNEE) { Lt = NIGHT_KNEE + (1.0 - NIGHT_KNEE) * (1.0 - exp(-(L - NIGHT_KNEE) / (1.0 - NIGHT_KNEE))); }
  var y = x * (Lt / max(L, 1e-5));
  let mx = max(y.x, max(y.y, y.z));
  if (mx > 1.0) { y = vec3f(Lt) + (y - vec3f(Lt)) * ((1.0 - Lt) / max(1e-4, mx - Lt)); }
  return pow(y, vec3f(1.0 / 2.2)) * 255.0;
}
/** A filmic tone curve (Narkowicz's fit of ACES): bright light rolls off instead of clipping to white. */
fn acesL(x: f32) -> f32 { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
/** The curve on the luminance only, so a bright color keeps its hue and saturation; past 1 it goes to white. */
fn tone(x: vec3f) -> vec3f {
  let L = dot(x, vec3f(0.2126, 0.7152, 0.0722));
  if (L < 1e-5) { return vec3f(0.0); }
  let Lt = acesL(L * DAY_EXPO); var y = x * (Lt / L);
  let mx = max(y.x, max(y.y, y.z));
  if (mx > 1.0) { y = vec3f(Lt) + (y - vec3f(Lt)) * ((1.0 - Lt) / max(1e-4, mx - Lt)); }
  return y;
}
// ---- the finish: moonlight, daylight and haze, a whole-city blackout, the display modes
fn finish(cl: Cell) -> Cell {
  var o = cl;
  gGlow = 0.0;
  if (o.depth >= 1e9) { return o; }
  // the light this cell gives off and gets from the lamps, if it was made where it was marked
  let tagged = o.depth == gTag;
  let emit = select(vec3f(0.0), gEm, tagged); var lamp = select(vec3f(0.0), gIl, tagged);
  // the light a surface gets takes its color (light x albedo), instead of being added over it: a red
  // wall under a sodium lamp reads deep orange-red, not grey; brightness is kept by the color's own
  // strongest channel, so the dark night colors still show the light (a darker wall, a bit less)
  if (tagged && lamp.x + lamp.y + lamp.z > 0.5) {
    let base = max(vec3f(0.0), o.c - emit - lamp); let mb = max(base.x, max(base.y, base.z));
    let tint = mix(vec3f(1.0), base / max(mb, 1.0), smoothK(2.0, 12.0, mb));
    // a surface reflects in proportion to how light it is: dark glass under a white lamp stays dark and
    // keeps its hue, a pale sidewalk takes the full pool
    let nl = lamp * tint * (LAMP_REFL * clamp(mb / NIGHT_ALB_REF, 0.22, 1.25));
    o.c = base + emit + nl; lamp = nl;
  }
  gGlow = clamp(dot(emit, vec3f(0.3, 0.5, 0.2)) / 255.0, 0.0, 1.0) * (1.0 - 0.75 * u.day) * select(1.0, gGlowK, tagged);
  if (u.moonlight > 0.02 && o.depth > 0.0) { let m = u.moonlight * (1.0 - 0.7 * u.cloud) * 14.0; o.c = sat(o.c + vec3f(m * 0.7, m * 0.8, m * 1.15)); }
  let day = u.day;
  if (day > 0.01 || u.flash > 0.0) {
    let f = day * (0.1 + 0.42 * (1.0 - exp(-o.depth / 2500.0)));
    let haze = vec3f(150.0, 160.0, 176.0);
    // objects keep 2 + their share of sun (0: none, as the CPU's sun buffer left at 0)
    let objSun = o.sun >= 2.0;
    let sunlit = o.kind == KIND_WALL || objSun;
    if (day > 0.01 && (o.kind == KIND_GROUND || o.kind == KIND_BLOCK || sunlit)) {
      // by day, lit as a 3D game does: the surface's color as its albedo (in linear light), times the
      // sky's light from above (bluish; whiter under clouds) and the sun's on what faces it and is not in
      // a building's shadow (gSun); then a filmic tone curve, and the haze only with distance
      let low = 1.0 - clamp(u.sunEl / 0.35, 0.0, 1.0);
      let sunC = vec3f(1.05, 0.95 - 0.3 * low, 0.85 - 0.5 * low);
      let share = select(select(u.sunZ, o.sun, sunlit || o.kind == KIND_BLOCK), o.sun - 2.0, objSun);
      // the surface's own color without the light on it and from it
      var alb = pow(max(vec3f(0.0), o.c - emit - lamp) / 255.0, vec3f(2.2)) * DAY_ALBEDO;
      // the colors were made for the night: by day a bit more saturated, and never brighter than a white wall
      alb = max(vec3f(0.0), mix(vec3f(dot(alb, vec3f(0.2126, 0.7152, 0.0722))), alb, DAY_SAT));
      let am = max(alb.x, max(alb.y, alb.z)); if (am > DAY_ALB_MAX) { alb *= DAY_ALB_MAX / am; }
      // the ground's colors were made for the night (dark, bluish asphalt): by day, lighter and greyer
      if (o.kind == KIND_GROUND) { let g = dot(alb, vec3f(0.3, 0.5, 0.2)); alb = mix(alb, vec3f(g), 0.2) * DAY_GROUND; }
      let skyC = mix(vec3f(0.48, 0.6, 0.92), vec3f(0.82, 0.84, 0.88), u.cloud) * (DAY_SKY + 0.35 * u.cloud);
      let E = skyC + sunC * (DAY_SUN * (1.0 - 0.85 * u.cloud) * share * gSun) + vec3f(u.flash * 0.6);
      // the lamps light the surface as the sky does (weak by day); what glows is added over
      let lin = tone(alb * (E + pow(lamp / 255.0, vec3f(2.2)) * DAY_LAMP) + pow(emit / 255.0, vec3f(2.2)) * DAY_EMIT);
      let fd = (1.0 - exp(-o.depth / 1800.0)) * 0.6;
      let dc = mix(pow(lin, vec3f(1.0 / 2.2)) * 255.0, haze, fd);
      o.c = sat(mix(o.c * (1.0 - f) + haze * f, dc, smoothK(0.0, 0.35, day)));
    } else {
      // rooms keep their own lamps' light (brightened, a green plant read almost white)
      let amb = 1.0 + select(0.7, 0.1, o.kind == KIND_ROOM) * day + u.flash * 0.6;
      o.c = sat(o.c * amb * (1.0 - f) + haze * f);
    }
  }
  // a blackout darkens what is lit by the city's glow, not the lights: what still shines (a generator's
  // windows, headlights, a lamp coming back) stands out more against a dark city, as the eye adapts
  let night = 1.0 - day;
  let dark = 1.0 - 0.72 * pow(1.0 - u.cityLit, 1.5) * night;
  if (dark < 0.999) {
    let adapt = 1.0 + 0.7 * (1.0 - u.cityLit) * night;
    let lit = min(o.c, emit + lamp);
    o.c = (o.c - lit) * dark + lit * adapt; o.bg *= dark;
    gGlow = min(1.0, gGlow * adapt);
  }
  // the city's sodium glow in the air: far things sink into a low orange haze (as a big city seen at night)
  if (night > 0.01 && o.kind != KIND_ROOM) {
    let hk = (1.0 - exp(-o.depth / 1400.0)) * NIGHT_HAZE * night * (0.15 + 0.85 * u.cityLit) * (0.8 + 0.4 * u.precip);
    o.c = o.c * (1.0 - hk) + vec3f(120.0, 64.0, 26.0) * hk;
  }
  // at night bright sums roll off on the luminance (the hue kept) instead of each channel clipping at 255,
  // which sent a lit color to grey and white
  if (night > 0.01) { o.c = mix(o.c, nightTone(o.c), night); }
  if (u.solid > 0.0) { o.bg = o.c * u.solid; }
  if (u.sharp < 3.0) {
    let s = u.sharp;
    var fill = 0.0;
    if (o.kind == KIND_GROUND) { fill = 0.5; } else if (o.kind == KIND_OBJECT && s < 2.0) { fill = 0.7; } else if (s == 0.0 && (o.kind == KIND_WALL || o.kind == KIND_ROOM)) { fill = 0.28; }
    if (fill > 0.0) {
      let fa = select(0.0, clamp((o.depth - 40.0) / 220.0, 0.0, 1.0), u.fuse > 0.5); let f = fa * fa * (3.0 - 2.0 * fa);
      let glyph = select(select(0.78, 0.95, o.kind == KIND_OBJECT), 0.82, o.kind == KIND_GROUND) - 0.15 * f;
      let fl = fill + (0.5 - fill) * 0.45 * f;
      o.bg = o.c * fl; o.c *= glyph;
    }
  }
  if (o.kind == KIND_BLOCK) {
    // solid color; a glyph left on it is a glint, brighter than the surface
    o.bg = o.c;
    if (o.ch != 32u) { o.c = o.c * 1.4 + vec3f(50.0, 50.0, 46.0); }
  }
  if (u.blocks > 0.5 && BLOCKS[o.ch] != 0u) { o.ch = BLOCKS[o.ch]; }
  return o;
}

// ---- the sky (sky.ts): gradient, stars, the moon with its phase, the cloud deck lit from below, the sun's glow
const CLOUD_H = 1200.0;
const MOON_R = ${(3.4 * Math.PI) / 180};
const TAU = 6.28318531;
// the same smooth noise as sky.ts (its 256x256 table is hash3(i, j, 777), computed here instead)
fn noise(x: f32, y: f32) -> f32 {
  let ix = floor(x); let iy = floor(y); let fx = x - ix; let fy = y - iy;
  let sx = fx * fx * (3.0 - 2.0 * fx); let sy = fy * fy * (3.0 - 2.0 * fy);
  let x0 = i32(ix) & 255; let y0 = i32(iy) & 255; let x1 = (x0 + 1) & 255; let y1 = (y0 + 1) & 255;
  let a = hash3(x0, y0, 777); let b = hash3(x1, y0, 777); let c = hash3(x0, y1, 777); let d = hash3(x1, y1, 777);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
fn smoothK(a: f32, b: f32, v: f32) -> f32 { let t = clamp((v - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
fn wrapA(a: f32) -> f32 { return a - round(a / TAU) * TAU; }
// how much the ground under a point lights the clouds: the city's glow, and the crater under the Sarcophagus
fn glowBelow(x: f32, y: f32) -> vec3f {
  let half = min(u.cityW, u.cityH) * 0.5; let rc = length(vec2f(x - u.cityW * 0.5, y - u.cityH * 0.5)) / half;
  let spread = exp(-(rc / 2.6) * (rc / 2.6));
  let cd = length(vec2f(x - u.ccx, y - u.ccy)) / (min(u.cityW, u.cityH) * 0.6);
  let city = spread * (0.75 + 0.25 * exp(-cd * cd)) * u.cityLit;
  let sd = length(vec2f(x - u.sarX, y - u.sarY)) / (u.sarR * 1.3);
  let fire = 1.6 * exp(-sd * sd);
  return vec3f(40.0 * city + 70.0 * fire, 34.0 * city + 24.0 * fire, 18.0 * city + 12.0 * fire);
}
fn skyCell(m: f32, rdx: f32, rdy: f32) -> Cell {
  let L = length(vec2f(rdx, rdy)); let night = 1.0 - u.day; let day = u.day;
  let up = -m / L; // tan of the elevation
  // the row relative to the horizon (the CPU's y + 0.5 - hor); the 3D camera takes it from the elevation
  let rowF = select(m * u.scale, -up * u.scale, u.cam3d > 0.5);
  let t = clamp((u.hor + rowF) / max(1.0, u.hor), 0.0, 1.0);
  let az = atan2(rdy, rdx);
  let dA = wrapA(az - u.moonA);
  let moonCol = u.moonEl > -MOON_R && abs(dA) * cos(u.moonEl) < MOON_R * 3.0;
  let dS = wrapA(az - u.sunA);
  let toSun = 0.5 + 0.5 * cos(dS);
  let t2 = t * t; let t4 = t2 * t2;
  let cl = 0.3 + 0.7 * u.cityLit;
  var r = (5.0 + 21.0 * t2 + 30.0 * t4 * cl) * night + (62.0 + 80.0 * t2) * day;
  var g = (6.0 + 10.0 * t2 + 8.0 * t4 * cl) * night + (84.0 + 72.0 * t2) * day;
  var b = (11.0 + 21.0 * t2 - 6.0 * t4 * cl) * night + (118.0 + 44.0 * t2) * day;
  let dk = u.dusk * t4 * (0.35 + 0.65 * toSun);
  r += 190.0 * dk; g += 80.0 * dk; b += 30.0 * dk - 10.0 * dk * toSun;
  // the city's glow on the haze over it: seen only from its edges and beyond, low over the center, and it
  // fades as the lamps go out (cityLit)
  let tcx = u.cityW * 0.5 - u.px; let tcy = u.cityH * 0.5 - u.py; let dcen = length(vec2f(tcx, tcy));
  let away = smoothK(0.2, 1.2, dcen / (min(u.cityW, u.cityH) * 0.5));
  if (away > 0.0 && night > 0.0) {
    let toC = max(0.0, (tcx * rdx + tcy * rdy) / (max(1.0, dcen) * L));
    let dome = away * (0.3 + 0.7 * toC * toC) * exp(-max(0.0, up) / 0.16) * u.cityLit * night;
    r += 150.0 * dome; g += 72.0 * dome; b += 22.0 * dome;
  }
  var ch = 0u; var cc = vec3f(0.0);
  var sunK = 0.0; var cover = 0.0;
  let el = atan(up);
  if (u.sunEl > -0.15) {
    let ang = length(vec2f(dS * cos(el), el - u.sunEl));
    sunK = (exp(-ang / 0.09) * 0.8 + exp(-ang / 0.35) * 0.25) * min(1.0, (u.sunEl + 0.15) / 0.2);
  }
  // stars on a fixed ring of azimuth slots
  let slot = i32(floor(fract(az / TAU) * u.starSlots));
  let yr = rowF - 0.5;
  let hs = hash3(slot, ifloor(yr), 7);
  var star = 0.0;
  if (hs < 0.012 && yr < -3.0) { star = (120.0 + hs * 8000.0) * night * night; }
  else if (yr >= -2.0 && night > 0.5) { ch = DOT; cc = vec3f(70.0, 40.0, 60.0); }
  // the moon, its lit side facing the sun
  var moonA = false;
  if (moonCol) {
    let mu = (dA * cos(el)) / MOON_R; let mv = (el - u.moonEl) / MOON_R; let d2 = mu * mu + mv * mv;
    if (d2 < 1.0) {
      let wz = sqrt(1.0 - d2); let f = TAU * u.phase;
      var lit = max(0.0, mu * sin(f) - wz * cos(f));
      lit = lit * (0.72 + 0.28 * noise(mu * 3.0 + 40.0, mv * 3.0 + 40.0)) + 0.05 * night * night;
      if (lit > 0.04 + 0.2 * day) {
        let k = min(1.0, lit) * (0.35 + 0.65 * night); let e = min(1.0, (1.0 - d2) * 5.0);
        cc = vec3f(235.0 * k + 20.0 + r * day, 228.0 * k + 20.0 + g * day, 200.0 * k + 26.0 + b * day);
        r += (cc.x - r) * e; g += (cc.y - g) * e; b += (cc.z - b) * e;
        moonA = true; star = 0.0;
      }
    } else if (d2 < 9.0) {
      let hk = ((1.0 - cos(TAU * u.phase)) * 0.5) * night * exp(-(sqrt(d2) - 1.0) * 1.6) * 18.0;
      r += hk; g += hk; b += hk * 1.2;
    }
  }
  // the cloud deck where this ray meets it, drifting with the wind
  if (u.cloud > 0.01 && up > 0.002) {
    let tc = (CLOUD_H - u.eye) / (up * L); let wx = u.px + rdx * tc; let wy = u.py + rdy * tc; let D = tc * L;
    let fp = (D * D) / ((CLOUD_H - u.eye) * u.scale);
    let ox = wx + u.driftX; let oy = wy + u.driftY;
    let k1 = 1.0 - smoothK(300.0, 900.0, fp); let k2 = 1.0 - smoothK(120.0, 360.0, fp);
    let n0 = noise(ox / 1100.0, oy / 1100.0); let n1 = noise(ox / 420.0 + 71.0, oy / 420.0 + 13.0); let n2 = noise(ox / 150.0 + 37.0, oy / 150.0 + 91.0);
    var d = 0.55 * n0 + 0.3 * (k1 * n1 + (1.0 - k1) * 0.5) + 0.15 * (k2 * n2 + (1.0 - k2) * 0.5);
    d += (0.5 - d) * smoothK(8000.0, 30000.0, D);
    let lo = 1.0 - u.cloud;
    let a = smoothK(lo - 0.18, lo + 0.12, d) * (0.55 + 0.45 * min(1.0, u.cloud * 1.3));
    if (a > 0.02) {
      let GL = glowBelow(wx, wy);
      let thick = min(1.0, a * (0.5 + d));
      let gk = (0.35 + 0.65 * thick) * (0.8 + 0.5 * u.precip) * night;
      let base = 12.0 + 12.0 * (1.0 - u.cityLit) * night;
      var q = vec3f(base + GL.x * gk, base + GL.y * gk, base + 5.0 + GL.z * gk);
      let grey = (215.0 - 75.0 * thick - 70.0 * u.precip + 25.0 * toSun * (1.0 - thick)) * day;
      q += vec3f(grey, grey * 1.01, grey * 1.06);
      q += vec3f(150.0 * u.dusk * toSun * (1.0 - thick * 0.5), 60.0 * u.dusk * toSun, 30.0 * u.dusk);
      q += vec3f(190.0, 185.0, 230.0) * u.flash;
      let ml = u.moonlight * (1.0 - thick) * 60.0;
      q += vec3f(ml, ml, ml * 1.15);
      if (moonA) { q += cc * (0.3 * (1.0 - thick)); }
      let hz = 1.0 - exp(-D / 12000.0); let hk = 0.4 * night * (0.6 + 0.6 * u.precip) * (0.25 + 0.75 * u.cityLit);
      q += (vec3f(26.0 + 55.0 * hk + 90.0 * day, 22.0 + 32.0 * hk + 95.0 * day, 26.0 + 22.0 * hk + 102.0 * day) - q) * hz;
      r += (q.x - r) * a; g += (q.y - g) * a; b += (q.z - b) * a;
      cover = a;
      star *= 1.0 - a;
      if (moonA) { if (thick > 0.6) { ch = 0u; } else { cc *= 1.0 - a * 0.8; } }
    }
  }
  if (sunK > 0.003) {
    let sk = sunK * (1.0 - 0.55 * cover);
    r += 230.0 * sk; g += (205.0 - 60.0 * u.dusk) * sk; b += (170.0 - 90.0 * u.dusk) * sk;
  }
  var o = Cell(32u, vec3f(0.0), vec3f(r, g, b), 1e9, KIND_OTHER, 0.0);
  if (star > r + 25.0 && !moonA) { o.ch = select(DOT, STAR, hs < 0.003); o.c = vec3f(star, star, star + 30.0); }
  else if (ch != 0u) { o.ch = ch; o.c = cc; }
  if (u.blocks > 0.5 && BLOCKS[o.ch] != 0u) { o.ch = BLOCKS[o.ch]; }
  return o;
}

// ---- the Sarcophagus on the horizon (sarcophagus.ts): the dome, the draft tower and the cranes
fn domeZ(r: f32, h: f32, rho: f32) -> f32 {
  if (rho >= r) { return 0.0; }
  let Rs = (r * r + h * h) / (2.0 * h);
  return sqrt(Rs * Rs - rho * rho) - (Rs - h);
}
// [entry, exit] along the unit ray (ux, uy) through a circle, or x < 0 for none
fn span2(cx: f32, cy: f32, r: f32, ux: f32, uy: f32) -> vec2f {
  let ox = u.px - cx; let oy = u.py - cy; let b = ox * ux + oy * uy; let disc = b * b - (ox * ox + oy * oy - r * r);
  if (disc > 0.0 && -b + sqrt(disc) > 0.0) { return vec2f(max(1.0, -b - sqrt(disc)), -b + sqrt(disc)); }
  return vec2f(-1.0);
}
// apparent height above the eye of a surface point z at distance d, over the curve, as a slope
fn slopeAt(z: f32, d: f32) -> f32 { return (z - u.eye - d * d / (2.0 * u.curveR)) / d; }
fn sarcVis() -> f32 { return smoothK(u.sarR + 3700.0, u.sarR + 3100.0, length(vec2f(u.sarX - u.px, u.sarY - u.py))); }
// the dome or tower in this cell (want: the cell's slope; sL: rows per unit of slope), depth 1e9 if none
fn sarcCell(want: f32, sL: f32, L: f32, ux: f32, uy: f32, col: f32, bg: vec3f, vis: f32) -> Cell {
  var o = Cell(32u, vec3f(0.0), bg, 1e9, KIND_BLOCK, 0.0);
  let day = u.day; let fire = 0.75 * (1.0 - 0.7 * day); let dark = 18.0 * 0.7 * day;
  let flick = 0.75 + 0.25 * sin(u.sec * 0.7 + col * 0.05); let steel = 16.0 + 14.0 * day;
  let sun = vec3f(u.sunX, u.sunY, u.sunZ);
  var best = 1e9; var c = vec3f(0.0); var ch = 32u; var sh = 0.0;
  let dome = span2(u.sarX, u.sarY, u.sarR, ux, uy);
  if (dome.x >= 0.0) {
    let ds = (dome.y - dome.x) / 24.0;
    var top = -1e9;
    for (var k = 0; k <= 24; k++) { let dd = dome.x + ds * f32(k); top = max(top, slopeAt(domeZ(u.sarR, u.sarH, length(vec2f(u.px + ux * dd - u.sarX, u.py + uy * dd - u.sarY))), dd)); }
    if (want <= top && want >= slopeAt(0.0, dome.x) - 1.0 / sL) {
      // the first point along the ray where the dome rises above this cell
      var d = dome.x; var z = 0.0;
      for (var k = 0; k <= 24; k++) {
        d = dome.x + ds * f32(k);
        z = domeZ(u.sarR, u.sarH, length(vec2f(u.px + ux * d - u.sarX, u.py + uy * d - u.sarY)));
        if (slopeAt(z, d) >= want) { break; }
      }
      let hx = u.px + ux * d - u.sarX; let hy = u.py + uy * d - u.sarY; let phi = atan2(hy, hx);
      // panels: 2.5 degrees around by 50 m up; a third never went up, and the fire shows through
      let pa = ifloor((phi + 3.14159265) / 0.044); let pz = ifloor(z / 50.0); let ph = hash3(pa, pz, 92);
      let Rs = (u.sarR * u.sarR + u.sarH * u.sarH) / (2.0 * u.sarH);
      let nrm = normalize(vec3f(hx / Rs + (ph - 0.5) * 0.08, hy / Rs + (hash3(pa, pz, 93) - 0.5) * 0.08, (z + Rs - u.sarH) / Rs));
      let ns = dot(nrm, sun);
      // a glint where the sun mirrors off a panel toward the eye
      let vv = vec3f(-ux, -uy, (u.eye - z) / d);
      var spec = 0.0;
      if (sun.z > 0.0 && ns > 0.0) { spec = (2.0 * ns * dot(nrm, vv) - dot(sun, vv)) / length(vv); }
      let glint = select(32u, select(PLUS, STAR, spec > 0.996), day > 0.2 && spec > 0.985);
      let pk = 0.85 + 0.3 * ph;
      best = d;
      if ((top - want) * sL < 1.0) { c = vec3f(steel * 1.3, steel * 1.3, steel * 1.4); sh = ns + 0.01; }
      else if (z < 45.0) { c = vec3f(230.0 * flick * fire + dark, 95.0 * flick * fire + dark, 30.0 * fire + dark); }
      else if (hash3(pa, pz, 91) < 0.33) { c = vec3f(200.0 * flick * fire + dark, 80.0 * flick * fire + dark, 28.0 * fire + dark); }
      else { let rib = select(1.0, 0.8, pa % 3 == 0); ch = glint; c = vec3f(steel * pk * rib, steel * pk * rib, steel * 1.12 * pk * rib); sh = ns + 0.01; }
    }
  }
  let tw = span2(u.towX, u.towY, u.towR, ux, uy);
  if (tw.x >= 0.0 && tw.x < best) {
    // the draft tower: a squat ribbed drum, its rim glowing with the heat it was built to draw up
    let d = tw.x; let top = slopeAt(u.towH, d);
    if (want <= top && want >= slopeAt(0.0, d) - 1.0 / sL) {
      let ang = atan2(u.py + uy * d - u.towY, u.px + ux * d - u.towX);
      best = d; ch = 32u; sh = 0.0;
      if ((top - want) * sL < 1.0) {
        ch = select(32u, STAR, (ifloor(u.sec * 1.5) + i32(col)) % 9 == 0);
        c = vec3f(255.0 * flick * fire + dark, 70.0 * fire + dark, 40.0 * fire + dark);
      } else {
        let rib = select(1.0, 0.8, ifloor((ang + 3.14159265) / 0.06) % 4 == 0);
        c = vec3f(steel * 0.9 * rib, steel * 0.9 * rib, steel * rib); sh = cos(ang) * sun.x + sin(ang) * sun.y + 0.01;
      }
    }
  }
  if (best >= 1e9) { return o; }
  // fade out into whatever is behind (the smoky low sky) as it leaves view
  let haze = 0.45 * (1.0 - day);
  c = c * (1.0 - haze) + bg * haze;
  o.ch = ch; o.c = bg + (c - bg) * vis; o.bg = bg + (c * 0.35 - bg) * vis;
  o.depth = best / L; o.sun = select(0.0, clamp(sh, 0.0, 1.0), sh != 0.0);
  return o;
}
// the cranes on the dome, stopped mid-job, projected like the CPU's (drawCranes); depth 1e9 if none here
fn craneCell(gx: i32, gy: i32, vis: f32) -> Cell {
  var o = Cell(32u, vec3f(0.0), vec3f(7.0, 8.0, 12.0), 1e9, KIND_OTHER, 0.0);
  let invDet = 1.0 / (u.plX * u.dirY - u.dirX * u.plY);
  let c0 = sg[3]; let nc = sg[4];
  for (var q = 0u; q < nc; q++) {
    let kx = bitcast<f32>(sg[c0 + q * 4u]); let ky = bitcast<f32>(sg[c0 + q * 4u + 1u]); let kz = bitcast<f32>(sg[c0 + q * 4u + 2u]); let ka = bitcast<f32>(sg[c0 + q * 4u + 3u]);
    let rx = kx - u.px; let ry = ky - u.py; let tY = invDet * (-u.plY * rx + u.plX * ry);
    if (tY < 10.0 || tY >= o.depth) { continue; }
    let tX = invDet * (u.dirY * rx - u.dirX * ry); let dx = gx - ifloor((u.cols / 2.0) * (1.0 + tX / tY));
    if (dx < -1 || dx > 1) { continue; }
    let drop = (rx * rx + ry * ry) / (2.0 * u.curveR);
    let yTop = i32(ceil(u.hor - ((kz - u.eye - drop) * u.scale) / tY - 0.5)); let yBot = i32(ceil(u.hor - ((kz - 70.0 - u.eye - drop) * u.scale) / tY - 0.5));
    if (gy < yTop || gy > yBot) { continue; }
    let lightOn = (u.sec + ka) % 1.6 < 0.5;
    if (gy == yTop) {
      if (dx == 0) { o.ch = select(DASH, STAR, lightOn); o.c = select(vec3f(60.0 * vis, 60.0 * vis, 65.0 * vis), vec3f(255.0 * vis, 40.0, 30.0), lightOn); }
      else { o.ch = DASH; o.c = vec3f(70.0, 70.0, 76.0) * vis; }
    } else if (dx == 0) { o.ch = BAR; o.c = vec3f(60.0, 60.0, 66.0) * vis; }
    else { continue; }
    o.depth = tY;
  }
  return o;
}
// whether (x, y, z) is under one of this frame's roofs (bus shelters, sidewalk sheds), as precip.ts's underRoof
fn underRoof(x: f32, y: f32, z: f32) -> bool {
  let OB = fx[1];
  if (OB == 0u) { return false; }
  let rb = OB + fx[OB + 4u]; let nr = fx[OB + 5u];
  for (var k = 0u; k < nr; k++) {
    let w = rb + k * 7u;
    if (z > fxf(w + 6u)) { continue; }
    let dx = x - fxf(w); let dy = y - fxf(w + 1u); let c = fxf(w + 2u); let s = fxf(w + 3u);
    if (abs(dx * c + dy * s) < fxf(w + 4u) && abs(-dx * s + dy * c) < fxf(w + 5u)) { return true; }
  }
  return false;
}
// the smoke columns over the fire zone (drawSmoke): color only, veiling what is behind them in puffs that
// rise, glowing orange at the base; each vent's column measured in metres across at its distance
fn smokeOver(cl: Cell, rdx: f32, rdy: f32, m: f32) -> Cell {
  var o = cl;
  let fwd = rdx * u.dirX + rdy * u.dirY;
  if (fwd < 1e-3) { return o; }
  let lat = rdy * u.dirX - rdx * u.dirY;
  let v0 = sg[5]; let nv = sg[6];
  for (var q = 0u; q < nv; q++) {
    let w = v0 + q * 4u;
    let sx = bitcast<f32>(sg[w]); let sy = bitcast<f32>(sg[w + 1u]); let sr = bitcast<f32>(sg[w + 2u]); let sh = bitcast<f32>(sg[w + 3u]);
    let rx = sx - u.px; let ry = sy - u.py; let fV = rx * u.dirX + ry * u.dirY;
    if (fV < 5.0) { continue; }
    let t = fV / fwd;
    if (o.depth <= t) { continue; }
    let drop = (rx * rx + ry * ry) / (2.0 * u.curveR);
    let vv = (sh - drop - (u.eye - m * t)) / sh; // 0 at the top of the column, 1 at the ground
    if (vv < 0.0 || vv >= 1.0) { continue; }
    let rise = 1.0 - vv;
    // the column widens and leans downwind as it rises
    let half = sr * (0.5 + 1.7 * rise); let mid = ry * u.dirX - rx * u.dirY + rise * rise * sr * 1.5;
    let uu = (lat * t - mid) / half;
    if (abs(uu) >= 1.0) { continue; }
    let row = ifloor(vv * 30.0 + u.sec * 60.0 * 0.03 * (30.0 / max(1.0, sh / 10.0)));
    let a = (1.0 - uu * uu) * (0.25 + 0.75 * vv) * 0.55 * (0.55 + 0.45 * hash3(ifloor(uu * 5.0 + sx), row, i32(sy)));
    if (a < 0.02) { continue; }
    let glow = select(0.0, (vv - 0.7) / 0.3, vv > 0.7);
    let g0 = (60.0 + 30.0 * vv) * (1.0 - min(1.0, fV / 2500.0) * 0.7);
    let sc = vec3f(g0 + 120.0 * glow, g0 + 40.0 * glow, g0 * 1.05);
    o.bg += (sc - o.bg) * a;
    if (o.ch != 32u && o.ch != 0u) { o.c += (sc - o.c) * a; }
  }
  return o;
}
// ---- rain and snow falling (precip.ts, drawFall), over the finished cell: drops on shells around the
// viewer, in columns fixed to the compass; the nearest shell's drop over this cell wins, then the water
// running off the roofs' edges
const SHELLS = array<f32, ${SHELLS.length}>(${SHELLS.map(f).join(', ')});
fn h3(a: i32, b: i32, c: i32) -> f32 {
  var h = (bitcast<u32>(a) * 0x27d4eb2du) ^ (bitcast<u32>(b) * 0x165667b1u) ^ (bitcast<u32>(c) * 0x9e3779b1u);
  h ^= h >> 16u; h *= 0x85ebca6bu; h ^= h >> 13u; h *= 0xc2b2ae35u; h ^= h >> 16u;
  return f32(h) / 4294967296.0;
}
fn fallOver(cl: Cell, rdx: f32, rdy: f32, m: f32, nearT: f32) -> Cell {
  var o = cl;
  if (u.fall <= 0.01) { return o; }
  let snow = u.fallSnow > 0.5;
  let L = sqrt(rdx * rdx + rdy * rdy);
  let fwd = rdx * u.dirX + rdy * u.dirY; let side = rdy * u.dirX - rdx * u.dirY;
  if (fwd < 1e-3) { return o; }
  // (Y: the rows from a drop's head up to this cell, as the CPU's rows on its sheared camera)
  let az = u.yaw + atan2(side, fwd); let da = 2.0 * u.plane / u.cols;
  // wind across this line of sight: which way the rain's streaks lean
  let cross = 0.5 * ((-rdy * u.windX + rdx * u.windY) / L) / u.fallSpeed;
  let glyph = select(select(BS, SL, cross > 0.0), BAR, abs(cross) < 0.1);
  let P = u.fallPeriod; let base = max(0.0, u.eye - 6.0);
  let b0 = ifloor((u.fallR + base) / P); let b1 = ifloor((12.0 + base + u.fallR) / P);
  for (var s = 0; s < ${SHELLS.length}; s++) {
    let t = SHELLS[s]; let dist = t / L;
    if (o.depth <= dist) { break; }
    if (dist <= nearT) { continue; } // indoors: only beyond the window
    let cap = select(max(1.5, 6.0 - f32(s) * 0.6), 1.0, snow); let near = 1.0 - f32(s) / ${SHELLS.length}.0;
    let zc = u.eye - m * dist; let wx = u.px + rdx / L * t; let wy = u.py + rdy / L * t;
    for (var bb = b0; bb <= b1; bb++) {
      let b = i32(u.fallB) + bb;
      var a = az;
      if (snow) { a += 0.25 * sin(u.sec * 0.9 + f32(b) * 1.7 + f32(s)) / t; }
      let colI = ifloor(a / da);
      if (h3(colI, b, s) > u.fallDens) { continue; }
      let zd = f32(bb) * P + h3(colI, b, s + 17) * P - u.fallR;
      if (zd < base || zd > base + 12.0) { continue; }
      let len = min(u.fallStreak * u.scale / dist, cap); let Y = 0.5 + (zc - zd) * u.scale / dist;
      if (Y < 0.0 || Y >= max(len, 1.0)) { continue; }
      if (underRoof(wx, wy, zd)) { continue; } // sheltered
      // see-through: the drop is the color behind it lightened (snow: whitened), plus the light it catches
      let lt = lightAt(wx, wy, zd);
      let q = (0.5 + 0.5 * near) * select(0.8, 1.0, snow); let add = select(60.0, 120.0, snow) * q + 200.0 * u.flash;
      o.ch = select(select(glyph, COL, s > 5), select(DOT, STAR, s < 3), snow);
      o.c = max(sat(o.bg), sat(o.c) * 0.5) * 1.2 + vec3f(add, add, add * 1.1) + lt * select(2.2, 1.4, snow);
      return o;
    }
  }
  if (snow) { return o; }
  // water running off the roofs: drops falling from their edges (the open front and the two ends)
  let OB = fx[1];
  if (OB == 0u) { return o; }
  let rb = OB + fx[OB + 4u]; let nr = fx[OB + 5u];
  let colC = ifloor((side / fwd / u.plane + 1.0) * 0.5 * u.cols);
  for (var n = 0u; n < nr; n++) {
    let w = rb + n * 7u;
    let Rx = fxf(w); let Ry = fxf(w + 1u); let Rc = fxf(w + 2u); let Rs = fxf(w + 3u); let hx = fxf(w + 4u); let hy = fxf(w + 5u); let Rz = fxf(w + 6u);
    // a roof whose corners all fall in other columns has no drop here
    var lo = 1e9; var hi = -1e9; var ok = true;
    for (var c = 0; c < 4; c++) {
      let lx = select(-hx, hx, (c & 1) == 1); let ly = select(-hy, hy, (c & 2) == 2);
      let wx = Rx + lx * Rc - ly * Rs - u.px; let wy = Ry + lx * Rs + ly * Rc - u.py; let d = wx * u.dirX + wy * u.dirY;
      if (d < 0.4) { ok = false; break; }
      let cx = ((wx * -u.dirY + wy * u.dirX) / (d * u.plane) + 1.0) * 0.5 * u.cols; lo = min(lo, cx); hi = max(hi, cx);
    }
    if (ok && (f32(colC) + 1.0 < lo || f32(colC) > hi)) { continue; }
    var k = 0;
    for (var e = 0; e < 3; e++) {
      var ax = hx; var ay = -hy; var bx = hx; var by = hy; var ox = 1.0; var oy = 0.0;
      if (e == 1) { ax = -hx; ay = -hy; bx = hx; by = -hy; ox = 0.0; oy = -1.0; }
      if (e == 2) { ax = -hx; ay = hy; bx = hx; by = hy; ox = 0.0; oy = 1.0; }
      let mm = ifloor(length(vec2f(bx - ax, by - ay)) / 0.3);
      for (var qq = 0; qq <= mm; qq++) {
        let kk = k; k++;
        if (h3(i32(n), kk, 71) > u.fall * 0.55) { continue; }
        let lx = ax + (bx - ax) * f32(qq) / f32(max(mm, 1)); let ly = ay + (by - ay) * f32(qq) / f32(max(mm, 1));
        let wx = Rx + lx * Rc - ly * Rs - u.px; let wy = Ry + lx * Rs + ly * Rc - u.py;
        let d = wx * u.dirX + wy * u.dirY;
        if (d < 0.4) { continue; }
        if (ifloor(((wx * -u.dirY + wy * u.dirX) / (d * u.plane) + 1.0) * 0.5 * u.cols) != colC) { continue; }
        // a drop every ~0.6 s from each point, falling at 5 m/s
        let z = Rz - fract(u.sec / 0.6 + h3(i32(n), kk, 72)) * 3.0;
        if (z < 0.0 || o.depth <= d / fwd) { continue; }
        let Y = 0.5 + (u.eye - m * (d / fwd) - z) * u.scale / d;
        if (Y < 0.0 || Y >= min(3.0, 0.3 * u.scale / d)) { continue; }
        // no drip where the next roof goes on (scaffold sheds of two faces meeting, end to end)
        let qx = lx + ox * 0.2; let qy = ly + oy * 0.2;
        if (underRoof(Rx + qx * Rc - qy * Rs, Ry + qx * Rs + qy * Rc, Rz - 0.1)) { continue; }
        let lt = lightAt(wx + u.px, wy + u.py, z);
        o.ch = select(BAR, COM, Y < 1.0);
        o.c = max(sat(o.bg), sat(o.c) * 0.5) * 1.2 + vec3f(70.0, 75.0, 85.0) + lt * 2.0;
        return o;
      }
    }
  }
  return o;
}
${objectsWGSL()}
fn store(i: u32, n: u32, cl: Cell) {
  let k = vec3u(clamp(cl.c, vec3f(0.0), vec3f(255.0)));
  outp[i] = cl.ch | (k.x << 8u) | (k.y << 16u) | (k.z << 24u);
  let b = vec3u(clamp(cl.bg, vec3f(0.0), vec3f(255.0)));
  // the background's alpha carries the glow (the compositor's bloom pass reads it)
  outp[n + i] = b.x | (b.y << 8u) | (b.z << 16u) | (u32(gGlow * 255.0) << 24u);
}

// a light held at the eye (handLight): what is near gets brighter by its distance, most in the middle of the view
fn handOver(cl: Cell, gx: u32, gy: u32) -> Cell {
  var o = cl;
  if (u.hand <= 0.0 || o.depth > 40.0) { return o; }
  let cx = (f32(gx) - u.cols / 2.0) / u.cols; let cy = (f32(gy) - u.rows / 2.0) / u.rows; let aim = 0.55 + 0.45 * exp(-(cx * cx + cy * cy) * 6.0);
  let f = u.hand * aim / (1.0 + (o.depth / 2.2) * (o.depth / 2.2));
  if (f < 0.01) { return o; }
  let mul = 1.0 + f * 2.2; let add = f * 70.0;
  o.c = sat(o.c) * mul + add * 1.4; o.bg = sat(o.bg) * mul + add;
  return o;
}
// the city along a cell's ray (everything but the floor around the viewer)
fn cityCell(gx: u32, gy: u32, rdx: f32, rdy: f32, m: f32, L: f32, A: f32, tG: f32) -> Cell {
  // ---- walk the street grid front to back, as the CPU does, but for this one cell's ray
  let ix = select(1e12, 1.0 / rdx, rdx != 0.0); let iy = select(1e12, 1.0 / rdy, rdy != 0.0);
  let stX = select(1, -1, rdx < 0.0); let stY = select(1, -1, rdy < 0.0);
  let W = arrayLength(&xc); let H = arrayLength(&yc);
  var cx = i32(xc[u32(clamp(u.px, 0.0, f32(W - 1u)))]);
  var cy = i32(yc[u32(clamp(u.py, 0.0, f32(H - 1u)))]);
  let nx = i32(u.nxb) - 1; let ny = i32(u.nyb) - 1;
  var tx = (select(xb[cx + 1], xb[cx], rdx < 0.0) - u.px) * ix;
  var ty = (select(yb[cy + 1], yb[cy], rdy < 0.0) - u.py) * iy;
  var tIn = 0.0;
  var best = 1e9; var bk = -1; var bside = 0; var roof = false;
  for (var s = 0; s < 1024; s++) {
    if (tIn > tG) { break; }
    let tOut = min(tx, ty);
    if ((cx & 1) == 1 && (cy & 1) == 1) {
      let o = u32(((cy >> 1) * i32(u.nbx) + (cx >> 1)) * ${BLK});
      let b0 = i32(blk[o + 4u]); let b1 = i32(blk[o + 5u]); let maxH = blk[o + 6u];
      let zMin = min(u.eye - m * tIn + A * tIn * tIn, u.eye - m * tOut + A * tOut * tOut);
      if (b1 > b0 && zMin < maxH) {
        for (var k = b0; k < b1; k++) {
          let q = u32(k * ${BLD});
          let x0 = bld[q]; let y0 = bld[q + 1u]; let x1 = bld[q + 2u]; let y1 = bld[q + 3u]; let h = bld[q + 4u];
          if ((x0 >= u.inX0 - 0.01) && (x1 <= u.inX1 + 0.01) && (y0 >= u.inY0 - 0.01) && (y1 <= u.inY1 + 0.01)) { continue; }
          var tN = 0.0; var tF = 0.0; var side = 0;
          if (bld[q + 5u] > 0.5) {
            let rr = (x1 - x0) * 0.5; let ox = u.px - (x0 + rr); let oy = u.py - (y0 + rr);
            let qa = rdx * rdx + rdy * rdy; let qb = ox * rdx + oy * rdy;
            let disc = qb * qb - qa * (ox * ox + oy * oy - rr * rr);
            if (disc <= 0.0) { continue; }
            tN = (-qb - sqrt(disc)) / qa; tF = (-qb + sqrt(disc)) / qa; side = 2;
          } else {
            let ax = (x0 - u.px) * ix; let bx = (x1 - u.px) * ix; let ay = (y0 - u.py) * iy; let by = (y1 - u.py) * iy;
            let nnx = min(ax, bx); let nny = min(ay, by);
            tF = min(max(ax, bx), max(ay, by)); tN = max(nnx, nny); side = select(1, 0, nnx > nny);
            if (bld[q + 6u] > 0.5) {
              let knx = bld[q + 7u]; let kny = bld[q + 8u]; let kc = bld[q + 9u];
              let dn = knx * rdx + kny * rdy; let th = (kc - knx * u.px - kny * u.py) / dn;
              if (dn < 0.0) { if (th > tN) { tN = th; side = 3; } }
              else if (dn > 0.0) { tF = min(tF, th); }
              else if (knx * u.px + kny * u.py > kc) { continue; }
            }
          }
          if (tN <= 0.01 || tN >= tF || tN >= best) { continue; }
          let zN = u.eye - m * tN + A * tN * tN;
          if (zN >= 0.0 && zN <= h) { best = tN; bk = k; bside = side; roof = false; }
          else if (zN > h && m > 0.0) {
            let tr = (u.eye - h) / m;
            if (tr <= tF && tr < best) { best = tr; bk = k; bside = side; roof = true; }
          }
        }
        if (bk >= 0) { break; }
      }
    }
    if (tx < ty) { cx += stX; tIn = tx; if (cx < 0 || cx >= nx) { break; } tx = (select(xb[cx + 1], xb[cx], rdx < 0.0) - u.px) * ix; }
    else { cy += stY; tIn = ty; if (cy < 0 || cy >= ny) { break; } ty = (select(yb[cy + 1], yb[cy], rdy < 0.0) - u.py) * iy; }
  }

  // the Sarcophagus and its cranes, far past the fence, behind whatever is nearer
  var far = Cell(32u, vec3f(0.0), vec3f(0.0), 1e9, KIND_OTHER, 0.0);
  let vis = sarcVis();
  if (vis > 0.0) {
    var bgS = vec3f(7.0, 8.0, 12.0); if (m <= 0.0) { bgS = skyCell(m, rdx, rdy).bg; }
    far = sarcCell(-m / L, u.scale * L, L, rdx / L, rdy / L, f32(gx), bgS, vis);
    let cr = craneCell(i32(gx), i32(gy), vis);
    if (cr.depth < far.depth) { far = cr; }
  }
  // the cordon fence on the city edge (fenceColumn): chain link on posts, barbed wire on top, where nothing nearer is hit
  let fX = select(select(1e9, -u.px / rdx, rdx < 0.0), (u.cityW - u.px) / rdx, rdx > 0.0);
  let fY = select(select(1e9, -u.py / rdy, rdy < 0.0), (u.cityH - u.py) / rdy, rdy > 0.0);
  let tf = min(fX, fY);
  var cl = Cell(32u, vec3f(0.0), vec3f(0.0), 1e9, KIND_OTHER, 0.0);
  var done = false;
  if (tf > 0.05 && tf <= 2000.0 && tf < min(min(select(1e9, best, bk >= 0), tG), far.depth)) {
    let z = u.eye - m * tf + A * tf * tf;
    if (z >= 0.0 && z < 4.2) {
      let along = select(u.px + tf * rdx, u.py + tf * rdy, fX < fY);
      var ch = 0u;
      if (z > 3.7) { ch = select(TILDE, X, (ifloor(along / 0.4) & 1) == 1); }
      else if (along % 3.0 < 0.15 + tf * 0.002) { ch = BAR; }
      else if (tf < 30.0) {
        let a = (((along + z) % 0.6) + 0.6) % 0.6 < 0.07; let b = (((along - z) % 0.6) + 0.6) % 0.6 < 0.07;
        ch = select(select(select(0u, BS, b), SL, a), X, a && b);
      }
      if (ch != 0u) {
        let k = 1.0 - min(1.0, tf / 1500.0) * 0.7;
        cl = Cell(ch, vec3f(120.0, 120.0, 130.0) * k, vec3f(7.0, 8.0, 12.0), tf, KIND_OTHER, 0.0); done = true;
      }
    }
  }
  if (!done) {
    if (bk >= 0 && best < tG && best < far.depth) {
      if (roof) { cl = roofCell(u32(bk * ${BLD}), best, u.px + rdx * best, u.py + rdy * best); }
      // (the last argument: the metres of wall one row covers there, for edges thinner than a row)
      else { cl = wallCell(bk, best, bside, rdx, rdy, u.eye - m * best + A * best * best, best / u.scale, m, A); }
    }
    else if (tG < 1e8 && tG < far.depth) { cl = groundCell(tG, rdx, rdy); }
    else if (far.depth < 1e9) { cl = far; }
    // below the horizon, a ray the curve carries past the ground: the far ground, as on the CPU
    else if (m > 0.0) { cl = groundCell(1e7, rdx, rdy); }
    else { cl = skyCell(m, rdx, rdy); }
  }
  return cl;
}
/**
 * Whether the sun reaches the point (px, py, pz): 1 lit, 0 in a building's shadow. A ray from the point
 * toward the sun walks the street grid as the view's rays do, rising sunZ per metre of ground, and any
 * box, cylinder or cut box it passes below the top of shades the point. (A point on a face turned to the
 * sun starts on its own box's edge: only a box the ray goes on through counts.)
 */
fn sunLit(px: f32, py: f32, pz: f32) -> f32 {
  let L = length(vec2f(u.sunX, u.sunY));
  if (u.sunZ <= 0.0 || L < 1e-4) { return 1.0; }
  let rdx = u.sunX / L; let rdy = u.sunY / L; let k = u.sunZ / L;
  let ix = select(1e12, 1.0 / rdx, rdx != 0.0); let iy = select(1e12, 1.0 / rdy, rdy != 0.0);
  let stX = select(1, -1, rdx < 0.0); let stY = select(1, -1, rdy < 0.0);
  let W = arrayLength(&xc); let H = arrayLength(&yc);
  if (px < 0.0 || py < 0.0 || px >= f32(W) || py >= f32(H)) { return 1.0; }
  var cx = i32(xc[u32(px)]); var cy = i32(yc[u32(py)]);
  let nx = i32(u.nxb) - 1; let ny = i32(u.nyb) - 1;
  var tx = (select(xb[cx + 1], xb[cx], rdx < 0.0) - px) * ix;
  var ty = (select(yb[cy + 1], yb[cy], rdy < 0.0) - py) * iy;
  var tIn = 0.0;
  for (var s = 0; s < 256; s++) {
    let z = pz + k * tIn;
    if (z > SHADOW_TOP) { break; }
    if ((cx & 1) == 1 && (cy & 1) == 1) {
      let o = u32(((cy >> 1) * i32(u.nbx) + (cx >> 1)) * ${BLK});
      let b0 = i32(blk[o + 4u]); let b1 = i32(blk[o + 5u]);
      if (b1 > b0 && z < blk[o + 6u]) {
        for (var q0 = b0; q0 < b1; q0++) {
          let q = u32(q0 * ${BLD});
          let x0 = bld[q]; let y0 = bld[q + 1u]; let x1 = bld[q + 2u]; let y1 = bld[q + 3u]; let h = bld[q + 4u];
          var tN = 0.0; var tF = 0.0;
          if (bld[q + 5u] > 0.5) {
            let rr = (x1 - x0) * 0.5; let ox = px - (x0 + rr); let oy = py - (y0 + rr);
            let qb = ox * rdx + oy * rdy; let disc = qb * qb - (ox * ox + oy * oy - rr * rr);
            if (disc <= 0.0) { continue; }
            tN = -qb - sqrt(disc); tF = -qb + sqrt(disc);
          } else {
            let ax = (x0 - px) * ix; let bx = (x1 - px) * ix; let ay = (y0 - py) * iy; let by = (y1 - py) * iy;
            tN = max(min(ax, bx), min(ay, by)); tF = min(max(ax, bx), max(ay, by));
            if (bld[q + 6u] > 0.5) {
              let knx = bld[q + 7u]; let kny = bld[q + 8u]; let kc = bld[q + 9u];
              let dn = knx * rdx + kny * rdy; let th = (kc - knx * px - kny * py) / dn;
              if (dn < 0.0) { tN = max(tN, th); } else if (dn > 0.0) { tF = min(tF, th); } else if (knx * px + kny * py > kc) { continue; }
            }
          }
          if (tF <= 0.03 || tN >= tF) { continue; }
          if (pz + k * max(tN, 0.0) < h - 0.05) { return 0.0; }
        }
      }
    }
    if (tx < ty) { cx += stX; tIn = tx; if (cx < 0 || cx >= nx) { break; } tx = (select(xb[cx + 1], xb[cx], rdx < 0.0) - px) * ix; }
    else { cy += stY; tIn = ty; if (cy < 0 || cy >= ny) { break; } ty = (select(yb[cy + 1], yb[cy], rdy < 0.0) - py) * iy; }
  }
  return 1.0;
}
/** No building is taller than this (m): a shadow ray above it is out in the sun. */
const SHADOW_TOP = 460.0;
/** This cell's sunlight after the shadows (sunLit), for finish. */
var<private> gSun: f32 = 1.0;
// what of the cell's color is light it gives off (a lit window, a sign, a lamp) and light it gets from the
// lamps (street lamps, floodlights, headlights), for the cell at depth gTag; set where the cell is made
var<private> gEm: vec3f = vec3f(0.0);
var<private> gIl: vec3f = vec3f(0.0);
var<private> gTag: f32 = -1.0;
// how strongly the finished cell glows onto its neighbors (0..1), written with it (the background's alpha)
var<private> gGlow: f32 = 0.0;
// how much of a cell's light blooms (a lit doorway or a floodlight's lamp less than a sign)
var<private> gGlowK: f32 = 1.0;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let cols = u32(u.cols); let rows = u32(u.rows);
  if (gid.x >= cols || gid.y >= rows) { return; }
  let n = cols * rows; let i = gid.y * cols + gid.x;
  let camX = 2.0 * (f32(gid.x) + 0.5) / u.cols - 1.0;
  // the ray: on the ground plane (rdx, rdy), and how fast it drops per unit of that (m):
  // z(t) = eye - m t + (t L)^2 / 2R (the ground falls away over the curve). Sheared like the CPU's, or a true 3D camera turned by the pitch.
  var rdx = u.dirX + u.plX * camX; var rdy = u.dirY + u.plY * camX;
  var m = (f32(gid.y) + 0.5 - u.hor) / u.scale;
  if (u.cam3d > 0.5) {
    let cp = cos(u.pitch); let sp = sin(u.pitch); let v = (u.rows * 0.5 - (f32(gid.y) + 0.5)) / u.scale; let h = camX * u.plane;
    let D = vec3f(u.dirX * cp, u.dirY * cp, sp) + vec3f(-u.dirY, u.dirX, 0.0) * h + vec3f(-u.dirX * sp, -u.dirY * sp, cp) * v;
    rdx = D.x; rdy = D.y; m = -D.z;
  }
  let L = sqrt(rdx * rdx + rdy * rdy);
  let A = L * L / (2.0 * u.curveR);
  var tG = 1e9;
  if (m > 0.0) { let disc = m * m - 4.0 * A * u.eye; if (disc > 0.0) { tG = 2.0 * u.eye / (m + sqrt(disc)); } }

  // indoors, the floor around the viewer first: the city shows only through its windows
  let IB = inBlock();
  var inc = InC(Cell(32u, vec3f(0.0), vec3f(7.0, 8.0, 12.0), 1e9, KIND_OTHER, 0.0), 0u, 0.0, 0.0, vec3f(0.0), false, 0.0, 0.0, 0.0, 0.0);
  if (IB != 0u) { inc = interiorCell(IB, rdx, rdy, m); }
  var cl = inc.cl;
  if (inc.state != 1u) { cl = cityCell(gid.x, gid.y, rdx, rdy, m, L, A, tG); }
  // the smoke, then the street objects (and the furniture) over all of it, the window glass, then rain and snow over
  // the finished cell, only beyond the glass indoors (the sky's depth is 1e9, so the finish leaves it as it is)
  cl = objectsOver(smokeOver(cl, rdx, rdy, m), gid.x, gid.y, rdx, rdy, -m);
  if (inc.state == 2u) { cl = glassOver(cl, inc, m); }
  // by day, whether the sun reaches what this cell shows (the sky and the rooms keep theirs)
  gSun = 1.0;
  if (u.day > 0.01 && u.sunZ > 0.0 && cl.depth < 3000.0 && cl.kind != KIND_ROOM) {
    let t = cl.depth;
    gSun = sunLit(u.px + rdx * t, u.py + rdy * t, max(0.0, u.eye - m * t + A * t * t));
  }
  store(i, n, fallOver(handOver(finish(cl), gid.x, gid.y), rdx, rdy, m, inc.nearT));
}
`;
}
