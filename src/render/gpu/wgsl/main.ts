export const mainWGSL = (): string => /* wgsl */ `@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let cols = u32(u.cols); let rows = u32(u.rows);
  if (gid.x >= cols || gid.y >= rows) { return; }
  heads();
  let n = cols * rows; let i = gid.y * cols + gid.x;
  let camX = 2.0 * (f32(gid.x) + 0.5) / u.cols - 1.0;
  // the ray: on the ground plane (rdx, rdy), and how fast it drops per unit of that (m):
  // z(t) = eye - m t + (t L)^2 / 2R (the ground falls away over the curve). Sheared like the CPU's, or a true 3D camera turned by the pitch.
  var rdx = u.dirX + u.plX * camX; var rdy = u.dirY + u.plY * camX;
  var m = (f32(gid.y) + 0.5 - u.hor) / u.scale;
  if (u.cam3d > 0.5) {
    let cp = cos(u.pitch); let sp = sin(u.pitch); let v = (u.rows * 0.5 - (f32(gid.y) + 0.5)) / u.scale; let h = camX * u.plane;
    let D = vec3f(u.dirX * cp, u.dirY * cp, sp) + vec3f(-u.dirY, u.dirX, 0.0) * h + vec3f(-u.dirX * sp, -u.dirY * sp, cp) * v;
    rdx = D.x; rdy = D.y; m = -D.z;
  }
  let L = sqrt(rdx * rdx + rdy * rdy);
  let A = L * L / (2.0 * u.curveR);
  gOX = u.px; gOY = u.py; gOZ = u.eye; gRefl = false; gMat = MAT_NONE; gWet = 0.0;
  gRay = normalize(vec3f(rdx, rdy, -m));
  var tG = 1e9;
  if (m > 0.0) { let disc = m * m - 4.0 * A * u.eye; if (disc > 0.0) { tG = 2.0 * u.eye / (m + sqrt(disc)); } }

  // indoors, the floor around the viewer first: the city shows only through its windows
  let IB = inBlock();
  var inc = InC(Cell(32u, vec3f(0.0), vec3f(7.0, 8.0, 12.0), 1e9, KIND_OTHER, 0.0), 0u, 0.0, 0.0, vec3f(0.0), false, 0.0, 0.0, 0.0, 0.0);
  if (IB != 0u) {
    // the viewer's storey; through its stairwell, the storey above or below, as a room seen from outside it is (its
    // furniture met by the walk). One call in a loop: WGSL inlines roomWalk at each call, and the shader is slow to compile
    var V = inView(IB); var tIn = 0.0; var thruWell = false;
    gWR = vec4f(fxf(IB + 18u), fxf(IB + 19u), fxf(IB + 20u), fxf(IB + 21u)); gThru = false;
    for (var walkN = 0; walkN < 2; walkN++) {
      gWell = 0;
      inc = roomWalk(V, rdx, rdy, m, tIn);
      if (gWell == 0 || thruWell) { break; }
      let f2 = V.f + gWell;
      V = RView(gWellO, V.lot, V.box, f2, f32(f2) * FLOOR_H, false, V.elec, -1, 0u, true); tIn = gWellT; thruWell = true; gThru = true;
    }
    if (thruWell && inc.state == 0u) { inc.state = 1u; inc.cl = roomCell(32u, vec3f(0.0), tIn); }
    gWell = 0; gWR = vec4f(0.0); gThru = false;
  }
  var cl = inc.cl;
  gBackT = 0.0;
  gPeekT = 0.0;
  var handD = 0.0;
  // the rays this cell sends through the city, in one loop with one call of cityCell (WGSL inlines it at each call, and
  // three calls made the shader three times as slow to compile, 13.S): 0 the view's own; 1 (13.10b2) on through a
  // room seen through a window or an open street door, from the window on its far side, to the street behind; 2 (R.24)
  // the reflection: glass and wet ground mirror the city along a ray from where the view's hit; anything else glossy
  // (a car's paint, metal) mirrors the sky. Weighed by Fresnel and the roughness.
  var thru = vec3f(0.0); var thruCh = 32u; var thruK = 0.0; var thruPane = 1.0; var thruD = -1.0;
  var refl = vec3f(0.0); var rw = 0.0; var rGlow = 0.0;
  // what a second ray overwrites of the view's hit, put back after it
  var sEm = vec3f(0.0); var sIl = vec3f(0.0); var sTag = 0.0; var sGK = 0.0; var sEK = 0.0; var sMat = 0u; var sN = vec3f(0.0); var sWet = 0.0; var sRay = vec3f(0.0);
  // the reflection's ray (2): where it starts along the view's ray, and how much sky it fades into
  var tr = 0.0; var skyK = 0.0; var mR = 0.0; var rx = 0.0; var ry = 0.0;
  for (var ray = 0; ray < 3; ray++) {
    var go = false; var qx = rdx; var qy = rdy; var qm = m; var qL = L; var qA = A; var qg = tG;
    if (ray == 0) { go = inc.state != 1u; }
    else if (ray == 1) {
      handD = select(cl.depth, max(cl.depth, gPeekT), cl.kind == KIND_ROOM);
      if (inc.state != 1u && gBackT > 0.0 && cl.kind == KIND_ROOM && abs(cl.depth - gBackW) < 1e-3) {
        tr = gBackT + 0.05; thruK = abs(gBackK); thruD = cl.depth; thruPane = select(1.0, 0.0, gBackK < 0.0);
        sEm = gEm; sIl = gIl; sTag = gTag; sGK = gGlowK; sEK = gEmK; sMat = gMat; sN = gNrm; sWet = gWet;
        gOX = u.px + rdx * tr; gOY = u.py + rdy * tr; gOZ = u.eye - m * tr + A * tr * tr;
        qg = 1e9;
        if (m > 0.0) { let disc = m * m - 4.0 * A * gOZ; if (disc > 0.0) { qg = 2.0 * gOZ / (m + sqrt(disc)); } }
        go = true;
      }
    } else {
      // the street objects (and the furniture) over all of it, the window glass, then rain and snow over
      // the finished cell, only beyond the glass indoors (the sky's depth is 1e9, so the finish leaves it as it is)
      cl = objectsOver(cl, gid.x, gid.y, rdx, rdy, -m);
      if (inc.state == 2u && !inc.gdoor) { cl = glassOver(cl, inc, m); }
      if (cl.depth == gTag && cl.depth < 1e8 && gMat != MAT_NONE) {
        let N = gNrm; let nv = max(1e-3, -dot(N, gRay)); let r = matRough();
        rw = fres(MAT_F0[gMat], nv) * (1.0 - r) * (1.0 - r);
        if (N.z > 0.5 && gMat != MAT_PAINT) { rw = min(rw, 0.7); } // a puddle never mirrors all of it
        if (rw > 0.03) {
          tr = cl.depth;
          var R = gRay - 2.0 * dot(gRay, N) * N;
          // a rough surface scatters its mirror: the ray turned a little per cell (a dithered blur)
          if (r > 0.08) {
            let jx = hash3(i32(gid.x), i32(gid.y), 31) - 0.5; let jy = hash3(i32(gid.x), i32(gid.y), 32) - 0.5; let jz = hash3(i32(gid.x), i32(gid.y), 33) - 0.5;
            // on the ground it smears up and down more than sideways (the long streaks under lights on wet asphalt)
            let an = select(vec3f(1.0), vec3f(0.35, 0.35, 1.8), N.z > 0.5);
            R = normalize(R + vec3f(jx, jy, jz) * an * (REFL_BLUR * r));
            if (dot(R, N) < 0.02) { R = normalize(R + N * (0.02 - dot(R, N))); }
          }
          let LR = length(R.xy); mR = -R.z / max(LR, 1e-4);
          // the rain ripples the puddles: the reflection wavers up and down, a streak under each light
          if (N.z > 0.5 && u.rain > 0.0 && gMat != MAT_PAINT) { mR += (hash3(i32(gid.x), i32(gid.y), ifloor(u.sec * 6.0 + 7.0 * hash3(i32(gid.x), i32(gid.y), 77))) - 0.5) * 0.05 * u.rain; } rx = R.x / max(LR, 1e-4); ry = R.y / max(LR, 1e-4);
          let ground = N.z > 0.5;
          // past its reach a surface mirrors only the sky; the city's reflection fades into it over the last stretch,
          // so a tall tower's glass never shows a cut where its upper floors pass the reach
          let farR = select(select(REFL_FAR_WALL, REFL_FAR_GROUND, ground), REFL_FAR_CAR, gMat == MAT_PAINT);
          skyK = smoothstep(0.65 * farR, farR, tr);
          let mirror = (gMat == MAT_GLASS || gMat == MAT_WINDOW || gWet > 0.05 || gMat == MAT_PAINT) && tr < farR && LR > 0.05;
          sEm = gEm; sIl = gIl; sTag = gTag; sGK = gGlowK; sEK = gEmK; sMat = gMat; sN = gNrm; sWet = gWet; sRay = gRay;
          if (mirror) {
            gRefl = true;
            gOX = u.px + rdx * tr + N.x * 0.05; gOY = u.py + rdy * tr + N.y * 0.05; gOZ = max(0.02, u.eye - m * tr + A * tr * tr + N.z * 0.02);
            gRay = normalize(vec3f(rx, ry, -mR));
            qx = rx; qy = ry; qm = mR; qL = 1.0; qA = 1.0 / (2.0 * u.curveR); qg = 1e9;
            if (mR > 0.0) { let disc = mR * mR - 4.0 * qA * gOZ; if (disc > 0.0) { qg = 2.0 * gOZ / (mR + sqrt(disc)); } }
            go = true;
          } else {
            refl = skyCell(mR, rx, ry).bg;
            gEm = sEm; gIl = sIl; gTag = sTag; gGlowK = sGK; gEmK = sEK; gMat = sMat; gNrm = sN; gWet = sWet; gRay = sRay;
          }
        }
      }
    }
    if (!go) { continue; }
    var c = cityCell(gid.x, gid.y, qx, qy, qm, qL, qA, qg);
    if (ray == 0) { cl = c; continue; }
    // and the street objects the reflection meets first (the lamps' heads and the cars in the wet street)
    if (ray == 2) { c = objRefl(c, vec3f(gOX, gOY, gOZ), gRay); }
    gRefl = false; gOX = u.px; gOY = u.py; gOZ = u.eye;
    if (ray == 1) {
      if (c.depth < 1e8) { if (c.depth == gTag) { gTag += tr; } c.depth += tr; }
      c = objectsOver(c, gid.x, gid.y, rdx, rdy, -m);
      gSun = 1.0; gSky = 1.0; gMoon = 1.0; gBncA = vec3f(0.0); gBncS = vec3f(0.0);
      let lb = light(c); thru = lb.c; thruCh = lb.ch;
    } else {
      if (c.depth < 1e8) {
        if (c.depth == gTag) { gTag += tr; } c.depth += tr;
        gSun = 1.0; gSky = 1.0; gBncA = vec3f(0.0); gBncS = vec3f(0.0);
        let lc = light(c); refl = lc.c; rGlow = gGlow;
      } else { refl = max(c.bg, select(vec3f(0.0), c.c, c.ch != 32u)); }
      if (skyK > 0.0) { refl = mix(refl, skyCell(mR, rx, ry).bg, skyK); rGlow *= 1.0 - skyK; }
      gRay = sRay;
    }
    gEm = sEm; gIl = sIl; gTag = sTag; gGlowK = sGK; gEmK = sEK; gMat = sMat; gNrm = sN; gWet = sWet;
  }
  // how much sky what this cell shows sees (the sky and the rooms keep theirs; it fades out far away)
  gSky = 1.0; gBncA = vec3f(0.0); gBncS = vec3f(0.0);
  if (cl.depth < SKY_FAR && cl.kind != KIND_ROOM && cl.kind != KIND_OTHER) {
    let t = cl.depth;
    let P = vec3f(u.px + rdx * t, u.py + rdy * t, max(0.0, u.eye - m * t + A * t * t));
    let Nn = select(vec3f(0.0, 0.0, 1.0), gNrm, cl.depth == gTag && cl.kind == KIND_WALL);
    let fk = smoothK(SKY_FAR * 0.65, SKY_FAR, t);
    gSky = mix(skyView(P, Nn), 1.0, fk); gBncA *= 1.0 - fk; gBncS *= 1.0 - fk;
  }
  // by day, whether the sun reaches what this cell shows (the sky and the rooms keep theirs)
  gSun = 1.0;
  if (u.day > 0.01 && u.sunZ > 0.0 && cl.depth < 3000.0 && cl.kind != KIND_ROOM) {
    let t = cl.depth;
    let P = vec3f(u.px + rdx * t, u.py + rdy * t, max(0.0, u.eye - m * t + A * t * t));
    gSun = sunLit(P.x, P.y, P.z);
    // and past the street objects (poles, trees, cars, people), near enough for their shadows to show
    if (gSun > 0.0 && t < OBJ_SHADOW_FAR) {
      let Ls = normalize(vec3f(u.sunX, u.sunY, u.sunZ));
      let Nn = select(vec3f(0.0, 0.0, 1.0), gNrm, cl.depth == gTag);
      // (parts thinner than a cell where the shadow falls are widened to half a cell, as drawing does, or a pole's shadow flickers away)
      gSun *= objShadow(P + Nn * 0.06, Ls, 0.5 * u.colW * t);
    }
  }
  // at night, whether the moon reaches it (the buildings' shadows in the moonlight, which tell in a blackout)
  gMoon = 1.0;
  if (u.moonlight > 0.02 && u.day < 0.99 && cl.depth < 3000.0 && cl.kind != KIND_ROOM) {
    let t = cl.depth;
    let P = vec3f(u.px + rdx * t, u.py + rdy * t, max(0.0, u.eye - m * t + A * t * t));
    gMoon = dirLit(P.x, P.y, P.z, moonDir());
  }
  let paint = gMat == MAT_PAINT;
  var lit = light(cl);
  // (only where the room is still what this cell shows: a pole, a sign or a person in front of the window hides it)
  if (thruK > 0.0 && cl.depth == thruD) {
    var tc = glassSeen(thru, vec3f(0.0), 1.0, 0.0, 0.0);
    if (thruPane > 0.0) { tc = glassSeen(tc, vec3f(0.0), 1.0, 0.0, u.day); }
    lit.c = mix(lit.c, tc, thruK);
    if (thruK > 0.5 && lit.ch == EQ) { lit.ch = thruCh; }  }
  if (paint) { refl *= mix(vec3f(1.0), gTint, CAR_METAL); }
  if (rw > 0.03) { lit.c = lit.c * (1.0 - rw) + refl * rw; gGlow = max(gGlow, rGlow * rw); }
  // the lamps' cones in the air (stronger in the rain), over all of it (as bright as the eye takes them)
  if (inc.state == 0u) { lit.c += lampCones(gid.x, gid.y, rdx, rdy, m, cl.depth) * pow(u.adapt, 1.0 / 2.2); }
  store(i, n, fallOver(handOver(display(lit), gid.x, gid.y, handD), rdx, rdy, m, inc.nearT));
}
`;
