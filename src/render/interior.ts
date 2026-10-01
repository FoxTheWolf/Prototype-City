import { hash3 } from '../core/rng';
import { BAY, blockAt, faceSpan, FLOOR_H, type Building, type City, type RGB } from '../sim/city';
import { CEIL, CELL, cellAt, DOOR, DOOR_H, isOffice, type Door, type Plan, type Room, type RoomKind } from '../sim/interior';
import { type CharGrid } from './grid';

/**
 * The floor the viewer stands in, drawn column by column over the city: walls where the plan's rooms
 * meet, lintels over the doorways, the outer walls with their windows open onto the city that was
 * drawn first, then floor and ceiling. Everything is lit by the rooms' own lamps (on the building's
 * power) and, by day, by the windows.
 */
export interface Inside {
  city: City;
  plan: Plan;
  /** The lot's ground volume (style, door, shop) and the box this floor fills. */
  base: Building;
  box: Building;
  boxId: number;
  floor: number;
  door: Door | null;
  /** The building's electric light (blackouts), daylight 0..1, seconds, rain 0..1. */
  elec: number;
  day: number;
  sec: number;
  rain: number;
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
  const here = (cellAt(I.plan, x, y) & 127) - 1;
  const R = I.plan.rooms, n = R.length;
  if (lamp.length < n * 3) lamp = new Float32Array(n * 3 + 96);
  const litK = I.base.lit * (1 - 0.75 * I.day) * 1.3, office = isOffice(I.base);
  for (let r = 0; r < n; r++) {
    const kind = R[r].kind, common = R[r].unit < 0;
    const on = common || r === here || hash3(I.boxId, r * 31 + I.floor, 11) < litK;
    const c = !on ? null : kind === 'lobby' ? LOBBY : office || kind === 'stair' || kind === 'lift' ? TUBE : WARM;
    const k = c ? I.elec * (kind === 'stair' ? 0.7 : 1) : 0;
    lamp[r * 3] = c ? (c[0] / 255) * k : 0; lamp[r * 3 + 1] = c ? (c[1] / 255) * k : 0; lamp[r * 3 + 2] = c ? (c[2] / 255) * k : 0;
  }
}

/** Squared distance from (x, y) to the nearest ceiling lamp of a room: they hang about every 4 m. */
function lampD2(R: Room, x: number, y: number) {
  const w = R.x1 - R.x0, h = R.y1 - R.y0, sx = w / Math.max(1, Math.round(w / 4)), sy = h / Math.max(1, Math.round(h / 4));
  const dx = ((((x - R.x0) % sx) + sx) % sx) - sx / 2, dy = ((((y - R.y0) % sy) + sy) % sy) - sy / 2;
  return dx * dx + dy * dy;
}

const L3 = new Float32Array(3);
/** Light at a point of room r into L3: its lamps, plus ambient. */
function lightIn(I: Inside, r: number, x: number, y: number, t: number) {
  const k = (0.5 + 0.9 / (1 + lampD2(I.plan.rooms[r], x, y) / 5)) / (1 + t * 0.03);
  // a dark room still gets the city's glow through the windows; by day, the daylight
  const a = 0.14 + 0.5 * I.day;
  L3[0] = lamp[r * 3] * k + a; L3[1] = lamp[r * 3 + 1] * k + a * 1.05; L3[2] = lamp[r * 3 + 2] * k + a * 1.25;
}

