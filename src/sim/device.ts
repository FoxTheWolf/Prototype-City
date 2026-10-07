import { hash3 } from '../core/rng';

/**
 * A computer in the world, as its own terminal reports it. Every machine (the phones now; the
 * notebook and the city's systems later) has one, and its limits are meant to be real: what does
 * not fit in its memory does not run.
 *
 * The phones on sale in a city come from its makers: MAKERS companies (their names are the city's,
 * see makerName in locale/names.ts), each with a cheap, a middle and a top model of its own specs,
 * body color and camera. The citizens will carry them (stage 11); the player carries a top model.
 * A maker's index is its family (15.18, docs/identidade/fabricantes-manual.html): 0 the giant,
 * 1 the executive's, 2 the fashion and music one, 3 the rugged; its logo is in render/brands.ts.
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
  /** The body's look (one of LOOKS shells, drawn by phone/shells.ts): the same screen and system in each; each maker has looks of its own (LOOK_MAKER). */
  look: number;
  /**
   * The board inside (one of BOARDS): its bootloader runs the first boot screen, the hardware check.
   * Boards are bought in, so models of different makers can share one; the second screen (the logo) is the maker's.
   */
  board: number;
}

/** How many looks a phone's body can have. */
export const LOOKS = 6;
/** Whose each look is (by maker index, the family): Classic and Brushed the giant's, Slate the executive's, Pebble and Slider the fashion one's, Rugged the rugged one's. */
export const LOOK_MAKER = [0, 1, 0, 2, 3, 2];
const makerLooks = (m: number) => LOOK_MAKER.map((x, i) => (x === m % MAKERS ? i : -1)).filter((i) => i >= 0);
/** The boards the makers buy (the bootloader's name); a cheap model tends to get the first, a top one the last. */
export const BOARDS = ['SB-11 bootrom', 'MX2 loader', 'ORCA-3 IPL'];

export const MAKERS = 4;
/** Each family's model names (the manual): the giant's bare numbers, the executive's office words, the fashion one's music words, the rugged one's field words. */
const SERIES = [[], ['Ledger', 'Courier', 'Quorum', 'Charter'], ['tempo', 'loop', 'glide', 'beat'], ['Field', 'Anvil', 'Trek', 'Brick']];
/** A model's name in its family's format, higher numbers up the tiers: "6230i", "Courier 8820", "glide 52", "Anvil X3". */
function modelName(m: number, tier: number, h: (q: number) => number): string {
  const d = (q: number, n: number) => Math.floor(h(q) * n), word = SERIES[m][d(4, SERIES[m].length)];
  if (m === 0) return `${1 + tier * 3 + d(1, 3)}${d(2, 3) + 1}${d(10, 7) + 1}0${['', '', 'i', 'c', 's'][d(11, 5)]}`;
  if (m === 1) return `${word} ${(7 + tier) * 1000 + 100 + d(1, 9) * 100 + d(2, 5) * 10}`;
  if (m === 2) return `${word} ${20 + tier * 25 + d(1, 25)}`;
  return `${word} X${1 + tier * 2 + d(1, 2)}`;
}
const OS = ['KOS', 'VEX', 'ORB'];
const BODIES: [number, number, number][] = [[30, 32, 37], [120, 124, 132], [110, 24, 28], [26, 44, 92], [196, 196, 190], [150, 70, 110], [52, 56, 48]];

/** The models of maker m: 0 cheap, 1 middle, 2 top (the top always has Wi-Fi and GPS). */
export function phoneModel(seed: number, m: number, tier: number): Device {
  const h = (q: number) => hash3(seed, m * 16 + tier, 7000 + q);
  const pick = <T>(a: T[], q: number) => a[Math.floor(h(q) * a.length)];
  const model = modelName(m, tier, h);
  const os = `${OS[m % OS.length]} ${1 + tier}.${Math.floor(h(3) * 5)}`;
  const looks = makerLooks(m), look = looks[Math.floor(h(9) * looks.length)];
  // the board: by the tier, sometimes the next one; not by the maker, so makers share boards
  const board = (tier + (hash3(seed, tier * 16 + m, 7200) < 0.25 ? 1 : 0)) % BOARDS.length;
  if (tier === 0) return {
    maker: m, model, os, cpu: 'ARM9', cpuMHz: 104 + Math.floor(h(5) * 4) * 24, ramMB: 16, flashMB: 32,
    radio: 'GSM/GPRS', wlan: '', gps: '', screen: '128x160', cameraMP: h(6) < 0.4 ? 0 : 0.3, body: pick(BODIES, 7), look, board,
  };
  if (tier === 1) return {
    maker: m, model, os, cpu: 'ARM9', cpuMHz: 220 + Math.floor(h(5) * 4) * 16, ramMB: 64, flashMB: 128,
    radio: 'GSM/EDGE', wlan: h(6) < 0.5 ? '802.11b/g' : '', gps: h(8) < 0.3 ? 'L1 GPS, 12 ch' : '', screen: '176x220', cameraMP: 1.3, body: pick(BODIES, 7), look, board,
  };
  return {
    maker: m, model, os, cpu: 'ARM11', cpuMHz: 332 + Math.floor(h(5) * 3) * 34, ramMB: 128, flashMB: 160,
    radio: 'GSM/EDGE', wlan: '802.11b/g', gps: 'L1 GPS, 12 ch', screen: '240x320', cameraMP: h(6) < 0.5 ? 2 : 3.2, body: pick(BODIES, 7), look, board,
  };
}

/** The top model whose body is `look` (the maker follows the look): the phones the player can get. */
export function lookPhone(seed: number, look: number): Device {
  return { ...phoneModel(seed, LOOK_MAKER[look], 2), look };
}

/** The player's phone: the giant's top model (the manual: the giant is the player's first phone), in one of its looks. */
export function playerPhone(seed: number): Device {
  return phoneModel(seed, 0, 2);
}
