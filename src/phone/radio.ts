import { hash3 } from '../core/rng';
import { siteUp, useData } from '../sim/telco';
import { liftFloors, type World } from '../sim/world';
import { MAP_RES, mapRaster } from './mapdata';

/**
 * The phone's GSM/EDGE radio. While the phone is on it listens to the cell sites around (see
 * sim/telco.ts) and camps on the strongest, as a handset does:
 *  - the signal falls with distance (an urban path loss for 900 MHz), with every building standing
 *    in the line between the antennas and the phone, behind walls indoors and much more in a lift
 *    car (a metal box), and wanders a little from place to place (shadowing);
 *  - it finds and registers on the network a few seconds after power on or after losing it, and
 *    hands over to another site only when that one is clearly stronger;
 *  - a site in a blackout runs on batteries for a few hours of game time, then falls silent.
 * Data goes over EDGE, as fast as the signal allows (tens to a couple of hundred kbit/s), and comes
 * out of the line's prepaid bundle as it arrives.
 */
export type RadioState = 'off' | 'search' | 'service' | 'none';
/** dBm at or above which the phone shows 1, 2, 3, 4 bars; below the last one there is no service. */
const BARS = [-104, -95, -85, -75], FLOOR_DBM = -110;
/** EDGE throughput (kbit/s) at 0..4 bars. */
const RATE = [0, 30, 80, 150, 200];
/** Seconds to register on the network, and to set up a data session (GPRS attach, PDP context). */
const REGISTER = 3, ATTACH = 1.6;
/** The antennas' 58 dBm less the clutter at street level (cars, trees, signs, the bodies of passers-by). */
const EIRP_STREET = 40;

export interface Transfer {
  what: string;
  kb: number;
  done: number;
  /** When it was asked for: it connects for ATTACH seconds first. */
  at: number;
  state: 'connecting' | 'loading' | 'done' | 'nosignal' | 'nodata';
}

export class Radio {
  state: RadioState = 'off';
  /** The site it camps on (-1: none), what it hears from it, and in bars. */
  site = -1;
  dbm = -130;
  bars = 0;
  /** The sites heard at the last scan, strongest first: [site, dBm] (the field test screen lists them). */
  heard: [number, number][] = [];
  /** Throughput of the Wi-Fi joined (kbit/s), 0 when there is none: data then goes over it, free. */
  wifiKbps = 0;
  /** The data transfer under way or last finished, if any. */
  job: Transfer | null = null;
  private next = 0;
  private found = 0;

  update(world: World, on: boolean, now: number, dt: number) {
    if (!on) { this.state = 'off'; this.site = -1; this.bars = 0; this.job = null; return; }
    if (this.state === 'off') { this.state = 'search'; this.found = now + REGISTER; }
    if (now >= this.next) { this.next = now + 0.5; this.scan(world, now); }
    const J = this.job;
    if (J && (J.state === 'connecting' || J.state === 'loading')) {
      const wifi = this.wifiKbps > 0;
      if (!wifi && this.state !== 'service') J.state = 'nosignal';
      else if (now - J.at < (wifi ? 0.4 : ATTACH)) J.state = 'connecting';
      else {
        J.state = 'loading';
        const kb = Math.min(J.kb - J.done, ((wifi ? this.wifiKbps : RATE[this.bars]) / 8) * dt);
        if (!wifi && !useData(world.telco.player, kb)) J.state = 'nodata';
        else if ((J.done += kb) >= J.kb - 1e-6) J.state = 'done';
      }
    }
  }

  /** Start downloading `kb` kilobytes for `what`. */
  fetch(what: string, kb: number, now: number) {
    this.job = { what, kb, done: 0, at: now, state: 'connecting' };
  }

  /** Listen to every site on the air and pick the one to camp on. */
  private scan(world: World, now: number) {
    const T = world.telco, p = world.player, lift = liftFloors(world) > 0;
    let best = -1, bestDbm = -999, cur = -999;
    this.heard.length = 0;
    for (let k = 0; k < T.sites.length; k++) {
      if (!siteUp(T, world.power, k, world.tick)) continue;
      const d = this.rssi(world, k, p.x, p.y, p.z + 1.4, lift, now);
      if (k === this.site) cur = d;
      if (d > FLOOR_DBM - 6) this.heard.push([k, Math.round(d)]);
      if (d > bestDbm) { bestDbm = d; best = k; }
    }
    // hand over only to a clearly stronger site
    this.heard.sort((a, b) => b[1] - a[1]);
    if (this.site >= 0 && cur > FLOOR_DBM && bestDbm < cur + 4) { best = this.site; bestDbm = cur; }
    if (best < 0 || bestDbm < FLOOR_DBM) {
      // lost: look again for a while before giving up
      if (this.state === 'service') { this.state = 'search'; this.found = now + REGISTER; }
      else if (this.state === 'search' && now > this.found + 6) this.state = 'none';
      this.site = -1; this.dbm = bestDbm; this.bars = 0;
      return;
    }
    if (this.state !== 'service') {
      if (this.state === 'none') { this.state = 'search'; this.found = now + REGISTER; }
      if (now < this.found) return;
      this.state = 'service';
    }
    this.site = best; this.dbm = Math.round(bestDbm);
    this.bars = BARS.reduce((n, b) => (bestDbm >= b ? n + 1 : n), 0);
  }

  /** What the phone at (x, y), `eye` metres up, hears from site k, in dBm. */
  private rssi(world: World, k: number, x: number, y: number, eye: number, lift: boolean, now: number): number {
    const S = world.telco.sites[k], m = mapRaster(world.city), p = world.player;
    const dx = S.x - x, dy = S.y - y, d = Math.hypot(dx, dy);
    // 58 dBm out of the antennas, an urban path loss at 900 MHz (COST-231 Hata, flat), and the
    // clutter of a street down among the buildings (EIRP_STREET)
    let dbm = EIRP_STREET - (128.1 + 37.6 * Math.log10(Math.hypot(Math.max(30, d), S.h - eye) / 1000));
    // every building standing in the way of the line to the antennas
    const own = p.inside >= 0 ? world.city.buildings[p.inside] : null;
    let blocked = 0, inRun = false;
    for (let t = 6; t < d - 20; t += 6) {
      const px = x + (dx * t) / d, py = y + (dy * t) / d;
      if (own && px > own.x0 && px < own.x1 && py > own.y0 && py < own.y1) continue;
      const i = Math.floor(px / MAP_RES), j = Math.floor(py / MAP_RES);
      if (i < 0 || j < 0 || i >= m.w || j >= m.h) continue;
      const hit = m.height[j * m.w + i] * 2 > eye + ((S.h - eye) * t) / d;
      if (hit && !inRun) blocked++;
      inRun = hit;
    }
    dbm -= Math.min(40, blocked * 10);
    // indoors: the outer walls; in a lift car, its steel box and the shaft
    if (own) dbm -= 14;
    if (lift) dbm -= 22;
    // shadowing over a 5 m grid, and a little fading over time
    dbm += (hash3(world.seed ^ k, Math.floor(x / 5), Math.floor(y / 5)) - 0.5) * 6 + (hash3(k, Math.floor(now * 2), 3) - 0.5) * 3;
    return dbm;
  }
}
