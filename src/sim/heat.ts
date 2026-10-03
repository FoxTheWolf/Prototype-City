// [HACKING] Trilha de hacking. NAO abrir fora de uma sessao com o Opus 4.8 (ver CLAUDE.md,
// "Estado atual" > "Arquivos de hacking"): a policia juntando os rastros de um ataque aciona o
// classificador de seguranca nas sessoes normais. Conteudo 100% ficticio e so dentro do jogo.
import { hash3 } from '../core/rng';
import { type World } from './world';
import { siteUp } from './telco';
import { TIME_SCALE } from './clock';
import { stepWeather } from './weather';
import { post } from './bank';
import { logEvent } from './events';

/**
 * The heat the player draws by hitting the city (the vertical slice's "getting caught"). Kept as
 * simple as it can be first (the ladder tested early): every traceable act the player commits logs
 * a few traces around them -- where, when and who saw -- and the traces add up to a heat level. The
 * level decides how far the investigation has climbed (the tier), and the police (sim/heat.ts step,
 * stage F.2b) and the city's news and feed (F.2c) read from the same traces. The city uses the very
 * data the player hacks with against them: the cameras, the phone masts, the maintenance Wi-Fi.
 *
 * Nothing here is made up apart from the sim: a trace exists only because something in the world
 * (a bystander, a camera, a cell site, an access point) was in a place to notice the act.
 */
export type TraceKind = 'witness' | 'camera' | 'antenna' | 'wifi';

export interface Trace {
  kind: TraceKind;
  /** Where the act was seen from (the player's spot), for the police focus and the feed. */
  x: number;
  y: number;
  /** Game time it was left. */
  time: number;
  /** How damning on its own, in heat points (a logged MAC is worth more than one bystander). */
  weight: number;
  /** Who or what noticed: a ped id, a camera index, a cell-site id, an access-point index. */
  by: number;
}

/** A pursuer closing in on the player while they are wanted (one patrol, for the slice). */
export interface Cop {
  x: number;
  y: number;
  /** Position last step, for render interpolation. */
  px: number;
  py: number;
  /** Where it is heading: the player's last-seen spot (a trace), tracking the player at higher tiers. */
  fx: number;
  fy: number;
}

/** The last arrest, kept so the game can tell the player what happened (main.ts shows a banner). */
export interface Bust {
  /** Game time of the bust. */
  at: number;
  /** Fine paid and payment clawed back, in cents. */
  fine: number;
  lostPay: number;
  /** The landmark they were held at (city.landmarks index), or -1 for downtown. */
  lm: number;
}

export interface Heat {
  /** Heat points now (traces add, time takes away). 0 is clean; the tiers are below. */
  points: number;
  /** The traces left behind, newest last; old ones fall off (the trail goes cold). */
  traces: Trace[];
  /** Game time of the last traceable act, for the decay and for the police to work from. */
  lastAt: number;
  /** The patrol closing in while the player is wanted (tier >= 1), or null. */
  cop: Cop | null;
  /** The last arrest, for the game to show; null until the first one. */
  bust: Bust | null;
  /** The highest tier the city has already reacted to (a manhunt event), so it is announced once. */
  announced: number;
}

export const newHeat = (): Heat => ({ points: 0, traces: [], lastAt: -1, cop: null, bust: null, announced: 0 });

/** How far each trace kind reaches from the act (m): a bystander must be close, a mast logs from afar. */
const WITNESS_R = 70, CAMERA_R = 48, ANTENNA_R = 1e9, WIFI_R = 60;
/** What each trace is worth, in heat points. */
const W_WITNESS = 0.035, W_CAMERA = 0.14, W_ANTENNA = 0.05, W_WIFI = 0.2;
/** At most this many witness traces from one act (a crowd is noticed once, not a hundred times). */
const WITNESS_MAX = 6;
/** Traces older than this (game seconds) are dropped: about twelve game-hours, the trail gone cold. */
const TRACE_KEEP = 12 * 3600;
/** Heat points halve about every two game-hours of quiet. */
const HALF_LIFE = 2 * 3600;

