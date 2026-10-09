export const burnWGSL = (): string => /* wgsl */ `// ---- scorched ground outside the fence, split by cracks that glow where the coal burns (burnGround)
fn burnGround(wx: f32, wy: f32, rd: f32, W: f32, Hh: f32) -> Cell {
  let out = max(max(-wx, wx - W), max(-wy, wy - Hh));
  let fog = 1.0 - min(1.0, rd / 2500.0) * 0.85; let day = u.day;
  let hv = hash3(ifloor(wx / 6.0), ifloor(wy / 6.0), 5); let tex = (0.9 + 0.15 * hv) * fog * (0.45 + 0.55 * day);
  var ch = 32u; var c = vec3f(42.0 - 14.0 * day, 32.0 - 5.0 * day, 30.0 - 2.0 * day) * tex;
  // with the fire zone off (FIRE_ZONE in sim/city.ts): plain dusty ground, no cracks
  if (!FIRE_ZONE) { c = mix(vec3f(55.0, 55.0, 60.0), vec3f(110.0, 106.0, 96.0), day) * tex; }
  let heat = select(0.0, clamp((out - BURN_START) / 200.0, 0.0, 1.0), FIRE_ZONE);
  if (heat > 0.0) {
    // cracks are the edges of a cellular pattern: where the two nearest feature points are almost equally far
    let S = 14.0; let gx = ifloor(wx / S); let gy = ifloor(wy / S);
    var d1 = 1e9; var d2 = 1e9; var near = 0.0;
    for (var j = -1; j <= 1; j++) {
      for (var k = -1; k <= 1; k++) {
        let cx = gx + k; let cy = gy + j;
        let d = length(vec2f((f32(cx) + hash3(cx, cy, 11)) * S - wx, (f32(cy) + hash3(cx, cy, 12)) * S - wy));
        if (d < d1) { d2 = d1; d1 = d; near = hash3(cx, cy, 13); } else if (d < d2) { d2 = d; }
      }
    }
    // wide enough to read as cracks from the fence (a cell there is metres across), not a few dots
    let width = 1.2 + rd * 0.006;
    if (d2 - d1 < width && near < 0.75) {
      let kk = heat * (0.55 + 0.45 * sin(u.sec * 60.0 * 0.05 + near * 40.0)) * (0.6 + 0.4 * fog) * min(1.0, 1.6 / (1.0 + rd * 0.0008)) * (1.0 - 0.6 * day);
      if (d2 - d1 < width * 0.4 && rd < 150.0 && kk > 0.5) { ch = STAR; }
      let dk = 0.97 * day;
      c = vec3f(24.0 + 130.0 * kk, 10.0 + 50.0 * kk * kk, 8.0 + 10.0 * kk) * (1.0 - dk) + c * (0.7 * dk);
    }
  }
  return Cell(ch, c, vec3f(7.0, 8.0, 12.0), rd, KIND_BLOCK, u.sunZ);
}

`;