/** Window openings of a facade style, as wallColumn draws them: fw across the bay, fz up the storey. */
function windowHole(B: Building, fw: number, fz: number, z: number, ground: boolean): boolean {
  if (ground && B.shop) return fw > 0.12 && fw < 0.88 && z > 0.2 && z < 2.6;
  switch (B.style) {
    case 'glass': return fw >= 0.07 && fz >= 0.08;
    case 'residential': return fw > 0.25 && fw < 0.75 && fz > 0.3 && fz < 0.78;
    case 'brick': return fw > 0.3 && fw < 0.7 && fz > 0.3 && fz < 0.78;
    default: return fw > 0.2 && fw < 0.8 && fz > 0.28 && fz < 0.8;
  }
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
      const c = PAINT[(R.unit * 7 + 3) % PAINT.length], h = hash3(R.unit, 5, 9);
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
function ceilPaint(I: Inside, r: number, x: number, y: number, out: number[]) {
  const R = I.plan.rooms[r], on = lamp[r * 3] + lamp[r * 3 + 1] > 0.05;
  out[0] = G.dot; out[1] = 150; out[2] = 148; out[3] = 142;
  if (isOffice(I.base) || R.kind === 'stair' || R.kind === 'lift') {
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
  if (gT.length !== cols) { gT = new Float32Array(cols); gA = new Float32Array(cols); gL = new Float32Array(cols * 3); gDoor = new Uint8Array(cols); }
  if (glass.length !== cols * rows) glass = new Uint8Array(cols * rows);
  gT[x] = 0;
  for (let y = 0; y < rows; y++) glass[y * cols + x] = 0;
  const z0 = I.floor * FLOOR_H, zc = z0 + CEIL;

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
    grid.put(i, ch, r, g, b); grid.setBg(i, 7, 8, 12); depth[i] = t; rowState[y] = 1;
  };

  // walk the plan's cells; a change of room is a wall, unless both cells are a doorway
  let i = Math.floor(px / CELL) - P.gx, j = Math.floor(py / CELL) - P.gy;
  const stX = rdx < 0 ? -1 : 1, stY = rdy < 0 ? -1 : 1;
  const dX = rdx !== 0 ? Math.abs(CELL / rdx) : 1e12, dY = rdy !== 0 ? Math.abs(CELL / rdy) : 1e12;
  let tX = rdx !== 0 ? (((P.gx + i + (rdx > 0 ? 1 : 0)) * CELL - px) / rdx) : 1e12;
  let tY = rdy !== 0 ? (((P.gy + j + (rdy > 0 ? 1 : 0)) * CELL - py) / rdy) : 1e12;
  const at = (a: number, b: number) => (a < 0 || b < 0 || a >= P.nx || b >= P.ny ? 0 : P.cells[b * P.nx + a]);
  let cur = at(i, j), closed = false;
  for (let guard = 0; guard < 400; guard++) {
    const xStep = tX < tY, tn = xStep ? tX : tY;
    if (tn >= tExit) break;
    if (xStep) { i += stX; tX += dX; } else { j += stY; tY += dY; }
    const nv = at(i, j);
    if (!nv) continue;
    if (!cur) { cur = nv; continue; }
    if ((nv & 127) !== (cur & 127)) {
      const r = (cur & 127) - 1, R = P.rooms[r], hx = px + rdx * tn, hy = py + rdy * tn;
      const u = xStep ? hy : hx, shade = xStep ? 1 : 0.82;
      const paint = (y: number, z: number) => {
        lightIn(I, r, hx, hy, tn);
        wallPaint(R, z - z0, u, P4);
        put(y, tn, P4[0], P4[1] * L3[0] * shade, P4[2] * L3[1] * shade, P4[3] * L3[2] * shade);
      };
      if (cur & nv & DOOR) {
        // a doorway: the lintel above it, and on through
        span(tn, z0 + DOOR_H, zc, (y, z) => { lightIn(I, r, hx, hy, tn); const k = z < z0 + DOOR_H + 0.08 ? 1.3 : 1; put(y, tn, G.eq, 120 * L3[0] * k, 95 * L3[1] * k, 70 * L3[2] * k); });
      } else { span(tn, z0, zc, paint); closed = true; break; }
    }
    cur = nv;
  }

  const r0 = cur ? (cur & 127) - 1 : 0;
  if (!closed && P.rooms.length) {
    // the outer wall: windows on the facade's grid, the street door on the ground floor
    const t = tExit, hx = px + rdx * t, hy = py + rdy * t, R = P.rooms[r0];
    const along = face < 2 ? hy : face < 4 ? hx : hx * K!.ny - hy * K!.nx;
    const sp = faceSpan(B, face), corner = along - sp[0] < 0.35 || sp[1] - along < 0.35;
    const bay = along / BAY, fw = bay - Math.floor(bay), ground = I.floor === 0;
    const D = I.door, isDoor = ground && D && D.face === face && along > D.a0 && along < D.a1;
    // a wall against the next building has no windows, up to that building's roof
    const nX = face === 0 ? -1 : face === 1 ? 1 : face === 4 ? K!.nx : 0, nY = face === 2 ? -1 : face === 3 ? 1 : face === 4 ? K!.ny : 0;
    const blind = builtUp(I.city, hx + nX * 0.3, hy + nY * 0.3, z0 + 1);
    const shade = face === 4 ? 0.9 : face < 2 ? 1 : 0.82;
    nearT[x] = t;
    lightIn(I, r0, hx, hy, t);
    gT[x] = t; gA[x] = along; gDoor[x] = isDoor ? 1 : 0; gL[x * 3] = L3[0]; gL[x * 3 + 1] = L3[1]; gL[x * 3 + 2] = L3[2];
    span(t, z0, zc, (y, z) => {
      const fz = z / FLOOR_H - I.floor;
      if ((isDoor && z < z0 + DOOR_H) || (!corner && !blind && windowHole(I.base, fw, fz, z - z0, ground))) { rowState[y] = 2; glass[y * cols + x] = 1; return; }
      lightIn(I, r0, hx, hy, t);
      const zr = z - z0;
      // the sill: just under a window
      if (!corner && !blind && zr < 1.5 && windowHole(I.base, fw, fz + 0.1 / FLOOR_H, zr + 0.1, ground)) { put(y, t, G.eq, 150 * L3[0], 140 * L3[1], 125 * L3[2]); return; }
      wallPaint(R, zr, along, P4);
      put(y, t, P4[0], P4[1] * L3[0] * shade, P4[2] * L3[1] * shade, P4[3] * L3[2] * shade);
    });
  }
  if (closed) nearT[x] = 0;

  // floor and ceiling in the rows left: each row meets them at its own distance
  for (let y = 0; y < rows; y++) {
    if (rowState[y]) continue;
    const m = (y + 0.5 - hor) / scale;
    const below = m > 0, t = below ? (eye - z0) / m : (zc - eye) / -m;
    if (!(t > 0) || t > 200) continue;
    const wx = px + rdx * t, wy = py + rdy * t;
    let c = at(Math.floor(wx / CELL) - P.gx, Math.floor(wy / CELL) - P.gy);
    if (!c) c = cur || 1;
    const r = (c & 127) - 1;
    if (r < 0 || r >= P.rooms.length) continue;
    lightIn(I, r, wx, wy, t);
    if (below) floorPaint(P.rooms[r].kind, office, wx, wy, P4); else ceilPaint(I, r, wx, wy, P4);
    put(y, t, P4[0], P4[1] * L3[0], P4[2] * L3[1], P4[3] * L3[2]);
  }
}

/**
 * After the city (and the cars) are in: the window cells get the glass, a little darker, with the
 * room's lamp reflected in it and, when it rains, drops sliding down and beads that stay.
 */
export function glassPass(grid: CharGrid, I: Inside, eye: number, hor: number, scale: number) {
  const { cols, rows, cells } = grid, z0 = I.floor * FLOOR_H;
  for (let x = 0; x < cols; x++) {
    const t = gT[x];
    if (!t) continue;
    const along = gA[x], lr = gL[x * 3], lg = gL[x * 3 + 1], lb = gL[x * 3 + 2];
    const col = Math.floor(along * 9), speed = 0.25 + hash3(col, 1, 7) * 0.5, ph = hash3(col, 2, 7) * 9, slides = hash3(col, 3, 7) < I.rain * 0.5;
    for (let y = 0; y < rows; y++) {
      if (!glass[y * cols + x]) continue;
      const k4 = (y * cols + x) * 4;
      cells[k4 + 1] = cells[k4 + 1] * 0.82 + 14 * lr; cells[k4 + 2] = cells[k4 + 2] * 0.82 + 14 * lg; cells[k4 + 3] = cells[k4 + 3] * 0.85 + 16 * lb;
      if (I.rain > 0 && !gDoor[x]) {
        const z = eye + ((hor - (y + 0.5)) / scale) * t, dz = ((z - z0) + I.sec * speed + ph) % 3;
        const slide = slides && dz < (t / scale) * 1.2;
        const bead = hash3(Math.floor(along * 14), Math.floor(z * 14), 8) < I.rain * 0.06;
        if (slide || bead) { cells[k4] = slide ? G.com : G.dot; cells[k4 + 1] += 50; cells[k4 + 2] += 55; cells[k4 + 3] += 65; }
      }
    }
  }
}
