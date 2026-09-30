import { hash3 } from '../core/rng';
import { BS, N, Tile, type RGB } from '../sim/city';
import { type World } from '../sim/world';
import { type CharGrid } from './grid';

export interface View {
  x: number;
  y: number;
  yaw: number;
  /** Look angle up/down in radians. */
  pitch: number;
  /** Eye height in world units. */
  eye: number;
  /** Interpolation factor between the previous and current sim tick. */
  alpha: number;
  /** Cell width / cell height in pixels, needed for correct vertical scale. */
  cellAspect: number;
}

/** Draw distance in tiles. */
const FAR = 48;
/** tan(horizontal FOV / 2). */
const PLANE = 0.72;

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

export function renderWorld(grid: CharGrid, world: World, v: View) {
  const { cols, rows } = grid;
  const { city } = world;
  grid.clear();

  const dirX = Math.cos(v.yaw), dirY = Math.sin(v.yaw);
  const plX = -dirY * PLANE, plY = dirX * PLANE;
  // Rows per world unit of height at distance 1: horizontal scale converted by the cell aspect.
  const scale = (cols / 2) / PLANE * v.cellAspect;
  // y-shearing: the horizon moves by the vertical focal length times tan(pitch)
  const hor = rows / 2 + Math.tan(v.pitch) * scale;
  const eye = v.eye, px = v.x, py = v.y;
  // Stars live on a fixed ring of azimuth slots, one slot per column at screen center.
  const starSlots = Math.round(cols * Math.PI / Math.atan(PLANE));

  for (let x = 0; x < cols; x++) {
    const camX = (2 * (x + 0.5)) / cols - 1;
    const rdx = dirX + plX * camX, rdy = dirY + plY * camX;

    // ---- sky: gradient background + stars fixed to the sky
    const az = v.yaw + Math.atan(camX * PLANE);
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
      if (rd > FAR || wx < 0 || wy < 0 || wx >= N || wy >= N) { grid.put(i, G.dot, 28, 24, 32); continue; }
      const t = city.tiles[(wy | 0) * N + (wx | 0)];
      const lxf = wx - Math.floor(wx / BS) * BS, lyf = wy - Math.floor(wy / BS) * BS;
      const lx = lxf | 0, ly = lyf | 0;
      // lamp glow pools
      const dxl = Math.min(Math.abs(lxf - 3.5), Math.abs(lxf - 11.5), Math.abs(lxf + 0.5));
      const dyl = Math.min(Math.abs(lyf - 3.5), Math.abs(lyf - 11.5), Math.abs(lyf + 0.5));
      const glow = Math.max(0, 1 - (dxl * dxl + dyl * dyl) / 10);
      const fog = 1 - Math.min(1, rd / FAR) * 0.9;
      const hv = hash3(Math.floor(wx * 4), Math.floor(wy * 4), 3);
      let ch = G.dot, r = 38, g = 38, b = 46;
      if (t === Tile.Road) {
        ch = hv < 0.5 ? G.dot : hv < 0.8 ? G.com : G.tick;
        const vRoad = lx < 3, hRoad = ly < 3;
        if (vRoad && !hRoad) {
          if (ly === 3 || ly === 11) { if (((lxf * 3) | 0) % 2 === 0) { ch = G.eq; r = 150; g = 150; b = 150; } }
          else if (Math.abs(lxf - 1.5) < 0.06 && ((wy * 1.3) | 0) % 2 === 0) { ch = G.bar; r = 210; g = 170; b = 60; }
        } else if (hRoad && !vRoad) {
          if (lx === 3 || lx === 11) { if (((lyf * 3) | 0) % 2 === 0) { ch = G.bar; r = 150; g = 150; b = 150; } }
          else if (Math.abs(lyf - 1.5) < 0.06 && ((wx * 1.3) | 0) % 2 === 0) { ch = G.dash; r = 210; g = 170; b = 60; }
        }
      } else if (t === Tile.Walk) {
        const fx = wx - (wx | 0), fy = wy - (wy | 0);
        ch = fx < 0.08 || fy < 0.08 ? G.plus : G.col; r = 78; g = 74; b = 78;
      } else if (t === Tile.Park) {
        ch = hv < 0.4 ? G.quo : hv < 0.7 ? G.com : G.semi; r = 40; g = 95 + hv * 40; b = 45;
      } else { ch = G.hash; r = 60; g = 50; b = 45; }
      grid.put(i, ch, r * fog + glow * 95, g * fog + glow * 70, b * fog + glow * 35);
    }

    // ---- walls: DDA front to back; keeps going past near buildings to find taller ones behind
    let mx = Math.floor(px), my = Math.floor(py);
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    const stX = rdx < 0 ? -1 : 1, stY = rdy < 0 ? -1 : 1;
    let sdx = (rdx < 0 ? px - mx : mx + 1 - px) * ddx, sdy = (rdy < 0 ? py - my : my + 1 - py) * ddy;
    let clipTop = rows, cur = city.bid[my * N + mx];
    for (let s = 0; s < 400; s++) {
      let side: number;
      if (sdx < sdy) { sdx += ddx; mx += stX; side = 0; } else { sdy += ddy; my += stY; side = 1; }
      if (mx < 0 || my < 0 || mx >= N || my >= N) break;
      const perp = side === 0 ? sdx - ddx : sdy - ddy;
      if (perp > FAR) break;
      const id = city.bid[my * N + mx];
      if (id === cur) continue;
      cur = id;
      if (id < 0) continue;
      const B = city.buildings[id];
      const yb = hor + (eye * scale) / perp, yt = hor - ((B.h - eye) * scale) / perp;
      // a cell belongs to the wall when its center is inside the projected span
      const y0 = Math.max(0, Math.ceil(yt - 0.5)), y1 = Math.min(rows, Math.ceil(yb - 0.5), clipTop);
      const along = side === 0 ? py + perp * rdy : px + perp * rdx;
      const fogK = Math.min(1, perp / FAR);
      const light = (side ? 0.72 : 1) * (1 - fogK * 0.85);
      const winLight = 1 - fogK * 0.55;
      const wxw = along * 3, wi = Math.floor(wxw), fw = wxw - wi;
      const edge = Math.abs(along - Math.round(along)) < 0.04;
      const [fr, fg, fb] = B.frame;
      for (let y = y0; y < y1; y++) {
        const i = y * cols + x;
        const z = eye + ((hor - (y + 0.5)) / scale) * perp;
        const fl = Math.floor(z / 0.55), fz = z / 0.55 - fl;
        let ch: number, r: number, g: number, b: number;
        if (z > B.h - 0.18) { ch = G.us; r = fr * 1.5 * light; g = fg * 1.5 * light; b = fb * 1.5 * light; }
        else if (z < 0.5 && B.shop) {
          if (z > 0.36) { ch = G.eq; const k = winLight * (0.7 + 0.3 * hash3(id, wi, 99)); r = B.sign[0] * k; g = B.sign[1] * k; b = B.sign[2] * k; }
          else if (fw > 0.12 && fw < 0.88 && z > 0.04) { ch = fw < 0.2 ? G.lb : fw > 0.8 ? G.rb : G.col; r = 180 * winLight; g = 150 * winLight; b = 100 * winLight; }
          else { ch = G.bar; r = fr * light; g = fg * light; b = fb * light; }
        } else if (fw > 0.2 && fw < 0.8 && fz > 0.28 && fz < 0.8 && !edge) {
          const hh = hash3(id, wi, fl);
          if (hh < B.lit) {
            ch = hh < B.lit * 0.3 ? G.at : hh < B.lit * 0.7 ? G.hash : G.pct;
            const k = winLight * (0.65 + 0.35 * hash3(wi, fl, id));
            r = B.win[0] * k; g = B.win[1] * k; b = B.win[2] * k;
          } else { ch = G.eq; r = 30 * light + 8; g = 36 * light + 8; b = 58 * light + 12; }
        } else {
          ch = edge ? G.bar : perp > 18 ? G.dot : G.col;
          r = fr * light; g = fg * light; b = fb * light;
        }
        grid.put(i, ch, r, g, b);
        grid.setBg(i, 7, 8, 12);
        grid.depth[i] = perp;
      }
      clipTop = Math.min(clipTop, Math.max(0, Math.ceil(yt - 0.5)));
      if (clipTop <= 0) break;
    }
  }

  drawSprites(grid, collectSprites(world, v), v, dirX, dirY, plX, plY, scale, hor);
}

