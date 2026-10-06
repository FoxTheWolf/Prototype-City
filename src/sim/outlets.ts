/**
 * Wall outlets (13.9c): the plugs a customer may use in cafés, bars, cybercafés, laundries, motels...
 * (furniture of kind 'outlet', placed by interior.ts). The phone is plugged in by hand (F) and charges
 * while the player stays within the cable's reach; the notebook charges when the place it is opened
 * at is within reach of one. Off with the building's power, unless a generator backs it up.
 */
import { planOf, type Furn } from './interior';
import { Backup } from './power';
import { type World } from './world';

/** How far a charger's cable reaches from the wall, m. */
export const CABLE = 2.5;
/** How near an outlet must be to be plugged into by hand, m. */
const HAND = 1.4;

/** The outlets on the player's floor (none outside). */
export function outletsHere(w: World): Furn[] {
  const p = w.player;
  if (p.inside < 0) return [];
  return planOf(w.city, p.inside, p.floor)?.furn.filter((f) => f.kind === 'outlet') ?? [];
}

/** The nearest outlet within r of (x, y) on the player's floor, or null. */
export function outletNear(w: World, x: number, y: number, r = CABLE): Furn | null {
  let best: Furn | null = null, bd = r;
  for (const f of outletsHere(w)) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd) { bd = d; best = f; } }
  return best;
}

/** The outlet the player faces, within a hand's reach, or null. */
export function outletAhead(w: World, yaw: number): Furn | null {
  const p = w.player, c = Math.cos(yaw), s = Math.sin(yaw);
  let best: Furn | null = null, bd = HAND;
  for (const f of outletsHere(w)) {
    const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy);
    if (d < bd && (dx * c + dy * s) / Math.max(d, 1e-6) > 0.6) { bd = d; best = f; }
  }
  return best;
}

/** Whether the outlets of the building the player is in have power. */
export function outletPower(w: World): boolean {
  const p = w.player, G = w.power;
  return p.inside >= 0 && (G.subs[G.building[p.inside]].on || G.backup[p.inside] >= Backup.Generator);
}
