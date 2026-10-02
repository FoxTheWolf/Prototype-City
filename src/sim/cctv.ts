import { hash3 } from '../core/rng';
import { diagS, SIDEWALK, type City } from './city';

/**
 * The security cameras of the city, fixed from the seed. Two kinds for now:
 * - traffic cameras, the city's, on poles of their own at the inner corner of a block's sidewalk,
 *   an arm reaching toward the crossing, watching it;
 * - shop cameras, on the street front of a shop (banks always, pawnshops, pharmacies and the like
 *   often), over the sign, watching the sidewalk.
 * Each pans slowly to and fro (real time, as the traffic lights run). Their pictures are the same
 * renderWorld seen from the lens (main.ts, render/cctv.ts); breaking into them belongs to the
 * hacking track. Cameras inside the shops are to come with the shops' interiors.
 */
export interface Cctv {
  /** 0 traffic, 1 shop. */
  kind: number;
  /** The lens. */
  x: number; y: number; z: number;
  /** Where it is fixed: the pole's foot (traffic) or the point of the wall (shop). */
  mx: number; my: number;
  /** The middle of its pan, how far it pans each way, a sweep's length (s) and where in it it starts. */
  yaw: number; sweep: number; period: number; phase: number;
  /** How far it looks down. */
  pitch: number;
  /** The shop's business (shop cameras), else -1; its building, else -1. */
  biz: number;
  building: number;
}

const TRAFFIC: Record<string, number> = { financial: 0.85, theater: 1, commercial: 0.7, historic: 0.5, residential: 0.25, industrial: 0.3 };
const SHOP: Record<string, number> = { bank: 0.9, pawn: 0.5, liquor: 0.4, pharmacy: 0.3, electronics: 0.35, hotel: 0.3, grocery: 0.15, parking: 0.3, cinema: 0.15 };

export function buildCctv(seed: number, city: City): Cctv[] {
  const list: Cctv[] = [];
  const D = city.diagonal;
  city.blocks.forEach((b, k) => {
    // the crossing at the block's north-west corner
    if (b.diag || b.square || b.x0 < 30 || b.y0 < 30) return;
    if (hash3(seed ^ 0xcc7, k, 1) >= (TRAFFIC[city.districts[b.district].type] ?? 0.05)) return;
    const mx = b.x0 + SIDEWALK - 0.5, my = b.y0 + SIDEWALK - 0.5;
    if (Math.abs(diagS(D, mx, my)) < D.w / 2 + 12) return;
    const a = -0.75 * Math.PI, arm = 1.6;
    list.push({ kind: 0, x: mx + Math.cos(a) * arm, y: my + Math.sin(a) * arm, z: 6.1, mx, my, yaw: a, sweep: 0.55 + 0.25 * hash3(seed, k, 2), period: 18 + 20 * hash3(seed, k, 3), phase: hash3(seed, k, 4), pitch: -0.32, biz: -1, building: -1 });
  });
  city.businesses.forEach((biz, n) => {
    if (hash3(seed ^ 0x5ca, n, 1) >= (SHOP[biz.kind] ?? 0)) return;
    const B = city.buildings[biz.building], blk = city.blocks.find((q) => biz.building >= q.b0 && biz.building < q.b1);
    if (!blk || B.round || B.cut) return;
    // the face on the street: the one nearest its block's edge
    const gaps = [B.x0 - blk.x0, blk.x1 - B.x1, B.y0 - blk.y0, blk.y1 - B.y1], f = gaps.indexOf(Math.min(...gaps));
    if (gaps[f] > SIDEWALK + 0.5) return;
    const nx = f === 0 ? -1 : f === 1 ? 1 : 0, ny = f === 2 ? -1 : f === 3 ? 1 : 0;
    // at one end of the face, looking out and along it toward the other
    const lo = f < 2 ? B.y0 : B.x0, hi = f < 2 ? B.y1 : B.x1, end = hash3(seed, n, 2) < 0.5 ? 0 : 1;
    if (hi - lo < 4) return;
    const at = end ? hi - 0.7 : lo + 0.7, dir = end ? -1 : 1, wx = f === 0 ? B.x0 : f === 1 ? B.x1 : at, wy = f < 2 ? at : f === 2 ? B.y0 : B.y1;
    const out = 0.35, ax = f < 2 ? 0 : dir, ay = f < 2 ? dir : 0;
    list.push({
      kind: 1, x: wx + nx * out, y: wy + ny * out, z: 4.1, mx: wx, my: wy, yaw: Math.atan2(ny * 0.8 + ay * 0.6, nx * 0.8 + ax * 0.6),
      sweep: 0.3 + 0.15 * hash3(seed, n, 3), period: 12 + 12 * hash3(seed, n, 4), phase: hash3(seed, n, 5), pitch: -0.4, biz: n, building: biz.building,
    });
  });
  return list;
}

/** A camera's heading at a moment (seconds of real time). */
export const cctvYaw = (c: Cctv, sec: number) => c.yaw + c.sweep * Math.sin(2 * Math.PI * (sec / c.period + c.phase));
