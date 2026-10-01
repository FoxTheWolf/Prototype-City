/**
 * The sounds of the power grid, all synthesized: a substation going down (after the analysed recipe
 * in docs/blackout-som-receita.md; the user picked it over our own take), the power coming back, and
 * the odd relay or transformer fighting back in the dark.
 */

/** Shared pieces: the noise buffer and a short dark reverb. */
export class Kit {
  readonly reverb: ConvolverNode;
  constructor(readonly ctx: AudioContext, readonly out: AudioNode, readonly noise: AudioBuffer) {
    // a 0.7 s dark tail: decaying noise, low-passed by a running average
    const n = Math.floor(ctx.sampleRate * 0.7), ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.08; d[i] = lp * Math.exp((-4 * i) / n) * 3; }
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    this.reverb.connect(out);
  }
}

function shaper(ctx: AudioContext, k: number) {
  const w = ctx.createWaveShaper(), c = new Float32Array(1024);
  for (let i = 0; i < c.length; i++) { const x = (i / (c.length - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  w.curve = c;
  return w;
}

/** A gain node with an envelope of [time, value] points (linear between them), into `to`. */
function env(K: Kit, t0: number, pts: [number, number][], to: AudioNode): GainNode {
  const g = K.ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  for (const [t, v] of pts) g.gain.linearRampToValueAtTime(v, t0 + t);
  g.connect(to);
  return g;
}

function panner(K: Kit, p: number, to: AudioNode) {
  const s = K.ctx.createStereoPanner();
  s.pan.value = Math.max(-1, Math.min(1, p));
  s.connect(to);
  return s;
}

function osc(K: Kit, type: OscillatorType, t0: number, t1: number, freq: [number, number][], to: AudioNode) {
  const o = K.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq[0][1], t0);
  for (const [t, f] of freq) o.frequency.linearRampToValueAtTime(f, t0 + t);
  o.connect(to);
  o.start(t0); o.stop(t1);
  return o;
}

function noiseSrc(K: Kit, t0: number, t1: number, to: AudioNode) {
  const s = K.ctx.createBufferSource();
  s.buffer = K.noise; s.loop = true;
  s.connect(to);
  // start at a random point of the buffer, so bursts do not repeat
  s.start(t0, Math.random() * 1.5); s.stop(t1);
}

function filt(K: Kit, type: BiquadFilterType, f: number, q: number, to: AudioNode) {
  const b = K.ctx.createBiquadFilter();
  b.type = type; b.frequency.value = f; b.Q.value = q;
  b.connect(to);
  return b;
}

/**
 * An electric sizzle: broad band-passed noise chopped in a fast irregular stutter, so it crackles
 * like an arc instead of ringing (narrow, short bursts rang like billiard balls knocking).
 */
function sizzle(K: Kit, t: number, f: number, dur: number, peak: number, pan: number, verb: number) {
  const p = panner(K, pan, K.out);
  const g = env(K, t, [[0.004, peak], [dur * 0.7, peak * 0.6], [dur, 0]], p);
  for (let k = 0; k < dur / 0.012; k++) g.gain.setValueAtTime(Math.random() < 0.45 ? 0 : peak * (0.3 + Math.random() * 0.7), t + 0.004 + k * 0.012);
  g.gain.setValueAtTime(0, t + dur);
  if (verb) { const s = K.ctx.createGain(); s.gain.value = verb; g.connect(s); s.connect(K.reverb); }
  const sh = shaper(K.ctx, 3); sh.connect(g);
  noiseSrc(K, t, t + dur + 0.02, filt(K, 'bandpass', f, 1.4, sh));
}

/** A dry click: a millisecond of high-passed noise, no pitch to it. */
function tick(K: Kit, t: number, peak: number, pan: number, verb: number) {
  const p = panner(K, pan, K.out);
  const g = env(K, t, [[0.0005, peak], [0.0025, 0]], p);
  if (verb) { const s = K.ctx.createGain(); s.gain.value = verb; g.connect(s); s.connect(K.reverb); }
  noiseSrc(K, t, t + 0.01, filt(K, 'highpass', 2500, 0.7, g));
}

/**
 * After the recipe. A saturated sub and a power drone gliding down ~121 -> 82 Hz (B2 to E2)
 * through a resonant low-pass; a band-passed noise body; short arc bursts around 0.7-1.8 kHz (most
 * near 1.2 kHz), few at first and many later; clicks up to 5 kHz; a short dark reverb on the
 * middle layers only; a last hard re-strike of the low end at 55-80 Hz, then a fast cut. ~12 s.
 */
export function blackout(K: Kit, t0: number, gain: number, pan: number) {
  const out = K.ctx.createGain();
  out.gain.value = 0.9 * gain;
  out.connect(K.out);
  const end = t0 + 12;
  // [1] sub
  const subG = env(K, t0, [[0.35, 0.5], [6, 0.38], [11.1, 0.3], [11.25, 0.75], [11.95, 0.6], [12, 0]], out);
  const subSat = shaper(K.ctx, 2); subSat.connect(filt(K, 'lowpass', 220, 0.7, subG));
  osc(K, 'sine', t0, end, [[0, 110], [11.1, 60], [11.2, 80], [11.95, 55]], subSat);
  // [2] main drone: triangle plus a weaker saw an octave down, resonant low-pass, distortion
  const droneG = env(K, t0, [[0.3, 0.22], [0.8, 0.45], [2, 0.3], [10, 0.2], [11.2, 0.38], [11.95, 0.3], [12, 0]], out);
  const dsat = shaper(K.ctx, 4); dsat.connect(droneG);
  const lp = filt(K, 'lowpass', 420, 7, dsat);
  const glide: [number, number][] = [[0, 126], [0.9, 121], [3, 112], [5, 102], [7, 94], [9, 86], [11, 82], [11.2, 80], [11.95, 70]];
  osc(K, 'triangle', t0, end, glide, lp);
  const sub2 = K.ctx.createGain(); sub2.gain.value = 0.3; sub2.connect(lp);
  osc(K, 'sawtooth', t0, end, glide.map(([t, f]) => [t, f / 2] as [number, number]), sub2);
  // [3] electrical body
  const bodyG = env(K, t0, [[0.5, 0.22], [6, 0.14], [11, 0.08], [12, 0]], out);
  const bv = K.ctx.createGain(); bv.gain.value = 0.35; bodyG.connect(bv); bv.connect(K.reverb);
  noiseSrc(K, t0, end, filt(K, 'bandpass', 300, 0.9, bodyG));
  // [4] arcs and digital glitches, [5] high clicks: irregular, sparse first, thick in the second half
  for (let k = 0; k < 26; k++) {
    const t = k < 5 ? 0.8 + Math.random() * 4.7 : 5.5 + Math.random() * 6.3;
    const f = Math.random() < 0.6 ? 1100 + Math.random() * 200 : 700 + Math.random() * 1100;
    sizzle(K, t0 + t, f, 0.05 + Math.random() * 0.15, 0.3 * gain, pan + (Math.random() - 0.5) * 0.8, 0.4);
  }
  for (let k = 0; k < 28; k++) {
    const t = k < 22 ? 3 + Math.random() ** 0.6 * 8.6 : 11.6 + Math.random() * 0.4;
    tick(K, t0 + t, 0.2 * gain, pan + (Math.random() - 0.5) * 0.9, 0.2);
  }
}

/** The power back: a heavy contactor closing, a few relays, the hum swelling up to pitch. */
export function restore(K: Kit, t0: number, gain: number, pan: number) {
  const out = panner(K, pan * 0.5, K.out);
  osc(K, 'sine', t0, t0 + 0.3, [[0, 70], [0.2, 45]], env(K, t0, [[0.01, 0.7 * gain], [0.25, 0]], out));
  sizzle(K, t0, 1800, 0.08, 0.3 * gain, pan, 0.4);
  for (let k = 0; k < 5; k++) tick(K, t0 + 0.1 + Math.random() * 0.8, 0.3 * gain, (Math.random() - 0.5) * 1.6, 0.3);
  const humG = env(K, t0, [[0.6, 0.22 * gain], [2.4, 0.12 * gain], [3.2, 0]], out);
  osc(K, 'sine', t0, t0 + 3.3, [[0, 60], [1.8, 120]], humG);
}

/** In the dark, now and then: a relay snapping, a transformer buzzing in a stutter, a low thump. */
export function darkEvent(K: Kit, t0: number, pan: number) {
  const r = Math.random(), g = 0.25 + Math.random() * 0.25;
  if (r < 0.45) { tick(K, t0, g, pan, 0.3); tick(K, t0 + 0.05 + Math.random() * 0.1, g * 0.7, pan, 0.3); }
  else if (r < 0.8) {
    const bg = env(K, t0, [[0.02, g * 0.6], [0.3, g * 0.4], [0.32, 0]], panner(K, pan, K.out));
    for (let k = 0; k < 6; k++) bg.gain.setValueAtTime(Math.random() < 0.5 ? 0 : g * 0.5, t0 + 0.03 + k * 0.045);
    bg.gain.setValueAtTime(0, t0 + 0.33);
    const sh = shaper(K.ctx, 5); sh.connect(filt(K, 'bandpass', 900, 2, bg));
    osc(K, 'sawtooth', t0, t0 + 0.35, [[0, 120], [0.3, 118]], sh);
  } else osc(K, 'sine', t0, t0 + 0.5, [[0, 50], [0.4, 32]], env(K, t0, [[0.01, g * 1.2], [0.45, 0]], panner(K, pan, K.out)));
}
