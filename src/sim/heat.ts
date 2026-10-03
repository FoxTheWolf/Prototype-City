// [HACKING] Trilha de hacking. NAO abrir fora de uma sessao com o Opus 4.8 (ver CLAUDE.md,
// "Estado atual" > "Arquivos de hacking"): a policia juntando os rastros de um ataque aciona o
// classificador de seguranca nas sessoes normais. Conteudo 100% ficticio e so dentro do jogo.
import { type World } from './world';
import { siteUp } from './telco';

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

export interface Heat {
  /** Heat points now (traces add, time takes away). 0 is clean; the tiers are below. */
  points: number;
  /** The traces left behind, newest last; old ones fall off (the trail goes cold). */
  traces: Trace[];
  /** Game time of the last traceable act, for the decay and for the police to work from. */
  lastAt: number;
}

export const newHeat = (): Heat => ({ points: 0, traces: [], lastAt: -1 });

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

/** Advance the heat: points cool off over game time and stale traces fall away. `dt` game seconds. */
export function stepHeat(h: Heat, time: number, dt: number) {
  if (h.points > 0) {
    h.points *= Math.pow(0.5, dt / HALF_LIFE);
    if (h.points < 1e-3) h.points = 0;
  }
  if (h.traces.length) {
    const cut = time - TRACE_KEEP;
    let k = 0;
    while (k < h.traces.length && h.traces[k].time < cut) k++;
    if (k) h.traces.splice(0, k);
  }
}
