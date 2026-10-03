import { hash3, mulberry32, type Rng } from '../core/rng';

// 1 world unit = 1 metre.
export const FLOOR_H = 3.5;
/** Sidewalk ring inside every block, measured from the curb. */
export const SIDEWALK = 4;
export const LANE_W = 3.5;
/** Width of one window bay on a facade; the walls of the rooms inside line up with it. */
export const BAY = 1.6;

export type RGB = readonly [number, number, number];

/**
 * How a facade looks, drawn by the renderer. The first six are chosen per lot from the district
 * type; the rest are rooftop parts (tower crowns, spires, domes, water tanks, chimneys, machinery).
 */
export type Facade = 'office' | 'glass' | 'brick' | 'historic' | 'residential' | 'warehouse'
  | 'crown' | 'spire' | 'dome' | 'tank' | 'chimney' | 'mech'
  | 'clock' | 'mast' | 'gasholder';

/**
 * The side of a building cut by the diagonal avenue: the building keeps the part of its box where
 * nx*x + ny*y <= c; (nx, ny) is the unit normal pointing out of that face. u0..u1 is the face's
 * extent along (ny, -nx), which reads left to right for someone looking at it.
 */
export interface Cut {
  nx: number;
  ny: number;
  c: number;
  u0: number;
  u1: number;
}

/**
 * A shape standing on the ground: an axis-aligned box, or with `round` the upright cylinder inscribed
 * in that box. Towers with setbacks, crowns and domes are several nested shapes; parts on a roof
 * also start at the ground, hidden inside the building below them. Next to the diagonal avenue a
 * box can be cut by it (`cut`), which gives wedge-shaped buildings on the sharp corners.
 */
export interface Building {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  h: number;
  round: boolean;
  style: Facade;
  win: RGB;
  frame: RGB;
  lit: number;
  shop: boolean;
  sign: RGB;
  /** The business on the ground floor (index into city.businesses), or -1. */
  biz: number;
  /** Random per lot, for variants within a style (balconies, fire escapes). Shared by all tiers of a tower. */
  feat: number;
  cut: Cut | null;
  /**
   * Floodlights at the foot of the walls washing the facade upward, in this color, up to floodH
   * metres; null when unlit. Sim data, so the power grid can switch them off.
   */
  flood: RGB | null;
  floodH: number;
  /**
   * 1 for the ground volume of a lot, the one with the doors and the floors inside; 2, 3... for the
   * setbacks of a tower above it; 0 for rooftop parts and landmark pieces, which have no inside yet.
   */
  tier: number;
  /** Facade dressing: the top washed in this light at night (towers), a sidewalk shed along the street, a painted ad for this business (or -1). */
  crown: RGB | null;
  shed: boolean;
  ad: number;
  /** A billboard on the roof advertising a business, facing a street; null when there is none. */
  board: Board | null;
  /** Neon tubes along the corners and the roof line, in this color; null when there are none. */
  neon: RGB | null;
  /** Scaffolding up the street faces above the sidewalk shed, to this height (0: none); netting color index + 1 (0: bare). */
  scaffold: number;
  net: number;
  /** Video screens: bit f set for a screen on face f (see faceSpan); a news ticker running around the building. */
  screen: number;
  ticker: boolean;
}

/**
 * A rooftop billboard: the panel's middle at (x, y), facing the street along angle a, w metres
 * wide and h tall, standing on legs from the roof up to z. biz is the business it advertises.
 */
export interface Board {
  biz: number;
  x: number;
  y: number;
  a: number;
  w: number;
  h: number;
  z: number;
}

/**
 * An avenue that runs straight across the grid at a slant, like Broadway: through (ox, oy) along
 * the unit vector (ex, ey). (nx, ny) = (ey, -ex) is its normal; s = (p - o) . n is the signed
 * distance of a point from its center line. The roadway is |s| < w / 2, then a sidewalk.
 */
export interface Diagonal {
  ox: number;
  oy: number;
  ex: number;
  ey: number;
  nx: number;
  ny: number;
  w: number;
}

export const DIAG_W = 21;
/** The diagonal's angle off the avenues, in degrees (fixed: every city has the same one). */
export const DIAG_ANGLE = 24;

export type PropKind = 'lamp' | 'tree' | 'bench' | 'bin' | 'hydrant' | 'mailbox' | 'news' | 'payphone' | 'shelter' | 'dumpster' | 'debris' | 'blade' | 'table' | 'planter' | 'steps';

/**
 * What a business does. Kept as data the rest of the game builds on: the shop sign shows its name
 * now; interiors (stage 7) and the economy (stage 13) will hang their own data on the same record.
 */
export type BusinessKind = 'diner' | 'bar' | 'cafe' | 'pharmacy' | 'grocery' | 'laundry' | 'pawn' | 'electronics'
  | 'liquor' | 'hotel' | 'bank' | 'cinema' | 'books' | 'tailor' | 'autoparts' | 'parking';

export interface Business {
  kind: BusinessKind;
  /** The building it occupies. */
  building: number;
  /** Picks the name; the words live in the locale, like the other names. */
  name: number;
}

/** Which businesses open on the ground floor, by district. */
const SHOPS: Record<DistrictType, BusinessKind[]> = {
  financial: ['bank', 'cafe', 'electronics', 'diner', 'pharmacy', 'bar', 'parking'],
  commercial: ['diner', 'bar', 'electronics', 'pawn', 'cinema', 'hotel', 'pharmacy', 'liquor', 'cafe', 'parking'],
  residential: ['grocery', 'laundry', 'liquor', 'pharmacy', 'diner', 'bar'],
  historic: ['cafe', 'bar', 'books', 'tailor', 'hotel', 'diner'],
  industrial: ['autoparts', 'diner', 'bar', 'liquor'],
  theater: ['cinema', 'hotel', 'bar', 'diner', 'electronics', 'cinema', 'hotel', 'cafe', 'pharmacy', 'parking'],
};

export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  w: number;
  z1: number;
  seed: number;
  /** Facing in radians; a lamp's arm points this way, over the street. */
  a: number;
  /** For street lamps: the kind of lamp in the head. */
  lampType?: LampType;
}

/**
 * Chance that a business hangs a blade sign (a vertical sign sticking out of the facade, for the
 * street to see) next to its shop sign.
 */
const BLADE: Partial<Record<BusinessKind, number>> = {
  hotel: 1, cinema: 1, parking: 1, bar: 0.6, pawn: 0.6, liquor: 0.4, cafe: 0.4, diner: 0.4, pharmacy: 0.3,
};
/**
 * A blade sign's panel starts this high and has one letter every BLADE_LETTER metres; hotels and
 * cinemas on tall enough buildings hang a tall one instead, BLADE_TALL metres a letter, over several floors.
 */
export const BLADE_Z = 3.8, BLADE_LETTER = 0.75, BLADE_TALL = 1.5;

/**
 * Street-lamp technology around 2008 in an American city: high-pressure sodium (amber) almost
 * everywhere, metal halide (white) downtown and on commercial strips, old mercury vapor (bluish
 * green, being phased out) in older neighborhoods, low-pressure sodium (deep yellow) in industry,
 * and the first pilot LED lamps downtown.
 */
export type LampType = 'hps' | 'mh' | 'mv' | 'lps' | 'led';

const LAMPS: Record<DistrictType, [LampType, number][]> = {
  financial: [['mh', 0.7], ['led', 0.1], ['hps', 0.2]],
  commercial: [['hps', 0.5], ['mh', 0.45], ['led', 0.05]],
  historic: [['hps', 0.6], ['mv', 0.3], ['mh', 0.1]],
  residential: [['hps', 0.75], ['mv', 0.25]],
  industrial: [['hps', 0.55], ['lps', 0.35], ['mv', 0.1]],
  theater: [['mh', 0.8], ['led', 0.2]],
};

/** The theater district is one per city, the commercial district nearest downtown: all neon, screens and tickers. */
export type DistrictType = 'financial' | 'commercial' | 'residential' | 'historic' | 'industrial' | 'theater';

/** A named part of the city. Its blocks are the ones closer to (x, y) than to any other district's point. */
export interface District {
  type: DistrictType;
  x: number;
  y: number;
  /** Random number the name formatter uses to choose a name pattern. */
  pick: number;
}

/** A block without buildings: a park with trees, a paved plaza or an industrial rail yard. */
export type OpenKind = 'park' | 'plaza' | 'yard';

/** How each district type shapes its blocks. */
/** Street furniture by district: relative weights of what stands on the sidewalk. */
const FURNITURE: Record<DistrictType, [PropKind, number][]> = {
  financial: [['bin', 3], ['news', 3], ['payphone', 2], ['mailbox', 2], ['bench', 1], ['shelter', 1]],
  commercial: [['bin', 3], ['news', 2], ['payphone', 2], ['bench', 2], ['mailbox', 1], ['shelter', 1]],
  residential: [['bin', 2], ['bench', 1], ['mailbox', 1], ['payphone', 1], ['dumpster', 1]],
  historic: [['bench', 3], ['bin', 2], ['payphone', 1], ['mailbox', 1]],
  industrial: [['dumpster', 2], ['bin', 1]],
  theater: [['news', 3], ['bin', 3], ['payphone', 2], ['bench', 1], ['mailbox', 1]],
};

