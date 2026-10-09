import { AD_BG } from '../../raycaster';
import { BLD } from './common';

export const wallWGSL = (): string => /* wgsl */ `// ---- a wall (wallColumn): the facade by its style, its windows, and the lights on it
// (m and A: the ray's drop and the curve's, to find heights on it a little nearer, at a relief or the scaffolding)
fn wallCell(bk: i32, t: f32, side: i32, rdx: f32, rdy: f32, zw: f32, dz: f32, m: f32, A: f32) -> Cell {
  let q = u32(bk * ${BLD});
  let x0 = bldF(u32(q)); let y0 = bldF(u32(q + 1u)); let x1 = bldF(u32(q + 2u)); let y1 = bldF(u32(q + 3u)); let H = bldF(u32(q + 4u));
  let hx = gOX + t * rdx; let hy = gOY + t * rdy;
  let style = i32(bldF(u32(q + 10u))); let lit = bldF(u32(q + 11u)); let feat = bldF(u32(q + 18u));
  let shop = bldF(u32(q + 19u)) > 0.5;
  let win = colAt(q + 12u); let frame = colAt(q + 15u); let sign = colAt(q + 21u);
  // where along the face, its light, the face's span
  var along = 0.0; var lightK = 1.0; var face = 0; var dn = 1.0; var wsun = 0.0; var nw = vec2f(0.0);
  if (side == 2) {
    let rr = (x1 - x0) * 0.5; let nx = (hx - x0 - rr) / rr; let ny = (hy - y0 - rr) / rr;
    along = (atan2(ny, nx) + 3.14159265) * rr; lightK = 0.72 + 0.28 * abs(nx);
    wsun = nx * u.sunX + ny * u.sunY; nw = normalize(vec2f(nx, ny));
  } else if (side == 3) {
    let kx = bldF(u32(q + 7u)); let ky = bldF(u32(q + 8u));
    along = hx * ky - hy * kx; lightK = 0.72 + 0.28 * abs(kx); face = 4; dn = kx * rdx + ky * rdy;
    wsun = kx * u.sunX + ky * u.sunY; nw = vec2f(kx, ky);
  } else {
    along = select(hx, hy, side == 0); lightK = select(0.72, 1.0, side == 0);
    if (side == 0) { face = select(0, 1, rdx < 0.0); dn = rdx; nw = vec2f(select(1.0, -1.0, rdx > 0.0), 0.0); } else { face = select(3, 2, rdy > 0.0); dn = rdy; nw = vec2f(0.0, select(1.0, -1.0, rdy > 0.0)); }
    wsun = select(select(select(u.sunY, -u.sunY, face == 2), u.sunX, face == 1), -u.sunX, face == 0);
  }
  var f0 = -1e9; var f1 = 1e9;
  if (side != 2) { f0 = bldF(u32(q + 36u + u32(face) * 2u)); f1 = bldF(u32(q + 37u + u32(face) * 2u)); }
  let dAlong = u.colW * t / max(1e-6, abs(dn));
  // (16.1b) the face's own color: its light comes from its normal and the haze from the sky, both in light()
  let shade0 = 1.0; var shade = shade0;
  let winLight = 1.0;
  // the building's power now, its signs' (never on the generator), and each window's
  let sub = i32(bldF(u32(q + 46u))); let gen = bldF(u32(q + 47u)) > 0.5;
  let cx = (x0 + x1) * 0.5; let cy = (y0 + y1) * 0.5;
  let pw = power(sub, cx, cy, bk, gen, bk, 0.25);
  let ad = select(pw, power(sub, cx, cy, bk, false, bk, 0.25), gen);
  let elec = winLight * pw; let adElec = winLight * ad;
  let switched = subsF(u32(u32(sub) * 4u)) >= 0.0;
  // (13.22) the far windows by the people's average, as the rooms seen near (litShare)
  let litK = lit * litShare(style == 0 || style == 1);
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
  if (side == 0) { da = rdy; } else if (side == 1) { da = rdx; } else if (side == 3) { da = rdx * bldF(u32(q + 8u)) - rdy * bldF(u32(q + 7u)); }
  let along0 = along; var z = zw; var T = t;
  // a bay, pilaster or pier in front of the wall plane (reliefOf): where the ray meets it first, its
  // front (rs 1) or its side (rs 2); there it is nearer, at its own spot along the face, lit by its own side
  var rs = 0;
  if (detailed && side != 2 && bldF(u32(q + 62u)) > 0.5) {
    let per = bldF(u32(q + 55u)) * BAY; let o = bldF(u32(q + 56u)) * BAY + bldF(u32(q + 57u)); let rw = bldF(u32(q + 58u));
    let sb = bldF(u32(q + 59u)) / max(1e-6, abs(dn)); let af = along - da * sb;
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
      if (zr > bldF(u32(q + 60u)) && zr < bldF(u32(q + 61u))) {
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
  if (side == 0) { tang = rdy; } else if (side == 1) { tang = rdx; } else if (side == 3) { tang = rdx * bldF(u32(q + 8u)) - rdy * bldF(u32(q + 7u)); }
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
  var body = false; var bodyEm = vec3f(-1.0); var winGlow = vec3f(0.0); var doorPeek = false;
  // seen from the other side, text reads mirrored along the face (rev in wallColumn)
  let rev = side < 2 && (face == 1 || face == 2);
  let sec = u.sec; let scol = sign;
  // the shop sign on this face: the business name centered on it, if at least 3 letters fit
  let biz = i32(bldF(u32(q + 48u)));
  var signN = 0; var signU = 0.0; var stx = vec2u(0u); var smode = 0u; var sfull = 0.0;
  if (biz >= 0 && side != 2) {
    stx = bizText(biz, ifloor((f1 - f0 - 1.2) / LETTER_W) - 2);
    signN = select(0, i32(stx.y), stx.y >= 3u);
    signU = along - (f0 + f1) * 0.5 + f32(signN + 2) * LETTER_W * 0.5;
    if (signU < 0.0 || signU >= f32(signN + 2) * LETTER_W) { signN = 0; }
    smode = sgU(u32(SG_BIZ + u32(biz) * 3u + 2u)); sfull = f32(sgU(u32(SG_BIZ + u32(biz) * 3u)) & 255u);
  }
  let letters = LETTER_W / dAlong >= 0.9;
  // a painted ad high on one face: the business's name in big block letters on a colored board
  let adB = i32(bldF(u32(q + 49u)));
  var adN = 0; var adTx = vec2u(0u); var adA0 = 0.0; var adA1 = 0.0; var adZ0 = 0.0; var adZ1 = 0.0;
  if (adB >= 0 && side != 2 && face == ifloor(hash3(bk, 7, 77) * select(4.0, 5.0, bldF(u32(q + 6u)) > 0.5))) {
    let w = min(f1 - f0 - 2.0, 16.0); let mid = (f0 + f1) * 0.5;
    if (w > 5.0) {
      adTx = bizText(adB, ifloor((w - 1.0) / AD_LETTER)); adN = i32(adTx.y);
      adA0 = mid - w / 2.0; adA1 = mid + w / 2.0; adZ1 = H - 1.6; adZ0 = max(FLOOR_H * 1.5, adZ1 - 5.5);
    }
  }
  // a video screen on this face, above the shop sign (and the ticker), as wide as the face allows
  let ticker = bldF(u32(q + 51u)) > 0.5;
  var scA0 = 0.0; var scA1 = 0.0; var scZ0 = 0.0; var scZ1 = 0.0;
  if (side != 2 && ((u32(bldF(u32(q + 50u))) >> u32(face)) & 1u) == 1u) {
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
    var cc = 32u; if (col >= 0 && col < signN) { cc = sgU(u32(stx.x + u32(kk))); }
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
      var lc = 32u; if (n > 0) { lc = sgU(sgU(0u) + u32(((li % n) + n) % n)); }
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
  } else if (dA1 > dA0 && z < DOOR_H + select(0.35, TRANSOM_Z + 0.06, dLf != 0u && fxf(dLf + 6u) < 0.0)) {
    // the street door: a frame, two glass leaves and a transom, lit from the lobby; the residents' own (13.19, its
    // leaf's width negative) one wooden leaf hinged at dA0, a glass transom over it with the number (an object)
    let e = min(along - dA0, dA1 - along); let dEn = dLf != 0u && fxf(dLf + 6u) < 0.0;
    let shTop = DOOR_H + 0.22; let shBot = shTop - dSh * shTop;
    if (dHasSh && z > shTop) {
      // a shop's shutter box over the door
      ch = select(EQ, BAR, z > DOOR_H + 0.31); c = vec3f(96.0, 100.0, 104.0) * shade;
    } else if (dSh > 0.0 && z >= shBot) {
      // the steel shutter rolled down (as far as it is), slats across the whole door and a bar along its bottom
      let slat = fract((shTop - z) / 0.09);
      ch = select(select(DASH, EQ, slat < 0.6), BAR, z - shBot < 0.07 && dSh < 0.999);
      c = vec3f(128.0, 132.0, 136.0) * select(select(0.75, 1.0, slat < 0.6), 0.6, z - shBot < 0.07) * shade;
    } else if (dEn && z > DOOR_H) {
      // the transom: its frame, and the pane lit from the lobby
      if (e < 0.07 || z < DOOR_H + 0.1 || z > DOOR_H + TRANSOM_Z) { ch = select(EQ, BAR, e < 0.07); c = frame * 1.5 * shade; }
      else { ch = EQ; c = vec3f(20.0, 24.0, 32.0) + vec3f(255.0, 215.0, 150.0) * (0.3 * elec); em = true; glowK = 0.2; glass = true; }
    } else if (e < 0.07 || z > DOOR_H + 0.22) {
      // the frame: the residents' door's of its wood, as from inside (the same door both ways, playtest of 2026-10-09)
      ch = select(EQ, BAR, e < 0.07); c = select(frame * 1.5, vec3f(75.0, 45.0, 27.0), dEn && z < DOOR_H + 0.1) * shade;
    }
    else {
      // up close, the door itself (13.10d): the walk into the lobby meets the same two glass leaves as from inside,
      // hinged at the jambs and turned in as far as the door is open. Far, the door painted: open, each leaf a strip
      // that narrows, and between them the lobby, lit, without glass. (One walk for both: it is the costly call.)
      let near = pkR >= 0 && tRef < PEEK_FULL && side != 2;
      let hwd = (dA1 - dA0) * 0.5; let sw = (1.0 - (1.0 - dOp) * (1.0 - dOp)) * 1.5707963; let edgeIn = hwd * cos(sw);
      // (the gap an open door leaves: between the two leaves' free edges, or past the one leaf's)
      let gap = select(e - edgeIn, along - dA0 - 2.0 * edgeIn, dEn);
      if (near || (pkR >= 0 && dOp > 0.0 && gap > 0.08)) {
        // (the walk itself is made once below, for the door and the windows alike)
        gSDo = select(0u, dLf, near); gSDang = sw; gSDglass = false; doorPeek = true;
      }
      else if (dOp > 0.0 && gap > 0.08) { ch = DOT; c = vec3f(255.0, 220.0, 160.0) * (0.18 * elec); em = true; glowK = 0.2; }
      else if (dOp > 0.0 && gap > 0.0) { ch = COL; c = vec3f(255.0, 220.0, 160.0) * (0.4 * elec); em = true; glowK = 0.2; }
      else if (dEn) {
        // far, the residents' door painted: dark oak, its glass light lit from the lobby, the brass knob
        let lu = (along - dA0) / (dA1 - dA0);
        if (lu > 0.2 && lu < 0.8 && z > 1.1 && z < DOOR_H - 0.28) { ch = COL; c = vec3f(255.0, 215.0, 150.0) * (0.35 * elec); em = true; glowK = 0.2; }
        else { ch = select(EQ, O, lu > 0.84 && lu < 0.92 && abs(z - 1.0) < 0.07); c = select(vec3f(96.0, 58.0, 34.0), vec3f(210.0, 175.0, 90.0), ch == O) * shade; }
      }
      else { ch = select(select(COL, BAR, abs(along - (dA0 + dA1) * 0.5) < 0.06), DASH, z > DOOR_H); c = vec3f(255.0, 220.0, 160.0) * (0.4 * elec); em = true; glowK = 0.3; }
    }
  } else if (adN > 0 && along > adA0 && along < adA1 && z > adZ0 && z < adZ1) {
    // the ad: a frame, then the letters (5 x 7 blocks each) centered on the board, weathered paint
    let lw = AD_LETTER; let start = (adA0 + adA1) * 0.5 - f32(adN) * lw * 0.5; let zc = (adZ0 + adZ1) * 0.5;
    let col = ifloor((along - start) / lw); let kk = select(col, adN - 1 - col, rev);
    let fu = ((along - start) / lw - f32(col)) * 1.25 - 0.12; let fzz = (zc + 1.1 - z) / 2.2;
    var on = false;
    if (col >= 0 && col < adN && fu >= 0.0 && fu < 1.0 && fzz >= 0.0 && fzz < 1.0) { on = bulbOn(sgU(u32(adTx.x + u32(kk))), ifloor(select(fu, 1.0 - fu, rev) * 5.0), ifloor(fzz * 7.0)); }
    let edge = along - adA0 < 0.25 || adA1 - along < 0.25 || z - adZ0 < 0.25 || adZ1 - z < 0.25;
    let hp = ifloor(hash3(bk, 8, 77) * ${AD_BG.length}.0);
    var ac = select(AD_BG[hp], AD_FG[hp], on); if (edge) { ac = FRAME_AD; }
    ch = select(select(select(DOT, COL, hash3(ifloor(along * 2.0), ifloor(z * 2.0), 5) < 0.2), HASH, on), EQ, edge);
    c = ac * ((0.75 + 0.25 * hash3(ifloor(along * 3.0), ifloor(z * 3.0), bk)) * shade);
    // lit from below by gooseneck lamps at night
    let al = vec3f(120.0, 105.0, 80.0) * ((1.0 - u.day) * ad * max(0.0, 1.0 - (z - adZ0) / (adZ1 - adZ0)) * 0.9); c += al; il += al;
  } else { body = true; }
  // the room behind the street door or a window: one call of peekRoom for both (WGSL inlines it at each call, and it
  // walks the room: two calls made the shader much slower to compile, 13.S)
  let winPeek = body && detailed && !(fl == 0 && dA1 > dA0 && z < FLOOR_H) && pkR >= 0 && !escCell && !corner && windowHole(style, shop, fw, fz, z - f32(fl) * FLOOR_H, fl == 0);
  var P = Px(32u, vec3f(0.0));
  let gcW = abs(dn) / max(1e-4, length(vec2f(rdx, rdy)));
  if (doorPeek || winPeek) { P = peekRoom(po, lot, bk, fl, rdx, rdy, m, t, winPw, tRef < PEEK_FULL, winPeek, gcW); }
  if (doorPeek) {
    gSDo = 0u;
    ch = P.ch; c = P.c; isWin = true; backT = gBack; winGlow = gPeekEm;
    // through a shut leaf's glass: a little darker and cooler, and it takes the street's reflection
    if (gSDglass) { c = glassSeen(c, vec3f(0.0), gcW, 0.0, u.day); glass = true; }
    else {
      // (13.10d2) the open doorway: the room as the walk met it, nothing of the facade's light on it (no glass,
      // no lamps, neon or floodlights on a wall that is not there), the same cell as seen from inside
      gBackT = select(0.0, gBack, gBack > t); gBackW = t; gBackK = -1.0;
      gEm = sat(gPeekEm); gIl = vec3f(0.0); gGlowK = 1.0; gEmK = 1.0;
      gTag = t; gNrm = vec3f(nw, 0.0); gWet = 0.0; gMat = MAT_NONE;
      return Cell(P.ch, P.c, vec3f(7.0, 8.0, 12.0), t, KIND_ROOM, 0.0);
    }
  }
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
  } else if (winPeek) {
    // a window: the room behind it, lit by its own lamps. From afar it was a pane in the building's window
    // color (lit) or dark glass: that look fades out over the whole building as it comes near, and a pane
    // that was lit keeps a glow of its color, fading closer still
    backT = gBack;
    let capaLit = hh < litK && wp > 0.04;
    let capa = select(darkPane, wc * wk, capaLit);
    ch = select(select(EQ, select(HASH, pat.x, hh < litK * 0.3), capaLit), P.ch, peekK > hash3(wi, fl, bk + 517));
    c = mix(capa, P.c, peekK); isWin = true; glass = true; winGlow = gPeekEm * peekK * glassKeep(gcW, u.day);
    // (the lit pane is light, as in the far look, until the room takes over)
    if (capaLit) { let gk = WIN_GLOW * peekK * smoothstep(GLOW_NEAR, GLOW_FULL, tRef); c += wc * wk * gk; winGlow += wc * wk * (1.0 - peekK + gk); }
    // the rain on the pane's outer face, the same drops as seen from inside (glassRain)
    let dr = glassRain(along, z, f32(fl) * FLOOR_H, t);
    if (dr > 0u && peekK > 0.5) { ch = select(DOT, COM, dr == 2u); c += vec3f(50.0, 55.0, 65.0); }
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
  if (bldF(u32(q + 27u)) > 0.5) {
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
  if (bldF(u32(q + 31u)) > 0.5 && z > H - CROWN_H) {
    let cw = colAt(q + 28u) * (pow((z - (H - CROWN_H)) / CROWN_H, 1.4) * 0.95 * ad * (1.0 - 0.85 * u.day)); c += cw; il += cw;
  }
  // floodlights at the foot of the wall, each a cone of light widening upward
  let floodH = bldF(u32(q + 35u));
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
        var tg = vec2f(0.0, 1.0); if (side == 1) { tg = vec2f(1.0, 0.0); } else if (side == 3) { tg = vec2f(bldF(u32(q + 8u)), -bldF(u32(q + 7u))); }
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
  let scH = bldF(u32(q + 52u));
  if (scH > 0.0 && side != 2 && face < 4 && ((u32(bldF(u32(q + 54u))) >> u32(face)) & 1u) == 1u) {
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
      } else if (bldF(u32(q + 53u)) > 0.5) {
        // the net veils the wall behind it
        c = c * 0.45 + NETS[u32(bldF(u32(q + 53u))) - 1u] * (0.55 * shade0); emC *= 0.45; il *= 0.45;
        if (t < 40.0 && ch != AT && ch != HASH) { ch = select(DOT, COL, ((ifloor(uu / 0.3) + ifloor(zs / 0.3)) & 1) == 1); }
      }
    }
  }
  // (not clamped here: the finish takes the light back out to tint it by the wall's color)
  // street lamps, headlights and signs light the lower floors
  // the street behind, through the room's far window (main sends the ray on)
  gBackT = select(0.0, backT, isWin && T == t && backT > t); gBackW = t; gBackK = peekK;
  if (!isWin) { gEm = sat(emC); gIl = il; gGlowK = glowK; gEmK = emK; } else { gEm = sat(winGlow); gIl = vec3f(0.0); gGlowK = 1.0; gEmK = 1.0; }
  gTag = T; gNrm = vec3f(nw, 0.0); gWet = 0.0; gPos = vec3f(gOX + rdx * T, gOY + rdy * T, gOZ - m * T + A * T * T);
  gMat = select(select(WALL_MAT[u32(clamp(S, 0, 15))], MAT_METAL, escCell || (rs == 2 && S == 1)), select(MAT_GLASS, MAT_WINDOW, isWin), glass);
  // a room seen through a window keeps its own lamps' light: by day the sun on the facade is not on it
  return Cell(ch, c, vec3f(7.0, 8.0, 12.0), T, select(KIND_WALL, KIND_ROOM, isWin), select(max(0.0, wsun), 0.0, isWin));
}

`;
