import { businessName, districtName, landmarkName, roadName } from '../locale/names';
import { districtAt, nearestRoad, type City } from '../sim/city';
import { type Substation } from '../sim/power';
import { exitsOf, facePoint } from '../sim/interior';
import { BIZ_HOURS } from '../sim/telco';
import { Ground, MAP_RES, mapRaster, type MapRaster } from './mapdata';
import { T } from './lcd';

/**
 * The Maps app's places: what a search finds (the city's businesses and landmarks), where each one's
 * door is, and the walking route to it, found over the map raster (sidewalks first, crossing the
 * roads where it must). A place is a number: a business k as k, a landmark k as -(k + 1), and the
 * power grid's substation k as -(landmarks + 1 + k) (so a job's maintenance target can be navigated to).
 * Not part of the simulation: the phone reads the city.
 */
export type Place = number;
const F = T.find;

/** The live power grid's substations, linked once from the phone (the sim owns them, not the city). */
const subsByCity = new WeakMap<City, Substation[]>();
export function linkSubs(city: City, subs: Substation[]) { subsByCity.set(city, subs); }
const subList = (city: City): Substation[] => subsByCity.get(city) ?? [];
/** For a place p < 0: the substation index it names, or -1 when it is an ordinary landmark. */
const subIndex = (city: City, p: Place): number => { const i = -p - 1 - city.landmarks.length; return i >= 0 ? i : -1; };
/** The two-digit number a substation shows (matches its GRIDLINK-nn maintenance Wi-Fi, see sim/wifi.ts). */
const subNo = (k: number) => String(k + 1).padStart(2, '0');

export const placeName = (city: City, p: Place) => {
  if (p >= 0) return businessName(city, p);
  const s = subIndex(city, p);
  return s >= 0 ? `${F.substation} ${subNo(s)}` : landmarkName(city, -p - 1);
};
/** What kind of place it is, as the search lists it ("Bar", "Pharmacy", "Landmark", "Substation"). */
export const placeKind = (city: City, p: Place) => {
  if (p >= 0) return (F.kinds as Record<string, string>)[city.businesses[p].kind] ?? '';
  return subIndex(city, p) >= 0 ? F.substation : F.landmark;
};

const doors = new WeakMap<City, Map<Place, [number, number]>>();
/** Where to walk to: just outside the shop's own door (or the building's), or the landmark itself. */
export function placeAt(city: City, p: Place): [number, number] {
  if (p < 0) {
    const s = subIndex(city, p);
    if (s >= 0) { const S = subList(city)[s]; return S ? walkable(city, S.x, S.y) : [0, 0]; }
    const L = city.landmarks[-p - 1]; return walkable(city, L.x, L.y);
  }
  let mine = doors.get(city);
  if (!mine) doors.set(city, (mine = new Map()));
  const hit = mine.get(p);
  if (hit) return hit;
  const k = city.businesses[p].building, B = city.buildings[k], ex = exitsOf(city, k), D = ex[ex.length - 1];
  let at: [number, number];
  if (D) { const [x, y, nx, ny] = facePoint(B, D.face, (D.a0 + D.a1) / 2); at = walkable(city, x + nx * 1.5, y + ny * 1.5); }
  else at = walkable(city, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2);
  mine.set(p, at);
  return at;
}

/** The address: the avenue and the street of the corner nearest the door. */
export function placeAddress(city: City, p: Place): string {
  const [x, y] = placeAt(city, p);
  return `${roadName(city, true, nearestRoad(city.xb, city.xCell, x))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, y))}`;
}
export const placeDistrict = (city: City, p: Place) => { const [x, y] = placeAt(city, p); return districtName(city, districtAt(city, x, y)); };

const ampm = (h: number) => { h = ((h % 24) + 24) % 24; return h === 0 ? F.midnight : h === 12 ? F.noon : `${h % 12}${h < 12 ? 'am' : 'pm'}`; };
/** Open now, and until when; or closed, and when it opens. Null for a landmark (always there). */
export function placeHours(city: City, p: Place, hour: number): { open: boolean; text: string } | null {
  if (p < 0) return null;
  const [a, b] = BIZ_HOURS[city.businesses[p].kind] ?? [9, 17];
  if (a === 0 && b === 24) return { open: true, text: F.always };
  const open = (hour >= a && hour < b) || hour + 24 < b;
  return { open, text: (open ? F.until : F.opens).replace('{h}', ampm(open ? b : a)) };
}

