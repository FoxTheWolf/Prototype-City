import { BLK } from './common';
import { LITTER } from '../../raycaster';

export const groundWGSL = (): string => /* wgsl */ `// ---- the ground (renderWorld's ground loop)
// past the city's edge: bare dusty ground
fn outsideGround(wx: f32, wy: f32, rd: f32) -> Cell {
  // (the darkening with distance is the night's; by day finish's haze takes it to the horizon's color. By day a dry
  //  field's brown, near the asphalt's: at 110 the sunlit plain lay brighter than the sky, a cream band under it, C3)
  let day = u.day; let fog = 1.0 - min(1.0, rd / 2500.0) * 0.85 * (1.0 - day);
  let hv = hash3(ifloor(wx / 6.0), ifloor(wy / 6.0), 5); let tex = (0.9 + 0.15 * hv) * fog * (0.45 + 0.55 * day);
  return Cell(32u, mix(vec3f(55.0, 55.0, 60.0), vec3f(74.0, 70.0, 62.0), day) * tex, vec3f(7.0, 8.0, 12.0), rd, KIND_BLOCK, u.sunZ);
}
fn groundCell(rd: f32, rdx: f32, rdy: f32) -> Cell {
  let wx = gOX + rdx * rd; let wy = gOY + rdy * rd;
  let W = f32(nXC); let Hh = f32(nYC);
  let bg = vec3f(7.0, 8.0, 12.0);
  if (wx < 0.0 || wy < 0.0 || wx >= W || wy >= Hh) { return outsideGround(wx, wy, rd); }
  if (rd > GROUND_FAR) { return Cell(DOT, mix(vec3f(28.0, 24.0, 32.0), vec3f(70.0, 72.0, 78.0), u.day), bg, rd, KIND_GROUND, 0.0); }
  let gx = i32(xcU(u32(u32(wx)))); let gy = i32(ycU(u32(u32(wy))));
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
      if (roadX) { b0a = xbF(u32(gx)); b0b = xbF(u32(gx + 1)); e0a = ybF(u32(gy)); e0b = ybF(u32(gy + 1)); across = wx - (b0a + b0b) * 0.5; along = wy; }
      else { b0a = ybF(u32(gy)); b0b = ybF(u32(gy + 1)); e0a = xbF(u32(gx)); e0b = xbF(u32(gx + 1)); across = wy - (b0a + b0b) * 0.5; along = wx; }
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
      if (roadX) { let xo = sgU(u32(7)) + u32(gx >> 1) * 2u; xa0 = bitcast<f32>(sgU(u32(xo))); xa1 = bitcast<f32>(sgU(u32(xo + 1u))); }
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
    let flags = u32(blkF(u32(o + 7u))); let opk = flags & 3u; let diag = (flags >> 2u) & 7u; let square = (flags & 64u) != 0u;
    var edge = min(min(wx - blkF(u32(o)), blkF(u32(o + 2u)) - wx), min(wy - blkF(u32(o + 1u)), blkF(u32(o + 3u)) - wy));
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
      let mx = (blkF(u32(o)) + blkF(u32(o + 2u))) * 0.5; let my = (blkF(u32(o + 1u)) + blkF(u32(o + 3u))) * 0.5;
      if (abs(wx - mx) < 1.5 || abs(wy - my) < 1.5) { ch = select(COM, DOT, hv < 0.5); c = vec3f(95.0, 85.0, 70.0); }
      else { ch = select(select(SEMI, COM, hv < 0.7), QUO, hv < 0.4); c = vec3f(40.0, 95.0 + hv * 40.0, 45.0); mat = MAT_LEAF; }
    } else if (opk == 2u) {
      let fx = fract(wx / 2.5); let fy = fract(wy / 2.5);
      ch = select(COL, PLUS, fx < 0.06 || fy < 0.06); c = vec3f(92.0, 86.0, 80.0);
      if (square) { let dark = ((ifloor(wx / 2.5) + ifloor(wy / 2.5)) & 1) == 1; c = select(vec3f(108.0, 104.0, 108.0), vec3f(62.0, 60.0, 66.0), dark); if (!dark && fx > 0.45 && fx < 0.55 && fy > 0.45 && fy < 0.55) { ch = O; } }
    } else if (opk == 3u) {
      let long = blkF(u32(o + 2u)) - blkF(u32(o)) > blkF(u32(o + 3u)) - blkF(u32(o + 1u));
      let a = (select(wx, wy, long) - select(blkF(u32(o)), blkF(u32(o + 1u)), long)) % 4.5; let uu = select(wy, wx, long);
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
  if (u.snow > 0.02) {
    let sk = u.snow * select(1.0, 0.5, roadX || roadY || pastD < 0.0);
    c += (vec3f(200.0, 205.0, 218.0) - c) * sk;
    if (sk > 0.35) { ch = select(select(DOT, SEMI, hv < 0.85), COL, hv < 0.55); }
  }
  if (u.wet > 0.02) {
    let wk = u.wet * (1.0 - u.snow);
    // (darker, less than before the reflections: the mirror now takes its share of the light)
    c *= vec3f(1.0 - 0.2 * wk, 1.0 - 0.2 * wk, 1.0 - 0.17 * wk);
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
  gEm = vec3f(0.0); gEmK = 1.0; gIl = vec3f(0.0); gTag = rd; gPos = vec3f(wx, wy, 0.0); gMat = mat; gNrm = vec3f(0.0, 0.0, 1.0);
  // how wet the spot is: a film everywhere it rains, puddles in the low spots (more on the asphalt)
  gWet = 0.0;
  if (u.wet > 0.02 && mat != MAT_LEAF) {
    let pd = smoothK(select(0.62, 0.55, mat == MAT_ASPHALT), 0.72, noise(wx / 5.0 + 13.0, wy / 5.0 + 7.0) * 0.7 + noise(wx / 1.7, wy / 1.7) * 0.3);
    gWet = u.wet * (1.0 - u.snow) * select(0.15 + 0.6 * pd, 0.45 + 0.55 * pd, mat == MAT_ASPHALT);
  }
  return Cell(ch, c, bg, rd, KIND_GROUND, 0.0);
}

/** The day's sky and sun in the old units (the rooms' daylight until part 4 of docs/plano-luz-fisica.md). */
const DAY_SKY = 1.1; const DAY_SUN = 4.2;
/** The day's exposure. */
// (playtest 2026-10-07: the day read dark and too contrasted; brighter and less saturated, the night untouched; was 1.3 and 0.75; the user asked for 1.2)
const DAY_EXPO = 1.2;
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
`;
