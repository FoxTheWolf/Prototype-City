import { hash3 } from '../core/rng';
import { calendar } from '../sim/clock';
import { type BootDev, type Computer, type FsNode } from '../sim/computer';
import { Firmware, type FwAction } from './bios';
import { Editor } from './editor';
import { type Scr } from './screen';
import { type World } from '../sim/world';
import L from '../locale/laptop.en.json';
import { computerMakerName, wifiName } from '../locale/names';
import { Wifi } from '../phone/wifi';
import { Sec } from '../sim/wifi';
import { type Host, lanHosts, modbusRegs, setBreaker, setSignals, WORDS } from '../sim/network';
import { capture } from '../sim/packets';

/**
 * A Unix-like shell on a Computer: the commands, the text they print and how long they take. The
 * screen is a terminal of TERM_W x TERM_H characters; what a command prints is scheduled line by
 * line at the pace of the real work behind it (the disk reading, the processor hashing), so the
 * text types in as fast as the machine would give it, and Ctrl+C stops what has not happened yet.
 *
 * It runs on any Computer: the player's notebook now, the city's machines over the network later.
 * Times are real seconds; file times and the clock are the game's.
 */
/** The system's console: 160 x 50, as a 2008 notebook's 1280 x 800 screen shows with the 8 x 16 console font (the firmware's text mode is 80 x 25). */
export const TERM_W = 160, TERM_H = 50;
/** How the terminal writes a line: a moment per line and per character (fast, but it is seen to scroll). */
const LINE_S = 0.012, CHAR_S = 1 / 5000;
const KEEP = 800;

/** 0 normal, 1 dim, 2 bright. */
export type Ink = 0 | 1 | 2;
export interface Line { text: string; ink: Ink }
/** A sound the shell asks for: a seek of the drive, the BIOS beep, the drive spinning up or down. */
export type LapSfx = 'seek' | 'beep' | 'spin' | 'spindown';

interface Item { at: number; text?: string; ink?: Ink; replace?: boolean; sfx?: LapSfx; fn?: () => void; always?: boolean }

/** The programs installed with the system: where, size on disk (KB) and memory to run (KB). */
const PROGRAMS: [string, string, number, number][] = [
  ['/bin', 'ls', 92, 420], ['/bin', 'cat', 46, 300], ['/bin', 'cp', 72, 380], ['/bin', 'mv', 76, 380], ['/bin', 'rm', 48, 320],
  ['/bin', 'mkdir', 36, 300], ['/bin', 'rmdir', 30, 290], ['/bin', 'touch', 40, 300], ['/bin', 'echo', 26, 260], ['/bin', 'pwd', 26, 260],
  ['/bin', 'ps', 70, 900], ['/bin', 'kill', 22, 270], ['/bin', 'date', 52, 330], ['/bin', 'uname', 24, 260], ['/bin', 'hostname', 14, 250],
  ['/bin', 'dmesg', 18, 600], ['/bin', 'sleep', 22, 250], ['/bin', 'sh', 680, 1800],
  ['/usr/bin', 'head', 36, 300], ['/usr/bin', 'wc', 34, 300], ['/usr/bin', 'find', 168, 1100], ['/usr/bin', 'du', 82, 700], ['/usr/bin', 'uptime', 12, 300],
  ['/usr/bin', 'free', 14, 320], ['/usr/bin', 'df', 64, 420], ['/usr/bin', 'whoami', 22, 260], ['/usr/bin', 'id', 30, 270],
  ['/usr/bin', 'sha1sum', 38, 520], ['/usr/bin', 'man', 96, 2400], ['/usr/bin', 'lshw', 540, 3800], ['/usr/bin', 'clear', 10, 240],
  ['/usr/bin', 'color', 12, 240], ['/sbin', 'ifconfig', 66, 520], ['/sbin', 'iwconfig', 26, 440], ['/sbin', 'iwlist', 40, 520], ['/sbin', 'dhclient', 120, 900], ['/bin', 'ping', 44, 420], ['/usr/bin', 'sensors', 28, 360], ['/sbin', 'shutdown', 18, 400], ['/sbin', 'reboot', 12, 380],
  ['/usr/bin', 'nano', 160, 1600], ['/usr/bin', 'acpi', 20, 300],
];
/** The hacker tools in ~/bin: fictional stand-ins (scanner, cracker, sniffer, console). Name, size KB, memory KB. */
const HACK_TOOLS: [string, number, number][] = [
  ['mmap', 220, 1400], ['bruter', 180, 1600], ['tdump', 260, 2200], ['tnet', 64, 520], ['mbus', 96, 700],
];
/** What the shell does itself, with no program on the disk. */
const BUILTINS = new Set(['cd', 'help', 'history', 'exit', 'logout']);
const PATH = ['/bin', '/usr/bin', '/sbin'];

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const p2 = (n: number) => String(n).padStart(2, '0');
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

/** Install the system on a fresh disk: the directories, the programs, the manual, the owner's files. */
export function install(pc: Computer, t: number) {
  const u = pc.hw.user, H = `/home/${u}`, ago = (d: number) => Math.max(0, t - 86400 * d); // the clock starts in 2008
  for (const d of ['/boot', '/dev', '/etc', '/lib', '/mnt', '/proc', '/root', '/tmp', '/usr/lib', '/usr/share/man/man1', '/var/log', '/var/tmp']) pc.mkdirs(d, 'root', t);
  for (const [dir, name, kb, mem] of PROGRAMS) pc.put(`${dir}/${name}`, kb * 1024, 'root', t, name, mem);
  for (const [name, text] of Object.entries(L.man)) pc.put(`/usr/share/man/man1/${name}.1`, text + '\n', 'root', t);
  pc.put('/boot/vmlinuz-' + pc.hw.kernel, 1_930_000, 'root', t);
  pc.put('/boot/initrd.img-' + pc.hw.kernel, 7_400_000, 'root', t);
  pc.put('/lib/libc.so.6', 1_290_000, 'root', t);
  pc.put('/etc/hostname', pc.hw.host + '\n', 'root', t);
  pc.put('/etc/issue', `${pc.hw.os} \\n \\l\n`, 'root', t);
  pc.put('/etc/passwd', `root:x:0:0:root:/root:/bin/sh\n${u}:x:1000:1000:${u}:${H}:/bin/sh\n`, 'root', t);
  pc.put('/etc/fstab', '/dev/sda1  /      ext3  defaults  0 1\n/dev/sda5  none   swap  sw        0 0\nproc       /proc  proc  defaults  0 0\n', 'root', t);
  pc.put('/etc/hosts', `127.0.0.1  localhost\n127.0.1.1  ${pc.hw.host}\n`, 'root', t);
  pc.put('/etc/resolv.conf', '', 'root', t);
  for (const n of ['cpuinfo', 'meminfo', 'uptime', 'version']) pc.put(`/proc/${n}`, 0, 'root', t);
  pc.mkdirs(H, u, t);
  for (const [name, text] of Object.entries(L.home)) pc.put(`${H}/${name}`, text, u, ago(2 + Math.floor(hash3(name.length, 3, 5) * 30)));
  // the hacker tools, installed outside the app store (through the notebook): a port scanner, a
  // password tester, a packet sniffer and a remote console. All fictional, all run on the game's network.
  pc.mkdirs(`${H}/bin`, u, t);
  for (const [name, kb, mem] of HACK_TOOLS) pc.put(`${H}/bin/${name}`, kb * 1024, u, t, name, mem);
  // an old backup: big enough to take a while to read
  pc.put(`${H}/media/backup-2007.tar`, 734_003_200, u, ago(61));
  pc.put(`${H}/media/photos/IMG_0412.JPG`, 1_184_311, u, ago(40));
  pc.put(`${H}/media/photos/IMG_0413.JPG`, 1_090_822, u, ago(40));
}

export class Shell {
  lines: Line[] = [];
  private queue: Item[] = [];
  /** Scheduling cursor: the time the last queued item happens. */
  private tq = 0;
  /** No prompt until this time (a command at work); the screen is off, booting or ready. */
  busyUntil = 0;
  state: 'off' | 'boot' | 'ready' = 'off';
  input = '';
  cur = 0;
  readonly hist: string[] = [];
  private hi = -1;
  cwd: string;
  /** Lines scrolled back from the bottom. */
  scroll = 0;
  /** 0 amber, 1 green. */
  ink = 0;
  readonly sfx: LapSfx[] = [];
  /** The kernel's messages since boot (dmesg). */
  private kmsg: string[] = [];
  /** Game time of the last boot. */
  private bootT = 0;
  private shellPid = 0;
  /** The process a command is running as, until it ends. */
  private job = 0;
  /** Until when the processor is working hard (a command that computes), real seconds. */
  heavyUntil = 0;
  /** The BIOS's screen is up (draw.ts draws its logos and colors). */
  bios = false;
  /** Asked to power off (shutdown): the notebook reads it. */
  halted = false;
  /** The wireless card: it scans and joins the simulated routers of sim/wifi.ts (the phone's signal model). */
  readonly net = new Wifi();
  /** The ESSID set with iwconfig, waiting for dhclient to lease an address. */
  private essid = '';
  /** An open remote console (tnet): the host, its substation, and where we are in logging in. */
  private conn: { host: Host; stage: 'login' | 'pass' | 'shell'; tryUser: string } | null = null;
  /** The next typed line is not echoed (a password prompt): draw.ts shows it masked. */
  mask = false;
  /** The firmware's SETUP and boot menu, after the self test. */
  readonly fw: Firmware;
  /** The self test is on screen: F2 and F12 are heard, and what was asked for comes when it ends. */
  private inPost = false;
  private postWant: null | 'setup' | 'menu' = null;
  /** The text editor, while it owns the screen. */
  editor: Editor | null = null;

