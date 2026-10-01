import { hash3 } from '../core/rng';
import { BAY, BLADE_LETTER, blockAt, BLADE_Z, BURN_START, diagS, faceSpan, FLOOR_H, LANE_W, lanesOf, SIDEWALK, type Building, type City, type RGB } from '../sim/city';
import { liftFloors, type World } from '../sim/world';
import { baseAt, cachedPlan, DOOR_H, doorOf, escapesOf, exitsOf, habitable, liftGlassAt, lotOf, planOf, type Door, type Plan } from '../sim/interior';
import { glassPass, insideLight, interiorColumn, peekCell, peekInto, prepareInside, roomGlow, sheenAt, windowHole, type Inside, type Peek } from './interior';
import { type CharGrid } from './grid';
import { BLOCK } from './atlas';
import { LAMP_LIGHT, lampId } from './lamps';
import { DynLights } from './lights';
import { LightWindow } from './lightmap';
import { bladeText } from '../locale/names';
import { bladeHeight, bladeModel, bladeReach, bikeModel, boardModel, carFarModel, carModel, VEHICLE_SIZE, vehicleModel, debrisModel, escapeModel, shedModel, FLOOD, FURNITURE, furnitureModel, lampModel, poweredFurniture, SIGNAL_POLE, signalFarModel, signalModel, STOP_SIGN, treeModel } from './models';
import { drawObjects, type Obj } from './objects';
import { type Look } from './palette';
import { drawFall, underRoof, type Roof } from './precip';
import { power } from './power';
import { subAt, type PowerGrid } from '../sim/power';
import { CURVE_R, drawCranes, sarcophagusColumn } from './sarcophagus';
import { prepareSky, skyColumn, type SkyFrame } from './sky';
import { BLADE_SYMBOL, BULB_COLS, BULB_ROWS, bulbGlyph, bulbOn, bulbsIn, fontRows, marqueeBulb, signLight, signMode, signText, SignMode } from './signs';
import { tickerText } from '../locale/news';
import { diagPoint, diagRoad, DIRS, Sig, signal, zoneSignal } from '../sim/traffic';

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
}

/** Vertical field of view. The horizontal one follows the window shape (wider window, wider view). */
const VFOV = (60 * Math.PI) / 180;
/** Beyond this the ground is plain haze. Buildings are traced to the city edge. */
const GROUND_FAR = 600;
/** Street furniture and cars are drawn only this close. */
const SPRITE_FAR = 250;
/** Cars closer than this get their full model (wheels, lamps); farther, a simple one. */
const CAR_NEAR = 70;
/** Headlights and tail lights light the street this close (farther, the lamps on the car still show). */
const CAR_LIGHT_FAR = 90;
/** Distance where building fog reaches ~63%. Long, so the skyline reads across the whole city. */
const FOG = 1500;
/** Street lamps light walls and objects up to this height, and this far from the viewer. */
const LIT_H = 9, LIT_FAR = 600;
/** Litter on the ground is drawn only this close. */
const LITTER_FAR = 14;
/** Height of a tower's lit crown band; width of an ad's letters; the ads' boards and paint. */
const CROWN_H = 16, AD_LETTER = 1.25;
const AD_BG: RGB[] = [[170, 40, 35], [35, 60, 130], [200, 170, 60], [215, 210, 195], [40, 100, 70], [25, 25, 30]];
const AD_FG: RGB[] = [[240, 230, 210], [240, 200, 70], [40, 30, 30], [180, 40, 35], [235, 225, 200], [230, 60, 60]];
const FRAME_AD: RGB = [60, 55, 50];
/** Spacing of the floodlights along the foot of a floodlit facade. */
const FLOOD_GAP = 6;

const C = (s: string) => s.charCodeAt(0);
const G = {
  dot: C('.'), com: C(','), tick: C('`'), col: C(':'), semi: C(';'), dash: C('-'), eq: C('='), plus: C('+'),
  hash: C('#'), pct: C('%'), at: C('@'), bar: C('|'), us: C('_'), star: C('*'), quo: C('"'), amp: C('&'),
  o: C('o'), lb: C('['), rb: C(']'), sl: C('/'), bs: C('\\'), caret: C('^'), x: C('x'), tilde: C('~'), lp: C('('), rp: C(')'),
};

/**
 * Litter items: glyph, color, shape (0 round, 1 flat rectangle, 2 long and thin) and half sizes in metres.
 * Colors are muted, so the street keeps its sodium palette.
 */
