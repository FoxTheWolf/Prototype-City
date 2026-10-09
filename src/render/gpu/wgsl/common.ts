import STARS from '../../stars.json';
/** What the world's shader (gpu/shader.ts) shares with world.ts, which fills its buffers, and its pieces' helpers. */

/** The uniform block, one f32 each, in this order (world.ts fills it by these names). */
export const UNIFORMS = [
  'px', 'py', 'eye', 'dirX', 'dirY', 'plX', 'plY', 'hor',
  'scale', 'cols', 'rows', 'sec', 'day', 'solid', 'sharp', 'fuse',
  'nbx', 'nxb', 'nyb', 'curveR', 'dox', 'doy', 'dex', 'dey',
  'dnx', 'dny', 'dw', 'blocks', 'lox', 'loy', 'dbx', 'dby',
  'sunX', 'sunY', 'sunZ', 'sunEl', 'cloud', 'moonlight', 'cityLit', 'flash',
  'snow', 'wet', 'rain', 'cam3d', 'pitch', 'colW', 'plane', 'adapt',
  'dusk', 'sunA', 'moonA', 'moonEl', 'phase', 'precip', 'driftX', 'driftY',
  'cityW', 'cityH', 'ccx', 'ccy', 'lst', 'tickN', 'yaw', 'fall',
  'fallSnow', 'windX', 'windY', 'fallB', 'fallR', 'fallSpeed', 'fallStreak', 'fallDens',
  'fallPeriod', 'inX0', 'inY0', 'inX1', 'inY1', 'hand', 'eclU', 'eclV',
  'homeLit', 'workLit', 'lightDbg',
] as const;

/** Words of the viewer's floor's block (world.ts) before its street doors' leaves (16..21: the stairwell, see roomWalk). */
export const IN_LEAVES = 22;
/** Floats per door leaf in a plan (world.ts putPlan), and how many open doors fx lists (openDoors). */
export const LEAF_W = 8, FX_DOORS = 64;
/** Words per room in a plan (world.ts putPlan): its box, kind, unit and the next room on the way out. */
export const ROOM_REC = 7;

/** Floats per building in the buildings buffer (see world.ts for the layout). */
export const BLD = 64;
/** The signs' buffer (world.ts, signData): where the font, the stars (four words each: sky.ts) and the businesses start, and the ticker's room. */
export const SG_FONT = 8, SG_STARS = SG_FONT + 256 * 7, SG_BIZ = SG_STARS + STARS.length * 4, TICK_MAX = 4096;
export const BLK = 8;
/** Where the per-building table of facade features starts in the near buffer (world.ts, facades). */
export const FX_TAB = 8;
export const STYLES = ['office', 'glass', 'brick', 'historic', 'residential', 'warehouse', 'crown', 'spire', 'dome', 'tank', 'chimney', 'mech', 'clock', 'mast', 'gasholder'];

export const C = (s: string) => s.charCodeAt(0);
export const v3 = (c: readonly number[]) => `vec3f(${c.map((x) => x.toFixed(1)).join(', ')})`;
export const f = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : `${x}`);
export const G = {
  DOT: C('.'), COM: C(','), TICK: C('`'), COL: C(':'), SEMI: C(';'), DASH: C('-'), EQ: C('='), PLUS: C('+'),
  HASH: C('#'), PCT: C('%'), AT: C('@'), BAR: C('|'), US: C('_'), STAR: C('*'), QUO: C('"'),
  O: C('o'), TILDE: C('~'), LB: C('['), RB: C(']'), SL: C('/'), BS: C('\\'), CARET: C('^'), X: C('x'),
};
/** The fake radius of the earth: things far away sink d^2 / 2R (barely, at the city's scale). */
export const CURVE_R = 400000;
