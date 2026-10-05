import { hash3 } from '../core/rng';
import { BAY, blockAt, faceSpan, FLOOR_H, type Building, type City, type RGB } from '../sim/city';
import { CEIL, CELL, cellAt, DOOR, DOOR_H, isOffice, ROOM, liftGlassAt, SL, STAIR_LAND, stairH, stairLocal, type Door, type Leaf, type Plan, type Room, type RoomKind } from '../sim/interior';
import { type CharGrid, KIND } from './grid';
import { bulbGlyph, bulbsIn, fontRows } from './signs';

/**
 * The floor the viewer stands in, drawn column by column over the city: walls where the plan's rooms
 * meet, lintels over the doorways, the outer walls with their windows open onto the city that was
 * drawn first, then floor and ceiling. Everything is lit by the rooms' own lamps (on the building's
 * power) and, by day, by the windows.
 */
export interface Inside {
  city: City;
  /** The lot (its ground volume's index). */
  k: number;
  plan: Plan;
  /** The lot's ground volume (style, door, shop) and the box this floor fills. */
  base: Building;
  box: Building;
  boxId: number;
  floor: number;
  /** Height of the floor under the viewer (the lift car's floor while it rides), and doors shut. */
  z0: number;
  closed: boolean;
  /** In a lift car: the floors it serves (0 if not in one), and where it is going (-1 standing). */
  liftN: number;
  liftTo: number;
  /** Metres one column covers at distance 1 (for the panel's lettering). */
  colW: number;
  door: Door | null;
  /** All its street doors (the main one and the shops'), for the ground floor. */
  exits: Door[];
  /** The building's electric light (blackouts), daylight 0..1, seconds, rain 0..1. */
  elec: number;
  /** Its backup power when the substation is down (sim/power.ts Backup). */
  backup: number;
  day: number;
  sec: number;
  rain: number;
  /** The doors between rooms on this floor, and how far each has swung open (radians). */
  leaves: Leaf[];
  leafA: number[];
}

const C = (s: string) => s.charCodeAt(0);
const G = { dot: C('.'), com: C(','), col: C(':'), semi: C(';'), dash: C('-'), eq: C('='), plus: C('+'), hash: C('#'), bar: C('|'), us: C('_'), star: C('*'), o: C('o'), quo: C('"'), pct: C('%') };

/** Per row of the current column: 0 free, 1 drawn, 2 window (the city shows through). */
let rowState = new Uint8Array(0);
/** Per room: lamp light (r, g, b, 0..~1.2) and the room center, rebuilt every frame. */
let lamp = new Float32Array(0);

/** Wall paint of an apartment, by unit. */
const PAINT: RGB[] = [[190, 170, 135], [150, 170, 160], [175, 150, 165], [185, 185, 175], [150, 160, 185], [195, 160, 120]];
const WARM: RGB = [255, 205, 140], TUBE: RGB = [215, 232, 255], LOBBY: RGB = [255, 222, 165];

/**
 * Lamps of the floor's rooms for this frame: common parts always on, rooms by who is home, and the
 * room the viewer (x, y) stands in, as if they had found the switch.
 */
export function prepareInside(I: Inside, x: number, y: number) {
  const here = (cellAt(I.plan, x, y) & ROOM) - 1;
  const R = I.plan.rooms, n = R.length;
  if (lamp.length < n * 3) lamp = new Float32Array(n * 3 + 96);
  for (let r = 0; r < n; r++) roomLamp(I.base, I.boxId, R[r], r, I.floor, I.elec, I.backup, I.day, r === here, lamp, r * 3);
  stairRoom = here >= 0 && R[here].kind === 'stair' ? here : -1;
  stairIdx = R.findIndex((q) => q.kind === 'stair');
}
/** The stair room the viewer is in, or -1: its well is open a storey up and down. */
let stairRoom = -1;
/** The floor's stair room, or -1: its steps are drawn wherever a ray crosses it. */
let stairIdx = -1;

/**
 * The lamp of room r on floor f of box boxId, into out[o..o+2] (0..1 per channel, times the power):
 * common parts always on, the others when someone is home (or `on`), as seen from outside too.
 */
function roomLamp(base: Building, boxId: number, R: Room, r: number, f: number, elec: number, backup: number, day: number, on: boolean, out: Float32Array, o: number) {
  const common = R.unit < 0, h = hash3(boxId, r * 31 + f, 12);
  // off the mains, by the building's backup (sim/power.ts): a critical generator keeps it nearly as
  // usual; a generator gives its own dimmer, amber "half light" in the common parts and a few rooms,
  // red lamps here and there in the halls; batteries give the emergency lights, faint, only where
  // people must find their way out (halls, stairs, the lobby); with nothing it is dark
  if (elec < MAINS && backup === 3) elec = 0.85;
  else if (elec < MAINS) {
    if (backup === 0 || (backup === 1 && !common)) { out[o] = out[o + 1] = out[o + 2] = 0; return; }
    const gen = backup === 2 && elec > 0.25, lit = common || (gen && (on || h < 0.25)), red = common && h < (gen ? 0.3 : 0.4);
    const c = !lit ? null : red ? EMERG_RED : gen ? GEN : EMERG;
    const k = !c ? 0 : gen ? Math.min(1, elec * 1.1) : 0.6;
    out[o] = c ? (c[0] / 255) * k : 0; out[o + 1] = c ? (c[1] / 255) * k : 0; out[o + 2] = c ? (c[2] / 255) * k : 0;
    return;
  }
  on ||= common || R.kind === 'shop' || hash3(boxId, r * 31 + f, 11) < base.lit * (1 - 0.75 * day) * 1.3;
  const c = !on ? null : R.kind === 'lobby' ? LOBBY : isOffice(base) || R.kind === 'stair' || R.kind === 'lift' ? TUBE : WARM;
  const k = c ? elec : 0;
  out[o] = c ? (c[0] / 255) * k : 0; out[o + 1] = c ? (c[1] / 255) * k : 0; out[o + 2] = c ? (c[2] / 255) * k : 0;
}
/** Below this the building is off the mains (power() gives ~0.55 on a generator, 0 with none). */
const MAINS = 0.8;
/** The generator's light, and the emergency lamps (on batteries): white, and red ones. */
const GEN: RGB = [190, 120, 60], EMERG: RGB = [70, 85, 110], EMERG_RED: RGB = [150, 22, 16];