/** Lowercase words, for matching. */
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);

/**
 * The places matching a search: every word typed starts a word of the name or of the kind ("pub",
 * "pharm", "bank"), nearest first, at most `max`.
 */
export function search(city: City, q: string, x: number, y: number, max = 40): Place[] {
  const qs = words(q);
  if (!qs.length) return [];
  const hits: [Place, number][] = [];
  const test = (p: Place) => {
    const extra = p >= 0 ? words((F.also as Record<string, string>)[city.businesses[p].kind] ?? '') : subIndex(city, p) >= 0 ? words(F.subWords) : [];
    const ws = [...words(placeName(city, p)), ...words(placeKind(city, p)), ...extra];
    if (!qs.every((w) => ws.some((v) => v.startsWith(w)))) return;
    const [px, py] = placeAt(city, p);
    hits.push([p, Math.hypot(px - x, py - y)]);
  };
  for (let k = 0; k < city.businesses.length; k++) test(k);
  for (let k = 0; k < city.landmarks.length; k++) test(-k - 1);
  const subs = subList(city);
  for (let k = 0; k < subs.length; k++) test(-(city.landmarks.length + 1 + k));
  return hits.sort((a, b) => a[1] - b[1]).slice(0, max).map((h) => h[0]);
}

/** Ground a route goes over, and what a metre of it costs (the sidewalks first; the roadway only to cross). */
const COST: number[] = [];
COST[Ground.Walk] = 1; COST[Ground.Park] = 1.2; COST[Ground.Plaza] = 1.1; COST[Ground.Road] = 2.2;
const cost = (m: MapRaster, q: number) => COST[m.kind[q]] ?? 0;

/** The nearest point a route can reach from (x, y): within 80 m, else (x, y) itself. */
export function walkable(city: City, x: number, y: number): [number, number] {
  const m = mapRaster(city), i0 = Math.floor(x / MAP_RES), j0 = Math.floor(y / MAP_RES);
  for (let r = 0; r < 40; r++) {
    let best = -1, bd = 1e9;
    for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
      if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || i < 0 || j < 0 || i >= m.w || j >= m.h) continue;
      const q = j * m.w + i;
      if (!cost(m, q) || m.kind[q] === Ground.Road) continue;
      const d = (i - i0) ** 2 + (j - j0) ** 2;
      if (d < bd) { bd = d; best = q; }
    }
    if (best >= 0) return [(best % m.w + 0.5) * MAP_RES, (Math.floor(best / m.w) + 0.5) * MAP_RES];
  }
  return [x, y];
}

/**
 * The walking route from (ax, ay) to (bx, by): A* over the map raster's 2 m squares (8 ways), then
 * straightened into its corners. Returns the corners as x, y pairs (empty when there is no way).
 */
export function route(city: City, ax: number, ay: number, bx: number, by: number): number[] {
  const m = mapRaster(city), W = m.w, N = W * m.h;
  [ax, ay] = walkable(city, ax, ay);
  const s = Math.floor(ay / MAP_RES) * W + Math.floor(ax / MAP_RES), e = Math.floor(by / MAP_RES) * W + Math.floor(bx / MAP_RES);
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const ei = e % W, ej = (e / W) | 0;
  const h = (q: number) => { const dx = Math.abs((q % W) - ei), dy = Math.abs(((q / W) | 0) - ej); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  // a binary heap of (f, square)
  const hf: number[] = [], hq: number[] = [];
  const push = (f: number, q: number) => {
    let i = hf.length; hf.push(f); hq.push(q);
    while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; hf[i] = hf[p]; hq[i] = hq[p]; i = p; }
    hf[i] = f; hq[i] = q;
  };
  const pop = (): number => {
    const top = hq[0], lf = hf.pop()!, lq = hq.pop()!;
    if (hf.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= hf.length) break;
        if (c + 1 < hf.length && hf[c + 1] < hf[c]) c++;
        if (hf[c] >= lf) break;
        hf[i] = hf[c]; hq[i] = hq[c]; i = c;
      }
      hf[i] = lf; hq[i] = lq;
    }
    return top;
  };
  g[s] = 0; push(h(s), s);
  const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];
  while (hf.length) {
    const q = pop();
    if (done[q]) continue;
    done[q] = 1;
    if (q === e) break;
    const i = q % W, j = (q / W) | 0;
    for (let d = 0; d < 8; d++) {
      const ni = i + DI[d], nj = j + DJ[d];
      if (ni < 0 || nj < 0 || ni >= W || nj >= m.h) continue;
      const n = nj * W + ni, c = cost(m, n);
      if (!c || done[n]) continue;
      // no cutting a building's corner
      if (d >= 4 && (!cost(m, j * W + ni) || !cost(m, nj * W + i))) continue;
      const ng = g[q] + c * (d >= 4 ? 1.414 : 1);
      if (ng < g[n]) { g[n] = ng; from[n] = q; push(ng + h(n), n); }
    }
  }
  if (!done[e]) return [];
  const pts: number[] = [];
  for (let q = e; q >= 0; q = from[q]) pts.push(((q % W) + 0.5) * MAP_RES, (((q / W) | 0) + 0.5) * MAP_RES);
  const path: number[] = [];
  for (let k = pts.length - 2; k >= 0; k -= 2) path.push(pts[k], pts[k + 1]);
  path[path.length - 2] = bx; path[path.length - 1] = by;
  return simplify(path, 2.5);
}

