import { hash3 } from '../core/rng';
import { BAY, BLADE_LETTER, blockAt, BLADE_Z, diagS, faceSpan, FLOOR_H, LANE_W, lanesOf, SIDEWALK, type Building, type City, type RGB } from '../sim/city';
import { doorKey, liftFloors, type World } from '../sim/world';
import { baseAt, doorOf, escapesOf, exitsOf, leavesOf, planOf } from '../sim/interior';
import { insideLight, interiorColumn, prepareInside, type Inside } from './interior';
import { CharGrid } from './grid';
import { BLOCK } from './atlas';
import { LAMP_LIGHT, lampId } from './lamps';
import { DynLights, FLOOD_OUT } from './lights';
import { LightWindow } from './lightmap';
import { bladeText } from '../locale/names';
import { signalLamps, mastModel, substationModel, cctvModel, cctvMount, bladeHeight, bladeModel, bladeReach, bikeModel, boardModel, carFarModel, carModel, pedModel, VEHICLE_SIZE, vehicleModel, debrisModel, escapeModel, shedModel, FLOOD, FURNITURE, lampModel, poweredFurniture, SIGNAL_POLE, walkSignal, signalFarModel, signalModel, STOP_SIGN, treeModel, wallFloodModel } from './models';
import { type Obj } from './objects';
import { type Look } from './palette';
import { type Roof } from './precip';
import { power } from './power';
import { subAt } from '../sim/power';
import { CAMS, cctvYaw } from '../sim/cctv';
import { daylight, prepareSky, type SkyFrame } from './sky';
import { BLADE_SYMBOL, signLight, signMode, signText } from './signs';
import { tickerText } from '../locale/news';
import { blinkOn, carPose, diagPoint, diagRoad, DIRS, flashing, Sig, signal, zoneSignal } from '../sim/traffic';

export interface View {
  x: number;
  y: number;
  yaw: number;
  /** Look angle up/down in radians. */
  pitch: number;
  /** Eye height in metres. */
  eye: number;
  /** Storey the viewer stands on, 0 at street level; feet height; riding a lift (its doors shut). */
  floor: number;
  z: number;
  lift: boolean;
  /** Interpolation factor between the previous and current sim tick. */
  alpha: number;
  /** Cell width / cell height in pixels, needed for correct vertical scale. */
  cellAspect: number;
  look: Look;
  /** A light in the player's hand (the phone's screen as a torch, a camera flash): its strength, 0 for none. */
  hand?: number;
}

/** Vertical field of view. The horizontal one follows the window shape (wider window, wider view). */
export const VFOV = (60 * Math.PI) / 180;
/** Street furniture and cars are drawn only this close. */
const SPRITE_FAR = 250;
/** Cars closer than this get their full model (wheels, lamps); farther, a simple one. */
const CAR_NEAR = 70;
/** People are drawn this close, in detail closer than PED_NEAR. */
const PED_DRAW = 130, PED_NEAR = 40;
/** Headlights and tail lights light the street this close (farther, the lamps on the car still show). */
const CAR_LIGHT_FAR = 90;
/**
 * Closer than this a car's headlights are two cones, one per lamp (further, one cone for the pair),
 * for the CAR_TWIN_MAX nearest at most: each second cone costs ~0.1 ms of a single-thread frame.
 */
const CAR_TWIN_FAR = 40, CAR_TWIN_MAX = 8;
/** Street lamps light walls and objects up to this height, and this far from the viewer. */
const LIT_H = 9;
/** Litter on the ground is drawn only this close. */
export const LITTER_FAR = 14;
export const AD_LETTER = 1.25;
export const AD_BG: RGB[] = [[170, 40, 35], [35, 60, 130], [200, 170, 60], [215, 210, 195], [40, 100, 70], [25, 25, 30]];
export const AD_FG: RGB[] = [[240, 230, 210], [240, 200, 70], [40, 30, 30], [180, 40, 35], [235, 225, 200], [230, 60, 60]];
export const FRAME_AD: RGB = [60, 55, 50];

const C = (s: string) => s.charCodeAt(0);

/**
 * Litter items: glyph, color, shape (0 round, 1 flat rectangle, 2 long and thin) and half sizes in metres.
 * Colors are muted, so the street keeps its sodium palette.
 */
export const LITTER: [number, number, number, number, number, number, number][] = [
  [C('@'), 38, 38, 44, 0, 0.22, 0], [C('@'), 50, 66, 100, 0, 0.19, 0], [C('&'), 165, 165, 160, 0, 0.16, 0], // black, blue and white bags
  [C('u'), 225, 220, 205, 0, 0.08, 0], [C('u'), 185, 60, 50, 0, 0.08, 0], [C('o'), 120, 90, 60, 0, 0.07, 0], // cups, a coffee lid
  [C('='), 175, 180, 190, 2, 0.08, 0.035], [C('='), 175, 50, 45, 2, 0.08, 0.035], // cans lying down
  [C('-'), 70, 125, 80, 2, 0.13, 0.04], [C('-'), 115, 78, 40, 2, 0.13, 0.04], // green and brown bottles
  [C('#'), 205, 200, 180, 1, 0.14, 0.1], [C('~'), 165, 162, 148, 1, 0.22, 0.16], [C('%'), 145, 115, 78, 1, 0.22, 0.17], // paper, newspaper, cardboard
  [C('*'), 195, 165, 60, 1, 0.06, 0.04], [C('*'), 90, 130, 150, 1, 0.06, 0.04], // candy wrappers
  [C('.'), 225, 150, 90, 2, 0.03, 0.012], [C(','), 200, 190, 170, 2, 0.03, 0.012], // cigarette butts
];
const light = new LightWindow();
const dyn = new DynLights();
/** Light reaching a point, filled by lightAt. */
const LT = new Float32Array(3);
/** Dynamic lights (cars, signs) are gathered this close to the viewer. */
const DYN_FAR = 200;
/**
 * A lit facade's floodlights stand every FLOOD_GAP m along each face (where the shader paints their beams);
 * their fixtures are drawn this close, and they light what passes in front of them this close.
 */
export const FLOOD_GAP = 6, FLOOD_FIX_FAR = 70, FLOOD_LIGHT_FAR = 120;

/** The floodlights of building B: each lamp's spot (FLOOD_OUT m out from its face) and the face's outward normal. */
function floodSpots(B: Building, cb: (x: number, y: number, nx: number, ny: number) => void) {
  if (!B.flood || B.round) return;
  const K = B.cut;
  for (let f = 0; f < (K ? 5 : 4); f++) {
    const sp = faceSpan(B, f), lo = sp[0], hi = sp[1];
    const out = f & 1 ? 1 : -1, nx = f === 4 ? K!.nx : f >= 2 ? 0 : out, ny = f === 4 ? K!.ny : f >= 2 ? out : 0;
    for (let a = lo + FLOOD_GAP / 2; a < hi; a += FLOOD_GAP) {
      const x = f === 4 ? nx * K!.c + ny * a : f >= 2 ? a : f === 0 ? B.x0 : B.x1;
      const y = f === 4 ? ny * K!.c - nx * a : f >= 2 ? (f === 2 ? B.y0 : B.y1) : a;
      cb(x + nx * FLOOD_OUT, y + ny * FLOOD_OUT, nx, ny);
    }
  }
}
/** Width of one letter on a shop sign, and the sign band's height above the sidewalk. */
export const LETTER_W = 0.55, SIGN_Z0 = 2.6, SIGN_Z1 = 3.4;
// the current frame's city and time in seconds, for the signs
let frameTicker = '';
let frameSec = 0, frameDay = 0;
/** Toward the sun (z up; the elevation clamped at the horizon), and the share of it on the face being drawn. */
const SUN = [0, 0, 0];
/** ASCII glyph -> block/box slot for the blocks mode; 0 keeps the glyph. */
export const BLOCKS = new Uint8Array(256);
for (const [c, b] of [['@', BLOCK.full], ['#', BLOCK.dark], ['%', BLOCK.mid], [':', BLOCK.light], ['-', BLOCK.h], ['|', BLOCK.v],
  ['+', BLOCK.cross], ['=', BLOCK.dh], ['/', BLOCK.up], ['\\', BLOCK.down], ['x', BLOCK.x]] as const) BLOCKS[C(c)] = b;
