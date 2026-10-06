import { hash3 } from '../core/rng';
import en from '../locale/en.json';
import { formatNumber } from '../sim/telco';
import { type World } from '../sim/world';
import { type C3, type Lcd, SH, softKeys, SW, typed, typeHint } from './lcd';
import { type Key, type Phone } from './phone';
import { Editor } from './textinput';
import { lerp } from './ui';

/**
 * Reynard (15.9e): the encrypted messenger the city's hackers use, tied to the phone's number as such
 * apps are. It is not in the store: it is sideloaded once the phone is unlocked (stage 19; until then
 * only the debug installs it), and it becomes the mentor's channel after the tutorial.
 *
 * Registering texts a six-digit code to the number by SMS; typed back, the phone makes its own key.
 * Each contact has a key too, and the two together give the chat's safety number, sixty digits to be
 * compared with the other person (in person, or read out over a call): marked verified once they match.
 * A chat can make its messages disappear a while after they are sent, and the whole app can be wiped
 * (the chats and the key; registering again makes a new key, and contacts would see it change).
 */
const R = en.phone.apps.rey;
export interface ReyMsg { me: boolean; text: string; at: number; /** 0 sending, 1 sent, 2 delivered. */ st: 0 | 1 | 2 }
export interface ReyChat { name: string; num: string; key: string; verified: boolean; /** Game seconds until a message disappears (0: never). */ timer: number; msgs: ReyMsg[] }
export interface ReyState {
  reg: 'none' | 'wait' | 'ok';
  /** The code texted, and the digits typed so far; the phone's own key once registered. */
  code: string;
  typed: string;
  mine: string;
  chats: ReyChat[];
}
export const newRey = (): ReyState => ({ reg: 'none', code: '', typed: '', mine: '', chats: [] });

type View = 'reg' | 'list' | 'chat' | 'opts' | 'key' | 'menu' | 'wipe';
/** The screens' own state (not saved): the page, the row picked, the chat open, a note shown, the message being written. */
export const rv = { view: 'list' as View, sel: 0, open: 0, note: '', scroll: 0, ed: new Editor(160) };

/** The timer choices, in game seconds: off, an hour, a day, a week. */
const TIMERS = [0, 3600, 86400, 7 * 86400];
const SENT_S = 15, DELIVERED_S = 40;

/** A key, as Reynard shows it: 30 digits from the number and a seed of the phone's own. */
export function keyOf(seed: number, num: string, salt: number): string {
  let s = '';
  for (let i = 0; i < 30; i++) s += Math.floor(hash3(seed, i * 131 + salt, num.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) & 0xffffff) * 10);
  return s;
}
/** The chat's safety number: both keys, the lower first (so both ends see the same), in groups of five. */
export function safety(a: string, b: string): string[] {
  const s = a < b ? a + b : b + a;
  return s.match(/.{5}/g) ?? [];
}

/** Each frame: messages go out (and arrive at the other end) while there is a network; the disappearing ones go. */
export function stepRey(P: Phone, w: World) {
  const S = P.rey;
  if (S.reg !== 'ok') return;
  const on = P.online();
  for (const C of S.chats) {
    for (const m of C.msgs) {
      if (!m.me || m.st === 2 || !on) continue;
      if (m.st === 0 && w.time - m.at > SENT_S) m.st = 1;
      else if (m.st === 1 && w.time - m.at > DELIVERED_S) m.st = 2;
    }
    if (C.timer) C.msgs = C.msgs.filter((m) => w.time - m.at < C.timer);
  }
}

/** Opening the app: registered, the chats; else the page to register. */
export function openRey(P: Phone) {
  rv.view = P.rey.reg === 'ok' ? 'list' : 'reg'; rv.sel = 0; rv.note = ''; rv.scroll = 0;
}

