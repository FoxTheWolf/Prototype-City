/**
 * The title's logo (2026-10-08): GRID DOWN: TERMINAL STATE, built as the identity manual builds it
 * (docs/identidade/manual.html, sections 2, 6 and 9: MANUAL = LEI): GRID over LINK with the L under the I, the
 * stem in three pieces with its joints, then the vandal's OWN after the D and LINK scribbled out, on the
 * box's grey under the sodium light. It plays the manual's opening (~6 s) with its sounds, synthesized here.
 * In SVG drawn by code; the face is the system's heavy sans (no font file: "tudo é código"), so every place
 * is measured from the letters, as the manual's does.
 */
const NS = 'http://www.w3.org/2000/svg';
const C = { navy: '#1d3a6e', teal: '#0d6f6e', cyan: '#3aa6d8', spray: '#ff6a13', night: '#c9ccd0' };
const F = (w: number, s: number) => `font-family:'Arial Black',Archivo,'Segoe UI',sans-serif;font-weight:${w};font-size:${s}px`;
const TOP = 76, BOT = 146, SIZE = 60, W = 380, H = 200;

/** A spray stroke: overspray, the stroke (rough-edged), drips; with `anim` [start s, length s] it draws itself. */
function spray(path: string, col: string, w: number, drips: number[][], anim?: number[]) {
  const a = anim ? ` pathLength="1" style="opacity:0;stroke-dasharray:1;stroke-dashoffset:1;animation:gdDraw ${anim[1]}s linear ${anim[0]}s forwards, gdIn .01s ${anim[0]}s forwards"` : '';
  // (hidden until it starts: a dash of nothing still shows its round cap, an orange dot before the vandal came)
  const ad = anim ? ` style="opacity:0;animation:gdIn .25s ${anim[0] + anim[1]}s forwards"` : '';
  let s = `<path d="${path}" fill="none" stroke="${col}" stroke-width="${w * 2.6}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".16" filter="url(#gdBlur)"${a}/>`;
  s += `<path d="${path}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" filter="url(#gdRough)"${a}/>`;
  for (const [x, y, l] of drips) s += `<g${ad}><path d="M${x} ${y} L${x + 0.6} ${y + l}" stroke="${col}" stroke-width="${w * 0.32}" stroke-linecap="round" filter="url(#gdRough)"/><circle cx="${x + 0.6}" cy="${y + l + 1}" r="${w * 0.3}" fill="${col}"/></g>`;
  return s;
}
/** O, W, N by hand from x, cap top y, h tall; the first letter starts at `t0`, each 0.45 s after. */
function own(x: number, y: number, h: number, col: string, t0: number) {
  const w = h * 0.74, g = h * 0.16, L = [
    (x0: number) => `M${x0 + w / 2} ${y} C${x0 - 3} ${y} ${x0 - 3} ${y + h} ${x0 + w / 2} ${y + h} C${x0 + w + 3} ${y + h} ${x0 + w + 3} ${y} ${x0 + w / 2 - 3} ${y + 2}`,
    (x0: number) => `M${x0 - 2} ${y - 1} L${x0 + w * 0.2} ${y + h} L${x0 + w * 0.5} ${y + h * 0.3} L${x0 + w * 0.82} ${y + h} L${x0 + w + 3} ${y - 3}`,
    (x0: number) => `M${x0} ${y + h} L${x0 + 1} ${y} L${x0 + w} ${y + h} L${x0 + w + 1} ${y - 3}`,
  ];
  return L.map((fn, i) => {
    const x0 = x + i * (w + g) + (i === 2 ? g : 0), rot = [3, -2, 4][i];
    return `<g transform="rotate(${rot} ${x0 + w / 2} ${y + h / 2})">${spray(fn(x0), col, h * 0.15, i === 1 ? [[x0 + w * 0.2, y + h, h * 0.3]] : i === 2 ? [[x0 + w + 1, y + h * 0.1, h * 0.45]] : [], [t0 + i * 0.45, 0.4])}</g>`;
  }).join('');
}

