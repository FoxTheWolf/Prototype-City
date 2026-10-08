import { BAY, BURN_START, FLOOR_H, LANE_W, SIDEWALK } from '../../sim/city';
import STARS from '../stars.json';
import { PENUMBRA, UMBRA } from '../sky';
import { LAT } from '../../sim/clock';
import { CEIL, CELL as PCELL, DOOR, DOOR_H, LEAF_TH, WALL } from '../../sim/interior';
import { LITTER, LITTER_FAR, AD_BG, AD_FG, AD_LETTER, BLOCKS, FRAME_AD, LETTER_W, NETS, RAMP, SCAF_BOARD, SCAF_D, SCAF_STEEL, SCREEN_PAL, SHED_Z, SIGN_Z0, FLOOD_GAP, FLOOD_FIX_FAR, SIGN_Z1, TICK_LW, TICK_SPEED, TICK_Z0, TICK_Z1 } from '../raycaster';
import { BULB_COLS, BULB_ROWS } from '../signs';
import { CELL, FLOOD_OUT, PANEL_S, SIDE } from '../lights';
import { LAMP_R, LIGHT_W } from '../lightmap';
import { objectsWGSL } from './objects';
import { SHELLS } from '../precip';
import { SURGE, SURGE_K } from '../power';

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
  'snow', 'wet', 'rain', 'cam3d', 'pitch', 'colW', 'plane', 'adapt',
  'dusk', 'sunA', 'moonA', 'moonEl', 'phase', 'precip', 'driftX', 'driftY',
  'cityW', 'cityH', 'ccx', 'ccy', 'sarX', 'sarY', 'sarR', 'lst',
  'tickN', 'sarH', 'towX', 'towY', 'towR', 'towH', 'yaw', 'fall',
  'fallSnow', 'windX', 'windY', 'fallB', 'fallR', 'fallSpeed', 'fallStreak', 'fallDens',
  'fallPeriod', 'inX0', 'inY0', 'inX1', 'inY1', 'hand', 'eclU', 'eclV',
] as const;

/** Words of the viewer's floor's block (world.ts) before its street doors' leaves (16..21: the stairwell, see roomWalk). */
export const IN_LEAVES = 22;
/** Floats per door leaf in a plan (world.ts putPlan), and how many open doors fx lists (openDoors). */
export const LEAF_W = 8, FX_DOORS = 64;

/** Floats per building in the buildings buffer (see world.ts for the layout). */
export const BLD = 64;
/** The signs' buffer (world.ts, signData): where the font, the stars (four words each: sky.ts) and the businesses start, and the ticker's room. */
export const SG_FONT = 8, SG_STARS = SG_FONT + 256 * 7, SG_BIZ = SG_STARS + STARS.length * 4, TICK_MAX = 4096;
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
/** A panel light's size factor (PANEL_S in lights.ts), and how much of it a surface turned away from it still gets (it is not a point: some of it always shows). */
const PANEL_S = ${f(PANEL_S)}; const PANEL_RECV_WRAP = 0.15;
const WIN_SPILL = 70.0;
const CROWN_H = 16.0;
const FLOOD_GAP = ${f(FLOOD_GAP)}; const FLOOD_OUT = ${f(FLOOD_OUT)}; const FLOOD_FIX_FAR = ${f(FLOOD_FIX_FAR)}; const FLOOD_SHADOW_FAR = 45.0;
const LW = ${LIGHT_W};
const DSIDE = ${SIDE};
const DCELL = ${CELL}.0;
const BLOCKS = array<u32, 256>(${Array.from(BLOCKS).map((b) => `${b}u`).join(',')});
const PATS = array<vec3u, 5>(vec3u(AT, HASH, PCT), vec3u(56u, O, COL), vec3u(88u, 90u, PLUS), vec3u(48u, O, EQ), vec3u(72u, HASH, EQ));
// materials (R.23): how rough a surface is (0 a mirror, 1 matte) and how much it reflects head-on (F0)
const MAT_NONE = 0u; const MAT_ASPHALT = 1u; const MAT_CONCRETE = 2u; const MAT_BRICK = 3u; const MAT_GLASS = 4u; const MAT_METAL = 5u;
const MAT_PAINT = 6u; const MAT_LEAF = 7u; const MAT_STONE = 8u; const MAT_WINDOW = 9u;
// (a car's paint: a clear coat over a satin color, not chrome; its mirror only shows toward the edges, blurred)
const MAT_ROUGH = array<f32, 10>(1.0, 0.8, 0.85, 0.9, 0.04, 0.45, 0.35, 1.0, 0.75, 0.05);
const MAT_F0 = array<f32, 10>(0.0, 0.03, 0.03, 0.025, 0.05, 0.25, 0.1, 0.02, 0.03, 0.04);
// each facade style's wall (office, glass, brick, historic, residential, warehouse, lit stripes, spire, ...)
const WALL_MAT = array<u32, 16>(2u, 5u, 3u, 8u, 2u, 5u, 2u, 5u, 2u, 5u, 5u, 8u, 8u, 5u, 2u, 2u);
/** How far a mirroring surface traces its reflection (m); past it, it mirrors the sky only. */
const REFL_FAR_WALL = 260.0; const REFL_FAR_GROUND = 160.0;
/** How far a car's paint mirrors the city (m); past it, the sky only. How much the paint's color tints what it mirrors (metallic flakes). */
const REFL_FAR_CAR = 90.0; const CAR_METAL = 0.25;
/** How far a rough surface's mirror ray is scattered per unit of roughness (a blurred reflection, dithered per cell). */
const REFL_BLUR = 0.1;
/** How much of a lamp's highlight on glossy paint, metal or glass blooms, and where the sun's glint starts blooming and how fast it grows. */
const SPEC_BLOOM = 1.6; const SPEC_BLOOM_MIN = 0.4; const SPEC_BLOOM_SUN = 0.5;
/** How saturated the palette color reads as albedo under a light: the palettes are near grey (their hue shows
 *  mostly through the city's orange haze), so a lit wall went grey; the light now takes a stronger version of the hue. */
const LIT_SAT = 1.5;
/** How much of a lamp's own hue a facade takes (0: only its brightness). */
const WALL_LAMP_HUE = 0.9;
/** At night, how much darker the street objects' paint reads than its palette color (as the walls' palette is). */
const OBJ_NIGHT = 0.3;
/** How strongly a glossy surface shows the lamps' light at night, on top of the light it scatters. */
/** The walls of the shops seen through their windows: mint, butter, salmon, sky, cream, red. */
const SHOP_PAINT = array<vec3f, 6>(vec3f(150.0, 205.0, 175.0), vec3f(225.0, 205.0, 120.0), vec3f(220.0, 140.0, 115.0), vec3f(135.0, 180.0, 215.0), vec3f(220.0, 205.0, 170.0), vec3f(190.0, 80.0, 70.0));
const LAMP_GLOSS = 1.2; const CAR_GLOSS = 1.5;
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
    // (L.12) the surge: everything swells together, then holds brighter until the ring arrives (render/power.ts)
    if (since < ${SURGE}) { return 1.0 + ${SURGE_K.toFixed(3)} * smoothstep(0.0, ${SURGE}, since); }
    let t = since - ${SURGE} - d / 120.0 - hb * 0.3 - hw * spread;
    if (t < 0.0) { return ${(1 + SURGE_K).toFixed(3)}; }
    if (t < 0.32) { return select(0.05, 1.25, hash3(id, ifloor(t * 28.0), 405) < 0.45); }
    if (gen && t > 3.0) { return min(0.55, (t - 3.0) * 0.4); }
    return 0.0;
  }
  let t = since - (0.4 + d / 120.0 + hb * 2.0 + hw * spread * 2.0);
  if (t < 0.0) { return select(0.0, 0.55, gen); }
  return select(1.0, 0.15, t < 0.7 && hash3(id, ifloor(t * 18.0), 406) < 0.5);
}

/** The power element a window belongs to: in a blackout the windows go (and come back) together by
 *  whole floors in some buildings, by runs of 4..8 windows in the others, not one by one. */
fn winGroup(bk: i32, wi: i32, fl: i32) -> i32 {
  let h = hash3(bk, 0, 408);
  if (h < 0.35) { return bk * 131 + fl * 7; }
  return bk * 131 + (wi / (4 + i32(fract(h * 13.0) * 5.0))) * 977 + fl * 7;
}

// ---- light (lightmap.ts, lights.ts, lightAt): the street lamps' pools and this frame's dynamic lights
fn lampCorner(i: u32, f: f32, sh: vec4f) -> vec3f {
  let w = lmap[i];
  if (w == 0u || f <= 0.0) { return vec3f(0.0); }
  let id = w >> 8u; let n = (id - 1u) * 6u; let g = f32(w & 255u) / 255.0 * f;
  // (the shadow of what stands between it and the lamp, for the two lamps of the nearest metre: sh = id, lit, id, lit)
  let k = select(select(1.0, sh.w, f32(id) == sh.z), sh.y, f32(id) == sh.x);
  return vec3f(lampCol[n], lampCol[n + 1u], lampCol[n + 2u]) * (g * k);
}
/** How far from the viewer the street lamps' shadows of the objects are traced (m), and from how far they fade out. */
const LAMP_SH_FAR = 40.0;
/**
 * The street lamps' cones in the air at night (CONE_DRY), stronger in falling rain or snow (CONE_WET by the precipitation): a short march along the view ray (to CONE_FAR),
 * each step lit by the two lamps of its metre if it is in the cone under their heads, the brighter near them.
 * The steps start at a fine-grained offset per cell (interleaved gradient noise), as the sun's rays do.
 */