const KIND: Record<DistrictType, { base: number; tall: number; cap: number; lot: number; lotCore: number; open: OpenKind; openP: number; empty: number; shop: number }> = {
  //            floors at the edge, x downtown growth, max floors, lot size (+ downtown), open block kind and chance, empty lot/shop chance
  financial: { base: 3, tall: 1, cap: 999, lot: 14, lotCore: 36, open: 'plaza', openP: 0.03, empty: 0.04, shop: 0.6 },
  commercial: { base: 3, tall: 0.7, cap: 30, lot: 14, lotCore: 20, open: 'plaza', openP: 0.03, empty: 0.06, shop: 0.8 },
  residential: { base: 3, tall: 0.5, cap: 14, lot: 12, lotCore: 10, open: 'park', openP: 0.08, empty: 0.05, shop: 0.12 },
  historic: { base: 4, tall: 0.3, cap: 9, lot: 10, lotCore: 8, open: 'park', openP: 0.07, empty: 0.02, shop: 0.5 },
  industrial: { base: 1.5, tall: 0.1, cap: 4, lot: 30, lotCore: 20, open: 'yard', openP: 0.12, empty: 0.15, shop: 0.04 },
  theater: { base: 5, tall: 0.8, cap: 45, lot: 14, lotCore: 18, open: 'plaza', openP: 0.02, empty: 0.02, shop: 0.95 },
};

/**
 * A crack in the burning coal seam outside the city, where smoke and gas come out. (x, y) is
 * outside the city; r is the width of the smoke column at its base and h how high it rises.
 */
export interface Vent {
  x: number;
  y: number;
  r: number;
  h: number;
}

/**
 * The Sarcophagus: a colossal containment dome, never finished, over the main crater of the fire,
 * some 5 km past the fence on one side. A shallow cap of radius r and height h centered at (x, y);
 * beside it, joined to it, a squat draft tower (center tx, ty, radius tr, height th) meant to turn
 * the fire's heat into power. Work stopped (bankruptcy or graft, for the story to tell); its cranes
 * still stand on top, and its telemetry and sensors are still live.
 */
export interface Sarcophagus {
  x: number;
  y: number;
  r: number;
  h: number;
  tx: number;
  ty: number;
  tr: number;
  th: number;
  /** Tower cranes standing on the dome: position and height of the mast top. */
  cranes: { x: number; y: number; z: number; a: number }[];
}

/** Outside the city the ground burns; this far past the fence it starts to crack and glow. */
export const BURN_START = 40;

export type LandmarkKind = 'tower' | 'hall' | 'memorial' | 'power' | 'park' | 'clock' | 'church' | 'mast' | 'gasworks';

/**
 * Landmarks the generator can place. Every city draws its own set: each entry is tried up to
 * `max` times (the first with `chance`, the next ones with half of it), on random blocks of the
 * listed district types. The tallest tower is not here; it is whatever building ends up tallest.
 */
const LIBRARY: { kind: LandmarkKind; where: DistrictType[]; chance: number; max: number }[] = [
  { kind: 'hall', where: ['historic'], chance: 1, max: 1 },
  { kind: 'memorial', where: ['financial', 'commercial'], chance: 0.8, max: 1 },
  { kind: 'power', where: ['industrial'], chance: 0.9, max: 1 },
  { kind: 'park', where: ['residential', 'historic'], chance: 0.9, max: 2 },
  { kind: 'clock', where: ['historic', 'commercial'], chance: 0.7, max: 2 },
  { kind: 'church', where: ['historic', 'residential'], chance: 0.8, max: 3 },
  { kind: 'mast', where: ['industrial', 'residential'], chance: 0.6, max: 1 },
  { kind: 'gasworks', where: ['industrial'], chance: 0.7, max: 2 },
];

/** A named place people navigate by. (x, y) is its middle. */
export interface Landmark {
  kind: LandmarkKind;
  x: number;
  y: number;
}

/** Map sectors per side (the city is split into sectors x sectors squares for map codes like "C3"). */
const SECTORS = 4;
/** Rough side of a district in metres. */
const DISTRICT_SIZE = 400;

export interface Block {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  district: number;
  /** Set when the block has no buildings. */
  open: OpenKind | null;
  /** This block's buildings are city.buildings[b0 .. b1). */
  b0: number;
  b1: number;
  /** Tallest building, so the renderer can skip blocks hidden behind nearer ones. */
  maxH: number;
  props: Prop[];
  /**
   * The diagonal avenue and this block: bit 1 when it crosses the block, bit 2 / bit 4 when the
   * piece left on its negative / positive side is too small for buildings and is a plaza.
   */
  diag: number;
  /** Next to the theater district's X (its "Times Square"): its slivers are the square's plazas. */
  square: boolean;
}

/**
 * The street grid is a list of boundaries per axis. Cell c spans [xb[c], xb[c+1]]:
 * even cells are roads, odd cells are blocks. The city starts and ends with a road.
 */
/** A lot left without a building, inside the sidewalks of its block. */
export interface EmptyLot { x0: number; y0: number; x1: number; y1: number; block: number }

export interface City {
  businesses: Business[];
  /** Every street lamp, in a fixed order: the index is the lamp's identity (for its failures now, the power grid later). */
  lamps: Prop[];
  w: number;
  h: number;
  xb: number[];
  yb: number[];
  /** Cell index for every whole metre, so a point lookup is one array read. */
  xCell: Uint16Array;
  yCell: Uint16Array;
  /** Blocks per row and per column. Block (i, j) is blocks[j * nbx + i]. */
  nbx: number;
  nby: number;
  blocks: Block[];
  buildings: Building[];
  /** The empty lots (rubble), where the power grid puts its substations. */
  empties: EmptyLot[];
  /** Middle of downtown, where the towers are. */
  cx: number;
  cy: number;
  districts: District[];
  landmarks: Landmark[];
  /** The burning seam around the city: smoke vents, and floodlight towers on the cordon fence (which runs along the city edge). */
  vents: Vent[];
  floodlights: { x: number; y: number }[];
  sarcophagus: Sarcophagus;
  diagonal: Diagonal;
  sectors: number;
  /** Chooses the words of every place name (see locale/names.ts). */
  nameSeed: number;
}

/**
 * Districts on a jittered grid. Downtown is financial, the ring around it commercial with one or
 * two historic districts, the outskirts residential, except for an industrial wedge on one side.
 */
function placeDistricts(rng: Rng, w: number, h: number, cx: number, cy: number, radius: number): District[] {
  const nx = Math.max(1, Math.round(w / DISTRICT_SIZE)), ny = Math.max(1, Math.round(h / DISTRICT_SIZE));
  const pts: { x: number; y: number; core: number }[] = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = ((i + 0.2 + rng() * 0.6) * w) / nx, y = ((j + 0.2 + rng() * 0.6) * h) / ny;
    pts.push({ x, y, core: coreAt(x, y, cx, cy, radius) });
  }
  const types: DistrictType[] = pts.map((p) => (p.core > 0.5 ? 'financial' : p.core > 0.12 ? 'commercial' : 'residential'));
  let center = 0;
  pts.forEach((p, k) => { if (p.core > pts[center].core) center = k; });
  types[center] = 'financial';
  const ring = types.map((t, k) => (t === 'commercial' ? k : -1)).filter((k) => k >= 0);
  for (let n = rng() < 0.5 ? 2 : 1; n > 0 && ring.length; n--) types[ring.splice((rng() * ring.length) | 0, 1)[0]] = 'historic';
  // the commercial district nearest downtown is the theater district
  let theater = -1;
  types.forEach((t, k) => { if (t === 'commercial' && (theater < 0 || pts[k].core > pts[theater].core)) theater = k; });
  if (theater >= 0) types[theater] = 'theater';
  const wedge = rng() * 2 * Math.PI;
  pts.forEach((p, k) => {
    const da = Math.abs(((Math.atan2(p.y - cy, p.x - cx) - wedge + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    if (types[k] === 'residential' && da < 0.7) types[k] = 'industrial';
  });
  return pts.map((p, k) => ({ type: types[k], x: p.x, y: p.y, pick: (rng() * 1e9) | 0 }));
}

/** Index of the district whose point is nearest to (x, y). */
function nearestDistrict(districts: District[], x: number, y: number): number {
  let best = 0;
  districts.forEach((d, k) => { if (Math.hypot(d.x - x, d.y - y) < Math.hypot(districts[best].x - x, districts[best].y - y)) best = k; });
  return best;
}

/**
 * Blocks that hold a landmark, by block index, drawn from LIBRARY. Landmarks never touch each
 * other (not even diagonally), except a big park, which takes a second block to its east ('park2').
 */
function pickLandmarkBlocks(seed: number, xb: number[], yb: number[], nbx: number, nby: number, districts: District[], diag: Diagonal) {
  const rng = mulberry32((hash3(seed, 5555, 2) * 4294967296) | 0);
  const out = new Map<number, LandmarkKind | 'park2'>();
  const type: DistrictType[] = [];
  for (let j = 0; j < nby; j++) for (let i = 0; i < nbx; i++) {
    type.push(districts[nearestDistrict(districts, (xb[2 * i + 1] + xb[2 * i + 2]) / 2, (yb[2 * j + 1] + yb[2 * j + 2]) / 2)].type);
  }
  const free = (k: number) => {
    const i = k % nbx, j = (k / nbx) | 0;
    if (diagRange(diag, xb[2 * i + 1], yb[2 * j + 1], xb[2 * i + 2], yb[2 * j + 2]).touches) return false;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj;
      if (ii >= 0 && jj >= 0 && ii < nbx && jj < nby && out.has(jj * nbx + ii)) return false;
    }
    return true;
  };
  for (const e of LIBRARY) {
    for (let n = 0; n < e.max; n++) {
      if (rng() >= (n === 0 ? e.chance : e.chance / 2)) break;
      const options = type.map((t, k) => (e.where.includes(t) && free(k) ? k : -1)).filter((k) => k >= 0);
      if (!options.length) break;
      const k = options[(rng() * options.length) | 0];
      out.set(k, e.kind);
      if (e.kind === 'park' && k % nbx < nbx - 1 && free(k + 1)) out.set(k + 1, 'park2');
    }
  }
  return out;
}

/**
 * The diagonal avenue, the same in every city: DIAG_ANGLE off the avenues, through the center of
 * the avenue intersection nearest (px, py) (the theater district's point), so the X it makes with
 * that avenue is centered on a cross street, like Times Square. The grid and districts stay the same.
 */
function placeDiagonal(xb: number[], yb: number[], px: number, py: number): Diagonal {
  const a = (DIAG_ANGLE * Math.PI) / 180, ex = Math.sin(a), ey = Math.cos(a);
  let ox = 0, oy = 0, bd = Infinity;
  for (let i = 1; i < xb.length / 2 - 1; i++) for (let j = 1; j < yb.length / 2 - 1; j++) {
    const x = roadCenter(xb, i), y = roadCenter(yb, j), d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bd) { bd = d; ox = x; oy = y; }
  }
  return { ox, oy, ex, ey, nx: ey, ny: -ex, w: DIAG_W };
}

