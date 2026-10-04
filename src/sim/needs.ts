import { type World } from './world';

/**
 * What the body asks for (13.5): for now only food. `food` runs from 1 (just ate) to 0 (starving),
 * emptying over the game hours; it is filled by eating, at a diner's counter or from the bag.
 * Never deadly: hunger only shortens the run (`breath`, how long the player can sprint before
 * dropping to a walk). Temperature and tiredness come with stage 22.
 */
export interface Needs {
  food: number;
  /** Breath for running, 0..1 of what the stomach allows now. */
  breath: number;
  /** The last hunger stage the player was told about (0 fed .. 3 starving), for main to say it once. */
  told: number;
}
export const newNeeds = (): Needs => ({ food: 0.8, breath: 1, told: 0 });

/** Game hours from full to empty. */
const EMPTY_H = 18;
/** Seconds of sprint on a full stomach, and recovering from empty to full while walking or standing. */
const RUN_S = 30, CATCH_S = 10;

/** 0 fed, 1 peckish, 2 hungry, 3 starving. */
export const hungerStage = (food: number) => (food > 0.5 ? 0 : food > 0.25 ? 1 : food > 0.08 ? 2 : 3);
/** How much of a full sprint the stomach allows: all of it fed, a third hungry, a little starving. */
const breathCap = (food: number) => [1, 0.7, 0.35, 0.15][hungerStage(food)];

/** A tick: the stomach empties with the game clock; running spends breath, which comes back walking. Whether the player may run. */
export function stepNeeds(w: World, run: boolean, dt: number, gameDt: number): boolean {
  const N = w.needs, cap = breathCap(N.food);
  N.food = Math.max(0, N.food - gameDt / (EMPTY_H * 3600));
  if (run && N.breath > 0) N.breath = Math.max(0, N.breath - dt / RUN_S);
  else if (!run) N.breath = Math.min(cap, N.breath + dt / CATCH_S);
  N.breath = Math.min(N.breath, cap);
  return N.breath > 0;
}

/**
 * How much of an empty stomach each thing fills (goods not here are not food: soap, batteries, a
 * dozen raw eggs). A full meal is about half of it; a snack a tenth; a drink a little.
 */
export const FOOD: Record<string, number> = {
  coffee: 0.03, eggs_toast: 0.4, burger: 0.45, fries: 0.2, milkshake: 0.15, pie: 0.2, meatloaf: 0.6,
  drip_coffee: 0.03, espresso: 0.02, latte: 0.08, muffin: 0.15, bagel: 0.18,
  slice: 0.2, pepperoni_slice: 0.22, garlic_knots: 0.18, fountain_soda: 0.05, whole_pie: 1,
  pastrami: 0.5, bagel_cc: 0.22, chips: 0.12, soda_can: 0.05,
  combo: 0.6, cheeseburger: 0.25, nuggets: 0.25, large_soda: 0.06,
  bottled_beer: 0.06, peanuts: 0.1, draft_beer: 0.06, whiskey: 0.01,
  bread: 0.35, milk: 0.2, canned_soup: 0.25, noodles: 0.2, candy: 0.08, vending_snack: 0.08,
};
export const edible = (good: string) => good in FOOD;

/** Eat (or drink) a thing: false when it is not food or the player is too full for it. */
export function eat(w: World, good: string): boolean {
  const f = FOOD[good];
  if (f === undefined || w.needs.food > 0.97) return false;
  w.needs.food = Math.min(1, w.needs.food + f);
  w.needs.breath = Math.min(breathCap(w.needs.food), w.needs.breath + f);
  w.needs.told = Math.min(w.needs.told, hungerStage(w.needs.food));
  return true;
}
