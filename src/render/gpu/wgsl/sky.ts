import { LAT } from '../../../sim/clock';
import { PENUMBRA, UMBRA } from '../../sky';

export const skyWGSL = (): string => /* wgsl */ `// ---- the sky (sky.ts): gradient, stars, the moon with its phase, the cloud deck lit from below, the sun's glow
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
// how much the ground under a point lights the clouds: the city's glow
fn glowBelow(x: f32, y: f32) -> vec3f {
  let half = min(u.cityW, u.cityH) * 0.5; let rc = length(vec2f(x - u.cityW * 0.5, y - u.cityH * 0.5)) / half;
  let spread = exp(-(rc / 2.6) * (rc / 2.6));
  let cd = length(vec2f(x - u.ccx, y - u.ccy)) / (min(u.cityW, u.cityH) * 0.6);
  let city = spread * (0.75 + 0.25 * exp(-cd * cd)) * u.cityLit;
  return vec3f(48.0, 33.0, 10.0) * city;
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
  let moonCol = u.moonEl > -MOON_R && abs(dA) * cos(u.moonEl) < MOON_R * 3.0;
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
      let w = SG_STARS + k * 4u; let sv = vec3f(bitcast<f32>(sgU(u32(w))), bitcast<f32>(sgU(u32(w + 1u))), bitcast<f32>(sgU(u32(w + 2u))));
      let c = dot(sv, sd);
      if (c < cut) { continue; }
      if (abs(dot(sv, sr)) < hw * c && abs(dot(sv, su)) < hh * c) {
        let p = sgU(u32(w + 3u)); starC = vec3f(f32(p & 255u), f32((p >> 8u) & 255u), f32((p >> 16u) & 255u));
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

`;