const LITTER: [number, number, number, number, number, number, number][] = [
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
/** Width of one letter on a shop sign, and the sign band's height above the sidewalk. */
const LETTER_W = 0.55, SIGN_Z0 = 2.6, SIGN_Z1 = 3.4;
// the current frame's city and time in seconds, for the signs
let frameTicker = '';
let frameCity: City, frameSec = 0, frameDay = 0, frameSnow = 0, frameInside = false, frameX = 0, frameY = 0;
/** Rooms are seen through the windows this close; floor plans not made yet are made a few per frame. */
const PEEK_FAR = 80, PLANS_PER_FRAME = 4;
let planBudget = 0;
const peeks: (Peek & { plan: Plan | null; state: number })[] = [0, 1].map(() => ({ d: 0, r: 0, u: 0, shade: 1, plan: null, state: 0 }));
const P4 = [0, 0, 0, 0], GL = [0, 0, 0];
let framePower: PowerGrid;
/** ASCII glyph -> block/box slot for the blocks mode; 0 keeps the glyph. */
const BLOCKS = new Uint8Array(256);
for (const [c, b] of [['@', BLOCK.full], ['#', BLOCK.dark], ['%', BLOCK.mid], [':', BLOCK.light], ['-', BLOCK.h], ['|', BLOCK.v],
  ['+', BLOCK.cross], ['=', BLOCK.dh], ['/', BLOCK.up], ['\\', BLOCK.down], ['x', BLOCK.x]] as const) BLOCKS[C(c)] = b;
// per-block ray hits, reused every column
const hitT = new Float64Array(1024);
const hitId = new Int32Array(1024);
const hitSide = new Uint8Array(1024);
const hitF = new Float64Array(1024);
/** Per column: distance to the window glass when indoors, so the rain is not drawn in the room. */
let nearT = new Float32Array(0);
/** This frame's roofs near the viewer that keep the rain off. */
const roofs: Roof[] = [];

export function renderWorld(grid: CharGrid, world: World, v: View) {
  const { cols, rows } = grid;
  const { city } = world;
  grid.clear();
  light.ensure(city, v.x, v.y);

  const dirX = Math.cos(v.yaw), dirY = Math.sin(v.yaw);
  // Rows per metre of height at distance 1, from the vertical FOV.
  const scale = rows / 2 / Math.tan(VFOV / 2);
  // tan(horizontal FOV / 2): the same focal length converted to columns by the cell aspect.
  const plane = ((cols / 2) * v.cellAspect) / scale;
  const plX = -dirY * plane, plY = dirX * plane;
  // y-shearing: the horizon moves by the vertical focal length times tan(pitch)
  const hor = rows / 2 + Math.tan(v.pitch) * scale;
  const eye = v.eye, px = v.x, py = v.y;
  // Stars live on a fixed ring of azimuth slots, one slot per column at screen center.
  const starSlots = Math.round(cols * Math.PI / Math.atan(plane));
  // metres covered by one column at distance 1, to pick the level of facade detail
  const colW = (2 * plane) / cols;
  const time = world.tick + v.alpha;
  frameCity = city; frameSec = time / 60; framePower = world.power; frameTicker = tickerText(world);
  const D = city.diagonal, diagGlyph = D.ex * D.ey > 0 ? G.bs : G.sl;
  const sky = prepareSky(city, world.power, world.weather, world.seed, world.ptime + (world.time - world.ptime) * v.alpha, frameSec);
  frameDay = sky.day;
  // what the weather leaves on the ground: wet streets that mirror the lights, splashes, snow
  const W = world.weather, wet = W.wet, snowC = (frameSnow = W.snowCover), rain = W.snow ? 0 : W.precip;
  light.update(frameSec, sky.day, world.power);
  gatherLights(world, v, frameSec);
  gatherRoofs(world, v);
  // indoors: the floor is drawn over the city, which shows only through the windows; the building's
  // own boxes (setbacks, rooftop parts) are left out of the city
  if (nearT.length !== cols) nearT = new Float32Array(cols); else nearT.fill(0);
  const kIn = baseAt(city, px, py), plan = kIn >= 0 ? planOf(city, kIn, v.floor) : null;
  let inside: Inside | null = null, skip: Building | null = null;
  if (plan) {
    skip = city.buildings[kIn];
    inside = { city, k: kIn, plan, base: skip, box: city.buildings[plan.box], boxId: plan.box, floor: v.floor, z0: v.lift ? v.z : v.floor * FLOOR_H, closed: v.lift, liftN: liftFloors(world), liftTo: world.player.liftTo, colW: (2 * plane) / cols, door: doorOf(city, kIn), exits: exitsOf(city, kIn), elec: buildingPower(world, kIn, frameSec), day: sky.day, sec: frameSec, rain };
    prepareInside(inside, px, py);
  }
  frameInside = !!inside;
  frameX = px; frameY = py; planBudget = PLANS_PER_FRAME;

  for (let x = 0; x < cols; x++) {
    const camX = (2 * (x + 0.5)) / cols - 1;
    const rdx = dirX + plX * camX, rdy = dirY + plY * camX, L = Math.hypot(rdx, rdy);

    // indoors the room comes first; the city fills only the cells its windows leave open
    if (inside) interiorColumn(grid, x, inside, px, py, rdx, rdy, eye, hor, scale, nearT);

    // ---- sky: gradient, stars, moon and clouds (sky.ts); below the horizon a dark base
    const az = v.yaw + Math.atan(camX * plane);
    const slot = Math.floor((((az / (2 * Math.PI)) % 1 + 1) % 1) * starSlots);
    skyColumn(grid, x, sky, az, rdx, rdy, px, py, eye, hor, scale, slot);
    sarcophagusColumn(grid, x, city, px, py, rdx, rdy, eye, hor, scale, frameSec, sky.day);
    for (let y = Math.max(0, Math.ceil(hor - 0.5)); y < rows; y++) grid.setBg(y * cols + x, 7, 8, 12);

    // ---- ground: each cell below the horizon maps to one point on the floor
    for (let y = Math.max(0, Math.ceil(hor - 0.5)); y < rows; y++) {
      const i = y * cols + x;
      // the ground falls away d^2 / 2R over the curve: eye - t*m = -(t*L)^2 / 2R, the near root
      // in a form that stays exact when the curve is slight
      const m = (y + 0.5 - hor) / scale, A = (L * L) / (2 * CURVE_R), disc = m * m - 4 * A * eye;
      const rd = disc > 0 ? (2 * eye) / (m + Math.sqrt(disc)) : 1e7;
      if (grid.depth[i] < rd) continue; // the Sarcophagus's foot, nearer than this far ground
      const wx = px + rdx * rd, wy = py + rdy * rd;
      grid.depth[i] = rd;
      if (wx < 0 || wy < 0 || wx >= city.w || wy >= city.h) { burnGround(grid, i, city, wx, wy, rd, time); continue; }
      if (rd > GROUND_FAR) { grid.put(i, G.dot, 28, 24, 32); continue; }
      const fog = 1 - (rd / GROUND_FAR) * 0.9;
      const cx = city.xCell[wx | 0], cy = city.yCell[wy | 0];
      const hv = hash3(Math.floor(wx * 1.2), Math.floor(wy * 1.2), 3);
      let ch = G.dot, r = 38, g = 38, b = 46;
      let dens = 0; // litter per 0.5 m square
      const roadX = !(cx & 1), roadY = !(cy & 1);
      // distance from the diagonal avenue's center line, and how far past its curb
      const sD = diagS(D, wx, wy), aD = Math.abs(sD), pastD = aD - D.w / 2;
      if (pastD < 0) {
        ch = hv < 0.5 ? G.dot : hv < 0.8 ? G.com : G.tick;
        if (!roadY && rd < 200) {
          // the diagonal between two cross streets, over an avenue too in an X (the crossings stay plain asphalt)
          const al = (wx - D.ox) * D.ex + (wy - D.oy) * D.ey, m = aD % LANE_W;
          if (aD < 0.3) { ch = diagGlyph; r = 210; g = 170; b = 60; }
          else if (pastD > -1.2) dens = 0.07;
          else if (Math.min(m, LANE_W - m) < 0.12 && aD < Math.floor(D.w / 2 / LANE_W) * LANE_W - 1 && Math.floor(al / 3) % 2 === 0) { ch = diagGlyph; r = 150; g = 150; b = 150; }
        }
      } else if (roadX || roadY) {
        ch = hv < 0.5 ? G.dot : hv < 0.8 ? G.com : G.tick;
        if (roadX !== roadY && rd < 200) {
          // a road segment between two intersections: center line, lane dashes, crosswalks at the ends
          const b0 = roadX ? city.xb : city.yb, bc = roadX ? cx : cy;
          const e0 = roadX ? city.yb : city.xb, ec = roadX ? cy : cx;
          const across = (roadX ? wx : wy) - (b0[bc] + b0[bc + 1]) / 2, along = roadX ? wy : wx;
          // a street segment ends at the cross streets, and where it meets the diagonal
          // (an avenue meets the diagonal at a shallow angle, in an X: its crosswalks are at the cross streets only)
          const a = Math.abs(across), end = Math.min(along - e0[ec], e0[ec + 1] - along, roadX ? 1e9 : pastD);
          const X = roadX ? xAt(city, bc >> 1) : null;
          const m = a % LANE_W;
          if (X && pastD < 0.25 && along > X.a0 && along < X.a1) { ch = G.bar; r = 175; g = 175; b = 175; } // in an X: the line where the diagonal's lanes end
          else if (end > 1 && end < 4.5) { if (Math.floor((across + 100) / 0.9) % 2 === 0) { ch = roadX ? G.eq : G.bar; r = 150; g = 150; b = 150; } }
          else if (X && a < (b0[bc + 1] - b0[bc]) / 2 - 0.3 && ((across < 0 && X.a0 - along > 4.6 && X.a0 - along < 5.05) || (across > 0 && along - X.a1 > 4.6 && along - X.a1 < 5.05))) {
            ch = G.eq; r = 170; g = 170; b = 170; // the X's stop lines, where the avenue's traffic waits for it
          }
          else if (end > 4.6 && end < 5.05 && a < (b0[bc + 1] - b0[bc]) / 2 - 0.3 && (along - e0[ec] < e0[ec + 1] - along ? across > 0 : across < 0) === roadX) {
            // the stop line, across the half of the road coming in to the intersection
            ch = roadX ? G.eq : G.bar; r = 170; g = 170; b = 170;
          }
          else if (a < 0.3) { ch = roadX ? G.bar : G.dash; r = 210; g = 170; b = 60; }
          else if ((b0[bc + 1] - b0[bc]) / 2 - a < 1.2) dens = 0.07; // the gutter collects what the wind blows
          else if (Math.min(m, LANE_W - m) < 0.12 && a < lanesOf(b0, bc >> 1) * LANE_W - 1 && Math.floor(along / 3) % 2 === 0) {
            ch = roadX ? G.bar : G.dash; r = 150; g = 150; b = 150;
          }
        }
      } else {
        const blk = city.blocks[(cy >> 1) * city.nbx + (cx >> 1)];
        const edge = Math.min(wx - blk.x0, blk.x1 - wx, wy - blk.y0, blk.y1 - wy, blk.diag ? pastD : 1e9);
        if (edge < SIDEWALK) {
          const fx = wx / 1.5 - Math.floor(wx / 1.5), fy = wy / 1.5 - Math.floor(wy / 1.5);
          ch = fx < 0.08 || fy < 0.08 ? G.plus : G.col; r = 78; g = 74; b = 78;
          dens = city.districts[blk.district].type === 'industrial' ? 0.06 : 0.025;
        } else if (blk.diag & (sD > 0 ? 4 : 2)) {
          // plaza on the sliver the diagonal cut off; the square's are granite in a checker of two greys
          const fx = wx / 2.5 - Math.floor(wx / 2.5), fy = wy / 2.5 - Math.floor(wy / 2.5);
          ch = fx < 0.06 || fy < 0.06 ? G.plus : G.col; r = 92; g = 86; b = 80;
          if (blk.square) { const dark = (Math.floor(wx / 2.5) + Math.floor(wy / 2.5)) & 1; r = dark ? 62 : 108; g = dark ? 60 : 104; b = dark ? 66 : 108; if (!dark && fx > 0.45 && fx < 0.55 && fy > 0.45 && fy < 0.55) ch = G.o; }
        } else if (blk.open === 'park') {
          dens = 0.01;
          const mx = (blk.x0 + blk.x1) / 2, my = (blk.y0 + blk.y1) / 2;
          if (Math.abs(wx - mx) < 1.5 || Math.abs(wy - my) < 1.5) { ch = hv < 0.5 ? G.dot : G.com; r = 95; g = 85; b = 70; } // gravel paths
          else { ch = hv < 0.4 ? G.quo : hv < 0.7 ? G.com : G.semi; r = 40; g = 95 + hv * 40; b = 45; }
        } else if (blk.open === 'plaza') {
          // stone slabs
          const fx = wx / 2.5 - Math.floor(wx / 2.5), fy = wy / 2.5 - Math.floor(wy / 2.5);
          ch = fx < 0.06 || fy < 0.06 ? G.plus : G.col; r = 92; g = 86; b = 80;
        } else if (blk.open === 'yard') {
          // rail tracks along the block's long side: two rails on sleepers, 4.5 m apart
          const long = blk.x1 - blk.x0 > blk.y1 - blk.y0;
          const a = ((long ? wy : wx) - (long ? blk.y0 : blk.x0)) % 4.5, u = long ? wx : wy;
          if (Math.abs(a - 1.5) < 0.12 || Math.abs(a - 2.95) < 0.12) { ch = long ? G.eq : G.bar; r = 120; g = 115; b = 115; }
          else if (a > 1.2 && a < 3.3 && u % 0.8 < 0.25) { ch = long ? G.bar : G.eq; r = 70; g = 52; b = 40; }
          else { ch = hv < 0.6 ? G.dot : G.com; r = 55; g = 50; b = 48; }
        } else { ch = hv < 0.7 ? G.dot : G.com; r = 50; g = 48; b = 52; }
      }
      if (dens && rd < LITTER_FAR) {
        // litter: at most one item per 0.5 m square, fixed to the ground; at a distance an item
        // grows to the ground one row covers, so it does not slip between rows
        const gx = Math.floor(wx * 2), gy = Math.floor(wy * 2), h = hash3(gx, gy, 17);
        if (h < dens) {
          const L = LITTER[Math.floor(hash3(gx, gy, 18) * LITTER.length)];
          // a random spot and turn inside the square
          const half = Math.max(L[5], L[6]), room = Math.max(0, 0.5 - 2 * half);
          const ux = wx - (gx / 2 + half + room * hash3(gx, gy, 19)), uy = wy - (gy / 2 + half + room * hash3(gx, gy, 20));
          const ang = hash3(gx, gy, 21) * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang);
          const u = Math.abs(ux * ca + uy * sa), w = Math.abs(-ux * sa + uy * ca);
          const e = ((rd * rd) / (eye * scale)) * 0.5;
          const hit = L[4] === 0 ? Math.hypot(u, w) < Math.max(L[5], e) : u < Math.max(L[5], e) && w < Math.max(L[6], e);
          if (hit) { ch = L[0]; r = L[1]; g = L[2]; b = L[3]; }
        }
      }
      let lk = 1;
      if (snowC > 0.02) {
        // snow lies thickest on sidewalks and in parks; traffic keeps the roadway half clear
        const sk = snowC * (roadX || roadY || pastD < 0 ? 0.5 : 1);
        r += (200 - r) * sk; g += (205 - g) * sk; b += (218 - b) * sk;
        // a snowy surface reads as dense, pale glyphs; markings and litter disappear under it
        if (sk > 0.35) ch = hv < 0.55 ? G.col : hv < 0.85 ? G.semi : G.dot;
      }
      if (wet > 0.02) {
        // wet asphalt is darker and throws the lamps' light back, rippling while it rains
        const wk = wet * (1 - snowC);
        r *= 1 - 0.35 * wk; g *= 1 - 0.35 * wk; b *= 1 - 0.3 * wk;
        lk = 1 + 1.1 * wk * (rain > 0 ? 0.75 + 0.25 * Math.sin(frameSec * 7 + hv * 30) : 1);
        if (rain > 0 && rd < 22 && !(roofs.length && underRoof(roofs, wx, wy, 0.1))) {
          // splashes: a ring and a drop for a blink, here and there, more in a downpour
          // a ring that grows from a random spot of each 0.33 m square; a cell at a distance covers
          // more ground (e), so there it shrinks to a dot
          const gx = Math.floor(wx * 3), gy = Math.floor(wy * 3), ph = (frameSec * 2.3 + hash3(gx, gy, 41)) % 1;
          if (hash3(gx, gy, 42) < rain * 0.3 && ph < 0.09) {
            const d = Math.hypot(wx - (gx + 0.2 + 0.6 * hash3(gx, gy, 43)) / 3, wy - (gy + 0.2 + 0.6 * hash3(gx, gy, 44)) / 3);
            const e = ((rd * rd) / (eye * scale)) * 0.5, rr = 0.02 + ph * 1.1;
            if (Math.abs(d - rr) < Math.max(0.015, e)) { ch = rr < 0.05 || e > 0.04 ? G.tick : G.o; r = g = 150; b = 165; }
          }
        }
      }
      lightAt(wx, wy, 0);
      grid.put(i, ch, (r + LT[0] * lk) * fog, (g + LT[1] * lk) * fog, (b + LT[2] * lk) * fog);
    }

    // ---- walls: walk the street grid front to back. Inside each block, hit its buildings in
    // distance order; keep going past near buildings to find taller ones behind.
    const { xb, yb } = city;
    const ix = rdx !== 0 ? 1 / rdx : 1e12, iy = rdy !== 0 ? 1 / rdy : 1e12;
    const stX = rdx < 0 ? -1 : 1, stY = rdy < 0 ? -1 : 1;
    let cx = city.xCell[Math.min(city.w - 1, Math.max(0, px | 0))], cy = city.yCell[Math.min(city.h - 1, Math.max(0, py | 0))];
    let tx = ((rdx < 0 ? xb[cx] : xb[cx + 1]) - px) * ix, ty = ((rdy < 0 ? yb[cy] : yb[cy + 1]) - py) * iy;
    let tIn = 0, clipTop = rows;
    for (;;) {
      if ((cx & 1) && (cy & 1)) {
        const blk = city.blocks[(cy >> 1) * city.nbx + (cx >> 1)];
        // skip the block when even its tallest building would be hidden behind what is already drawn
        // (seen from above, a block's highest row is its far side)
        const tE = blk.maxH > eye ? Math.max(tIn, 0.1) : Math.min(tx, ty);
        if (blk.b1 > blk.b0 && hor - ((blk.maxH - eye) * scale) / tE < clipTop) {
          let n = 0;
          for (let k = blk.b0; k < blk.b1; k++) {
            const B = city.buildings[k];
            if (skip && B.x0 >= skip.x0 - 0.01 && B.x1 <= skip.x1 + 0.01 && B.y0 >= skip.y0 - 0.01 && B.y1 <= skip.y1 + 0.01) continue;
            let tNear: number, side: number, tOut: number;
            if (B.round) {
              // upright cylinder inscribed in the box: nearest root of |p + t*d - c| = r
              const rr = (B.x1 - B.x0) / 2, ox = px - (B.x0 + rr), oy = py - (B.y0 + rr);
              const qa = rdx * rdx + rdy * rdy, qb = ox * rdx + oy * rdy, disc = qb * qb - qa * (ox * ox + oy * oy - rr * rr);
              if (disc <= 0) continue;
              tNear = (-qb - Math.sqrt(disc)) / qa; side = 2; tOut = (-qb + Math.sqrt(disc)) / qa;
              if (tNear <= 0.01) continue;
            } else {
              const ax = (B.x0 - px) * ix, bx = (B.x1 - px) * ix, ay = (B.y0 - py) * iy, by = (B.y1 - py) * iy;
              const nx = Math.min(ax, bx), ny = Math.min(ay, by);
              let tFar = Math.min(Math.max(ax, bx), Math.max(ay, by));
              tNear = Math.max(nx, ny);
              side = nx > ny ? 0 : 1;
              const K = B.cut;
              if (K) {
                // also inside the half-plane of the cut: entering it may be the nearest face (side 3)
                const dn = K.nx * rdx + K.ny * rdy, th = (K.c - K.nx * px - K.ny * py) / dn;
                if (dn < 0) { if (th > tNear) { tNear = th; side = 3; } }
                else if (dn > 0) tFar = Math.min(tFar, th);
                else if (K.nx * px + K.ny * py > K.c) continue;
              }
              if (tNear <= 0.01 || tNear >= tFar) continue;
              tOut = tFar;
            }
            let s = n++;
            while (s > 0 && hitT[s - 1] > tNear) { hitT[s] = hitT[s - 1]; hitId[s] = hitId[s - 1]; hitSide[s] = hitSide[s - 1]; hitF[s] = hitF[s - 1]; s--; }
            hitT[s] = tNear; hitId[s] = k; hitSide[s] = side; hitF[s] = tOut;
          }
          for (let s = 0; s < n && clipTop > 0; s++) {
            const t = hitT[s], id = hitId[s], B = city.buildings[id];
            // far buildings sink a little over the curve of the ground
            const eyeD = eye + (t * L) ** 2 / (2 * CURVE_R);
            const yt = hor - ((B.h - eyeD) * scale) / t, yb2 = hor + (eyeD * scale) / t;
            const top = Math.ceil(yt - 0.5);
            const y0 = Math.max(0, top), y1 = Math.min(rows, Math.ceil(yb2 - 0.5), clipTop);
            // seen from above: the roof, from the near edge back to the far one, or to a taller
            // box standing on it (a setback, a water tank), which then rises from the roof
            let roofTop = top;
            if (eyeD > B.h + 0.05) {
              let tf = hitF[s];
              for (let q = s + 1; q < n; q++) if (hitT[q] < tf && city.buildings[hitId[q]].h > B.h) { tf = hitT[q]; break; }
              roofTop = Math.max(0, Math.ceil(hor - ((B.h - eyeD) * scale) / tf - 0.5));
              roofRows(grid, x, B, roofTop, Math.min(top, clipTop, rows), px, py, rdx, rdy, eyeD, hor, scale);
            }
            if (y0 < y1) {
              const side = hitSide[s];
              let along: number, lightK: number, face = 0, rev = false, dn: number;
              const hx = px + t * rdx, hy = py + t * rdy;
              if (side === 2) {
                // position around the cylinder in metres of arc; lit like a box face turned the same way
                const rr = (B.x1 - B.x0) / 2, nx = (hx - B.x0 - rr) / rr, ny = (hy - B.y0 - rr) / rr;
                along = (Math.atan2(ny, nx) + Math.PI) * rr; lightK = 0.72 + 0.28 * Math.abs(nx); dn = 1;
              } else if (side === 3) {
                // the face along the diagonal: measured along (ny, -nx), which reads left to right
                const K = B.cut!;
                along = hx * K.ny - hy * K.nx; lightK = 0.72 + 0.28 * Math.abs(K.nx); face = 4; dn = K.nx * rdx + K.ny * rdy;
              } else {
                along = side === 0 ? hy : hx; lightK = side ? 0.72 : 1;
                rev = side === 0 ? rdx < 0 : rdy > 0; face = side === 0 ? (rdx < 0 ? 1 : 0) : (rdy > 0 ? 2 : 3); dn = side === 0 ? rdx : rdy;
              }
              wallColumn(grid, x, B, id, t, side, face, lightK, along, y0, y1, top, hor, scale, eyeD, colW, rev, (colW * t) / Math.max(1e-6, Math.abs(dn)), hx, hy);
            }
            clipTop = Math.min(clipTop, Math.max(0, Math.min(top, roofTop)));
          }
          if (clipTop <= 0) break;
        }
      }
      if (tx < ty) { cx += stX; tIn = tx; if (cx < 0 || cx >= xb.length - 1) break; tx = ((rdx < 0 ? xb[cx] : xb[cx + 1]) - px) * ix; }
      else { cy += stY; tIn = ty; if (cy < 0 || cy >= yb.length - 1) break; ty = ((rdy < 0 ? yb[cy] : yb[cy + 1]) - py) * iy; }
    }

    fenceColumn(grid, x, city, px, py, rdx, rdy, hor, scale, eye);
  }

  drawSmoke(grid, city, v, dirX, dirY, plX, plY, plane, scale, hor, time);
  drawCranes(grid, city, v.x, v.y, eye, dirX, dirY, plX, plY, scale, hor, frameSec);
  const lit = (x: number, y: number, z: number) => { lightAt(x, y, z); return LT; };
  drawObjects(grid, collectObjects(world, v), { x: px, y: py, eye, dirX, dirY, plX, plY, plane, scale, hor, far: SPRITE_FAR, light: lit, snow: snowC });
  drawEscapes(grid, world, v, dirX, dirY, plX, plY, plane, scale, hor);
  const boardObjs = gatherBoards(world, v, sky.day);
  if (boardObjs.length) drawObjects(grid, boardObjs, { x: px, y: py, eye, dirX, dirY, plX, plY, plane, scale, hor, far: BOARD_FAR, light: lit, snow: snowC });
  if (sheds.length) drawObjects(grid, sheds, { x: px, y: py, eye, dirX, dirY, plX, plY, plane, scale, hor, far: SPRITE_FAR, light: lit, snow: snowC });
  if (inside) {
    // the floor's furniture, lit by its rooms' lamps
    const I = inside, objs: Obj[] = I.plan.furn.map((f) => ({ x: f.x, y: f.y, c: f.c, s: f.s, parts: furnitureModel(f.kind, f.seed, f.hx, f.hy), r: Math.hypot(f.hx, f.hy) + 0.4, h: 2, seed: f.seed }));
    drawObjects(grid, objs, { x: px, y: py, eye: eye - I.z0, dirX, dirY, plX, plY, plane, scale, hor, far: 40, light: (x, y) => insideLight(I, x, y), mul: true });
    glassPass(grid, inside, eye, hor, scale);
  }
  finish(grid, v.look, sky);
  // after finish, so the drops keep the background of what is behind them
  drawFall(grid, { amount: W.precip, snow: W.snow, windX: W.windX, windY: W.windY, sec: frameSec, flash: sky.flash }, px, py, eye, v.yaw, plane, scale, hor, lit, nearT, roofs);
}

