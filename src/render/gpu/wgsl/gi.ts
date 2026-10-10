import { BLD, BLK } from './common';
import { SKY_K } from '../../atmosphere';

/** (16.1c) The indirect light's world cache (docs/plano-luz-fisica.md, part 2): slots, and words per slot in each buffer. */
export const GI_SLOTS = 1 << 18, GI_ACC_W = 5, GI_RES_W = 4;

/**
 * (16.1c) The indirect light by rays (docs/plano-luz-fisica.md, part 2): each cell sends rays from its point into its
 * hemisphere; a ray that escapes brings the sky's light that way (its spherical harmonics, atmosphere.ts skySH), one that
 * hits a building or the ground brings what leaves it there (its albedo x the sun on it past the shadows + the cache's
 * light there, the bounces after the first). Each cell adds its samples into a cache held in the world (gia), which a
 * small pass blends every frame into the light read back (gir): stable, tied to places, not to the screen.
 * Units: radiance as the sky's (SKY_K x the atmosphere's, the sun's irradiance SKY_K); the cache holds the mean
 * radiance over the hemisphere (the irradiance over pi), so a surface sends back albedo x it.
 */
export const giWGSL = (): string => /* wgsl */ `// ---- (16.1c) the indirect light by rays and the world cache (gi.ts)
const GI_SLOTS = ${GI_SLOTS}u; const GI_FAR = 400.0; const GI_FIX = 1024.0; const GI_SUN = ${(SKY_K * 0.9).toFixed(3)};
/** The sky's light along d (unit), from its harmonics (never below zero: their ringing near the horizon's step). */
fn skySH(d: vec3f) -> vec3f {
  let x = d.x; let y = d.y; let z = d.z;
  let Y = array<f32, 9>(0.282095, 0.488603 * y, 0.488603 * z, 0.488603 * x, 1.092548 * x * y, 1.092548 * y * z, 0.315392 * (3.0 * z * z - 1.0), 1.092548 * x * z, 0.546274 * (x * x - y * y));
  let c = array<vec3f, 9>(vec3f(u.sh0, u.sh1, u.sh2), vec3f(u.sh3, u.sh4, u.sh5), vec3f(u.sh6, u.sh7, u.sh8), vec3f(u.sh9, u.sh10, u.sh11),
    vec3f(u.sh12, u.sh13, u.sh14), vec3f(u.sh15, u.sh16, u.sh17), vec3f(u.sh18, u.sh19, u.sh20), vec3f(u.sh21, u.sh22, u.sh23), vec3f(u.sh24, u.sh25, u.sh26));
  var L = vec3f(0.0);
  for (var k = 0; k < 9; k++) { L += c[k] * Y[k]; }
  return max(L, vec3f(0.0));
}
/** What giTrace met: its horizontal distance (-1: nothing, the sky), the face's normal, the building (-1: the ground). */
var<private> giT: f32 = -1.0;
var<private> giN: vec3f = vec3f(0.0, 0.0, 1.0);
var<private> giQ: i32 = -1;
/** A ray from P along D (unit) against the buildings (boxes, round towers, cut corners: the grid of blocks, as dirLit) and the ground. */
fn giTrace(P: vec3f, D: vec3f) {
  giT = -1.0; giQ = -1; giN = vec3f(0.0, 0.0, 1.0);
  let Lh = length(D.xy);
  // the ground, if it goes down (its horizontal distance)
  var tG = 1e9;
  if (D.z < -1e-4) { tG = select(P.z / -D.z * Lh, 0.0, Lh < 1e-4); }
  if (Lh < 1e-4) { if (D.z < 0.0) { giT = 0.0; } return; }
  let rdx = D.x / Lh; let rdy = D.y / Lh; let k = D.z / Lh;
  let ix = select(1e12, 1.0 / rdx, rdx != 0.0); let iy = select(1e12, 1.0 / rdy, rdy != 0.0);
  let stX = select(1, -1, rdx < 0.0); let stY = select(1, -1, rdy < 0.0);
  let W = nXC; let H = nYC;
  var best = min(tG, GI_FAR);
  if (P.x >= 0.0 && P.y >= 0.0 && P.x < f32(W) && P.y < f32(H)) {
    var cx = i32(xcU(u32(P.x))); var cy = i32(ycU(u32(P.y)));
    let nx = i32(u.nxb) - 1; let ny = i32(u.nyb) - 1;
    var tx = (select(xbF(u32(cx + 1)), xbF(u32(cx)), rdx < 0.0) - P.x) * ix;
    var ty = (select(ybF(u32(cy + 1)), ybF(u32(cy)), rdy < 0.0) - P.y) * iy;
    var tIn = 0.0;
    for (var s = 0; s < 256; s++) {
      if (tIn >= best) { break; }
      let z = P.z + k * tIn;
      if (k >= 0.0 && z > SHADOW_TOP) { break; }
      if ((cx & 1) == 1 && (cy & 1) == 1) {
        let o = u32(((cy >> 1) * i32(u.nbx) + (cx >> 1)) * ${BLK});
        let b0 = i32(blkF(u32(o + 4u))); let b1 = i32(blkF(u32(o + 5u)));
        if (b1 > b0 && min(z, P.z + k * min(tx, ty)) < blkF(u32(o + 6u))) {
          for (var q0 = b0; q0 < b1; q0++) {
            let q = u32(q0 * ${BLD});
            let x0 = bldF(u32(q)); let y0 = bldF(u32(q + 1u)); let x1 = bldF(u32(q + 2u)); let y1 = bldF(u32(q + 3u)); let h = bldF(u32(q + 4u));
            var tN = 0.0; var tF = 0.0; var nN = vec2f(0.0);
            if (bldF(u32(q + 5u)) > 0.5) {
              let rr = (x1 - x0) * 0.5; let ox = P.x - (x0 + rr); let oy = P.y - (y0 + rr);
              let qb = ox * rdx + oy * rdy; let disc = qb * qb - (ox * ox + oy * oy - rr * rr);
              if (disc <= 0.0) { continue; }
              tN = -qb - sqrt(disc); tF = -qb + sqrt(disc);
              nN = normalize(vec2f(ox + rdx * tN, oy + rdy * tN));
            } else {
              let ax = (x0 - P.x) * ix; let bx = (x1 - P.x) * ix; let ay = (y0 - P.y) * iy; let by = (y1 - P.y) * iy;
              let tX = min(ax, bx); let tY = min(ay, by);
              tN = max(tX, tY); tF = min(max(ax, bx), max(ay, by));
              nN = select(vec2f(0.0, select(1.0, -1.0, rdy > 0.0)), vec2f(select(1.0, -1.0, rdx > 0.0), 0.0), tX > tY);
              if (bldF(u32(q + 6u)) > 0.5) {
                let knx = bldF(u32(q + 7u)); let kny = bldF(u32(q + 8u)); let kc = bldF(u32(q + 9u));
                let dn = knx * rdx + kny * rdy; let th = (kc - knx * P.x - kny * P.y) / dn;
                if (dn < 0.0) { if (th > tN) { tN = th; nN = vec2f(knx, kny); } } else if (dn > 0.0) { tF = min(tF, th); } else if (knx * P.x + kny * P.y > kc) { continue; }
              }
            }
            if (tF <= 0.03 || tN >= tF || tN >= best) { continue; }
            let zN = P.z + k * max(tN, 0.0);
            if (zN < h && tN > 0.0) { best = tN; giQ = i32(q); giN = vec3f(nN, 0.0); }
            else if (k < 0.0) {
              // over its edge, coming down onto its roof
              let tR = (h - P.z) / k;
              if (tR > max(tN, 0.0) && tR < tF && tR < best) { best = tR; giQ = i32(q); giN = vec3f(0.0, 0.0, 1.0); }
            }
          }
        }
      }
      if (tx < ty) { cx += stX; tIn = tx; if (cx < 0 || cx >= nx) { break; } tx = (select(xbF(u32(cx + 1)), xbF(u32(cx)), rdx < 0.0) - P.x) * ix; }
      else { cy += stY; tIn = ty; if (cy < 0 || cy >= ny) { break; } ty = (select(ybF(u32(cy + 1)), ybF(u32(cy)), rdy < 0.0) - P.y) * iy; }
    }
  }
  if (giQ >= 0 || best == tG) { giT = best; }
  if (giQ < 0 && giT >= 0.0) { giN = vec3f(0.0, 0.0, 1.0); }
}
// ---- the cache: a slot by the place (cells from 0.5 m near the eye to 8 m far) and the face it looks to
fn giKey(P: vec3f, N: vec3f) -> u32 {
  let d = length(P.xy - vec2f(u.px, u.py));
  let lv = u32(clamp(floor(log2(max(d, 1.0) / 6.0)), 0.0, 4.0)); let s = 0.5 * f32(1u << lv);
  let a = abs(N); var face = select(select(4u, 2u, a.y > a.z), 0u, a.x > a.y && a.x > a.z);
  face += select(0u, 1u, (face == 0u && N.x < 0.0) || (face == 2u && N.y < 0.0) || (face == 4u && N.z < 0.0));
  let ix = i32(floor(P.x / s)); let iy = i32(floor(P.y / s)); let iz = i32(floor(P.z / s));
  var h = (u32(ix) * 73856093u) ^ (u32(iy) * 19349663u) ^ (u32(iz) * 83492791u) ^ (face * 2654435761u) ^ (lv * 2246822519u);
  h = (h ^ (h >> 15u)) * 2246822519u; h = h ^ (h >> 13u);
  return max(h, 1u);
}
/** Adds a sample (the mean radiance over the hemisphere seen, x the exposure for the fixed point) to its slot. */
fn giAdd(key: u32, L: vec3f) {
  let x = min(L * evDayNight(), vec3f(64.0));
  var s = key % GI_SLOTS;
  for (var p = 0u; p < 4u; p++) {
    let o = s * ${GI_ACC_W}u;
    let r = atomicCompareExchangeWeak(&gia[o], 0u, key);
    if (r.exchanged || r.old_value == key) {
      atomicAdd(&gia[o + 1u], u32(x.x * GI_FIX)); atomicAdd(&gia[o + 2u], u32(x.y * GI_FIX)); atomicAdd(&gia[o + 3u], u32(x.z * GI_FIX));
      atomicAdd(&gia[o + 4u], 1u);
      return;
    }
    s = (s + 1u) % GI_SLOTS;
  }
}
/** The light the cache holds at a slot (-1: none yet). */
fn giGet(key: u32) -> vec4f {
  var s = key % GI_SLOTS;
  for (var p = 0u; p < 4u; p++) {
    let o = s * ${GI_RES_W}u;
    if (gir[o] == key) { return vec4f(bitcast<f32>(gir[o + 1u]), bitcast<f32>(gir[o + 2u]), bitcast<f32>(gir[o + 3u]), 1.0); }
    s = (s + 1u) % GI_SLOTS;
  }
  return vec4f(0.0, 0.0, 0.0, -1.0);
}
/** What leaves a ray's hit toward where it came from: its albedo x (the sun on it past the buildings + the cache there). */
fn giHit(P: vec3f, D: vec3f) -> vec3f {
  giTrace(P, D);
  if (giT < 0.0) { return skySH(D); }
  let Lh = max(length(D.xy), 1e-4);
  let H = P + D * (giT / Lh) + giN * 0.05;
  var A = vec3f(0.18, 0.18, 0.2); // (the ground: asphalt and pavement, part 1 gives the real ones)
  if (giQ >= 0) {
    let q = u32(giQ);
    A = lin(mix(colAt(q + 15u), vec3f(55.0, 62.0, 78.0), 0.3)) * 1.6;
    if (giN.z > 0.5) { A = vec3f(0.25); }
  }
  let S = sunVec();
  var E = vec3f(0.0);
  let ns = dot(giN, S);
  if (ns > 0.0 && S.z > 0.0) { E += sunLin() * (GI_SUN / 3.14159 * ns * (1.0 - 0.85 * u.cloud)) * dirLit(H.x, H.y, H.z, S); }
  let c = giGet(giKey(H, giN));
  if (c.w > 0.0) { E += c.xyz / evDayNight(); }
  return min(A, vec3f(0.9)) * E;
}
/** This cell's indirect light at P (normal N): two rays now into the cache, and the cache's light back (the mean radiance). */
fn giSample(P: vec3f, N: vec3f, gx: u32, gy: u32) -> vec3f {
  let t = vec3f(select(vec3f(0.0, 0.0, 1.0), vec3f(1.0, 0.0, 0.0), abs(N.z) > 0.9));
  let T = normalize(cross(t, N)); let B = cross(N, T);
  let fr = ifloor(u.sec * 60.0);
  let O = P + N * 0.06;
  var acc = vec3f(0.0);
  for (var i = 0; i < 2; i++) {
    let r1 = hash3(i32(gx), i32(gy), fr * 2 + i); let r2 = hash3(i32(gy) + 911, i32(gx), fr * 2 + i + 7);
    let ph = 6.2831853 * r1; let sr = sqrt(r2);
    let D = normalize(T * (cos(ph) * sr) + B * (sin(ph) * sr) + N * sqrt(max(0.0, 1.0 - r2)));
    acc += giHit(O, D);
  }
  let key = giKey(P, N);
  giAdd(key, acc * 0.5);
  let c = giGet(key);
  return select(acc * 0.5, c.xyz / evDayNight(), c.w > 0.0 && u.giDbg < 2.5);
}
`;