/** Signed distance of a point from the diagonal's center line. */
export function diagS(d: Diagonal, x: number, y: number): number {
  return (x - d.ox) * d.nx + (y - d.oy) * d.ny;
}

/** Range of s over a box, and whether the avenue with its sidewalks reaches into it. */
function diagRange(d: Diagonal, x0: number, y0: number, x1: number, y1: number) {
  const a = diagS(d, x0, y0), b = diagS(d, x1, y0), c = diagS(d, x0, y1), e = diagS(d, x1, y1);
  const lo = Math.min(a, b, c, e), hi = Math.max(a, b, c, e), R = d.w / 2 + SIDEWALK;
  return { lo, hi, touches: lo < R && hi > -R };
}

/** Area of the box x0..y1 where nx*x + ny*y <= c (the box clipped by a half-plane). */
function clippedArea(x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, c: number) {
  const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], out: number[][] = [];
  for (let k = 0; k < 4; k++) {
    const P = pts[k], Q = pts[(k + 1) % 4], fp = nx * P[0] + ny * P[1] - c, fq = nx * Q[0] + ny * Q[1] - c;
    if (fp <= 0) out.push(P);
    if ((fp < 0) !== (fq < 0) && fp !== fq) { const t = fp / (fp - fq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); }
  }
  let a = 0;
  for (let k = 0; k < out.length; k++) { const P = out[k], Q = out[(k + 1) % out.length]; a += P[0] * Q[1] - Q[0] * P[1]; }
  return Math.abs(a) / 2;
}

/** The cut of box x0..y1 by the half-plane nx*x + ny*y <= c, with the extent of the cut face. */
function makeCut(x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, c: number): Cut {
  // points on the face line are (nx, ny) * c + (ny, -nx) * u; keep the u inside the box
  let u0 = -1e9, u1 = 1e9;
  const clamp = (base: number, k: number, lo: number, hi: number) => {
    if (Math.abs(k) < 1e-9) return;
    const a = (lo - base) / k, b = (hi - base) / k;
    u0 = Math.max(u0, Math.min(a, b)); u1 = Math.min(u1, Math.max(a, b));
  };
  clamp(nx * c, ny, x0, x1);
  clamp(ny * c, -nx, y0, y1);
  return { nx, ny, c, u0, u1 };
}

const SPAN = new Float64Array(2);
/**
 * Extent of one face of a box building along the face, in SPAN: face 0 / 1 are the x0 / x1 sides
 * (measured along y), 2 / 3 the y0 / y1 sides (along x), 4 the cut face (along its u).
 */
export function faceSpan(B: Building, face: number): Float64Array {
  const C = B.cut;
  if (face === 4) { SPAN[0] = C!.u0; SPAN[1] = C!.u1; return SPAN; }
  const alongY = face < 2, at = face === 0 ? B.x0 : face === 1 ? B.x1 : face === 2 ? B.y0 : B.y1;
  let lo = alongY ? B.y0 : B.x0, hi = alongY ? B.y1 : B.x1;
  if (C) {
    // on this side nx*x + ny*y <= c leaves: k * along <= c - (the fixed coordinate's term)
    const k = alongY ? C.ny : C.nx, rest = C.c - (alongY ? C.nx : C.ny) * at;
    if (Math.abs(k) < 1e-9) { if (rest < 0) hi = lo; }
    else if (k > 0) hi = Math.min(hi, rest / k);
    else lo = Math.max(lo, rest / k);
  }
  SPAN[0] = lo; SPAN[1] = hi;
  return SPAN;
}

/**
 * Cut the buildings of one block, buildings[from..], by the diagonal: parts on its roadway and
 * sidewalk go, a box across its edge is cut (or split in two when it spans the whole avenue),
 * cylinders that reach it go, and so does whatever is left too small to stand.
 */
function cutByDiagonal(buildings: Building[], from: number, d: Diagonal) {
  const R = d.w / 2 + SIDEWALK, o = d.ox * d.nx + d.oy * d.ny, kept: Building[] = [];
  for (const B of buildings.splice(from)) {
    if (B.round) {
      const r = (B.x1 - B.x0) / 2;
      if (Math.abs(diagS(d, B.x0 + r, B.y0 + r)) >= R + r) kept.push(B);
      continue;
    }
    const { lo, hi } = diagRange(d, B.x0, B.y0, B.x1, B.y1);
    if (lo >= R || hi <= -R) { kept.push(B); continue; }
    let first = true;
    // the side where s >= R keeps -n.p <= -(R + o), the side where s <= -R keeps n.p <= o - R
    for (const [nx, ny, c, has] of [[-d.nx, -d.ny, -(R + o), hi > R], [d.nx, d.ny, o - R, lo < -R]] as const) {
      if (!has || clippedArea(B.x0, B.y0, B.x1, B.y1, nx, ny, c) < 40) continue;
      kept.push({ ...B, cut: makeCut(B.x0, B.y0, B.x1, B.y1, nx, ny, c), shop: B.shop && first });
      first = false;
    }
  }
  buildings.push(...kept);
}

/** 1 downtown, ~0 at the edges of the city. */
function coreAt(x: number, y: number, cx: number, cy: number, radius: number) {
  return Math.exp(-((Math.hypot(x - cx, y - cy) / radius / 0.35) ** 2));
}

/** Colors a tower's top is washed in at night: warm white, gold, red, blue, violet, green. */
/** Neon tube colors: pink, cyan, violet, green, red, amber. */
const NEON: RGB[] = [[255, 70, 170], [60, 230, 255], [170, 90, 255], [90, 255, 140], [255, 60, 60], [255, 170, 50]];

const CROWNS: RGB[] = [[255, 235, 190], [255, 190, 80], [255, 70, 60], [80, 140, 255], [190, 100, 255], [90, 230, 170]];

// offices: mostly fluorescent tubes (cool white ~4100 K with its green, daylight ~6500 K), some behind tinted glass
// (cyan, blue, green), a few warm (halogen, a manager's desk lamp) (L.2)
const WIN: RGB[] = [[255, 206, 110], [120, 220, 255], [90, 150, 255], [225, 245, 230], [190, 255, 170], [215, 230, 255], [255, 240, 200]];
const WARM: RGB[] = [[255, 206, 110], [255, 170, 90], [255, 240, 200], [150, 190, 255]];
// (A.2) more color in the near-grey palettes, at about the same brightness: bronze, steel blue, red granite, green, concrete
const FRAME: RGB[] = [[100, 74, 46], [52, 66, 100], [96, 58, 52], [46, 72, 64], [96, 88, 74]];

