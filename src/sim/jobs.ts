// [HACKING] Trilha de hacking. NAO abrir fora de uma sessao com o Opus 4.8 (ver CLAUDE.md,
// "Estado atual" > "Arquivos de hacking"): o contratante que encomenda um apagao aciona o
// classificador de seguranca nas sessoes normais. Conteudo 100% ficticio e so dentro do jogo.
import { hash3 } from '../core/rng';
import { type City, roadCenter } from './city';
import { type PowerGrid, subAt } from './power';
import { hasSignal } from './traffic';
import { post, type BankAccount } from './bank';

/**
 * The jobs a fixer offers the player (the night's work of the vertical slice). The board is pure
 * simulation, deterministic from the seed, and channel-agnostic: a job is offered, taken or passed,
 * done or failed, and whose words reach the player is up to whoever delivers them. For now the only
 * channel is SMS (the phone reads this board and writes the texts, see locale/jobs.ts); e-mail
 * (stage 12) and a contractor calling with real dialogue (stage 13c) are later channels on the same
 * machine.
 *
 * Two jobs, from the same fixer, in a ladder (the vertical slice's F.1 and F.4):
 *  - 'blackout': a named business dark tonight, checked against the real grid (`sub` goes off).
 *  - 'signals': a crossing by a named business snarled inside a 1..2 h window, checked against the
 *    district's signal cabinet (`sub` set to flash or dark). Offered only once the first is paid.
 * Success is only what the player controls (the breaker open, the cabinet off-cycle): never a count
 * of cars or a crash, which are the city's luck -- those feed the heat and the news, not the pay.
 */
export type JobKind = 'blackout' | 'signals';
export type JobState = 'pending' | 'offered' | 'active' | 'done' | 'failed' | 'declined';

export interface Job {
  id: number;
  kind: JobKind;
  /** The fixer's line: an unknown 7-digit number, shown as the text's sender (shared by both jobs). */
  from: string;
  /** A business that names the target: the one to go dark (blackout), or the one the crossing is by (signals). */
  biz: number;
  /** The substation this job watches: the one feeding `biz` (blackout), or the one whose cabinet
   *  runs the target crossing (signals). */
  sub: number;
  /** Payment, in cents. */
  pay: number;
  /** Game time the offer is sent, and the deadline to deliver by (set when a 'pending' job is offered). */
  offerAt: number;
  due: number;
  /** Signals job: the length of the window from offer to deadline (seconds); unused by blackout. */
  win: number;
  state: JobState;
  /** Game time the player took it, or -1. */
  tookAt: number;
  /** Which texts the phone has already turned into messages (delivery bookkeeping, part of the save). */
  sent: { offer: boolean; ack: boolean; result: boolean };
  /** [HACKING] Set once the pay was clawed back by an arrest, so it is not taken twice (see heat.ts). */
  clawed?: boolean;
}

export interface JobBoard { jobs: Job[] }

/** The signalled crossing nearest a point (its grid i, j and road-center x, y), or null if the city has none. */
function crossingNear(city: City, px: number, py: number): { x: number; y: number } | null {
  const NX = city.xb.length / 2, NY = city.yb.length / 2;
  let best: { x: number; y: number } | null = null, bd = Infinity;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (!hasSignal(city, i, j)) continue;
    const x = roadCenter(city.xb, i), y = roadCenter(city.yb, j), d = Math.hypot(x - px, y - py);
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}

