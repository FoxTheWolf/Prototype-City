import { FLOOR_H } from './city';
import { loadHeat, saveHeat } from './heat'; // [HACKING] the heat's own save
import { loadJobs, saveJobs } from './jobs'; // [HACKING] the jobs' own save
import { spawnPeds } from './peds';
import { type World } from './world';

/**
 * The saved game (F.6): the seed and what has changed since (the decision "semente + mudanças").
 * The city, its people, its numbers and its routines come again from the seed; this keeps what the
 * game changed: the clock, where the player stands and carries, the grid's switches, the line and
 * the account, what happened (events, posts), the weather's state and the fixer's jobs and the heat.
 * Plain data, kept by structured clone (IndexedDB): Maps, Sets and typed arrays go as they are.
 * What is not kept: the cars and the pedestrians (made again around the player), the doors, and
 * the random stream's place (the world's rng starts again from the seed, so after a load the city
 * goes on its own way, not the very same one it would have gone).
 */
export interface WorldSave {
  time: number;
  tick: number;
  player: World['player'];
  subs: { on: boolean; changed: number; ox: number; oy: number; sig: number; offAt?: number }[];
  line: World['telco']['player'];
  spent: Set<string>;
  bank: World['bank'];
  events: World['events'];
  feed: World['feed'];
  weather: World['weather'];
  /** [HACKING] The fixer's jobs and the heat, as their modules keep them. */
  jobs: unknown;
  heat: unknown;
}

export function snapWorld(w: World): WorldSave {
  return {
    time: w.time, tick: w.tick, player: { ...w.player },
    subs: w.power.subs.map((s) => ({ on: s.on, changed: s.changed, ox: s.ox, oy: s.oy, sig: s.sig, offAt: s.offAt })),
    line: { ...w.telco.player }, spent: w.telco.spent, bank: w.bank, events: w.events, feed: w.feed, weather: { ...w.weather },
    jobs: saveJobs(w.jobs), heat: saveHeat(w.heat),
  };
}

/** A saved game onto a world just made from the same seed. */
export function applyWorld(w: World, d: WorldSave) {
  w.time = w.ptime = d.time;
  w.tick = d.tick;
  // never mid-ride in a lift: on the floor it was going to
  Object.assign(w.player, d.player, { px: d.player.x, py: d.player.y, liftTo: -1 });
  if (d.player.liftTo >= 0) { w.player.floor = d.player.liftTo; w.player.z = d.player.liftTo * FLOOR_H; }
  d.subs.forEach((s, k) => { if (w.power.subs[k]) Object.assign(w.power.subs[k], s); });
  Object.assign(w.telco.player, d.line);
  w.telco.spent = d.spent;
  w.bank = d.bank;
  w.events = d.events;
  w.feed = d.feed;
  Object.assign(w.weather, d.weather);
  loadJobs(w.jobs, d.jobs);
  loadHeat(w.heat, d.heat);
  w.doors.clear();
  w.peds = spawnPeds(w.city, w.pop, w.rng, w.time, w.player.x, w.player.y);
}
