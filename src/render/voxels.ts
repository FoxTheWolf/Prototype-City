import { hash3 } from '../core/rng';

/**
 * 15.19a: objects of little cubes (the rule "objetos de cubinhos"; docs/plano-interfaces.md). A model is
 * an occupancy grid of 1 mm cells (a palette index per cell, 0 empty), built by code from its drawing
 * (the color at the middle of each cell), never from a file. It is drawn by casting a ray per pixel of
 * the HD layer (render/hd.ts) through the grid (a 3D DDA), in two steps: the geometry into a G-buffer
 * (which cube, which face, how hemmed in it is), redone only when the shape changes (a key sinks); the
 * light over it every frame, cheap. On the CPU for the things held in the hand (one model, ~25 thousand
 * rays); the world's objects (the cars, stage 18) will take the same grids to the GPU.
 */
export class Vox {
  readonly cells: Uint8Array;
  constructor(readonly nx: number, readonly ny: number, readonly nz: number) { this.cells = new Uint8Array(nx * ny * nz); }
  at(x: number, y: number, z: number): number {
    return x < 0 || y < 0 || z < 0 || x >= this.nx || y >= this.ny || z >= this.nz ? 0 : this.cells[(z * this.ny + y) * this.nx + x];
  }
  set(x: number, y: number, z: number, c: number) {
    if (x >= 0 && y >= 0 && z >= 0 && x < this.nx && y < this.ny && z < this.nz) this.cells[(z * this.ny + y) * this.nx + x] = c;
  }
  /** Layers z0..z1-1 from a drawing: the palette index at the middle of each cell (x + 0.5, y + 0.5), 0 for none (left as is). */
  draw(z0: number, z1: number, f: (x: number, y: number) => number) {
    for (let y = 0; y < this.ny; y++) for (let x = 0; x < this.nx; x++) {
      const c = f(x + 0.5, y + 0.5);
      if (c) for (let z = z0; z < z1; z++) this.set(x, y, z, c);
    }
  }
  copy(): Vox { const v = new Vox(this.nx, this.ny, this.nz); v.cells.set(this.cells); return v; }
}

/** The faces a ray can meet: the normal's axis and sign (x-, x+, y-, y+, z-, z+); y grows down, z toward the viewer. */
export const enum Face { XN, XP, YN, YP, ZN, ZP }
export const FACE_N: readonly (readonly [number, number, number])[] = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];

/** What the rays met, per pixel: the palette index (0 nothing), the face, how many of its four neighbours in front of it are filled (0..4), the cube's x and y. */
export interface GBuf { w: number; h: number; mat: Uint8Array; face: Uint8Array; ao: Uint8Array; vx: Uint8Array; vy: Uint8Array }

/**
 * A model seen from in front, orthographic: w x h pixels, each sx x sy mm; untilted, pixel (0, 0) falls on
 * the model's (0, 0) and the view runs down -z. yaw turns it about its vertical axis (its right side
 * toward the viewer), pitch about its horizontal one (its top toward the viewer), both about its middle.
 */
export interface VoxView { w: number; h: number; sx: number; sy: number; yaw: number; pitch: number; /** the model's point at pixel (0, 0)'s corner, untilted (mm; 0 by default) */ x0?: number; y0?: number }