/** Squared distance from (x, y) to the nearest ceiling lamp of a room: they hang about every 4 m. */
function lampD2(R: Room, x: number, y: number) {
  const w = R.x1 - R.x0, h = R.y1 - R.y0, sx = w / Math.max(1, Math.round(w / 4)), sy = h / Math.max(1, Math.round(h / 4));
  const dx = ((((x - R.x0) % sx) + sx) % sx) - sx / 2, dy = ((((y - R.y0) % sy) + sy) % sy) - sy / 2;
  return dx * dx + dy * dy;
}

const L3 = new Float32Array(3);
/** Light at a point of room r into L3: its lamps, plus ambient. */
function lightIn(I: Inside, r: number, x: number, y: number, t: number) {
  lit3(I.plan.rooms[r], lamp, r * 3, x, y, t, I.day);
}
/**
 * An EXIT sign's cell: green letters lit on their own (on a battery, so through a blackout too),
 * `u` 0..1 across the sign as the viewer reads it. Writes into out (glyph, r, g, b).
 */
const EXIT = 'EXIT';
/**
 * `du`, `dv`: how much of the sign one column and one row cover. As every text in the world: close
 * up, each letter is made of points (the 5x7 bulbs); farther, one ASCII letter in the column holding
 * its middle.
 */
function exitCell(u: number, v: number, du: number, dv: number, out: number[]) {
  const slots = EXIT.length + 2, n = Math.floor(u * slots) - 1, c = (n + 1.5) / slots; // a margin slot each side
  out[0] = G.eq; out[1] = 25; out[2] = 120; out[3] = 55;
  if (n < 0 || n >= EXIT.length || v < 0.1 || v > 0.9) return;
  const rows = fontRows(EXIT.charCodeAt(n))!;
  if (0.8 / dv >= 4 && 1 / slots / du >= 3) {
    // points: the bulbs in this cell
    const px = (u * slots - (n + 1)) * 6 - 1, pz = ((v - 0.1) / 0.8) * 7 - 0.5;
    const hx = (du * slots * 6) / 2, hz = ((dv / 0.8) * 7) / 2, b = bulbsIn(rows, 5, px, pz, hx, hz);
    if (b) { out[0] = bulbGlyph(b, hx, hz); out[1] = 225; out[2] = 255; out[3] = 230; }
    return;
  }
  if (Math.abs(u - c) < du / 2) { out[0] = EXIT.charCodeAt(n); out[1] = 235; out[2] = 255; out[3] = 235; }
}
/** Whether a reading direction along a wall runs to the viewer's right: the right of a ray (rdx, rdy) is (-rdy, rdx). */
const toRight = (ax: number, ay: number, rdx: number, rdy: number) => ax * -rdy + ay * rdx >= 0;

/** L3 from a lamp color (lp[o..o+2]) falling off from the room's lamps, plus the ambient light. */
function lit3(R: Room, lp: Float32Array, o: number, x: number, y: number, t: number, day: number) {
  const k = (0.5 + 0.9 / (1 + lampD2(R, x, y) / 5)) / (1 + t * 0.03);
  // a dark room still gets the city's glow through the windows; by day, the daylight
  const a = 0.14 + 0.5 * day;
  L3[0] = lp[o] * k + a; L3[1] = lp[o + 1] * k + a * 1.05; L3[2] = lp[o + 2] * k + a * 1.25;
}

/** Window openings of a facade style, as wallColumn draws them: fw across the bay, fz up the storey. */
function windowHole(B: Building, fw: number, fz: number, z: number, ground: boolean): boolean {
  if (ground && B.shop) return fw > 0.12 && fw < 0.88 && z > 0.2 && z < 2.6;
  switch (B.style) {
    case 'glass': return fw >= 0.07 && fz >= 0.08;
    case 'residential': return fw > 0.25 && fw < 0.75 && fz > 0.3 && fz < 0.78;
    case 'brick': return fw > 0.3 && fw < 0.7 && fz > 0.3 && fz < 0.78;
    // tall arched windows over a rusticated base that has none
    case 'historic': return !ground && fw > 0.3 && fw < 0.7 && fz > 0.18 && fz < 0.82;
    default: return fw > 0.2 && fw < 0.8 && fz > 0.28 && fz < 0.8;
  }
}

/**
 * The lift car's panel: one, on a long side wall, centered on it. A display of the floor the car is
 * at, over a button per floor the lift serves, numbered, the bottom row the ground floor. The
 * button under the screen's center is noted, so a click can press it (pickedButton).
 */
