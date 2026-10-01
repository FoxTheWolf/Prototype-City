import { type RGB } from '../sim/city';

/** The street-lamp light on the ground: sodium vapor, the palette chosen in stage 4. */
export const LAMP: RGB = [95, 70, 35];

/** Display switches the player can flip while playing. */
export interface Look {
  /** Colored background behind every glyph, a dim copy of its color: its strength, 0 for none. */
  solid: number;
  /** Swap some ASCII glyphs for block and box shapes. */
  blocks: boolean;
  /**
   * Easier on the eyes (a toggle, to compare): 0 off; 1 the ground and solid objects drawn as color
   * blocks, their glyphs faint; 2 the walls filled denser too.
   */
  soft: number;
}
