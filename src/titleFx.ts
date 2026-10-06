/**
 * The title's background (2026-10-06): a city's console scrolling, typed a few characters at a time,
 * instead of the city itself behind the title (making the city just to show it cost the wait on every
 * open). Plain 2D canvas under the overlay; stop() takes it away when the game starts.
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
  private lines: { text: string; shown: number; color: string }[] = [];
  private raf = 0;
  private last = 0;

  constructor(before: HTMLElement) {
    // out of focus and dim, behind the buttons (it must not read through them)
    Object.assign(this.cv.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none', filter: 'blur(2px) brightness(0.6)' });
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

  private step(t: number) {
    const W = innerWidth, H = innerHeight, dpr = devicePixelRatio || 1;
    if (this.cv.width !== Math.round(W * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    const g = this.g, fs = Math.max(11, Math.round(H / 60)), lh = Math.round(fs * 1.5), rows = Math.floor(H / lh) - 1;
    // a few characters a frame onto the last line; a new one when it is done (now and then a pause)
    const dt = Math.min(0.1, (t - this.last) / 1000); this.last = t;
    const cur = this.lines[this.lines.length - 1];
    if (!cur || cur.shown >= cur.text.length + 8 + Math.random() * 40) {
      const k = Math.random();
      this.lines.push({ text: this.line(), shown: 0, color: k < 0.08 ? CYAN : k < 0.7 ? DIM : AMBER });
      if (this.lines.length > rows) this.lines.shift();
    } else cur.shown += dt * 90;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    g.font = `${fs}px 'IBM Plex Mono', Consolas, monospace`; g.textBaseline = 'top';
    this.lines.forEach((L, i) => {
      const s = L.text.slice(0, Math.floor(L.shown)), y = lh * (i + 0.5);
      g.fillStyle = L.color; g.globalAlpha = 0.35 + 0.65 * ((i + 1) / this.lines.length);
      g.fillText(s, fs, y);
      // the cursor on the line being typed
      if (L === this.lines[this.lines.length - 1] && Math.floor(t / 400) & 1) g.fillRect(fs + g.measureText(s).width + 2, y, fs * 0.6, fs);
    });
    g.globalAlpha = 1;
    // scanlines
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  }
}
