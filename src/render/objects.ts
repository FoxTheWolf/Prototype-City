import { hash3 } from '../core/rng';
import { type RGB } from '../sim/city';
import { type CharGrid, KIND } from './grid';
import { BULB_COLS, BULB_ROWS, bulbGlyph, bulbsIn, fontRows, SYMBOLS } from './signs';

/**
 * Street objects built from a few solid parts (boxes, upright cylinders, ellipsoids) in the
 * object's own frame: +x forward, +y to its right (the world's y grows south, so a heading's
 * right-hand side is +y), z up, in metres.
 *
 * With y-shearing, every screen cell is a straight 3D ray: from the eye, t metres forward along
 * the column's ray, rising (hor - row) / scale per metre. So each part is hit exactly, and t is
 * the same depth the walls and ground write to the depth buffer.
 */
export const Shape = { Box: 0, Cyl: 1, Ball: 2 } as const;
/**
 * Solid: shaded glyphs. Leaf: glyph noise fixed to the surface. Glow: a light, unshaded. Text: a lit
 * panel with the part's text stacked top to bottom on its two broad (y) faces, under a square
 * symbol when `sym` is set (see SYMBOLS). Up close letters and symbol are drawn as bulbs, like the
 * shop signs; farther, as glyphs; farther still, a lit bar. Board: a painted billboard facing +x,
 * its text across it in 5x7 block letters (`col2` on `col`), lit from below by `lamp` (0..1).
 */
export const Mat = { Solid: 0, Leaf: 1, Glow: 2, Text: 3, Board: 4, Wheel: 5, Glass: 6 } as const;
/*
 * Wheel: a tyre (an ellipsoid flattened along y), drawn from the side as hub, spokes and a rubber
 * ring with a scuff of dirt, all turning by the object's `wheel` angle. Glass: see-through; the
 * ray goes on to what is behind (in the object or the world) and only tints it and catches a sheen.
 */

export interface Part {
  shape: number;
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
  col: RGB;
  mat: number;
  /** Glyph on the sides, on top, and on the front/back (x) faces of a box. */
  side: number;
  top: number;
  end: number;
  text?: string;
  sym?: number;
  col2?: RGB;
  lamp?: number;
  /** Board: the letters are lamps (bulbs up close, lit glyphs farther), not paint. */
  bulbs?: boolean;
}

export interface Obj {
  x: number;
  y: number;
  /** cos and sin of the heading */
  c: number;
  s: number;
  parts: Part[];
  /** Bounding radius around (x, y) and height, to find the screen area. */
  r: number;
  h: number;
  seed: number;
  /** Height of its lowest part, when it does not stand on the ground (a rooftop billboard). */
  z0?: number;
  /**
   * A vehicle's body on its springs: parts off the ground move up and down by lift, and by pitch
   * (nose down) and roll (toward +y) about the middle; the wheels (on the ground) show their turn.
   */
  pitch?: number;
  roll?: number;
  lift?: number;
  wheel?: number;
}

export interface Cam {
  x: number; y: number; eye: number;
  dirX: number; dirY: number; plX: number; plY: number;
  plane: number; scale: number; hor: number;
  /** Fog reaches its end here. */
  far: number;
  /** All the light reaching a world point at a height, as r, g, b. */
  light: (x: number, y: number, z: number) => Float32Array;
  /** Snow lying on top faces, 0..1. */
  snow?: number;
  /** Indoors: light multiplies the colors (the room's lamps) instead of adding to them. */
  mul?: boolean;
}

const C = (s: string) => s.charCodeAt(0);
const LEAF = [C('@'), C('&'), C('%'), C('#'), C('*')];
const TYRE: RGB = [52, 52, 56], HUB: RGB = [170, 170, 175], RIM: RGB = [140, 140, 148], DIRT: RGB = [110, 90, 62];
const SPOKES = [C('|'), C('/'), C('-'), C('\\')];
/** Height the body leans about. */
const PIVOT = 0.7;

export function part(shape: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: RGB, mat: number, side: string, top = side, end = side): Part {
  return { shape, x0, y0, z0, x1, y1, z1, col, mat, side: C(side), top: C(top), end: C(end) };
}

