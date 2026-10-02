import { hash3 } from '../core/rng';
import { calendar } from './clock';
import { fsNode, type FsNode } from './computer';
import { BOARDS, type Device } from './device';

/**
 * A phone's file system: the firmware (the board's loader, the radio's baseband), the system (the
 * maker's OS, its apps, its ringtones and fonts), and the user's data as plain files, which are what
 * the phone shows: the contacts as vCards, the call log, the texts, the notes, the photos. Change a
 * file (on the notebook, over the cable) and the phone shows the change; use the phone and the files
 * change (phone.ts keeps the two in step). The tree is the same kind as a computer's (computer.ts), so
 * the notebook can mount it as it is and its commands work on it.
 */
export const DATA = { contacts: '/data/contacts.vcf', calls: '/data/calls.log', inbox: '/data/sms/inbox.txt', sent: '/data/sms/sent.txt', notes: '/data/notes.txt' } as const;
export const DCIM = '/media/DCIM/100PHONE';

/** Find a node by path from a root. */
export function fsGet(root: FsNode, path: string): FsNode | null {
  let n: FsNode | null = root;
  for (const p of path.split('/')) if (p) n = n?.kids?.get(p) ?? null;
  return n;
}
/** Make the directories of a path. */
export function fsDirs(root: FsNode, path: string, owner: string, mtime: number): FsNode {
  let n = root;
  for (const p of path.split('/')) {
    if (!p) continue;
    let k = n.kids!.get(p);
    if (!k) { k = fsNode(p, true, owner, mtime); n.kids!.set(p, k); }
    n = k;
  }
  return n;
}
/** Write a file: text, or a binary of a size. */
export function fsPut(root: FsNode, path: string, data: string | number, owner: string, mtime: number): FsNode {
  const k = path.lastIndexOf('/'), dir = fsDirs(root, path.slice(0, k), owner, mtime), name = path.slice(k + 1);
  const f = fsNode(name, false, owner, mtime);
  if (typeof data === 'string') { f.data = data; f.size = data.length; } else f.size = data;
  dir.kids!.set(name, f);
  return f;
}

/** A new phone's tree: what its maker put on it, and empty data files. */
export function phoneFs(dev: Device, seed: number, now: number, ringtones: string[], apps: string[]): FsNode {
  const root = fsNode('phone', true, 'root', 0), h = (q: number) => hash3(seed, dev.maker, 7400 + q);
  const kb = (a: number, b: number, q: number) => Math.round((a + h(q) * (b - a)) * 1024);
  const os = dev.os.split(' ')[0].toLowerCase(), loader = BOARDS[dev.board].split(' ')[0].toLowerCase();
  fsPut(root, `/firmware/${loader}.img`, kb(96, 160, 1), 'root', 0);
  fsPut(root, '/firmware/baseband.bin', kb(1800, 2600, 2), 'root', 0);
  fsPut(root, '/firmware/VERSION', `board ${BOARDS[dev.board]}\nbaseband ${dev.radio} ${(h(3) * 9 + 1).toFixed(2)}\n`, 'root', 0);
  fsPut(root, `/system/${os}/kernel.img`, kb(1400, 2000, 4), 'root', 0);
  fsPut(root, `/system/${os}/shell.bin`, kb(2600, 4200, 5), 'root', 0);
  fsPut(root, `/system/${os}/RELEASE`, `${dev.os}\nmodel ${dev.model}\n`, 'root', 0);
  fsPut(root, '/system/fonts/sys5x7.fnt', 4096, 'root', 0);
  fsPut(root, '/system/fonts/t9-en.dic', kb(180, 240, 6), 'root', 0);
  ringtones.forEach((r, k) => fsPut(root, `/system/ringtones/${r.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.mid`, 2000 + Math.floor(h(10 + k) * 6000), 'root', 0));
  apps.forEach((a, k) => fsPut(root, `/system/apps/${a}.app`, kb(40, 400, 20 + k), 'root', 0));
  const u = 'user';
  fsPut(root, DATA.contacts, '', u, now);
  fsPut(root, DATA.calls, '', u, now);
  fsPut(root, DATA.inbox, '', u, now);
  fsPut(root, DATA.sent, '', u, now);
  fsPut(root, DATA.notes, '', u, now);
  fsDirs(root, DCIM, u, now);
  return root;
}

