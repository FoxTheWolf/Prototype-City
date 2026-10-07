import { hash3 } from '../core/rng';
import en from '../locale/en.json';
import { formatNumber } from '../sim/telco';
import { type World } from '../sim/world';
import { type C3, type Lcd, softKeys } from './lcd';
import { type Paint } from '../render/paint2d';
import { ptext, ptextW, SCR_H, SCR_W } from './pixui';
import { ctext, edHint, HITS, M, paintHint, Y0, Y1, type TypeHint } from './pixpages';
import { artColors } from './hdicons';
import { type Key, type Phone } from './phone';
import { Editor } from './textinput';

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
const BG0: C3 = [30, 27, 26], BG1: C3 = [14, 12, 12], BAR: C3 = [20, 18, 17], RUST: C3 = [232, 112, 44], CREAM: C3 = [238, 228, 210], GREY: C3 = [138, 128, 118];
const MINE: C3 = [96, 46, 20], THEIRS: C3 = [52, 48, 46], OK2: C3 = [120, 200, 120], PICKED: C3 = [70, 40, 26];

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

/** One of Reynard's pages, as it is painted. */
type ReyPage = { view: 'reg'; number: string; waiting: boolean; hint: string[]; typed: string; codeHint: string; tagline: string; button: string }
  | { view: 'list'; empty: string[]; rows: { name: string; verified: boolean; when: string; prev: string; sel: boolean; pre: () => void }[] }
  | { view: 'chat'; timer: string; bubbles: { lines: string[]; me: boolean; meta: string }[]; scroll: number; line: string; write: string; hint: TypeHint }
  | { view: 'opts'; rows: { label: string; sel: boolean; pre: () => void }[] }
  | { view: 'key'; title: string; groups: string[]; verified: boolean; hint: string[]; status: string; button: string }
  | { view: 'menu'; wipe: string; yourKey: string; groups: string[] }
  | { view: 'wipe'; warn: string[]; yes: string; keep: string };
interface ReyPaint { right: string; rightOk: boolean; note: string; t: number; page: ReyPage }

/**
 * Reynard on the phone's screen: what each page shows (the painter is paintRey). The left soft key
 * and OK act as before; touched, a row picks and opens, the buttons press their key.
 */
export function drawRey(S: Lcd, P: Phone, w: World, t: number, now: number): (Pt: Paint) => void {
  const St = P.rey, C = St.chats[rv.open], blink = Math.floor(now * 2) & 1;
  const d: ReyPaint = { right: '', rightOk: false, note: rv.note, t, page: { view: 'menu', wipe: '', yourKey: '', groups: [] } };
  const paint = (Pt: Paint) => paintRey(Pt, d);
  switch (rv.view) {
    case 'reg': {
      const D = St.typed.padEnd(6, '_');
      d.page = { view: 'reg', number: `${R.yourNumber} ${formatNumber(w.telco, w.telco.player.number.replace('-', ''))}`, waiting: St.reg !== 'none', hint: St.reg === 'none' ? R.regHint : [R.enterCode],
        typed: `${D.slice(0, 3)} - ${D.slice(3)}`, codeHint: R.codeHint, tagline: R.tagline, button: R.register };
      softKeys(S, St.reg === 'none' ? R.register : '', St.reg === 'none' ? en.phone.back : St.typed ? R.del : en.phone.back);
      return paint;
    }
    case 'list': {
      d.right = R.encrypted;
      d.page = { view: 'list', empty: R.noChats, rows: St.chats.map((Ch, n) => {
        const last = Ch.msgs[Ch.msgs.length - 1];
        return { name: Ch.name, verified: Ch.verified, when: last ? ago(w, last.at) : '', prev: last ? `${last.me ? R.you : ''}${last.text}` : Ch.timer ? R.gone : '', sel: n === rv.sel, pre: () => { rv.sel = n; } };
      }) };
      softKeys(S, R.menu, en.phone.back);
      return paint;
    }
    case 'chat': {
      if (!C) return paint;
      d.right = C.name; d.rightOk = C.verified;
      const v = rv.ed.value();
      d.page = { view: 'chat', timer: C.timer ? `${R.timerOn} ${timerName(C.timer)}` : '', scroll: rv.scroll,
        bubbles: C.msgs.map((m) => ({ lines: wrap(m.text, 28), me: m.me, meta: m.me ? `${R.status[m.st]}  ${ago(w, m.at)}` : ago(w, m.at) })),
        line: v ? (v + (blink ? '_' : ' ')).slice(-30) : '', write: R.write, hint: edHint(rv.ed, now, `${rv.ed.label()}  ${R.sendHint}`) };
      softKeys(S, R.options, v ? R.del : en.phone.back);
      return paint;
    }
    case 'opts':
      d.right = C?.name ?? '';
      d.page = { view: 'opts', rows: [R.verify, `${R.disappear} ${timerName(C?.timer ?? 0)}`, R.deleteChat].map((label, n) => ({ label, sel: n === rv.sel, pre: () => { rv.sel = n; } })) };
      softKeys(S, en.phone.ok, en.phone.back);
      return paint;
    case 'key': {
      if (!C) return paint;
      d.right = R.safetyTitle;
      d.page = { view: 'key', title: R.safetyWith.replace('{n}', C.name), groups: safety(St.mine, C.key), verified: C.verified, hint: R.safetyHint, status: C.verified ? R.isVerified : R.notVerified, button: C.verified ? R.unverify : R.markVerified };
      softKeys(S, C.verified ? R.unverify : R.markVerified, en.phone.back);
      return paint;
    }
    case 'menu':
      d.page = { view: 'menu', wipe: R.wipe, yourKey: R.yourKey, groups: St.mine.match(/.{5}/g) ?? [] };
      softKeys(S, en.phone.ok, en.phone.back);
      return paint;
    case 'wipe':
      d.page = { view: 'wipe', warn: R.wipeWarn, yes: R.wipeYes, keep: R.keep };
      softKeys(S, R.wipeYes, R.keep);
      return paint;
  }
  return paint;
}

