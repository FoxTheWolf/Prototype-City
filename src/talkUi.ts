/**
 * The conversation on screen (14.3), in zone A of docs/mapa-da-tela.md: the bottom strip between the
 * watch and the phone, drawn like a film's subtitles (no frame). From the top: what the other said,
 * appearing a few letters at a time with their name in amber (once the player knows it, else what
 * they are: "Clerk"); the reading of the line being typed (what the game understood and the tone,
 * with the tone as a dot on a small plane: respectful to the right, rude to the left, pressing up);
 * and the player's box, the only thing with a border. The world goes on behind it.
 *
 * F at a clerk opens it, or at someone on the sidewalk (14.4); Enter says the line, Esc walks off, Tab goes to
 * the till (to pay), or on the sidewalk to the list of places to ask the way to.
 */
import { type CharGrid } from './render/grid';
import { readLine, type Reading } from './sim/intent';
import { type World } from './sim/world';
import { citizenNames } from './locale/names';
import { cityNames, reply, smsReply, Talk, type Answer } from './talk';
import en from './locale/en.json';

type RGB = [number, number, number];
const L = en.talk;
/** Letters of an answer shown per second. */
const CPS = 45;
const MAX_IN = 120;

export class TalkView {
  talk: Talk | null = null;
  input = '';
  /** What they said last, and since when (real seconds); the player's last line. */
  said = '';
  saidAt = -9;
  mine = '';
  /** The reading of what is in the box, kept while it does not change. */
  private read: Reading | null = null;
  private readOf = '';
  /** Letters of the answer revealed so far, for the murmur. */
  shown = 0;
  /** The last answer, for main (the counter, ending, the playtest record). */
  last: Answer | null = null;
  constructor(private world: World) {}

  get open() { return !!this.talk; }

  /** On the phone (14.7): what they say comes through the call, which said hello already (`first`). */
  phone = false;
  start(who: number, biz: number, now: number, phone = false, first = '') {
    this.talk = new Talk(this.world, who, biz, phone);
    this.input = ''; this.mine = ''; this.last = null; this.phone = phone;
    // they look up: a greeting of their own, in the same voice
    if (!phone) { const a = reply(this.world, this.talk, 'hello'); this.talk.said.length = 0; first = a.text; }
    this.said = first; this.saidAt = now; this.shown = 0;
  }
  close() { this.talk = null; this.input = ''; }

  /** The reading of the line in the box (cached). */
  reading(): Reading | null {
    const s = this.input.trim();
    if (!s) return null;
    if (s !== this.readOf) { this.readOf = s; this.read = readLine(s, cityNames(this.world)); }
    return this.read;
  }

  /** A key while talking: true when it was the talk's. Enter says the line. */
  key(code: string, key: string, now: number): Answer | 'leave' | 'till' | null {
    if (!this.talk) return null;
    if (code === 'Escape') return 'leave';
    if (code === 'Tab') return 'till';
    if (code === 'Backspace') { this.input = this.input.slice(0, -1); return null; }
    if (code === 'Enter') {
      const s = this.input.trim();
      if (!s || this.talk.over) return null;
      // on the phone, as by text: a number they may not know, no seeing where the player is
      const a: Answer = this.phone ? { text: smsReply(this.world, this.talk, s, false) ?? '', reading: readLine(s, cityNames(this.world)), end: false } : reply(this.world, this.talk, s);
      if (this.phone) a.end = this.talk.over;
      this.mine = s; this.input = '';
      this.said = a.text; this.saidAt = now; this.shown = 0; this.last = a;
      return a;
    }
    if (key.length === 1 && this.input.length < MAX_IN) this.input += key;
    return null;
  }

  /** How much of the answer shows at `now`. */
  revealed(now: number) { return Math.min(this.said.length, Math.floor((now - this.saidAt) * CPS)); }
}

