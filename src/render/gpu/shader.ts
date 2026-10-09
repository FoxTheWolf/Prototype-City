import { headWGSL } from './wgsl/head';
import { powerWGSL } from './wgsl/power';
import { lampsWGSL } from './wgsl/lamps';
import { roofWGSL } from './wgsl/roof';
import { signsWGSL } from './wgsl/signs';
import { roomsWGSL } from './wgsl/rooms';
import { insideWGSL } from './wgsl/inside';
import { wallWGSL } from './wgsl/wall';
import { burnWGSL } from './wgsl/burn';
import { groundWGSL } from './wgsl/ground';
import { shadingWGSL } from './wgsl/shading';
import { skyWGSL } from './wgsl/sky';
import { sarcophagusWGSL } from './wgsl/sarcophagus';
import { fallWGSL } from './wgsl/fall';
import { occlusionWGSL } from './wgsl/occlusion';
import { mainWGSL } from './wgsl/main';

export { BLD, BLK, FX_DOORS, FX_TAB, IN_LEAVES, LEAF_W, ROOM_REC, SG_BIZ, SG_FONT, SG_STARS, STYLES, TICK_MAX, UNIFORMS } from './wgsl/common';

/**
 * The world's compute shader (stage R): one invocation per cell. The walk through the street grid and
 * the shading port raycaster.ts (renderWorld, wallColumn, roofRows, the ground, lightAt, finish) and
 * keep its numbers, so the two can be compared with J. What is not ported yet is listed in world.ts.
 * Its WGSL is split by subject in gpu/wgsl/ (13.S) and joined here in the order the functions are declared.
 */
export function worldWGSL(): string {
  return [headWGSL, powerWGSL, lampsWGSL, roofWGSL, signsWGSL, roomsWGSL, insideWGSL, wallWGSL, burnWGSL, groundWGSL, shadingWGSL, skyWGSL, sarcophagusWGSL, fallWGSL, occlusionWGSL, mainWGSL].map((w) => w()).join('');
}
