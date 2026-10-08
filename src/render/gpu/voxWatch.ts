/**
 * 15.21: the wristwatch's body in little cubes of 1 mm, cast and lit on the GPU (the compositor's fragment
 * shader) at the monitor's resolution, as the phone's (orthographic: the watch faces the eye, tilted a
 * little so its lower side shows): the case, the strap, the four buttons (which sink as they are pressed),
 * the face with its print (wFace: the buttons' names, the maker, the gold rule) and the LCD (wLcd: painted
 * in pixels by watch/body3d.ts each time what it shows changes). The LCD only reflects: below a knee of
 * light it darkens faster than the scene, unless its backlight is on (blue, light of its own).
 * Needs BODY_WGSL first (BFACE_N).
 */

/** The uniform's floats: rect, eye, ray, right, down, light dir, light, LCD rect, LCD light; then the palette (2 vec4 an entry, 32 entries). */
export const WATCH_U_FLOATS = 10 * 4 + 64 * 4;
export const WATCH_AT = { rect: 0, eye: 4, F: 8, R: 12, D: 16, ldir: 20, light: 24, lcd: 28, knee: 32, pal: 40 } as const;

export const WATCH_WGSL = /* wgsl */ `
struct WatchU {
  // where it is drawn (monitor pixels, x0 y0 x1 y1; empty when not)
  rect: vec4f,
  // the ray of monitor pixel s: from eye + R * s.x + D * s.y along F (cells); eye.w, F.w, R.w: the model's size in cells
  eye: vec4f, F: vec4f, R: vec4f, D: vec4f,
  // toward the light (the model's frame), the scene's light (rgb) and whether the backlight is on (w)
  ldir: vec4f, light: vec4f,
  // the LCD's window on the face (cells: x0, y0, width, height); its knee and gain (x, y), the glint's band (its place, z) and strength (w);
  // the glint's color (rgb)
  lcd: vec4f, knee: vec4f, glint: vec4f,
  pal: array<vec4f, 64>,
};
@group(0) @binding(22) var<uniform> wu: WatchU;
@group(0) @binding(23) var<storage, read> wvox: array<u32>;
@group(0) @binding(24) var wFace: texture_2d<f32>;
@group(0) @binding(25) var wLcd: texture_2d<f32>;

fn wdim() -> vec3i { return vec3i(i32(wu.eye.w), i32(wu.F.w), i32(wu.R.w)); }
fn wcell(n: vec3i, c: vec3i) -> u32 {
  if (any(c < vec3i(0)) || any(c >= n)) { return 0u; }
  let b = u32((c.z * n.y + c.y) * n.x + c.x);
  return (wvox[b >> 2u] >> ((b & 3u) * 8u)) & 255u;
}
fn wcast(s: vec2f) -> BHit {
  var h: BHit; h.mat = 0u;
  let N3 = wdim(); let n = vec3f(N3); let dir = wu.F.xyz;
  let o = wu.eye.xyz + wu.R.xyz * s.x + wu.D.xyz * s.y;
  let inv = select(vec3f(1e9), 1.0 / dir, abs(dir) > vec3f(1e-9));
  let ta = -o * inv; let tb = (n - o) * inv; let tn = min(ta, tb); let tx = max(ta, tb);
  let t0 = max(tn.x, max(tn.y, tn.z)); let t1 = min(tx.x, min(tx.y, tx.z));
  if (t0 >= t1 || t1 < 0.0) { return h; }
  let st = select(vec3i(-1), vec3i(1), dir > vec3f(0.0));
  let fX = select(1u, 0u, dir.x > 0.0); let fY = select(3u, 2u, dir.y > 0.0); let fZ = select(5u, 4u, dir.z > 0.0);
  var face = select(select(fZ, fY, t0 == tn.y), fX, t0 == tn.x);
  let p = o + dir * (t0 + 1e-4);
  var c = clamp(vec3i(floor(p)), vec3i(0), N3 - 1);
  let td = abs(inv);
  var mt = t0 + (vec3f(c + select(vec3i(0), vec3i(1), st > vec3i(0))) - p) * inv;
  var te = t0;
  for (var k = 0; k < 300; k++) {
    let mm = wcell(N3, c);
    if (mm != 0u) {
      h.mat = mm; h.face = face; h.c = c; h.p = o + dir * te;
      let Nf = BFACE_N[face]; let f = c + Nf; var ao = 0u;
      if (Nf.x == 0) { ao += select(0u, 1u, wcell(N3, f - vec3i(1, 0, 0)) != 0u) + select(0u, 1u, wcell(N3, f + vec3i(1, 0, 0)) != 0u); }
      if (Nf.y == 0) { ao += select(0u, 1u, wcell(N3, f - vec3i(0, 1, 0)) != 0u) + select(0u, 1u, wcell(N3, f + vec3i(0, 1, 0)) != 0u); }
      if (Nf.z == 0) { ao += select(0u, 1u, wcell(N3, f - vec3i(0, 0, 1)) != 0u) + select(0u, 1u, wcell(N3, f + vec3i(0, 0, 1)) != 0u); }
      h.ao = f32(ao);
      return h;
    }
    if (mt.x < mt.y && mt.x < mt.z) { c.x += st.x; if (c.x < 0 || c.x >= N3.x) { break; } te = mt.x; mt.x += td.x; face = fX; }
    else if (mt.y < mt.z) { c.y += st.y; if (c.y < 0 || c.y >= N3.y) { break; } te = mt.y; mt.y += td.y; face = fY; }
    else { c.z += st.z; if (c.z < 0 || c.z >= N3.z) { break; } te = mt.z; mt.z += td.z; face = fZ; }
  }
  return h;
}
// a hit lit: the scene's light from the top left (the rim lit on top and left, dark on the right and below),
// the crevices darker, the brushed steel streaked; the face's print; the LCD by its own rule; 0..1
fn wshade(h: BHit) -> vec3f {
  let A = wu.pal[h.mat * 2u]; let B = wu.pal[h.mat * 2u + 1u]; let fl = u32(B.x);
  let L = wu.light.rgb; let N = vec3f(BFACE_N[h.face]); let l = normalize(wu.ldir.xyz);
  let nl = dot(N, l);
  // the glint: the brightest light nearby mirrored as a soft diagonal band across the case, where the
  // watch's tilt puts it (it slides as the view turns and the arm swings); sharper and stronger on the
  // polished steel than the brushed, on the crystal over the LCD a glare that washes the digits out
  let uu = (h.p.x - 3.0) / 46.0 + ((h.p.y - 28.0) / 40.0) * 0.55 - wu.knee.z;
  let band = exp(-pow(uu / 0.09, 2.0)); let G = wu.glint.rgb * band * wu.knee.w * 300.0;
  var d = (0.4 + 0.6 * max(0.0, nl)) * (1.0 - 0.1 * h.ao) * B.w;
  if ((fl & 1u) != 0u) { d *= 1.0 + (fract(sin(f32(h.c.y) * 12.9898 + f32(h.c.x >> 2u) * 78.233) * 43758.5453) - 0.5) * 0.14; }
  let n = vec2f(wdim().xy);
  if ((fl & 4u) != 0u) {
    // the LCD: its picture over its window; reflective (darker than the scene below the knee), or backlit
    let uv = (h.p.xy - wu.lcd.xy) / wu.lcd.zw;
    let t = textureSampleLevel(wLcd, tmSamp, clamp(uv, vec2f(0.0), vec2f(1.0)), 0.0).rgb * 255.0;
    // the crystal over it: a faint veil of the scene's light (it greys the digits in bright light) and the glint's glare
    let veil = L * 9.0 + G * 0.55;
    if (wu.light.w > 0.5) { return (t * max(vec3f(1.0), L) + veil) / 255.0; }
    let Ld = min(vec3f(1.0), L * wu.knee.y) * pow(min(vec3f(1.0), L / wu.knee.x), vec3f(1.6));
    return (t * Ld * select(0.9, 1.0, h.face == 5u) + veil) / 255.0;
  }
  var base = A.rgb;
  if (h.face == 5u && (fl & 8u) != 0u) { let dc = textureSampleLevel(wFace, tmSamp, h.p.xy / n, 0.0); base = mix(base, dc.rgb * 255.0, dc.a); }
  // the steel's rim: its top face a little brighter than flat (a polished bevel)
  let sp = select(0.0, pow(max(0.0, nl), 6.0) * A.w * 40.0, nl > 0.0);
  var col = base * L * d + L * sp + G * A.w * select(0.35, 0.7, (fl & 1u) != 0u) * select(0.6, 1.0, h.face == 5u);
  // the backlight spills a little blue over the face round the LCD
  if (wu.light.w > 0.5 && h.face == 5u) {
    let q = max(vec2f(0.0), max(wu.lcd.xy - h.p.xy, h.p.xy - (wu.lcd.xy + wu.lcd.zw)));
    col += vec3f(70.0, 150.0, 245.0) * 0.35 * max(0.0, 1.0 - length(q) / 5.0);
  }
  return col / 255.0;
}
`;