/** Display modes applied to the finished frame: solid backgrounds under world cells, block glyphs. */
function finish(grid: CharGrid, look: Look, sky: SkyFrame) {
  const { cells, bg, depth } = grid;
  // by day the world is brighter and sinks into a pale haze with distance: the "service" look
  const day = sky.day;
  for (let i = 0, k = 0; i < depth.length; i++, k += 4) {
    if (sky.moonlight > 0.02 && depth[i] < 1e9 && depth[i] > 0) {
      // the moon's cold light on everything: faint, it only tells once the city lights are out
      const m = sky.moonlight * (1 - 0.7 * sky.cloud) * 14;
      cells[k + 1] += m * 0.7; cells[k + 2] += m * 0.8; cells[k + 3] += m * 1.15;
    }
    if ((day > 0.01 || sky.flash > 0) && depth[i] < 1e9) {
      const f = day * (0.25 + 0.6 * (1 - Math.exp(-depth[i] / 1500))), amb = 1 + 0.7 * day + sky.flash * 0.6;
      cells[k + 1] = cells[k + 1] * amb * (1 - f) + 138 * f; cells[k + 2] = cells[k + 2] * amb * (1 - f) + 146 * f; cells[k + 3] = cells[k + 3] * amb * (1 - f) + 156 * f;
    }
    if (look.solid && depth[i] < 1e9) { bg[k] = cells[k + 1] * look.solid; bg[k + 1] = cells[k + 2] * look.solid; bg[k + 2] = cells[k + 3] * look.solid; }
    if (look.blocks && BLOCKS[cells[k]]) cells[k] = BLOCKS[cells[k]];
  }
}

/** Scorched ground outside the fence, split by cracks that glow where the coal burns underneath. */
function burnGround(grid: CharGrid, i: number, city: City, wx: number, wy: number, rd: number, time: number) {
  const out = Math.max(-wx, wx - city.w, -wy, wy - city.h);
  const fog = 1 - Math.min(1, rd / 2500) * 0.85;
  const hv = hash3(Math.floor(wx * 1.2), Math.floor(wy * 1.2), 5);
  let ch = hv < 0.6 ? G.dot : hv < 0.85 ? G.com : G.tick, r = 42 * fog, g = 32 * fog, b = 30 * fog;
  const heat = Math.min(1, Math.max(0, (out - BURN_START) / 200));
  if (heat > 0) {
    // cracks are the edges of a cellular pattern: where the two nearest feature points are almost equally far
    const S = 14, gx = Math.floor(wx / S), gy = Math.floor(wy / S);
    let d1 = 1e9, d2 = 1e9, near = 0;
    for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const cx = gx + k, cy = gy + j;
      const d = Math.hypot((cx + hash3(cx, cy, 11)) * S - wx, (cy + hash3(cx, cy, 12)) * S - wy);
      if (d < d1) { d2 = d1; d1 = d; near = hash3(cx, cy, 13); } else if (d < d2) d2 = d;
    }
    // far away a crack is thinner than a cell: widen it and dim it so it reads as a glow line
    const width = 0.7 + rd * 0.004;
    if (d2 - d1 < width && near < 0.75) {
      const k = heat * (0.55 + 0.45 * Math.sin(time * 0.05 + near * 40)) * (0.6 + 0.4 * fog) * Math.min(1, 1.2 / (1 + rd * 0.002));
      ch = d2 - d1 < width * 0.4 && rd < 150 ? G.star : G.eq;
      r = 60 + 220 * k; g = 30 + 90 * k * k; b = 20 + 20 * k;
    }
  }
  grid.put(i, ch, r, g, b);
}

/**
 * The cordon fence on the city edge, seen from inside: chain link on posts with barbed wire on top.
 * Drawn after the walls and only where nothing nearer was drawn, so the burning ground shows through.
 */
