import { lampId, lampMode, LampMode, lampState, lampStutter } from '../render/lamps';
import { signLight, signMode, SignMode, signStutter, signText } from '../render/signs';
import { type City } from '../sim/city';

/**
 * Ambient sound, all synthesized with Web Audio: the city's distant rumble, the hum of the nearest
 * sodium lamp, the buzz of the nearest neon sign (cutting out with its flicker) and the low roar of
 * the burning seam near the city edge. Nearby sources are panned left/right from the listener.
 */

/** Hearing distances in metres. */
const LAMP_R = 8, SIGN_R = 16, FIRE_R = 300;

export class Sound {
  private ctx: AudioContext;
  private master: GainNode;
  private hum: GainNode;
  private humPan: StereoPannerNode;
  private humCrackle: GainNode;
  private st = new Float32Array(2);
  private neon: GainNode;
  private crackle: GainNode;
  private neonPan: StereoPannerNode;
  private fire: GainNode;
  muted = false;

  constructor() {
    const ctx = (this.ctx = new AudioContext());
    this.master = gain(ctx, 0.5, ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };

    // city rumble: low-passed noise whose cutoff drifts slowly, like traffic far away
    const cityLp = filter(ctx, 'lowpass', 260, 0.7);
    src().connect(cityLp).connect(gain(ctx, 0.35, this.master));
    const drift = ctx.createOscillator();
    drift.frequency.value = 0.06;
    drift.connect(gain(ctx, 120, cityLp.frequency));
    drift.start();

    // sodium lamp: mains hum at 120 Hz with a weaker overtone
    this.humPan = ctx.createStereoPanner();
    this.humPan.connect(this.master);
    this.hum = gain(ctx, 0, this.humPan);
    tone(ctx, 'sine', 120, 1, this.hum);
    tone(ctx, 'sine', 240, 0.35, this.hum);
    this.humCrackle = gain(ctx, 0, this.humPan);

    // neon: a buzzy 120 Hz sawtooth through a band-pass, plus crackle for a failing tube
    this.neonPan = ctx.createStereoPanner();
    this.neonPan.connect(this.master);
    this.neon = gain(ctx, 0, this.neonPan);
    const bp = filter(ctx, 'bandpass', 2400, 1.2);
    bp.connect(this.neon);
    tone(ctx, 'sawtooth', 120, 1, bp);
    this.crackle = gain(ctx, 0, this.neonPan);
    const hiss = src().connect(filter(ctx, 'highpass', 3500, 0.7));
    hiss.connect(this.crackle);
    hiss.connect(this.humCrackle);

    // burning seam: a deep roar
    this.fire = gain(ctx, 0, this.master);
    tone(ctx, 'sine', 38, 0.6, this.fire);
    src().connect(filter(ctx, 'lowpass', 110, 0.8)).connect(gain(ctx, 1.2, this.fire));
  }

  /** Browsers only start audio after a click; call from one. */
  resume() { if (this.ctx.state !== 'running') this.ctx.resume(); }

  toggleMute() {
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  /** Follow the listener: position, heading and the time in seconds (the signs' clock). */
  update(city: City, x: number, y: number, yaw: number, sec: number) {
    const now = this.ctx.currentTime;
    // screen-right direction, for panning
    const rx = -Math.sin(yaw), ry = Math.cos(yaw);
    const pan = (px: number, py: number) => { const d = Math.hypot(px - x, py - y) || 1; return ((px - x) * rx + (py - y) * ry) / d; };

    let lamp = 1e9, lx = 0, ly = 0, lid = -1, sign = 1e9, sx = 0, sy = 0, biz = -1;
    for (const b of city.blocks) {
      if (x < b.x0 - SIGN_R || x > b.x1 + SIGN_R || y < b.y0 - SIGN_R || y > b.y1 + SIGN_R) continue;
      for (const p of b.props) {
        if (p.kind !== 'lamp') continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < lamp) { lamp = d; lx = p.x; ly = p.y; lid = lampId(city, p); }
      }
      for (let k = b.b0; k < b.b1; k++) {
        const B = city.buildings[k];
        if (B.biz < 0) continue;
        // nearest point of the shop front
        const cx = Math.max(B.x0, Math.min(B.x1, x)), cy = Math.max(B.y0, Math.min(B.y1, y));
        const d = Math.hypot(cx - x, cy - y);
        if (d < sign) { sign = d; sx = cx; sy = cy; biz = B.biz; }
      }
    }

    // the hum follows the lamp: silent when out, cutting out and crackling when it fails
    let hum = 0, hcr = 0;
    if (lid >= 0 && lamp < LAMP_R) {
      const near = (1 - lamp / LAMP_R) ** 2;
      lampState(lid, sec, this.st);
      hum = 0.05 * near * this.st[0];
      if (lampMode(lid) === LampMode.Stutter && lampStutter(lid, sec)) hcr = 0.04 * near;
    }
    this.hum.gain.setTargetAtTime(hum, now, 0.03);
    this.humCrackle.gain.setTargetAtTime(hcr, now, 0.01);
    if (hum) this.humPan.pan.setTargetAtTime(pan(lx, ly) * 0.8, now, 0.1);

    let neon = 0, crackle = 0;
    if (biz >= 0 && sign < SIGN_R) {
      const near = (1 - sign / SIGN_R) ** 2, mode = signMode(city, biz);
      const lit = signLight(biz, mode, -1, signText(city, biz, 255).length, sec);
      const stutter = mode === SignMode.Broken && signStutter(biz, sec);
      neon = 0.035 * near * (lit > 0.5 ? (stutter ? 0.25 : 1) : 0);
      crackle = stutter ? 0.05 * near : 0;
      this.neonPan.pan.setTargetAtTime(pan(sx, sy) * 0.8, now, 0.1);
    }
    this.neon.gain.setTargetAtTime(neon, now, 0.015);
    this.crackle.gain.setTargetAtTime(crackle, now, 0.01);

    const edge = Math.min(x, y, city.w - x, city.h - y);
    this.fire.gain.setTargetAtTime(edge < FIRE_R ? 0.3 * (1 - edge / FIRE_R) ** 1.5 : 0, now, 0.5);
  }
}

function gain(ctx: AudioContext, v: number, to: AudioNode | AudioParam): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  g.connect(to as AudioNode);
  return g;
}

function filter(ctx: AudioContext, type: BiquadFilterType, f: number, q: number): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type; b.frequency.value = f; b.Q.value = q;
  return b;
}

function tone(ctx: AudioContext, type: OscillatorType, f: number, v: number, to: AudioNode) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.value = f;
  o.connect(gain(ctx, v, to));
  o.start();
}
