import { hash3 } from '../core/rng';
import { BURN_START, FLOOR_H, LANE_W, lanesOf, SIDEWALK, type Building, type City } from '../sim/city';
import { type World } from '../sim/world';
import { type CharGrid } from './grid';
import { BLOCK } from './atlas';
import { LightWindow } from './lightmap';
import { carModel, debrisModel, FLOOD, FURNITURE, lampModel, treeModel } from './models';
import { drawObjects, type Obj } from './objects';
import { PALETTES, type Look } from './palette';

export interface View {
  x: number;
  y: number;
  yaw: number;
  /** Look angle up/down in radians. */
  pitch: number;
  /** Eye height in metres. */
  eye: number;
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
/** Distance where building fog reaches ~63%. Long, so the skyline reads across the whole city. */
const FOG = 1500;
/** Width of one window bay on a facade. */
const BAY = 1.6;

const C = (s: string) => s.charCodeAt(0);
const G = {
  dot: C('.'), com: C(','), tick: C('`'), col: C(':'), semi: C(';'), dash: C('-'), eq: C('='), plus: C('+'),
  hash: C('#'), pct: C('%'), at: C('@'), bar: C('|'), us: C('_'), star: C('*'), quo: C('"'), amp: C('&'),
  o: C('o'), lb: C('['), rb: C(']'), sl: C('/'), bs: C('\\'), caret: C('^'), x: C('x'), tilde: C('~'), lp: C('('), rp: C(')'),
};

const light = new LightWindow();
/** Solid mode: the background behind a glyph is its own color at this strength. */
const SOLID = 0.36;
/** ASCII glyph -> block/box slot for the blocks mode; 0 keeps the glyph. */
const BLOCKS = new Uint8Array(256);
for (const [c, b] of [['@', BLOCK.full], ['#', BLOCK.dark], ['%', BLOCK.mid], [':', BLOCK.light], ['-', BLOCK.h], ['|', BLOCK.v],
  ['+', BLOCK.cross], ['=', BLOCK.dh], ['/', BLOCK.up], ['\\', BLOCK.down], ['x', BLOCK.x]] as const) BLOCKS[C(c)] = b;
// per-block ray hits, reused every column
const hitT = new Float64Array(1024);
const hitId = new Int32Array(1024);
const hitSide = new Uint8Array(1024);

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
  const [lr, lg, lb] = PALETTES[v.look.palette].lamp;