/** The pass that blends each slot's samples of this frame into the light read back, and empties it for the next. */
export const GI_RESOLVE_WGSL = /* wgsl */ `
@group(0) @binding(0) var<storage, read_write> gia: array<u32>;
@group(0) @binding(1) var<storage, read_write> gir: array<u32>;
/** How much of a slot's light this frame's samples replace (~0.3 s to settle at 60 fps). */
const GI_BLEND = 0.12; const GI_FIX = 1024.0;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) g: vec3u) {
  let s = g.x; if (s >= ${GI_SLOTS}u) { return; }
  let a = s * ${GI_ACC_W}u; let r = s * ${GI_RES_W}u;
  let n = gia[a + 4u]; let key = gia[a];
  if (n > 0u) {
    let L = vec3f(f32(gia[a + 1u]), f32(gia[a + 2u]), f32(gia[a + 3u])) / (GI_FIX * f32(n));
    var o = L;
    if (gir[r] == key) { o = mix(vec3f(bitcast<f32>(gir[r + 1u]), bitcast<f32>(gir[r + 2u]), bitcast<f32>(gir[r + 3u])), L, max(GI_BLEND, 1.0 / f32(n + 1u))); }
    gir[r] = key; gir[r + 1u] = bitcast<u32>(o.x); gir[r + 2u] = bitcast<u32>(o.y); gir[r + 3u] = bitcast<u32>(o.z);
  }
  gia[a] = 0u; gia[a + 1u] = 0u; gia[a + 2u] = 0u; gia[a + 3u] = 0u; gia[a + 4u] = 0u;
}
`;
