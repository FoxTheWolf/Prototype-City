import { hash3 } from '../core/rng';

/**
 * The apps from the phone's store that run on it: a game of Snake, a torch, a news reader and a
 * unit converter. Their state lives here; phone.ts passes the keys and apps.ts draws them.
 */
export const SNAKE_W = 40, SNAKE_H = 20;

export class Snake {
  body: [number, number][] = [];
  dir: [number, number] = [1, 0];
  next: [number, number] = [1, 0];
  food: [number, number] = [0, 0];
  score = 0;
  best = 0;
  over = false;
  private at = 0;
  private n = 0;

  reset(now: number) {
    this.body = [[10, 10], [9, 10], [8, 10]]; this.dir = this.next = [1, 0];
    this.score = 0; this.over = false; this.at = now; this.place();
  }

  private place() {
    for (let t = 0; t < 100; t++) {
      const f: [number, number] = [Math.floor(hash3(this.n, t, 1) * SNAKE_W), Math.floor(hash3(this.n++, t, 2) * SNAKE_H)];
      if (!this.body.some(([x, y]) => x === f[0] && y === f[1])) { this.food = f; return; }
    }
  }

  /** Steer (it cannot turn back on itself). */
  steer(dx: number, dy: number) { if (dx !== -this.dir[0] || dy !== -this.dir[1]) this.next = [dx, dy]; }

  /** A step every so often, faster as it grows; true when it ate. */
  update(now: number): boolean {
    if (this.over || !this.body.length) return false;
    const step = Math.max(0.06, 0.16 - this.score * 0.004);
    if (now - this.at < step) return false;
    this.at = now; this.dir = this.next;
    const [hx, hy] = this.body[0], nx = hx + this.dir[0], ny = hy + this.dir[1];
    if (nx < 0 || ny < 0 || nx >= SNAKE_W || ny >= SNAKE_H || this.body.some(([x, y]) => x === nx && y === ny)) {
      this.over = true; this.best = Math.max(this.best, this.score);
      return false;
    }
    this.body.unshift([nx, ny]);
    if (nx === this.food[0] && ny === this.food[1]) { this.score++; this.place(); return true; }
    this.body.pop();
    return false;
  }
}

/** The converter's pairs: name, from, to, and the conversion. */
export const CONVERT: [string, string, string, (v: number) => number][] = [
  ['Temperature', 'F', 'C', (v) => ((v - 32) * 5) / 9],
  ['Temperature', 'C', 'F', (v) => (v * 9) / 5 + 32],
  ['Distance', 'mi', 'km', (v) => v * 1.609344],
  ['Distance', 'km', 'mi', (v) => v / 1.609344],
  ['Length', 'ft', 'm', (v) => v * 0.3048],
  ['Weight', 'lb', 'kg', (v) => v * 0.45359237],
  ['Volume', 'gal', 'L', (v) => v * 3.785411784],
];
