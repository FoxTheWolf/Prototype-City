import {  } from '../sim/city';


/** Display switches the player can flip while playing. */
export interface Look {
  /** Colored background behind every glyph, a dim copy of its color: its strength, 0 for none. */
  solid: number;
  /** Swap some ASCII glyphs for block and box shapes. */
  blocks: boolean;
  /**
   * How much the glyphs show (key V): 0 SOFT, the ground, solid objects and walls filled as color
   * blocks with the glyphs faint (the walls darker); 1 SHARP, the ground and objects only; 2 SHARPER,
   * the ground only; 3 SHARPEST, plain glyphs.
   */
  sharp: number;
  /** Far glyphs fade into their blocks in the soft looks, against aliasing (key G). */
  fuse: boolean;
}
