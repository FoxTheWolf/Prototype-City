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
 *   the roofs that keep the rain off (fx[OB + 4] where, fx[OB + 5] how many; seven floats each), and the floor
 *   the viewer stands in (fx[OB + 6] where, 0 outdoors; see the shader's interiorCell). The furniture is objects
 *   too, marked indoor (lit by the rooms' lamps, multiplied).
 */
export const OW = 20, PW = 24, TILE = 8;

const C = (s: string) => s.charCodeAt(0);

export function objectsWGSL(): string {
  return /* wgsl */ `
const OW = ${OW}u; const PW = ${PW}u; const TILE = ${TILE}u; const PIVOT = 0.7;
const M_SOLID = 0u; const M_LEAF = 1u; const M_GLOW = 2u; const M_TEXT = 3u; const M_BOARD = 4u; const M_WHEEL = 5u; const M_GLASS = 6u;
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

// the objects over what the world drew in this cell, nearest wins (the cell's depth); (dz: the ray's rise per metre)
fn objectsOver(cl0: Cell, gx: u32, gy: u32, rdx: f32, rdy: f32, dz: f32) -> Cell {
  var cl = cl0;
  let OB = fx[1];
  if (OB == 0u || fx[OB] == 0u) { return cl; }
  let tile = gx / TILE;
  if (tile >= fx[OB + 1u]) { return cl; }
  let objs = OB + fx[OB + 2u]; let list = OB + fx[OB + 3u];
  for (var li = fx[OB + 8u + tile]; li < fx[OB + 9u + tile]; li++) {
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
      ch = DOT;
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
        else if (slotOn(cc, sl, bx, by)) { ch = 32u; kk = 0.45; }
        else { ch = 32u; kk = 0.12; }
      } else {
        // a glyph in the one cell holding the slot's center; the rest of the panel glows faintly
        let center = abs(hp.x - (sx0 + sw / 2.0)) < max(perCol, 0.05) / 2.0 && abs(hp.z - (sz0 - sh / 2.0)) < perRow / 2.0 + 0.01;
        ch = select(32u, farC, center); kk = select(0.3, 1.0, center);
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
    }
    var rgb = col * kk; var oEm = vec3f(0.0); var oIl = vec3f(0.0);
    let painted = mat == M_GLOW || mat == M_TEXT || (mat == M_BOARD && face == 0);
    if (face == 2 && u.snow > 0.0 && !painted && !indoor) { rgb += (vec3f(185.0, 190.0, 200.0) - rgb) * (u.snow * 0.85); }
    if (!painted && indoor) { rgb *= insideLight(x + hp.x * c - hp.y * s, y + hp.x * s + hp.y * c); } // the room's lamps
    else if (!painted) {
      // the light where the ray hit, strongest on tops
      let L = lightAt(x + hp.x * c - hp.y * s, y + hp.x * s + hp.y * c, hp.z + zoff);
      rgb += L * (select(1.1, 1.5, face == 2) * fog); oIl = L * (select(1.1, 1.5, face == 2) * fog);
    }
    if (mat == M_GLOW || mat == M_TEXT) { oEm = rgb; }
    // seen through glass: darker and colder, with a faint sheen
    if (glassT < best) { rgb = rgb * vec3f(0.6, 0.66, 0.72) + vec3f(16.0, 24.0, 34.0); oEm *= 0.66; oIl *= 0.66; }
    // the share of direct sun on this face (2 + share, see finish); a fire escape (no sun on the CPU) and
    // the painted faces keep what was under them
    var sun = select(0.0, cl.sun, cl.sun >= 2.0);
    if (cl.kind == KIND_WALL && !indoor) { sun = 2.0 + cl.sun; }
    if (!painted && mat != M_GLOW && zoff == 0.0 && !indoor) {
      let w = vec3f(nrm.x * c - nrm.y * s, nrm.x * s + nrm.y * c, nrm.z); let nl = select(length(w), 1.0, length(w) == 0.0);
      sun = 2.0 + max(0.0, dot(w, vec3f(u.sunX, u.sunY, u.sunZ)) / nl);
    }
    gEm = sat(oEm); gIl = oIl; gTag = best; gGlowK = 1.0;
    cl = Cell(ch, sat(rgb), cl.bg, best, select(select(KIND_OTHER, KIND_OBJECT, mat == M_SOLID && !painted), KIND_ROOM, indoor), sun);
  }
  return cl;
}
`;
}
