import { type CharGrid } from './render/grid';
import { hash3 } from './core/rng';
import { nearestRoad, type BusinessKind } from './sim/city';
import { type Ped } from './sim/peds';
import { type World } from './sim/world';
import { placeAt, placeName, type Place } from './phone/places';
import { landmarkName, roadName } from './locale/names';
import { expand, rngOf, tidy } from './locale/gen';
import { TEXT } from './locale/text';
import { selFor, voice } from './locale/voice';
import en from './locale/en.json';

const T = en.ask;
/** How near someone must be to be asked, m; how far a place may be for them to know it, m. */
const REACH = 2.4, KNOWN = 1600;
/** The kinds of place one asks the way to, in the list's order. */
const KINDS: BusinessKind[] = ['cafe', 'diner', 'bar', 'grocery', 'pharmacy', 'bank', 'electronics', 'phones', 'cyber', 'motel', 'laundry', 'pawn'];
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/**
 * Asking the way (13.9): F by someone on the sidewalk lists where one might want to go (a kind of
 * place, its nearest one; or a landmark); they stop, face the player, point the first way and say
 * the route in blocks and street names, in their own voice (locale/text/directions.en.json). Some
 * do not know it (the farther, the fewer), some are wrong (left for right), and late at night some
 * do not stop. A first, simple talk with the city's people before the dialogue of stage 14.
 */
export class AskWay {
  /** The person asked (a citizen on the street), or -1 while the list is closed. */
  who = -1;
  pick = 0;
  /** What they said, when, and who said it. */
  said = '';
  saidAt = -99;
  constructor(private world: World) {}

  get open() { return this.who >= 0; }

  /** Someone near enough, in front of the player, to ask; or null. */
  near(yaw: number): Ped | null {
    const p = this.world.player;
    if (p.inside >= 0) return null;
    let best: Ped | null = null, bd = REACH;
    const fx = Math.cos(yaw), fy = Math.sin(yaw);
    for (const q of this.world.peds) {
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
      if (d < bd && (dx * fx + dy * fy) / (d || 1) > 0.5) { bd = d; best = q; }
    }
    return best;
  }

  /** The list: the kinds of place, then the landmarks by name. */
  rows(): { label: string; place: () => Place | null }[] {
    const w = this.world, c = w.city, p = w.player, out: { label: string; place: () => Place | null }[] = [];
    const kinds = en.phone.find.kinds as Record<string, string>;
    for (const k of KINDS) out.push({
      label: kinds[k] ?? k,
      place: () => {
        let best: Place | null = null, bd = Infinity;
        c.businesses.forEach((b, n) => { if (b.kind !== k) return; const [x, y] = placeAt(c, n), d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = n; } });
        return best;
      },
    });
    c.landmarks.forEach((_, n) => out.push({ label: landmarkName(c, n), place: () => -n - 1 }));
    return out;
  }

  /**
   * Ask q: they stop and face the player while the list is open (13.11d), unless they are crossing
   * the street or going through a door; then they walk on with a word.
   */
  ask(q: Ped, now: number) {
    if (q.way.length || q.door) { this.who = q.id; this.say(q.id, null, 'dir.busy', {}, now); this.who = -1; return; }
    this.who = q.id; this.pick = 0;
    q.hold = 60 * 60; q.pdx = q.pdy = 0;
  }
  /** Closed without an answer: they walk on after a moment. */
  close() {
    const q = this.world.peds.find((e) => e.id === this.who);
    if (q && (q.hold ?? 0) > 90 && !q.pdx && !q.pdy) q.hold = 30;
    this.who = -1;
  }
  private say(id: number, pl: Place | null, key: string, ctx: Record<string, string>, now: number) {
    const w = this.world, P = w.pop, W = w.weather, sel = selFor(P, id, w.time, W.temp, W.precip, W.snow), r = rngOf(id, pl ?? 0, Math.floor(w.time / 600));
    this.said = voice(tidy(expand(`#${key}#`, TEXT, r, { ...ctx, place: pl === null ? '' : placeName(w.city, pl) }, sel)), P, id, r);
    this.saidAt = now;
  }

  /** A key while the list is open: true when it was the list's. */
  key(code: string, now: number): boolean {
    if (!this.open) return false;
    const n = this.rows().length;
    if (code === 'ArrowUp') this.pick = (this.pick + n - 1) % n;
    else if (code === 'ArrowDown') this.pick = (this.pick + 1) % n;
    else if (code === 'Enter' || code === 'Space') { this.answer(this.rows()[this.pick].place(), now); this.who = -1; }
    else if (code === 'Escape' || code === 'KeyF') this.close();
    else return false;
    return true;
  }

  /** Their answer about place pl: said, and they stop to say it (pointing the first way). */
  private answer(pl: Place | null, now: number) {
    const w = this.world, c = w.city, id = this.who, q = w.peds.find((e) => e.id === id), me = w.player;
    if (!q) return;
    const h = (k: number) => hash3(id, pl ?? -999, k + Math.floor(w.time / 3600)), hour = (w.time / 3600) % 24;
    const say = (key: string, ctx: Record<string, string> = {}) => this.say(id, pl, key, ctx, now);
    const hold = (s: number, px = 0, py = 0) => { q.hold = Math.round(s * 60); q.pdx = px; q.pdy = py; };
    // late at night some walk on
    if ((hour >= 23 || hour < 5) && h(1) < 0.35) { say('dir.busy'); q.hold = 0; return; }
    if (pl === null) { say('dir.dunno'); hold(3); return; }
    const [tx, ty] = placeAt(c, pl), d = Math.hypot(tx - me.x, ty - me.y);
    if (d > KNOWN || h(2) < 0.08 + 0.5 * (d / KNOWN) ** 2) { say('dir.dunno'); hold(3); return; }
    // the route on the grid: so many streets north or south, so many avenues east or west
    const i0 = nearestRoad(c.xb, c.xCell, me.x), i1 = nearestRoad(c.xb, c.xCell, tx), j0 = nearestRoad(c.yb, c.yCell, me.y), j1 = nearestRoad(c.yb, c.yCell, ty);
    const wrong = h(3) < 0.1, ew = (i1 - i0) * (wrong ? -1 : 1), ns = j1 - j0;
    const blocks = (n: number) => `${NUM[Math.abs(n)] ?? Math.abs(n)} block${Math.abs(n) === 1 ? '' : 's'}`;
    const NS = ns < 0 ? T.north : T.south, EW = ew > 0 ? T.east : T.west;
    if (!ns && !ew) {
      const dx = tx - me.x, dy = ty - me.y, way = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? T.east : T.west) : dy < 0 ? T.north : T.south;
      say('dir.near', { feet: String(Math.max(20, Math.round((d * 3.28) / 10) * 10)), way });
      hold(4, Math.sign(dx), Math.sign(dy));
      return;
    }
    // first along the longer way, to the street (or avenue) the place is on
    const road = Math.abs(ns) >= Math.abs(ew) ? roadName(c, true, i1) : roadName(c, false, j1);
    if (!ns || !ew) {
      const leg1 = ns ? `${NS} ${blocks(ns)}` : `${EW} ${blocks(ew)}`;
      say('dir.one', { leg1, road });
      hold(5, ns ? 0 : Math.sign(ew), ns ? Math.sign(ns) : 0);
      return;
    }
    const nsFirst = Math.abs(ns) >= Math.abs(ew);
    const leg1 = nsFirst ? `${NS} ${blocks(ns)} to ${roadName(c, false, j1)}` : `${EW} ${blocks(ew)} to ${roadName(c, true, i1)}`;
    const leg2 = nsFirst ? `${EW} ${blocks(ew)}` : `${NS} ${blocks(ns)}`;
    say('dir.answer', { leg1, leg2, road });
    hold(6, nsFirst ? 0 : Math.sign(ew), nsFirst ? Math.sign(ns) : 0);
  }
}