// ---- the data files' formats: plain text, one record a line (or a vCard a contact), a game time first ----
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, ' ');
const unesc = (s: string) => s.replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
const stamp = (t: number) => { const c = calendar(t); return `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')} ${String(Math.floor(c.hour)).padStart(2, '0')}:${String(Math.floor((c.hour % 1) * 60)).padStart(2, '0')}`; };
const lines = (s: string) => s.split('\n').filter((l) => l.trim() && !l.startsWith('#'));

export type Contact = { name: string; number: string };
export const contactsOut = (L: Contact[]) => L.map((c) => `BEGIN:VCARD\nVERSION:2.1\nN:${c.name}\nTEL;CELL:${c.number}\nEND:VCARD\n`).join('');
export function contactsIn(s: string): Contact[] {
  const out: Contact[] = [];
  let cur: Contact | null = null;
  for (const raw of s.split('\n')) {
    const l = raw.trim();
    if (l.toUpperCase() === 'BEGIN:VCARD') cur = { name: '', number: '' };
    else if (l.toUpperCase() === 'END:VCARD') { if (cur && cur.number) out.push(cur); cur = null; }
    else if (cur && /^(N|FN)[:;]/i.test(l)) cur.name = cur.name || l.slice(l.indexOf(':') + 1).replace(/;/g, ' ').trim();
    else if (cur && /^TEL[:;]/i.test(l)) cur.number = l.slice(l.indexOf(':') + 1).replace(/[^0-9*#+]/g, '');
  }
  return out;
}

export type LogEntry = { number: string; kind: 'out' | 'failed' | 'in' | 'missed'; at: number };
export const callsOut = (L: LogEntry[]) => `# time\tkind\tnumber\n${L.map((e) => `${Math.floor(e.at)}\t${e.kind}\t${e.number}\t# ${stamp(e.at)}`).join('\n')}\n`;
export function callsIn(s: string): LogEntry[] {
  const out: LogEntry[] = [];
  for (const l of lines(s)) {
    const [t, kind, number] = l.split('\t');
    if (!number || isNaN(+t) || !['out', 'failed', 'in', 'missed'].includes(kind)) continue;
    out.push({ number: number.trim(), kind: kind as LogEntry['kind'], at: +t });
  }
  return out;
}

export type InMsg = { from: string; text: string; at: number; read: boolean };
export const inboxOut = (L: InMsg[]) => `# time\tread\tfrom\ttext\n${L.map((m) => `${Math.floor(m.at)}\t${m.read ? 'R' : 'N'}\t${esc(m.from)}\t${esc(m.text)}`).join('\n')}\n`;
export function inboxIn(s: string): InMsg[] {
  const out: InMsg[] = [];
  for (const l of lines(s)) {
    const [t, r, from, ...text] = l.split('\t');
    if (!from || isNaN(+t)) continue;
    out.push({ at: +t, read: r !== 'N', from: unesc(from), text: unesc(text.join(' ')) });
  }
  return out;
}

export type OutMsg = { to: string; text: string; at: number };
export const sentOut = (L: OutMsg[]) => `# time\tto\ttext\n${L.map((m) => `${Math.floor(m.at)}\t${esc(m.to)}\t${esc(m.text)}`).join('\n')}\n`;
export function sentIn(s: string): OutMsg[] {
  const out: OutMsg[] = [];
  for (const l of lines(s)) {
    const [t, to, ...text] = l.split('\t');
    if (!to || isNaN(+t)) continue;
    out.push({ at: +t, to: unesc(to), text: unesc(text.join(' ')) });
  }
  return out;
}