// part centers and half sizes of the current object, widened so thin parts never fall between cells
let P = new Float64Array(32 * 6);
// per column: the parts its ray can meet (seen from above), and the rows each of them can cover
let CAND = new Int16Array(32), CY0 = new Int32Array(32), CY1 = new Int32Array(32);
// the light last sampled in this column, reused for points close to it
const LC = new Float32Array(3);
/** Metres a leaning body can move a part sideways or up (springs, small angles). */
const LEAN = 0.3;

export function drawObjects(grid: CharGrid, objs: Obj[], v: Cam) {
  const { cols, rows, depth } = grid;
  const invDet = 1 / (v.plX * v.dirY - v.dirX * v.plY);
  const colW = (2 * v.plane) / cols;
  for (const o of objs) {
    const rx = o.x - v.x, ry = o.y - v.y;
    const tY = invDet * (-v.plY * rx + v.plX * ry);
    if (tY + o.r < 0.3 || tY - o.r > v.far) continue;
    const tX = invDet * (v.dirY * rx - v.dirX * ry);

    // screen area: project the four corners of the bounding square (camera space: depth tY, side tX).
    // A corner at or behind the near plane stretches the area to the screen edge on its side.
    let sx0 = 1e9, sx1 = -1e9, behind = false;
    for (let k = 0; k < 4; k++) {
      const cy = tY + (k & 1 ? o.r : -o.r), cx = tX + (k & 2 ? o.r : -o.r);
      if (cy < 0.3) { behind = true; continue; }
      const sx = (cols / 2) * (1 + cx / cy);
      sx0 = Math.min(sx0, sx); sx1 = Math.max(sx1, sx);
    }
    if (behind) {
      // where the square crosses the near plane it runs off the screen: left, right, or both if it surrounds the eye
      if (tX - o.r < 0) sx0 = -1e9;
      if (tX + o.r > 0) sx1 = 1e9;
    }
    const x0 = Math.max(0, Math.floor(sx0)), x1 = Math.min(cols, Math.ceil(sx1));
    if (x0 >= x1) continue;
    // parts thinner than a cell at this distance are widened to half a cell, so poles do not flicker
    const mh = 0.5 * colW * Math.max(tY, 0.3), mz = (0.5 * Math.max(tY, 0.3)) / v.scale;
    const n = o.parts.length;
    // (the work arrays grow to the largest object seen)
    if (n > CAND.length) { P = new Float64Array(n * 6); CAND = new Int16Array(n); CY0 = new Int32Array(n); CY1 = new Int32Array(n); }
    for (let k = 0; k < n; k++) {
      const q = o.parts[k], j = k * 6;
      P[j] = (q.x0 + q.x1) / 2; P[j + 1] = (q.y0 + q.y1) / 2; P[j + 2] = (q.z0 + q.z1) / 2;
      P[j + 3] = Math.max((q.x1 - q.x0) / 2, mh); P[j + 4] = Math.max((q.y1 - q.y0) / 2, mh); P[j + 5] = Math.max((q.z1 - q.z0) / 2, mz);
    }
    const fog = 1 - Math.min(1, tY / v.far) * 0.8;
    // camera in the object's frame
    const ox = (v.x - o.x) * o.c + (v.y - o.y) * o.s, oy = -(v.x - o.x) * o.s + (v.y - o.y) * o.c, oz = v.eye;
    const ox0 = ox, oy0 = oy, oz0 = oz;

    for (let x = x0; x < x1; x++) {
      const camX = (2 * (x + 0.5)) / cols - 1;
      const rdx = v.dirX + v.plX * camX, rdy = v.dirY + v.plY * camX;
      const dx = rdx * o.c + rdy * o.s, dy = -rdx * o.s + rdy * o.c, dx0 = dx, dy0 = dy;
      // this column's ray against the bounding circle: the depths [ta, tb] where the object can be,
      // hence the only rows it can cover
      const R = o.r + mh, qa = dx * dx + dy * dy, qb = ox * dx + oy * dy, disc = qb * qb - qa * (ox * ox + oy * oy - R * R);
      if (disc < 0) continue;
      const sq = Math.sqrt(disc), tb = (-qb + sq) / qa;
      if (tb < 0.05) continue;
      const ta = Math.max(0.05, (-qb - sq) / qa), up = o.h - v.eye, down = v.eye - (o.z0 ?? 0);
      const y0 = Math.max(0, Math.floor(v.hor - (up * v.scale) / (up > 0 ? ta : tb)));
      const y1 = Math.min(rows, Math.ceil(v.hor + (down * v.scale) / (down > 0 ? ta : tb)));
      // the parts this column can meet: their box seen from above against the ray, and from the
      // depths where it does, the rows they can reach (a leaning body's parts get some slack)
      let nc = 0;
      const leans = o.lift !== undefined;
      for (let k = 0; k < n; k++) {
        const j = k * 6, sl = leans && o.parts[k].z0 > 0 ? LEAN : 0;
        const hx = P[j + 3] + sl, hy = P[j + 4] + sl;
        let tA = 0.05, tB = 1e9;
        if (Math.abs(dx) < 1e-9) { if (Math.abs(ox - P[j]) > hx) continue; }
        else { let a = (P[j] - hx - ox) / dx, b = (P[j] + hx - ox) / dx; if (a > b) { const t = a; a = b; b = t; } tA = Math.max(tA, a); tB = Math.min(tB, b); }
        if (Math.abs(dy) < 1e-9) { if (Math.abs(oy - P[j + 1]) > hy) continue; }
        else { let a = (P[j + 1] - hy - oy) / dy, b = (P[j + 1] + hy - oy) / dy; if (a > b) { const t = a; a = b; b = t; } tA = Math.max(tA, a); tB = Math.min(tB, b); }
        if (tA > tB) continue;
        const zhi = P[j + 2] + P[j + 5] + sl - oz, zlo = P[j + 2] - P[j + 5] - sl - oz;
        const eMax = zhi / (zhi > 0 ? tA : tB), eMin = zlo / (zlo > 0 ? tB : tA);
        CAND[nc] = k; CY0[nc] = Math.floor(v.hor - eMax * v.scale - 1.5); CY1[nc] = Math.ceil(v.hor - eMin * v.scale + 0.5); nc++;
      }
      if (!nc) continue;
      let lx = 1e9, ly = 1e9, lz = 1e9;
      for (let y = y0; y < y1; y++) {
        const i = y * cols + x;
        // cells where something nearer than the whole object is already drawn
        if (depth[i] <= ta) continue;
        const dz = (v.hor - (y + 0.5)) / v.scale, dz0 = dz;
        let best = depth[i], bk = -1, face = 0, nx = 0, ny = 0, nz = 0, glassT = 1e9;
        // a vehicle's body leans on its springs: its parts off the ground are hit by the ray turned
        // (and lifted) into the body's frame, pivoting about its middle (small angles)
        const tilt = o.lift !== undefined, pt = o.pitch ?? 0, rl = o.roll ?? 0;
        const bOx = ox - pt * (oz - PIVOT), bOy = oy - rl * (oz - PIVOT), bOz = oz + pt * ox + rl * oy - (o.lift ?? 0);
        const bDx = dx - pt * dz, bDy = dy - rl * dz, bDz = dz + pt * dx + rl * dy;
        for (let m = 0; m < nc; m++) {
          if (y < CY0[m] || y > CY1[m]) continue;
          const k = CAND[m], j = k * 6, cx = P[j], cy = P[j + 1], cz = P[j + 2], hx = P[j + 3], hy = P[j + 4], hz = P[j + 5];
          const part = o.parts[k], shape = part.shape, body = tilt && part.z0 > 0, glassy = part.mat === Mat.Glass;
          const ox = body ? bOx : ox0, oy = body ? bOy : oy0, oz = body ? bOz : oz0, dx = body ? bDx : dx0, dy = body ? bDy : dy0, dz = body ? bDz : dz0;
          if (shape === Shape.Box) {
            let tmin = -1e9, tmax = 1e9, ax = 0;
            if (Math.abs(dx) < 1e-9) { if (Math.abs(ox - cx) > hx) continue; }
            else { let a = (cx - hx - ox) / dx, b = (cx + hx - ox) / dx; if (a > b) { const t = a; a = b; b = t; } if (a > tmin) { tmin = a; ax = 0; } if (b < tmax) tmax = b; }
            if (Math.abs(dy) < 1e-9) { if (Math.abs(oy - cy) > hy) continue; }
            else { let a = (cy - hy - oy) / dy, b = (cy + hy - oy) / dy; if (a > b) { const t = a; a = b; b = t; } if (a > tmin) { tmin = a; ax = 1; } if (b < tmax) tmax = b; }
            if (Math.abs(dz) < 1e-9) { if (Math.abs(oz - cz) > hz) continue; }
            else { let a = (cz - hz - oz) / dz, b = (cz + hz - oz) / dz; if (a > b) { const t = a; a = b; b = t; } if (a > tmin) { tmin = a; ax = 2; } if (b < tmax) tmax = b; }
            if (tmin > tmax || tmin <= 0.05 || tmin >= best) continue;
            if (glassy) { glassT = Math.min(glassT, tmin); continue; }
            best = tmin; bk = k; face = ax;
            nx = ax === 0 ? 1 : 0; ny = ax === 1 ? 1 : 0; nz = ax === 2 ? 1 : 0;
          } else {
            // upright elliptic cylinder or ellipsoid, solved in the space where it is a unit shape
            const X = (ox - cx) / hx, Y = (oy - cy) / hy, DX = dx / hx, DY = dy / hy;
            if (shape === Shape.Cyl) {
              const a = DX * DX + DY * DY, b = X * DX + Y * DY, disc = b * b - a * (X * X + Y * Y - 1);
              if (disc < 0) continue;
              let t = (-b - Math.sqrt(disc)) / a;
              if (t > 0.05 && Math.abs(oz + dz * t - cz) <= hz) {
                if (t >= best) continue;
                if (glassy) { glassT = Math.min(glassT, t); continue; }
                best = t; bk = k; face = 1; nx = X + DX * t; ny = Y + DY * t; nz = 0;
              } else if (dz < 0 && oz > cz + hz) {
                t = (cz + hz - oz) / dz;
                const u = X + DX * t, w = Y + DY * t;
                if (t <= 0.05 || t >= best || u * u + w * w > 1) continue;
                best = t; bk = k; face = 2; nx = 0; ny = 0; nz = 1;
              }
            } else {
              const Z = (oz - cz) / hz, DZ = dz / hz;
              const a = DX * DX + DY * DY + DZ * DZ, b = X * DX + Y * DY + Z * DZ, disc = b * b - a * (X * X + Y * Y + Z * Z - 1);
              if (disc < 0) continue;
              const t = (-b - Math.sqrt(disc)) / a;
              if (t <= 0.05 || t >= best) continue;
              if (glassy) { glassT = Math.min(glassT, t); continue; }
              best = t; bk = k; nx = X + DX * t; ny = Y + DY * t; nz = Z + DZ * t; face = nz > 0.75 ? 2 : 1;
            }
          }
        }
        if (bk < 0) {
          // only glass in the way: what is already drawn behind it shows through, tinted
          if (glassT < depth[i]) { const k4 = i * 4, c = grid.cells; c[k4 + 1] = c[k4 + 1] * 0.62 + 18; c[k4 + 2] = c[k4 + 2] * 0.68 + 26; c[k4 + 3] = c[k4 + 3] * 0.74 + 34; }
          continue;
        }
        const q = o.parts[bk];
        let ch: number, k: number, col = q.col;
        if (q.mat === Mat.Glow) { ch = q.side; k = 0.6 + 0.4 * fog; }
        else if (q.mat === Mat.Wheel) {
          // from the side: the hub, five spokes and the tyre with a scuff, turned by the wheel angle;
          // from the front or back, just the tread
          const j = bk * 6, wx = (ox + dx * best - P[j]) / P[j + 3], wz = (oz + dz * best - P[j + 2]) / P[j + 5];
          const rr = Math.hypot(wx, wz), ang = Math.atan2(wz, wx) + (o.wheel ?? 0), sec = (((ang / (Math.PI * 2)) % 1) + 1) % 1;
          k = (0.75 + 0.25 * Math.abs(ny)) * fog;
          if (Math.abs(ny) < 0.55) { ch = Math.floor(sec * 16) & 1 ? C('=') : C('-'); col = TYRE; }
          else if (rr < 0.28) { ch = C('o'); col = HUB; }
          else if (rr < 0.62) { const f = (sec * 5) % 1; ch = f < 0.3 ? SPOKES[Math.floor(sec * 20) & 3] : C('.'); col = f < 0.3 ? RIM : TYRE; }
          else { ch = sec > 0.08 && sec < 0.16 ? C('%') : Math.floor(sec * 12) & 1 ? C('#') : C('*'); col = sec > 0.08 && sec < 0.16 ? DIRT : TYRE; }
        }
        else if (q.mat === Mat.Board && face === 0 && ox > q.x1 && q.text) {
          // the billboard's face, read left to right from the front (+x): from +y toward -y
          const hy = oy + dy * best, hz = oz + dz * best, W = q.y1 - q.y0, H = q.z1 - q.z0, n = q.text.length;
          const perCol = (colW * best) / Math.max(1e-6, Math.abs(dx)), perRow = best / v.scale;
          // margins scale down on small panels (a walk signal); a billboard keeps 0.8 m and a 0.2 m rim
          const lw = Math.min((W - Math.min(0.8, W * 0.2)) / n, (H * 0.62) / 1.4), lh = lw * 1.4, start = (W - n * lw) / 2;
          const u = q.y1 - hy - start, li = Math.floor(u / lw), fz = ((q.z0 + q.z1) / 2 + lh / 2 - hz) / lh;
          // lamp letters (a walk signal) have no rim, are bulbs only when they span 4 rows, and keep
          // a glyph per letter as long as each has a column, even when shorter than a row
          const frame = !q.bulbs && (Math.min(hy - q.y0, q.y1 - hy) < Math.max(Math.min(0.2, W * 0.05), perCol / 2) || Math.min(hz - q.z0, q.z1 - hz) < Math.max(Math.min(0.2, H * 0.08), perRow / 2));
          let fg = false;
          ch = C('.');
          if (frame) ch = C('=');
          else if (li >= 0 && li < n && ((fz >= 0 && fz < 1) || q.bulbs)) {
            const c = q.text.charCodeAt(li), fu = (u / lw - li) * 1.25 - 0.12;
            if (q.bulbs ? lw / perCol >= 3.5 && lh / perRow >= 4 : lw / perCol >= BULB_COLS && lh / perRow >= BULB_ROWS) {
              // block letters painted as a 5x7 grid (0.8 of the slot across), counted per cell like the bulbs
              const rows = fontRows(c), ux = (lw * 0.8) / 5, uz = lh / 7, hx = perCol / ux / 2, hz = perRow / uz / 2;
              const nb = rows ? bulbsIn(rows, 5, fu * 5, fz * 7, hx, hz) : 0;
              fg = nb > 0; if (fg) ch = q.bulbs ? bulbGlyph(nb, hx, hz) : bulbGlyph(nb, hx, hz) === 58 ? C(':') : C('#');
            }
            else if (lw / perCol >= 0.9 && (q.bulbs || lh / perRow >= 0.9)) {
              // one glyph in the cell holding the letter's center
              fg = Math.abs(u - (li + 0.5) * lw) < perCol / 2 && Math.abs(fz - 0.5) * lh < perRow / 2 + 0.01;
              if (fg) ch = c;
            } else { fg = hash3(li, 1, 9) < 0.6; ch = C('='); }
          }
          if (frame) col = [60, 58, 55]; else if (fg) col = q.col2 ?? col;
          // gooseneck lamps along the bottom light it from below, fading upward
          k = (0.55 + 0.25 * hash3(Math.floor(hy * 2), Math.floor(hz * 2), 7)) * fog + (q.lamp ?? 0) * 1.3 * Math.max(0, 1 - (hz - q.z0) / H);
          if (q.bulbs && fg) k = 0.75 + 0.45 * fog; // lit letters glow through the fog
        }
        else if (q.mat === Mat.Text && face === 1 && q.text) {
          // the cell's size on the face: metres along x per column, and metres per row
          const hx = ox + dx * best, hz = oz + dz * best, W = q.x1 - q.x0;
          const perCol = (colW * best) / Math.max(1e-6, Math.abs(dy)), perRow = best / v.scale;
          const sym = q.sym ?? -1, symH = sym >= 0 ? W : 0, n = q.text.length, lh = (q.z1 - q.z0 - symH) / n;
          // the slot this cell is in: the symbol square on top, or one letter; its box and bulb grid
          let rows: number[] | undefined, bw: number, bh: number, sx0: number, sz0: number, sw: number, sh: number, far: number;
          if (hz > q.z1 - symH) { rows = SYMBOLS[sym].rows; bw = bh = 9; sw = sh = W * 0.9; sx0 = q.x0 + W * 0.05; sz0 = q.z1 - W * 0.05; far = SYMBOLS[sym].far; }
          else {
            const li = Math.min(n - 1, Math.floor((q.z1 - symH - hz) / lh));
            far = q.text.charCodeAt(li); rows = fontRows(far); bw = 5; bh = 7;
            sw = Math.min(W * 0.66, lh * 0.62); sh = lh * 0.8; sx0 = (q.x0 + q.x1 - sw) / 2; sz0 = q.z1 - symH - li * lh - lh * 0.1;
          }
          const small = perRow > lh * 0.9; // far away the panel blurs into a lit bar
          if (small) { ch = C('|'); k = 0.7; }
          else if (rows && sw / perCol >= BULB_COLS && sh / perRow >= BULB_ROWS) {
            // up close: bulbs, counted per cell (bulb units across and down)
            // read left to right from either side: seen from -y, +x is to the viewer's left
            const ux = sw / bw, uz = sh / bh, px = (oy < 0 ? sx0 + sw - hx : hx - sx0) / ux, pz = (sz0 - hz) / uz;
            const nb = bulbsIn(rows, bw, px, pz, perCol / ux / 2, perRow / uz / 2);
            const bx = Math.floor(px), by = Math.floor(pz);
            if (nb) { ch = bulbGlyph(nb, perCol / ux / 2, perRow / uz / 2); k = 1.25; }
            else if (bx >= 0 && bx < bw && by >= 0 && by < bh && (rows[by] >> (bw - 1 - bx)) & 1) { ch = 32; k = 0.45; }
            else { ch = 32; k = 0.12; }
          } else {
            // a glyph in the one cell holding the slot's center; the rest of the panel glows faintly
            const center = Math.abs(hx - (sx0 + sw / 2)) < Math.max(perCol, 0.05) / 2 && Math.abs(hz - (sz0 - sh / 2)) < perRow / 2 + 0.01;
            ch = center ? far : 32; k = center ? 1 : 0.3;
          }
        }
        else {
          // lit like the buildings: faces turned along x brighter, tops brightest
          const wn = Math.abs(nx * o.c - ny * o.s) / (Math.hypot(nx, ny) || 1);
          k = (face === 2 ? 1.15 : 0.72 + 0.28 * wn) * fog;
          if (q.mat === Mat.Leaf) {
            const px = ox + dx * best, py = oy + dy * best, pz = oz + dz * best;
            const h = hash3(Math.floor(px / 0.35) + o.seed, Math.floor(py / 0.35), Math.floor(pz / 0.35));
            ch = LEAF[(h * LEAF.length) | 0];
            k *= 0.55 + 0.45 * h + 0.25 * nz;
          } else ch = face === 2 ? q.top : face === 0 && q.shape === Shape.Box ? q.end : q.side;
        }
        let r = col[0] * k, g = col[1] * k, b = col[2] * k;
        const painted = q.mat === Mat.Glow || q.mat === Mat.Text || (q.mat === Mat.Board && face === 0);
        if (face === 2 && v.snow && !painted) { const sk = v.snow * 0.85; r += (185 - r) * sk; g += (190 - g) * sk; b += (200 - b) * sk; }
        if (!painted) {
          // the light where the ray hit, strongest on tops: a car lights up under a lamp or in another's headlights
          // (points close together in the column share one sample of the light)
          const hx = ox + dx * best, hy = oy + dy * best, hz = oz + dz * best;
          if ((hx - lx) ** 2 + (hy - ly) ** 2 + (hz - lz) ** 2 > 0.0625) {
            const S = v.light(o.x + hx * o.c - hy * o.s, o.y + hx * o.s + hy * o.c, hz);
            LC[0] = S[0]; LC[1] = S[1]; LC[2] = S[2]; lx = hx; ly = hy; lz = hz;
          }
          const L = LC, gl = (face === 2 ? 1.5 : 1.1) * fog;
          if (v.mul) { r *= L[0]; g *= L[1]; b *= L[2]; } else { r += L[0] * gl; g += L[1] * gl; b += L[2] * gl; }
        }
        if (glassT < best) {
          // seen through glass: darker and colder, with a faint sheen
          r = r * 0.6 + 16; g = g * 0.66 + 24; b = b * 0.72 + 34;
        }
        grid.put(i, ch, r, g, b);
        depth[i] = best;
        grid.kind[i] = q.mat === Mat.Solid && !painted ? KIND.object : KIND.other;
      }
    }
  }
}
