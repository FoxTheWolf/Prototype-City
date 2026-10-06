/**
 * Balloons on the street (14.4, docs/mapa-da-tela.md zone B): short lines over the heads of people
 * near the player. They react to the world (the rain starting, a blackout, the lights coming back, a
 * crash up the street), to the player (running into them, staring, crouching or jumping beside them) and talk among themselves (two
 * waiting at the same light, someone on the phone). At most three show, the nearest first, up to
 * ~12 m; farther, an empty balloon (`...`); nearer than ~3 m the line is also a dim subtitle in zone
 * A, overheard. Only what is seen: not through a building, not from indoors.
 *
 * Interface only: who says what is picked by hash3 and the real clock, never world.rng, so the
 * simulation stays the same with or without it. The words are grammar pieces
 * (locale/text/barks.en.json), in each person's voice.
 */
import { type CharGrid } from './render/grid';
import { VFOV } from './render/raycaster';
import { hash3 } from './core/rng';
import { isSolid } from './sim/city';
import { type Ped } from './sim/peds';
import { type World } from './sim/world';
import { citizenNames } from './locale/names';
import { knowsName } from './talk';
import { expand, rngOf, tidy } from './locale/gen';
import { TEXT } from './locale/text';
import { lifeCtx, selFor } from './locale/voice';
import en from './locale/en.json';

type RGB = [number, number, number];
export interface Bark { who: number; text: string; at: number; until: number }

/** How near people must be to be heard (m), to read their balloon, and to overhear them as a subtitle. */
const HEAR = 20, READ = 12, NEAR = 3;
/** The height of a balloon's tail over the ground (m): just over a head. */
const HEAD = 2.05;
/** Seconds before the same person speaks up again; between two lines no one prompted. */
const QUIET = 20, AMBIENT = [4, 7];
const SHOW = 3, WIDTH = 26;

export class Barks {
  list: Bark[] = [];
  private last = new Map<number, number>();
  private queue: { who: number; key: string; at: number }[] = [];
  private seen = -2;
  private wet = false;
  private stare = -1;
  private stareAt = 0;
  private nextAmbient = 0;
  private lowAt = -1;
  constructor(private w: World) {}

  /** What `who` says for grammar key `key`, in their voice. */
  line(who: number, key: string): string {
    const w = this.w, W = w.weather, r = rngOf(who, key.length, Math.floor(w.time / 60));
    return tidy(expand(`#${key}#`, TEXT, r, lifeCtx(w.city, w.pop, who, r), selFor(w.pop, who, w.time, W.temp, W.precip, W.snow)));
  }
  say(who: number, text: string, now: number) {
    if (!text) return;
    this.list = this.list.filter((b) => b.who !== who);
    this.list.push({ who, text, at: now, until: now + 2.2 + text.length / 14 });
    this.last.set(who, now);
  }
  private quiet(who: number, now: number, s = QUIET) { return now - (this.last.get(who) ?? -99) > s; }

