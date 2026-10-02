import { hash3 } from '../core/rng';

/**
 * A computer in the world, as its own terminal reports it. Every machine (the phones now; the
 * notebook and the city's systems later) has one, and its limits are meant to be real: what does
 * not fit in its memory does not run.
 *
 * The phones on sale in a city come from its makers: MAKERS companies (their names are the city's,
 * see makerName in locale/names.ts), each with a cheap, a middle and a top model of its own specs,
 * body color and camera. The citizens will carry them (stage 11); the player carries a top model.
 */
export interface Device {
  /** The maker (index; the name comes from the locale) and the model's name. */
  maker: number;
  model: string;
  os: string;
  cpu: string;
  cpuMHz: number;
  ramMB: number;
  flashMB: number;
  /** Radios: cellular, wireless LAN (or none), satellite positioning (or none). */
  radio: string;
  wlan: string;
  gps: string;
  /** Screen in pixels; camera in megapixels (0: none). */
  screen: string;
  cameraMP: number;
  /** The body's color. */
  body: [number, number, number];
  /** The body's look (one of LOOKS shells, drawn by phone/shells.ts): the same screen and system in each. */
  look: number;
}

/** How many looks a phone's body can have. */
export const LOOKS = 6;

export const MAKERS = 3;
const SERIES = ['Navigator', 'Slide', 'Flip', 'Pulse', 'Edge', 'Nova', 'Classic', 'Aero', 'Sense'];
const OS = ['KOS', 'VEX', 'ORB'];
const BODIES: [number, number, number][] = [[30, 32, 37], [120, 124, 132], [110, 24, 28], [26, 44, 92], [196, 196, 190], [150, 70, 110], [52, 56, 48]];

/** The models of maker m: 0 cheap, 1 middle, 2 top (the top always has Wi-Fi and GPS). */
export function phoneModel(seed: number, m: number, tier: number): Device {
  const h = (q: number) => hash3(seed, m * 16 + tier, 7000 + q);
  const pick = <T>(a: T[], q: number) => a[Math.floor(h(q) * a.length)];
  const num = (tier + 1) * 1000 + Math.floor(h(1) * 9) * 100 + (h(2) < 0.5 ? 0 : 10);
  const os = `${OS[m % OS.length]} ${1 + tier}.${Math.floor(h(3) * 5)}`;
  if (tier === 0) return {
    maker: m, model: `${num} ${pick(SERIES, 4)}`, os, cpu: 'ARM9', cpuMHz: 104 + Math.floor(h(5) * 4) * 24, ramMB: 16, flashMB: 32,
    radio: 'GSM/GPRS', wlan: '', gps: '', screen: '128x160', cameraMP: h(6) < 0.4 ? 0 : 0.3, body: pick(BODIES, 7), look: Math.floor(h(9) * LOOKS),
  };
  if (tier === 1) return {
    maker: m, model: `${num} ${pick(SERIES, 4)}`, os, cpu: 'ARM9', cpuMHz: 220 + Math.floor(h(5) * 4) * 16, ramMB: 64, flashMB: 128,
    radio: 'GSM/EDGE', wlan: h(6) < 0.5 ? '802.11b/g' : '', gps: h(8) < 0.3 ? 'L1 GPS, 12 ch' : '', screen: '176x220', cameraMP: 1.3, body: pick(BODIES, 7), look: Math.floor(h(9) * LOOKS),
  };
  return {
    maker: m, model: `${num} ${pick(SERIES, 4)}`, os, cpu: 'ARM11', cpuMHz: 332 + Math.floor(h(5) * 3) * 34, ramMB: 128, flashMB: 160,
    radio: 'GSM/EDGE', wlan: '802.11b/g', gps: 'L1 GPS, 12 ch', screen: '240x320', cameraMP: h(6) < 0.5 ? 2 : 3.2, body: pick(BODIES, 7), look: Math.floor(h(9) * LOOKS),
  };
}

/** The player's phone: the top model of one of the city's makers. */
export function playerPhone(seed: number): Device {
  return phoneModel(seed, Math.floor(hash3(seed, 31, 7001) * MAKERS), 2);
}
