/**
 * (16.1c) The atmosphere, by its physics: single scattering of the sunlight by the air (Rayleigh), the haze (Mie)
 * and the ozone's absorption (what gives the twilight its blue-violet), with the Earth's constants (Hillaire 2020 /
 * Bruneton). One model, two places: the CPU (here) gives the frame its sun color through the air (on the ground and at
 * the clouds' height) and the zenith's hue; the shader (atmoWGSL, from the same constants) marches it per sky cell.
 * Lengths in metres; the sun's irradiance is 1 (the radiance comes out relative to it).
 */
export const ATMO = {
  R: 6360e3, TOP: 6460e3,
  /** Rayleigh: scattering per metre at sea level (r, g, b), scale height. */
  BR: [5.802e-6, 13.558e-6, 33.1e-6], HR: 8000,
  /** Mie: scattering and absorption per metre at sea level, scale height, asymmetry. */
  BMS: 3.996e-6, BMA: 4.4e-6, HM: 1200, G: 0.8,
  /** Ozone: absorption per metre at its peak, the peak's height and the layer's half width (a tent). */
  BO: [0.65e-6, 1.881e-6, 0.085e-6], OH: 25000, OW: 15000,
  /** The multiple scattering, cheaply: an isotropic share of what the air scatters, lit by the same sun (0: single only). */
  MS: 0.6,
  /** The march's samples along the view. */
  STEPS: 10,
};
/** The clouds' height (sky.ts's CLOUD_H .. CLOUD_TOP, the middle): where their sun color is taken; and the high veil's (cirrus). */
const CLOUD_MID = 1500;
export const CIRRUS_H = 8000;

/**
 * The air's density along a ray to space from radius r at cos mu from the vertical, over the scale height H:
 * the integral of exp(-altitude/H), in units of H (Schüler's approximation of the Chapman function). Huge when the
 * ray runs into the ground.
 */
export function chapman(r: number, mu: number, H: number) {
  const X = ATMO.R / H, h = (r - ATMO.R) / H, c = Math.sqrt(X + h);
  if (mu >= 0) return (c / (c * mu + 1)) * Math.exp(-h);
  const x0 = Math.sqrt(1 - mu * mu) * (X + h);
  return 2 * Math.sqrt(x0) * Math.exp(Math.min(60, X - x0)) - (c / (1 - c * mu)) * Math.exp(-h);
}
/** The ozone's column along the ray (m of its peak density): the layer's column (OW) through its slant at its height. */
function ozoneCol(r: number, mu: number) {
  const k = r / (ATMO.R + ATMO.OH), s = Math.sqrt(Math.max(1e-3, 1 - k * k * (1 - mu * mu)));
  return (ATMO.OW / s) * (mu < 0 ? 2 : 1);
}
/** The sunlight left after the air from radius r toward the sun at cos mu from the vertical (r, g, b). */
export function transmittance(r: number, mu: number, out: number[] = [0, 0, 0], mie = 1) {
  const dR = chapman(r, mu, ATMO.HR) * ATMO.HR, dM = chapman(r, mu, ATMO.HM) * ATMO.HM, dO = ozoneCol(r, mu);
  for (let c = 0; c < 3; c++) out[c] = Math.exp(-(ATMO.BR[c] * dR + (ATMO.BMS + ATMO.BMA) * mie * dM + ATMO.BO[c] * dO));
  return out;
}
const PR = (c: number) => (3 / (16 * Math.PI)) * (1 + c * c);
const PM = (c: number) => { const g = ATMO.G; return ((3 / (8 * Math.PI)) * ((1 - g * g) * (1 + c * c))) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * c, 1.5)); };
/** The sky's radiance seen from height h0 along v (unit, z up) with the sun along s (unit): the CPU twin of atmoWGSL's atmo(). */
export function skyRadiance(h0: number, v: number[], s: number[], out: number[] = [0, 0, 0], mie = 1) {
  const r0 = ATMO.R + h0, b = r0 * v[2], tMax = -b + Math.sqrt(b * b - (r0 * r0 - ATMO.TOP * ATMO.TOP));
  const cs = v[0] * s[0] + v[1] * s[1] + v[2] * s[2], pr = PR(cs), pm = PM(cs);
  const tv = [0, 0, 0], T = [0, 0, 0]; out[0] = out[1] = out[2] = 0;
  const N = ATMO.STEPS;
  for (let i = 0; i < N; i++) {
    const t = tMax * ((i + 0.5) / N) ** 2, dt = (tMax * (2 * i + 1)) / (N * N);
    const px = v[0] * t, py = v[1] * t, pz = r0 + v[2] * t, r = Math.hypot(px, py, pz), h = r - ATMO.R;
    const mu = (px * s[0] + py * s[1] + pz * s[2]) / r;
    const dR = Math.exp(-h / ATMO.HR), dM = Math.exp(-h / ATMO.HM), dO = Math.max(0, 1 - Math.abs(h - ATMO.OH) / ATMO.OW);
    transmittance(r, mu, T, mie);
    for (let c = 0; c < 3; c++) {
      const ext = ATMO.BR[c] * dR + (ATMO.BMS + ATMO.BMA) * mie * dM + ATMO.BO[c] * dO;
      tv[c] += ext * dt * 0.5;
      const sc = ATMO.BR[c] * dR, sm = ATMO.BMS * mie * dM;
      out[c] += Math.exp(-tv[c]) * T[c] * (sc * pr + sm * pm + (sc + sm) * (ATMO.MS / (4 * Math.PI))) * dt;
      tv[c] += ext * dt * 0.5;
    }
  }
  return out;
}

