/**
 * The HD layer: plain pixels, HD x HD of them in every cell of the interface's grid, for what needs
 * more detail than characters give (the photos kept on the phone; the notebook's body in its 2D look).
 * It is composed with the other two layers in one draw (glRenderer.ts). A pixel lies either over the
 * interface (a photo on the phone's screen) or under it (a body whose screen the interface draws on
 * top); where nothing was put the layers below show. Only the rows touched are uploaded.
 */
export const HD = 3;
export const enum HdOrder { Under = 128, Over = 255 }

export class HdLayer {
  /** Per pixel: r, g, b, and 0 nothing / 128 under the interface / 255 over it. */
  readonly px: Uint8ClampedArray;
  /** Rows drawn since the last wipe; rows to upload (drawn or cleared since the last upload). */
  private y0 = Infinity;
  private y1 = -1;
  lo = Infinity;
  hi = -1;
  constructor(readonly w: number, readonly h: number) {
    this.px = new Uint8ClampedArray(w * h * 4);
  }

  put(x: number, y: number, r: number, g: number, b: number, order: HdOrder = HdOrder.Over) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const k = (y * this.w + x) * 4, P = this.px;
    P[k] = r; P[k + 1] = g; P[k + 2] = b; P[k + 3] = order;
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
    if (y < this.lo) this.lo = y;
    if (y > this.hi) this.hi = y;
  }

  /** Index of pixel (x, y) in px if something was put there, else -1. */
  at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    const k = (y * this.w + x) * 4;
    return this.px[k + 3] ? k : -1;
  }

  /** Nothing drawn: clears what the last frame drew (those rows still need one upload, cleared). */
  wipe() {
    this.mark();
    if (this.y1 >= this.y0) this.px.fill(0, this.y0 * this.w * 4, (this.y1 + 1) * this.w * 4);
    this.y0 = Infinity; this.y1 = -1;
  }

  /** Fold the rows drawn into the rows to upload (on a wipe: the rows cleared need one more upload). */
  mark() {
    if (this.y0 < this.lo) this.lo = this.y0;
    if (this.y1 > this.hi) this.hi = this.y1;
  }
}