/** Per style: wall colors, window colors, share of lit windows [min, max]. */
const LOOK: Partial<Record<Facade, { frame: RGB[]; win: RGB[]; lit: [number, number] }>> = {
  office: { frame: FRAME, win: WIN, lit: [0.18, 0.68] },
  glass: { frame: [[40, 90, 120], [30, 105, 100], [50, 70, 130], [85, 60, 115], [30, 85, 70], [110, 95, 60]], win: WIN, lit: [0.15, 0.55] },
  brick: { frame: [[120, 52, 38], [100, 60, 45], [130, 72, 50], [85, 45, 40], [110, 80, 60]], win: WARM, lit: [0.2, 0.55] },
  // limestone, sandstone, pale stone, brownstone, buff
  historic: { frame: [[140, 125, 100], [150, 125, 85], [150, 130, 110], [112, 70, 52], [130, 100, 80]], win: WARM, lit: [0.15, 0.45] },
  // painted walls: terracotta, cream, sage, dusty blue, mustard, salmon
  residential: { frame: [[140, 85, 62], [150, 138, 112], [96, 118, 92], [86, 100, 132], [150, 118, 62], [148, 96, 88]], win: WARM, lit: [0.2, 0.6] },
  warehouse: { frame: [[80, 85, 90], [95, 80, 65], [70, 78, 72], [100, 70, 55]], win: [[200, 220, 180], [255, 200, 120]], lit: [0.05, 0.25] },
};

const FLOOD_WARM: RGB = [150, 115, 70];
/** Floodlight colors for towers: cool white, and the odd colored one. */
const FLOOD_TOWER: RGB[] = [[110, 120, 140], [110, 120, 140], [70, 90, 170], [120, 70, 150], [60, 130, 130]];

/**
 * Whether a building on this lot is floodlit, and in what color: some old facades in warm light,
 * some downtown towers in cool white or a color. From the lot position, like its business.
 */
function floodFor(seed: number, type: DistrictType, facade: Facade, floors: number, x: number, y: number): RGB | null {
  const h = hash3(seed ^ 0x0f100d, x | 0, y | 0);
  if (facade === 'historic') return h < (type === 'historic' ? 0.3 : 0.15) ? FLOOD_WARM : null;
  if (type === 'financial' && (facade === 'glass' || facade === 'office') && floors > 12 && h < 0.18) return FLOOD_TOWER[Math.floor((h / 0.18) * FLOOD_TOWER.length)];
  return null;
}

/** Facade styles per district type, as [style, weight]. */
const MIX: Record<DistrictType, [Facade, number][]> = {
  financial: [['glass', 45], ['office', 40], ['historic', 15]],
  commercial: [['office', 40], ['brick', 25], ['glass', 15], ['residential', 20]],
  residential: [['residential', 55], ['brick', 45]],
  historic: [['historic', 65], ['brick', 35]],
  industrial: [['warehouse', 75], ['brick', 25]],
  theater: [['office', 45], ['historic', 20], ['glass', 20], ['brick', 15]],
};

function pickStyle(r: number, mix: [Facade, number][]): Facade {
  let total = 0;
  for (const [, w] of mix) total += w;
  r *= total;
  for (const [s, w] of mix) { if (r < w) return s; r -= w; }
  return mix[0][0];
}

/** Road/block boundaries along one axis: a wide road every `wideEvery` roads, blocks of random length between. */
function layoutAxis(rng: Rng, size: number, blockMin: number, blockMax: number, road: number, wide: number, wideEvery: number): number[] {
  const b = [0, wide];
  let x = wide;
  for (let k = 1; ; k++) {
    const blk = blockMin + Math.round(rng() * (blockMax - blockMin));
    const w = k % wideEvery === 0 ? wide : road;
    if (x + blk + w > size) break;
    b.push(x + blk, x + blk + w);
    x += blk + w;
  }
  return b;
}

function cellTable(b: number[]): Uint16Array {
  const t = new Uint16Array(b[b.length - 1]);
  for (let c = 0; c < b.length - 1; c++) t.fill(c, b[c], b[c + 1]);
  return t;
}

/** Number of lanes in each direction of road k (the road is the even cell 2k). */
export function lanesOf(b: number[], k: number): number {
  return Math.floor((b[2 * k + 1] - b[2 * k]) / 2 / LANE_W);
}

export function roadCenter(b: number[], k: number): number {
  return (b[2 * k] + b[2 * k + 1]) / 2;
}

/**
 * American grid city of about size x size metres: avenues run north-south, streets east-west,
 * towers downtown and low houses at the edges. Every block draws from its own seed, taken from
 * the city seed and its position, so a building is the same whatever else changes.
 */
