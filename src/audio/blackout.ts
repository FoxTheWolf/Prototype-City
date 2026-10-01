/**
 * The sounds of the power grid, all synthesized: a substation going down (two versions to compare,
 * A after the analysed recipe in docs/blackout-som-receita.md, B our own take), the power coming
 * back, and the odd relay or transformer fighting back in the dark.
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

/** One short burst of filtered noise: an arc, a glitch, a click. */
function burst(K: Kit, t: number, f: number, q: number, dur: number, peak: number, pan: number, verb: number, dist = false) {
  const p = panner(K, pan, K.out);
  const g = env(K, t, [[0.002, peak], [dur, 0]], p);
  if (verb) { const s = K.ctx.createGain(); s.gain.value = verb; g.connect(s); s.connect(K.reverb); }
  let into: AudioNode = g;
  if (dist) { const sh = shaper(K.ctx, 5); sh.connect(g); into = sh; }
  const b = filt(K, 'bandpass', f, q, into);
  b.frequency.setValueAtTime(f, t);
  b.frequency.linearRampToValueAtTime(f * (0.8 + Math.random() * 0.4), t + dur);
  noiseSrc(K, t, t + dur + 0.02, b);
}

/**
 * A: after the recipe. A saturated sub and a power drone gliding down ~121 -> 82 Hz (B2 to E2)
 * through a resonant low-pass; a band-passed noise body; short arc bursts around 0.7-1.8 kHz (most
 * near 1.2 kHz), few at first and many later; clicks up to 5 kHz; a short dark reverb on the
 * middle layers only; a last hard re-strike of the low end at 55-80 Hz, then a fast cut. ~12 s.
 */
export function blackoutA(K: Kit, t0: number, gain: number, pan: number) {
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
    burst(K, t0 + t, f, 5 + Math.random() * 5, 0.02 + Math.random() * 0.1, 0.32 * gain, pan + (Math.random() - 0.5) * 0.8, 0.4, true);
  }
  for (let k = 0; k < 28; k++) {
    const t = k < 22 ? 3 + Math.random() ** 0.6 * 8.6 : 11.6 + Math.random() * 0.4;
    burst(K, t0 + t, 1500 + Math.random() * 3500, 3, 0.002 + Math.random() * 0.006, 0.25 * gain, pan + (Math.random() - 0.5) * 0.9, 0.2);
  }
}

/**
 * B: our own take on a transformer dying in the street: a deep thump and a crack as it blows, an
 * arc buzzing up in pitch until it snaps off, relays clattering down the line, the mains hum winding
 * down to nothing, and other transformers going a little further off.
 */
export function blackoutB(K: Kit, t0: number, gain: number, pan: number) {
  const out = panner(K, pan * 0.5, K.out);
  const g = (v: number) => v * gain;
  // the blow: thump, crack, and a low boom rolling off
  osc(K, 'sine', t0, t0 + 0.7, [[0, 58], [0.25, 28]], env(K, t0, [[0.01, g(0.9)], [0.6, 0]], out));
  burst(K, t0, 2200, 1, 0.12, g(0.7), pan, 0.5);
  noiseSrc(K, t0, t0 + 1.6, filt(K, 'lowpass', 150, 0.7, env(K, t0, [[0.02, g(0.6)], [1.5, 0]], out)));
  // the arc: a buzzing saw climbing, stuttering, cut dead
  const arcG = env(K, t0, [[0.05, g(0.25)], [1.3, g(0.35)], [1.32, 0]], out);
  for (let k = 0; k < 18; k++) arcG.gain.setValueAtTime(g(0.08 + Math.random() * 0.32), t0 + 0.06 + k * 0.07);
  arcG.gain.setValueAtTime(0, t0 + 1.32);
  const arcF = filt(K, 'bandpass', 900, 2, arcG);
  const sh = shaper(K.ctx, 6); sh.connect(arcF);
  osc(K, 'sawtooth', t0, t0 + 1.4, [[0, 120], [1.3, 260]], sh);
  for (let k = 0; k < 15; k++) burst(K, t0 + Math.random() * 1.3, 2500 + Math.random() * 2500, 2, 0.004, g(0.3), pan + (Math.random() - 0.5), 0.2);
  // the hum winding down
  const humG = env(K, t0, [[0.05, g(0.3)], [4.5, 0]], out);
  osc(K, 'sine', t0, t0 + 4.6, [[0, 120], [4.5, 25]], humG);
  const h2 = K.ctx.createGain(); h2.gain.value = 0.4; h2.connect(humG);
  osc(K, 'sine', t0, t0 + 4.6, [[0, 240], [4.5, 50]], h2);
  // relays clattering, and other transformers further off
  for (let k = 0; k < 12; k++) burst(K, t0 + 0.2 + Math.random() * 2.3, 3000, 8, 0.006, g(0.45), (Math.random() - 0.5) * 1.8, 0.3);
  for (const t of [1.2, 2.3, 3.4]) noiseSrc(K, t0 + t, t0 + t + 1.2, filt(K, 'lowpass', 120, 0.7, env(K, t0 + t, [[0.02, g(0.25)], [1, 0]], panner(K, (Math.random() - 0.5) * 1.6, K.out))));
}

/** The power back: a heavy contactor closing, a few relays, the hum swelling up to pitch. */
export function restore(K: Kit, t0: number, gain: number, pan: number) {
  const out = panner(K, pan * 0.5, K.out);
  osc(K, 'sine', t0, t0 + 0.3, [[0, 70], [0.2, 45]], env(K, t0, [[0.01, 0.7 * gain], [0.25, 0]], out));
  burst(K, t0, 1800, 2, 0.05, 0.35 * gain, pan, 0.4);
  for (let k = 0; k < 5; k++) burst(K, t0 + 0.1 + Math.random() * 0.8, 3000, 8, 0.006, 0.35 * gain, (Math.random() - 0.5) * 1.6, 0.3);
  const humG = env(K, t0, [[0.6, 0.22 * gain], [2.4, 0.12 * gain], [3.2, 0]], out);
  osc(K, 'sine', t0, t0 + 3.3, [[0, 60], [1.8, 120]], humG);
}

/** In the dark, now and then: a relay snapping, a transformer buzzing in a stutter, a low thump. */
export function darkEvent(K: Kit, t0: number, pan: number) {
  const r = Math.random(), g = 0.25 + Math.random() * 0.25;
  if (r < 0.45) { burst(K, t0, 3000, 8, 0.006, g, pan, 0.3); burst(K, t0 + 0.05 + Math.random() * 0.1, 2600, 8, 0.005, g * 0.7, pan, 0.3); }
  else if (r < 0.8) {
    const bg = env(K, t0, [[0.02, g * 0.6], [0.3, g * 0.4], [0.32, 0]], panner(K, pan, K.out));
    for (let k = 0; k < 6; k++) bg.gain.setValueAtTime(Math.random() < 0.5 ? 0 : g * 0.5, t0 + 0.03 + k * 0.045);
    bg.gain.setValueAtTime(0, t0 + 0.33);
    const sh = shaper(K.ctx, 5); sh.connect(filt(K, 'bandpass', 900, 2, bg));
    osc(K, 'sawtooth', t0, t0 + 0.35, [[0, 120], [0.3, 118]], sh);
  } else osc(K, 'sine', t0, t0 + 0.5, [[0, 50], [0.4, 32]], env(K, t0, [[0.01, g * 1.2], [0.45, 0]], panner(K, pan, K.out)));
}
