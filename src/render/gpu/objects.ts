import { SYMBOLS } from '../signs';

/**
 * The street objects on the GPU (objects.ts's drawObjects, per cell). The objects of a frame come from
 * the CPU's own lists (raycaster.ts, gpuObjects); world.ts packs them into the near buffer `fx`:
 *
 * - the models (Part lists, cached on the CPU, so each goes up once): their part count, then PW words
 *   per part (shape, box, color, material, glyphs, text as offset and length into the words after the
 *   parts, symbol + 1, second color + flag, lamp, bulbs);
 * - the frame's objects, from fx[1]: their count, the number of 8-column tiles, where the objects and
 *   the tile lists start, the tiles' offsets into the list, the list, then OW words per object (pose,
 *   radius, height, base, seed, fog distance, lift, lean, the model's offset, its screen box), then
 *   the roofs that keep the rain off (fx[OB + 4] where, fx[OB + 5] how many; seven floats each), the floor
 *   the viewer stands in (fx[OB + 6] where, 0 outdoors; see the shader's interiorCell), the sun's shadow grid
 *   (fx[OB + 7]), the objects that shade the floodlit facades (fx[OB + 8]: a count, then their indices) and the objects'
 *   footprints on the ground (fx[OB + 9], footGrid). The furniture is objects
 *   too, marked indoor (lit by the rooms' lamps, multiplied).
 */
export const OW = 20, PW = 24, TILE = 8;

const C = (s: string) => s.charCodeAt(0);