/** This frame's roofs near the viewer that keep the rain off. */
export const roofs: Roof[] = [];

/** The light on the viewer's hands after the last renderWorld, per channel (~0.3 in the dark, 1 in daylight). */
export const VIEW_LIGHT = new Float32Array([1, 1, 1]);
/**
 * The light that glints off what they hold: its side (-1 left .. 1 right of the view), strength
 * (0..1, more for a light behind them, as a screen facing them mirrors), color (r, g, b, 0..1),
 * and how much it is behind them (-1 ahead .. 1 behind).
 */
export const VIEW_GLINT = new Float32Array([0, 0, 1, 1, 1, 0]);


/**
 * The light on the viewer's hands, for what they hold (the phone): the room's lamps indoors; outside the sky,
 * the street lamps and the passing lights at chest height, and the lightning. And the brightest light's side
 * and color, for the glint on what they hold: the light sampled 2 m around them gives the way it gets brighter;
 * a light behind reflects best off a screen facing them.
 */
function viewLight(I: Inside | null, px: number, py: number, dirX: number, dirY: number, sky: SkyFrame) {
  const sample = (x: number, y: number, out: Float32Array) => {
    if (I) { const L = insideLight(I, x, y); out[0] = L[0] * 150; out[1] = L[1] * 150; out[2] = L[2] * 150; }
    else { lightAt(x, y, 1.6); out[0] = LT[0]; out[1] = LT[1]; out[2] = LT[2]; }
    return out[0] + out[1] + out[2];
  };
  const S = new Float32Array(3), ex = sample(px + 2, py, S) - sample(px - 2, py, S), ey = sample(px, py + 2, S) - sample(px, py - 2, S);
  const here = sample(px, py, S), g = Math.hypot(ex, ey);
  if (I) { const L = insideLight(I, px, py); for (let c = 0; c < 3; c++) VIEW_LIGHT[c] = 0.3 + 0.85 * L[c]; }
  else {
    const base = 0.3 + 0.55 * sky.day + 0.08 * sky.moonlight + 0.8 * sky.flash;
    for (let c = 0; c < 3; c++) VIEW_LIGHT[c] = Math.min(1.6, base + S[c] / 150);
  }
  const lat = g > 1e-3 ? (ex * -dirY + ey * dirX) / g : 0, back = g > 1e-3 ? -(ex * dirX + ey * dirY) / g : 0;
  const m = Math.max(1, S[0], S[1], S[2]);
  VIEW_GLINT[0] = lat;
  VIEW_GLINT[1] = Math.min(1, here / 300) * (0.45 + 0.55 * Math.max(0, back)) * Math.min(1, 0.4 + g / Math.max(1, here));
  VIEW_GLINT[2] = S[0] / m; VIEW_GLINT[3] = S[1] / m; VIEW_GLINT[4] = S[2] / m; VIEW_GLINT[5] = back;
}

/** The floor the viewer stands in (null outdoors), with its doors' swing and its lamps made ready for this frame. */
function insideOf(world: World, v: View, colW: number, day: number, rain: number): Inside | null {
  const { city } = world, kIn = baseAt(city, v.x, v.y), plan = kIn >= 0 ? planOf(city, kIn, v.floor) : null;
  if (!plan) return null;
  const base = city.buildings[kIn];
  const I: Inside = { city, k: kIn, plan, base, box: city.buildings[plan.box], boxId: plan.box, floor: v.floor, z0: v.lift ? v.z : v.floor * FLOOR_H, closed: v.lift, liftN: liftFloors(world), liftTo: world.player.liftTo, colW, door: doorOf(city, kIn), exits: exitsOf(city, kIn), elec: buildingPower(world, kIn, frameSec), backup: world.power.backup[kIn], day, sec: frameSec, rain, leaves: [], leafA: [] };
  // the doors between rooms, swung as far as they are open (eased: fast at first, settling at the end)
  I.leaves = leavesOf(plan);
  I.leafA = I.leaves.map((_, n) => { const a = world.doors.get(doorKey(kIn, v.floor, n)) ?? 0; return (1 - (1 - a) ** 2) * Math.PI * 0.5; });
  prepareInside(I, v.x, v.y);
  return I;
}

let pickGrid: CharGrid | null = null, pickNear = new Float32Array(0);
/**
 * The floor a GPU frame draws around the viewer (after gpuPrepare), or null outdoors. The lift button
 * under the middle of the screen (pickedButton) is still found here, by the CPU's walk of that one column.
 */
export function gpuInside(world: World, v: View, cols: number, rows: number, sky: SkyFrame) {
  const W = world.weather, scale = rows / 2 / Math.tan(VFOV / 2), plane = ((cols / 2) * v.cellAspect) / scale;
  const I = insideOf(world, v, (2 * plane) / cols, frameDay, W.snow ? 0 : W.precip);
  if (!I) return null;
  if (!pickGrid || pickGrid.cols !== cols || pickGrid.rows !== rows) { pickGrid = new CharGrid(cols, rows); pickNear = new Float32Array(cols); }
  const x = cols >> 1, camX = (2 * (x + 0.5)) / cols - 1, dirX = Math.cos(v.yaw), dirY = Math.sin(v.yaw);
  pickGrid.clear();
  interiorColumn(pickGrid, x, I, v.x, v.y, dirX - dirY * plane * camX, dirY + dirX * plane * camX, v.eye, rows / 2 + Math.tan(v.pitch) * scale, scale, pickNear);
  viewLight(I, v.x, v.y, dirX, dirY, sky);
  return I;
}

/**
 * What a frame drawn on the GPU (render/gpu) takes from here: the frame's globals, the sky, the street lamps, the dynamic lights), and at the end the
 * light on the viewer's hands outdoors (gpuInside sets it indoors).
 */
export function gpuPrepare(world: World, v: View) {
  const { city } = world;
  light.ensure(city, v.x, v.y);
  const time = world.tick + v.alpha;
  frameSec = time / 60; frameTicker = tickerText(world);
  const sky = prepareSky(city, world.power, world.weather, world.seed, world.ptime + (world.time - world.ptime) * v.alpha, frameSec);
  frameDay = sky.day;
  { const ce = Math.cos(sky.sunEl); SUN[0] = Math.cos(sky.sunA) * ce; SUN[1] = Math.sin(sky.sunA) * ce; SUN[2] = Math.max(0, Math.sin(sky.sunEl)); }
  light.update(frameSec, sky.day, world.power);
  gatherLights(world, v, frameSec);
  glFrame = (glFrame + 1) >>> 0 || 1;
  viewLight(null, v.x, v.y, Math.cos(v.yaw), Math.sin(v.yaw), sky);
  return { sky, light, dyn, sun: SUN, ticker: frameTicker };
}

/**
 * The objects a GPU frame draws (after gpuPrepare): the same lists renderWorld draws, each with the
 * distance its fog ends at and how high it is lifted (a fire escape's floors: zoff).
 */