export function generateCity(seed: number, size: number): City {
  const rng = mulberry32(seed);
  const xb = layoutAxis(rng, size, 150, 200, 21, 28, 4);
  const yb = layoutAxis(rng, size, 60, 80, 14, 21, 5);
  const w = xb[xb.length - 1], h = yb[yb.length - 1];
  const nbx = (xb.length - 2) / 2, nby = (yb.length - 2) / 2;
  const cx = w * (0.4 + rng() * 0.2), cy = h * (0.4 + rng() * 0.2);
  const radius = Math.min(w, h) / 2;
  const districts = placeDistricts(rng, w, h, cx, cy, radius);
  const nameSeed = (rng() * 1e9) | 0;
  const blocks: Block[] = [];
  const buildings: Building[] = [];
  const empties: EmptyLot[] = [];
  const businesses: Business[] = [];
  const theater = districts.find((d) => d.type === 'theater');
  const diagonal = placeDiagonal(xb, yb, theater ? theater.x : cx, theater ? theater.y : cy);
  const special = pickLandmarkBlocks(seed, xb, yb, nbx, nby, districts, diagonal);

  for (let j = 0; j < nby; j++) for (let i = 0; i < nbx; i++) {
    const br = mulberry32((hash3(seed, i, j) * 4294967296) | 0);
    // furniture has its own generator, so adding or changing it never moves the buildings
    const fr = mulberry32((hash3(seed ^ 0x2c1b3c6d, i, j) * 4294967296) | 0);
    const pick = <T>(a: T[]) => a[(br() * a.length) | 0];
    const x0 = xb[2 * i + 1], x1 = xb[2 * i + 2], y0 = yb[2 * j + 1], y1 = yb[2 * j + 2];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const core = coreAt(mx, my, cx, cy, radius);
    const district = nearestDistrict(districts, mx, my);
    const K = KIND[districts[district].type];
    const lm = special.get(j * nbx + i);
    const LM_OPEN: Record<string, OpenKind | null> = { memorial: 'plaza', hall: 'plaza', clock: 'plaza', mast: 'plaza', park: 'park', park2: 'park', church: 'park', gasworks: 'yard', power: null };
    const open = lm ? LM_OPEN[lm] : br() < K.openP ? K.open : null;
    const block: Block = { x0, y0, x1, y1, district, open, b0: buildings.length, b1: 0, maxH: 0, props: [], diag: 0, square: false };
    blocks.push(block);

    // street lamps along the curb, about every 28 m
    const L = 0.8;
    const corners = [[x0 + L, y0 + L], [x1 - L, y0 + L], [x1 - L, y1 - L], [x0 + L, y1 - L]];
    for (let e = 0; e < 4; e++) {
      const [ax, ay] = corners[e], [bx, by] = corners[(e + 1) % 4], a = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][e];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 28));
      // one lamp type per side of the block, the way a street gets relamped
      let roll = hash3(seed ^ 0x1a3b5c, i * 4 + e, j), lampType: LampType = 'hps';
      for (const [t, w] of LAMPS[districts[district].type]) { if ((roll -= w) < 0) { lampType = t; break; } }
      // in the middle of each stretch: the corners are the traffic lights' and the stop signs'
      for (let k = 0; k < n; k++) block.props.push({ kind: 'lamp', x: ax + ((bx - ax) * (k + 0.5)) / n, y: ay + ((by - ay) * (k + 0.5)) / n, w: 0.3, z1: 6.5, seed: 0, a, lampType });
    }

    const ix0 = x0 + SIDEWALK, iy0 = y0 + SIDEWALK, ix1 = x1 - SIDEWALK, iy1 = y1 - SIDEWALK;
    const tree = (x: number, y: number) => block.props.push({ kind: 'tree', x, y, w: 3.5 + br() * 2, z1: 5 + br() * 4, seed: (br() * 1e6) | 0, a: 0 });

    // split the block into lots; downtown lots are bigger, for towers
    const maxLot = K.lot + K.lotCore * core;
    const lot = (ax0: number, ay0: number, ax1: number, ay1: number) => {
      const lw = ax1 - ax0, lh = ay1 - ay0;
      if (Math.max(lw, lh) > maxLot) {
        const t = 0.35 + br() * 0.3;
        if (lw >= lh) { const s = Math.round(ax0 + lw * t); lot(ax0, ay0, s, ay1); lot(s, ay0, ax1, ay1); }
        else { const s = Math.round(ay0 + lh * t); lot(ax0, ay0, ax1, s); lot(ax0, s, ax1, ay1); }
        return;
      }
      if (br() < K.empty) {
        // empty lot: rubble piles (the power grid may fence one in for a substation)
        empties.push({ x0: ax0, y0: ay0, x1: ax1, y1: ay1, block: blocks.length - 1 });
        for (let n = 1 + ((fr() * 3) | 0); n > 0; n--) {
          block.props.push({ kind: 'debris', x: ax0 + 1.5 + fr() * Math.max(0, lw - 3), y: ay0 + 1.5 + fr() * Math.max(0, lh - 3), w: 0, z1: 0, seed: (fr() * 1e6) | 0, a: fr() * 6.28 });
        }
        return;
      }
      let floors = Math.max(1, Math.round((K.base + 55 * K.tall * core ** 1.5) * (0.35 + br() * 0.9)));
      if (br() < 0.05) floors = Math.round(floors * 1.5);
      floors = Math.min(floors, K.cap);
      const facade = pickStyle(br(), MIX[districts[district].type]), look = LOOK[facade]!;
      const style = {
        style: facade, win: pick(look.win), frame: pick(look.frame), lit: look.lit[0] + br() * (look.lit[1] - look.lit[0]),
        shop: facade !== 'warehouse' && br() < K.shop, sign: pick(WIN), feat: br(), biz: -1,
      };
      // warehouses have one or two tall open floors
      if (facade === 'warehouse') floors = Math.min(floors, 2);
      // towers stand back from the lot edge and step in as they rise
      let inset = floors > 25 && Math.min(lw, lh) > 20 ? 2 + br() * 3 : 0;
      const tiers = floors > 30 ? 1 + ((br() * 3) | 0) : 1;
      let top: Building | null = null;
      const fl = floodFor(seed, districts[district].type, facade, floors, ax0, ay0);
      for (let k = 1; k <= tiers; k++) {
        if (Math.min(lw, lh) - 2 * inset < 8) break;
        const f = k === tiers ? floors : Math.round(floors * (0.3 + (0.6 * k) / tiers) * (0.8 + br() * 0.2));
        const bh = f * (facade === 'warehouse' ? 5 : FLOOR_H) + 1;
        top = { x0: ax0 + inset, y0: ay0 + inset, x1: ax1 - inset, y1: ay1 - inset, h: bh, round: false, ...style, shop: style.shop && k === 1, cut: null, flood: null, floodH: 0, tier: k, crown: null, shed: false, ad: -1, board: null, neon: null, scaffold: 0, net: 0, screen: 0, ticker: false };
        if (k === 1 && fl) { const u = hash3(seed, ax0 | 0, ay0 | 0); top.flood = fl; top.floodH = Math.min(bh, fl === FLOOD_WARM ? 14 + u * 30 : 30 + u * 60); }
        buildings.push(top);
        block.maxH = Math.max(block.maxH, bh);
        inset += 3 + br() * 3;
      }
      if (top) roof(top, floors);
    };

    /** A rooftop shape centered at (x, y) with half-size (or radius) s, reaching height h. */
    const part = (x: number, y: number, s: number, h: number, style: Facade, round: boolean, frame: RGB, win: RGB) => {
      buildings.push({ x0: x - s, y0: y - s, x1: x + s, y1: y + s, h, round, style, win, frame, lit: 0, shop: false, sign: win, feat: br(), biz: -1, cut: null, flood: null, floodH: 0, tier: 0, crown: null, shed: false, ad: -1, board: null, neon: null, scaffold: 0, net: 0, screen: 0, ticker: false });
      block.maxH = Math.max(block.maxH, h);
    };
    /** Drum with windows, then a dome of stacked rings and a small lantern on top. */
    const dome = (x: number, y: number, R: number, base: number, frame: RGB, win: RGB) => {
      part(x, y, R, base, 'historic', true, frame, win);
      const n = 5;
      for (let k = 1; k <= n; k++) part(x, y, R * Math.cos(((k - 1) / n) * Math.PI / 2), base + R * Math.sin((k / n) * Math.PI / 2), 'dome', true, [70, 140, 120], [255, 220, 150]);
      part(x, y, Math.max(0.8, R * 0.15), base + R + 3, 'dome', true, [70, 140, 120], [255, 220, 150]);
    };
    // what stands on a roof depends on the building: crowns and spires on towers, domes on old
    // civic buildings, water tanks on walk-ups, chimneys in the industrial areas, machinery on offices
    const roof = (B: Building, floors: number) => {
      const w = B.x1 - B.x0, d = B.y1 - B.y0, m = Math.min(w, d), mx = (B.x0 + B.x1) / 2, my = (B.y0 + B.y1) / 2;
      const r = br();
      if ((B.style === 'office' || B.style === 'historic') && floors > 28 && r < 0.7) {
        // art deco crown: narrowing steps with lit ribs, then a spire with a red beacon
        let s = m / 2, z = B.h;
        for (let k = 2 + ((br() * 3) | 0); k > 0 && s * 0.72 >= 2; k--) { s *= 0.72; z += 3 + br() * 3; part(mx, my, s, z, 'crown', false, B.frame, B.sign); }
        if (br() < 0.8) part(mx, my, 0.8, z + 12 + br() * 25, 'spire', false, [150, 150, 160], [255, 40, 40]);
      } else if (B.style === 'glass' && floors > 25 && r < 0.4) {
        part(mx, my, 0.6, B.h + 15 + br() * 20, 'spire', false, [150, 150, 160], [255, 40, 40]);
      } else if (B.style === 'historic' && m >= 14 && r < 0.2) {
        dome(mx, my, m * 0.32, B.h + 4, B.frame, B.win);
      } else if ((B.style === 'office' || B.style === 'glass') && m > 12 && r < 0.6) {
        part(mx, my, m * (0.25 + br() * 0.1), B.h + 3 + br() * 2, 'mech', false, [70, 72, 78], [255, 60, 50]);
      } else if ((B.style === 'brick' || B.style === 'residential') && m > 8 && B.h < 60 && r < 0.35) {
        // from a small tank to a big one; legs, body (1.7 r) and lid (0.6 r) scale with it, see the renderer
        const tr = Math.min(1.1 + br() ** 1.5 * 2.3, m / 2 - 1.5);
        const wood: RGB = pick([[110, 75, 50], [88, 64, 48], [125, 90, 62], [95, 100, 105]]);
        part(B.x0 + tr + 1 + br() * (w - 2 * tr - 2), B.y0 + tr + 1 + br() * (d - 2 * tr - 2), tr, B.h + 1.2 + br() * 2.3 + 2.3 * tr, 'tank', true, wood, wood);
      } else if (B.style === 'warehouse' && m > 10 && r < 0.18) {
        const cr = 1.5 + br();
        part(B.x0 + cr + 2 + br() * (w - 2 * cr - 4), B.y0 + cr + 2 + br() * (d - 2 * cr - 4), cr, 30 + br() * 35, 'chimney', true, [115, 55, 42], [255, 40, 40]);
      }
    };
    const stone: RGB = [150, 135, 110], warm: RGB = [255, 220, 150], copper: RGB = [70, 140, 120];
    /** A plain building of this landmark. */
    const house = (bx0: number, by0: number, bx1: number, by1: number, bh: number, style: Facade, frame: RGB, win: RGB, lit: number) => {
      const civic = lm === 'hall' || lm === 'church' || lm === 'clock';
      buildings.push({ x0: bx0, y0: by0, x1: bx1, y1: by1, h: bh, round: false, style, win, frame, lit, shop: false, sign: win, feat: 1, biz: -1, cut: null, flood: civic ? FLOOD_WARM : null, floodH: civic ? Math.min(bh, 28) : 0, tier: 0, crown: null, shed: false, ad: -1, board: null, neon: null, scaffold: 0, net: 0, screen: 0, ticker: false });
      block.maxH = Math.max(block.maxH, bh);
    };
    const long = ix1 - ix0 > iy1 - iy0;

    if (open === 'plaza' || lm === 'church') for (const [x, y] of [[ix0 + 4, iy0 + 4], [ix1 - 4, iy0 + 4], [ix1 - 4, iy1 - 4], [ix0 + 4, iy1 - 4]]) tree(x, y);
    else if (open === 'park') {
      // trees, leaving the two crossing paths through the middle clear
      const trees = Math.round(((ix1 - ix0) * (iy1 - iy0)) / 140);
      for (let t = 0; t < trees; t++) {
        const x = ix0 + 2 + br() * (ix1 - ix0 - 4), y = iy0 + 2 + br() * (iy1 - iy0 - 4);
        if (Math.abs(x - mx) > 3 && Math.abs(y - my) > 3) tree(x, y);
      }
    }

    // street furniture on the sidewalk, facing the street, clear of the corners and of the lamps
    const kinds = FURNITURE[districts[district].type];
    const total = kinds.reduce((a, k) => a + k[1], 0);
    for (let e = 0; e < 4; e++) {
      const [ax, ay] = corners[e], [bx, by] = corners[(e + 1) % 4], a = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][e];
      const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
      const nx = Math.cos(a), ny = Math.sin(a); // toward the street
      const lampStep = len / Math.max(1, Math.round(len / 28));
      // a hydrant near one end of every side
      if (fr() < 0.7) block.props.push({ kind: 'hydrant', x: ax + ux * 6 - nx * 0.6, y: ay + uy * 6 - ny * 0.6, w: 0, z1: 0, seed: 0, a });
      for (let d = 9 + fr() * 6; d < len - 9; d += 7 + fr() * 9) {
        const lampGap = d % lampStep;
        if (lampGap < 2.5 || lampStep - lampGap < 2.5 || fr() < 0.35) continue;
        let pick = fr() * total, kind = kinds[0][0];
        for (const [k, wgt] of kinds) { if ((pick -= wgt) < 0) { kind = k; break; } }
        // dumpsters and rubble sit against the buildings, the rest near the curb
        const back = kind === 'dumpster' ? 2.2 : kind === 'shelter' ? 1.3 : 0.7;
        block.props.push({ kind, x: ax + ux * d - nx * back, y: ay + uy * d - ny * back, w: 0, z1: 0, seed: (fr() * 1e6) | 0, a });
      }
    }
    if (open === 'park' || open === 'plaza') {
      // benches along the paths through the middle, facing them
      for (const s of [-1, 1]) for (let k = 1; k <= 2; k++) {
        const off = open === 'park' ? 2.6 : 6;
        const dx = (ix1 - ix0) * 0.18 * k, dy = (iy1 - iy0) * 0.18 * k;
        block.props.push({ kind: 'bench', x: mx + s * dx, y: my + off, w: 0, z1: 0, seed: 0, a: -Math.PI / 2 });
        block.props.push({ kind: 'bench', x: mx - off, y: my + s * dy, w: 0, z1: 0, seed: 0, a: 0 });
      }
      if (fr() < 0.5) block.props.push({ kind: 'bin', x: mx + 2.2, y: my + 2.2, w: 0, z1: 0, seed: 0, a: 0 });
    }

    if (lm === 'memorial') {
      // an obelisk on a stepped plinth
      part(mx, my, 5, 1, 'historic', false, stone, warm);
      part(mx, my, 3.5, 3, 'historic', false, stone, warm);
      part(mx, my, 1.4, 36 + br() * 14, 'spire', false, [170, 155, 125], [255, 235, 190]);
    } else if (lm === 'hall') {
      const hw = (ix1 - ix0) * 0.3, hd = (iy1 - iy0) * 0.3;
      house(mx - hw, my - hd, mx + hw, my + hd, 18, 'historic', stone, warm, 0.5);
      dome(mx, my, Math.min(hw, hd) * 0.7, 22, stone, warm);
    } else if (lm === 'clock') {
      // square tower with a lit clock face on every side and a copper cap
      const cs = 5 + br() * 1.5, th = 38 + br() * 14;
      house(mx - cs, my - cs, mx + cs, my + cs, th, 'clock', br() < 0.5 ? stone : [120, 60, 45], warm, 0.3);
      part(mx, my, cs * 0.8, th + 3, 'dome', false, copper, warm);
      part(mx, my, cs * 0.5, th + 6, 'dome', false, copper, warm);
      part(mx, my, 0.5, th + 12, 'spire', false, copper, warm);
    } else if (lm === 'church') {
      // nave along the long side of the block, steeple with a copper spire at one end
      const nl = (long ? ix1 - ix0 : iy1 - iy0) * 0.3, nw = 6, sx = long ? mx - nl - 3 : mx, sy = long ? my : my - nl - 3;
      house(long ? mx - nl : mx - nw, long ? my - nw : my - nl, long ? mx + nl : mx + nw, long ? my + nw : my + nl, 15, 'historic', stone, [255, 190, 120], 0.35);
      house(sx - 3.5, sy - 3.5, sx + 3.5, sy + 3.5, 30, 'historic', stone, [255, 190, 120], 0.2);
      part(sx, sy, 2.6, 36, 'dome', false, copper, warm);
      part(sx, sy, 1.6, 43, 'dome', false, copper, warm);
      part(sx, sy, 0.6, 54 + br() * 8, 'spire', false, copper, warm);
    } else if (lm === 'mast') {
      // radio transmitter: a lattice mast in three narrowing sections, lit red, and a hut at its foot
      house(ix0 + 4, iy0 + 4, ix0 + 10, iy0 + 8, 3.5, 'warehouse', [80, 85, 90], [200, 220, 180], 0.5);
      const top = 150 + br() * 40;
      part(mx, my, 4, top * 0.4, 'mast', false, [150, 60, 50], [255, 40, 40]);
      part(mx, my, 2.6, top * 0.72, 'mast', false, [150, 60, 50], [255, 40, 40]);
      part(mx, my, 1.4, top, 'mast', false, [150, 60, 50], [255, 40, 40]);
    } else if (lm === 'gasworks') {
      // one or two gas holders: steel guide frames around the tank
      const gr = Math.min(17, Math.min(ix1 - ix0, iy1 - iy0) / 2 - 4);
      const two = (long ? ix1 - ix0 : iy1 - iy0) > 4 * gr + 12;
      for (const u of two ? [-1, 1] : [0]) {
        const gx = long ? mx + u * (gr + 3) : mx, gy = long ? my : my + u * (gr + 3);
        part(gx, gy, gr, 24 + br() * 16, 'gasholder', true, [105, 85, 70], [255, 40, 40]);
      }
    } else if (lm === 'power') {
      // turbine hall with a row of tall chimneys beside it
      const frame: RGB = [115, 55, 42];
      house(ix0 + 4, iy0 + 4, long ? ix1 - 4 : mx, long ? my : iy1 - 4, 24, 'brick', frame, [255, 200, 120], 0.4);
      for (let k = 0; k < 3; k++) {
        const u = 0.25 + 0.25 * k;
        part(long ? ix0 + (ix1 - ix0) * u : mx + 10, long ? my + 10 : iy0 + (iy1 - iy0) * u, 3, 80 + br() * 15, 'chimney', true, frame, [255, 40, 40]);
      }
    } else if (!open) lot(ix0, iy0, ix1, iy1);
    const dr = diagRange(diagonal, x0, y0, x1, y1);
    if (dr.touches) {
      block.diag = 1;
      // a sliver left between the diagonal and the cross streets is too small to build on: a plaza
      const R = diagonal.w / 2 + SIDEWALK, o = diagonal.ox * diagonal.nx + diagonal.oy * diagonal.ny;
      const neg = clippedArea(ix0, iy0, ix1, iy1, diagonal.nx, diagonal.ny, o - R);
      const pos = clippedArea(ix0, iy0, ix1, iy1, -diagonal.nx, -diagonal.ny, -(R + o));
      // around the theater district's X the slivers are bigger: the square's plazas
      block.square = Math.hypot(mx - diagonal.ox, my - diagonal.oy) < SQUARE_R;
      const plaza = block.square ? SQUARE_PLAZA : PLAZA_AREA;
      if (neg > 0 && neg < plaza) block.diag |= 2;
      if (pos > 0 && pos < plaza) block.diag |= 4;
      cutByDiagonal(buildings, block.b0, diagonal);
      for (let k = buildings.length - 1; k >= block.b0; k--) {
        const B = buildings[k], sB = diagS(diagonal, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2);
        if (block.diag & (sB > 0 ? 4 : 2)) buildings.splice(k, 1);
      }
      block.maxH = 0;
      for (let k = block.b0; k < buildings.length; k++) block.maxH = Math.max(block.maxH, buildings[k].h);
      // nothing stands on the roadway; trees keep off its sidewalks too
      block.props = block.props.filter((p) => Math.abs(diagS(diagonal, p.x, p.y)) > diagonal.w / 2 + (p.kind === 'tree' ? SIDEWALK + 1 : 0.4));
      if (block.square) furnishSquare(block, diagonal, fr);
    }
    // one business per shop front; kind and name come from the building's position, so they stay put
    const shops = SHOPS[districts[district].type];
    for (let k = block.b0; k < buildings.length; k++) {
      const B = buildings[k];
      if (!B.shop) continue;
      const bx = Math.floor(B.x0), by = Math.floor(B.y0);
      B.biz = businesses.length;
      const kind = shops[Math.floor(hash3(seed ^ 0x51ed27, bx, by) * shops.length)];
      businesses.push({ kind, building: k, name: Math.floor(hash3(seed ^ 0x3b9ac1, bx, by) * 1e9) });
      if (hash3(seed ^ 0x7b1ade, bx, by) < (BLADE[kind] ?? 0)) bladeSign(block, B, hash3(seed ^ 0x7b1ade, by, bx), kind);
    }
    // facade dressing, from each building's position so nothing else moves: lit crowns on towers,
    // sidewalk sheds (scaffolding) along the street, ads painted high on the walls of walk-ups
    for (let k = block.b0; k < buildings.length; k++) {
      const B = buildings[k], bx = Math.floor(B.x0), by = Math.floor(B.y0), floors = (B.h - 1) / FLOOR_H;
      const type = districts[district].type;
      if (B.tier >= 1 && floors > 22 && (B.style === 'office' || B.style === 'glass' || B.style === 'historic') && hash3(seed ^ 0xc0f1, bx, by) < 0.55) B.crown = CROWNS[Math.floor(hash3(seed ^ 0xc0f2, bx, by) * CROWNS.length)];
      if (B.tier === 1 && B.style !== 'warehouse' && !B.round && hash3(seed ^ 0x5bed, bx, by) < 0.07) B.shed = true;
      // on almost half of those the scaffolding climbs the wall, all the way up on low buildings
      if (B.shed && B.h > 9 && hash3(seed ^ 0x5caf, bx, by) < 0.45) {
        const u = hash3(seed ^ 0x5cb0, bx, by);
        B.scaffold = Math.min(B.h + 1, Math.max(10, 4.1 + 2 * Math.round((B.h < 30 ? B.h : 12 + u * 24) / 2)));
        B.net = u < 0.5 ? 1 + Math.floor(u * 6) : 0;
      }
      if (type === 'theater' && B.tier === 1 && !B.round) {
        // a news ticker around some buildings (most of the wedges on the diagonal), screens on most street faces
        if (B.h >= 18 && hash3(seed ^ 0x71c4, bx, by) < (B.cut ? 0.35 : 0.04)) B.ticker = true;
        if (B.h >= 14) for (const f of streetFaces(block, B)) if (hash3(seed ^ 0x5c4e, bx + f, by) < 0.6 || (block.square && facesX(B, f, diagonal))) B.screen |= 1 << f;
        if (block.square && B.cut && B.h >= 18) B.ticker = true;
      }
      if (B.tier === 1 && !B.round && businesses.length && (B.style === 'brick' || B.style === 'residential' || B.style === 'warehouse') && B.h > 10 && hash3(seed ^ 0xadad, bx, by) < 0.3) B.ad = Math.floor(hash3(seed ^ 0xadae, bx, by) * businesses.length);
      // neon tubes on the corners and roof line: common on the commercial strips, rarer on towers
      const neonP = B.tier < 1 || B.style === 'warehouse' ? 0 : type === 'theater' ? 0.7 : type === 'commercial' ? 0.18 : type === 'financial' ? 0.08 : type === 'residential' ? 0.03 : 0;
      if (hash3(seed ^ 0x4e0e, bx, by) < neonP) B.neon = NEON[Math.floor(hash3(seed ^ 0x4e0f, bx, by) * NEON.length)];
      // a billboard on the roof of a low or middling building (its top box), facing a street
      const topBox = B.tier >= 1 && !(k + 1 < buildings.length && buildings[k + 1].tier === B.tier + 1);
      if (topBox && !B.round && businesses.length && B.h > 7 && B.h < (type === 'theater' ? 140 : 90) && !B.crown && type !== 'historic' && hash3(seed ^ 0xb0a4, bx, by) < (type === 'theater' ? 0.45 : 0.14)) {
        B.board = billboard(block, B, Math.floor(hash3(seed ^ 0xb0a5, bx, by) * businesses.length), hash3(seed ^ 0xb0a6, bx, by));
        // not where a water tank or machinery already stands on the roof
        const Bd = B.board;
        if (Bd) for (let q = block.b0; q < buildings.length; q++) {
          const P = buildings[q], pr = (P.x1 - P.x0) / 2, cx = P.x0 + pr, cy = P.y0 + pr;
          if (P.tier !== 0 || P.h <= B.h || cx < B.x0 || cx > B.x1 || cy < B.y0 || cy > B.y1) continue;
          const ux = -Math.sin(Bd.a), uy = Math.cos(Bd.a), u = (cx - Bd.x) * ux + (cy - Bd.y) * uy, n = (cx - Bd.x) * uy - (cy - Bd.y) * ux;
          if (Math.abs(u) < Bd.w / 2 + pr + 0.5 && Math.abs(n) < pr + 1.5) { B.board = null; break; }
        }
      }
    }
    block.b1 = buildings.length;
  }

  const landmarks: Landmark[] = [];
  for (const [k, kind] of special) if (kind !== 'park2') landmarks.push({ kind, x: (blocks[k].x0 + blocks[k].x1) / 2, y: (blocks[k].y0 + blocks[k].y1) / 2 });
  let tallest = buildings[0];
  for (const B of buildings) if (B.h > tallest.h) tallest = B;
  if (tallest) landmarks.push({ kind: 'tower', x: (tallest.x0 + tallest.x1) / 2, y: (tallest.y0 + tallest.y1) / 2 });

  const xCell = cellTable(xb), yCell = cellTable(yb);
  diagonalLamps(seed, diagonal, w, h, xb, yb, xCell, yCell, nbx, blocks, districts);
  const { vents, floodlights, sarcophagus } = generateBorder(seed, w, h);
  return { w, h, xb, yb, xCell, yCell, nbx, nby, blocks, buildings, empties, cx, cy, districts, landmarks, vents, floodlights, sarcophagus, diagonal, businesses, lamps: blocks.flatMap((b) => b.props.filter((p) => p.kind === 'lamp')), sectors: SECTORS, nameSeed };
}

