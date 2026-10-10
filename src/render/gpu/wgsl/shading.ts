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
// ---- (16.1c) the sunlight's color: the sun's through the air to here (atmosphere.ts, on the CPU each frame), its
// luminance ~1 at noon; golden in the late afternoon, red and dim in its last minute, nothing once it is down
fn sunLin() -> vec3f { return vec3f(u.sunTR, u.sunTG, u.sunTB); }
/** The sky's light, its hue the dome's (blue at noon, violet in the twilight; whiter under clouds) and its strength over noon's (skyL). */
fn skyHue() -> vec3f { return mix(vec3f(u.zenR, u.zenG, u.zenB), vec3f(0.82, 0.84, 0.88), u.cloud) * min(1.0, u.skyL); }
// ---- the light (L.1): one for day and night. A surface's palette color is its albedo; it gets the ambient light
// (the sky's by day, the city's glow and the moon's by night), the sun's, and the lamps'; what glows adds its own.
// The sum is radiance, in linear light; the eye's exposure (EV) takes it to the screen through one tone curve.
// What is not lit this way (the rooms seen inside, painted signs) keeps its color as it looks at the
// exposure the time of day expects, and follows the eye's adaptation only.
/** The night's ambient light with the city lit (its glow on everything; the night's palette is drawn for it), and the full moon's. */
/** (16.1c) The sun's irradiance in these units (the atmosphere's: gi.ts GI_SUN, over pi for a Lambert surface), and what the
 *  old units (the sun's 4.2, DAY_SUN) are in these: the night's constants below were set in the old ones. */
const SUN_E = GI_SUN / 3.14159265; const E_UNIT = SUN_E / 4.2;
/** (16.1c) The palette's colors were drawn ~6x darker than real reflectances (the asphalt's (38, 38, 46) is 0.02 linear;
 *  the real one 0.07-0.12): a surface's albedo is its color x K_PAL, its hue kept under ALB_MAX (part 1 of
 *  docs/plano-luz-fisica.md gives each material its own). */
const K_PAL = 6.0; const ALB_MAX = 0.85;
const AMB_N = 0.004 * E_UNIT; const MOON_E = 0.003 * E_UNIT;
/** How much of the moonlight a point in the buildings' moon shadow still gets (the sky's part of it). */
const MOON_SHADE = 0.25;
/** How much the eye opens up as the city's glow fails (0: not at all, 1: as much as the light fell). */
const NIGHT_ADAPT = 0.3;
/** The lamps' light (lightAt's) in the same units: under a street lamp ~3% of the day's sky. */
const LAMP_E = 0.45 * E_UNIT;
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
/** The lamps' highlight on what is glossy. */
const LAMP_SPEC = 0.03;
/** The night's exposure with the city lit: the night's palette shows as drawn under AMB_N. */
const EV_NIGHT = 1.0 / (K_PAL * AMB_N);
fn lin(c: vec3f) -> vec3f { return pow(max(c, vec3f(0.0)) / 255.0, vec3f(2.2)); }
fn srgb(x: vec3f) -> vec3f { return pow(max(x, vec3f(0.0)), vec3f(1.0 / 2.2)) * 255.0; }
fn luma(c: vec3f) -> f32 { return dot(c, vec3f(0.2126, 0.7152, 0.0722)); }
/** How far toward the day's look (0 at night, 1 from a third of the way into the day). */
fn dayGrade() -> f32 { return smoothK(0.0, 0.35, u.day); }
/** The city's glow on everything (it fades with the lamps in a blackout). */
fn cityAmb() -> f32 { return AMB_N * (0.02 + 0.98 * pow(clamp(u.cityLit, 0.0, 1.0), 1.5)); }
/** The exposure from night to day (on a log scale), without the blackout's. */
fn evDayNight() -> f32 { return u.dayEv; }
/** (16.1c) How far the eye is from the day's exposure toward the night's (0 day, 1 night), by the sky's light. */
fn evNight() -> f32 { return clamp(log(u.dayEv / DAY_EXPO) / log(EV_NIGHT / DAY_EXPO), 0.0, 1.0); }
/** The exposure the time of day expects: the night's opened up a little when the city goes dark. */
fn evRef() -> f32 { return u.dayEv * pow(cityAmb() / AMB_N, -NIGHT_ADAPT * evNight()); }
/** One tone curve: the night's (untouched below a knee) toward the day's filmic one with the day. */
fn toneMap(x: vec3f, g: f32) -> vec3f {
  if (g <= 0.0) { return nightTone(x); }
  if (g >= 1.0) { return tone(x); }
  return mix(nightTone(x), tone(x), g);
}
/**
 * (16.1b) The color grade, the last step of the world's picture (the film's look): made by code from the hour and the
 * weather, not a table. At night the shadows lean cold (blue-teal) and the lit parts keep the sodium's warmth (the
 * dusk's gold is the sun's own through the air now, 16.1c: not graded on top); rain greys and cools it; by day it is nearly neutral. A soft S-curve gives the
 * mids their contrast without crushing the blacks. GRADE_K scales all of it (0: off).
 */