  constructor(readonly pc: Computer, private world: World) {
    this.cwd = `/home/${pc.hw.user}`;
    this.fw = new Firmware(pc, world, (a) => this.fwDone(a));
  }
  /** The machine's own clock: the city's, moved by what was set in the BIOS. */
  private get clock() { return this.world.time + this.pc.bios.clockOffset; }
  /** A program drawing the whole screen (SETUP, the editor), with its cursor; null for the scrolling lines. */
  screen(): { scr: Scr; cx: number; cy: number } | null {
    if (this.fw.mode) return { scr: this.fw.cells(), cx: -1, cy: -1 };
    if (this.editor && this.state === 'ready') return this.editor.cells();
    return null;
  }
  get prompt() {
    if (this.conn) return this.conn.stage === 'login' ? `${this.conn.host.name} login: ` : this.conn.stage === 'pass' ? 'Password: ' : `admin@${this.conn.host.name}# `;
    const H = `/home/${this.pc.hw.user}`, w = this.cwd === H ? '~' : this.cwd.startsWith(H + '/') ? '~' + this.cwd.slice(H.length) : this.cwd;
    return `${this.pc.hw.user}@${this.pc.hw.host}:${w}$ `;
  }
  get ready() { return this.state === 'ready' && performance.now() / 1000 >= this.busyUntil && !this.queue.length; }

  // ---- the schedule ----
  private at(now: number, delay: number) { this.tq = Math.max(this.tq, now) + delay; return this.tq; }
  /** Print a line after `delay`, plus the moment the terminal takes to write it. */
  say(now: number, text: string, ink: Ink = 0, delay = 0) {
    text = text.replace(/[^	]*	/g, (m) => m.slice(0, -1).padEnd((Math.floor((m.length - 1) / 8) + 1) * 8));
    for (let k = 0; k === 0 || k < text.length; k += TERM_W) {
      this.queue.push({ at: this.at(now, (k ? 0 : delay) + LINE_S + Math.min(TERM_W, text.length - k) * CHAR_S), text: text.slice(k, k + TERM_W), ink });
    }
  }
  private redo(now: number, text: string, delay: number) { this.queue.push({ at: this.at(now, delay), text, replace: true }); }
  private sound(now: number, s: LapSfx, delay = 0) { this.queue.push({ at: this.at(now, delay), sfx: s }); }
  private then(now: number, fn: () => void, delay = 0, always = false) { this.queue.push({ at: this.at(now, delay), fn, always }); }
  /** Drive activity for `s` seconds from the cursor: a seek every so often, as a working drive clicks. */
  private seeks(now: number, s: number, rate = 5) {
    const t0 = Math.max(this.tq, now);
    for (let k = 0, t = 0; t < s; k++) {
      t += (0.4 + hash3(k, Math.floor(t0 * 10), 77) * 1.2) / rate;
      if (t < s) this.queue.push({ at: t0 + t, sfx: 'seek' });
    }
    this.queue.sort((a, b) => a.at - b.at);
  }

  update(now: number) {
    this.net.on = this.pc.bios.wlan;
    this.net.update(this.world, this.state !== 'off', now);
    let n = 0;
    while (n < this.queue.length && this.queue[n].at <= now) {
      const q = this.queue[n++];
      if (q.text !== undefined) {
        if (q.replace && this.lines.length) this.lines[this.lines.length - 1] = { text: q.text, ink: q.ink ?? 0 };
        else this.lines.push({ text: q.text, ink: q.ink ?? 0 });
      }
      if (q.sfx) this.sfx.push(q.sfx);
      q.fn?.();
    }
    if (n) {
      this.queue.splice(0, n);
      if (this.lines.length > KEEP) this.lines.splice(0, this.lines.length - KEEP);
    }
  }
  /** Ctrl+C: what has not happened yet does not happen (its clean-up still runs). */
  private interrupt(now: number) {
    const left = this.queue.filter((q) => q.always);
    this.queue = [];
    for (const q of left) q.fn?.();
    this.lines.push({ text: '^C', ink: 0 });
    this.tq = now; this.busyUntil = now;
  }