/** Faces of a building on the sidewalk: the sides on the block's edge, and a face cut by the diagonal. */
function streetFaces(block: Block, B: Building): number[] {
  const ix0 = block.x0 + SIDEWALK, iy0 = block.y0 + SIDEWALK, ix1 = block.x1 - SIDEWALK, iy1 = block.y1 - SIDEWALK;
  const faces = [B.x0 <= ix0 + 0.01, B.x1 >= ix1 - 0.01, B.y0 <= iy0 + 0.01, B.y1 >= iy1 - 0.01, !!B.cut];
  return faces.map((f, k) => (f ? k : -1)).filter((k) => k >= 0);
}

/** Point at u along face f of a building, pushed `out` metres outward, and the face's outward angle. */
function onFace(B: Building, f: number, u: number, out: number): [number, number, number] {
  if (f === 4) { const K = B.cut!; return [K.nx * (K.c + out) + K.ny * u, K.ny * (K.c + out) - K.nx * u, Math.atan2(K.ny, K.nx)]; }
  if (f < 2) return [f === 0 ? B.x0 - out : B.x1 + out, u, f === 0 ? Math.PI : 0];
  return [u, f === 2 ? B.y0 - out : B.y1 + out, f === 2 ? -Math.PI / 2 : Math.PI / 2];
}