/** The sky's light in the units of the shader's light() (sky.ts's SKY_K): calibrated so the clear zenith at noon reads as the old sky's. */
export const SKY_K = 4.7;
/** The night sky's own faint light (the airglow, the haze over the city: sky.ts's night gradient, its mean), in light() units at full night. */
const NIGHT_SKY = [0.004, 0.0035, 0.006].map((x) => x / 125);
const FIB = 256, FIB_D: number[][] = [];
for (let i = 0; i < FIB; i++) { const z = 1 - (2 * i + 1) / FIB, r = Math.sqrt(1 - z * z), a = i * 2.39996323; FIB_D.push([Math.cos(a) * r, Math.sin(a) * r, z]); }
/** The 9 real spherical harmonics (L2) of a unit direction. */
export function shBasis(d: number[], o: number[] = []) {
  const [x, y, z] = d;
  o[0] = 0.282095; o[1] = 0.488603 * y; o[2] = 0.488603 * z; o[3] = 0.488603 * x;
  o[4] = 1.092548 * x * y; o[5] = 1.092548 * y * z; o[6] = 0.315392 * (3 * z * z - 1); o[7] = 1.092548 * x * z; o[8] = 0.546274 * (x * x - y * y);
  return o;
}
/**
 * (16.1c) The whole sky's light by direction as 27 numbers (L2 spherical harmonics, 9 per channel, c[k * 3 + ch]): what a
 * ray of the indirect light that escapes the city meets (the shader's skySH). Below the horizon, the horizon's light
 * (those rays hit the ground first anyway). night: 0..1, the night sky's own light (1 - day).
 */
export function skySH(sunEl: number, sunA: number, mie: number, night: number, out = new Float32Array(27)) {
  out.fill(0);
  const ce = Math.cos(sunEl), s = [Math.cos(sunA) * ce, Math.sin(sunA) * ce, Math.sin(sunEl)], Y: number[] = [], L = [0, 0, 0], v = [0, 0, 0];
  const w = (4 * Math.PI) / FIB;
  for (const d of FIB_D) {
    v[0] = d[0]; v[1] = d[1]; v[2] = Math.max(0.02, d[2]);
    const n = Math.hypot(v[0], v[1], v[2]); v[0] /= n; v[1] /= n; v[2] /= n;
    if (sunEl > -0.35) skyRadiance(2, v, s, L, mie); else L[0] = L[1] = L[2] = 0;
    shBasis(d, Y);
    for (let c = 0; c < 3; c++) { const r = L[c] * SKY_K + NIGHT_SKY[c] * night; for (let k = 0; k < 9; k++) out[k * 3 + c] += r * Y[k] * w; }
  }
  return out;
}

const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
/** The sun straight overhead's light on the ground: the sun colors below are over its luminance (noon's stays ~1). */
const NOON = lum(transmittance(ATMO.R + 2, 1));
/** The old fixed sky hue's luminance (shading.ts's skyC): the zenith's hue is scaled to it. */
const SKY_HUE_L = 0.598;
/** The day's exposure (ground.ts's DAY_EXPO) and the night's (EV_NIGHT): the eye opens between them as the sky dims. */
const DAY_EXPO = 1.2, EV_NIGHT = 125;
/** How much of the sky's dimming at the end of the day the eye makes up for (0: none, 1: all): a sunset reads as dimmer than noon, not as dark as it is. */
const EYE_DAY = 0.7;
const sv = [0, 0, 0], zv = [0, 0, 1], dv = [0, 0, 0], acc = [0, 0, 0];
/** The sky's light on the ground (a few directions of the dome, the zenith most), seen from 2 m with the sun along s. */
function skyLight(s: number[], mie = 1) {
  const z = skyRadiance(2, zv, s, undefined, mie); acc[0] = z[0] * 0.4; acc[1] = z[1] * 0.4; acc[2] = z[2] * 0.4;
  const e = 0.5, ce = Math.cos(e);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + 0.3; dv[0] = Math.cos(a) * ce; dv[1] = Math.sin(a) * ce; dv[2] = Math.sin(e);
    const r = skyRadiance(2, dv, s, undefined, mie); for (let c = 0; c < 3; c++) acc[c] += r[c] * 0.15;
  }
  return acc;
}
/** Noon's sky light (the sun 60 degrees up): the frame's is over it. */
const NOON_SKY = lum(skyLight([0.5, 0, Math.sin(Math.PI / 3)]));
let lastHue = [0.48, 0.6, 0.92];
/**
 * The frame's air: the sun's color on the ground and at the clouds (over noon's luminance), the sky's light (its hue at
 * luminance SKY_HUE_L, and how bright over noon's), and the day's exposure that follows it (the eye opening at dusk).
 */
