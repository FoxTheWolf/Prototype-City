import { BLD, FX_DOORS, LEAF_W, ROOM_REC } from './common';

export const roomsWGSL = (): string => /* wgsl */ `// ---- the rooms of the plans in fx (render/interior.ts: roomLamp, the paints), for roomWalk
const PAINT = array<vec3f, 6>(vec3f(190.0, 170.0, 135.0), vec3f(150.0, 170.0, 160.0), vec3f(175.0, 150.0, 165.0), vec3f(185.0, 185.0, 175.0), vec3f(150.0, 160.0, 185.0), vec3f(195.0, 160.0, 120.0));
const R_LOBBY = 0u; const R_HALL = 1u; const R_STAIR = 2u; const R_LIFT = 3u; const R_KITCHEN = 7u; const R_BATH = 8u; const R_OFFICE = 9u; const R_OPEN = 10u; const R_SHOP = 11u;
/** Cell (i, j) of the plan at o: its room + 1 (0 outside), with the DOOR bit. */
fn planCell(o: u32, i: i32, j: i32) -> u32 {
  let nx = i32(fx[o + 2u]);
  if (i < 0 || j < 0 || i >= nx || j >= i32(fx[o + 3u])) { return 0u; }
  let b = u32(j * nx + i);
  return (fx[o + 6u + fx[o + 4u] * ROOM_REC + b / 2u] >> ((b % 2u) * 16u)) & 0xffffu;
}
fn roomAt(o: u32, x: f32, y: f32) -> u32 { return planCell(o, ifloor(x / PCELL) - i32(fx[o]), ifloor(y / PCELL) - i32(fx[o + 1u])) & 255u; }
const LEAF_W = ${LEAF_W}u; const ROOM_REC = ${ROOM_REC}u; const FX_DOORS = ${FX_DOORS}u;
/** Where the door leaves of the plan at o start (after its cells): their count, then LEAF_W words each (world.ts putPlan). */
fn leafBase(o: u32) -> u32 { return o + 6u + fx[o + 4u] * ROOM_REC + (fx[o + 2u] * fx[o + 3u] + 1u) / 2u; }
/** Room r's record in the plan at o (its box as four f32, its kind and unit, the next room + 1 on the way out: Plan.exitTo). */
fn roomRec(o: u32, r: i32) -> u32 { return o + 6u + u32(r) * ROOM_REC; }
/** The lamp of room r on floor f of box boxId (0..1 per channel, times the power), as roomLamp; "on": the room the viewer stands in. */
fn roomLamp(lot: i32, boxId: i32, ro: u32, r: i32, f: i32, elecIn: f32, on: bool) -> vec3f {
  let kind = fx[ro + 4u]; let commonPart = bitcast<i32>(fx[ro + 5u]) < 0; let h = hash3(boxId, r * 31 + f, 12);
  let lq = u32(lot * ${BLD});
  let backup = i32(bldF(u32(lq + 63u)));
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
  let st = i32(bldF(u32(lq + 10u))); let office = st == 0 || st == 1;
  // a home's lamps go out by day; an office's stay on through the working day (L.5)
  let onK = select(1.0 - 0.75 * u.day, 1.0 + 0.6 * u.day, office);
  // (a shop's lamps are always on: the same seen from the street and from inside, 13.10d2)
  if (!(commonPart || on || kind == R_SHOP || hash3(boxId, r * 31 + f, 11) < bldF(u32(lq + 11u)) * onK * 1.3)) { return vec3f(0.0); }
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

`;
