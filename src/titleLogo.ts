/**
 * The title's logo (2026-10-08): GRID DOWN: TERMINAL STATE, built as the identity manual builds it
 * (docs/identidade/manual.html, sections 2, 6, 8 and 9: MANUAL = LEI), in the game's own language (section 8:
 * up close, in dots): the GridLink's logo is a sign of bulbs straight on the title's dark, not a card. It plays
 * the manual's opening (~6 s): GRID letter by letter, the stem coming down, LINK, POWER · TELECOM typed; the can
 * shaken, OWN sprayed after the D in paint (not bulbs), LINK scribbled out; then the hum falls and the grid goes
 * down, the sign's bulbs and the console behind going out, TERMINAL STATE lit in amber on its own, and the power
 * flickering back. The sounds are synthesized here. The face is the system's heavy sans (no font file:
 * "tudo é código"), so every place is measured from the letters, as the manual's does.
 */
const C = { grid: [96, 140, 222], link: [44, 178, 166], cyan: [58, 166, 216], spray: '#ff6a13', state: [255, 176, 74] };
const FONT = (s: number) => `900 ${s}px 'Arial Black', Archivo, 'Segoe UI', sans-serif`;
/** The manual's frame (its svg's units: 380 x 200; the caps' baselines and size). */
const W = 380, H = 200, TOP = 80, BOT = 150, SIZE = 60;
/** A bulb's pitch (units): the sign's, and the small lines' (POWER · TELECOM, TERMINAL STATE: at the big pitch
 * their letters came out unreadable); the mask's resolution (pixels a unit). */
const DOT = 3, FINE = 1.25, MK = 3;
/** Where the small lines' fine bulbs take over (units down the frame). */
const FINE_Y = 154;
const clamp = (x: number) => Math.max(0, Math.min(1, x));

/** The logo into `host` (replacing what is there), playing the opening; its sounds unless `mute`; `power`
 * dims the console behind. Click it to play again. */