/** mie: the haze's (Mie) share over the standard air's, from the humidity (sky.ts). */
export function atmoFrame(sunEl: number, sunA: number, mie = 1) {
  const ce = Math.cos(sunEl);
  sv[0] = Math.cos(sunA) * ce; sv[1] = Math.sin(sunA) * ce; sv[2] = Math.sin(sunEl);
  const sun = transmittance(ATMO.R + 2, sv[2], undefined, mie).map((x) => x / NOON);
  const cloud = transmittance(ATMO.R + CLOUD_MID, sv[2], undefined, mie).map((x) => x / NOON);
  const high = transmittance(ATMO.R + CIRRUS_H, sv[2], undefined, mie).map((x) => x / NOON);
  const z = skyLight(sv, mie), l = lum(z);
  // (the hue alone; past the twilight there is no sky light to take it from, so the last one stays)
  if (l > 1e-9) lastHue = z.map((x) => (x / l) * SKY_HUE_L);
  const skyL = Math.max(1e-5, l / NOON_SKY);
  return { sun, cloud, high, mie, zen: lastHue, skyL, dayEv: Math.min(EV_NIGHT, DAY_EXPO * Math.pow(Math.min(1, skyL), -EYE_DAY)) };
}

const f = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : `${x}`);
const v3 = (c: number[]) => `vec3f(${c.map(f).join(', ')})`;
/** The shader's twin of skyRadiance (and its transmittance), from the same constants. */
export const atmoWGSL = (): string => /* wgsl */ `// ---- (16.1c) the atmosphere (render/atmosphere.ts): Rayleigh, Mie and ozone, single scattering + a cheap multiple
const A_R = ${f(ATMO.R)}; const A_TOP = ${f(ATMO.TOP)};
const A_BR = ${v3(ATMO.BR)}; const A_HR = ${f(ATMO.HR)};
const A_BMS = ${f(ATMO.BMS)}; const A_BMA = ${f(ATMO.BMA)}; const A_HM = ${f(ATMO.HM)}; const A_G = ${f(ATMO.G)};
const A_BO = ${v3(ATMO.BO)}; const A_OH = ${f(ATMO.OH)}; const A_OW = ${f(ATMO.OW)};
const A_MS = ${f(ATMO.MS)}; const A_STEPS = ${ATMO.STEPS}; const CIRRUS_H = ${f(CIRRUS_H)};
fn chapman(r: f32, mu: f32, H: f32) -> f32 {
  let X = A_R / H; let h = (r - A_R) / H; let c = sqrt(X + h);
  if (mu >= 0.0) { return c / (c * mu + 1.0) * exp(-h); }
  let x0 = sqrt(1.0 - mu * mu) * (X + h);
  return 2.0 * sqrt(x0) * exp(min(60.0, X - x0)) - c / (1.0 - c * mu) * exp(-h);
}
fn atmoT(r: f32, mu: f32) -> vec3f {
  let k = r / (A_R + A_OH); let oz = A_OW / sqrt(max(1e-3, 1.0 - k * k * (1.0 - mu * mu))) * select(1.0, 2.0, mu < 0.0);
  return exp(-(A_BR * (chapman(r, mu, A_HR) * A_HR) + vec3f((A_BMS + A_BMA) * u.mie * chapman(r, mu, A_HM) * A_HM) + A_BO * oz));
}
/** The sky's radiance seen from height h0 along v (unit, z up) with the sun along s (unit), relative to the sun's irradiance. */
fn atmo(h0: f32, v: vec3f, s: vec3f) -> vec3f {
  let r0 = A_R + h0; let b = r0 * v.z; let tMax = -b + sqrt(b * b - (r0 * r0 - A_TOP * A_TOP));
  let cs = dot(v, s); let pr = 0.0596831 * (1.0 + cs * cs);
  let g2 = A_G * A_G; let pm = 0.1193662 * (1.0 - g2) * (1.0 + cs * cs) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * A_G * cs, 1.5));
  var tv = vec3f(0.0); var L = vec3f(0.0);
  let N = f32(A_STEPS);
  for (var i = 0; i < A_STEPS; i++) {
    let fi = f32(i); let t = tMax * ((fi + 0.5) / N) * ((fi + 0.5) / N); let dt = tMax * (2.0 * fi + 1.0) / (N * N);
    let p = vec3f(v.xy * t, r0 + v.z * t); let r = length(p); let h = r - A_R;
    let dR = exp(-h / A_HR); let dM = exp(-h / A_HM); let dO = max(0.0, 1.0 - abs(h - A_OH) / A_OW);
    let ext = A_BR * dR + vec3f((A_BMS + A_BMA) * u.mie * dM) + A_BO * dO;
    tv += ext * (dt * 0.5);
    let sc = A_BR * dR; let sm = A_BMS * u.mie * dM;
    L += exp(-tv) * atmoT(r, dot(p, s) / r) * (sc * pr + vec3f(sm * pm) + (sc + vec3f(sm)) * (A_MS * 0.0795775)) * dt;
    tv += ext * (dt * 0.5);
  }
  return L;
}
`;
