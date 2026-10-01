import { LAMP_LIGHT, lampId, lampMode, LampMode, lampState, lampStutter, photocell } from '../render/lamps';
import { signLight, signMode, SignMode, signStutter, signText } from '../render/signs';
import { type City } from '../sim/city';
import { type Weather } from '../sim/weather';
import { type PowerGrid } from '../sim/power';
import { power } from '../render/power';
import { blackout, darkEvent, Kit, restore } from './blackout';
import { type Car } from '../sim/traffic';
import { type EventLog } from '../sim/events';

/** Engines heard at once (the nearest), and how far an engine, a horn and a crash carry. */
const ENGINES = 3, ENGINE_R = 45, HORN_R = 120, CRASH_R = 600, CROWD_R = 30;

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
  private city: GainNode;
  private rain: GainNode;
  private rainLow: GainNode;
  private noise: AudioBuffer;
  private lastBolt = -1;
  private kit: Kit;
  private seen: number[] = [];
  private nextDark = 0;
  private hush = 0;
  /** Everything outdoors reaches the ear through this: muffled by the walls indoors. */
  private out: GainNode;
  private wall: BiquadFilterNode;
  /** Indoors: the buzz of office tubes, and when the next raindrop hits the glass. */
  private tubes: GainNode;
  private nextDrop = 0;
  muted = false;

  private engines: { osc: OscillatorNode; lp: BiquadFilterNode; g: GainNode; tyre: GainNode; wet: GainNode; pan: StereoPannerNode }[] = [];
  private lastEvent = -1;
  private crowd!: GainNode;
  private dwelling = new Set<Car>();
  private honks = new Map<Car, number>();

  constructor() {
    const ctx = (this.ctx = new AudioContext());
    this.master = gain(ctx, 0.5, ctx.destination);
    this.wall = filter(ctx, 'lowpass', 20000, 0.7);
    this.wall.connect(this.master);
    this.out = gain(ctx, 1, this.wall);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = noise;
    const src = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(); return s; };

    // city rumble: low-passed noise whose cutoff drifts slowly, like traffic far away
    const cityLp = filter(ctx, 'lowpass', 260, 0.7);
    this.city = gain(ctx, 0.35, this.out);
    src().connect(cityLp).connect(this.city);
    const drift = ctx.createOscillator();
    drift.frequency.value = 0.06;
    drift.connect(gain(ctx, 120, cityLp.frequency));
    drift.start();

    // sodium lamp: mains hum at 120 Hz with a weaker overtone
    this.humPan = ctx.createStereoPanner();
    this.humPan.connect(this.out);
    this.hum = gain(ctx, 0, this.humPan);
    tone(ctx, 'sine', 120, 1, this.hum);
    tone(ctx, 'sine', 240, 0.35, this.hum);
    this.humCrackle = gain(ctx, 0, this.humPan);

    // neon: a buzzy 120 Hz sawtooth through a band-pass, plus crackle for a failing tube
    this.neonPan = ctx.createStereoPanner();
    this.neonPan.connect(this.out);
    this.neon = gain(ctx, 0, this.neonPan);
    const bp = filter(ctx, 'bandpass', 2400, 1.2);
    bp.connect(this.neon);
    tone(ctx, 'sawtooth', 120, 1, bp);
    this.crackle = gain(ctx, 0, this.neonPan);
    const hiss = src().connect(filter(ctx, 'highpass', 3500, 0.7));
    hiss.connect(this.crackle);
    hiss.connect(this.humCrackle);

    this.kit = new Kit(ctx, this.out, noise);

    // rain: a hiss of drops on the pavement, and in a downpour the low roar of water everywhere
    this.rain = gain(ctx, 0, this.out);
    src().connect(filter(ctx, 'bandpass', 2600, 0.5)).connect(this.rain);
    this.rainLow = gain(ctx, 0, this.out);
    src().connect(filter(ctx, 'lowpass', 500, 0.6)).connect(this.rainLow);

    // burning seam: a deep roar
    this.fire = gain(ctx, 0, this.out);
    tone(ctx, 'sine', 38, 0.6, this.fire);
    src().connect(filter(ctx, 'lowpass', 110, 0.8)).connect(gain(ctx, 1.2, this.fire));

    // the nearest vehicles: a motor each (a sawtooth through a low-pass that opens with speed),
    // tyres on the asphalt and, on a wet road, their hiss
    for (let k = 0; k < ENGINES; k++) {
      const pan = ctx.createStereoPanner(); pan.connect(this.out);
      const g = gain(ctx, 0, pan), lp = filter(ctx, 'lowpass', 300, 1.2);
      lp.connect(g);
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 40; osc.connect(lp); osc.start();
      const tyre = gain(ctx, 0, pan); src().connect(filter(ctx, 'bandpass', 900, 0.8)).connect(tyre);
      const wet = gain(ctx, 0, pan); src().connect(filter(ctx, 'highpass', 2800, 0.7)).connect(wet);
      this.engines.push({ osc, lp, g, tyre, wet, pan });
    }

    // a crowd: voices blurred into a murmur, band-passed noise whose loudness wanders like talk
    this.crowd = gain(ctx, 0, this.out);
    for (const [f, rate] of [[480, 0.9], [900, 1.3], [1400, 0.7]]) {
      const g = gain(ctx, 0.5, this.crowd), lfo = ctx.createOscillator();
      src().connect(filter(ctx, 'bandpass', f, 3)).connect(g);
      lfo.frequency.value = rate; lfo.connect(gain(ctx, 0.45, g.gain)); lfo.start();
    }

    // indoors: fluorescent tubes buzzing
    this.tubes = gain(ctx, 0, this.master);
    const tb = filter(ctx, 'bandpass', 1500, 2.5);
    tb.connect(this.tubes);
    tone(ctx, 'sawtooth', 120, 1, tb);
  }

  /** Thunder after `delay` seconds: a crack, then a long low roll that fades. */
  private thunder(delay: number) {
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    const lp = filter(ctx, 'lowpass', 900, 0.7), g = gain(ctx, 0, this.out);
    s.connect(lp).connect(g);
    lp.frequency.setValueAtTime(900, t0);
    lp.frequency.exponentialRampToValueAtTime(90, t0 + 3);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.9, t0 + 0.08);
    g.gain.setTargetAtTime(0.35, t0 + 0.3, 0.4);
    g.gain.setTargetAtTime(0, t0 + 1.5, 1.6);
    s.start(t0);
    s.stop(t0 + 9);
  }

  /** One raindrop hitting a window: a few milliseconds of bright noise, ringing a little. */
  private drop(t: number, g: number, pan: number) {
    const ctx = this.ctx, s = ctx.createBufferSource();
    s.buffer = this.noise;
    const bp = filter(ctx, 'bandpass', 900 + Math.random() * 1500, 4 + Math.random() * 4), p = ctx.createStereoPanner(), v = gain(ctx, 0, p);
    p.pan.value = pan; p.connect(this.master);
    s.connect(bp).connect(v);
    v.gain.setValueAtTime(g, t);
    v.gain.exponentialRampToValueAtTime(0.0005, t + 0.012 + Math.random() * 0.02);
    s.start(t, Math.random() * 1.5);
    s.stop(t + 0.05);
  }

  /** A key of the lift panel: a short square beep (higher when refused). */
  beep(ok = true) {
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
    o.type = 'square'; o.frequency.value = ok ? 1320 : 440;
    o.connect(filter(ctx, 'lowpass', 3000, 0.7)).connect(g);
    g.gain.setValueAtTime(0.05, t); g.gain.setTargetAtTime(0, t + (ok ? 0.05 : 0.15), 0.01);
    o.start(t); o.stop(t + 0.3);
  }

  /**
   * A phone key: the snap of its rubber dome (a click of bright noise) and the handset's short
   * keypad tone, a little higher for the d-pad than the digits, low when the key does nothing.
   */
  phoneKey(digit: boolean, ok = true, tone = true) {
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), c = gain(ctx, 0, this.master);
    s.buffer = this.noise;
    s.connect(filter(ctx, 'highpass', 2500, 0.7)).connect(c);
    c.gain.setValueAtTime(0.09, t); c.gain.exponentialRampToValueAtTime(0.0005, t + 0.012);
    s.start(t, Math.random() * 1.5); s.stop(t + 0.02);
    // the keypad tone can be turned off in the phone's settings: only the dome's click then
    if (!tone) return;
    const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
    o.type = 'sine'; o.frequency.value = !ok ? 520 : digit ? 1180 : 1560;
    o.connect(g);
    g.gain.setValueAtTime(0, t + 0.004); g.gain.linearRampToValueAtTime(0.035, t + 0.008); g.gain.setTargetAtTime(0, t + 0.06, 0.012);
    o.start(t); o.stop(t + 0.2);
  }

  /** A key on the dialer: its touch-tone (DTMF), the two frequencies of its row and column, for a moment. */
  dtmf(key: string) {
    const n = '123456789*0#'.indexOf(key);
    if (n < 0) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const f of [[697, 770, 852, 941][Math.floor(n / 3)], [1209, 1336, 1477][n % 3]]) {
      const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.frequency.value = f; o.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.005); g.gain.setValueAtTime(0.045, t + 0.13); g.gain.linearRampToValueAtTime(0, t + 0.14);
      o.start(t); o.stop(t + 0.2);
    }
  }

  private ringNodes: AudioScheduledSourceNode[] = [];
  /** Stop a ringtone that is playing. */
  stopRing() { for (const n of this.ringNodes) try { n.stop(); } catch { /* already stopped */ } this.ringNodes = []; }
  /**
   * A ringtone, synthesized as the handsets of the time played them (a few voices of square and
   * sine), for `secs` seconds; k picks it (see RINGTONES in phone/phone.ts). The phone's settings play
   * it as a preview; incoming calls (stage 9B) ring with it.
   */
  ring(k: number, secs = 3) {
    this.stopRing();
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05;
    const note = (f: number, at: number, len: number, type: OscillatorType = 'square', v = 0.03) => {
      if (at > secs) return;
      const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.type = type; o.frequency.value = f;
      o.connect(filter(ctx, 'lowpass', 3500, 0.7)).connect(g);
      g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(v, t0 + at + 0.01); g.gain.setValueAtTime(v, t0 + at + len - 0.02); g.gain.linearRampToValueAtTime(0, t0 + at + len);
      o.start(t0 + at); o.stop(t0 + at + len + 0.02);
      this.ringNodes.push(o);
    };
    const m = (n: number) => 440 * 2 ** ((n - 69) / 12);
    switch (k) {
      case 0: // the bell of a desk phone: two tones warbling, 2 s on, 4 s off
        for (let a = 0; a < secs; a += 6) for (let b = 0; b < 2; b += 0.05) { note(440 * (b % 0.1 < 0.05 ? 1 : 1.09), a + b, 0.05, 'triangle', 0.04); }
        break;
      case 1: // trill: a fast high warble in bursts
        for (let a = 0; a < secs; a += 1.2) for (let b = 0; b < 0.6; b += 0.06) note(b % 0.12 < 0.06 ? 1400 : 1750, a + b, 0.06, 'square', 0.02);
        break;
      case 2: // nocturne: a slow minor arpeggio
        [69, 72, 76, 81, 76, 72, 69, 64].forEach((n, i) => { for (let a = 0; a < secs; a += 3.4) note(m(n), a + i * 0.4, 0.38, 'triangle', 0.045); });
        break;
      case 3: // arcade: a bright rising run
        [72, 76, 79, 84, 79, 84, 88, 91].forEach((n, i) => { for (let a = 0; a < secs; a += 1.8) note(m(n), a + i * 0.12, 0.1, 'square', 0.022); });
        break;
      case 4: // pulse: two notes, insistent
        for (let a = 0; a < secs; a += 0.5) note(a % 1 < 0.5 ? m(76) : m(71), a, 0.22, 'square', 0.025);
        break;
      default: // noir: a muted walking bass and a high answer
        [[45, 0], [48, 0.35], [50, 0.7], [52, 1.05], [76, 1.5], [74, 1.8]].forEach(([n, at]) => { for (let a = 0; a < secs; a += 2.6) note(m(n), a + at, n > 60 ? 0.25 : 0.3, n > 60 ? 'sine' : 'triangle', n > 60 ? 0.04 : 0.06); });
    }
  }

  /** The phone vibrating against the hand (silent profiles): a low buzz in bursts. */
  vibrate(secs = 1.6) {
    this.stopRing();
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let a = 0; a < secs; a += 0.8) {
      const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.type = 'sawtooth'; o.frequency.value = 150;
      o.connect(filter(ctx, 'lowpass', 400, 1)).connect(g);
      g.gain.setValueAtTime(0, t0 + a); g.gain.linearRampToValueAtTime(0.05, t0 + a + 0.03); g.gain.setValueAtTime(0.05, t0 + a + 0.42); g.gain.linearRampToValueAtTime(0, t0 + a + 0.47);
      o.start(t0 + a); o.stop(t0 + a + 0.5);
      this.ringNodes.push(o);
    }
  }

  /** Two tones together for a while, through the earpiece's narrow band (call progress tones). */
  private dual(f1: number, f2: number, at: number, len: number, v = 0.03) {
    const ctx = this.ctx, t = ctx.currentTime + at;
    for (const f of [f1, f2]) {
      const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.frequency.value = f; o.connect(filter(ctx, 'bandpass', 900, 0.6)).connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.setValueAtTime(v, t + len - 0.02); g.gain.linearRampToValueAtTime(0, t + len);
      o.start(t); o.stop(t + len + 0.02);
      this.ringNodes.push(o);
    }
  }
  /** The opening: a low swell rising under the typing, and a breath of noise as the city comes apart into glyphs. */
  intro() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
    o.type = 'sawtooth'; o.frequency.setValueAtTime(55, t); o.frequency.linearRampToValueAtTime(82, t + 4);
    o.connect(filter(ctx, 'lowpass', 300, 2)).connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 1.8); g.gain.linearRampToValueAtTime(0, t + 4.6);
    o.start(t); o.stop(t + 4.7);
    const s = ctx.createBufferSource(), h = gain(ctx, 0, this.master);
    s.buffer = this.noise; s.loop = true;
    const f = filter(ctx, 'bandpass', 800, 0.8);
    f.frequency.setValueAtTime(400, t + 1.8); f.frequency.exponentialRampToValueAtTime(3500, t + 4.4);
    s.connect(f).connect(h);
    h.gain.setValueAtTime(0, t + 1.8); h.gain.linearRampToValueAtTime(0.05, t + 2.4); h.gain.linearRampToValueAtTime(0, t + 4.4);
    s.start(t + 1.8); s.stop(t + 4.5);
  }
  /** A phone camera's shutter: the fake click handsets played, two quick clacks. */
  shutter() {
    const ctx = this.ctx, t = ctx.currentTime;
    for (const d of [0, 0.07]) {
      const s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
      s.buffer = this.noise; s.connect(filter(ctx, 'bandpass', d ? 1800 : 2600, 1.2)).connect(g);
      g.gain.setValueAtTime(0.1, t + d); g.gain.exponentialRampToValueAtTime(0.0005, t + d + 0.035);
      s.start(t + d, Math.random()); s.stop(t + d + 0.05);
    }
  }
  /** A payphone ringing on the street: its bell for two seconds, as loud and from where the distance and the bearing say. */
  bell(dist: number, pan: number) {
    const v = 0.08 / (1 + (dist / 12) ** 2);
    if (v < 0.002) return;
    const ctx = this.ctx, t0 = ctx.currentTime, p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(this.master);
    for (let a = 0; a < 2; a += 0.05) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = (a % 0.1 < 0.05 ? 1020 : 1280); o.connect(g).connect(p);
      g.gain.setValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(v * 0.2, t0 + a + 0.05);
      o.start(t0 + a); o.stop(t0 + a + 0.05);
      this.ringNodes.push(o);
    }
  }
  /** A coin dropping into a payphone: a bright metallic clink, and its rattle down the chute. */
  coin(at = 0) {
    const ctx = this.ctx, t = ctx.currentTime + at;
    for (const [f, d, v] of [[3200, 0, 0.06], [4700, 0.004, 0.04], [2100, 0.09, 0.03], [2600, 0.16, 0.02]]) {
      const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.type = 'sine'; o.frequency.value = f * (0.97 + Math.random() * 0.06); o.connect(g);
      g.gain.setValueAtTime(v, t + d); g.gain.exponentialRampToValueAtTime(0.0005, t + d + 0.12);
      o.start(t + d); o.stop(t + d + 0.15);
    }
  }
  /** Coins falling back into the return cup. */
  coinsBack() { for (let k = 0; k < 3; k++) this.coin(0.05 + k * 0.11); }
  /** A payphone's handset lifted off (or put back on) its hook: a heavy clunk. */
  hook() {
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
    s.buffer = this.noise; s.connect(filter(ctx, 'bandpass', 420, 2)).connect(g);
    g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
    s.start(t, Math.random()); s.stop(t + 0.12);
  }
  /** A text arriving: two short bright notes. */
  smsTone() { this.dual(1760, 1760, 0, 0.12, 0.04); this.dual(2093, 2093, 0.16, 0.18, 0.04); }
  /** A text sent: a soft rising chirp. */
  sentTone() { this.dual(1200, 1200, 0, 0.06, 0.03); this.dual(1600, 1600, 0.07, 0.08, 0.03); }
  /** The ringback the caller hears: 440 + 480 Hz for 2 seconds (one ring of the far phone). */
  ringback() { this.dual(440, 480, 0, 2); }
  /** Busy: 480 + 620 Hz, half a second on, half off. */
  busy(secs = 4) { for (let a = 0; a < secs; a += 1) this.dual(480, 620, a, 0.5); }
  /** The three rising tones before a recorded intercept (number not in service). */
  intercept() { [[914, 0, 0.27], [1371, 0.28, 0.27], [1777, 0.56, 0.38]].forEach(([f, a, l]) => this.dual(f, f, a, l, 0.035)); }
  /** The click of the other side hanging up. */
  hangClick() {
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
    s.buffer = this.noise; s.connect(filter(ctx, 'bandpass', 1200, 1.5)).connect(g);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.04);
    s.start(t, Math.random()); s.stop(t + 0.06);
  }
  /**
   * A voice on the line, without words: noise shaped into syllables (a band that moves like
   * formants, bursts of 120-250 ms) through the phone's narrow band. `pitch` sets the voice, a
   * recording sounds flatter and more even.
   */
  voice(secs: number, pitch = 1, rec = false) {
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let a = 0; a < secs; ) {
      const len = rec ? 0.16 : 0.12 + Math.random() * 0.13, s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
      s.buffer = this.noise;
      const f = filter(ctx, 'bandpass', (500 + Math.random() * 900) * pitch, rec ? 6 : 4);
      s.connect(f).connect(filter(ctx, 'bandpass', 1000, 0.5)).connect(g);
      const v = 0.05 + (rec ? 0 : Math.random() * 0.04), t = t0 + a;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.03); g.gain.linearRampToValueAtTime(0, t + len);
      s.start(t, Math.random() * 1.5); s.stop(t + len + 0.02);
      this.ringNodes.push(s);
      a += len + (Math.random() < 0.15 ? 0.18 : 0.03);
    }
  }
  /** Hold music: a slow tune through the earpiece, for `secs`. */
  holdMusic(secs = 8) {
    const ctx = this.ctx, t0 = ctx.currentTime, tune = [67, 71, 74, 72, 71, 69, 67, 64];
    for (let a = 0, i = 0; a < secs; a += 0.5, i++) {
      const o = ctx.createOscillator(), g = gain(ctx, 0, this.master), t = t0 + a;
      o.type = 'triangle'; o.frequency.value = 440 * 2 ** ((tune[i % tune.length] - 69) / 12);
      o.connect(filter(ctx, 'bandpass', 900, 0.7)).connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.02); g.gain.linearRampToValueAtTime(0, t + 0.48);
      o.start(t); o.stop(t + 0.5);
      this.ringNodes.push(o);
    }
  }

  /** A call that cannot go through: after a moment of silence, the network's three rising tones. */
  callFail() {
    const ctx = this.ctx, t = ctx.currentTime + 1.6;
    [[950, 0], [1400, 0.33], [1800, 0.66]].forEach(([f, d]) => {
      const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.frequency.value = f; o.connect(g);
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.04, t + d + 0.01); g.gain.setValueAtTime(0.04, t + d + 0.3); g.gain.linearRampToValueAtTime(0, t + d + 0.32);
      o.start(t + d); o.stop(t + d + 0.4);
    });
  }

  /** The phone out of the pocket (or back in): cloth rustling, and the knock of it in the hand. */
  phoneSlide(out: boolean) {
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
    s.buffer = this.noise;
    s.connect(filter(ctx, 'bandpass', out ? 1700 : 1300, 0.9)).connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.06); g.gain.linearRampToValueAtTime(0.02, t + 0.15); g.gain.linearRampToValueAtTime(0, t + 0.28);
    s.start(t, Math.random()); s.stop(t + 0.3);
    const k = ctx.createBufferSource(), h = gain(ctx, 0, this.master);
    k.buffer = this.noise; k.connect(filter(ctx, 'bandpass', 380, 2)).connect(h);
    const at = t + (out ? 0.24 : 0.02);
    h.gain.setValueAtTime(0.12, at); h.gain.exponentialRampToValueAtTime(0.0005, at + 0.05);
    k.start(at, Math.random()); k.stop(at + 0.08);
  }

  /** The phone powering on: three soft rising notes, a bell on top. */
  phoneBoot(delay = 0) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    [[523, 0], [784, 0.16], [1047, 0.32]].forEach(([f, d]) => {
      for (const [type, mul, v] of [['triangle', 1, 0.05], ['sine', 2, 0.015]] as const) {
        const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
        o.type = type; o.frequency.value = f * mul; o.connect(g);
        g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(v, t + d + 0.01); g.gain.setTargetAtTime(0, t + d + 0.03, d === 0.32 ? 0.45 : 0.12);
        o.start(t + d); o.stop(t + d + 2.5);
      }
    });
  }

  /** Lift doors sliding: a soft rumble of filtered noise that swells and dies. */
  doors() {
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
    s.buffer = this.noise;
    s.connect(filter(ctx, 'bandpass', 350, 1.2)).connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.14, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 0.9);
    s.start(t, Math.random()); s.stop(t + 1);
    // the clunk of them meeting
    const o = ctx.createOscillator(), h = gain(ctx, 0, this.master);
    o.frequency.value = 70; o.connect(h);
    h.gain.setValueAtTime(0.18, t + 0.9); h.gain.setTargetAtTime(0, t + 0.92, 0.04);
    o.start(t + 0.9); o.stop(t + 1.2);
  }

  /** The car moving (0..1 of its speed): a low motor hum and a faint whine. */
  liftMotor(k: number) {
    if (!this.motor) {
      this.motor = gain(this.ctx, 0, this.master);
      const lp = filter(this.ctx, 'lowpass', 260, 0.8);
      lp.connect(this.motor);
      tone(this.ctx, 'sawtooth', 55, 0.6, lp);
    }
    this.motor.gain.setTargetAtTime(0.08 * k, this.ctx.currentTime, 0.2);
  }
  private motor: GainNode | null = null;

  /**
   * A footstep: a soft thud with a scuff on top. Indoors on hard floors it is drier and brighter,
   * on wet streets it splashes, on the stairs it is a little sharper.
   */
  step(indoors: boolean, wet: number, stairs: boolean) {
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
    s.buffer = this.noise;
    const f = (indoors ? 900 : 600) * (stairs ? 1.4 : 1) * (0.85 + Math.random() * 0.3);
    s.connect(filter(ctx, 'bandpass', f, 1.1)).connect(g);
    const v = (indoors ? 0.11 : 0.08) * (0.8 + Math.random() * 0.4);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
    s.start(t, Math.random() * 1.5); s.stop(t + 0.12);
    if (wet > 0.3 && !indoors) {
      // the splash of a puddle: a short bright hiss
      const w = ctx.createBufferSource(), h = gain(ctx, 0, this.master);
      w.buffer = this.noise; w.connect(filter(ctx, 'highpass', 2500, 0.7)).connect(h);
      h.gain.setValueAtTime(0.05 * wet, t + 0.01); h.gain.exponentialRampToValueAtTime(0.0005, t + 0.15);
      w.start(t + 0.01, Math.random() * 1.5); w.stop(t + 0.2);
    }
  }

  /** The car arriving: a soft two-note chime. */
  ding() {
    const ctx = this.ctx, t = ctx.currentTime;
    [[988, 0], [784, 0.35]].forEach(([f, d]) => {
      const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.frequency.value = f; o.connect(g);
      g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.12, t + d + 0.01); g.gain.setTargetAtTime(0, t + d + 0.02, 0.5);
      o.start(t + d); o.stop(t + d + 3);
    });
  }

  /** Browsers only start audio after a click; call from one. */
  resume() { if (this.ctx.state !== 'running') this.ctx.resume(); }

  toggleMute() {
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  /**
   * Follow the listener: position, heading and the time in seconds (the signs' clock); day (0 at
   * night .. 1 in daylight) for the lamps' photocells; the weather; and the lightning bolt now
   * flashing (-1 for none), whose thunder follows once, a few seconds later.
   */
  /**
   * The traffic around the listener: the nearest engines and tyres, horns, buses' air brakes at their
   * stops, and crashes from the event queue, late by the speed of sound.
   */
  traffic(cars: Car[], events: EventLog, x: number, y: number, yaw: number, wet: number, tick: number, people: { x: number; y: number }[] = []) {
    const now = this.ctx.currentTime, rx = -Math.sin(yaw), ry = Math.cos(yaw);
    // the people around: the more within earshot, the louder the murmur
    let crowd = 0;
    for (const p of people) { const d = Math.abs(p.x - x) + Math.abs(p.y - y); if (d < CROWD_R) crowd += 1 - d / CROWD_R; }
    this.crowd.gain.setTargetAtTime(0.09 * Math.min(1, crowd / 8), now, 0.8);
    const pan = (px: number, py: number) => { const d = Math.hypot(px - x, py - y) || 1; return ((px - x) * rx + (py - y) * ry) / d; };
    const near: [number, Car][] = [];
    for (const c of cars) {
      const d = Math.abs(c.x - x) + Math.abs(c.y - y);
      if (d > ENGINE_R * 1.5) continue;
      const e = Math.hypot(c.x - x, c.y - y);
      if (e < ENGINE_R && c.kind !== 'bike') near.push([e, c]); // a bicycle is silent
      // a horn: two detuned square waves, a short blast (a truck's or a bus's deeper)
      if (c.honk && this.honks.get(c) !== c.honk && e < HORN_R) { this.honks.set(c, c.honk); this.horn(now + e / 343, (1 - e / HORN_R) ** 1.5, pan(c.x, c.y), c.len > 6); }
      // a bus pulling up at a stop lets out its air brakes
      if (c.kind === 'bus') {
        if (c.dwell && !this.dwelling.has(c)) { this.dwelling.add(c); if (e < 60) this.psst(now + e / 343, (1 - e / 60) ** 1.5, pan(c.x, c.y)); }
        else if (!c.dwell) this.dwelling.delete(c);
      }
    }
    if (this.honks.size > 500) this.honks.clear();
    near.sort((a, b) => a[0] - b[0]);
    this.engines.forEach((E, k) => {
      const n = near[k];
      if (!n) { E.g.gain.setTargetAtTime(0, now, 0.2); E.tyre.gain.setTargetAtTime(0, now, 0.2); E.wet.gain.setTargetAtTime(0, now, 0.2); return; }
      const [d, c] = n, big = c.len > 6, k2 = (1 - d / ENGINE_R) ** 2, sp = Math.min(1, c.v / 14);
      E.osc.frequency.setTargetAtTime((big ? 28 : 38) + sp * (big ? 30 : 55), now, 0.15);
      E.lp.frequency.setTargetAtTime(180 + sp * 600, now, 0.15);
      E.g.gain.setTargetAtTime(k2 * (big ? 0.16 : 0.1) * (0.35 + 0.65 * sp), now, 0.1);
      E.tyre.gain.setTargetAtTime(k2 * 0.05 * sp, now, 0.1);
      E.wet.gain.setTargetAtTime(k2 * 0.09 * sp * wet, now, 0.1);
      E.pan.pan.setTargetAtTime(pan(c.x, c.y) * 0.85, now, 0.1);
    });
    // crashes: a heavy thump, metal crumpling and glass, heard from where they happened
    for (const e of events.list) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (e.kind !== 'crash' || tick - e.tick > 60) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < CRASH_R) this.smash(now + d / 343, (1 - d / CRASH_R) ** 1.6 * (0.5 + e.weight), pan(e.x, e.y));
    }
  }

  private burst(t: number, len: number, v: number, pan: number, f: number, type: BiquadFilterType, q: number) {
    const ctx = this.ctx, s = ctx.createBufferSource(), p = ctx.createStereoPanner(), g = gain(ctx, 0, p);
    p.pan.value = pan; p.connect(this.out);
    s.buffer = this.noise; s.connect(filter(ctx, type, f, q)).connect(g);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    s.start(t, Math.random() * 1.5); s.stop(t + len + 0.05);
  }

  private horn(t: number, v: number, pan: number, big: boolean) {
    const ctx = this.ctx, p = ctx.createStereoPanner(), g = gain(ctx, 0, p), lp = filter(ctx, 'lowpass', 1800, 0.7);
    p.pan.value = pan; p.connect(this.out); lp.connect(g);
    const len = 0.25 + Math.random() * 0.45;
    for (const f of big ? [180, 227] : [400, 505]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + len + 0.05); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07 * v, t + 0.02); g.gain.setValueAtTime(0.07 * v, t + len); g.gain.linearRampToValueAtTime(0, t + len + 0.04);
  }

  private psst(t: number, v: number, pan: number) {
    this.burst(t, 0.7, 0.12 * v, pan, 3200, 'highpass', 0.7);
  }

  private smash(t: number, v: number, pan: number) {
    this.burst(t, 0.45, 0.6 * v, pan, 140, 'lowpass', 0.9);
    // the crumple: a rattle of short mid bursts
    for (let k = 0; k < 7; k++) this.burst(t + 0.01 + k * 0.025 + Math.random() * 0.02, 0.06, 0.25 * v * (1 - k / 8), pan, 700 + Math.random() * 900, 'bandpass', 2);
    // glass: bright pings scattering
    for (let k = 0; k < 10; k++) {
      const ctx = this.ctx, o = ctx.createOscillator(), p = ctx.createStereoPanner(), g = gain(ctx, 0, p), at = t + 0.05 + Math.random() * 0.35;
      p.pan.value = Math.max(-1, Math.min(1, pan + (Math.random() - 0.5) * 0.4)); p.connect(this.out);
      o.frequency.value = 3000 + Math.random() * 4000; o.connect(g);
      g.gain.setValueAtTime(0.03 * v, at); g.gain.exponentialRampToValueAtTime(0.0003, at + 0.08);
      o.start(at); o.stop(at + 0.1);
    }
  }

  update(city: City, x: number, y: number, yaw: number, sec: number, day: number, w: Weather, bolt: number, grid: PowerGrid, indoors: boolean, tubes: number) {
    const now = this.ctx.currentTime;
    const rain = w.snow ? 0 : w.precip;
    // walls: the street goes low and quiet, the room's own sounds come up
    this.wall.frequency.setTargetAtTime(indoors ? 220 : 20000, now, 0.15);
    this.out.gain.setTargetAtTime(indoors ? 0.28 : 1, now, 0.15);
    // the rain itself is barely heard indoors; the drops tapping on the glass are, one by one
    if (indoors && rain > 0.02) {
      if (this.nextDrop < now) this.nextDrop = now + 0.02;
      while (this.nextDrop < now + 0.2) {
        this.drop(this.nextDrop, 0.04 + Math.random() * 0.14, (Math.random() - 0.5) * 1.4);
        this.nextDrop += -Math.log(1 - Math.random()) / (2 + rain * 22);
      }
    }
    this.tubes.gain.setTargetAtTime(indoors ? 0.012 * tubes : 0, now, 0.1);
    this.rain.gain.setTargetAtTime(0.28 * Math.min(1, rain * 1.4), now, 0.4);
    this.rainLow.gain.setTargetAtTime(0.35 * Math.max(0, rain - 0.4), now, 0.6);
    // falling and lying snow muffle the city
    this.city.gain.setTargetAtTime(0.35 * (1 - 0.6 * Math.max(w.snow ? w.precip : 0, w.snowCover)) * (1 - 0.55 * this.hush), now, 1);
    this.hush = grid.subs.some((s) => !s.on && Math.hypot(s.x - x, s.y - y) < 700) ? 1 : 0;
    if (bolt >= 0 && bolt !== this.lastBolt) { this.lastBolt = bolt; this.thunder(1 + ((bolt * 7919) % 50) / 10); }
    // screen-right direction, for panning
    const rx = -Math.sin(yaw), ry = Math.cos(yaw);
    const pan = (px: number, py: number) => { const d = Math.hypot(px - x, py - y) || 1; return ((px - x) * rx + (py - y) * ry) / d; };

    // the grid: a substation switching within earshot is heard, late by the speed of sound
    grid.subs.forEach((s, k) => {
      if (this.seen[k] === undefined) { this.seen[k] = s.changed; return; }
      if (s.changed === this.seen[k]) return;
      this.seen[k] = s.changed;
      // heard from where it was thrown (for now, where the player is)
      const d = Math.hypot(s.ox - x, s.oy - y);
      if (d > 1400) return;
      const g = (1 - d / 1400) ** 1.3, at = now + d / 343, pn = pan(s.ox, s.oy) * 0.6;
      if (!s.on) blackout(this.kit, at, g, pn);
      else restore(this.kit, at, g, pn);
    });
    // in a dark district the city hush falls; now and then a relay or a transformer fights back
    let here = 0;
    grid.subs.forEach((s, k) => { if (!s.on && Math.hypot(s.x - x, s.y - y) < 700) here = Math.max(here, 1 - power(grid, k, x, y, 7, 0, sec)[0]); });
    if (here > 0.8 && now > this.nextDark) { darkEvent(this.kit, now, (Math.random() - 0.5) * 1.6); this.nextDark = now + 1.5 + Math.random() * 5; }

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
    const type = lid >= 0 ? city.lamps[lid].lampType ?? 'hps' : 'hps';
    if (lid >= 0 && lamp < LAMP_R && LAMP_LIGHT[type].hum) {
      const near = (1 - lamp / LAMP_R) ** 2;
      lampState(lid, sec, this.st, type);
      photocell(lid, day, this.st);
      hum = 0.05 * near * this.st[0] * Math.min(1, power(grid, grid.lamp[lid], lx, ly, lid + 100000, 0, sec)[0]);
      if (lampMode(lid, type) === LampMode.Stutter && lampStutter(lid, sec)) hcr = 0.04 * near;
    }
    this.hum.gain.setTargetAtTime(hum, now, 0.03);
    this.humCrackle.gain.setTargetAtTime(hcr, now, 0.01);
    if (hum) this.humPan.pan.setTargetAtTime(pan(lx, ly) * 0.8, now, 0.1);

    let neon = 0, crackle = 0;
    if (biz >= 0 && sign < SIGN_R) {
      const near = (1 - sign / SIGN_R) ** 2, mode = signMode(city, biz);
      const bk = city.businesses[biz].building, Bb = city.buildings[bk];
      const lit = signLight(biz, mode, -1, signText(city, biz, 255).length, sec) * Math.min(1, power(grid, grid.building[bk], (Bb.x0 + Bb.x1) / 2, (Bb.y0 + Bb.y1) / 2, bk, 0, sec)[0]);
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