  /** People near enough to hear, not stopped to talk to the player, with nothing in between; the nearest first. */
  near(): { q: Ped; d: number }[] {
    const p = this.w.player, out: { q: Ped; d: number }[] = [];
    for (const q of this.w.peds) {
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < HEAR && !q.hold && seen(this.w, p.x, p.y, q.x, q.y)) out.push({ q, d });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  /** Once a frame: who speaks up now. `yaw` is where the player looks. */
  update(now: number, yaw: number) {
    const w = this.w, p = w.player, W = w.weather;
    this.list = this.list.filter((b) => b.until > now);
    for (let k = this.queue.length - 1; k >= 0; k--) {
      const Q = this.queue[k];
      if (Q.at > now) continue;
      this.queue.splice(k, 1);
      if (w.peds.some((q) => q.id === Q.who && !q.hold)) this.say(Q.who, this.line(Q.who, Q.key), now);
    }
    const ev = w.events.list, newest = ev.length ? ev[ev.length - 1].id : -1;
    if (this.seen === -2) { this.seen = newest; this.wet = W.precip > 0.15; }
    if (p.inside >= 0) { this.list.length = 0; this.queue.length = 0; this.seen = newest; this.wet = W.precip > 0.15; return; }
    const near = this.near();
    // a few of the nearest react, one after the other
    const react = (key: string, n: number) => {
      let t = now + 0.3;
      for (const { q } of near) {
        if (!n) break;
        if (!this.quiet(q.id, now, 6) || this.queue.some((Q) => Q.who === q.id)) continue;
        this.queue.push({ who: q.id, key, at: t }); t += 0.7 + hash3(q.id, 3, Math.floor(now)) * 0.8; n--;
      }
    };
    // the world: the rain starting, the power going or coming back, a crash up the street
    const wet = W.precip > 0.15;
    if (wet && !this.wet) react(W.snow ? 'bark.snow' : 'bark.rain', 2);
    this.wet = wet;
    for (const e of ev) {
      if (e.id <= this.seen) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (e.kind === 'blackout' && d < 500) react('bark.dark', 2);
      else if (e.kind === 'restored' && d < 500) react('bark.lights', 1);
      else if (e.kind === 'crash' && d < 150) react('bark.crash', 2);
    }
    this.seen = newest;
    // the player: running into someone, staring at them
    for (const { q, d } of near) {
      if (d > 1.4) break;
      if (p.speed > 6 && this.quiet(q.id, now, 8)) this.say(q.id, this.line(q.id, 'bark.bump'), now);
    }
    // crouched for a while beside someone, or jumping about next to them (14.8)
    if ((p.crouch ?? 0) > 0.8) { if (this.lowAt < 0) this.lowAt = now; } else this.lowAt = -1;
    for (const { q, d } of near) {
      if (d > 4) break;
      if (this.lowAt >= 0 && now - this.lowAt > 2 && this.quiet(q.id, now, 30)) { this.say(q.id, this.line(q.id, 'bark.crouch'), now); break; }
      if ((p.hop ?? 0) > 0.3 && this.quiet(q.id, now, 30) && hash3(q.id, 13, Math.floor(now)) < 0.5) { this.say(q.id, this.line(q.id, 'bark.jump'), now); break; }
    }
    const fx = Math.cos(yaw), fy = Math.sin(yaw);
    const eyed = near.find(({ q, d }) => d < 6 && ((q.x - p.x) * fx + (q.y - p.y) * fy) / d > 0.995);
    if (!eyed || eyed.q.id !== this.stare) { this.stare = eyed ? eyed.q.id : -1; this.stareAt = now; }
    else if (now - this.stareAt > 2.5 && this.quiet(eyed.q.id, now, 40)) this.say(eyed.q.id, this.line(eyed.q.id, 'bark.stare'), now);
    // on their own: someone on the phone, two waiting at the same light
    if (now < this.nextAmbient) return;
    this.nextAmbient = now + AMBIENT[0] + hash3(7, 7, Math.floor(now)) * (AMBIENT[1] - AMBIENT[0]);
    const close = near.filter(({ d, q }) => d < READ && this.quiet(q.id, now));
    const caller = close.find(({ q }) => q.use === 1);
    if (caller && hash3(caller.q.id, 5, Math.floor(now / 5)) < 0.6) { this.say(caller.q.id, this.line(caller.q.id, 'bark.phone'), now); return; }
    for (const { q: a } of close) {
      if (!a.wait) continue;
      const b = close.find(({ q }) => q !== a && q.wait && Math.hypot(q.x - a.x, q.y - a.y) < 3);
      if (!b) continue;
      const recent = ev.some((e) => (e.kind === 'blackout' || e.kind === 'crash') && w.time - e.time < 7200 && Math.hypot(e.x - a.x, e.y - a.y) < 800);
      const topics = ['light', 'weather', 'work', ...(recent ? ['news', 'news'] : [])], t = topics[Math.floor(hash3(a.id, b.q.id, Math.floor(now / 30)) * topics.length)];
      this.say(a.id, this.line(a.id, `bark.chat.${t}.a`), now);
      this.queue.push({ who: b.q.id, key: `bark.chat.${t}.b`, at: now + 2.4 });
      this.last.set(b.q.id, now);
      return;
    }
  }
}

/** Whether nothing solid stands between two points on the street (sampled every metre). */
function seen(w: World, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d);
  for (let k = 1; k < n; k++) if (isSolid(w.city, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n)) return false;
  return true;
}

/** Where the world draws, and where the interface does (both in pixels of the canvas). */
export interface Screen { cols: number; rows: number; cellW: number; cellH: number; originX: number; originY: number }
export interface Eye { x: number; y: number; eye: number; yaw: number; pitch: number }