const GRADE_K = 1.0;
fn grade(c: vec3f) -> vec3f {
  var x = clamp(c / 255.0, vec3f(0.0), vec3f(1.0));
  let night = 1.0 - u.day; let wet = u.precip;
  let l = dot(x, vec3f(0.2126, 0.7152, 0.0722));
  // the shadows' tint (lift, fading out by the mids) and the highlights' (gain)
  let lift = (vec3f(-0.004, 0.006, 0.022) * night + vec3f(-0.004, 0.0, 0.012) * wet) * GRADE_K;
  let gain = vec3f(1.0) + (vec3f(0.03, 0.0, -0.04) * night * (1.0 - 0.5 * wet)) * GRADE_K;
  let sh = (1.0 - l) * (1.0 - l);
  x = x + lift * sh;
  x = x * mix(vec3f(1.0), gain, smoothstep(0.15, 0.8, l));
  // the saturation: a little less in the rain
  let l2 = dot(x, vec3f(0.2126, 0.7152, 0.0722));
  x = mix(vec3f(l2), x, 1.0 - 0.18 * wet * GRADE_K);
  // the S-curve on the mids
  let xs = clamp(x, vec3f(0.0), vec3f(1.0));
  x = mix(x, xs * xs * (3.0 - 2.0 * xs), 0.12 * GRADE_K);
  return clamp(x, vec3f(0.0), vec3f(1.0)) * 255.0;
}
/** (16.1b) How strongly the street lamps' light (lightAt) shows on what it falls on. */
const LAMP_RECV = 1.5; // (1.2 on the old sRGB light, now linear: 1.2^2.2)
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
/** The lamps' light (lightAt's linear units) as light in the same units as the sun's and the sky's. */
fn lampE(lampL: vec3f) -> vec3f { return lampL * LAMP_E; }
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
  let sky = skyHue() * (DAY_SKY + 0.35 * u.cloud);
  let sun = sunLin() * (DAY_SUN * (1.0 - 0.85 * u.cloud) * max(0.0, u.sunZ));
  // (not the lamps yet: lightAt here was inlined in every one of roomWalk's roomLit calls, and the shader took minutes to compile)
  // (16.1c: the sky and the sun still in the old units until part 4, the rooms, brings them onto the rays)
  return (sky + sun) * E_UNIT + vec3f(cityAmb());
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
  if (!gRObj && dot(gRN, gRN) > 0.5) { N = gRN; }
  else if (!gRObj) {
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
  let ds = min(1.0, u.skyL); // (16.1c) the daylight's strength, from the air
  // (the daylight outside: the sky's, and the sun's off the street and the walls round, SUN_IN of it)
  let out = DAY_SKY + DAY_SUN * SUN_IN * (1.0 - 0.85 * u.cloud) * max(0.0, u.sunZ);
  let sky = mix(vec3f(0.6, 0.66, 0.8), vec3f(0.82, 0.84, 0.88), u.cloud) * (out * ds * (SKY_IN_DEEP + SKY_IN_WIN * exp(-dw / DAYLIGHT_FALL)));
  return AMB_N * artK() * pow(la, vec3f(2.2)) + sky * E_UNIT; // (16.1c: the daylight in the old units until part 4)
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
  // (16.1b) the deferred light: the street lamps', headlights' and signs' light on the surface, here once for all of them
  // (the cell's color is its albedo; gIl keeps only what a facade paints on itself: its neon, floodlights, a lit window's spill)
  let def = tagged && o.kind != KIND_ROOM && (o.kind != KIND_OTHER || max(emit.x, max(emit.y, emit.z)) < 1.0);
  // (lamp: what the facade paints on itself, sRGB; lampL: the lights', linear)
  var lampL = vec3f(0.0);
  if (def && o.depth < LIT_FAR) { lampL = lightAt(gPos.x, gPos.y, gPos.z, gNrm) * LAMP_RECV; }
  gDbg = vec3f(luma(lamp) / 255.0 * 4.0, luma(srgb(lampL)) / 255.0 * 4.0, luma(giE));
  // the surface's hue (its palette color, saturated, max channel 1), for the paint's reflection
  if (mb > 12.0) { let s0 = max(vec3f(0.0), mix(vec3f(luma(base)), base, LIT_SAT)); gTint = s0 / max(1.0, max(s0.x, max(s0.y, s0.z))); }
  let day = u.day; let night = 1.0 - day; let g = dayGrade();
  let objSun = o.sun >= 2.0;
  let sunlit = o.kind == KIND_WALL || objSun;
  // the blackout's darkening of what is not lit this way (what is lit, below, darkens by its light)
  let dark = 1.0 - 0.72 * pow(1.0 - u.cityLit, 1.5) * night;
  if (o.kind == KIND_GROUND || o.kind == KIND_BLOCK || sunlit) {
    // ---- lit: albedo x the light on it
    // (16.1c) the albedo: the color x K_PAL under its material's reflectance (albedoOf; the same by day and by night)
    let A = albedoOf(base, gMat);
    // the moon (bluish), past the buildings round it (gMoon); (16.1c) the city's glow is no longer an ambient on everything:
    // the night is lit by what is there (the lamps, their pools bouncing up the facades, the lit windows: by the rays, giE)
    let En = vec3f(0.875, 1.0, 1.44) * (MOON_E * u.moonlight * (1.0 - 0.7 * u.cloud) * mix(MOON_SHADE, 1.0, gMoon));
    // (16.1c) the day's: the sun's through the air on what faces it out of the shadows (gSun), and the sky's and every
    // bounce's by the rays (giE: gi.ts, the world cache; past its reach, the open sky's light that way)
    let share = select(select(u.sunZ, o.sun, sunlit || o.kind == KIND_BLOCK), o.sun - 2.0, objSun);
    let sunC = sunLin(); let sunK = SUN_E * (1.0 - 0.85 * u.cloud) * gSun;
    let Ei = select(skySH(select(vec3f(0.0, 0.0, 1.0), gNrm, def)), giE, giOn) * u.tk_giK;
    let E = (En + Ei + sunC * (sunK * max(0.0, share))) * (1.0 + 0.6 * u.flash);
    // the lamps: their light takes the surface's color (by day the sun outshines them: the eye does that)
    let El = lampE(linL(lamp) + lampL);
    // what glows: at night as drawn; by day almost as bright on the screen (a sign is not lost in the sun)
    // (a sign keeps most of its brightness when the eye closes down in a bright street: it still reads as lit)
    // (16.1b) a lit window is a room's light: by day as the room's lamps are (artK), not as a sign
    let roomGlow = (gMat == MAT_GLASS || gMat == MAT_WINDOW) && gEmK <= 1.0;
    let Le = lin(emit) * (select(pow(EV_NIGHT / evDayNight(), EMIT_KEEP), artK(), roomGlow) / EV_NIGHT) * select(1.0, gEmK * pow(max(1.0, 1.0 / u.adapt), SIGN_EYE), tagged && gEmK > 1.0);
    var Lr = A * (E + El) + Le;
    // a glossy surface (wet asphalt, a car's paint, glass) also shines with the lamps' own color, and the sun's
    if (gMat != MAT_NONE && tagged) {
      let r = matRough();
      // (16.1b) not where the reflection ray mirrors the city (glass, a window, a car's paint, the wet ground): there the
      // lamps are seen in the mirror itself, and this, with no direction, counted them twice (auditoria-luz.md)
      let mirrors = gMat == MAT_GLASS || gMat == MAT_WINDOW || gMat == MAT_PAINT || gWet > 0.05;
      let sp = select(El * (fres(MAT_F0[gMat], max(0.0, dot(gNrm, -gRay))) * (1.0 - r) * (1.0 - r) * LAMP_GLOSS * LAMP_SPEC), vec3f(0.0), mirrors);
      Lr += sp; spG = dot(srgb(sp * ev), vec3f(0.3, 0.5, 0.2)) / 255.0 * SPEC_BLOOM;
      if (day > 0.01) {
        let gloss = sunGloss() * sunK;
        Lr += sunC * gloss;
        gGlow = clamp((gloss - SPEC_BLOOM_MIN) * SPEC_BLOOM_SUN, 0.0, 1.0); // a strong glint on metal blooms
      }
    }
    o.c = srgb(toneMap(Lr * ev, g));
    gGlow = max(gGlow, clamp(dot(srgb(Le * ev), vec3f(0.3, 0.5, 0.2)) / 255.0 + spG, 0.0, 1.0) * (1.0 - 0.75 * day) * select(1.0, gGlowK, tagged));
  } else if (o.kind == KIND_ROOM) {
    // ---- a room: its paint lit here, once (roomE, from roomLit's note), in the street's units; or, without a note (the
    // roof's open air), lit by roomLit itself (roomMul). Exposed and toned as the street; what glows in it (a screen, a
    // lamp) is its own light, brighter by gEmK as the signs are, and by day as the artificial light is (artK)
    var Lr = (lin(max(vec3f(0.0), o.c - emit)) + lin(emit) * (select(1.0, gEmK, tagged) * artK())) / EV_NIGHT;
    if (gRUse) { Lr = lin(max(vec3f(0.0), o.c - emit)) * K_PAL * roomE() + lin(emit) * (select(1.0, gEmK, tagged) * artK() / EV_NIGHT); }
    o.c = srgb(toneMap(Lr * ev, g));
    gGlow = clamp(dot(srgb(lin(emit) / EV_NIGHT * ev), vec3f(0.3, 0.5, 0.2)) / 255.0, 0.0, 1.0) * select(1.0, gGlowK, tagged);
  } else {
    // ---- kept as drawn (what glows, painted boards, a person or a pole not lit as a solid): the lamps' light, the moon on
    // it, brighter by day, the blackout, and the eye's adaptation
    var c = o.c;
    // (what is drawn is not lit as a solid: the lamps' light is added to its color, toned down by day as the old light was;
    //  auditoria-luz.md C1: the new people are lit as solids, and this path goes)
    let lampS = srgb(lampL) * (1.0 - 0.85 * day);
    if (def) { c += lampS; }
    if (u.moonlight > 0.02 && o.depth > 0.0) { let m = u.moonlight * (1.0 - 0.7 * u.cloud) * 14.0; c += vec3f(m * 0.7, m * 0.8, m * 1.15); }
    let amb = 1.0 + 0.7 * day + u.flash * 0.6;
    c *= amb;
    let lit = min(c, emit + lamp + lampS);
    let up = pow(evRef() / evDayNight(), 1.0 / 2.2); // how much the eye opened in the blackout
    c = (c - lit) * dark + lit * up * select(1.0, gEmK, tagged);
    gGlow = clamp(dot(emit, vec3f(0.3, 0.5, 0.2)) / 255.0, 0.0, 1.0) * (1.0 - 0.75 * day) * select(1.0, gGlowK, tagged) * up;
    if (abs(u.adapt - 1.0) > 0.001) { c = srgb(lin(c) * u.adapt); }
    o.c = c;
  }
  o.bg *= dark;
  gGlow = min(1.0, gGlow * rS);
  // one haze for everything, in the sky's own color at the horizon that way (by night the city's glow): far things melt
  // into the sky behind them
  o.c = aerial(o.c, o.depth, o.kind == KIND_BLOCK);
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