/** The logo into `host` (replacing what is there), playing the opening; its sounds unless `mute`. Click it to play again. */
export function titleLogo(host: HTMLElement, mute: boolean) {
  const play = () => {
    host.innerHTML = '';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'GRID DOWN: TERMINAL STATE');
    svg.innerHTML = `<defs>
      <filter id="gdRough" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="3.2"/></filter>
      <filter id="gdBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
      <filter id="gdGrime"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="11"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 0.62"/></filter>
      <radialGradient id="gdLamp" cx="0.35" cy="-0.1" r="1.2"><stop offset="0" stop-color="#ffb347" stop-opacity="0"/><stop offset="1" stop-color="#140c04" stop-opacity="0.55"/></radialGradient>
      </defs><rect width="${W}" height="${H}" fill="${C.night}"/>`;
    host.appendChild(svg);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', 'translate(0 4)');
    svg.appendChild(g);
    g.innerHTML = `<text class="t" x="34" y="${TOP}" style="${F(900, SIZE)}" fill="${C.navy}">GRID</text><text class="b" x="0" y="${BOT}" style="${F(900, SIZE)}" fill="${C.teal}">LINK</text>`;
    const t = g.querySelector('.t') as SVGTextElement, b = g.querySelector('.b') as SVGTextElement;
    const E = [0, 1, 2, 3].map((i) => t.getExtentOfChar(i)), I = E[2], D = E[3];
    b.setAttribute('x', String(I.x - b.getExtentOfChar(0).x));
    const L = b.getExtentOfChar(0), K = b.getExtentOfChar(3);
    const sx = I.x + I.width * 0.5, sw = I.width * 0.47, capT = BOT - SIZE * 0.72, gap = capT - TOP, j1 = TOP + gap * 0.33, j2 = TOP + gap * 0.67, J = 2.5;
    // GRID letter by letter
    t.remove();
    let s = [0, 1, 2, 3].map((i) => `<text x="${E[i].x}" y="${TOP}" style="${F(900, SIZE)};opacity:0;animation:gdUp .3s ${i * 0.22}s forwards" fill="${C.navy}">${'GRID'[i]}</text>`).join('');
    // the stem comes down from the I to the L, its joints the box's grey
    const stem = `<rect x="${sx - sw / 2}" y="${TOP - 20}" width="${sw}" height="${j1 - TOP + 20}" fill="${C.navy}"/><rect x="${sx - sw / 2}" y="${j1 + J}" width="${sw}" height="${j2 - j1 - J}" fill="${C.cyan}"/><rect x="${sx - sw / 2}" y="${j2 + J}" width="${sw}" height="${capT - j2 - J + 18}" fill="${C.teal}"/>` +
      [j1, j2].map((y) => `<rect x="${sx - sw / 2 - 1}" y="${y}" width="${sw + 2}" height="${J}" fill="${C.night}"/>`).join('');
    s += `<g style="transform-origin:${sx}px ${TOP}px;transform:scaleY(0);animation:gdGrow .6s ease-out 1.0s forwards">${stem}</g>`;
    // LINK; POWER · TELECOM typed, then gone when the subtitle takes its place
    b.style.opacity = '0'; b.style.animation = 'gdIn .4s 1.6s forwards';
    const tagY = BOT + 16;
    s += `<g style="opacity:0;animation:gdIn .1s 2.0s forwards, gdOut .5s 5.0s forwards"><clipPath id="gdType"><rect x="34" y="${tagY - 10}" width="0" height="14"><animate attributeName="width" from="0" to="140" begin="2s" dur=".6s" fill="freeze"/></rect></clipPath><g clip-path="url(#gdType)"><text x="34" y="${tagY}" style="${F(700, 8.5)}" fill="${C.cyan}" letter-spacing="1.6">POWER · TELECOM</text></g></g>`;
    // the spray: OWN after the D, LINK scribbled back and forth
    const lx = L.x - 8, rx = K.x + K.width + 10, mid = BOT - SIZE * 0.36;
    s += own(D.x + D.width + 6, TOP - SIZE * 0.72, SIZE * 0.72, C.spray, 3.4);
    s += spray(`M${lx + 24} ${mid - 16} Q${(lx + rx) / 2} ${mid - 24} ${rx} ${mid - 12} Q${(lx + rx) / 2} ${mid - 4} ${lx - 6} ${mid + 6} Q${(lx + rx) / 2} ${mid + 2} ${rx - 6} ${mid + 4} Q${(lx + rx) / 2 - 20} ${mid + 18} ${lx + 6} ${mid + 20}`, C.spray, 4.5, [[lx - 5, mid + 8, 12], [lx + 7, mid + 22, 8]], [4.8, 0.7]);
    s += `<text x="190" y="${BOT + 34}" text-anchor="middle" style="${F(700, 15)};opacity:0;animation:gdIn .7s 5.5s forwards" fill="${C.navy}" letter-spacing="6">TERMINAL STATE</text>`;
    g.insertAdjacentHTML('beforeend', s);
    // the sodium night and the street's grime over it all
    svg.insertAdjacentHTML('beforeend', `<rect width="${W}" height="${H}" fill="#e09a3a" opacity=".22" style="mix-blend-mode:multiply"/><rect width="${W}" height="${H}" filter="url(#gdGrime)" opacity=".3"/><rect width="${W}" height="${H}" fill="url(#gdLamp)"/>`);
    if (!mute) openingSound();
  };
  host.addEventListener('click', (e) => { e.stopPropagation(); play(); });
  play();
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
  // 1–5.5 s: the transformer's hum rising as the stem comes down; 5.5–6.2 s it falls (the light going: the blackout)
  const hum = ac.createOscillator(), h2 = ac.createOscillator(), lp = ac.createBiquadFilter(), hg = ac.createGain();
  hum.type = 'sawtooth'; h2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 520;
  hum.frequency.setValueAtTime(120, t0); h2.frequency.setValueAtTime(240, t0);
  hg.gain.setValueAtTime(0, t0 + 1.0); hg.gain.linearRampToValueAtTime(0.09, t0 + 1.6); hg.gain.setValueAtTime(0.07, t0 + 2.6); hg.gain.setValueAtTime(0.07, t0 + 5.5);
  hg.gain.linearRampToValueAtTime(0, t0 + 6.2);
  for (const o of [hum, h2]) { o.frequency.setValueAtTime(o.frequency.value, t0 + 5.5); o.frequency.exponentialRampToValueAtTime(o.frequency.value * 0.35, t0 + 6.2); }
  const h2g = ac.createGain(); h2g.gain.value = 0.25;
  hum.connect(lp); h2.connect(h2g).connect(lp); lp.connect(hg).connect(out);
  hum.start(t0 + 1); h2.start(t0 + 1); hum.stop(t0 + 6.3); h2.stop(t0 + 6.3);
  // 2–2.6 s: POWER · TELECOM typed, a terminal key a letter
  for (let i = 0; i < 15; i++) hiss(t0 + 2.0 + i * 0.04 + Math.random() * 0.01, 0.025, 'bandpass', 2600 + Math.random() * 900, 3, 0.35, 0.002);
  // ~3 s: the can shaken (the ball knocking)
  for (let i = 0; i < 7; i++) { const at = t0 + 2.95 + i * 0.065; hiss(at, 0.03, 'bandpass', 3200, 14, 0.9, 0.002); hiss(at, 0.02, 'lowpass', 900, 1, 0.25, 0.001); }
  // 3.4–4.8 s: O, W, N, a stroke of spray each with its short "tsst" at the end
  for (let i = 0; i < 3; i++) { const at = t0 + 3.4 + i * 0.45; hiss(at, 0.4, 'highpass', 3800, 0.7, 0.32, 0.03); hiss(at + 0.38, 0.06, 'highpass', 6000, 0.7, 0.4, 0.004); }
  // 4.8–5.5 s: the long spray back and forth over LINK
  hiss(t0 + 4.8, 0.7, 'bandpass', 5200, 0.8, 0.34, 0.04, 6);
  setTimeout(() => void ac.close(), 7000);
}