export function castVox(V: Vox, view: VoxView): GBuf {
  const { w, h, sx, sy } = view, n = w * h, X0 = view.x0 ?? 0, Y0 = view.y0 ?? 0;
  const G: GBuf = { w, h, mat: new Uint8Array(n), face: new Uint8Array(n), ao: new Uint8Array(n), vx: new Uint8Array(n), vy: new Uint8Array(n) };
  const cy = Math.cos(view.yaw), syw = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  // the camera's axes in the model's frame: R = Ry(yaw) * Rx(pitch) applied to the screen's right, down and the view
  const rot = (x: number, y: number, z: number): [number, number, number] => {
    const y1 = y * cp - z * sp, z1 = y * sp + z * cp;
    return [x * cy + z1 * syw, y1, -x * syw + z1 * cy];
  };
  const R = rot(1, 0, 0), D = rot(0, 1, 0), dir = rot(0, 0, -1), mx = V.nx / 2, my = V.ny / 2, mz = V.nz / 2, far = V.nx + V.ny + V.nz;
  const [dx, dy, dz] = dir, NX = V.nx, NY = V.ny, NZ = V.nz, C = V.cells;
  const ix = Math.abs(dx) < 1e-9 ? 1e9 : 1 / dx, iy = Math.abs(dy) < 1e-9 ? 1e9 : 1 / dy, iz = Math.abs(dz) < 1e-9 ? 1e9 : 1 / dz;
  const stx = dx > 0 ? 1 : -1, sty = dy > 0 ? 1 : -1, stz = dz > 0 ? 1 : -1, tdx = Math.abs(ix), tdy = Math.abs(iy), tdz = Math.abs(iz);
  // the face a step along each axis comes in through
  const fX = stx > 0 ? Face.XN : Face.XP, fY = sty > 0 ? Face.YN : Face.YP, fZ = stz > 0 ? Face.ZN : Face.ZP;
  const slab = (o: number, i: number, n: number): [number, number] => { const a = -o * i, b = (n - o) * i; return a < b ? [a, b] : [b, a]; };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = X0 + (i + 0.5) * sx - mx, v = Y0 + (j + 0.5) * sy - my;
    const ox = mx + R[0] * u + D[0] * v - dx * far, oy = my + R[1] * u + D[1] * v - dy * far, oz = mz + R[2] * u + D[2] * v - dz * far;
    // into the grid's box (slabs), then cell by cell
    const [ax, bx] = slab(ox, ix, NX), [ay, by] = slab(oy, iy, NY), [az, bz] = slab(oz, iz, NZ);
    const t0 = Math.max(ax, ay, az), t1 = Math.min(bx, by, bz);
    if (t0 >= t1) continue;
    let face = t0 === ax ? fX : t0 === ay ? fY : fZ;
    const t = t0 + 1e-6, px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
    let cx = Math.min(NX - 1, Math.max(0, Math.floor(px))), cy = Math.min(NY - 1, Math.max(0, Math.floor(py))), cz = Math.min(NZ - 1, Math.max(0, Math.floor(pz)));
    let mX = t0 + ((stx > 0 ? cx + 1 : cx) - px) * ix, mY = t0 + ((sty > 0 ? cy + 1 : cy) - py) * iy, mZ = t0 + ((stz > 0 ? cz + 1 : cz) - pz) * iz;
    for (;;) {
      const m = C[(cz * NY + cy) * NX + cx];
      if (m) {
        const k = j * w + i, N = FACE_N[face];
        G.mat[k] = m; G.face[k] = face; G.vx[k] = cx; G.vy[k] = cy;
        // hemmed in: the cells in front of the face, beside it, that are filled (the crevices round the keys)
        const fx = cx + N[0], fy = cy + N[1], fz = cz + N[2];
        let ao = 0;
        if (!N[0]) ao += (V.at(fx - 1, fy, fz) ? 1 : 0) + (V.at(fx + 1, fy, fz) ? 1 : 0);
        if (!N[1]) ao += (V.at(fx, fy - 1, fz) ? 1 : 0) + (V.at(fx, fy + 1, fz) ? 1 : 0);
        if (!N[2]) ao += (V.at(fx, fy, fz - 1) ? 1 : 0) + (V.at(fx, fy, fz + 1) ? 1 : 0);
        G.ao[k] = ao;
        break;
      }
      if (mX < mY && mX < mZ) { cx += stx; if (cx < 0 || cx >= NX) break; mX += tdx; face = fX; }
      else if (mY < mZ) { cy += sty; if (cy < 0 || cy >= NY) break; mY += tdy; face = fY; }
      else { cz += stz; if (cz < 0 || cz >= NZ) break; mZ += tdz; face = fZ; }
    }
  }
  return G;
}

/** The camera's axes in the model's frame for a yaw and pitch (castVox's): the screen's right, its down, and the view. */
export function voxAxes(yaw: number, pitch: number): [number[], number[], number[]] {
  const cy = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const rot = (a: number, b: number, c: number): number[] => { const y1 = b * cp - c * sp, z1 = b * sp + c * cp; return [a * cy + z1 * syw, y1, -a * syw + z1 * cy]; };
  return [rot(1, 0, 0), rot(0, 1, 0), rot(0, 0, -1)];
}
/** Where a point of the model (x, y, z in cells) falls in the view, in pixels from its top-left (pixel i spans i to i + 1), as castVox sees it. */
export function voxProject(V: { nx: number; ny: number; nz: number }, view: VoxView, x: number, y: number, z: number): [number, number] {
  const [R, D] = voxAxes(view.yaw, view.pitch), mx = V.nx / 2, my = V.ny / 2, mz = V.nz / 2;
  const u = (x - mx) * R[0] + (y - my) * R[1] + (z - mz) * R[2], v = (x - mx) * D[0] + (y - my) * D[1] + (z - mz) * D[2];
  return [(u + mx - (view.x0 ?? 0)) / view.sx, (v + my - (view.y0 ?? 0)) / view.sy];
}

/**
 * How a palette entry takes the light: its color and how much of the scene's glint it gives back; metal
 * streaks along its rows, glow is light of its own. chrome: a curved mirror (the manual's chrome: light at
 * the top, a dark band past the middle, light again at the foot) over the rows y0 to y1 of the model,
 * instead of col, a little tinted by the scene's light.
 */
