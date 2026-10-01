import { hash3 } from '../core/rng';
import { FLOOR_H } from '../sim/city';
import { Sec } from '../sim/wifi';
import { type World } from '../sim/world';
import { MAP_RES, mapRaster } from './mapdata';

/**
 * The phone's Wi-Fi (802.11b/g). While it is on it scans the access points around (sim/wifi.ts)
 * every second: the signal falls with distance at 2.4 GHz, with every building in between, an outer
 * wall when the router and the phone are not in the same building, and every floor between them in
 * the same one; tens of metres outside, less through walls. Joining a network takes a moment
 * (associating, then getting an address); a locked one needs its key, typed on the keypad. Once up,
 * data goes over it, fast and free (phone/radio.ts), and it drops when the signal fades.
 */
export type WifiState = 'off' | 'idle' | 'assoc' | 'dhcp' | 'up' | 'badkey';
/** dBm at or above which 1..4 bars show; below the floor a network is out of reach. */
const BARS = [-85, -76, -67, -58], FLOOR_DBM = -88;
/** Seconds to associate and to get an address. */
const ASSOC = 1.2, DHCP = 1.4;

export class Wifi {
  on = true;
  state: WifiState = 'idle';
  /** The access point joined (or being joined), its signal now, in bars. */
  ap = -1;
  dbm = -100;
  bars = 0;
  ip = '';
  /** What the last scan found, strongest first: [access point, dBm]. */
  list: [number, number][] = [];
  private at = 0;
  private next = 0;
  private keyOk = true;

  update(world: World, phoneOn: boolean, now: number) {
    if (!phoneOn || !this.on) { this.state = this.on ? 'idle' : 'off'; this.ap = -1; this.list = []; return; }
    if (this.state === 'off') this.state = 'idle';
    if (now >= this.next) { this.next = now + 1; this.scan(world); }
    if (this.ap >= 0) {
      const heard = this.list.find(([i]) => i === this.ap);
      this.dbm = heard ? heard[1] : -120;
      this.bars = BARS.reduce((n, b) => (this.dbm >= b ? n + 1 : n), 0);
      if (!heard) { this.state = 'idle'; this.ap = -1; return; }
    }
    if (this.state === 'assoc' && now - this.at > ASSOC) { if (this.keyOk) { this.state = 'dhcp'; this.at = now; } else { this.state = 'badkey'; this.ap = -1; } }
    if (this.state === 'dhcp' && now - this.at > DHCP) {
      this.state = 'up';
      const A = world.wifi[this.ap];
      this.ip = `192.168.${A.ch}.${100 + Math.floor(hash3(world.seed, this.ap, 9) * 150)}`;
    }
  }

  /** Join access point i with a key (ignored for an open one). */
  connect(world: World, i: number, key: string, now: number) {
    const A = world.wifi[i];
    this.ap = i; this.state = 'assoc'; this.at = now; this.ip = '';
    this.keyOk = A.sec === Sec.Open || key === A.key;
  }

  disconnect() { this.ap = -1; this.state = this.on ? 'idle' : 'off'; this.ip = ''; }

  /** Throughput while up, kbit/s: an ADSL line behind the router, less with a weak signal. */
  kbps(): number { return this.state === 'up' ? [0, 300, 900, 1800, 2400][this.bars] : 0; }

  private scan(world: World) {
    const p = world.player, eye = p.z + 1.4, m = mapRaster(world.city), floor = Math.floor((p.z + 0.5) / FLOOR_H);
    this.list.length = 0;
    world.wifi.forEach((A, i) => {
      const dx = A.x - p.x, dy = A.y - p.y, d2 = Math.hypot(dx, dy);
      if (d2 > 150) return;
      // 15 dBm out of the router, the free-space loss at 2.4 GHz (indoor exponent 3)
      let dbm = 15 - (40 + 30 * Math.log10(Math.max(1, Math.hypot(d2, A.z - eye))));
      if (p.inside === A.building) dbm -= 12 * Math.abs(Math.floor(A.z / FLOOR_H) - floor);
      else {
        dbm -= p.inside >= 0 ? 20 : 10; // its outer wall, and ours
        // the buildings in between
        let walls = 0, inRun = false;
        for (let t = 2; t < d2 - 2; t += 2) {
          const i2 = Math.floor((p.x + (dx * t) / d2) / MAP_RES), j2 = Math.floor((p.y + (dy * t) / d2) / MAP_RES);
          const hit = i2 >= 0 && j2 >= 0 && i2 < m.w && j2 < m.h && m.height[j2 * m.w + i2] * 2 > Math.min(eye, A.z);
          if (hit && !inRun) walls++;
          inRun = hit;
        }
        dbm -= Math.max(0, walls - 1) * 12;
      }
      dbm += (hash3(i, Math.floor(p.x / 3), Math.floor(p.y / 3)) - 0.5) * 6;
      if (dbm >= FLOOR_DBM) this.list.push([i, Math.round(dbm)]);
    });
    this.list.sort((a, b) => b[1] - a[1]);
  }
}