const PANEL_W = 0.44, PANEL_Z0 = 0.85, PANEL_Z1 = 1.65;
let picked = -1;
export const pickedButton = () => picked;
/** Paint a cell of the panel at (pu across it, 0..1 left to right; zr), or return false off it. */
function panelPaint(I: Inside, pu: number, zr: number, cu: number, cz: number, out: number[]): number {
  const n = I.liftN, cols = n > 12 ? 4 : 2, rows = Math.ceil(n / cols);
  if (pu < 0 || pu > 1 || zr < PANEL_Z0 || zr > PANEL_Z1 + 0.14) return -2;
  out[1] = 70; out[2] = 72; out[3] = 80; out[0] = G.hash;
  if (zr > PANEL_Z1 + 0.02) {
    // the floor display: amber lamp digits on black
    const g = digitLamps(String(I.floor).padStart(2, '0'), 0.3, 0.7, PANEL_Z1 + 0.135, PANEL_Z1 + 0.035, pu, zr, cu, cz);
    if (g) { out[0] = g; out[1] = 255; out[2] = 140; out[3] = 40; } else { out[0] = G.dot; out[1] = 60; out[2] = 25; out[3] = 10; }
    return -1;
  }
  const bu = pu * cols, bz = ((zr - PANEL_Z0) / (PANEL_Z1 - PANEL_Z0)) * rows;
  const col = Math.floor(bu), row = Math.floor(bz), f = row * cols + col, fu = bu - col, fz = bz - row;
  if (f >= n) return -1;
  const lit = f === I.liftTo || (I.liftTo < 0 && f === I.floor);
  // the button's number in little lamps, behind the steel plate: amber on the floor it goes to
  const s = String(f), w = Math.min(0.66, 0.3 * s.length);
  const g = digitLamps(s, 0.5 - w / 2, 0.5 + w / 2, 0.8, 0.2, fu, fz, cu * cols, (cz / (PANEL_Z1 - PANEL_Z0)) * rows);
  if (g) { out[0] = g; out[1] = lit ? 255 : 200; out[2] = lit ? 160 : 205; out[3] = lit ? 50 : 210; return f; }
  if (fu < 0.12 || fu > 0.88 || fz < 0.15 || fz > 0.85) return f; // the plate around it: still that button's
  out[0] = G.dot; out[1] = lit ? 120 : 95; out[2] = lit ? 80 : 98; out[3] = lit ? 40 : 105; // the button's face
  return f;
}

/**
 * Glyph of the lamps of 5x7 digits s laid out in the box u0..u1 (across) by zTop..zBot, at a cell
 * centered at (u, z) of size cu x cz in the same units, or 0 where no lamp falls in it. Lamps, not
 * glyphs, at any distance: far away the digits blur into a block of light.
 */
function digitLamps(s: string, u0: number, u1: number, zTop: number, zBot: number, u: number, z: number, cu: number, cz: number): number {
  const bw = (u1 - u0) / (6 * s.length - 1), bh = (zTop - zBot) / 7, hx = cu / bw / 2, hz = cz / bh / 2;
  const px = (u - u0) / bw, pz = (zTop - z) / bh;
  // a digit under 3 rows tall: its ASCII glyph, in the cell holding its middle (as every text in the world)
  if ((zTop - zBot) / cz < 3) {
    const k = Math.floor(px / 6), mu = u0 + (k * 6 + 2.5) * bw, mz = (zTop + zBot) / 2;
    return k >= 0 && k < s.length && Math.abs(u - mu) <= cu / 2 && Math.abs(z - mz) <= cz / 2 ? s.charCodeAt(k) : 32;
  }
  let nb = 0;
  for (let k = 0; k < s.length; k++) {
    const rows = fontRows(s.charCodeAt(k));
    if (rows) nb += bulbsIn(rows, 5, px - 6 * k, pz, hx, hz);
  }
  return bulbGlyph(nb, hx, hz);
}

/** Paint of a room's walls: glyph and color at height zr above its floor, u along the wall. */
function wallPaint(R: Room, zr: number, u: number, out: number[]) {
  const kind = R.kind;
  if (zr < 0.12) { out[0] = G.us; out[1] = 70; out[2] = 52; out[3] = 40; return; } // skirting board
  if (zr > CEIL - 0.1) { out[0] = G.dash; out[1] = out[2] = out[3] = 120; return; } // cornice
  switch (kind) {
    case 'bath': case 'kitchen': {
      // tiles up to shoulder height in the bathroom, a splashback in the kitchen
      const top = kind === 'bath' ? 2 : 1.5;
      if (zr < top && zr > (kind === 'bath' ? 0 : 0.9)) {
        const seam = ((u / 0.3) % 1 + 1) % 1 < 0.15 || (zr / 0.3) % 1 < 0.15;
        out[0] = seam ? G.plus : G.dot; out[1] = 180; out[2] = 190; out[3] = 188; return;
      }
      out[0] = G.col; out[1] = 200; out[2] = 196; out[3] = 180; return;
    }
    case 'lobby': case 'hall':
      // wainscot of wood panels below a plaster wall
      if (zr < 1) { const p = ((u / 0.8) % 1 + 1) % 1; out[0] = p < 0.08 ? G.bar : zr > 0.92 ? G.eq : G.col; out[1] = 110; out[2] = 76; out[3] = 50; return; }
      out[0] = G.col; out[1] = 165; out[2] = 155; out[3] = 135; return;
    case 'stair': out[0] = G.semi; out[1] = 135; out[2] = 135; out[3] = 130; return;
    case 'lift': out[0] = G.bar; out[1] = 165; out[2] = 170; out[3] = 175; return;
    case 'office': case 'open': case 'shop': out[0] = G.col; out[1] = 165; out[2] = 165; out[3] = 160; return;
    default: {
      // homes: each one papered or painted in its own way
      const c = PAINT[(((R.unit * 7 + 3) % PAINT.length) + PAINT.length) % PAINT.length], h = hash3(R.unit, 5, 9);
      const pu = ((u / 0.4) % 1 + 1) % 1;
      out[0] = h < 0.35 ? (pu < 0.5 ? G.bar : G.col) : h < 0.6 ? ((((u / 0.3) | 0) + ((zr / 0.3) | 0)) & 1 ? G.dot : G.quo) : G.col;
      out[1] = c[0]; out[2] = c[1]; out[3] = c[2];
    }
  }
}

