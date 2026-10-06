import { compile, type Song, type Track } from './tracks';

/**
 * The phone's music (15.9b): the chiptune songs of tracks.ts played on four voices as an old console's
 * (a pulse lead, a thinner pulse arpeggio, a triangle bass, noise drums), or a decoded file from the SD
 * card, and where it comes out:
 * - `phones`: earphones, in stereo, for the player alone: the cheap earbuds of 2008 (thin lows, a
 *   presence bump, the top rolled off) on a 128 kbps MP3 (nothing above ~16 kHz), 2026-10-06;
 * - `hand`: the phone's own little speaker, mono, no bass, a little harsh where it rattles;
 * - `pocket`: the same speaker muffled by the cloth.
 * The songs are scheduled a little ahead of the audio clock, a step at a time, as a tracker plays them.
 */
export type Route = 'phones' | 'hand' | 'pocket';

const AHEAD = 0.25;
/** Each voice's level in the mix. */
const VOL = { lead: 0.15, arp: 0.055, bass: 0.2, kick: 0.4, snare: 0.18, hat: 0.06 };
const hz = (n: number) => 440 * 2 ** ((n - 69) / 12);

export class Music {
  /** What plays (null: nothing loaded); paused keeps the place. */
  private song: Song | null = null;
  private buf: AudioBuffer | null = null;
  private paused = true;
  /** Where in the song (a step, or seconds in a file), when it was last set. */
  private from = 0;
  /** The audio clock when `from` was, for the current session. */
  private t0 = 0;
  private ev = 0;
  /** The session's own gain: dropped (and left to the collector) on pause, stop or a new song. */
  private sess: GainNode | null = null;
  private src: AudioBufferSourceNode | null = null;
  private voices: { lead: AudioNode; arp: AudioNode; bass: AudioNode; drum: AudioNode } | null = null;
  private waves = new Map<number, PeriodicWave>();
  private readonly noise: AudioBuffer;
  private readonly bus: GainNode;
  private readonly phones: GainNode;
  private readonly speaker: GainNode;
  private readonly cloth: BiquadFilterNode;
  private readonly vol: GainNode;
  /** The spectrum the phone's visualizer draws, read before the volume (it dances the same at any level). */
  private readonly an: AnalyserNode;
  private readonly bins: Uint8Array<ArrayBuffer>;
  /** True once a song or a file reached its end (the player takes the next one and clears it). */
  ended = false;

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.vol = ctx.createGain(); this.vol.connect(dest);
    this.bus = ctx.createGain();
    // a 128 kbps MP3 of the time cut everything above about 16 kHz (steeply: two filters)
    const mp3a = biquad(ctx, 'lowpass', 16000, 0.7), mp3b = biquad(ctx, 'lowpass', 16000, 0.7);
    this.bus.connect(mp3a).connect(mp3b);
    this.an = ctx.createAnalyser(); this.an.fftSize = 1024; this.an.smoothingTimeConstant = 0.6;
    this.bins = new Uint8Array(this.an.frequencyBinCount);
    mp3b.connect(this.an);
    // the earbuds: little drivers that lose the lowest bass, a bump where the voice sits, the top soft
    const bud = [biquad(ctx, 'highpass', 90, 0.6), biquad(ctx, 'peaking', 3200, 1.1, 3), biquad(ctx, 'highshelf', 9000, 0.7, -5)];
    this.phones = ctx.createGain();
    bud.reduce<AudioNode>((a, b) => a.connect(b), mp3b).connect(this.phones).connect(this.vol);
    // the speaker: mono, the lows gone (it is a centimetre wide), a resonance where it rattles, a soft clip, and the cloth over it
    const mono = ctx.createGain();
    mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
    const hp = biquad(ctx, 'highpass', 650, 0.9), peak = biquad(ctx, 'peaking', 2600, 1.4, 7), lp = biquad(ctx, 'lowpass', 6500, 0.7);
    const clip = ctx.createWaveShaper();
    const c = new Float32Array(1024);
    for (let i = 0; i < c.length; i++) { const x = (i / (c.length - 1)) * 2 - 1; c[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
    clip.curve = c;
    this.cloth = biquad(ctx, 'lowpass', 20000, 0.7);
    this.speaker = ctx.createGain();
    mp3b.connect(mono).connect(hp).connect(peak).connect(lp).connect(clip).connect(this.cloth).connect(this.speaker).connect(this.vol);
    const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = n;
    this.route('phones', 0.7);
  }

  /** Where it comes out, and the player's volume (0..1). */
  route(r: Route, v: number) {
    const t = this.ctx.currentTime;
    this.phones.gain.setTargetAtTime(r === 'phones' ? 1 : 0, t, 0.02);
    this.speaker.gain.setTargetAtTime(r === 'phones' ? 0 : r === 'hand' ? 0.55 : 0.4, t, 0.02);
    this.cloth.frequency.setTargetAtTime(r === 'pocket' ? 1300 : 20000, t, 0.05);
    this.vol.gain.setTargetAtTime(v * v, t, 0.03);
  }

  /**
   * The visualizer's bars (2026-10-06): n bands from ~60 Hz to ~11 kHz, spaced as the ear hears
   * (log), each 0..1; all 0 when nothing plays.
   */
  spectrum(out: Float32Array) {
    const n = out.length;
    if (!this.playing) { out.fill(0); return; }
    this.an.getByteFrequencyData(this.bins);
    const hzBin = this.ctx.sampleRate / this.an.fftSize;
    for (let k = 0; k < n; k++) {
      const f0 = 60 * (11000 / 60) ** (k / n), f1 = 60 * (11000 / 60) ** ((k + 1) / n);
      let a = Math.max(1, Math.floor(f0 / hzBin)), b = Math.max(a + 1, Math.ceil(f1 / hzBin)), m = 0;
      for (let i = a; i < b && i < this.bins.length; i++) m = Math.max(m, this.bins[i]);
      // the analyser's floor sits around 40 of 255 in quiet parts
      out[k] = Math.max(0, Math.min(1, (m - 60) / 170));
    }
  }

  /** Load a song (or a decoded file) and play it from its start. */
  play(what: Track | AudioBuffer) {
    this.drop();
    this.song = what instanceof AudioBuffer ? null : compile(what);
    this.buf = what instanceof AudioBuffer ? what : null;
    this.from = 0; this.ended = false;
    this.paused = true;
    this.resume();
  }
  get playing() { return !this.paused && (!!this.song || !!this.buf); }
  /** Seconds into it, and how long it is. */
  get at() {
    if (this.paused) return this.song ? this.from * this.song.stepS : this.from;
    return (this.song ? this.from * this.song.stepS : this.from) + Math.max(0, this.ctx.currentTime - this.t0);
  }
  get length() { return this.song ? this.song.steps * this.song.stepS : this.buf?.duration ?? 0; }

  pause() {
    if (this.paused) return;
    const s = this.at;
    this.drop();
    this.from = this.song ? Math.floor(s / this.song.stepS) : s;
    this.paused = true;
  }
  resume() {
    if (!this.paused || this.ended || (!this.song && !this.buf)) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.03;
    this.paused = false; this.t0 = t;
    this.sess = ctx.createGain(); this.sess.connect(this.bus);
    if (this.buf) {
      const s = (this.src = ctx.createBufferSource());
      s.buffer = this.buf; s.connect(this.sess);
      s.onended = () => { if (this.src === s && !this.paused) { this.ended = true; this.drop(); this.paused = true; this.from = 0; } };
      s.start(t, this.from);
      return;
    }
    // the four voices, a little apart in the earphones (the speaker sums them back to one)
    const pan = (p: number) => { const n = ctx.createStereoPanner(); n.pan.value = p; n.connect(this.sess!); return n; };
    this.voices = { lead: pan(0.05), arp: pan(0.35), bass: pan(0), drum: pan(-0.2) };

    const S = this.song!;
    this.ev = S.events.findIndex((e) => e.at >= this.from);
    if (this.ev < 0) this.ev = S.events.length;
  }
  stop() { this.drop(); this.song = null; this.buf = null; this.paused = true; this.from = 0; }

  /** Every frame: schedules the steps coming up. */
  update() {
    const S = this.song;
    if (this.paused || !S || !this.voices) return;
    const ctx = this.ctx, until = ctx.currentTime + AHEAD;
    const stepT = (k: number) => this.t0 + (k - this.from) * S.stepS;
    while (this.ev < S.events.length && stepT(S.events[this.ev].at) < until) {
      const e = S.events[this.ev++], t = Math.max(ctx.currentTime, stepT(e.at)), len = e.len * S.stepS;
      if (e.ch === 'drum') this.drum(e.d!, t);
      else this.note(e.ch, e.n, t, len, S.track.lead);
    }
    if (this.ev >= S.events.length && ctx.currentTime > stepT(S.steps)) { this.ended = true; this.drop(); this.paused = true; this.from = 0; }
  }

  private drop() {
    const s = this.sess;
    if (s) { s.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01); setTimeout(() => s.disconnect(), 120); }
    try { this.src?.stop(); } catch { /* not started */ }
    this.sess = null; this.src = null; this.voices = null;
  }

