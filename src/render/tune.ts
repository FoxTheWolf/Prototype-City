/**
 * Live knobs, for tuning from the console without a rebuild (`tune.dayExpo = 1.6`; F12 in Electron opens it): read
 * every frame, so a change shows on the next one. The CPU's are read where they act (atmosphere.ts, gpu/world.ts);
 * GPU_KNOBS go to the world's shader as uniforms (`u.tk_<name>`), so changing their values never recompiles it
 * (adding a knob does, once). A value found good is written back into its constant and the knob may go.
 */
export const TUNE = {
  /** The day's exposure at noon (atmosphere.ts): higher, the whole day brighter on the screen. */
  dayExpo: 1.2,
  /** How much of the sky's dimming toward evening the eye makes up for (0 none, 1 all). */
  eyeDay: 0.7,
  /** The eye's comfort band by day (gpu/world.ts): the scene's mean light it leaves alone; under lo it opens up. */
  bandDayLo: 0.1,
  bandDayHi: 0.22,
  /** How far the eye goes to bring a too dark / too bright scene back into the band (0 not at all, 1 all the way). */
  adaptDark: 0.85,
  adaptBright: 0.75,
  /** (GPU) The indirect light (the rays' bounce and the sky) x this: 1 is the physical one. */
  giK: 1.0,
  /** (GPU) The most one GI ray's light may be on the screen (1 = white): lower, fewer sparks, a little less bounce. */
  giRayMax: 2.0,
  /** (GPU) The street objects in the indirect light round them (their AO and the color they bounce): 0 off, 1 as computed. */
  aoK: 1.0,
};
/** The knobs the shader reads (each one a uniform `tk_<name>`, filled from TUNE every frame). */
export const GPU_KNOBS = ['giK', 'giRayMax', 'aoK'] as const;