/** Douglas-Peucker: the corners of a polyline, dropping points within `tol` metres of the straight line. */
function simplify(p: number[], tol: number): number[] {
  const n = p.length / 2;
  if (n < 3) return p;
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = p[2 * a], ay = p[2 * a + 1], dx = p[2 * b] - ax, dy = p[2 * b + 1] - ay, L = Math.hypot(dx, dy) || 1;
    let worst = -1, wd = tol;
    for (let k = a + 1; k < b; k++) { const d = Math.abs((p[2 * k] - ax) * dy - (p[2 * k + 1] - ay) * dx) / L; if (d > wd) { wd = d; worst = k; } }
    if (worst >= 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  const out: number[] = [];
  for (let k = 0; k < n; k++) if (keep[k]) out.push(p[2 * k], p[2 * k + 1]);
  return out;
}

/** Where a point falls on a route: the leg it is nearest, the nearest point on it, how far off, and the metres left from there. */
export function onRoute(R: number[], x: number, y: number): { leg: number; px: number; py: number; off: number; left: number } {
  let best = { leg: 0, px: R[0], py: R[1], off: Infinity, left: 0 };
  for (let k = 0; k + 3 < R.length; k += 2) {
    const ax = R[k], ay = R[k + 1], dx = R[k + 2] - ax, dy = R[k + 3] - ay, L2 = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2)), px = ax + u * dx, py = ay + u * dy, off = Math.hypot(x - px, y - py);
    if (off < best.off) best = { leg: k / 2, px, py, off, left: 0 };
  }
  let left = Math.hypot(R[2 * best.leg + 2] - best.px, R[2 * best.leg + 3] - best.py);
  for (let k = 2 * best.leg + 2; k + 3 < R.length; k += 2) left += Math.hypot(R[k + 2] - R[k], R[k + 3] - R[k + 1]);
  best.left = left;
  return best;
}

/**
 * The next turn after leg `leg` (worth calling a turn: more than ~30 degrees): how far to it from
 * (px, py), left or right, and the road the route turns onto. Null when the rest is straight.
 */
export function nextTurn(city: City, R: number[], leg: number, px: number, py: number): { dist: number; right: boolean; road: string } | null {
  let dist = 0, x = px, y = py;
  for (let k = leg; 2 * k + 5 < R.length; k++) {
    const ax = R[2 * k], ay = R[2 * k + 1], bx = R[2 * k + 2], by = R[2 * k + 3], cx = R[2 * k + 4], cy = R[2 * k + 5];
    dist += Math.hypot(bx - x, by - y); x = bx; y = by;
    const ux = bx - ax, uy = by - ay, vx = cx - bx, vy = cy - by, lu = Math.hypot(ux, uy) || 1, lv = Math.hypot(vx, vy) || 1;
    const cross = (ux * vy - uy * vx) / (lu * lv), dot = (ux * vx + uy * vy) / (lu * lv);
    if (dot > 0.87 || lv < 6) continue;
    // the leg after the turn runs along an avenue (north-south) or a street (east-west)
    const mx = (bx + cx) / 2, my = (by + cy) / 2, ns = Math.abs(vy) > Math.abs(vx);
    const road = ns ? roadName(city, true, nearestRoad(city.xb, city.xCell, mx)) : roadName(city, false, nearestRoad(city.yb, city.yCell, my));
    return { dist, right: cross > 0, road };
  }
  return null;
}
