import { calendar } from '../sim/clock';
import { biosDefaults, type BiosConfig, type BootDev, type Computer } from '../sim/computer';
import { type World } from '../sim/world';
import { computerMakerName } from '../locale/names';
import { Scr, St } from './screen';

/**
 * The notebook's firmware once the power-on self test is over: the SETUP screens (F2) and the boot
 * menu (F12). SETUP edits a copy of the settings (sim/computer.ts, BiosConfig); saving writes them
 * to the machine and resets it, so they take effect on that boot. Keys are the browser's names
 * (e.key). The look is our own take on the text firmware of the time.
 */
const W = 80, H = 22;
const TABS = ['Main', 'Advanced', 'Boot', 'Exit'] as const;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const p2 = (n: number) => String(n).padStart(2, '0');
export const DEV_NAME: Record<BootDev, string> = { hdd: 'Hard Drive', dvd: 'CD/DVD Drive', usb: 'USB Storage Device', net: 'Network Boot (PXE)' };

export type FwAction = { kind: 'boot'; first?: BootDev } | { kind: 'reset' };

/** One row of a tab: a setting to change, a command, or a line to read. */
interface Item { label: string; value?: () => string; change?: (d: number) => void; enter?: () => void; help: string }
interface Dialog { title: string; lines: string[]; yes?: () => void; pick: number }

export class Firmware {
  mode: null | 'setup' | 'menu' = null;
  private tab = 0;
  private row = 0;
  private draft: BiosConfig = biosDefaults();
  private dlg: Dialog | null = null;
  private menuRow = 0;

  constructor(private pc: Computer, private world: World, private done: (a: FwAction) => void) {}

  openSetup() { this.mode = 'setup'; this.tab = 0; this.row = 0; this.dlg = null; this.draft = structuredClone(this.pc.bios); this.row = this.firstRow(); }
  openMenu() { this.mode = 'menu'; this.menuRow = 0; }
  close() { this.mode = null; this.dlg = null; }

