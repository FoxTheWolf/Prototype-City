/** Keyboard state and pointer-locked mouse deltas. */
export class Input {
  readonly keys = new Set<string>();
  private mdx = 0;
  private mdy = 0;
  private settleUntil = 0;
  /** With the pointer free (the phone out), the mouse still turns the view while this is set (the right button held). */
  drag = false;

  constructor(private target: HTMLElement) {
    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    // Chromium's first moves after the lock carry where the cursor was (the spin on spawn): skip them.
    addEventListener('pointerlockchange', () => { this.settleUntil = performance.now() + 120; });
    addEventListener('mousemove', (e) => {
      if (!this.locked && !this.drag) return;
      if (performance.now() < this.settleUntil) return;
      // Some browsers report huge spikes on pointer lock; drop them.
      if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
      this.mdx += e.movementX;
      this.mdy += e.movementY;
    });
  }

  get locked() { return document.pointerLockElement === this.target; }

  lock() {
    // unadjustedMovement skips OS acceleration where supported; fall back when it is not.
    const el = this.target as HTMLElement & { requestPointerLock(o?: object): Promise<void> | void };
    try {
      const p = el.requestPointerLock({ unadjustedMovement: true });
      if (p) p.catch(() => { try { el.requestPointerLock()?.catch(() => {}); } catch { /* ignored */ } });
    } catch { /* ignored */ }
  }

  /** Mouse movement since the last call, in pixels. */
  takeMouse(): [number, number] {
    const d: [number, number] = [this.mdx, this.mdy];
    this.mdx = this.mdy = 0;
    return d;
  }

  /** Free the pointer: the system cursor shows. */
  unlock() { if (this.locked) { this.unlockedAt = performance.now(); document.exitPointerLock(); } }
  /** When the game itself last freed the pointer (to tell it from the player pressing Esc). */
  unlockedAt = -1e9;

  down(...codes: string[]) { return codes.some((c) => this.keys.has(c)); }
}
