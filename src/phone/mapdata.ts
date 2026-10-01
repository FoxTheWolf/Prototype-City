import { blockAt, diagS, SIDEWALK, type City } from '../sim/city';

/**
 * The phone's map database: the city rasterized once into 2 m squares (what lies there, and how
 * tall the building is), so the map app only reads arrays. Built on first use (the phone's boot
 * hides it) and kept for the city.
 */
export const MAP_RES = 2;
export const Ground = { Out: 0, Road: 1, Walk: 2, Lot: 3, Building: 4, Park: 5, Plaza: 6, Yard: 7 } as const;

export interface MapRaster {
  w: number;
  h: number;
  kind: Uint8Array;
  /** Building height in metres / 2, capped at 255. */
  height: Uint8Array;
}

let cached: { city: City; m: MapRaster } | null = null;

export function mapRaster(city: City): MapRaster {
  if (cached?.city === city) return cached.m;
  const w = Math.ceil(city.w / MAP_RES), h = Math.ceil(city.h / MAP_RES);
  const kind = new Uint8Array(w * h), height = new Uint8Array(w * h), D = city.diagonal;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = (i + 0.5) * MAP_RES, y = (j + 0.5) * MAP_RES, B = blockAt(city, x, y), s = diagS(D, x, y);
    let k: number = Ground.Road;
    if (B) {
      if (Math.min(x - B.x0, B.x1 - x, y - B.y0, B.y1 - y) < SIDEWALK) k = Ground.Walk;
      else if (B.open) k = B.open === 'park' ? Ground.Park : B.open === 'plaza' ? Ground.Plaza : Ground.Yard;
      // slivers the diagonal leaves too small to build on are plazas
      else if ((B.diag & 2 && s < 0) || (B.diag & 4 && s > 0)) k = Ground.Plaza;
      else k = Ground.Lot;
    }
    if (Math.abs(s) < D.w / 2) k = Ground.Road;
    else if (Math.abs(s) < D.w / 2 + SIDEWALK && k !== Ground.Road) k = Ground.Walk;
    kind[j * w + i] = k;
  }
  for (const B of city.buildings) {
    const i0 = Math.max(0, Math.floor(B.x0 / MAP_RES)), i1 = Math.min(w - 1, Math.floor(B.x1 / MAP_RES));
    const j0 = Math.max(0, Math.floor(B.y0 / MAP_RES)), j1 = Math.min(h - 1, Math.floor(B.y1 / MAP_RES));
    const mx = (B.x0 + B.x1) / 2, my = (B.y0 + B.y1) / 2, rx = (B.x1 - B.x0) / 2, ry = (B.y1 - B.y0) / 2, hh = Math.min(255, B.h / 2);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = (i + 0.5) * MAP_RES, y = (j + 0.5) * MAP_RES;
      if (x < B.x0 || x > B.x1 || y < B.y0 || y > B.y1) continue;
      if (B.round && ((x - mx) / rx) ** 2 + ((y - my) / ry) ** 2 > 1) continue;
      if (B.cut && B.cut.nx * x + B.cut.ny * y > B.cut.c) continue;
      const q = j * w + i;
      kind[q] = Ground.Building;
      if (hh > height[q]) height[q] = hh;
    }
  }
  const m = { w, h, kind, height };
  cached = { city, m };
  return m;
}

/** What lies at a world point (Out beyond the city). */
export function groundAt(m: MapRaster, x: number, y: number): number {
  const i = Math.floor(x / MAP_RES), j = Math.floor(y / MAP_RES);
  return i < 0 || j < 0 || i >= m.w || j >= m.h ? Ground.Out : m.kind[j * m.w + i];
}
