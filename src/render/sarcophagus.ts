import { hash3 } from '../core/rng';
import { type City } from '../sim/city';
import { KIND, type CharGrid } from './grid';

/**
 * The Sarcophagus on the horizon, past the fence on one side: a dome of steel ribs with panels
 * missing, the fire glowing through the gaps and leaking out under its rim, and the squat draft
 * tower beside it. It is 2.5 km out and more, so it is drawn as a far silhouette, column by column.
 * From most of the city the seam's smoke hides it; it only comes out of the haze near that edge.
 */

/** The fake radius of the earth: things far away sink d^2 / 2R (barely, at the city's scale). */
export const CURVE_R = 400000;

const C = (s: string) => s.charCodeAt(0);
const smooth = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** How clearly the dome shows from a point: 1 near its edge of the city, 0 deeper in. */
function visibility(c: City, px: number, py: number) {
  const S = c.sarcophagus;
  return smooth(S.r + 3700, S.r + 3100, Math.hypot(S.x - px, S.y - py));
}

/** Height of the dome's surface at distance rho from its center (a spherical cap). */
function domeZ(r: number, h: number, rho: number) {
  if (rho >= r) return 0;
  const Rs = (r * r + h * h) / (2 * h);
  return Math.sqrt(Rs * Rs - rho * rho) - (Rs - h);
}

export function sarcophagusColumn(grid: CharGrid, x: number, c: City, px: number, py: number, rdx: number, rdy: number, eye: number, hor: number, scale: number, sec: number, day: number, sun: readonly number[]) {
  const vis = visibility(c, px, py);
  if (vis <= 0) return;
  const S = c.sarcophagus, L = Math.hypot(rdx, rdy), ux = rdx / L, uy = rdy / L;
  const { cols, depth, bg } = grid;
  // dome and tower along this column's ray: [entry, exit] distances, or none
  const span = (cx: number, cy: number, r: number) => {
    const ox = px - cx, oy = py - cy, b = ox * ux + oy * uy, disc = b * b - (ox * ox + oy * oy - r * r);
    return disc > 0 && -b + Math.sqrt(disc) > 0 ? [Math.max(1, -b - Math.sqrt(disc)), -b + Math.sqrt(disc)] : null;
  };
  // apparent height above the eye of a surface point z at distance d, over the curve, as a slope
  const slope = (z: number, d: number) => (z - eye - (d * d) / (2 * CURVE_R)) / d;
  // a row's slope: rows climb (hor - y) / scale per unit of the ray parameter, which covers L metres
  const rowSlope = (y: number) => (hor - (y + 0.5)) / scale / L;
  // sh: the share of direct sun on a steel surface (daylight brightens it in the final pass); 0 for the fire
  const put = (y: number, d: number, ch: number, r: number, g: number, b: number, sh = 0) => {
    const i = y * cols + x;
    if (y < 0 || y >= grid.rows || depth[i] <= d / L) return;
    // fade out into whatever is behind (the smoky low sky) as it leaves view
    const k = i * 4, haze = 0.45 * (1 - day); // by day the final pass hazes it, after the daylight
    r = r * (1 - haze) + bg[k] * haze; g = g * (1 - haze) + bg[k + 1] * haze; b = b * (1 - haze) + bg[k + 2] * haze;
    grid.setBg(i, bg[k] + (r * 0.35 - bg[k]) * vis, bg[k + 1] + (g * 0.35 - bg[k + 1]) * vis, bg[k + 2] + (b * 0.35 - bg[k + 2]) * vis);
    grid.put(i, ch, bg[k] + (r - bg[k]) * vis, bg[k + 1] + (g - bg[k + 1]) * vis, bg[k + 2] + (b - bg[k + 2]) * vis);
    depth[i] = d / L;
    grid.sun[i] = sh ? 1 + Math.max(0, Math.min(1, sh)) * 254 : 0;
    grid.kind[i] = KIND.block; // solid color; a glyph on it is a glint
  };
  // the fire through the gaps fades by day into the dark of the inside, a glow left deep in it
  const fire = 0.75 * (1 - 0.7 * day), dark = 18 * 0.7 * day;
  const flick = 0.75 + 0.25 * Math.sin(sec * 0.7 + x * 0.05);
  const steel = 16 + 14 * day; // a solid block: darker than a glyph on black would be

  const dome = span(S.x, S.y, S.r);
  if (dome) {
    // march through the dome: the highest slope is its silhouette
    const N = 24, ds = (dome[1] - dome[0]) / N;
    let top = -1e9;
    for (let k = 0; k <= N; k++) { const d = dome[0] + ds * k; top = Math.max(top, slope(domeZ(S.r, S.h, Math.hypot(px + ux * d - S.x, py + uy * d - S.y)), d)); }
    const yTop = Math.ceil(hor - top * scale * L - 0.5), yBase = Math.ceil(hor - slope(0, dome[0]) * scale * L - 0.5);
    for (let y = Math.max(0, yTop); y <= Math.min(grid.rows - 1, yBase); y++) {
      // the first point along the ray where the dome rises above this row
      const want = rowSlope(y);
      let d = dome[0], z = 0;
      for (let k = 0; k <= N; k++) {
        d = dome[0] + ds * k;
        z = domeZ(S.r, S.h, Math.hypot(px + ux * d - S.x, py + uy * d - S.y));
        if (slope(z, d) >= want) break;
      }
      const hx = px + ux * d - S.x, hy = py + uy * d - S.y, phi = Math.atan2(hy, hx);
      // panels: 2.5 degrees around by 50 m up; a third never went up, and the fire shows through
      const pa = Math.floor((phi + Math.PI) / 0.044), pz = Math.floor(z / 50), ph = hash3(pa, pz, 92);
      // the dome's normal there (a sphere of radius Rs centered Rs - h below its top), each panel
      // set a little askew, turned to the sun
      const Rs = (S.r * S.r + S.h * S.h) / (2 * S.h);
      let nx = hx / Rs + (ph - 0.5) * 0.08, ny = hy / Rs + (hash3(pa, pz, 93) - 0.5) * 0.08, nz = (z + Rs - S.h) / Rs;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const ns = nx * sun[0] + ny * sun[1] + nz * sun[2];
      // a glint where the sun mirrors off a panel toward the eye
      const vx = -ux, vy = -uy, vz = (eye - z) / d, vl = Math.hypot(vx, vy, vz);
      const spec = sun[2] > 0 && ns > 0 ? (2 * ns * (nx * vx + ny * vy + nz * vz) - (sun[0] * vx + sun[1] * vy + sun[2] * vz)) / vl : 0;
      const glint = day > 0.2 && spec > 0.985 ? (spec > 0.996 ? C('*') : C('+')) : 32;
      const pk = 0.85 + 0.3 * ph;
      if (y === yTop) put(y, d, 32, steel * 1.3, steel * 1.3, steel * 1.4, ns + 0.01);
      else if (z < 45) put(y, d, 32, 230 * flick * fire + dark, 95 * flick * fire + dark, 30 * fire + dark); // the fire leaking out under the rim
      else if (hash3(pa, pz, 91) < 0.33) put(y, d, 32, 200 * flick * fire + dark, 80 * flick * fire + dark, 28 * fire + dark);
      else { const rib = pa % 3 === 0 ? 0.8 : 1; put(y, d, glint, steel * pk * rib, steel * pk * rib, steel * 1.12 * pk * rib, ns + 0.01); }
    }
  }

  const tw = span(S.tx, S.ty, S.tr);
  if (tw) {
    // the draft tower: a squat ribbed drum, its rim glowing with the heat it was built to draw up
    const d = tw[0];
    const yTop = Math.ceil(hor - slope(S.th, d) * scale * L - 0.5), yBase = Math.ceil(hor - slope(0, d) * scale * L - 0.5);
    const ang = Math.atan2(py + uy * d - S.ty, px + ux * d - S.tx);
    for (let y = Math.max(0, yTop); y <= Math.min(grid.rows - 1, yBase); y++) {
      if (y === yTop) put(y, d, (Math.floor(sec * 1.5) + x) % 9 === 0 ? C('*') : 32, 255 * flick * fire + dark, 70 * fire + dark, 40 * fire + dark);
      else { const rib = Math.floor((ang + Math.PI) / 0.06) % 4 === 0 ? 0.8 : 1; put(y, d, 32, steel * 0.9 * rib, steel * 0.9 * rib, steel * rib, Math.cos(ang) * sun[0] + Math.sin(ang) * sun[1] + 0.01); }
    }
  }
}