/**
 * A rooftop billboard over the widest street face, set 1.5 m back from it and facing out, as wide
 * as the face allows (up to 14 m) and a third as tall; r picks the face when several are as good.
 */
function billboard(block: Block, B: Building, biz: number, r: number): Board | null {
  const open = streetFaces(block, B);
  let best = -1, len = 0;
  for (const f of open) { const sp = faceSpan(B, f), l = sp[1] - sp[0] + r * 0.5; if (l > len) { len = l; best = f; } }
  if (best < 0) return null;
  const sp = faceSpan(B, best), w = Math.min(14, sp[1] - sp[0] - 2);
  if (w < 6) return null;
  const [x, y, a] = onFace(B, best, (sp[0] + sp[1]) / 2, -1.5);
  return { biz, x, y, a, w, h: Math.max(2.5, Math.min(4.5, w / 3)), z: B.h + 1.6 + r };
}

/**
 * A blade sign on one of the building's faces toward a street, near one end of it; seed is the
 * business. The renderer stacks its letters and makes it as tall as its word (up to 8 letters),
 * so it is only hung where the building is tall enough.
 */
function bladeSign(block: Block, B: Building, r: number, kind: BusinessKind) {
  // hotels and cinemas hang a tall sign over several floors where there is room for one
  const letter = (kind === 'hotel' || kind === 'cinema') && B.h >= BLADE_Z + 8 * BLADE_TALL + 3 ? BLADE_TALL : BLADE_LETTER;
  if (B.h < BLADE_Z + 8 * letter + 2) return; // room for the longest word and a symbol
  const open = streetFaces(block, B);
  if (!open.length) return;
  const f = open[Math.floor(r * open.length)], sp = faceSpan(B, f), lo = sp[0], hi = sp[1];
  if (hi - lo < 4) return;
  const u = (r * 7) % 1 < 0.5 ? lo + 1.2 : hi - 1.2;
  const [x, y, a] = onFace(B, f, u, 0);
  // z1 carries the letter size
  block.props.push({ kind: 'blade', x, y, w: 0, z1: letter, seed: B.biz, a });
}

/** A piece of block cut off by the diagonal and smaller than this (m²) is left as a plaza. */
const PLAZA_AREA = 1200;
/** The square around the theater district's X: blocks this close to its center, and how big a sliver it turns into plaza. */
const SQUARE_R = 190, SQUARE_PLAZA = 4000;

/** Whether face f of a building looks out onto the square (toward the X's center). */
function facesX(B: Building, f: number, d: Diagonal): boolean {
  const mx = (B.x0 + B.x1) / 2, my = (B.y0 + B.y1) / 2;
  const [nx, ny] = f === 4 ? [B.cut!.nx, B.cut!.ny] : f === 0 ? [-1, 0] : f === 1 ? [1, 0] : f === 2 ? [0, -1] : [0, 1];
  const dx = d.ox - mx, dy = d.oy - my, L = Math.hypot(dx, dy) || 1;
  return (nx * dx + ny * dy) / L > 0.35;
}