const CONE_FAR = 32.0; const CONE_STEPS = 12; const CONE_TAN = 1.6; const CONE_K = 0.1; const CONE_DRY = 0.8; const CONE_WET = 1.6;
fn coneLamp(w: u32, Q: vec3f) -> vec3f {
  if (w == 0u) { return vec3f(0.0); }
  let n = ((w >> 8u) - 1u) * 6u;
  let dz = lampCol[n + 5u] - Q.z;
  if (dz <= 0.1) { return vec3f(0.0); }
  let rr = length(vec2f(Q.x - lampCol[n + 3u], Q.y - lampCol[n + 4u])); let R = dz * CONE_TAN;
  if (rr >= R) { return vec3f(0.0); }
  let e = 1.0 - rr / R;
  return vec3f(lampCol[n], lampCol[n + 1u], lampCol[n + 2u]) * (e * e / (1.0 + (dz * dz + rr * rr) / 12.0));
}
fn lampCones(gx: u32, gy: u32, rdx: f32, rdy: f32, m: f32, depth: f32) -> vec3f {
  let k = (CONE_DRY + CONE_WET * u.precip) * (1.0 - u.day);
  if (k < 0.03) { return vec3f(0.0); }
  let tEnd = min(depth, CONE_FAR); let dt = tEnd / f32(CONE_STEPS);
  let j = fract(52.9829189 * fract(0.06711056 * f32(gx) + 0.00583715 * f32(gy)));
  var acc = vec3f(0.0);
  for (var s = 0; s < CONE_STEPS; s++) {
    let t = (f32(s) + j) * dt;
    let Q = vec3f(u.px + rdx * t, u.py + rdy * t, u.eye - m * t);
    if (Q.z < 0.0 || Q.z > 7.0) { continue; }
    let ix = ifloor(Q.x - u.lox); let iy = ifloor(Q.y - u.loy);
    if (ix < 0 || iy < 0 || ix >= LW || iy >= LW) { continue; }
    let i0 = u32(iy * LW + ix);
    acc += (coneLamp(lmap[i0], Q) + coneLamp(lmap[i0 + u32(LW * LW)], Q)) * dt;
  }
  return acc * (CONE_K * k);
}
/** How much of lamp id's light reaches P past the street objects (1 clear). */
fn lampShadow(P: vec3f, id: u32) -> f32 {
  let n = (id - 1u) * 6u;
  return footShadow(P, vec3f(lampCol[n + 3u], lampCol[n + 4u], lampCol[n + 5u]));
}
fn lvSum(o: u32, n: u32, p: f32) -> f32 {
  let k = u32(floor(p));
  if (k >= n) { return dlv[o + k]; }
  return dlv[o + k] + (dlv[o + k + 1u] - dlv[o + k]) * (p - f32(k));
}
// nr: the lit surface's normal (zero: none, a raindrop; it takes the light as if it faced it)
fn lightAt(px: f32, py: f32, pz: f32, nr: vec3f) -> vec3f {
  var L = vec3f(0.0);
  // the panels add up in linear light (their colors come linear; 1 = white): summed as sRGB, raised to 2.2 in the
  // finish, a light fell off as 1 / d^4.4 and a sign lit only the wall it hung on
  var Lp = vec3f(0.0);
  let zk = select(1.0 - (pz - 1.0) / (LIT_H - 1.0), 1.0, pz <= 1.0);
  if (zk > 0.0) {
    let fx = px - u.lox; let fy = py - u.loy; let ix = ifloor(fx); let iy = ifloor(fy);
    if (ix >= 0 && iy >= 0 && ix < LW - 1 && iy < LW - 1) {
      let tx = fx - f32(ix); let ty = fy - f32(iy);
      // near the viewer at night, what stands between a point and its lamps shades it: the two lamps of the nearest metre
      var sh = vec4f(-1.0, 1.0, -1.0, 1.0);
      let dv = length(vec2f(px - u.px, py - u.py));
      if (u.day < 0.95 && dv < LAMP_SH_FAR) {
        let k = u32((iy + i32(ty >= 0.5)) * LW + ix + i32(tx >= 0.5));
        let w0 = lmap[k]; let w1 = lmap[k + u32(LW * LW)];
        let P = vec3f(px, py, max(pz, 0.03)) + nr * 0.06;
        let fade = smoothK(LAMP_SH_FAR * 0.75, LAMP_SH_FAR, dv);
        if (w0 != 0u) { sh.x = f32(w0 >> 8u); sh.y = mix(lampShadow(P, w0 >> 8u), 1.0, fade); }
        if (w1 != 0u) { sh.z = f32(w1 >> 8u); sh.w = mix(lampShadow(P, w1 >> 8u), 1.0, fade); }
      }
      // the two strongest lamps on each metre (the second layer at LW * LW), summed
      for (var ly = 0u; ly < 2u; ly++) {
        let i0 = u32(iy * LW + ix) + ly * u32(LW * LW);
        L += (lampCorner(i0, (1.0 - tx) * (1.0 - ty), sh) + lampCorner(i0 + 1u, tx * (1.0 - ty), sh) + lampCorner(i0 + u32(LW), (1.0 - tx) * ty, sh) + lampCorner(i0 + u32(LW) + 1u, tx * ty, sh)) * zk;
      }
    }
  }
  let bi = ifloor(px / DCELL) - i32(u.dbx); let bj = ifloor(py / DCELL) - i32(u.dby);
  if (bi >= 0 && bj >= 0 && bi < DSIDE && bj < DSIDE) {
    let c = u32(bj * DSIDE + bi);
    for (var q = doff[c]; q < doff[c + 1u]; q++) {
      let o = didx[q] * 16u;
      let zf = dl[o + 8u]; let zt = dl[o + 9u];
      if (dl[o] >= 4.0) {
        // a lit panel (DynLights.panel): a sign, a screen, a shop window, a neon tube; its nearest point in 3D,
        // how it faces the point (its wrap: a bare tube lights all round) and how the surface faces it
        let wrap = dl[o] - 4.0; let enx = dl[o + 5u]; let eny = dl[o + 6u];
        var ax = px - dl[o + 1u]; var ay = py - dl[o + 2u];
        if (ax * enx + ay * eny < -0.3 && wrap < 0.9) { continue; }
        let sx = dl[o + 3u] - dl[o + 1u]; let sy = dl[o + 4u] - dl[o + 2u]; let L2 = sx * sx + sy * sy;
        let t = select(0.0, clamp((ax * sx + ay * sy) / L2, 0.0, 1.0), L2 > 1e-4);
        let v = vec3f(ax - sx * t, ay - sy * t, pz - clamp(pz, zf, zt));
        let d2 = dot(v, v); let R = dl[o + 7u];
        if (d2 >= R * R) { continue; }
        let d = sqrt(d2) + 0.05;
        let ce = mix(max(0.0, (v.x * enx + v.y * eny) / d), 1.0, wrap);
        let cr = select(1.0, mix(max(0.0, -dot(nr, v) / d), 1.0, PANEL_RECV_WRAP), dot(nr, nr) > 0.25);
        // (only the part of it within ~d of the point counts: a long tube falls off as 1 / d, a wide panel up close is even)
        let ext = 2.0 * d + 0.3; let S = PANEL_S * clamp(sqrt(L2), 0.3, ext) * clamp(zt - zf, 0.3, ext); let w = 1.0 - d2 / (R * R);
        var lv = 1.0;
        let n = u32(dl[o + 14u]);
        if (n > 0u) {
          let h = (0.3 + 0.5 * sqrt(d2)) * dl[o + 15u]; let cc = t * f32(n);
          let a = max(0.0, cc - h); let b = min(f32(n), cc + h); let lo = u32(dl[o + 13u]);
          lv = (lvSum(lo, n, b) - lvSum(lo, n, a)) / (b - a);
        }
        Lp += vec3f(dl[o + 10u], dl[o + 11u], dl[o + 12u]) * (ce * cr * (S / (d2 + S)) * w * w * lv);
        continue;
      }
      let lz = select((zt - pz) / (zt - zf), 1.0, pz <= zf);
      if (lz <= 0.0) { continue; }
      let kind = u32(dl[o]); let R = dl[o + 7u];
      let dx = px - dl[o + 1u]; let dy = py - dl[o + 2u];
      if (kind == 3u) {
        // a wall floodlight (floodBeam in lights.ts): the beam up the wall, thin out from it, and a little
        // spill round the lamp on the pavement; the wall itself is painted in wallCell with the same cone
        let s = dx * dl[o + 5u] + dy * dl[o + 6u];
        if (s < 0.1 - FLOOD_OUT) { continue; }
        let a = -dx * dl[o + 6u] + dy * dl[o + 5u]; let z = max(pz, 0.0);
        let w = 1.4 + 0.55 * z; let fz = min(1.0, z / 1.5) * pow(max(0.0, 1.0 - z / zf), 1.2);
        let own = clamp((a * a + s * s - 0.06) / 0.1, 0.0, 1.0); // not the fixture's own housing
        let sc = s + FLOOD_OUT * min(1.0, z / 4.0); // the beam leans in to meet the wall
        L += vec3f(dl[o + 10u], dl[o + 11u], dl[o + 12u]) * own * (fz * exp(-(a * a + sc * sc * 4.0) / (w * w)) + 0.3 * exp(-(a * a + s * s) / 0.6) * max(0.0, 1.0 - z));
        continue;
      }
      let d = length(vec2f(dx, dy));
      if (d >= R) { continue; }
      var f = (1.0 - d / R) * (1.0 - d / R);
      if (kind == 1u) {
        let cs = (dx * dl[o + 3u] + dy * dl[o + 4u]) / select(d, 1.0, d == 0.0); let c0 = dl[o + 5u];
        if (cs <= c0) { continue; }
        f *= min(1.0, (cs - c0) / ((1.0 - c0) * 0.5));
        // a car ahead in the beam (dl[6]: how far its back is, dl[15]: its side offset over that) shadows what is behind it,
        // a wedge as wide as a car at its back, widening behind; its back itself stays lit
        let cut = dl[o + 6u];
        if (cut > 0.0) {
          let s = dx * dl[o + 3u] + dy * dl[o + 4u];
          if (s > cut) {
            let a = -dx * dl[o + 4u] + dy * dl[o + 3u]; let w = 1.0 / cut;
            f *= 1.0 - (1.0 - smoothK(0.85 * w, 1.25 * w, abs(a / s - dl[o + 15u]))) * smoothK(cut + 0.1, cut + 0.7, s);
          }
        }
      }
      f *= lz;
      L += vec3f(dl[o + 10u], dl[o + 11u], dl[o + 12u]) * f;
    }
  }
  if (Lp.x + Lp.y + Lp.z > 0.0) { L = pow(pow(max(L, vec3f(0.0)) / 255.0, vec3f(2.2)) + Lp, vec3f(1.0 / 2.2)) * 255.0; }
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
/** Whether a video screen on substation sub's power shows the crash screen now: for half a second before the
 *  power goes (and through its flicker), and for a few seconds after it comes back, as it reboots (timed as power()). */
fn bsod(sub: i32, x: f32, y: f32, id: i32, spread: f32) -> bool {
  let o = u32(sub) * 4u;
  let changed = subs[o];
  if (changed < 0.0) { return false; }
  let since = u.sec - changed; let d = length(vec2f(x - subs[o + 2u], y - subs[o + 3u]));
  let hb = hash3(id, sub, 404); let hw = hash3(id, sub, 407);
  if (subs[o + 1u] < 0.5) {
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

// ---- the rooms of the plans in fx (render/interior.ts: roomLamp, the paints), for roomWalk
const PAINT = array<vec3f, 6>(vec3f(190.0, 170.0, 135.0), vec3f(150.0, 170.0, 160.0), vec3f(175.0, 150.0, 165.0), vec3f(185.0, 185.0, 175.0), vec3f(150.0, 160.0, 185.0), vec3f(195.0, 160.0, 120.0));
const R_LOBBY = 0u; const R_HALL = 1u; const R_STAIR = 2u; const R_LIFT = 3u; const R_KITCHEN = 7u; const R_BATH = 8u; const R_OFFICE = 9u; const R_OPEN = 10u; const R_SHOP = 11u;
/** Cell (i, j) of the plan at o: its room + 1 (0 outside), with the DOOR bit. */
fn planCell(o: u32, i: i32, j: i32) -> u32 {
  let nx = i32(fx[o + 2u]);
  if (i < 0 || j < 0 || i >= nx || j >= i32(fx[o + 3u])) { return 0u; }
  let b = u32(j * nx + i);
  return (fx[o + 6u + fx[o + 4u] * 6u + b / 2u] >> ((b % 2u) * 16u)) & 0xffffu;
}
fn roomAt(o: u32, x: f32, y: f32) -> u32 { return planCell(o, ifloor(x / PCELL) - i32(fx[o]), ifloor(y / PCELL) - i32(fx[o + 1u])) & 255u; }
const LEAF_W = ${LEAF_W}u; const FX_DOORS = ${FX_DOORS}u;
/** Where the door leaves of the plan at o start (after its cells): their count, then LEAF_W words each (world.ts putPlan). */
fn leafBase(o: u32) -> u32 { return o + 6u + fx[o + 4u] * 6u + (fx[o + 2u] * fx[o + 3u] + 1u) / 2u; }
/** Room r's record in the plan at o (its box as four f32, its kind and unit). */
fn roomRec(o: u32, r: i32) -> u32 { return o + 6u + u32(r) * 6u; }
/** The lamp of room r on floor f of box boxId (0..1 per channel, times the power), as roomLamp; "on": the room the viewer stands in. */
fn roomLamp(lot: i32, boxId: i32, ro: u32, r: i32, f: i32, elecIn: f32, on: bool) -> vec3f {
  let kind = fx[ro + 4u]; let commonPart = bitcast<i32>(fx[ro + 5u]) < 0; let h = hash3(boxId, r * 31 + f, 12);
  let lq = u32(lot * ${BLD});
  let backup = i32(bld[lq + 63u]);
  var elec = elecIn;
  if (elec < 0.8 && backup == 3) { elec = 0.85; }
  else if (elec < 0.8) {
    // off the mains: the generator's amber, the emergency lamps (white, a few red), or dark
    if (backup == 0 || (backup == 1 && !commonPart)) { return vec3f(0.0); }
    let gen = backup == 2 && elec > 0.25;
    if (!(commonPart || (gen && (on || h < 0.25)))) { return vec3f(0.0); }
    let c = select(select(vec3f(70.0, 85.0, 110.0), vec3f(190.0, 120.0, 60.0), gen), vec3f(150.0, 22.0, 16.0), commonPart && h < select(0.4, 0.3, gen));
    return c / 255.0 * select(0.6, min(1.0, elec * 1.1), gen);
  }
  let st = i32(bld[lq + 10u]); let office = st == 0 || st == 1;
  // a home's lamps go out by day; an office's stay on through the working day (L.5)
  let onK = select(1.0 - 0.75 * u.day, 1.0 + 0.6 * u.day, office);
  // (a shop's lamps are always on: the same seen from the street and from inside, 13.10d2)
  if (!(commonPart || on || kind == R_SHOP || hash3(boxId, r * 31 + f, 11) < bld[lq + 11u] * onK * 1.3)) { return vec3f(0.0); }
  let c = select(select(vec3f(255.0, 205.0, 140.0), vec3f(222.0, 240.0, 232.0), (office && kind != R_SHOP) || kind == R_STAIR || kind == R_LIFT), vec3f(255.0, 222.0, 165.0), kind == R_LOBBY);
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
  if (kind == R_OFFICE || kind == R_OPEN) { return Px(COL, vec3f(165.0, 165.0, 160.0)); }
  // a shop painted in its own color (a grey one under cool lamps read as a grey slab through the window)
  if (kind == R_SHOP) { return Px(COL, SHOP_PAINT[u32(hash3(unit, 7, 13) * 6.0) % 6u]); }
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
 * objects are (the room's lamps are applied by roomWalk; a glowing part keeps its own color).
 */
struct FHit { t: f32, ch: u32, c: vec3f, glow: bool };
fn furnHit(o: u32, f: i32, rdx: f32, rdy: f32, kz: f32, t0: f32, t1: f32) -> FHit {
  var h = FHit(t1, 0u, vec3f(0.0), false);
  let lb = leafBase(o); let fo = lb + 1u + fx[lb] * LEAF_W;
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
      // (a model in little cubes, the stair, is the viewer's objects' only: seen from outside its storey it is left out)
      if (shape == 3u) { continue; }
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
/** Window openings of a facade style, as wallColumn draws them (windowHole). */
fn windowHole(S: i32, shop: bool, fw: f32, fz: f32, z: f32, ground: bool) -> bool {
  if (ground && shop) { return fw > 0.12 && fw < 0.88 && z > 0.2 && z < 2.6; }
  if (S == 1) { return fw >= 0.07 && fz >= 0.08; }
  if (S == 4) { return fw > 0.25 && fw < 0.75 && fz > 0.3 && fz < 0.78; }
  if (S == 2) { return fw > 0.3 && fw < 0.7 && fz > 0.3 && fz < 0.78; }
  if (S == 3) { return !ground && fw > 0.3 && fw < 0.7 && fz > 0.18 && fz < 0.82; }
  return fw > 0.2 && fw < 0.8 && fz > 0.28 && fz < 0.8;
}

// ---- the inside of a building (13.10b): one walk through a storey's plan for every ray that enters it, from the
// viewer standing in it or from the street through a window or an open street door (render/interior.ts still walks
// the viewer's middle column on the CPU, for the lift's buttons). Everything comes from the plan and the lot, the same
// for every ray: the rooms and their lamps, the doors between rooms and how far each stands open, the lift car, the
// street doors, the furniture. Past PEEK_FULL the walk drops the small things (the door leaves, the EXIT signs, the
// lift's doors, the furniture) and stops at the first room change, as at a shut door. A span of a wall from za to zb
// covers this cell where za < z <= zb (z: the ray's height there), as the CPU's rows.
const IN_LEAVES = ${IN_LEAVES}u;
const PEEK_FULL = 60.0;
const PANEL_W = 0.44; const PANEL_Z0 = 0.85; const PANEL_Z1 = 1.65;
const EXIT_CH = array<u32, 4>(69u, 88u, 73u, 84u);
/** What the walk drew in a cell: state 0 nothing (the city), 1 drawn, 2 a window; the window's glass; where the rain starts. */
struct InC { cl: Cell, state: u32, gt: f32, ga: f32, gl: vec3f, gdoor: bool, gc: f32, gh: f32, gz0: f32, nearT: f32 };
/**
 * A storey as a ray sees it: its plan, lot, box, storey and floor height (the lift car's while it rides); doors shut
 * (riding the lift); the building's power; the room whose lamps are on as if someone had found the switch (the
 * viewer's, or -1); the viewer's block when they stand in it (0 from the street); whether the small things are drawn.
 */
struct RView { o: u32, lot: i32, box: i32, f: i32, z0: f32, shut: bool, elec: f32, here: i32, IB: u32, full: bool };
fn inBlock() -> u32 {
  let OB = fx[1];
  if (OB == 0u || fx[OB + 6u] == 0u) { return 0u; }
  return OB + fx[OB + 6u];
}
/** The viewer's storey (IB their block, world.ts: the IN_ words). */
fn inView(IB: u32) -> RView {
  return RView(fx[IB], i32(fx[IB + 1u]), i32(fx[IB + 2u]), i32(fx[IB + 3u]), fxf(IB + 4u), fx[IB + 5u] == 1u, fxf(IB + 15u), bitcast<i32>(fx[IB + 9u]), IB, true);
}
/** Storey f of box "box" of lot "lot" seen from the street (o its plan); the viewer's room is lit if they stand on it. */
fn outView(o: u32, lot: i32, box: i32, f: i32, elec: f32, full: bool) -> RView {
  var here = -1; let IB = inBlock();
  if (IB != 0u && i32(fx[IB + 1u]) == lot && i32(fx[IB + 3u]) == f) { here = bitcast<i32>(fx[IB + 9u]); }
  return RView(o, lot, box, f, f32(f) * FLOOR_H, false, elec, here, 0u, full);
}
/** The daylight in a room (L.5): strong by the windows, falling off with the distance to the nearest outer wall of
 *  its box (DAYLIGHT_FALL m), and what reaches deep in; whiter than the night's ambient. */
const DAYLIGHT_WIN = 2.2; const DAYLIGHT_DEEP = 0.2; const DAYLIGHT_FALL = 4.0;
fn dayIn(box: i32, x: f32, y: f32) -> f32 {
  let q = u32(box * ${BLD});
  let d = max(0.0, min(min(x - bld[q], bld[q + 2u] - x), min(y - bld[q + 1u], bld[q + 3u] - y)));
  return u.day * (DAYLIGHT_DEEP + DAYLIGHT_WIN * exp(-d / DAYLIGHT_FALL)) * (1.0 - 0.4 * u.cloud);
}
/** The light at a point of room r: its lamps, falling off with the distance to the nearest and along the ray inside (d); the ambient; the daylight. */
fn roomLit(V: RView, ro: u32, r: i32, x: f32, y: f32, d: f32) -> vec3f {
  let lp = roomLamp(V.lot, V.box, ro, r, V.f, V.elec, r == V.here);
  let k = (0.5 + 0.9 / (1.0 + lampD2(ro, x, y) / 5.0)) / (1.0 + d * 0.03); let a = 0.14 * (1.0 - u.day); let dl = dayIn(V.box, x, y);
  return lp * k + vec3f(a, a * 1.05, a * 1.25) + vec3f(dl * 0.92, dl * 0.97, dl);
}
/** The light on the floor's furniture (insideLight), as a multiplier. */
fn insideLight(x: f32, y: f32) -> vec3f {
  let IB = inBlock();
  if (IB == 0u) { return vec3f(0.3); }
  let V = inView(IB); let c = roomAt(V.o, x, y); let r = select(0, i32(c) - 1, c > 0u);
  if (u32(r) >= fx[V.o + 4u]) { return vec3f(0.3); }
  return roomLit(V, roomRec(V.o, r), r, x, y, 0.0);
}
// (not clamped: by the windows the daylight takes a room past 255, and the finish takes it down with its hue kept)
fn roomCell(ch: u32, c: vec3f, t: f32) -> Cell { return Cell(ch, max(c, vec3f(0.0)), vec3f(7.0, 8.0, 12.0), t, KIND_ROOM, 0.0); }
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
/** The lift car's panel (panelPaint) at pu across it and zr up: -2 off it, -1 on it, else the button's floor. The car at fl, n floors, riding to "to". */
fn panelPaint(fl: i32, n: i32, to: i32, pu: f32, zr: f32, cu: f32, cz: f32) -> Pan {
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
/** How far door n of storey f of lot k stands open (radians, world.ts openDoors): shut unless it is on the list. */
fn leafSwing(k: i32, f: i32, n: u32) -> f32 {
  let at = FX_TAB + 4u * fx[0]; let key = (u32(k) * 256u + u32(f)) * 128u + n;
  for (var e = 0u; e < min(fx[at], FX_DOORS); e++) { if (fx[at + 1u + e * 2u] == key) { return fxf(at + 2u + e * 2u); } }
  return 0.0;
}
struct LHit { t: f32, u: f32, k: f32, kind: u32, edge: bool };
/** A leaf's thickness, m: its free edge shows as a strip when the door stands open, seen along it. */
const LEAF_TH = ${f(LEAF_TH)};
/** A door leaf hinged at h, lying along a when shut and swinging toward n by ang, dw wide (negative: a street door's
 *  glass leaf), made of kind (DOOR_* in sim/interior): the hit h made nearer if the ray meets it, or its free edge,
 *  between t0 and h.t. */
fn leafTest(h: LHit, hx: f32, hy: f32, ax: f32, ay: f32, nx: f32, ny: f32, dwr: f32, ang: f32, kind: u32, rdx: f32, rdy: f32, rl: f32, t0: f32) -> LHit {
  let c = cos(ang); let s = sin(ang); let dw = abs(dwr);
  let ex = (ax * c + nx * s) * dw; let ey = (ay * c + ny * s) * dw; let den = rdx * ey - rdy * ex;
  var r = h;
  if (abs(den) > 1e-9) {
    let qx = hx - u.px; let qy = hy - u.py; let t = (qx * ey - qy * ex) / den; let uu = (qx * rdy - qy * rdx) / den;
    if (t > t0 && t < r.t && uu >= 0.0 && uu <= 1.0) { r = LHit(t, uu, 0.7 + 0.3 * abs(-ey * rdx + ex * rdy) / (dw * rl), kind, false); }
  }
  // the free edge: a short segment across the leaf's end, as thick as the leaf
  let px = -ey / dw * LEAF_TH; let py = ex / dw * LEAF_TH;
  let den2 = rdx * py - rdy * px;
  if (abs(den2) > 1e-9) {
    let qx = hx + ex - px * 0.5 - u.px; let qy = hy + ey - py * 0.5 - u.py;
    let t = (qx * py - qy * px) / den2; let uu = (qx * rdy - qy * rdx) / den2;
    if (t > t0 && t < r.t && uu >= 0.0 && uu <= 1.0) { r = LHit(t, 0.5, 0.75, kind, true); }
  }
  return r;
}
/**
 * A street door seen from outside (13.10d): where its two leaves are in fx (seven floats each, as sim/doors.ts
 * doorLeaves makes them, after the lot's door table: world.ts facades), and how far they are turned in; set by
 * wallCell for the walk it starts through the doorway (0: none).
 */
var<private> gSDo: u32 = 0u;
var<private> gSDang: f32 = 0.0;
/** Whether the walk last started from outside went through a street door's glass leaf (its glass seen over the room). */
var<private> gSDglass: bool = false;

/**
 * The walk (z(t) = eye - m t): from the viewer (V.IB != 0, tIn 0) or from where the ray came in at tIn. The viewer's
 * own storey leaves the windows to the city (state 2) and its furniture to the objects; seen from the street, the far
 * outer wall's windows are dark glass and the furniture is met here.
 */
fn roomWalk(V: RView, rdx: f32, rdy: f32, m: f32, tIn: f32) -> InC {
  var res = InC(Cell(32u, vec3f(0.0), vec3f(7.0, 8.0, 12.0), 1e9, KIND_OTHER, 0.0), 0u, 0.0, 0.0, vec3f(0.0), false, 0.0, 0.0, 0.0, 0.0);
  let o = V.o; let inside = V.IB != 0u; let full = V.full;
  let z0 = V.z0; let zc = z0 + CEIL; let ztop = z0 + FLOOR_H; let nRooms = fx[o + 4u];
  // the stairwell's shaft (2026-10-08): over the flights the slab is open, so a ray that is above the ceiling's height
  // there (rising through the opening, or come down it from the storey above, or the viewer's head up the stair) still
  // meets this storey's walls, up to the floor above; one space from storey to storey, not two boxes with a gap
  let zs = u.eye - m * tIn; let tz = select(tIn, (zc - u.eye) / -m, zs <= zc && m < 0.0);
  let shaft = gWR.z > gWR.x && (zs > zc || m < 0.0) && inWellRect(u.px + rdx * tz, u.py + rdy * tz);
  let zw = select(zc, ztop, shaft);
  // the lift car (13.2d, world.ts liftCars): the floor it shows, where it rides to, how many floors; whether it stands
  // on this storey (its doors open; always, for the viewer riding it), whether it was called here
  let carW = fx[FX_TAB + 3u * fx[0] + u32(V.lot)];
  let carFl = i32(carW & 255u); let carTo = i32((carW >> 9u) & 255u) - 1; let carN = i32((carW >> 17u) & 255u);
  let carHereF = (inside && V.shut) || ((carW & 256u) != 0u && carFl == V.f); let carCalled = carTo == V.f;
  // (riding it, the viewer's own pick lights its button)
  let panelTo = select(carTo, bitcast<i32>(fx[V.IB + 7u]), inside && V.shut);
  let q = u32(V.box * ${BLD}); let lq = u32(V.lot * ${BLD});
  let st = i32(bld[lq + 10u]); let shop = bld[lq + 19u] > 0.5; let office = st == 0 || st == 1;
  let rl = sqrt(rdx * rdx + rdy * rdy);
  res.gz0 = f32(V.f) * FLOOR_H;
  // where the ray leaves the box (and the cut): that outer wall closes the column
  var tExit = 1e9; var face = 0;
  if (rdx > 0.0) { let t = (bld[q + 2u] - u.px) / rdx; if (t < tExit) { tExit = t; face = 1; } } else if (rdx < 0.0) { let t = (bld[q] - u.px) / rdx; if (t < tExit) { tExit = t; face = 0; } }
  if (rdy > 0.0) { let t = (bld[q + 3u] - u.py) / rdy; if (t < tExit) { tExit = t; face = 3; } } else if (rdy < 0.0) { let t = (bld[q + 1u] - u.py) / rdy; if (t < tExit) { tExit = t; face = 2; } }
  let knx = bld[q + 7u]; let kny = bld[q + 8u];
  if (bld[q + 6u] > 0.5) { let dn = knx * rdx + kny * rdy; if (dn > 0.0) { let t = (bld[q + 9u] - knx * u.px - kny * u.py) / dn; if (t < tExit) { tExit = t; face = 4; } } }
  tExit = max(tExit, tIn + 0.02);
  // the nearest door leaf the ray meets (the plan's, swung as far as each is open; the viewer's street doors' glass ones)
  var lh = LHit(1e9, 0.0, 1.0, 0u, false);
  if (full) {
    let t0 = max(0.05, tIn); let lb = leafBase(o);
    for (var n = 0u; n < fx[lb]; n++) {
      let w = lb + 1u + n * LEAF_W;
      lh = leafTest(lh, fxf(w), fxf(w + 1u), fxf(w + 2u), fxf(w + 3u), fxf(w + 4u), fxf(w + 5u), fxf(w + 6u), leafSwing(V.lot, V.f, n), u32(fxf(w + 7u)), rdx, rdy, rl, t0);
    }
    if (inside) {
      for (var n = 0u; n < fx[V.IB + 8u]; n++) {
        let w = V.IB + IN_LEAVES + n * 8u;
        lh = leafTest(lh, fxf(w), fxf(w + 1u), fxf(w + 2u), fxf(w + 3u), fxf(w + 4u), fxf(w + 5u), fxf(w + 6u), fxf(w + 7u), 0u, rdx, rdy, rl, t0);
      }
    } else if (gSDo != 0u) {
      // the street door the ray came in by, seen from outside: the same two glass leaves as from inside
      for (var n = 0u; n < 2u; n++) {
        let w = gSDo + n * 7u;
        lh = leafTest(lh, fxf(w), fxf(w + 1u), fxf(w + 2u), fxf(w + 3u), fxf(w + 4u), fxf(w + 5u), -fxf(w + 6u), gSDang, 0u, rdx, rdy, rl, t0);
      }
    }
  }
  var lt = lh.t; let lu = lh.u; let lk = lh.k; let lg = lh.kind == 0u; let lkind = lh.kind; let ledge = lh.edge;
  // walk the plan's cells from where the ray is in it; a change of room is a wall, unless both cells are a doorway
  let gx = i32(fx[o]); let gy = i32(fx[o + 1u]);
  let s0 = tIn + select(0.0, 0.03 / rl, tIn > 0.0);
  var i = ifloor((u.px + rdx * s0) / PCELL) - gx; var j = ifloor((u.py + rdy * s0) / PCELL) - gy;
  let stX = select(1, -1, rdx < 0.0); let stY = select(1, -1, rdy < 0.0);
  let dX = select(1e12, abs(PCELL / rdx), rdx != 0.0); let dY = select(1e12, abs(PCELL / rdy), rdy != 0.0);
  var tX = 1e12; if (rdx != 0.0) { tX = (f32(gx + i + select(0, 1, rdx > 0.0)) * PCELL - u.px) / rdx; }
  var tY = 1e12; if (rdy != 0.0) { tY = (f32(gy + j + select(0, 1, rdy > 0.0)) * PCELL - u.py) / rdy; }
  var cur = planCell(o, i, j); var wall = false; var done = false; var leafGlass = false;
  if (!inside && cur == 0u) { return res; }
  for (var g = 0; g < 400; g++) {
    let xs = tX < tY; let tn = select(tY, tX, xs);
    if (lt < min(tn, tExit)) {
      let z = u.eye - m * lt;
      if (ledge && z > z0 && z <= z0 + DOOR_H - 0.02) {
        // the leaf's free edge, seen along it as it stands open: its frame, or the wood's end grain
        let hx = u.px + rdx * lt; let hy = u.py + rdy * lt; let rr = max(0, i32(roomAt(o, hx, hy)) - 1);
        let Lt = roomLit(V, roomRec(o, rr), rr, hx, hy, lt - tIn);
        let ec = select(select(select(vec3f(150.0, 108.0, 70.0), vec3f(95.0, 98.0, 105.0), lkind == 0u), vec3f(120.0, 126.0, 132.0), lkind == 2u), vec3f(140.0, 144.0, 150.0), lkind == 3u);
        res.cl = roomCell(BAR, ec * Lt * lk, lt); res.state = 1u; done = true; break;
      } else if (lg && z > z0 && z <= z0 + DOOR_H - 0.02) {
        // a street door's leaf: a metal frame and a push bar round the glass, which the ray goes on through
        let zz = z - z0;
        let frame = lu > 0.93 || lu < 0.05 || zz > DOOR_H - 0.12 || zz < 0.1;
        let bar = zz > 0.95 && zz < 1.08 && lu > 0.12 && lu < 0.85;
        if (frame || bar) {
          let hx = u.px + rdx * lt; let hy = u.py + rdy * lt; let rr = max(0, i32(roomAt(o, hx, hy)) - 1);
          let Lt = roomLit(V, roomRec(o, rr), rr, hx, hy, lt - tIn);
          res.cl = roomCell(select(EQ, BAR, frame), select(vec3f(95.0, 98.0, 105.0), vec3f(190.0, 190.0, 195.0), bar) * Lt * lk, lt); res.state = 1u; done = true; break;
        }
        leafGlass = true; gSDglass = true;
      } else if (lkind == 2u && z > z0 && z <= z0 + DOOR_H - 0.02) {
        // a steel door (a stockroom's): a plain sheet in a darker edge, a kick plate, the bar across it
        let hx = u.px + rdx * lt; let hy = u.py + rdy * lt; let rr = max(0, i32(roomAt(o, hx, hy)) - 1);
        let Lt = roomLit(V, roomRec(o, rr), rr, hx, hy, lt - tIn); let zz = z - z0;
        let edge = lu < 0.04 || lu > 0.96 || zz > DOOR_H - 0.07;
        let kick = zz < 0.28; let bar = zz > 0.95 && zz < 1.06 && lu > 0.1 && lu < 0.88;
        let col = vec3f(112.0, 120.0, 126.0) * lk * select(select(select(1.0, 0.8, kick), 1.45, bar), 0.7, edge);
        res.cl = roomCell(select(select(select(HASH, EQ, kick), BAR, bar), BAR, edge), col * Lt, lt);
        res.state = 1u; done = true; break;
      } else if (z > z0 && z <= z0 + DOOR_H - 0.02) {
        // a panel door (wood in a home, a painted panel in an office): its edges, two recessed panels, the knob
        let hx = u.px + rdx * lt; let hy = u.py + rdy * lt; let rr = max(0, i32(roomAt(o, hx, hy)) - 1);
        let Lt = roomLit(V, roomRec(o, rr), rr, hx, hy, lt - tIn); let zz = z - z0;
        let edge = lu < 0.06 || lu > 0.94 || zz > DOOR_H - 0.1 || zz < 0.06;
        let knob = lu > 0.82 && lu < 0.9 && zz > 0.92 && zz < 1.06;
        let panel = !edge && lu > 0.16 && lu < 0.84 && ((zz > 0.25 && zz < 0.85) || (zz > 1.2 && zz < DOOR_H - 0.3));
        let col = select(vec3f(118.0, 78.0, 46.0), vec3f(118.0, 122.0, 130.0), lkind == 3u) * lk * select(select(1.0, 1.1, panel), 0.8, edge);
        if (knob) { res.cl = roomCell(O, vec3f(210.0, 175.0, 90.0) * Lt, lt); } else { res.cl = roomCell(select(select(EQ, COL, panel), BAR, edge), col * Lt, lt); }
        res.state = 1u; done = true; break;
      }
      lt = 1e9;
    }
    if (tn >= tExit) { break; }
    if (xs) { i += stX; tX += dX; } else { j += stY; tY += dY; }
    let nv = planCell(o, i, j);
    if (nv == 0u) { continue; }
    if (cur == 0u) { cur = nv; continue; }
    // the walls have a body (13.10a): a band of WALL cells on one side of where two rooms meet, and along the outer
    // walls. Stepping into the band is meeting the wall (and what is beyond it: met, the cells either side of the wall
    // ci, cj and wi, wj); the outer walls' band is gone through to the facade, where the windows are
    var met = nv; var ci = i; var cj = j; var wi = select(i, i - stX, xs); var wj = select(j - stY, j, xs); var band = false;
    if ((nv & PWALL) != 0u && (cur & PWALL) == 0u && (nv & 255u) == (cur & 255u)) {
      let bi = select(i, i + stX, xs); let bj = select(j + stY, j, xs); let nb = planCell(o, bi, bj);
      if (nb == 0u) { cur = nv; continue; }
      band = true; met = select(cur, nb, (nb & 255u) != (cur & 255u)); ci = bi; cj = bj; wi = i; wj = j;
    }
    if ((met & 255u) != (cur & 255u) || band) {
      let r = i32(cur & 255u) - 1; let ro = roomRec(o, r); let kind = fx[ro + 4u]; let unit = bitcast<i32>(fx[ro + 5u]);
      let hx = u.px + rdx * tn; let hy = u.py + rdy * tn; let uu = select(hx, hy, xs); let shade = select(0.82, 1.0, xs);
      let z = u.eye - m * tn;
      let nk = fx[roomRec(o, i32(met & 255u) - 1) + 4u];
      // the lift's doorway is shut on this floor while its car is elsewhere
      let liftShut = !carHereF && (nk == R_LIFT || kind == R_LIFT);
      if (!band && (cur & nv & PDOOR) != 0u && !V.shut && !liftShut && full) {
        // a doorway: the lintel above it, and on through; over the way out to the lobby (or the stairs), a green EXIT sign
        if (z > z0 + DOOR_H && z <= zc) {
          let k2 = fx[roomRec(o, i32(nv & 255u) - 1) + 4u];
          let toExit = k2 == R_STAIR || (k2 == R_LOBBY && kind != R_LOBBY);
          let zz = z - z0;
          if (toExit && zz > DOOR_H + 0.06 && zz < DOOR_H + 0.32) {
            // the doorway's extent along the wall: the run of door cells on both sides
            var a = 0; var b = 0;
            loop { if (a <= -8 || !doorBoth(o, xs, wi, wj, i, j, a - 1)) { break; } a--; }
            loop { if (b >= 8 || !doorBoth(o, xs, wi, wj, i, j, b + 1)) { break; } b++; }
            let base = select(f32(gx + i), f32(gy + j), xs) * PCELL;
            let sA = base + f32(a) * PCELL; let sB = base + f32(b + 1) * PCELL;
            let ww = (uu - sA) / (sB - sA); let mm = 0.5 - 0.3 / (sB - sA);
            if (ww > 0.5 - mm && ww < 0.5 + mm) {
              let rd = select(toRight(1.0, 0.0, rdx, rdy), toRight(0.0, 1.0, rdx, rdy), xs);
              let du = u.colW * tn / max(1e-6, abs(select(rdy, rdx, xs))) / ((sB - sA) * 2.0 * mm);
              let ep = exitPx(select((0.5 + mm - ww) / (2.0 * mm), (ww - 0.5 + mm) / (2.0 * mm), rd), (DOOR_H + 0.32 - zz) / 0.26, du, tn / u.scale / 0.26);
              res.cl = roomCell(ep.ch, ep.c, tn); res.state = 1u; done = true; break;
            }
          }
          let k = select(1.0, 1.3, z < z0 + DOOR_H + 0.08);
          res.cl = roomCell(EQ, vec3f(120.0, 95.0, 70.0) * roomLit(V, ro, r, hx, hy, tn - tIn) * k, tn); res.state = 1u; done = true; break;
        }
      } else {
        if (full && z > z0 && z <= zc && nk == R_LIFT && kind != R_LIFT) {
          // the hall side of the lift (13.2d): its steel doors, the floor display over them, the call button beside
          let zz = z - z0; let rlt = roomLit(V, ro, r, hx, hy, tn - tIn);
          var off = 0; var found = doorBoth(o, xs, wi, wj, ci, cj, 0);
          for (var q2 = 1; q2 <= 3 && !found; q2++) {
            if (doorBoth(o, xs, wi, wj, ci, cj, q2)) { off = q2; found = true; } else if (doorBoth(o, xs, wi, wj, ci, cj, -q2)) { off = -q2; found = true; }
          }
          if (found) {
            var a = 0; var b = 0;
            loop { if (a <= -8 || !doorBoth(o, xs, wi, wj, ci, cj, off + a - 1)) { break; } a--; }
            loop { if (b >= 8 || !doorBoth(o, xs, wi, wj, ci, cj, off + b + 1)) { break; } b++; }
            let base = select(f32(gx + i), f32(gy + j), xs) * PCELL;
            let sA = base + f32(off + a) * PCELL; let sB = base + f32(off + b + 1) * PCELL; let sm = (sA + sB) * 0.5;
            let cw = u.colW * tn / max(1e-6, abs(select(rdy, rdx, xs)));
            let rd = select(toRight(1.0, 0.0, rdx, rdy), toRight(0.0, 1.0, rdx, rdy), xs);
            if (uu > sA && uu < sB && zz < DOOR_H) {
              // two steel leaves meeting in the middle, a dark frame round them
              let seam = abs(uu - sm) < 0.03; let edge = uu - sA < 0.06 || sB - uu < 0.06 || zz > DOOR_H - 0.06;
              res.cl = roomCell(select(select(BAR, COL, !seam), EQ, edge), select(select(vec3f(150.0, 156.0, 165.0), vec3f(60.0, 62.0, 68.0), seam), vec3f(80.0, 82.0, 90.0), edge) * rlt * shade, tn); res.state = 1u; done = true; break;
            }
            if (abs(uu - sm) < 0.17 && zz > DOOR_H + 0.06 && zz < DOOR_H + 0.36) {
              // the floor display: amber lamp digits on black
              let pu0 = (uu - (sm - 0.17)) / 0.34; let pu = select(1.0 - pu0, pu0, rd);
              let gd = digitLamps(carFl, max(2, ndig(carFl)), 0.08, 0.92, DOOR_H + 0.34, DOOR_H + 0.08, pu, zz, cw / 0.34, tn / u.scale);
              if (gd != 0u) { res.cl = roomCell(gd, vec3f(255.0, 140.0, 40.0), tn); } else { res.cl = roomCell(DOT, vec3f(40.0, 18.0, 8.0), tn); }
              res.state = 1u; done = true; break;
            }
            let bu = uu - sB;
            if (bu > 0.12 && bu < 0.3 && zz > 1.0 && zz < 1.3) {
              // the call button on its plate: lit amber once the car is called
              let btn = abs(bu - 0.21) < 0.045 && abs(zz - 1.15) < 0.05;
              res.cl = roomCell(select(EQ, O, btn), select(vec3f(120.0, 124.0, 132.0), select(vec3f(90.0, 92.0, 98.0), vec3f(255.0, 160.0, 50.0), carCalled), btn) * select(rlt, vec3f(1.0), btn && carCalled), tn); res.state = 1u; done = true; break;
            }
          }
        }
        if (z > z0 && z <= zw) {
          // the wall; on the lift car's long wall at the low coordinate, its panel
          var pw = -1.0;
          if (full && kind == R_LIFT && carN > 0) {
            let x0 = fxf(ro); let y0 = fxf(ro + 1u); let x1 = fxf(ro + 2u); let y1 = fxf(ro + 3u); let longX = x1 - x0 >= y1 - y0;
            if (longX && !xs && abs(hy - y0) < 0.05) { pw = (hx - ((x0 + x1) / 2.0 - PANEL_W / 2.0)) / PANEL_W; }
            else if (!longX && xs && abs(hx - x0) < 0.05) { pw = ((y0 + y1) / 2.0 + PANEL_W / 2.0 - hy) / PANEL_W; }
          }
          var p = Px(0u, vec3f(0.0)); var b = -2;
          if (pw >= 0.0 && pw <= 1.0) { let pp = panelPaint(carFl, carN, panelTo, pw, z - z0, u.colW * tn / max(1e-6, abs(select(rdy, rdx, xs))) / PANEL_W, tn / u.scale); b = pp.b; p = pp.p; }
          if (b == -2) { p = wallPx(kind, unit, zrOf(z, z0), uu); }
          res.cl = roomCell(p.ch, p.c * roomLit(V, ro, r, hx, hy, tn - tIn) * shade, tn); res.state = 1u; done = true; break;
        }
        wall = true; break;
      }
    }
    cur = nv;
  }
  if (!done && wall) { res.nearT = 1e9; }
  else if (!done && nRooms > 0u) {
    // the outer wall: windows on the facade's grid, the street doors (the lot's, as the facade has them) on the ground floor
    let r0 = select(0, i32(cur & 255u) - 1, cur != 0u); let ro = roomRec(o, r0); let kind = fx[ro + 4u]; let unit = bitcast<i32>(fx[ro + 5u]);
    let t = tExit; let hx = u.px + rdx * t; let hy = u.py + rdy * t;
    let along = select(select(hx * kny - hy * knx, hx, face < 4), hy, face < 2);
    let corner = along - bld[q + 36u + u32(face) * 2u] < 0.35 || bld[q + 37u + u32(face) * 2u] - along < 0.35;
    let bay = along / BAY; let fw = bay - floor(bay); let ground = V.f == 0;
    var isDoor = false; var du = 0.0; var doorW = 1.0;
    let fo = fx[FX_TAB + u32(V.lot)];
    if (ground && fo > 0u) {
      for (var e = 0u; e < fx[fo]; e++) {
        let w = fo + 1u + e * 3u; let kf = fx[w]; let a0 = fxf(w + 1u); let a1 = fxf(w + 2u);
        if ((kf & 15u) == 0u && i32((kf >> 4u) & 15u) == face && along > a0 && along < a1) { isDoor = true; du = (along - a0) / (a1 - a0); doorW = a1 - a0; }
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
    if (inside) {
      let gk = fx[V.IB + 10u];
      if (kind == R_LIFT && gk != 0u) { let gu = select(hy, hx, gk == 1u); let gv = select(hx, hy, gk == 1u); liftGlass = gu > fxf(V.IB + 11u) && gu < fxf(V.IB + 12u) && gv > fxf(V.IB + 13u) && gv < fxf(V.IB + 14u); }
    }
    let shade = select(select(0.82, 1.0, face < 2), 0.9, face == 4);
    let Lt = roomLit(V, ro, r0, hx, hy, t - tIn);
    res.nearT = t; res.gt = t; res.ga = along; res.gl = Lt; res.gc = abs(nX * rdx + nY * rdy) / rl; res.gh = atan2(rdy, rdx);
    // seen from the street, the far side's glass: dark, with the night city's glow (or the day) beyond it
    let farGlass = vec3f(20.0, 24.0, 40.0) + vec3f(90.0, 100.0, 115.0) * u.day;
    let z = u.eye - m * t;
    if (z > z0 && z <= zw) {
      let fz = z / FLOOR_H - floor(z / FLOOR_H);
      done = true; res.state = 1u;
      if (isDoor) {
        // the street door from inside: a metal frame, the middle stile, a push bar and the top rail around
        // its two glass leaves; over it the green EXIT sign
        let zz = z - z0;
        if (zz > DOOR_H + 0.06 && zz < DOOR_H + 0.34 && du > 0.25 && du < 0.75) {
          let ep = exitPx(select((0.75 - du) * 2.0, (du - 0.25) * 2.0, rdF), (DOOR_H + 0.34 - zz) / 0.28, colA / (doorW * 0.5), t / u.scale / 0.28);
          res.cl = roomCell(ep.ch, ep.c, t);
        } else if (zz < DOOR_H) {
          // the jambs and the head: the leaves (drawn above, as they swing) carry the stiles and the push bars
          let frame = du < 0.04 || du > 0.96 || zz > DOOR_H - 0.06;
          if (frame) { res.cl = roomCell(BAR, vec3f(95.0, 98.0, 105.0) * Lt, t); }
          // (an open doorway with no leaf in the way has no glass: gdoor)
          else if (inside || gThru) { res.state = 2u; res.gdoor = !leafGlass; }
          else { res.cl = roomCell(EQ, farGlass, t); gBack = t; }
        } else {
          // above the door and its sign: wall, never a window
          let p = wallPx(kind, unit, zrOf(z, z0), along);
          res.cl = roomCell(p.ch, p.c * Lt * shade, t);
        }
      } else if ((liftGlass && z > z0 + 0.12 && z < zc - 0.08) || (!corner && !blind && !liftGlass && windowHole(st, shop, fw, fz, z - z0, ground))) {
        if (inside || gThru) { res.state = 2u; } else { res.cl = roomCell(EQ, farGlass, t); gBack = t; }
      } else {
        let zr = zrOf(z, z0);
        // the sill: just under a window
        if (!corner && !blind && zr < 1.5 && windowHole(st, shop, fw, fz + 0.1 / FLOOR_H, zr + 0.1, ground)) { res.cl = roomCell(EQ, vec3f(150.0, 140.0, 125.0) * Lt, t); }
        else { let p = wallPx(kind, unit, zr, along); res.cl = roomCell(p.ch, p.c * Lt * shade, t); }
      }
    }
  }
  if (!done) {
    // floor and ceiling in what is left: each row meets them at its own distance
    let below = m > 0.0;
    var t = select(select((zc - u.eye) / -m, (ztop - u.eye) / -m, shaft && inside), (u.eye - z0) / m, below);
    if (!(t > tIn) || t > 200.0) { return res; }
    var wx = u.px + rdx * t; var wy = u.py + rdy * t;
    // (step 4 of the interiors' rework) the viewer's stairwell: over the flights the ceiling is open to the storey above
    // (met where that storey's floor is), and the floor to the one below; the main walk goes on there (gWell). A
    // storey seen through it shows its own floor and ceiling there (one walk on at most)
    if (inside && ((shaft && !below) || (below && inWellRect(wx, wy)))) {
      let to = fx[V.IB + select(16u, 17u, below)];
      if (to != 0u) { gWell = select(1, -1, below); gWellT = t; gWellO = to; return res; }
      if (!below) { t = (zc - u.eye) / -m; if (!(t > tIn)) { return res; } wx = u.px + rdx * t; wy = u.py + rdy * t; }
    }
    var c = planCell(o, ifloor(wx / PCELL) - gx, ifloor(wy / PCELL) - gy);
    if (c == 0u) { c = select(1u, cur, cur != 0u); }
    let r = i32(c & 255u) - 1;
    if (r < 0 || u32(r) >= nRooms) { return res; }
    let ro = roomRec(o, r); let kind = fx[ro + 4u];
    var p = Px(0u, vec3f(0.0));
    if (below) { p = floorPx(kind, office, wx, wy); } else { let lp = roomLamp(V.lot, V.box, ro, r, V.f, V.elec, r == V.here); p = ceilPx(ro, kind, office, lp.x + lp.y > 0.05, wx, wy); }
    res.cl = roomCell(p.ch, p.c * roomLit(V, ro, r, wx, wy, t - tIn), t); res.state = 1u;
  }
  // seen from the street, the furniture in front of what the walk met (the viewer's own storey has it as objects)
  if (!inside && full && res.state == 1u) {
    let F = furnHit(o, V.f, rdx, rdy, -m, tIn, res.cl.depth);
    if (F.t < res.cl.depth) {
      let x = u.px + rdx * F.t; let y = u.py + rdy * F.t; let cc = roomAt(o, x, y); let r = select(0, i32(cc) - 1, cc > 0u);
      if (u32(r) < nRooms) {
        let ro = roomRec(o, r); let lp = roomLamp(V.lot, V.box, ro, r, V.f, V.elec, r == V.here);
        // a lamp keeps its own color: lit when the room is
        let lc = select(F.c * roomLit(V, ro, r, x, y, F.t - tIn), F.c * select(0.25, 1.0, lp.x + lp.y > 0.05), F.glow);
        res.cl = roomCell(F.ch, lc, F.t); gBack = 0.0; if (F.glow) { gPeekEm = lc; }
      }
    }
  }
  return res;
}
/**
 * One window cell's view of storey f of the box behind it (o its plan, entered at distance t): the walk from the
 * glass, under a faint cold tint (the reflection itself is the finish's, R.24); through an open doorway (pane false)
 * as it is, the same as from inside.
 */
fn peekRoom(o: u32, lot: i32, box: i32, f: i32, rdx: f32, rdy: f32, m: f32, t: f32, elec: f32, full: bool, pane: bool) -> Px {
  gBack = 0.0; gPeekEm = vec3f(0.0);
  let R = roomWalk(outView(o, lot, box, f, elec, full), rdx, rdy, m, t);
  if (R.state == 1u) { gPeekT = R.cl.depth; }
  if (R.state != 1u) { gBack = 0.0; return Px(EQ, vec3f(20.0, 24.0, 40.0)); }
  if (!pane) { return Px(R.cl.ch, R.cl.c); }
  let gk = 0.62 - 0.2 * u.day;
  return Px(R.cl.ch, R.cl.c * gk + vec3f(8.0, 12.0, 18.0));
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
  if (u.rain > 0.0) {
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
  let hx = gOX + t * rdx; let hy = gOY + t * rdy;
  let style = i32(bld[q + 10u]); let lit = bld[q + 11u]; let feat = bld[q + 18u];
  let shop = bld[q + 19u] > 0.5;
  let win = colAt(q + 12u); let frame = colAt(q + 15u); let sign = colAt(q + 21u);
  // where along the face, its light, the face's span
  var along = 0.0; var lightK = 1.0; var face = 0; var dn = 1.0; var wsun = 0.0; var nw = vec2f(0.0);
  if (side == 2) {
    let rr = (x1 - x0) * 0.5; let nx = (hx - x0 - rr) / rr; let ny = (hy - y0 - rr) / rr;
    along = (atan2(ny, nx) + 3.14159265) * rr; lightK = 0.72 + 0.28 * abs(nx);
    wsun = nx * u.sunX + ny * u.sunY; nw = normalize(vec2f(nx, ny));
  } else if (side == 3) {
    let kx = bld[q + 7u]; let ky = bld[q + 8u];
    along = hx * ky - hy * kx; lightK = 0.72 + 0.28 * abs(kx); face = 4; dn = kx * rdx + ky * rdy;
    wsun = kx * u.sunX + ky * u.sunY; nw = vec2f(kx, ky);
  } else {
    along = select(hx, hy, side == 0); lightK = select(0.72, 1.0, side == 0);
    if (side == 0) { face = select(0, 1, rdx < 0.0); dn = rdx; nw = vec2f(select(1.0, -1.0, rdx > 0.0), 0.0); } else { face = select(3, 2, rdy > 0.0); dn = rdy; nw = vec2f(0.0, select(1.0, -1.0, rdy > 0.0)); }
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
  // the facade's detail is the building's, not the cell's: it comes in by the distance to the nearest point of
  // its footprint, faded with a dither over a band, so a tower never shows a diagonal cut between the two looks
  // (a long wall's far end still drops to the far look: its cells would be smaller than a glyph)
  let tCut = min(FLOOR_H * u.scale / 2.2, BAY / (u.colW * 1.5));
  let tRef = length(vec2f(max(max(x0 - gOX, gOX - x1), 0.0), max(max(y0 - gOY, gOY - y1), 0.0)));
  // (a tall tower's top, far from the eye though its foot is near, fades out over a band too: never a cut)
  let detK = (1.0 - smoothstep(0.7 * tCut, DET_FADE * tCut, tRef)) * (1.0 - smoothstep(2.4 * tCut, 3.2 * tCut, t));
  // the same for the rooms seen through the windows: the building's, not the cell's, so no cut runs across a tower
  let peekK = (1.0 - smoothstep(0.7 * PEEK_FAR, 1.3 * PEEK_FAR, tRef)) * (1.0 - smoothstep(1.8 * PEEK_FAR, 2.5 * PEEK_FAR, t));
  let detailed = t < tCut * 3.2 && detK > hash3(i32(floor(along * 4.0)), i32(floor(zw * 2.0)), bk + 913);
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
      let rT = t - sb + sb * bl; let zr = gOZ - m * rT + A * rT * rT;
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
  var dA0 = 0.0; var dA1 = -1.0; var esc = false; var dOp = 0.0; var dSh = 0.0; var dHasSh = false; var dLf = 0u;
  let fo = fx[FX_TAB + u32(bk)];
  if (fo > 0u) {
    for (var e = 0u; e < fx[fo]; e++) {
      let w = fo + 1u + e * 3u; let kf = fx[w]; let a0 = bitcast<f32>(fx[w + 1u]); let a1 = bitcast<f32>(fx[w + 2u]);
      if (i32((kf >> 4u) & 15u) != face || side == 2) { continue; }
      // a street door's word has how open it is in bits 8..15 (13.2c)
      // (and a shop's own door has a steel shutter, bit 24, rolled down as far as bits 16..23 say: 13.10d)
      if ((kf & 15u) == 0u) { if (along0 > a0 && along0 < a1) { dA0 = a0; dA1 = a1; dLf = fo + 1u + fx[fo] * 3u + e * 14u; dOp = f32((kf >> 8u) & 255u) / 255.0; dSh = f32((kf >> 16u) & 255u) / 255.0; dHasSh = (kf & (1u << 24u)) != 0u; } }
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
  let sheen = 0.5 + 0.5 * sin(tang * 6.0 + ((z - gOZ) / t) * 4.0 + f32(bk % 7));
  let fl = ifloor(z / FLOOR_H); let fz = z / FLOOR_H - f32(fl);
  let escU = (f32(wi % 7) - 2.0 + fw) / 2.0;
  // the room behind the wall here, near enough to make out: this floor's plan (the ground floor's or the
  // upper floors' of this box), entered where the ray met the wall
  var po = 0u; var pkR = -1; var lot = -1;
  if (detailed && t < PEEK_FAR * 2.5 && peekK > 0.0 && !gRefl && side != 2 && fl >= 0 && f32(fl) < floor((H - 1.0) / FLOOR_H + 0.5)) {
    po = fx[FX_TAB + fx[0] + u32(bk) * 2u + select(1u, 0u, fl == 0)];
    // (the room just inside, where there is one)
    if (po > 0u) { lot = i32(fx[po + 5u]); let e = 0.03 / length(vec2f(rdx, rdy)); pkR = i32(roomAt(po, hx + rdx * e, hy + rdy * e)) - 1; }
  }
  let winPw = select(winLight, power(sub, cx, cy, winGroup(bk, wi, fl), gen, bk, 0.5) * winLight, switched);
  var isWin = false; var glass = false; var backT = 0.0;
  let escCell = esc && z > FLOOR_H && (fz < 0.08 || escU < 0.04 || escU > 0.96 || abs(select(escU, 1.0 - escU, (fl & 1) == 1) - fz) < 0.1);
  var ch = 0u; var c = vec3f(0.0); var em = false; var il = vec3f(0.0); var glowK = 1.0; var emK = 1.0;
  var body = false; var bodyEm = vec3f(-1.0); var winGlow = vec3f(0.0);
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
  if (hh < litK) { wp = select(winLight, power(sub, cx, cy, winGroup(bk, wi, fl), gen, bk, 0.5) * winLight, switched); }
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
    // (switched off, a dark board lit by what is round it: emitting, its dark panel glowed brighter than the dead bulbs)
    em = adElec > 0.02; emK = SIGN_EMIT; glowK = SIGN_GLOW;
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
      else if (bulbOn(cc, ifloor(px), ifloor(pz))) { ch = 32u; c = hue * (on * 0.8); }
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
      em = adElec > 0.02; emK = SIGN_EMIT; glowK = SIGN_GLOW;
      let n = i32(u.tickN); let p = select(along, -along, rev) + sec * TICK_SPEED; let li = ifloor(p / TICK_LW); let fu = p / TICK_LW - f32(li);
      var lc = 32u; if (n > 0) { lc = sg[sg[0] + u32(((li % n) + n) % n)]; }
      let lh = TICK_Z1 - TICK_Z0; let on = adElec;
      if (TICK_LW / dAlong >= BULB_COLS && lh / dz >= BULB_ROWS) {
        // up close, bulbs (0.14 m apart), counted per cell like the shop signs'
        let bz = (lh - 0.2) / 7.0; let hx = dAlong / 0.28; let hz = dz / bz / 2.0;
        let nb = bulbsIn(lc, (fu * TICK_LW - 0.08) / 0.14, (TICK_Z1 - 0.1 - z) / bz, hx, hz);
        // unlit, the bulbs are the housing's color (else the dark letters show on it, inverted)
        if (nb > 0u && on > 0.05) { ch = bulbGlyph(nb, hx, hz); c = mix(vec3f(34.0, 20.0, 12.0), vec3f(255.0, 150.0, 45.0), on); } else { ch = DOT; c = vec3f(34.0, 20.0, 12.0); }
      } else if (TICK_LW / dAlong >= 0.9) {
        let center = abs(fu - 0.45) * TICK_LW < dAlong / 2.0 && abs(z - (TICK_Z0 + TICK_Z1) / 2.0) < dz / 2.0 + 0.01;
        ch = select(32u, lc, center && on > 0.05); c = vec3f(255.0, 150.0, 45.0) * select(0.12 * on, on, center);
      } else { ch = EQ; c = vec3f(160.0, 95.0, 30.0) * on; }
    }
  } else if (scZ1 > scZ0 && along > scA0 && along < scA1 && z > scZ0 && z < scZ1) {
    // a video screen behind a dark bezel
    if (along - scA0 < 0.25 || scA1 - along < 0.25 || z - scZ0 < 0.25 || scZ1 - z < 0.25) { ch = HASH; c = frame * 0.45 * shade; }
    else {
      let su = select(along - scA0, scA1 - along, rev);
      var P = screenPix(bk, su, scZ1 - z, scA1 - scA0, scZ1 - scZ0, dAlong, dz);
      if (bsod(sub, cx, cy, bk, 0.25)) { P = bsodPix(bk, su, scZ1 - z, scA1 - scA0, scZ1 - scZ0, dAlong, dz); }
      ch = P.ch; c = P.c * adElec; em = true; emK = SCREEN_EMIT * (1.0 + SCREEN_DAY_EMIT * u.day);
    }
  } else if (dA1 > dA0 && z < DOOR_H + 0.35) {
    // the street door: a frame, two glass leaves and a transom, lit from the lobby
    let e = min(along - dA0, dA1 - along);
    let shTop = DOOR_H + 0.22; let shBot = shTop - dSh * shTop;
    if (dHasSh && z > shTop) {
      // a shop's shutter box over the door
      ch = select(EQ, BAR, z > DOOR_H + 0.31); c = vec3f(96.0, 100.0, 104.0) * shade;
    } else if (dSh > 0.0 && z >= shBot) {
      // the steel shutter rolled down (as far as it is), slats across the whole door and a bar along its bottom
      let slat = fract((shTop - z) / 0.09);
      ch = select(select(DASH, EQ, slat < 0.6), BAR, z - shBot < 0.07 && dSh < 0.999);
      c = vec3f(128.0, 132.0, 136.0) * select(select(0.75, 1.0, slat < 0.6), 0.6, z - shBot < 0.07) * shade;
    } else if (e < 0.12 || z > DOOR_H + 0.22) { ch = select(EQ, BAR, e < 0.12); c = frame * 1.5 * shade; }
    else {
      // up close, the door itself (13.10d): the walk into the lobby meets the same two glass leaves as from inside,
      // hinged at the jambs and turned in as far as the door is open. Far, the door painted: open, each leaf a strip
      // that narrows, and between them the lobby, lit, without glass. (One walk for both: it is the costly call.)
      let near = pkR >= 0 && tRef < PEEK_FULL && side != 2;
      let hwd = (dA1 - dA0) * 0.5; let sw = (1.0 - (1.0 - dOp) * (1.0 - dOp)) * 1.5707963; let edgeIn = hwd * cos(sw);
      if (near || (pkR >= 0 && dOp > 0.0 && e > edgeIn + 0.08)) {
        gSDo = select(0u, dLf, near); gSDang = sw; gSDglass = false;
        let P = peekRoom(po, lot, bk, fl, rdx, rdy, m, t, winPw, tRef < PEEK_FULL, false);
        gSDo = 0u;
        ch = P.ch; c = P.c; isWin = true; backT = gBack; winGlow = gPeekEm;
        // through a shut leaf's glass: a little darker and cooler, and it takes the street's reflection
        if (gSDglass) { c = c * 0.82 + vec3f(8.0, 12.0, 18.0); glass = true; }
        else {
          // (13.10d2) the open doorway: the room as the walk met it, nothing of the facade's light on it (no glass,
          // no lamps, neon or floodlights on a wall that is not there), the same cell as seen from inside
          gBackT = select(0.0, gBack, gBack > t); gBackW = t; gBackK = -1.0;
          gEm = sat(gPeekEm); gIl = vec3f(0.0); gGlowK = 1.0; gEmK = 1.0;
          gTag = t; gNrm = vec3f(nw, 0.0); gWet = 0.0; gMat = MAT_NONE;
          return Cell(P.ch, P.c, vec3f(7.0, 8.0, 12.0), t, KIND_ROOM, 0.0);
        }
      }
      else if (dOp > 0.0 && e > edgeIn + 0.08) { ch = DOT; c = vec3f(255.0, 220.0, 160.0) * (0.18 * elec); em = true; glowK = 0.2; }
      else if (dOp > 0.0 && e > edgeIn) { ch = COL; c = vec3f(255.0, 220.0, 160.0) * (0.4 * elec); em = true; glowK = 0.2; }
      else { ch = select(select(COL, BAR, abs(along - (dA0 + dA1) * 0.5) < 0.06), DASH, z > DOOR_H); c = vec3f(255.0, 220.0, 160.0) * (0.4 * elec); em = true; glowK = 0.3; }
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
    let al = vec3f(120.0, 105.0, 80.0) * ((1.0 - u.day) * ad * max(0.0, 1.0 - (z - adZ0) / (adZ1 - adZ0)) * 0.9); c += al; il += al;
  } else { body = true; }
  // the facade's body (windows and wall). Far, several floors and bays share a cell; up close, each window
  // and its room. In the band between, both are made and their colors mixed by the building's detail, so the
  // whole tower fades from one look to the other (only the glyphs still dither over the band)
  var chF = 0u; var cF = vec3f(0.0); var emF = false; var glassF = false;
  if (body && (!detailed || detK < 1.0)) {
    let gw = wi >> kh; let gf = fl >> kv;
    let h2 = hash3(bk, gw, gf);
    var p2 = 0.0;
    if (h2 < litK) { p2 = select(winLight, power(sub, cx, cy, winGroup(bk, gw << kh, gf << kv), gen, bk, 0.5) * winLight, switched); }
    if (p2 > 0.04) {
      chF = select(COL, O, h2 < litK * 0.4);
      var w2 = win; let gfl = gf << kv; if (band > 0 && ((gfl / band) & 1) == 1) { w2 = sign; }
      // one window per cell: the same brightness as that window up close, so the two looks agree
      let bri = select(0.65 + 0.35 * hash3(gw, bk, 5), 0.65 + 0.35 * hash3(wi, fl, bk), kh == 0u && kv == 0u);
      cF = w2 * p2 * bri; emF = true;
    } else {
      // the average of what up close is wall and dark panes, so the color holds when the detail comes in
      let paneK = select(select(select(0.3, 0.2, S == 2), 0.24, S == 4), 0.0, S == 1 || S == 5);
      chF = farWall; cF = mix(frame * select(farK, 1.15, S == 1) * shade, darkPane, paneK); glassF = S == 1;
    }
  }
  if (body && !detailed) { ch = chF; c = cF; em = emF; glass = glassF; }
  else if (body) {
  if (fl == 0 && dA1 > dA0 && z < FLOOR_H) {
    // over a street door: wall up to the next floor, never a window (13.10b2)
    ch = select(COL, EQ, z < DOOR_H + 0.5); c = frame * select(1.0, 1.25, z < DOOR_H + 0.5) * shade;
  } else if (pkR >= 0 && !escCell && !corner && windowHole(style, shop, fw, fz, z - f32(fl) * FLOOR_H, fl == 0)) {
    // a window: the room behind it, lit by its own lamps. From afar it was a pane in the building's window
    // color (lit) or dark glass: that look fades out over the whole building as it comes near, and a pane
    // that was lit keeps a glow of its color, fading closer still
    let P = peekRoom(po, lot, bk, fl, rdx, rdy, m, t, winPw, tRef < PEEK_FULL, true); backT = gBack;
    let capaLit = hh < litK && wp > 0.04;
    let capa = select(darkPane, wc * wk, capaLit);
    ch = select(select(EQ, select(HASH, pat.x, hh < litK * 0.3), capaLit), P.ch, peekK > hash3(wi, fl, bk + 517));
    c = mix(capa, P.c, peekK); isWin = true; glass = true; winGlow = gPeekEm * peekK * (0.62 - 0.2 * u.day);
    // (the lit pane is light, as in the far look, until the room takes over)
    if (capaLit) { let gk = WIN_GLOW * peekK * smoothstep(GLOW_NEAR, GLOW_FULL, tRef); c += wc * wk * gk; winGlow += wc * wk * (1.0 - peekK + gk); }
  } else if (S != 1 && S != 5 && S != 3 && z > H - 1.3) {
    // cornice with dentils
    ch = select(select(DOT, QUO, (i32(along * 4.0) & 1) == 1), EQ, z > H - 0.95); c = frame * 1.4 * shade;
  } else if ((S == 0 || S == 2 || S == 4) && fl > 1 && fl % (4 + i32(feat * 3.0)) == 0 && fz < 0.07) {
    ch = EQ; c = frame * 1.3 * shade; // a belt course every few floors
  } else if (S == 2 && !corner && fw > 0.27 && fw < 0.73 && ((fz > 0.78 && fz < 0.86) || (fz > 0.25 && fz < 0.3))) {
    ch = select(US, DASH, fz > 0.5); c = frame * 1.3 * shade; // stone lintel and sill
  } else if (S == 0 && feat > 0.6 && wi % 2 == 0 && fw < 0.18) {
    ch = BAR; c = frame * 1.3 * shade; // art deco piers
  } else if ((S == 0 || S == 4) && z < FLOOR_H && !shop && !corner) {
    ch = select(HASH, EQ, (ifloor(z / 0.5) & 1) == 1); c = frame * 0.95 * shade; // a stone base
  } else if (z < FLOOR_H && shop) {
    if (fw > 0.12 && fw < 0.88 && z > 0.2 && z < 2.6 && !corner) { ch = select(select(COL, RB, fw > 0.8), LB, fw < 0.2); c = vec3f(180.0, 150.0, 100.0) * elec; em = true; glass = true; }
    else { ch = BAR; c = frame * shade; }
  } else if (S == 1) {
    // curtain wall: mullions and floor slabs over tinted glass with a diagonal sheen
    if (fz < 0.08) { ch = DASH; c = frame * 0.8 * shade; }
    else if (fw < 0.07 || corner) { ch = BAR; c = frame * 1.5 * shade; }
    else if (hh < litK) {
      if (wp > 0.04) { ch = select(select(COL, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; em = true; glass = true; } else { ch = EQ; c = darkPane; glass = true; }
    } else { ch = select(select(DOT, COL, sheen > 0.4), SL, sheen > 0.85); c = frame * (1.0 + 0.3 * sheen) * shade; glass = true; }
  } else if (S == 5) {
    let dp = along % 6.0;
    if (z > H - 3.2 && z < H - 1.4) {
      if (fw > 0.08 && fw < 0.92) {
        let p0 = select(winLight, power(sub, cx, cy, winGroup(bk, wi, 0), gen, bk, 0.5) * winLight, switched);
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
      else if (wp > 0.04) { ch = select(select(HASH, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; em = true; glass = true; } else { ch = EQ; c = darkPane; glass = true; }
    } else { ch = COL; c = frame * shade; }
  } else if (S == 2) {
    if (fw > 0.3 && fw < 0.7 && fz > 0.3 && fz < 0.78 && !corner) {
      if (wp > 0.04) { ch = select(select(HASH, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; em = true; glass = true; } else { ch = EQ; c = darkPane; glass = true; }
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
      if (wp > 0.04) { ch = select(select(HASH, pat.y, pIdx != 0), pat.x, hh < litK * 0.3); c = wc * wk; em = true; glass = true; } else { ch = EQ; c = darkPane; glass = true; }
    } else { ch = select(DOT, BAR, corner); c = frame * shade; }
  } else if (fw > 0.2 && fw < 0.8 && fz > 0.28 && fz < 0.8 && !corner) {
    if (wp > 0.04) { ch = select(select(pat.z, pat.y, hh < litK * 0.7), pat.x, hh < litK * 0.3); c = wc * wk; em = true; glass = true; } else { ch = EQ; c = darkPane; glass = true; }
  } else { ch = select(select(COL, DOT, t > 60.0), BAR, corner); c = frame * shade; }
  if (detK < 1.0) {
    bodyEm = mix(select(vec3f(0.0), cF, emF), select(vec3f(0.0), c, em), detK);
    c = mix(cF, c, detK); em = em || emF;
  }
  }
  var emC = select(select(vec3f(0.0), c, em), bodyEm, bodyEm.x >= 0.0);
  // a lit room's light spills onto the wall around its window
  // (only where this floor has a window in this bay: a stone base or a blind wall has none to spill from;
  // and only from the mains: the emergency lamps of a blackout are too faint to light the wall outside)
  if (pkR >= 0 && !isWin && winPw >= 0.8 && !corner && z < H - 0.6 && windowHole(style, shop, 0.5, 0.54, 0.54 * FLOOR_H, fl == 0)) {
    let GL = roomLamp(lot, bk, roomRec(po, pkR), pkR, fl, winPw, false);
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
    // where along its tube the chase is: up a side tube (and the wall's glow nearer a side than the top), else across the top
    let s = select(along, z, eA < tw || eA < dTop);
    let chase = hash3(bk, 3, 31) < 0.35 && ifloor((s - u.sec * 5.0) / 1.4) % 3 == 0;
    let k = ad * (1.0 - 0.55 * u.day) * select(1.0, 0.25, chase);
    if (onTube) { ch = select(DASH, BAR, eA < tw); c = neon * k + vec3f(70.0 * k); emC = c; il = vec3f(0.0); emK = SIGN_EMIT; glowK = SIGN_GLOW; }
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
      // near, whoever stands between a lamp and the wall throws a shadow up it: the ray from here to each of the
      // two nearest lamps (FLOOD_OUT m out, at its lens) past the objects in front of the floodlit facades
      var v1 = 1.0; var v2 = 1.0;
      if (t < FLOOD_SHADOW_FAR && side != 2) {
        var tg = vec2f(0.0, 1.0); if (side == 1) { tg = vec2f(1.0, 0.0); } else if (side == 3) { tg = vec2f(bld[q + 8u], -bld[q + 7u]); }
        let a1 = (0.5 - fr) * FLOOD_GAP; let a2 = a1 + select(-FLOOD_GAP, FLOOD_GAP, fr > 0.5);
        let P = vec3f(hx + nw.x * 0.02, hy + nw.y * 0.02, z);
        v1 = floodShadow(P, vec3f(hx + tg.x * a1 + nw.x * FLOOD_OUT, hy + tg.y * a1 + nw.y * FLOOD_OUT, 0.32));
        v2 = floodShadow(P, vec3f(hx + tg.x * a2 + nw.x * FLOOD_OUT, hy + tg.y * a2 + nw.y * FLOOD_OUT, 0.32));
      }
      // each lamp's cone, and some light between them, so the wall is scalloped and never left dark
      I = fzz * (0.3 + 0.7 * min(1.2, exp(-(d / w) * (d / w)) * v1 + exp(-(d2 / w) * (d2 / w)) * v2));
      // (the lamp itself: near, a fixture standing in front of the wall)
      if (z < 0.35 && d < 0.3 && t > FLOOD_FIX_FAR) { ch = STAR; c = vec3f(200.0, 190.0, 165.0); emC = c; il = vec3f(0.0); glowK = 0.3; }
    }
    // the light takes the wall's color (light times albedo, plus a little of its own): a stone wall glows warm, not white
    let fl = colAt(q + 32u) * (I * adElec) * (vec3f(0.2) + 1.5 * frame / 255.0); c += fl; il += fl;
  }
  // the scaffolding 1 m out from a street face: steel tubes (standards every 2.4 m, ledgers every 2 m,
  // a brace in every other bay), boards on each lift, and over the rest a mesh net or nothing
  let scH = bld[q + 52u];
  if (scH > 0.0 && side != 2 && face < 4 && ((u32(bld[q + 54u]) >> u32(face)) & 1u) == 1u) {
    let sb = SCAF_D / max(1e-6, abs(dn)); let sA = along0 - da * sb; let sT = t - sb;
    let zs = gOZ - m * sT + A * sT * sT;
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
  if (t < LIT_FAR) { let L = lightAt(hx, hy, z, vec3f(nw, 0.0)) * (1.3 * shade); c += L; il += L; }
  // the street behind, through the room's far window (main sends the ray on)
  gBackT = select(0.0, backT, isWin && T == t && backT > t); gBackW = t; gBackK = peekK;
  if (!isWin) { gEm = sat(emC); gIl = il; gGlowK = glowK; gEmK = emK; } else { gEm = sat(winGlow); gIl = vec3f(0.0); gGlowK = 1.0; gEmK = 1.0; }
  gTag = T; gNrm = vec3f(nw, 0.0); gWet = 0.0;
  gMat = select(select(WALL_MAT[u32(clamp(S, 0, 15))], MAT_METAL, escCell || (rs == 2 && S == 1)), select(MAT_GLASS, MAT_WINDOW, isWin), glass);
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
    // wide enough to read as cracks from the fence (a cell there is metres across), not a few dots
    let width = 1.2 + rd * 0.006;
    if (d2 - d1 < width && near < 0.75) {
      let kk = heat * (0.55 + 0.45 * sin(u.sec * 60.0 * 0.05 + near * 40.0)) * (0.6 + 0.4 * fog) * min(1.0, 1.6 / (1.0 + rd * 0.0008)) * (1.0 - 0.6 * day);
      if (d2 - d1 < width * 0.4 && rd < 150.0 && kk > 0.5) { ch = STAR; }
      let dk = 0.97 * day;
      c = vec3f(24.0 + 130.0 * kk, 10.0 + 50.0 * kk * kk, 8.0 + 10.0 * kk) * (1.0 - dk) + c * (0.7 * dk);
    }
  }
  return Cell(ch, c, vec3f(7.0, 8.0, 12.0), rd, KIND_BLOCK, u.sunZ);
}

// ---- the ground (renderWorld's ground loop)
fn groundCell(rd: f32, rdx: f32, rdy: f32) -> Cell {
  let wx = gOX + rdx * rd; let wy = gOY + rdy * rd;
  let W = f32(arrayLength(&xc)); let Hh = f32(arrayLength(&yc));
  let bg = vec3f(7.0, 8.0, 12.0);
  if (wx < 0.0 || wy < 0.0 || wx >= W || wy >= Hh) { return burnGround(wx, wy, rd, W, Hh); }
  if (rd > GROUND_FAR) { return Cell(DOT, mix(vec3f(28.0, 24.0, 32.0), vec3f(70.0, 72.0, 78.0), u.day), bg, rd, KIND_GROUND, 0.0); }
  let fog = 1.0 - (rd / GROUND_FAR) * 0.9 * (1.0 - 0.8 * u.day);
  let gx = i32(xc[u32(wx)]); let gy = i32(yc[u32(wy)]);
  let hv = hash3(ifloor(wx * 1.2), ifloor(wy * 1.2), 3);
  var ch = DOT; var c = vec3f(38.0, 38.0, 46.0); var mat = MAT_CONCRETE;
  var dens = 0.0; // litter per 0.5 m square
  let roadX = (gx & 1) == 0; let roadY = (gy & 1) == 0;
  let sD = (wx - u.dox) * u.dnx + (wy - u.doy) * u.dny; let aD = abs(sD); let pastD = aD - u.dw * 0.5;
  let diagGlyph = select(SL, BS, u.dex * u.dey > 0.0);
  let asphalt = select(select(TICK, COM, hv < 0.8), DOT, hv < 0.5);
  if (pastD < 0.0) {
    ch = asphalt; mat = MAT_ASPHALT;
    if (!roadY && rd < 200.0) {
      let al = (wx - u.dox) * u.dex + (wy - u.doy) * u.dey; let m = aD % LANE_W;
      if (aD < 0.3) { ch = diagGlyph; c = vec3f(210.0, 170.0, 60.0); }
      else if (pastD > -1.2) { dens = 0.07; }
      else if (min(m, LANE_W - m) < 0.12 && aD < floor(u.dw * 0.5 / LANE_W) * LANE_W - 1.0 && ifloor(al / 3.0) % 2 == 0) { ch = diagGlyph; c = vec3f(150.0); }
    }
  } else if (roadX || roadY) {
    ch = asphalt; mat = MAT_ASPHALT;
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
      else { ch = select(select(SEMI, COM, hv < 0.7), QUO, hv < 0.4); c = vec3f(40.0, 95.0 + hv * 40.0, 45.0); mat = MAT_LEAF; }
    } else if (opk == 2u) {
      let fx = fract(wx / 2.5); let fy = fract(wy / 2.5);
      ch = select(COL, PLUS, fx < 0.06 || fy < 0.06); c = vec3f(92.0, 86.0, 80.0);
      if (square) { let dark = ((ifloor(wx / 2.5) + ifloor(wy / 2.5)) & 1) == 1; c = select(vec3f(108.0, 104.0, 108.0), vec3f(62.0, 60.0, 66.0), dark); if (!dark && fx > 0.45 && fx < 0.55 && fy > 0.45 && fy < 0.55) { ch = O; } }
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
      let e = rd * rd / (max(gOZ, 0.5) * u.scale) * 0.5;
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
    // (darker, less than before the reflections: the mirror now takes its share of the light)
    c *= vec3f(1.0 - 0.2 * wk, 1.0 - 0.2 * wk, 1.0 - 0.17 * wk);
    lk = 1.0 + 1.1 * wk * select(1.0, 0.75 + 0.25 * sin(u.sec * 7.0 + hv * 30.0), u.rain > 0.0);
    if (u.rain > 0.0 && rd < 22.0 && !underRoof(wx, wy, 0.1)) {
      // splashes: each 0.33 m square takes a drop now and then at its own pace (0.3-1.1 s), each at a new
      // random spot: a small faint ring for a blink; a cell at a distance covers more ground (e), so there a dot
      let sx = ifloor(wx * 3.0); let sy = ifloor(wy * 3.0);
      let per = 0.3 + 0.8 * hash3(sx, sy, 45); let tt = u.sec / per + hash3(sx, sy, 41); let cyc = ifloor(tt);
      let ph = fract(tt) * per;
      if (hash3(sx * 7 + cyc, sy - cyc * 3, 42) < u.rain * 0.45 && ph < 0.1) {
        let d = length(vec2f(wx - (f32(sx) + 0.2 + 0.6 * hash3(sx + cyc * 13, sy, 43)) / 3.0, wy - (f32(sy) + 0.2 + 0.6 * hash3(sx, sy + cyc * 11, 44)) / 3.0));
        let e = rd * rd / (max(gOZ, 0.5) * u.scale) * 0.5; let rr = 0.01 + ph * 0.5;
        if (abs(d - rr) < max(0.01, e)) { ch = select(O, TICK, rr < 0.03 || e > 0.03); c = mix(c, vec3f(150.0, 150.0, 165.0), 0.4 * (1.0 - ph / 0.1)); }
      }
    }
  }
  c = sat(c);
  let gl = lightAt(wx, wy, 0.0, vec3f(0.0, 0.0, 1.0)) * (lk * fog);
  gEm = vec3f(0.0); gEmK = 1.0; gIl = gl; gTag = rd; gMat = mat; gNrm = vec3f(0.0, 0.0, 1.0);
  // how wet the spot is: a film everywhere it rains, puddles in the low spots (more on the asphalt)
  gWet = 0.0;
  if (u.wet > 0.02 && mat != MAT_LEAF) {
    let pd = smoothK(select(0.62, 0.55, mat == MAT_ASPHALT), 0.72, noise(wx / 5.0 + 13.0, wy / 5.0 + 7.0) * 0.7 + noise(wx / 1.7, wy / 1.7) * 0.3);
    gWet = u.wet * (1.0 - u.snow) * select(0.15 + 0.6 * pd, 0.45 + 0.55 * pd, mat == MAT_ASPHALT);
  }
  return Cell(ch, c * fog + gl, bg, rd, KIND_GROUND, 0.0);
}

/** The day's light (finish): how the surface's color reads as albedo, and the sky's and the sun's strength. */
const DAY_ALBEDO = 2.0; const DAY_SKY = 1.1; const DAY_SUN = 4.2; const DAY_GROUND = 1.8;
/** The brightest a surface reflects (its hue kept), how much more saturated the day shows the colors, and the exposure. */
// (playtest 2026-10-07: the day read dark and too contrasted; brighter and less saturated, the night untouched; was 1.3 and 0.75; the user asked for 1.2)
const DAY_ALB_MAX = 0.8; const DAY_SAT = 1.12; const DAY_EXPO = 1.2;
/** Night: where the highlights start to roll off, and how far a color past 1 goes toward white. */
const NIGHT_KNEE = 0.3; const NIGHT_WHITE = 0.15;
/** The night's curve, on display-linear light, on the luminance: untouched below the knee (the night's look),
 *  above it an exponential shoulder toward 1; a channel still past 1 goes toward white, as in tone(). */
fn nightTone(c: vec3f) -> vec3f {
  let x = max(c, vec3f(0.0));
  let L = dot(x, vec3f(0.2126, 0.7152, 0.0722));
  let mx0 = max(x.x, max(x.y, x.z));
  if (L <= NIGHT_KNEE && mx0 <= 1.0) { return x; }
  var Lt = L;
  if (L > NIGHT_KNEE) { Lt = NIGHT_KNEE + (1.0 - NIGHT_KNEE) * (1.0 - exp(-(L - NIGHT_KNEE) / (1.0 - NIGHT_KNEE))); }
  var y = x * (Lt / max(L, 1e-5));
  let mx = max(y.x, max(y.y, y.z));
  // past 1, mostly scaled down with its hue kept (a red tail light stays red), only a little toward white
  if (mx > 1.0) { y = mix(y / mx, vec3f(Lt) + (y - vec3f(Lt)) * ((1.0 - Lt) / max(1e-4, mx - Lt)), NIGHT_WHITE); }
  return y;
}
/** A filmic tone curve (Narkowicz's fit of ACES): bright light rolls off instead of clipping to white. */
fn acesL(x: f32) -> f32 { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
/** How far a color past 1 goes toward white (0: only scaled down, its hue kept). */
const DAY_WHITE = 0.2;
/** The curve on the luminance only, so a bright color keeps its hue and saturation. */
fn tone(x: vec3f) -> vec3f {
  let L = dot(x, vec3f(0.2126, 0.7152, 0.0722));
  if (L < 1e-5) { return vec3f(0.0); }
  let Lt = acesL(L); var y = x * (Lt / L);
  let mx = max(y.x, max(y.y, y.z));
  // past 1: mostly scaled down with its hue kept (a red car in the sun reads a stronger red), only a little toward white
  if (mx > 1.0) { y = mix(y / mx, vec3f(Lt) + (y - vec3f(Lt)) * ((1.0 - Lt) / max(1e-4, mx - Lt)), DAY_WHITE); }
  return y;
}
// ---- materials: Fresnel (Schlick), the highlight's spread (GGX), the roughness with the wet film
fn fres(f0: f32, cosT: f32) -> f32 { let k = 1.0 - clamp(cosT, 0.0, 1.0); let k2 = k * k; return f0 + (1.0 - f0) * k2 * k2 * k; }
fn ggx(nh: f32, r: f32) -> f32 { let a = max(r * r, 0.002); let a2 = a * a; let d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (3.14159265 * d * d); }
fn matRough() -> f32 { return mix(MAT_ROUGH[gMat], 0.04, gWet); }
/** The sun's highlight on this cell's surface (its BRDF's specular part times N.L; Kelemen's visibility), 0 on matte. */
fn sunGloss() -> f32 {
  if (gMat == MAT_NONE) { return 0.0; }
  let Ls = normalize(vec3f(u.sunX, u.sunY, max(u.sunZ, 0.0))); let V = -gRay; let N = gNrm;
  let nl = dot(N, Ls); if (nl <= 0.0 || dot(N, V) <= 0.0) { return 0.0; }
  let H = normalize(Ls + V); let lh = max(dot(Ls, H), 0.1);
  return min(40.0, ggx(max(dot(N, H), 0.0), matRough()) * fres(MAT_F0[gMat], lh) * 0.25 / (lh * lh) * nl);
}
// ---- the sun's color by its color temperature: a warm yellow-white high up, orange toward the horizon
/** The sun's color temperature (K) at noon high and at the horizon, and the elevation (rad) where it is fully the high one. */
// (playtest 2026-10-07: the afternoon read too yellow, the sky too; real noon sun is ~5500-5800 K; was 4700)
const SUN_K_HIGH = 5800.0; const SUN_K_LOW = 1900.0; const SUN_K_EL = 0.55;
fn sunTemp() -> f32 { return mix(SUN_K_LOW, SUN_K_HIGH, smoothK(-0.02, SUN_K_EL, u.sunEl)); }
/** A black body's color at T kelvin, in sRGB 0-1 (Tanner Helland's fit), the strongest channel 1. */
fn kelvin(T: f32) -> vec3f {
  let t = clamp(T, 1000.0, 15000.0) / 100.0;
  var c = vec3f(1.0);
  if (t > 66.0) { c.x = 329.698727446 * pow(t - 60.0, -0.1332047592) / 255.0; c.y = 288.1221695283 * pow(t - 60.0, -0.0755148492) / 255.0; }
  else { c.y = (99.4708025861 * log(t) - 161.1195681661) / 255.0; c.z = select(select((138.5177312231 * log(t - 10.0) - 305.0447927307) / 255.0, 0.0, t <= 19.0), 1.0, t >= 66.0); }
  c = clamp(c, vec3f(0.0), vec3f(1.0));
  return c / max(c.x, max(c.y, c.z));
}
/** The sunlight's color in linear light, its luminance 1 (the brightness is DAY_SUN's). */
fn sunLin() -> vec3f { let l = pow(kelvin(sunTemp()), vec3f(2.2)); return l / max(1e-3, dot(l, vec3f(0.2126, 0.7152, 0.0722))); }
// ---- the light (L.1): one for day and night. A surface's palette color is its albedo; it gets the ambient light
// (the sky's by day, the city's glow and the moon's by night), the sun's, and the lamps'; what glows adds its own.
// The sum is radiance, in linear light; the eye's exposure (EV) takes it to the screen through one tone curve.
// What is not lit this way (the rooms seen inside, painted signs, smoke) keeps its color as it looks at the
// exposure the time of day expects, and follows the eye's adaptation only.
/** The night's ambient light with the city lit (its glow on everything; the night's palette is drawn for it), and the full moon's. */
const AMB_N = 0.004; const MOON_E = 0.003;
/** How much of the moonlight a point in the buildings' moon shadow still gets (the sky's part of it). */
const MOON_SHADE = 0.25;
/** How much the eye opens up as the city's glow fails (0: not at all, 1: as much as the light fell). */
const NIGHT_ADAPT = 0.3;
/** The lamps' light (lightAt's) in the same units: under a street lamp ~3% of the day's sky. */
const LAMP_E = 0.45;
/** How fast the lamps' summed light still grows past white (lightAt's 255). */
const LAMP_OVER = 0.3;
/** How much of the eye's change from night to day what glows keeps up with (1: as bright on the screen by day as at night). */
const EMIT_KEEP = 0.95;
/** The signs (shop signs, blade signs and their bulbs, the ticker, the neon tubes up the corners): how much brighter they look than drawn, and their bloom (only to the eye: their light on the street is SIGN_LIGHT in raycaster.ts). */
const SIGN_EMIT = 2.4; const SIGN_GLOW = 1.6;
/** The video screens (the telões, the bus shelters' adverts): brighter to the eye too, less than the signs (a picture, not a light). */
const SCREEN_EMIT = 1.6;
/** By day the screens are turned up (as real LED screens are): to the eye x (1 + this) at noon. */
const SCREEN_DAY_EMIT = 0.6;
/** How much of a sign cell's color its background takes (the others take the B key's share, 0.24). */
const SIGN_FILL = 0.5;
/** How much of the eye closing down a sign makes up for (0: none, 1: all). */
const SIGN_EYE = 0.6;
/** How much of the light on what hides the sky comes back (its albedo), and the share of it in the sun (L.4). */
const SKY_BOUNCE = 0.35;
/** The bounce off the buildings round (L.8): how much of the sky's light they send back (per albedo: L.4 took albedo 1), and
 *  of the sun's on a face turned to it (about half of it in the sun, past the other buildings' shadows). */
const BOUNCE_SKY = 2.0; const BOUNCE_SUN = 2.5;
/** The lamps' highlight on what is glossy. */
const LAMP_SPEC = 0.03;
/** How much of the day's exposure a room's own light follows (0: it reads as drawn by day too; 1: only its lamps, dark by day). */
const ROOM_DAY = 0.3;
/** The night's exposure with the city lit: the night's palette shows as drawn under AMB_N. */
const EV_NIGHT = 1.0 / (DAY_ALBEDO * AMB_N);
fn lin(c: vec3f) -> vec3f { return pow(max(c, vec3f(0.0)) / 255.0, vec3f(2.2)); }
fn srgb(x: vec3f) -> vec3f { return pow(max(x, vec3f(0.0)), vec3f(1.0 / 2.2)) * 255.0; }
fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
/** How far toward the day's look (0 at night, 1 from a third of the way into the day). */
fn dayGrade() -> f32 { return smoothK(0.0, 0.35, u.day); }
/** The city's glow on everything (it fades with the lamps in a blackout). */
fn cityAmb() -> f32 { return AMB_N * (0.02 + 0.98 * pow(clamp(u.cityLit, 0.0, 1.0), 1.5)); }
/** The exposure from night to day (on a log scale), without the blackout's. */
fn evDayNight() -> f32 { return exp(mix(log(EV_NIGHT), log(DAY_EXPO), dayGrade())); }
/** The exposure the time of day expects: the night's opened up a little when the city goes dark. */
fn evRef() -> f32 { return exp(mix(log(EV_NIGHT * pow(cityAmb() / AMB_N, -NIGHT_ADAPT)), log(DAY_EXPO), dayGrade())); }
/** One tone curve: the night's (untouched below a knee) toward the day's filmic one with the day. */
fn toneMap(x: vec3f, g: f32) -> vec3f {
  if (g <= 0.0) { return nightTone(x); }
  if (g >= 1.0) { return tone(x); }
  return mix(nightTone(x), tone(x), g);
}
fn light(cl: Cell) -> Cell {
  var o = cl;
  gGlow = 0.0; gTint = vec3f(1.0); var spG = 0.0; // spG: the bloom of a lamp's highlight on glossy paint, metal or glass
  let ev = evRef() * u.adapt; let rS = pow(u.adapt, 1.0 / 2.2);
  if (o.depth >= 1e9) {
    // the sky follows the eye's adaptation only
    if (abs(u.adapt - 1.0) > 0.001) { o.c = srgb(nightTone(lin(o.c) * u.adapt)); o.bg = srgb(nightTone(lin(o.bg) * u.adapt)); }
    return o;
  }
  let tagged = o.depth == gTag;
  // the light this cell gives off and gets from the lamps, if it was made where it was marked
  let emit = select(vec3f(0.0), gEm, tagged); let lamp = select(vec3f(0.0), gIl, tagged);
  let base = max(vec3f(0.0), o.c - emit - lamp); let mb = max(base.x, max(base.y, base.z));
  // the surface's hue (its palette color, saturated, max channel 1), for the paint's reflection
  if (mb > 12.0) { let s0 = max(vec3f(0.0), mix(vec3f(luma(base)), base, LIT_SAT)); gTint = s0 / max(1.0, max(s0.x, max(s0.y, s0.z))); }
  let day = u.day; let night = 1.0 - day; let g = dayGrade();
  let haze = vec3f(150.0, 160.0, 176.0);
  let objSun = o.sun >= 2.0;
  let sunlit = o.kind == KIND_WALL || objSun;
  // the blackout's darkening of what is not lit this way (what is lit, below, darkens by its light)
  let dark = 1.0 - 0.72 * pow(1.0 - u.cityLit, 1.5) * night;
  if (o.kind == KIND_GROUND || o.kind == KIND_BLOCK || sunlit) {
    // ---- lit: albedo x the light on it
    var A = lin(base) * DAY_ALBEDO;
    // the colors were made for the night: by day a bit more saturated, and never brighter than a white wall
    A = max(vec3f(0.0), mix(vec3f(luma(A)), A, mix(1.0, DAY_SAT, g)));
    let am = max(A.x, max(A.y, A.z)); if (am > DAY_ALB_MAX) { A *= DAY_ALB_MAX / am; }
    // the ground's colors were made for the night (dark, bluish asphalt): by day, lighter and greyer
    if (o.kind == KIND_GROUND) { A = mix(A, vec3f(dot(A, vec3f(0.3, 0.5, 0.2))), 0.2 * g) * mix(1.0, DAY_GROUND, g); }
    // the night's ambient: the city's glow (neutral: the palette is drawn under it) and the moon (bluish)
    // (the moon and the sky are cut by the buildings round it, gSky; the city's glow, half from the lit air, a little less)
    let En = vec3f(cityAmb()) * mix(1.0, gSky, 0.5) + vec3f(0.875, 1.0, 1.44) * (MOON_E * u.moonlight * (1.0 - 0.7 * u.cloud) * gSky * mix(MOON_SHADE, 1.0, gMoon));
    // the day's: the sky's (bluish; whiter under clouds) and the sun's on what faces it out of the shadows (gSun);
    // it fades in on a log scale with the exposure (ds), so dusk never dips darker than night or day
    let ds = pow(AMB_N / DAY_SKY, 1.0 - g) * min(1.0, 4.0 * g);
    let share = select(select(u.sunZ, o.sun, sunlit || o.kind == KIND_BLOCK), o.sun - 2.0, objSun);
    let sunC = sunLin(); let sunK = DAY_SUN * (1.0 - 0.85 * u.cloud) * gSun * ds;
    let skyC = mix(vec3f(0.48, 0.6, 0.92), vec3f(0.82, 0.84, 0.88), u.cloud) * (DAY_SKY + 0.35 * u.cloud);
    // what hides the sky gives some back: the walls and the street round it, lit by the sky and by the sun on part of them
    let sunOpen = DAY_SUN * (1.0 - 0.85 * u.cloud) * ds * max(0.0, u.sunZ);
    let Eb = SKY_BOUNCE * (skyC * (ds * BOUNCE_SKY) * gBncA + sunC * (DAY_SUN * (1.0 - 0.85 * u.cloud) * ds * BOUNCE_SUN * smoothK(-0.02, 0.04, u.sunZ)) * gBncS);
    let E = (En * (1.0 - g) + skyC * (ds * gSky) + Eb + sunC * (sunK * max(0.0, share))) * (1.0 + 0.6 * u.flash);
    // the lamps (lightAt dims its light by day; the eye does that now): their light takes the surface's color;
    // on a facade most of its hue (each street takes its lamps' tone; all of it under the old sRGB light made scorched-paper greys)
    // (past white the sum of lamps grows slowly: a few headlights together raised to the 2.2 blew a car out to white)
    let lx = lamp / max(0.15, 1.0 - 0.85 * day) / 255.0;
    var El = pow(min(lx, vec3f(1.0) + max(lx - vec3f(1.0), vec3f(0.0)) * LAMP_OVER), vec3f(2.2)) * LAMP_E;
    if (o.kind == KIND_WALL) { El = mix(vec3f(luma(El)), El, WALL_LAMP_HUE); }
    // what glows: at night as drawn; by day almost as bright on the screen (a sign is not lost in the sun)
    // (a sign keeps most of its brightness when the eye closes down in a bright street: it still reads as lit)
    let Le = lin(emit) * (pow(EV_NIGHT / evDayNight(), EMIT_KEEP) / EV_NIGHT) * select(1.0, gEmK * pow(max(1.0, 1.0 / u.adapt), SIGN_EYE), tagged && gEmK > 1.0);
    var Lr = A * (E + El) + Le;
    // a glossy surface (wet asphalt, a car's paint, glass) also shines with the lamps' own color, and the sun's
    if (gMat != MAT_NONE && tagged) {
      let r = matRough();
      let sp = El * (fres(MAT_F0[gMat], max(0.0, dot(gNrm, -gRay))) * (1.0 - r) * (1.0 - r) * select(LAMP_GLOSS, CAR_GLOSS, gMat == MAT_PAINT) * LAMP_SPEC);
      Lr += sp; spG = dot(srgb(sp * ev), vec3f(0.3, 0.5, 0.2)) / 255.0 * SPEC_BLOOM;
      if (day > 0.01) {
        let gloss = sunGloss() * sunK;
        Lr += sunC * gloss;
        gGlow = clamp((gloss / max(ds, 1e-3) - SPEC_BLOOM_MIN) * SPEC_BLOOM_SUN, 0.0, 1.0); // a strong glint on metal blooms
      }
    }
    o.c = srgb(toneMap(Lr * ev, g));
    gGlow = max(gGlow, clamp(dot(srgb(Le * ev), vec3f(0.3, 0.5, 0.2)) / 255.0 + spG, 0.0, 1.0) * (1.0 - 0.75 * day) * select(1.0, gGlowK, tagged));
    // the haze: by day with distance, at its most far away
    let f = day * (0.1 + 0.42 * (1.0 - exp(-o.depth / 2500.0)));
    let fd = (1.0 - exp(-o.depth / 1800.0)) * 0.6;
    o.c = mix(o.c, haze * rS, (1.0 - g) * f + g * fd);
  } else {
    // ---- kept as drawn: the moon on it, brighter by day (rooms keep their own lamps' light), the blackout,
    // and the eye's adaptation
    var c = o.c;
    if (u.moonlight > 0.02 && o.depth > 0.0) { let m = u.moonlight * (1.0 - 0.7 * u.cloud) * 14.0; c += vec3f(m * 0.7, m * 0.8, m * 1.15); }
    let amb = 1.0 + select(0.7, 0.1, o.kind == KIND_ROOM) * day + u.flash * 0.6;
    c *= amb;
    let lit = min(c, emit + lamp);
    let up = pow(evRef() / evDayNight(), 1.0 / 2.2); // how much the eye opened in the blackout
    c = (c - lit) * dark + lit * up * select(1.0, gEmK, tagged);
    gGlow = clamp(dot(emit, vec3f(0.3, 0.5, 0.2)) / 255.0, 0.0, 1.0) * (1.0 - 0.75 * day) * select(1.0, gGlowK, tagged) * up;
    let f = day * (0.1 + 0.42 * (1.0 - exp(-o.depth / 2500.0)));
    c = c * (1.0 - f) + haze * f;
    // a room has its own lamps, much dimmer than the day outside: by day it reads darker at the day's exposure
    // (a share of the daylight comes in by the windows, until the light bounces: L.5), and the eye opens up inside
    let roomK = select(1.0, pow(evDayNight() / EV_NIGHT, ROOM_DAY), o.kind == KIND_ROOM);
    let k = u.adapt * roomK;
    if (abs(k - 1.0) > 0.001) { c = srgb(lin(c) * k); }
    o.c = c;
  }
  o.bg *= dark;
  gGlow = min(1.0, gGlow * rS);
  // the city's sodium glow in the air: far things sink into a low orange haze (as a big city seen at night)
  if (night > 0.01 && o.kind != KIND_ROOM) {
    let hk = (1.0 - exp(-o.depth / 900.0)) * NIGHT_HAZE * night * (0.15 + 0.85 * u.cityLit) * (0.8 + 0.4 * u.precip);
    o.c = o.c * (1.0 - hk) + vec3f(120.0, 64.0, 26.0) * (hk * rS);
  }
  // bright sums roll off on the luminance (the hue kept) instead of each channel clipping at 255
  if (max(o.c.x, max(o.c.y, o.c.z)) > 255.0) { o.c = srgb(nightTone(lin(o.c))); }
  return o;
}
fn display(cl: Cell) -> Cell {
  var o = cl;
  if (o.depth >= 1e9) { return o; }
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
  // a sign glows through its whole cell, not only its glyph (the bulbs' light on the panel behind them)
  if (o.depth == gTag && gEmK > 1.0) { o.bg = max(o.bg, o.c * SIGN_FILL); }
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
// the layer's top plane, the longest stretch marched, the samples along it, and the mean free path (m) of the thickest cloud
const CLOUD_TOP = 1900.0;
const CLOUD_RUN = 5000.0;
const CLOUD_STEPS = 12;
const CLOUD_MFP = 140.0;
const MOON_R = ${(3.4 * Math.PI) / 180};
/** The stars' light over their catalog value, and how much more with the city dark (cityLit 0). */
const STAR_K = 1.35; const STAR_DARK = 0.6;
const UMBRA = ${UMBRA}; const PENUMBRA = ${PENUMBRA};
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
  return vec3f(48.0 * city + 70.0 * fire, 33.0 * city + 24.0 * fire, 10.0 * city + 12.0 * fire);
}
// the cloud's column at (x, y): its cover c (from the cover's noise, as the flat deck had it), base and top; the
// finer scales slide with height z (so it billows instead of standing as columns); k1, k2 fade them with distance
fn cloudCol(x: f32, y: f32, z: f32, k1: f32, k2: f32, lo: f32) -> vec3f {
  let ox = x + u.driftX; let oy = y + u.driftY;
  let hz = clamp(z, CLOUD_H, CLOUD_TOP) - CLOUD_H;
  let n0 = noise(ox / 1100.0, oy / 1100.0); let n1 = noise((ox + hz * 0.6) / 420.0 + 71.0, (oy - hz * 0.4) / 420.0 + 13.0); let n2 = noise((ox - hz * 0.9) / 150.0 + 37.0, (oy + hz * 0.7) / 150.0 + 91.0);
  var d = 0.55 * n0 + 0.3 * (k1 * n1 + (1.0 - k1) * 0.5) + 0.15 * (k2 * n2 + (1.0 - k2) * 0.5);
  d += (0.5 - d) * smoothK(8000.0, 30000.0, length(vec2f(x - u.px, y - u.py)));
  let c = smoothK(lo - 0.18, lo + 0.12, d);
  return vec3f(c, CLOUD_H + 140.0 * (1.0 - c), CLOUD_H + (CLOUD_TOP - CLOUD_H) * c * (0.3 + 0.7 * d));
}
// the cloud's density at a point (for the looks toward the sun): its column's cover, inside base..top
fn cloudAt(x: f32, y: f32, z: f32, k1: f32, k2: f32, lo: f32) -> f32 {
  if (z < CLOUD_H || z > CLOUD_TOP) { return 0.0; }
  let C = cloudCol(x, y, z, k1, k2, lo);
  if (C.x <= 0.0) { return 0.0; }
  return C.x * smoothK(C.y, C.y + 80.0, z) * (1.0 - smoothK(max(C.y + 40.0, C.z - 220.0), C.z, z));
}
// a direction of the world (x east, y south, z up) in the equator's frame (x to the vernal point, z to the pole),
// by the city's latitude and the sidereal time (sim/clock.ts)
const SIN_LAT = ${Math.sin(LAT)}; const COS_LAT = ${Math.cos(LAT)};
fn eqDir(v: vec3f) -> vec3f {
  let n = -v.y; let P = -n * SIN_LAT + v.z * COS_LAT; let Q = -v.x; let R = n * COS_LAT + v.z * SIN_LAT;
  let cl = cos(u.lst); let sl = sin(u.lst);
  return vec3f(cl * P + sl * Q, sl * P - cl * Q, R);
}
fn skyCell(m: f32, rdx: f32, rdy: f32) -> Cell {
  let L = length(vec2f(rdx, rdy)); let night = 1.0 - u.day; let day = u.day;
  let up = -m / L; // tan of the elevation
  // the row relative to the horizon (the CPU's y + 0.5 - hor); the 3D camera takes it from the elevation
  let rowF = select(m * u.scale, -up * u.scale, u.cam3d > 0.5);
  // (the 3D camera's by the elevation alone: by u.hor, looking up stretched the horizon's glow over the whole sky)
  let hor0 = select(max(1.0, u.hor), u.rows * 0.5, u.cam3d > 0.5);
  let t = clamp((hor0 + rowF) / hor0, 0.0, 1.0);
  let az = atan2(rdy, rdx);
  let dA = wrapA(az - u.moonA);
  let moonCol = !gNoMoon && u.moonEl > -MOON_R && abs(dA) * cos(u.moonEl) < MOON_R * 3.0;
  let dS = wrapA(az - u.sunA);
  let toSun = 0.5 + 0.5 * cos(dS);
  let t2 = t * t; let t4 = t2 * t2;
  let cl = 0.3 + 0.7 * u.cityLit;
  // (A.2) the day: still a hazy sky, but a bluer zenith fading to a pale horizon
  var r = (5.0 + 21.0 * t2 + 30.0 * t4 * cl) * night + (54.0 + 96.0 * t2) * day;
  var g = (6.0 + 10.0 * t2 + 8.0 * t4 * cl) * night + (88.0 + 80.0 * t2) * day;
  var b = (11.0 + 21.0 * t2 - 6.0 * t4 * cl) * night + (142.0 + 42.0 * t2) * day;
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
  // the stars where they stand in the sky of 2008: the ray (and the cell's sides) turned into the equator's frame by
  // the sidereal time, then each star (a unit vector there, its light and color: world.ts signData) in this cell?
  let yr = rowF - 0.5;
  var star = 0.0; var starC = vec3f(0.0); var starCh = DOT;
  if (night > 0.05 && yr < -1.0) {
    let R3 = vec3f(rdx, rdy, -m); let Dl = length(R3); let D = R3 / Dl;
    let rt = normalize(vec3f(-D.y, D.x, 0.0)); let upv = cross(D, rt);
    let sd = eqDir(D); let sr = eqDir(rt); let su = eqDir(upv);
    // (exactly half a cell each way: any overlap lit a star in two cells as it crossed between them)
    let hw = u.plane / u.cols / Dl; let hh = 0.5 / u.scale / Dl; let cut = cos(2.0 * max(hw, hh));
    for (var k = 0u; k < N_STARS; k++) {
      let w = SG_STARS + k * 4u; let sv = vec3f(bitcast<f32>(sg[w]), bitcast<f32>(sg[w + 1u]), bitcast<f32>(sg[w + 2u]));
      let c = dot(sv, sd);
      if (c < cut) { continue; }
      if (abs(dot(sv, sr)) < hw * c && abs(dot(sv, su)) < hh * c) {
        let p = sg[w + 3u]; starC = vec3f(f32(p & 255u), f32((p >> 8u) & 255u), f32((p >> 16u) & 255u));
        // a slight twinkle, more the lower it is (more air)
        let tw = 1.0 - (0.08 + 0.25 * (1.0 - min(1.0, up * 2.0))) * hash3(i32(k), ifloor(u.sec * 6.0), 9);
        // brighter than drawn, and more so in a blackout (no city glow washing them out)
        let sb = tw * night * night * STAR_K * (1.0 + STAR_DARK * (1.0 - u.cityLit));
        star = max(starC.x, max(starC.y, starC.z)) * sb; starC = min(starC * sb, vec3f(255.0));
        starCh = select(select(DOT, PLUS, star > 130.0), STAR, star > 190.0);
        break;
      }
    }
  }
  if (yr >= -2.0 && night > 0.5) { ch = DOT; cc = vec3f(70.0, 40.0, 60.0); }
  // the moon, its lit side facing the sun
  var moonA = false;
  if (moonCol) {
    let mu = (dA * cos(el)) / MOON_R; let mv = (el - u.moonEl) / MOON_R; let d2 = mu * mu + mv * mv;
    if (d2 < 1.0) {
      let wz = sqrt(1.0 - d2); let f = TAU * u.phase;
      var lit = max(0.0, mu * sin(f) - wz * cos(f));
      // the face: the dark seas (broad, sharp-edged patches) over a finer mottle
      let sea = smoothK(0.42, 0.6, noise(mu * 1.6 + 40.0, mv * 1.6 + 40.0)); let fine = noise(mu * 4.5 + 10.0, mv * 4.5 + 10.0);
      let face = (1.0 - 0.38 * sea) * (0.82 + 0.18 * fine);
      lit = lit * face + 0.05 * night * night;
      if (lit > 0.04 + 0.2 * day) {
        var k = min(1.0, lit) * (0.35 + 0.65 * night); let e = min(1.0, (1.0 - d2) * 5.0);
        // an eclipse: the penumbra greys it a little, the umbra (deeper toward its middle) leaves a copper glow
        let ed = length(vec2f(mu, mv) - vec2f(u.eclU, u.eclV));
        let um = 1.0 - smoothK(UMBRA - 0.06, UMBRA + 0.06, ed); let pen = 1.0 - smoothK(UMBRA, PENUMBRA, ed);
        k *= (1.0 - 0.35 * pen) * (1.0 - um);
        let cu = um * (0.5 - 0.25 * (1.0 - ed / UMBRA)) * night * face;
        cc = vec3f(235.0 * k + 20.0 + 105.0 * cu + r * day, 228.0 * k + 20.0 + 45.0 * cu + g * day, 200.0 * k + 26.0 + 30.0 * cu + b * day);
        r += (cc.x - r) * e; g += (cc.y - g) * e; b += (cc.z - b) * e;
        moonA = true; star = 0.0;
      }
    } else if (d2 < 9.0) {
      let hk = ((1.0 - cos(TAU * u.phase)) * 0.5) * night * exp(-(sqrt(d2) - 1.0) * 1.6) * 18.0;
      r += hk; g += hk; b += hk * 1.2;
    }
  }
  // (B.1) the cloud layer, marched: CLOUD_H up to as thick as its cover makes it, each sample lit by the sun
  // through the cloud between it and the sun (lit edges, dark bases) and, at night, by the city from below
  if (u.cloud > 0.01 && up > 0.002) {
    let tc = (CLOUD_H - u.eye) / (up * L); let wx = u.px + rdx * tc; let wy = u.py + rdy * tc; let D = tc * L;
    let fp = (D * D) / ((CLOUD_H - u.eye) * u.scale);
    let k1 = 1.0 - smoothK(300.0, 900.0, fp); let k2 = 1.0 - smoothK(120.0, 360.0, fp);
    let lo = 1.0 - u.cloud;
    // the march: from the base to the top plane, no longer than CLOUD_RUN m across (low rays are long)
    let s0 = D; let s1 = min((CLOUD_TOP - u.eye) / up, s0 + CLOUD_RUN);
    let ds = (s1 - s0) / f32(CLOUD_STEPS); let seg = ds * sqrt(1.0 + up * up);
    let ux = rdx / L; let uy = rdy / L;
    let Ls = normalize(vec3f(u.sunX, u.sunY, u.sunZ));
    let cosS = dot(normalize(vec3f(ux, uy, up)), Ls);
    // forward scattering: the edges between the eye and the sun light up (silver lining)
    let phase = 0.75 + 1.4 * pow(max(0.0, cosS), 10.0) + 0.3 * pow(max(0.0, cosS), 2.0);
    let sunOn = smoothK(-0.1, 0.03, u.sunEl) * (1.0 - 0.45 * u.precip);
    let sunC = kelvin(sunTemp()) * (235.0 * sunOn * phase);
    let amb = vec3f(118.0, 124.0, 140.0) * day * (1.0 - 0.4 * u.precip) + vec3f(60.0 * u.dusk, 30.0 * u.dusk, 22.0 * u.dusk);
    let GL = glowBelow(wx, wy) * ((0.9 + 0.5 * u.precip) * night);
    // the clouds' own floor of light: lower in a blackout (no city to light them, only the moon)
    let base = 12.0 - 9.0 * (1.0 - u.cityLit) * night;
    var tr = 1.0; var acc = vec3f(0.0);
    // the scales finer than a step are averaged out (else a long step hits or misses them by chance: grain)
    let k1s = k1 * (1.0 - smoothK(500.0, 1200.0, ds)); let k2s = k2 * (1.0 - smoothK(150.0, 400.0, ds));
    var s = s0;
    // a small fixed offset per ray of where each step samples: the step edges (layers) melt into a fine dither
    let cj = (fract(sin(dot(vec2f(ux * 977.0 + up * 311.0, uy * 1213.0 - up * 157.0), vec2f(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.6;
    for (var k = 0; k < CLOUD_STEPS; k++) {
      // each step's stretch, s..s+ds: how much of the height it climbs lies inside its column's cloud
      let za = u.eye + up * s; let zb = za + up * ds; let sm = s + ds * (0.5 + cj);
      let px = u.px + ux * sm; let py = u.py + uy * sm;
      let C = cloudCol(px, py, (za + zb) * 0.5, k1s, k2s, lo);
      let lo2 = max(za, C.y); let hi2 = min(zb, C.z);
      let inside = max(0.0, hi2 - lo2) / max(1e-3, zb - za);
      let dn = C.x * inside;
      let pz = (lo2 + hi2) * 0.5;
      if (dn > 0.003) {
        // the cloud toward the sun, two looks
        let l1 = cloudAt(px + Ls.x * 90.0, py + Ls.y * 90.0, pz + Ls.z * 90.0, k1s, k2s, lo);
        let l2 = cloudAt(px + Ls.x * 320.0, py + Ls.y * 320.0, pz + Ls.z * 320.0, k1s, k2s, lo);
        let sunT = exp(-(l1 * 90.0 + l2 * 230.0) / 160.0);
        let hf = clamp((pz - CLOUD_H) / (CLOUD_TOP - CLOUD_H), 0.0, 1.0);
        let lb = (1.0 - hf) * (1.0 - hf);
        var q = amb * (0.45 + 0.55 * hf) + sunC * sunT + vec3f(base, base, base + 5.0) + GL * (0.35 + 0.65 * lb);
        q += vec3f(u.moonlight * 60.0 * (0.3 + 0.7 * hf)) * vec3f(1.0, 1.0, 1.15);
        let ab = 1.0 - exp(-dn * seg / CLOUD_MFP);
        acc += q * ab * tr; tr *= 1.0 - ab;
        if (tr < 0.03) { break; }
      }
      s += ds;
    }
    let a = (1.0 - tr) * (0.55 + 0.45 * min(1.0, u.cloud * 1.3));
    if (a > 0.02) {
      var q = acc / max(1e-3, 1.0 - tr);
      let thick = 1.0 - tr;
      q += vec3f(190.0, 185.0, 230.0) * u.flash;
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
    // toward the sun's own color (not added on top of the blue sky, which burned it to white)
    let kc = kelvin(sunTemp()) * 245.0; let m = min(1.0, sk);
    r += (kc.x - r) * m; g += (kc.y - g) * m; b += (kc.z - b) * m;
  }
  var o = Cell(32u, vec3f(0.0), vec3f(r, g, b), 1e9, KIND_OTHER, 0.0);
  if (star > r + 25.0 && !moonA) { o.ch = starCh; o.c = starC * (1.0 - cover); }
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
      let lt = lightAt(wx, wy, zd, vec3f(0.0));
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
        let lt = lightAt(wx + u.px, wy + u.py, z, vec3f(0.0));
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
fn handOver(cl: Cell, gx: u32, gy: u32, d: f32) -> Cell {
  var o = cl;
  if (u.hand <= 0.0 || d > 40.0) { return o; }
  let cx = (f32(gx) - u.cols / 2.0) / u.cols; let cy = (f32(gy) - u.rows / 2.0) / u.rows; let aim = 0.55 + 0.45 * exp(-(cx * cx + cy * cy) * 6.0);
  let f = u.hand * aim / (1.0 + (d / 2.2) * (d / 2.2));
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
  var cx = i32(xc[u32(clamp(gOX, 0.0, f32(W - 1u)))]);
  var cy = i32(yc[u32(clamp(gOY, 0.0, f32(H - 1u)))]);
  let nx = i32(u.nxb) - 1; let ny = i32(u.nyb) - 1;
  var tx = (select(xb[cx + 1], xb[cx], rdx < 0.0) - gOX) * ix;
  var ty = (select(yb[cy + 1], yb[cy], rdy < 0.0) - gOY) * iy;
  var tIn = 0.0;
  var best = 1e9; var bk = -1; var bside = 0; var roof = false;
  for (var s = 0; s < 1024; s++) {
    if (tIn > tG) { break; }
    let tOut = min(tx, ty);
    if ((cx & 1) == 1 && (cy & 1) == 1) {
      let o = u32(((cy >> 1) * i32(u.nbx) + (cx >> 1)) * ${BLK});
      let b0 = i32(blk[o + 4u]); let b1 = i32(blk[o + 5u]); let maxH = blk[o + 6u];
      let zMin = min(gOZ - m * tIn + A * tIn * tIn, gOZ - m * tOut + A * tOut * tOut);
      if (b1 > b0 && zMin < maxH) {
        for (var k = b0; k < b1; k++) {
          let q = u32(k * ${BLD});
          let x0 = bld[q]; let y0 = bld[q + 1u]; let x1 = bld[q + 2u]; let y1 = bld[q + 3u]; let h = bld[q + 4u];
          if ((x0 >= u.inX0 - 0.01) && (x1 <= u.inX1 + 0.01) && (y0 >= u.inY0 - 0.01) && (y1 <= u.inY1 + 0.01)) { continue; }
          var tN = 0.0; var tF = 0.0; var side = 0;
          if (bld[q + 5u] > 0.5) {
            let rr = (x1 - x0) * 0.5; let ox = gOX - (x0 + rr); let oy = gOY - (y0 + rr);
            let qa = rdx * rdx + rdy * rdy; let qb = ox * rdx + oy * rdy;
            let disc = qb * qb - qa * (ox * ox + oy * oy - rr * rr);
            if (disc <= 0.0) { continue; }
            tN = (-qb - sqrt(disc)) / qa; tF = (-qb + sqrt(disc)) / qa; side = 2;
          } else {
            let ax = (x0 - gOX) * ix; let bx = (x1 - gOX) * ix; let ay = (y0 - gOY) * iy; let by = (y1 - gOY) * iy;
            let nnx = min(ax, bx); let nny = min(ay, by);
            tF = min(max(ax, bx), max(ay, by)); tN = max(nnx, nny); side = select(1, 0, nnx > nny);
            if (bld[q + 6u] > 0.5) {
              let knx = bld[q + 7u]; let kny = bld[q + 8u]; let kc = bld[q + 9u];
              let dn = knx * rdx + kny * rdy; let th = (kc - knx * gOX - kny * gOY) / dn;
              if (dn < 0.0) { if (th > tN) { tN = th; side = 3; } }
              else if (dn > 0.0) { tF = min(tF, th); }
              else if (knx * gOX + kny * gOY > kc) { continue; }
            }
          }
          if (tN <= 0.01 || tN >= tF || tN >= best) { continue; }
          let zN = gOZ - m * tN + A * tN * tN;
          if (zN >= 0.0 && zN <= h) { best = tN; bk = k; bside = side; roof = false; }
          else if (zN > h && m > 0.0) {
            let tr = (gOZ - h) / m;
            if (tr <= tF && tr < best) { best = tr; bk = k; bside = side; roof = true; }
          }
        }
        if (bk >= 0) { break; }
      }
    }
    if (tx < ty) { cx += stX; tIn = tx; if (cx < 0 || cx >= nx) { break; } tx = (select(xb[cx + 1], xb[cx], rdx < 0.0) - gOX) * ix; }
    else { cy += stY; tIn = ty; if (cy < 0 || cy >= ny) { break; } ty = (select(yb[cy + 1], yb[cy], rdy < 0.0) - gOY) * iy; }
  }

  // the Sarcophagus and its cranes, far past the fence, behind whatever is nearer
  var far = Cell(32u, vec3f(0.0), vec3f(0.0), 1e9, KIND_OTHER, 0.0);
  let vis = select(sarcVis(), 0.0, gRefl);
  if (vis > 0.0) {
    // the haze it fades into is the sky without the moon (else the moon shows through it, like glass)
    var bgS = vec3f(7.0, 8.0, 12.0); if (m <= 0.0) { gNoMoon = true; bgS = skyCell(m, rdx, rdy).bg; gNoMoon = false; }
    far = sarcCell(-m / L, u.scale * L, L, rdx / L, rdy / L, f32(gx), bgS, vis);
    let cr = craneCell(i32(gx), i32(gy), vis);
    if (cr.depth < far.depth) { far = cr; }
  }
  // the cordon fence on the city edge (fenceColumn): chain link on posts, barbed wire on top, where nothing nearer is hit
  let fX = select(select(1e9, -gOX / rdx, rdx < 0.0), (u.cityW - gOX) / rdx, rdx > 0.0);
  let fY = select(select(1e9, -gOY / rdy, rdy < 0.0), (u.cityH - gOY) / rdy, rdy > 0.0);
  let tf = min(fX, fY);
  var cl = Cell(32u, vec3f(0.0), vec3f(0.0), 1e9, KIND_OTHER, 0.0);
  var done = false;
  if (tf > 0.05 && tf <= 2000.0 && tf < min(min(select(1e9, best, bk >= 0), tG), far.depth)) {
    let z = gOZ - m * tf + A * tf * tf;
    if (z >= 0.0 && z < 4.2) {
      let along = select(gOX + tf * rdx, gOY + tf * rdy, fX < fY);
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
      if (roof) { cl = roofCell(u32(bk * ${BLD}), best, gOX + rdx * best, gOY + rdy * best); }
      // (the last argument: the metres of wall one row covers there, for edges thinner than a row)
      else { cl = wallCell(bk, best, bside, rdx, rdy, gOZ - m * best + A * best * best, best / u.scale, m, A); }
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
fn sunLit(px: f32, py: f32, pz: f32) -> f32 { return dirLit(px, py, pz, vec3f(u.sunX, u.sunY, u.sunZ)); }
/** The moon's direction (as the sun's, from its azimuth and elevation). */
fn moonDir() -> vec3f { let ce = cos(u.moonEl); return vec3f(cos(u.moonA) * ce, sin(u.moonA) * ce, max(0.0, sin(u.moonEl))); }
/** Whether a light far off along S (the sun, the moon) reaches the point past the buildings. */
fn dirLit(px: f32, py: f32, pz: f32, S: vec3f) -> f32 {
  let L = length(S.xy);
  if (S.z <= 0.0 || L < 1e-4) { return 1.0; }
  let rdx = S.x / L; let rdy = S.y / L; let k = S.z / L;
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
// ---- the sky's occlusion (L.4): how much of the sky a point sees, past the buildings round it
/** How far the horizon is looked for (m), how many directions round a point on the ground, and how far from the viewer it is
 *  worked out (past it the occlusion fades to none over the last third). */
const SKY_R = 110.0; const SKY_FAR = 700.0;
/** The highest a building rises above (px, py, pz) seen along (rdx, rdy), as the tangent of its elevation, within SKY_R. */
fn horizonTan(px: f32, py: f32, pz: f32, rdx: f32, rdy: f32) -> f32 {
  let ix = select(1e12, 1.0 / rdx, rdx != 0.0); let iy = select(1e12, 1.0 / rdy, rdy != 0.0);
  let stX = select(1, -1, rdx < 0.0); let stY = select(1, -1, rdy < 0.0);
  let W = arrayLength(&xc); let H = arrayLength(&yc);
  if (px < 0.0 || py < 0.0 || px >= f32(W) || py >= f32(H)) { return 0.0; }
  var cx = i32(xc[u32(px)]); var cy = i32(yc[u32(py)]);
  let nx = i32(u.nxb) - 1; let ny = i32(u.nyb) - 1;
  var tx = (select(xb[cx + 1], xb[cx], rdx < 0.0) - px) * ix;
  var ty = (select(yb[cy + 1], yb[cy], rdy < 0.0) - py) * iy;
  var tIn = 0.0; var best = 0.0; gHzQ = -1;
  for (var s = 0; s < 64; s++) {
    if (tIn > SKY_R || (SHADOW_TOP - pz) < best * tIn) { break; }
    if ((cx & 1) == 1 && (cy & 1) == 1) {
      let o = u32(((cy >> 1) * i32(u.nbx) + (cx >> 1)) * ${BLK});
      let b0 = i32(blk[o + 4u]); let b1 = i32(blk[o + 5u]);
      if (b1 > b0 && blk[o + 6u] - pz > best * max(tIn, 0.5)) {
        for (var q0 = b0; q0 < b1; q0++) {
          let q = u32(q0 * ${BLD});
          let x0 = bld[q]; let y0 = bld[q + 1u]; let x1 = bld[q + 2u]; let y1 = bld[q + 3u]; let h = bld[q + 4u];
          if (h - pz <= best * max(tIn, 0.5)) { continue; }
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
          if (tF <= 0.03 || tN >= tF || tN > SKY_R) { continue; }
          let tb = (h - pz) / max(tN, 0.5);
          if (tb > best) {
            // the face the ray meets (a round tower's, or the cut's, roughly: back along the ray)
            best = tb; gHzQ = i32(q);
            if (bld[q + 5u] > 0.5) { gHzN = vec2f(-rdx, -rdy); }
            else if (bld[q + 6u] > 0.5 && tN > max(min((x0 - px) * ix, (x1 - px) * ix), min((y0 - py) * iy, (y1 - py) * iy)) + 1e-3) { gHzN = vec2f(bld[q + 7u], bld[q + 8u]); }
            else if (min((x0 - px) * ix, (x1 - px) * ix) > min((y0 - py) * iy, (y1 - py) * iy)) { gHzN = vec2f(select(1.0, -1.0, rdx > 0.0), 0.0); }
            else { gHzN = vec2f(0.0, select(1.0, -1.0, rdy > 0.0)); }
          }
        }
      }
    }
    if (tx < ty) { cx += stX; tIn = tx; if (cx < 0 || cx >= nx) { break; } tx = (select(xb[cx + 1], xb[cx], rdx < 0.0) - px) * ix; }
    else { cy += stY; tIn = ty; if (cy < 0 || cy >= ny) { break; } ty = (select(yb[cy + 1], yb[cy], rdy < 0.0) - py) * iy; }
  }
  return best;
}
/** The share of the sky's light a surface at P with normal N gets past the buildings (1: open sky), cosine-weighted:
 *  a floor sees cos^2 of each direction's horizon; a wall only the sky in front of it, each slice by how it faces it.
 *  No sorting by cell: it moves smoothly with the point, so no glyph flickers. */
const SKY_DIRS = 16;
fn skyView(P: vec3f, N: vec3f) -> f32 {
  let up = N.z > 0.7;
  gBncA = vec3f(0.0); gBncS = vec3f(0.0);
  if (up) {
    // (16 directions: with 8, each corner of a building crossing one of them cut a straight wedge of shade into the street)
    var s = 0.0;
    for (var k = 0; k < SKY_DIRS; k++) {
      let a = (f32(k) + 0.5) * (6.283185 / f32(SKY_DIRS)); let tn = horizonTan(P.x, P.y, P.z + 0.3, cos(a), sin(a));
      s += 1.0 / (1.0 + tn * tn);
      bounceFrom(tn * tn / (1.0 + tn * tn) / f32(SKY_DIRS));
    }
    return s / f32(SKY_DIRS);
  }
  let n = normalize(vec2f(N.x, N.y) + vec2f(1e-5, 0.0));
  var s = 0.0; var wsum = 0.0;
  for (var k = -2; k <= 2; k++) {
    let a = f32(k) * 0.6; let w = cos(a);
    let d = vec2f(n.x * cos(a) - n.y * sin(a), n.x * sin(a) + n.y * cos(a));
    let th = atan(horizonTan(P.x + n.x * 0.15, P.y + n.y * 0.15, P.z, d.x, d.y));
    let sl = (0.785398 - th * 0.5 - sin(2.0 * th) * 0.25) / 0.785398;
    s += w * sl; wsum += w;
    bounceFrom(w * (1.0 - sl) / 3.37); // (3.37: the sum of the slices' weights)
  }
  // a wall also sees half its hemisphere below the horizon: the ground's light (the bounce, in light) stands in for it
  return mix(s / wsum, 1.0, max(0.0, N.z));
}
/** The building that rose highest in the last horizonTan (its offset in bld, -1: none) and the normal of its face met. */
var<private> gHzQ: i32 = -1;
var<private> gHzN: vec2f = vec2f(0.0);
/**
 * What the buildings hiding the sky give back (skyView), in their own colors (L.8): their albedo x the share of the sky
 * they hide (gBncA, lit by the sky) and x how their face meets the sun too (gBncS); a sunlit wall's warm afternoon
 * light reaches the street and the wall across from it.
 */
var<private> gBncA: vec3f = vec3f(0.0);
var<private> gBncS: vec3f = vec3f(0.0);
fn bounceFrom(w: f32) {
  if (gHzQ < 0 || w <= 0.0) { return; }
  let q = u32(gHzQ);
  // a facade: its wall color, darkened a little by its windows
  var A = lin(mix(colAt(q + 15u), vec3f(55.0, 62.0, 78.0), 0.3)) * DAY_ALBEDO;
  let am = max(A.x, max(A.y, A.z)); if (am > DAY_ALB_MAX) { A *= DAY_ALB_MAX / am; }
  gBncA += A * w;
  gBncS += A * (w * max(0.0, gHzN.x * u.sunX + gHzN.y * u.sunY));
}
/** How far from the viewer the street objects' shadows are traced (m). */
const OBJ_SHADOW_FAR = 120.0;
/** This cell's sunlight after the shadows (sunLit), for finish. */
var<private> gSun: f32 = 1.0;
/** Whether the moon reaches this cell past the buildings (1) or not (0), for finish. */
var<private> gMoon: f32 = 1.0;
/** This cell's share of the sky past the buildings (skyView), for finish. */
var<private> gSky: f32 = 1.0;
// what of the cell's color is light it gives off (a lit window, a sign, a lamp) and light it gets from the
// lamps (street lamps, floodlights, headlights), for the cell at depth gTag; set where the cell is made
var<private> gEm: vec3f = vec3f(0.0);
var<private> gIl: vec3f = vec3f(0.0);
var<private> gTag: f32 = -1.0;
// how strongly the finished cell glows onto its neighbors (0..1), written with it (the background's alpha)
var<private> gGlow: f32 = 0.0;
/** skyCell without the moon (the haze behind the Sarcophagus). */
var<private> gNoMoon: bool = false;
// how much of a cell's light blooms (a lit doorway or a floodlight's lamp less than a sign)
var<private> gGlowK: f32 = 1.0;
// how much brighter than drawn a cell's own light looks (the signs: lit to the eye, apart from the light they cast)
var<private> gEmK: f32 = 1.0;
// the material, the surface's normal (toward the viewer) and how wet it is, of the cell at gTag (R.23)
var<private> gMat: u32 = 0u;
var<private> gNrm: vec3f = vec3f(0.0, 0.0, 1.0);
var<private> gWet: f32 = 0.0;
// the hue of this cell's surface (its palette color, saturated, max channel 1), for the light and the paint's reflection
var<private> gTint: vec3f = vec3f(1.0);
// this cell's ray (unit, the way it travels)
var<private> gRay: vec3f = vec3f(1.0, 0.0, 0.0);
// where the rays through the city start (the eye; a mirror's spot for a reflection), and whether it is one
var<private> gOX: f32 = 0.0;
var<private> gOY: f32 = 0.0;
var<private> gOZ: f32 = 0.0;
var<private> gRefl: bool = false;
// (13.10b2) a room seen from the street through to a window on its far side: where the walk met that glass (gBack,
// roomWalk), and for the cell wallCell made, how far off the far glass is (gBackT, 0 none), where the near window is,
// and how much of the cell is the room (peekK); main sends a second ray on through it to the street behind
var<private> gBack: f32 = 0.0;
var<private> gBackT: f32 = 0.0;
var<private> gBackW: f32 = 0.0;
var<private> gBackK: f32 = 0.0;
// a lit piece of furniture (a screen, a lamp) met by peekRoom: its glow, so it blooms seen from the street as from inside
var<private> gPeekEm: vec3f = vec3f(0.0);
// (13.10d2) how far off what peekRoom met really is: the cell keeps the facade's depth, but the light in the hand
// falls on the room behind the glass or the doorway, as it does seen from inside
var<private> gPeekT: f32 = 0.0;
/** The viewer's stairwell (roomWalk): the walk left the storey through it (1 up, -1 down, 0 not), where, and the plan it went into. */
var<private> gWell: i32 = 0;
/** The viewer's stairwell (x0, y0, x1, y1; empty when none), the same on every storey; and whether the walk is a storey seen through it. */
var<private> gWR: vec4f = vec4f(0.0);
var<private> gThru: bool = false;
fn inWellRect(x: f32, y: f32) -> bool { return x > gWR.x && x < gWR.z && y > gWR.y && y < gWR.w; }
var<private> gWellT: f32 = 0.0;
var<private> gWellO: u32 = 0u;

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
  gOX = u.px; gOY = u.py; gOZ = u.eye; gRefl = false; gMat = MAT_NONE; gWet = 0.0;
  gRay = normalize(vec3f(rdx, rdy, -m));
  var tG = 1e9;
  if (m > 0.0) { let disc = m * m - 4.0 * A * u.eye; if (disc > 0.0) { tG = 2.0 * u.eye / (m + sqrt(disc)); } }

  // indoors, the floor around the viewer first: the city shows only through its windows
  let IB = inBlock();
  var inc = InC(Cell(32u, vec3f(0.0), vec3f(7.0, 8.0, 12.0), 1e9, KIND_OTHER, 0.0), 0u, 0.0, 0.0, vec3f(0.0), false, 0.0, 0.0, 0.0, 0.0);
  if (IB != 0u) {
    // the viewer's storey; through its stairwell, the storey above or below, as a room seen from outside it is (its
    // furniture met by the walk). One call in a loop: WGSL inlines roomWalk at each call, and the shader is slow to compile
    var V = inView(IB); var tIn = 0.0; var thruWell = false;
    gWR = vec4f(fxf(IB + 18u), fxf(IB + 19u), fxf(IB + 20u), fxf(IB + 21u)); gThru = false;
    for (var walkN = 0; walkN < 2; walkN++) {
      gWell = 0;
      inc = roomWalk(V, rdx, rdy, m, tIn);
      if (gWell == 0 || thruWell) { break; }
      let f2 = V.f + gWell;
      V = RView(gWellO, V.lot, V.box, f2, f32(f2) * FLOOR_H, false, V.elec, -1, 0u, true); tIn = gWellT; thruWell = true; gThru = true;
    }
    if (thruWell && inc.state == 0u) { inc.state = 1u; inc.cl = roomCell(32u, vec3f(0.0), tIn); }
    gWell = 0; gWR = vec4f(0.0); gThru = false;
  }
  var cl = inc.cl;
  gBackT = 0.0;
  gPeekT = 0.0;
  if (inc.state != 1u) { cl = cityCell(gid.x, gid.y, rdx, rdy, m, L, A, tG); }
  let handD = select(cl.depth, max(cl.depth, gPeekT), cl.kind == KIND_ROOM);
  // ---- (13.10b2) a room seen through a window or an open street door, and through a window on its far side: the
  // street behind, by a second ray on from that glass (as the reflection's, R.24), lit on its own
  var thru = vec3f(0.0); var thruCh = 32u; var thruK = 0.0; var thruPane = 1.0; var thruD = -1.0;
  if (inc.state != 1u && gBackT > 0.0 && cl.kind == KIND_ROOM && abs(cl.depth - gBackW) < 1e-3) {
    let tb = gBackT + 0.05; thruK = abs(gBackK); thruD = cl.depth; thruPane = select(0.62 - 0.2 * u.day, 1.0, gBackK < 0.0) * 0.8;
    let sEm = gEm; let sIl = gIl; let sTag = gTag; let sGK = gGlowK; let sEK = gEmK; let sMat = gMat; let sN = gNrm; let sWet = gWet;
    gOX = u.px + rdx * tb; gOY = u.py + rdy * tb; gOZ = u.eye - m * tb + A * tb * tb;
    var tg = 1e9;
    if (m > 0.0) { let disc = m * m - 4.0 * A * gOZ; if (disc > 0.0) { tg = 2.0 * gOZ / (m + sqrt(disc)); } }
    var bc = cityCell(gid.x, gid.y, rdx, rdy, m, L, A, tg);
    gOX = u.px; gOY = u.py; gOZ = u.eye;
    if (bc.depth < 1e8) { if (bc.depth == gTag) { gTag += tb; } bc.depth += tb; }
    bc = objectsOver(bc, gid.x, gid.y, rdx, rdy, -m);
    gSun = 1.0; gSky = 1.0; gMoon = 1.0; gBncA = vec3f(0.0); gBncS = vec3f(0.0);
    let lb = light(bc); thru = lb.c; thruCh = lb.ch;
    gEm = sEm; gIl = sIl; gTag = sTag; gGlowK = sGK; gEmK = sEK; gMat = sMat; gNrm = sN; gWet = sWet;
  }
  // the smoke, then the street objects (and the furniture) over all of it, the window glass, then rain and snow over
  // the finished cell, only beyond the glass indoors (the sky's depth is 1e9, so the finish leaves it as it is)
  cl = objectsOver(smokeOver(cl, rdx, rdy, m), gid.x, gid.y, rdx, rdy, -m);
  if (inc.state == 2u && !inc.gdoor) { cl = glassOver(cl, inc, m); }
  // ---- the reflection (R.24): glass and wet ground mirror the city along a second ray from where this one
  // hit; anything else glossy (a car's paint, metal) mirrors the sky. Weighed by Fresnel and the roughness.
  var refl = vec3f(0.0); var rw = 0.0; var rGlow = 0.0;
  if (cl.depth == gTag && cl.depth < 1e8 && gMat != MAT_NONE) {
    let N = gNrm; let nv = max(1e-3, -dot(N, gRay)); let r = matRough();
    rw = fres(MAT_F0[gMat], nv) * (1.0 - r) * (1.0 - r);
    if (N.z > 0.5 && gMat != MAT_PAINT) { rw = min(rw, 0.7); } // a puddle never mirrors all of it
    if (rw > 0.03) {
      let t = cl.depth;
      var R = gRay - 2.0 * dot(gRay, N) * N;
      // a rough surface scatters its mirror: the ray turned a little per cell (a dithered blur)
      if (r > 0.08) {
        let jx = hash3(i32(gid.x), i32(gid.y), 31) - 0.5; let jy = hash3(i32(gid.x), i32(gid.y), 32) - 0.5; let jz = hash3(i32(gid.x), i32(gid.y), 33) - 0.5;
        // on the ground it smears up and down more than sideways (the long streaks under lights on wet asphalt)
        let an = select(vec3f(1.0), vec3f(0.35, 0.35, 1.8), N.z > 0.5);
        R = normalize(R + vec3f(jx, jy, jz) * an * (REFL_BLUR * r));
        if (dot(R, N) < 0.02) { R = normalize(R + N * (0.02 - dot(R, N))); }
      }
      let LR = length(R.xy); var mR = -R.z / max(LR, 1e-4);
      // the rain ripples the puddles: the reflection wavers up and down, a streak under each light
      if (N.z > 0.5 && u.rain > 0.0 && gMat != MAT_PAINT) { mR += (hash3(i32(gid.x), i32(gid.y), ifloor(u.sec * 6.0 + 7.0 * hash3(i32(gid.x), i32(gid.y), 77))) - 0.5) * 0.05 * u.rain; } let rx = R.x / max(LR, 1e-4); let ry = R.y / max(LR, 1e-4);
      let ground = N.z > 0.5;
      // past its reach a surface mirrors only the sky; the city's reflection fades into it over the last stretch,
      // so a tall tower's glass never shows a cut where its upper floors pass the reach
      let farR = select(select(REFL_FAR_WALL, REFL_FAR_GROUND, ground), REFL_FAR_CAR, gMat == MAT_PAINT);
      let skyK = smoothstep(0.65 * farR, farR, t);
      let mirror = (gMat == MAT_GLASS || gMat == MAT_WINDOW || gWet > 0.05 || gMat == MAT_PAINT) && t < farR && LR > 0.05;
      let sEm = gEm; let sIl = gIl; let sTag = gTag; let sGK = gGlowK; let sEK = gEmK; let sMat = gMat; let sN = gNrm; let sWet = gWet; let sRay = gRay;
      if (mirror) {
        gRefl = true;
        gOX = u.px + rdx * t + N.x * 0.05; gOY = u.py + rdy * t + N.y * 0.05; gOZ = max(0.02, u.eye - m * t + A * t * t + N.z * 0.02);
        gRay = normalize(vec3f(rx, ry, -mR));
        let AR = 1.0 / (2.0 * u.curveR);
        var tg = 1e9;
        if (mR > 0.0) { let disc = mR * mR - 4.0 * AR * gOZ; if (disc > 0.0) { tg = 2.0 * gOZ / (mR + sqrt(disc)); } }
        var rc = cityCell(gid.x, gid.y, rx, ry, mR, 1.0, AR, tg);
        // and the street objects it meets first (the lamps' heads and the cars in the wet street)
        rc = objRefl(rc, vec3f(gOX, gOY, gOZ), gRay);
        gRefl = false; gOX = u.px; gOY = u.py; gOZ = u.eye;
        if (rc.depth < 1e8) {
          if (rc.depth == gTag) { gTag += t; } rc.depth += t;
          gSun = 1.0; gSky = 1.0; gBncA = vec3f(0.0); gBncS = vec3f(0.0);
          let lc = light(rc); refl = lc.c; rGlow = gGlow;
        } else { refl = max(rc.bg, select(vec3f(0.0), rc.c, rc.ch != 32u)); }
        if (skyK > 0.0) { refl = mix(refl, skyCell(mR, rx, ry).bg, skyK); rGlow *= 1.0 - skyK; }
      } else {
        let sk = skyCell(mR, rx, ry); refl = sk.bg;
      }
      gEm = sEm; gIl = sIl; gTag = sTag; gGlowK = sGK; gEmK = sEK; gMat = sMat; gNrm = sN; gWet = sWet; gRay = sRay;
    }
  }
  // how much sky what this cell shows sees (the sky and the rooms keep theirs; it fades out far away)
  gSky = 1.0; gBncA = vec3f(0.0); gBncS = vec3f(0.0);
  if (cl.depth < SKY_FAR && cl.kind != KIND_ROOM && cl.kind != KIND_OTHER) {
    let t = cl.depth;
    let P = vec3f(u.px + rdx * t, u.py + rdy * t, max(0.0, u.eye - m * t + A * t * t));
    let Nn = select(vec3f(0.0, 0.0, 1.0), gNrm, cl.depth == gTag && cl.kind == KIND_WALL);
    let fk = smoothK(SKY_FAR * 0.65, SKY_FAR, t);
    gSky = mix(skyView(P, Nn), 1.0, fk); gBncA *= 1.0 - fk; gBncS *= 1.0 - fk;
  }
  // by day, whether the sun reaches what this cell shows (the sky and the rooms keep theirs)
  gSun = 1.0;
  if (u.day > 0.01 && u.sunZ > 0.0 && cl.depth < 3000.0 && cl.kind != KIND_ROOM) {
    let t = cl.depth;
    let P = vec3f(u.px + rdx * t, u.py + rdy * t, max(0.0, u.eye - m * t + A * t * t));
    gSun = sunLit(P.x, P.y, P.z);
    // and past the street objects (poles, trees, cars, people), near enough for their shadows to show
    if (gSun > 0.0 && t < OBJ_SHADOW_FAR) {
      let Ls = normalize(vec3f(u.sunX, u.sunY, u.sunZ));
      let Nn = select(vec3f(0.0, 0.0, 1.0), gNrm, cl.depth == gTag);
      // (parts thinner than a cell where the shadow falls are widened to half a cell, as drawing does, or a pole's shadow flickers away)
      gSun *= objShadow(P + Nn * 0.06, Ls, 0.5 * u.colW * t);
    }
  }
  // at night, whether the moon reaches it (the buildings' shadows in the moonlight, which tell in a blackout)
  gMoon = 1.0;
  if (u.moonlight > 0.02 && u.day < 0.99 && cl.depth < 3000.0 && cl.kind != KIND_ROOM) {
    let t = cl.depth;
    let P = vec3f(u.px + rdx * t, u.py + rdy * t, max(0.0, u.eye - m * t + A * t * t));
    gMoon = dirLit(P.x, P.y, P.z, moonDir());
  }
  let paint = gMat == MAT_PAINT;
  var lit = light(cl);
  // (only where the room is still what this cell shows: a pole, a sign or a person in front of the window hides it)
  if (thruK > 0.0 && cl.depth == thruD) {
    lit.c = mix(lit.c, thru * thruPane * vec3f(0.9, 0.95, 1.0) + vec3f(4.0, 6.0, 9.0), thruK);
    if (thruK > 0.5 && lit.ch == EQ) { lit.ch = thruCh; }  }
  if (paint) { refl *= mix(vec3f(1.0), gTint, CAR_METAL); }
  if (rw > 0.03) { lit.c = lit.c * (1.0 - rw) + refl * rw; gGlow = max(gGlow, rGlow * rw); }
  // the lamps' cones in the air (stronger in the rain), over all of it (as bright as the eye takes them)
  if (inc.state == 0u) { lit.c += lampCones(gid.x, gid.y, rdx, rdy, m, cl.depth) * pow(u.adapt, 1.0 / 2.2); }
  store(i, n, fallOver(handOver(display(lit), gid.x, gid.y, handD), rdx, rdy, m, inc.nearT));
}
`;
}
