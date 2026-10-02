import { CharGrid } from './grid';
import { setPicked } from './interior';
import { VFOV, VIEW_GLINT, VIEW_LIGHT, type View } from './raycaster';
import { type EventLog } from '../sim/events';
import { type World } from '../sim/world';

/**
 * Drawing the world on several threads. The renderer works column by column, so each worker draws a
 * strip of the screen into memory they all share (SharedArrayBuffer: the page must be cross-origin
 * isolated, see vite.config.ts). Every worker keeps its own copy of the city, made from the seed;
 * each frame the main thread sends what moves (a Snapshot) and the view.
 *
 * The frame is pipelined: a frame started now is shown at the next screen refresh that finds it
 * done, so the main thread never waits for the workers (one frame of latency). The strips are cut
 * so every worker takes about as long: by what each column cost in the last frame, shifted by how
 * far the view turned since (a busy facade moves across the screen as the player turns).
 */
export interface Snapshot {
  tick: number; time: number; ptime: number;
  player: World['player'];
  cars: World['cars']; peds: World['peds'];
  weather: World['weather'];
  subs: { on: boolean; changed: number; ox: number; oy: number; sig: number }[];
  doors: [number, number][];
  /** The event log, only when it changed since the last frame sent (the news ticker reads it). */
  events: EventLog | null;
}

/** Cars further than this from the viewer are not drawn (objects end at 250 m), so not sent. */
const CAR_SEND = 320;

export class RenderPool {
  readonly n: number;
  private workers: Worker[] = [];
  private busy = 0;
  private id = 0;
  private shared: CharGrid | null = null;
  /** Each worker's time for its last strip, and the strips. */
  private took: number[];
  private ranges: [number, number][] = [];
  /** What each column cost in the last frame (ms), and the view's heading then. */
  private cost = new Float32Array(0);
  private costYaw = 0;
  private sentYaw = 0;
  private lastEvents = -1;
  private pending: [number, number] | null = null;
  /** A finished frame not yet taken. */
  private fresh = false;
  private light = new Float32Array(3);
  private glint = new Float32Array(6);
  private picked = -1;
  /** The slowest worker's time for the last frame (the frame's time on the critical path), ms. */
  ms = 0;
  /**
   * The snapshot, written once as JSON into memory every worker reads: posting the object to each
   * worker would copy it once per worker (~1 ms each on the main thread).
   */
  private snapBuf = new SharedArrayBuffer(1 << 20);
  private snapSent = false;
  private enc = new TextEncoder();

  constructor(seed: number, size: number | undefined, n: number) {
    this.n = n;
    this.took = new Array(n).fill(0);
    for (let k = 0; k < n; k++) {
      const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e) => this.done(k, e.data);
      w.postMessage({ type: 'init', seed, size });
      this.workers.push(w);
    }
  }
  /** Can a pool run here: shared memory needs a cross-origin isolated page. */
  static available() { return typeof SharedArrayBuffer !== 'undefined' && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true; }

  /** The screen's size; applied between frames. */
  resize(cols: number, rows: number) { this.pending = [cols, rows]; }

  /**
   * Called every screen refresh: when the last frame is done, copy it into `out` (true) and start the
   * next one with this view. Otherwise nothing (false): the workers are still drawing.
   */
  frame(world: World, view: View, out: CharGrid): boolean {
    if (this.busy) return false;
    let got = false;
    if (this.fresh && this.shared && this.shared.cols === out.cols && this.shared.rows === out.rows) {
      out.cells.set(this.shared.cells); out.bg.set(this.shared.bg);
      VIEW_LIGHT.set(this.light); VIEW_GLINT.set(this.glint); setPicked(this.picked);
      got = true;
    }
    this.fresh = false;
    if (this.pending) {
      const [cols, rows] = this.pending, buf = CharGrid.shared(cols, rows);
      this.shared = new CharGrid(cols, rows, buf);
      for (const w of this.workers) w.postMessage({ type: 'grid', cols, rows, buf });
      this.pending = null;
    }
    if (!this.shared) return got;
    this.balance(view);
    this.sentYaw = view.yaw;
    const bytes = this.enc.encode(JSON.stringify(this.snapshot(world, view))), id = ++this.id;
    if (bytes.length > this.snapBuf.byteLength) { this.snapBuf = new SharedArrayBuffer(bytes.length * 2); this.snapSent = false; }
    new Uint8Array(this.snapBuf).set(bytes);
    const buf = this.snapSent ? undefined : this.snapBuf;
    this.snapSent = true;
    this.busy = this.n;
    this.workers.forEach((w, k) => w.postMessage({ type: 'frame', id, len: bytes.length, buf, view, x0: this.ranges[k][0], x1: this.ranges[k][1] }));
    return got;
  }
  private done(k: number, m: { id: number; ms: number; cost: Float32Array; light: number[]; glint: number[]; picked: number }) {
    if (m.id !== this.id) return;
    this.took[k] = m.ms;
    if (this.cost.length === this.shared?.cols) { this.cost.set(m.cost, this.ranges[k][0]); this.costYaw = this.sentYaw; }
    // every worker samples the same light around the viewer; the button under the middle of the
    // screen is seen by the one drawing that column
    if (k === 0) { this.light.set(m.light); this.glint.set(m.glint); }
    const mid = (this.shared?.cols ?? 0) >> 1, [a, b] = this.ranges[k];
    if (mid >= a && mid < b) this.picked = m.picked;
    if (--this.busy === 0) { this.fresh = true; this.ms = Math.max(...this.took); }
  }
  /** New strips of about equal cost: the last frame's column costs, moved by the turn since. */
  private balance(v: View) {
    const { cols, rows } = this.shared!, n = this.n;
    if (this.cost.length !== cols) { this.cost = new Float32Array(cols).fill(1); this.costYaw = v.yaw; }
    // a turn of d radians moves what was at column x + s to column x (the view's width is its FOV)
    const plane = ((cols / 2) * v.cellAspect) / (rows / 2 / Math.tan(VFOV / 2));
    let d = v.yaw - this.costYaw;
    d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
    const s = Math.round((d * cols) / (2 * Math.atan(plane))), c = this.cost;
    let total = 0;
    const est = new Float32Array(cols);
    for (let x = 0; x < cols; x++) { const q = x + s; est[x] = c[q < 0 ? 0 : q >= cols ? cols - 1 : q]; total += est[x]; }
    // every worker also pays the frame's own work (objects, lights) whatever its strip: left out
    this.ranges = [];
    let x = 0, acc = 0;
    for (let k = 0; k < n; k++) {
      const goal = (total * (k + 1)) / n, x0 = x;
      if (k === n - 1) x = cols;
      else { while (x < cols - (n - 1 - k) && (acc + est[x] <= goal || x === x0)) acc += est[x++]; }
      this.ranges.push([x0, x]);
    }
  }
  private snapshot(w: World, v: View): Snapshot {
    const cars = w.cars.filter((c) => Math.abs(c.x - v.x) < CAR_SEND && Math.abs(c.y - v.y) < CAR_SEND);
    const ev = w.events.next !== this.lastEvents ? w.events : null;
    this.lastEvents = w.events.next;
    return {
      tick: w.tick, time: w.time, ptime: w.ptime, player: w.player, cars, peds: w.peds, weather: w.weather,
      subs: w.power.subs.map((s) => ({ on: s.on, changed: s.changed, ox: s.ox, oy: s.oy, sig: s.sig })),
      doors: [...w.doors], events: ev,
    };
  }
}