/** Floor of a room at (x, y): glyph and color. */
function floorPaint(kind: RoomKind, office: boolean, x: number, y: number, out: number[]) {
  switch (kind) {
    case 'bath': case 'kitchen': {
      const ix = Math.floor(x / 0.3), iy = Math.floor(y / 0.3), seam = x / 0.3 - ix < 0.12 || y / 0.3 - iy < 0.12;
      const dark = kind === 'kitchen' && (ix + iy) & 1;
      out[0] = seam ? G.plus : G.dot; out[1] = dark ? 60 : 165; out[2] = dark ? 58 : 165; out[3] = dark ? 62 : 158; return;
    }
    case 'lobby': {
      const ix = Math.floor(x / 0.8), iy = Math.floor(y / 0.8), seam = x / 0.8 - ix < 0.05 || y / 0.8 - iy < 0.05, k = (ix + iy) & 1 ? 1 : 0.8;
      out[0] = seam ? G.plus : G.dot; out[1] = 175 * k; out[2] = 165 * k; out[3] = 145 * k; return;
    }
    case 'hall': if (office) { out[0] = G.dot; out[1] = 95; out[2] = 95; out[3] = 100; } else { out[0] = G.com; out[1] = 120; out[2] = 45; out[3] = 45; } return; // runner carpet
    case 'office': case 'open': {
      const k = (Math.floor(x / 0.6) + Math.floor(y / 0.6)) & 1 ? 1 : 0.85;
      out[0] = hash3(Math.floor(x * 6), Math.floor(y * 6), 3) < 0.5 ? G.com : G.dot; out[1] = 72 * k; out[2] = 78 * k; out[3] = 95 * k; return;
    }
    case 'stair': out[0] = G.eq; out[1] = out[2] = 125; out[3] = 120; return;
    case 'lift': out[0] = G.hash; out[1] = 100; out[2] = 100; out[3] = 108; return;
    case 'shop': out[0] = G.dot; out[1] = out[2] = out[3] = 110; return;
    default: {
      // wooden boards, staggered
      const row = Math.floor(y / 0.2), along = x / 1.2 + (row & 1) * 0.5, seam = along - Math.floor(along) < 0.06;
      const k = 0.8 + 0.3 * hash3(row, Math.floor(along), 4);
      out[0] = seam ? G.bar : G.dash; out[1] = 130 * k; out[2] = 85 * k; out[3] = 50 * k;
    }
  }
}

/** Ceiling at (x, y) of room r: tubes in offices, a lamp in the middle of the rooms at home. */
function ceilPaint(R: Room, office: boolean, on: boolean, x: number, y: number, out: number[]) {
  out[0] = G.dot; out[1] = 150; out[2] = 148; out[3] = 142;
  if (office || R.kind === 'stair' || R.kind === 'lift') {
    // ceiling tiles with a light panel every 2.4 x 1.2 m
    const fx = ((x / 2.4) % 1 + 1) % 1, fy = ((y / 1.2) % 1 + 1) % 1;
    if (fx > 0.3 && fx < 0.7 && fy > 0.25 && fy < 0.75) { out[0] = G.eq; const k = on ? 2.2 : 0.6; out[1] = 200 * k; out[2] = 210 * k; out[3] = 220 * k; return; }
    if (x / 0.6 - Math.floor(x / 0.6) < 0.06 || y / 0.6 - Math.floor(y / 0.6) < 0.06) out[0] = G.plus;
    return;
  }
  if (lampD2(R, x, y) < 0.05) { out[0] = G.o; const k = on ? 2.4 : 0.5; out[1] = 255 * k; out[2] = 220 * k; out[3] = 160 * k; }
}

const P4 = [0, 0, 0, 0];

/** Whether a building stands at (x, y) taller than z. */
function builtUp(city: City, x: number, y: number, z: number): boolean {
  const b = blockAt(city, x, y);
  if (!b) return false;
  for (let k = b.b0; k < b.b1; k++) {
    const B = city.buildings[k];
    if (B.h > z && x >= B.x0 && x < B.x1 && y >= B.y0 && y < B.y1 && (!B.cut || B.cut.nx * x + B.cut.ny * y <= B.cut.c)) return true;
  }
  return false;
}

