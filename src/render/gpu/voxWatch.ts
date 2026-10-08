/**
 * 15.21: the wristwatch's body in little cubes of 1 mm, cast and lit on the GPU (the compositor's fragment
 * shader) at the monitor's resolution, as the phone's (orthographic: the watch faces the eye, tilted a
 * little so its lower side shows): the case, the strap, the four buttons (which sink as they are pressed),
 * the face with its print (wFace: the buttons' names, the maker, the gold rule) and the LCD (wLcd: painted
 * in pixels by watch/body3d.ts each time what it shows changes). The LCD only reflects: below a knee of
 * light it darkens faster than the scene, unless its backlight is on (blue, light of its own).
 * Needs BODY_WGSL first (BFACE_N).
 */

/**
 * The uniform's floats: rect, eye, ray, right, down, light dir, light, LCD rect, LCD light, glint, the glint's
 * box, the backlight's spill, the glare's two spots on the LCD (as the phone's glass, raycaster.ts JACK_GLARE); then the palette (2 vec4 an entry, 32 entries). The same for every device the
 * pass draws (the watch; the Jackdaw, 15.22).
 */
export const VOXP_U_FLOATS = 16 * 4 + 64 * 4;
export const VOXP_AT = { rect: 0, eye: 4, F: 8, R: 12, D: 16, ldir: 20, light: 24, lcd: 28, knee: 32, glint: 36, box: 40, spill: 44, glare: 48, pal: 64 } as const;
export const WATCH_U_FLOATS = VOXP_U_FLOATS, WATCH_AT = VOXP_AT;

/**
 * The pass's WGSL for one device, its names prefixed by `p` (the uniform `${p}u`, the cubes `${p}vox`, the
 * face's print `${p}Face`, the LCD `${p}Lcd`, and `${p}cast`, `${p}shade`) at bindings b0 .. b0 + 3.
 * Palette flags: 1 brushed metal, 2 glowing (light of its own: an LED), 4 the LCD, 8 printed (the face's print on its front).
 */
