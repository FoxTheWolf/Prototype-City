export const shadingWGSL = (): string => /* wgsl */ `// ---- materials: Fresnel (Schlick), the highlight's spread (GGX), the roughness with the wet film
fn fres(f0: f32, cosT: f32) -> f32 { let k = 1.0 - clamp(cosT, 0.0, 1.0); let k2 = k * k; return f0 + (1.0 - f0) * k2 * k2 * k; }
fn ggx(nh: f32, r: f32) -> f32 { let a = max(r * r, 0.002); let a2 = a * a; let d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (3.14159265 * d * d); }
fn matRough() -> f32 { return mix(MAT_ROUGH[gMat], 0.04, gWet); }
/** The sun's highlight on this cell's surface (its BRDF's specular part times N.L; Kelemen's visibility), 0 on matte. */
fn sunGloss() -> f32 {
  if (gMat == MAT_NONE) { return 0.0; }
  let Ls = normalize(vec3f(u.sunX, u.sunY, max(u.sunZ, 0.0))); let V = -gRay; let N = gNrm;
  let nl = dot(N, Ls); if (nl <= 0.0 || dot(N, V) <= 0.0) { return 0.0; }
  let H = normalize(Ls + V); let lh = max(dot(Ls, H), 0.1);
  return min(40.0, ggx(max(dot(N, H), 0.0), matRough()) * fres(MAT_F0[gMat], lh) * 0.25 / (lh * lh) * nl);
}
// ---- the sun's color by its color temperature: a warm yellow-white high up, orange toward the horizon
/** The sun's color temperature (K) at noon high and at the horizon, and the elevation (rad) where it is fully the high one. */
// (playtest 2026-10-07: the afternoon read too yellow, the sky too; real noon sun is ~5500-5800 K; was 4700)
const SUN_K_HIGH = 5800.0; const SUN_K_LOW = 1900.0; const SUN_K_EL = 0.55;
fn sunTemp() -> f32 { return mix(SUN_K_LOW, SUN_K_HIGH, smoothK(-0.02, SUN_K_EL, u.sunEl)); }
/** A black body's color at T kelvin, in sRGB 0-1 (Tanner Helland's fit), the strongest channel 1. */
fn kelvin(T: f32) -> vec3f {
  let t = clamp(T, 1000.0, 15000.0) / 100.0;
  var c = vec3f(1.0);
  if (t > 66.0) { c.x = 329.698727446 * pow(t - 60.0, -0.1332047592) / 255.0; c.y = 288.1221695283 * pow(t - 60.0, -0.0755148492) / 255.0; }
  else { c.y = (99.4708025861 * log(t) - 161.1195681661) / 255.0; c.z = select(select((138.5177312231 * log(t - 10.0) - 305.0447927307) / 255.0, 0.0, t <= 19.0), 1.0, t >= 66.0); }
  c = clamp(c, vec3f(0.0), vec3f(1.0));
  return c / max(c.x, max(c.y, c.z));
}
/** The sunlight's color in linear light, its luminance 1 (the brightness is DAY_SUN's). */
fn sunLin() -> vec3f { let l = pow(kelvin(sunTemp()), vec3f(2.2)); return l / max(1e-3, dot(l, vec3f(0.2126, 0.7152, 0.0722))); }
// ---- the light (L.1): one for day and night. A surface's palette color is its albedo; it gets the ambient light
// (the sky's by day, the city's glow and the moon's by night), the sun's, and the lamps'; what glows adds its own.
// The sum is radiance, in linear light; the eye's exposure (EV) takes it to the screen through one tone curve.
// What is not lit this way (the rooms seen inside, painted signs) keeps its color as it looks at the
// exposure the time of day expects, and follows the eye's adaptation only.
/** The night's ambient light with the city lit (its glow on everything; the night's palette is drawn for it), and the full moon's. */
const AMB_N = 0.004; const MOON_E = 0.003;
/** How much of the moonlight a point in the buildings' moon shadow still gets (the sky's part of it). */
const MOON_SHADE = 0.25;
/** How much the eye opens up as the city's glow fails (0: not at all, 1: as much as the light fell). */
const NIGHT_ADAPT = 0.3;
/** The lamps' light (lightAt's) in the same units: under a street lamp ~3% of the day's sky. */
const LAMP_E = 0.45;
/** How fast the lamps' summed light still grows past white (lightAt's 255). */
const LAMP_OVER = 0.3;
/** How much of the eye's change from night to day what glows keeps up with (1: as bright on the screen by day as at night). */
const EMIT_KEEP = 0.95;
/** The signs (shop signs, blade signs and their bulbs, the ticker, the neon tubes up the corners): how much brighter they look than drawn, and their bloom (only to the eye: their light on the street is SIGN_LIGHT in raycaster.ts). */
const SIGN_EMIT = 2.4; const SIGN_GLOW = 1.6;
/** The video screens (the telões, the bus shelters' adverts): brighter to the eye too, less than the signs (a picture, not a light). */
const SCREEN_EMIT = 1.6;
/** By day the screens are turned up (as real LED screens are): to the eye x (1 + this) at noon. */
const SCREEN_DAY_EMIT = 0.6;
/** How much of a sign cell's color its background takes (the others take the B key's share, 0.24). */
const SIGN_FILL = 0.5;
/** How much of the eye closing down a sign makes up for (0: none, 1: all). */
const SIGN_EYE = 0.6;
/** How much of the light on what hides the sky comes back (its albedo), and the share of it in the sun (L.4). */
const SKY_BOUNCE = 0.35;
/** The bounce off the buildings round (L.8): how much of the sky's light they send back (per albedo: L.4 took albedo 1), and
 *  of the sun's on a face turned to it (about half of it in the sun, past the other buildings' shadows). */
const BOUNCE_SKY = 2.0; const BOUNCE_SUN = 2.5;
/** The lamps' highlight on what is glossy. */
const LAMP_SPEC = 0.03;
/** How much of the day's exposure a room's own light follows (0: it reads as drawn by day too; 1: only its lamps, dark by day). */
const ROOM_DAY = 0.3;
/** The night's exposure with the city lit: the night's palette shows as drawn under AMB_N. */
const EV_NIGHT = 1.0 / (DAY_ALBEDO * AMB_N);
fn lin(c: vec3f) -> vec3f { return pow(max(c, vec3f(0.0)) / 255.0, vec3f(2.2)); }
fn srgb(x: vec3f) -> vec3f { return pow(max(x, vec3f(0.0)), vec3f(1.0 / 2.2)) * 255.0; }
fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
/** How far toward the day's look (0 at night, 1 from a third of the way into the day). */
fn dayGrade() -> f32 { return smoothK(0.0, 0.35, u.day); }
/** The city's glow on everything (it fades with the lamps in a blackout). */
fn cityAmb() -> f32 { return AMB_N * (0.02 + 0.98 * pow(clamp(u.cityLit, 0.0, 1.0), 1.5)); }
/** The exposure from night to day (on a log scale), without the blackout's. */
fn evDayNight() -> f32 { return exp(mix(log(EV_NIGHT), log(DAY_EXPO), dayGrade())); }
/** The exposure the time of day expects: the night's opened up a little when the city goes dark. */
fn evRef() -> f32 { return exp(mix(log(EV_NIGHT * pow(cityAmb() / AMB_N, -NIGHT_ADAPT)), log(DAY_EXPO), dayGrade())); }
/** One tone curve: the night's (untouched below a knee) toward the day's filmic one with the day. */
fn toneMap(x: vec3f, g: f32) -> vec3f {
  if (g <= 0.0) { return nightTone(x); }
  if (g >= 1.0) { return tone(x); }
  return mix(nightTone(x), tone(x), g);
}
fn light(cl: Cell) -> Cell {
  var o = cl;
  gGlow = 0.0; gTint = vec3f(1.0); var spG = 0.0; // spG: the bloom of a lamp's highlight on glossy paint, metal or glass
  let ev = evRef() * u.adapt; let rS = pow(u.adapt, 1.0 / 2.2);
  if (o.depth >= 1e9) {
    // the sky follows the eye's adaptation only
    if (abs(u.adapt - 1.0) > 0.001) { o.c = srgb(nightTone(lin(o.c) * u.adapt)); o.bg = srgb(nightTone(lin(o.bg) * u.adapt)); }
    return o;
  }
  let tagged = o.depth == gTag;
  // the light this cell gives off and gets from the lamps, if it was made where it was marked
  let emit = select(vec3f(0.0), gEm, tagged); let lamp = select(vec3f(0.0), gIl, tagged);
  let base = max(vec3f(0.0), o.c - emit - lamp); let mb = max(base.x, max(base.y, base.z));
  // the surface's hue (its palette color, saturated, max channel 1), for the paint's reflection
  if (mb > 12.0) { let s0 = max(vec3f(0.0), mix(vec3f(luma(base)), base, LIT_SAT)); gTint = s0 / max(1.0, max(s0.x, max(s0.y, s0.z))); }
  let day = u.day; let night = 1.0 - day; let g = dayGrade();
  let haze = vec3f(150.0, 160.0, 176.0);
  let objSun = o.sun >= 2.0;
  let sunlit = o.kind == KIND_WALL || objSun;
  // the blackout's darkening of what is not lit this way (what is lit, below, darkens by its light)
  let dark = 1.0 - 0.72 * pow(1.0 - u.cityLit, 1.5) * night;
  if (o.kind == KIND_GROUND || o.kind == KIND_BLOCK || sunlit) {
    // ---- lit: albedo x the light on it
    var A = lin(base) * DAY_ALBEDO;
    // the colors were made for the night: by day a bit more saturated, and never brighter than a white wall
    A = max(vec3f(0.0), mix(vec3f(luma(A)), A, mix(1.0, DAY_SAT, g)));
    let am = max(A.x, max(A.y, A.z)); if (am > DAY_ALB_MAX) { A *= DAY_ALB_MAX / am; }
    // the ground's colors were made for the night (dark, bluish asphalt): by day, lighter and greyer
    if (o.kind == KIND_GROUND) { A = mix(A, vec3f(dot(A, vec3f(0.3, 0.5, 0.2))), 0.2 * g) * mix(1.0, DAY_GROUND, g); }
    // the night's ambient: the city's glow (neutral: the palette is drawn under it) and the moon (bluish)
    // (the moon and the sky are cut by the buildings round it, gSky; the city's glow, half from the lit air, a little less)
    let En = vec3f(cityAmb()) * mix(1.0, gSky, 0.5) + vec3f(0.875, 1.0, 1.44) * (MOON_E * u.moonlight * (1.0 - 0.7 * u.cloud) * gSky * mix(MOON_SHADE, 1.0, gMoon));
    // the day's: the sky's (bluish; whiter under clouds) and the sun's on what faces it out of the shadows (gSun);
    // it fades in on a log scale with the exposure (ds), so dusk never dips darker than night or day
    let ds = pow(AMB_N / DAY_SKY, 1.0 - g) * min(1.0, 4.0 * g);
    let share = select(select(u.sunZ, o.sun, sunlit || o.kind == KIND_BLOCK), o.sun - 2.0, objSun);
    let sunC = sunLin(); let sunK = DAY_SUN * (1.0 - 0.85 * u.cloud) * gSun * ds;
    let skyC = mix(vec3f(0.48, 0.6, 0.92), vec3f(0.82, 0.84, 0.88), u.cloud) * (DAY_SKY + 0.35 * u.cloud);
    // what hides the sky gives some back: the walls and the street round it, lit by the sky and by the sun on part of them
    let sunOpen = DAY_SUN * (1.0 - 0.85 * u.cloud) * ds * max(0.0, u.sunZ);
    let Eb = SKY_BOUNCE * (skyC * (ds * BOUNCE_SKY) * gBncA + sunC * (DAY_SUN * (1.0 - 0.85 * u.cloud) * ds * BOUNCE_SUN * smoothK(-0.02, 0.04, u.sunZ)) * gBncS);
    let E = (En * (1.0 - g) + skyC * (ds * gSky) + Eb + sunC * (sunK * max(0.0, share))) * (1.0 + 0.6 * u.flash);
    // the lamps (lightAt dims its light by day; the eye does that now): their light takes the surface's color;
    // on a facade most of its hue (each street takes its lamps' tone; all of it under the old sRGB light made scorched-paper greys)
    // (past white the sum of lamps grows slowly: a few headlights together raised to the 2.2 blew a car out to white)
    let lx = lamp / max(0.15, 1.0 - 0.85 * day) / 255.0;
    var El = pow(min(lx, vec3f(1.0) + max(lx - vec3f(1.0), vec3f(0.0)) * LAMP_OVER), vec3f(2.2)) * LAMP_E;
    if (o.kind == KIND_WALL) { El = mix(vec3f(luma(El)), El, WALL_LAMP_HUE); }
    // what glows: at night as drawn; by day almost as bright on the screen (a sign is not lost in the sun)
    // (a sign keeps most of its brightness when the eye closes down in a bright street: it still reads as lit)
    let Le = lin(emit) * (pow(EV_NIGHT / evDayNight(), EMIT_KEEP) / EV_NIGHT) * select(1.0, gEmK * pow(max(1.0, 1.0 / u.adapt), SIGN_EYE), tagged && gEmK > 1.0);
    var Lr = A * (E + El) + Le;
    // a glossy surface (wet asphalt, a car's paint, glass) also shines with the lamps' own color, and the sun's
    if (gMat != MAT_NONE && tagged) {
      let r = matRough();
      let sp = El * (fres(MAT_F0[gMat], max(0.0, dot(gNrm, -gRay))) * (1.0 - r) * (1.0 - r) * select(LAMP_GLOSS, CAR_GLOSS, gMat == MAT_PAINT) * LAMP_SPEC);
      Lr += sp; spG = dot(srgb(sp * ev), vec3f(0.3, 0.5, 0.2)) / 255.0 * SPEC_BLOOM;
      if (day > 0.01) {
        let gloss = sunGloss() * sunK;
        Lr += sunC * gloss;
        gGlow = clamp((gloss / max(ds, 1e-3) - SPEC_BLOOM_MIN) * SPEC_BLOOM_SUN, 0.0, 1.0); // a strong glint on metal blooms
      }
    }
    o.c = srgb(toneMap(Lr * ev, g));
    gGlow = max(gGlow, clamp(dot(srgb(Le * ev), vec3f(0.3, 0.5, 0.2)) / 255.0 + spG, 0.0, 1.0) * (1.0 - 0.75 * day) * select(1.0, gGlowK, tagged));
    // the haze: by day with distance, at its most far away
    let f = day * (0.1 + 0.42 * (1.0 - exp(-o.depth / 2500.0)));
    let fd = (1.0 - exp(-o.depth / 1800.0)) * 0.6;
    o.c = mix(o.c, haze * rS, (1.0 - g) * f + g * fd);
  } else {
    // ---- kept as drawn: the moon on it, brighter by day (rooms keep their own lamps' light), the blackout,
    // and the eye's adaptation
    var c = o.c;
    if (u.moonlight > 0.02 && o.depth > 0.0) { let m = u.moonlight * (1.0 - 0.7 * u.cloud) * 14.0; c += vec3f(m * 0.7, m * 0.8, m * 1.15); }
    let amb = 1.0 + select(0.7, 0.1, o.kind == KIND_ROOM) * day + u.flash * 0.6;
    c *= amb;
    let lit = min(c, emit + lamp);
    let up = pow(evRef() / evDayNight(), 1.0 / 2.2); // how much the eye opened in the blackout
    c = (c - lit) * dark + lit * up * select(1.0, gEmK, tagged);
    gGlow = clamp(dot(emit, vec3f(0.3, 0.5, 0.2)) / 255.0, 0.0, 1.0) * (1.0 - 0.75 * day) * select(1.0, gGlowK, tagged) * up;
    let f = day * (0.1 + 0.42 * (1.0 - exp(-o.depth / 2500.0)));
    c = c * (1.0 - f) + haze * f;
    // a room has its own lamps, much dimmer than the day outside: by day it reads darker at the day's exposure
    // (a share of the daylight comes in by the windows, until the light bounces: L.5), and the eye opens up inside
    let roomK = select(1.0, pow(evDayNight() / EV_NIGHT, ROOM_DAY), o.kind == KIND_ROOM);
    let k = u.adapt * roomK;
    if (abs(k - 1.0) > 0.001) { c = srgb(lin(c) * k); }
    o.c = c;
  }
  o.bg *= dark;
  gGlow = min(1.0, gGlow * rS);
  // the city's sodium glow in the air: far things sink into a low orange haze (as a big city seen at night)
  if (night > 0.01 && o.kind != KIND_ROOM) {
    let hk = (1.0 - exp(-o.depth / 900.0)) * NIGHT_HAZE * night * (0.15 + 0.85 * u.cityLit) * (0.8 + 0.4 * u.precip);
    o.c = o.c * (1.0 - hk) + vec3f(120.0, 64.0, 26.0) * (hk * rS);
  }
  // bright sums roll off on the luminance (the hue kept) instead of each channel clipping at 255
  if (max(o.c.x, max(o.c.y, o.c.z)) > 255.0) { o.c = srgb(nightTone(lin(o.c))); }
  return o;
}
fn display(cl: Cell) -> Cell {
  var o = cl;
  if (o.depth >= 1e9) { return o; }
  if (u.solid > 0.0) { o.bg = o.c * u.solid; }
  if (u.sharp < 3.0) {
    let s = u.sharp;
    var fill = 0.0;
    if (o.kind == KIND_GROUND) { fill = 0.5; } else if (o.kind == KIND_OBJECT && s < 2.0) { fill = 0.7; } else if (s == 0.0 && (o.kind == KIND_WALL || o.kind == KIND_ROOM)) { fill = 0.28; }
    if (fill > 0.0) {
      let fa = select(0.0, clamp((o.depth - 40.0) / 220.0, 0.0, 1.0), u.fuse > 0.5); let f = fa * fa * (3.0 - 2.0 * fa);
      let glyph = select(select(0.78, 0.95, o.kind == KIND_OBJECT), 0.82, o.kind == KIND_GROUND) - 0.15 * f;
      let fl = fill + (0.5 - fill) * 0.45 * f;
      o.bg = o.c * fl; o.c *= glyph;
    }
  }
  // a sign glows through its whole cell, not only its glyph (the bulbs' light on the panel behind them)
  if (o.depth == gTag && gEmK > 1.0) { o.bg = max(o.bg, o.c * SIGN_FILL); }
  if (o.kind == KIND_BLOCK) {
    // solid color; a glyph left on it is a glint, brighter than the surface
    o.bg = o.c;
    if (o.ch != 32u) { o.c = o.c * 1.4 + vec3f(50.0, 50.0, 46.0); }
  }
  if (u.blocks > 0.5 && BLOCKS[o.ch] != 0u) { o.ch = BLOCKS[o.ch]; }
  return o;
}

`;
