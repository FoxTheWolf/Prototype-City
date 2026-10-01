import { hash3 } from '../core/rng';
import { type World } from '../sim/world';
import { Ground, MAP_RES, mapRaster } from './mapdata';

/**
 * The phone's GPS receiver, with a 2008 receiver's limits. It runs while the Maps app is open:
 *  - it must find the satellites first (cold start ~25 s the first time, warm ~8 s, hot ~2 s when
 *    it had a fix a moment ago), and needs 4 in view for a position;
 *  - a satellite counts only where the sky toward it is open: the buildings around block it
 *    (the sky profile is read from the map raster), so in a downtown canyon few are left, the
 *    position is off by tens of metres and jumps as the reflections change (multipath);
 *  - indoors only a faint signal gets through: slow updates, a large error, often lost;
 *  - with no fix the last known position stays, blinking, and there is no compass: the heading
 *    comes from movement.
 * Not part of the simulation (nothing in the city depends on it); deterministic from the seed and
 * the time anyway.
 */
const SATS = 11, AZ = 16;
/** Seconds to the first fix: never had one, had one minutes ago, a moment ago. */
const COLD = 25, WARM = 8, HOT = 2;

export type GpsState = 'off' | 'search' | 'fix' | 'lost';

export class Gps {
  state: GpsState = 'off';
  /** The position it reports (with its error), its estimated accuracy in metres, satellites in use. */
  x = 0;
  y = 0;
  acc = 0;
  sats = 0;
  /** Heading from movement (radians), or NaN standing still. */
  heading = NaN;
  /** Searching: seconds left to the first fix, out of how many. */
  wait = 0;
  waitOf = 0;
  /** Every satellite, for the service screen: azimuth and elevation (radians), signal (dB-Hz, 0 not heard), in use. */
  readonly satAz = new Float32Array(SATS);
  readonly satEl = new Float32Array(SATS);
  readonly satSnr = new Float32Array(SATS);
  readonly satUse = new Uint8Array(SATS);
  /** Whether it ever had a fix (x, y is then the last known position). */
  known = false;
  private lastFix = -1e9;
  private nextUpdate = 0;
  private nextSky = 0;
  private sky = new Float32Array(AZ);
  /** Of the satellites in use, those heard only bounced off the buildings. */
  private bounced = 0;
  /** Seconds with too few satellites since the last good second. */
  private short = 0;
  private ex = 0;
  private ey = 0;
  private hx = 0;
  private hy = 0;

  /** Called every frame; `on`: the Maps app is open on a phone that is on. */
  update(world: World, on: boolean, now: number, dt: number) {
    if (!on) { if (this.state !== 'off') this.state = 'off'; return; }
    const p = world.player, indoor = p.inside >= 0;
    if (this.state === 'off') {
      this.state = 'search';
      this.waitOf = this.wait = !this.known ? COLD : now - this.lastFix < 120 ? HOT : WARM;
    }
    if (now > this.nextSky) { this.nextSky = now + 0.5; this.profile(world, p.x, p.y, p.z + 1.2); }
    // satellites in view: above the buildings toward them, or through the roof only faintly
    const t = world.time / 3600;
    // a satellite just behind the skyline still gets through now and then, bounced off the buildings
    // (more error); indoors only the high ones, faintly
    let n = 0, bounced = 0;
    for (let s = 0; s < SATS; s++) {
      const az = hash3(world.seed, s, 1) * Math.PI * 2 + t * 0.26 * (hash3(world.seed, s, 2) - 0.5);
      const el = 0.15 + 1.2 * Math.abs(Math.sin(hash3(world.seed, s, 3) * 6.28 + t * 0.13));
      const sky = this.sky[Math.floor(((az / (Math.PI * 2)) % 1 + 1) % 1 * AZ)], flick = hash3(s, Math.floor(now / 2), 9);
      const before = n, q = hash3(world.seed, s, 4);
      let snr = 0;
      if (indoor) { if (el > 0.55 && flick < 0.5) { n++; snr = 20 + 8 * q; } }
      else if (el > sky) { n++; snr = 36 + 12 * q; }
      else if (el > sky - 0.35 && flick < 0.6) { n++; bounced++; snr = 24 + 8 * q; }
      this.satAz[s] = az; this.satEl[s] = el; this.satSnr[s] = snr; this.satUse[s] = n > before ? 1 : 0;
    }
    this.sats = n;
    this.bounced = bounced;
    if (this.state === 'search') {
      // the search counts down while satellites are in view: slower with few, not at all with less than 3
      this.wait -= dt * (n >= 4 ? Math.min(1, n / 6) : n === 3 ? 0.3 : 0);
      if (this.wait > 0 || n < 4) return;
      this.state = 'fix';
    }
    // the fix holds a few seconds with too few satellites before it is lost
    if (n < 4) { this.short += dt; if (this.short > 3) this.state = 'lost'; return; }
    this.short = 0;
    this.state = 'fix';
    // a new position once a second (every 3 s indoors), off by the error of the moment
    if (now < this.nextUpdate) return;
    this.nextUpdate = now + (indoor ? 3 : 1);
    const canyon = this.sky.reduce((a, b) => a + b, 0) / AZ;
    const sigma = indoor ? 12 : Math.min(60, 3 + 12 / Math.max(1, n - 3) + 18 * canyon + 5 * this.bounced);
    const k = Math.floor(now);
    // the error wanders (multipath), mostly carried over from the last second
    const gx = (hash3(world.seed, k, 11) + hash3(world.seed, k, 12) - 1) * 1.7, gy = (hash3(world.seed, k, 13) + hash3(world.seed, k, 14) - 1) * 1.7;
    this.ex = this.ex * 0.6 + gx * sigma * 0.4;
    this.ey = this.ey * 0.6 + gy * sigma * 0.4;
    const nx = p.x + this.ex, ny = p.y + this.ey;
    // heading from the track, when it moved more than the noise
    const mx = nx - this.hx, my = ny - this.hy;
    if (Math.hypot(mx, my) > Math.max(2.5, sigma * 0.6)) { this.heading = Math.atan2(my, mx); this.hx = nx; this.hy = ny; }
    else if (Math.hypot(p.x - (this.x - this.ex), p.y - (this.y - this.ey)) < 0.3) this.heading = NaN;
    this.x = nx; this.y = ny; this.acc = Math.round(sigma);
    this.known = true; this.lastFix = now;
  }

  /** The elevation (radians) of the skyline in each direction, from the map raster's building heights. */
  private profile(world: World, x: number, y: number, eye: number) {
    const m = mapRaster(world.city);
    for (let a = 0; a < AZ; a++) {
      const dx = Math.cos((a + 0.5) * (Math.PI * 2) / AZ), dy = Math.sin((a + 0.5) * (Math.PI * 2) / AZ);
      let best = 0.05;
      for (let d = 4; d < 160; d += 4) {
        const i = Math.floor((x + dx * d) / MAP_RES), j = Math.floor((y + dy * d) / MAP_RES);
        if (i < 0 || j < 0 || i >= m.w || j >= m.h) break;
        const q = j * m.w + i;
        if (m.kind[q] === Ground.Building) best = Math.max(best, Math.atan2(m.height[q] * 2 - eye, d));
      }
      this.sky[a] = best;
    }
  }
}