function collectSprites(world: World, v: View): Sprite[] {
  const out: Sprite[] = [];
  const none: RGB = [0, 0, 0];
  for (const p of world.city.props) out.push({ ...p, dx: 0, dy: 0, taxi: false, col: none });
  for (const c of world.cars) {
    // interpolate between ticks so motion is smooth at any frame rate
    const x = c.px + (c.x - c.px) * v.alpha, y = c.py + (c.y - c.py) * v.alpha;
    out.push({ kind: 'car', x, y, w: 0.85, z1: 0.62, seed: 0, dx: c.dx, dy: c.dy, taxi: c.taxi, col: c.col });
  }
  return out;
}

function drawSprites(grid: CharGrid, sprites: Sprite[], v: View, dirX: number, dirY: number, plX: number, plY: number, scale: number, hor: number) {
  const { cols, rows } = grid;
  const invDet = 1 / (plX * dirY - dirX * plY);
  const vis: [number, number, Sprite, number, number][] = [];
  for (const s of sprites) {
    const rx = s.x - v.x, ry = s.y - v.y;
    if (rx * rx + ry * ry > FAR * FAR) continue;
    const tY = invDet * (-plY * rx + plX * ry);
    if (tY < 0.15) continue;
    vis.push([tY, invDet * (dirY * rx - dirX * ry), s, rx, ry]);
  }
  vis.sort((a, b) => b[0] - a[0]);

  for (const [tY, tX, s, rx, ry] of vis) {
    const cx = (cols / 2) * (1 + tX / tY), half = ((s.w / tY) * (cols / 2)) / PLANE / 2;
    const top = hor - ((s.z1 - v.eye) * scale) / tY, bot = hor + (v.eye * scale) / tY;
    const x0 = Math.max(0, Math.ceil(cx - half - 0.5)), x1 = Math.min(cols, Math.ceil(cx + half - 0.5));
    const y0 = Math.max(0, Math.ceil(top - 0.5)), y1 = Math.min(rows, Math.ceil(bot - 0.5));
    if (x0 >= x1 || y0 >= y1) continue;
    const fog = 1 - Math.min(1, tY / FAR) * 0.8;
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
