import { type RGB } from '../sim/city';

/**
 * A look for the whole screen. `grade` picks the color grading done in the glyph shader;
 * `lamp` is the color street lamps cast on the ground.
 */
export interface Palette {
  name: string;
  grade: number;
  lamp: RGB;
}

export const PALETTES: Palette[] = [
  // sodium-vapor streets: the colors as the raycaster makes them
  { name: 'SODIUM', grade: 0, lamp: [95, 70, 35] },
  // cold desaturated streets, where only the saturated lights stay, pushed toward magenta and cyan
  { name: 'NEON NOIR', grade: 1, lamp: [55, 75, 100] },
  // green phosphor monitor
  { name: 'TERMINAL', grade: 2, lamp: [80, 80, 80] },
];

/** Display switches the player can flip while playing. */
export interface Look {
  palette: number;
  /** Colored background behind every glyph, a dim copy of its color. */
  solid: boolean;
  /** Swap some ASCII glyphs for block and box shapes. */
  blocks: boolean;
}
