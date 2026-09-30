import { hash3 } from '../core/rng';
import { FLOOR_H, LANE_W, lanesOf, SIDEWALK, type Building, type City, type RGB } from '../sim/city';
import { type World } from '../sim/world';
import { type CharGrid } from './grid';
import { LightWindow } from './lightmap';

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
  o: C('o'), lb: C('['), rb: C(']'),
};

interface Sprite {
  kind: 'lamp' | 'tree' | 'car';
  x: number;
  y: number;
  w: number;
  z1: number;
  seed: number;
  dx: number;
  dy: number;
  taxi: boolean;
  col: RGB;
}

const light = new LightWindow();
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
        grid.setBg(i, 5 + 21 * t * t, 6 + 10 * t * t, 11 + 21 * t * t);
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
      if (rd > GROUND_FAR || wx < 0 || wy < 0 || wx >= city.w || wy >= city.h) { grid.put(i, G.dot, 28, 24, 32); continue; }
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
        } else if (blk.park) {
          ch = hv < 0.4 ? G.quo : hv < 0.7 ? G.com : G.semi; r = 40; g = 95 + hv * 40; b = 45;
        } else { ch = hv < 0.7 ? G.dot : G.com; r = 50; g = 48; b = 52; }
      }
      grid.put(i, ch, r * fog + glow * 95, g * fog + glow * 70, b * fog + glow * 35);
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
            const ax = (B.x0 - px) * ix, bx = (B.x1 - px) * ix, ay = (B.y0 - py) * iy, by = (B.y1 - py) * iy;
            const nx = Math.min(ax, bx), ny = Math.min(ay, by);
            const tNear = Math.max(nx, ny), tFar = Math.min(Math.max(ax, bx), Math.max(ay, by));
            if (tNear <= 0.01 || tNear >= tFar) continue;
            let s = n++;
            while (s > 0 && hitT[s - 1] > tNear) { hitT[s] = hitT[s - 1]; hitId[s] = hitId[s - 1]; hitSide[s] = hitSide[s - 1]; s--; }
            hitT[s] = tNear; hitId[s] = k; hitSide[s] = nx > ny ? 0 : 1;
          }
          for (let s = 0; s < n && clipTop > 0; s++) {
            const t = hitT[s], id = hitId[s], B = city.buildings[id];
            const yt = hor - ((B.h - eye) * scale) / t, yb2 = hor + (eye * scale) / t;
            const top = Math.ceil(yt - 0.5);
            const y0 = Math.max(0, top), y1 = Math.min(rows, Math.ceil(yb2 - 0.5), clipTop);
            if (y0 < y1) {
              const side = hitSide[s], along = side === 0 ? py + t * rdy : px + t * rdx;
              wallColumn(grid, x, B, id, t, side, along, y0, y1, top, hor, scale, eye, colW);
            }
            clipTop = Math.min(clipTop, Math.max(0, top));
          }
          if (clipTop <= 0) break;
        }
      }
      if (tx < ty) { cx += stX; tIn = tx; if (cx < 0 || cx >= xb.length - 1) break; tx = ((rdx < 0 ? xb[cx] : xb[cx + 1]) - px) * ix; }
      else { cy += stY; tIn = ty; if (cy < 0 || cy >= yb.length - 1) break; ty = ((rdy < 0 ? yb[cy] : yb[cy + 1]) - py) * iy; }
    }
  }

  drawSprites(grid, collectSprites(world, v), v, dirX, dirY, plX, plY, plane, scale, hor);
}