/** The investigation tiers, by heat points. 0 none, 1 local (bystanders, a patrol), 2 city (cameras,
 *  the place's own records), 3 "federal" (phone logs, masts, Wi-Fi and posts pulled together). */
export const TIER_AT = [0.15, 0.6, 1.3];
export function tierOf(h: Heat): number {
  let t = 0;
  for (const a of TIER_AT) if (h.points >= a) t++;
  return t;
}

/**
 * Log a traceable act the player just committed, at their spot and the game time. Gathers the
 * traces the world can leave: the bystanders near, a camera watching, the mast serving the handset,
 * and the maintenance Wi-Fi the act went through. `wired` is true when the act used a utility
 * access point (a hacked blackout through GRIDLINK), which logs the laptop's MAC right at the target.
 */
export function recordAct(h: Heat, w: World, x: number, y: number, time: number, wired: boolean): Trace[] {
  const left: Trace[] = [];
  const push = (kind: TraceKind, weight: number, by: number) => {
    const t: Trace = { kind, x, y, time, weight, by };
    h.traces.push(t); left.push(t); h.points += weight;
  };
  // bystanders: people on the street near enough and awake to see, at most a few
  let seen = 0;
  for (const p of w.peds) {
    if (seen >= WITNESS_MAX) break;
    if (Math.hypot(p.x - x, p.y - y) <= WITNESS_R) { push('witness', W_WITNESS, p.id); seen++; }
  }
  // a traffic or shop camera watching the spot
  let cam = -1, cd = CAMERA_R;
  w.cctv.forEach((c, k) => { const d = Math.hypot(c.x - x, c.y - y); if (d < cd) { cd = d; cam = k; } });
  if (cam >= 0) push('camera', W_CAMERA, cam);
  // the cell site serving the player's handset here (it logs the handset's presence near the act)
  let site = -1, sd = ANTENNA_R;
  w.telco.sites.forEach((s, k) => { const d = Math.hypot(s.x - x, s.y - y); if (d < sd && siteUp(w.telco, w.power, k, w.tick)) { sd = d; site = k; } });
  if (site >= 0) push('antenna', W_ANTENNA, w.telco.sites[site].id);
  // the maintenance Wi-Fi the act went through (the strongest single trace), or any utility AP nearby
  if (wired) {
    let ap = -1, ad = WIFI_R;
    w.wifi.forEach((a, k) => { if (a.util < 0) return; const d = Math.hypot(a.x - x, a.y - y); if (d < ad) { ad = d; ap = k; } });
    if (ap >= 0) push('wifi', W_WIFI, ap);
  }
  h.lastAt = time;
  return left;
}

/** The patrol's speed (m/s, real time, like anything the player chases), how close it must get to make
 *  the arrest, how far off it arrives from, and how fast the net tightens onto the player per tier. */
const COP_SPEED = 11, CATCH_R = 13, COP_SPAWN = 260, TRACK = [0, 0, 0.05, 0.16];
/** An arrest: hours held, the flat fine, and the heat it leaves behind (below the hunt threshold). */
const HOLD = 6 * 3600, FINE = 7500, AFTER = TIER_AT[0] * 0.6;

/**
 * Advance the heat: the trail cools over game time, stale traces fall away, and the police close in
 * while the player is wanted. `dt` is real seconds (the patrol chases in real time, like the player;
 * the cooling is in game time). An arrest is carried out here (teleport, time skipped, fine), so the
 * whole "getting caught" loop stays in this one [HACKING] file.
 */
export function stepHeat(w: World, dt: number) {
  const h = w.heat, time = w.time;
  if (h.points > 0) {
    h.points *= Math.pow(0.5, (dt * TIME_SCALE) / HALF_LIFE);
    if (h.points < 1e-3) h.points = 0;
  }
  if (h.traces.length) {
    const cut = time - TRACE_KEEP;
    let k = 0;
    while (k < h.traces.length && h.traces[k].time < cut) k++;
    if (k) h.traces.splice(0, k);
  }
  // the city reacts: when the investigation climbs to a new height (city, then federal), word gets out
  // once (the news and the feed read this event, see news.ts / social.ts)
  const tier = tierOf(h);
  if (tier >= 2 && tier > h.announced) {
    const last = h.traces[h.traces.length - 1];
    logEvent(w.events, 'manhunt', w.tick, time, last ? last.x : w.player.x, last ? last.y : w.player.y, tier >= 3 ? 1 : 0.7, [tier]);
    h.announced = tier;
  }
  if (tier < 2) h.announced = 0; // cooled off: a fresh escalation will be news again
  runCop(w, dt);
}

