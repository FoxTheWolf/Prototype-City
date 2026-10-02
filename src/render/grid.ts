/**
 * What drew a cell: other (sky, signs, lights, fence), the ground (and roofs seen from above), a wall,
 * a solid object, a room indoors, or a block: a big far surface drawn as solid color (the fire zone's
 * ground, the Sarcophagus), its glyph shown only where something glints.
 */
export const KIND = { other: 0, ground: 1, wall: 2, object: 3, room: 4, block: 5 } as const;

/**
 * The character screen: one glyph + foreground + background per cell.
 * Layouts match the GPU textures so they upload without conversion.
 */
export interface GridBuffers { cells: ArrayBufferLike; bg: ArrayBufferLike; depth: ArrayBufferLike; kind: ArrayBufferLike; sun: ArrayBufferLike }

export class CharGrid {
  /** Per cell: glyph code, fg r, fg g, fg b. Clamped arrays saturate out-of-range colors for free. */
  readonly cells: Uint8ClampedArray;
  /** Per cell: bg r, bg g, bg b, unused. */
  readonly bg: Uint8ClampedArray;
  /** Per cell distance of what was drawn, for sprite occlusion. */
  readonly depth: Float32Array;
  /** Per cell: what drew it (the soft look fills these as blocks). See KIND. */
  readonly kind: Uint8Array;
  /** Per cell: 0 not lit by the day; else 1 + 254 x the share of direct sun on that surface (walls, objects). */
  readonly sun: Uint8Array;

  /**
   * The columns this grid draws, [x0, x1): all of them, or a strip when several render workers share
   * one screen (render/pool.ts). Every pass of the renderer stays inside it.
   */
  x0 = 0;
  x1: number;

  /** A screen, on fresh memory, or on buffers shared with other threads (see buffers()). */
  constructor(readonly cols: number, readonly rows: number, buf?: GridBuffers) {
    const n = cols * rows;
    this.cells = new Uint8ClampedArray(buf?.cells ?? new ArrayBuffer(n * 4));
    this.bg = new Uint8ClampedArray(buf?.bg ?? new ArrayBuffer(n * 4));
    this.depth = new Float32Array(buf?.depth ?? new ArrayBuffer(n * 4));
    this.kind = new Uint8Array(buf?.kind ?? new ArrayBuffer(n));
    this.sun = new Uint8Array(buf?.sun ?? new ArrayBuffer(n));
    this.x1 = cols;
  }
  /** Shared memory for a grid of this size, for a pool of render workers. */
  static shared(cols: number, rows: number): GridBuffers {
    const n = cols * rows, S = (b: number) => new SharedArrayBuffer(b);
    return { cells: S(n * 4), bg: S(n * 4), depth: S(n * 4), kind: S(n), sun: S(n) };
  }

  clear() {
    const { cols, rows, x0, x1 } = this;
    if (x0 === 0 && x1 === cols) {
      for (let i = 0; i < this.cells.length; i += 4) this.cells[i] = 32;
      this.depth.fill(1e9);
      this.kind.fill(0);
      this.sun.fill(0);
      return;
    }
    for (let y = 0; y < rows; y++) {
      const a = y * cols + x0, b = y * cols + x1;
      for (let i = a; i < b; i++) this.cells[i * 4] = 32;
      this.depth.fill(1e9, a, b);
      this.kind.fill(0, a, b);
      this.sun.fill(0, a, b);
    }
  }

  put(i: number, ch: number, r: number, g: number, b: number) {
    const k = i * 4;
    this.cells[k] = ch; this.cells[k + 1] = r; this.cells[k + 2] = g; this.cells[k + 3] = b;
  }

  setBg(i: number, r: number, g: number, b: number) {
    const k = i * 4;
    this.bg[k] = r; this.bg[k + 1] = g; this.bg[k + 2] = b;
  }

  /** Write a line of text starting at (x, y), with a solid background. */
  text(x: number, y: number, s: string, fg: readonly number[], bg: readonly number[]) {
    for (let n = 0; n < s.length && x + n < this.cols; n++) {
      const i = y * this.cols + x + n;
      this.put(i, s.charCodeAt(n), fg[0], fg[1], fg[2]);
      this.setBg(i, bg[0], bg[1], bg[2]);
    }
  }
}