  // ---- power ----
  /** Cold boot: the BIOS, the boot loader, the kernel, the services, the login. */
  boot(now: number) {
    const pc = this.pc, H = pc.hw, w = this.world;
    this.lines = []; this.queue = []; this.kmsg = []; this.tq = now; this.state = 'boot'; this.halted = false; this.scroll = 0; this.conn = null; this.mask = false;
    this.editor = null; this.fw.close(); this.inPost = true; this.postWant = null;
    pc.halt(); pc.bootAt = now; this.bootT = w.time; this.bios = false;
    // the BIOS's own screen (see draw.ts for its logos): the maker, the processor, the memory counting
    // up, the drives it finds; the drive spins up meanwhile
    this.bios = true;
    const maker = computerMakerName(w.city, H.maker), year = calendar(w.time).year - 1;
    this.say(now, '', 0, 0.5);
    this.sound(now, 'beep', 0.1);
    this.sound(now, 'spin', 0);
    this.say(now, `     ${maker} BIOS (C) ${year} ${maker} Systems, Inc.`, 0, 0.1);
    this.say(now, `     ${maker} ${H.model} BIOS Revision ${H.bios}`, 0, 0.05);
    this.say(now, '', 0, 0);
    this.say(now, '', 0, 0);
    this.say(now, `  Main Processor  : ${H.cpu} @ ${(H.cpuMHz / 1000).toFixed(2)}GHz`, 0, 0.3);
    // counts up as fast as the BIOS checks it: ~1 GB a second (quick boot skips the test)
    const kb = H.ramMB * 1024, quick = pc.bios.quickBoot;
    if (quick) this.say(now, `  Memory Test     : ${String(kb).padStart(7)}K OK`, 0, 0.1);
    else {
      this.say(now, '  Memory Test     :       0K', 0, 0.2);
      const steps = 16;
      for (let k = 1; k <= steps; k++) this.redo(now, `  Memory Test     : ${String(Math.round((kb * k) / steps)).padStart(7)}K${k === steps ? ' OK' : ''}`, H.ramMB / 1000 / steps);
    }
    const q = quick ? 0.35 : 1;
    this.say(now, '', 0, 0.3 * q);
    this.say(now, '  Detecting Primary Master   ...', 0, 0.2 * q);
    this.seeks(now, 0.9 * q, 7);
    this.redo(now, `  Detecting Primary Master   ... ${H.disk} ${Math.round(H.diskMB / 1000)}G`, 0);
    this.say(now, '  Detecting Primary Slave    ...', 0, 0.1 * q);
    this.redo(now, '  Detecting Primary Slave    ... None', 0.5 * q);
    this.say(now, '  Detecting Secondary Master ...', 0, 0.1 * q);
    this.redo(now, '  Detecting Secondary Master ... DVD+-RW 8X', 0.6 * q);
    for (let k = 0; k < TERM_H - 15; k++) this.say(now, '', 0, 0);
    this.then(now, () => { this.lines.push({ text: this.postWant ? this.postMsg() : '  Press F2 to enter SETUP, F12 for the boot menu', ink: 0 }); });
    // the keys are heard until the self test ends; then SETUP, the menu, or the boot order
    this.then(now, () => this.postDone(), 1.6 * (quick ? 0.6 : 1));
    this.busyUntil = this.tq;
  }
  private postMsg() { return this.postWant === 'setup' ? '  Entering SETUP...' : '  Entering the boot menu...'; }
  private postDone() {
    const now = performance.now() / 1000;
    this.inPost = false;
    if (this.postWant === 'setup') { this.lines = []; this.bios = false; this.fw.requestSetup(); }
    else if (this.postWant === 'menu') { this.lines = []; this.bios = false; this.fw.openMenu(); }
    else if (this.pc.bios.supervisorPass && this.pc.bios.bootPass) { this.lines = []; this.bios = false; this.fw.openUnlock('boot'); }
    else this.load(now);
    this.postWant = null;
  }
  private fwDone(a: FwAction) {
    const now = performance.now() / 1000;
    if (a.kind === 'reset') this.boot(now); else this.load(now, a.first);
  }
  /** Try the boot devices in their order (or the one picked first) until one boots: only the drive has a system. */
  private load(now: number, first?: BootDev) {
    const pc = this.pc, H = pc.hw;
    this.tq = now; this.lines = []; this.bios = false;
    const order = first ? [first, ...pc.bios.bootOrder.filter((d) => d !== first)] : pc.bios.bootOrder;
    for (const d of order) {
      if (d === 'hdd') break;
      if (d === 'dvd') { this.say(now, 'Booting from CD/DVD Drive...', 0, 0.2); this.seeks(now, 1.6, 3); this.say(now, '  No bootable disc in the drive.', 0, 1.6); }
      else if (d === 'usb') { this.say(now, 'Booting from USB Storage Device...', 0, 0.2); this.say(now, '  No USB storage device found.', 0, 0.4); }
      else { this.say(now, `${H.eth} Boot Agent v1.2.40`, 0, 0.3); this.say(now, 'PXE-E61: Media test failure, check cable', 0, 1.2); this.say(now, 'PXE-M0F: Exiting PXE ROM.', 0, 0.3); }
      this.say(now, '', 0, 0.1);
    }
    // the drive reads the boot loader, then the system's text
    this.then(now, () => { this.lines = []; }, 0.2);
    this.seeks(now, 1.2, 9);
    this.at(now, 1.2);
    this.say(now, `Loading ${H.os} ${H.kernel} .....`, 0, 0.3);
    this.seeks(now, 1.4, 6);
    // the kernel: timestamped as it goes; the slower the machine, the longer it takes
    const kb = H.ramMB * 1024, slow = 1800 / H.cpuMHz, kern = [
      `${H.os} version ${H.kernel} (builder@osprey) #1 SMP`, `BIOS-provided physical RAM map: ${H.ramMB}MB LOWMEM available.`,
      `Detected ${H.cpuMHz}.${Math.floor(hash3(H.cpuMHz, 1, 2) * 900 + 100)} MHz processor.`, `Memory: ${kb - 38 * 1024}k/${kb}k available`,
      `CPU0: ${H.cpu} stepping 0${1 + Math.floor(hash3(H.cpuMHz, 3, 3) * 9)}`, ...(H.cores > 1 ? ['Booting processor 1/2 eip 2000', 'Total of 2 processors activated.'] : []),
      'NET: Registered protocol family 2', 'PCI: Probing PCI hardware', `ACPI: AC Adapter [AC] (${pc.plugged ? 'on-line' : 'off-line'})`, 'ACPI: Battery Slot [BAT0] (battery present)',
      `ata1.00: ATA-7: ${H.disk}, max UDMA/100`, `sd 0:0:0:0: [sda] ${Math.round(H.diskMB * 1953.125)} 512-byte hardware sectors`, ' sda: sda1 sda2 < sda5 >',
      `eth0: ${H.eth}, link down`, ...(pc.bios.wlan ? [`wlan0: ${H.wlan} card, firmware 4.1`] : []), 'EXT3-fs: mounted filesystem with ordered data mode.', 'Adding 1004052k swap on /dev/sda5.',
    ];
    let ts = 0;
    for (const k of kern) {
      ts += (0.02 + hash3(ts * 1000, 5, 6) * 0.12) * slow;
      const s = `[${ts.toFixed(6).padStart(12)}] ${k}`;
      this.kmsg.push(s);
      this.say(now, s, 1, (0.03 + hash3(k.length, 7, 8) * 0.14) * slow);
      if (k.startsWith('ata') || k.startsWith('EXT3')) this.seeks(now, 0.3, 8);
    }
    this.say(now, '', 0, 0.2);
    // the services: each takes its time and its memory
    const svc: [string, string, number][] = [['Starting system log daemon', 'syslogd', 620], ['Starting kernel log daemon', 'klogd', 410], ['Loading hardware drivers', 'udevd', 760],
      ['Checking file systems', '', 0], ['Starting periodic command scheduler', 'crond', 540], ['Configuring network interfaces', '', 0]];
    this.then(now, () => { pc.spawn('init', 'root', 310, now); });
    for (const [label, name, mem] of svc) {
      this.say(now, `${label}...`, 0, 0.1 * slow);
      this.seeks(now, 0.25 * slow, 7);
      this.redo(now, `${label}...`.padEnd(TERM_W - 8) + '[ OK ]', 0.15 + 0.35 * slow * hash3(label.length, 9, 9));
      if (name) this.then(now, () => { pc.spawn(name, 'root', mem, now); });
    }
    this.say(now, '', 0, 0.3);
    this.say(now, `${H.os} ${H.host} tty1`, 0, 0.2);
    this.say(now, '', 0, 0);
    this.login(now);
  }
  private login(now: number) {
    const H = this.pc.hw;
    this.say(now, `${H.host} login: ${H.user}`, 0, 0.4);
    this.say(now, 'Password:', 0, 0.5);
    this.seeks(now, 0.3, 6);
    const last = calendar(this.clock - 3600 * 26);
    this.say(now, `Last login: ${WDAY[last.weekday]} ${MON[last.month - 1]} ${String(last.day).padStart(2)} ${p2(Math.floor(last.hour))}:${p2(Math.floor((last.hour % 1) * 60))} on tty1`, 0, 0.6);
    for (const m of L.motd) this.say(now, fill(m, { os: H.os, kernel: H.kernel, host: H.host, user: H.user }), 1);
    this.then(now, () => {
      const p = this.pc.spawn('sh', H.user, 1800, now);
      this.shellPid = p?.pid ?? 0;
      this.state = 'ready'; this.cwd = `/home/${H.user}`;
    });
    this.busyUntil = this.tq;
  }
  /** Back from suspend (the lid was closed): the screen comes back as it was. */
  resume(now: number) {
    this.tq = now;
    this.say(now, '', 1, 0.9);
    this.redo(now, '', 0);
    this.busyUntil = this.tq;
  }
  /**
   * The power button pressed while it runs: at the prompt the system halts cleanly (the button
   * tells it to, as ACPI does); anywhere else (the firmware, booting, busy) it cuts the power.
   */
  powerButton(now: number) {
    if (this.halted) return;
    if (this.state === 'ready' && !this.editor && !this.fw.mode) { this.shutdown(now, false); return; }
    this.queue = []; this.editor = null; this.fw.close(); this.bios = false; this.inPost = false;
    this.pc.halt(); this.state = 'off'; this.halted = true; this.lines = [];
    this.sound(now, 'spindown', 0);
  }
  shutdown(now: number, reboot: boolean) {
    const pc = this.pc;
    this.state = 'boot';
    this.say(now, '');
    this.say(now, `Broadcast message from ${pc.hw.user}@${pc.hw.host} (tty1):`, 0, 0.1);
    this.say(now, `The system is going down for ${reboot ? 'reboot' : 'system halt'} NOW!`, 0, 0.1);
    for (const s of ['Stopping periodic command scheduler', 'Stopping kernel log daemon', 'Stopping system log daemon', 'Unmounting local filesystems', 'Deactivating swap']) {
      this.say(now, `${s}...`, 0, 0.15);
      this.seeks(now, 0.2, 8);
      this.redo(now, `${s}...`.padEnd(TERM_W - 8) + '[ OK ]', 0.2);
    }
    this.say(now, reboot ? 'Will now restart.' : 'Will now halt.', 0, 0.3);
    this.sound(now, 'spindown', 0.3);
    if (reboot) this.then(now, () => this.boot(performance.now() / 1000), 1.2);
    else this.then(now, () => { pc.halt(); this.state = 'off'; this.halted = true; this.lines = []; }, 0.8);
    this.busyUntil = this.tq;
  }

