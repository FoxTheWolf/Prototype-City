/**
 * 15.19b: the phone's body in little cubes, cast and lit on the GPU (the compositor's fragment shader), at
 * the monitor's resolution: the same ray through the same 1 mm grid as render/voxels.ts castVox, and the
 * same light as shadeVox, per pixel of the body's rectangle. Two models of the same size (the phone's upper
 * plate, model 1, and the lower one, model 0, drawn shifted by the rail), their cells a byte each in one
 * storage buffer; the palette, the view and the light in a uniform; the keypad's legends and the maker's
 * name in a decal texture laid over the models' front faces (DK pixels a cell). The CPU only builds the
 * models when they change (a key sinks) and fills the uniform each frame (phone/body3d.ts).
 */

/** How many floats the body's uniform holds: 10 vec4 of view and light, 4 of the glare on the glass, then the palette (2 vec4 an entry, 256 entries). */
export const BODY_U_FLOATS = 14 * 4 + 512 * 4;
/** Where in the body's uniform the glare's two spots go (raycaster.ts VIEW_GLARE: 8 floats each). */
export const BODY_GLARE_AT = 40;

export const BODY_WGSL = /* wgsl */ `
struct BodyU {
  dim: vec4i,
  // the camera's axes in the model's frame; R.w and D.w: a pixel's size in cells (x, y); dir.w: the rail (pixels the lower plate is drawn down)
  R: vec4f, D: vec4f, dir: vec4f,
  // the rectangle's size (pixels), the decal's pixels a cell, the glint's diagonal (its start)
  size: vec4f,
  // the scene's light (rgb) and its side (lat); the glint's color and strength
  light: vec4f, glint: vec4f,
  // the legends' ice (0..255) and whether it glows; the maker's name's color (0..255)
  ice: vec4f, brand: vec4f,
  // the glass's cells in the upper model (x0, y0, width, height): the screen's picture lies on them
  scr: vec4f,
  // the glare on the glass (2026-10-07): two lights mirrored in it, each its place (u, v on the glass), its size (u, v) and its color times its strength
  gp0: vec4f, gc0: vec4f, gp1: vec4f, gc1: vec4f,
  // per entry: color (0..255) and gloss; flags (1 metal, 2 glow, 4 chrome), the chrome's rows (y0, y1), the light multiplier
  pal: array<vec4f, 512>,
};
@group(0) @binding(14) var bDecal: texture_2d<f32>;
@group(0) @binding(15) var<uniform> bu: BodyU;
@group(0) @binding(16) var<storage, read> bvox: array<u32>;

fn bcell(m: i32, c: vec3i) -> u32 {
  if (any(c < vec3i(0)) || any(c >= bu.dim.xyz)) { return 0u; }
  let b = u32(m * bu.dim.w + (c.z * bu.dim.y + c.y) * bu.dim.x + c.x);
  return (bvox[b >> 2u] >> ((b & 3u) * 8u)) & 255u;
}
const BFACE_N = array<vec3i, 6>(vec3i(-1, 0, 0), vec3i(1, 0, 0), vec3i(0, -1, 0), vec3i(0, 1, 0), vec3i(0, 0, -1), vec3i(0, 0, 1));
struct BHit { mat: u32, face: u32, ao: f32, c: vec3i, p: vec3f };
// the ray of the body's pixel (i, j) into model m: the first cell met, its face, how hemmed in it is, where it was met
fn bcast(m: i32, i: f32, j: f32) -> BHit {
  var h: BHit; h.mat = 0u;
  let n = vec3f(bu.dim.xyz); let mid = n * 0.5; let dir = bu.dir.xyz;
  let u = (i + 0.5) * bu.R.w - mid.x; let v = (j + 0.5) * bu.D.w - mid.y;
  let o = mid + bu.R.xyz * u + bu.D.xyz * v - dir * (n.x + n.y + n.z);
  let inv = select(vec3f(1e9), 1.0 / dir, abs(dir) > vec3f(1e-9));
  let ta = -o * inv; let tb = (n - o) * inv; let tn = min(ta, tb); let tx = max(ta, tb);
  let t0 = max(tn.x, max(tn.y, tn.z)); let t1 = min(tx.x, min(tx.y, tx.z));
  if (t0 >= t1) { return h; }
  let st = select(vec3i(-1), vec3i(1), dir > vec3f(0.0));
  let fX = select(1u, 0u, dir.x > 0.0); let fY = select(3u, 2u, dir.y > 0.0); let fZ = select(5u, 4u, dir.z > 0.0);
  var face = select(select(fZ, fY, t0 == tn.y), fX, t0 == tn.x);
  let p = o + dir * (t0 + 1e-4);
  var c = clamp(vec3i(floor(p)), vec3i(0), bu.dim.xyz - 1);
  let td = abs(inv);
  var mt = t0 + (vec3f(c + select(vec3i(0), vec3i(1), st > vec3i(0))) - p) * inv;
  var te = t0;
  for (var k = 0; k < 400; k++) {
    let mm = bcell(m, c);
    if (mm != 0u) {
      h.mat = mm; h.face = face; h.c = c; h.p = o + dir * te;
      let N = BFACE_N[face]; let f = c + N; var ao = 0u;
      if (N.x == 0) { ao += select(0u, 1u, bcell(m, f - vec3i(1, 0, 0)) != 0u) + select(0u, 1u, bcell(m, f + vec3i(1, 0, 0)) != 0u); }
      if (N.y == 0) { ao += select(0u, 1u, bcell(m, f - vec3i(0, 1, 0)) != 0u) + select(0u, 1u, bcell(m, f + vec3i(0, 1, 0)) != 0u); }
      if (N.z == 0) { ao += select(0u, 1u, bcell(m, f - vec3i(0, 0, 1)) != 0u) + select(0u, 1u, bcell(m, f + vec3i(0, 0, 1)) != 0u); }
      h.ao = f32(ao);
      return h;
    }
    if (mt.x < mt.y && mt.x < mt.z) { c.x += st.x; if (c.x < 0 || c.x >= bu.dim.x) { break; } te = mt.x; mt.x += td.x; face = fX; }
    else if (mt.y < mt.z) { c.y += st.y; if (c.y < 0 || c.y >= bu.dim.y) { break; } te = mt.y; mt.y += td.y; face = fY; }
    else { c.z += st.z; if (c.z < 0 || c.z >= bu.dim.z) { break; } te = mt.z; mt.z += td.z; face = fZ; }
  }
  return h;
}
// the manual's chrome: light at the top, a dark band past the middle, light again at the foot
fn bchrome(t: f32) -> vec3f {
  let a = vec3f(238.0, 242.0, 247.0); let b = vec3f(141.0, 147.0, 156.0); let c = vec3f(93.0, 98.0, 106.0); let d = vec3f(201.0, 206.0, 214.0);
  let x = clamp(t, 0.0, 1.0);
  if (x < 0.45) { return mix(a, b, x / 0.45); }
  if (x < 0.55) { return mix(b, c, (x - 0.45) / 0.1); }
  return mix(c, d, (x - 0.55) / 0.45);
}
// a hit lit (shadeVox's light), with the legends and the maker's name over the front faces; 0..1
fn bshade(h: BHit, q: vec2f) -> vec3f {
  let A = bu.pal[h.mat * 2u]; let B = bu.pal[h.mat * 2u + 1u]; let fl = u32(B.x);
  let L = bu.light.rgb; let lat = bu.light.w;
  let l = normalize(vec3f(lat * 0.8, -0.6, 0.7));
  let N = vec3f(BFACE_N[h.face]); let nl = dot(N, l);
  var d = (0.42 + 0.58 * max(0.0, nl)) * select(1.0, 1.3, N.z != 1.0 && nl > 0.3);
  d *= (1.0 - 0.11 * h.ao) * (1.0 - (q.y / bu.size.y) * 0.25);
  if ((fl & 1u) != 0u) { d *= 1.0 + (fract(sin(f32(h.c.y) * 12.9898 + f32(h.c.x >> 3u) * 78.233) * 43758.5453) - 0.5) * 0.12; }
  d *= B.w;
  let uu = q.x / bu.size.x + (q.y / bu.size.y) * 0.55 - bu.size.w;
  let sh = exp(-pow(uu / 0.1, 2.0)) * A.w * bu.glint.w * 55.0 * select(0.5, 1.0, h.face == 5u);
  let G = bu.glint.rgb * sh;
  var col: vec3f;
  if ((fl & 4u) != 0u) { col = bchrome((f32(h.c.y) + 0.5 - B.y) / max(1.0, B.z - B.y)) * (0.55 + 0.45 * L) * select(0.82, 1.0, h.face == 5u) * B.w + G; }
  else if ((fl & 2u) != 0u) { col = A.rgb * max(vec3f(1.0), L) + G; }
  // in strong light (the sun on the hand) dark plastic shows its grey, not a black hole (playtest 2026-10-07)
  // (only the plastic: the glass and the screen's black surround stay black; and only in the sun, not under a street lamp)
  else { let lift = select(0.0, 60.0 * clamp((dot(L, vec3f(0.333)) - 1.05) / 0.45, 0.0, 1.0), A.w < 0.65); col = (A.rgb + lift) * L * d + G; }
  if (h.face == 5u) {
    let dc = textureSampleLevel(bDecal, tmSamp, h.p.xy / vec2f(bu.dim.xy), 0.0);
    let ice = bu.ice.rgb * select(L, max(vec3f(1.0), L), bu.ice.w > 0.5) * select(1.0, 0.7, B.w < 0.99);
    col = mix(col, ice, dc.r);
    col = mix(col, bu.brand.rgb * L, dc.g);
  }
  return col / 255.0;
}
`;
