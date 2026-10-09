import { BLD } from './common';
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
/** (16.1b) How strongly the street lamps' light (lightAt) shows on what it falls on, and how much of the ambient a face turned away from its source keeps. */
const LAMP_RECV = 1.2; const AMB_FACE = 0.72;
/** (16.1b) The air between the eye and a thing: how far until most of it is haze, by night and by day (shorter in rain), and the most of it a thing takes. */
const AIR_NIGHT = 900.0; const AIR_DAY = 1800.0; const AIR_MAX_N = 0.5; const AIR_MAX_D = 0.65; const AIR_EDGE = 220.0;
/** The sky's color at the horizon toward the ray, as the eye sees it (the sky follows the adaptation only). */
fn horizonSeen() -> vec3f {
  let h = horizonCol(gRay.x, gRay.y);
  return select(h, srgb(nightTone(lin(h) * u.adapt)), abs(u.adapt - 1.0) > 0.001);
}
fn aerial(c: vec3f, d: f32, edge: bool) -> vec3f {
  let D = select(mix(AIR_NIGHT, AIR_DAY, u.day) / (1.0 + 1.5 * u.precip), AIR_EDGE, edge);
  let k = (1.0 - exp(-d / D)) * select(mix(AIR_MAX_N, AIR_MAX_D, u.day), 1.0, edge);
  if (k < 0.002) { return c; }
  return mix(c, horizonSeen(), k);
}
/** The street lamps' light (lightAt's color units, dimmed by day) as light in the same units as the sun's and the sky's. */
fn lampE(lamp: vec3f) -> vec3f {
  let lx = lamp / max(0.15, 1.0 - 0.85 * u.day) / 255.0;
  return pow(min(lx, vec3f(1.0) + max(lx - vec3f(1.0), vec3f(0.0)) * LAMP_OVER), vec3f(2.2)) * LAMP_E;
}
/** (16.1b) A room's light E (the sun's and the sky's units) as roomLit's multiplier of its paint: lin(paint x M) = lin(paint) x E / AMB_N,
 *  so that light() takes the room back to E and exposes it as it does the street (the night's lamps come out as before). */
/** (16.1b) The game's night is brighter than a real one (its palette shows under AMB_N), so a lamp or a screen, drawn
 *  for the night, is too faint next to the day's light: by day the artificial light (a room's lamps, its screens, a lit
 *  window seen from afar) keeps this much of the eye's change from night to day (0: none, as a real light; 1: all). */
const ART_KEEP = 0.6;
fn artK() -> f32 { return pow(EV_NIGHT / evDayNight(), ART_KEEP); }
fn roomMul(E: vec3f) -> vec3f { return pow(max(E, vec3f(0.0)) / AMB_N, vec3f(1.0 / 2.2)); }
/** (16.1b) The open air's light on a roof, the street's: the sky, the sun (no shadows yet), the city's glow at night. */
fn roofE(x: f32, y: f32, z: f32) -> vec3f {
  let g = dayGrade(); let ds = pow(AMB_N / DAY_SKY, 1.0 - g) * min(1.0, 4.0 * g);
  let sky = mix(vec3f(0.48, 0.6, 0.92), vec3f(0.82, 0.84, 0.88), u.cloud) * (DAY_SKY + 0.35 * u.cloud) * ds;
  let sun = sunLin() * (DAY_SUN * (1.0 - 0.85 * u.cloud) * ds * max(0.0, u.sunZ));
  // (not the lamps yet: lightAt here was inlined in every one of roomWalk's roomLit calls, and the shader took minutes to compile)
  return sky + sun + vec3f(cityAmb() * (1.0 - g));
}
/** (16.1b) How much of a room lamp's light a surface turned away from it still gets (the other lamps, the bounce off the room). */
const ROOM_WRAP = 0.35;
/**
 * (16.1b) The light on a room's surface (the street's units), from roomLit's note (gRV..gRX): its lamps, by the distance to
 * the nearest and its angle to the surface (so a door's jamb, a wall and the ceiling read apart), the city's glow at night
 * and the daylight by its windows. The surface's normal: a piece of furniture's own (gRObj); else from the plan: the floor,
 * the ceiling, or a wall on the plan's grid lines, facing the ray.
 */
