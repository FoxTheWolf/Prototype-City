/**
 * Smooth camera: input moves a target, the camera eases toward it every frame.
 * Mouse noise and uneven frame times never reach the view directly.
 */
export class Camera {
  yaw = -Math.PI / 2;
  /** Horizon shift as a fraction of screen height (y-shearing, keeps verticals vertical). */
  pitch = 0;
  targetYaw = this.yaw;
  targetPitch = 0;

  static readonly MAX_PITCH = 0.35;
  /** Higher = snappier. 1/SMOOTH is roughly the lag in seconds. */
  static readonly SMOOTH = 22;

  look(dYaw: number, dPitch: number) {
    this.targetYaw += dYaw;
    this.targetPitch = Math.max(-Camera.MAX_PITCH, Math.min(Camera.MAX_PITCH, this.targetPitch + dPitch));
  }

  update(dt: number) {
    const k = 1 - Math.exp(-Camera.SMOOTH * dt);
    this.yaw += (this.targetYaw - this.yaw) * k;
    this.pitch += (this.targetPitch - this.pitch) * k;
  }
}