/** One building face in one column, rows y0..y1. `along` is where the ray hit the face; `top` is the unclipped roof row. */
function wallColumn(grid: CharGrid, x: number, B: Building, id: number, t: number, side: number, along: number, y0: number, y1: number, top: number, hor: number, scale: number, eye: number, colW: number) {
  const f0 = side === 0 ? B.y0 : B.x0, f1 = side === 0 ? B.y1 : B.x1;
  const fogK = 1 - Math.exp(-t / FOG);
  const shade = (side ? 0.72 : 1) * (1 - fogK * 0.6);
  const winLight = 1 - fogK * 0.45;
  const [fr, fg, fb] = B.frame;
  // rows per floor and columns per window bay decide how much of the facade fits in a cell
  const rpf = (FLOOR_H * scale) / t, cpb = BAY / (colW * t);
  const detailed = rpf >= 2.2 && cpb >= 1.5;
  // far away several floors/bays share a cell: group them in powers of two so the pattern holds still
  const kv = rpf >= 1 ? 0 : Math.ceil(Math.log2(1 / rpf)), kh = cpb >= 1 ? 0 : Math.ceil(Math.log2(1 / cpb));
  const bay = along / BAY, wi = Math.floor(bay), fw = bay - wi;
  const corner = along - f0 < 0.35 || f1 - along < 0.35;
  for (let y = y0; y < y1; y++) {
    const i = y * grid.cols + x;
    const z = eye + ((hor - (y + 0.5)) / scale) * t;
    let ch: number, r: number, g: number, b: number;
    if (y === top || z > B.h - 0.6) { ch = G.us; r = fr * 1.5 * shade; g = fg * 1.5 * shade; b = fb * 1.5 * shade; }
    else if (!detailed) {
      const hh = hash3(id, wi >> kh, Math.floor(z / FLOOR_H) >> kv);
      if (hh < B.lit) {
        ch = hh < B.lit * 0.4 ? G.o : G.col;
        const k = winLight * (0.65 + 0.35 * hash3(wi >> kh, id, 5));
        r = B.win[0] * k; g = B.win[1] * k; b = B.win[2] * k;
      } else { ch = G.col; r = fr * shade; g = fg * shade; b = fb * shade; }
    } else if (z < FLOOR_H && B.shop) {
      if (z > 2.7 && z < 3.3) { ch = G.eq; const k = winLight * (0.7 + 0.3 * hash3(id, wi, 99)); r = B.sign[0] * k; g = B.sign[1] * k; b = B.sign[2] * k; }
      else if (fw > 0.12 && fw < 0.88 && z > 0.2 && z < 2.6 && !corner) { ch = fw < 0.2 ? G.lb : fw > 0.8 ? G.rb : G.col; r = 180 * winLight; g = 150 * winLight; b = 100 * winLight; }
      else { ch = G.bar; r = fr * shade; g = fg * shade; b = fb * shade; }
    } else {
      const fl = Math.floor(z / FLOOR_H), fz = z / FLOOR_H - fl;
      if (fw > 0.2 && fw < 0.8 && fz > 0.28 && fz < 0.8 && !corner) {
        const hh = hash3(id, wi, fl);
        if (hh < B.lit) {
          ch = hh < B.lit * 0.3 ? G.at : hh < B.lit * 0.7 ? G.hash : G.pct;
          const k = winLight * (0.65 + 0.35 * hash3(wi, fl, id));
          r = B.win[0] * k; g = B.win[1] * k; b = B.win[2] * k;
        } else { ch = G.eq; r = 30 * shade + 8; g = 36 * shade + 8; b = 58 * shade + 12; }
      } else {
        ch = corner ? G.bar : t > 60 ? G.dot : G.col;
        r = fr * shade; g = fg * shade; b = fb * shade;
      }
    }
    grid.put(i, ch, r, g, b);
    grid.setBg(i, 7, 8, 12);
    grid.depth[i] = t;
  }
}

/** Props of the blocks near the viewer, plus nearby cars. Far away they are too small to matter. */
function collectSprites(world: World, v: View): Sprite[] {
  const out: Sprite[] = [];
  const none: RGB = [0, 0, 0];
  const { city } = world;
  const cl = (a: number, n: number) => Math.min(n - 1, Math.max(0, a | 0));
  const cx0 = city.xCell[cl(v.x - SPRITE_FAR, city.w)], cx1 = city.xCell[cl(v.x + SPRITE_FAR, city.w)];
  const cy0 = city.yCell[cl(v.y - SPRITE_FAR, city.h)], cy1 = city.yCell[cl(v.y + SPRITE_FAR, city.h)];
  for (let cy = cy0 | 1; cy <= cy1; cy += 2) for (let cx = cx0 | 1; cx <= cx1; cx += 2) {
    const blk = cityBlock(city, cx, cy);
    if (blk) for (const p of blk.props) out.push({ ...p, dx: 0, dy: 0, taxi: false, col: none });
  }
  for (const c of world.cars) {
    // interpolate between ticks so motion is smooth at any frame rate
    const x = c.px + (c.x - c.px) * v.alpha, y = c.py + (c.y - c.py) * v.alpha;
    if (Math.abs(x - v.x) > SPRITE_FAR || Math.abs(y - v.y) > SPRITE_FAR) continue;
    out.push({ kind: 'car', x, y, w: 2.2, z1: 1.5, seed: 0, dx: c.dx, dy: c.dy, taxi: c.taxi, col: c.col });
  }
  return out;
}