/** The list of places, on paper in the middle of the screen; and what was said, under it, for a few seconds. */
export function drawAskWay(g: CharGrid, A: AskWay, now: number) {
  if (now - A.saidAt < 7 && A.said) {
    // their words, wrapped, over a dark strip
    const W = Math.min(90, g.cols - 8), words = `"${A.said}"`.split(' '), lines: string[] = [];
    let l = '';
    for (const s of words) { if ((l + ' ' + s).trim().length > W - 4) { lines.push(l.trim()); l = s; } else l += ' ' + s; }
    lines.push(l.trim());
    const y0 = g.rows - 12 - lines.length, x0 = (g.cols - W) >> 1;
    g.text(x0, y0 - 1, ` ${T.they} `.padEnd(W), [150, 200, 255], [10, 12, 18]);
    lines.forEach((s, k) => g.text(x0, y0 + k, ` ${s}`.padEnd(W), [235, 235, 225], [10, 12, 18]));
  }
  if (!A.open) return;
  const rows = A.rows(), W = 44, show = Math.min(rows.length, 16), top = Math.max(0, Math.min(rows.length - show, A.pick - (show >> 1)));
  const H = show + 6, x0 = (g.cols - W) >> 1, y0 = Math.max(1, (g.rows - H) >> 1) - 4;
  const PAPER = [228, 222, 200], INK = [40, 36, 30], DIM = [120, 112, 96], SEL = [30, 26, 20];
  for (let y = 0; y < H; y++) g.text(x0, y0 + y, ' '.repeat(W), INK, PAPER);
  g.text(x0 + 2, y0 + 1, T.title, INK, PAPER);
  g.text(x0 + 2, y0 + 2, '-'.repeat(W - 4), DIM, PAPER);
  for (let k = 0; k < show; k++) {
    const n = top + k, on = n === A.pick, s = `${on ? '>' : ' '} ${rows[n].label}`.slice(0, W - 4);
    g.text(x0 + 1, y0 + 3 + k, ` ${s}`.padEnd(W - 2), on ? [255, 230, 160] : INK, on ? SEL : PAPER);
  }
  g.text(x0 + 2, y0 + H - 2, T.keys.slice(0, W - 4), DIM, PAPER);
}
