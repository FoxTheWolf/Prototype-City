import { hash3 } from '../core/rng';
import { type RGB } from '../sim/city';
import { type CharGrid } from './grid';
import { bulbsIn, fontRows, SYMBOLS } from './signs';

/**
 * Street objects built from a few solid parts (boxes, upright cylinders, ellipsoids) in the
 * object's own frame: +x forward, +y left, z up, in metres.
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
 * shop signs; farther, as glyphs; farther still, a lit bar.
 */
export const Mat = { Solid: 0, Leaf: 1, Glow: 2, Text: 3 } as const;

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

export function part(shape: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: RGB, mat: number, side: string, top = side, end = side): Part {
  return { shape, x0, y0, z0, x1, y1, z1, col, mat, side: C(side), top: C(top), end: C(end) };
}

// part centers and half sizes of the current object, widened so thin parts never fall between cells
const P = new Float64Array(32 * 6);

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
    for (let k = 0; k < n; k++) {
      const q = o.parts[k], j = k * 6;
      P[j] = (q.x0 + q.x1) / 2; P[j + 1] = (q.y0 + q.y1) / 2; P[j + 2] = (q.z0 + q.z1) / 2;
      P[j + 3] = Math.max((q.x1 - q.x0) / 2, mh); P[j + 4] = Math.max((q.y1 - q.y0) / 2, mh); P[j + 5] = Math.max((q.z1 - q.z0) / 2, mz);
    }
    const fog = 1 - Math.min(1, tY / v.far) * 0.8;
    // camera in the object's frame
    const ox = (v.x - o.x) * o.c + (v.y - o.y) * o.s, oy = -(v.x - o.x) * o.s + (v.y - o.y) * o.c, oz = v.eye;

    for (let x = x0; x < x1; x++) {
      const camX = (2 * (x + 0.5)) / cols - 1;
      const rdx = v.dirX + v.plX * camX, rdy = v.dirY + v.plY * camX;
      const dx = rdx * o.c + rdy * o.s, dy = -rdx * o.s + rdy * o.c;
      // this column's ray against the bounding circle: the depths [ta, tb] where the object can be,
      // hence the only rows it can cover
      const R = o.r + mh, qa = dx * dx + dy * dy, qb = ox * dx + oy * dy, disc = qb * qb - qa * (ox * ox + oy * oy - R * R);
      if (disc < 0) continue;
      const sq = Math.sqrt(disc), tb = (-qb + sq) / qa;
      if (tb < 0.05) continue;
      const ta = Math.max(0.05, (-qb - sq) / qa), up = o.h - v.eye;
      const y0 = Math.max(0, Math.floor(v.hor - (up * v.scale) / (up > 0 ? ta : tb)));
      const y1 = Math.min(rows, Math.ceil(v.hor + (v.eye * v.scale) / (v.eye > 0 ? ta : tb)));
      for (let y = y0; y < y1; y++) {
        const i = y * cols + x;
        // cells where something nearer than the whole object is already drawn
        if (depth[i] <= ta) continue;
        const dz = (v.hor - (y + 0.5)) / v.scale;
        let best = depth[i], bk = -1, face = 0, nx = 0, ny = 0, nz = 0;
        for (let k = 0; k < n; k++) {
          const j = k * 6, cx = P[j], cy = P[j + 1], cz = P[j + 2], hx = P[j + 3], hy = P[j + 4], hz = P[j + 5];
          const shape = o.parts[k].shape;
          if (shape === Shape.Box) {
            let tmin = -1e9, tmax = 1e9, ax = 0;
            if (Math.abs(dx) < 1e-9) { if (Math.abs(ox - cx) > hx) continue; }
            else { let a = (cx - hx - ox) / dx, b = (cx + hx - ox) / dx; if (a > b) { const t = a; a = b; b = t; } if (a > tmin) { tmin = a; ax = 0; } if (b < tmax) tmax = b; }
            if (Math.abs(dy) < 1e-9) { if (Math.abs(oy - cy) > hy) continue; }
            else { let a = (cy - hy - oy) / dy, b = (cy + hy - oy) / dy; if (a > b) { const t = a; a = b; b = t; } if (a > tmin) { tmin = a; ax = 1; } if (b < tmax) tmax = b; }
            if (Math.abs(dz) < 1e-9) { if (Math.abs(oz - cz) > hz) continue; }
            else { let a = (cz - hz - oz) / dz, b = (cz + hz - oz) / dz; if (a > b) { const t = a; a = b; b = t; } if (a > tmin) { tmin = a; ax = 2; } if (b < tmax) tmax = b; }
            if (tmin > tmax || tmin <= 0.05 || tmin >= best) continue;
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
              best = t; bk = k; nx = X + DX * t; ny = Y + DY * t; nz = Z + DZ * t; face = nz > 0.75 ? 2 : 1;
            }
          }
        }
        if (bk < 0) continue;
        const q = o.parts[bk];
        let ch: number, k: number;
        if (q.mat === Mat.Glow) { ch = q.side; k = 0.6 + 0.4 * fog; }
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
          else if (rows && sw / perCol >= 3 && sh / perRow >= 2.6) {
            // up close: bulbs, counted per cell (bulb units across and down)
            // read left to right from either side: seen from -y, +x is to the viewer's left
            const ux = sw / bw, uz = sh / bh, px = (oy < 0 ? sx0 + sw - hx : hx - sx0) / ux, pz = (sz0 - hz) / uz;
            const nb = bulbsIn(rows, bw, px, pz, perCol / ux / 2, perRow / uz / 2);
            const bx = Math.floor(px), by = Math.floor(pz);
            if (nb) { ch = nb > 1 ? C('@') : C('o'); k = 1.25; }
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
        let r = q.col[0] * k, g = q.col[1] * k, b = q.col[2] * k;
        if (face === 2 && v.snow && q.mat !== Mat.Glow && q.mat !== Mat.Text) { const sk = v.snow * 0.85; r += (185 - r) * sk; g += (190 - g) * sk; b += (200 - b) * sk; }
        if (q.mat !== Mat.Glow && q.mat !== Mat.Text) {
          // the light where the ray hit, strongest on tops: a car lights up under a lamp or in another's headlights
          const hx = ox + dx * best, hy = oy + dy * best, hz = oz + dz * best;
          const L = v.light(o.x + hx * o.c - hy * o.s, o.y + hx * o.s + hy * o.c, hz), gl = (face === 2 ? 1.5 : 1.1) * fog;
          if (v.mul) { r *= L[0]; g *= L[1]; b *= L[2]; } else { r += L[0] * gl; g += L[1] * gl; b += L[2] * gl; }
        }
        grid.put(i, ch, r, g, b);
        depth[i] = best;
      }
    }
  }
}