export function gpuObjects(world: World, v: View, cols: number, plane: number): { o: Obj; far: number; zoff: number }[] {
  // what is outside the view's cone is not even built (seen), as in a render worker's strip
  Object.assign(CULL, { px: v.x, py: v.y, dirX: Math.cos(v.yaw), dirY: Math.sin(v.yaw), plane, cols, x0: 0, x1: cols, all: false });
  gatherRoofs(world, v);
  const out = collectObjects(world, v).map((o) => ({ o, far: SPRITE_FAR, zoff: 0 }));
  for (const o of gatherBoards(world, v, frameDay)) out.push({ o, far: BOARD_FAR, zoff: 0 });
  for (const o of sheds) out.push({ o, far: SPRITE_FAR, zoff: 0 });
  // the fire escapes, one object per floor (drawEscapes)
  const { city } = world;
  for (const blk of city.blocks) {
    if (v.x < blk.x0 - 50 || v.x > blk.x1 + 50 || v.y < blk.y0 - 50 || v.y > blk.y1 + 50) continue;
    for (let k = blk.b0; k < blk.b1; k++) {
      const B = city.buildings[k];
      if (B.style !== 'brick' || B.tier !== 1 || B.feat >= 0.45) continue;
      for (const e of escapesOf(city, k)) {
        const cx = e.ox + e.ux * BAY, cy = e.oy + e.uy * BAY;
        if (Math.hypot(cx - v.x, cy - v.y) > 50) continue;
        const flip = e.nx * e.uy - e.ny * e.ux > 0 ? 1 : -1;
        for (let f = 0; f <= e.top; f++) {
          const parts = escapeModel(f > 0, f < e.top ? (f & 1 ? -flip : flip) : 0, BAY, (f & 1) === 1);
          out.push({ o: { x: cx, y: cy, c: e.nx, s: e.ny, parts, r: 2, h: 4.6, seed: 0 }, far: 60, zoff: f * FLOOR_H });
        }
      }
    }
  }
  return out;
}









/** The news ticker's band, its letters' width and its speed (m/s). */
export const TICK_Z0 = 9.8, TICK_Z1 = 11, TICK_LW = 0.85, TICK_SPEED = 3.2;
export const SCREEN_PAL: RGB[] = [[255, 60, 130], [60, 200, 255], [255, 210, 60], [110, 255, 120], [190, 90, 255], [255, 120, 40], [240, 240, 255]];
export const RAMP = [C('.'), C(':'), C('-'), C('='), C('+'), C('*'), C('%'), C('#'), C('@')];
/** The scene showing on screen `id` now (it changes every 6 s): its kind (0 ad, 1 video, 2 color bars) and colors. */
function screenScene(id: number, sec: number) {
  const scene = Math.floor(sec / 6 + hash3(id, 0, 91) * 7);
  return { scene, kind: Math.floor(hash3(id, scene, 92) * 3), a: SCREEN_PAL[Math.floor(hash3(id, scene, 94) * SCREEN_PAL.length)], b: SCREEN_PAL[Math.floor(hash3(id, scene, 95) * SCREEN_PAL.length)], t: (sec % 6) };
}

/** Scaffolding: its distance from the wall, and the colors of its tubes, boards and nets (green, blue, white, orange, black, green). */
export const SCAF_D = 1, SCAF_STEEL: RGB = [140, 140, 150], SCAF_BOARD: RGB = [120, 95, 60];
export const NETS: RGB[] = [[50, 110, 70], [50, 80, 140], [170, 170, 165], [190, 100, 40], [35, 35, 40], [70, 120, 60]];

/**
 * What stands out of a facade, filled by reliefOf: a piece every P bays (from bay off, plus a
 * metres), w wide and d deep, between heights z0 and z1.
 */
export const REL = { P: 0, off: 0, a: 0, w: 0, d: 0, z0: 0, z1: 0 };
/** Oriel bays on some walk-ups, pilasters on old facades, piers on art deco offices (where the facade draws them). */
export function reliefOf(B: Building): boolean {
  const h = (B.feat * 7919) % 1;
  if (B.style === 'brick' && B.feat >= 0.45 && B.feat < 0.8 && B.h > 10 && B.ad < 0) {
    REL.P = 3 + Math.floor(h * 3); REL.off = 1; REL.a = 0.15; REL.w = 2 * BAY - 0.3; REL.d = 0.6; REL.z0 = FLOOR_H + 0.3; REL.z1 = B.h - 1.6;
  } else if (B.style === 'residential' && B.feat >= 0.6 && B.h > 7 && B.ad < 0) {
    const wide = h < 0.5 ? 1 : 2;
    REL.P = wide + 1 + (Math.floor(h * 4) % 2); REL.off = 0; REL.a = 0.15; REL.w = wide * BAY - 0.3; REL.d = 0.7; REL.z0 = FLOOR_H + 0.3; REL.z1 = B.h - 0.9;
  } else if (B.style === 'historic') {
    REL.P = 3; REL.off = 0; REL.a = 0; REL.w = 0.45; REL.d = 0.25; REL.z0 = FLOOR_H * 1.2; REL.z1 = B.h - 2.2;
  } else if (B.style === 'office' && B.feat > 0.6) {
    REL.P = 2; REL.off = 0; REL.a = 0; REL.w = 0.29; REL.d = 0.3; REL.z0 = FLOOR_H; REL.z1 = B.h - 1.3;
  } else return false;
  return REL.z1 > REL.z0 + 2;
}

let glFrame = 1;
function lightAt(x: number, y: number, z: number) {
  const zk = z <= 1 ? 1 : 1 - (z - 1) / (LIT_H - 1);
  LT[0] = LT[1] = LT[2] = 0;
  if (zk > 0) light.add(x, y, zk, LT);
  dyn.sample(x, y, z, LT);
  // lights add up (a car's headlights under a street lamp), but softly past a knee, keeping the
  // hue: the sum never burns out to flat white
  const m = Math.max(LT[0], LT[1], LT[2]);
  if (m > LIGHT_KNEE) { const k = (LIGHT_KNEE + (m - LIGHT_KNEE) * 0.3) / m; LT[0] *= k; LT[1] *= k; LT[2] *= k; }
  // against the sun, lamps, signs and headlights barely tell; daylight multiplies the colors later,
  // so their light is taken down first, or it burns into saturated yellow smears
  if (frameDay > 0) { const k = 1 - 0.85 * frameDay; LT[0] *= k; LT[1] *= k; LT[2] *= k; }
}
/** Where the summed light starts to be compressed. */
const LIGHT_KNEE = 150;

const SIGN_LETTER_LIGHT = 40, LEVELS: number[] = [];

/**
 * The power of building k's signs, ads, neon, screens and floodlights: like buildingPower, but a
 * backup generator does not run them (it keeps only the inside lit). Every new light that is
 * decoration or advertising must use this; lights inside use buildingPower.
 */
