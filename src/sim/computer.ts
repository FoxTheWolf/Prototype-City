import { hash3 } from '../core/rng';

/**
 * A computer of the world: its hardware, its disk (a tree of files) and the processes in its
 * memory. The player's notebook is the first (stage 10); the city's systems (a substation's
 * controller, a traffic cabinet, a shop's router) will be the same thing with other hardware and
 * other files, reached over the network, and the same shell (laptop/shell.ts) runs on all of them.
 *
 * The limits are real: a program that does not fit in the free memory does not start, a file that
 * does not fit on the disk is not written, and work takes as long as the processor and the disk
 * need for it. Times here are real seconds; the files keep the game time they were written at.
 */
export interface Hardware {
  /** The maker (index; the name comes from the city, see computerMakerName) and the model. */
  maker: number;
  model: string;
  cpu: string;
  cpuMHz: number;
  cores: number;
  ramMB: number;
  diskMB: number;
  disk: string;
  /** Disk throughput in MB/s and its average seek in ms (a 2008 notebook drive: 5400 rpm). */
  diskMBs: number;
  seekMs: number;
  eth: string;
  wlan: string;
  bios: string;
  /** The operating system, its kernel's version, the host's name and the owner's login. */
  os: string;
  kernel: string;
  host: string;
  user: string;
  /** The body's color. */
  body: [number, number, number];
  /** The battery: its design capacity (Wh) and how much of it is left after the years (0..1). */
  battWh: number;
  battWear: number;
}

export interface FsNode {
  name: string;
  dir: boolean;
  kids: Map<string, FsNode> | null;
  /** A text file's contents (null for binaries and directories). */
  data: string | null;
  /** Size in bytes (a text file: its length). */
  size: number;
  owner: string;
  /** Game time it was last written. */
  mtime: number;
  /** A program: the command it runs, and the memory it needs, in KB. */
  exec: string | null;
  memKB: number;
}

export interface Proc {
  pid: number;
  name: string;
  user: string;
  /** Resident memory, KB. */
  memKB: number;
  /** Real time it started. */
  start: number;
}

/** What the system itself takes before any process: the kernel, its buffers and the page cache it keeps. */
const KERNEL_KB = 96 * 1024;
/** The installed system on the disk, besides the files in the tree. */
const SYSTEM_MB = 3400;

/** What can boot the machine, in the BIOS's boot order. */
export type BootDev = 'hdd' | 'dvd' | 'usb' | 'net';
/**
 * The firmware's settings (CMOS), kept with the machine: they change what it does, not just what
 * the SETUP screen shows. The clock runs off the real one by an offset; a disabled radio is not
 * there for the system; quick boot skips the memory test; the boot order is tried in turn.
 */
export interface BiosConfig {
  /** Seconds the hardware clock is off the city's (set in SETUP). */
  clockOffset: number;
  wlan: boolean;
  quickBoot: boolean;
  /** The fan never stops (a floor under its controller). */
  fanAlways: boolean;
  bootOrder: BootDev[];
}
export const biosDefaults = (): BiosConfig => ({ clockOffset: 0, wlan: true, quickBoot: false, fanAlways: false, bootOrder: ['hdd', 'dvd', 'usb', 'net'] });

const node = (name: string, dir: boolean, owner: string, mtime: number): FsNode => ({ name, dir, kids: dir ? new Map() : null, data: null, size: dir ? 4096 : 0, owner, mtime, exec: null, memKB: 0 });

