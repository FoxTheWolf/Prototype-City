/**
 * The simulation's event queue: facts, never made up apart from the sim. Whatever happens (a
 * substation goes down, a jam builds, later a crash) is logged here with where and when, and the
 * news, the social network (stage 12) and the logs the player hacks into read from the same queue.
 */
export type EventKind = 'blackout' | 'restored' | 'jam' | 'crash' | 'manhunt' | 'bust' | 'shoplift';

export interface SimEvent {
  /** Running number, so readers can tell what they have already seen. */
  id: number;
  kind: EventKind;
  /** Tick and game time (seconds since 2008-01-01) it happened at. */
  tick: number;
  time: number;
  x: number;
  y: number;
  /** How big a deal it is, 0..1 (for who notices it and how loudly). */
  weight: number;
  /** What it is about: a substation index, an intersection (i, j), cars... by kind. */
  refs: number[];
}

export interface EventLog {
  list: SimEvent[];
  next: number;
}

/** Events kept; older ones are dropped (whoever needs them has read them by then). */
const KEEP = 1000;

export const newEventLog = (): EventLog => ({ list: [], next: 0 });

export function logEvent(log: EventLog, kind: EventKind, tick: number, time: number, x: number, y: number, weight: number, refs: number[]): SimEvent {
  const e: SimEvent = { id: log.next++, kind, tick, time, x, y, weight, refs };
  log.list.push(e);
  if (log.list.length > KEEP) log.list.splice(0, log.list.length - KEEP);
  return e;
}

/** The last event of a kind about the same refs, if any. */
export function lastEvent(log: EventLog, kind: EventKind, refs: number[]): SimEvent | undefined {
  for (let k = log.list.length - 1; k >= 0; k--) {
    const e = log.list[k];
    if (e.kind === kind && e.refs.length === refs.length && e.refs.every((r, n) => r === refs[n])) return e;
  }
  return undefined;
}