/**
 * The square's plazas, on a block's slivers: cafe tables with chairs, planters, benches and bins
 * on a 4 m grid, and on the biggest sliver the red steps people sit on to watch the screens,
 * turned to the X. From the block's furniture stream, so the buildings stay put.
 */
function furnishSquare(block: Block, d: Diagonal, fr: Rng) {
  const ix0 = block.x0 + SIDEWALK + 1, iy0 = block.y0 + SIDEWALK + 1, ix1 = block.x1 - SIDEWALK - 1, iy1 = block.y1 - SIDEWALK - 1;
  const inPlaza = (x: number, y: number) => {
    if (x < ix0 || x > ix1 || y < iy0 || y > iy1) return false;
    const sv = diagS(d, x, y);
    return Math.abs(sv) > d.w / 2 + SIDEWALK + 1 && (block.diag & (sv > 0 ? 4 : 2)) !== 0;
  };
  const toX = (x: number, y: number) => Math.atan2(d.oy - y, d.ox - x);
  // the steps: the free spot (8 x 6 m around it) nearest the X
  let best: [number, number] | null = null, bd = Infinity;
  for (let y = iy0 + 4; y <= iy1 - 4; y += 2) for (let x = ix0 + 4; x <= ix1 - 4; x += 2) {
    const ok = [[-4, -4], [4, -4], [-4, 4], [4, 4], [0, 0]].every(([a, b]) => inPlaza(x + a, y + b));
    const dd = Math.hypot(x - d.ox, y - d.oy);
    if (ok && dd < bd) { bd = dd; best = [x, y]; }
  }
  if (best) block.props.push({ kind: 'steps', x: best[0], y: best[1], w: 0, z1: 0, seed: 0, a: toX(best[0], best[1]) });
  for (let y = iy0 + 1; y <= iy1 - 1; y += 4) for (let x = ix0 + 1; x <= ix1 - 1; x += 4) {
    const px = x + (fr() - 0.5) * 1.5, py = y + (fr() - 0.5) * 1.5;
    if (!inPlaza(px, py) || (best && Math.hypot(px - best[0], py - best[1]) < 6.5)) continue;
    const r = fr(), a = fr() * Math.PI * 2;
    const kind: PropKind | null = r < 0.3 ? 'table' : r < 0.42 ? 'planter' : r < 0.52 ? 'bench' : r < 0.58 ? 'bin' : null;
    if (kind) block.props.push({ kind, x: px, y: py, w: 0, z1: 0, seed: (fr() * 1e6) | 0, a: kind === 'bench' ? toX(px, py) : a });
  }
}

/**
 * Street lamps along both curbs of the diagonal, every 28 m, arms over the roadway. Each goes to
 * the block it stands in; spots on the cross streets or too near their corners are skipped.
 */
function diagonalLamps(seed: number, d: Diagonal, w: number, h: number, xb: number[], yb: number[], xCell: Uint16Array, yCell: Uint16Array, nbx: number, blocks: Block[], districts: District[]) {
  const L = Math.hypot(w, h);
  for (const side of [-1, 1]) {
    const off = side * (d.w / 2 + 0.8), a = Math.atan2(-side * d.ny, -side * d.nx);
    for (let k = Math.floor(-L / 28); k <= L / 28; k++) {
      const u = k * 28 + (side > 0 ? 14 : 0), x = d.ox + d.ex * u + d.nx * off, y = d.oy + d.ey * u + d.ny * off;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const cx = xCell[x | 0], cy = yCell[y | 0];
      if (!(cx & 1) || !(cy & 1)) continue;
      if (Math.min(x - xb[cx], xb[cx + 1] - x, y - yb[cy], yb[cy + 1] - y) < 3) continue;
      const blk = blocks[(cy >> 1) * nbx + (cx >> 1)];
      let roll = hash3(seed ^ 0x6d1a9e, k, side), lampType: LampType = 'hps';
      for (const [t, wt] of LAMPS[districts[blk.district].type]) { if ((roll -= wt) < 0) { lampType = t; break; } }
      blk.props.push({ kind: 'lamp', x, y, w: 0.3, z1: 6.5, seed: 0, a, lampType });
    }
  }
}

/**
 * The burning seam that surrounds the city, and the cordon on its edge. It has its own random
 * stream, so it never shifts the city itself.
 */
function generateBorder(seed: number, w: number, h: number) {
  const rng = mulberry32((hash3(seed, 7777, 1) * 4294967296) | 0);
  const vents: Vent[] = [];
  const n = Math.round((w + h) / 50);
  for (let k = 0; k < n; k++) {
    // a point on the perimeter, pushed outward
    let s = rng() * 2 * (w + h), x: number, y: number, nx: number, ny: number;
    if (s < w) { x = s; y = 0; nx = 0; ny = -1; } else if ((s -= w) < h) { x = w; y = s; nx = 1; ny = 0; }
    else if ((s -= h) < w) { x = s; y = h; nx = 0; ny = 1; } else { s -= w; x = 0; y = s; nx = -1; ny = 0; }
    const out = BURN_START + 40 + rng() ** 1.5 * 900;
    vents.push({ x: x + nx * out, y: y + ny * out, r: 4 + rng() * 10, h: 50 + rng() * 110 });
  }
  // the Sarcophagus on one side: its near edge 2.5 km past the fence
  const a = rng() * 2 * Math.PI, dx = Math.cos(a), dy = Math.sin(a);
  const edge = Math.min(Math.abs(w / 2 / (dx || 1e-9)), Math.abs(h / 2 / (dy || 1e-9)));
  const R = 1500, H = 600, far = edge + 2500 + R;
  const sx = w / 2 + dx * far, sy = h / 2 + dy * far;
  const side = rng() < 0.5 ? -1 : 1;
  const tr = 420, tower = { tx: sx + dx * 300 - dy * side * (R + tr * 0.6), ty: sy + dy * 300 + dx * side * (R + tr * 0.6), tr, th: 230 };
  const cranes: Sarcophagus['cranes'] = [];
  for (let k = 0; k < 5; k++) {
    // on the dome's upper slopes, where the work stopped
    const ca = rng() * 2 * Math.PI, cr = (0.15 + rng() * 0.45) * R;
    const Rs = (R * R + H * H) / (2 * H), surf = Math.sqrt(Rs * Rs - cr * cr) - (Rs - H);
    cranes.push({ x: sx + Math.cos(ca) * cr, y: sy + Math.sin(ca) * cr, z: surf + 60 + rng() * 30, a: rng() * 2 * Math.PI });
  }
  const sarcophagus: Sarcophagus = { x: sx, y: sy, r: R, h: H, ...tower, cranes };
  const floodlights: { x: number; y: number }[] = [];
  const GAP = 120, OFF = 3;
  for (let x = GAP / 2; x < w; x += GAP) floodlights.push({ x, y: -OFF }, { x, y: h + OFF });
  for (let y = GAP / 2; y < h; y += GAP) floodlights.push({ x: -OFF, y }, { x: w + OFF, y });
  return { vents, floodlights, sarcophagus };
}

/** District of the block nearest to a point (roads belong to the block beside them). */
export function districtAt(city: City, x: number, y: number): number {
  const i = Math.min(city.nbx - 1, (city.xCell[Math.min(city.w - 1, Math.max(0, x | 0))] - 1) >> 1);
  const j = Math.min(city.nby - 1, (city.yCell[Math.min(city.h - 1, Math.max(0, y | 0))] - 1) >> 1);
  return city.blocks[Math.max(0, j) * city.nbx + Math.max(0, i)].district;
}

/** Index of the road nearest to coordinate v along one axis (b = city.xb gives avenues, city.yb streets). */
export function nearestRoad(b: number[], cells: Uint16Array, v: number): number {
  const c = cells[Math.min(cells.length - 1, Math.max(0, v | 0))];
  if (!(c & 1)) return c >> 1;
  return v - b[c] < b[c + 1] - v ? c >> 1 : (c >> 1) + 1;
}

/** The block containing a point, or null on a road or outside the city. */
export function blockAt(city: City, x: number, y: number): Block | null {
  if (x < 0 || y < 0 || x >= city.w || y >= city.h) return null;
  const cx = city.xCell[x | 0], cy = city.yCell[y | 0];
  if (!(cx & 1) || !(cy & 1)) return null;
  return city.blocks[(cy >> 1) * city.nbx + (cx >> 1)];
}

export function isSolid(city: City, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= city.w || y >= city.h) return true;
  const b = blockAt(city, x, y);
  if (!b) return false;
  for (let k = b.b0; k < b.b1; k++) {
    const B = city.buildings[k];
    if (x >= B.x0 && x < B.x1 && y >= B.y0 && y < B.y1 && (!B.cut || B.cut.nx * x + B.cut.ny * y <= B.cut.c)) return true;
  }
  return false;
}
