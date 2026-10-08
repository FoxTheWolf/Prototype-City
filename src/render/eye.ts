/**
 * The eye as the device screens see it: how bright a screen (a light of its own, of a fixed strength) looks
 * with the eye where it is now, from the world's exposure (the time of day's and the adaptation, see `light`
 * in gpu/shader.ts; the constants are that file's). `k` is 0 by day (the screen looks dim, no bloom), about
 * 0.6 on a lit street at night, and up to 1 in the dark with the eye opened up.
 */
export const EYE = { k: 0.6 };

/** gpu/shader.ts's EV_NIGHT (1 / (DAY_ALBEDO * AMB_N)), AMB_N, DAY_EXPO and NIGHT_ADAPT. */
const EV_NIGHT = 125, AMB_N = 0.004, DAY_EXPO = 0.95, NIGHT_ADAPT = 0.3;

/** After the eye moves: day and cityLit as the world's uniforms have them, adapt the eye's adaptation. */
export function setEye(day: number, cityLit: number, adapt: number) {
  const t = Math.min(1, Math.max(0, day / 0.35)), g = t * t * (3 - 2 * t);
  const amb = AMB_N * (0.02 + 0.98 * Math.pow(Math.min(1, Math.max(0, cityLit)), 1.5));
  const ev = Math.exp((1 - g) * Math.log(EV_NIGHT * Math.pow(amb / AMB_N, -NIGHT_ADAPT)) + g * Math.log(DAY_EXPO)) * adapt;
  // in stops from the lit night's exposure
  const x = Math.log2(ev / EV_NIGHT);
  const s = Math.min(1, Math.max(0, (x + 6) / 6));
  EYE.k = x >= 0 ? Math.min(1, 0.6 + 0.1 * x) : 0.6 * s * s * (3 - 2 * s);
}

/** How much the screen's own content takes the bloom down: the eye adapts to a bright page it looks at (m: its mean light, 0 to 255). */
export const pageDim = (m: number) => 1 / (1 + 3 * Math.min(1, Math.max(0, m / 255)));