function fenceColumn(grid: CharGrid, x: number, city: City, px: number, py: number, rdx: number, rdy: number, hor: number, scale: number, eye: number) {
  const tX = rdx > 0 ? (city.w - px) / rdx : rdx < 0 ? -px / rdx : 1e9;
  const tY = rdy > 0 ? (city.h - py) / rdy : rdy < 0 ? -py / rdy : 1e9;
  const t = Math.min(tX, tY);
  if (t <= 0.05 || t > 2000) return;
  const along = tX < tY ? py + t * rdy : px + t * rdx;
  const H = 4.2;
  eye += (t * Math.hypot(rdx, rdy)) ** 2 / (2 * CURVE_R); // the fence far off sinks with the ground
  const y0 = Math.max(0, Math.ceil(hor - ((H - eye) * scale) / t - 0.5)), y1 = Math.min(grid.rows, Math.ceil(hor + (eye * scale) / t - 0.5));
  const post = along % 3 < 0.15 + t * 0.002, k = 1 - Math.min(1, t / 1500) * 0.7;
  for (let y = y0; y < y1; y++) {
    const i = y * grid.cols + x;
    if (grid.depth[i] <= t) continue;
    const z = eye + ((hor - (y + 0.5)) / scale) * t;
    let ch = 0;
    if (z > H - 0.5) ch = Math.floor(along / 0.4) & 1 ? G.x : G.tilde; // barbed wire
    else if (post) ch = G.bar;
    else if (t < 30) {
      // chain link: two sets of diagonal wires 0.6 m apart; thinner than a cell further away, so it fades out
      const a = (((along + z) % 0.6) + 0.6) % 0.6 < 0.07, b = (((along - z) % 0.6) + 0.6) % 0.6 < 0.07;
      ch = a && b ? G.x : a ? G.sl : b ? G.bs : 0;
    }
    if (!ch) continue;
    grid.put(i, ch, 120 * k, 120 * k, 130 * k);
    grid.depth[i] = t;
  }
}

/**
 * Smoke columns rising from the vents of the burning seam, seen from far away: sparse glyphs
 * drifting upward, glowing orange at the base.
 */
function drawSmoke(grid: CharGrid, city: City, v: View, dirX: number, dirY: number, plX: number, plY: number, plane: number, scale: number, hor: number, time: number) {
  const { cols, rows } = grid;
  const invDet = 1 / (plX * dirY - dirX * plY);
  for (const s of city.vents) {
    const rx = s.x - v.x, ry = s.y - v.y;
    const tY = invDet * (-plY * rx + plX * ry);
    if (tY < 5) continue;
    const tX = invDet * (dirY * rx - dirX * ry);
    const cx = (cols / 2) * (1 + tX / tY), colsPerM = cols / 2 / plane / tY;
    const eyeS = v.eye + (rx * rx + ry * ry) / (2 * CURVE_R); // sunk by the curve
    const top = hor - ((s.h - eyeS) * scale) / tY, bot = hor + (eyeS * scale) / tY;
    const maxHalf = s.r * 2.2 * colsPerM;
    const x0 = Math.max(0, Math.floor(cx - maxHalf)), x1 = Math.min(cols, Math.ceil(cx + maxHalf));
    const y0 = Math.max(0, Math.ceil(top - 0.5)), y1 = Math.min(rows, Math.ceil(bot - 0.5));
    if (x0 >= x1 || y0 >= y1) continue;
    const fog = 1 - Math.min(1, tY / 2500) * 0.7;
    for (let y = y0; y < y1; y++) {
      const vv = (y + 0.5 - top) / (bot - top); // 0 at the top of the column, 1 at the ground
      const rise = 1 - vv;
      // the column widens and leans downwind as it rises
      const half = s.r * (0.5 + 1.7 * rise) * colsPerM, mid = cx + rise * rise * s.r * 1.5 * colsPerM;
      const row = Math.floor(vv * 30 + time * 0.03 * (30 / Math.max(1, s.h / 10)));
      for (let x = Math.max(x0, Math.floor(mid - half)); x < Math.min(x1, Math.ceil(mid + half)); x++) {
        const i = y * cols + x;
        if (grid.depth[i] <= tY) continue;
        const u = (x + 0.5 - mid) / half; // -1 .. 1 across the column
        const dens = (1 - u * u) * (0.25 + 0.75 * vv);
        // color only, like the clouds (glyphs made it stand apart from the sky): the cell behind is
        // veiled by the smoke, in puffs that rise, glowing orange at the base
        const hh = hash3(Math.floor(u * 5 + s.x), row, s.y | 0);
        const a = dens * 0.55 * (0.55 + 0.45 * hh);
        if (a < 0.02) continue;
        const glow = vv > 0.7 ? (vv - 0.7) / 0.3 : 0;
        const g0 = (60 + 30 * vv) * fog, sr = g0 + 120 * glow, sg = g0 + 40 * glow, sb = g0 * 1.05;
        const k = i * 4, { cells, bg } = grid;
        grid.setBg(i, bg[k] + (sr - bg[k]) * a, bg[k + 1] + (sg - bg[k + 1]) * a, bg[k + 2] + (sb - bg[k + 2]) * a);
        if (cells[k] !== 32 && cells[k] !== 0) grid.put(i, cells[k], cells[k + 1] + (sr - cells[k + 1]) * a, cells[k + 2] + (sg - cells[k + 2]) * a, cells[k + 3] + (sb - cells[k + 3]) * a);
      }
    }
  }
}

/** A flat roof seen from above, rows ya..yb of column x: tar and gravel inside a pale parapet. */
function roofRows(grid: CharGrid, x: number, B: Building, ya: number, yb: number, px: number, py: number, rdx: number, rdy: number, eye: number, hor: number, scale: number) {
  for (let y = ya; y < yb; y++) {
    const i = y * grid.cols + x, m = (y + 0.5 - hor) / scale;
    if (m <= 0) continue;
    const t = (eye - B.h) / m;
    if (frameInside && grid.depth[i] < t + 0.5) continue;
    const wx = px + rdx * t, wy = py + rdy * t, fogK = 1 - Math.exp(-t / FOG), k = 1 - fogK * 0.6;
    const edge = Math.min(wx - B.x0, B.x1 - wx, wy - B.y0, B.y1 - wy, B.cut ? B.cut.c - B.cut.nx * wx - B.cut.ny * wy : 1e9, B.round ? (B.x1 - B.x0) / 2 - Math.hypot(wx - (B.x0 + B.x1) / 2, wy - (B.y0 + B.y1) / 2) : 1e9);
    const h = hash3(Math.floor(wx * 2), Math.floor(wy * 2), 61);
    let ch = h < 0.5 ? G.dot : h < 0.8 ? G.com : G.col, r = 50, g = 50, b = 56;
    if (edge < 0.35) { ch = G.eq; r = B.frame[0] * 1.2; g = B.frame[1] * 1.2; b = B.frame[2] * 1.2; }
    if (frameSnow > 0.05) { const q = frameSnow * 0.9; r += (200 - r) * q; g += (205 - g) * q; b += (218 - b) * q; }
    grid.put(i, ch, r * k, g * k, b * k);
    grid.setBg(i, 7, 8, 12);
    grid.depth[i] = t;
  }
}