export class Computer {
  readonly root: FsNode;
  procs: Proc[] = [];
  private nextPid = 1;
  /** Real time of the last boot, or -1 while off. */
  bootAt = -1;
  bios: BiosConfig = biosDefaults();
  /** The battery: charge 0..1 of what it holds now (its capacity worn below the design's, Wh). */
  charge = 0.85;
  battWh: number;
  /** On the mains (the adapter in a live outlet), and charging the battery. */
  plugged = false;
  /** What it draws now, W (set by drain). */
  watts = 0;
  constructor(readonly hw: Hardware) {
    this.root = node('', true, 'root', 0);
    this.battWh = hw.battWh * hw.battWear;
  }
  /**
   * The battery for `dt` real seconds: running, the machine draws a base, its processor's load, the
   * screen and the radio; asleep (lid shut) next to nothing; off nothing. On the mains, the adapter
   * feeds it and charges the battery (about an hour and a half from empty).
   */
  drain(dt: number, state: 'off' | 'sleep' | 'on') {
    const W = state === 'off' ? 0 : state === 'sleep' ? 0.6 : 9 + 16 * this.load + 3 + (this.bios.wlan ? 1.2 : 0) + 1.5 * this.fan;
    this.watts = W;
    if (this.plugged) this.charge = Math.min(1, this.charge + (dt * (this.charge < 0.8 ? 1 : 0.4)) / 5400);
    else this.charge = Math.max(0, this.charge - (W * dt) / 3600 / this.battWh);
  }
  /** Seconds of battery left at what it draws now (Infinity on the mains or drawing nothing). */
  battLeftS() { return this.plugged || this.watts <= 0 ? Infinity : (this.charge * this.battWh * 3600) / this.watts; }

  /** Path from cwd (absolute or relative; . and .. and ~ understood) to a normalized absolute path. */
  abs(cwd: string, path: string): string {
    if (path === '~' || path.startsWith('~/')) path = `/home/${this.hw.user}${path.slice(1)}`;
    const parts = (path.startsWith('/') ? path : `${cwd}/${path}`).split('/'), out: string[] = [];
    for (const p of parts) {
      if (!p || p === '.') continue;
      if (p === '..') out.pop(); else out.push(p);
    }
    return '/' + out.join('/');
  }
  get(path: string): FsNode | null {
    let n: FsNode | null = this.root;
    for (const p of path.split('/')) if (p) n = n?.kids?.get(p) ?? null;
    return n;
  }
  /** The directory a path's last name would go in, and that name. */
  parent(path: string): [FsNode | null, string] {
    const k = path.lastIndexOf('/');
    return [this.get(path.slice(0, k) || '/'), path.slice(k + 1)];
  }
  /** May the user write here: only in their home and /tmp (the rest is the system's). */
  writable(path: string, user: string): boolean {
    return user === 'root' || path === `/home/${user}` || path.startsWith(`/home/${user}/`) || path === '/tmp' || path.startsWith('/tmp/');
  }
  /** Make the directories of a path, as the system does when it is installed. */
  mkdirs(path: string, owner = 'root', mtime = 0): FsNode {
    let n = this.root;
    for (const p of path.split('/')) {
      if (!p) continue;
      let k = n.kids!.get(p);
      if (!k) { k = node(p, true, owner, mtime); n.kids!.set(p, k); }
      n = k;
    }
    return n;
  }
  /** Write a file (making its directories): text, or a binary of a size. */
  put(path: string, data: string | number, owner = 'root', mtime = 0, exec: string | null = null, memKB = 0): FsNode {
    const k = path.lastIndexOf('/'), dir = this.mkdirs(path.slice(0, k), owner === 'root' ? 'root' : owner, mtime), name = path.slice(k + 1);
    const f = node(name, false, owner, mtime);
    if (typeof data === 'string') { f.data = data; f.size = data.length; } else f.size = data;
    f.exec = exec; f.memKB = memKB;
    dir.kids!.set(name, f);
    return f;
  }
  /** Bytes in a tree. */
  du(n: FsNode): number {
    if (!n.dir) return n.size;
    let s = n.size;
    for (const k of n.kids!.values()) s += this.du(k);
    return s;
  }
  usedMB() { return SYSTEM_MB + this.du(this.root) / 1048576; }
  freeMB() { return this.hw.diskMB - this.usedMB(); }
  /** Memory taken by the kernel and the processes, and what is left, in KB. */
  /** Buffers and cache the running system holds (set by the notebook each frame); counts as used memory. */
  bgKB = 0;
  usedKB() { return KERNEL_KB + this.bgKB + this.procs.reduce((s, p) => s + p.memKB, 0); }
  freeKB() { return this.hw.ramMB * 1024 - this.usedKB(); }
  /** Start a process if its memory fits; null when it does not. */
  spawn(name: string, user: string, memKB: number, now: number): Proc | null {
    if (memKB > this.freeKB()) return null;
    const p = { pid: this.nextPid++, name, user, memKB, start: now };
    this.procs.push(p);
    return p;
  }
  kill(pid: number) { this.procs = this.procs.filter((p) => p.pid !== pid); }
  /** Processor load 0..1 (set by what runs on it), the processor's temperature in °C and the fan's speed 0..1. */
  load = 0;
  tempC = 30;
  fan = 0;
  /**
   * The heat, for `dt` real seconds in air at `ambient` °C: the load heats the processor toward a
   * level the fan pulls down, and the fan follows the temperature (as a notebook's controller does:
   * slow and quiet when cool, full above ~75 °C). Off, it cools to the air and the fan stops.
   */
  heat(dt: number, ambient: number) {
    const on = this.bootAt >= 0;
    const target = ambient + (on ? (16 + 46 * this.load) * (1 - 0.32 * this.fan) : 0);
    this.tempC += (target - this.tempC) * Math.min(1, dt / 20);
    const want = on ? Math.max(this.bios.fanAlways ? 0.45 : 0.2, Math.min(1, (this.tempC - 45) / 30)) : 0;
    this.fan += (want - this.fan) * Math.min(1, dt / 2.5);
  }
  /** The fan in revolutions a minute. */
  fanRpm() { return this.fan < 0.02 ? 0 : Math.round(1800 + this.fan * 3600); }
  /** Power off: memory is gone, the pids start over. */
  halt() { this.procs = []; this.nextPid = 1; this.bootAt = -1; }
  /**
   * Seconds of work: reading `bytes` off the disk (plus a seek per file) and pushing them through
   * the processor at `cycles` per byte.
   */
  workS(bytes: number, files = 1, cycles = 0): number {
    const H = this.hw;
    return files * H.seekMs / 1000 + bytes / (H.diskMBs * 1048576) + (bytes * cycles) / (H.cpuMHz * 1e6);
  }
}

