import { FLOOD_EDGE, FLOOD_HALF, FLOOD_KC, FLOOD_Z } from '../../lights';
import { LAMP_REC } from './common';
export const lampsWGSL = (): string => /* wgsl */ `// ---- light (lightmap.ts, lights.ts, lightAt): the street lamps' pools and this frame's dynamic lights
// (16.1c) a wall floodlight's cone (floodCone in lights.ts): a along the wall, s out from the lamp, z the height
const FLOOD_Z = ${FLOOD_Z}; const FLOOD_HALF = ${FLOOD_HALF}; const FLOOD_EDGE = ${FLOOD_EDGE}; const FLOOD_KC = ${FLOOD_KC.toFixed(1)};
fn floodCone(a: f32, s: f32, z: f32) -> f32 {
  let v = vec3f(a, s, z - FLOOD_Z); let l = length(v);
  if (l < 0.05) { return 0.0; }
  let th = acos(clamp(dot(v, vec3f(0.0, -sin(FLOOD_HALF), cos(FLOOD_HALF))) / l, -1.0, 1.0));
  let k = th / (FLOOD_HALF * 0.6);
  return (1.0 - smoothK(FLOOD_HALF - FLOOD_EDGE, FLOOD_HALF + FLOOD_EDGE, th)) * (0.35 + 0.65 * exp(-k * k)) * FLOOD_KC / (l * l + 0.5);
}
/** The same cone on its wall (FLOOD_OUT in from the lamp): with the slant it meets the wall at. */
fn floodWall(a: f32, z: f32) -> f32 { let l = length(vec3f(a, FLOOD_OUT, z - FLOOD_Z)); return floodCone(a, -FLOOD_OUT, z) * FLOOD_OUT / max(l, 0.05); }
// ---- (16.1c, part 3) a street lamp as a luminaire: its light by the inverse square, the angle it meets the surface at, and
// its beam's profile (as an IES file would give it), nothing painted. The profile is made from the footprint it is designed
// to throw on the road (an ellipse round the point under the head, in mounting heights): a cobra head's type II, long along
// the street, some way across it, little to the house side; a post top's round. The intensity toward a direction is
// what gives that footprint where the direction meets the ground: E h^2 / cos^3(theta). Full cutoff: nothing above the head.
const LAMP_REC = ${LAMP_REC}u;
/** The footprint's reach, x the mounting height: along the street, to the street side, to the house side, and round (a post top). */
const LAMP_S = 2.3; const LAMP_F = 1.4; const LAMP_B = 0.45; const LAMP_O = 1.8;
/** Lamp id's light at P (normal N; zero: a point in the air, taking it as if it faced it), linear, 1 = the old pool's middle. */
fn lampLum(id: u32, P: vec3f, N: vec3f) -> vec3f {
  let n = (id - 1u) * LAMP_REC;
  let H = vec3f(lampColF(n + 3u), lampColF(n + 4u), lampColF(n + 5u));
  let V = H - P;
  if (V.z <= 0.05) { return vec3f(0.0); }
  // where the ray from the head through P meets the ground, from under the head, in mounting heights
  let g = -V.xy / V.z;
  let a = vec2f(lampColF(n + 6u), lampColF(n + 7u));
  var r2 = dot(g, g) / (LAMP_O * LAMP_O);
  if (dot(a, a) > 0.25) {
    let f = dot(g, a); let s = g.x * a.y - g.y * a.x; let rf = select(LAMP_B, LAMP_F, f > 0.0);
    r2 = (s * s) / (LAMP_S * LAMP_S) + (f * f) / (rf * rf);
  }
  if (r2 >= 1.0) { return vec3f(0.0); }
  let d2 = dot(V, V); let d = sqrt(d2);
  // the intensity that way (in the units where the ground under the head gets 1): (1 - r^2)^2 h^2 / cos^3 theta
  let ct = V.z / d; let I = (1.0 - r2) * (1.0 - r2) * H.z * H.z / (ct * ct * ct);
  let ci = select(1.0, max(0.0, dot(N, V) / d), dot(N, N) > 0.25);
  return linL(vec3f(lampColF(n), lampColF(n + 1u), lampColF(n + 2u))) * (I * ci / (d2 + 0.25));
}
/** How far from the viewer the street lamps' shadows of the objects are traced (m). */
const LAMP_SH_FAR = 40.0;
/**
 * The street lamps' cones in the air at night (CONE_DRY), stronger in falling rain or snow (CONE_WET by the precipitation): a short march along the view ray (to CONE_FAR),
 * each step lit by the two lamps of its metre if it is in the cone under their heads, the brighter near them.
 * The steps start at a fine-grained offset per cell (interleaved gradient noise), as the sun's rays do.
 */
const CONE_FAR = 32.0; const CONE_STEPS = 12; const CONE_K = 0.1; const CONE_DRY = 0.8; const CONE_WET = 1.6;
/** How much of the lamp's light the air sends to the eye (calibrated by eye against the old cone). */
const CONE_AIR = 0.35;
/** (16.1c) The air at Q lit by the lamp of light-map word w: the same luminaire as on the ground (lampLum), the air taking it from every side. */
fn coneLamp(w: u32, Q: vec3f) -> vec3f {
  if (w == 0u) { return vec3f(0.0); }
  return lampLum(w >> 8u, Q, vec3f(0.0)) * CONE_AIR;
}
/** (16.1c) A headlight's beam in the air (o: its record in the frame's lights): the pattern of headBeam (lights.ts) in 3D,
 *  between its cutoff and the road, brightest near the lamp. HEAD_AIR: its strength next to the street lamps' cones. */
const HEAD_AIR = 4.0; // (a headlight's beam is far more intense than a street lamp's spread: ~20000 cd against ~3000)
fn headAir(o: u32, Q: vec3f) -> vec3f {
  let dx = Q.x - dlF(u32(o + 1u)); let dy = Q.y - dlF(u32(o + 2u)); let ux = dlF(u32(o + 3u)); let uy = dlF(u32(o + 4u));
  let s = dx * ux + dy * uy; let R = dlF(u32(o + 7u));
  if (s <= 0.1 || s >= R) { return vec3f(0.0); }
  let a = -dx * uy + dy * ux; let phi = atan2(a, s); let pa = (phi - 0.05) / 0.33;
  let h = dlF(u32(o + 5u)); let zc = h + s * (dlF(u32(o + 8u)) + 0.27 * clamp(phi - 0.02, 0.0, 0.12));
  let below = (h - Q.z) / s; // the ray's slope down from the lamp: the beam fills 0 (the cutoff) to ~0.18 (the road nearby)
  let f = exp(-pa * pa) * (1.0 - smoothK(zc - 0.05, zc + 0.05, Q.z)) * (1.0 - smoothK(0.12, 0.2, below)) * (1.0 - s / R) / (1.0 + s * s / 30.0);
  return vec3f(dlF(u32(o + 10u)), dlF(u32(o + 11u)), dlF(u32(o + 12u))) * f;
}
fn lampCones(gx: u32, gy: u32, rdx: f32, rdy: f32, m: f32, depth: f32) -> vec3f {
  let k = (CONE_DRY + CONE_WET * u.precip) * (1.0 - u.day);
  if (k < 0.03) { return vec3f(0.0); }
  // (16.1c) the headlights' beams show only in falling rain or snow (in the dry air they hardly do)
  let kh = CONE_WET * u.precip * (1.0 - u.day) * HEAD_AIR;
  var accH = vec3f(0.0);
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
    if (kh > 0.01 && Q.z < 2.5) {
      let bi = ifloor(Q.x / DCELL) - i32(u.dbx); let bj = ifloor(Q.y / DCELL) - i32(u.dby);
      if (bi >= 0 && bj >= 0 && bi < DSIDE && bj < DSIDE) {
        let c = u32(bj * DSIDE + bi);
        for (var q = doffU(u32(c)); q < doffU(u32(c + 1u)); q++) {
          let o = didxU(u32(q)) * 16u;
          if (u32(dlF(u32(o))) == 1u) { accH += headAir(o, Q) * dt; }
        }
      }
    }
  }
  return acc * (CONE_K * k) + accH * (CONE_K * kh);
}
/** How much of lamp id's light reaches P past the street objects (1 clear). */
fn lampShadow(P: vec3f, id: u32) -> f32 {
  let n = (id - 1u) * LAMP_REC;
  return footShadow(P, vec3f(lampColF(u32(n + 3u)), lampColF(u32(n + 4u)), lampColF(u32(n + 5u))));
}
fn lvSum(o: u32, n: u32, p: f32) -> f32 {
  let k = u32(floor(p));
  if (k >= n) { return dlvF(u32(o + k)); }
  return dlvF(u32(o + k)) + (dlvF(u32(o + k + 1u)) - dlvF(u32(o + k))) * (p - f32(k));
}
/** A light's value as the old sRGB-coded light (0-255, its falloff in it) made linear (1 = white), to be summed. */
fn linL(s: vec3f) -> vec3f { return pow(max(s, vec3f(0.0)) / 255.0, vec3f(2.2)); }
// nr: the lit surface's normal (zero: none, a raindrop; it takes the light as if it faced it)
// (16.1b) the light in LINEAR units (1 = white), every light made linear before it is summed: summed as sRGB and raised
// to 2.2 after, two equal lamps gave 4.6 times one, and two knees squeezed the sum back
/** (16.1c) The street lamps' light at P (normal N): every lamp the light map names round P (its metre's four corners, two
 *  each, each lamp once), by lampLum; the two that light it most shaded by what stands between (shade: near the viewer). */
fn lampPools(P: vec3f, N: vec3f, shade: bool) -> vec3f {
  let fx = P.x - u.lox; let fy = P.y - u.loy; let ix = ifloor(fx); let iy = ifloor(fy);
  if (ix < 0 || iy < 0 || ix >= LW - 1 || iy >= LW - 1) { return vec3f(0.0); }
  var ids = array<u32, 8>(0u, 0u, 0u, 0u, 0u, 0u, 0u, 0u); var ls = array<vec3f, 8>();
  var m = 0u; var L = vec3f(0.0);
  for (var k = 0u; k < 8u; k++) {
    let w = lmap[u32(iy * LW + ix) + (k & 1u) + u32(LW) * ((k >> 1u) & 1u) + (k >> 2u) * u32(LW * LW)];
    if (w == 0u) { continue; }
    let id = w >> 8u; var seen = false;
    for (var j = 0u; j < m; j++) { if (ids[j] == id) { seen = true; } }
    if (seen) { continue; }
    ids[m] = id; ls[m] = lampLum(id, P, N); L += ls[m]; m++;
  }
  if (!shade || m == 0u) { return L; }
  // the two brightest, shaded (the others light it a fraction as much)
  var b0 = 0u; var b1 = 8u;
  for (var j = 1u; j < m; j++) { if (luma(ls[j]) > luma(ls[b0])) { b0 = j; } }
  for (var j = 0u; j < m; j++) { if (j != b0 && (b1 == 8u || luma(ls[j]) > luma(ls[b1]))) { b1 = j; } }
  let Ps = vec3f(P.x, P.y, max(P.z, 0.03)) + N * 0.06;
  if (luma(ls[b0]) > 1e-4) { L -= ls[b0] * (1.0 - lampShadow(Ps, ids[b0])); }
  if (b1 < 8u) { if (luma(ls[b1]) > 1e-4) { L -= ls[b1] * (1.0 - lampShadow(Ps, ids[b1])); } }
  return L;
}
/** (16.1c) The street lamps' light at a point a ray of the indirect light met (gi.ts), without their object shadows, in light()'s units. */
fn giLamps(P: vec3f, N: vec3f) -> vec3f { return lampPools(P, N, false) * (LAMP_RECV * LAMP_E); }
fn lightAt(px: f32, py: f32, pz: f32, nr: vec3f) -> vec3f {
  var L = vec3f(0.0);
  // the panels add up in linear light (their colors come linear; 1 = white): summed as sRGB, raised to 2.2 in the
  // finish, a light fell off as 1 / d^4.4 and a sign lit only the wall it hung on
  var Lp = vec3f(0.0);
  // (16.1c) the street lamps, as luminaires; what stands between shades them out to LAMP_SH_FAR from the viewer (the cost)
  L += lampPools(vec3f(px, py, pz), nr, u.day < 0.95 && length(vec2f(px - u.px, py - u.py)) < LAMP_SH_FAR);
  let bi = ifloor(px / DCELL) - i32(u.dbx); let bj = ifloor(py / DCELL) - i32(u.dby);
  if (bi >= 0 && bj >= 0 && bi < DSIDE && bj < DSIDE) {
    let c = u32(bj * DSIDE + bi);
    for (var q = doffU(u32(c)); q < doffU(u32(c + 1u)); q++) {
      let o = didxU(u32(q)) * 16u;
      let zf = dlF(u32(o + 8u)); let zt = dlF(u32(o + 9u));
      if (dlF(u32(o)) >= 4.0) {
        // a lit panel (DynLights.panel): a sign, a screen, a shop window, a neon tube; its nearest point in 3D,
        // how it faces the point (its wrap: a bare tube lights all round) and how the surface faces it
        let wrap = dlF(u32(o)) - 4.0; let enx = dlF(u32(o + 5u)); let eny = dlF(u32(o + 6u));
        var ax = px - dlF(u32(o + 1u)); var ay = py - dlF(u32(o + 2u));
        if (ax * enx + ay * eny < -0.3 && wrap < 0.9) { continue; }
        let sx = dlF(u32(o + 3u)) - dlF(u32(o + 1u)); let sy = dlF(u32(o + 4u)) - dlF(u32(o + 2u)); let L2 = sx * sx + sy * sy;
        let t = select(0.0, clamp((ax * sx + ay * sy) / L2, 0.0, 1.0), L2 > 1e-4);
        let v = vec3f(ax - sx * t, ay - sy * t, pz - clamp(pz, zf, zt));
        let d2 = dot(v, v); let R = dlF(u32(o + 7u));
        if (d2 >= R * R) { continue; }
        let d = sqrt(d2) + 0.05;
        let ce = mix(max(0.0, (v.x * enx + v.y * eny) / d), 1.0, wrap);
        let cr = select(1.0, mix(max(0.0, -dot(nr, v) / d), 1.0, PANEL_RECV_WRAP), dot(nr, nr) > 0.25);
        // (only the part of it within ~d of the point counts: a long tube falls off as 1 / d, a wide panel up close is even)
        // (a neon tube up a corner, wrap ~1, lights nothing above its top: the cornice and the parapet hide it from
        // the roof, which it flooded pink, C3)
        if (wrap > 0.9 && pz > zt + 1.0) { continue; }
        let ext = 2.0 * d + 0.3; let S = PANEL_S * clamp(sqrt(L2), 0.3, ext) * clamp(zt - zf, 0.3, ext); let w = (1.0 - d2 / (R * R)) * select(1.0, zt + 1.0 - pz, wrap > 0.9 && pz > zt);
        var lv = 1.0;
        let n = u32(dlF(u32(o + 14u)));
        if (n > 0u) {
          let h = (0.3 + 0.5 * sqrt(d2)) * dlF(u32(o + 15u)); let cc = t * f32(n);
          let a = max(0.0, cc - h); let b = min(f32(n), cc + h); let lo = u32(dlF(u32(o + 13u)));
          lv = (lvSum(lo, n, b) - lvSum(lo, n, a)) / (b - a);
        }
        Lp += vec3f(dlF(u32(o + 10u)), dlF(u32(o + 11u)), dlF(u32(o + 12u))) * (ce * cr * (S / (d2 + S)) * w * w * lv);
        continue;
      }
      let kind = u32(dlF(u32(o))); let R = dlF(u32(o + 7u));
      let dx = px - dlF(u32(o + 1u)); let dy = py - dlF(u32(o + 2u));
      if (kind == 1u) {
        // (16.1c) a headlight: its beam's pattern (headBeam in lights.ts; zf here is its cutoff's slope, o + 5 its height)
        let ux = dlF(u32(o + 3u)); let uy = dlF(u32(o + 4u));
        let s = dx * ux + dy * uy; let a = -dx * uy + dy * ux;
        if (s <= 0.05 || s >= R) { continue; }
        let phi = atan2(a, s);
        let zc = dlF(u32(o + 5u)) + s * (zf + 0.27 * clamp(phi - 0.02, 0.0, 0.12)); let soft = 0.04 + 0.015 * s;
        let pa = (phi - 0.05) / 0.33;
        var f = exp(-pa * pa) * smoothK(0.3, 4.0, s) * pow(1.0 - s / R, 1.5) * (1.0 - smoothK(zc - soft, zc + soft, pz));
        // a car ahead in the beam (dlF(u32(6)): how far its back is, dlF(u32(15)): its side offset over that) shadows what is behind it,
        // a wedge as wide as a car at its back, widening behind; its back itself stays lit
        let cut = dlF(u32(o + 6u));
        if (cut > 0.0 && s > cut) {
          let w = 1.0 / cut;
          f *= 1.0 - (1.0 - smoothK(0.85 * w, 1.25 * w, abs(a / s - dlF(u32(o + 15u))))) * smoothK(cut + 0.1, cut + 0.7, s);
        }
        L += linL(vec3f(dlF(u32(o + 10u)), dlF(u32(o + 11u)), dlF(u32(o + 12u))) * f);
        continue;
      }
      let lz = select((zt - pz) / (zt - zf), 1.0, pz <= zf);
      if (lz <= 0.0) { continue; }
      if (kind == 3u) {
        // a wall floodlight (floodBeam in lights.ts): its cone (floodCone) on what stands in it, and a little
        // spill round the lamp on the pavement; the wall itself is painted in wallCell with the same cone
        let s = dx * dlF(u32(o + 5u)) + dy * dlF(u32(o + 6u));
        if (s < 0.1 - FLOOD_OUT) { continue; }
        let a = -dx * dlF(u32(o + 6u)) + dy * dlF(u32(o + 5u)); let z = max(pz, 0.0);
        let own = clamp((a * a + s * s - 0.06) / 0.1, 0.0, 1.0); // not the fixture's own housing
        L += linL(vec3f(dlF(u32(o + 10u)), dlF(u32(o + 11u)), dlF(u32(o + 12u))) * own * (floodCone(a, s, z) * pow(max(0.0, 1.0 - z / zf), 1.2) + 0.3 * exp(-(a * a + s * s) / 0.6) * max(0.0, 1.0 - z)));
        continue;
      }
      let d = length(vec2f(dx, dy));
      if (d >= R) { continue; }
      let f = (1.0 - d / R) * (1.0 - d / R) * lz;
      L += linL(vec3f(dlF(u32(o + 10u)), dlF(u32(o + 11u)), dlF(u32(o + 12u))) * f);
    }
  }
  return L + Lp;
}

// what a cell ends up with before the finish
struct Cell { ch: u32, c: vec3f, bg: vec3f, depth: f32, kind: u32, sun: f32 };
fn sat(c: vec3f) -> vec3f { return clamp(c, vec3f(0.0), vec3f(255.0)); }
fn colAt(o: u32) -> vec3f { return vec3f(bldF(u32(o)), bldF(u32(o + 1u)), bldF(u32(o + 2u))); }

`;
