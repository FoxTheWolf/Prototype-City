/** Keyboard state and pointer-locked mouse deltas. */
export class Input {
  readonly keys = new Set<string>();
  private mdx = 0;
  private mdy = 0;

  constructor(private target: HTMLElement) {
    addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
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

  down(...codes: string[]) { return codes.some((c) => this.keys.has(c)); }
}