  // ---- what each tab holds ----
  private items(): Item[] {
    const pc = this.pc, hw = pc.hw, d = this.draft;
    const t = () => calendar(this.world.time + d.clockOffset);
    const onOff = (b: boolean) => (b ? '[Enabled]' : '[Disabled]');
    switch (TABS[this.tab]) {
      case 'Main': return [
        { label: 'System Time', value: () => { const k = t(); return `[${p2(Math.floor(k.hour))}:${p2(Math.floor((k.hour % 1) * 60))}:${p2(Math.floor(((k.hour * 60) % 1) * 60))}]`; }, change: (s) => { d.clockOffset += s * 3600; }, help: 'The hardware clock. +/- moves it an hour. The system takes its time from here.' },
        { label: 'System Date', value: () => { const k = t(); return `[${WDAY[k.weekday]} ${MON[k.month - 1]} ${p2(k.day)} ${k.year}]`; }, change: (s) => { d.clockOffset += s * 86400; }, help: 'The hardware calendar. +/- moves it a day.' },
        { label: '', help: '' },
        { label: 'BIOS Version', value: () => hw.bios, help: '' },
        { label: 'Product Name', value: () => hw.model, help: '' },
        { label: 'Processor Type', value: () => hw.cpu, help: '' },
        { label: 'Processor Speed', value: () => `${(hw.cpuMHz / 1000).toFixed(2)} GHz`, help: '' },
        { label: 'System Memory', value: () => `${hw.ramMB} MB`, help: '' },
        { label: 'Hard Disk', value: () => `${hw.disk} ${Math.round(hw.diskMB / 1000)} GB`, help: '' },
        { label: 'Battery', value: () => `${Math.round(pc.battWh)} of ${hw.battWh} Wh design`, help: '' },
      ];
      case 'Advanced': return [
        { label: 'Wireless LAN', value: () => onOff(d.wlan), change: () => { d.wlan = !d.wlan; }, help: 'Disabled, the wireless card is switched off: the system does not see it, and it draws no power.' },
        { label: 'Quick Boot', value: () => onOff(d.quickBoot), change: () => { d.quickBoot = !d.quickBoot; }, help: 'Skips the memory test and shortens the drive detection at power-on.' },
        { label: 'Fan Always On', value: () => onOff(d.fanAlways), change: () => { d.fanAlways = !d.fanAlways; }, help: 'The fan keeps turning even when the processor is cool. Cooler, louder, more battery.' },
        { label: '', help: '' },
        { label: 'CPU Temperature', value: () => `${Math.round(pc.tempC)} C`, help: '' },
        { label: 'Fan Speed', value: () => `${pc.fanRpm()} RPM`, help: '' },
        { label: 'AC Adapter', value: () => (pc.plugged ? 'Connected' : 'Not connected'), help: '' },
        { label: 'Battery Charge', value: () => `${Math.round(pc.charge * 100)} %`, help: '' },
      ];
      case 'Boot': return d.bootOrder.map((dev, k) => ({
        label: `${k + 1}. ${DEV_NAME[dev]}`, value: () => (dev === 'hdd' ? hw.disk : dev === 'dvd' ? 'DVD+-RW 8X' : dev === 'net' ? hw.eth : ''),
        change: (s: number) => { const j = k - s; if (j < 0 || j >= d.bootOrder.length) return; [d.bootOrder[k], d.bootOrder[j]] = [d.bootOrder[j], d.bootOrder[k]]; this.row = j; },
        help: 'The order the devices are tried at power-on. + moves the selected one up, - down.',
      }));
      case 'Exit': return [
        { label: 'Exit Saving Changes', enter: () => this.ask('Save configuration changes and exit now?', () => { this.pc.bios = structuredClone(d); this.close(); this.done({ kind: 'reset' }); }), help: 'Write the settings and restart the machine with them.' },
        { label: 'Exit Discarding Changes', enter: () => this.ask('Quit without saving changes?', () => { this.close(); this.done({ kind: 'boot' }); }), help: 'Leave SETUP and boot as before.' },
        { label: 'Load Setup Defaults', enter: () => this.ask('Load default configuration now?', () => { this.draft = biosDefaults(); }), help: 'The settings as they left the factory (not saved until you exit saving).' },
        { label: 'Discard Changes', enter: () => this.ask('Load previous configuration now?', () => { this.draft = structuredClone(this.pc.bios); }), help: 'Back to the settings saved last.' },
      ];
    }
  }
  private selectable(it: Item) { return !!(it.change || it.enter); }
  private firstRow() { const I = this.items(); const k = I.findIndex((i) => this.selectable(i)); return Math.max(0, k); }
  private ask(title: string, yes: () => void) { this.dlg = { title, lines: [], yes, pick: 0 }; }

  // ---- keys ----
  key(key: string) {
    if (this.mode === 'menu') return this.menuKey(key);
    if (this.dlg) {
      const D = this.dlg;
      if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Tab') D.pick = 1 - D.pick;
      else if (key === 'y' || key === 'Y') { this.dlg = null; D.yes?.(); }
      else if (key === 'n' || key === 'N' || key === 'Escape') this.dlg = null;
      else if (key === 'Enter') { this.dlg = null; if (D.pick === 0) D.yes?.(); }
      return;
    }
    const I = this.items();
    const move = (s: number) => { for (let r = this.row + s; r >= 0 && r < I.length; r += s) if (this.selectable(I[r])) { this.row = r; return; } };
    if (key === 'ArrowLeft' || key === 'ArrowRight') { this.tab = (this.tab + (key === 'ArrowLeft' ? TABS.length - 1 : 1)) % TABS.length; this.row = this.firstRow(); }
    else if (key === 'ArrowUp') move(-1);
    else if (key === 'ArrowDown') move(1);
    else if (key === '+' || key === '=' || key === 'PageUp') I[this.row]?.change?.(1);
    else if (key === '-' || key === '_' || key === 'PageDown') I[this.row]?.change?.(-1);
    else if (key === 'Enter' || key === ' ') { const it = I[this.row]; if (it?.enter) it.enter(); else it?.change?.(1); }
    else if (key === 'F9') this.ask('Load default configuration now?', () => { this.draft = biosDefaults(); });
    else if (key === 'F10') this.ask('Save configuration changes and exit now?', () => { this.pc.bios = structuredClone(this.draft); this.close(); this.done({ kind: 'reset' }); });
    else if (key === 'Escape') this.ask('Quit without saving changes?', () => { this.close(); this.done({ kind: 'boot' }); });
  }
  private menuKey(key: string) {
    const n = this.pc.bios.bootOrder.length + 1;
    if (key === 'ArrowUp') this.menuRow = (this.menuRow + n - 1) % n;
    else if (key === 'ArrowDown') this.menuRow = (this.menuRow + 1) % n;
    else if (key === 'Escape') { this.close(); this.done({ kind: 'boot' }); }
    else if (key === 'Enter') {
      if (this.menuRow === n - 1) { this.openSetup(); return; }
      const dev = this.pc.bios.bootOrder[this.menuRow];
      this.close(); this.done({ kind: 'boot', first: dev });
    }
  }