/** A point of the world on the interface's grid (column, row), or null behind the eye; as the GPU's 3D camera sees it. */
export function toUi(v: Eye, x: number, y: number, z: number, world: Screen, ui: Screen): [number, number] | null {
  const dirX = Math.cos(v.yaw), dirY = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
  const rx = x - v.x, ry = y - v.y, rz = z - v.eye, f = rx * dirX + ry * dirY, lat = -rx * dirY + ry * dirX;
  const d = f * cp + rz * sp, up = -f * sp + rz * cp;
  if (d < 0.3) return null;
  const scale = world.rows / 2 / Math.tan(VFOV / 2), plane = ((world.cols / 2) * (world.cellW / world.cellH)) / scale;
  const px = world.originX + (world.cols / 2) * (1 + lat / (d * plane)) * world.cellW, py = world.originY + (world.rows / 2 - (up / d) * scale) * world.cellH;
  return [(px - ui.originX) / ui.cellW, (py - ui.originY) / ui.cellH];
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

const INK: RGB = [235, 228, 214], EDGE: RGB = [150, 132, 104], PAPER: RGB = [18, 16, 14], DIM: RGB = [170, 160, 145], AMBER: RGB = [255, 176, 74], SHADOW: RGB = [8, 7, 6];

/**
 * The balloons, over the heads they belong to, in the top two thirds of the screen only (below are the
 * conversation, the watch and the phone); and the nearest line as an overheard subtitle when `sub`.
 */
export function drawBarks(g: CharGrid, B: Barks, w: World, v: Eye, world: Screen, ui: Screen, sub: boolean) {
  const p = w.player, shown: { b: Bark; q: Ped; d: number }[] = [];
  if (p.inside < 0) drawNames(g, B, w, v, world, ui);
  if (!B.list.length) return;
  for (const b of B.list) {
    const q = w.peds.find((e) => e.id === b.who);
    if (!q) continue;
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < HEAR && seen(w, p.x, p.y, q.x, q.y)) shown.push({ b, q, d });
  }
  shown.sort((a, b) => a.d - b.d);
  const put = (x: number, y: number, s: string, fg: RGB, bg: RGB | null) => {
    for (let k = 0; k < s.length; k++) {
      if (x + k < 0 || x + k >= g.cols || y < 0 || y >= g.rows) continue;
      const i = y * g.cols + x + k;
      g.put(i, s.charCodeAt(k), fg[0], fg[1], fg[2]);
      if (bg) g.setBg(i, bg[0], bg[1], bg[2]);
    }
  };
  const limit = Math.floor((g.rows * 2) / 3);
  for (const { b, q, d } of shown.slice(0, SHOW)) {
    const at = toUi(v, q.x, q.y, HEAD, world, ui);
    if (!at) continue;
    const lines = d > READ ? ['...'] : wrap(b.text, WIDTH).slice(0, 3), bw = Math.max(...lines.map((l) => l.length)) + 4;
    const cx = Math.round(at[0]), tail = Math.round(at[1]) - 1, bottom = tail - 1, top = bottom - lines.length - 1;
    if (tail >= limit || top < 0 || cx < 0 || cx >= g.cols) continue;
    const x0 = Math.max(0, Math.min(g.cols - bw, cx - (bw >> 1)));
    put(x0, top, '.' + '-'.repeat(bw - 2) + '.', EDGE, PAPER);
    lines.forEach((l, k) => { put(x0, top + 1 + k, '|', EDGE, PAPER); put(x0 + 1, top + 1 + k, ` ${l}`.padEnd(bw - 2), INK, PAPER); put(x0 + bw - 1, top + 1 + k, '|', EDGE, PAPER); });
    put(x0, bottom, "'" + '-'.repeat(bw - 2) + "'", EDGE, PAPER);
    put(Math.max(x0 + 1, Math.min(x0 + bw - 2, cx)), bottom, 'v', EDGE, PAPER);
  }
  // overheard: the nearest line also as a dim subtitle, in the conversation's place
  const o = shown[0];
  if (!sub || !o || o.d > NEAR) return;
  const mem = w.talks.get(o.b.who), who = mem?.name ? citizenNames(w.city, w.pop, o.b.who)[0] : en.talk.passerby;
  const x0 = 46, W = Math.max(60, g.cols - 62 - x0), lines = wrap(`${who}: ${o.b.text}`, W - 4).slice(-2);
  lines.forEach((l, k) => {
    const y = g.rows - 13 - lines.length + k;
    if (k === 0) { put(x0, y, who + ':', AMBER.map((c) => c * 0.75) as RGB, SHADOW); put(x0 + who.length + 1, y, l.slice(who.length + 1), DIM, SHADOW); }
    else put(x0, y, l, DIM, SHADOW);
  });
}

/**
 * The names the player knows (14.9): over the head of whoever said theirs, while it is remembered
 * (knowsName), up to 15 m, not behind a building, not over someone with a balloon up.
 */
function drawNames(g: CharGrid, B: Barks, w: World, v: Eye, world: Screen, ui: Screen) {
  const p = w.player, limit = Math.floor((g.rows * 2) / 3);
  let n = 0;
  for (const q of w.peds) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d > 15 || n >= 6 || !knowsName(w, q.id) || B.list.some((b) => b.who === q.id) || !seen(w, p.x, p.y, q.x, q.y)) continue;
    const at = toUi(v, q.x, q.y, HEAD, world, ui);
    if (!at) continue;
    const name = citizenNames(w.city, w.pop, q.id)[0], y = Math.round(at[1]) - 1, x = Math.round(at[0] - name.length / 2);
    if (y < 0 || y >= limit) continue;
    const k = 1 - d / 18;
    for (let c = 0; c < name.length; c++) if (x + c >= 0 && x + c < g.cols) g.put(y * g.cols + x + c, name.charCodeAt(c), AMBER[0] * k, AMBER[1] * k, AMBER[2] * k);
    n++;
  }
}
