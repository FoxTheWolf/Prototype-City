// [HACKING] Trilha de hacking. NAO abrir fora de uma sessao com o Opus 4.8 (ver CLAUDE.md,
// "Estado atual" > "Arquivos de hacking"): o contratante que encomenda um apagao aciona o
// classificador de seguranca nas sessoes normais. Conteudo 100% ficticio e so dentro do jogo.
import { hash3 } from '../core/rng';
import { type City, roadCenter, districtAt } from './city';
import { type PowerGrid, subAt } from './power';
import { hasSignal } from './traffic';
import { post, type BankAccount } from './bank';
import { type Population, whereIs, Doing } from './citizens';
import { type Telco, mastNear } from './telco';
import { type World } from './world';

/**
 * The jobs a fixer offers the player (the night's work of the vertical slice). The board is pure
 * simulation, deterministic from the seed, and channel-agnostic: a job is offered, taken or passed,
 * done or failed, and whose words reach the player is up to whoever delivers them. For now the only
 * channel is SMS (the phone reads this board and writes the texts, see locale/jobs.ts); e-mail
 * (stage 12) and a contractor calling with real dialogue (stage 13c) are later channels on the same
 * machine.
 *
 * Three jobs, from the same fixer, in a ladder (the vertical slice's F.1, F.4 and F.5):
 *  - 'blackout': a named business dark tonight, checked against the real grid (`sub` goes off).
 *  - 'signals': a crossing by a named business snarled inside a 1..2 h window, checked against the
 *    district's signal cabinet (`sub` set to flash or dark). Offered only once the first is paid.
 *  - 'trace': where a subject's phone put them at a time, read off the operator's cell-site log and
 *    reported back by text. Checked against the district the serving mast covers (the answer the
 *    log itself shows), so it is still only what the player controls -- pulling the right record and
 *    relaying it -- never the city's luck. Offered only once the signals job is paid.
 * Success is only what the player controls (the breaker open, the cabinet off-cycle, the record
 * pulled): never a count of cars or a crash, which are the city's luck -- those feed the heat and
 * the news, not the pay.
 */
export type JobKind = 'blackout' | 'signals' | 'trace';
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
  /** Signals/trace job: the length of the window from offer to deadline (seconds); unused by blackout. */
  win: number;
  state: JobState;
  /** Game time the player took it, or -1. */
  tookAt: number;
  /** Which texts the phone has already turned into messages (delivery bookkeeping, part of the save). */
  sent: { offer: boolean; ack: boolean; result: boolean };
  /** [HACKING] Set once the pay was clawed back by an arrest, so it is not taken twice (see heat.ts). */
  clawed?: boolean;
  /** Trace job: the subject (citizen id), their mobile's local digits, the game time asked about,
   *  and the district the operator's log puts them in then (the answer, from the serving mast). */
  subj?: number;
  num?: string;
  at?: number;
  ans?: number;
  /** Trace job: wrong answers so far, and that a wrong one just came in (for the fixer's "look again"
   *  text, which the phone sends outside the offer/ack/result bookkeeping). */
  tries?: number;
  nudge?: boolean;
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

/** The slice's three jobs, from the seed and the player's start (x, y) and game time. */
export function buildJobs(seed: number, city: City, power: PowerGrid, pop: Population, telco: Telco, x: number, y: number, time: number): JobBoard {
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

  // job 3, the trace: where a subject's line put them at a time, read off the operator's cell logs
  // and reported back. Only a skeleton here; the subject and the hour are chosen when the job is
  // offered (resolveTrace, from stepJobs), so the hour stays recent whatever the player's pace --
  // the fast game clock would otherwise push the asked hour past the log's window. Needs a population
  // and masts (not the empty world). Offered after the signals job is paid (see stepJobs).
  if (pop.n > 0 && telco.sites.length) {
    const pay3 = 40000 + Math.floor(h(31) * 5) * 2500;      // $400 .. $500, more than the signals job
    const win3 = (3 + Math.floor(h(32) * 3)) * 0.5 * 3600;  // a 1.5 / 2.0 / 2.5 h window
    board.jobs.push({ id: 3, kind: 'trace', from, biz: -1, sub: -1, pay: pay3, win: win3, offerAt: 0, due: 0, state: 'pending', tookAt: -1, sent: { offer: false, ack: false, result: false }, subj: -1, num: '', at: 0, ans: -1, tries: 0 });
  }
  return board;
}

/**
 * [HACKING] Fill a trace job's subject, line, hour and answer when it is offered, from the seed and
 * the game time now. A random adult with a mobile, at a fixed place a few hours ago (so the serving
 * mast's district is plain); the answer is that district, exactly what the operator's cell log shows
 * (sim/network.ts, cellLog) -- so a diligent pull always answers right, never the city's luck.
 */