export function objectsWGSL(): string {
  return /* wgsl */ `
const OW = ${OW}u; const PW = ${PW}u; const TILE = ${TILE}u; const PIVOT = 0.7;
const M_SOLID = 0u; const M_LEAF = 1u; const M_GLOW = 2u; const M_TEXT = 3u; const M_BOARD = 4u; const M_WHEEL = 5u; const M_GLASS = 6u; const M_SCREEN = 7u; const M_SKIN = 8u;
// A person's body part in the blocky style (13.8): the hit's pixel on the skin's grid (1.8/32 m) on
// the face it is on, colored by the part (0 head, 1 body, 2 arm, 3 leg) and its style bits (see pedLook).
// c: the main color (skin tone, shirt, sleeve, trousers); c2: the second (hair, jacket, hand, shoes).
fn mcSkin(w: u32, hp: vec3f, q0: vec3f, q1: vec3f, c: vec3f, c2: vec3f) -> vec3f {
  let X = 1.8 / 32.0; let k = w & 15u; let st = w >> 4u;
  // which face: the nearest of the box's planes
  let d0 = abs(hp - q0); let d1 = abs(q1 - hp);
  var f = 0u; var m = d1.x; // 0 front (+x), 1 back, 2 right (+y), 3 left, 4 top, 5 bottom
  if (d0.x < m) { m = d0.x; f = 1u; } if (d1.y < m) { m = d1.y; f = 2u; } if (d0.y < m) { m = d0.y; f = 3u; }
  if (d1.z < m) { m = d1.z; f = 4u; } if (d0.z < m) { f = 5u; }
  // the pixel: across the face (from the part's left as seen from that face) and down from its top
  let row = i32(floor((q1.z - hp.z) / X)); var col = 0;
  if (f == 0u) { col = i32(floor((q1.y - hp.y) / X)); } else if (f == 1u) { col = i32(floor((hp.y - q0.y) / X)); }
  else if (f == 2u) { col = i32(floor((hp.x - q0.x) / X)); } else if (f == 3u) { col = i32(floor((q1.x - hp.x) / X)); }
  else { col = i32(floor((q1.y - hp.y) / X)); }
  let shade = select(1.0, 0.82, (row + col) % 7 == 3); // a little pixel noise, as hand-drawn skins have
  if (k == 0u) {
    // the head: hair (none, short, long) over the face; eyes on the 5th row, a mouth on the 7th; a beard
    let hl = st & 3u; let eyes = (st >> 2u) & 3u; let beard = (st >> 4u) & 1u;
    if (f == 4u) { return select(c, c2, hl > 0u); }
    if (f == 5u) { return c * 0.8; }
    let hairRows = select(select(1, 2, hl == 1u), 6, hl == 2u);
    if (hl > 0u && (row < select(hairRows, 1 + i32(hl), f == 0u) || (f == 0u && hl == 2u && (col == 0 || col == 7) && row < 5))) { return c2 * shade; }
    if (f == 0u) {
      if (row == 4 && (col == 1 || col == 6)) { return vec3f(235.0, 235.0, 230.0); }
      if (row == 4 && (col == 2 || col == 5)) {
        return select(select(vec3f(60.0, 40.0, 25.0), vec3f(50.0, 90.0, 160.0), eyes == 1u), select(vec3f(60.0, 120.0, 70.0), vec3f(25.0, 25.0, 28.0), eyes == 3u), eyes >= 2u);
      }
      if (beard == 1u && row >= 5) { return c2 * 0.9; }
      if (row == 6 && (col == 3 || col == 4)) { return c * 0.62; }
      if (row == 5 && (col == 3 || col == 4)) { return c * 0.88; } // the nose's shadow
    }
    return c * select(1.0, 0.9, f != 0u);
  }
  if (k == 1u) {
    // the body: the shirt, an open jacket at its sides, stripes; the neck's skin at the collar; a belt
    if (row == 11) { return c * 0.5; }
    if (st == 1u && (f == 0u || f == 1u) && (col < 3 || col > 4 || f == 1u)) { return c2 * shade; }
    if (st == 1u && (f == 2u || f == 3u)) { return c2 * shade; }
    if (st == 2u && row % 3 == 1) { return c2; }
    if (f == 0u && row == 0 && (col == 3 || col == 4)) { return c * 0.75; }
    return c * shade;
  }
  if (k == 2u) {
    // an arm: the sleeve (long, or short down to the 4th row), the hand at the bottom
    let sleeve = select(9, 4, st == 1u);
    if (f == 5u || row >= sleeve) { return c2 * select(1.0, 0.85, row >= 11); }
    return c * shade;
  }
  // a leg: the trousers, the shoes on the last two rows
  if (f == 5u || row >= 10) { return c2; }
  return c * select(shade, 0.8, f == 1u);
}

const LEAF = array<u32, 5>(${['@', '&', '%', '#', '*'].map((c) => `${C(c)}u`).join(', ')});
const SPOKES = array<u32, 4>(${['|', '/', '-', '\\'].map((c) => `${C(c)}u`).join(', ')});
const TYRE = vec3f(52.0, 52.0, 56.0); const HUB = vec3f(170.0, 170.0, 175.0); const RIM = vec3f(140.0, 140.0, 148.0); const DIRT = vec3f(110.0, 90.0, 62.0);
const SYM_ROWS = array<u32, ${SYMBOLS.length * 9}>(${SYMBOLS.flatMap((s) => s.rows).map((r) => `${r}u`).join(', ')});
const SYM_FAR = array<u32, ${SYMBOLS.length}>(${SYMBOLS.map((s) => `${s.far}u`).join(', ')});

fn fxf(i: u32) -> f32 { return bitcast<f32>(fx[i]); }
fn fx3(i: u32) -> vec3f { return vec3f(fxf(i), fxf(i + 1u), fxf(i + 2u)); }
fn symOn(s: u32, bx: i32, by: i32) -> bool {
  if (bx < 0 || bx > 8 || by < 0 || by > 8) { return false; }
  return ((SYM_ROWS[s * 9u + u32(by)] >> u32(8 - bx)) & 1u) == 1u;
}
// a slot's bulbs in a cell's footprint: a 5x7 letter, or a 9x9 symbol (sym > 0: its index + 1)
fn slotBulbs(c: u32, sym: u32, px: f32, pz: f32, hx: f32, hz: f32) -> u32 {
  if (sym == 0u) { return bulbsIn(c, px, pz, hx, hz); }
  var n = 0u;
  for (var by = max(0, i32(ceil(pz - hz - 0.5))); by <= min(8, i32(ceil(pz + hz - 0.5)) - 1); by++) {
    for (var bx = max(0, i32(ceil(px - hx - 0.5))); bx <= min(8, i32(ceil(px + hx - 0.5)) - 1); bx++) { if (symOn(sym - 1u, bx, by)) { n++; } }
  }
  return n;
}
fn slotOn(c: u32, sym: u32, bx: i32, by: i32) -> bool { return select(symOn(sym - 1u, bx, by), bulbOn(c, bx, by), sym == 0u); }

/**
 * How much sun reaches world point P past the frame's street objects (1 lit, 0 shaded): a ray toward the sun
 * (Ls, unit) against each outdoor object's parts, as the view's rays hit them (unleaned, true sizes). Leaves let
 * some light through in flecks. Only objects whose cylinder the ray passes below the top of count.
 */
fn objShadow(P: vec3f, Ls: vec3f, mw: f32) -> f32 {
  let OB = fx[1];
  if (OB == 0u || fx[OB] == 0u || fx[OB + 7u] == 0u || Ls.z <= 0.02) { return 1.0; }
  let objs = OB + fx[OB + 2u];
  // the point cast down to the ground along the sun: its cell of the shadow grid holds the objects to test
  let G = OB + fx[OB + 7u]; let N = fx[G + 2u]; let cs = fxf(G + 3u);
  let qx = P.x - Ls.x * (P.z / Ls.z) - fxf(G); let qy = P.y - Ls.y * (P.z / Ls.z) - fxf(G + 1u);
  if (qx < 0.0 || qy < 0.0) { return 1.0; }
  let ci = u32(qx / cs); let cj = u32(qy / cs);
  if (ci >= N || cj >= N) { return 1.0; }
  let head = G + 4u; let list = head + N * N + 1u; let cell = cj * N + ci;
  var lit = 1.0;
  for (var li = fx[head + cell]; li < fx[head + cell + 1u]; li++) {
    let ob = objs + fx[list + li] * OW;
    if (fx[ob + 14u] == 2u) { continue; } // indoor furniture
    let top = fxf(ob + 5u) + fxf(ob + 9u);
    if (P.z >= top) { continue; }
    // (along the ray until it is above the object's top)
    lit = min(lit, objBlock(ob, P, Ls, (top - P.z) / Ls.z, 1e9, mw));
    if (lit <= 0.0) { return 0.0; }
  }
  return lit;
}

/**
 * How much of a floodlight at L reaches world point P on its wall past the objects standing in front of the
 * floodlit facades (fx[OB + 8]'s list), the same way as the sun's shadows; 1 when there is no list.
 */
fn floodShadow(P: vec3f, L: vec3f) -> f32 {
  let OB = fx[1];
  if (OB == 0u || fx[OB] == 0u || fx[OB + 8u] == 0u) { return 1.0; }
  let objs = OB + fx[OB + 2u]; let F = OB + fx[OB + 8u];
  let D = L - P; let len = length(D); let d = D / max(len, 1e-4);
  var lit = 1.0;
  for (var i = 0u; i < fx[F]; i++) {
    let ob = objs + fx[F + 1u + i] * OW;
    lit = min(lit, objBlock(ob, P, d, len, len - 0.25, 0.0));
    if (lit <= 0.0) { return 0.0; }
  }
  return lit;
}

/**
 * How much of the ray from P along the unit direction Ls gets past object ob (1 clear, 0 blocked, between for
 * leaves): its axis's nearest pass on the ground plane within tPre first, then each part within tMax.
 */
fn objBlock(ob: u32, P: vec3f, Ls: vec3f, tPre: f32, tMax: f32, mw: f32) -> f32 {
    let x = fxf(ob); let y = fxf(ob + 1u); let r = fxf(ob + 4u); let zoff = fxf(ob + 9u);
    let rx = x - P.x; let ry = y - P.y; let L2 = max(1e-6, Ls.x * Ls.x + Ls.y * Ls.y);
    let tc = clamp((rx * Ls.x + ry * Ls.y) / L2, 0.0, tPre);
    let ex = rx - Ls.x * tc; let ey = ry - Ls.y * tc;
    if (ex * ex + ey * ey > r * r) { return 1.0; }
    var lit = 1.0;
    let c = fxf(ob + 2u); let s = fxf(ob + 3u);
    let o = vec3f((P.x - x) * c + (P.y - y) * s, -(P.x - x) * s + (P.y - y) * c, P.z - zoff);
    let d0 = vec3f(Ls.x * c + Ls.y * s, -Ls.x * s + Ls.y * c, Ls.z);
    let d = select(d0, vec3f(1e-6), abs(d0) < vec3f(1e-6));
    let mo = fx[ob + 15u]; let np = fx[mo];
    for (var k = 0u; k < np; k++) {
      let p = mo + 1u + k * PW;
      let mat = fx[p + 10u];
      if (mat == M_GLASS) { continue; }
      let shape = fx[p]; let q0 = fx3(p + 1u); let q1 = fx3(p + 4u);
      let cen = (q0 + q1) * 0.5; let hs = max((q1 - q0) * 0.5, vec3f(mw, mw, 0.01));
      var hit = false; var hp = vec3f(0.0);
      if (shape == 0u) {
        let t0 = (cen - hs - o) / d; let t1 = (cen + hs - o) / d;
        let tn = min(t0, t1); let tf = max(t0, t1);
        let a = max(tn.x, max(tn.y, tn.z)); let b = min(tf.x, min(tf.y, tf.z));
        hit = a <= b && b > 0.03; hp = o + d * max(a, 0.0);
      } else {
        let X = (o.x - cen.x) / hs.x; let Y = (o.y - cen.y) / hs.y; let DX = d.x / hs.x; let DY = d.y / hs.y;
        if (shape == 1u) {
          let qa = DX * DX + DY * DY; let qb = X * DX + Y * DY; let ds = qb * qb - qa * (X * X + Y * Y - 1.0);
          if (ds >= 0.0 && qa > 1e-9) {
            let ta = (-qb - sqrt(ds)) / qa; let tb = (-qb + sqrt(ds)) / qa;
            // the span inside the circle, cut to the cylinder's height
            let za = (cen.z - hs.z - o.z) / d.z; let zb = (cen.z + hs.z - o.z) / d.z;
            let a = max(ta, min(za, zb)); let b = min(tb, max(za, zb));
            hit = a <= b && b > 0.03; hp = o + d * max(a, 0.0);
          }
        } else {
          let Z = (o.z - cen.z) / hs.z; let DZ = d.z / hs.z;
          let qa = DX * DX + DY * DY + DZ * DZ; let qb = X * DX + Y * DY + Z * DZ; let ds = qb * qb - qa * (X * X + Y * Y + Z * Z - 1.0);
          if (ds >= 0.0) { let tb = (-qb + sqrt(ds)) / qa; let ta = (-qb - sqrt(ds)) / qa; hit = tb > 0.03; hp = o + d * max(ta, 0.0); }
        }
      }
      if (!hit || length(hp - o) > tMax) { continue; }
      if (mat == M_LEAF) {
        // a crown lets the sun through in flecks
        // (in blotches a metre wide and never wholly clear: the 0.4 m flecks, lit or not, flickered as the view moved
        // and read as holes in the shadow)
        let h = hash3(ifloor(hp.x) + j32(ob), ifloor(hp.y), ifloor(hp.z));
        lit = min(lit, OBJ_LEAF_GAP * h);
        if (lit <= 0.0) { return 0.0; }
        continue;
      }
      return 0.0;
    }
    return lit;
}
fn j32(v: u32) -> i32 { return i32(v & 0xffffu); }

// ---- the objects' footprints on the ground (fx[OB + 9], footGrid): a ray near the ground walks its cells
/** The footprint grid's cells a ray from P along unit D crosses within tEnd (along D), walked by footStep. */
struct FootWalk { G: u32, N: i32, cs: f32, ci: i32, cj: i32, si: i32, sj: i32, tx: f32, ty: f32, dtx: f32, dty: f32, tEnd: f32, ok: bool };
fn footStart(P: vec3f, D: vec3f, tMax: f32) -> FootWalk {
  var w = FootWalk(0u, 0, 1.0, 0, 0, 0, 0, 0.0, 0.0, 0.0, 0.0, tMax, false);
  let OB = fx[1];
  if (OB == 0u || fx[OB] == 0u || fx[OB + 9u] == 0u) { return w; }
  let G = OB + fx[OB + 9u]; let N = i32(fx[G + 2u]); let cs = fxf(G + 3u);
  let qx = (P.x - fxf(G)) / cs; let qy = (P.y - fxf(G + 1u)) / cs;
  if (qx < 0.0 || qy < 0.0 || qx >= f32(N) || qy >= f32(N)) { return w; }
  w.G = G; w.N = N; w.cs = cs; w.ci = i32(qx); w.cj = i32(qy); w.ok = true;
  w.si = select(1, -1, D.x < 0.0); w.sj = select(1, -1, D.y < 0.0);
  w.dtx = select(1e9, cs / abs(D.x), abs(D.x) > 1e-6); w.dty = select(1e9, cs / abs(D.y), abs(D.y) > 1e-6);
  w.tx = select(1e9, (select(f32(w.ci + 1), f32(w.ci), D.x < 0.0) - qx) * cs / abs(D.x), abs(D.x) > 1e-6);
  w.ty = select(1e9, (select(f32(w.cj + 1), f32(w.cj), D.y < 0.0) - qy) * cs / abs(D.y), abs(D.y) > 1e-6);
  return w;
}
/** The current cell's stretch (start, end) of the footprint grid's list. */
fn footCell(w: FootWalk) -> vec2u {
  let head = w.G + 4u; let c = u32(w.cj * w.N + w.ci);
  return vec2u(fx[head + c], fx[head + c + 1u]);
}
/** On to the next cell; false past the end or out of the grid. */
fn footStep(w: ptr<function, FootWalk>) -> bool {
  if ((*w).tx < (*w).ty) { if ((*w).tx > (*w).tEnd) { return false; } (*w).ci += (*w).si; (*w).tx += (*w).dtx; }
  else { if ((*w).ty > (*w).tEnd) { return false; } (*w).cj += (*w).sj; (*w).ty += (*w).dty; }
  return (*w).ci >= 0 && (*w).cj >= 0 && (*w).ci < (*w).N && (*w).cj < (*w).N;
}
/** How much of a light at H reaches P past the street objects (1 clear): the street lamps' shadows. */
fn footShadow(P: vec3f, H: vec3f) -> f32 {
  let V = H - P; let len = length(V);
  if (len < 0.6) { return 1.0; }
  let D = V / len;
  var w = footStart(P, D, len);
  if (!w.ok) { return 1.0; }
  let OB = fx[1]; let objs = OB + fx[OB + 2u]; let list = w.G + 4u + u32(w.N * w.N) + 1u;
  var lit = 1.0;
  for (var s = 0; s < 40; s++) {
    let r = footCell(w);
    for (var li = r.x; li < r.y; li++) {
      let ob = objs + fx[list + li] * OW;
      // (short of the lamp's own head)
      lit = min(lit, objBlock(ob, P, D, len, len - 0.5, 0.0));
      if (lit <= 0.0) { return 0.0; }
    }
    if (!footStep(&w)) { break; }
  }
  return lit;
}
/** How far the wet street and the glass mirror the street objects (m along the mirrored ray). */
const REFL_OBJ_FAR = 60.0;
/**
 * The street objects over what a mirrored ray from O along unit D found (cl, at its depth along the ray): the nearest
 * part it meets, plainly shaded (its color and the lamps' light; a lamp's head, a sign, a screen lit), as objectsOver
 * shades them for the view.
 */
fn objRefl(cl0: Cell, O: vec3f, D: vec3f) -> Cell {
  var cl = cl0;
  let tLim = min(cl.depth, REFL_OBJ_FAR);
  var w = footStart(O, D, tLim);
  if (!w.ok) { return cl; }
  let OB = fx[1]; let objs = OB + fx[OB + 2u]; let list = w.G + 4u + u32(w.N * w.N) + 1u;
  var best = tLim; var bp = 0u; var bo = 0u; var bn = vec3f(0.0); var found = false;
  for (var s = 0; s < 40; s++) {
    let r = footCell(w);
    for (var li = r.x; li < r.y; li++) {
      let ob = objs + fx[list + li] * OW;
      let x = fxf(ob); let y = fxf(ob + 1u); let c = fxf(ob + 2u); let sn = fxf(ob + 3u); let rr = fxf(ob + 4u);
      let o = vec3f((O.x - x) * c + (O.y - y) * sn, -(O.x - x) * sn + (O.y - y) * c, O.z);
      let d0 = vec3f(D.x * c + D.y * sn, -D.x * sn + D.y * c, D.z);
      // the ray's pass by its circle first
      let qa = d0.x * d0.x + d0.y * d0.y; let qb = o.x * d0.x + o.y * d0.y; let disc = qb * qb - qa * (o.x * o.x + o.y * o.y - rr * rr);
      if (disc < 0.0 || qa < 1e-9) { continue; }
      if ((-qb - sqrt(disc)) / qa >= best) { continue; }
      let d = select(d0, vec3f(1e-6), abs(d0) < vec3f(1e-6));
      let mo = fx[ob + 15u]; let np = fx[mo];
      for (var k = 0u; k < np; k++) {
        let p = mo + 1u + k * PW;
        if (fx[p + 10u] == M_GLASS) { continue; }
        let shape = fx[p]; let q0 = fx3(p + 1u); let q1 = fx3(p + 4u);
        let cen = (q0 + q1) * 0.5; let hs = max((q1 - q0) * 0.5, vec3f(0.03));
        var t = 1e9; var nr = vec3f(0.0);
        if (shape == 0u) {
          let t0 = (cen - hs - o) / d; let t1 = (cen + hs - o) / d;
          let tn = min(t0, t1); let tf = max(t0, t1);
          let a = max(tn.x, max(tn.y, tn.z)); let b = min(tf.x, min(tf.y, tf.z));
          if (a <= b && a > 0.03) { t = a; nr = select(select(vec3f(0.0, 0.0, -sign(d.z)), vec3f(0.0, -sign(d.y), 0.0), a == tn.y), vec3f(-sign(d.x), 0.0, 0.0), a == tn.x); }
        } else {
          let X = (o.x - cen.x) / hs.x; let Y = (o.y - cen.y) / hs.y; let DX = d.x / hs.x; let DY = d.y / hs.y;
          if (shape == 1u) {
            let a = DX * DX + DY * DY; let b = X * DX + Y * DY; let ds = b * b - a * (X * X + Y * Y - 1.0);
            if (ds >= 0.0 && a > 1e-9) { let tt = (-b - sqrt(ds)) / a; if (tt > 0.03 && abs(o.z + d.z * tt - cen.z) <= hs.z) { t = tt; nr = vec3f(X + DX * tt, Y + DY * tt, 0.0); } }
          } else {
            let Z = (o.z - cen.z) / hs.z; let DZ = d.z / hs.z;
            let a = DX * DX + DY * DY + DZ * DZ; let b = X * DX + Y * DY + Z * DZ; let ds = b * b - a * (X * X + Y * Y + Z * Z - 1.0);
            if (ds >= 0.0) { let tt = (-b - sqrt(ds)) / a; if (tt > 0.03) { t = tt; nr = vec3f(X + DX * tt, Y + DY * tt, Z + DZ * tt); } }
          }
        }
        if (t < best) { best = t; bp = p; bo = ob; bn = nr; found = true; }
      }
    }
    // a hit before this cell's far edge is the nearest (an object over several cells is met again further on)
    if (found && best <= min(w.tx, w.ty)) { break; }
    if (!footStep(&w)) { break; }
  }
  if (!found) { return cl; }
  let mat = fx[bp + 10u]; let c = fxf(bo + 2u); let sn = fxf(bo + 3u);
  let wn = normalize(vec3f(bn.x * c - bn.y * sn, bn.x * sn + bn.y * c, bn.z) + vec3f(1e-5, 0.0, 0.0));
  let H = O + D * best;
  let glow = mat == M_GLOW || mat == M_TEXT || mat == M_SCREEN;
  var col = fx3(bp + 7u);
  if (mat == M_SCREEN) { col = vec3f(150.0, 160.0, 190.0) * (col / 255.0); }
  var rgb = col * select((0.72 + 0.28 * abs(wn.x)) * (1.0 - OBJ_NIGHT * (1.0 - u.day)), 1.0, glow);
  var oIl = vec3f(0.0);
  if (!glow) { oIl = lightAt(H.x, H.y, H.z, wn) * 1.1; rgb += oIl; }
  gEm = select(vec3f(0.0), sat(rgb), glow); gIl = oIl; gTag = best; gWet = 0.0; gMat = MAT_NONE; gNrm = wn;
  gGlowK = 1.0; gEmK = select(1.0, SIGN_EMIT, mat == M_TEXT);
  let ch = select(fx[bp + 11u], LEAF[1], mat == M_LEAF);
  return Cell(ch, max(rgb, vec3f(0.0)), cl.bg, best, select(KIND_OBJECT, KIND_OTHER, glow), 2.0 + max(0.0, dot(wn, vec3f(u.sunX, u.sunY, u.sunZ))));
}

/** The most sun a crown lets through (its blotches between none and this). */
const OBJ_LEAF_GAP = 0.5;
/** How bright a small screen (a shelter's advert) is next to the big ones on the buildings. */
const SCREEN_K = 0.75; const SCREEN_S = 3.0;

// the objects over what the world drew in this cell, nearest wins (the cell's depth); (dz: the ray's rise per metre)
fn objectsOver(cl0: Cell, gx: u32, gy: u32, rdx: f32, rdy: f32, dz: f32) -> Cell {
  var cl = cl0;
  let OB = fx[1];
  if (OB == 0u || fx[OB] == 0u) { return cl; }
  let tile = gx / TILE;
  if (tile >= fx[OB + 1u]) { return cl; }
  let objs = OB + fx[OB + 2u]; let list = OB + fx[OB + 3u];
  for (var li = fx[OB + 10u + tile]; li < fx[OB + 11u + tile]; li++) {
    let ob = objs + fx[list + li] * OW;
    if (gx < fx[ob + 16u] || gx >= fx[ob + 17u] || gy < fx[ob + 18u] || gy >= fx[ob + 19u]) { continue; }
    let x = fxf(ob); let y = fxf(ob + 1u); let c = fxf(ob + 2u); let s = fxf(ob + 3u); let r = fxf(ob + 4u);
    let seed = bitcast<i32>(fx[ob + 7u]); let far = fxf(ob + 8u); let zoff = fxf(ob + 9u);
    let tYr = (x - u.px) * u.dirX + (y - u.py) * u.dirY; let tY = max(tYr, 0.3);
    // parts thinner than a cell at this distance are widened to half a cell, so poles do not flicker
    let mh = 0.5 * u.colW * tY; let mz = 0.5 * tY / u.scale;
    let fog = 1.0 - min(1.0, tYr / far) * 0.8;
    // the camera and this cell's ray in the object's frame (+x forward, +y right, z up)
    let ox = (u.px - x) * c + (u.py - y) * s; let oy = -(u.px - x) * s + (u.py - y) * c; let oz = u.eye - zoff;
    let dx = rdx * c + rdy * s; let dy = -rdx * s + rdy * c;
    let R = r + mh; let qa = dx * dx + dy * dy; let qb = ox * dx + oy * dy; let disc = qb * qb - qa * (ox * ox + oy * oy - R * R);
    if (disc < 0.0) { continue; }
    let sq = sqrt(disc); let tb = (-qb + sq) / qa;
    if (tb < 0.05) { continue; }
    let ta = max(0.05, (-qb - sq) / qa);
    if (cl.depth <= ta) { continue; }
    // a vehicle's body leans on its springs: its parts off the ground are hit by the ray turned (and lifted) into it
    let lean = fx[ob + 14u] == 1u; let indoor = fx[ob + 14u] == 2u; let pt = fxf(ob + 10u); let rl = fxf(ob + 11u); let lift = fxf(ob + 12u);
    let bo = vec3f(ox - pt * (oz - PIVOT), oy - rl * (oz - PIVOT), oz + pt * ox + rl * oy - lift);
    let bd = vec3f(dx - pt * dz, dy - rl * dz, dz + pt * dx + rl * dy);
    let mo = fx[ob + 15u]; let np = fx[mo];
    var best = cl.depth; var bk = -1; var face = 0; var nrm = vec3f(0.0); var glassT = 1e9;
    for (var k = 0u; k < np; k++) {
      let p = mo + 1u + k * PW;
      let shape = fx[p]; let q0 = fx3(p + 1u); let q1 = fx3(p + 4u);
      let cen = (q0 + q1) * 0.5; let hs = max((q1 - q0) * 0.5, vec3f(mh, mh, mz));
      let body = lean && q0.z > 0.0; let glassy = fx[p + 10u] == M_GLASS;
      let o = select(vec3f(ox, oy, oz), bo, body); let d = select(vec3f(dx, dy, dz), bd, body);
      if (shape == 0u) {
        var tmin = -1e9; var tmax = 1e9; var ax = 0; var miss = false;
        for (var a = 0; a < 3; a++) {
          if (abs(d[a]) < 1e-9) { if (abs(o[a] - cen[a]) > hs[a]) { miss = true; } }
          else {
            var t0 = (cen[a] - hs[a] - o[a]) / d[a]; var t1 = (cen[a] + hs[a] - o[a]) / d[a];
            if (t0 > t1) { let t = t0; t0 = t1; t1 = t; }
            if (t0 > tmin) { tmin = t0; ax = a; }
            if (t1 < tmax) { tmax = t1; }
          }
        }
        if (miss || tmin > tmax || tmin <= 0.05 || tmin >= best) { continue; }
        if (glassy) { glassT = min(glassT, tmin); continue; }
        best = tmin; bk = i32(k); face = ax;
        nrm = vec3f(0.0); nrm[ax] = -sign(d[ax]);
      } else {
        // upright elliptic cylinder or ellipsoid, solved in the space where it is a unit shape
        let X = (o.x - cen.x) / hs.x; let Y = (o.y - cen.y) / hs.y; let DX = d.x / hs.x; let DY = d.y / hs.y;
        if (shape == 1u) {
          let a = DX * DX + DY * DY; let b = X * DX + Y * DY; let ds = b * b - a * (X * X + Y * Y - 1.0);
          if (ds < 0.0) { continue; }
          var t = (-b - sqrt(ds)) / a;
          if (t > 0.05 && abs(o.z + d.z * t - cen.z) <= hs.z) {
            if (t >= best) { continue; }
            if (glassy) { glassT = min(glassT, t); continue; }
            best = t; bk = i32(k); face = 1; nrm = vec3f(X + DX * t, Y + DY * t, 0.0);
          } else if (d.z < 0.0 && o.z > cen.z + hs.z) {
            t = (cen.z + hs.z - o.z) / d.z;
            let uu = X + DX * t; let w = Y + DY * t;
            if (t <= 0.05 || t >= best || uu * uu + w * w > 1.0) { continue; }
            best = t; bk = i32(k); face = 2; nrm = vec3f(0.0, 0.0, 1.0);
          }
        } else {
          let Z = (o.z - cen.z) / hs.z; let DZ = d.z / hs.z;
          let a = DX * DX + DY * DY + DZ * DZ; let b = X * DX + Y * DY + Z * DZ; let ds = b * b - a * (X * X + Y * Y + Z * Z - 1.0);
          if (ds < 0.0) { continue; }
          let t = (-b - sqrt(ds)) / a;
          if (t <= 0.05 || t >= best) { continue; }
          if (glassy) { glassT = min(glassT, t); continue; }
          best = t; bk = i32(k); nrm = vec3f(X + DX * t, Y + DY * t, Z + DZ * t); face = select(1, 2, nrm.z > 0.75);
        }
      }
    }
    if (bk < 0) {
      // only glass in the way: what is already drawn behind it shows through, tinted
      if (glassT < cl.depth) { cl.c = cl.c * vec3f(0.62, 0.68, 0.74) + vec3f(18.0, 26.0, 34.0); }
      continue;
    }
    let p = mo + 1u + u32(bk) * PW;
    let mat = fx[p + 10u]; let shape = fx[p]; let q0 = fx3(p + 1u); let q1 = fx3(p + 4u);
    let cen = (q0 + q1) * 0.5; let hs = max((q1 - q0) * 0.5, vec3f(mh, mh, mz));
    let tOff = fx[p + 14u]; let tLen = fx[p + 15u]; let sym = fx[p + 16u];
    var col = fx3(p + 7u);
    let col2 = select(col, fx3(p + 17u), fx[p + 20u] == 1u);
    // the hit, unleaned, in the object's frame (as the CPU shades it)
    let hp = vec3f(ox, oy, oz) + vec3f(dx, dy, dz) * best;
    var ch = 32u; var kk = 1.0;
    if (mat == M_GLOW) { ch = fx[p + 11u]; kk = 0.6 + 0.4 * fog; }
    else if (mat == M_WHEEL) {
      // from the side: the hub, five spokes and the tyre with a scuff, turned by the wheel angle; from the front or back, the tread
      let wx = (hp.x - cen.x) / hs.x; let wz = (hp.z - cen.z) / hs.z;
      let rr = length(vec2f(wx, wz)); let ang = atan2(wz, wx) + fxf(ob + 13u); let sec = fract(ang / TAU);
      kk = (0.75 + 0.25 * abs(nrm.y)) * fog;
      if (abs(nrm.y) < 0.55) { ch = select(DASH, EQ, (ifloor(sec * 16.0) & 1) == 1); col = TYRE; }
      else if (rr < 0.28) { ch = O; col = HUB; }
      else if (rr < 0.62) { let f = fract(sec * 5.0); ch = select(DOT, SPOKES[u32(ifloor(sec * 20.0) & 3)], f < 0.3); col = select(TYRE, RIM, f < 0.3); }
      else {
        let scuff = sec > 0.08 && sec < 0.16;
        ch = select(select(STAR, HASH, (ifloor(sec * 12.0) & 1) == 1), PCT, scuff); col = select(TYRE, DIRT, scuff);
      }
    }
    else if (mat == M_BOARD && face == 0 && ox > q1.x && tLen > 0u) {
      // the billboard's face, read left to right from the front (+x): from +y toward -y
      let W = q1.y - q0.y; let H = q1.z - q0.z; let n = f32(tLen); let bulbs = fx[p + 22u] == 1u;
      let perCol = (u.colW * best) / max(1e-6, abs(dx)); let perRow = best / u.scale;
      let lw = min((W - min(0.8, W * 0.2)) / n, (H * 0.62) / 1.4); let lh = lw * 1.4; let start = (W - n * lw) / 2.0;
      let uu = q1.y - hp.y - start; let li = ifloor(uu / lw); let fz = ((q0.z + q1.z) / 2.0 + lh / 2.0 - hp.z) / lh;
      let frame = !bulbs && (min(hp.y - q0.y, q1.y - hp.y) < max(min(0.2, W * 0.05), perCol / 2.0) || min(hp.z - q0.z, q1.z - hp.z) < max(min(0.2, H * 0.08), perRow / 2.0));
      var fg = false;
      // the board's face between the letters is solid (a sparse glyph read as tinted glass, 13.7)
      ch = select(HASH, DOT, bulbs);
      if (frame) { ch = EQ; }
      else if (li >= 0 && f32(li) < n && ((fz >= 0.0 && fz < 1.0) || bulbs)) {
        let cc = fx[tOff + u32(li)]; let fu = (uu / lw - f32(li)) * 1.25 - 0.12;
        if (select(lw / perCol >= BULB_COLS && lh / perRow >= BULB_ROWS, lw / perCol >= 3.5 && lh / perRow >= 4.0, bulbs)) {
          // block letters painted as a 5x7 grid (0.8 of the slot across), counted per cell like the bulbs
          let ux = (lw * 0.8) / 5.0; let uz = lh / 7.0; let bhx = perCol / ux / 2.0; let bhz = perRow / uz / 2.0;
          let nb = bulbsIn(cc, fu * 5.0, fz * 7.0, bhx, bhz);
          fg = nb > 0u;
          if (fg) { let gl = bulbGlyph(nb, bhx, bhz); ch = select(select(HASH, COL, gl == 58u), gl, bulbs); }
        } else if (lw / perCol >= 0.9 && (bulbs || lh / perRow >= 0.9)) {
          // one glyph in the cell holding the letter's center
          fg = abs(uu - (f32(li) + 0.5) * lw) < perCol / 2.0 && abs(fz - 0.5) * lh < perRow / 2.0 + 0.01;
          if (fg) { ch = cc; }
        } else { fg = hash3(li, 1, 9) < 0.6; ch = EQ; }
      }
      if (frame) { col = vec3f(60.0, 58.0, 55.0); } else if (fg) { col = col2; }
      // gooseneck lamps along the bottom light it from below, fading upward
      kk = (0.55 + 0.25 * hash3(ifloor(hp.y * 2.0), ifloor(hp.z * 2.0), 7)) * fog + fxf(p + 21u) * 1.3 * max(0.0, 1.0 - (hp.z - q0.z) / H);
      if (bulbs && fg) { kk = 0.75 + 0.45 * fog; }
    }
    else if (mat == M_SCREEN) {
      // a video screen on its faces across y (a bus shelter's advert, both sides), the telões' animations; the edges a dark frame
      let pw = col / 255.0; // the part's color is its power (dims in a blackout)
      ch = EQ; col = vec3f(40.0, 40.0, 44.0); kk = fog;
      if (face == 1) {
        let W = q1.x - q0.x; let H = q1.z - q0.z;
        let uu = select(q1.x - hp.x, hp.x - q0.x, oy > cen.y); // read left to right from either side
        // drawn as a screen SCREEN_S times bigger, so its pixels are finer than the buildings' 0.3 m
        let S = SCREEN_S;
        let px = screenPix(seed, uu * S, (q1.z - hp.z) * S, W * S, H * S, S * (u.colW * best) / max(1e-6, abs(dy)), S * best / u.scale);
        ch = px.ch; col = px.c * SCREEN_K * pw; kk = 1.0;
      }
    }
    else if (mat == M_TEXT && face == 1 && tLen > 0u) {
      let W = q1.x - q0.x;
      let perCol = (u.colW * best) / max(1e-6, abs(dy)); let perRow = best / u.scale;
      let symH = select(0.0, W, sym > 0u); let n = f32(tLen); let lh = (q1.z - q0.z - symH) / n;
      // the slot this cell is in: the symbol square on top, or one letter; its box and bulb grid
      var cc = 0u; var sl = 0u; var bw = 5.0; var bh = 7.0; var sx0 = 0.0; var sz0 = 0.0; var sw = 0.0; var sh = 0.0; var farC = 0u;
      if (hp.z > q1.z - symH) { sl = sym; bw = 9.0; bh = 9.0; sw = W * 0.9; sh = sw; sx0 = q0.x + W * 0.05; sz0 = q1.z - W * 0.05; farC = SYM_FAR[sym - 1u]; }
      else {
        let li = min(i32(tLen) - 1, ifloor((q1.z - symH - hp.z) / lh));
        cc = fx[tOff + u32(max(li, 0))]; farC = cc;
        sw = min(W * 0.66, lh * 0.62); sh = lh * 0.8; sx0 = (q0.x + q1.x - sw) / 2.0; sz0 = q1.z - symH - f32(li) * lh - lh * 0.1;
      }
      if (perRow > lh * 0.9) { ch = BAR; kk = 0.7; }
      else if (sw / perCol >= BULB_COLS && sh / perRow >= BULB_ROWS) {
        // up close: bulbs, counted per cell; read left to right from either side (seen from -y, +x is to the viewer's left)
        let ux = sw / bw; let uz = sh / bh; let bpx = select(hp.x - sx0, sx0 + sw - hp.x, oy < 0.0) / ux; let bpz = (sz0 - hp.z) / uz;
        let nb = slotBulbs(cc, sl, bpx, bpz, perCol / ux / 2.0, perRow / uz / 2.0);
        let bx = ifloor(bpx); let by = ifloor(bpz);
        if (nb > 0u) { ch = bulbGlyph(nb, perCol / ux / 2.0, perRow / uz / 2.0); kk = 1.25; }
        else if (slotOn(cc, sl, bx, by)) { ch = 32u; kk = 0.75; }
        else { ch = EQ; kk = 0.3; } // the panel between the bulbs, solid (a blank read as tinted glass, 13.7)
      } else {
        // a glyph in the one cell holding the slot's center; the rest of the panel glows faintly
        let center = abs(hp.x - (sx0 + sw / 2.0)) < max(perCol, 0.05) / 2.0 && abs(hp.z - (sz0 - sh / 2.0)) < perRow / 2.0 + 0.01;
        ch = select(EQ, farC, center); kk = select(0.3, 1.0, center);
      }
    }
    else {
      // lit like the buildings: faces turned along x brighter, tops brightest
      let wn = abs(nrm.x * c - nrm.y * s) / select(length(nrm.xy), 1.0, length(nrm.xy) == 0.0);
      kk = select(0.72 + 0.28 * wn, 1.15, face == 2) * fog;
      if (mat == M_LEAF) {
        let h = hash3(ifloor(hp.x / 0.35) + seed, ifloor(hp.y / 0.35), ifloor(hp.z / 0.35));
        ch = LEAF[min(4u, u32(h * 5.0))];
        kk *= 0.55 + 0.45 * h + 0.25 * nrm.z;
      } else { ch = select(select(fx[p + 11u], fx[p + 13u], face == 0 && shape == 0u), fx[p + 12u], face == 2); }
      if (mat == M_SKIN) { col = mcSkin(fx[p + 23u], hp, q0, q1, col, col2); ch = HASH; }
    }
    // a board's printed face is a surface like any other (lit, shaded, its own sun), lit at night by its lamps too
    let painted = mat == M_GLOW || mat == M_TEXT || mat == M_SCREEN;
    // at night the paint reads darker, as the walls' palette does (the lamps' light comes on top, by its color)
    var rgb = col * kk * select(1.0, 1.0 - OBJ_NIGHT * (1.0 - u.day), !painted && !indoor && mat != M_GLOW && mat != M_BOARD); var oEm = vec3f(0.0); var oIl = vec3f(0.0);
    if (face == 2 && u.snow > 0.0 && !painted && !indoor) { rgb += (vec3f(185.0, 190.0, 200.0) - rgb) * (u.snow * 0.85); }
    if (!painted && indoor) { rgb *= insideLight(x + hp.x * c - hp.y * s, y + hp.x * s + hp.y * c); } // the room's lamps
    else if (!painted) {
      // the light where the ray hit, strongest on tops
      let wn = vec3f(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z);
      let L = lightAt(x + hp.x * c - hp.y * s, y + hp.x * s + hp.y * c, hp.z + zoff, wn / max(1e-4, length(wn)));
      rgb += L * (select(1.1, 1.5, face == 2) * fog); oIl = L * (select(1.1, 1.5, face == 2) * fog);
    }
    if (mat == M_GLOW || mat == M_TEXT || (mat == M_SCREEN && face == 1)) { oEm = rgb; }
    // seen through glass: darker and colder, with a faint sheen
    if (glassT < best) { rgb = rgb * vec3f(0.6, 0.66, 0.72) + vec3f(16.0, 24.0, 34.0); oEm *= 0.66; oIl *= 0.66; }
    // the share of direct sun on this face (2 + share, see finish), by its own normal (signs too: taking
    // what was under them showed the wall's shadows through them, 13.7); a fire escape keeps what was under it
    var sun = select(0.0, cl.sun, cl.sun >= 2.0);
    if (cl.kind == KIND_WALL && !indoor) { sun = 2.0 + cl.sun; }
    if (mat != M_GLOW && zoff == 0.0 && !indoor) {
      let w = vec3f(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z); let nl = select(length(w), 1.0, length(w) == 0.0);
      sun = 2.0 + max(0.0, dot(w, vec3f(u.sunX, u.sunY, u.sunZ)) / nl);
    }
    gEm = sat(oEm); gIl = oIl; gTag = best; gWet = 0.0;
    // a blade sign and the bulbs up its edges look lit, as the shop signs do (SIGN_EMIT); an advert screen as the telões do
    let signLit = mat == M_TEXT || (mat == M_GLOW && fx[p + 22u] == 1u);
    gGlowK = select(1.0, SIGN_GLOW, signLit); gEmK = select(select(1.0, SCREEN_EMIT, mat == M_SCREEN && face == 1), SIGN_EMIT, signLit);
    // the material: a vehicle's body is glossy paint, leaves are matte; the rest (people, poles, benches) plain
    let wn = vec3f(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z); let wl = length(wn);
    gNrm = select(vec3f(0.0, 0.0, 1.0), wn / wl, wl > 1e-5);
    gMat = select(select(MAT_NONE, MAT_LEAF, mat == M_LEAF), MAT_PAINT, lean && mat == M_SOLID && !indoor);
    cl = Cell(ch, max(rgb, vec3f(0.0)), cl.bg, best, select(select(KIND_OTHER, KIND_OBJECT, mat == M_SOLID && !painted), KIND_ROOM, indoor), sun);
  }
  return cl;
}
`;
}
