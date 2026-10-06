/**
 * Sitting (13.10f): F at a chair, a stool, a sofa or a bench sits the player down on it, facing the way
 * it faces; the eye goes down to a seated height. Walking (or F with nothing else in front) stands them
 * up where they were. The notebook opened while seated is used from the same seat (laptop.ts).
 */
import { blockAt } from './city';
import { planOf, type Furn } from './interior';
import { type World } from './world';

export type SitKind = 'chair' | 'stool' | 'sofa' | 'bench';
export interface Sit {
  kind: SitKind;
  /** Where the player sits, the way they face, and the eye's height over the feet there. */
  x: number;
  y: number;
  yaw: number;
  eye: number;
  /** Where they stood before, to stand up to. */
  fromX: number;
  fromY: number;
}

/** How far in front a seat can be reached, m. */
const REACH = 1.5;
const EYE: Record<SitKind, number> = { chair: 1.2, stool: 1.4, sofa: 1.1, bench: 1.15 };

/** The seat in front of the player within reach, as the place they would sit, or null. */
export function seatAhead(w: World, yaw: number): Sit | null {
  const p = w.player, c = Math.cos(yaw), s = Math.sin(yaw);
  let best: Sit | null = null, bd = REACH;
  const consider = (kind: SitKind, x: number, y: number, a: number) => {
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d < bd && (d < 0.4 || (dx * c + dy * s) / d > 0.5)) { bd = d; best = { kind, x, y, yaw: a, eye: EYE[kind], fromX: p.x, fromY: p.y }; }
  };
  if (p.liftTo >= 0) return null;
  if (p.inside >= 0) {
    for (const f of planOf(w.city, p.inside, p.floor)?.furn ?? []) {
      const kind: SitKind | null = f.kind === 'chair' ? 'chair' : f.kind === 'stool' ? 'stool' : f.kind === 'sofa' ? 'sofa' : null;
      if (!kind) continue;
      const [x, y] = kind === 'sofa' ? alongSofa(f, p.x, p.y) : [f.x, f.y];
      consider(kind, x, y, Math.atan2(f.s, f.c));
    }
    return best;
  }
  if (p.z > 0.5) return null;
  const B = blockAt(w.city, p.x, p.y);
  for (const q of B?.props ?? []) {
    if (q.kind !== 'bench' && q.kind !== 'shelter') continue;
    // the seat in the prop's own frame: x forward (the way it faces), y along it (models.ts)
    const qc = Math.cos(q.a), qs = Math.sin(q.a), back = q.kind === 'shelter' ? -0.35 : 0.05, half = q.kind === 'shelter' ? 1.1 : 0.6;
    const ly = Math.max(-half, Math.min(half, -(p.x - q.x) * qs + (p.y - q.y) * qc));
    consider('bench', q.x + qc * back - qs * ly, q.y + qs * back + qc * ly, q.a);
  }
  return best;
}

/** On a sofa: the place along it nearest (x, y), a little in from its ends. */
function alongSofa(f: Furn, x: number, y: number): [number, number] {
  const half = Math.max(0, f.hy - 0.4), l = Math.max(-half, Math.min(half, -(x - f.x) * f.s + (y - f.y) * f.c));
  return [f.x - f.s * l + f.c * 0.05, f.y + f.c * l + f.s * 0.05];
}

export function sitDown(w: World, s: Sit) {
  const p = w.player;
  p.sit = s;
  p.x = p.px = s.x; p.y = p.py = s.y;
}

export function standUp(w: World) {
  const p = w.player, s = p.sit;
  if (!s) return;
  p.sit = null;
  p.x = p.px = s.fromX; p.y = p.py = s.fromY;
}