/** One building face in one column, rows y0..y1. `along` is where the ray hit the face; `top` is the unclipped roof row. */
function wallColumn(grid: CharGrid, x: number, B: Building, id: number, t: number, side: number, face: number, lightK: number, along: number, y0: number, y1: number, top: number, hor: number, scale: number, eye: number, colW: number, rev: boolean, dAlong: number, hx: number, hy: number) {
  // side 2 is a cylinder: no corners. A face of a cut building is shorter than its box side.
  let f0 = -1e9, f1 = 1e9;
  if (side !== 2) {
    if (B.cut) { const sp = faceSpan(B, face); f0 = sp[0]; f1 = sp[1]; }
    else { f0 = side === 0 ? B.y0 : B.x0; f1 = side === 0 ? B.y1 : B.x1; }
  }
  const fogK = 1 - Math.exp(-t / FOG);
  const shade0 = lightK * (1 - fogK * 0.6);
  let shade = shade0;
  const winLight = 1 - fogK * 0.45;
  // the building's electric light right now (blackouts, the surge before, the flicker back);
  // aircraft warning lights run on batteries and stay on
  const pw = power(framePower, framePower.building[id], (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, id, framePower.generator[id], frameSec)[0];
  const elec = winLight * pw;
  // signs, ads, neon, screens and floodlights never run on a backup generator (it keeps the inside lit)
  const ad = framePower.generator[id] ? power(framePower, framePower.building[id], (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, id, 0, frameSec)[0] : pw, adElec = winLight * ad;
  const [fr, fg, fb] = B.frame;
  // by day most lights in the windows are off
  const litK = B.lit * (1 - 0.75 * frameDay);
  // each window on its own: it dies with the passing wave and flickers back at its own moment
  const sub = framePower.building[id], gen = framePower.generator[id], switched = framePower.subs[sub].changed >= 0;
  const winPow = (a: number, fl: number) => (switched ? power(framePower, sub, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, (id * 131 + a * 977 + fl * 7) | 0, gen, frameSec, id, 1.5)[0] * winLight : winLight);
  // rows per floor and columns per window bay decide how much of the facade fits in a cell
  const rpf = (FLOOR_H * scale) / t, cpb = BAY / (colW * t);
  const detailed = rpf >= 2.2 && cpb >= 1.5;
  // far away several floors/bays share a cell: group them in powers of two so the pattern holds still
  const kv = rpf >= 1 ? 0 : Math.ceil(Math.log2(1 / rpf)), kh = cpb >= 1 ? 0 : Math.ceil(Math.log2(1 / cpb));
  const along0 = along;
  let bay = along / BAY, wi = Math.floor(bay), fw = bay - wi;
  let corner = along - f0 < 0.35 || f1 - along < 0.35;
  // a clock tower is a historic facade with a clock face near the top of each side
  const S = B.style === 'clock' ? 'historic' : B.style;
  const clockR = B.style === 'clock' && side !== 2 ? Math.min(3, (f1 - f0) * 0.32) : 0, clockZ = B.h - clockR - 2;
  const du = along - (f0 + f1) / 2;
  const farWall = S === 'brick' ? G.eq : S === 'warehouse' ? G.bar : G.col;
  const farK = S === 'glass' ? 1.25 : 1;
  // brick walk-ups: an iron fire escape two bays wide, repeating along the facade
  let esc = S === 'brick' && B.feat < 0.45 && B.h > 12 && (wi % 7 === 2 || wi % 7 === 3) && !corner;
  let escU = ((wi % 7) - 2 + fw) / 2;
  /** Move the hit along the face (onto a bay or pier standing out of it), with what follows from it. */
  const setAlong = (a: number) => {
    along = a; bay = a / BAY; wi = Math.floor(bay); fw = bay - wi; corner = a - f0 < 0.35 || f1 - a < 0.35;
    esc = S === 'brick' && B.feat < 0.45 && B.h > 12 && (wi % 7 === 2 || wi % 7 === 3) && !corner; escU = ((wi % 7) - 2 + fw) / 2;
  };
  const balcony = S === 'residential' && B.feat < 0.5, balK = Math.floor(((B.feat * 131) % 1) * 4);
  // balconies: railings on every floor, solid parapets on every other, glass ones stacked in pairs, or one long slab
  const balconyAt = (fl: number) => balK === 3 || (balK === 2 ? wi % 4 < 2 && fw > 0.04 && fw < 0.96 : fw > 0.1 && fw < 0.9 && (balK !== 1 || (fl & 1) === 1));
  // the building's window pattern (glyphs) and, on some, a second color in bands of floors
  const pIdx = Math.floor(((B.feat * 977) % 1) * PATS.length), pat = PATS[pIdx];
  const band = (B.feat * 311) % 1 < 0.35 ? 1 + Math.floor(((B.feat * 53) % 1) * 3) : 0;
  const wc = (fl: number) => (band && Math.floor(fl / band) & 1 ? B.sign : B.win);
  // the street doors on this face: the main one, and the shops' (once the ground plan is made)
  let door: Door | null = null;
  if (B.tier === 1 && habitable(B)) for (const D of exitsOf(frameCity, id, true)) if (D.face === face && along > D.a0 && along < D.a1) door = D;
  // a painted ad high on this face: the business's name in big block letters on a colored board
  let adA0 = 0, adA1 = 0, adZ0 = 0, adZ1 = 0, adText = '', adBg: RGB = AD_BG[0], adFg: RGB = AD_FG[0];
  if (B.ad >= 0 && side !== 2 && face === Math.floor(hash3(id, 7, 77) * (B.cut ? 5 : 4))) {
    const w = Math.min(f1 - f0 - 2, 16), mid = (f0 + f1) / 2;
    if (w > 5) {
      adText = signText(frameCity, B.ad, Math.floor((w - 1) / AD_LETTER));
      adA0 = mid - w / 2; adA1 = mid + w / 2; adZ1 = B.h - 1.6; adZ0 = Math.max(FLOOR_H * 1.5, adZ1 - 5.5);
      const h = Math.floor(hash3(id, 8, 77) * AD_BG.length); adBg = AD_BG[h]; adFg = AD_FG[h];
    }
  }
  // a video screen on this face, above the shop sign (and the ticker), as wide as the face allows
  let scA0 = 0, scA1 = 0, scZ0 = 0, scZ1 = 0;
  if (B.screen && side !== 2 && B.screen & (1 << face)) {
    const w = Math.min(f1 - f0 - 1.5, 16), mid = (f0 + f1) / 2;
    if (w > 4) { scA0 = mid - w / 2; scA1 = mid + w / 2; scZ0 = B.ticker ? TICK_Z1 + 1.2 : 5.2; scZ1 = Math.min(B.h - 1.5, scZ0 + Math.min(12, w * 0.75)); }
  }
  // the rooms behind the windows, near enough to make out (see interior.ts): one look into the
  // ground floor's plan and one into the floors above, made the first time a window needs them
  const lot = detailed && t < PEEK_FAR && side !== 2 ? lotOf(frameCity, id) : -1;
  const rdx = (hx - frameX) / t, rdy = (hy - frameY) / t;
  // how fast the hit moves along the face, per unit of t
  const da = side === 0 ? rdy : side === 1 ? rdx : side === 3 ? rdx * B.cut!.ny - rdy * B.cut!.nx : 0;
  // scaffolding 1 m out from a street face: where the ray crosses its plane
  let sT = 0, sA = 0, sTop = 0;
  if (B.scaffold && side !== 2 && face < 4 && scaffoldFace(B, face)) {
    const sb = (SCAF_D * dAlong) / (colW * t);
    sA = along - da * sb; sT = t - sb;
    if (sA > f0 + 0.1 && sA < f1 - 0.1) sTop = B.scaffold;
  }
  // a bay, pilaster or pier in front of the wall plane: where the ray meets it first (front or side)
  let rMode = 0, rT = 0, rA = 0, rCur = 0;
  if (detailed && side !== 2 && reliefOf(B)) {
    const sb = (REL.d * dAlong) / (colW * t), af = along - da * sb, lo = Math.min(af, along), hi = Math.max(af, along), per = REL.P * BAY, o = REL.off * BAY + REL.a;
    let best = 2;
    for (let k = Math.floor((lo - o - REL.w) / per); k <= Math.floor((hi - o) / per); k++) {
      const s0 = k * per + o, s1 = s0 + REL.w;
      if (s0 < f0 + 0.5 || s1 > f1 - 0.5) continue;
      let l0: number, l1: number;
      if (Math.abs(along - af) < 1e-9) { if (af < s0 || af > s1) continue; l0 = 0; l1 = 1; }
      else { const a = (s0 - af) / (along - af), b = (s1 - af) / (along - af); l0 = Math.max(0, Math.min(a, b)); l1 = Math.min(1, Math.max(a, b)); }
      if (l0 <= l1 && l0 < best) best = l0;
    }
    if (best <= 1) { rMode = best < 1e-6 ? 1 : 2; rT = t - sb + sb * best; rA = af + (along - af) * best; }
  }
  peeks[0].state = peeks[1].state = 0;
  let glowFl = -1;
  const peekFor = (fl: number) => {
    const pk = peeks[fl === 0 ? 0 : 1];
    if (pk.state) return pk.state === 1 ? pk : null;
    let P = cachedPlan(frameCity, lot, fl);
    if (P === undefined) { if (planBudget <= 0) return null; planBudget--; P = planOf(frameCity, lot, fl); }
    pk.state = P && P.box === id && peekInto(P, B, hx, hy, rdx, rdy, pk) ? 1 : 2;
    pk.plan = P;
    return pk.state === 1 ? pk : null;
  };
  let ch = 0, r = 0, g = 0, b = 0;
  // the shop sign on this face: the business name centered on it, if at least 3 letters fit
  let signN = 0, signU = 0, text = '', mode = 0;
  if (B.biz >= 0 && side !== 2) {
    text = signText(frameCity, B.biz, Math.floor((f1 - f0 - 1.2) / LETTER_W) - 2);
    signN = text.length >= 3 ? text.length : 0;
    signU = along - (f0 + f1) / 2 + ((signN + 2) * LETTER_W) / 2;
    if (signU < 0 || signU >= (signN + 2) * LETTER_W) signN = 0;
    mode = signMode(frameCity, B.biz);
  }
  // metres of facade per column (dAlong, grows when the face is seen at a slant) and per row
  const letters = LETTER_W / dAlong >= 0.9, dz = t / scale; // below one column per letter it is just a glowing bar
  const floodBase = side === 2 ? 0 : f0; // floodlights line up from the face's start
  const neonK = ad * (1 - 0.55 * frameDay), neonChase = hash3(id, 3, 31) < 0.35;
  const wall = (c: number, k: number) => { ch = c; r = fr * k * shade; g = fg * k * shade; b = fb * k * shade; };
  // a window: lit ones glow in the building's window color, dark ones are deep blue glass
  const pane = (fl: number, litCh: number) => {
    const hh = hash3(id, wi, fl), wp = hh < litK ? winPow(wi, fl) : 0;
    if (wp > 0.04) {
      ch = hh < litK * 0.3 ? pat[0] : pIdx ? pat[1] : litCh;
      const k = wp * (0.65 + 0.35 * hash3(wi, fl, id)), W = wc(fl);
      r = W[0] * k; g = W[1] * k; b = W[2] * k;
    } else { ch = G.eq; r = 30 * shade + 8; g = 36 * shade + 8; b = 58 * shade + 12; }
  };
  for (let y = y0; y < y1; y++) {
    const i = y * grid.cols + x;
    if (frameInside && grid.depth[i] < t + 0.5) continue; // the room around the viewer is in front (a neighbour may touch its wall)
    // rows where the bay or pier stands: nearer, its own spot along the face, lit by its own side
    let T = t, rs = 0;
    if (rMode) { const zr = eye + ((hor - (y + 0.5)) / scale) * rT; if (zr > REL.z0 && zr < REL.z1) { T = rT; rs = rMode; } }
    if (rs !== rCur) { rCur = rs; setAlong(rs ? rA : along0); shade = shade0 * (rs === 2 ? 0.68 : rs === 1 ? 1.08 : 1); }
    const z = eye + ((hor - (y + 0.5)) / scale) * T;
    const fl = Math.floor(z / FLOOR_H), fz = z / FLOOR_H - fl;
    const escCell = esc && z > FLOOR_H && (fz < 0.08 || escU < 0.04 || escU > 0.96 || Math.abs((fl & 1 ? 1 - escU : escU) - fz) < 0.1);
    let pk: ReturnType<typeof peekFor> = null, isWin = false;
    if (S === 'spire' || S === 'chimney') {
      // red beacon at the tip; chimneys also get two pale bands near the top
      if (z > B.h - 1) { ch = G.star; r = B.win[0] * winLight; g = B.win[1] * winLight; b = B.win[2] * winLight; }
      else if (S === 'chimney' && ((z > B.h - 6 && z < B.h - 4.5) || (z > B.h - 10 && z < B.h - 8.5))) wall(G.eq, 1.9);
      else wall(S === 'chimney' && detailed ? G.eq : G.bar, S === 'spire' ? 1.2 : 1);
    } else if (y === top || z > B.h - 0.6) {
      wall(G.us, 1.5);
      if (frameSnow > 0.05) { const k = frameSnow * 0.8; r += (190 - r) * k; g += (195 - g) * k; b += (205 - b) * k; } // snow on the ledge
    }
    else if (rs === 2) wall(S === 'brick' ? G.eq : G.bar, 1); // the side of a bay or pier
    else if (clockR && Math.hypot(du, z - clockZ) < clockR) {
      // lit face, a ring, and hands at ten past ten (they will follow the sim clock once it exists)
      const dz = z - clockZ, d = Math.hypot(du, dz);
      const hand = (a: number, len: number) => { const s = du * Math.cos(a) + dz * Math.sin(a); return s > 0 && s < len && Math.abs(-du * Math.sin(a) + dz * Math.cos(a)) < 0.22; };
      if (d > clockR * 0.82) wall(G.o, 1.6);
      else if (hand((150 * Math.PI) / 180, clockR * 0.5) || hand((30 * Math.PI) / 180, clockR * 0.75)) { ch = G.hash; r = 40; g = 30; b = 20; }
      else { ch = d < 0.3 ? G.o : G.col; r = 250 * elec; g = 230 * elec; b = 170 * elec; }
    } else if (S === 'mast') {
      // steel lattice with red aircraft-warning lights every 30 m and on the corners
      const edge = corner;
      if (z % 30 < 1 && edge) { ch = G.star; r = B.win[0] * winLight; g = B.win[1] * winLight; b = B.win[2] * winLight; }
      else if (!detailed) wall(G.bar, 1);
      else if (edge) wall(G.bar, 1.3);
      else { const a = (((along + z) % 3) + 3) % 3 < 0.35, c = (((along - z) % 3) + 3) % 3 < 0.35; wall(a && c ? G.x : a ? G.sl : c ? G.bs : G.dot, a || c ? 1.2 : 0.35); }
    } else if (S === 'gasholder') {
      // guide columns around the tank, tied by rings
      if (along % 7 < 0.5) wall(G.bar, 1.4);
      else if (z % 6 < 0.45) wall(G.eq, 1.3);
      else wall(detailed ? G.col : G.dot, 0.75);
    }
    else if (S === 'crown') {
      // vertical light strips between dark ribs
      if (Math.floor(along / (detailed ? 0.8 : 1.6)) & 1) { ch = G.bar; const k = adElec * 0.9; r = B.win[0] * k; g = B.win[1] * k; b = B.win[2] * k; }
      else wall(G.bar, 1.2);
    } else if (S === 'dome') wall(detailed && along % 2 < 0.3 ? G.bar : G.col, 1.2);
    else if (S === 'mech') wall(detailed && fw < 0.5 ? G.eq : G.hash, 0.9);
    else if (S === 'tank') {
      // wooden tank on steel legs, with hoops and a pointed lid
      const tr = (B.x1 - B.x0) / 2, lid = B.h - 0.6 * tr, base = lid - 1.7 * tr;
      if (z < base) wall(along % 1.6 < 0.3 ? G.bar : G.dot, 0.6);
      else if (z > lid) wall(G.caret, 1);
      else wall(Math.abs(z - (base + 0.33 * (lid - base))) < 0.2 || Math.abs(z - (base + 0.7 * (lid - base))) < 0.2 ? G.eq : G.bar, 1);
    }
    else if (signN && z > SIGN_Z0 && z < SIGN_Z1) {
      // neon sign: letters on the middle row, a frame (or marquee bulbs) around them
      const col = Math.floor(signU / LETTER_W) - 1, inText = col >= 0 && col < signN && z > 2.75 && z < 3.25;
      const k = rev ? signN - 1 - col : col, c = inText ? text.charCodeAt(k) : 32;
      const lit = signLight(B.biz, mode, inText ? k : -1, signText(frameCity, B.biz, 255).length, frameSec) * adElec;
      // up close a letter covers several cells: the glyph goes in the one holding its center, the others glow
      const center = Math.abs((signU / LETTER_W - col - 1.5) * LETTER_W) < dAlong / 2 && Math.abs(z - 3) < dz / 2 + 0.01;
      // a letter at least 2.6 rows tall and 3 columns wide (up to ~15 m, mid-avenue seen from the far
      // sidewalk: the user's pick) is drawn as its 5x7 pattern of bulbs; smaller, the glyph reads better
      const bulbs = LETTER_W / dAlong >= BULB_COLS && 0.56 / dz >= BULB_ROWS;
      if (bulbs && col >= 0 && col < signN && z > 2.72 && z < 3.28) {
        let fu = signU / LETTER_W - col - 1;
        if (rev) fu = 1 - fu; // seen from the other side, the pattern mirrors with the reading order
        const kk = rev ? signN - 1 - col : col, cc = text.charCodeAt(kk);
        const on = signLight(B.biz, mode, kk, signText(frameCity, B.biz, 255).length, frameSec) * adElec;
        // this cell's footprint in bulb units (0.09 m across, 0.08 m down): count the bulbs whose centers fall in it,
        // so each bulb lands in exactly one cell and, when bulbs are smaller than cells, several share one
        const px = (fu * LETTER_W - 0.05) / 0.09, pz = (3.28 - z) / 0.08, hx = dAlong / 0.18, hz = dz / 0.16;
        let n = 0;
        for (let by = Math.max(0, Math.ceil(pz - hz - 0.5)); by <= Math.min(6, Math.ceil(pz + hz - 0.5) - 1); by++) {
          for (let bx = Math.max(0, Math.ceil(px - hx - 0.5)); bx <= Math.min(4, Math.ceil(px + hx - 0.5) - 1); bx++) if (bulbOn(cc, bx, by)) n++;
        }
        const bx = Math.floor(px), by = Math.floor(pz);
        if (n) {
          ch = bulbGlyph(n, hx, hz); r = B.sign[0] * on; g = B.sign[1] * on; b = B.sign[2] * on;
          if (on > 0.5) { r += 60; g += 60; b += 60; } // a lit bulb burns whiter than its tint
        } else if (bx >= 0 && bx < 5 && by < 7 && bulbOn(cc, bx, by)) {
          ch = 32; r = B.sign[0] * on * 0.4; g = B.sign[1] * on * 0.4; b = B.sign[2] * on * 0.4; // glow around a bulb
        } else { ch = 32; r = 14; g = 12; b = 16; } // plain board between the bulbs
      } else if (inText && c !== 32 && (!letters || center)) {
        ch = letters ? c : G.eq;
        r = B.sign[0] * lit; g = B.sign[1] * lit; b = B.sign[2] * lit;
      } else if (inText) { ch = 32; r = B.sign[0] * lit * 0.35; g = B.sign[1] * lit * 0.35; b = B.sign[2] * lit * 0.35; } else if (mode === SignMode.Marquee && !inText) {
        // the marquee's white bulbs are on the building's power too
        const on = marqueeBulb(signU, frameSec) && ad > 0.05;
        ch = on ? G.o : G.dot; const q = (on ? 1 : 0.3) * Math.min(ad, 1.3); r = 255 * q; g = 225 * q; b = 150 * q;
      } else if (!inText && (z < 2.72 || z > 3.28)) { ch = G.dash; r = B.sign[0] * lit * 0.45; g = B.sign[1] * lit * 0.45; b = B.sign[2] * lit * 0.45; }
      else { ch = G.dot; r = 14; g = 12; b = 16; } // dark backing board
    }
    else if (B.ticker && side !== 2 && z > TICK_Z0 - 0.15 && z < TICK_Z1 + 0.15) {
      // the news ticker: headlines in amber bulbs running right to left around the building
      if (z < TICK_Z0 || z > TICK_Z1) wall(G.eq, 0.7);
      else {
        const n = frameTicker.length, p = (rev ? -along : along) + frameSec * TICK_SPEED, li = Math.floor(p / TICK_LW), fu = p / TICK_LW - li;
        const c = frameTicker.charCodeAt(((li % n) + n) % n), lh = TICK_Z1 - TICK_Z0, on = adElec;
        if (TICK_LW / dAlong >= BULB_COLS && lh / dz >= BULB_ROWS) {
          // up close, bulbs (0.14 m apart), counted per cell like the shop signs'
          const rows = fontRows(c), bz = (lh - 0.2) / 7;
          const hx = dAlong / 0.28, hz = dz / bz / 2;
          const nb = rows ? bulbsIn(rows, 5, (fu * TICK_LW - 0.08) / 0.14, (TICK_Z1 - 0.1 - z) / bz, hx, hz) : 0;
          if (nb) { ch = bulbGlyph(nb, hx, hz); r = 255 * on; g = 150 * on; b = 45 * on; } else { ch = G.dot; r = 34; g = 20; b = 12; }
        } else if (TICK_LW / dAlong >= 0.9) {
          const center = Math.abs(fu - 0.45) * TICK_LW < dAlong / 2 && Math.abs(z - (TICK_Z0 + TICK_Z1) / 2) < dz / 2 + 0.01;
          ch = center ? c : 32; const q = center ? on : 0.12 * on; r = 255 * q; g = 150 * q; b = 45 * q;
        } else { ch = G.eq; r = 160 * on; g = 95 * on; b = 30 * on; }
      }
    } else if (scZ1 > scZ0 && along > scA0 && along < scA1 && z > scZ0 && z < scZ1) {
      // a video screen behind a dark bezel
      if (along - scA0 < 0.25 || scA1 - along < 0.25 || z - scZ0 < 0.25 || scZ1 - z < 0.25) wall(G.hash, 0.45);
      else {
        screenPixel(id, rev ? scA1 - along : along - scA0, scZ1 - z, scA1 - scA0, scZ1 - scZ0, dAlong, dz, frameSec);
        ch = P4[0]; r = P4[1] * adElec; g = P4[2] * adElec; b = P4[3] * adElec;
      }
    }
    else if (door && z < DOOR_H + 0.35) {
      // the street door: a frame, two glass leaves and a transom, lit from the lobby
      const e = Math.min(along - door.a0, door.a1 - along);
      if (e < 0.12 || z > DOOR_H + 0.22) wall(e < 0.12 ? G.bar : G.eq, 1.5);
      else { const k = 0.55 * elec; ch = z > DOOR_H ? G.dash : Math.abs(along - (door.a0 + door.a1) / 2) < 0.06 ? G.bar : G.col; r = 255 * k; g = 220 * k; b = 160 * k; }
    } else if (adText && along > adA0 && along < adA1 && z > adZ0 && z < adZ1) {
      // the ad: a frame, then the letters (5 x 7 blocks each) centered on the board, weathered paint
      const n = adText.length, lw = AD_LETTER, start = (adA0 + adA1) / 2 - (n * lw) / 2, zc = (adZ0 + adZ1) / 2;
      const col = Math.floor((along - start) / lw), k = rev ? n - 1 - col : col;
      const fu = ((along - start) / lw - col) * 1.25 - 0.12, fzz = (zc + 1.1 - z) / 2.2;
      let on = false;
      if (col >= 0 && col < n && fu >= 0 && fu < 1 && fzz >= 0 && fzz < 1) on = bulbOn(adText.charCodeAt(k), Math.floor((rev ? 1 - fu : fu) * 5), Math.floor(fzz * 7));
      const edge = along - adA0 < 0.25 || adA1 - along < 0.25 || z - adZ0 < 0.25 || adZ1 - z < 0.25;
      const c = edge ? FRAME_AD : on ? adFg : adBg, wk = (0.75 + 0.25 * hash3(Math.floor(along * 3), Math.floor(z * 3), id)) * shade;
      ch = edge ? G.eq : on ? G.hash : hash3(Math.floor(along * 2), Math.floor(z * 2), 5) < 0.2 ? G.col : G.dot;
      r = c[0] * wk; g = c[1] * wk; b = c[2] * wk;
      // lit from below by gooseneck lamps at night
      const lamp = (1 - frameDay) * ad * Math.max(0, 1 - (z - adZ0) / (adZ1 - adZ0)) * 0.9;
      r += 120 * lamp; g += 105 * lamp; b += 80 * lamp;
    } else if (lot >= 0 && !escCell && ((!corner && windowHole(B, fw, fz, z - fl * FLOOR_H, fl === 0)) || (fz > 0.04 && fz < 0.9 && liftGlassAt(frameCity, lot, hx, hy))) && (pk = peekFor(fl))) {
      // a window: the room behind it, lit by its own lamps
      peekCell(P4, frameCity.buildings[lot], id, pk.plan!, pk, fl, frameX, frameY, rdx, rdy, eye, (hor - (y + 0.5)) / scale, t, winPow(wi, fl), frameDay, sheenAt(along, z));
      ch = P4[0]; r = P4[1]; g = P4[2]; b = P4[3]; isWin = true;
    } else if (detailed && S !== 'glass' && S !== 'warehouse' && S !== 'historic' && z > B.h - 1.3) {
      // cornice with dentils
      wall(z > B.h - 0.95 ? G.eq : ((along * 4) | 0) & 1 ? G.quo : G.dot, 1.4);
    } else if (detailed && (S === 'office' || S === 'brick' || S === 'residential') && fl > 1 && fl % (4 + ((B.feat * 3) | 0)) === 0 && fz < 0.07) {
      wall(G.eq, 1.3); // a belt course every few floors
    } else if (detailed && S === 'brick' && !corner && fw > 0.27 && fw < 0.73 && ((fz > 0.78 && fz < 0.86) || (fz > 0.25 && fz < 0.3))) {
      wall(fz > 0.5 ? G.dash : G.us, 1.3); // stone lintel and sill
    } else if (detailed && S === 'office' && B.feat > 0.6 && wi % 2 === 0 && fw < 0.18) {
      wall(G.bar, 1.3); // art deco piers
    } else if (detailed && (S === 'office' || S === 'residential') && z < FLOOR_H && !B.shop && !corner) {
      wall(Math.floor(z / 0.5) & 1 ? G.eq : G.hash, 0.95); // a stone base
    } else if (!detailed) {
      const hh = hash3(id, wi >> kh, fl >> kv), wp = hh < litK ? winPow(wi >> kh, fl >> kv) : 0;
      if (wp > 0.04) {
        ch = hh < litK * 0.4 ? G.o : G.col;
        const k = wp * (0.65 + 0.35 * hash3(wi >> kh, id, 5)), W = wc((fl >> kv) << kv);
        r = W[0] * k; g = W[1] * k; b = W[2] * k;
      } else wall(farWall, farK);
    } else if (z < FLOOR_H && B.shop) {
      if (fw > 0.12 && fw < 0.88 && z > 0.2 && z < 2.6 && !corner) { ch = fw < 0.2 ? G.lb : fw > 0.8 ? G.rb : G.col; r = 180 * elec; g = 150 * elec; b = 100 * elec; }
      else wall(G.bar, 1);
    } else if (S === 'glass') {
      // curtain wall: mullions and floor slabs over tinted glass with a diagonal sheen
      if (fz < 0.08) wall(G.dash, 0.8);
      else if (fw < 0.07 || corner) wall(G.bar, 1.5);
      else if (hash3(id, wi, fl) < litK) pane(fl, G.col);
      else {
        const sheen = 0.5 + 0.5 * Math.sin(along * 0.35 + z * 0.5);
        wall(sheen > 0.85 ? G.sl : sheen > 0.4 ? G.col : G.dot, 1.3 + 0.9 * sheen);
      }
    } else if (S === 'warehouse') {
      const door = z < 4.5 && Math.floor(along / 6) % 3 === 1, dp = along % 6;
      if (z > B.h - 3.2 && z < B.h - 1.4) { // clerestory strip under the roof
        if (fw > 0.08 && fw < 0.92) {
          if (hash3(id, wi, 0) < litK * 2 && winPow(wi, 0) > 0.04) { ch = G.hash; const k = winPow(wi, 0) * 0.75; r = B.win[0] * k; g = B.win[1] * k; b = B.win[2] * k; }
          else { ch = G.eq; r = 22 * shade + 8; g = 26 * shade + 8; b = 36 * shade + 10; }
        } else wall(G.bar, 1.2);
      } else if (door && !corner) wall(dp < 0.4 || dp > 5.6 ? G.bar : z > 4.1 ? G.eq : G.dash, dp < 0.4 || dp > 5.6 ? 1.3 : 1.15);
      else wall(G.bar, Math.floor(along / 0.6) & 1 ? 1 : 0.78); // corrugated metal
    } else if (escCell) {
      // fire escape: landings, rails and a zigzag stair between floors
      ch = fz < 0.08 ? G.eq : escU < 0.04 || escU > 0.96 ? G.bar : fl & 1 ? G.bs : G.sl;
      r = 95 * shade; g = 95 * shade; b = 105 * shade;
    } else if (S === 'historic') {
      if (z > B.h - 2.2) wall(z > B.h - 1.2 ? G.eq : (fw * 4) & 1 ? G.col : G.quo, 1.3); // cornice with dentils
      else if (z < FLOOR_H * 1.2) wall(Math.floor(z / 0.7) & 1 ? G.eq : G.hash, 0.9); // rusticated base
      else if ((wi % 3 === 0 && fw < 0.28) || corner) wall(G.bar, 1.25); // pilasters
      else if (fz < 0.08) wall(G.dash, 1.1);
      else if (fw > 0.3 && fw < 0.7 && fz > 0.18 && fz < 0.82) { if (fz > 0.7) wall(G.caret, 1.3); else pane(fl, G.hash); }
      else wall(G.col, 1);
    } else if (S === 'brick') {
      if (fw > 0.3 && fw < 0.7 && fz > 0.3 && fz < 0.78 && !corner) pane(fl, G.hash);
      else {
        const course = Math.floor(z / 0.5), off = (course & 1) * 0.6;
        wall(corner ? G.bar : G.eq, 0.8 + 0.35 * hash3(course, Math.floor((along + off) / 1.2), id));
      }
    } else if (S === 'residential') {
      if (balcony && z > FLOOR_H && fz < 0.25 && balconyAt(fl)) {
        if (fz < 0.07) wall(G.eq, 1.35);
        else if (balK === 1) wall(G.hash, 1.1);
        else if (balK === 2) { ch = G.col; r = 110 * shade + 10; g = 140 * shade + 10; b = 160 * shade + 12; }
        else wall(balK === 3 ? G.dash : G.bar, 1.3);
      }
      else if (fw > 0.25 && fw < 0.75 && fz > 0.3 && fz < 0.78 && !corner) pane(fl, G.hash);
      else wall(corner ? G.bar : G.dot, 1);
    } else if (fw > 0.2 && fw < 0.8 && fz > 0.28 && fz < 0.8 && !corner) {
      const hh = hash3(id, wi, fl), wp = hh < litK ? winPow(wi, fl) : 0;
      if (wp > 0.04) {
        ch = hh < litK * 0.3 ? pat[0] : hh < litK * 0.7 ? pat[1] : pat[2];
        const k = wp * (0.65 + 0.35 * hash3(wi, fl, id)), W = wc(fl);
        r = W[0] * k; g = W[1] * k; b = W[2] * k;
      } else { ch = G.eq; r = 30 * shade + 8; g = 36 * shade + 8; b = 58 * shade + 12; }
    } else wall(corner ? G.bar : t > 60 ? G.dot : G.col, 1);
    if (lot >= 0 && !isWin && !corner && z < B.h - 0.6 && (pk ??= peekFor(fl))) {
      // a lit room's light spills onto the wall around its window
      if (fl !== glowFl) { const L = roomGlow(frameCity.buildings[lot], id, pk.plan!, pk.r, fl, winPow(wi, fl), frameDay); glowFl = fl; GL[0] = L[0]; GL[1] = L[1]; GL[2] = L[2]; }
      if (GL[0] + GL[1] + GL[2] > 0.02) {
        const d = Math.hypot((fw - 0.5) * BAY, (fz - 0.54) * FLOOR_H), k = 120 * Math.max(0, 1 - d / 1.5) ** 2;
        r += GL[0] * k; g += GL[1] * k; b += GL[2] * k;
      }
    }
    if (B.neon) {
      // neon tubes up the corners and along the roof line (a few chase), and their glow on the wall
      const eA = Math.min(along - f0, f1 - along), dTop = Math.abs(z - (B.h - 0.3));
      const tw = Math.max(0.1, dAlong * 0.6), tz = Math.max(0.1, dz * 0.6), onTube = (eA < tw && z < B.h - 0.3 + tz) || dTop < tz;
      const s = eA < tw ? z : along, run = neonChase && Math.floor((s - frameSec * 5) / 1.4) % 3 === 0 ? 0.25 : 1, k = neonK * run;
      if (onTube) { ch = eA < tw ? G.bar : G.dash; r = B.neon[0] * k + 70 * k; g = B.neon[1] * k + 70 * k; b = B.neon[2] * k + 70 * k; }
      else {
        const hk = Math.max(0, 1 - Math.min(eA, dTop) / 1.6) ** 2 * 0.5 * k;
        r += B.neon[0] * hk; g += B.neon[1] * hk; b += B.neon[2] * hk;
      }
    }
    if (B.crown && z > B.h - CROWN_H) {
      // the top washed in light at night, brightest at the very top
      const k = ((z - (B.h - CROWN_H)) / CROWN_H) ** 1.4 * 0.95 * ad * (1 - 0.85 * frameDay);
      r += B.crown[0] * k; g += B.crown[1] * k; b += B.crown[2] * k;
    }
    if (B.flood && z < B.floodH) {
      // floodlights every FLOOD_GAP metres at the foot of the wall, each a cone of light widening
      // upward (the two nearest count) and fading out toward floodH; far away, the average
      const w = 0.35 + 0.18 * z, fz = Math.min(1, z / 1.5) * (1 - z / B.floodH) ** 1.2;
      let I: number;
      if (dAlong > FLOOD_GAP * 0.4) I = fz * Math.min(1, (1.77 * w) / FLOOD_GAP);
      else {
        const fr = ((((along - floodBase) / FLOOD_GAP) % 1) + 1) % 1, d = Math.abs(fr - 0.5) * FLOOD_GAP, d2 = FLOOD_GAP - d;
        I = fz * (Math.exp(-((d / w) ** 2)) + Math.exp(-((d2 / w) ** 2)));
        if (z < 0.35 && d < 0.3) { ch = G.star; r = 240; g = 230; b = 200; } // the lamp itself
      }
      const k = I * adElec;
      r += B.flood[0] * k; g += B.flood[1] * k; b += B.flood[2] * k;
    }
    if (sTop) {
      // the scaffolding in front: steel tubes (standards every 2.4 m, ledgers every 2 m, a brace
      // in every other bay), boards on each lift, and over the rest a mesh net or nothing
      const zs = eye + ((hor - (y + 0.5)) / scale) * sT;
      if (zs > SHED_Z + 1.1 && zs < sTop) {
        const u = sA - f0, tw = Math.max(0.05, dAlong * 0.5), tz = Math.max(0.05, dz * 0.5), lz = (zs - SHED_Z) % 2;
        const std = u % 2.4 < tw || f1 - sA < tw, led = lz < tz || zs > sTop - tz, board = lz < 0.14 + tz;
        const brace = Math.floor(u / 2.4) % 2 === 0 && Math.abs(((u % 2.4) / 2.4) * 2 - lz) < Math.max(0.08, tw * 1.5);
        let k = 0;
        if (std || led || brace || board) {
          ch = std ? G.bar : board && !led ? G.eq : brace ? G.sl : G.dash;
          k = board && !led && !std ? 0.9 : 1.1;
          const c = board && !led && !std ? SCAF_BOARD : SCAF_STEEL;
          r = c[0] * k * shade0; g = c[1] * k * shade0; b = c[2] * k * shade0; T = sT;
        } else if (B.net) {
          // the net veils the wall behind it
          const c = NETS[B.net - 1], q = 0.55;
          r = r * (1 - q) + c[0] * q * shade0; g = g * (1 - q) + c[1] * q * shade0; b = b * (1 - q) + c[2] * q * shade0;
          if (t < 40 && ch !== G.at && ch !== G.hash) ch = (Math.floor(u / 0.3) + Math.floor(zs / 0.3)) & 1 ? G.col : G.dot;
        }
      }
    }
    if (z < LIT_H && t < LIT_FAR) {
      // street lamps, headlights and signs light the lower floors
      lightAt(hx, hy, z);
      const k = 1.3 * shade;
      r += LT[0] * k; g += LT[1] * k; b += LT[2] * k;
    }
    grid.put(i, ch, r, g, b);
    grid.setBg(i, 7, 8, 12);
    grid.depth[i] = T;
  }
}

/** The news ticker's band, its letters' width and its speed (m/s). */
const TICK_Z0 = 9.8, TICK_Z1 = 11, TICK_LW = 0.85, TICK_SPEED = 3.2;
const SCREEN_PAL: RGB[] = [[255, 60, 130], [60, 200, 255], [255, 210, 60], [110, 255, 120], [190, 90, 255], [255, 120, 40], [240, 240, 255]];
const RAMP = [C('.'), C(':'), C('-'), C('='), C('+'), C('*'), C('%'), C('#'), C('@')];
/** The scene showing on screen `id` now (it changes every 6 s): its kind (0 ad, 1 video, 2 color bars) and colors. */
function screenScene(id: number, sec: number) {
  const scene = Math.floor(sec / 6 + hash3(id, 0, 91) * 7);
  return { scene, kind: Math.floor(hash3(id, scene, 92) * 3), a: SCREEN_PAL[Math.floor(hash3(id, scene, 94) * SCREEN_PAL.length)], b: SCREEN_PAL[Math.floor(hash3(id, scene, 95) * SCREEN_PAL.length)], t: (sec % 6) };
}
/**
 * One cell of a video screen W x H metres, at u metres from its left edge (as read) and v down from
 * its top, into P4: an ad for a business of the city in block letters, an ASCII "video", or bars of
 * color sweeping across. Pixels are 0.3 m, so up close it reads as a screen.
 */
function screenPixel(id: number, u: number, v: number, W: number, H: number, dAlong: number, dz: number, sec: number) {
  const S = screenScene(id, sec), px = Math.floor(u / 0.3) * 0.3, pz = Math.floor(v / 0.3) * 0.3;
  let k: number, col: RGB;
  if (S.kind === 0 && frameCity.businesses.length) {
    const text = signText(frameCity, Math.floor(hash3(id, S.scene, 93) * frameCity.businesses.length), Math.max(1, Math.floor((W - 1) / 1.2)));
    const n = text.length, lw = Math.min((W - 1) / n, (H * 0.55) / 1.4), lh = lw * 1.4, x0 = (W - n * lw) / 2, y0 = (H - lh) / 2;
    const li = Math.floor((u - x0) / lw), fu = ((u - x0) / lw - li) * 1.25 - 0.12, fv = (v - y0) / lh;
    // the letters type in, one every 0.12 s
    const on = li >= 0 && li < n && li < S.t / 0.12 && fu >= 0 && fu < 1 && fv >= 0 && fv < 1 && bulbOn(text.charCodeAt(li), Math.floor(fu * 5), Math.floor(fv * 7));
    const glyphs = lw / dAlong >= 3 && lh / dz >= 2.6;
    if (!glyphs && lw / dAlong >= 0.9 && li >= 0 && li < n && li < S.t / 0.12 && Math.abs(u - x0 - (li + 0.5) * lw) < dAlong / 2 && Math.abs(v - H / 2) < dz / 2 + 0.01) {
      P4[0] = text.charCodeAt(li); P4[1] = 255; P4[2] = 250; P4[3] = 235; return;
    }
    k = on && glyphs ? 1 : 0.3 + 0.25 * (pz / H); col = on && glyphs ? [255, 250, 235] : S.a;
    P4[0] = on && glyphs ? G.hash : G.col;
  } else if (S.kind === 1) {
    // plasma: three moving waves, mapped to a ramp of glyphs and blended between two colors
    const val = (Math.sin(px * 0.9 + sec * 1.3 + S.scene) + Math.sin(pz * 1.1 - sec * 0.9) + Math.sin((px + pz) * 0.6 + sec * 2.1)) / 6 + 0.5;
    k = 0.25 + 0.75 * val; const m = val;
    col = [S.a[0] * (1 - m) + S.b[0] * m, S.a[1] * (1 - m) + S.b[1] * m, S.a[2] * (1 - m) + S.b[2] * m];
    P4[0] = RAMP[Math.min(RAMP.length - 1, Math.floor(val * RAMP.length))];
  } else {
    // diagonal bars of color sweeping across, with a bright band
    const s = (px + pz * 0.6 - sec * 3) / 1.5, band = ((s % 3) + 3) % 3;
    col = band < 1 ? S.a : band < 2 ? S.b : [30, 30, 40];
    k = band < 2 ? 0.75 + 0.25 * Math.sin(s * 3) : 0.6;
    P4[0] = band < 2 ? (band % 1 < 0.15 ? G.at : G.hash) : G.col;
  }
  P4[1] = col[0] * k; P4[2] = col[1] * k; P4[3] = col[2] * k;
}

/** Scaffolding: its distance from the wall, and the colors of its tubes, boards and nets (green, blue, white, orange, black, green). */
const SCAF_D = 1, SCAF_STEEL: RGB = [140, 140, 150], SCAF_BOARD: RGB = [120, 95, 60];
const NETS: RGB[] = [[50, 110, 70], [50, 80, 140], [170, 170, 165], [190, 100, 40], [35, 35, 40], [70, 120, 60]];
/** Whether face f (0..3) of a building faces a street, where its sidewalk shed and scaffolding go. */
function scaffoldFace(B: Building, f: number): boolean {
  const blk = blockAt(frameCity, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2);
  if (!blk) return false;
  const gap = f === 0 ? B.x0 - blk.x0 : f === 1 ? blk.x1 - B.x1 : f === 2 ? B.y0 - blk.y0 : blk.y1 - B.y1;
  return gap <= SIDEWALK + 0.5;
}

/** Window glyphs per building, brightest first, as in the dense facades of the references. */
const PATS = [[G.at, G.hash, G.pct], [C('8'), G.o, G.col], [C('X'), C('Z'), G.plus], [C('0'), G.o, G.eq], [C('H'), G.hash, G.eq]];
/**
 * What stands out of a facade, filled by reliefOf: a piece every P bays (from bay off, plus a
 * metres), w wide and d deep, between heights z0 and z1.
 */
const REL = { P: 0, off: 0, a: 0, w: 0, d: 0, z0: 0, z1: 0 };
/** Oriel bays on some walk-ups, pilasters on old facades, piers on art deco offices (where the facade draws them). */
function reliefOf(B: Building): boolean {
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

/**
 * All the light reaching a point, into LT: the street lamps' pools (fading above 1 m, gone at LIT_H)
 * and this frame's dynamic lights.
 */
function lightAt(x: number, y: number, z: number) {
  const zk = z <= 1 ? 1 : 1 - (z - 1) / (LIT_H - 1);
  LT[0] = LT[1] = LT[2] = 0;
  if (zk > 0) light.add(x, y, zk, LT);
  dyn.sample(x, y, z, LT);
}

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

/** The fire escapes within 50 m, as iron: each storey drawn on its own, from its height. */
function drawEscapes(grid: CharGrid, world: World, v: View, dirX: number, dirY: number, plX: number, plY: number, plane: number, scale: number, hor: number) {
  const { city } = world, one: Obj[] = [{ x: 0, y: 0, c: 1, s: 0, parts: [], r: 2, h: 4.6, seed: 0 }];
  for (const blk of city.blocks) {
    if (v.x < blk.x0 - 50 || v.x > blk.x1 + 50 || v.y < blk.y0 - 50 || v.y > blk.y1 + 50) continue;
    for (let k = blk.b0; k < blk.b1; k++) {
      const B = city.buildings[k];
      if (B.style !== 'brick' || B.tier !== 1 || B.feat >= 0.45) continue;
      for (const e of escapesOf(city, k)) {
        const cx = e.ox + e.ux * BAY, cy = e.oy + e.uy * BAY;
        if (Math.hypot(cx - v.x, cy - v.y) > 50) continue;
        // local +x out of the wall, +y along the facade
        const o = one[0];
        o.x = cx; o.y = cy; o.c = e.nx; o.s = e.ny;
        const flip = e.nx * e.uy - e.ny * e.ux > 0 ? 1 : -1;
        for (let f = 0; f <= e.top; f++) {
          o.parts = escapeModel(f > 0, f < e.top ? (f & 1 ? -flip : flip) : 0, BAY, (f & 1) === 1);
          drawObjects(grid, one, { x: v.x, y: v.y, eye: v.eye - f * FLOOR_H, dirX, dirY, plX, plY, plane, scale, hor, far: 60, light: (x, y, z) => { lightAt(x, y, z + f * FLOOR_H); return LT; }, snow: frameSnow });
        }
      }
    }
  }
}

/**
 * Bus shelters and sidewalk sheds near the viewer: their roofs keep the rain off (see precip.ts).
 * The sheds (scaffolding over the sidewalk along a building's street faces) are also gathered as
 * objects, in pieces of SHED_SEG metres: a plywood deck on posts, with a bulb under it.
 */
const SHED_SEG = 4.8, SHED_D = 2.6, SHED_Z = 3;
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
  return boardList;
}

/** This frame's moving and flickering lights: car headlights and tail lights, and the neon signs. */
function gatherLights(world: World, v: View, sec: number) {
  const { city } = world;
  dyn.begin(v.x, v.y);
  for (const c of world.cars) {
    const x = c.px + (c.x - c.px) * v.alpha, y = c.py + (c.y - c.py) * v.alpha;
    if (Math.abs(x - v.x) > CAR_LIGHT_FAR || Math.abs(y - v.y) > CAR_LIGHT_FAR) continue;
    const hl = c.len / 2, bike = c.kind === 'bike';
    dyn.cone(x + c.dx * hl, y + c.dy * hl, c.dx, c.dy, 0.87, bike ? 8 : 24, 1, 4, bike ? 60 : 150, bike ? 58 : 140, bike ? 50 : 115);
    if (!bike) dyn.point(x - c.dx * (hl + 0.1), y - c.dy * (hl + 0.1), 4, 1, 2, 120, 12, 8);
    // a police beacon throws red and blue around it in turns
    // a wreck's hazard lights blink amber
    if (c.wreck && Math.floor(sec * 1.6) & 1) dyn.point(x, y, 6, 1, 3, 150, 90, 10);
    if (c.beacon) { const red = (Math.floor(sec * 3) & 1) === 0; dyn.point(x, y, 14, 2, 8, red ? 140 : 20, red ? 15 : 30, red ? 15 : 160); }
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
interface SignalPost { x: number; y: number; c: number; s: number; state: number; lit: number; at: number[] }
const SP: SignalPost = { x: 0, y: 0, c: 0, s: 0, state: 0, lit: -1, at: [] };
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
        const st = signal(city, world.power, i, j, hd & 1, sec), rx = -dy, ry = dx; // the right-hand side
        const ahead = st === Sig.Stop ? -(aH + 0.7) : aH + 0.7;
        SP.x = mx + dx * ahead + rx * (halfW + 0.7); SP.y = my + dy * ahead + ry * (halfW + 0.7);
        SP.c = -dx; SP.s = -dy;
        setState(st);
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
    for (const dg of [1, -1]) {
      diagPoint(d, (dg > 0 ? z.u1 : z.u0) + dg * 0.7, dg, hw + 0.7, Q2);
      SP.x = Q2[0]; SP.y = Q2[1]; SP.c = -d.ex * dg; SP.s = -d.ey * dg;
      setState(zoneSignal(city, world.power, z, true, sec));
      SP.at = lanesAt(D.lanes, hw);
      cb(SP);
    }
    if (z.i >= 0 && !z.isX) continue;
    const b = z.vert ? city.xb : city.yb, rc = (b[2 * z.road] + b[2 * z.road + 1]) / 2, half = (b[2 * z.road + 1] - b[2 * z.road]) / 2;
    for (const hd of z.vert ? [1, 3] : [0, 2]) {
      const [dx, dy] = DIRS[hd], aFar = dx + dy > 0 ? z.a1 + 0.7 : z.a0 - 0.7;
      SP.x = z.vert ? rc - dy * (half + 0.7) : aFar; SP.y = z.vert ? aFar : rc + dx * (half + 0.7);
      SP.c = -dx; SP.s = -dy;
      setState(zoneSignal(city, world.power, z, false, sec));
      SP.at = lanesAt(Math.max(1, lanesOf(b, z.road)), half);
      cb(SP);
    }
  }
}
const Q2 = [0, 0];
/** The X on avenue k, if the diagonal makes one there. */
function xAt(city: City, k: number) {
  const zs = diagRoad(city).byRoad.get(1024 + k);
  if (zs) for (const z of zs) if (z.isX) return z;
  return null;
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

function collectObjects(world: World, v: View): Obj[] {
  const out: Obj[] = [];
  const { city } = world;
  const cl = (a: number, n: number) => Math.min(n - 1, Math.max(0, a | 0));
  const cx0 = city.xCell[cl(v.x - SPRITE_FAR, city.w)], cx1 = city.xCell[cl(v.x + SPRITE_FAR, city.w)];
  const cy0 = city.yCell[cl(v.y - SPRITE_FAR, city.h)], cy1 = city.yCell[cl(v.y + SPRITE_FAR, city.h)];
  for (let cy = cy0 | 1; cy <= cy1; cy += 2) for (let cx = cx0 | 1; cx <= cx1; cx += 2) {
    const blk = cityBlock(city, cx, cy);
    if (blk) for (const p of blk.props) {
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
  forSignals(world, v, SIGNAL_FAR, (S) => {
    const near = Math.hypot(S.x - v.x, S.y - v.y) < SIGNAL_NEAR;
    if (S.state === Sig.Stop) { if (near) out.push({ x: S.x, y: S.y, c: S.c, s: S.s, parts: STOP_SIGN, r: 0.5, h: 2.9, seed: 0 }); return; }
    if (!near && S.lit < 0) return;
    if (near) out.push({ x: S.x, y: S.y, c: S.c, s: S.s, parts: SIGNAL_POLE, r: 0.3, h: 6.3, seed: 0 });
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
  for (const c of world.cars) {
    // interpolate between ticks so motion is smooth at any frame rate
    const x = c.px + (c.x - c.px) * v.alpha, y = c.py + (c.y - c.py) * v.alpha;
    if (Math.abs(x - v.x) > SPRITE_FAR || Math.abs(y - v.y) > SPRITE_FAR) continue;
    const near = Math.abs(x - v.x) < CAR_NEAR && Math.abs(y - v.y) < CAR_NEAR, [hl, h] = VEHICLE_SIZE[c.kind];
    const who = c.id & 63;
    const parts = c.kind === 'bike' ? bikeModel(c.col, who, Math.floor(c.wheel / (Math.PI / 2)) & 3)
      : c.kind === 'sedan' || c.kind === 'taxi' ? (near ? carModel(c.col, c.taxi, who) : carFarModel(c.col, c.taxi)) : vehicleModel(c.kind, c.col, c.beacon ? 1 + (Math.floor(frameSec * 3) & 1) : 0, near ? who : 0);
    const o: Obj = { x, y, c: c.dx, s: c.dy, parts, r: hl + 0.3, h: h + 0.1, seed: 0 };
    if (near) { o.pitch = c.pitch; o.roll = c.roll; o.lift = c.lift; o.wheel = c.wheel; }
    out.push(o);
  }
  return out;
}

function cityBlock(city: City, cx: number, cy: number) {
  const i = cx >> 1, j = cy >> 1;
  return i < city.nbx && j < city.nby ? city.blocks[j * city.nbx + i] : null;
}
