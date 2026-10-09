import { BLD, BLK, IN_LEAVES, f } from './common';
import { LEAF_TH } from '../../../sim/interior';

export const insideWGSL = (): string => /* wgsl */ `// ---- the inside of a building (13.10b): one walk through a storey's plan for every ray that enters it, from the
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
  let d = max(0.0, min(min(x - bldF(u32(q)), bldF(u32(q + 2u)) - x), min(y - bldF(u32(q + 1u)), bldF(u32(q + 3u)) - y)));
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
/**
 * An EXIT sign (the signage manual, rule 4): red lamps lit on their own (on a battery, so through a blackout too), the
 * man running out at the letters' height on the left, EXIT_W x EXIT_H m. Laid out in the letters' dots: a margin of 2,
 * the man 7.5 (15 x 15 half dots), a gap of 2, the four letters (6 each, 23 in all), a margin of 2; 1.5 above and below.
 */
const EXIT_W = 0.85; const EXIT_H = 0.235;
/** The residents' street door's leaf (sim DOOR_ENTRY, 13.19): wood with a glass light, a glass transom over it (to TRANSOM_Z over the door). */
const LEAF_ENTRY = 4u; const TRANSOM_Z = 0.5;
const EXIT_MAN = array<u32, 15>(24u, 24u, 0u, 248u, 476u, 826u, 1593u, 120u, 204u, 390u, 770u, 1539u, 3072u, 6144u, 0u);
/** The man's lit half dots in a cell's footprint (center px, pz, half sizes hx, hz, in half dots). */
fn exitManIn(px: f32, pz: f32, hx: f32, hz: f32) -> u32 {
  var n = 0u;
  for (var by = max(0, i32(ceil(pz - hz - 0.5))); by <= min(14, i32(ceil(pz + hz - 0.5)) - 1); by++) {
    for (var bx = max(0, i32(ceil(px - hx - 0.5))); bx <= min(14, i32(ceil(px + hx - 0.5)) - 1); bx++) { if (((EXIT_MAN[by] >> u32(14 - bx)) & 1u) == 1u) { n++; } }
  }
  return n;
}
/** An EXIT sign's cell: uu 0..1 across as read, v 0..1 down, du and dv the share of the sign the cell covers. */
fn exitPx(uu: f32, v: f32, du: f32, dv: f32) -> Px {
  let X = uu * 36.5; let Y = v * 10.0; let hx = du * 36.5 / 2.0; let hz = dv * 10.0 / 2.0;
  let lamp = vec3f(255.0, 80.0, 62.0);
  var o = Px(EQ, vec3f(105.0, 20.0, 16.0));
  if (hx <= 1.0 && hz <= 0.875) {
    // up close, the lamps in this cell: the letters', else the man's
    let n = ifloor((X - 11.5) / 6.0);
    var b = 0u;
    if (n >= 0 && n < 4) { b = bulbGlyph(bulbsIn(EXIT_CH[n], X - 11.5 - f32(n) * 6.0, Y - 1.5, hx, hz), hx, hz); }
    if (b == 0u) { b = bulbGlyph(exitManIn((X - 2.0) * 2.0, (Y - 1.25) * 2.0, hx * 2.0, hz * 2.0), hx * 2.0, hz * 2.0); }
    if (b > 0u) { o = Px(b, lamp); }
    return o;
  }
  // farther, a letter a cell, in the cell that holds its middle
  let n = ifloor((X - 11.5) / 6.0);
  if (n >= 0 && n < 4 && Y > 1.5 && Y < 8.5 && abs(X - 14.0 - f32(n) * 6.0) < hx) { o = Px(EXIT_CH[n], lamp); }
  return o;
}
/** Whether a building stands at (x, y) taller than z (builtUp). */
fn builtUp(x: f32, y: f32, z: f32) -> bool {
  if (x < 0.0 || y < 0.0 || x >= u.cityW || y >= u.cityH) { return false; }
  let gx = i32(xcU(u32(u32(x)))); let gy = i32(ycU(u32(u32(y))));
  if ((gx & 1) == 0 || (gy & 1) == 0) { return false; }
  let o = u32(((gy >> 1) * i32(u.nbx) + (gx >> 1)) * ${BLK});
  for (var k = i32(blkF(u32(o + 4u))); k < i32(blkF(u32(o + 5u))); k++) {
    let q = u32(k * ${BLD});
    if (bldF(u32(q + 4u)) > z && x >= bldF(u32(q)) && x < bldF(u32(q + 2u)) && y >= bldF(u32(q + 1u)) && y < bldF(u32(q + 3u)) && (bldF(u32(q + 6u)) < 0.5 || bldF(u32(q + 7u)) * x + bldF(u32(q + 8u)) * y <= bldF(u32(q + 9u)))) { return true; }
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
  // the slab's cut face round the opening (playtest of 2026-10-08): a ray in it that leaves it sideways between this
  // storey's ceiling and the next floor meets the slab there (the last riser up to a landing is that face), not what
  // is beyond it: before it, the walk stops (tSlab)
  var tSlab = 1e9;
  if (shaft) {
    let te = min(select((gWR.x - u.px) / rdx, (gWR.z - u.px) / rdx, rdx > 0.0), select((gWR.y - u.py) / rdy, (gWR.w - u.py) / rdy, rdy > 0.0));
    let ze = u.eye - m * te;
    if (te > tIn && ze > zc && ze < ztop) { tSlab = te; }
  }
  // the lift car (13.2d, world.ts liftCars): the floor it shows, where it rides to, how many floors; whether it stands
  // on this storey (its doors open; always, for the viewer riding it), whether it was called here
  let carW = fx[FX_TAB + 3u * fx[0] + u32(V.lot)];
  let carFl = i32(carW & 255u); let carTo = i32((carW >> 9u) & 255u) - 1; let carN = i32((carW >> 17u) & 255u);
  let carHereF = (inside && V.shut) || ((carW & 256u) != 0u && carFl == V.f); let carCalled = carTo == V.f;
  // (riding it, the viewer's own pick lights its button)
  let panelTo = select(carTo, bitcast<i32>(fx[V.IB + 7u]), inside && V.shut);
  let q = u32(V.box * ${BLD}); let lq = u32(V.lot * ${BLD});
  let st = i32(bldF(u32(lq + 10u))); let shop = bldF(u32(lq + 19u)) > 0.5; let office = st == 0 || st == 1;
  let rl = sqrt(rdx * rdx + rdy * rdy);
  res.gz0 = f32(V.f) * FLOOR_H;
  // where the ray leaves the box (and the cut): that outer wall closes the column
  var tExit = 1e9; var face = 0;
  if (rdx > 0.0) { let t = (bldF(u32(q + 2u)) - u.px) / rdx; if (t < tExit) { tExit = t; face = 1; } } else if (rdx < 0.0) { let t = (bldF(u32(q)) - u.px) / rdx; if (t < tExit) { tExit = t; face = 0; } }
  if (rdy > 0.0) { let t = (bldF(u32(q + 3u)) - u.py) / rdy; if (t < tExit) { tExit = t; face = 3; } } else if (rdy < 0.0) { let t = (bldF(u32(q + 1u)) - u.py) / rdy; if (t < tExit) { tExit = t; face = 2; } }
  let knx = bldF(u32(q + 7u)); let kny = bldF(u32(q + 8u));
  if (bldF(u32(q + 6u)) > 0.5) { let dn = knx * rdx + kny * rdy; if (dn > 0.0) { let t = (bldF(u32(q + 9u)) - knx * u.px - kny * u.py) / dn; if (t < tExit) { tExit = t; face = 4; } } }
  tExit = max(tExit, tIn + 0.02);
  // the nearest door leaf the ray meets (the plan's, swung as far as each is open; the viewer's street doors' glass ones);
  // a leaf is lit by the room on the side it is seen from (5 cm back along the ray: it stands on the cells' border)
  // (and the next one behind it: a ray through a leaf's glass goes on to the leaves behind, playtest of 2026-10-08)
  var lh = LHit(1e9, 0.0, 1.0, 0u, false); var lh2 = lh;
  if (full) {
    let t0 = max(0.05, tIn); let lb = leafBase(o);
    for (var n = 0u; n < fx[lb]; n++) {
      let w = lb + 1u + n * LEAF_W;
      { let nh = leafTest(LHit(1e9, 0.0, 1.0, 0u, false), fxf(w), fxf(w + 1u), fxf(w + 2u), fxf(w + 3u), fxf(w + 4u), fxf(w + 5u), fxf(w + 6u), leafSwing(V.lot, V.f, n), u32(fxf(w + 7u)), rdx, rdy, rl, t0); if (nh.t < lh.t) { lh2 = lh; lh = nh; } else if (nh.t < lh2.t) { lh2 = nh; } }
    }
    if (inside) {
      for (var n = 0u; n < fx[V.IB + 8u]; n++) {
        let w = V.IB + IN_LEAVES + n * 8u;
        // (the glass leaves' width is negative; the residents' wooden one's positive)
        { let nh = leafTest(LHit(1e9, 0.0, 1.0, 0u, false), fxf(w), fxf(w + 1u), fxf(w + 2u), fxf(w + 3u), fxf(w + 4u), fxf(w + 5u), fxf(w + 6u), fxf(w + 7u), select(LEAF_ENTRY, 0u, fxf(w + 6u) < 0.0), rdx, rdy, rl, t0); if (nh.t < lh.t) { lh2 = lh; lh = nh; } else if (nh.t < lh2.t) { lh2 = nh; } }
      }
    } else if (gSDo != 0u) {
      // the street door the ray came in by, seen from outside: the same leaves as from inside (two of glass, or the
      // residents' one of wood, its width negative and the second slot's 0)
      for (var n = 0u; n < 2u; n++) {
        let w = gSDo + n * 7u; let lw = fxf(w + 6u);
        if (lw == 0.0) { continue; }
        { let nh = leafTest(LHit(1e9, 0.0, 1.0, 0u, false), fxf(w), fxf(w + 1u), fxf(w + 2u), fxf(w + 3u), fxf(w + 4u), fxf(w + 5u), -abs(lw), gSDang, select(0u, LEAF_ENTRY, lw < 0.0), rdx, rdy, rl, t0); if (nh.t < lh.t) { lh2 = lh; lh = nh; } else if (nh.t < lh2.t) { lh2 = nh; } }
      }
    }
  }
  var lt = lh.t; var lu = lh.u; var lk = lh.k; var lg = lh.kind == 0u; var lkind = lh.kind; var ledge = lh.edge;
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
    // (met before the outer wall too: not on to it)
    if (tSlab < min(tn, tExit)) { wall = true; break; }
    if (lt < min(tn, tExit)) {
      let z = u.eye - m * lt;
      if (ledge && z > z0 && z <= z0 + DOOR_H - 0.02) {
        // the leaf's free edge, seen along it as it stands open: its frame, or the wood's end grain
        let hx = u.px + rdx * lt; let hy = u.py + rdy * lt; let rr = max(0, i32(roomAt(o, hx - rdx * 0.05 / rl, hy - rdy * 0.05 / rl)) - 1);
        let Lt = roomLit(V, roomRec(o, rr), rr, hx, hy, lt - tIn);
        let ec = select(select(select(vec3f(150.0, 108.0, 70.0), vec3f(95.0, 98.0, 105.0), lkind == 0u), vec3f(120.0, 126.0, 132.0), lkind == 2u), vec3f(140.0, 144.0, 150.0), lkind == 3u);
        res.cl = roomCell(BAR, ec * Lt * lk, lt); res.state = 1u; done = true; break;
      } else if (lg && z > z0 && z <= z0 + DOOR_H - 0.02) {
        // a street door's leaf: a metal frame and a push bar round the glass, which the ray goes on through
        let zz = z - z0;
        let frame = lu > 0.93 || lu < 0.05 || zz > DOOR_H - 0.12 || zz < 0.1;
        let bar = zz > 0.95 && zz < 1.08 && lu > 0.12 && lu < 0.85;
        if (frame || bar) {
          let hx = u.px + rdx * lt; let hy = u.py + rdy * lt; let rr = max(0, i32(roomAt(o, hx - rdx * 0.05 / rl, hy - rdy * 0.05 / rl)) - 1);
          let Lt = roomLit(V, roomRec(o, rr), rr, hx, hy, lt - tIn);
          res.cl = roomCell(select(EQ, BAR, frame), select(vec3f(95.0, 98.0, 105.0), vec3f(190.0, 190.0, 195.0), bar) * Lt * lk, lt); res.state = 1u; done = true; break;
        }
        leafGlass = true; gSDglass = true;
      } else if (lkind == LEAF_ENTRY && z > z0 && z <= z0 + DOOR_H - 0.02 && lu > 0.2 && lu < 0.8 && z - z0 > 1.1 && z - z0 < DOOR_H - 0.28) {
        // the residents' street door's glass light (13.19): the ray goes on through it, as through a glass leaf
        leafGlass = true; gSDglass = true;
      } else if (lkind == LEAF_ENTRY && z > z0 && z <= z0 + DOOR_H - 0.02) {
        // the residents' street door (13.19): dark oak in its edge, the light's moulding, a panel under it, the knob
        let hx = u.px + rdx * lt; let hy = u.py + rdy * lt; let rr = max(0, i32(roomAt(o, hx - rdx * 0.05 / rl, hy - rdy * 0.05 / rl)) - 1);
        let Lt = roomLit(V, roomRec(o, rr), rr, hx, hy, lt - tIn); let zz = z - z0;
        let edge = lu < 0.05 || lu > 0.95 || zz > DOOR_H - 0.1 || zz < 0.06;
        let rim = !edge && lu > 0.15 && lu < 0.85 && zz > 1.04 && zz < DOOR_H - 0.22;
        let panel = !edge && lu > 0.16 && lu < 0.84 && zz > 0.25 && zz < 0.85;
        let knob = lu > 0.84 && lu < 0.92 && zz > 0.92 && zz < 1.06;
        let col = vec3f(96.0, 58.0, 34.0) * lk * select(select(1.0, 1.12, panel), 0.78, edge || rim);
        if (knob) { res.cl = roomCell(O, vec3f(210.0, 175.0, 90.0) * Lt, lt); } else { res.cl = roomCell(select(select(EQ, COL, panel), BAR, edge || rim), col * Lt, lt); }
        res.state = 1u; done = true; break;
      } else if (lkind == 2u && z > z0 && z <= z0 + DOOR_H - 0.02) {
        // a steel door (a stockroom's): a plain sheet in a darker edge, a kick plate, the bar across it
        let hx = u.px + rdx * lt; let hy = u.py + rdy * lt; let rr = max(0, i32(roomAt(o, hx - rdx * 0.05 / rl, hy - rdy * 0.05 / rl)) - 1);
        let Lt = roomLit(V, roomRec(o, rr), rr, hx, hy, lt - tIn); let zz = z - z0;
        let edge = lu < 0.04 || lu > 0.96 || zz > DOOR_H - 0.07;
        let kick = zz < 0.28; let bar = zz > 0.95 && zz < 1.06 && lu > 0.1 && lu < 0.88;
        let col = vec3f(112.0, 120.0, 126.0) * lk * select(select(select(1.0, 0.8, kick), 1.45, bar), 0.7, edge);
        res.cl = roomCell(select(select(select(HASH, EQ, kick), BAR, bar), BAR, edge), col * Lt, lt);
        res.state = 1u; done = true; break;
      } else if (z > z0 && z <= z0 + DOOR_H - 0.02) {
        // a panel door (wood in a home, a painted panel in an office): its edges, two recessed panels, the knob
        let hx = u.px + rdx * lt; let hy = u.py + rdy * lt; let rr = max(0, i32(roomAt(o, hx - rdx * 0.05 / rl, hy - rdy * 0.05 / rl)) - 1);
        let Lt = roomLit(V, roomRec(o, rr), rr, hx, hy, lt - tIn); let zz = z - z0;
        let edge = lu < 0.06 || lu > 0.94 || zz > DOOR_H - 0.1 || zz < 0.06;
        let knob = lu > 0.82 && lu < 0.9 && zz > 0.92 && zz < 1.06;
        let panel = !edge && lu > 0.16 && lu < 0.84 && ((zz > 0.25 && zz < 0.85) || (zz > 1.2 && zz < DOOR_H - 0.3));
        let col = select(vec3f(118.0, 78.0, 46.0), vec3f(118.0, 122.0, 130.0), lkind == 3u) * lk * select(select(1.0, 1.1, panel), 0.8, edge);
        if (knob) { res.cl = roomCell(O, vec3f(210.0, 175.0, 90.0) * Lt, lt); } else { res.cl = roomCell(select(select(EQ, COL, panel), BAR, edge), col * Lt, lt); }
        res.state = 1u; done = true; break;
      }
      // (through its glass, or past it over or under: on to the next leaf behind)
      lt = lh2.t; lu = lh2.u; lk = lh2.k; lg = lh2.kind == 0u; lkind = lh2.kind; ledge = lh2.edge; lh2.t = 1e9;
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
        // a doorway: the lintel above it, and on through; over each doorway on the way out (Plan.exitTo), a red EXIT sign
        if (z > z0 + DOOR_H && z <= zc) {
          // (only on the way out: the next room toward the street, Plan.exitTo)
          let toExit = fx[ro + 6u] != 0u && fx[ro + 6u] == (nv & 255u);
          let zz = z - z0;
          if (toExit && zz > DOOR_H + 0.07 && zz < DOOR_H + 0.07 + EXIT_H) {
            // the doorway's extent along the wall: the run of door cells on both sides
            var a = 0; var b = 0;
            loop { if (a <= -8 || !doorBoth(o, xs, wi, wj, i, j, a - 1)) { break; } a--; }
            loop { if (b >= 8 || !doorBoth(o, xs, wi, wj, i, j, b + 1)) { break; } b++; }
            let base = select(f32(gx + i), f32(gy + j), xs) * PCELL;
            let sA = base + f32(a) * PCELL; let sB = base + f32(b + 1) * PCELL;
            let a2 = (uu - (sA + sB) * 0.5) / EXIT_W;
            if (abs(a2) < 0.5) {
              let rd = select(toRight(1.0, 0.0, rdx, rdy), toRight(0.0, 1.0, rdx, rdy), xs);
              let du = u.colW * tn / max(1e-6, abs(select(rdy, rdx, xs))) / EXIT_W;
              let ep = exitPx(select(0.5 - a2, 0.5 + a2, rd), (DOOR_H + 0.07 + EXIT_H - zz) / EXIT_H, du, tn / u.scale / EXIT_H);
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
    let corner = along - bldF(u32(q + 36u + u32(face) * 2u)) < 0.35 || bldF(u32(q + 37u + u32(face) * 2u)) - along < 0.35;
    let bay = along / BAY; let fw = bay - floor(bay); let ground = V.f == 0;
    var isDoor = false; var du = 0.0; var doorW = 1.0; var entryD = false;
    let fo = fx[FX_TAB + u32(V.lot)];
    if (ground && fo > 0u) {
      for (var e = 0u; e < fx[fo]; e++) {
        let w = fo + 1u + e * 3u; let kf = fx[w]; let a0 = fxf(w + 1u); let a1 = fxf(w + 2u);
        if ((kf & 15u) == 0u && i32((kf >> 4u) & 15u) == face && along > a0 && along < a1) { isDoor = true; du = (along - a0) / (a1 - a0); doorW = a1 - a0; entryD = fxf(fo + 1u + fx[fo] * 3u + e * 14u + 6u) < 0.0; }
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
        // its two glass leaves; over it the red EXIT sign
        let zz = z - z0; let a2 = (du - 0.5) * doorW / EXIT_W;
        if (zz > DOOR_H + 0.07 && zz < DOOR_H + 0.07 + EXIT_H && abs(a2) < 0.5) {
          let ep = exitPx(select(0.5 - a2, 0.5 + a2, rdF), (DOOR_H + 0.07 + EXIT_H - zz) / EXIT_H, colA / EXIT_W, t / u.scale / EXIT_H);
          res.cl = roomCell(ep.ch, ep.c, t);
        } else if (zz < DOOR_H) {
          // the jambs and the head: the leaves (drawn above, as they swing) carry the stiles and the push bars
          let frame = du < 0.04 || du > 0.96 || zz > DOOR_H - 0.06;
          // (the residents' door's frame is of its wood: in steel grey, the strip over the leaf read as a gap)
          if (frame) { res.cl = roomCell(BAR, select(vec3f(95.0, 98.0, 105.0), vec3f(75.0, 45.0, 27.0), entryD) * Lt, t); }
          // (an open doorway with no leaf in the way has no glass: gdoor)
          else if (inside || gThru) { res.state = 2u; res.gdoor = !leafGlass; }
          else { res.cl = roomCell(EQ, farGlass, t); gBack = t; }
        } else if (entryD && zz > DOOR_H + 0.1 && zz < DOOR_H + TRANSOM_Z && du * doorW > 0.07 && (1.0 - du) * doorW > 0.07) {
          // the residents' door's glass transom (13.19), onto the street
          if (inside || gThru) { res.state = 2u; } else { res.cl = roomCell(EQ, farGlass, t); gBack = t; }
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
    // (the slab's cut face, tSlab above, before the floor or the ceiling)
    let slab = tSlab < 1e8 && (tSlab < t || !(t > tIn));
    if (slab) { t = tSlab; }
    if (!(t > tIn) || t > 200.0) { return res; }
    var wx = u.px + rdx * t; var wy = u.py + rdy * t;
    // (step 4 of the interiors' rework) the viewer's stairwell: over the flights the ceiling is open to the storey above
    // (met where that storey's floor is), and the floor to the one below; the main walk goes on there (gWell). A
    // storey seen through it shows its own floor and ceiling there (one walk on at most)
    if (inside && !slab && ((shaft && !below) || (below && inWellRect(wx, wy)))) {
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
    if (below && !slab) { p = floorPx(kind, office, wx, wy); } else { let lp = roomLamp(V.lot, V.box, ro, r, V.f, V.elec, r == V.here); p = ceilPx(ro, kind, office, lp.x + lp.y > 0.05, wx, wy); }
    // (the slab's face, a little darker than the ceiling it is the edge of)
    res.cl = roomCell(p.ch, p.c * roomLit(V, ro, r, wx, wy, t - tIn) * select(1.0, 0.7, slab), t); res.state = 1u;
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

`;