export const LAPTOP_MAKERS = 2;
const SERIES = ['Traveler', 'Vector', 'Latitude', 'Courier', 'Pilot', 'Atlas', 'Scout', 'Envoy'];
const CPUS: [string, number, number][] = [['XC Solo T1350', 1600, 1], ['XC Duo T2250', 1730, 2], ['XC Duo T5450', 1660, 2], ['XC Duo T7250', 2000, 2], ['K8 Mobile TL-56', 1800, 2]];
const BODIES: [number, number, number][] = [[34, 36, 40], [150, 152, 158], [24, 24, 26], [60, 64, 72], [196, 196, 192]];

/** The player's notebook: a 2008 machine from one of the city's computer makers, the same for a seed. */
export function playerLaptop(seed: number): Hardware {
  const h = (q: number) => hash3(seed, 401, 9000 + q);
  const pick = <T>(a: T[], q: number) => a[Math.floor(h(q) * a.length)];
  const [cpu, cpuMHz, cores] = pick(CPUS, 1);
  const ramMB = pick([512, 1024, 1024, 2048], 2), diskGB = pick([60, 80, 80, 120], 3);
  const host = `${pick(['nb', 'deck', 'rig', 'box', 'term'], 4)}-${Math.floor(h(5) * 900 + 100)}`;
  return {
    maker: Math.floor(h(0) * LAPTOP_MAKERS), model: `${pick(SERIES, 6)} ${Math.floor(h(7) * 8 + 2)}${Math.floor(h(8) * 90 + 10)}`,
    cpu, cpuMHz, cores, ramMB, diskMB: diskGB * 1000, disk: `DTK-${diskGB}G54 ATA`, diskMBs: 32 + Math.floor(h(9) * 12), seekMs: 12 + Math.floor(h(10) * 4),
    eth: '10/100 Ethernet', wlan: '802.11b/g, 54 Mbit/s', bios: `v1.${Math.floor(h(11) * 20)}`,
    os: 'Osprey/UX 4.2', kernel: '2.6.24-19', host, user: 'user', body: pick(BODIES, 12),
    battWh: pick([48, 56, 56, 64], 13), battWear: 0.62 + h(14) * 0.3,
  };
}
