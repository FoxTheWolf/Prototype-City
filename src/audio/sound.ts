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
const ENGINES = 3, ENGINE_R = 45, HORN_R = 120, CRASH_R = 600;

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
  traffic(cars: Car[], events: EventLog, x: number, y: number, yaw: number, wet: number, tick: number) {
    const now = this.ctx.currentTime, rx = -Math.sin(yaw), ry = Math.cos(yaw);
    const pan = (px: number, py: number) => { const d = Math.hypot(px - x, py - y) || 1; return ((px - x) * rx + (py - y) * ry) / d; };
    const near: [number, Car][] = [];
    for (const c of cars) {
      const d = Math.abs(c.x - x) + Math.abs(c.y - y);
      if (d > ENGINE_R * 1.5) continue;
      const e = Math.hypot(c.x - x, c.y - y);
      if (e < ENGINE_R) near.push([e, c]);
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