export function titleLogo(host: HTMLElement, mute: boolean, power: (k: number) => void) {
  host.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  const glow = document.createElement('canvas'), cv = document.createElement('canvas');
  for (const c of [glow, cv]) { c.style.width = '100%'; c.style.display = 'block'; }
  Object.assign(glow.style, { position: 'absolute', inset: '0', filter: 'blur(7px)', opacity: '0.9' });
  wrap.append(glow, cv); host.append(wrap);
  const mask = document.createElement('canvas'); mask.width = W * MK; mask.height = H * MK;
  const mg = mask.getContext('2d', { willReadFrequently: true })!;
  // the places, measured from the letters (the manual's logo(): L under I, the stem at the I's middle third)
  mg.font = FONT(SIZE);
  const gw = [...'GRID'].map((ch) => mg.measureText(ch).width), gx = [34];
  for (let i = 1; i < 4; i++) gx.push(gx[i - 1] + gw[i - 1]);
  const lw = [...'LINK'].map((ch) => mg.measureText(ch).width);
  const sx = gx[2] + gw[2] * 0.5, sw = gw[2] * 0.22, lx0 = sx - lw[0] * 0.28;
  const capT = BOT - SIZE * 0.72, gap = capT - TOP, j1 = TOP + gap * 0.33, j2 = TOP + gap * 0.67, J = 2.5;
  const dEnd = gx[3] + gw[3], linkEnd = lx0 + lw.reduce((a, b) => a + b, 0);
  // the spray's strokes (the manual's own(): O, W, N by hand; the scribble over LINK) and their lengths
  const h = SIZE * 0.72, ow = h * 0.74, og = h * 0.16, oy = TOP - h, ox = dEnd + 6;
  const strokes: { d: string; at: number; len: number; w: number; rot: number; cx: number; cy: number; drip?: number[] }[] = [];
  [
    (x0: number) => `M${x0 + ow / 2} ${oy} C${x0 - 3} ${oy} ${x0 - 3} ${oy + h} ${x0 + ow / 2} ${oy + h} C${x0 + ow + 3} ${oy + h} ${x0 + ow + 3} ${oy} ${x0 + ow / 2 - 3} ${oy + 2}`,
    (x0: number) => `M${x0 - 2} ${oy - 1} L${x0 + ow * 0.2} ${oy + h} L${x0 + ow * 0.5} ${oy + h * 0.3} L${x0 + ow * 0.82} ${oy + h} L${x0 + ow + 3} ${oy - 3}`,
    (x0: number) => `M${x0} ${oy + h} L${x0 + 1} ${oy} L${x0 + ow} ${oy + h} L${x0 + ow + 1} ${oy - 3}`,
  ].forEach((fn, i) => {
    const x0 = ox + i * (ow + og) + (i === 2 ? og : 0);
    strokes.push({ d: fn(x0), at: 3.4 + i * 0.45, len: 0.4, w: h * 0.15, rot: [3, -2, 4][i] * Math.PI / 180, cx: x0 + ow / 2, cy: oy + h / 2,
      drip: i === 1 ? [x0 + ow * 0.2, oy + h, h * 0.3] : i === 2 ? [x0 + ow + 1, oy + h * 0.1, h * 0.45] : undefined });
  });
  const sl = lx0 - 8, sr = linkEnd + 10, mid = BOT - SIZE * 0.36;
  strokes.push({ d: `M${sl + 24} ${mid - 16} Q${(sl + sr) / 2} ${mid - 24} ${sr} ${mid - 12} Q${(sl + sr) / 2} ${mid - 4} ${sl - 6} ${mid + 6} Q${(sl + sr) / 2} ${mid + 2} ${sr - 6} ${mid + 4} Q${(sl + sr) / 2 - 20} ${mid + 18} ${sl + 6} ${mid + 20}`,
    at: 4.8, len: 0.7, w: 4.5, rot: 0, cx: 0, cy: 0, drip: [sl - 5, mid + 8, 12] });
  const meas = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), mp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  meas.style.position = 'absolute'; meas.style.visibility = 'hidden'; meas.append(mp); document.body.append(meas);
  const paths = strokes.map((s) => { mp.setAttribute('d', s.d); return { p: new Path2D(s.d), L: mp.getTotalLength() }; });
  meas.remove();
  // the bulbs' grid over the sign (and TERMINAL STATE's line under it)
  const bulbs: { x: number; y: number; r: number }[] = [];
  for (let y = DOT / 2; y < FINE_Y; y += DOT) for (let x = DOT / 2; x < W; x += DOT) bulbs.push({ x, y, r: DOT * 0.36 });
  for (let y = FINE_Y + FINE / 2; y < H; y += FINE) for (let x = FINE / 2; x < W; x += FINE) bulbs.push({ x, y, r: FINE * 0.4 });

  let t0 = performance.now(), raf = 0, sized = 0;
  /** The bulbs' layer at time t into the mask: what is lit (colors), or (ghost) every bulb the sign has. */
  const drawSign = (t: number, ghost: boolean) => {
    mg.setTransform(MK, 0, 0, MK, 0, 0); mg.clearRect(0, 0, W, H);
    const col = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${ghost ? 1 : a})`;
    mg.font = FONT(SIZE); mg.textBaseline = 'alphabetic';
    for (let i = 0; i < 4; i++) {
      const a = ghost ? 1 : clamp((t - i * 0.22) / 0.3);
      if (a <= 0) continue;
      mg.fillStyle = col(C.grid, a); mg.fillText('GRID'[i], gx[i], TOP + (ghost ? 0 : 6 * (1 - a)));
    }
    // the stem: three pieces with their joints, coming down from the I
    const g = ghost ? 1 : 1 - (1 - clamp((t - 1) / 0.6)) ** 2, yEnd = TOP - 20 + (capT + 18 - (TOP - 20)) * g;
    const piece = (y0: number, y1: number, c: number[]) => { const b = Math.min(y1, yEnd); if (b > y0) { mg.fillStyle = col(c, 1); mg.fillRect(sx - sw, y0, sw * 2, b - y0); } };
    if (g > 0) { piece(TOP - 20, j1, C.grid); piece(j1 + J, j2, C.cyan); piece(j2 + J, capT + 18, C.link); }
    const la = ghost ? 1 : clamp((t - 1.6) / 0.4);
    if (la > 0) { mg.fillStyle = col(C.link, la); let x = lx0; for (let i = 0; i < 4; i++) { mg.fillText('LINK'[i], x, BOT); x += lw[i]; } }
    // POWER · TELECOM typed (2.0–2.6 s), gone when the grid goes down (5.0–5.5 s)
    // (not among the ghost bulbs: once it goes, nothing of it is left to read)
    const tw = clamp((t - 2) / 0.6), ta = 1 - clamp((t - 5) / 0.5);
    if (!ghost && tw > 0 && ta > 0) {
      mg.save(); mg.beginPath(); mg.rect(34, BOT + 4, 150 * tw, 16); mg.clip();
      mg.font = `900 10px 'Arial Black', sans-serif`; mg.fillStyle = col(C.cyan, ta);
      mg.fillText('POWER · TELECOM', 34, BOT + 16); mg.restore();
    }
  };
  /** TERMINAL STATE's bulbs (amber, on their own: the backup) into the mask. */
  const drawState = (t: number) => {
    mg.setTransform(MK, 0, 0, MK, 0, 0); mg.clearRect(0, 0, W, H);
    const a = clamp((t - 5.5) / 0.7);
    if (a <= 0) return;
    mg.font = `900 15px 'Arial Black', sans-serif`; mg.textAlign = 'center';
    mg.fillStyle = `rgba(255,255,255,${a})`; mg.fillText('T E R M I N A L   S T A T E', W / 2, BOT + 38); mg.textAlign = 'left';
  };
  /** The grid's power at t: on; 5.5–6.2 s flickering out; out; 7.2–8.0 s flickering back. */
  const powerAt = (t: number) => {
    const fl = (k: number) => (Math.sin(t * 91) * Math.sin(t * 37) > 0.1 ? k : k * 0.15);
    if (t < 5.5) return 1;
    if (t < 6.2) return fl(1 - (t - 5.5) / 0.7);
    if (t < 7.2) return 0;
    if (t < 8.0) return fl((t - 7.2) / 0.8);
    return 1;
  };
  let ghostPx: Uint8ClampedArray | null = null;
  const frame = (now: number) => {
    const t = (now - t0) / 1000;
    const px = Math.round(wrap.clientWidth * (devicePixelRatio || 1));
    if (px && px !== sized) { sized = px; for (const c of [glow, cv]) { c.width = px; c.height = Math.round(px * H / W); } }
    const g = cv.getContext('2d')!, k = cv.width / W;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(k, 0, 0, k, 0, 0);
    if (!ghostPx) { drawSign(0, true); ghostPx = mg.getImageData(0, 0, mask.width, mask.height).data; }
    drawSign(t, false);
    const lit = mg.getImageData(0, 0, mask.width, mask.height).data;
    drawState(t);
    const st = mg.getImageData(0, 0, mask.width, mask.height).data;
    const P = powerAt(t); power(P);
    for (const b of bulbs) {
      const r = b.r;
      const o = (Math.floor(b.y * MK) * mask.width + Math.floor(b.x * MK)) * 4;
      if (st[o + 3] > 60) { g.fillStyle = `rgba(${C.state[0]},${C.state[1]},${C.state[2]},${st[o + 3] / 255})`; g.beginPath(); g.arc(b.x, b.y, r, 0, 7); g.fill(); continue; }
      if (ghostPx[o + 3] < 128 && lit[o + 3] < 8) continue;
      // every bulb the sign has shows faintly dark; the lit ones in their color, times the power
      const a = (lit[o + 3] / 255) * P;
      g.fillStyle = a > 0.02 ? `rgba(${lit[o]},${lit[o + 1]},${lit[o + 2]},${0.12 + 0.88 * a})` : 'rgba(70,74,84,0.22)';
      g.beginPath(); g.arc(b.x, b.y, r, 0, 7); g.fill();
    }
    // the paint over the bulbs: rough-edged strokes drawing themselves, overspray, drips once a stroke is done
    g.lineCap = 'round'; g.lineJoin = 'round';
    strokes.forEach((s, i) => {
      const p = clamp((t - s.at) / s.len);
      if (p <= 0) return;
      g.save();
      if (s.rot) { g.translate(s.cx, s.cy); g.rotate(s.rot); g.translate(-s.cx, -s.cy); }
      g.setLineDash([paths[i].L * p, paths[i].L * 2]);
      g.strokeStyle = 'rgba(255,106,19,0.16)'; g.lineWidth = s.w * 2.6; g.stroke(paths[i].p);
      g.strokeStyle = C.spray; g.lineWidth = s.w;
      for (const [dx, dy] of [[0, 0], [0.6, -0.4], [-0.5, 0.5]]) { g.save(); g.translate(dx, dy); g.globalAlpha = dx || dy ? 0.35 : 1; g.stroke(paths[i].p); g.restore(); }
      g.setLineDash([]);
      if (s.drip && p >= 1) {
        const [x, y, l] = s.drip, dl = l * clamp((t - s.at - s.len) / 0.5);
        g.lineWidth = s.w * 0.32; g.strokeStyle = C.spray; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 0.6, y + dl); g.stroke();
        g.fillStyle = C.spray; g.beginPath(); g.arc(x + 0.6, y + dl + 1, s.w * 0.3, 0, 7); g.fill();
      }
      g.restore();
    });
    const gg = glow.getContext('2d')!;
    gg.setTransform(1, 0, 0, 1, 0, 0); gg.clearRect(0, 0, glow.width, glow.height); gg.drawImage(cv, 0, 0);
    if (t < 9) raf = requestAnimationFrame(frame); else power(1);
  };
  const play = () => {
    cancelAnimationFrame(raf); t0 = performance.now();
    raf = requestAnimationFrame(frame);
    if (!mute) openingSound();
  };
  wrap.addEventListener('click', (e) => { e.stopPropagation(); play(); });
  // the face must be in before the letters are measured (a system font, so almost at once)
  void document.fonts.ready.then(play);
}

/** The manual's sounds for the opening (section 9), from now. Silent where the browser will not play without a click. */
function openingSound() {
  let ac: AudioContext;
  try { ac = new AudioContext(); } catch { return; }
  // (in the browser, before a click, it stays suspended: then the opening plays silent)
  if (ac.state !== 'running') { void ac.resume(); setTimeout(() => { if ((ac.state as string) !== 'running') void ac.close(); }, 300); }
  const t0 = ac.currentTime + 0.05, out = ac.createGain();
  out.gain.value = 0.5; out.connect(ac.destination);
  const noise = (() => { const n = ac.sampleRate, buf = ac.createBuffer(1, n, n), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return buf; })();
  const env = (g: GainNode, at: number, peak: number, att: number, len: number) => {
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + att); g.gain.setValueAtTime(peak, at + Math.max(att, len - 0.03)); g.gain.linearRampToValueAtTime(0, at + len);
  };
  /** A burst of noise through a filter. */
  const hiss = (at: number, len: number, type: BiquadFilterType, f: number, q: number, peak: number, att = 0.01, wob = 0) => {
    const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
    const bq = ac.createBiquadFilter(); bq.type = type; bq.frequency.value = f; bq.Q.value = q;
    const g = ac.createGain(); env(g, at, peak, att, len);
    src.connect(bq).connect(g).connect(out);
    if (wob) { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = wob; lg.gain.value = f * 0.35; lfo.connect(lg).connect(bq.frequency); lfo.start(at); lfo.stop(at + len); }
    src.start(at, Math.random() * 0.5); src.stop(at + len + 0.02);
  };
  // 0–1 s: a boot beep a letter, low and clean
  for (let i = 0; i < 4; i++) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = 330;
    env(g, t0 + i * 0.22, 0.32, 0.005, 0.11); o.connect(g).connect(out); o.start(t0 + i * 0.22); o.stop(t0 + i * 0.22 + 0.13);
  }
  // 1–5.5 s: the transformer's hum rising as the stem comes down; 5.5–6.2 s it falls (the blackout);
  // 7.2–8 s it comes back with the bulbs, and fades
  const hum = ac.createOscillator(), h2 = ac.createOscillator(), lp = ac.createBiquadFilter(), hg = ac.createGain();
  hum.type = 'sawtooth'; h2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 520;
  hum.frequency.setValueAtTime(120, t0); h2.frequency.setValueAtTime(240, t0);
  hg.gain.setValueAtTime(0, t0 + 1.0); hg.gain.linearRampToValueAtTime(0.09, t0 + 1.6); hg.gain.setValueAtTime(0.07, t0 + 2.6); hg.gain.setValueAtTime(0.07, t0 + 5.5);
  hg.gain.linearRampToValueAtTime(0, t0 + 6.2); hg.gain.setValueAtTime(0, t0 + 7.2); hg.gain.linearRampToValueAtTime(0.05, t0 + 8.0); hg.gain.linearRampToValueAtTime(0, t0 + 9.5);
  for (const o of [hum, h2]) {
    const f = o.frequency.value;
    o.frequency.setValueAtTime(f, t0 + 5.5); o.frequency.exponentialRampToValueAtTime(f * 0.35, t0 + 6.2);
    o.frequency.setValueAtTime(f * 0.35, t0 + 7.2); o.frequency.exponentialRampToValueAtTime(f, t0 + 8.0);
  }
  const h2g = ac.createGain(); h2g.gain.value = 0.25;
  hum.connect(lp); h2.connect(h2g).connect(lp); lp.connect(hg).connect(out);
  hum.start(t0 + 1); h2.start(t0 + 1); hum.stop(t0 + 9.6); h2.stop(t0 + 9.6);
  // 2–2.6 s: POWER · TELECOM typed, a terminal key a letter
  for (let i = 0; i < 15; i++) hiss(t0 + 2.0 + i * 0.04 + Math.random() * 0.01, 0.025, 'bandpass', 2600 + Math.random() * 900, 3, 0.35, 0.002);
  // ~3 s: the can shaken (the ball knocking)
  for (let i = 0; i < 7; i++) { const at = t0 + 2.95 + i * 0.065; hiss(at, 0.03, 'bandpass', 3200, 14, 0.9, 0.002); hiss(at, 0.02, 'lowpass', 900, 1, 0.25, 0.001); }
  // 3.4–4.8 s: O, W, N, a stroke of spray each with its short "tsst" at the end
  for (let i = 0; i < 3; i++) { const at = t0 + 3.4 + i * 0.45; hiss(at, 0.4, 'highpass', 3800, 0.7, 0.32, 0.03); hiss(at + 0.38, 0.06, 'highpass', 6000, 0.7, 0.4, 0.004); }
  // 4.8–5.5 s: the long spray back and forth over LINK
  hiss(t0 + 4.8, 0.7, 'bandpass', 5200, 0.8, 0.34, 0.04, 6);
  // 7.2 s: the relay clacking the power back in
  hiss(t0 + 7.2, 0.04, 'bandpass', 1400, 4, 0.8, 0.002);
  setTimeout(() => void ac.close(), 10500);
}