fn roomE() -> vec3f {
  let V = gRV; let ro = gRO; let r = gRR; let x = gRX.x; let y = gRX.y; let d = gRX.z;
  let z = gOZ + gRay.z / max(1e-4, length(gRay.xy)) * length(vec2f(x - gOX, y - gOY));
  var N = gNrm;
  if (!gRObj) {
    let zr = z - V.z0;
    if (zr < 0.03) { N = vec3f(0.0, 0.0, 1.0); }
    else if (zr > CEIL - 0.03) { N = vec3f(0.0, 0.0, -1.0); }
    else {
      let ax = abs(fract(x / PCELL + 0.5) - 0.5); let ay = abs(fract(y / PCELL + 0.5) - 0.5);
      N = select(vec3f(0.0, -sign(gRay.y), 0.0), vec3f(-sign(gRay.x), 0.0, 0.0), ax < ay);
    }
  }
  let lp = roomLamp(V.lot, V.box, ro, r, V.f, V.elec, r == V.here);
  let off = lampOff(ro, x, y);
  let Lv = vec3f(-off, V.z0 + CEIL - 0.05 - z);
  let nl = mix(ROOM_WRAP, 1.0, max(0.0, dot(N, Lv) / max(1e-3, length(Lv))));
  let k = (0.5 + 0.9 / (1.0 + dot(off, off) / 5.0)) / (1.0 + d * 0.03); let a = 0.14 * (1.0 - u.day);
  let la = lp * (k * nl) + vec3f(a, a * 1.05, a * 1.25);
  let q = u32(V.box * ${BLD});
  let dw = max(0.0, min(min(x - bldF(u32(q)), bldF(u32(q + 2u)) - x), min(y - bldF(u32(q + 1u)), bldF(u32(q + 3u)) - y)));
  let g = dayGrade(); let ds = pow(AMB_N / DAY_SKY, 1.0 - g) * min(1.0, 4.0 * g);
  // (the daylight outside: the sky's, and the sun's off the street and the walls round, SUN_IN of it)
  let out = DAY_SKY + DAY_SUN * SUN_IN * (1.0 - 0.85 * u.cloud) * max(0.0, u.sunZ);
  let sky = mix(vec3f(0.6, 0.66, 0.8), vec3f(0.82, 0.84, 0.88), u.cloud) * (out * ds * (SKY_IN_DEEP + SKY_IN_WIN * exp(-dw / DAYLIGHT_FALL)));
  return AMB_N * artK() * pow(la, vec3f(2.2)) + sky;
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
  let emit = select(vec3f(0.0), gEm, tagged); var lamp = select(vec3f(0.0), gIl, tagged);
  let base = max(vec3f(0.0), o.c - emit - lamp); let mb = max(base.x, max(base.y, base.z));
  // (16.1b) the deferred light: the street lamps', headlights' and signs' light on the surface, here once for all of them
  // (the cell's color is its albedo; gIl keeps only what a facade paints on itself: its neon, floodlights, a lit window's spill)
  let def = defOn() && tagged && o.kind != KIND_ROOM && (o.kind != KIND_OTHER || max(emit.x, max(emit.y, emit.z)) < 1.0);
  if (def && o.depth < LIT_FAR) { lamp += lightAt(gPos.x, gPos.y, gPos.z, gNrm) * LAMP_RECV; }
  gDbg = vec3f(luma(select(vec3f(0.0), gIl, tagged)) / 255.0 * 4.0, luma(lamp) / 255.0 * 4.0, select(0.0, 1.0, def));
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
    // (16.1b) the ambient by the face's normal: the city's glow comes most from downtown, the sky's most from the sun's side
    var aCity = 1.0; var aSky = 1.0;
    if (def && abs(gNrm.z) < 0.7) {
      let Nh = normalize(gNrm.xy + vec2f(1e-5, 0.0));
      let tc = vec2f(u.ccx - gPos.x, u.ccy - gPos.y); let tl = length(tc);
      aCity = AMB_FACE + (1.0 - AMB_FACE) * select(0.5, 0.5 + 0.5 * dot(Nh, tc / tl), tl > 1.0);
      let sl = length(vec2f(u.sunX, u.sunY));
      aSky = AMB_FACE + (1.0 - AMB_FACE) * select(0.5, 0.5 + 0.5 * dot(Nh, vec2f(u.sunX, u.sunY) / sl), sl > 1e-3);
    }
    let En = vec3f(cityAmb() * aCity) * mix(1.0, gSky, 0.5) + vec3f(0.875, 1.0, 1.44) * (MOON_E * u.moonlight * (1.0 - 0.7 * u.cloud) * gSky * mix(MOON_SHADE, 1.0, gMoon));
    // the day's: the sky's (bluish; whiter under clouds) and the sun's on what faces it out of the shadows (gSun);
    // it fades in on a log scale with the exposure (ds), so dusk never dips darker than night or day
    let ds = pow(AMB_N / DAY_SKY, 1.0 - g) * min(1.0, 4.0 * g);
    let share = select(select(u.sunZ, o.sun, sunlit || o.kind == KIND_BLOCK), o.sun - 2.0, objSun);
    let sunC = sunLin(); let sunK = DAY_SUN * (1.0 - 0.85 * u.cloud) * gSun * ds;
    let skyC = mix(vec3f(0.48, 0.6, 0.92), vec3f(0.82, 0.84, 0.88), u.cloud) * (DAY_SKY + 0.35 * u.cloud);
    // what hides the sky gives some back: the walls and the street round it, lit by the sky and by the sun on part of them
    let sunOpen = DAY_SUN * (1.0 - 0.85 * u.cloud) * ds * max(0.0, u.sunZ);
    let Eb = SKY_BOUNCE * (skyC * (ds * BOUNCE_SKY) * gBncA + sunC * (DAY_SUN * (1.0 - 0.85 * u.cloud) * ds * BOUNCE_SUN * smoothK(-0.02, 0.04, u.sunZ)) * gBncS);
    let E = (En * (1.0 - g) + skyC * (ds * gSky * aSky) + Eb + sunC * (sunK * max(0.0, share))) * (1.0 + 0.6 * u.flash);
    // the lamps (lightAt dims its light by day; the eye does that now): their light takes the surface's color;
    // on a facade most of its hue (each street takes its lamps' tone; all of it under the old sRGB light made scorched-paper greys)
    // (past white the sum of lamps grows slowly: a few headlights together raised to the 2.2 blew a car out to white)
    var El = lampE(lamp);
    if (o.kind == KIND_WALL) { El = mix(vec3f(luma(El)), El, WALL_LAMP_HUE); }
    // what glows: at night as drawn; by day almost as bright on the screen (a sign is not lost in the sun)
    // (a sign keeps most of its brightness when the eye closes down in a bright street: it still reads as lit)
    // (16.1b) a lit window is a room's light: by day as the room's lamps are (artK), not as a sign
    let roomGlow = defOn() && (gMat == MAT_GLASS || gMat == MAT_WINDOW) && gEmK <= 1.0;
    let Le = lin(emit) * (select(pow(EV_NIGHT / evDayNight(), EMIT_KEEP), artK(), roomGlow) / EV_NIGHT) * select(1.0, gEmK * pow(max(1.0, 1.0 / u.adapt), SIGN_EYE), tagged && gEmK > 1.0);
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
    // (the bare ground past the city's edge goes all the way to the horizon's haze: it lay cream under the sky)
    let fd = select((1.0 - exp(-o.depth / 1800.0)) * 0.6, 1.0 - exp(-o.depth / 500.0), o.kind == KIND_BLOCK);
    if (!defOn()) { o.c = mix(o.c, haze * rS, (1.0 - g) * f + g * fd); }
  } else if (defOn() && o.kind == KIND_ROOM) {
    // ---- (16.1b) a room: its color is its paint lit by roomLit in the street's units (roomMul): exposed and toned as the street
    // (what glows in it, a screen or a lamp, is its own light, brighter by gEmK as the signs are)
    var Lr = (lin(max(vec3f(0.0), o.c - emit)) + lin(emit) * (select(1.0, gEmK, tagged) * artK())) / EV_NIGHT;
    // (its paint lit here, once: roomE)
    if (gRUse) { Lr = lin(max(vec3f(0.0), o.c - emit)) * DAY_ALBEDO * roomE() + lin(emit) * (select(1.0, gEmK, tagged) * artK() / EV_NIGHT); }
    o.c = srgb(toneMap(Lr * ev, g));
    gGlow = clamp(dot(srgb(lin(emit) / EV_NIGHT * ev), vec3f(0.3, 0.5, 0.2)) / 255.0, 0.0, 1.0) * select(1.0, gGlowK, tagged);
  } else {
    // ---- kept as drawn: the moon on it, brighter by day (rooms keep their own lamps' light), the blackout,
    // and the eye's adaptation
    var c = o.c;
    if (def) { c += lamp - select(vec3f(0.0), gIl, tagged); } // (16.1b) the lamps' light, here and no longer in the cell
    if (u.moonlight > 0.02 && o.depth > 0.0) { let m = u.moonlight * (1.0 - 0.7 * u.cloud) * 14.0; c += vec3f(m * 0.7, m * 0.8, m * 1.15); }
    let amb = 1.0 + select(0.7, 0.1, o.kind == KIND_ROOM) * day + u.flash * 0.6;
    c *= amb;
    let lit = min(c, emit + lamp);
    let up = pow(evRef() / evDayNight(), 1.0 / 2.2); // how much the eye opened in the blackout
    c = (c - lit) * dark + lit * up * select(1.0, gEmK, tagged);
    gGlow = clamp(dot(emit, vec3f(0.3, 0.5, 0.2)) / 255.0, 0.0, 1.0) * (1.0 - 0.75 * day) * select(1.0, gGlowK, tagged) * up;
    let f = day * (0.1 + 0.42 * (1.0 - exp(-o.depth / 2500.0)));
    if (!defOn()) { c = c * (1.0 - f) + haze * f; }
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
  if (night > 0.01 && o.kind != KIND_ROOM && !defOn()) {
    let hk = (1.0 - exp(-o.depth / 900.0)) * NIGHT_HAZE * night * (0.15 + 0.85 * u.cityLit) * (0.8 + 0.4 * u.precip);
    o.c = o.c * (1.0 - hk) + vec3f(120.0, 64.0, 26.0) * (hk * rS);
  }
  // (16.1b) one haze for everything, in the sky's own color at the horizon that way: far things melt into the sky behind them
  if (defOn()) { o.c = aerial(o.c, o.depth, o.kind == KIND_BLOCK); }
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
