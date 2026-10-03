import { BAY, FLOOR_H, LANE_W, SIDEWALK } from '../../sim/city';
import { AD_BG, AD_FG, AD_LETTER, BLOCKS, FRAME_AD, LETTER_W, RAMP, SCREEN_PAL, SIGN_Z0, SIGN_Z1, TICK_LW, TICK_SPEED, TICK_Z0, TICK_Z1 } from '../raycaster';
import { BULB_COLS, BULB_ROWS } from '../signs';
import { CELL, SIDE } from '../lights';
import { LAMP_R, LIGHT_W } from '../lightmap';

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
  'tickN',
] as const;

/** Floats per building in the buildings buffer (see world.ts for the layout). */
export const BLD = 52;
/** The signs' buffer (world.ts, signData): where the font and the businesses start, and the ticker's room. */
export const SG_FONT = 8, SG_BIZ = SG_FONT + 256 * 7, TICK_MAX = 4096;
export const BLK = 8;
export const STYLES = ['office', 'glass', 'brick', 'historic', 'residential', 'warehouse', 'crown', 'spire', 'dome', 'tank', 'chimney', 'mech', 'clock', 'mast', 'gasholder'];

const C = (s: string) => s.charCodeAt(0);
const v3 = (c: readonly number[]) => `vec3f(${c.map((x) => x.toFixed(1)).join(', ')})`;
const f = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : `${x}`);
const G = {
  DOT: C('.'), COM: C(','), TICK: C('`'), COL: C(':'), SEMI: C(';'), DASH: C('-'), EQ: C('='), PLUS: C('+'),
  HASH: C('#'), PCT: C('%'), AT: C('@'), BAR: C('|'), US: C('_'), STAR: C('*'), QUO: C('"'),
  O: C('o'), LB: C('['), RB: C(']'), SL: C('/'), BS: C('\\'), CARET: C('^'), X: C('x'),
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

${glyphs}
const FLOOR_H = ${FLOOR_H};
const BAY = ${BAY};
const SIDEWALK = ${SIDEWALK};
const LANE_W = ${LANE_W};
const FOG = 1500.0;
const LIT_H = 9.0;
const LIT_FAR = 600.0;
const GROUND_FAR = 600.0;
const LIGHT_KNEE = 150.0;
const CROWN_H = 16.0;
const FLOOD_GAP = 6.0;
const LW = ${LIGHT_W};
const DSIDE = ${SIDE};
const DCELL = ${CELL}.0;
const BLOCKS = array<u32, 256>(${Array.from(BLOCKS).map((b) => `${b}u`).join(',')});
const PATS = array<vec3u, 5>(vec3u(AT, HASH, PCT), vec3u(56u, O, COL), vec3u(88u, 90u, PLUS), vec3u(48u, O, EQ), vec3u(72u, HASH, EQ));
const KIND_OTHER = 0u; const KIND_GROUND = 1u; const KIND_WALL = 2u;
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
      let tx = fx - f32(ix); let ty = fy - f32(iy); let i0 = u32(iy * LW + ix);
      L += (lampCorner(i0, (1.0 - tx) * (1.0 - ty)) + lampCorner(i0 + 1u, tx * (1.0 - ty)) + lampCorner(i0 + u32(LW), (1.0 - tx) * ty) + lampCorner(i0 + u32(LW) + 1u, tx * ty)) * zk;
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
        if (dx * dl[o + 5u] + dy * dl[o + 6u] < -0.3) { continue; }
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
  let fogK = 1.0 - exp(-t / FOG); let k = 1.0 - fogK * 0.6;
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

// ---- a wall (wallColumn): the facade by its style, its windows, and the lights on it
fn wallCell(bk: i32, t: f32, side: i32, rdx: f32, rdy: f32, z: f32, dz: f32) -> Cell {
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
  let shade = lightK * (1.0 - fogK * 0.6);
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
  let kv = select(u32(ceil(log2(1.0 / rpf))), 0u, rpf >= 1.0); let kh = select(u32(ceil(log2(1.0 / cpb))), 0u, cpb >= 1.0);
  let bay = along / BAY; let wi = ifloor(bay); let fw = bay - f32(wi);
  let corner = along - f0 < 0.35 || f1 - along < 0.35;
  // a clock tower is a historic facade with a clock face near the top of each side
  var S = style; if (style == 12) { S = 3; }
  let clockR = select(0.0, min(3.0, (f1 - f0) * 0.32), style == 12 && side != 2); let clockZ = H - clockR - 2.0;
  let du = along - (f0 + f1) * 0.5;
  let farWall = select(select(COL, BAR, S == 5), EQ, S == 2);
  let farK = select(1.0, 1.25, S == 1);
  let balcony = S == 4 && feat < 0.5; let balK = ifloor(fract(feat * 131.0) * 4.0);
  let pIdx = ifloor(fract(feat * 977.0) * 5.0); let pat = PATS[pIdx];
  let band = select(0, 1 + ifloor(fract(feat * 53.0) * 3.0), fract(feat * 311.0) < 0.35);
  // the glass mirrors the sky: bands slide over it as the viewer moves
  var tang = 0.0;
  if (side == 0) { tang = rdy; } else if (side == 1) { tang = rdx; } else if (side == 3) { tang = rdx * bld[q + 8u] - rdy * bld[q + 7u]; }
  else { let nx = hx - cx; let ny = hy - cy; let n = max(1e-6, length(vec2f(nx, ny))); tang = (rdx * -ny + rdy * nx) / n; }
  let sheen = 0.5 + 0.5 * sin(tang * 6.0 + ((z - u.eye) / t) * 4.0 + f32(bk % 7));
  let fl = ifloor(z / FLOOR_H); let fz = z / FLOOR_H - f32(fl);
  var ch = 0u; var c = vec3f(0.0);
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
    if (z > H - 1.0) { ch = STAR; c = win * winLight; }
    else if (S == 10 && ((z > H - 6.0 && z < H - 4.5) || (z > H - 10.0 && z < H - 8.5))) { ch = EQ; c = frame * 1.9 * shade; }
    else { ch = select(BAR, EQ, S == 10 && detailed); c = frame * select(1.0, 1.2, S == 7) * shade; }
  } else if (z > H - max(0.6, dz)) {
    ch = US; c = frame * 1.5 * shade;
    if (u.snow > 0.05) { c += (vec3f(190.0, 195.0, 205.0) - c) * (u.snow * 0.8); }
  } else if (clockR > 0.0 && length(vec2f(du, z - clockZ)) < clockR) {
    let cz = z - clockZ; let d = length(vec2f(du, cz));
    let a1 = 150.0 * 3.14159265 / 180.0; let a2 = 30.0 * 3.14159265 / 180.0;
    let s1 = du * cos(a1) + cz * sin(a1); let s2 = du * cos(a2) + cz * sin(a2);
    let hand = (s1 > 0.0 && s1 < clockR * 0.5 && abs(-du * sin(a1) + cz * cos(a1)) < 0.22) || (s2 > 0.0 && s2 < clockR * 0.75 && abs(-du * sin(a2) + cz * cos(a2)) < 0.22);
    if (d > clockR * 0.82) { ch = O; c = frame * 1.6 * shade; }
    else if (hand) { ch = HASH; c = vec3f(40.0, 30.0, 20.0); }
    else { ch = select(COL, O, d < 0.3); c = vec3f(250.0, 230.0, 170.0) * elec; }
  } else if (S == 13) {
    if (z % 30.0 < 1.0 && corner) { ch = STAR; c = win * winLight; }
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
    if ((ifloor(along / select(1.6, 0.8, detailed)) & 1) == 1) { ch = BAR; c = win * adElec * 0.9; }
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
      ch = P.ch; c = P.c * adElec;
    }
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
    c += vec3f(120.0, 105.0, 80.0) * ((1.0 - u.day) * ad * max(0.0, 1.0 - (z - adZ0) / (adZ1 - adZ0)) * 0.9);
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
      c = w2 * p2 * (0.65 + 0.35 * hash3(gw, bk, 5));
    } else { ch = farWall; c = frame * farK * shade; }
  } else if (z < FLOOR_H && shop) {
    if (fw > 0.12 && fw < 0.88 && z > 0.2 && z < 2.6 && !corner) { ch = select(select(COL, RB, fw > 0.8), LB, fw < 0.2); c = vec3f(180.0, 150.0, 100.0) * elec; }
    else { ch = BAR; c = frame * shade; }
  } else if (S == 1) {
    // curtain wall: mullions and floor slabs over tinted glass with a diagonal sheen
    if (fz < 0.08) { ch = DASH; c = frame * 0.8 * shade; }
    else if (fw < 0.07 || corner) { ch = BAR; c = frame * 1.5 * shade; }
    else if (hh < litK) {
      if (wp > 0.04) { ch = select(select(COL, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; } else { ch = EQ; c = darkPane; }
    } else { ch = select(select(DOT, COL, sheen > 0.4), SL, sheen > 0.85); c = frame * (1.3 + 0.9 * sheen) * shade; }
  } else if (S == 5) {
    let dp = along % 6.0;
    if (z > H - 3.2 && z < H - 1.4) {
      if (fw > 0.08 && fw < 0.92) {
        let p0 = select(winLight, power(sub, cx, cy, bk * 131 + wi * 977, gen, bk, 1.5) * winLight, switched);
        if (hash3(bk, wi, 0) < litK * 2.0 && p0 > 0.04) { ch = HASH; c = win * p0 * 0.75; }
        else { ch = EQ; c = vec3f(22.0 * shade + 8.0, 26.0 * shade + 8.0, 36.0 * shade + 10.0); }
      } else { ch = BAR; c = frame * 1.2 * shade; }
    } else if (z < 4.5 && ifloor(along / 6.0) % 3 == 1 && !corner) {
      let edge = dp < 0.4 || dp > 5.6;
      ch = select(select(DASH, EQ, z > 4.1), BAR, edge); c = frame * select(1.15, 1.3, edge) * shade;
    } else { ch = BAR; c = frame * select(0.78, 1.0, (ifloor(along / 0.6) & 1) == 1) * shade; }
  } else if (S == 3) {
    if (z > H - 2.2) { ch = select(select(QUO, COL, (i32(fw * 4.0) & 1) == 1), EQ, z > H - 1.2); c = frame * 1.3 * shade; }
    else if (z < FLOOR_H * 1.2) { ch = select(HASH, EQ, (ifloor(z / 0.7) & 1) == 1); c = frame * 0.9 * shade; }
    else if ((wi % 3 == 0 && fw < 0.28) || corner) { ch = BAR; c = frame * 1.25 * shade; }
    else if (fz < 0.08) { ch = DASH; c = frame * 1.1 * shade; }
    else if (fw > 0.3 && fw < 0.7 && fz > 0.18 && fz < 0.82) {
      if (fz > 0.7) { ch = CARET; c = frame * 1.3 * shade; }
      else if (wp > 0.04) { ch = select(select(HASH, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; } else { ch = EQ; c = darkPane; }
    } else { ch = COL; c = frame * shade; }
  } else if (S == 2) {
    if (fw > 0.3 && fw < 0.7 && fz > 0.3 && fz < 0.78 && !corner) {
      if (wp > 0.04) { ch = select(select(HASH, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; } else { ch = EQ; c = darkPane; }
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
      if (wp > 0.04) { ch = select(select(HASH, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; } else { ch = EQ; c = darkPane; }
    } else { ch = select(DOT, BAR, corner); c = frame * shade; }
  } else if (fw > 0.2 && fw < 0.8 && fz > 0.28 && fz < 0.8 && !corner) {
    if (wp > 0.04) { ch = select(select(pat.z, pat.y, hh < litK * 0.7), pat.x, hh < litK * 0.3); c = wc * wk; } else { ch = EQ; c = darkPane; }
  } else { ch = select(select(COL, DOT, t > 60.0), BAR, corner); c = frame * shade; }
  // neon tubes up the corners and along the roof line, and their glow on the wall
  if (bld[q + 27u] > 0.5) {
    let neon = colAt(q + 24u);
    let eA = min(along - f0, f1 - along); let dTop = abs(z - (H - 0.3));
    let tw = max(0.1, dAlong * 0.6); let tz = max(0.1, dz * 0.6);
    let onTube = (eA < tw && z < H - 0.3 + tz) || dTop < tz;
    let s = select(along, z, eA < tw);
    let chase = hash3(bk, 3, 31) < 0.35 && ifloor((s - u.sec * 5.0) / 1.4) % 3 == 0;
    let k = ad * (1.0 - 0.55 * u.day) * select(1.0, 0.25, chase);
    if (onTube) { ch = select(DASH, BAR, eA < tw); c = neon * k + vec3f(70.0 * k); }
    else { let e = max(0.0, 1.0 - min(eA, dTop) / 1.6); c += neon * (e * e * 0.5 * k); }
  }
  // the top washed in light at night
  if (bld[q + 31u] > 0.5 && z > H - CROWN_H) {
    c += colAt(q + 28u) * (pow((z - (H - CROWN_H)) / CROWN_H, 1.4) * 0.95 * ad * (1.0 - 0.85 * u.day));
  }
  // floodlights at the foot of the wall, each a cone of light widening upward
  let floodH = bld[q + 35u];
  if (floodH > 0.0 && z < floodH) {
    let w = 0.35 + 0.18 * z; let fzz = min(1.0, z / 1.5) * pow(max(0.0, 1.0 - z / floodH), 1.2);
    var I = 0.0;
    if (dAlong > FLOOD_GAP * 0.4) { I = fzz * min(1.0, 1.77 * w / FLOOD_GAP); }
    else {
      let fb = select(f0, 0.0, side == 2);
      let fr = (((along - fb) / FLOOD_GAP) % 1.0 + 1.0) % 1.0; let d = abs(fr - 0.5) * FLOOD_GAP; let d2 = FLOOD_GAP - d;
      I = fzz * (exp(-(d / w) * (d / w)) + exp(-(d2 / w) * (d2 / w)));
      if (z < 0.35 && d < 0.3) { ch = STAR; c = vec3f(240.0, 230.0, 200.0); }
    }
    c += colAt(q + 32u) * (I * adElec);
  }
  c = sat(c);
  // street lamps, headlights and signs light the lower floors
  if (z < LIT_H && t < LIT_FAR) { c = sat(c + lightAt(hx, hy, z) * (1.3 * shade)); }
  return Cell(ch, c, vec3f(7.0, 8.0, 12.0), t, KIND_WALL, max(0.0, wsun));
}

// ---- the ground (renderWorld's ground loop)
fn groundCell(rd: f32, rdx: f32, rdy: f32) -> Cell {
  let wx = u.px + rdx * rd; let wy = u.py + rdy * rd;
  let W = f32(arrayLength(&xc)); let Hh = f32(arrayLength(&yc));
  let bg = vec3f(7.0, 8.0, 12.0);
  if (wx < 0.0 || wy < 0.0 || wx >= W || wy >= Hh) { return Cell(DOT, vec3f(60.0, 30.0, 18.0), bg, rd, KIND_GROUND, 0.0); }
  if (rd > GROUND_FAR) { return Cell(DOT, vec3f(28.0, 24.0, 32.0), bg, rd, KIND_GROUND, 0.0); }
  let fog = 1.0 - (rd / GROUND_FAR) * 0.9;
  let gx = i32(xc[u32(wx)]); let gy = i32(yc[u32(wy)]);
  let hv = hash3(ifloor(wx * 1.2), ifloor(wy * 1.2), 3);
  var ch = DOT; var c = vec3f(38.0, 38.0, 46.0);
  let roadX = (gx & 1) == 0; let roadY = (gy & 1) == 0;
  let sD = (wx - u.dox) * u.dnx + (wy - u.doy) * u.dny; let aD = abs(sD); let pastD = aD - u.dw * 0.5;
  let diagGlyph = select(SL, BS, u.dex * u.dey > 0.0);
  let asphalt = select(select(TICK, COM, hv < 0.8), DOT, hv < 0.5);
  if (pastD < 0.0) {
    ch = asphalt;
    if (!roadY && rd < 200.0) {
      let al = (wx - u.dox) * u.dex + (wy - u.doy) * u.dey; let m = aD % LANE_W;
      if (aD < 0.3) { ch = diagGlyph; c = vec3f(210.0, 170.0, 60.0); }
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
      if (dEnd < 1.0) { }
      else if (end > 1.0 && end < 4.5) { if (ifloor((across + 100.0) / 0.9) % 2 == 0) { ch = markX; c = vec3f(150.0); } }
      else if ((end > 4.6) && (end < 5.05) && (a < (b0b - b0a) * 0.5 - 0.3) && (select((across < 0.0), (across > 0.0), (along - e0a) < (e0b - along)) == roadX)) { ch = markX; c = vec3f(170.0); }
      else if (a < 0.3) { ch = mark; c = vec3f(210.0, 170.0, 60.0); }
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
    } else if ((diag & select(2u, 4u, sD > 0.0)) != 0u) {
      let fx = fract(wx / 2.5); let fy = fract(wy / 2.5);
      ch = select(COL, PLUS, fx < 0.06 || fy < 0.06); c = vec3f(92.0, 86.0, 80.0);
      if (square) { let dark = ((ifloor(wx / 2.5) + ifloor(wy / 2.5)) & 1) == 1; c = select(vec3f(108.0, 104.0, 108.0), vec3f(62.0, 60.0, 66.0), dark); if (!dark && fx > 0.45 && fx < 0.55 && fy > 0.45 && fy < 0.55) { ch = O; } }
    } else if (opk == 1u) {
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
  }
  c = sat(c);
  return Cell(ch, sat((c + lightAt(wx, wy, 0.0) * lk) * fog), bg, rd, KIND_GROUND, 0.0);
}

// ---- the finish: moonlight, daylight and haze, a whole-city blackout, the display modes
fn finish(cl: Cell) -> Cell {
  var o = cl;
  if (o.depth >= 1e9) { return o; }
  if (u.moonlight > 0.02 && o.depth > 0.0) { let m = u.moonlight * (1.0 - 0.7 * u.cloud) * 14.0; o.c = sat(o.c + vec3f(m * 0.7, m * 0.8, m * 1.15)); }
  let day = u.day;
  if (day > 0.01 || u.flash > 0.0) {
    let f = day * (0.1 + 0.42 * (1.0 - exp(-o.depth / 2500.0)));
    let haze = vec3f(150.0, 160.0, 176.0);
    let sunlit = o.kind == KIND_WALL;
    if (day > 0.01 && (o.kind == KIND_GROUND || sunlit)) {
      let low = 1.0 - clamp(u.sunEl / 0.35, 0.0, 1.0);
      let skyK = day * (0.36 + 0.3 * u.cloud); let dirK = 1.6 * day * (1.0 - 0.85 * u.cloud);
      let sunC = vec3f(1.05, 0.95 - 0.3 * low, 0.85 - 0.5 * low);
      let share = select(u.sunZ, o.sun, sunlit); let d = dirK * share;
      let gm = vec3f(1.0) + 2.2 * (vec3f(skyK * 0.92, skyK * 0.97, skyK * 1.08) + d * sunC) + vec3f(u.flash * 0.6);
      let lift = 24.0 * (skyK + d);
      o.c = sat((o.c * gm + lift * sunC) * (1.0 - f) + haze * f);
    } else {
      let amb = 1.0 + 0.7 * day + u.flash * 0.6;
      o.c = sat(o.c * amb * (1.0 - f) + haze * f);
    }
  }
  let dark = 1.0 - 0.72 * pow(1.0 - u.cityLit, 1.5) * (1.0 - day);
  if (dark < 0.999) { o.c *= dark; o.bg *= dark; }
  if (u.solid > 0.0) { o.bg = o.c * u.solid; }
  if (u.sharp < 3.0) {
    let s = u.sharp;
    var fill = 0.0;
    if (o.kind == KIND_GROUND) { fill = 0.5; } else if (s == 0.0 && o.kind == KIND_WALL) { fill = 0.28; }
    if (fill > 0.0) {
      let fa = select(0.0, clamp((o.depth - 40.0) / 220.0, 0.0, 1.0), u.fuse > 0.5); let f = fa * fa * (3.0 - 2.0 * fa);
      let glyph = select(0.78, 0.82, o.kind == KIND_GROUND) - 0.15 * f;
      let fl = fill + (0.5 - fill) * 0.45 * f;
      o.bg = o.c * fl; o.c *= glyph;
    }
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
      let grey = (150.0 - 60.0 * thick - 35.0 * u.precip) * day;
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

fn store(i: u32, n: u32, cl: Cell) {
  let k = vec3u(clamp(cl.c, vec3f(0.0), vec3f(255.0)));
  outp[i] = cl.ch | (k.x << 8u) | (k.y << 16u) | (k.z << 24u);
  let b = vec3u(clamp(cl.bg, vec3f(0.0), vec3f(255.0)));
  outp[n + i] = b.x | (b.y << 8u) | (b.z << 16u) | (255u << 24u);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let cols = u32(u.cols); let rows = u32(u.rows);
  if (gid.x >= cols || gid.y >= rows) { return; }
  let n = cols * rows; let i = gid.y * cols + gid.x;
  let camX = 2.0 * (f32(gid.x) + 0.5) / u.cols - 1.0;
  // the ray: on the ground plane (rdx, rdy), and how fast it drops per unit of that (m):
  // z(t) = eye - m t - (t L)^2 / 2R. Sheared like the CPU's, or a true 3D camera turned by the pitch.
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
      let zMin = min(u.eye - m * tIn - A * tIn * tIn, u.eye - m * tOut - A * tOut * tOut);
      if (b1 > b0 && zMin < maxH) {
        for (var k = b0; k < b1; k++) {
          let q = u32(k * ${BLD});
          let x0 = bld[q]; let y0 = bld[q + 1u]; let x1 = bld[q + 2u]; let y1 = bld[q + 3u]; let h = bld[q + 4u];
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
          let zN = u.eye - m * tN - A * tN * tN;
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

  if (bk >= 0 && best < tG) {
    if (roof) { store(i, n, finish(roofCell(u32(bk * ${BLD}), best, u.px + rdx * best, u.py + rdy * best))); return; }
    // (the last argument: the metres of wall one row covers there, for edges thinner than a row)
    store(i, n, finish(wallCell(bk, best, bside, rdx, rdy, u.eye - m * best - A * best * best, best / u.scale)));
    return;
  }
  if (tG < 1e8) { store(i, n, finish(groundCell(tG, rdx, rdy))); return; }

  // below the horizon, a ray the curve carries past the ground: the far ground, as on the CPU
  if (m > 0.0) { store(i, n, finish(groundCell(1e7, rdx, rdy))); return; }
  store(i, n, skyCell(m, rdx, rdy));
}
`;
}
