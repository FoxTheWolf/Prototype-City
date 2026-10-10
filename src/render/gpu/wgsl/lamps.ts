export const lampsWGSL = (): string => /* wgsl */ `// ---- light (lightmap.ts, lights.ts, lightAt): the street lamps' pools and this frame's dynamic lights
fn lampCorner(i: u32, f: f32, sh: vec4f) -> vec3f {
  let w = lmap[i];
  if (w == 0u || f <= 0.0) { return vec3f(0.0); }
  let id = w >> 8u; let n = (id - 1u) * 6u; let g = f32(w & 255u) / 255.0 * f;
  // (the shadow of what stands between it and the lamp, for the two lamps of the nearest metre: sh = id, lit, id, lit)
  let k = select(select(1.0, sh.w, f32(id) == sh.z), sh.y, f32(id) == sh.x);
  return vec3f(lampColF(u32(n)), lampColF(u32(n + 1u)), lampColF(u32(n + 2u))) * (g * k);
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
  let dz = lampColF(u32(n + 5u)) - Q.z;
  if (dz <= 0.1) { return vec3f(0.0); }
  let rr = length(vec2f(Q.x - lampColF(u32(n + 3u)), Q.y - lampColF(u32(n + 4u)))); let R = dz * CONE_TAN;
  if (rr >= R) { return vec3f(0.0); }
  let e = 1.0 - rr / R;
  return vec3f(lampColF(u32(n)), lampColF(u32(n + 1u)), lampColF(u32(n + 2u))) * (e * e / (1.0 + (dz * dz + rr * rr) / 12.0));
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
        L += linL((lampCorner(i0, (1.0 - tx) * (1.0 - ty), sh) + lampCorner(i0 + 1u, tx * (1.0 - ty), sh) + lampCorner(i0 + u32(LW), (1.0 - tx) * ty, sh) + lampCorner(i0 + u32(LW) + 1u, tx * ty, sh)) * zk);
      }
    }
  }
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
      let lz = select((zt - pz) / (zt - zf), 1.0, pz <= zf);
      if (lz <= 0.0) { continue; }
      let kind = u32(dlF(u32(o))); let R = dlF(u32(o + 7u));
      let dx = px - dlF(u32(o + 1u)); let dy = py - dlF(u32(o + 2u));
      if (kind == 3u) {
        // a wall floodlight (floodBeam in lights.ts): the beam up the wall, thin out from it, and a little
        // spill round the lamp on the pavement; the wall itself is painted in wallCell with the same cone
        let s = dx * dlF(u32(o + 5u)) + dy * dlF(u32(o + 6u));
        if (s < 0.1 - FLOOD_OUT) { continue; }
        let a = -dx * dlF(u32(o + 6u)) + dy * dlF(u32(o + 5u)); let z = max(pz, 0.0);
        let w = 1.4 + 0.55 * z; let fz = min(1.0, z / 1.5) * pow(max(0.0, 1.0 - z / zf), 1.2);
        let own = clamp((a * a + s * s - 0.06) / 0.1, 0.0, 1.0); // not the fixture's own housing
        let sc = s + FLOOD_OUT * min(1.0, z / 4.0); // the beam leans in to meet the wall
        L += linL(vec3f(dlF(u32(o + 10u)), dlF(u32(o + 11u)), dlF(u32(o + 12u))) * own * (fz * exp(-(a * a + sc * sc * 4.0) / (w * w)) + 0.3 * exp(-(a * a + s * s) / 0.6) * max(0.0, 1.0 - z)));
        continue;
      }
      let d = length(vec2f(dx, dy));
      if (d >= R) { continue; }
      var f = (1.0 - d / R) * (1.0 - d / R);
      if (kind == 1u) {
        let cs = (dx * dlF(u32(o + 3u)) + dy * dlF(u32(o + 4u))) / select(d, 1.0, d == 0.0); let c0 = dlF(u32(o + 5u));
        if (cs <= c0) { continue; }
        f *= min(1.0, (cs - c0) / ((1.0 - c0) * 0.5));
        // a car ahead in the beam (dlF(u32(6)): how far its back is, dlF(u32(15)): its side offset over that) shadows what is behind it,
        // a wedge as wide as a car at its back, widening behind; its back itself stays lit
        let cut = dlF(u32(o + 6u));
        if (cut > 0.0) {
          let s = dx * dlF(u32(o + 3u)) + dy * dlF(u32(o + 4u));
          if (s > cut) {
            let a = -dx * dlF(u32(o + 4u)) + dy * dlF(u32(o + 3u)); let w = 1.0 / cut;
            f *= 1.0 - (1.0 - smoothK(0.85 * w, 1.25 * w, abs(a / s - dlF(u32(o + 15u))))) * smoothK(cut + 0.1, cut + 0.7, s);
          }
        }
      }
      f *= lz;
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
