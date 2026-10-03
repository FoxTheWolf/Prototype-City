// [HACKING] Trilha de hacking. NAO abrir fora de uma sessao com o Opus 4.8 (ver CLAUDE.md,
// "Estado atual" > "Arquivos de hacking"): o contratante que encomenda um apagao aciona o
// classificador de seguranca nas sessoes normais. Conteudo 100% ficticio e so dentro do jogo.
import { hash3 } from '../core/rng';
import { type City } from './city';
import { type PowerGrid } from './power';
import { post, type BankAccount } from './bank';

/**
 * The jobs a fixer offers the player (the night's work of the vertical slice). The board is pure
 * simulation, deterministic from the seed, and channel-agnostic: a job is offered, taken or passed,
 * done or failed, and whose words reach the player is up to whoever delivers them. For now the only
 * channel is SMS (the phone reads this board and writes the texts, see locale/jobs.ts); e-mail
 * (stage 12) and a contractor calling with real dialogue (stage 13c) are later channels on the same
 * machine. The first job is the "blackout for hire": a fixer wants a named business dark tonight,
 * checked against the real grid (the substation feeding it goes off before the deadline).
 */
export type JobState = 'offered' | 'active' | 'done' | 'failed' | 'declined';

export interface Job {
  id: number;
  /** The fixer's line: an unknown 7-digit number, shown as the text's sender. */
  from: string;
  /** The target business to go dark, and the substation that feeds it (what we actually check). */
  biz: number;
  sub: number;
  /** Payment, in cents. */
  pay: number;
  /** Game time the offer is sent, and the deadline to deliver by. */
  offerAt: number;
  due: number;
  state: JobState;
  /** Game time the player took it, or -1. */
  tookAt: number;
  /** Which texts the phone has already turned into messages (delivery bookkeeping, part of the save). */
  sent: { offer: boolean; ack: boolean; result: boolean };
  /** [HACKING] Set once the pay was clawed back by an arrest, so it is not taken twice (see heat.ts). */
  clawed?: boolean;
}

export interface JobBoard { jobs: Job[] }

/** The slice's one tutorial job, from the seed and the player's start (x, y) and game time. */
export function buildJobs(seed: number, city: City, power: PowerGrid, x: number, y: number, time: number): JobBoard {
  const board: JobBoard = { jobs: [] };
  const B = city.businesses;
  if (!B.length) return board;
  const h = (a: number) => hash3(seed ^ 0x70b5, a, 0);
  // a business far enough from the start to be a trip (150..700 m); a bar if there is one, as a rival's lights out
  const dist = (k: number) => { const b = city.buildings[B[k].building]; return Math.hypot((b.x0 + b.x1) / 2 - x, (b.y0 + b.y1) / 2 - y); };
  const all = B.map((_, k) => k);
  const near = all.filter((k) => dist(k) > 150 && dist(k) < 700);
  const bars = near.filter((k) => B[k].kind === 'bar');
  const pool = bars.length ? bars : near.length ? near : all;
  const biz = pool[Math.floor(h(1) * pool.length)];
  const sub = power.building[B[biz].building];
  // an unknown line: 7 digits, a 2..9 exchange, never the 555 block kept for fiction
  let from = String(2 + Math.floor(h(2) * 8));
  for (let i = 0; i < 6; i++) from += Math.floor(h(3 + i) * 10);
  if (from.slice(0, 3) === '555') from = '2' + from.slice(1);
  const offerAt = time + 8 * 60;            // about eight game-minutes into the night
  const due = time + 6 * 3600;              // by the small hours (the night starts at nine)
  const pay = 15000 + Math.floor(h(10) * 5) * 2500;   // $150 .. $250
  board.jobs.push({ id: 1, from, biz, sub, pay, offerAt, due, state: 'offered', tookAt: -1, sent: { offer: false, ack: false, result: false } });
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

/** Advance the board: an active job is done the moment its target goes dark (and paid), failed when the deadline passes. */
export function stepJobs(board: JobBoard, power: PowerGrid, bank: BankAccount, time: number) {
  for (const j of board.jobs) {
    if (j.state !== 'active') continue;
    if (!power.subs[j.sub].on) { j.state = 'done'; post(bank, time, 'transfer', j.pay, j.biz); }
    else if (time >= j.due) j.state = 'failed';
  }
}