function cityBlock(city: City, cx: number, cy: number) {
  const i = cx >> 1, j = cy >> 1;
  return i < city.nbx && j < city.nby ? city.blocks[j * city.nbx + i] : null;
}

function drawSprites(grid: CharGrid, sprites: Sprite[], v: View, dirX: number, dirY: number, plX: number, plY: number, plane: number, scale: number, hor: number) {
  const { cols, rows } = grid;
  const invDet = 1 / (plX * dirY - dirX * plY);
  const vis: [number, number, Sprite, number, number][] = [];
  for (const s of sprites) {
    const rx = s.x - v.x, ry = s.y - v.y;
    if (rx * rx + ry * ry > SPRITE_FAR * SPRITE_FAR) continue;
    const tY = invDet * (-plY * rx + plX * ry);
    if (tY < 0.3) continue;
    vis.push([tY, invDet * (dirY * rx - dirX * ry), s, rx, ry]);
  }
  vis.sort((a, b) => b[0] - a[0]);

  for (const [tY, tX, s, rx, ry] of vis) {
    const cx = (cols / 2) * (1 + tX / tY), half = ((s.w / tY) * (cols / 2)) / plane / 2;
    const top = hor - ((s.z1 - v.eye) * scale) / tY, bot = hor + (v.eye * scale) / tY;
    const x0 = Math.max(0, Math.ceil(cx - half - 0.5)), x1 = Math.min(cols, Math.ceil(cx + half - 0.5));
    const y0 = Math.max(0, Math.ceil(top - 0.5)), y1 = Math.min(rows, Math.ceil(bot - 0.5));
    if (x0 >= x1 || y0 >= y1) continue;
    const fog = 1 - Math.min(1, tY / SPRITE_FAR) * 0.8;
    let facing = 0;
    if (s.kind === 'car') { const dl = Math.hypot(rx, ry) || 1; facing = (s.dx * rx + s.dy * ry) / dl; }
    for (let x = x0; x < x1; x++) {
      const u = (x + 0.5 - (cx - half)) / (2 * half);
      for (let y = y0; y < y1; y++) {
        const i = y * cols + x;
        if (grid.depth[i] <= tY) continue;
        const vv = (y + 0.5 - top) / (bot - top);
        let ch = 0, r = 0, g = 0, b = 0;
        if (s.kind === 'car') {
          const roofSign = s.taxi && u > 0.4 && u < 0.6;
          if (vv < 0.12) { if (u > 0.15 && u < 0.85) { ch = roofSign ? G.hash : G.us; [r, g, b] = roofSign ? [255, 230, 120] : s.col; } }
          else if (vv < 0.42) { if (u > 0.1 && u < 0.9) { ch = G.eq; r = 45; g = 65; b = 95; if (u < 0.14 || u > 0.86) { ch = G.bar; [r, g, b] = s.col; } } }
          else if (vv < 0.86) {
            ch = G.hash; [r, g, b] = s.col;
            if (vv > 0.72 && (u < 0.2 || u > 0.8)) {
              if (facing > 0.35) { ch = G.at; r = 255; g = 40; b = 40; }
              else if (facing < -0.35) { ch = G.at; r = 255; g = 245; b = 200; }
            }
          } else if (u < 0.3 || u > 0.7) { ch = G.o; r = 30; g = 30; b = 34; } else { ch = G.dash; r = 20; g = 20; b = 24; }
          r *= fog; g *= fog; b *= fog;
        } else if (s.kind === 'tree') {
          const du = (u - 0.5) / 0.5, dv = (vv - 0.34) / 0.34;
          if (du * du + dv * dv < 1) {
            const hv = hash3(s.seed, Math.floor(u * 8), Math.floor(vv * 10));
            ch = hv < 0.4 ? G.at : hv < 0.7 ? G.amp : G.pct; r = 40 * fog; g = (100 + hv * 80) * fog; b = 45 * fog;
          } else if (vv > 0.6 && Math.abs(u - 0.5) < 0.09) { ch = G.bar; r = 90 * fog; g = 60 * fog; b = 35 * fog; }
        } else if (vv < 0.07) { ch = G.star; r = 255; g = 200; b = 120; }
        else if (Math.abs(u - 0.5) < 0.3) { ch = G.bar; r = 110 * fog; g = 110 * fog; b = 118 * fog; }
        if (ch) { grid.put(i, ch, r, g, b); grid.depth[i] = tY; }
      }
    }
  }
}
