import { CharGrid, type GridBuffers } from './grid';
import { pickedButton } from './interior';
import { COL_MS, renderWorld, VIEW_GLINT, VIEW_LIGHT, type View } from './raycaster';
import { createWorld, type World } from '../sim/world';
import { type Snapshot } from './pool';

/**
 * A render worker: it holds its own copy of the city (generated from the seed, the same as the
 * main thread's), takes each frame what moves (a snapshot, see pool.ts) and draws its strip of
 * columns into the screen shared by all the workers.
 */
let world: World | null = null;
let grid: CharGrid | null = null;
/** Where the main thread writes each frame's snapshot, as JSON (see pool.ts). */
let snapBuf: SharedArrayBuffer | null = null;
const dec = new TextDecoder();

(self as unknown as Worker).onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === 'init') { world = createWorld(m.seed, m.size, false); return; }
  if (m.type === 'grid') { grid = new CharGrid(m.cols, m.rows, m.buf as GridBuffers); return; }
  if (m.type === 'frame' && world && grid) {
    const t0 = performance.now();
    if (m.buf) snapBuf = m.buf;
    // the decoder does not read shared memory: a private copy first
    apply(world, JSON.parse(dec.decode(new Uint8Array(snapBuf!, 0, m.len).slice())) as Snapshot);
    grid.x0 = m.x0; grid.x1 = m.x1;
    // a failure must not leave the pool waiting for this strip forever
    try { renderWorld(grid, world, m.view as View); } catch (err) { console.error('render worker:', err); }
    (self as unknown as Worker).postMessage({ type: 'done', id: m.id, ms: performance.now() - t0, cost: COL_MS.slice(m.x0, m.x1), light: [...VIEW_LIGHT], glint: [...VIEW_GLINT], picked: pickedButton() });
  }
};

/** What changes from frame to frame, copied over the worker's world. */
function apply(w: World, s: Snapshot) {
  w.tick = s.tick; w.time = s.time; w.ptime = s.ptime;
  Object.assign(w.player, s.player);
  w.cars = s.cars; w.peds = s.peds;
  Object.assign(w.weather, s.weather);
  s.subs.forEach((q, k) => Object.assign(w.power.subs[k], q));
  w.doors = new Map(s.doors);
  if (s.events) w.events = s.events;
}
