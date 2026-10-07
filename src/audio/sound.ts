import { LAMP_LIGHT, lampId, lampMode, LampMode, lampState, lampStutter, photocell } from '../render/lamps';
import { signLight, signMode, SignMode, signStutter, signText } from '../render/signs';
import { type City } from '../sim/city';
import { type Weather } from '../sim/weather';
import { type PowerGrid } from '../sim/power';
import { power } from '../render/power';
import { blackout, darkEvent, Kit, restore } from './blackout';
import { type Car } from '../sim/traffic';
import { type EventLog } from '../sim/events';
import { Music } from './music';

/**
 * (L.13) Development only: play the recorded blackout sounds the user keeps in
 * `easter eggs/copyright protected/` (git-ignored, never shipped) instead of the synthesized ones.
 * Where the files are missing (any build given to someone else), the synthesized sounds play.
 * The final game uses only synthesized sounds.
 */
const EGG_SOUNDS = true;

/** Engines heard at once (the nearest), and how far an engine, a horn and a crash carry. */
const ENGINES = 3, ENGINE_R = 45, HORN_R = 120, CRASH_R = 600, CROWD_R = 30;
/** Passers-by's phones heard: ringing within this, keys clicking within the second. */
const PED_RING_R = 22, PED_KEYS_R = 4;
/** Sirens: one answering a crash within SIREN_R, after a while; and now and then one from somewhere in the city. */
const SIREN_R = 1500;

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
  private wind: GainNode;
  private windLp: BiquadFilterNode;
  private whistle: GainNode;
  private whistleBp: BiquadFilterNode;
  private noise: AudioBuffer;
  private lastBolt = -1;
  private kit: Kit;
  /** (L.13, dev only) The recorded blackout sounds from `easter eggs/copyright protected/`, when EGG_SOUNDS and the files are there. */
  private egg: { down?: AudioBuffer; up?: AudioBuffer } = {};
  private seen: number[] = [];
  private nextDark = 0;
  private hush = 0;
  /** Everything outdoors reaches the ear through this: muffled by the walls indoors. */
  private out: GainNode;
  private wall: BiquadFilterNode;
  /** The earphones in (2026-10-06): the world comes through them muffled and quieter. */
  private ears: BiquadFilterNode;
  private earsGain: GainNode;
  private earsOn = false;
  /** Indoors: the buzz of office tubes, and when the next raindrop hits the glass. */
  private tubes: GainNode;
  private nextDrop = 0;
  muted = false;
  /** The phone's music (15.9b): the Tunes Player's songs and the SD card's files. */
  readonly music: Music;

  private engines: { osc: OscillatorNode; lp: BiquadFilterNode; g: GainNode; tyre: GainNode; wet: GainNode; pan: StereoPannerNode }[] = [];
  private lastEvent = -1;
  private crowd!: GainNode;
  private dwelling = new Set<Car>();
  private honks = new Map<Car, number>();
  /** When each passer-by's phone rings next (its tune's loop), and when the next key click of someone texting near is. */
  private pedRings = new Map<number, number>();
  private nextKey = 0;
  /** The next far car going by, the next siren from nowhere in particular, and the sirens coming to crashes (when, where). */
  private nextPass = 0;
  private nextSiren = 0;
  private sirensDue: [number, number, number][] = [];

  constructor() {
    const ctx = (this.ctx = new AudioContext());
    this.master = gain(ctx, 0.5, ctx.destination);
    this.wall = filter(ctx, 'lowpass', 20000, 0.7);
    this.earsGain = gain(ctx, 1, this.master);
    this.ears = filter(ctx, 'lowpass', 20000, 0.7);
    this.ears.connect(this.earsGain);
    this.wall.connect(this.ears);
    this.out = gain(ctx, 1, this.wall);
    this.music = new Music(ctx, this.master);
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
    if (EGG_SOUNDS) for (const [k, f] of [['down', 'wd_blackout_start'], ['up', 'wd_blackout_end']] as const)
      fetch(`/easter eggs/copyright protected/${f}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((b) => ctx.decodeAudioData(b)).then((a) => { this.egg[k] = a; }).catch(() => {});

    // rain: a hiss of drops on the pavement, and in a downpour the low roar of water everywhere
    this.rain = gain(ctx, 0, this.out);
    src().connect(filter(ctx, 'bandpass', 2600, 0.5)).connect(this.rain);
    this.rainLow = gain(ctx, 0, this.out);
    src().connect(filter(ctx, 'lowpass', 500, 0.6)).connect(this.rainLow);

    // wind: a low rush of air with a whistle over it, in gusts (through the walls indoors, muffled)
    this.wind = gain(ctx, 0, this.out);
    this.windLp = filter(ctx, 'lowpass', 400, 0.7);
    src().connect(this.windLp).connect(this.wind);
    this.whistle = gain(ctx, 0, this.out);
    this.whistleBp = filter(ctx, 'bandpass', 700, 6);
    src().connect(this.whistleBp).connect(this.whistle);

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
  /** (L.13) One of the recorded blackout sounds (EGG_SOUNDS), at time `at`, with gain g and pan pn. */
  private playEgg(buf: AudioBuffer, at: number, g: number, pn: number) {
    const src = this.ctx.createBufferSource(), p = this.ctx.createStereoPanner();
    src.buffer = buf;
    p.pan.value = Math.max(-1, Math.min(1, pn));
    src.connect(gain(this.ctx, g, p)); p.connect(this.out);
    src.start(at);
  }

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

  /** The wristwatch's piezo: two short high pips on the hour (F.4), quiet as a watch on a wrist is. */
  watchChime() {
    const ctx = this.ctx;
    for (const a of [0, 0.16]) {
      const t = ctx.currentTime + a, o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.type = 'square'; o.frequency.value = 4096;
      o.connect(filter(ctx, 'lowpass', 6000, 0.7)).connect(g);
      g.gain.setValueAtTime(0.012, t); g.gain.setValueAtTime(0, t + 0.07);
      o.start(t); o.stop(t + 0.1);
    }
  }

  /** The wristwatch's alarm: a burst of four fast pips (asked for once a second while it rings). */
  watchAlarm() {
    const ctx = this.ctx;
    for (let b = 0; b < 4; b++) {
      const t = ctx.currentTime + b * 0.11, o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.type = 'square'; o.frequency.value = 4096;
      o.connect(filter(ctx, 'lowpass', 6000, 0.7)).connect(g);
      g.gain.setValueAtTime(0.03, t); g.gain.setValueAtTime(0, t + 0.06);
      o.start(t); o.stop(t + 0.08);
    }
  }

  /** A wristwatch button: one short pip, as the cheap ones beep on every press. */
  watchBeep() {
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
    o.type = 'square'; o.frequency.value = 4096;
    o.connect(filter(ctx, 'lowpass', 6000, 0.7)).connect(g);
    g.gain.setValueAtTime(0.012, t); g.gain.setValueAtTime(0, t + 0.035);
    o.start(t); o.stop(t + 0.05);
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

  /** A touch on the phone's screen (the manual v2): not a key's click but a short high tick from its speaker, a sine and its octave. */
  phoneTap() {
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [f, v] of [[1250, 0.045], [2500, 0.012]] as const) {
      const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.type = 'sine'; o.frequency.value = f; o.connect(g);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.032);
      o.start(t); o.stop(t + 0.05);
    }
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
  stopRing() { for (const n of this.ringNodes) try { n.stop(); } catch { /* already stopped */ } this.ringNodes = []; this.stopTone(); }
  /** The handset's own ringtone and buzz, apart from the call tones in the earpiece (a payphone's ringback goes on under them). */
  private toneNodes: AudioScheduledSourceNode[] = [];
  private stopTone() { for (const n of this.toneNodes) try { n.stop(); } catch { /* already stopped */ } this.toneNodes = []; }
  /**
   * A ringtone, synthesized as the handsets of the time played them (a few voices of square and
   * sine), for `secs` seconds; k picks it (see RINGTONES in phone/phone.ts). The phone's settings play
   * it as a preview; incoming calls (stage 9B) ring with it.
   */
  ring(k: number, secs = 3) {
    this.stopTone();
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05;
    const note = (f: number, at: number, len: number, type: OscillatorType = 'square', v = 0.03) => {
      if (at > secs) return;
      const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.type = type; o.frequency.value = f;
      o.connect(filter(ctx, 'lowpass', 3500, 0.7)).connect(g);
      g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(v, t0 + at + 0.01); g.gain.setValueAtTime(v, t0 + at + len - 0.02); g.gain.linearRampToValueAtTime(0, t0 + at + len);
      o.start(t0 + at); o.stop(t0 + at + len + 0.02);
      this.toneNodes.push(o);
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
    this.stopTone();
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let a = 0; a < secs; a += 0.8) {
      const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
      o.type = 'sawtooth'; o.frequency.value = 150;
      o.connect(filter(ctx, 'lowpass', 400, 1)).connect(g);
      g.gain.setValueAtTime(0, t0 + a); g.gain.linearRampToValueAtTime(0.05, t0 + a + 0.03); g.gain.setValueAtTime(0.05, t0 + a + 0.42); g.gain.linearRampToValueAtTime(0, t0 + a + 0.47);
      o.start(t0 + a); o.stop(t0 + a + 0.5);
      this.toneNodes.push(o);
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
  /**
   * A syllable of someone talking (14.3): the chiptune murmur, a short square-wave blip around the
   * speaker's own pitch (lower or higher by the person), a little different every time.
   */
  murmur(pitch: number) {
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
    o.type = 'square'; o.frequency.setValueAtTime(pitch * (0.9 + Math.random() * 0.25), t);
    o.frequency.linearRampToValueAtTime(pitch * (0.85 + Math.random() * 0.3), t + 0.05);
    o.connect(filter(ctx, 'lowpass', 1800, 0.7)).connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.022, t + 0.006); g.gain.setTargetAtTime(0, t + 0.035, 0.01);
    o.start(t); o.stop(t + 0.09);
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

  /**
   * A notebook key: the scissor switch's short snap (bright noise) over a soft thock of the keycap
   * bottoming out; the space bar and the big keys deeper and a bit louder. Each press a little different.
   */
  lapKey(kind: 'key' | 'space' | 'enter') {
    const ctx = this.ctx, t = ctx.currentTime, big = kind !== 'key';
    const s = ctx.createBufferSource(), c = gain(ctx, 0, this.master);
    s.buffer = this.noise;
    s.connect(filter(ctx, 'bandpass', (big ? 2200 : 3200) + Math.random() * 900, 1.2)).connect(c);
    c.gain.setValueAtTime((big ? 0.2 : 0.16) * (0.8 + Math.random() * 0.4), t); c.gain.exponentialRampToValueAtTime(0.0005, t + 0.018);
    s.start(t, Math.random() * 1.5); s.stop(t + 0.03);
    const k = ctx.createBufferSource(), h = gain(ctx, 0, this.master);
    k.buffer = this.noise;
    k.connect(filter(ctx, 'bandpass', kind === 'space' ? 260 : big ? 380 : 520 + Math.random() * 120, 2)).connect(h);
    const at = t + 0.006;
    h.gain.setValueAtTime(kind === 'space' ? 0.36 : big ? 0.26 : 0.18, at); h.gain.exponentialRampToValueAtTime(0.0005, at + (kind === 'space' ? 0.05 : 0.03));
    k.start(at, Math.random() * 1.5); k.stop(at + 0.07);
  }
  /** The backpack's zipper: a run of tiny teeth clicking past, then the bag's cloth. */
  zipper() {
    const ctx = this.ctx, t0 = ctx.currentTime;
    for (let n = 0; n < 34; n++) {
      const t = t0 + n * (0.011 + Math.random() * 0.004), s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
      s.buffer = this.noise; s.connect(filter(ctx, 'bandpass', 2600 + Math.random() * 1500, 1.5)).connect(g);
      g.gain.setValueAtTime(0.03 + Math.random() * 0.02, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.008);
      s.start(t, Math.random() * 1.5); s.stop(t + 0.012);
    }
    this.phoneSlide(true);
  }
  /** The lid: the hinge's friction as it swings, and the clack of it shutting (or the knock of it open). */
  lid(open: boolean) {
    const ctx = this.ctx, t = ctx.currentTime, len = open ? 0.4 : 0.28;
    const s = ctx.createBufferSource(), g = gain(ctx, 0, this.master), f = filter(ctx, 'bandpass', 700, 3);
    s.buffer = this.noise; s.connect(f).connect(g);
    f.frequency.setValueAtTime(open ? 500 : 900, t); f.frequency.linearRampToValueAtTime(open ? 900 : 500, t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.05); g.gain.linearRampToValueAtTime(0, t + len);
    s.start(t, Math.random()); s.stop(t + len + 0.05);
    const k = ctx.createBufferSource(), h = gain(ctx, 0, this.master), at = t + len;
    k.buffer = this.noise; k.connect(filter(ctx, 'bandpass', open ? 300 : 650, 2)).connect(h);
    h.gain.setValueAtTime(open ? 0.05 : 0.16, at); h.gain.exponentialRampToValueAtTime(0.0005, at + 0.06);
    k.start(at, Math.random()); k.stop(at + 0.1);
  }
  /** The drive seeking: the head's arm ticking across the platter. */
  /**
   * The drive's head arm moving, as an old mechanical drive sounds: a dry tick of the actuator
   * hitting its stop over a dull thock through the case; now and then a quick chatter of short seeks.
   */
  seek(at = 0, big = false) {
    const ctx = this.ctx, t = ctx.currentTime + at, n = big ? 1 : Math.random() < 0.25 ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const d = k * (0.018 + Math.random() * 0.012);
      this.hddHit(t + d, 1500 + Math.random() * 900, (big ? 0.1 : 0.05) * (0.6 + Math.random() * 0.5), 0.005);
      this.hddHit(t + d + 0.002, big ? 260 : 340 + Math.random() * 120, (big ? 0.22 : 0.09) * (0.7 + Math.random() * 0.4), big ? 0.035 : 0.018);
    }
  }
  private hddHit(t: number, f: number, v: number, len: number) {
    const ctx = this.ctx, s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
    s.buffer = this.noise; s.connect(filter(ctx, 'bandpass', f, f < 600 ? 1.6 : 3)).connect(g);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    s.start(t, Math.random() * 1.5); s.stop(t + len + 0.01);
  }
  /**
   * Power on: the spindle motor winds up (a rising whirr), then the heads unpark and calibrate (a
   * few heavy clunks and a buzz of fast seeks as the arm sweeps the platters), then quiet reads.
   */
  hddSpinUp() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
    o.type = 'sawtooth'; o.connect(filter(ctx, 'lowpass', 300, 1)).connect(g);
    o.frequency.setValueAtTime(8, t); o.frequency.exponentialRampToValueAtTime(90, t + 2.4);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.3); g.gain.linearRampToValueAtTime(0.018, t + 2.4); g.gain.linearRampToValueAtTime(0, t + 3);
    o.start(t); o.stop(t + 3.1);
    // the brushes' whirr as it starts
    const n = ctx.createBufferSource(), ng = gain(ctx, 0, this.master), nf = filter(ctx, 'bandpass', 200, 2);
    n.buffer = this.noise; n.connect(nf).connect(ng);
    nf.frequency.setValueAtTime(150, t); nf.frequency.exponentialRampToValueAtTime(1400, t + 2.4);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.02, t + 0.4); ng.gain.linearRampToValueAtTime(0, t + 2.6);
    n.start(t, Math.random()); n.stop(t + 2.7);
    // unpark and calibrate
    const c = 2.5;
    for (const [d, big] of [[0, true], [0.22, true], [0.5, false], [0.56, false], [0.62, false], [0.68, false], [0.74, false], [0.95, true], [1.3, false], [1.38, false], [1.6, true]] as [number, boolean][]) this.seek(c + d, big);
    // the voice coil's buzz as the arm sweeps
    const b = ctx.createOscillator(), bg = gain(ctx, 0, this.master);
    b.type = 'square'; b.frequency.value = 110; b.connect(filter(ctx, 'bandpass', 700, 2)).connect(bg);
    bg.gain.setValueAtTime(0, t + c + 0.48); bg.gain.linearRampToValueAtTime(0.012, t + c + 0.5); bg.gain.linearRampToValueAtTime(0, t + c + 0.8);
    b.start(t + c + 0.45); b.stop(t + c + 0.85);
  }
  /** Power off: the heads park with a clunk, the spindle winds down. */
  hddPark() {
    this.seek(0, true);
    this.seek(0.12, false);
  }
  /** The BIOS's beep from the little speaker: short, square and thin. */
  biosBeep() {
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
    o.type = 'square'; o.frequency.value = 1000; o.connect(filter(ctx, 'bandpass', 1400, 1)).connect(g);
    g.gain.setValueAtTime(0.035, t); g.gain.setValueAtTime(0.035, t + 0.12); g.gain.linearRampToValueAtTime(0, t + 0.13);
    o.start(t); o.stop(t + 0.15);
  }
  /** The Ferret's back button (15.17c): a low, soft "tum", a pitch falling under a felt click. */
  ferretBack() {
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = gain(ctx, 0, this.master);
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(65, t + 0.11); o.connect(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
    o.start(t); o.stop(t + 0.18);
    const s = ctx.createBufferSource(), c = gain(ctx, 0, this.master);
    s.buffer = this.noise; s.connect(filter(ctx, 'lowpass', 1800, 0.7)).connect(c);
    c.gain.setValueAtTime(0.03, t); c.gain.exponentialRampToValueAtTime(0.0005, t + 0.02);
    s.start(t, Math.random()); s.stop(t + 0.03);
  }
  /** A Ferret tab picked, opened or closed: a small, bright plastic tick. */
  ferretTab() {
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
    s.buffer = this.noise; s.connect(filter(ctx, 'bandpass', 2600, 2.5)).connect(g);
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.012);
    s.start(t, Math.random()); s.stop(t + 0.02);
  }
  /** The power button's click. */
  powerClick() {
    const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
    s.buffer = this.noise; s.connect(filter(ctx, 'highpass', 3000, 0.7)).connect(g);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.01);
    s.start(t, Math.random()); s.stop(t + 0.02);
  }
  private lapHum: { spin: OscillatorNode; whine: OscillatorNode; sg: GainNode; fan: GainNode; ff: BiquadFilterNode } | null = null;
  /**
   * The notebook running: the drive's platter (5400 rpm, a hum at 90 Hz with a faint whine) and the
   * fan's soft hiss. `spin` 0..1 is the platter's speed (it spins up at boot and down at halt).
   */
  laptopHum(on: boolean, spin: number, fan = 0) {
    const ctx = this.ctx, t = ctx.currentTime;
    if (!this.lapHum) {
      const sg = gain(ctx, 0, this.master), fan = gain(ctx, 0, this.master);
      const spinO = ctx.createOscillator(), whine = ctx.createOscillator();
      spinO.type = 'triangle'; whine.type = 'sine';
      spinO.connect(filter(ctx, 'lowpass', 260, 0.7)).connect(sg);
      const wg = gain(ctx, 0.025, sg); whine.connect(filter(ctx, 'lowpass', 1200, 0.7)).connect(wg);
      spinO.start(); whine.start();
      const n = ctx.createBufferSource(); n.buffer = this.noise; n.loop = true;
      const ff = filter(ctx, 'lowpass', 420, 0.5);
      n.connect(ff).connect(fan); n.start();
      this.lapHum = { spin: spinO, whine, sg, fan, ff };
    }
    const H = this.lapHum;
    H.spin.frequency.setTargetAtTime(15 + 75 * spin, t, 0.1);
    H.whine.frequency.setTargetAtTime(180 + 720 * spin, t, 0.1);
    H.sg.gain.setTargetAtTime(on ? 0.012 * spin : 0, t, 0.2);
    // the fan: a soft hiss at idle, louder and brighter as it spins up to cool
    H.fan.gain.setTargetAtTime(on ? 0.007 + 0.03 * fan * fan : 0, t, 0.6);
    H.ff.frequency.setTargetAtTime(380 + 1600 * fan, t, 0.6);
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

  /**
   * The slider's rail (15.19b): the plastic plates rubbing as it runs (a narrow hiss that rises), then the
   * spring's catch, the "tchac": a bright snap with a short knock under it. Shutting it is a little lower.
   */
  railSlide(open: boolean) {
    const ctx = this.ctx, t = ctx.currentTime, p = open ? 1 : 0.8;
    const s = ctx.createBufferSource(), f = filter(ctx, 'bandpass', 2600 * p, 3), g = gain(ctx, 0, this.master);
    s.buffer = this.noise; s.connect(f).connect(g);
    f.frequency.setValueAtTime(2000 * p, t); f.frequency.linearRampToValueAtTime(3400 * p, t + 0.11);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.04); g.gain.linearRampToValueAtTime(0.018, t + 0.11); g.gain.linearRampToValueAtTime(0, t + 0.13);
    s.start(t, Math.random()); s.stop(t + 0.15);
    const at = t + 0.13;
    // the snap: noise through a high band, very short
    const c = ctx.createBufferSource(), cg = gain(ctx, 0, this.master);
    c.buffer = this.noise; c.connect(filter(ctx, 'bandpass', 4200 * p, 1.5)).connect(cg);
    cg.gain.setValueAtTime(0.16, at); cg.gain.exponentialRampToValueAtTime(0.0005, at + 0.025);
    c.start(at, Math.random()); c.stop(at + 0.04);
    // the knock of the plates meeting the stop
    const o = ctx.createOscillator(), og = gain(ctx, 0, this.master);
    o.type = 'triangle'; o.frequency.setValueAtTime(420 * p, at); o.frequency.exponentialRampToValueAtTime(160 * p, at + 0.04); o.connect(og);
    og.gain.setValueAtTime(0.09, at); og.gain.exponentialRampToValueAtTime(0.0005, at + 0.06);
    o.start(at); o.stop(at + 0.08);
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

  /**
   * A door swinging (13.10d), by what it is made of (DOOR_* in sim/interior): wood (and an office's panel) clicks its
   * latch, rubs its hinge and knocks shut; a street door's glass leaf clacks its push bar, hisses on its closer and
   * shuts with a tinny shiver of the glass; the steel one of a stockroom thumps its bar and booms shut. vol: by distance.
   */
  swing(open: boolean, kind = 1, vol = 1) {
    const ctx = this.ctx, t = ctx.currentTime;
    const out = gain(ctx, vol, this.master);
    const click = (at: number, f: number, v: number, q = 3, d = 0.012) => {
      const s = ctx.createBufferSource(), g = gain(ctx, 0, out);
      s.buffer = this.noise; s.connect(filter(ctx, 'bandpass', f, q)).connect(g);
      g.gain.setValueAtTime(v, t + at); g.gain.setTargetAtTime(0, t + at + 0.004, d);
      s.start(t + at, Math.random()); s.stop(t + at + 0.08 + d * 6);
    };
    const thud = (at: number, f: number, v: number, d: number) => {
      const o = ctx.createOscillator(), h = gain(ctx, 0, out);
      o.frequency.setValueAtTime(f, t + at); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + at + d * 4); o.connect(h);
      h.gain.setValueAtTime(v, t + at); h.gain.setTargetAtTime(0, t + at + 0.01, d);
      o.start(t + at); o.stop(t + at + d * 8);
    };
    const rub = (at: number, f0: number, f1: number, v: number, len: number, q = 6) => {
      const s = ctx.createBufferSource(), bp = filter(ctx, 'bandpass', f0, q), g = gain(ctx, 0, out);
      s.buffer = this.noise; s.connect(bp).connect(g);
      bp.frequency.setValueAtTime(f0, t + at); bp.frequency.linearRampToValueAtTime(f1, t + at + len);
      g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(v, t + at + len * 0.3); g.gain.linearRampToValueAtTime(0, t + at + len);
      s.start(t + at, Math.random()); s.stop(t + at + len + 0.05);
    };
    if (kind === 0) {
      // glass: the push bar's clack, the closer's soft hiss; shut, the frame's knock and the pane's shiver
      if (open) { click(0, 1900, 0.13, 2); click(0.03, 700, 0.1, 2); rub(0.08, 2400, 3200, 0.025, 0.5, 1.5); }
      else {
        rub(0, 3000, 2200, 0.02, 0.35, 1.5); click(0.35, 1100, 0.12, 2); thud(0.35, 140, 0.08, 0.03);
        for (let k = 0; k < 3; k++) { const o = ctx.createOscillator(), h = gain(ctx, 0, out); o.frequency.value = 3800 + k * 1370; o.connect(h); h.gain.setValueAtTime(0.012, t + 0.36); h.gain.setTargetAtTime(0, t + 0.37, 0.05); o.start(t + 0.36); o.stop(t + 0.7); }
      }
    } else if (kind === 2) {
      // steel: the bar's heavy clunk, a long low groan of the hinge; shut, a boom and the latch
      if (open) { click(0, 900, 0.16, 2, 0.02); thud(0.02, 110, 0.12, 0.05); rub(0.1, 220, 330, 0.06, 0.8, 4); }
      else { thud(0, 62, 0.3, 0.12); click(0, 500, 0.18, 1.5, 0.03); click(0.05, 1500, 0.08); }
    } else {
      // wood (an office's panel a little lighter): the latch's click, the hinge's rub; shut, a soft knock
      const hi = kind === 3 ? 1.2 : 1;
      click(0, 2600 * hi, 0.12);
      if (open) rub(0.05, 600 * hi, 900 * hi, 0.05, 0.4);
      else { thud(0, 95 * hi, 0.16, 0.05); click(0.02, 1400 * hi, 0.08); }
    }
  }

  /** A shop's steel shutter rolling down (or up): the slats rattling over the drum for a few seconds, a clang at the end. */
  rollShutter(down: boolean, vol = 1) {
    const ctx = this.ctx, t = ctx.currentTime, len = 3.2;
    const out = gain(ctx, vol, this.master);
    const s = ctx.createBufferSource(), bp = filter(ctx, 'bandpass', down ? 900 : 700, 2), am = gain(ctx, 0, out);
    s.buffer = this.noise; s.connect(bp).connect(am);
    // the slats passing the drum, about 18 a second
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.type = 'square'; lfo.frequency.value = 18; lg.gain.value = 0.05; lfo.connect(lg).connect(am.gain);
    am.gain.setValueAtTime(0.06, t); am.gain.linearRampToValueAtTime(0.07, t + len * 0.8); am.gain.linearRampToValueAtTime(0, t + len);
    bp.frequency.linearRampToValueAtTime(down ? 650 : 1000, t + len);
    s.start(t, Math.random()); s.stop(t + len + 0.1); lfo.start(t); lfo.stop(t + len + 0.1);
    // the bottom bar hitting the ground (rolled down) or the stop (rolled up)
    const o = ctx.createOscillator(), h = gain(ctx, 0, out);
    o.frequency.value = down ? 85 : 140; o.connect(h);
    h.gain.setValueAtTime(0.22, t + len); h.gain.setTargetAtTime(0, t + len + 0.01, 0.1);
    o.start(t + len); o.stop(t + len + 0.8);
    const c = ctx.createBufferSource(), g = gain(ctx, 0, out);
    c.buffer = this.noise; c.connect(filter(ctx, 'bandpass', 1200, 3)).connect(g);
    g.gain.setValueAtTime(0.12, t + len); g.gain.setTargetAtTime(0, t + len + 0.005, 0.06);
    c.start(t + len, Math.random()); c.stop(t + len + 0.4);
  }

  /** A locked door tried: the handle turns and stops, the latch knocks twice against its keeper. */
  rattle() {
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [at, f, v] of [[0, 1800, 0.1], [0.11, 900, 0.14], [0.2, 900, 0.1]]) {
      const s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
      s.buffer = this.noise; s.connect(filter(ctx, 'bandpass', f, 4)).connect(g);
      g.gain.setValueAtTime(v, t + at); g.gain.setTargetAtTime(0, t + at + 0.005, 0.02);
      s.start(t + at, Math.random()); s.stop(t + at + 0.1);
    }
  }

  /** Eating: a few soft crunches. */
  munch() {
    const ctx = this.ctx, t = ctx.currentTime;
    for (let k = 0; k < 4; k++) {
      const at = t + k * 0.22 + Math.random() * 0.05, s = ctx.createBufferSource(), g = gain(ctx, 0, this.master);
      s.buffer = this.noise; s.connect(filter(ctx, 'bandpass', 700 + Math.random() * 500, 1.5)).connect(g);
      g.gain.setValueAtTime(0.09, at); g.gain.setTargetAtTime(0, at + 0.01, 0.04);
      s.start(at, Math.random()); s.stop(at + 0.2);
    }
  }

  /** The stomach growling: a low gurgle that wobbles in pitch. */
  growl() {
    const ctx = this.ctx, t = ctx.currentTime, g = gain(ctx, 0, this.master), lp = filter(ctx, 'lowpass', 220, 4);
    lp.connect(g);
    const o = ctx.createOscillator(), wob = ctx.createOscillator(), wg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 70; wob.frequency.value = 7; wg.gain.value = 25;
    wob.connect(wg).connect(o.frequency); o.connect(lp);
    o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(45, t + 1.1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.15); g.gain.setTargetAtTime(0, t + 0.8, 0.2);
    o.start(t); wob.start(t); o.stop(t + 1.6); wob.stop(t + 1.6);
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

  /** A music file from the SD card, decoded (rejects what the browser cannot read). */
  decode(data: ArrayBuffer) { return this.ctx.decodeAudioData(data); }

  toggleMute() {
    this.muted = !this.muted;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    // muting cuts at once (no blip of the intro when it starts muted); unmuting fades in
    if (this.muted) this.master.gain.setValueAtTime(0, this.ctx.currentTime);
    else this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.05);
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
  traffic(cars: Car[], events: EventLog, x: number, y: number, yaw: number, wet: number, tick: number, people: { x: number; y: number; id: number; use: number }[] = []) {
    const now = this.ctx.currentTime, rx = -Math.sin(yaw), ry = Math.cos(yaw);
    // passers-by's phones: a ringing one plays its tune (each their own of the handsets' tunes),
    // someone texting close by clicks the keys
    let texting = 0;
    for (const p of people) {
      if (!p.use) { this.pedRings.delete(p.id); continue; }
      const d = Math.hypot(p.x - x, p.y - y);
      if (p.use === 2 && d < PED_KEYS_R) texting = Math.max(texting, 1 - d / PED_KEYS_R);
      if (p.use !== 3 || d > PED_RING_R) continue;
      const due = this.pedRings.get(p.id);
      if (due !== undefined && due > now) continue;
      const pn = ((p.x - x) * rx + (p.y - y) * ry) / (d || 1);
      this.pedRings.set(p.id, now + this.pedRing(p.id % 5, (1 - d / PED_RING_R) ** 1.6, pn));
    }
    if (this.pedRings.size > 200) this.pedRings.clear();
    if (texting && now > this.nextKey) { this.burst(now, 0.015, 0.05 * texting, 0, 3800, 'bandpass', 3); this.nextKey = now + 0.12 + Math.random() * 0.35; }
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
      // help is on its way: a siren to it, a minute or so later
      if (d < SIREN_R && Math.random() < 0.7) this.sirensDue.push([now + 25 + Math.random() * 50, e.x, e.y]);
    }
  }

  /** One loop of a passer-by's ringtone (k: one of five little tunes), at v, panned; returns how long until it plays again. */
  private pedRing(k: number, v: number, pan: number): number {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02, p = ctx.createStereoPanner(), out = gain(ctx, v * 0.6, p);
    p.pan.value = pan * 0.8; p.connect(this.out);
    const m = (n: number) => 440 * 2 ** ((n - 69) / 12);
    const tunes: [number, number, number][][] = [
      [[76, 0, 0.12], [72, 0.15, 0.12], [76, 0.3, 0.12], [79, 0.45, 0.25]],
      [[84, 0, 0.08], [88, 0.1, 0.08], [84, 0.2, 0.08], [88, 0.3, 0.08], [84, 0.4, 0.08], [88, 0.5, 0.08]],
      [[67, 0, 0.2], [71, 0.22, 0.2], [74, 0.44, 0.2], [79, 0.66, 0.35]],
      [[81, 0, 0.5], [77, 0.5, 0.5]],
      [[72, 0, 0.1], [72, 0.15, 0.1], [79, 0.3, 0.1], [79, 0.45, 0.1], [81, 0.6, 0.1], [79, 0.75, 0.2]],
    ];
    let end = 0;
    for (const [n, at, len] of tunes[k]) {
      const o = ctx.createOscillator(), g = gain(ctx, 0, out);
      o.type = k === 3 ? 'triangle' : 'square'; o.frequency.value = m(n);
      o.connect(filter(ctx, 'lowpass', 3000, 0.7)).connect(g);
      g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(0.03, t0 + at + 0.01); g.gain.setValueAtTime(0.03, t0 + at + len - 0.02); g.gain.linearRampToValueAtTime(0, t0 + at + len);
      o.start(t0 + at); o.stop(t0 + at + len + 0.02);
      end = Math.max(end, at + len);
    }
    return end + 0.6;
  }

  /** A car going by somewhere off in the streets: a soft rise and fall of road noise, panned across. */
  private passBy(t: number, v: number, pan: number) {
    const ctx = this.ctx, s = ctx.createBufferSource(), p = ctx.createStereoPanner(), g = gain(ctx, 0, p), lp = filter(ctx, 'lowpass', 500, 0.8);
    const len = 2.5 + Math.random() * 3;
    p.pan.setValueAtTime(pan, t); p.pan.linearRampToValueAtTime(-pan * 0.6, t + len); p.connect(this.out);
    s.buffer = this.noise; s.connect(lp).connect(g);
    lp.frequency.setValueAtTime(300, t); lp.frequency.linearRampToValueAtTime(700, t + len / 2); lp.frequency.linearRampToValueAtTime(260, t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + len / 2); g.gain.linearRampToValueAtTime(0, t + len);
    s.start(t, Math.random() * 1.5); s.stop(t + len + 0.05);
  }

  /** The earphones in or out: the world's sounds (not the phone's music) muffled and lowered while in. */
  earphones(on: boolean) {
    if (on === this.earsOn) return;
    this.earsOn = on;
    const t = this.ctx.currentTime;
    this.ears.frequency.setTargetAtTime(on ? 1800 : 20000, t, 0.08);
    this.earsGain.gain.setTargetAtTime(on ? 0.4 : 1, t, 0.08);
  }
  /** A siren far off: the wail (or the yelp) of an emergency vehicle rising out of the city and fading, dulled by the buildings. */
  private siren(t: number, v: number, pan: number) {
    const ctx = this.ctx, p = ctx.createStereoPanner(), g = gain(ctx, 0, p), lp = filter(ctx, 'lowpass', 1600, 0.7), o = ctx.createOscillator();
    const len = 10 + Math.random() * 10, yelp = Math.random() < 0.35;
    p.pan.setValueAtTime(pan, t); p.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, pan + (Math.random() - 0.5))), t + len); p.connect(this.out);
    o.type = 'sawtooth'; o.connect(lp).connect(g);
    // a wail sweeps up and down in about 4 s; a yelp in a third of a second
    const per = yelp ? 0.32 : 4.2;
    for (let a = 0; a < len; a += per) { o.frequency.setValueAtTime(650, t + a); o.frequency.linearRampToValueAtTime(1350, t + a + per * 0.55); o.frequency.linearRampToValueAtTime(650, t + a + per); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + len * 0.45); g.gain.linearRampToValueAtTime(v * 0.8, t + len * 0.6); g.gain.linearRampToValueAtTime(0, t + len);
    o.start(t); o.stop(t + len + 0.05);
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
    const ctx = this.ctx, p = ctx.createStereoPanner(), g = gain(ctx, 0, p), o = ctx.createOscillator();
    p.pan.value = pan; p.connect(this.out);
    // the hit itself: a dull body thump (a low sine falling fast, no ring) and the bang of the impact
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.12); o.connect(g);
    g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.18);
    o.start(t); o.stop(t + 0.22);
    this.burst(t, 0.22, 0.8 * v, pan, 220, 'lowpass', 0.7);
    this.burst(t, 0.07, 0.35 * v, pan, 1200, 'lowpass', 0.7);
    // the crumple: a short rattle of low-mid bursts
    for (let k = 0; k < 5; k++) this.burst(t + 0.02 + k * 0.03 + Math.random() * 0.02, 0.05, 0.18 * v * (1 - k / 6), pan, 350 + Math.random() * 500, 'bandpass', 1.2);
    // glass: a few bright noise ticks (noise, not tones, so it never rings like a bell)
    for (let k = 0; k < 5; k++) this.burst(t + 0.05 + Math.random() * 0.25, 0.03, 0.05 * v, Math.max(-1, Math.min(1, pan + (Math.random() - 0.5) * 0.4)), 5000, 'highpass', 0.7);
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
        this.nextDrop += -Math.log(1 - Math.random()) / (6 + rain * 60);
      }
    }
    this.tubes.gain.setTargetAtTime(indoors ? 0.012 * tubes : 0, now, 0.1);
    // the wind: stronger with its speed and in a storm, in gusts; a whistle when it blows hard
    const ws = Math.hypot(w.windX, w.windY), gust = 0.55 + 0.45 * Math.sin(sec * 0.7) * Math.sin(sec * 0.23 + 1.3) + 0.15 * Math.sin(sec * 2.9);
    const wk = Math.max(0, Math.min(1, (ws - 3) / 12)) * (1 + 1.2 * rain) * Math.max(0.15, gust);
    this.wind.gain.setTargetAtTime(0.22 * wk, now, 0.3);
    this.windLp.frequency.setTargetAtTime(250 + 600 * wk, now, 0.3);
    this.whistle.gain.setTargetAtTime(0.03 * Math.max(0, wk - 0.5), now, 0.4);
    this.whistleBp.frequency.setTargetAtTime(600 + 500 * gust, now, 0.5);
    this.rain.gain.setTargetAtTime(0.28 * Math.min(1, rain * 1.4), now, 0.4);
    this.rainLow.gain.setTargetAtTime(0.35 * Math.max(0, rain - 0.4), now, 0.6);
    // falling and lying snow muffle the city
    this.city.gain.setTargetAtTime(0.35 * (1 - 0.6 * Math.max(w.snow ? w.precip : 0, w.snowCover)) * (1 - 0.55 * this.hush), now, 1);
    this.hush = grid.subs.some((s) => !s.on && Math.hypot(s.x - x, s.y - y) < 700) ? 1 : 0;
    if (bolt >= 0 && bolt !== this.lastBolt) { this.lastBolt = bolt; this.thunder(1 + ((bolt * 7919) % 50) / 10); }
    // screen-right direction, for panning
    const rx = -Math.sin(yaw), ry = Math.cos(yaw);
    const pan = (px: number, py: number) => { const d = Math.hypot(px - x, py - y) || 1; return ((px - x) * rx + (py - y) * ry) / d; };

    // the grid: a substation switching within earshot is heard, late by the speed of sound; several
    // thrown together (the same tick, from the same spot) are one sound, not a pile of them
    const heard = new Set<string>();
    grid.subs.forEach((s, k) => {
      if (this.seen[k] === undefined) { this.seen[k] = s.changed; return; }
      if (s.changed === this.seen[k]) return;
      this.seen[k] = s.changed;
      const key = `${s.changed}|${s.ox}|${s.oy}|${s.on}`;
      if (heard.has(key)) return;
      heard.add(key);
      // heard from where it was thrown (for now, where the player is)
      const d = Math.hypot(s.ox - x, s.oy - y);
      if (d > 1400) return;
      const g = (1 - d / 1400) ** 1.3, at = now + d / 343, pn = pan(s.ox, s.oy) * 0.6;
      const egg = s.on ? this.egg.up : this.egg.down;
      if (egg) this.playEgg(egg, at, g, pn);
      else if (!s.on) blackout(this.kit, at, g, pn);
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

    // far off: cars going by on the other streets now and then (fewer at night), and sirens: to the
    // crashes, and once in a while one from somewhere in the city
    if (now > this.nextPass) {
      const busy = 0.35 + 0.65 * day;
      if (this.nextPass > 0) this.passBy(now, 0.05 + Math.random() * 0.05, (Math.random() - 0.5) * 1.6);
      this.nextPass = now + (2 + Math.random() * 6) / busy;
    }
    for (let k = this.sirensDue.length - 1; k >= 0; k--) {
      const [at, ex, ey] = this.sirensDue[k];
      if (at > now) continue;
      this.sirensDue.splice(k, 1);
      const d = Math.hypot(ex - x, ey - y);
      this.siren(now, 0.06 * Math.max(0.15, 1 - d / SIREN_R), pan(ex, ey) * 0.7);
    }
    if (now > this.nextSiren) {
      if (this.nextSiren > 0) this.siren(now, 0.015 + Math.random() * 0.02, (Math.random() - 0.5) * 1.6);
      this.nextSiren = now + 90 + Math.random() * 180;
    }

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