/** A tick: verified. */
const tick = (P: Paint, x: number, y: number, c: C3) => { P.line(x, y + 4, x + 3, y + 7, 2, c); P.line(x + 3, y + 7, x + 9, y, 2, c); };
/** A button of Reynard's: rust (or outlined), its word, the key it presses. */
function button(P: Paint, x: number, y: number, w: number, label: string, key: Key, solid = true) {
  HITS.push({ x, y, w, h: 28, key });
  if (solid) P.rrect(x, y, w, 28, 6, RUST); else { P.rrect(x, y, w, 28, 6, RUST); P.rrect(x + 1, y + 1, w - 2, 26, 5, BG1); }
  ptext(P, Math.round(x + (w - ptextW(label, 1, true)) / 2), y + 10, label, solid ? [30, 16, 8] : RUST, 1, true);
}
/** The fox (its icon's art), k pixels a dot, its top left at x, y. */
function fox(P: Paint, x: number, y: number, k: number) { artColors('reynard')?.forEach((row, j) => row.forEach((c, i) => { if (c) P.rect(x + i * k, y + j * k, k, k, c); })); }

function paintRey(P: Paint, d: ReyPaint) {
  P.grad(0, Y0, SCR_W, Y1 - Y0, [[0, BG0], [1, BG1]]);
  // the bar: the fox, the name, what is open on the right
  P.rect(0, Y0, SCR_W, 24, BAR);
  fox(P, M - 2, Y0 + 7, 1);
  ptext(P, M + 20, Y0 + 8, 'reynard', CREAM, 1, true);
  if (d.right) {
    const rw = ptextW(d.right.slice(0, 18)), rx = SCR_W - M - rw - (d.rightOk ? 14 : 0);
    ptext(P, rx, Y0 + 8, d.right.slice(0, 18), GREY);
    if (d.rightOk) tick(P, SCR_W - M - 10, Y0 + 8, OK2);
  }
  const top = Y0 + 32, G = d.page, typed = (s: string, lag = 0) => (d.t - lag <= 0 ? '' : s.slice(0, Math.ceil((d.t - lag) * 60)));
  if (G.view === 'reg') {
    fox(P, (SCR_W - 18 * 5) >> 1, top + 8, 5);
    ctext(P, top + 64, typed(G.tagline), CREAM, 1, true);
    ctext(P, top + 82, G.number, GREY);
    G.hint.forEach((l, k) => ctext(P, top + 112 + k * 13, l, CREAM));
    if (!G.waiting) button(P, M + 30, top + 150, SCR_W - 2 * M - 60, G.button, 'ok');
    else {
      ctext(P, top + 140, G.typed, RUST, 2, true);
      ctext(P, top + 168, G.codeHint, GREY);
    }
  } else if (G.view === 'list') {
    if (!G.rows.length) G.empty.forEach((l, k) => ctext(P, top + 100 + k * 13, l, GREY));
    G.rows.forEach((r, n) => {
      const y = top + n * 46;
      if (y + 42 > Y1) return;
      HITS.push({ x: 6, y, w: SCR_W - 12, h: 42, key: 'ok', pre: r.pre });
      if (r.sel) P.rrect(6, y, SCR_W - 12, 42, 5, PICKED); else P.rect(M, y + 43, SCR_W - 2 * M, 1, [44, 40, 38]);
      // the contact's mark: the first letter on a rust disc
      P.disc(M + 13, y + 21, 13, RUST); ptext(P, M + 13 - ptextW(r.name[0]?.toUpperCase() ?? '?', 1, true) / 2, y + 17, r.name[0]?.toUpperCase() ?? '?', [30, 16, 8], 1, true);
      const ww = ptextW(r.when), nx = M + 34, nw = ptext(P, nx, y + 9, r.name.slice(0, Math.floor((SCR_W - nx - M - ww - 22) / 7)), r.sel ? [255, 255, 255] : CREAM, 1, true);
      if (r.verified) tick(P, nx + nw + 4, y + 9, OK2);
      ptext(P, SCR_W - M - 4 - ww, y + 9, r.when, GREY);
      ptext(P, nx, y + 25, typed(r.prev, n * 0.04).slice(0, Math.floor((SCR_W - nx - M - 4) / 6)), GREY);
    });
  } else if (G.view === 'chat') {
    let y0 = top;
    if (G.timer) { ptext(P, M, top - 2, G.timer, GREY); y0 += 12; }
    // the bubbles, newest at the bottom, mine to the right in rust, theirs to the left; a line of when (and how it went) under each
    const foot = Y1 - 44, lh = 12;
    let y = foot + G.scroll * lh;
    P.clip(0, y0, SCR_W, foot - 2);
    for (let i = G.bubbles.length - 1; i >= 0 && y > y0; i--) {
      const B = G.bubbles[i], bw = Math.max(...B.lines.map((l) => ptextW(l))) + 16, bh = B.lines.length * lh + 8, x = B.me ? SCR_W - M - bw : M;
      y -= 12;
      ptext(P, B.me ? SCR_W - M - ptextW(B.meta) : M + 2, y + 2, B.meta, GREY);
      y -= bh;
      P.rrect(x, y, bw, bh, 7, B.me ? MINE : THEIRS);
      B.lines.forEach((l, k) => ptext(P, x + 8, y + 5 + k * lh, l, CREAM));
      y -= 6;
    }
    P.clip(0, 0, SCR_W, SCR_H);
    // the line being written, and the typing under it (or the note)
    P.rrect(6, foot, SCR_W - 12, 22, 5, [44, 40, 38]);
    ptext(P, M + 2, foot + 7, '>', RUST, 1, true);
    ptext(P, M + 14, foot + 7, G.line || G.write, G.line ? CREAM : GREY);
    if (d.note) ptext(P, M, foot + 28, d.note, RUST); else paintHint(P, foot + 26, G.hint, GREY);
    return;
  } else if (G.view === 'opts') {
    G.rows.forEach((r, n) => {
      const y = top + 8 + n * 40;
      HITS.push({ x: 6, y, w: SCR_W - 12, h: 34, key: 'ok', pre: r.pre });
      if (r.sel) P.rrect(6, y, SCR_W - 12, 34, 5, PICKED); else P.rect(M, y + 35, SCR_W - 2 * M, 1, [44, 40, 38]);
      ptext(P, M + 6, y + 13, r.label, r.sel ? [255, 255, 255] : CREAM, 1, true);
    });
  } else if (G.view === 'key') {
    ptext(P, M, top, typed(G.title), CREAM, 1, true);
    // the safety number: three rows of four groups of five, big
    for (let r = 0; r < 3; r++) ctext(P, top + 28 + r * 26, G.groups.slice(r * 4, r * 4 + 4).join(' '), G.verified ? OK2 : RUST, 1, true);
    G.hint.forEach((l, k) => ctext(P, top + 116 + k * 13, l, GREY));
    const sw = ptextW(G.status, 1, true) + (G.verified ? 14 : 0), sx = (SCR_W - sw) >> 1;
    ptext(P, sx, top + 170, G.status, G.verified ? OK2 : GREY, 1, true);
    if (G.verified) tick(P, sx + sw - 10, top + 170, OK2);
    button(P, M + 30, Y1 - 40, SCR_W - 2 * M - 60, G.button, 'ok', !G.verified);
  } else if (G.view === 'menu') {
    const y = top + 8;
    HITS.push({ x: 6, y, w: SCR_W - 12, h: 34, key: 'ok' });
    P.rrect(6, y, SCR_W - 12, 34, 5, PICKED);
    ptext(P, M + 6, y + 13, G.wipe, [255, 255, 255], 1, true);
    ptext(P, M, y + 56, G.yourKey, GREY);
    G.groups.forEach((g, k) => ptext(P, M + (k % 3) * 42, y + 74 + Math.floor(k / 3) * 14, g, CREAM));
  } else if (G.view === 'wipe') {
    G.warn.forEach((l, k) => ctext(P, top + 90 + k * 16, l, k ? CREAM : RUST, 1, !k));
    const bw = (SCR_W - 2 * M - 10) / 2;
    button(P, M, top + 170, Math.round(bw), G.yes, 'ok');
    button(P, Math.round(M + bw + 10), top + 170, Math.round(bw), G.keep, 'rsoft', false);
  }
  if (d.note) ctext(P, Y1 - 16, d.note, RUST);
}
