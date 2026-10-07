import { hex, Paint, type C3 } from '../render/paint2d';

/**
 * 15.17h: Lookwise's owl in pixels, by the manual (docs/identidade/ferret-manual.html, part 12): the
 * head (two ink-ringed amber eyes, the tufts, the facial disc, the small beak) in its moods, and the
 * name with the two "o" as the owl's eyes. Amber only in the eyes.
 */
export const OW = { ink: hex('#16244a'), feath: hex('#5e6f8e'), feath2: hex('#3f4d6a'), disc: hex('#d6dde8'), disc2: hex('#aab6c9'), amber: hex('#f4a91c'), amber2: hex('#b8720c'), pupil: hex('#0b0e16'), beak: hex('#e08a1a') };
/** What the owl is doing: still (its eyes on the text being typed), searching, found (eyes wide), nothing ("Hoo?"), flying (at night). */
export type Mood = 'idle' | 'search' | 'found' | 'hoo' | 'fly';
export interface OwlLook { tilt?: number; look?: [number, number]; wide?: boolean; squint?: boolean; wings?: number }

/** A quadratic curve from a to b by c, as n points (after the first). */
function quad(out: number[], ax: number, ay: number, cx: number, cy: number, bx: number, by: number, n = 8) {
  for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; out.push(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by); }
}

/** The owl's head, `size` pixels tall, its box's top-left at (x, y); drawn on the manual's 200-unit grid. */
export function paintOwl(P: Paint, x: number, y: number, size: number, o: OwlLook = {}) {
  const s = size / 200, a = ((o.tilt ?? 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), [lx, ly] = o.look ?? [0, 0];
  const tx = (u: number, v: number) => x + (100 + (u - 100) * ca - (v - 112) * sa) * s, ty = (u: number, v: number) => y + (112 + (u - 100) * sa + (v - 112) * ca) * s;
  const poly = (pts: number[], c: C3) => { const q: number[] = []; for (let i = 0; i < pts.length; i += 2) q.push(tx(pts[i], pts[i + 1]), ty(pts[i], pts[i + 1])); P.poly(q, c); };
  const disc = (u: number, v: number, r: number, c: C3, ry = r) => P.disc(tx(u, v), ty(u, v), r * s, c, 1, ry * s);
  if (o.wings !== undefined) {
    const f = o.wings;
    for (const sg of [-1, 1]) {
      const m = (u: number) => 100 + sg * (u - 100), w = [m(30), 120];
      quad(w, m(30), 120, m(-10), 100 - f * 30, m(-40), 120 - f * 50);
      quad(w, m(-40), 120 - f * 50, m(-6), 140 - f * 10, m(34), 150);
      poly(w, OW.feath2);
    }
  }
  poly([50, 74, 34, 18, 88, 54], OW.feath2); poly([150, 74, 166, 18, 112, 54], OW.feath2);
  disc(100, 114, 84, OW.feath, 78);
  const brow = [40, 86];
  quad(brow, 40, 86, 70, 54, 100, 84); quad(brow, 100, 84, 130, 54, 160, 86); brow.push(160, 98);
  quad(brow, 160, 98, 130, 72, 100, 100); quad(brow, 100, 100, 70, 72, 40, 98);
  poly(brow, OW.feath2);
  for (const ex of [68, 132]) { disc(ex, 110, 38, OW.disc); if (size > 40) P.ring(tx(ex, 110), ty(ex, 110), 32 * s, Math.max(1, 2 * s), OW.disc2); }
  [68, 132].forEach((ex, i) => {
    const shut = o.squint && i === 1, R = o.wide ? 24 : 22;
    disc(ex, 110, R + 4, OW.ink);
    disc(ex, 110, R - 4, shut ? OW.feath2 : OW.amber);
    if (shut) { P.line(tx(ex - 14, 110), ty(ex - 14, 110), tx(ex, 117), ty(ex, 117), Math.max(1, 4 * s), OW.disc); P.line(tx(ex, 117), ty(ex, 117), tx(ex + 14, 110), ty(ex + 14, 110), Math.max(1, 4 * s), OW.disc); }
    else { disc(ex + lx * 8, 110 + ly * 8, o.wide ? 13 : 10, OW.pupil); disc(ex + lx * 8 - 4, 106 + ly * 8, 3.2, [255, 255, 255]); }
  });
  poly([90, 128, 110, 128, 100, 150], OW.beak);
  if (size > 60) for (const [u, v] of [[82, 180], [100, 184], [118, 180]]) P.line(tx(u - 6, v - 2), ty(u - 6, v - 2), tx(u + 6, v - 2), ty(u + 6, v - 2), Math.max(1, 3 * s), OW.disc2);
}

/** How the owl looks in a mood, at `now` (seconds): its tilt, where it looks, its wings. */
export function owlLook(mood: Mood, now: number, look: [number, number] = [0, 0.2]): OwlLook {
  if (mood === 'search') { const sw = Math.sin(now * 4); return { tilt: sw * 14, look: [sw, 0] }; }
  if (mood === 'found') return { wide: true };
  if (mood === 'hoo') return { tilt: -18, squint: true, look: [0.4, -0.4] };
  if (mood === 'fly') return { wings: (Math.sin(now * 9) + 1) / 2 };
  return { look };
}

/**
 * The name in the bulb font, s pixels a bulb, with the two "o" as the owl's eyes (tufts over them, the
 * beak in the gap): its top-left at (x, y) (the tufts' tips), 10 s tall. Returns its width.
 */
export function paintLogo(P: Paint, x: number, y: number, s: number, o: { look?: [number, number]; wide?: boolean; ink?: C3 } = {}): number {
  const ink = o.ink ?? OW.ink, top = y + 3 * s, r = 3.6 * s, sw = Math.max(1, 1.1 * s), gap = 1.6 * s;
  P.text(x, top, 'L', s, ink);
  const e1 = x + 5 * s + gap + r, e2 = e1 + 2 * r + 0.3 * s, cy = top + 3.5 * s, [lx, ly] = o.look ?? [0, 0];
  for (const [ex, sg] of [[e1, -1], [e2, 1]] as const) {
    P.poly([ex + sg * r * 0.15, cy - r * 0.96, ex + sg * r * 1.05, cy - r * 1.75, ex + sg * r * 0.82, cy - r * 0.55], OW.feath2);
    P.disc(ex, cy, r, ink);
    P.disc(ex, cy, r - sw, OW.amber);
    const pr = r * (o.wide ? 0.5 : 0.38);
    P.disc(ex + lx * r * 0.3, cy + ly * r * 0.3, pr, OW.pupil);
    if (s >= 2) P.disc(ex + lx * r * 0.3 - r * 0.14, cy + ly * r * 0.3 - r * 0.14, Math.max(0.8, r * 0.1), [255, 255, 255]);
  }
  const mid = (e1 + e2) / 2;
  P.poly([mid - r * 0.28, cy + r * 0.6, mid + r * 0.28, cy + r * 0.6, mid, cy + r * 1.1], OW.beak);
  return P.text(e2 + r + gap, top, 'KWISE', s, ink) + (e2 + r + gap - x);
}
/** The logo's width at s pixels a bulb (without painting it). */
export const logoW = (s: number) => 5 * s + 1.6 * s * 2 + 4 * 3.6 * s + 0.3 * s + Paint.textW('KWISE', s);