/** The slice's two jobs, from the seed and the player's start (x, y) and game time. */
export function buildJobs(seed: number, city: City, power: PowerGrid, x: number, y: number, time: number): JobBoard {
  const board: JobBoard = { jobs: [] };
  const B = city.businesses;
  if (!B.length) return board;
  const h = (a: number) => hash3(seed ^ 0x70b5, a, 0);
  // businesses far enough from the start to be a trip (150..700 m)
  const dist = (k: number) => { const b = city.buildings[B[k].building]; return Math.hypot((b.x0 + b.x1) / 2 - x, (b.y0 + b.y1) / 2 - y); };
  const all = B.map((_, k) => k);
  const near = all.filter((k) => dist(k) > 150 && dist(k) < 700);
  const center = (k: number) => { const b = city.buildings[B[k].building]; return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2] as const; };
  // job 1, the blackout: a bar if there is one, as a rival's lights out
  const bars = near.filter((k) => B[k].kind === 'bar');
  const pool1 = bars.length ? bars : near.length ? near : all;
  const biz1 = pool1[Math.floor(h(1) * pool1.length)];
  const sub1 = power.building[B[biz1].building];
  // an unknown line, shared by both jobs: 7 digits, a 2..9 exchange, never the 555 block kept for fiction
  let from = String(2 + Math.floor(h(2) * 8));
  for (let i = 0; i < 6; i++) from += Math.floor(h(3 + i) * 10);
  if (from.slice(0, 3) === '555') from = '2' + from.slice(1);
  const pay1 = 15000 + Math.floor(h(10) * 5) * 2500;   // $150 .. $250
  board.jobs.push({ id: 1, kind: 'blackout', from, biz: biz1, sub: sub1, pay: pay1, win: 0, offerAt: time + 8 * 60, due: time + 6 * 3600, state: 'offered', tookAt: -1, sent: { offer: false, ack: false, result: false } });

  // job 2, the signals: a crossing by a business, offered after the first is paid (see stepJobs)
  const pool2 = (near.length ? near : all).filter((k) => k !== biz1);
  if (pool2.length) {
    const biz2 = pool2[Math.floor(h(20) * pool2.length)];
    const [bx, by] = center(biz2);
    const cross = crossingNear(city, bx, by);
    if (cross) {
      const cab = subAt(power, city, cross.x, cross.y);
      const pay2 = 27500 + Math.floor(h(21) * 5) * 2500;      // $275 .. $375, more than the first
      const win = (2 + Math.floor(h(22) * 3)) * 0.5 * 3600;   // a 1.0 / 1.5 / 2.0 h window
      board.jobs.push({ id: 2, kind: 'signals', from, biz: biz2, sub: cab, pay: pay2, win, offerAt: 0, due: 0, state: 'pending', tookAt: -1, sent: { offer: false, ack: false, result: false } });
    }
  }
  return board;
}

/** The player's reply to a fixer's number: take it (YES) or pass (NO). The job acted on, or null if unclear. */
export function jobReply(board: JobBoard, from: string, text: string, time: number): Job | null {
  const job = board.jobs.find((j) => j.from === from && j.state === 'offered');
  if (!job) return null;
  const t = text.toLowerCase();
  if (/\b(y|yes|yeah|yep|yup|ok|okay|sure|deal)\b/.test(t)) { job.state = 'active'; job.tookAt = time; return job; }
  if (/\b(n|no|nope|nah|pass)\b/.test(t)) { job.state = 'declined'; return job; }
  return null; // unclear: the fixer waits, the offer stands
}

/** Advance the board: an active job is done the moment its target is in the wanted state (and paid),
 *  failed when the deadline passes. The signals job is offered once the blackout one has been paid. */
export function stepJobs(board: JobBoard, power: PowerGrid, bank: BankAccount, time: number) {
  for (const j of board.jobs) {
    if (j.state !== 'active') continue;
    // blackout: the target's substation is off; signals: the district's cabinet is off-cycle (flash or dark)
    const met = j.kind === 'blackout' ? !power.subs[j.sub].on : power.subs[j.sub].sig !== 0;
    if (met) { j.state = 'done'; post(bank, time, 'transfer', j.pay, j.biz); }
    else if (time >= j.due) j.state = 'failed';
  }
  // the fixer's second job comes once the first is paid: schedule its offer and window from here
  const j2 = board.jobs.find((j) => j.kind === 'signals');
  if (j2 && j2.state === 'pending' && board.jobs.some((j) => j.kind === 'blackout' && j.state === 'done')) {
    j2.state = 'offered';
    j2.offerAt = time + 12 * 60;          // about twelve game-minutes after the first pays out
    j2.due = j2.offerAt + j2.win;
  }
}