export const voxPassWgsl = (p: string, b0: number) => /* wgsl */ `
struct ${p}U {
  // where it is drawn (monitor pixels, x0 y0 x1 y1; empty when not)
  rect: vec4f,
  // the ray of monitor pixel s: from eye + R * s.x + D * s.y along F (cells); eye.w, F.w, R.w: the model's size in cells
  eye: vec4f, F: vec4f, R: vec4f, D: vec4f,
  // toward the light (the model's frame), the scene's light (rgb) and whether the backlight is on (w)
  ldir: vec4f, light: vec4f,
  // the LCD's window on the face (cells: x0, y0, width, height); its knee and gain (x, y), the glint's band (its place, z) and strength (w);
  // the glint's color (rgb)
  lcd: vec4f, knee: vec4f, glint: vec4f,
  // the glint's band runs across this box (cells: x0, y0, width, height); the backlight's spill: its color (rgb, 0..255) and reach (cells)
  box: vec4f, spill: vec4f,
  // the glare on the LCD (2026-10-08, as the phone's): two lights mirrored in it, each its place (u, v), its size (u, v) and its color times its strength
  gp0: vec4f, gc0: vec4f, gp1: vec4f, gc1: vec4f,
  pal: array<vec4f, 64>,
};
@group(0) @binding(${b0}) var<uniform> ${p}u: ${p}U;
@group(0) @binding(${b0 + 1}) var<storage, read> ${p}vox: array<u32>;
@group(0) @binding(${b0 + 2}) var ${p}Face: texture_2d<f32>;
@group(0) @binding(${b0 + 3}) var ${p}Lcd: texture_2d<f32>;

fn ${p}dim() -> vec3i { return vec3i(i32(${p}u.eye.w), i32(${p}u.F.w), i32(${p}u.R.w)); }
fn ${p}cell(n: vec3i, c: vec3i) -> u32 {
  if (any(c < vec3i(0)) || any(c >= n)) { return 0u; }
  let b = u32((c.z * n.y + c.y) * n.x + c.x);
  return (${p}vox[b >> 2u] >> ((b & 3u) * 8u)) & 255u;
}
fn ${p}cast(s: vec2f) -> BHit {
  var h: BHit; h.mat = 0u;
  let N3 = ${p}dim(); let n = vec3f(N3); let dir = ${p}u.F.xyz;
  let o = ${p}u.eye.xyz + ${p}u.R.xyz * s.x + ${p}u.D.xyz * s.y;
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
    let mm = ${p}cell(N3, c);
    if (mm != 0u) {
      h.mat = mm; h.face = face; h.c = c; h.p = o + dir * te;
      let Nf = BFACE_N[face]; let f = c + Nf; var ao = 0u;
      if (Nf.x == 0) { ao += select(0u, 1u, ${p}cell(N3, f - vec3i(1, 0, 0)) != 0u) + select(0u, 1u, ${p}cell(N3, f + vec3i(1, 0, 0)) != 0u); }
      if (Nf.y == 0) { ao += select(0u, 1u, ${p}cell(N3, f - vec3i(0, 1, 0)) != 0u) + select(0u, 1u, ${p}cell(N3, f + vec3i(0, 1, 0)) != 0u); }
      if (Nf.z == 0) { ao += select(0u, 1u, ${p}cell(N3, f - vec3i(0, 0, 1)) != 0u) + select(0u, 1u, ${p}cell(N3, f + vec3i(0, 0, 1)) != 0u); }
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
fn ${p}shade(h: BHit) -> vec3f {
  let A = ${p}u.pal[h.mat * 2u]; let B = ${p}u.pal[h.mat * 2u + 1u]; let fl = u32(B.x);
  let L = ${p}u.light.rgb; let N = vec3f(BFACE_N[h.face]); let l = normalize(${p}u.ldir.xyz);
  let nl = dot(N, l);
  // the glint: the brightest light nearby mirrored as a soft diagonal band across the case, where the
  // watch's tilt puts it (it slides as the view turns and the arm swings); sharper and stronger on the
  // polished steel than the brushed, on the crystal over the LCD a glare that washes the digits out
  let uu = (h.p.x - ${p}u.box.x) / ${p}u.box.z + ((h.p.y - ${p}u.box.y) / ${p}u.box.w) * 0.55 - ${p}u.knee.z;
  let band = exp(-pow(uu / 0.09, 2.0)); let G = ${p}u.glint.rgb * band * ${p}u.knee.w * 300.0;
  // the phone's light (voxBody.ts bshade, 2026-10-08: one rule for every held thing): the faces turned to the light
  // brighter, the sides it catches more so, the crevices darker
  var d = (0.42 + 0.58 * max(0.0, nl)) * select(1.0, 1.3, N.z != 1.0 && nl > 0.3) * (1.0 - 0.11 * h.ao) * B.w;
  if ((fl & 1u) != 0u) { d *= 1.0 + (fract(sin(f32(h.c.y) * 12.9898 + f32(h.c.x >> 2u) * 78.233) * 43758.5453) - 0.5) * 0.14; }
  let n = vec2f(${p}dim().xy);
  if ((fl & 4u) != 0u) {
    // the LCD: its picture over its window; reflective (darker than the scene below the knee), or backlit
    let uv = (h.p.xy - ${p}u.lcd.xy) / ${p}u.lcd.zw;
    // averaged over the monitor pixel's footprint (4 x 4 taps): the dots' gaps are finer than a pixel and,
    // sampled once, beat into moiré (2026-10-08); tilted away, the footprint is longer down the LCD
    let fp = vec2f(length(${p}u.R.xyz), length(${p}u.D.xyz) / max(abs(${p}u.F.z), 0.3)) / ${p}u.lcd.zw;
    var t = vec3f(0.0);
    for (var j = 0; j < 4; j++) { for (var i = 0; i < 4; i++) {
      let q = uv + (vec2f(f32(i), f32(j)) - 1.5) * 0.25 * fp;
      t += textureSampleLevel(${p}Lcd, tmSamp, clamp(q, vec2f(0.0), vec2f(1.0)), 0.0).rgb;
    } }
    t *= 255.0 / 16.0;
    // the crystal over it: a faint veil of the scene's light (it greys the digits in bright light) and the glint's glare
    // (the glint a little only: over the whole LCD it washed the digits out white and looked false, 2026-10-08)
    var veil = L * 9.0 + G * 0.15;
    // and the lights it mirrors toward the eye, where they really are (the phone's glare, compositor.ts)
    for (var k = 0; k < 2; k++) {
      let gp = select(${p}u.gp1, ${p}u.gp0, k == 0); let gc = select(${p}u.gc1, ${p}u.gc0, k == 0);
      if (gc.r + gc.g + gc.b > 0.0) {
        let e = (uv - gp.xy) / max(gp.zw, vec2f(1e-3)); let e2 = dot(e, e);
        let hot = mix(gc.rgb, vec3f(max(gc.r, max(gc.g, gc.b))), 0.65);
        veil += (hot * exp(-e2) * 0.55 + gc.rgb * exp(-e2 / 9.0) * 0.08) * 255.0;
      }
    }
    if (${p}u.light.w > 0.5) { return (t * max(vec3f(1.0), L) + veil) / 255.0; }
    // (no ceiling at its painted paper: in the sun it reads brighter, as the phone's screen does, 2026-10-08)
    let Ld = min(vec3f(1.8), L * ${p}u.knee.y) * pow(min(vec3f(1.0), L / ${p}u.knee.x), vec3f(1.6));
    return (t * Ld * select(0.9, 1.0, h.face == 5u) + veil) / 255.0;
  }
  // light of its own (the LED): the scene does not dim it
  if ((fl & 2u) != 0u) { return (A.rgb * max(vec3f(1.0), L) + G * 0.3) / 255.0; }
  var base = A.rgb;
  if (h.face == 5u && (fl & 8u) != 0u) { let dc = textureSampleLevel(${p}Face, tmSamp, h.p.xy / n, 0.0); base = mix(base, dc.rgb * 255.0, dc.a); }
  // the steel's rim: its top face a little brighter than flat (a polished bevel)
  let sp = select(0.0, pow(max(0.0, nl), 6.0) * A.w * 40.0, nl > 0.0);
  // in strong light (the sun on the hand) dark plastic and steel show their grey, not a black hole (as the phone's)
  let lift = select(0.0, 60.0 * clamp((dot(L, vec3f(0.333)) - 1.05) / 0.45, 0.0, 1.0), A.w < 0.65);
  var col = (base + lift) * L * d + L * sp + G * A.w * select(0.35, 0.7, (fl & 1u) != 0u) * select(0.6, 1.0, h.face == 5u);
  // the backlight spills a little of its color over the face round the LCD
  if (${p}u.light.w > 0.5 && h.face == 5u) {
    let q = max(vec2f(0.0), max(${p}u.lcd.xy - h.p.xy, h.p.xy - (${p}u.lcd.xy + ${p}u.lcd.zw)));
    col += ${p}u.spill.rgb * 0.35 * max(0.0, 1.0 - length(q) / ${p}u.spill.w);
  }
  return col / 255.0;
}
`;
export const WATCH_WGSL = voxPassWgsl('w', 22);
export const JACK_WGSL = voxPassWgsl('j', 26);