  /** A pulse of this duty, bandlimited (its first 48 harmonics). */
  private pulse(duty: number) {
    let w = this.waves.get(duty);
    if (!w) {
      const N = 48, re = new Float32Array(N), im = new Float32Array(N);
      for (let k = 1; k < N; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      w = this.ctx.createPeriodicWave(re, im);
      this.waves.set(duty, w);
    }
    return w;
  }

  private note(ch: 'lead' | 'arp' | 'bass', n: number, t: number, len: number, lead: number | 'tri') {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    if (ch === 'bass' || (ch === 'lead' && lead === 'tri')) o.type = 'triangle';
    else o.setPeriodicWave(this.pulse(ch === 'arp' ? 0.125 : (lead as number)));
    o.frequency.value = hz(n);
    const v = ch === 'lead' ? VOL.lead * (lead === 'tri' ? 1.8 : 1) : VOL[ch];
    // a quick attack, a fall to a sustain, and a short release before the next note
    const sus = ch === 'arp' ? 0.45 : 0.7, end = t + Math.max(0.03, len - 0.012);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.setTargetAtTime(v * sus, t + 0.01, 0.08);
    g.gain.setValueAtTime(v * sus, end - 0.01);
    g.gain.linearRampToValueAtTime(0, end);
    // a long lead note wavers a little once it has sounded a moment
    if (ch === 'lead' && len > 0.45) {
      const lfo = ctx.createOscillator(), d = ctx.createGain();
      lfo.frequency.value = 5.5; d.gain.setValueAtTime(0, t); d.gain.linearRampToValueAtTime(hz(n) * 0.006, t + 0.35);
      lfo.connect(d).connect(o.frequency); lfo.start(t); lfo.stop(end);
    }
    o.connect(g).connect(this.voices![ch]);
    o.start(t); o.stop(end + 0.01);
  }

  private drum(d: string, t: number) {
    const ctx = this.ctx, out = this.voices!.drum;
    if (d === 'k') {
      // a thump: a sine falling fast in pitch
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
      g.gain.setValueAtTime(VOL.kick, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.17);
      return;
    }
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = this.noise;
    const snare = d === 's', open = d === 'o', dur = snare ? 0.13 : open ? 0.22 : 0.04;
    const f = snare ? biquad(ctx, 'bandpass', 1900, 0.8) : biquad(ctx, 'highpass', 7000, 0.7);
    g.gain.setValueAtTime(snare ? VOL.snare : VOL.hat, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.01);
    if (snare) {
      // the snare's body under the rattle
      const o = ctx.createOscillator(), b = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.06);
      b.gain.setValueAtTime(VOL.snare * 0.8, t); b.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(b).connect(out); o.start(t); o.stop(t + 0.09);
    }
  }
}

function biquad(ctx: AudioContext, type: BiquadFilterType, f: number, q: number, g = 0) {
  const b = ctx.createBiquadFilter();
  b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = g;
  return b;
}