function signPower(world: World, k: number, sec: number) {
  const P = world.power, B = world.city.buildings[k];
  return power(P, P.building[k], (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, k, 0, sec)[0];
}

/** The electric light of building k at time sec (see power.ts). */
function buildingPower(world: World, k: number, sec: number) {
  const P = world.power, B = world.city.buildings[k];
  return power(P, P.building[k], (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, k, P.generator[k], sec)[0];
}


/**
 * Bus shelters and sidewalk sheds near the viewer: their roofs keep the rain off (see precip.ts).
 * The sheds (scaffolding over the sidewalk along a building's street faces) are also gathered as
 * objects, in pieces of SHED_SEG metres: a plywood deck on posts, with a bulb under it.
 */
export const SHED_Z = 3;
const SHED_SEG = 4.8, SHED_D = 2.6;
const sheds: Obj[] = [];
function gatherRoofs(world: World, v: View) {
  roofs.length = 0; sheds.length = 0;
  const { city } = world;
  for (const blk of city.blocks) {
    if (v.x < blk.x0 - 60 || v.x > blk.x1 + 60 || v.y < blk.y0 - 60 || v.y > blk.y1 + 60) continue;
    for (const p of blk.props) if (p.kind === 'shelter' && Math.hypot(p.x - v.x, p.y - v.y) < 40) roofs.push({ x: p.x, y: p.y, c: Math.cos(p.a), s: Math.sin(p.a), hx: 0.95, hy: 2.05, z: 2.3 });
    for (let k = blk.b0; k < blk.b1; k++) {
      const B = city.buildings[k];
      if (!B.shed) continue;
      for (let f = 0; f < 4; f++) {
        const gap = f === 0 ? B.x0 - blk.x0 : f === 1 ? blk.x1 - B.x1 : f === 2 ? B.y0 - blk.y0 : blk.y1 - B.y1;
        if (gap > SIDEWALK + 0.5) continue;
        const sp = faceSpan(B, f), lo = sp[0] + 0.3, hi = sp[1] - 0.3;
        if (hi - lo < 3) continue;
        const nx = f === 0 ? -1 : f === 1 ? 1 : 0, ny = f === 2 ? -1 : f === 3 ? 1 : 0, edge = f === 0 ? B.x0 : f === 1 ? B.x1 : f === 2 ? B.y0 : B.y1;
        const at = (a: number, out: number): [number, number] => (f < 2 ? [edge + nx * out, a] : [a, edge + ny * out]);
        const [mx, my] = at((lo + hi) / 2, SHED_D / 2);
        if (Math.hypot(mx - v.x, my - v.y) > 60 + (hi - lo) / 2) continue;
        // local +x out from the wall, +y along it (for the rain: one roof for the whole face)
        const c = nx, s = ny;
        roofs.push({ x: mx, y: my, c, s, hx: SHED_D / 2, hy: (hi - lo) / 2, z: SHED_Z });
        const n = Math.max(1, Math.round((hi - lo) / SHED_SEG)), seg = (hi - lo) / n;
        for (let q = 0; q < n; q++) {
          const [x, y] = at(lo + (q + 0.5) * seg, SHED_D / 2);
          if (Math.hypot(x - v.x, y - v.y) > SPRITE_FAR) continue;
          sheds.push({ x, y, c, s, parts: shedModel(seg), r: Math.hypot(SHED_D, seg) / 2 + 0.3, h: SHED_Z + 0.5, seed: 0 });
        }
      }
    }
  }
}

/** Security cameras are drawn this far. */
const CCTV_FAR = 140;
/** Rooftop billboards are drawn this far. */
const BOARD_FAR = 500;
const boardList: Obj[] = [];
/** The rooftop billboards within BOARD_FAR, lit by their lamps at night on their building's power. */
function gatherBoards(world: World, v: View, day: number): Obj[] {
  boardList.length = 0;
  const { city } = world;
  for (const blk of city.blocks) {
    if (blk.x1 < v.x - BOARD_FAR || blk.x0 > v.x + BOARD_FAR || blk.y1 < v.y - BOARD_FAR || blk.y0 > v.y + BOARD_FAR) continue;
    for (let k = blk.b0; k < blk.b1; k++) {
      const Bd = city.buildings[k].board;
      if (!Bd || Math.hypot(Bd.x - v.x, Bd.y - v.y) > BOARD_FAR) continue;
      const text = signText(city, Bd.biz, Math.floor((Bd.w - 0.8) / 0.9));
      if (text.length < 2) continue;
      const pal = Math.floor(hash3(k, Bd.biz, 79) * AD_BG.length);
      const lamp = Math.round(Math.max(0, Math.min(1, (1 - day) * signPower(world, k, frameSec))) * 8) / 8;
      const B = city.buildings[k];
      boardList.push({ x: Bd.x, y: Bd.y, c: Math.cos(Bd.a), s: Math.sin(Bd.a), parts: boardModel(text, Bd.w, Bd.h, B.h, Bd.z, AD_BG[pal], AD_FG[pal], lamp), r: Bd.w / 2 + 1.2, h: Bd.z + Bd.h + 0.1, z0: B.h, seed: k });
    }
  }
  // the cell sites' masts, their red lights blinking (on batteries, so through a blackout too)
  world.telco.sites.forEach((S, k) => {
    if (Math.hypot(S.x - v.x, S.y - v.y) > BOARD_FAR) return;
    const base = city.buildings[S.building].h, lit = (frameSec + k * 0.37) % 1.5 < 0.5;
    boardList.push({ x: S.x, y: S.y, c: 1, s: 0, parts: mastModel(base, lit), r: 1.8, h: base + 8.6, z0: base, seed: 9000 + k });
  });
  // the security cameras, panning, their red light blinking while they record
  world.cctv.forEach((C, k) => {
    if (Math.abs(C.x - v.x) > CCTV_FAR || Math.abs(C.y - v.y) > CCTV_FAR) return;
    const arm = Math.hypot(C.x - C.mx, C.y - C.my), a = Math.atan2(C.y - C.my, C.x - C.mx), yaw = cctvYaw(C, frameSec);
    boardList.push({ x: C.mx, y: C.my, c: Math.cos(a), s: Math.sin(a), parts: cctvMount(C.z, arm, C.kind === 0), r: arm + 0.2, h: C.z + 0.4, z0: C.kind === 0 ? 0 : C.z - 0.15, seed: 9700 + k });
    boardList.push({ x: C.x, y: C.y, c: Math.cos(yaw), s: Math.sin(yaw), parts: cctvModel(C.z, (frameSec + k * 0.29) % 2 < 1, CAMS[C.model].shape), r: 0.45, h: C.z + 0.15, z0: C.z - 0.22, seed: 9800 + k });
  });
  // the substations' yards
  world.power.subs.forEach((S, k) => {
    if (!S.yard || Math.hypot(S.x - v.x, S.y - v.y) > BOARD_FAR) return;
    const [D, W] = yardSize(S.yard);
    boardList.push({ x: S.x, y: S.y, c: Math.cos(S.yard.a), s: Math.sin(S.yard.a), parts: substationModel(D, W, S.on, yardFlood(S.on, day)), r: Math.hypot(D, W) / 2, h: 9.1, seed: 9500 + k });
  });
  return boardList;
}

/** A yard's depth (toward its street) and width. */
function yardSize(Y: { x0: number; y0: number; x1: number; y1: number; a: number }): [number, number] {
  const along = Math.abs(Math.cos(Y.a)) > 0.5;
  return along ? [Y.x1 - Y.x0, Y.y1 - Y.y0] : [Y.y1 - Y.y0, Y.x1 - Y.x0];
}
/** A yard's floodlight: on at night while the substation runs, in eighths. */
const yardFlood = (on: boolean, day: number) => (on ? Math.round(Math.max(0, 1 - day * 1.4) * 8) / 8 : 0);

/** This frame's moving and flickering lights: car headlights and tail lights, and the neon signs. */
function gatherLights(world: World, v: View, sec: number) {
  const { city } = world;
  dyn.begin(v.x, v.y);
  // the squared distance within which cars get a cone per headlamp: CAR_TWIN_FAR, or nearer when
  // more than CAR_TWIN_MAX are that close
  const near2: number[] = [];
  for (const c of world.cars) { const d2 = (c.x - v.x) ** 2 + (c.y - v.y) ** 2; if (d2 < CAR_TWIN_FAR * CAR_TWIN_FAR && c.kind !== 'bike') near2.push(d2); }
  const twinD2 = near2.length > CAR_TWIN_MAX ? near2.sort((a, b) => a - b)[CAR_TWIN_MAX - 1] : CAR_TWIN_FAR * CAR_TWIN_FAR;
  for (const c of world.cars) {
    carPose(c, v.alpha, POSE);
    const [x, y, dx, dy] = POSE;
    if (Math.abs(x - v.x) > CAR_LIGHT_FAR || Math.abs(y - v.y) > CAR_LIGHT_FAR) continue;
    const hl = c.len / 2, bike = c.kind === 'bike', fl = !bike && flashing(c, world.tick) ? 2.2 : 1, hw = halfW(c.kind) - 0.25;
    // a flash of the headlights: the high beams, brighter and further for a blink
    const range = bike ? 8 : 24 * (fl > 1 ? 1.6 : 1), hr = (bike ? 60 : 150) * fl, hg = (bike ? 58 : 140) * fl, hb = (bike ? 50 : 115) * fl;
    if (!bike && (x - v.x) ** 2 + (y - v.y) ** 2 <= twinD2) {
      // up close, a cone from each headlamp (each a little more than half the pair's light); the dipped
      // beam is asymmetric: the right lamp's reaches further and higher, a little toward the curb (the signs)
      for (const sd of [-hw, hw]) {
        const rt = sd > 0, ax = rt ? dx - dy * 0.08 : dx, ay = rt ? dy + dx * 0.08 : dy, an = Math.hypot(ax, ay);
        dyn.cone(x + dx * hl - dy * sd, y + dy * hl + dx * sd, ax / an, ay / an, 0.87, range * (rt ? 1.35 : 1), 1, rt ? 6 : 4, hr * 0.6, hg * 0.6, hb * 0.6);
      }
    } else dyn.cone(x + dx * hl, y + dy * hl, dx, dy, 0.87, range, 1, 4, hr, hg, hb);
    if (!bike) dyn.point(x - dx * (hl + 0.1), y - dy * (hl + 0.1), 4, 1, 2, 120, 12, 8);
    // the turn signal blinking amber at its front and back corners on that side
    if (!bike && blinkOn(c, sec)) {
      const sd = c.sig * hw;
      for (const f of [hl + 0.05, -hl - 0.05]) dyn.point(x + dx * f - dy * sd, y + dy * f + dx * sd, 2.5, 0.5, 1.5, 110, 60, 0);
    }
    // a police beacon throws red and blue around it in turns
    // a wreck's hazard lights blink amber
    if (c.wreck && Math.floor(sec * 1.6) & 1) dyn.point(x, y, 6, 1, 3, 150, 90, 10);
    if (c.beacon) { const red = (Math.floor(sec * 3) & 1) === 0; dyn.point(x, y, 14, 2, 8, red ? 140 : 20, red ? 15 : 30, red ? 15 : 160); }
  }
  // the substations' floodlights light their yards
  for (const S of world.power.subs) {
    if (!S.yard || Math.abs(S.x - v.x) > DYN_FAR || Math.abs(S.y - v.y) > DYN_FAR) continue;
    const f = yardFlood(S.on, daylight(world.time));
    if (f <= 0) continue;
    const [D, W] = yardSize(S.yard), c = Math.cos(S.yard.a), sn = Math.sin(S.yard.a), lx = D / 2 - 1.6, ly = W / 2 - 1.6;
    dyn.point(S.x + c * lx - sn * ly, S.y + sn * lx + c * ly, 16, 3, 9, 170 * f, 160 * f, 135 * f);
  }
  // a phone's screen lights the face of whoever is texting on it, close by
  for (const p of world.peds) {
    if ((p.use !== 2 && p.use !== 3) || Math.abs(p.x - v.x) > 25 || Math.abs(p.y - v.y) > 25) continue;
    dyn.point(p.x + p.dx * 0.3, p.y + p.dy * 0.3, 1.4, 1, 1.9, 22, 30, 44);
  }
  // each lit traffic light throws its color on the street in front of it (and on wet asphalt, far)
  forSignals(world, v, SIGNAL_LIGHT_FAR, (S) => {
    if (S.lit < 0) return;
    const col = SIG_GLOW[S.lit], mid = S.at[S.at.length >> 1];
    dyn.point(S.x - S.s * mid + S.c * 1.5, S.y + S.c * mid + S.s * 1.5, 9, 0.5, 7, col[0], col[1], col[2]);
  });
  // each sign lights the sidewalk in front of it and the wall around it, in its own color and flicker
  for (const blk of city.blocks) {
    if (blk.x1 < v.x - DYN_FAR || blk.x0 > v.x + DYN_FAR || blk.y1 < v.y - DYN_FAR || blk.y0 > v.y + DYN_FAR) continue;
    for (const p of blk.props) {
      if (p.kind !== 'blade') continue;
      const bi = city.businesses[p.seed].building, B = city.buildings[bi];
      const q = 0.3 * signLight(p.seed, signMode(city, p.seed), -1, signText(city, p.seed, 255).length, sec) * signPower(world, bi, sec);
      dyn.point(p.x + Math.cos(p.a) * 0.9, p.y + Math.sin(p.a) * 0.9, 6, 9, 12, B.sign[0] * q, B.sign[1] * q, B.sign[2] * q);
    }
    for (let k = blk.b0; k < blk.b1; k++) {
      const B = city.buildings[k];
      // the floodlights at its foot light whoever walks by (and the sidewalk round each lamp)
      if (B.flood && Math.hypot((B.x0 + B.x1) / 2 - v.x, (B.y0 + B.y1) / 2 - v.y) < FLOOD_LIGHT_FAR) {
        const q = 0.8 * signPower(world, k, sec), [fr, fg, fb] = B.flood;
        if (q > 0.01) floodSpots(B, (x, y, nx, ny) => dyn.flood(x, y, nx, ny, B.floodH, fr * q, fg * q, fb * q));
      }
      if (B.biz < 0 || B.round) continue;
      const K0 = B.cut;
      if (B.shop && Math.hypot((B.x0 + B.x1) / 2 - v.x, (B.y0 + B.y1) / 2 - v.y) < 60) {
        // the lit shop windows spill warm light on the sidewalk in front of them (faces on the street)
        const w = 0.3 * buildingPower(world, k, sec), blk = blockAt(city, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2);
        for (let f = 0; f < (K0 ? 5 : 4); f++) {
          const sp = faceSpan(B, f), lo = sp[0], hi = sp[1];
          if (hi - lo < 2) continue;
          const gap = !blk ? 0 : f === 0 ? B.x0 - blk.x0 : f === 1 ? blk.x1 - B.x1 : f === 2 ? B.y0 - blk.y0 : f === 3 ? blk.y1 - B.y1 : 0;
          if (gap > SIDEWALK + 0.5) continue;
          if (f === 4) dyn.segment(K0!.nx * K0!.c + K0!.ny * lo, K0!.ny * K0!.c - K0!.nx * lo, K0!.nx * K0!.c + K0!.ny * hi, K0!.ny * K0!.c - K0!.nx * hi, K0!.nx, K0!.ny, 5, 1.5, 4, 200 * w, 165 * w, 110 * w);
          else {
            const alongX = f >= 2, edge = f === 0 ? B.x0 : f === 1 ? B.x1 : f === 2 ? B.y0 : B.y1, out = f & 1 ? 1 : -1;
            dyn.segment(alongX ? lo : edge, alongX ? edge : lo, alongX ? hi : edge, alongX ? edge : hi, alongX ? 0 : out, alongX ? out : 0, 5, 1.5, 4, 200 * w, 165 * w, 110 * w);
          }
        }
      }
      const mode = signMode(city, B.biz), full = signText(city, B.biz, 255).length;
      if (B.screen && Math.hypot((B.x0 + B.x1) / 2 - v.x, (B.y0 + B.y1) / 2 - v.y) < 80) {
        // the screens wash the street with their current scene's color
        const S = screenScene(k, sec), q = 0.22 * signPower(world, k, sec), cr = (S.a[0] + S.b[0]) / 2 * q, cg = (S.a[1] + S.b[1]) / 2 * q, cb = (S.a[2] + S.b[2]) / 2 * q;
        for (let f = 0; f < (B.cut ? 5 : 4); f++) {
          if (!(B.screen & (1 << f))) continue;
          const sp = faceSpan(B, f), mid = (sp[0] + sp[1]) / 2, hw = Math.min(sp[1] - sp[0] - 1.5, 16) / 2, Kc = B.cut;
          if (f === 4) dyn.segment(Kc!.nx * Kc!.c + Kc!.ny * (mid - hw), Kc!.ny * Kc!.c - Kc!.nx * (mid - hw), Kc!.nx * Kc!.c + Kc!.ny * (mid + hw), Kc!.ny * Kc!.c - Kc!.nx * (mid + hw), Kc!.nx, Kc!.ny, 14, 6, 12, cr, cg, cb);
          else {
            const alongX = f >= 2, edge = f === 0 ? B.x0 : f === 1 ? B.x1 : f === 2 ? B.y0 : B.y1, out = f & 1 ? 1 : -1;
            dyn.segment(alongX ? mid - hw : edge, alongX ? edge : mid - hw, alongX ? mid + hw : edge, alongX ? edge : mid + hw, alongX ? 0 : out, alongX ? out : 0, 14, 6, 12, cr, cg, cb);
          }
        }
      }
      const [sr, sg, sb] = B.sign, q = 0.4 * signPower(world, k, sec), whole = signLight(B.biz, mode, -1, full, sec);
      // up close every letter lights the wall and sidewalk in front of it, so a failing tube dims
      // its own spot; farther away the sign is lit evenly, as a whole
      const near = Math.hypot((B.x0 + B.x1) / 2 - v.x, (B.y0 + B.y1) / 2 - v.y) < SIGN_LETTER_LIGHT;
      const K = B.cut;
      for (let f = 0; f < (K ? 5 : 4); f++) {
        const sp = faceSpan(B, f), lo = sp[0], hi = sp[1];
        const n = signText(city, B.biz, Math.floor((hi - lo - 1.2) / LETTER_W) - 2).length;
        if (n < 3) continue;
        const half = ((n + 2) * LETTER_W) / 2, mid = (lo + hi) / 2;
        // the letters in order of increasing coordinate, with the frame's padding at both ends
        const rev = f === 1 || f === 2; // same reading order as wallColumn
        let x0: number, y0: number, x1: number, y1: number, nx: number, ny: number;
        if (f === 4) {
          // points on the cut face are n * c + (ny, -nx) * u
          nx = K!.nx; ny = K!.ny;
          x0 = nx * K!.c + ny * (mid - half); y0 = ny * K!.c - nx * (mid - half);
          x1 = nx * K!.c + ny * (mid + half); y1 = ny * K!.c - nx * (mid + half);
        } else {
          const alongX = f >= 2, edge = f === 0 ? B.x0 : f === 1 ? B.x1 : f === 2 ? B.y0 : B.y1, out = f & 1 ? 1 : -1;
          x0 = alongX ? mid - half : edge; y0 = alongX ? edge : mid - half; x1 = alongX ? mid + half : edge; y1 = alongX ? edge : mid + half;
          nx = alongX ? 0 : out; ny = alongX ? out : 0;
        }
        if (near) {
          LEVELS.length = 0;
          for (let col = 0; col < n; col++) LEVELS[col + 1] = signLight(B.biz, mode, rev ? n - 1 - col : col, full, sec);
          LEVELS[0] = LEVELS[n + 1] = whole;
          dyn.pieces(x0, y0, x1, y1, nx, ny, 7, 3.5, 7, sr * q, sg * q, sb * q, LEVELS);
        } else dyn.segment(x0, y0, x1, y1, nx, ny, 7, 3.5, 7, sr * q * whole, sg * q * whole, sb * q * whole);
      }
    }
  }
}

/** Props of the blocks near the viewer, plus nearby cars. Far away they are too small to matter. */
/** Traffic lights are drawn this close (whole, or far off just their lit lamps) and cast their color this close; their glow on the street, red, yellow, green. */
const SIGNAL_LIGHT_FAR = 80, SIGNAL_FAR = 200, SIGNAL_NEAR = 60;
const SIG_GLOW: RGB[] = [[110, 14, 10], [100, 70, 10], [20, 100, 55]];
interface SignalPost { x: number; y: number; c: number; s: number; state: number; lit: number; at: number[]; cross: number }
/** cross: the light of the other road's traffic here (for the second walk signal). */
const SP: SignalPost = { x: 0, y: 0, c: 0, s: 0, state: 0, lit: -1, at: [], cross: Sig.Stop };
const atCache = new Map<string, number[]>();

/**
 * Every approach to the intersections within `far` of the viewer: a traffic light pole on the far
 * right corner, facing the oncoming cars, its arm (+y in its frame) over their lanes; or, at a
 * stop sign corner, the sign on the near right corner. On real time (the tick), like the sim.
 */
function forSignals(world: World, v: View, far: number, cb: (S: SignalPost) => void) {
  const { city } = world, sec = (world.tick + v.alpha) / 60;
  const NX = city.xb.length / 2, NY = city.yb.length / 2;
  for (let i = 0; i < NX; i++) {
    const X0 = city.xb[2 * i], X1 = city.xb[2 * i + 1];
    if (X1 < v.x - far || X0 > v.x + far) continue;
    for (let j = 0; j < NY; j++) {
      const Y0 = city.yb[2 * j], Y1 = city.yb[2 * j + 1];
      if (Y1 < v.y - far || Y0 > v.y + far) continue;
      const mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2;
      for (let hd = 0; hd < 4; hd++) {
        const [dx, dy] = DIRS[hd], pi = i - dx, pj = j - dy;
        if (pi < 0 || pj < 0 || pi >= NX || pj >= NY) continue; // no road comes in from off the map
        const aH = hd & 1 ? (Y1 - Y0) / 2 : (X1 - X0) / 2, halfW = hd & 1 ? (X1 - X0) / 2 : (Y1 - Y0) / 2;
        const pw = power(world.power, subAt(world.power, city, mx, my), mx, my, 700000 + i * 997 + j, 0, sec)[0];
        const st = shown(signal(city, world.power, i, j, hd & 1, sec), signal(city, world.power, i, j, hd & 1, sec, true), pw, sec), rx = -dy, ry = dx; // the right-hand side
        const ahead = st === Sig.Stop ? -(aH + 0.7) : aH + 0.7;
        SP.x = mx + dx * ahead + rx * (halfW + 0.7); SP.y = my + dy * ahead + ry * (halfW + 0.7);
        SP.c = -dx; SP.s = -dy;
        setState(st);
        SP.cross = shown(signal(city, world.power, i, j, (hd & 1) ^ 1, sec), signal(city, world.power, i, j, (hd & 1) ^ 1, sec, true), pw, sec);
        if (SP.cross === Sig.Yellow && st === Sig.Yellow) SP.cross = Sig.Dark; // flashing: the walk signs stay dark
        SP.at = lanesAt(Math.max(1, lanesOf(hd & 1 ? city.xb : city.yb, hd & 1 ? i : j)), halfW);
        if (Math.abs(diagS(city.diagonal, SP.x, SP.y)) < city.diagonal.w / 2 + 0.5) continue; // its corner is on the diagonal's roadway
        cb(SP);
      }
    }
  }
  // where the diagonal crosses: its own lights on the far right of each crossing, and the grid
  // road's at crossings between two intersections
  const D = diagRoad(city), d = city.diagonal, hw = d.w / 2;
  for (const z of D.zones) {
    diagPoint(d, (z.u0 + z.u1) / 2, 1, 0, Q2);
    if (Math.abs(Q2[0] - v.x) > far + 30 || Math.abs(Q2[1] - v.y) > far + 30) continue;
    if (z.x) continue; // a crossing inside an X: the X's own lights stand at its edges
    const zpw = power(world.power, subAt(world.power, city, Q2[0], Q2[1]), Q2[0], Q2[1], 800000 + z.key, 0, sec)[0];
    for (const dg of [1, -1]) {
      diagPoint(d, (dg > 0 ? z.u1 : z.u0) + dg * 0.7, dg, hw + 0.7, Q2);
      SP.x = Q2[0]; SP.y = Q2[1]; SP.c = -d.ex * dg; SP.s = -d.ey * dg;
      setState(shown(zoneSignal(city, world.power, z, true, sec), zoneSignal(city, world.power, z, true, sec, true), zpw, sec));
      SP.at = lanesAt(D.lanes, hw);
      cb(SP);
    }
    if (z.i >= 0 && !z.isX) continue;
    const b = z.vert ? city.xb : city.yb, rc = (b[2 * z.road] + b[2 * z.road + 1]) / 2, half = (b[2 * z.road + 1] - b[2 * z.road]) / 2;
    for (const hd of z.vert ? [1, 3] : [0, 2]) {
      const [dx, dy] = DIRS[hd], aFar = dx + dy > 0 ? z.a1 + 0.7 : z.a0 - 0.7;
      SP.x = z.vert ? rc - dy * (half + 0.7) : aFar; SP.y = z.vert ? aFar : rc + dx * (half + 0.7);
      SP.c = -dx; SP.s = -dy;
      setState(shown(zoneSignal(city, world.power, z, false, sec), zoneSignal(city, world.power, z, false, sec, true), zpw, sec));
      SP.at = lanesAt(Math.max(1, lanesOf(b, z.road)), half);
      cb(SP);
    }
  }
}
const Q2 = [0, 0];
/**
 * What a light shows, from what the traffic system says (`st`), the cycle it would be in (`raw`)
 * and its lamp's own power (`pw`, the blackout's wave): going dark one by one after the system is
 * already down, coming back one by one flashing yellow.
 */
function shown(st: number, raw: number, pw: number, sec: number): number {
  if (st === Sig.Stop) return st;
  if (pw < 0.35) return Sig.Dark;
  if (st === Sig.Dark) return raw;
  if (st === Sig.Flash) return Math.floor(sec * 1.25) & 1 ? Sig.Yellow : Sig.Dark;
  return st;
}
function setState(st: number) {
  SP.state = st; SP.lit = st === Sig.Green ? 2 : st === Sig.Yellow ? 1 : st === Sig.Red ? 0 : -1;
}
/** Heads over each of n lanes on a road half `halfW` wide, measured from a pole 0.7 m off its edge. */
function lanesAt(n: number, halfW: number) {
  const key = n + '|' + halfW;
  let at = atCache.get(key);
  if (!at) { at = []; for (let l = 0; l < n; l++) at.push(0.7 + halfW - LANE_W * (l + 0.5)); atCache.set(key, at); }
  return at;
}

/** A car's place and heading this frame (carPose). */
const POSE = [0, 0, 0, 0];
/** Half a vehicle's width by kind, for the lamps on its corners. */
const halfW = (kind: string) => (kind === 'bus' || kind === 'truck' ? 1.2 : kind === 'van' ? 1.0 : 0.9);
/** The view and the grid's strip, for collectObjects to skip what that strip cannot show. */
const CULL = { px: 0, py: 0, dirX: 1, dirY: 0, plane: 1, cols: 1, x0: 0, x1: 1, all: true };
/**
 * Can something at (x, y), reaching r metres, show in the columns this grid draws: with a strip
 * of a render worker (pool.ts), the objects outside it are not even built.
 */
function seen(x: number, y: number, r: number): boolean {
  const C = CULL;
  if (C.all) return true;
  const rx = x - C.px, ry = y - C.py, t = rx * C.dirX + ry * C.dirY;
  if (t < r + 0.5) return t > -r; // around the viewer: let drawing decide
  const sx = (C.cols / 2) * (1 + (-rx * C.dirY + ry * C.dirX) / (t * C.plane)), hw = (r * C.cols) / (2 * C.plane * t) + 1;
  return sx + hw >= C.x0 && sx - hw <= C.x1;
}

function collectObjects(world: World, v: View): Obj[] {
  const out: Obj[] = [];
  const { city } = world;
  const cl = (a: number, n: number) => Math.min(n - 1, Math.max(0, a | 0));
  const cx0 = city.xCell[cl(v.x - SPRITE_FAR, city.w)], cx1 = city.xCell[cl(v.x + SPRITE_FAR, city.w)];
  const cy0 = city.yCell[cl(v.y - SPRITE_FAR, city.h)], cy1 = city.yCell[cl(v.y + SPRITE_FAR, city.h)];
  for (let cy = cy0 | 1; cy <= cy1; cy += 2) for (let cx = cx0 | 1; cx <= cx1; cx += 2) {
    const blk = cityBlock(city, cx, cy);
    if (blk) for (const p of blk.props) {
      if (!seen(p.x, p.y, p.kind === 'tree' ? p.w + 1 : 4)) continue;
      if (p.kind === 'lamp') {
        // the head glows in its lamp's color, as bright and as warm as the lamp is right now
        const n = lampId(city, p), lv = Math.round(light.level[n] * 8) / 8, wm = Math.round(light.warm[n] * 8) / 8;
        const L = LAMP_LIGHT[p.lampType ?? 'hps'], hc = [0, 1, 2].map((k) => L.cold[k] + (L.warm[k] - L.cold[k]) * wm);
        const s = 255 / Math.max(...hc), head: RGB = [Math.max(30, hc[0] * s * lv), Math.max(30, hc[1] * s * lv), Math.max(30, hc[2] * s * lv)];
        out.push({ x: p.x, y: p.y, c: Math.cos(p.a), s: Math.sin(p.a), parts: lampModel(head), r: 2.1, h: 6.7, seed: 0 });
      }
      else if (p.kind === 'tree') out.push({ x: p.x, y: p.y, c: 1, s: 0, parts: treeModel(p.seed, p.w, p.z1), r: p.w * 0.75, h: p.z1, seed: p.seed });
      else if (p.kind === 'blade') {
        // lit and flickering like the business's shop sign (brightness in eighths, so models are reused)
        const bi = city.businesses[p.seed].building, B = city.buildings[bi], text = bladeText(city, p.seed), letter = p.z1 || BLADE_LETTER;
        const pw = signPower(world, bi, frameSec);
        const lit = Math.round(signLight(p.seed, signMode(city, p.seed), -1, signText(city, p.seed, 255).length, frameSec) * Math.min(1.25, pw) * 8) / 8;
        const sym = BLADE_SYMBOL[city.businesses[p.seed].kind] ?? -1;
        // a tall sign's edge bulbs climb, on the building's power
        const chase = letter > 1 && pw > 0.05 ? Math.floor(frameSec * 6) % 3 : letter > 1 ? 1.5 : 0;
        out.push({ x: p.x, y: p.y, c: Math.cos(p.a), s: Math.sin(p.a), parts: bladeModel(text, sym, [B.sign[0] * lit, B.sign[1] * lit, B.sign[2] * lit], BLADE_Z, letter, chase), r: bladeReach(letter) + 0.3, h: BLADE_Z + bladeHeight(text, sym, letter), seed: 0 });
      }
      else if (p.kind === 'debris') out.push({ x: p.x, y: p.y, c: Math.cos(p.a), s: Math.sin(p.a), parts: debrisModel(p.seed), r: 1.8, h: 1.2, seed: p.seed });
      else {
        const f = FURNITURE[p.kind];
        // the shelter's poster and the phone's sign are on the street's power
        const P = world.power, lit = p.kind === 'shelter' || p.kind === 'payphone' || p.kind === 'steps';
        const parts = lit ? poweredFurniture(p.kind, power(P, subAt(P, city, p.x, p.y), p.x, p.y, p.seed, 0, frameSec)[0]) : f.parts;
        out.push({ x: p.x, y: p.y, c: Math.cos(p.a), s: Math.sin(p.a), parts, r: f.r, h: f.h, seed: p.seed });
      }
    }
  }
  // the floodlights at the foot of lit facades (their lens lit in eighths, so the models are reused)
  for (let cy = cy0 | 1; cy <= cy1; cy += 2) for (let cx = cx0 | 1; cx <= cx1; cx += 2) {
    const blk = cityBlock(city, cx, cy);
    if (!blk) continue;
    for (let k = blk.b0; k < blk.b1; k++) {
      const B = city.buildings[k];
      if (!B.flood || Math.abs((B.x0 + B.x1) / 2 - v.x) > FLOOD_FIX_FAR + 60 || Math.abs((B.y0 + B.y1) / 2 - v.y) > FLOOD_FIX_FAR + 60) continue;
      const parts = wallFloodModel(B.flood, Math.round(Math.min(1, signPower(world, k, frameSec)) * 8) / 8);
      floodSpots(B, (x, y, nx, ny) => {
        if (Math.abs(x - v.x) < FLOOD_FIX_FAR && Math.abs(y - v.y) < FLOOD_FIX_FAR && seen(x, y, 0.5)) out.push({ x, y, c: nx, s: ny, parts, r: 0.35, h: 0.35, seed: 0 });
      });
    }
  }
  forSignals(world, v, SIGNAL_FAR, (S) => {
    if (!seen(S.x, S.y, 16)) return;
    const near = Math.hypot(S.x - v.x, S.y - v.y) < SIGNAL_NEAR;
    if (S.state === Sig.Stop) { if (near) out.push({ x: S.x, y: S.y, c: S.c, s: S.s, parts: STOP_SIGN, r: 0.5, h: 2.9, seed: 0 }); return; }
    if (!near && S.lit < 0) return;
    // the walk light shows the people across the street when they may cross alongside this traffic (blinking on its yellow)
    const walkOf = (st: number) => st === Sig.Green ? 1 : st === Sig.Yellow ? (Math.floor(frameSec * 2) & 1 ? 2 : 0) : st === Sig.Red ? 2 : 0;
    if (near) {
      // two walk signals, one for each crosswalk starting at this corner, facing the people at its far
      // end: one facing the traffic (the crosswalk alongside it), one along the arm (+y: across this
      // traffic's road beyond the intersection), turned a quarter for that
      out.push({ x: S.x, y: S.y, c: S.c, s: S.s, parts: SIGNAL_POLE, r: 0.25, h: 6.3, seed: 0 });
      out.push({ x: S.x, y: S.y, c: S.c, s: S.s, parts: walkSignal(walkOf(S.state)), r: 0.6, h: 3, z0: 2.35, seed: 0 });
      out.push({ x: S.x, y: S.y, c: -S.s, s: S.c, parts: walkSignal(walkOf(S.cross)), r: 0.6, h: 3, z0: 2.35, seed: 0 });
    }
    // the arm and its heads, around the arm's middle, hanging above the street (far off, just the lit lamps)
    const m = (Math.max(...S.at) + 0.4) / 2, at = S.at.map((y) => y - m);
    out.push({ x: S.x - S.s * m, y: S.y + S.c * m, c: S.c, s: S.s, parts: near ? signalModel(at, -m, S.lit) : signalFarModel(at, S.lit), r: m + 0.3, h: 6.2, z0: 4.7, seed: 0 });
  });
  for (const f of city.floodlights) {
    if (Math.abs(f.x - v.x) > SPRITE_FAR * 2 || Math.abs(f.y - v.y) > SPRITE_FAR * 2) continue;
    // lamps face the city
    const a = Math.atan2(city.h / 2 - f.y, city.w / 2 - f.x);
    out.push({ x: f.x, y: f.y, c: Math.cos(a), s: Math.sin(a), parts: FLOOD, r: 1.2, h: 14.2, seed: 0 });
  }
  // the people on the sidewalks, under umbrellas in the rain
  const W = world.weather, wet = W.precip > 0.1 && !W.snow;
  for (const p of world.peds) {
    const x = p.px + (p.x - p.px) * v.alpha, y = p.py + (p.y - p.py) * v.alpha;
    if (Math.abs(x - v.x) > PED_DRAW || Math.abs(y - v.y) > PED_DRAW || !seen(x, y, 1)) continue;
    const far = Math.abs(x - v.x) > PED_NEAR || Math.abs(y - v.y) > PED_NEAR, step = p.v > 0.1 ? Math.floor(p.stride / 0.45) & 3 : 0;
    out.push({ x, y, c: p.dx, s: p.dy, parts: pedModel(p.id, step, wet && (p.id & 7) < 6, far, far ? 0 : p.use === 3 && Math.floor(frameSec * 4) & 1 ? 2 : p.use), r: 0.8, h: 2.3, seed: 0 });
  }
  for (const c of world.cars) {
    // interpolate between ticks so motion is smooth at any frame rate (a driven car's body, near the player)
    carPose(c, v.alpha, POSE);
    const [x, y] = POSE;
    if (Math.abs(x - v.x) > SPRITE_FAR || Math.abs(y - v.y) > SPRITE_FAR || !seen(x, y, 8)) continue;
    const near = Math.abs(x - v.x) < CAR_NEAR && Math.abs(y - v.y) < CAR_NEAR, [hl, h] = VEHICLE_SIZE[c.kind];
    const who = c.id & 63;
    const parts = c.kind === 'bike' ? bikeModel(c.col, who, Math.floor(c.wheel / (Math.PI / 2)) & 3)
      : c.kind === 'sedan' || c.kind === 'taxi' ? (near ? carModel(c.col, c.taxi, who) : carFarModel(c.col, c.taxi)) : vehicleModel(c.kind, c.col, c.beacon ? 1 + (Math.floor(frameSec * 3) & 1) : 0, near ? who : 0);
    // the turn signal's lamps, front and back on its side, lit in the blink; the headlights flashing
    const blink = c.kind !== 'bike' && blinkOn(c, frameSec), flash = c.kind !== 'bike' && flashing(c, world.tick);
    const o: Obj = { x, y, c: POSE[2], s: POSE[3], parts: blink || flash ? [...parts, ...signalLamps(hl, halfW(c.kind), blink ? c.sig : 0, flash)] : parts, r: hl + 0.3, h: h + 0.1, seed: 0 };
    if (near) { o.pitch = c.pitch; o.roll = c.roll; o.lift = c.lift; o.wheel = c.wheel; }
    out.push(o);
  }
  return out;
}

function cityBlock(city: City, cx: number, cy: number) {
  const i = cx >> 1, j = cy >> 1;
  return i < city.nbx && j < city.nby ? city.blocks[j * city.nbx + i] : null;
}
