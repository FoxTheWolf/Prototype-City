import { furnitureModel, goodColor } from './render/models';
import { Mat, Shape } from './render/objects';
import { addToBag, priceAt } from './sim/bag';
import { type Furn, planOf } from './sim/interior';
import { PLACES } from './sim/placeTypes';
import { type World } from './sim/world';

/** How far the hand reaches for a shelf, m. */
const REACH = 2.2;

export interface Aimed { f: Furn; good: string; cents: number; k: number }

/**
 * The good under the sight (13.4): the ray from the eye through the middle of the view against the
 * pieces of the shop around the player that hold stock, each tested part by part as it is drawn
 * (furnitureModel); the nearest part hit, if it is one of the goods (its packaging color is the
 * good's), says which. Null when the sight is not on a good of the shop the player is in.
 */
export function aimedGood(w: World, yaw: number, pitch: number, eye: number): Aimed | null {
  const p = w.player;
  if (p.inside < 0 || p.floor !== 0) return null;
  const k = w.city.buildings[p.inside].biz, P = planOf(w.city, p.inside, 0);
  if (k < 0 || !P) return null;
  const dx = Math.cos(yaw) * Math.cos(pitch), dy = Math.sin(yaw) * Math.cos(pitch), dz = Math.sin(pitch);
  let best: Aimed | null = null, bt = REACH;
  for (const f of P.furn) {
    if (!f.stock?.length || Math.hypot(f.x - p.x, f.y - p.y) > REACH + Math.max(f.hx, f.hy)) continue;
    // the ray in the piece's frame: +x its front, +y its right
    const ox = (p.x - f.x) * f.c + (p.y - f.y) * f.s, oy = -(p.x - f.x) * f.s + (p.y - f.y) * f.c;
    const rx = dx * f.c + dy * f.s, ry = -dx * f.s + dy * f.c;
    const cols = f.stock.map(goodColor);
    for (const q of furnitureModel(f.kind, f.seed, f.hx, f.hy, f.stock)) {
      if (q.mat === Mat.Glass) continue; // glass: seen through
      const t = slab(ox, oy, eye, rx, ry, dz, q.x0, q.y0, q.z0, q.x1, q.y1, q.z1);
      if (t < 0 || t >= bt) continue;
      bt = t;
      const n = q.shape !== Shape.Ball ? cols.findIndex((c) => c[0] === q.col[0] && c[1] === q.col[1] && c[2] === q.col[2]) : -1;
      best = n >= 0 ? { f, good: f.stock[n], cents: priceAt(k, w, f.stock[n]), k } : null;
    }
  }
  return best;
}

/** Where a ray from (ox, oy, oz) along (rx, ry, rz) enters a box, or -1. */
function slab(ox: number, oy: number, oz: number, rx: number, ry: number, rz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number {
  let t0 = 0, t1 = Infinity;
  for (const [o, r, a, b] of [[ox, rx, x0, x1], [oy, ry, y0, y1], [oz, rz, z0, z1]]) {
    if (Math.abs(r) < 1e-9) { if (o < a || o > b) return -1; continue; }
    let ta = (a - o) / r, tb = (b - o) / r;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return -1;
  }
  return t0;
}

/** Take the aimed good off the shelf into the bag, unpaid: 'ok', 'ask' (made to order at the counter) or 'room'. */
export function takeGood(w: World, a: Aimed): 'ok' | 'ask' | 'room' {
  if (PLACES[w.city.businesses[a.k].kind].order) return 'ask';
  return addToBag(w.bag, a.good, a.cents, a.k, false) ? 'ok' : 'room';
}
