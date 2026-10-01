/**
 * A computer in the world, as its own terminal reports it. Every machine (the player's phone now;
 * the citizens' phones, the notebook and the city's systems later) has one, and its limits are
 * meant to be real: what does not fit in its memory does not run (stage 9 on).
 */
export interface Device {
  maker: string;
  model: string;
  os: string;
  cpu: string;
  cpuMHz: number;
  ramMB: number;
  flashMB: number;
  /** Radios: cellular, wireless LAN, satellite positioning. */
  radio: string;
  wlan: string;
  gps: string;
  /** Screen in pixels. */
  screen: string;
}

/** The player's phone: a 2008 navigator handset with a keypad and a GPS receiver. */
export const PLAYER_PHONE: Device = {
  maker: 'Kestrel',
  model: '7300 Navigator',
  os: 'KOS 3.1',
  cpu: 'ARM11',
  cpuMHz: 332,
  ramMB: 128,
  flashMB: 160,
  radio: 'GSM/EDGE',
  wlan: '802.11b/g',
  gps: 'L1 GPS, 12 ch',
  screen: '240x320',
};