  for (let x = 0; x < cols; x++) {
    const camX = (2 * (x + 0.5)) / cols - 1;
    const rdx = dirX + plX * camX, rdy = dirY + plY * camX;

    // ---- sky: gradient background + stars fixed to the sky
    const az = v.yaw + Math.atan(camX * plane);
    const slot = Math.floor((((az / (2 * Math.PI)) % 1 + 1) % 1) * starSlots);
    for (let y = 0; y < rows; y++) {
      const i = y * cols + x;
      const t = Math.max(0, Math.min(1, (y + 0.5) / Math.max(1, hor)));
      if (y + 0.5 < hor) {
        // the burning seam all around lights the low sky orange
        const t4 = t * t * t * t;
        grid.setBg(i, 5 + 21 * t * t + 30 * t4, 6 + 10 * t * t + 8 * t4, 11 + 21 * t * t - 6 * t4);
        const h = hash3(slot, Math.floor(y - hor), 7);
        if (h < 0.012 && y < hor - 3) { const b = 120 + h * 8000; grid.put(i, h < 0.003 ? G.star : G.dot, b, b, b + 30); }
        else if (y >= hor - 2) grid.put(i, G.dot, 70, 40, 60);
      } else {
        grid.setBg(i, 7, 8, 12);
      }
    }

    // ---- ground: each cell below the horizon maps to one point on the floor
    for (let y = Math.max(0, Math.ceil(hor - 0.5)); y < rows; y++) {
      const i = y * cols + x;
      const rd = (eye * scale) / (y + 0.5 - hor);
      const wx = px + rdx * rd, wy = py + rdy * rd;
      grid.depth[i] = rd;
      if (wx < 0 || wy < 0 || wx >= city.w || wy >= city.h) { burnGround(grid, i, city, wx, wy, rd, time); continue; }
      if (rd > GROUND_FAR) { grid.put(i, G.dot, 28, 24, 32); continue; }
      const fog = 1 - (rd / GROUND_FAR) * 0.9;
      const glow = light.at(wx, wy) * fog;
      const cx = city.xCell[wx | 0], cy = city.yCell[wy | 0];
      const hv = hash3(Math.floor(wx * 1.2), Math.floor(wy * 1.2), 3);
      let ch = G.dot, r = 38, g = 38, b = 46;
      const roadX = !(cx & 1), roadY = !(cy & 1);
      if (roadX || roadY) {
        ch = hv < 0.5 ? G.dot : hv < 0.8 ? G.com : G.tick;
        if (roadX !== roadY && rd < 200) {
          // a road segment between two intersections: center line, lane dashes, crosswalks at the ends
          const b0 = roadX ? city.xb : city.yb, bc = roadX ? cx : cy;
          const e0 = roadX ? city.yb : city.xb, ec = roadX ? cy : cx;
          const across = (roadX ? wx : wy) - (b0[bc] + b0[bc + 1]) / 2, along = roadX ? wy : wx;
          const a = Math.abs(across), end = Math.min(along - e0[ec], e0[ec + 1] - along);
          const m = a % LANE_W;
          if (end > 1 && end < 4.5) { if (Math.floor((across + 100) / 0.9) % 2 === 0) { ch = roadX ? G.eq : G.bar; r = 150; g = 150; b = 150; } }
          else if (a < 0.3) { ch = roadX ? G.bar : G.dash; r = 210; g = 170; b = 60; }
          else if (Math.min(m, LANE_W - m) < 0.12 && a < lanesOf(b0, bc >> 1) * LANE_W - 1 && Math.floor(along / 3) % 2 === 0) {
            ch = roadX ? G.bar : G.dash; r = 150; g = 150; b = 150;
          }
        }
      } else {
        const blk = city.blocks[(cy >> 1) * city.nbx + (cx >> 1)];
        const edge = Math.min(wx - blk.x0, blk.x1 - wx, wy - blk.y0, blk.y1 - wy);
        if (edge < SIDEWALK) {
          const fx = wx / 1.5 - Math.floor(wx / 1.5), fy = wy / 1.5 - Math.floor(wy / 1.5);
          ch = fx < 0.08 || fy < 0.08 ? G.plus : G.col; r = 78; g = 74; b = 78;
        } else if (blk.open === 'park') {
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
      grid.put(i, ch, r * fog + glow * lr, g * fog + glow * lg, b * fog + glow * lb);
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
        if (blk.b1 > blk.b0 && hor - ((blk.maxH - eye) * scale) / Math.max(tIn, 0.1) < clipTop) {
          let n = 0;
          for (let k = blk.b0; k < blk.b1; k++) {
            const B = city.buildings[k];
            let tNear: number, side: number;
            if (B.round) {
              // upright cylinder inscribed in the box: nearest root of |p + t*d - c| = r
              const rr = (B.x1 - B.x0) / 2, ox = px - (B.x0 + rr), oy = py - (B.y0 + rr);
              const qa = rdx * rdx + rdy * rdy, qb = ox * rdx + oy * rdy, disc = qb * qb - qa * (ox * ox + oy * oy - rr * rr);
              if (disc <= 0) continue;
              tNear = (-qb - Math.sqrt(disc)) / qa; side = 2;
              if (tNear <= 0.01) continue;
            } else {
              const ax = (B.x0 - px) * ix, bx = (B.x1 - px) * ix, ay = (B.y0 - py) * iy, by = (B.y1 - py) * iy;
              const nx = Math.min(ax, bx), ny = Math.min(ay, by);
              tNear = Math.max(nx, ny);
              if (tNear <= 0.01 || tNear >= Math.min(Math.max(ax, bx), Math.max(ay, by))) continue;
              side = nx > ny ? 0 : 1;
            }
            let s = n++;
            while (s > 0 && hitT[s - 1] > tNear) { hitT[s] = hitT[s - 1]; hitId[s] = hitId[s - 1]; hitSide[s] = hitSide[s - 1]; s--; }
            hitT[s] = tNear; hitId[s] = k; hitSide[s] = side;
          }
          for (let s = 0; s < n && clipTop > 0; s++) {
            const t = hitT[s], id = hitId[s], B = city.buildings[id];
            const yt = hor - ((B.h - eye) * scale) / t, yb2 = hor + (eye * scale) / t;
            const top = Math.ceil(yt - 0.5);
            const y0 = Math.max(0, top), y1 = Math.min(rows, Math.ceil(yb2 - 0.5), clipTop);
            if (y0 < y1) {
              const side = hitSide[s];
              let along: number, lightK: number;
              if (side === 2) {
                // position around the cylinder in metres of arc; lit like a box face turned the same way
                const rr = (B.x1 - B.x0) / 2, nx = (px + t * rdx - B.x0 - rr) / rr, ny = (py + t * rdy - B.y0 - rr) / rr;
                along = (Math.atan2(ny, nx) + Math.PI) * rr; lightK = 0.72 + 0.28 * Math.abs(nx);
              } else { along = side === 0 ? py + t * rdy : px + t * rdx; lightK = side ? 0.72 : 1; }
              wallColumn(grid, x, B, id, t, side, lightK, along, y0, y1, top, hor, scale, eye, colW);
            }
            clipTop = Math.min(clipTop, Math.max(0, top));
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
  drawObjects(grid, collectObjects(world, v), { x: px, y: py, eye, dirX, dirY, plX, plY, plane, scale, hor, far: SPRITE_FAR });
  finish(grid, v.look);
}

/** Display modes applied to the finished frame: solid backgrounds under world cells, block glyphs. */
function finish(grid: CharGrid, look: Look) {
  const { cells, bg, depth } = grid;
  for (let i = 0, k = 0; i < depth.length; i++, k += 4) {
    if (look.solid && depth[i] < 1e9) { bg[k] = cells[k + 1] * SOLID; bg[k + 1] = cells[k + 2] * SOLID; bg[k + 2] = cells[k + 3] * SOLID; }
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
    const top = hor - ((s.h - v.eye) * scale) / tY, bot = hor + (v.eye * scale) / tY;
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
        const hh = hash3(Math.floor(u * 5 + s.x), row, s.y | 0);
        if (hh > dens * 0.9) continue;
        const glow = vv > 0.7 ? (vv - 0.7) / 0.3 : 0;
        const ch = hh < 0.15 ? G.tilde : hh < 0.35 ? G.lp : hh < 0.55 ? G.rp : hh < 0.75 ? G.col : G.dot;
        const g0 = (85 + 45 * vv) * fog;
        grid.put(i, ch, g0 + 180 * glow, g0 + 60 * glow, g0 * 1.05);
      }
    }
  }
}

/** One building face in one column, rows y0..y1. `along` is where the ray hit the face; `top` is the unclipped roof row. */
function wallColumn(grid: CharGrid, x: number, B: Building, id: number, t: number, side: number, lightK: number, along: number, y0: number, y1: number, top: number, hor: number, scale: number, eye: number, colW: number) {
  // side 2 is a cylinder: no corners
  const f0 = side === 0 ? B.y0 : side === 1 ? B.x0 : -1e9, f1 = side === 0 ? B.y1 : side === 1 ? B.x1 : 1e9;
  const fogK = 1 - Math.exp(-t / FOG);
  const shade = lightK * (1 - fogK * 0.6);
  const winLight = 1 - fogK * 0.45;
  const [fr, fg, fb] = B.frame;
  // rows per floor and columns per window bay decide how much of the facade fits in a cell
  const rpf = (FLOOR_H * scale) / t, cpb = BAY / (colW * t);
  const detailed = rpf >= 2.2 && cpb >= 1.5;
  // far away several floors/bays share a cell: group them in powers of two so the pattern holds still
  const kv = rpf >= 1 ? 0 : Math.ceil(Math.log2(1 / rpf)), kh = cpb >= 1 ? 0 : Math.ceil(Math.log2(1 / cpb));
  const bay = along / BAY, wi = Math.floor(bay), fw = bay - wi;
  const corner = along - f0 < 0.35 || f1 - along < 0.35;
  // a clock tower is a historic facade with a clock face near the top of each side
  const S = B.style === 'clock' ? 'historic' : B.style;
  const clockR = B.style === 'clock' && side !== 2 ? Math.min(3, (f1 - f0) * 0.32) : 0, clockZ = B.h - clockR - 2;
  const du = along - (f0 + f1) / 2;
  const farWall = S === 'brick' ? G.eq : S === 'warehouse' ? G.bar : G.col;
  const farK = S === 'glass' ? 1.25 : 1;
  // brick walk-ups: an iron fire escape two bays wide, repeating along the facade
  const esc = S === 'brick' && B.feat < 0.45 && B.h > 12 && (wi % 7 === 2 || wi % 7 === 3) && !corner;
  const escU = ((wi % 7) - 2 + fw) / 2;
  const balcony = S === 'residential' && B.feat < 0.5;
  let ch = 0, r = 0, g = 0, b = 0;
  const wall = (c: number, k: number) => { ch = c; r = fr * k * shade; g = fg * k * shade; b = fb * k * shade; };
  // a window: lit ones glow in the building's window color, dark ones are deep blue glass
  const pane = (fl: number, litCh: number) => {
    const hh = hash3(id, wi, fl);
    if (hh < B.lit) {
      ch = hh < B.lit * 0.3 ? G.at : litCh;
      const k = winLight * (0.65 + 0.35 * hash3(wi, fl, id));
      r = B.win[0] * k; g = B.win[1] * k; b = B.win[2] * k;
    } else { ch = G.eq; r = 30 * shade + 8; g = 36 * shade + 8; b = 58 * shade + 12; }
  };
  for (let y = y0; y < y1; y++) {
    const i = y * grid.cols + x;
    const z = eye + ((hor - (y + 0.5)) / scale) * t;
    const fl = Math.floor(z / FLOOR_H), fz = z / FLOOR_H - fl;
    if (S === 'spire' || S === 'chimney') {
      // red beacon at the tip; chimneys also get two pale bands near the top
      if (z > B.h - 1) { ch = G.star; r = B.win[0] * winLight; g = B.win[1] * winLight; b = B.win[2] * winLight; }
      else if (S === 'chimney' && ((z > B.h - 6 && z < B.h - 4.5) || (z > B.h - 10 && z < B.h - 8.5))) wall(G.eq, 1.9);
      else wall(S === 'chimney' && detailed ? G.eq : G.bar, S === 'spire' ? 1.2 : 1);
    } else if (y === top || z > B.h - 0.6) wall(G.us, 1.5);
    else if (clockR && Math.hypot(du, z - clockZ) < clockR) {
      // lit face, a ring, and hands at ten past ten (they will follow the sim clock once it exists)
      const dz = z - clockZ, d = Math.hypot(du, dz);
      const hand = (a: number, len: number) => { const s = du * Math.cos(a) + dz * Math.sin(a); return s > 0 && s < len && Math.abs(-du * Math.sin(a) + dz * Math.cos(a)) < 0.22; };
      if (d > clockR * 0.82) wall(G.o, 1.6);
      else if (hand((150 * Math.PI) / 180, clockR * 0.5) || hand((30 * Math.PI) / 180, clockR * 0.75)) { ch = G.hash; r = 40; g = 30; b = 20; }
      else { ch = d < 0.3 ? G.o : G.col; r = 250 * winLight; g = 230 * winLight; b = 170 * winLight; }
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
      if (Math.floor(along / (detailed ? 0.8 : 1.6)) & 1) { ch = G.bar; const k = winLight * 0.9; r = B.win[0] * k; g = B.win[1] * k; b = B.win[2] * k; }
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
    else if (!detailed) {
      const hh = hash3(id, wi >> kh, fl >> kv);
      if (hh < B.lit) {
        ch = hh < B.lit * 0.4 ? G.o : G.col;
        const k = winLight * (0.65 + 0.35 * hash3(wi >> kh, id, 5));
        r = B.win[0] * k; g = B.win[1] * k; b = B.win[2] * k;
      } else wall(farWall, farK);
    } else if (z < FLOOR_H && B.shop) {
      if (z > 2.7 && z < 3.3) { ch = G.eq; const k = winLight * (0.7 + 0.3 * hash3(id, wi, 99)); r = B.sign[0] * k; g = B.sign[1] * k; b = B.sign[2] * k; }
      else if (fw > 0.12 && fw < 0.88 && z > 0.2 && z < 2.6 && !corner) { ch = fw < 0.2 ? G.lb : fw > 0.8 ? G.rb : G.col; r = 180 * winLight; g = 150 * winLight; b = 100 * winLight; }
      else wall(G.bar, 1);
    } else if (S === 'glass') {
      // curtain wall: mullions and floor slabs over tinted glass with a diagonal sheen
      if (fz < 0.08) wall(G.dash, 0.8);
      else if (fw < 0.07 || corner) wall(G.bar, 1.5);
      else if (hash3(id, wi, fl) < B.lit) pane(fl, G.col);
      else {
        const sheen = 0.5 + 0.5 * Math.sin(along * 0.35 + z * 0.5);
        wall(sheen > 0.85 ? G.sl : sheen > 0.4 ? G.col : G.dot, 1.3 + 0.9 * sheen);
      }
    } else if (S === 'warehouse') {
      const door = z < 4.5 && Math.floor(along / 6) % 3 === 1, dp = along % 6;
      if (z > B.h - 3.2 && z < B.h - 1.4) { // clerestory strip under the roof
        if (fw > 0.08 && fw < 0.92) {
          if (hash3(id, wi, 0) < B.lit * 2) { ch = G.hash; const k = winLight * 0.75; r = B.win[0] * k; g = B.win[1] * k; b = B.win[2] * k; }
          else { ch = G.eq; r = 22 * shade + 8; g = 26 * shade + 8; b = 36 * shade + 10; }
        } else wall(G.bar, 1.2);
      } else if (door && !corner) wall(dp < 0.4 || dp > 5.6 ? G.bar : z > 4.1 ? G.eq : G.dash, dp < 0.4 || dp > 5.6 ? 1.3 : 1.15);
      else wall(G.bar, Math.floor(along / 0.6) & 1 ? 1 : 0.78); // corrugated metal
    } else if (esc && z > FLOOR_H && (fz < 0.08 || escU < 0.04 || escU > 0.96 || Math.abs((fl & 1 ? 1 - escU : escU) - fz) < 0.1)) {
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
      if (balcony && z > FLOOR_H && fz < 0.25 && fw > 0.1 && fw < 0.9) wall(fz < 0.07 ? G.eq : G.bar, 1.3);
      else if (fw > 0.25 && fw < 0.75 && fz > 0.3 && fz < 0.78 && !corner) pane(fl, G.hash);
      else wall(corner ? G.bar : G.dot, 1);
    } else if (fw > 0.2 && fw < 0.8 && fz > 0.28 && fz < 0.8 && !corner) {
      const hh = hash3(id, wi, fl);
      if (hh < B.lit) {
        ch = hh < B.lit * 0.3 ? G.at : hh < B.lit * 0.7 ? G.hash : G.pct;
        const k = winLight * (0.65 + 0.35 * hash3(wi, fl, id));
        r = B.win[0] * k; g = B.win[1] * k; b = B.win[2] * k;
      } else { ch = G.eq; r = 30 * shade + 8; g = 36 * shade + 8; b = 58 * shade + 12; }
    } else wall(corner ? G.bar : t > 60 ? G.dot : G.col, 1);
    grid.put(i, ch, r, g, b);
    grid.setBg(i, 7, 8, 12);
    grid.depth[i] = t;
  }
}

/** Props of the blocks near the viewer, plus nearby cars. Far away they are too small to matter. */
function collectObjects(world: World, v: View): Obj[] {
  const out: Obj[] = [];
  const { city } = world;
  const lamp = lampModel(PALETTES[v.look.palette].lamp);
  const cl = (a: number, n: number) => Math.min(n - 1, Math.max(0, a | 0));
  const cx0 = city.xCell[cl(v.x - SPRITE_FAR, city.w)], cx1 = city.xCell[cl(v.x + SPRITE_FAR, city.w)];
  const cy0 = city.yCell[cl(v.y - SPRITE_FAR, city.h)], cy1 = city.yCell[cl(v.y + SPRITE_FAR, city.h)];
  for (let cy = cy0 | 1; cy <= cy1; cy += 2) for (let cx = cx0 | 1; cx <= cx1; cx += 2) {
    const blk = cityBlock(city, cx, cy);
    if (blk) for (const p of blk.props) {
      if (p.kind === 'lamp') out.push({ x: p.x, y: p.y, c: Math.cos(p.a), s: Math.sin(p.a), parts: lamp, r: 2.1, h: 6.7, seed: 0 });
      else if (p.kind === 'tree') out.push({ x: p.x, y: p.y, c: 1, s: 0, parts: treeModel(p.seed, p.w, p.z1), r: p.w * 0.75, h: p.z1, seed: p.seed });
      else if (p.kind === 'debris') out.push({ x: p.x, y: p.y, c: Math.cos(p.a), s: Math.sin(p.a), parts: debrisModel(p.seed), r: 1.8, h: 1.2, seed: p.seed });
      else {
        const f = FURNITURE[p.kind];
        out.push({ x: p.x, y: p.y, c: Math.cos(p.a), s: Math.sin(p.a), parts: f.parts, r: f.r, h: f.h, seed: p.seed });
      }
    }
  }
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
    out.push({ x, y, c: c.dx, s: c.dy, parts: carModel(c.col, c.taxi), r: 2.5, h: 1.8, seed: 0 });
  }
  return out;
}

function cityBlock(city: City, cx: number, cy: number) {
  const i = cx >> 1, j = cy >> 1;
  return i < city.nbx && j < city.nby ? city.blocks[j * city.nbx + i] : null;
}