/** The patrol: it spawns when the player becomes wanted, heads for where they were last seen (and, at
 *  higher tiers, tracks the player as the cameras and masts pin them down), and makes the arrest when
 *  it reaches them in the open. It gives up when the heat has cooled below the hunt threshold. */
function runCop(w: World, dt: number) {
  const h = w.heat, p = w.player, tier = tierOf(h);
  if (tier < 1) { h.cop = null; return; }
  // the focus: the freshest trace (where they were last seen)
  const last = h.traces[h.traces.length - 1];
  if (!h.cop) {
    if (!last) return;
    const a = hash3(w.seed ^ 0xc0b, Math.floor(h.lastAt), 1) * Math.PI * 2;
    h.cop = { fx: last.x, fy: last.y, x: last.x + Math.cos(a) * COP_SPAWN, y: last.y + Math.sin(a) * COP_SPAWN, px: 0, py: 0 };
    h.cop.px = h.cop.x; h.cop.py = h.cop.y;
  }
  const c = h.cop;
  c.px = c.x; c.py = c.y;
  // the net tightens: at tier >= 2 the focus drifts onto the player (live cameras, the mast)
  const tr = TRACK[tier] * dt;
  c.fx += (p.x - c.fx) * Math.min(1, tr);
  c.fy += (p.y - c.fy) * Math.min(1, tr);
  // close on the focus in real time
  const dx = c.fx - c.x, dy = c.fy - c.y, d = Math.hypot(dx, dy), step = COP_SPEED * dt;
  if (d > 1e-3) { c.x += (dx / d) * Math.min(d, step); c.y += (dy / d) * Math.min(d, step); }
  // the arrest: within reach, and the player out in the open (indoors they cannot be taken yet)
  if (p.inside < 0 && p.liftTo < 0 && Math.hypot(c.x - p.x, c.y - p.y) < CATCH_R) arrest(w);
}

/** Take the player in: held at the nearest civic landmark, the night skipped, a fine and the night's
 *  pay clawed back, the heat left low (it cools from there). No game over. */
function arrest(w: World) {
  const h = w.heat, p = w.player, time = w.time;
  // the holding place: the nearest city hall, else downtown
  let lm = -1, bd = Infinity;
  w.city.landmarks.forEach((l, k) => { if (l.kind !== 'hall') return; const d = Math.hypot(l.x - p.x, l.y - p.y); if (d < bd) { bd = d; lm = k; } });
  const hx = lm >= 0 ? w.city.landmarks[lm].x : w.city.cx, hy = lm >= 0 ? w.city.landmarks[lm].y : w.city.cy;
  // lose the night's pay (each done job, once) and a flat fine, as far as the balance covers
  let lostPay = 0;
  for (const j of w.jobs.jobs) if (j.state === 'done' && !j.clawed) { j.clawed = true; const take = Math.min(j.pay, w.bank.balance); if (take > 0) post(w.bank, time, 'fee', -take, j.biz); lostPay += take; }
  const fine = Math.min(FINE, w.bank.balance);
  if (fine > 0) post(w.bank, time, 'fee', -fine, 0);
  h.bust = { at: time, fine, lostPay, lm };
  logEvent(w.events, 'bust', w.tick, time, hx, hy, 0.9, [lm]); // the city hears of the arrest
  // skip the night in custody
  w.time = w.ptime = time + HOLD;
  stepWeather(w.weather, w.seed, w.time, 0);
  // wake at the holding place, on the street
  p.x = p.px = hx; p.y = p.py = hy; p.inside = -1; p.floor = 0; p.z = 0; p.liftTo = -1;
  // the trail has cooled; the heat left is below the hunt threshold
  h.points = Math.min(h.points, AFTER);
  h.traces.length = 0;
  h.cop = null;
}