export interface VoxMat { col: readonly [number, number, number]; gloss: number; metal?: boolean; glow?: boolean; chrome?: readonly [number, number] }
/** The manual's chrome gradient (#eef2f7, #8d939c at 45%, #5d626a at 55%, #c9ced6). */
const CHROME_STOPS: readonly [number, number, number, number][] = [[0, 238, 242, 247], [0.45, 141, 147, 156], [0.55, 93, 98, 106], [1, 201, 206, 214]];
function chromeAt(t: number, out: number[]) {
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < CHROME_STOPS.length - 2 && t > CHROME_STOPS[i + 1][0]) i++;
  const a = CHROME_STOPS[i], b = CHROME_STOPS[i + 1], f = (t - a[0]) / (b[0] - a[0]);
  for (let c = 0; c < 3; c++) out[c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f;
}
/**
 * The scene's light on the model: its color (rgb, 0..1.5), the side the brightest light comes from
 * (lat, -1 left to 1 right) and how strong its glint is (str, 0..1), and the glint's color.
 */
export interface VoxLight { rgb: ArrayLike<number>; lat: number; str: number; glint: readonly [number, number, number] }

/**
 * The light over a G-buffer, into put(x, y, r, g, b) for each pixel met: diffuse from a light above and
 * to the side the glint comes from (in the model's frame), the faces facing it a little brighter (the
 * rim), the crevices darker, a soft diagonal sheen in proportion to the gloss, darker toward the bottom
 * as the old body was. `mul[index]` scales a palette entry (a key under the cursor, a key pressed).
 */
export function shadeVox(G: GBuf, pal: readonly VoxMat[], L: VoxLight, put: (x: number, y: number, r: number, g: number, b: number) => void, mul?: ArrayLike<number>) {
  const ln = Math.hypot(L.lat * 0.8, 0.6, 0.7), lx = (L.lat * 0.8) / ln, ly = -0.6 / ln, lz = 0.7 / ln;
  const amp = L.str * 55, s0 = 0.68 + L.lat * 0.44;
  // the palette flattened (one shape for the loop below)
  const n = pal.length, cr = new Float32Array(n), cg = new Float32Array(n), cb = new Float32Array(n), gl = new Float32Array(n), fl = new Uint8Array(n);
  const c0 = new Float32Array(n), c1 = new Float32Array(n), ch = [0, 0, 0];
  for (let i = 1; i < n; i++) {
    const M = pal[i]; if (!M) continue;
    cr[i] = M.col[0]; cg[i] = M.col[1]; cb[i] = M.col[2]; gl[i] = M.gloss; fl[i] = (M.metal ? 1 : 0) | (M.glow ? 2 : 0) | (M.chrome ? 4 : 0);
    if (M.chrome) { c0[i] = M.chrome[0]; c1[i] = M.chrome[1]; }
  }
  const Lr = L.rgb[0], Lg = L.rgb[1], Lb = L.rgb[2], [Gr, Gg, Gb] = L.glint;
  // the light on each face, once
  const dif = FACE_N.map((N) => { const nl = N[0] * lx + N[1] * ly + N[2] * lz; return (0.42 + 0.58 * Math.max(0, nl)) * (N[2] !== 1 && nl > 0.3 ? 1.3 : 1); });
  for (let y = 0; y < G.h; y++) {
    const fall = 1 - (y / G.h) * 0.25;
    for (let x = 0; x < G.w; x++) {
      const k = y * G.w + x, m = G.mat[k];
      if (!m) continue;
      const f = G.face[k];
      let d = dif[f] * (1 - 0.11 * G.ao[k]) * fall;
      if (fl[m] & 1) d *= 1 + (hash3(G.vy[k], G.vx[k] >> 3, 91) - 0.5) * 0.12;
      if (mul) d *= mul[m];
      // the sheen: a band across the face, along a diagonal that slides with the light's side
      const u = x / G.w + (y / G.h) * 0.55 - s0, sh = gl[m] && amp ? Math.exp(-((u / 0.1) ** 2)) * gl[m] * amp * (f === Face.ZP ? 1 : 0.5) : 0;
      if (fl[m] & 4) {
        // chrome: the mirror's gradient down the part (the sides a little darker), lit only a little by the scene, and the glint
        chromeAt((G.vy[k] + 0.5 - c0[m]) / Math.max(1, c1[m] - c0[m]), ch);
        const e = (f === Face.ZP ? 1 : 0.82) * (mul ? mul[m] : 1);
        put(x, y, ch[0] * (0.55 + 0.45 * Lr) * e + sh * Gr, ch[1] * (0.55 + 0.45 * Lg) * e + sh * Gg, ch[2] * (0.55 + 0.45 * Lb) * e + sh * Gb);
      } else if (fl[m] & 2) put(x, y, cr[m] * Math.max(1, Lr) + sh * Gr, cg[m] * Math.max(1, Lg) + sh * Gg, cb[m] * Math.max(1, Lb) + sh * Gb);
      else put(x, y, cr[m] * Lr * d + sh * Gr, cg[m] * Lg * d + sh * Gg, cb[m] * Lb * d + sh * Gb);
    }
  }
}