function resolveTrace(w: World, j: Job) {
  const { city, pop, telco, seed } = w;
  const h = (n: number) => hash3(seed ^ 0x3b1c, n, Math.floor(w.time / 3600));
  for (let t = 0; t < 96; t++) {
    const cand = Math.floor(h(100 + t) * pop.n);
    if (pop.phone[cand] === 255 || pop.age[cand] < 18 || !pop.mobile[cand]) continue;
    const ago = 3 + Math.floor(h(500 + t) * 4);               // 3..6 game-hours ago
    const q = Math.floor((w.time - ago * 3600) / 3600) * 3600; // on the hour
    if (q < 0) continue;
    const wa = whereIs(pop, city, cand, q);
    if (wa.doing === Doing.Walk || wa.building < 0) continue;  // somewhere fixed, so the district is plain
    const B = city.buildings[wa.building], m = mastNear(telco, (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2);
    if (m < 0) continue;
    j.subj = cand; j.num = pop.mobile[cand]; j.at = q; j.ans = districtAt(city, telco.sites[m].x, telco.sites[m].y);
    return;
  }
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
 *  failed when the deadline passes. Each job is offered once the one before it has been paid. */
export function stepJobs(w: World) {
  const board = w.jobs, time = w.time;
  for (const j of board.jobs) {
    if (j.state !== 'active') continue;
    // the trace job is closed by the player's answer (answerTrace), not the grid; here it only times out
    if (j.kind === 'trace') { if (time >= j.due) j.state = 'failed'; continue; }
    // blackout: the target's substation is off; signals: the district's cabinet is off-cycle (flash or dark)
    const met = j.kind === 'blackout' ? !w.power.subs[j.sub].on : w.power.subs[j.sub].sig !== 0;
    if (met) { j.state = 'done'; post(w.bank, time, 'transfer', j.pay, j.biz); }
    else if (time >= j.due) j.state = 'failed';
  }
  // the signals job is offered once the blackout one is paid: schedule its offer and window from here
  const j2 = board.jobs.find((q) => q.kind === 'signals');
  if (j2 && j2.state === 'pending' && board.jobs.some((q) => q.kind === 'blackout' && q.state === 'done')) {
    j2.state = 'offered'; j2.offerAt = time + 12 * 60; j2.due = j2.offerAt + j2.win;
  }
  // the trace job once the signals one is paid; its subject and hour are chosen now (resolveTrace),
  // so the hour the fixer asks about is recent whatever the player's pace
  const j3 = board.jobs.find((q) => q.kind === 'trace');
  if (j3 && j3.state === 'pending' && board.jobs.some((q) => q.kind === 'signals' && q.state === 'done')) {
    resolveTrace(w, j3);
    if ((j3.subj ?? -1) >= 0) { j3.state = 'offered'; j3.offerAt = time + 12 * 60; j3.due = j3.offerAt + j3.win; }
  }
}

/**
 * The player's answer to a trace job (a district index, parsed from their text by the phone, which
 * holds the locale), checked against the district the operator's log shows. A match is done and paid;
 * a wrong one only costs a try and flags a "look again" (the deadline still ends the job). Returns
 * 'right' | 'wrong' when a trace job took the answer, or null when none was waiting.
 */
export function answerTrace(board: JobBoard, from: string, dist: number, bank: BankAccount, time: number): 'right' | 'wrong' | null {
  const j = board.jobs.find((q) => q.from === from && q.kind === 'trace' && q.state === 'active');
  if (!j) return null;
  if (dist === j.ans) { j.state = 'done'; post(bank, time, 'transfer', j.pay, 0); return 'right'; }
  j.tries = (j.tries ?? 0) + 1; j.nudge = true; return 'wrong';
}

/**
 * Serialize the board to plain data (JSON-safe: only numbers, strings, booleans and plain objects,
 * no Maps/Sets/city references). Every field of a Job is already a primitive or a flat object; the
 * times are absolute game time (world.time), so they line up again once world.time is restored.
 * See loadJobs for the inverse.
 */
export function saveJobs(b: JobBoard): unknown {
  return { jobs: b.jobs.map((j) => ({ ...j, sent: { ...j.sent } })) };
}

/**
 * Restore the board's mutable state onto a board freshly built by buildJobs with the same seed (so
 * the structural fields -- from, biz, sub, pay, win -- already match): the jobs offered/taken/done,
 * their deadlines, the delivery bookkeeping (sent) and the trace job's resolved subject. Jobs are
 * matched by id; a field the save does not carry (one added after the save was written) keeps the
 * fresh board's value.
 */
export function loadJobs(b: JobBoard, data: unknown): void {
  const d = data as { jobs?: Partial<Job>[] } | null;
  if (!d || !Array.isArray(d.jobs)) return;
  for (const s of d.jobs) {
    const j = b.jobs.find((q) => q.id === s.id);
    if (!j) continue;
    const sent = s.sent ?? j.sent;
    Object.assign(j, s);
    j.sent = { offer: !!sent.offer, ack: !!sent.ack, result: !!sent.result };
  }
}