/** The app's keys (null: Back on its first page, to leave the app). */
export function reyKey(P: Phone, w: World, k: Key, now: number): boolean | null {
  const S = P.rey, C = S.chats[rv.open];
  rv.note = '';
  switch (rv.view) {
    case 'reg': {
      if (S.reg === 'none') {
        if (k === 'rsoft') return null;
        if (k !== 'ok' && k !== 'lsoft') return false;
        if (!P.online()) { rv.note = R.offline; return true; }
        S.code = String(100000 + Math.floor(hash3(w.seed, Math.floor(w.time), 77) * 900000));
        S.reg = 'wait'; S.typed = '';
        P.receive(R.sender, R.codeSms.replace('{c}', `${S.code.slice(0, 3)}-${S.code.slice(3)}`), now + 3);
        return true;
      }
      if (k === 'rsoft') { if (S.typed) { S.typed = S.typed.slice(0, -1); return true; } S.reg = 'none'; return true; }
      if (/^[0-9]$/.test(k) && S.typed.length < 6) {
        S.typed += k;
        if (S.typed.length === 6) {
          if (S.typed === S.code) { S.reg = 'ok'; S.mine = keyOf(w.seed, w.telco.player.number, Math.floor(w.time)); rv.view = 'list'; P.sfx.push(['sent']); }
          else { rv.note = R.badCode; S.typed = ''; }
        }
        return true;
      }
      return false;
    }
    case 'list': {
      const n = S.chats.length;
      if (k === 'rsoft') return null;
      if ((k === 'up' || k === 'down') && n) { rv.sel = (rv.sel + (k === 'up' ? -1 : 1) + n) % n; return true; }
      if (k === 'ok' && n) { rv.open = rv.sel; rv.view = 'chat'; rv.scroll = 0; rv.ed.set(''); return true; }
      if (k === 'lsoft') { rv.view = 'menu'; rv.sel = 0; return true; }
      return false;
    }
    case 'chat': {
      if (!C) { rv.view = 'list'; return true; }
      if (k === 'rsoft') { if (rv.ed.del()) return true; rv.view = 'list'; rv.sel = rv.open; return true; }
      if (k === 'lsoft') { rv.view = 'opts'; rv.sel = 0; return true; }
      if (k === 'up' || k === 'down') { rv.scroll = Math.max(0, rv.scroll + (k === 'up' ? 1 : -1)); return true; }
      if (k === 'ok' || k === 'send') {
        const t = rv.ed.value().trim();
        if (!t) return false;
        C.msgs.push({ me: true, text: t, at: w.time, st: 0 }); rv.ed.set(''); rv.scroll = 0;
        if (!P.online()) rv.note = R.queued;
        P.sfx.push(['sent']);
        return true;
      }
      return rv.ed.key(k, now);
    }
    case 'opts': {
      if (k === 'rsoft') { rv.view = 'chat'; return true; }
      if (k === 'up' || k === 'down') { rv.sel = (rv.sel + (k === 'up' ? 2 : 1)) % 3; return true; }
      if (k === 'ok' || k === 'lsoft') {
        if (rv.sel === 0) rv.view = 'key';
        else if (rv.sel === 1) C.timer = TIMERS[(TIMERS.indexOf(C.timer) + 1) % TIMERS.length];
        else { S.chats.splice(rv.open, 1); rv.view = 'list'; rv.sel = 0; }
        return true;
      }
      return false;
    }
    case 'key': {
      if (k === 'rsoft') { rv.view = 'opts'; return true; }
      if (k === 'ok' || k === 'lsoft') { C.verified = !C.verified; return true; }
      return false;
    }
    case 'menu': {
      if (k === 'rsoft') { rv.view = 'list'; rv.sel = 0; return true; }
      if (k === 'ok' || k === 'lsoft') { rv.view = 'wipe'; return true; }
      return false;
    }
    case 'wipe': {
      if (k === 'rsoft') { rv.view = 'list'; return true; }
      if (k === 'ok' || k === 'lsoft') { Object.assign(S, newRey()); rv.view = 'reg'; P.sfx.push(['stop']); return true; }
      return false;
    }
  }
  return false;
}

/** A contact as the debug gives it (the real ones come with the mentor, stage 19). */
export function debugChat(w: World): ReyChat {
  const at = w.time - 600;
  return { name: R.debugName, num: '5550142', key: keyOf(w.seed, '5550142', 3), verified: false, timer: 0,
    msgs: R.debugMsgs.map((text, i) => ({ me: false, text, at: at + i * 90, st: 2 as const })) };
}

