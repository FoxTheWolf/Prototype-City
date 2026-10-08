/**
 * 15.20b: the notebook's body in little cubes of 2 mm, cast and lit on the GPU (the compositor's fragment
 * shader) at the monitor's resolution, seen in perspective from the player's eye: per pixel, a ray from the
 * eye into the deck's grid (model 0) and into the lid's (model 1), each with its own camera (the lid turns on
 * its hinge), the nearer hit kept. The same DDA as render/voxels.ts castVoxPersp; the light is the scene's,
 * from above, with the screen's glow and the keyboard's lamp falling on the deck. Decals: the keys' legends
 * and the seal on the deck's top, the maker's name on the lid's inside (lDecal: the deck in its top half,
 * the lid's inside in the bottom one), and the lid's outside with its stickers (lOut). The CPU builds the
 * models once (a key sinking only changes its own cells) and fills the uniform each frame (laptop/body3d.ts).
 * Needs BODY_WGSL first (BFACE_N).
 */

/** The uniform's floats: dim, rect, 2 x 5 vec4 of camera and light, light, ink, screen, lamp; then the palette (2 vec4 an entry, 256 entries). */
export const LAP_U_FLOATS = 16 * 4 + 512 * 4;
/** Where each part starts in the uniform (floats). */
export const LAP_AT = { rect: 4, cam: 8, light: 48, ink: 52, scr: 56, lamp: 60, pal: 64 } as const;

