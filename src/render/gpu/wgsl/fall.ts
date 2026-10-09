import { BLD, BLK, f } from './common';
import { SHELLS } from '../../precip';
import { objectsWGSL } from '../objects';

export const fallWGSL = (): string => /* wgsl */ `// ---- rain and snow falling (precip.ts, drawFall), over the finished cell: drops on shells around the
// viewer, in columns fixed to the compass; the nearest shell's drop over this cell wins, then the water
// running off the roofs' edges
const SHELLS = array<f32, ${SHELLS.length}>(${SHELLS.map(f).join(', ')});
fn h3(a: i32, b: i32, c: i32) -> f32 {
  var h = (bitcast<u32>(a) * 0x27d4eb2du) ^ (bitcast<u32>(b) * 0x165667b1u) ^ (bitcast<u32>(c) * 0x9e3779b1u);
  h ^= h >> 16u; h *= 0x85ebca6bu; h ^= h >> 13u; h *= 0xc2b2ae35u; h ^= h >> 16u;
  return f32(h) / 4294967296.0;
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
  let W = nXC; let H = nYC;
  var cx = i32(xcU(u32(clamp(gOX, 0.0, f32(W - 1u)))));
  var cy = i32(ycU(u32(clamp(gOY, 0.0, f32(H - 1u)))));
  let nx = i32(u.nxb) - 1; let ny = i32(u.nyb) - 1;
  var tx = (select(xbF(u32(cx + 1)), xbF(u32(cx)), rdx < 0.0) - gOX) * ix;
  var ty = (select(ybF(u32(cy + 1)), ybF(u32(cy)), rdy < 0.0) - gOY) * iy;
  var tIn = 0.0;
  var best = 1e9; var bk = -1; var bside = 0; var roof = false;
  for (var s = 0; s < 1024; s++) {
    if (tIn > tG) { break; }
    let tOut = min(tx, ty);
    if ((cx & 1) == 1 && (cy & 1) == 1) {
      let o = u32(((cy >> 1) * i32(u.nbx) + (cx >> 1)) * ${BLK});
      let b0 = i32(blkF(u32(o + 4u))); let b1 = i32(blkF(u32(o + 5u))); let maxH = blkF(u32(o + 6u));
      let zMin = min(gOZ - m * tIn + A * tIn * tIn, gOZ - m * tOut + A * tOut * tOut);
      if (b1 > b0 && zMin < maxH) {
        for (var k = b0; k < b1; k++) {
          let q = u32(k * ${BLD});
          let x0 = bldF(u32(q)); let y0 = bldF(u32(q + 1u)); let x1 = bldF(u32(q + 2u)); let y1 = bldF(u32(q + 3u)); let h = bldF(u32(q + 4u));
          if ((x0 >= u.inX0 - 0.01) && (x1 <= u.inX1 + 0.01) && (y0 >= u.inY0 - 0.01) && (y1 <= u.inY1 + 0.01)) { continue; }
          var tN = 0.0; var tF = 0.0; var side = 0;
          if (bldF(u32(q + 5u)) > 0.5) {
            let rr = (x1 - x0) * 0.5; let ox = gOX - (x0 + rr); let oy = gOY - (y0 + rr);
            let qa = rdx * rdx + rdy * rdy; let qb = ox * rdx + oy * rdy;
            let disc = qb * qb - qa * (ox * ox + oy * oy - rr * rr);
            if (disc <= 0.0) { continue; }
            tN = (-qb - sqrt(disc)) / qa; tF = (-qb + sqrt(disc)) / qa; side = 2;
          } else {
            let ax = (x0 - gOX) * ix; let bx = (x1 - gOX) * ix; let ay = (y0 - gOY) * iy; let by = (y1 - gOY) * iy;
            let nnx = min(ax, bx); let nny = min(ay, by);
            tF = min(max(ax, bx), max(ay, by)); tN = max(nnx, nny); side = select(1, 0, nnx > nny);
            if (bldF(u32(q + 6u)) > 0.5) {
              let knx = bldF(u32(q + 7u)); let kny = bldF(u32(q + 8u)); let kc = bldF(u32(q + 9u));
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
    if (tx < ty) { cx += stX; tIn = tx; if (cx < 0 || cx >= nx) { break; } tx = (select(xbF(u32(cx + 1)), xbF(u32(cx)), rdx < 0.0) - gOX) * ix; }
    else { cy += stY; tIn = ty; if (cy < 0 || cy >= ny) { break; } ty = (select(ybF(u32(cy + 1)), ybF(u32(cy)), rdy < 0.0) - gOY) * iy; }
  }

  var cl: Cell;
  if (bk >= 0 && best < tG) {
    if (roof) { cl = roofCell(u32(bk * ${BLD}), best, gOX + rdx * best, gOY + rdy * best); }
    // (the last argument: the metres of wall one row covers there, for edges thinner than a row)
    else { cl = wallCell(bk, best, bside, rdx, rdy, gOZ - m * best + A * best * best, best / u.scale, m, A); }
  }
  else if (tG < 1e8) { cl = groundCell(tG, rdx, rdy); }
  // below the horizon, a ray the curve carries past the ground: the far ground, as on the CPU
  else if (m > 0.0) { cl = groundCell(1e7, rdx, rdy); }
  else { cl = skyCell(m, rdx, rdy); }
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
  let W = nXC; let H = nYC;
  if (px < 0.0 || py < 0.0 || px >= f32(W) || py >= f32(H)) { return 1.0; }
  var cx = i32(xcU(u32(px))); var cy = i32(ycU(u32(py)));
  let nx = i32(u.nxb) - 1; let ny = i32(u.nyb) - 1;
  var tx = (select(xbF(u32(cx + 1)), xbF(u32(cx)), rdx < 0.0) - px) * ix;
  var ty = (select(ybF(u32(cy + 1)), ybF(u32(cy)), rdy < 0.0) - py) * iy;
  var tIn = 0.0;
  for (var s = 0; s < 256; s++) {
    let z = pz + k * tIn;
    if (z > SHADOW_TOP) { break; }
    if ((cx & 1) == 1 && (cy & 1) == 1) {
      let o = u32(((cy >> 1) * i32(u.nbx) + (cx >> 1)) * ${BLK});
      let b0 = i32(blkF(u32(o + 4u))); let b1 = i32(blkF(u32(o + 5u)));
      if (b1 > b0 && z < blkF(u32(o + 6u))) {
        for (var q0 = b0; q0 < b1; q0++) {
          let q = u32(q0 * ${BLD});
          let x0 = bldF(u32(q)); let y0 = bldF(u32(q + 1u)); let x1 = bldF(u32(q + 2u)); let y1 = bldF(u32(q + 3u)); let h = bldF(u32(q + 4u));
          var tN = 0.0; var tF = 0.0;
          if (bldF(u32(q + 5u)) > 0.5) {
            let rr = (x1 - x0) * 0.5; let ox = px - (x0 + rr); let oy = py - (y0 + rr);
            let qb = ox * rdx + oy * rdy; let disc = qb * qb - (ox * ox + oy * oy - rr * rr);
            if (disc <= 0.0) { continue; }
            tN = -qb - sqrt(disc); tF = -qb + sqrt(disc);
          } else {
            let ax = (x0 - px) * ix; let bx = (x1 - px) * ix; let ay = (y0 - py) * iy; let by = (y1 - py) * iy;
            tN = max(min(ax, bx), min(ay, by)); tF = min(max(ax, bx), max(ay, by));
            if (bldF(u32(q + 6u)) > 0.5) {
              let knx = bldF(u32(q + 7u)); let kny = bldF(u32(q + 8u)); let kc = bldF(u32(q + 9u));
              let dn = knx * rdx + kny * rdy; let th = (kc - knx * px - kny * py) / dn;
              if (dn < 0.0) { tN = max(tN, th); } else if (dn > 0.0) { tF = min(tF, th); } else if (knx * px + kny * py > kc) { continue; }
            }
          }
          if (tF <= 0.03 || tN >= tF) { continue; }
          if (pz + k * max(tN, 0.0) < h - 0.05) { return 0.0; }
        }
      }
    }
    if (tx < ty) { cx += stX; tIn = tx; if (cx < 0 || cx >= nx) { break; } tx = (select(xbF(u32(cx + 1)), xbF(u32(cx)), rdx < 0.0) - px) * ix; }
    else { cy += stY; tIn = ty; if (cy < 0 || cy >= ny) { break; } ty = (select(ybF(u32(cy + 1)), ybF(u32(cy)), rdy < 0.0) - py) * iy; }
  }
  return 1.0;
}
/** No building is taller than this (m): a shadow ray above it is out in the sun. */
const SHADOW_TOP = 460.0;
`;
