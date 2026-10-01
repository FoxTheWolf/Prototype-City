/** What drew a cell: other (sky, signs, lights, fence), the ground (and roofs seen from above), a wall, a solid object, a room indoors. */
export const KIND = { other: 0, ground: 1, wall: 2, object: 3, room: 4 } as const;

/**
 * The character screen: one glyph + foreground + background per cell.
 * Layouts match the GPU textures so they upload without conversion.
 */
export class CharGrid {
  /** Per cell: glyph code, fg r, fg g, fg b. Clamped arrays saturate out-of-range colors for free. */
  readonly cells: Uint8ClampedArray;
  /** Per cell: bg r, bg g, bg b, unused. */
  readonly bg: Uint8ClampedArray;
  /** Per cell distance of what was drawn, for sprite occlusion. */
  readonly depth: Float32Array;
  /** Per cell: what drew it (the soft look fills these as blocks). See KIND. */
  readonly kind: Uint8Array;

  constructor(readonly cols: number, readonly rows: number) {
    this.cells = new Uint8ClampedArray(cols * rows * 4);
    this.bg = new Uint8ClampedArray(cols * rows * 4);
    this.depth = new Float32Array(cols * rows);
    this.kind = new Uint8Array(cols * rows);
  }

  clear() {
    for (let i = 0; i < this.cells.length; i += 4) this.cells[i] = 32;
    this.depth.fill(1e9);
    this.kind.fill(0);
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
