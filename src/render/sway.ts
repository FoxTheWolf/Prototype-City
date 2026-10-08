/**
 * The motion of a thing held in the hand (the watch on the wrist, 15.21; the Jackdaw, 15.22): the glint
 * eased (as the phone's), the sway (the hand lags the eye: as the view turns it leans the other way and eases
 * back, as the phone does) and the arm's swing as the player walks and runs (a stride's tilt and lift,
 * stronger running), which slides the glint up and down it.
 */
/** The view and the walk this frame: the camera's angles, the glint (VIEW_GLINT), the player's speed (m/s). */
export interface HandView { yaw: number; pitch: number; glint: ArrayLike<number>; speed: number }
/** The light glinting off it (side, strength, color) and the sway off its pose (yaw, pitch, rad). */
export interface HandMotion { lat: number; str: number; glint: readonly [number, number, number]; tilt: readonly [number, number] }
/** The arm's swing: a stride's length (m) and, at full (running), its tilt (rad). */
const STRIDE_M = 1.4, SWING_TILT = 0.05;

export class HandSway {
  private at = 0; private lat = 0; private str = 0; private r = 1; private g = 1; private b = 1;
  private yaw = NaN; private pitch = 0; private ty = 0; private tp = 0; private ph = 0; private amp = 0;
  /** The swing's lift this frame (-1 .. 1 at full: the caller scales it to its size). */
  lift = 0;
  /** Put away: the next frame starts without a jump. */
  reset() { this.yaw = NaN; }
  step(now: number, v?: HandView): HandMotion {
    const dt = Math.min(0.1, Math.max(0, now - this.at));
    this.at = now;
    if (!v) return { lat: 0, str: 0, glint: [1, 1, 1], tilt: [0, 0] };
    const q = 1 - Math.exp(-dt / 0.25), G = v.glint;
    this.lat += (G[0] - this.lat) * q; this.str += (G[1] - this.str) * q; this.r += (G[2] - this.r) * q; this.g += (G[3] - this.g) * q; this.b += (G[4] - this.b) * q;
    const dy = Number.isNaN(this.yaw) ? 0 : Math.atan2(Math.sin(v.yaw - this.yaw), Math.cos(v.yaw - this.yaw)), dp = Number.isNaN(this.yaw) ? 0 : v.pitch - this.pitch;
    this.yaw = v.yaw; this.pitch = v.pitch;
    const inv = dt > 1e-4 ? 1 / dt : 0, k = 1 - Math.exp(-dt / 0.12);
    this.ty += (Math.max(-0.06, Math.min(0.06, dy * inv * 0.012)) - this.ty) * k;
    this.tp += (Math.max(-0.045, Math.min(0.045, dp * inv * 0.012)) - this.tp) * k;
    // the swing: a cycle each two strides, its size eased in and out with the pace (walking a third of running's)
    this.ph += (v.speed * dt * Math.PI) / STRIDE_M;
    this.amp += (Math.min(1, Math.max(0, (v.speed - 0.5) / 4.5)) - this.amp) * (1 - Math.exp(-dt / 0.3));
    this.lift = Math.sin(this.ph) * this.amp;
    return { lat: this.lat, str: this.str, glint: [this.r, this.g, this.b], tilt: [this.ty + Math.sin(this.ph * 0.5) * SWING_TILT * 0.3 * this.amp, this.tp + Math.cos(this.ph) * SWING_TILT * this.amp] };
  }
}
