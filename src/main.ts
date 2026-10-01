import { Sound } from './audio/sound';
import { Input } from './input';
import { drawPhone, mapView } from './phone/draw';
import { BOOT_LOG_S, Phone, phoneKey, type Key } from './phone/phone';
import { FONT } from './render/atlas';
import { Camera } from './render/camera';
import { GlyphRenderer, type Layout } from './render/glRenderer';
import { CharGrid } from './render/grid';
import { type Look } from './render/palette';
import { power } from './render/power';
import { pickedButton } from './render/interior';
import { renderWorld, VIEW_GLINT, VIEW_LIGHT } from './render/raycaster';
import { daylight } from './render/sky';
import { cityName, compass, diagonalName, districtName, districtType, landmarkName, roadName, sectorCode } from './locale/names';
import { diagS, districtAt, FLOOR_H, nearestRoad, SIDEWALK } from './sim/city';
import { calendar } from './sim/clock';
import { isOffice } from './sim/interior';
import { lightning, PRESETS } from './sim/weather';
import { callLift, createWorld, cycleWeather, debugFloor, liftFloors, skipHours, stepWorld, TICK, togglePower, type PlayerInput } from './sim/world';

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
const phone = new Phone(world);
// Dev-only handles for testing from the browser console (pointer lock does not work in the app's preview pane).
// gridText(x0, y0, x1, y1) returns the glyphs of a screen region as text, to inspect detail the pane is too small to show.
if (import.meta.env.DEV) Object.assign(window, {
  world, camera, pickedButton, callLift, phone, VIEW_LIGHT, VIEW_GLINT,
  gridText: (x0 = 0, y0 = 0, x1 = grid.cols, y1 = grid.rows) => {
    let s = '';
    for (let y = y0; y < y1; y++) { for (let x = x0; x < x1; x++) s += String.fromCharCode(grid.cells[(y * grid.cols + x) * 4]); s += '\n'; }
    return s;
  },
  // renders the current view n times without the frame loop (it stops while the pane is hidden); returns the mean ms
  // on a 256x80 grid of its own, as in a 16:9 window
  bench: (n = 10) => {
    const p = world.player, g = new CharGrid(256, ROWS), t0 = performance.now();
    for (let k = 0; k < n; k++) renderWorld(g, world, { x: p.x, y: p.y, yaw: camera.yaw, pitch: camera.pitch, eye: EYE + p.z, floor: viewFloor(), z: p.z, lift: p.liftTo >= 0, alpha: 0, cellAspect: 0.6, look });
    return (performance.now() - t0) / n;
  },
});
let grid: CharGrid;
let layout: Layout;
let running = false;
// display switches: B steps the solid background darker until it is off, U the block glyphs
const SOLID = [0.24, 0.16, 0.08, 0];
let solidStep = 0; // 0.24 ("1/3"), the user's pick
const look: Look = { solid: SOLID[solidStep], blocks: false };
// the phone's keys (see phone.ts): sounds, and the slide back into the pocket
function phonePress(pk: Key) {
  const done = phone.press(pk, performance.now() / 1000, ...mapView(layout.cellW / layout.cellH, phone.zoom, world.player.inside >= 0));
  sound?.phoneKey(/^\d$/.test(pk), done !== false);
  if (done === 'away') sound?.phoneSlide(false);
}
function phoneToggle() {
  const r = phone.toggle(performance.now() / 1000);
  sound?.phoneSlide(r !== 'in');
  if (r === 'boot') sound?.phoneBoot(0.35 + BOOT_LOG_S);
}
// with the phone out the mouse buttons are its OK and Back (as in GTA IV);
// otherwise, in a lift car, aim at a button of its panel and click it
addEventListener('contextmenu', (e) => e.preventDefault());
// the mouse wheel zooms the phone's map
addEventListener('wheel', (e) => {
  if (!phone.out || phone.screen !== 'map' || !e.deltaY) return;
  if (phone.setZoom(phone.zoom + Math.sign(e.deltaY), performance.now() / 1000)) sound?.phoneKey(false);
});
addEventListener('mousedown', (e) => {
  if (!input.locked) return;
  if (phone.out) { if (e.button === 0 || e.button === 2) phonePress(e.button === 0 ? 'ok' : 'rsoft'); return; }
  if (e.button !== 0 || !liftFloors(world)) return;
  const b = pickedButton();
  if (b >= 0) sound?.beep(callLift(world, b));
});
addEventListener('keydown', (e) => {
  // the phone: Up (or P) takes it out; while it is out, its keys (see phone.ts)
  const pk = phone.out ? phoneKey(e.code) : null;
  if (pk) {
    e.preventDefault();
    if (e.repeat && pk !== 'up' && pk !== 'down' && pk !== 'left' && pk !== 'right') return;
    phonePress(pk);
    return;
  }
  if (e.repeat) return;
  if ((e.code === 'KeyP' || (e.code === 'ArrowUp' && !phone.out)) && running) phoneToggle();
  else if (e.code === 'KeyM') sound?.toggleMute();
  else if (e.code === 'KeyB') look.solid = SOLID[solidStep = (solidStep + 1) % SOLID.length];
  else if (e.code === 'KeyU') look.blocks = !look.blocks;
  // debug: T / shift+T move the clock an hour, Y steps through the weather presets
  else if (e.code === 'KeyT') skipHours(world, e.shiftKey ? -1 : 1);
  else if (e.code === 'KeyY') cycleWeather(world);
  // debug: K switches the nearest substation (shift: all of them)
  else if (e.code === 'KeyK') togglePower(world, e.shiftKey);
  // debug: PageUp / PageDown move a storey up or down inside a building
  else if (e.code === 'PageUp' || e.code === 'PageDown') debugFloor(world, e.code === 'PageUp' ? 1 : -1);
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
  // the up and down arrows belong to the phone (as in GTA IV); WASD walk
  const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
  const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
  return { forward: running ? f : 0, strafe: running ? s : 0, run: input.down('ShiftLeft', 'ShiftRight'), heading: camera.yaw };
}

// audio can only start from a click, so it is made on entering the city
let sound: Sound | null = null;
/** The storey drawn around the viewer: on the stairs, the one above once past the middle landing. */
const viewFloor = () => (world.player.liftTo >= 0 ? world.player.floor : Math.floor((world.player.z + FLOOR_H / 2) / FLOOR_H));
let wasRiding = false, stride = 0, lastX = 0, lastY = 0;

function begin() {
  sound ??= new Sound();
  sound.resume();
  overlay.hidden = true;
  running = true;
  input.lock();
}
overlay.addEventListener('click', begin);
canvas.addEventListener('click', () => { if (!input.locked) input.lock(); });

const bolt = new Float64Array(2);
let last = performance.now();
let acc = 0;
let fps = 60;
/** Time spent drawing the world: smoothed, and the worst of the last second. */
let renderMs = 0, worstMs = 0, worstShown = 0, worstAt = 0;

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;

  // camera first, so this frame's movement uses the heading the player sees
  const [mx, my] = input.takeMouse();
  camera.look(mx * MOUSE_SENS, -my * MOUSE_SENS);
  const turn = (input.down(phone.out ? 'KeyE' : 'ArrowRight', 'KeyE') ? 1 : 0) - (input.down(phone.out ? 'KeyQ' : 'ArrowLeft', 'KeyQ') ? 1 : 0);
  if (running) camera.look(turn * 2.2 * dt, 0);
  else camera.look(dt * 0.08, 0); // idle drift behind the title
  camera.update(dt);

  // fixed-step simulation, independent of the frame rate
  acc += dt;
  const cmd = readInput();
  while (acc >= TICK) { stepWorld(world, cmd); acc -= TICK; }
  const alpha = acc / TICK;

  const p = world.player;
  const r0 = performance.now();
  renderWorld(grid, world, {
    x: p.px + (p.x - p.px) * alpha,
    y: p.py + (p.y - p.py) * alpha,
    yaw: camera.yaw,
    pitch: camera.pitch,
    eye: EYE + p.z,
    floor: viewFloor(),
    z: p.z,
    lift: p.liftTo >= 0,
    alpha,
    cellAspect: layout.cellW / layout.cellH,
    look,
  });
  const ms = performance.now() - r0;
  phone.update(dt, now / 1000);
  drawPhone(grid, phone, world, camera.yaw, layout.cellW / layout.cellH, now / 1000, VIEW_LIGHT, VIEW_GLINT);
  renderMs += (ms - renderMs) * 0.05;
  worstMs = Math.max(worstMs, ms);
  if (now - worstAt > 1000) { worstShown = worstMs; worstMs = 0; worstAt = now; }
  const status = ` SEED ${seed}  POS ${p.x.toFixed(1)},${p.y.toFixed(1)}  ${p.inside >= 0 ? `INSIDE FLOOR ${p.floor}  ` : ''}${p.speed > 4 ? 'RUN ' : 'WALK'} ${p.speed.toFixed(1)} m/s  GRID ${grid.cols}x${grid.rows}  ${Math.round(fps)} FPS  DRAW ${renderMs.toFixed(1)} ms (MAX ${worstShown.toFixed(1)})  `
    + `[P] PHONE  [B] BG ${look.solid ? `${solidStep + 1}/${SOLID.length - 1}` : 'OFF'}  [U] ${look.blocks ? 'BLOCKS' : 'ASCII'}  [M] SOUND ${sound && !sound.muted ? 'ON' : 'OFF'} `;
  grid.text(1, grid.rows - 1, status, [255, 176, 74], [12, 10, 8]);
  const cal = calendar(world.time), wx = world.weather;
  const clock = ` ${cal.year}-${String(cal.month).padStart(2, '0')}-${String(cal.day).padStart(2, '0')} ${String(Math.floor(cal.hour)).padStart(2, '0')}:${String(Math.floor((cal.hour % 1) * 60)).padStart(2, '0')}  `
    + `${wx.preset >= 0 ? PRESETS[wx.preset][0].toUpperCase() : 'AUTO'} CLOUD ${Math.round(wx.cloud * 100)}% ${wx.precip > 0 ? `${wx.snow ? 'SNOW' : 'RAIN'} ${Math.round(wx.precip * 100)}% ` : ''}${wx.temp.toFixed(0)}C WIND ${Math.hypot(wx.windX, wx.windY).toFixed(0)} m/s  [T] +1H [Y] SKY  POWER ${world.power.subs.filter((s) => s.on).length}/${world.power.subs.length} [K] `;
  grid.text(grid.cols - clock.length - 1, grid.rows - 2, clock, [120, 220, 255], [8, 10, 14]);
  const { city } = world, d = districtAt(city, p.x, p.y);
  const where = ` ${cityName(city).toUpperCase()} / ${districtName(city, d).toUpperCase()} (${districtType(city, d)})  SECTOR ${sectorCode(city, p.x, p.y)}  `
    + `${Math.abs(diagS(city.diagonal, p.x, p.y)) < city.diagonal.w / 2 + SIDEWALK ? diagonalName(city) : roadName(city, true, nearestRoad(city.xb, city.xCell, p.x))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, p.y))} `;
  let lm = 0;
  city.landmarks.forEach((l, k) => { if (Math.hypot(l.x - p.x, l.y - p.y) < Math.hypot(city.landmarks[lm].x - p.x, city.landmarks[lm].y - p.y)) lm = k; });
  const L = city.landmarks[lm];
  grid.text(1, 0, where + ` LANDMARK ${landmarkName(city, lm)} ${Math.round(Math.hypot(L.x - p.x, L.y - p.y))}m ${compass(L.x - p.x, L.y - p.y)} `, [120, 220, 255], [8, 10, 14]);
  // the panel, while standing in a lift car; the chime when it arrives
  const nFloors = liftFloors(world);
  if (nFloors) {
    // a small sight in the middle, to aim at the panel's buttons
    const i = (grid.rows >> 1) * grid.cols + (grid.cols >> 1), on = pickedButton() >= 0;
    grid.put(i, '+'.charCodeAt(0), on ? 255 : 200, on ? 200 : 200, on ? 80 : 200);
  }
  if (wasRiding && p.liftTo < 0) { sound?.ding(); sound?.doors(); }
  if (!wasRiding && p.liftTo >= 0) sound?.doors();
  wasRiding = p.liftTo >= 0;
  sound?.liftMotor(p.liftTo >= 0 ? 1 : 0);
  // footsteps: one every stride, longer when running
  stride += Math.hypot(p.x - lastX, p.y - lastY);
  lastX = p.x; lastY = p.y;
  if (stride > (p.speed > 4 ? 2.6 : 1.6)) { stride = 0; sound?.step(p.inside >= 0, world.weather.wet, p.z % FLOOR_H > 0.05); }
  const W = world.weather;
  // indoors: office tubes buzz while the building has power
  let tubes = 0;
  if (p.inside >= 0 && isOffice(city.buildings[p.inside])) {
    const B = city.buildings[p.inside], P = world.power;
    tubes = power(P, P.building[p.inside], (B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, p.inside, P.generator[p.inside], (world.tick + alpha) / 60)[0];
  }
  sound?.traffic(world.cars, world.events, p.x, p.y, camera.yaw, world.weather.wet, world.tick, world.peds);
  sound?.update(world.city, p.x, p.y, camera.yaw, (world.tick + alpha) / 60, daylight(world.time), W, lightning(world.seed, world.time, W.snow ? 0 : W.precip, bolt)[1], world.power, p.inside >= 0, tubes);
  renderer.draw(grid);
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
document.fonts.load(`16px ${FONT}`).finally(() => {
  resize();
  requestAnimationFrame(frame);
});