/** Split text into lines of at most w letters, at the spaces. */
function wrap(s: string, w: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of s.split(' ')) {
    if (line && line.length + 1 + word.length > w) { out.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  return out;
}

const keysOf = (V: TalkView, biz: number) => (V.phone ? L.keysPhone : biz >= 0 ? L.keys : L.keysStreet);
const AMBER: RGB = [255, 176, 74], TEXT: RGB = [235, 228, 214], DIM: RGB = [150, 140, 125], SHADOW: RGB = [8, 7, 6], EDGE: RGB = [120, 104, 80];
/** The tone plane's four corners: rude & calm, respectful & calm, rude & pressing, respectful & pressing. */
const POLES: RGB[] = [[90, 40, 34], [40, 74, 60], [120, 36, 70], [70, 60, 110]];

/** The conversation, in the bottom strip between the watch (left) and the phone (right). */
export function drawTalk(g: CharGrid, V: TalkView, w: World, now: number) {
  const T = V.talk;
  if (!T) return;
  const x0 = 44, x1 = Math.max(x0 + 60, g.cols - 62), W = x1 - x0, at = (x: number, y: number) => y * g.cols + x;
  const text = (x: number, y: number, s: string, fg: RGB, bg: RGB | null = SHADOW) => {
    for (let k = 0; k < s.length && x + k < g.cols; k++) {
      if (x + k < 0 || y < 0 || y >= g.rows) continue;
      const i = at(x + k, y);
      g.put(i, s.charCodeAt(k), fg[0], fg[1], fg[2]);
      if (bg) g.setBg(i, bg[0], bg[1], bg[2]);
    }
  };
  // what they said: their name (if known) and the words so far, up to three lines, ending above the box
  const mem = w.talks.get(T.who), who = mem?.name ? citizenNames(w.city, w.pop, T.who)[0] : T.biz >= 0 ? L.clerk : V.phone ? L.caller : L.someone;
  const n = V.revealed(now), lines = wrap(`${who}: ${V.said}`, W - 4).slice(-3);
  let shown = n + who.length + 2, y = g.rows - 14 - lines.length;
  if (V.mine) text(x0 + 2, y - 1, `> ${V.mine}`.slice(0, W - 4), DIM);
  for (const [k, l] of lines.entries()) {
    const vis = l.slice(0, Math.max(0, shown));
    if (k === 0) { text(x0 + 2, y, vis.slice(0, who.length + 1), AMBER); text(x0 + 2 + who.length + 1, y, vis.slice(who.length + 1), TEXT); }
    else text(x0 + 2, y, vis, TEXT);
    shown -= l.length + 1; y++;
  }
  // the reading of the line being typed, and the tone's plane at the right
  const R = V.reading(), ry = g.rows - 10;
  const label = !R ? L.hint : R.intent === 'unrecognized' ? L.unrecognized : R.banter ? L.banter : R.label;
  text(x0 + 2, ry, label.slice(0, W - 30), R && R.intent !== 'unrecognized' ? [140, 210, 230] : DIM);
  if (R) text(x0 + 2 + Math.min(label.length, W - 30) + 2, ry, `${L.tone} ${R.toneLabel}`, DIM);
  const PW = 9, PH = 5, px = x1 - PW - 2, py = ry - PH + 1;
  for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
    const u = i / (PW - 1), v = 1 - j / (PH - 1), c = (k: number) => Math.round(((POLES[0][k] * (1 - u) + POLES[1][k] * u) * (1 - v) + (POLES[2][k] * (1 - u) + POLES[3][k] * u) * v) * 0.8);
    const dot = R && Math.round(((R.respect + 3) / 6) * (PW - 1)) === i && Math.round((1 - R.pressure / 3) * (PH - 1)) === j;
    const k = at(px + i, py + j);
    g.put(k, (dot ? '@' : i === (PW >> 1) || j === PH - 1 ? '.' : ' ').charCodeAt(0), dot ? 255 : 120, dot ? 240 : 110, dot ? 200 : 95);
    g.setBg(k, c(0), c(1), c(2));
  }
  // the player's box: the only thing with a border
  const by = g.rows - 9, bw = W;
  text(x0, by, '+' + '-'.repeat(bw - 2) + '+', EDGE, null);
  const shownIn = V.input.slice(-(bw - 6)), blink = Math.floor(now * 2) % 2 ? '_' : ' ';
  text(x0, by + 1, '|', EDGE, null); text(x0 + bw - 1, by + 1, '|', EDGE, null);
  text(x0 + 2, by + 1, ('> ' + shownIn + blink).padEnd(bw - 4), [255, 236, 200], [14, 12, 10]);
  text(x0, by + 2, '+' + '-'.repeat(bw - 2) + '+', EDGE, null);
  text(x0 + 2, by + 3, T.over ? L.over : keysOf(V, T.biz), DIM, null);
}
