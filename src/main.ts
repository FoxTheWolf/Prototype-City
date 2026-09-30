import { Input } from './input';
import { FONT } from './render/atlas';
import { Camera } from './render/camera';
import { GlyphRenderer, type Layout } from './render/glRenderer';
import { CharGrid } from './render/grid';
import { PALETTES, type Look } from './render/palette';
import { renderWorld } from './render/raycaster';
import { cityName, compass, districtName, districtType, landmarkName, roadName, sectorCode } from './locale/names';
import { districtAt, nearestRoad } from './sim/city';
import { createWorld, stepWorld, TICK, type PlayerInput } from './sim/world';

/** The grid always has this many rows; columns follow the window shape. */
const ROWS = 80;
/** Cell width / height, close to a monospace glyph. */
const CELL_ASPECT = 0.6;
/** Eye height in metres. */
const EYE = 1.7;
const MOUSE_SENS = 0.0022;

// ?seed=123 reproduces a city; otherwise every game rolls a new one.
const seedParam = new URLSearchParams(location.search).get('seed');
const seed = seedParam !== null ? Number(seedParam) | 0 : (Math.random() * 2 ** 31) | 0;
const world = createWorld(seed);

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const overlay = document.getElementById('overlay')!;
const renderer = new GlyphRenderer(canvas);
const input = new Input(canvas);
const camera = new Camera();
// Dev-only handles for testing from the browser console (pointer lock does not work in the app's preview pane).
// gridText(x0, y0, x1, y1) returns the glyphs of a screen region as text, to inspect detail the pane is too small to show.
if (import.meta.env.DEV) Object.assign(window, {
  world, camera,
  gridText: (x0 = 0, y0 = 0, x1 = grid.cols, y1 = grid.rows) => {
    let s = '';
    for (let y = y0; y < y1; y++) { for (let x = x0; x < x1; x++) s += String.fromCharCode(grid.cells[(y * grid.cols + x) * 4]); s += '\n'; }
    return s;
  },
});
let grid: CharGrid;
let layout: Layout;
let running = false;
// display switches: P cycles the palette, B the solid background, U the block glyphs
const look: Look = { palette: 0, solid: true, blocks: false };
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyP') look.palette = (look.palette + 1) % PALETTES.length;
  else if (e.code === 'KeyB') look.solid = !look.solid;
  else if (e.code === 'KeyU') look.blocks = !look.blocks;
});

function computeLayout(): Layout {
  const dpr = devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  canvas.width = w; canvas.height = h;
  const cellH = Math.max(4, Math.floor(h / ROWS));
  const cellW = Math.max(3, Math.round(cellH * CELL_ASPECT));
  const cols = Math.floor(w / cellW);
  return { cols, rows: ROWS, cellW, cellH, originX: (w - cols * cellW) >> 1, originY: (h - ROWS * cellH) >> 1 };
}

function resize() {
  layout = computeLayout();
  grid = new CharGrid(layout.cols, layout.rows);
  renderer.setLayout(layout);
}

function readInput(): PlayerInput {
  const f = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);
  const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
  return { forward: running ? f : 0, strafe: running ? s : 0, run: input.down('ShiftLeft', 'ShiftRight'), heading: camera.yaw };
}

function begin() {
  overlay.hidden = true;
  running = true;
  input.lock();
}
overlay.addEventListener('click', begin);
canvas.addEventListener('click', () => { if (!input.locked) input.lock(); });

let last = performance.now();
let acc = 0;
let fps = 60;

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;

  // camera first, so this frame's movement uses the heading the player sees
  const [mx, my] = input.takeMouse();
  camera.look(mx * MOUSE_SENS, -my * MOUSE_SENS);
  const turn = (input.down('ArrowRight', 'KeyE') ? 1 : 0) - (input.down('ArrowLeft', 'KeyQ') ? 1 : 0);
  if (running) camera.look(turn * 2.2 * dt, 0);
  else camera.look(dt * 0.08, 0); // idle drift behind the title
  camera.update(dt);

  // fixed-step simulation, independent of the frame rate
  acc += dt;
  const cmd = readInput();
  while (acc >= TICK) { stepWorld(world, cmd); acc -= TICK; }
  const alpha = acc / TICK;

  const p = world.player;
  renderWorld(grid, world, {
    x: p.px + (p.x - p.px) * alpha,
    y: p.py + (p.y - p.py) * alpha,
    yaw: camera.yaw,
    pitch: camera.pitch,
    eye: EYE,
    alpha,
    cellAspect: layout.cellW / layout.cellH,
    look,
  });
  const status = ` SEED ${seed}  POS ${p.x.toFixed(1)},${p.y.toFixed(1)}  ${p.speed > 4 ? 'RUN ' : 'WALK'} ${p.speed.toFixed(1)} m/s  GRID ${grid.cols}x${grid.rows}  ${Math.round(fps)} FPS  `
    + `[P] ${PALETTES[look.palette].name}  [B] BG ${look.solid ? 'ON' : 'OFF'}  [U] ${look.blocks ? 'BLOCKS' : 'ASCII'} `;
  grid.text(1, grid.rows - 1, status, [255, 176, 74], [12, 10, 8]);
  const { city } = world, d = districtAt(city, p.x, p.y);
  const where = ` ${cityName(city).toUpperCase()} / ${districtName(city, d).toUpperCase()} (${districtType(city, d)})  SECTOR ${sectorCode(city, p.x, p.y)}  `
    + `${roadName(city, true, nearestRoad(city.xb, city.xCell, p.x))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, p.y))} `;
  let lm = 0;
  city.landmarks.forEach((l, k) => { if (Math.hypot(l.x - p.x, l.y - p.y) < Math.hypot(city.landmarks[lm].x - p.x, city.landmarks[lm].y - p.y)) lm = k; });
  const L = city.landmarks[lm];
  grid.text(1, 0, where + ` LANDMARK ${landmarkName(city, lm)} ${Math.round(Math.hypot(L.x - p.x, L.y - p.y))}m ${compass(L.x - p.x, L.y - p.y)} `, [120, 220, 255], [8, 10, 14]);
  renderer.draw(grid, PALETTES[look.palette].grade);
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
document.fonts.load(`16px ${FONT}`).finally(() => {
  resize();
  requestAnimationFrame(frame);
});
