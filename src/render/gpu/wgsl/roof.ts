export const roofWGSL = (): string => /* wgsl */ `// ---- a roof seen from above (roofRows)
fn roofCell(q: u32, t: f32, wx: f32, wy: f32) -> Cell {
  let fogK = 1.0 - exp(-t / FOG); let k = select(1.0 - fogK * 0.6 * (1.0 - u.day), 1.0, defOn());
  if (defOn()) { gEm = vec3f(0.0); gIl = vec3f(0.0); gTag = t; gPos = vec3f(wx, wy, bldF(u32(q + 4u))); gNrm = vec3f(0.0, 0.0, 1.0); gMat = MAT_NONE; gWet = 0.0; gGlowK = 1.0; gEmK = 1.0; }
  let x0 = bldF(u32(q)); let y0 = bldF(u32(q + 1u)); let x1 = bldF(u32(q + 2u)); let y1 = bldF(u32(q + 3u));
  var edge = min(min(wx - x0, x1 - wx), min(wy - y0, y1 - wy));
  if (bldF(u32(q + 6u)) > 0.5) { edge = min(edge, bldF(u32(q + 9u)) - bldF(u32(q + 7u)) * wx - bldF(u32(q + 8u)) * wy); }
  if (bldF(u32(q + 5u)) > 0.5) { edge = min(edge, (x1 - x0) * 0.5 - length(vec2f(wx - (x0 + x1) * 0.5, wy - (y0 + y1) * 0.5))); }
  let h = hash3(ifloor(wx * 2.0), ifloor(wy * 2.0), 61);
  var ch = select(select(COL, COM, h < 0.8), DOT, h < 0.5); var c = vec3f(50.0, 50.0, 56.0);
  if (edge < 0.35) { ch = EQ; c = colAt(q + 15u) * 1.2; }
  if (u.snow > 0.05) { c += (vec3f(200.0, 205.0, 218.0) - c) * (u.snow * 0.9); }
  return Cell(ch, sat(c * k), vec3f(7.0, 8.0, 12.0), t, KIND_GROUND, 0.0);
}

`;