export const LAP_WGSL = /* wgsl */ `
struct LapU {
  // the models' size (cells; the lid padded to the deck's height) and the cells a model
  dim: vec4i,
  // where it is drawn (monitor pixels, x0 y0 x1 y1; empty when not)
  rect: vec4f,
  // per model: the eye (cells, w 1 when drawn), the ray at pixel (0, 0) and its step right and down (dir = F + R * x + D * y), the light's direction
  cam: array<vec4f, 10>,
  // the scene's light on it (rgb, its floor included) and whether the screen is lit
  light: vec4f,
  // the screen's ink (0..255) and its strength
  ink: vec4f,
  // the screen's glass for its light (deck cells: x0, x1, z0, z1; it stands over the hinge, y 0)
  scr: vec4f,
  // the keyboard's lamp: where it is (deck cells), w its strength (0 off)
  lamp: vec4f,
  pal: array<vec4f, 512>,
};
@group(0) @binding(18) var<uniform> lu: LapU;
@group(0) @binding(19) var<storage, read> lvox: array<u32>;
@group(0) @binding(20) var lDecal: texture_2d<f32>;
@group(0) @binding(21) var lOut: texture_2d<f32>;

fn lcell(m: i32, c: vec3i) -> u32 {
  if (any(c < vec3i(0)) || any(c >= lu.dim.xyz)) { return 0u; }
  let b = u32(m * lu.dim.w + (c.z * lu.dim.y + c.y) * lu.dim.x + c.x);
  return (lvox[b >> 2u] >> ((b & 3u) * 8u)) & 255u;
}
struct LHit { mat: u32, face: u32, ao: f32, c: vec3i, p: vec3f, t: f32 };
// the ray of the monitor's pixel s into model m: the first cell met, its face, how hemmed in it is, where and how far
fn lcast(m: i32, s: vec2f) -> LHit {
  var h: LHit; h.mat = 0u; h.t = 1e30;
  let e = lu.cam[m * 5];
  if (e.w == 0.0) { return h; }
  let n = vec3f(lu.dim.xyz); let o = e.xyz;
  let dir = lu.cam[m * 5 + 1].xyz + lu.cam[m * 5 + 2].xyz * s.x + lu.cam[m * 5 + 3].xyz * s.y;
  let inv = select(vec3f(1e9), 1.0 / dir, abs(dir) > vec3f(1e-9));
  let ta = -o * inv; let tb = (n - o) * inv; let tn = min(ta, tb); let tx = max(ta, tb);
  let t0 = max(0.0, max(tn.x, max(tn.y, tn.z))); let t1 = min(tx.x, min(tx.y, tx.z));
  if (t0 >= t1) { return h; }
  let st = select(vec3i(-1), vec3i(1), dir > vec3f(0.0));
  let fX = select(1u, 0u, dir.x > 0.0); let fY = select(3u, 2u, dir.y > 0.0); let fZ = select(5u, 4u, dir.z > 0.0);
  var face = select(select(fZ, fY, t0 == tn.y), fX, t0 == tn.x);
  let p = o + dir * (t0 + 1e-5);
  var c = clamp(vec3i(floor(p)), vec3i(0), lu.dim.xyz - 1);
  let td = abs(inv);
  var mt = t0 + (vec3f(c + select(vec3i(0), vec3i(1), st > vec3i(0))) - p) * inv;
  var te = t0;
  for (var k = 0; k < 400; k++) {
    let mm = lcell(m, c);
    if (mm != 0u) {
      h.mat = mm; h.face = face; h.c = c; h.p = o + dir * te; h.t = te;
      let N = BFACE_N[face]; let f = c + N; var ao = 0u;
      if (N.x == 0) { ao += select(0u, 1u, lcell(m, f - vec3i(1, 0, 0)) != 0u) + select(0u, 1u, lcell(m, f + vec3i(1, 0, 0)) != 0u); }
      if (N.y == 0) { ao += select(0u, 1u, lcell(m, f - vec3i(0, 1, 0)) != 0u) + select(0u, 1u, lcell(m, f + vec3i(0, 1, 0)) != 0u); }
      if (N.z == 0) { ao += select(0u, 1u, lcell(m, f - vec3i(0, 0, 1)) != 0u) + select(0u, 1u, lcell(m, f + vec3i(0, 0, 1)) != 0u); }
      h.ao = f32(ao);
      return h;
    }
    if (mt.x < mt.y && mt.x < mt.z) { c.x += st.x; if (c.x < 0 || c.x >= lu.dim.x) { break; } te = mt.x; mt.x += td.x; face = fX; }
    else if (mt.y < mt.z) { c.y += st.y; if (c.y < 0 || c.y >= lu.dim.y) { break; } te = mt.y; mt.y += td.y; face = fY; }
    else { c.z += st.z; if (c.z < 0 || c.z >= lu.dim.z) { break; } te = mt.z; mt.z += td.z; face = fZ; }
  }
  return h;
}
// a hit of model m lit: the scene's light from above, the crevices darker, a little shine on the glossy
// parts, the decals, the screen's ink and the lamp's warm fan on the deck; 0..1
fn lshade(h: LHit, m: i32, s: vec2f) -> vec3f {
  let A = lu.pal[h.mat * 2u]; let B = lu.pal[h.mat * 2u + 1u]; let fl = u32(B.x);
  let L = lu.light.rgb;
  let N = vec3f(BFACE_N[h.face]);
  let l = normalize(lu.cam[m * 5 + 4].xyz);
  let v = -normalize(lu.cam[m * 5 + 1].xyz + lu.cam[m * 5 + 2].xyz * s.x + lu.cam[m * 5 + 3].xyz * s.y);
  let nl = dot(N, l);
  let d = (0.38 + 0.62 * max(0.0, nl)) * (1.0 - 0.11 * h.ao) * B.w;
  var base = A.rgb;
  let fz = vec2f(lu.dim.xy);
  if (h.face == 5u && m == 0) { let dc = textureSampleLevel(lDecal, tmSamp, h.p.xy / fz * vec2f(1.0, 0.5), 0.0); base = mix(base, dc.rgb * 255.0, dc.a); }
  if (h.face == 5u && m == 1) { let dc = textureSampleLevel(lDecal, tmSamp, vec2f(h.p.x / fz.x, 0.5 + h.p.y / fz.y * 0.5), 0.0); base = mix(base, dc.rgb * 255.0, dc.a); }
  // the outside, as the manual draws it: seen from behind the open lid (so its right is the model's left)
  if (h.face == 4u && m == 1) { let dc = textureSampleLevel(lOut, tmSamp, vec2f(1.0 - h.p.x / fz.x, h.p.y / fz.y), 0.0); base = mix(base, dc.rgb * 255.0, dc.a); }
  var col: vec3f;
  if ((fl & 2u) != 0u) { col = base * max(vec3f(1.0), L); }
  else {
    let sp = pow(max(0.0, dot(reflect(-l, N), v)), 24.0) * A.w * 60.0;
    col = base * L * d + L * sp * select(1.0, 0.0, nl <= 0.0);
  }
  if (m == 0) {
    // the screen's light, falling off with the distance to the glass (cells: 25 cells = 5 cm)
    if (lu.light.w > 0.5) {
      let q = vec3f(max(0.0, max(lu.scr.x - h.p.x, h.p.x - lu.scr.y)), max(0.0, h.p.y), max(0.0, max(lu.scr.z - h.p.z, h.p.z - lu.scr.w)));
      col += lu.ink.rgb * lu.ink.w / (1.0 + pow(length(q) / 25.0, 2.0)) * select(0.6, 1.0, h.face == 5u);
    }
    // the lamp: a warm LED over the glass looking down, its light a fan over the keys
    if (lu.lamp.w > 0.0) {
      let to = lu.lamp.xyz - h.p; let r = length(to);
      col += base * vec3f(1.0, 0.886, 0.69) * lu.lamp.w * max(0.0, dot(N, to / r)) / (1.0 + pow(r / 80.0, 2.0));
    }
  }
  return col / 255.0;
}
`;
