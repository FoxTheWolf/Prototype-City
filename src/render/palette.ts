import { type RGB } from '../sim/city';

/** The street-lamp light on the ground: sodium vapor, the palette chosen in stage 4. */
export const LAMP: RGB = [95, 70, 35];

/** Display switches the player can flip while playing. */
export interface Look {
  /** Colored background behind every glyph, a dim copy of its color: its strength, 0 for none. */
  solid: number;
  /** Swap some ASCII glyphs for block and box shapes. */
  blocks: boolean;
}