/** Per column: the window glass (distance, position along the wall, door), and the room's light on it. */
let gT = new Float32Array(0), gA = new Float32Array(0), gL = new Float32Array(0), gDoor = new Uint8Array(0);
/** Per column, the window's facing: |cos| of the ray against the pane's normal, and the ray's heading. */
let gC = new Float32Array(0), gH = new Float32Array(0);
/** Per cell: 1 where a window leaves the city to show through. */
let glass = new Uint8Array(0);

/**
 * One column of the floor around the viewer, drawn before the city: walls, floor and ceiling take
 * their cells (and depth), window cells are left for the city to fill (see glassPass). nearT[x]
 * gets the distance to the glass, so the falling rain is not drawn inside the room.
 */
export function interiorColumn(grid: CharGrid, x: number, I: Inside, px: number, py: number, rdx: number, rdy: number, eye: number, hor: number, scale: number, nearT: Float32Array) {
  const { cols, rows, depth } = grid, P = I.plan, B = I.box, office = isOffice(I.base);
  if (rowState.length < rows) rowState = new Uint8Array(rows);
  rowState.fill(0);
  if (gT.length !== cols) { gT = new Float32Array(cols); gA = new Float32Array(cols); gL = new Float32Array(cols * 3); gDoor = new Uint8Array(cols); gC = new Float32Array(cols); gH = new Float32Array(cols); }
  if (glass.length !== cols * rows) glass = new Uint8Array(cols * rows);
  gT[x] = 0;
  for (let y = 0; y < rows; y++) glass[y * cols + x] = 0;
  const z0 = I.z0, zc = z0 + CEIL;
  if (x === (cols >> 1)) picked = -1;
  // the stairwell is a shaft: its walls go on a storey up and down; every other room keeps to its
  // own floor and ceiling
  const well = stairRoom >= 0, FH = FLOOR_H;
  const zrOf = (z: number) => (((z - z0) % FH) + FH) % FH;
  const lo = (r: number) => (r === stairIdx ? z0 - FH : z0), hi = (r: number) => (r === stairIdx ? zc + FH : zc);
  let tClose = 0;

  // where the ray leaves the box (and the cut): that outer wall closes the column
  let tExit = 1e9, face = 0;
  if (rdx > 0) { const t = (B.x1 - px) / rdx; if (t < tExit) { tExit = t; face = 1; } } else if (rdx < 0) { const t = (B.x0 - px) / rdx; if (t < tExit) { tExit = t; face = 0; } }
  if (rdy > 0) { const t = (B.y1 - py) / rdy; if (t < tExit) { tExit = t; face = 3; } } else if (rdy < 0) { const t = (B.y0 - py) / rdy; if (t < tExit) { tExit = t; face = 2; } }
  const K = B.cut;
  if (K) { const dn = K.nx * rdx + K.ny * rdy; if (dn > 0) { const t = (K.c - K.nx * px - K.ny * py) / dn; if (t < tExit) { tExit = t; face = 4; } } }
  tExit = Math.max(tExit, 0.02);

  /** Draw the rows of a vertical span from za to zb (absolute) at distance t with paint from fn. */
  const span = (t: number, za: number, zb: number, fn: (y: number, z: number) => void) => {
    const ra = Math.max(0, Math.ceil(hor - ((zb - eye) * scale) / t - 0.5)), rb = Math.min(rows, Math.ceil(hor - ((za - eye) * scale) / t - 0.5));
    for (let y = ra; y < rb; y++) if (!rowState[y]) fn(y, eye + ((hor - (y + 0.5)) / scale) * t);
  };
  const put = (y: number, t: number, ch: number, r: number, g: number, b: number) => {
    const i = y * cols + x;
    grid.put(i, ch, r, g, b); grid.setBg(i, 7, 8, 12); depth[i] = t; grid.kind[i] = KIND.room; rowState[y] = 1;
  };

  // walk the plan's cells; a change of room is a wall, unless both cells are a doorway
  let i = Math.floor(px / CELL) - P.gx, j = Math.floor(py / CELL) - P.gy;
  const stX = rdx < 0 ? -1 : 1, stY = rdy < 0 ? -1 : 1;
  const dX = rdx !== 0 ? Math.abs(CELL / rdx) : 1e12, dY = rdy !== 0 ? Math.abs(CELL / rdy) : 1e12;
  let tX = rdx !== 0 ? (((P.gx + i + (rdx > 0 ? 1 : 0)) * CELL - px) / rdx) : 1e12;
  let tY = rdy !== 0 ? (((P.gy + j + (rdy > 0 ? 1 : 0)) * CELL - py) / rdy) : 1e12;
  const at = (a: number, b: number) => (a < 0 || b < 0 || a >= P.nx || b >= P.ny ? 0 : P.cells[b * P.nx + a]);
  let cur = at(i, j), closed = false;
  // the nearest door leaf this column's ray meets, drawn once the walk gets that far
  let lt = 1e9, lu = 0, lk = 1;
  for (let n = 0; n < I.leaves.length; n++) {
    const D = I.leaves[n], c = Math.cos(I.leafA[n]), s = Math.sin(I.leafA[n]);
    const ex = (D.ax * c + D.nx * s) * D.w, ey = (D.ay * c + D.ny * s) * D.w, den = rdx * ey - rdy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const qx = D.hx - px, qy = D.hy - py, t = (qx * ey - qy * ex) / den, u = (qx * rdy - qy * rdx) / den;
    if (t > 0.05 && t < lt && u >= 0 && u <= 1) { lt = t; lu = u; lk = 0.7 + 0.3 * Math.abs(-ey * rdx + ex * rdy) / (D.w * Math.hypot(rdx, rdy)); }
  }
  const leafUpTo = (limit: number) => {
    if (lt >= limit) return;
    const hx = px + rdx * lt, hy = py + rdy * lt, rr = (cellAt(P, hx, hy) & ROOM) - 1, office = isOffice(I.base);
    span(lt, z0, z0 + DOOR_H - 0.02, (y, z) => {
      const zz = z - z0;
      lightIn(I, Math.max(0, rr), hx, hy, lt);
      // a panel door: its edges, two recessed panels, and the knob near the far edge
      const edge = lu < 0.06 || lu > 0.94 || zz > DOOR_H - 0.1 || zz < 0.06;
      const knob = lu > 0.82 && lu < 0.9 && zz > 0.92 && zz < 1.06;
      const panel = !edge && lu > 0.16 && lu < 0.84 && ((zz > 0.25 && zz < 0.85) || (zz > 1.2 && zz < DOOR_H - 0.3));
      const col = office ? [118, 122, 130] : [118, 78, 46], k = lk * (edge ? 0.8 : panel ? 1.1 : 1);
      const ch = knob ? G.o : edge ? G.bar : panel ? G.col : G.eq;
      if (knob) put(y, lt, ch, 210 * L3[0], 175 * L3[1], 90 * L3[2]);
      else put(y, lt, ch, col[0] * k * L3[0], col[1] * k * L3[1], col[2] * k * L3[2]);
    });
    lt = 1e9;
  };
  for (let guard = 0; guard < 400; guard++) {
    const xStep = tX < tY, tn = xStep ? tX : tY;
    leafUpTo(Math.min(tn, tExit));
    if (tn >= tExit) break;
    if (xStep) { i += stX; tX += dX; } else { j += stY; tY += dY; }
    const nv = at(i, j);
    if (!nv) continue;
    if (!cur) { cur = nv; continue; }
    if ((nv & ROOM) !== (cur & ROOM)) {
      const r = (cur & ROOM) - 1, R = P.rooms[r], hx = px + rdx * tn, hy = py + rdy * tn;
      const u = xStep ? hy : hx, shade = xStep ? 1 : 0.82;
      // the lift's panel: on the long wall at the low coordinate, read left to right from inside
      let pw = -1;
      if (R.kind === 'lift' && I.liftN) {
        const longX = R.x1 - R.x0 >= R.y1 - R.y0;
        if (longX && !xStep && Math.abs(hy - R.y0) < 0.05) pw = (hx - ((R.x0 + R.x1) / 2 - PANEL_W / 2)) / PANEL_W;
        else if (!longX && xStep && Math.abs(hx - R.x0) < 0.05) pw = ((R.y0 + R.y1) / 2 + PANEL_W / 2 - hy) / PANEL_W;
      }
      const paint = (y: number, z: number) => {
        lightIn(I, r, hx, hy, tn);
        const b = pw >= 0 && pw <= 1 ? panelPaint(I, pw, z - z0, (I.colW * tn) / Math.max(1e-6, Math.abs(xStep ? rdx : rdy)) / PANEL_W, tn / scale, P4) : -2;
        if (b === -2) wallPaint(R, zrOf(z), u, P4);
        if (b >= 0 && x === (cols >> 1) && y === (rows >> 1)) picked = b;
        put(y, tn, P4[0], P4[1] * L3[0] * shade, P4[2] * L3[1] * shade, P4[3] * L3[2] * shade);
      };
      const r2 = (nv & ROOM) - 1;
      if (cur & nv & DOOR && !I.closed && well && (r === stairIdx || r2 === stairIdx)) {
        // a door of the shaft seen from inside it: open on this storey; a storey up or down, a dark
        // doorway (that floor is not drawn); the shaft's wall around them
        span(tn, z0 - FH, zc + FH, (y, z) => {
          const zz = z - z0, k = ((zz % FH) + FH) % FH, st = Math.floor(zz / FH);
          if (st === 0 && zz < DOOR_H) return; // open: on through
          if (k < DOOR_H) { put(y, tn, G.col, 10, 10, 12); return; }
          paint(y, z);
        });
        // through the opening only rows of this storey's doorway are left
      } else if (cur & nv & DOOR && !I.closed) {
        // a doorway: the lintel above it, and on through; over the way to the stairs or out to the
        // lobby, a green EXIT sign
        const k2 = P.rooms[(nv & ROOM) - 1]?.kind, k1 = R.kind;
        const toExit = k2 === 'stair' || (k2 === 'lobby' && k1 !== 'lobby');
        let s0 = 0, s1 = 0;
        if (toExit) {
          // the doorway's extent along the wall: the run of door cells on both sides
          const wi = xStep ? i - stX : i, wj = xStep ? j : j - stY;
          let a = 0, b = 0;
          const both = (q: number) => (xStep ? at(wi, j + q) & at(i, j + q) : at(i + q, wj) & at(i + q, j)) & DOOR;
          while (a > -8 && both(a - 1)) a--;
          while (b < 8 && both(b + 1)) b++;
          const base = xStep ? (P.gy + j) * CELL : (P.gx + i) * CELL;
          s0 = base + a * CELL; s1 = base + (b + 1) * CELL;
        }
        const rd = xStep ? toRight(0, 1, rdx, rdy) : toRight(1, 0, rdx, rdy);
        span(tn, z0 + DOOR_H, zc, (y, z) => {
          const zz = z - z0;
          if (toExit && zz > DOOR_H + 0.06 && zz < DOOR_H + 0.32) {
            const w = (u - s0) / (s1 - s0), m = 0.5 - 0.3 / (s1 - s0);
            if (w > 0.5 - m && w < 0.5 + m) {
              const du = (I.colW * tn) / Math.max(1e-6, Math.abs(xStep ? rdx : rdy)) / ((s1 - s0) * 2 * m);
              exitCell(rd ? (w - 0.5 + m) / (2 * m) : (0.5 + m - w) / (2 * m), (DOOR_H + 0.32 - zz) / 0.26, du, tn / scale / 0.26, P4); put(y, tn, P4[0], P4[1], P4[2], P4[3]); return;
            }
          }
          lightIn(I, r, hx, hy, tn); const k = z < z0 + DOOR_H + 0.08 ? 1.3 : 1; put(y, tn, G.eq, 120 * L3[0] * k, 95 * L3[1] * k, 70 * L3[2] * k);
        });
      } else { span(tn, lo(r), hi(r), paint); closed = true; tClose = tn; break; }
    }
    cur = nv;
  }

  const r0 = cur ? (cur & ROOM) - 1 : 0;
  if (!closed && P.rooms.length) {
    // the outer wall: windows on the facade's grid, the street door on the ground floor
    const t = tExit, hx = px + rdx * t, hy = py + rdy * t, R = P.rooms[r0];
    const along = face < 2 ? hy : face < 4 ? hx : hx * K!.ny - hy * K!.nx;
    const sp = faceSpan(B, face), corner = along - sp[0] < 0.35 || sp[1] - along < 0.35;
    const bay = along / BAY, fw = bay - Math.floor(bay), ground = I.floor === 0;
    let isDoor = false, du = 0, doorW = 1;
    if (ground) for (const D of I.exits) if (D.face === face && along > D.a0 && along < D.a1) { isDoor = true; du = (along - D.a0) / (D.a1 - D.a0); doorW = D.a1 - D.a0; }
    // metres of wall one column covers there
    const colA = (I.colW * t) / Math.max(1e-6, Math.abs(face < 2 ? rdx : face < 4 ? rdy : K!.nx * rdx + K!.ny * rdy));
    // reading left to right from inside: along the face's direction, or against it
    const fax = face < 2 ? 0 : face < 4 ? 1 : K!.ny, fay = face < 2 ? 1 : face < 4 ? 0 : -K!.nx, rdF = toRight(fax, fay, rdx, rdy);
    // a wall against the next building has no windows, up to that building's roof
    const nX = face === 0 ? -1 : face === 1 ? 1 : face === 4 ? K!.nx : 0, nY = face === 2 ? -1 : face === 3 ? 1 : face === 4 ? K!.ny : 0;
    const blind = builtUp(I.city, hx + nX * 0.3, hy + nY * 0.3, z0 + 1);
    // a panoramic lift: glass from the car's floor to its ceiling
    const liftGlass = R && R.kind === 'lift' && liftGlassAt(I.city, I.k, hx, hy);
    const shade = face === 4 ? 0.9 : face < 2 ? 1 : 0.82;
    nearT[x] = t; tClose = t;
    lightIn(I, r0, hx, hy, t);
    gT[x] = t; gA[x] = along; gDoor[x] = isDoor ? 1 : 0; gL[x * 3] = L3[0]; gL[x * 3 + 1] = L3[1]; gL[x * 3 + 2] = L3[2];
    gC[x] = Math.abs(nX * rdx + nY * rdy) / Math.hypot(rdx, rdy); gH[x] = Math.atan2(rdy, rdx);
    span(t, lo(r0), hi(r0), (y, z) => {
      const fz = z / FLOOR_H - Math.floor(z / FLOOR_H);
      if (isDoor) {
        // the street door from inside: a metal frame, the middle stile, a push bar and the top rail
        // around its two glass leaves; over it the green EXIT sign
        const zz = z - z0;
        if (zz > DOOR_H + 0.06 && zz < DOOR_H + 0.34 && du > 0.25 && du < 0.75) { exitCell(rdF ? (du - 0.25) * 2 : (0.75 - du) * 2, (DOOR_H + 0.34 - zz) / 0.28, colA / (doorW * 0.5), t / scale / 0.28, P4); put(y, t, P4[0], P4[1], P4[2], P4[3]); return; }
        if (zz < DOOR_H) {
          const frame = du < 0.05 || du > 0.95 || Math.abs(du - 0.5) < 0.025 || zz > DOOR_H - 0.1 || zz < 0.08;
          const bar = zz > 0.95 && zz < 1.08 && Math.abs(du - 0.5) > 0.08 && Math.abs(du - 0.5) < 0.42;
          if (frame || bar) { lightIn(I, r0, hx, hy, t); put(y, t, frame ? G.bar : G.eq, (bar ? 190 : 95) * L3[0], (bar ? 190 : 98) * L3[1], (bar ? 195 : 105) * L3[2]); return; }
          rowState[y] = 2; glass[y * cols + x] = 1; return;
        }
        // above the door and its sign: wall, never a window
        lightIn(I, r0, hx, hy, t); wallPaint(R, zrOf(z), along, P4);
        put(y, t, P4[0], P4[1] * L3[0] * shade, P4[2] * L3[1] * shade, P4[3] * L3[2] * shade);
        return;
      }
      if ((liftGlass && z > z0 + 0.12 && z < zc - 0.08) || (!corner && !blind && !liftGlass && windowHole(I.base, fw, fz, z - z0, ground))) { rowState[y] = 2; glass[y * cols + x] = 1; return; }
      lightIn(I, r0, hx, hy, t);
      const zr = zrOf(z);
      // the sill: just under a window
      if (!corner && !blind && zr < 1.5 && windowHole(I.base, fw, fz + 0.1 / FLOOR_H, zr + 0.1, ground)) { put(y, t, G.eq, 150 * L3[0], 140 * L3[1], 125 * L3[2]); return; }
      wallPaint(R, zr, along, P4);
      put(y, t, P4[0], P4[1] * L3[0] * shade, P4[2] * L3[1] * shade, P4[3] * L3[2] * shade);
    });
  }
  if (closed) nearT[x] = 1e9; // no window in this column: no rain at all

  if (stairIdx >= 0) {
    // the stairwell, wherever the ray crosses it (from inside, or through its door): the flights
    // repeat every storey, so at each point there is the stair surface right under the eye (a
    // flight, a landing, or the floor of the storey below) and, over it, the underside of the
    // flight a storey higher. March out along the ray filling rows from the bottom up to the
    // surface below and from the top down to the underside above; outside the well the room's own
    // floor and ceiling only bound what is left.
    let yLow = rows, yHigh = 0;
    const sr = P.rooms[stairIdx];
    const rowOf = (z: number, t: number) => Math.max(0, Math.min(rows, Math.ceil(hor - ((z - eye) * scale) / t - 0.5)));
    for (let t = 0.08; t < Math.min(tClose, 14); t += 0.03 + t * 0.02) {
      const wx = px + rdx * t, wy = py + rdy * t;
      if (!stairLocal(I.city, I.k, wx, wy) || (cellAt(P, wx, wy) & ROOM) - 1 !== stairIdx) {
        yLow = Math.min(yLow, rowOf(z0, t)); yHigh = Math.max(yHigh, rowOf(zc, t));
        continue;
      }
      const S = z0 + stairH(SL[0], SL[1], SL[2], SL[3]);
      // the copy of the stairs just under the eye (never below the ground), and the one over it
      const h0 = S + FH * Math.floor((eye - 0.05 - S) / FH), hf = Math.max(0, h0), hc = h0 + FH - 0.22;
      const b = SL[1] - STAIR_LAND, run = SL[3] - 2 * STAIR_LAND, inRun = b > 0 && b < run;
      const edge = inRun && (b / 0.29) % 1 < 0.2;
      const yT = rowOf(hf, t), yB = rowOf(hc, t);
      lit3(sr, lamp, stairIdx * 3, wx, wy, t, I.day);
      for (let y = yT; y < yLow; y++) {
        if (rowState[y] === 2 || (rowState[y] === 1 && depth[y * cols + x] <= t)) continue; // glass, or a nearer wall
        const k = edge ? 1.35 : 1;
        put(y, t, edge ? G.us : G.eq, 125 * L3[0] * k, 125 * L3[1] * k, 120 * L3[2] * k);
      }
      for (let y = yHigh; y < yB; y++) {
        if (rowState[y] === 2 || (rowState[y] === 1 && depth[y * cols + x] <= t)) continue;
        // the underside of a flight (concrete, its steps' rhythm), or of a landing
        put(y, t, inRun && (b / 0.29) % 1 < 0.15 ? G.dash : G.dot, 80 * L3[0], 80 * L3[1], 84 * L3[2]);
      }
      yLow = Math.min(yLow, yT); yHigh = Math.max(yHigh, yB);
    }
  }

  // floor and ceiling in the rows left: each row meets them at its own distance; past the reach of
  // the stairwell's march (or a storey away in it), the dark of the shaft
  for (let y = 0; y < rows; y++) {
    if (rowState[y]) continue;
    const m = (y + 0.5 - hor) / scale;
    const below = m > 0, t = below ? (eye - z0) / m : (zc - eye) / -m;
    if (!(t > 0) || t > 200) continue;
    const wx = px + rdx * t, wy = py + rdy * t;
    let c = at(Math.floor(wx / CELL) - P.gx, Math.floor(wy / CELL) - P.gy);
    if (!c) c = cur || 1;
    const r = (c & ROOM) - 1;
    if (r < 0 || r >= P.rooms.length) continue;
    if (r === stairIdx) { put(y, t, 32, 0, 0, 0); continue; }
    lightIn(I, r, wx, wy, t);
    if (below) floorPaint(P.rooms[r].kind, office, wx, wy, P4); else ceilPaint(P.rooms[r], office, lamp[r * 3] + lamp[r * 3 + 1] > 0.05, wx, wy, P4);
    put(y, t, P4[0], P4[1] * L3[0], P4[2] * L3[1], P4[3] * L3[2]);
  }
}




/** Light at a point of the viewer's floor, as a multiplier (for the furniture). */
export function insideLight(I: Inside, x: number, y: number): Float32Array {
  const c = cellAt(I.plan, x, y) & ROOM, r = c ? c - 1 : 0;
  if (!I.plan.rooms[r]) { L3[0] = L3[1] = L3[2] = 0.3; return L3; }
  lit3(I.plan.rooms[r], lamp, r * 3, x, y, 0, I.day);
  return L3;
}