/**
 * The cranes standing on the dome, stopped mid-job: a mast with its jib, and a red light blinking
 * on top. Drawn after the columns, projected like the smoke columns.
 */
export function drawCranes(grid: CharGrid, c: City, px: number, py: number, eye: number, dirX: number, dirY: number, plX: number, plY: number, scale: number, hor: number, sec: number) {
  const vis = visibility(c, px, py);
  if (vis <= 0) return;
  const { cols, rows, depth } = grid;
  const invDet = 1 / (plX * dirY - dirX * plY);
  for (const k of c.sarcophagus.cranes) {
    const rx = k.x - px, ry = k.y - py, tY = invDet * (-plY * rx + plX * ry);
    if (tY < 10) continue;
    const tX = invDet * (dirY * rx - dirX * ry), cx = Math.floor((cols / 2) * (1 + tX / tY));
    const drop = (rx * rx + ry * ry) / (2 * CURVE_R);
    const yTop = Math.ceil(hor - ((k.z - eye - drop) * scale) / tY - 0.5), yBot = Math.ceil(hor - ((k.z - 70 - eye - drop) * scale) / tY - 0.5);
    const lightOn = (sec + k.a) % 1.6 < 0.5;
    for (let y = Math.max(0, yTop); y <= Math.min(rows - 1, yBot); y++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, i = y * cols + x;
        if (x < grid.x0 || x >= grid.x1 || depth[i] < tY) continue;
        if (y === yTop) {
          if (dx === 0) grid.put(i, lightOn ? C('*') : C('-'), lightOn ? 255 * vis : 60 * vis, lightOn ? 40 : 60 * vis, lightOn ? 30 : 65 * vis);
          else grid.put(i, C('-'), 70 * vis, 70 * vis, 76 * vis);
        } else if (dx === 0) grid.put(i, C('|'), 60 * vis, 60 * vis, 66 * vis);
      }
    }
  }
}
