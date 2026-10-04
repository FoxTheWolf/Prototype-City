import { hash3 } from '../core/rng';
import { diagS, SIDEWALK, type City } from './city';
import { PLACES } from './placeTypes';

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
  /** Its model (CAMS) and how this unit's picture strays from the model's (age, dirt on the lens), 0..1. */
  model: number;
  wear: number;
}

/**
 * The camera models sold in the city, from its three makers of security gear: what the picture is
 * (sensor lines, color or black and white, frames a second the recorder keeps) and what the unit
 * looks like (a box camera, a dome, a bullet). `bias`: the model's own take on color and light,
 * kept within reach of a picture one can see: a tint (r, g, b gains), how much color it keeps, its
 * gain and its curve (gamma), and how grainy it gets in the dark.
 */
export interface CamModel {
  maker: number; code: string; shape: 'box' | 'dome' | 'bullet'; color: boolean;
  /** The resolution's name and size, and the world's rows its picture is drawn at (main.ts). */
  res: string; px: string; rows: number;
  fps: number;
  bias: { tint: [number, number, number]; sat: number; gain: number; gamma: number; grain: number };
}
export const CAMS: CamModel[] = [
  { maker: 0, code: 'VC-220', shape: 'box', color: false, res: 'CIF', px: '352x240', rows: 120, fps: 10, bias: { tint: [0.86, 1, 0.88], sat: 0, gain: 1, gamma: 1.1, grain: 1 } },
  { maker: 0, code: 'VC-480D', shape: 'dome', color: true, res: '4CIF', px: '704x480', rows: 160, fps: 15, bias: { tint: [1.05, 1, 0.9], sat: 0.6, gain: 1.05, gamma: 1, grain: 0.7 } },
  { maker: 1, code: 'S-12 NIGHTEYE', shape: 'bullet', color: false, res: '2CIF', px: '704x240', rows: 120, fps: 15, bias: { tint: [0.92, 0.95, 1.06], sat: 0, gain: 1.2, gamma: 0.9, grain: 1.3 } },
  { maker: 1, code: 'S-30 COLORPRO', shape: 'box', color: true, res: 'D1', px: '720x480', rows: 160, fps: 30, bias: { tint: [0.95, 1.02, 1.08], sat: 0.85, gain: 1, gamma: 1.05, grain: 0.5 } },
  { maker: 2, code: 'TX-5', shape: 'dome', color: false, res: 'QCIF', px: '176x120', rows: 100, fps: 10, bias: { tint: [1, 1, 1], sat: 0, gain: 0.95, gamma: 1.15, grain: 1.2 } },
  { maker: 2, code: 'TX-9C', shape: 'bullet', color: true, res: 'CIF', px: '352x240', rows: 120, fps: 12.5, bias: { tint: [1.1, 0.96, 1.05], sat: 0.5, gain: 1.12, gamma: 0.95, grain: 1 } },
];
/** The models a traffic camera (the city's, newer, bought in bulk) or a shop's may be. */
const TRAFFIC_CAMS = [1, 2, 3, 3, 5], SHOP_CAMS = [0, 0, 1, 2, 4, 4, 5];

const TRAFFIC: Record<string, number> = { financial: 0.85, theater: 1, commercial: 0.7, historic: 0.5, residential: 0.25, industrial: 0.3 };
const SHOP: Record<string, number | undefined> = Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, p.cctv]));

export function buildCctv(seed: number, city: City): Cctv[] {
  const list: Cctv[] = [];
  const D = city.diagonal;
  city.blocks.forEach((b, k) => {
    // the crossing at the block's north-west corner
    if (b.diag || b.square || b.x0 < 30 || b.y0 < 30) return;
    if (hash3(seed ^ 0xcc7, k, 1) >= (TRAFFIC[city.districts[b.district].type] ?? 0.05)) return;
    const mx = b.x0 + SIDEWALK - 0.5, my = b.y0 + SIDEWALK - 0.5;
    if (Math.abs(diagS(D, mx, my)) < D.w / 2 + 12) return;
    const a = -0.75 * Math.PI, arm = 1.6, model = TRAFFIC_CAMS[Math.floor(hash3(seed, k, 5) * TRAFFIC_CAMS.length)];
    const [sweep, period] = pan(seed, k, CAMS[model].fps, 0.55 + 0.25 * hash3(seed, k, 2), 18 + 20 * hash3(seed, k, 3));
    list.push({ kind: 0, x: mx + Math.cos(a) * arm, y: my + Math.sin(a) * arm, z: 6.1, mx, my, yaw: a, sweep, period, phase: hash3(seed, k, 4), pitch: -0.32, biz: -1, building: -1, model, wear: hash3(seed, k, 6) });
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
    const out = 0.35, ax = f < 2 ? 0 : dir, ay = f < 2 ? dir : 0, model = SHOP_CAMS[Math.floor(hash3(seed, n, 6) * SHOP_CAMS.length)];
    const [sweep, period] = pan(seed, 10000 + n, CAMS[model].fps, 0.3 + 0.15 * hash3(seed, n, 3), 12 + 12 * hash3(seed, n, 4));
    list.push({
      kind: 1, x: wx + nx * out, y: wy + ny * out, z: 4.1, mx: wx, my: wy, yaw: Math.atan2(ny * 0.8 + ay * 0.6, nx * 0.8 + ax * 0.6),
      sweep, period, phase: hash3(seed, n, 5), pitch: -0.4, biz: n, building: biz.building, model, wear: hash3(seed, n, 7),
    });
  });
  return list;
}

/**
 * How a camera pans: about a third stay still, watching one spot; the others sweep, slower the
 * fewer frames their recorder keeps (a fast pan at 10 frames a second only jumps).
 */
function pan(seed: number, k: number, fps: number, sweep: number, period: number): [number, number] {
  return hash3(seed ^ 0x9a7, k, 1) < 0.33 ? [0, 1] : [sweep, period * (1 + (30 - fps) / 20)];
}

/** A camera's heading at a moment (seconds of real time). */
export const cctvYaw = (c: Cctv, sec: number) => c.yaw + c.sweep * Math.sin(2 * Math.PI * (sec / c.period + c.phase));