  // ---- the screen ----
  cells(): Scr {
    const s = new Scr(W, H, St.Body);
    if (this.mode === 'menu') return this.menuCells(s);
    const maker = computerMakerName(this.world.city, this.pc.hw.maker);
    s.fill(0, 0, W, 1, St.Bar);
    const title = `${maker} BIOS Setup Utility`;
    s.text((W - title.length) >> 1, 0, title, St.Bar);
    // the tabs
    let x = 2;
    TABS.forEach((t, k) => { s.text(x, 1, ` ${t} `, k === this.tab ? St.Tab : St.White); x += t.length + 4; });
    s.text(0, 2, '-'.repeat(W), St.Gray);
    // the items on the left, the help on the right
    const HX = 56, I = this.items();
    for (let r = 3; r < 19; r++) s.text(HX - 2, r, '|', St.Gray);
    s.text(HX, 3, 'Item Specific Help', St.White);
    I.forEach((it, k) => {
      const y = 4 + k;
      if (!it.label) return;
      const sel = k === this.row && this.selectable(it), lab = it.label.padEnd(24);
      s.text(2, y, lab, sel ? St.Pick : this.selectable(it) ? St.White : St.Gray);
      if (it.value) { const v = it.value().slice(0, HX - 30); s.text(28, y, v, sel ? St.Pick : St.Body); }
    });
    const help = I[this.row]?.help ?? '';
    wrap(help, W - HX - 1).forEach((l, k) => s.text(HX, 5 + k, l, St.Help));
    // the keys
    s.fill(0, 20, W, 2, St.Bar);
    s.text(1, 20, '^v  Select Item   +/- Change Values      F9  Setup Defaults', St.Bar);
    s.text(1, 21, '<>  Select Menu   Esc Exit     Enter Select / Execute F10 Save and Exit', St.Bar);
    if (this.dlg) {
      const D = this.dlg, w = Math.max(40, D.title.length + 6), bx = (W - w) >> 1;
      s.box(bx, 8, w, 6, St.Box);
      s.text(bx + ((w - D.title.length) >> 1), 9, D.title, St.Box);
      s.text(bx + (w >> 1) - 9, 11, '[ Yes ]', D.pick === 0 ? St.BoxPick : St.Box);
      s.text(bx + (w >> 1) + 2, 11, '[ No ]', D.pick === 1 ? St.BoxPick : St.Box);
    }
    return s;
  }
  private menuCells(s: Scr): Scr {
    for (let r = 0; r < H; r++) s.fill(0, r, W, 1, St.Body);
    const order = this.pc.bios.bootOrder, rows = [...order.map((d) => DEV_NAME[d]), 'Enter Setup'];
    const w = 40, h = rows.length + 6, bx = (W - w) >> 1, by = (H - h) >> 1;
    s.box(bx, by, w, h, St.Box);
    s.text(bx + 2, by + 1, 'Please select boot device:', St.Box);
    s.text(bx + 1, by + 2, '-'.repeat(w - 2), St.Box);
    rows.forEach((r, k) => s.text(bx + 2, by + 3 + k , (k === rows.length - 1 ? '' : `${k + 1}. `) + r.padEnd(w - 8), k === this.menuRow ? St.BoxPick : St.Box));
    s.text(bx + 2, by + h - 2, '^v to move, Enter to select, Esc', St.Box);
    return s;
  }
}

function wrap(t: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of t.split(' ')) {
    if (line && line.length + 1 + word.length > w) { out.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}
