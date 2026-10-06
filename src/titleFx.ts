/**
 * The title's background (2026-10-06): a city's console, its lines floating in depth and coming at the
 * viewer as if flying forward through them (each typed in as it nears), instead of the city itself behind
 * the title (making the city just to show it cost the wait on every open). Plain 2D canvas under the
 * overlay, out of focus and dim the nearer a line comes; stop() takes it away when the game starts.
 */
const LINES = [
  'GRID  SUB-{n}  LOAD {p}%  FREQ 60.0{d} HZ  OK',
  'TRAFFIC  SIG {s} ST & {a} AVE  PHASE {ph}  CYCLE {c}s',
  'CAM{n}  REC  {fps} FPS  DISK {p}%',
  'WEATHER  {t}C  WIND {w} KM/H  HUMIDITY {p}%',
  'TRANSIT  BUS {b}  STOP {c}  ETA {e} MIN',
  'TELCO  CELL {n}-{c}  {u} SUBSCRIBERS  EDGE',
  'POWER  FEEDER {n}{ab}  {kv} KV  BREAKER CLOSED',
  'STREETWIRE  {u} POSTS / HOUR',
  'DISPATCH  UNIT {b}  AVAILABLE',
  'LIGHTS  ZONE {n}  SODIUM  {p}% LIT',
  'WATER  PUMP {n}  {kv} PSI  NORMAL',
  'NEWSDESK  WIRE IN  {c} ITEMS',
];
const AMBER = '#ffb04a', DIM = '#9a6a2c', CYAN = '#6fd6e8';

export class TitleFx {
  private cv = document.createElement('canvas');
  private g = this.cv.getContext('2d')!;
  /** The lines in space: x, y across (units at depth 1), z how far, how much is typed. */
  private lines: { text: string; x: number; y: number; z: number; shown: number; color: string }[] = [];
  private raf = 0;
  private last = 0;

  constructor(before: HTMLElement) {
    // out of focus and dim, behind the buttons (it must not read through them)
    Object.assign(this.cv.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', filter: 'brightness(0.7)' });
    before.before(this.cv);
    const loop = (t: number) => { this.step(t); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }

  stop() { cancelAnimationFrame(this.raf); this.cv.remove(); }

  private line(): string {
    const r = (n: number) => Math.floor(Math.random() * n), two = (n: number) => String(n).padStart(2, '0');
    const now = new Date(), stamp = `[${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}]`;
    const t = LINES[r(LINES.length)].replace(/\{(\w+)\}/g, (_, k: string) => {
      switch (k) {
        case 'n': return two(1 + r(9));
        case 'p': return String(20 + r(80));
        case 'd': return String(r(10));
        case 's': return String(1 + r(40));
        case 'a': return String(1 + r(12));
        case 'ph': return 'ABCD'[r(4)];
        case 'c': return String(30 + r(90));
        case 'fps': return String([2, 4, 6, 12][r(4)]);
        case 't': return String(-4 + r(14));
        case 'w': return String(r(40));
        case 'b': return String(100 + r(900));
        case 'e': return String(1 + r(15));
        case 'u': return String(100 + r(9000));
        case 'ab': return 'AB'[r(2)];
        case 'kv': return String(10 + r(60));
        default: return k;
      }
    });
    return `${stamp} ${t}`;
  }

  private spawn(z: number) {
    const k = Math.random();
    // anywhere across, but not straight down the middle, where the title and the buttons are
    let x = 0, y = 0;
    do { x = (Math.random() * 2 - 1) * 1.6; y = (Math.random() * 2 - 1) * 1.0; } while (Math.abs(x) < 0.5 && Math.abs(y) < 0.35);
    this.lines.push({ text: this.line(), x, y, z, shown: 0, color: k < 0.1 ? CYAN : k < 0.65 ? DIM : AMBER });
  }

  private step(t: number) {
    const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
    if (this.cv.width !== Math.round(W * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    const g = this.g, dt = Math.min(0.1, (t - this.last) / 1000); this.last = t;
    const FAR = 9, NEAR = 0.6, SPEED = 0.55, F = Math.min(W, H) * 0.9;
    if (!this.lines.length) for (let k = 0; k < 46; k++) this.spawn(NEAR + Math.random() * (FAR - NEAR));
    // forward: every line comes nearer; one that passed the viewer goes back far away as a new line
    for (const L of this.lines) { L.z -= dt * SPEED; L.shown += dt * 40; }
    this.lines = this.lines.filter((L) => L.z > NEAR);
    while (this.lines.length < 46) this.spawn(FAR - Math.random() * 0.5);
    this.lines.sort((a, b) => b.z - a.z);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.filter = 'none';
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'middle';
    for (const L of this.lines) {
      const sx = W / 2 + (L.x / L.z) * F, sy = H / 2 + (L.y / L.z) * F, fs = 15 / L.z * (F / 600);
      if (fs < 2) continue;
      // faint far away (fog), brightest in the middle distance, fading as it comes too near (and blurred)
      const fog = Math.min(1, (FAR - L.z) / 3), near = Math.min(1, (L.z - NEAR) / 1.2);
      g.globalAlpha = 0.85 * fog * near;
      g.filter = L.z < 2.2 ? `blur(${((2.2 - L.z) * 2.5).toFixed(1)}px)` : 'none';
      g.font = `${fs.toFixed(1)}px 'IBM Plex Mono', Consolas, monospace`;
      g.fillStyle = L.color;
      // each line runs outward from the middle, so none crosses the title
      g.textAlign = L.x < 0 ? 'right' : 'left';
      g.fillText(L.text.slice(0, Math.floor(L.shown)), sx, sy);
    }
    g.filter = 'none'; g.globalAlpha = 1;
    // scanlines
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  }
}