  // ---- the keyboard ----
  /** A key typed at the prompt (`key` as the browser names it). */
  key(key: string, ctrl: boolean, now: number) {
    if (this.fw.mode) { this.fw.key(key); return; }
    if (this.inPost) {
      // F12 may be the browser's (its tools): F9 opens the boot menu too
      const want = key === 'F2' ? 'setup' : key === 'F12' || key === 'F9' ? 'menu' : null;
      if (want && !this.postWant) {
        this.postWant = want;
        const last = this.lines[this.lines.length - 1];
        if (last?.text.startsWith('  Press F2')) last.text = this.postMsg();
      }
      return;
    }
    if (this.state !== 'ready') return;
    if (this.editor) { this.editor.key(key, ctrl); return; }
    if (ctrl && (key === 'c' || key === 'C')) {
      if (!this.ready) this.interrupt(now);
      else { this.lines.push({ text: this.prompt + (this.mask ? '*'.repeat(this.input.length) : this.input) + '^C', ink: 0 }); this.input = ''; this.cur = 0; this.mask = false; }
      return;
    }
    if (ctrl && (key === 'l' || key === 'L')) { this.lines = []; return; }
    if (!this.ready) return; // what is typed while a command works is lost (no type-ahead yet)
    this.scroll = 0;
    const s = this.input;
    if (key === 'Enter') { this.run(s, now); return; }
    if (key === 'Backspace') { if (this.cur > 0) { this.input = s.slice(0, this.cur - 1) + s.slice(this.cur); this.cur--; } return; }
    if (key === 'Delete') { this.input = s.slice(0, this.cur) + s.slice(this.cur + 1); return; }
    if (key === 'ArrowLeft') { this.cur = Math.max(0, this.cur - 1); return; }
    if (key === 'ArrowRight') { this.cur = Math.min(s.length, this.cur + 1); return; }
    if (key === 'Home') { this.cur = 0; return; }
    if (key === 'End') { this.cur = s.length; return; }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (!this.hist.length) return;
      this.hi = key === 'ArrowUp' ? (this.hi < 0 ? this.hist.length - 1 : Math.max(0, this.hi - 1)) : this.hi < 0 ? -1 : this.hi + 1;
      if (this.hi >= this.hist.length) this.hi = -1;
      this.input = this.hi < 0 ? '' : this.hist[this.hi]; this.cur = this.input.length;
      return;
    }
    if (key === 'Tab') { this.complete(); return; }
    if (key.length === 1 && s.length < 200) { this.input = s.slice(0, this.cur) + key + s.slice(this.cur); this.cur++; }
  }
  /** Tab: the command's name, or the path being typed, as far as it is the only way to go. */
  private complete() {
    const s = this.input.slice(0, this.cur), k = s.lastIndexOf(' ') + 1, word = s.slice(k);
    let names: string[], dir = '';
    if (k === 0) names = [...BUILTINS, ...[...PATH, `/home/${this.pc.hw.user}/bin`].flatMap((d) => [...(this.pc.get(d)?.kids?.keys() ?? [])])];
    else {
      const j = word.lastIndexOf('/');
      dir = j >= 0 ? word.slice(0, j + 1) : '';
      const n = this.pc.get(this.pc.abs(this.cwd, dir || '.'));
      names = n?.kids ? [...n.kids.values()].map((f) => f.name + (f.dir ? '/' : '')) : [];
    }
    const base = word.slice(dir.length), hits = [...new Set(names)].filter((n) => n.startsWith(base) && (base.startsWith('.') || !n.startsWith('.')));
    if (!hits.length) return;
    let pre = hits[0];
    for (const h of hits) while (!h.startsWith(pre)) pre = pre.slice(0, -1);
    if (hits.length > 1 && pre === base) { this.lines.push({ text: this.prompt + this.input, ink: 0 }, { text: hits.sort().join('  ').slice(0, TERM_W * 3), ink: 0 }); return; }
    const add = pre.slice(base.length) + (hits.length === 1 && k === 0 ? ' ' : '');
    this.input = s + add + this.input.slice(this.cur); this.cur += add.length;
  }

  // ---- the commands ----
  private run(line: string, now: number) {
    this.lines.push({ text: this.prompt + (this.mask ? '*'.repeat(line.length) : line), ink: 2 });
    this.input = ''; this.cur = 0; this.hi = -1; this.tq = now;
    const wasMasked = this.mask; this.mask = false;
    if (this.conn) { this.remote(line.trim(), wasMasked, now); this.busyUntil = this.tq; return; }
    const t = line.trim();
    if (!t) return;
    if (this.hist[this.hist.length - 1] !== t) this.hist.push(t);
    // > and >> send what it prints to a file
    let redir: [string, boolean] | null = null;
    const m = /^(.*?)\s*(>>?)\s*(\S+)\s*$/.exec(t);
    let cmd = t;
    if (m) { cmd = m[1]; redir = [m[3], m[2] === '>>']; }
    const argv = cmd.match(/"[^"]*"|'[^']*'|\S+/g)?.map((a) => a.replace(/^["']|["']$/g, '')) ?? [];
    if (!argv.length) return;
    const name = argv[0], pc = this.pc;
    // a program has to be on the disk and fit in the memory
    let prog: FsNode | null = null;
    if (!BUILTINS.has(name)) {
      for (const d of name.includes('/') ? [''] : [...PATH, `/home/${pc.hw.user}/bin`]) { const f = pc.get(d ? `${d}/${name}` : pc.abs(this.cwd, name)); if (f?.exec) { prog = f; break; } }
      if (!prog) { this.say(now, fill(L.err.notfound, { c: name })); this.busyUntil = this.tq; return; }
      const p = pc.spawn(prog.exec!, pc.hw.user, prog.memKB, now);
      if (!p) { this.say(now, fill(L.err.nomem, { c: name }), 0, 0.05); this.busyUntil = this.tq; return; }
      this.job = p.pid;
      this.seeks(now, 0.01 + pc.workS(prog.size, 1) * 0.5, 30);
      this.at(now, pc.workS(prog.size, 1) * 0.3); // loading it (most of it is in the cache)
    }
    const out: string[] = [];
    const work = this.exec(prog?.exec ?? name, argv.slice(1), out, now);
    if (redir) {
      const path = pc.abs(this.cwd, redir[0]), [dir, base] = pc.parent(path), f = pc.get(path);
      const text = out.join('\n') + (out.length ? '\n' : '');
      if (!dir?.dir) out.splice(0, out.length, fill(L.err.nofile, { c: 'sh', p: redir[0] }));
      else if (f?.dir) out.splice(0, out.length, fill(L.err.isdir, { c: 'sh', p: redir[0] }));
      else if (!pc.writable(path, pc.hw.user)) out.splice(0, out.length, fill(L.err.denied, { c: 'sh', p: redir[0] }));
      else { const old = redir[1] && f?.data ? f.data : ''; pc.put(path, old + text, pc.hw.user, this.clock); dir.mtime = this.clock; void base; out.length = 0; }
    }
    // what it prints comes as the work gets done: spread over its time, or at the terminal's pace
    if (work > 0) {
      if (work > 0.5) this.heavyUntil = Math.max(now, this.tq) + work;
      this.seeks(now, work, 6);
      const each = work / Math.max(1, out.length);
      if (!out.length) this.at(now, work);
      for (const s of out) this.say(now, s, 0, each);
    } else for (const s of out) this.say(now, s);
    const pid = this.job;
    if (pid) this.then(now, () => { this.pc.kill(pid); if (this.job === pid) this.job = 0; }, 0, true);
    this.busyUntil = this.tq;
  }

  /** The strongest access point in range broadcasting this ESSID, or -1. */
  private findAp(essid: string): number {
    let best = -1, bd = -1e9;
    for (const [i, d] of this.net.list) if (wifiName(this.world.city, this.world.wifi[i]) === essid && d > bd) { bd = d; best = i; }
    return best;
  }
  /** The hosts on the joined network, or null when offline. */
  private lan(): Host[] | null { return this.net.state === 'up' ? lanHosts(this.world, this.net.ap) : null; }

  /** A line typed in an open tnet session: the login, the password, or a console command on the host. */
  private remote(line: string, _masked: boolean, now: number) {
    const C = this.conn!;
    if (C.stage === 'login') { C.tryUser = line; C.stage = 'pass'; this.mask = true; return; }
    if (C.stage === 'pass') {
      if (C.tryUser === C.host.user && line === C.host.pass) { C.stage = 'shell'; this.say(now, '', 0, 0.2); this.say(now, C.host.ports[0].banner, 0, 0.1); this.say(now, `Type 'help' for commands, 'exit' to disconnect.`, 0, 0.1); }
      else { this.say(now, 'Login incorrect', 0, 0.4); this.say(now, '', 0, 0.1); C.stage = 'login'; C.tryUser = ''; }
      return;
    }
    const w = this.world, k = C.host.sub, argv = line.split(/\s+/).filter(Boolean), c = argv[0] ?? '';
    const close = () => { this.say(now, 'Connection closed.', 0, 0.2); this.conn = null; };
    if (c === 'exit' || c === 'quit' || c === 'logout') { close(); return; }
    if (c === '') return;
    if (c === 'help') {
      if (C.host.kind === 'rtu') this.say(now, 'commands: status | breaker open | breaker close | exit', 0, 0.1);
      else if (C.host.kind === 'signal') this.say(now, 'commands: status | mode normal | mode flash | mode dark | exit', 0, 0.1);
      else this.say(now, 'commands: status | exit', 0, 0.1);
      return;
    }
    if (C.host.kind === 'rtu') {
      const on = w.power.subs[k].on;
      if (c === 'status') { this.say(now, `RTU-300 substation ${String(k + 1).padStart(2, '0')}: breaker ${on ? 'CLOSED (energized)' : 'OPEN (de-energized)'}`, 0, 0.2); return; }
      if (c === 'breaker' && (argv[1] === 'open' || argv[1] === 'close')) {
        const want = argv[1] === 'close';
        this.say(now, `> breaker ${argv[1]}`, 0, 0.3);
        if (!setBreaker(w, k, want)) { this.say(now, `  breaker already ${want ? 'closed' : 'open'}`, 0, 0.1); return; }
        this.say(now, want ? '  ACK: breaker closed, feeder re-energizing' : '  ACK: breaker tripped, feeder de-energized', 2, 0.2);
        return;
      }
      this.say(now, `unknown command (try 'help')`, 0, 0.1); return;
    }
    if (C.host.kind === 'signal') {
      const sig = w.power.subs[k].sig, name = ['NORMAL', 'FLASH', 'DARK'][sig];
      if (c === 'status') { this.say(now, `ATC-2 cabinet, district ${String(k + 1).padStart(2, '0')}: mode ${name}`, 0, 0.2); return; }
      if (c === 'mode' && ['normal', 'flash', 'dark'].includes(argv[1])) {
        const m = ['normal', 'flash', 'dark'].indexOf(argv[1]);
        this.say(now, `> mode ${argv[1]}`, 0, 0.3);
        setSignals(w, k, m);
        this.say(now, `  ACK: all intersections -> ${argv[1].toUpperCase()}`, 2, 0.2);
        return;
      }
      this.say(now, `unknown command (try 'help')`, 0, 0.1); return;
    }
    if (c === 'status') { this.say(now, `${C.host.name}: online`, 0, 0.1); return; }
    this.say(now, `unknown command (try 'help')`, 0, 0.1);
  }
  private err(out: string[], k: keyof typeof L.err, c: string, p = '') { out.push(fill(L.err[k], { c, p, u: p })); }
  /** Run a command; it prints into `out` and returns the seconds of work it took (0: none to speak of). */
  private exec(c: string, a: string[], out: string[], now: number): number {
    const pc = this.pc, H = pc.hw, u = H.user, w = this.world;
    const flags = new Set(a.filter((x) => x.startsWith('-')).flatMap((x) => [...x.slice(1)])), args = a.filter((x) => !x.startsWith('-'));
    const path = (p: string) => pc.abs(this.cwd, p);
    const when = (t: number) => { const k = calendar(t); return `${MON[k.month - 1]} ${String(k.day).padStart(2)} ${p2(Math.floor(k.hour))}:${p2(Math.floor((k.hour % 1) * 60))}`; };
    switch (c) {
      case 'help': out.push(...L.help); return 0;
      case 'man': {
        if (!args[0]) { this.err(out, 'usage', c, 'man command'); return 0; }
        const f = pc.get(`/usr/share/man/man1/${args[0]}.1`);
        if (!f?.data) { this.err(out, 'noman', c, args[0]); return 0; }
        out.push(`${args[0].toUpperCase()}(1)`.padEnd(TERM_W - 18) + 'User Commands', '', ...f.data.trimEnd().split('\n'), '');
        return pc.workS(f.size, 1);
      }
      case 'cd': {
        const p = path(args[0] ?? '~'), n = pc.get(p);
        if (!n) this.err(out, 'nofile', c, args[0]); else if (!n.dir) this.err(out, 'notdir', c, args[0]); else this.cwd = p;
        return 0;
      }
      case 'pwd': out.push(this.cwd); return 0;
      case 'ls': {
        let files = 0;
        for (const p of args.length ? args : ['.']) {
          const n = pc.get(path(p));
          if (!n) { this.err(out, 'nofile', c, p); continue; }
          const list = n.dir ? [...n.kids!.values()].filter((f) => flags.has('a') || !f.name.startsWith('.')).sort((x, y) => x.name.localeCompare(y.name)) : [n];
          files += list.length;
          if (args.length > 1) out.push(`${p}:`);
          if (flags.has('l')) {
            out.push(`total ${Math.ceil(list.reduce((s, f) => s + f.size, 0) / 1024)}`);
            for (const f of list) out.push(`${f.dir ? 'drwxr-xr-x' : f.exec ? '-rwxr-xr-x' : '-rw-r--r--'} 1 ${f.owner.padEnd(5)} ${f.owner.padEnd(5)} ${String(f.size).padStart(10)} ${when(f.mtime)} ${f.name}${f.dir ? '/' : ''}`);
          } else {
            const names = list.map((f) => f.name + (f.dir ? '/' : f.exec ? '*' : '')), wd = Math.min(TERM_W, Math.max(...names.map((x) => x.length), 1) + 2), per = Math.max(1, Math.floor(TERM_W / wd));
            for (let k = 0; k < names.length; k += per) out.push(names.slice(k, k + per).map((x) => x.padEnd(wd)).join('').trimEnd());
          }
        }
        return files > 40 ? pc.workS(0, Math.ceil(files / 40)) : 0;
      }
      case 'cat': case 'head': case 'wc': {
        const nLines = c === 'head' ? Number(a[a.indexOf('-n') + 1]) || 10 : Infinity;
        let bytes = 0, files = 0;
        for (const p of args.filter((x) => c !== 'head' || x !== String(nLines))) {
          const n = pc.get(path(p));
          if (!n) { this.err(out, 'nofile', c, p); continue; }
          if (n.dir) { this.err(out, 'isdir', c, p); continue; }
          const text = p.startsWith('/proc/') || path(p).startsWith('/proc/') ? this.proc(path(p), now) : n.data;
          files++; bytes += n.size;
          if (c === 'wc') { const t = text ?? ''; out.push(`${String(t.split('\n').length - 1).padStart(7)} ${String(t.split(/\s+/).filter(Boolean).length).padStart(7)} ${String(n.size).padStart(9)} ${p}`); continue; }
          if (text === null) { out.push(...this.binary(n, Math.min(nLines, 12))); continue; }
          out.push(...text.replace(/\n$/, '').split('\n').slice(0, nLines));
        }
        return pc.workS(Math.min(bytes, 64 * 1024), files);
      }
      case 'touch': case 'mkdir': {
        for (const p of args) {
          const q = path(p), [dir] = pc.parent(q), n = pc.get(q);
          if (!dir?.dir) { this.err(out, 'nofile', c, p); continue; }
          if (!pc.writable(q, u)) { this.err(out, 'denied', c, p); continue; }
          if (c === 'mkdir') { if (n) this.err(out, 'exists', c, p); else pc.mkdirs(q, u, this.clock); }
          else if (n) n.mtime = this.clock; else pc.put(q, '', u, this.clock);
          dir.mtime = this.clock;
        }
        return 0;
      }
      case 'rm': case 'rmdir': {
        let files = 0;
        for (const p of args) {
          const q = path(p), [dir, base] = pc.parent(q), n = pc.get(q);
          if (!n || !dir) { this.err(out, 'nofile', c, p); continue; }
          if (!pc.writable(q, u) || q === `/home/${u}`) { this.err(out, 'denied', c, p); continue; }
          if (c === 'rmdir' && !n.dir) { this.err(out, 'notdir', c, p); continue; }
          if (c === 'rmdir' && n.kids!.size) { this.err(out, 'notempty', c, p); continue; }
          if (c === 'rm' && n.dir && !flags.has('r')) { this.err(out, 'isdir', c, p); continue; }
          files += n.dir ? this.count(n) : 1;
          dir.kids!.delete(base); dir.mtime = this.clock;
          if (this.cwd === q || this.cwd.startsWith(q + '/')) this.cwd = q.slice(0, q.lastIndexOf('/')) || '/';
        }
        return files > 3 ? pc.workS(0, files) : 0;
      }
      case 'cp': case 'mv': {
        if (args.length !== 2) { this.err(out, 'usage', c, `${c} source dest`); return 0; }
        const s = path(args[0]), n = pc.get(s);
        if (!n) { this.err(out, 'nofile', c, args[0]); return 0; }
        let d = path(args[1]);
        if (pc.get(d)?.dir) d = `${d}/${n.name}`;
        const [dir, base] = pc.parent(d), [sdir, sbase] = pc.parent(s);
        if (!dir?.dir) { this.err(out, 'nofile', c, args[1]); return 0; }
        if (!pc.writable(d, u) || (c === 'mv' && !pc.writable(s, u))) { this.err(out, 'denied', c, c === 'mv' && !pc.writable(s, u) ? args[0] : args[1]); return 0; }
        if (c === 'mv') { sdir!.kids!.delete(sbase); n.name = base; dir.kids!.set(base, n); dir.mtime = this.clock; return 0; }
        if (n.dir) { this.err(out, 'isdir', c, args[0]); return 0; }
        if (n.size / 1048576 > pc.freeMB()) { this.err(out, 'nospace', c, args[1]); return pc.workS(pc.freeMB() * 1048576, 1); }
        // the copy is there once it has been read and written
        const work = pc.workS(n.size * 2, 2);
        this.at(now, work);
        this.then(now, () => { const f = pc.put(d, n.data ?? n.size, u, this.clock, n.exec, n.memKB); f.size = n.size; });
        this.seeks(now - work, work, 6);
        return 0;
      }
      case 'echo': out.push(args.join(' ')); return 0;
      case 'find': {
        const root = path(args[0] && !a[0].startsWith('-') ? args[0] : '.'), n = pc.get(root), pat = a.includes('-name') ? a[a.indexOf('-name') + 1] : null;
        if (!n) { this.err(out, 'nofile', c, args[0]); return 0; }
        const re = pat ? new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$') : null;
        const walk = (f: FsNode, p: string) => {
          if (!re || re.test(f.name)) out.push(p || '/');
          if (f.dir) for (const k of [...f.kids!.values()].sort((x, y) => x.name.localeCompare(y.name))) walk(k, `${p === '/' ? '' : p}/${k.name}`);
        };
        walk(n, root === '/' ? '/' : root);
        return pc.workS(0, Math.ceil(this.count(n) / 8));
      }
      case 'du': {
        const p = path(args[0] ?? '.'), n = pc.get(p);
        if (!n) { this.err(out, 'nofile', c, args[0]); return 0; }
        if (!flags.has('s') && n.dir) for (const k of n.kids!.values()) if (k.dir) out.push(`${Math.ceil(pc.du(k) / 1024)}\t${args[0] ?? '.'}/${k.name}`);
        out.push(`${Math.ceil(pc.du(n) / 1024)}\t${args[0] ?? '.'}`);
        return pc.workS(0, Math.ceil(this.count(n) / 8));
      }
      case 'uname': out.push(flags.has('a') ? `OspreyUX ${H.host} ${H.kernel} #1 SMP i686 ${H.cpu}` : 'OspreyUX'); return 0;
      case 'uptime': {
        const up = (w.time - this.bootT) / 60, k = calendar(this.clock), load = (0.02 + pc.procs.length * 0.01).toFixed(2);
        out.push(` ${p2(Math.floor(k.hour))}:${p2(Math.floor((k.hour % 1) * 60))}:${p2(Math.floor(((k.hour * 60) % 1) * 60))} up ${Math.floor(up / 60)}:${p2(Math.floor(up % 60))},  1 user,  load average: ${load}, ${load}, 0.00`);
        return 0;
      }
      case 'date': {
        const k = calendar(this.clock);
        out.push(`${WDAY[k.weekday]} ${MON[k.month - 1]} ${String(k.day).padStart(2)} ${p2(Math.floor(k.hour))}:${p2(Math.floor((k.hour % 1) * 60))}:${p2(Math.floor(((k.hour * 60) % 1) * 60))} EST ${k.year}`);
        return 0;
      }
      case 'ps': {
        out.push('  PID USER       RSS COMMAND');
        for (const p of pc.procs) out.push(`${String(p.pid).padStart(5)} ${p.user.padEnd(6)} ${String(p.memKB).padStart(8)} ${p.name}`);
        return 0;
      }
      case 'kill': {
        const pid = Number(args[0]), p = pc.procs.find((x) => x.pid === pid);
        if (!args[0]) this.err(out, 'usage', c, 'kill pid');
        else if (!p) this.err(out, 'nosuch', c, args[0]);
        else if (p.user !== u) this.err(out, 'noperm', c, args[0]);
        else if (pid === this.shellPid) { this.then(now, () => this.logout(performance.now() / 1000)); }
        else pc.kill(pid);
        return 0;
      }
      case 'free': {
        const m = flags.has('m') ? 1024 : 1, tot = H.ramMB * 1024, used = pc.usedKB(), f = (n: number) => String(Math.round(n / m)).padStart(11);
        out.push('             total       used       free', `Mem:   ${f(tot)}${f(used)}${f(tot - used)}`, `Swap:  ${f(1004052)}${f(0)}${f(1004052)}`);
        return 0;
      }
      case 'df': {
        const h = flags.has('h'), g = (mb: number) => (h ? `${(mb / 1000).toFixed(1)}G` : String(Math.round(mb * 1000))).padStart(h ? 7 : 11);
        out.push(`Filesystem   ${h ? '   Size    Used   Avail' : '  1K-blocks       Used  Available'} Use% Mounted on`);
        out.push(`/dev/sda1    ${g(H.diskMB)} ${g(pc.usedMB())} ${g(pc.freeMB())} ${String(Math.round((pc.usedMB() / H.diskMB) * 100)).padStart(3)}% /`);
        return 0;
      }
      case 'dmesg': out.push(...this.kmsg); return 0;
      case 'whoami': out.push(u); return 0;
      case 'id': out.push(`uid=1000(${u}) gid=1000(${u}) groups=1000(${u}),20(dialout),24(cdrom),44(video),46(plugdev),110(netdev)`); return 0;
      case 'hostname': out.push(H.host); return 0;
      case 'history': this.hist.forEach((h, k) => out.push(`${String(k + 1).padStart(5)}  ${h}`)); return 0;
      case 'lshw': {
        out.push(`${H.host}`, `    description: Notebook`, `    product: ${H.model}`, `  *-cpu`, `       product: ${H.cpu}`, `       size: ${H.cpuMHz}MHz`, `       cores: ${H.cores}`,
          `  *-memory`, `       size: ${H.ramMB}MiB`, `  *-disk`, `       product: ${H.disk}`, `       size: ${Math.round(H.diskMB / 1000)}GB`, `       capabilities: 5400rpm, ${H.diskMBs}MB/s`,
          `  *-network:0`, `       logical name: eth0`, `       product: ${H.eth}`, `       serial: ${this.mac(0)}`, `  *-network:1`, `       logical name: wlan0`, `       product: ${H.wlan}`, `       serial: ${this.mac(1)}`);
        return 0.4 * (1800 / H.cpuMHz);
      }
      case 'ifconfig': {
        out.push(`eth0      Link encap:Ethernet  HWaddr ${this.mac(0)}`, '          UP BROADCAST MULTICAST  MTU:1500  Metric:1', '          RX packets:0 errors:0 dropped:0', '          TX packets:0 errors:0 dropped:0', '');
        out.push('lo        Link encap:Local Loopback', '          inet addr:127.0.0.1  Mask:255.0.0.0', '          UP LOOPBACK RUNNING  MTU:16436  Metric:1', '');
        const up = this.net.state === 'up';
        if (!pc.bios.wlan) return 0;
        out.push(`wlan0     Link encap:Ethernet  HWaddr ${this.mac(1)}`);
        if (up) out.push(`          inet addr:${this.net.ip}  Bcast:${this.net.ip.replace(/\.\d+$/, '.255')}  Mask:255.255.255.0`);
        out.push(`          ${up ? 'UP BROADCAST RUNNING MULTICAST' : 'BROADCAST MULTICAST'}  MTU:1500  Metric:1`, '          RX packets:0 errors:0 dropped:0', '          TX packets:0 errors:0 dropped:0', '');
        return 0;
      }
      case 'iwconfig': {
        if (!pc.bios.wlan) { out.push('lo        no wireless extensions.', '', 'eth0      no wireless extensions.', '', 'wlan0     No such device', ''); return 0; }
        // with arguments it joins a network: iwconfig wlan0 essid "NAME" [key KEY]
        if (args[0] === 'wlan0' && (a.includes('essid') || a.includes('key'))) {
          const ei = a.indexOf('essid');
          if (ei >= 0 && a[ei + 1]) this.essid = a[ei + 1];
          const ki = a.indexOf('key'), key = ki >= 0 ? a[ki + 1] ?? '' : '';
          const i = this.findAp(this.essid);
          if (i < 0) { out.push(`Error for wireless request "Set ESSID": network "${this.essid}" not in range`); return 0; }
          this.net.connect(this.world, i, key, now);
          out.push(`wlan0     associating with "${this.essid}"...`);
          return 0.3;
        }
        out.push('lo        no wireless extensions.', '', 'eth0      no wireless extensions.', '');
        const N = this.net, joined = N.ap >= 0 ? this.world.wifi[N.ap] : null, nm = joined ? wifiName(this.world.city, joined) : '';
        if (joined) out.push(`wlan0     IEEE 802.11bg  ESSID:"${nm}"`, `          Mode:Managed  Frequency:2.4${joined.ch} GHz  Access Point: ${joined.bssid}`, '          Bit Rate:54 Mb/s   Tx-Power=20 dBm', `          Encryption key:${joined.sec === Sec.Open ? 'off' : 'on'}`, `          Link Quality:${N.bars}/4  Signal level:${N.dbm} dBm  Noise level:-92 dBm`, '');
        else out.push('wlan0     IEEE 802.11bg  ESSID:off/any', '          Mode:Managed  Access Point: Not-Associated', '          Tx-Power=20 dBm', '          Link Quality:0  Signal level:0  Noise level:0', '');
        return 0;
      }
      case 'iwlist': {
        if (!pc.bios.wlan) { out.push('wlan0     Interface doesn\'t support scanning : No such device'); return 0; }
        // scan the wireless networks in range (sim/wifi.ts), strongest first
        this.net.scanNow();
        const list = this.net.list.slice(0, 24);
        out.push('wlan0     Scan completed :');
        if (!list.length) out.push('          No networks in range.');
        list.forEach(([i, d], k) => {
          const A = this.world.wifi[i], nm = wifiName(this.world.city, A), q = Math.max(0, Math.min(100, 2 * (d + 100)));
          out.push(`          Cell ${String(k + 1).padStart(2, '0')} - Address: ${A.bssid}`, `                    ESSID:"${nm}"`, `                    Channel:${A.ch}  Quality=${q}/100  Signal level:${d} dBm`, `                    Encryption key:${A.sec === Sec.Open ? 'off' : 'on'}${A.sec ? (A.sec === Sec.WEP ? '  (WEP)' : '  (WPA)') : ''}`);
        });
        return this.net.list.length ? 1.2 : 0.4;
      }
      case 'dhclient': {
        const N = this.net;
        if (!pc.bios.wlan) { out.push('wlan0: No such device'); return 0; }
        if (N.ap < 0) { out.push('wlan0: not associated; run iwconfig wlan0 essid "NAME" [key KEY] first'); return 0; }
        this.say(now, 'Internet Systems Consortium DHCP Client', 0, 0.1);
        this.say(now, `Listening on LPF/wlan0/${this.mac(1).toLowerCase()}`, 0, 0.2);
        this.say(now, 'DHCPDISCOVER on wlan0 to 255.255.255.255 port 67', 0, 0.6);
        this.say(now, `DHCPOFFER from 192.168.${this.world.wifi[N.ap].ch}.1`, 0, 1.0);
        this.say(now, 'DHCPREQUEST on wlan0 to 255.255.255.255 port 67', 0, 0.3);
        // the lease is ready once the card finishes associating (driven in update); read it then
        this.then(now, () => {
          if (N.state === 'badkey') { this.lines.push({ text: 'wlan0: authentication failed (wrong key)', ink: 0 }); return; }
          if (N.state !== 'up') { this.lines.push({ text: 'No DHCPOFFERS received.', ink: 0 }); return; }
          this.lines.push({ text: `DHCPACK from 192.168.${this.world.wifi[N.ap].ch}.1`, ink: 0 });
          this.lines.push({ text: `bound to ${N.ip} -- renewal in 43200 seconds.`, ink: 0 });
        }, 1.2);
        this.busyUntil = this.tq;
        return 0;
      }
      case 'ping': {
        const host = args[0];
        if (!host) { this.err(out, 'usage', c, 'ping host'); return 0; }
        if (this.net.state !== 'up') { out.push('connect: Network is unreachable'); return 0; }
        const gw = `192.168.${this.world.wifi[this.net.ap].ch}.1`, dst = host === 'gw' || host === 'gateway' ? gw : host;
        this.say(now, `PING ${dst} (${dst}) 56(84) bytes of data.`, 0, 0.1);
        const base = 4 + (4 - this.net.bars) * 12;
        for (let k = 0; k < 4; k++) {
          const t = (base + hash3(k, this.world.tick, 3) * 10).toFixed(1);
          this.say(now, `64 bytes from ${dst}: icmp_seq=${k + 1} ttl=64 time=${t} ms`, 0, 0.6);
        }
        this.say(now, '', 0, 0.3);
        this.say(now, `--- ${dst} ping statistics ---`, 0, 0);
        this.say(now, '4 packets transmitted, 4 received, 0% packet loss', 0, 0);
        this.busyUntil = this.tq;
        return 0;
      }
      case 'mmap': {
        // the port scanner: the hosts on the joined network and the services they answer on
        const lan = this.lan();
        if (!lan) { out.push('mmap: no network (join one and run dhclient first)'); return 0; }
        const one = args[0], hosts = one ? lan.filter((x) => x.ip === one) : lan;
        if (one && !hosts.length) { out.push(`mmap: host ${one} down or not on this network`); return 0; }
        this.say(now, `mmap 2.3 scan started at ${when(w.time)}`, 0, 0.1);
        this.say(now, '', 0, 0);
        for (const hst of hosts) {
          this.say(now, `Host ${hst.ip} (${hst.name}) is up [${hst.mac}]`, 0, 0.35);
          this.say(now, '  PORT    STATE  SERVICE      BANNER', 0, 0.05);
          for (const pt of hst.ports) this.say(now, `  ${String(pt.n).padEnd(6)}  open   ${pt.service.padEnd(12)} ${pt.banner}`, 0, 0.12);
          this.say(now, '', 0, 0);
        }
        this.say(now, `${hosts.length} host${hosts.length === 1 ? '' : 's'} scanned.`, 0, 0.1);
        this.busyUntil = this.tq;
        return 0;
      }
      case 'bruter': {
        // the password tester: run the word list against a host's console (port 23)
        const lan = this.lan();
        if (!lan) { out.push('bruter: no network'); return 0; }
        const hst = lan.find((x) => x.ip === args[0]);
        if (!args[0]) { out.push('usage: bruter <ip> [login]'); return 0; }
        if (!hst) { out.push(`bruter: host ${args[0]} not found`); return 0; }
        const port = hst.ports.find((p) => p.n === 23);
        if (!port || !hst.user) { out.push(`bruter: ${args[0]} has no console to test (no login service on 23)`); return 0; }
        const login = args[1] ?? hst.user;
        this.say(now, `bruter: ${login}@${hst.ip}:23 — ${WORDS.length} candidates`, 0, 0.1);
        const idx = login === hst.user ? WORDS.indexOf(hst.pass) : -1, shown = idx < 0 ? WORDS.length : idx + 1;
        for (let k = 0; k < shown; k += Math.max(1, Math.floor(shown / 6))) this.say(now, `  [${String(k + 1).padStart(3)}/${WORDS.length}] ${WORDS[k]} ...`, 1, 0.18);
        if (idx >= 0) { this.say(now, '', 0, 0.1); this.say(now, `  PASSWORD FOUND  login:${login}  password:${hst.pass}`, 2, 0.1); }
        else { this.say(now, '', 0, 0.1); this.say(now, `  exhausted — ${login} is not a known login here`, 0, 0.1); }
        this.busyUntil = this.tq;
        return 0;
      }
      case 'tdump': {
        // the packet sniffer: the frames on the joined network, materialized from the simulation's
        // flows (sim/packets.ts). What reads in the clear follows the encryption — an open or WEP
        // network (we hold the key), or a station whose WPA handshake was captured. A technician
        // logged into a substation terminal leaks the login that way. -c N caps the frame count.
        if (this.net.state !== 'up') { out.push('tdump: no network (join one with iwconfig/dhclient first)'); return 0; }
        const A = w.wifi[this.net.ap], ssid = wifiName(w.city, A), sec = A.sec === Sec.Open ? 'open' : A.sec === Sec.WEP ? 'WEP' : 'WPA';
        const ci = a.indexOf('-c'), limit = ci >= 0 ? Math.max(1, Math.min(400, Number(a[ci + 1]) || 60)) : 60;
        const pkts = capture(w, this.net.ap, ssid, this.net.dbm, w.time, 8, limit);
        this.say(now, `tdump: listening on wlan0, channel ${A.ch}, ${sec}, link-type IEEE802_11 (${this.net.dbm} dBm)`, 0, 0.1);
        for (const p of pkts) this.say(now, `${p.t.toFixed(6).padStart(11)}  ${p.info}`, p.ink, 0.05 + hash3(Math.floor(p.t * 1000), 1, 2) * 0.08);
        const creds = pkts.some((p) => p.ink === 2 && p.info.startsWith('TELNET')), shake = pkts.some((p) => p.info.startsWith('EAPOL'));
        this.say(now, '', 0, 0.1);
        this.say(now, `${pkts.length} frames captured on channel ${A.ch}.`, 0, 0.1);
        if (creds) this.say(now, '  ^ cleartext credentials captured', 2, 0.1);
        else if (shake) this.say(now, '  ^ WPA four-way handshake captured (crackable offline)', 2, 0.1);
        else if (A.sec === Sec.WPA) this.say(now, '  (WPA data protected; capture a handshake to crack it offline)', 0, 0.1);
        this.busyUntil = this.tq;
        return 0;
      }
      case 'tnet': {
        const lan = this.lan();
        if (!lan) { out.push('tnet: no network'); return 0; }
        const hst = lan.find((x) => x.ip === args[0]);
        if (!args[0]) { out.push('usage: tnet <ip>'); return 0; }
        if (!hst) { out.push(`tnet: ${args[0]}: host down`); return 0; }
        if (!hst.ports.some((p) => p.n === 23) || !hst.user) { out.push(`tnet: ${args[0]}: connection refused on port 23`); return 0; }
        this.say(now, `Trying ${hst.ip}...`, 0, 0.3);
        this.say(now, `Connected to ${hst.ip}.`, 0, 0.3);
        this.say(now, `Escape character is '^]'. Type 'exit' to close.`, 0, 0.1);
        this.then(now, () => { this.conn = { host: hst, stage: 'login', tryUser: '' }; });
        this.busyUntil = this.tq;
        return 0;
      }
      case 'mbus': {
        // the modbus client: read the RTU's telemetry registers on port 502, or write the breaker
        // coil. Modbus has no authentication of its own — reaching 502 is enough, no login needed.
        const lan = this.lan();
        if (!lan) { out.push('mbus: no network'); return 0; }
        if (!args[0]) { out.push('usage: mbus <ip> [read | write coil 0 <0|1>]'); return 0; }
        const hst = lan.find((x) => x.ip === args[0]);
        if (!hst) { out.push(`mbus: ${args[0]}: host down`); return 0; }
        if (!hst.ports.some((p) => p.n === 502)) { out.push(`mbus: ${args[0]}: connection refused on port 502`); return 0; }
        const k = hst.sub, sub = args[1] ?? 'read';
        if (sub === 'read') {
          this.say(now, `mbus: ${hst.ip}:502 unit 1 — Read Holding Registers 0..7`, 0, 0.3);
          for (const r of modbusRegs(w, k)) this.say(now, `  4${String(r.addr).padStart(4, '0')}  ${r.name.padEnd(18)} ${String(r.value).padStart(6)}`, 1, 0.08);
          this.busyUntil = this.tq;
          return 0;
        }
        if (sub === 'write' && args[2] === 'coil' && args[3] === '0' && (args[4] === '0' || args[4] === '1')) {
          const want = args[4] === '1'; // coil 0 set = breaker closed (energized)
          this.say(now, `mbus: ${hst.ip}:502 unit 1 — Write Single Coil 0 = ${want ? 'ON' : 'OFF'}`, 0, 0.3);
          if (!setBreaker(w, k, want)) { this.say(now, `  response: coil 0 already ${want ? 'ON' : 'OFF'}`, 0, 0.15); return 0; }
          this.say(now, want ? '  response: coil 0 -> ON  (breaker closed, feeder energized)' : '  response: coil 0 -> OFF  (breaker tripped, feeder dead)', 2, 0.2);
          this.busyUntil = this.tq;
          return 0;
        }
        out.push('usage: mbus <ip> [read | write coil 0 <0|1>]');
        return 0;
      }
      case 'sha1sum': {
        let work = 0;
        for (const p of args) {
          const n = pc.get(path(p));
          if (!n) { this.err(out, 'nofile', c, p); continue; }
          if (n.dir) { this.err(out, 'isdir', c, p); continue; }
          let h = '';
          const key = (n.data ?? '') + n.size;
          for (let k = 0; k < 5; k++) h += Math.floor(hash3(key.length * 131 + n.size, k, key.charCodeAt(k % Math.max(1, key.length)) | 0) * 2 ** 32).toString(16).padStart(8, '0');
          out.push(`${h}  ${p}`);
          // read off the disk, 15 cycles a byte through the hash
          work += pc.workS(n.size, 1, 15);
        }
        return work;
      }
      case 'sensors': {
        out.push('coretemp-isa-0000', 'Adapter: ISA adapter');
        for (let k = 0; k < H.cores; k++) out.push(`Core ${k}:      +${(pc.tempC + k * 1.5).toFixed(1)}°C  (high = +85.0°C, crit = +100.0°C)`);
        out.push('', 'fan-isa-0000', `fan1:        ${String(pc.fanRpm()).padStart(4)} RPM`);
        return 0;
      }
      case 'nano': {
        const p = args[0] ? path(args[0]) : '', n = p ? pc.get(p) : null;
        if (n?.dir) { this.err(out, 'isdir', c, args[0]); return 0; }
        if (n && n.data === null && !p.startsWith('/proc/')) { out.push(`${c}: ${args[0]}: cannot edit a binary file`); return 0; }
        if (p && !n && !pc.parent(p)[0]?.dir) { this.err(out, 'nofile', c, args[0]); return 0; }
        const text = p.startsWith('/proc/') ? this.proc(p, now) : n?.data ?? '', ro = !!p && (p.startsWith('/proc/') || !pc.writable(p, u));
        // the editor keeps its process (and its memory) until it closes
        const pid = this.job;
        this.job = 0;
        this.then(now, () => {
          this.editor = new Editor(args[0] ?? '', text, ro, (q, t) => this.save(q, t), () => { this.editor = null; pc.kill(pid); }, (q) => pc.abs(this.cwd, q));
        });
        return pc.workS(n?.size ?? 0, 1);
      }
      case 'acpi': {
        const pct = Math.round(pc.charge * 100), hms = (t: number) => `${p2(Math.floor(t / 3600))}:${p2(Math.floor(t / 60) % 60)}:${p2(Math.floor(t) % 60)}`;
        const st = pc.plugged ? (pct >= 100 ? 'Full' : 'Charging') : 'Discharging';
        const left = pc.battLeftS(), tail = !pc.plugged ? (Number.isFinite(left) ? `, ${hms(left)} remaining` : '') : pct < 100 ? `, ${hms((1 - pc.charge) * 5400 * (pc.charge < 0.8 ? 1 : 1.6))} until charged` : '';
        out.push(`Battery 0: ${st}, ${pct}%${tail}`);
        if (flags.has('V') || flags.has('a')) out.push(`Adapter 0: ${pc.plugged ? 'on-line' : 'off-line'}`);
        if (flags.has('V')) {
          const mAh = (wh: number) => Math.round((wh * 1000) / 11.1);
          out.push(`Battery 0: design capacity ${mAh(H.battWh)} mAh, last full capacity ${mAh(pc.battWh)} mAh = ${Math.round(H.battWear * 100)}%`);
          out.push(`Thermal 0: ok, ${pc.tempC.toFixed(1)} degrees C`);
        }
        return 0;
      }
      case 'sleep': return Math.min(600, Math.max(0, Number(args[0]) || 0));
      case 'clear': this.then(now, () => { this.lines = []; }); return 0;
      case 'color': {
        if (args[0] === 'green') this.ink = 1; else if (args[0] === 'amber') this.ink = 0;
        else out.push(`color: ${this.ink ? 'green' : 'amber'} (color amber|green)`);
        return 0;
      }
      case 'exit': case 'logout': this.then(now, () => this.logout(performance.now() / 1000)); return 0;
      case 'shutdown': case 'reboot': this.then(now, () => this.shutdown(performance.now() / 1000, c === 'reboot')); return 0;
    }
    this.err(out, 'notfound', c);
    return 0;
  }
  /** The editor writes a file: an error (as the system words it), or null once it is on the disk. */
  private save(p: string, text: string): string | null {
    const pc = this.pc, [dir] = pc.parent(p), f = pc.get(p);
    if (!dir?.dir) return 'No such file or directory';
    if (f?.dir) return 'Is a directory';
    if (!pc.writable(p, pc.hw.user)) return 'Permission denied';
    if ((text.length - (f?.size ?? 0)) / 1048576 > pc.freeMB()) return 'No space left on device';
    pc.put(p, text, pc.hw.user, this.clock);
    dir.mtime = this.clock;
    this.sound(performance.now() / 1000, 'seek', 0.05);
    return null;
  }
  /** A line from the system to every terminal (the battery running low). */
  broadcast(now: number, text: string) {
    if (this.state !== 'ready') return;
    this.lines.push({ text: '', ink: 0 }, { text: `Broadcast message from root@${this.pc.hw.host}:`, ink: 2 }, { text, ink: 2 });
    void now;
  }
  /** The battery is almost empty: the system halts itself, cleanly. */
  battCritical(now: number) {
    if (this.state !== 'ready') return;
    this.editor = null;
    this.broadcast(now, 'Critical battery level: the system is shutting down.');
    this.shutdown(now, false);
  }
  /** The battery is empty: the power is simply gone, whatever was on the screen. */
  powerLoss() {
    this.pc.halt();
    this.queue = []; this.lines = []; this.state = 'off'; this.halted = true; this.bios = false; this.editor = null; this.fw.close(); this.inPost = false; this.conn = null; this.mask = false;
    this.sfx.push('spindown');
  }
  private logout(now: number) {
    this.pc.kill(this.shellPid);
    this.state = 'boot';
    this.conn = null; this.mask = false;
    this.tq = now;
    this.say(now, 'logout');
    this.say(now, '', 0, 0.3);
    this.login(now);
  }
  private count(n: FsNode): number { return n.dir ? 1 + [...n.kids!.values()].reduce((s, k) => s + this.count(k), 0) : 1; }
  private mac(k: number) {
    return [0, 0x1b, 0, 0, 0, 0].map((v, i) => (i < 2 ? v + k * 2 : Math.floor(hash3(this.world.seed, 411 + k, i) * 256)).toString(16).padStart(2, '0')).join(':').toUpperCase();
  }
  /** A binary file printed as text: what reads of it on a terminal. */
  private binary(n: FsNode, rows: number): string[] {
    const out: string[] = [], junk = '@#$%^&*~`|\\/<>{}[]?;:.,_-+=';
    for (let r = 0; r < rows; r++) { let s = r === 0 ? '\x7fELF' : ''; for (let k = s.length; k < 60; k++) s += junk[Math.floor(hash3(n.size, r, k) * junk.length)]; out.push(s); }
    return out;
  }
  /** The files in /proc: made as they are read, from the hardware and the memory now. */
  private proc(p: string, now: number): string {
    const H = this.pc.hw;
    if (p === '/proc/cpuinfo') {
      let s = '';
      for (let k = 0; k < H.cores; k++) s += `processor\t: ${k}\nmodel name\t: ${H.cpu}\ncpu MHz\t\t: ${H.cpuMHz}.000\ncache size\t: ${H.cores > 1 ? 2048 : 1024} KB\nbogomips\t: ${(H.cpuMHz * 1.995).toFixed(2)}\n\n`;
      return s;
    }
    if (p === '/proc/meminfo') { const t = H.ramMB * 1024; return `MemTotal:     ${String(t).padStart(8)} kB\nMemFree:      ${String(this.pc.freeKB()).padStart(8)} kB\nSwapTotal:    ${String(1004052).padStart(8)} kB\nSwapFree:     ${String(1004052).padStart(8)} kB\n`; }
    if (p === '/proc/uptime') return `${(now - this.pc.bootAt).toFixed(2)} ${((now - this.pc.bootAt) * 0.9).toFixed(2)}\n`;
    if (p === '/proc/version') return `${H.os} version ${H.kernel} (builder@osprey) #1 SMP\n`;
    return '';
  }
}
