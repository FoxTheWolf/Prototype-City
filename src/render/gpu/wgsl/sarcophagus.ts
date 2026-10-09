export const sarcophagusWGSL = (): string => /* wgsl */ `// ---- the Sarcophagus on the horizon (sarcophagus.ts): the dome, the draft tower and the cranes
fn domeZ(r: f32, h: f32, rho: f32) -> f32 {
  if (rho >= r) { return 0.0; }
  let Rs = (r * r + h * h) / (2.0 * h);
  return sqrt(Rs * Rs - rho * rho) - (Rs - h);
}
// [entry, exit] along the unit ray (ux, uy) through a circle, or x < 0 for none
fn span2(cx: f32, cy: f32, r: f32, ux: f32, uy: f32) -> vec2f {
  let ox = u.px - cx; let oy = u.py - cy; let b = ox * ux + oy * uy; let disc = b * b - (ox * ox + oy * oy - r * r);
  if (disc > 0.0 && -b + sqrt(disc) > 0.0) { return vec2f(max(1.0, -b - sqrt(disc)), -b + sqrt(disc)); }
  return vec2f(-1.0);
}
// apparent height above the eye of a surface point z at distance d, over the curve, as a slope
fn slopeAt(z: f32, d: f32) -> f32 { return (z - u.eye - d * d / (2.0 * u.curveR)) / d; }
fn sarcVis() -> f32 { if (!FIRE_ZONE) { return 0.0; } return smoothK(u.sarR + 3700.0, u.sarR + 3100.0, length(vec2f(u.sarX - u.px, u.sarY - u.py))); }
// the dome or tower in this cell (want: the cell's slope; sL: rows per unit of slope), depth 1e9 if none
fn sarcCell(want: f32, sL: f32, L: f32, ux: f32, uy: f32, col: f32, bg: vec3f, vis: f32) -> Cell {
  var o = Cell(32u, vec3f(0.0), bg, 1e9, KIND_BLOCK, 0.0);
  let day = u.day; let fire = 0.75 * (1.0 - 0.7 * day); let dark = 18.0 * 0.7 * day;
  let flick = 0.75 + 0.25 * sin(u.sec * 0.7 + col * 0.05); let steel = 16.0 + 14.0 * day;
  let sun = vec3f(u.sunX, u.sunY, u.sunZ);
  var best = 1e9; var c = vec3f(0.0); var ch = 32u; var sh = 0.0;
  let dome = span2(u.sarX, u.sarY, u.sarR, ux, uy);
  if (dome.x >= 0.0) {
    let ds = (dome.y - dome.x) / 24.0;
    var top = -1e9;
    for (var k = 0; k <= 24; k++) { let dd = dome.x + ds * f32(k); top = max(top, slopeAt(domeZ(u.sarR, u.sarH, length(vec2f(u.px + ux * dd - u.sarX, u.py + uy * dd - u.sarY))), dd)); }
    if (want <= top && want >= slopeAt(0.0, dome.x) - 1.0 / sL) {
      // the first point along the ray where the dome rises above this cell
      var d = dome.x; var z = 0.0;
      for (var k = 0; k <= 24; k++) {
        d = dome.x + ds * f32(k);
        z = domeZ(u.sarR, u.sarH, length(vec2f(u.px + ux * d - u.sarX, u.py + uy * d - u.sarY)));
        if (slopeAt(z, d) >= want) { break; }
      }
      let hx = u.px + ux * d - u.sarX; let hy = u.py + uy * d - u.sarY; let phi = atan2(hy, hx);
      // panels: 2.5 degrees around by 50 m up; a third never went up, and the fire shows through
      let pa = ifloor((phi + 3.14159265) / 0.044); let pz = ifloor(z / 50.0); let ph = hash3(pa, pz, 92);
      let Rs = (u.sarR * u.sarR + u.sarH * u.sarH) / (2.0 * u.sarH);
      let nrm = normalize(vec3f(hx / Rs + (ph - 0.5) * 0.08, hy / Rs + (hash3(pa, pz, 93) - 0.5) * 0.08, (z + Rs - u.sarH) / Rs));
      let ns = dot(nrm, sun);
      // a glint where the sun mirrors off a panel toward the eye
      let vv = vec3f(-ux, -uy, (u.eye - z) / d);
      var spec = 0.0;
      if (sun.z > 0.0 && ns > 0.0) { spec = (2.0 * ns * dot(nrm, vv) - dot(sun, vv)) / length(vv); }
      let glint = select(32u, select(PLUS, STAR, spec > 0.996), day > 0.2 && spec > 0.985);
      let pk = 0.85 + 0.3 * ph;
      best = d;
      if ((top - want) * sL < 1.0) { c = vec3f(steel * 1.3, steel * 1.3, steel * 1.4); sh = ns + 0.01; }
      else if (z < 45.0) { c = vec3f(230.0 * flick * fire + dark, 95.0 * flick * fire + dark, 30.0 * fire + dark); }
      else if (hash3(pa, pz, 91) < 0.33) { c = vec3f(200.0 * flick * fire + dark, 80.0 * flick * fire + dark, 28.0 * fire + dark); }
      else { let rib = select(1.0, 0.8, pa % 3 == 0); ch = glint; c = vec3f(steel * pk * rib, steel * pk * rib, steel * 1.12 * pk * rib); sh = ns + 0.01; }
    }
  }
  let tw = span2(u.towX, u.towY, u.towR, ux, uy);
  if (tw.x >= 0.0 && tw.x < best) {
    // the draft tower: a squat ribbed drum, its rim glowing with the heat it was built to draw up
    let d = tw.x; let top = slopeAt(u.towH, d);
    if (want <= top && want >= slopeAt(0.0, d) - 1.0 / sL) {
      let ang = atan2(u.py + uy * d - u.towY, u.px + ux * d - u.towX);
      best = d; ch = 32u; sh = 0.0;
      if ((top - want) * sL < 1.0) {
        ch = select(32u, STAR, (ifloor(u.sec * 1.5) + i32(col)) % 9 == 0);
        c = vec3f(255.0 * flick * fire + dark, 70.0 * fire + dark, 40.0 * fire + dark);
      } else {
        let rib = select(1.0, 0.8, ifloor((ang + 3.14159265) / 0.06) % 4 == 0);
        c = vec3f(steel * 0.9 * rib, steel * 0.9 * rib, steel * rib); sh = cos(ang) * sun.x + sin(ang) * sun.y + 0.01;
      }
    }
  }
  if (best >= 1e9) { return o; }
  // fade out into whatever is behind (the smoky low sky) as it leaves view
  let haze = 0.45 * (1.0 - day);
  c = c * (1.0 - haze) + bg * haze;
  o.ch = ch; o.c = bg + (c - bg) * vis; o.bg = bg + (c * 0.35 - bg) * vis;
  o.depth = best / L; o.sun = select(0.0, clamp(sh, 0.0, 1.0), sh != 0.0);
  return o;
}
// the cranes on the dome, stopped mid-job, projected like the CPU's (drawCranes); depth 1e9 if none here
fn craneCell(gx: i32, gy: i32, vis: f32) -> Cell {
  var o = Cell(32u, vec3f(0.0), vec3f(7.0, 8.0, 12.0), 1e9, KIND_OTHER, 0.0);
  let invDet = 1.0 / (u.plX * u.dirY - u.dirX * u.plY);
  let c0 = sg[3]; let nc = sg[4];
  for (var q = 0u; q < nc; q++) {
    let kx = bitcast<f32>(sg[c0 + q * 4u]); let ky = bitcast<f32>(sg[c0 + q * 4u + 1u]); let kz = bitcast<f32>(sg[c0 + q * 4u + 2u]); let ka = bitcast<f32>(sg[c0 + q * 4u + 3u]);
    let rx = kx - u.px; let ry = ky - u.py; let tY = invDet * (-u.plY * rx + u.plX * ry);
    if (tY < 10.0 || tY >= o.depth) { continue; }
    let tX = invDet * (u.dirY * rx - u.dirX * ry); let dx = gx - ifloor((u.cols / 2.0) * (1.0 + tX / tY));
    if (dx < -1 || dx > 1) { continue; }
    let drop = (rx * rx + ry * ry) / (2.0 * u.curveR);
    let yTop = i32(ceil(u.hor - ((kz - u.eye - drop) * u.scale) / tY - 0.5)); let yBot = i32(ceil(u.hor - ((kz - 70.0 - u.eye - drop) * u.scale) / tY - 0.5));
    if (gy < yTop || gy > yBot) { continue; }
    let lightOn = (u.sec + ka) % 1.6 < 0.5;
    if (gy == yTop) {
      if (dx == 0) { o.ch = select(DASH, STAR, lightOn); o.c = select(vec3f(60.0 * vis, 60.0 * vis, 65.0 * vis), vec3f(255.0 * vis, 40.0, 30.0), lightOn); }
      else { o.ch = DASH; o.c = vec3f(70.0, 70.0, 76.0) * vis; }
    } else if (dx == 0) { o.ch = BAR; o.c = vec3f(60.0, 60.0, 66.0) * vis; }
    else { continue; }
    o.depth = tY;
  }
  return o;
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
// the smoke columns over the fire zone (drawSmoke): color only, veiling what is behind them in puffs that
// rise, glowing orange at the base; each vent's column measured in metres across at its distance
fn smokeOver(cl: Cell, rdx: f32, rdy: f32, m: f32) -> Cell {
  var o = cl;
  let fwd = rdx * u.dirX + rdy * u.dirY;
  if (fwd < 1e-3) { return o; }
  let lat = rdy * u.dirX - rdx * u.dirY;
  let v0 = sg[5]; let nv = sg[6];
  for (var q = 0u; q < nv; q++) {
    let w = v0 + q * 4u;
    let sx = bitcast<f32>(sg[w]); let sy = bitcast<f32>(sg[w + 1u]); let sr = bitcast<f32>(sg[w + 2u]); let sh = bitcast<f32>(sg[w + 3u]);
    let rx = sx - u.px; let ry = sy - u.py; let fV = rx * u.dirX + ry * u.dirY;
    if (fV < 5.0) { continue; }
    let t = fV / fwd;
    if (o.depth <= t) { continue; }
    let drop = (rx * rx + ry * ry) / (2.0 * u.curveR);
    let vv = (sh - drop - (u.eye - m * t)) / sh; // 0 at the top of the column, 1 at the ground
    if (vv < 0.0 || vv >= 1.0) { continue; }
    let rise = 1.0 - vv;
    // the column widens and leans downwind as it rises
    let half = sr * (0.5 + 1.7 * rise); let mid = ry * u.dirX - rx * u.dirY + rise * rise * sr * 1.5;
    let uu = (lat * t - mid) / half;
    if (abs(uu) >= 1.0) { continue; }
    let row = ifloor(vv * 30.0 + u.sec * 60.0 * 0.03 * (30.0 / max(1.0, sh / 10.0)));
    let a = (1.0 - uu * uu) * (0.25 + 0.75 * vv) * 0.55 * (0.55 + 0.45 * hash3(ifloor(uu * 5.0 + sx), row, i32(sy)));
    if (a < 0.02) { continue; }
    let glow = select(0.0, (vv - 0.7) / 0.3, vv > 0.7);
    let g0 = (60.0 + 30.0 * vv) * (1.0 - min(1.0, fV / 2500.0) * 0.7);
    let sc = vec3f(g0 + 120.0 * glow, g0 + 40.0 * glow, g0 * 1.05);
    o.bg += (sc - o.bg) * a;
    if (o.ch != 32u && o.ch != 0u) { o.c += (sc - o.c) * a; }
  }
  return o;
}
`;