// the look: charcoal and cream, the fox's rust for what matters
const BG0: C3 = [30, 27, 26], BG1: C3 = [14, 12, 12], RUST: C3 = [232, 112, 44], CREAM: C3 = [238, 228, 210], GREY: C3 = [138, 128, 118];
const MINE: C3 = [96, 46, 20], THEIRS: C3 = [52, 48, 46], OK2: C3 = [120, 200, 120];
const bg = (y: number) => lerp(BG0, BG1, (y - 1) / (SH - 3));

function top(S: Lcd, right: string) {
  S.fill(1, [20, 18, 17]);
  S.text(1, 1, '/\\', RUST, [20, 18, 17]);
  S.text(4, 1, 'reynard', CREAM, [20, 18, 17]);
  if (right) S.text(SW - 1 - right.length, 1, right.slice(0, SW - 14), GREY, [20, 18, 17]);
}
function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    if (line && line.length + 1 + word.length > w) { out.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}
const ago = (w: World, at: number) => { const m = Math.floor((w.time - at) / 60); return m < 1 ? R.now : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`; };
const timerName = (t: number) => R.timers[TIMERS.indexOf(t)] ?? R.timers[0];

export function drawRey(S: Lcd, P: Phone, w: World, t: number, now: number) {
  for (let y = 1; y < SH - 1; y++) S.fill(y, bg(y));
  const St = P.rey, C = St.chats[rv.open], blink = Math.floor(now * 2) & 1;
  const note = () => { if (rv.note) S.center(SH - 3, rv.note, RUST, bg(SH - 3)); };
  switch (rv.view) {
    case 'reg': {
      top(S, '');
      // the fox, a few lines of it
      ['  /\\   /\\', ' /  \\_/  \\', ' \\  o o  /', '  \\  v  /', '   `---\''].forEach((l, k) => S.text((SW - 11) >> 1, 3 + k, l, RUST, bg(3 + k)));
      S.center(9, typed(R.tagline, t), CREAM, bg(9));
      S.center(11, `${R.yourNumber} ${formatNumber(w.telco, w.telco.player.number.replace('-', ''))}`, GREY, bg(11));
      if (St.reg === 'none') { R.regHint.forEach((l, k) => S.center(14 + k, l, CREAM, bg(14 + k))); note(); return softKeys(S, R.register, en.phone.back); }
      S.center(14, R.enterCode, CREAM, bg(14));
      const d = St.typed.padEnd(6, '_');
      S.center(16, `${d.slice(0, 3)} - ${d.slice(3)}`, RUST, bg(16));
      S.center(18, R.codeHint, GREY, bg(18));
      note();
      return softKeys(S, '', St.typed ? R.del : en.phone.back);
    }
    case 'list': {
      top(S, R.encrypted);
      if (!St.chats.length) R.noChats.forEach((l, k) => S.center(9 + k, l, GREY, bg(9 + k)));
      St.chats.forEach((Ch, n) => {
        const y = 3 + n * 3, sel = n === rv.sel, rb: C3 = sel ? [70, 40, 26] : bg(y), last = Ch.msgs[Ch.msgs.length - 1];
        if (y > SH - 5) return;
        S.fill(y, rb); S.fill(y + 1, sel ? [70, 40, 26] : bg(y + 1));
        S.text(1, y, '#', RUST, rb);
        S.text(3, y, Ch.name.slice(0, SW - 12), sel ? [255, 255, 255] : CREAM, rb);
        if (Ch.verified) S.text(3 + Math.min(Ch.name.length, SW - 12) + 1, y, 'v', OK2, rb);
        if (last) S.text(SW - 1 - ago(w, last.at).length, y, ago(w, last.at), GREY, rb);
        const prev = last ? `${last.me ? R.you : ''}${last.text}` : Ch.timer ? R.gone : '';
        S.text(3, y + 1, typed(prev.slice(0, SW - 5), t - n * 0.04), GREY, sel ? [70, 40, 26] : bg(y + 1));
      });
      return softKeys(S, R.menu, en.phone.back);
    }
    case 'chat': {
      if (!C) return;
      top(S, C.verified ? `${C.name} v` : C.name);
      if (C.timer) S.text(1, 2, `${R.timerOn} ${timerName(C.timer)}`, GREY, bg(2));
      // the bubbles, newest at the bottom, mine to the right in rust, theirs to the left
      // each bubble as wide as its longest line
      const W2 = SW - 10, rows: [string, C3, number, boolean, number][] = [];
      for (const m of C.msgs) {
        const L = wrap(m.text, W2), bw = Math.max(...L.map((l) => l.length)) + 2;
        L.forEach((l) => rows.push([l, m.me ? MINE : THEIRS, 0, m.me, bw]));
        rows.push([m.me ? ['...', 'v', 'vv'][m.st] + ' ' + ago(w, m.at) : ago(w, m.at), [0, 0, 0], 1, m.me, 0]);
      }
      const y1 = SH - 6, h = y1 - 3, end = Math.max(0, rows.length - rv.scroll);
      rows.slice(Math.max(0, end - h), end).forEach(([l, col, meta, me, bw], r) => {
        const y = 3 + Math.max(0, h - Math.min(h, end)) + r;
        if (meta) { const x = me ? SW - 2 - l.length : 2; S.text(x, y, l, GREY, bg(y)); return; }
        const x = me ? SW - 1 - bw : 1;
        for (let k = 0; k < bw; k++) S.put(x + k, y, 32, CREAM, col);
        S.text(x + 1, y, l, CREAM, col);
      });
      // the line being written
      const v = rv.ed.value(), line = (v + (blink ? '_' : ' ')).slice(-(SW - 4));
      S.fill(SH - 4, [44, 40, 38]);
      S.text(1, SH - 4, '>', RUST, [44, 40, 38]);
      S.text(3, SH - 4, v ? line : R.write, v ? CREAM : GREY, [44, 40, 38]);
      if (rv.note) S.text(1, SH - 3, rv.note, RUST, bg(SH - 3)); else typeHint(S, 1, SH - 3, rv.ed, now, `${rv.ed.label()}  ${R.sendHint}`, GREY, bg(SH - 3));
      return softKeys(S, R.options, v ? R.del : en.phone.back);
    }
    case 'opts': {
      top(S, C?.name ?? '');
      [R.verify, `${R.disappear} ${timerName(C?.timer ?? 0)}`, R.deleteChat].forEach((l, n) => {
        const y = 4 + n * 2, sel = n === rv.sel, rb: C3 = sel ? [70, 40, 26] : bg(y);
        S.fill(y, rb); S.text(2, y, l, sel ? [255, 255, 255] : CREAM, rb);
      });
      return softKeys(S, en.phone.ok, en.phone.back);
    }
    case 'key': {
      if (!C) return;
      top(S, R.safetyTitle);
      S.text(2, 3, typed(R.safetyWith.replace('{n}', C.name), t), CREAM, bg(3));
      const G = safety(St.mine, C.key);
      for (let r = 0; r < 3; r++) S.center(6 + r * 2, G.slice(r * 4, r * 4 + 4).join('  '), C.verified ? OK2 : RUST, bg(6 + r * 2));
      R.safetyHint.forEach((l, k) => S.center(13 + k, l, GREY, bg(13 + k)));
      S.center(SH - 4, C.verified ? R.isVerified : R.notVerified, C.verified ? OK2 : GREY, bg(SH - 4));
      return softKeys(S, C.verified ? R.unverify : R.markVerified, en.phone.back);
    }
    case 'menu': {
      top(S, '');
      S.fill(4, [70, 40, 26]); S.text(2, 4, R.wipe, [255, 255, 255], [70, 40, 26]);
      S.text(2, 7, `${R.yourKey}`, GREY, bg(7));
      (St.mine.match(/.{5}/g) ?? []).forEach((g, k) => S.text(2 + (k % 3) * 7, 8 + Math.floor(k / 3), g, CREAM, bg(8 + Math.floor(k / 3))));
      return softKeys(S, en.phone.ok, en.phone.back);
    }
    case 'wipe': {
      top(S, '');
      R.wipeWarn.forEach((l, k) => S.center(8 + k, l, k ? CREAM : RUST, bg(8 + k)));
      return softKeys(S, R.wipeYes, R.keep);
    }
  }
}
