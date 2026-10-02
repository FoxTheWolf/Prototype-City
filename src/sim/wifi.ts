import { hash3 } from '../core/rng';
import { FLOOR_H, type City } from './city';
import { type PowerGrid } from './power';

/**
 * Wi-Fi access points: the routers in the city's shops and homes. A cafe usually has an open one, a
 * hotel a locked one (the key at the desk), bars and other shops sometimes; some apartment buildings
 * a few, locked with the router's default key or open. Each has a network name (made in the locale
 * from what it is, see wifiName), its security and its key: what the player's phone finds (stage 9)
 * and what the hacking will work with (stage 14). Nearest the player's starting point there is
 * always an open one, to test with.
 */
export const Sec = { Open: 0, WEP: 1, WPA: 2 } as const;

export interface AccessPoint {
  x: number;
  y: number;
  /** Height of the router (the storey it is on). */
  z: number;
  building: number;
  /** The business it belongs to, or -1 for a home. */
  biz: number;
  sec: number;
  /** The key: digits for WPA (8-10), ten for WEP (typed on a phone's keypad); empty when open. */
  key: string;
  /** The hardware address, and the radio channel (1, 6 or 11). */
  bssid: string;
  ch: number;
  /** The substation it is the maintenance link of (a utility network), or -1 for an ordinary router. */
  util: number;
}

/** Chance that a business of each kind has a router, and that it is open. */
const SHOP_AP: Record<string, [number, number]> = {
  cafe: [0.9, 0.85], hotel: [0.8, 0.1], bar: [0.4, 0.5], books: [0.5, 0.7], diner: [0.3, 0.6], electronics: [0.6, 0.2],
};

export function buildWifi(seed: number, city: City, sx: number, sy: number, power: PowerGrid): AccessPoint[] {
  const out: AccessPoint[] = [];
  const add = (x: number, y: number, z: number, building: number, biz: number, sec: number, q: number) => {
    const h = (n: number) => hash3(seed ^ 0x3f1, q, n);
    const key = sec === Sec.WPA ? String(Math.floor(h(1) * 1e10)).padStart(8 + Math.floor(h(2) * 3), '0').slice(0, 8 + Math.floor(h(2) * 3))
      : sec === Sec.WEP ? Array.from({ length: 10 }, (_, i) => String(Math.floor(h(10 + i) * 10))).join('') : '';
    const bssid = Array.from({ length: 6 }, (_, i) => Math.floor(h(30 + i) * 256).toString(16).padStart(2, '0')).join(':').toUpperCase();
    out.push({ x, y, z, building, biz, sec, key, bssid, ch: [1, 6, 11][Math.floor(h(3) * 3)], util: -1 });
  };
  // the shops'
  city.businesses.forEach((b, k) => {
    const [p, open] = SHOP_AP[b.kind] ?? [0.15, 0.3], h = hash3(seed ^ 0x3f2, k, 1);
    if (h >= p) return;
    const B = city.buildings[b.building], o = hash3(seed ^ 0x3f2, k, 2);
    add((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, 2.4, b.building, k, o < open ? Sec.Open : o < open + (1 - open) * 0.3 ? Sec.WEP : Sec.WPA, k);
  });
  // the homes': a few routers in some apartment buildings, on random floors
  city.buildings.forEach((B, k) => {
    if (B.tier !== 1 || (B.style !== 'residential' && B.style !== 'brick')) return;
    const h = hash3(seed ^ 0x3f3, k, 1);
    if (h > 0.45) return;
    const n = 1 + Math.floor(hash3(seed ^ 0x3f3, k, 2) * 3), floors = Math.max(1, Math.floor(B.h / FLOOR_H));
    for (let i = 0; i < n; i++) {
      const q = 100000 + k * 4 + i, f = Math.floor(hash3(seed, q, 5) * floors), s = hash3(seed, q, 6);
      const x = B.x0 + (B.x1 - B.x0) * (0.2 + 0.6 * hash3(seed, q, 7)), y = B.y0 + (B.y1 - B.y0) * (0.2 + 0.6 * hash3(seed, q, 8));
      add(x, y, f * FLOOR_H + 2.4, k, -1, s < 0.15 ? Sec.Open : s < 0.4 ? Sec.WEP : Sec.WPA, q);
    }
  });
  // to test with: the router nearest the start is an open one
  let best = -1, bd = 1e9;
  out.forEach((a, i) => { const d = Math.hypot(a.x - sx, a.y - sy); if (a.biz >= 0 && d < bd) { bd = d; best = i; } });
  if (best >= 0) { out[best].sec = Sec.Open; out[best].key = ''; }
  // the utility's maintenance link at each substation: a WEP network (the old kind) for the technicians' laptops
  power.subs.forEach((S, k) => {
    add(S.x, S.y, 2, -2, -1, Sec.WEP, 900000 + k);
    out[out.length - 1].util = k;
  });
  return out;
}
