import { Sound } from './audio/sound';
import { Input } from './input';
import { drawPhone, keyAt, mapView } from './phone/draw';
import { BOOT_LOG_S, Phone, phoneKey, type Key } from './phone/phone';
import { drawPayphone, Payphone } from './phone/payphone';
import { type Sfx } from './phone/call';
import { Laptop, type LapSound } from './laptop/laptop';
import { drawLaptop } from './laptop/draw';
import en from './locale/en.json';
import { FONT } from './render/atlas';
import { Camera } from './render/camera';
import { GlyphRenderer, type Layout } from './render/glRenderer';
import { CharGrid } from './render/grid';
import { type Look } from './render/palette';
import { power } from './render/power';
import { pickedButton } from './render/interior';
import { renderWorld, VIEW_GLINT, VIEW_LIGHT, type View } from './render/raycaster';
import { RenderPool } from './render/pool';
import { intro, INTRO_S } from './render/intro';
import { daylight } from './render/sky';
import { operatorName, cityName, compass, diagonalName, districtName, districtType, landmarkName, roadName, sectorCode } from './locale/names';
import { diagS, districtAt, FLOOR_H, nearestRoad, SIDEWALK } from './sim/city';
import { calendar } from './sim/clock';
import { isOffice } from './sim/interior';
import { lightning, PRESETS } from './sim/weather';
import { callLift, createWorld, cycleWeather, debugFloor, liftFloors, skipHours, stepWorld, TICK, togglePower, type PlayerInput } from './sim/world';

/** The grid has this many rows (key R steps through them; more rows cost more to draw); columns follow the window shape. */
const RES_ROWS = [80, 100, 120, 160, 200];
let resStep = 1; // 100 rows on the main thread; 120 with the render workers (set below)
const ROWS = 80; // the bench's grid, kept the same to compare
/** The interface (phone, notebook, payphone, status lines) has its own grid, always this many rows: it keeps its size whatever the world's resolution. */
const UI_ROWS = 80;
/** Cell width / height, close to a monospace glyph. */
const CELL_ASPECT = 0.6;
/** Eye height in metres. */
const EYE = 1.7;
const MOUSE_SENS = 0.0022;

// ?seed=123 reproduces a city; otherwise every game rolls a new one. ?mute starts with the sound off.
const seedParam = new URLSearchParams(location.search).get('seed');
const seed = seedParam !== null ? Number(seedParam) | 0 : (Math.random() * 2 ** 31) | 0;
const world = createWorld(seed);
// the world is drawn by a pool of workers when the page allows shared memory (?workers=N sets how
// many, ?workers=0 draws on the main thread as before)
const workersParam = new URLSearchParams(location.search).get('workers');
const nWorkers = workersParam !== null ? Math.max(0, Number(workersParam) | 0) : Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 2));
const pool = nWorkers > 0 && RenderPool.available() ? new RenderPool(seed, undefined, nWorkers) : null;
if (pool) resStep = 2;

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const overlay = document.getElementById('overlay')!;
const renderer = new GlyphRenderer(canvas);
const input = new Input(canvas);
const camera = new Camera();
const phone = new Phone(world);
const payphone = new Payphone(world);
const laptop = new Laptop(world);
/** Eye height over the feet: lower while sitting at the notebook (or leaning on a counter). */
function eyeNow(): number {
  const s = laptop.seat, k = 1 - (1 - laptop.raise) ** 2;
  return s ? EYE + (s.eye - EYE) * k : EYE;
}
payphone.outgoing = () => phone.call;
phone.incomingCall = () => (payphone.call && payphone.active ? [payphone.call, world.telco.payphones[payphone.k].num] : null);
// the phone's camera sees the player's view
phone.render = (g) => renderWorld(g, world, { x: world.player.x, y: world.player.y, yaw: camera.yaw, pitch: camera.pitch, eye: eyeNow() + world.player.z, floor: viewFloor(), z: world.player.z, lift: world.player.liftTo >= 0, alpha: 0, cellAspect: layout.cellW / layout.cellH, look, hand: handLightNow() });
/** The light in the player's hand now: the camera's flash for a moment after a shot, the torch app while the phone is out. */
function handLightNow(): number {
  const t = performance.now() / 1000;
  if (t - phone.shotAt < 0.12) return 1.8;
  return phone.out && phone.torch() ? 0.6 : 0;
}
// Dev-only handles for testing from the browser console (pointer lock does not work in the app's preview pane).
// gridText(x0, y0, x1, y1) returns the glyphs of a screen region as text, to inspect detail the pane is too small to show.
if (import.meta.env.DEV) Object.assign(window, {
  world, camera, pickedButton, callLift, phone, payphone, laptop, VIEW_LIGHT, VIEW_GLINT, pool, RenderPool,
  // the world's characters; with ui = true the interface's (where it drew, else the world's under it at 80 rows)
  gridText: (x0 = 0, y0 = 0, x1?: number, y1?: number, onUi = false) => {
    const G = onUi ? ui : grid;
    x1 ??= G.cols; y1 ??= G.rows;
    let s = '';
    for (let y = y0; y < y1; y++) { for (let x = x0; x < x1; x++) s += String.fromCharCode(G.bg[(y * G.cols + x) * 4 + 3] || !onUi ? G.cells[(y * G.cols + x) * 4] : 32); s += '\n'; }
    return s;
  },
  // renders the current view n times without the frame loop (it stops while the pane is hidden); returns the mean ms
  // on a 256x80 grid of its own, as in a 16:9 window
  bench: (n = 10) => {
    const p = world.player, g = new CharGrid(256, ROWS), t0 = performance.now();
    for (let k = 0; k < n; k++) renderWorld(g, world, { x: p.x, y: p.y, yaw: camera.yaw, pitch: camera.pitch, eye: eyeNow() + p.z, floor: viewFloor(), z: p.z, lift: p.liftTo >= 0, alpha: 0, cellAspect: 0.6, look });
    return (performance.now() - t0) / n;
  },
});
let grid: CharGrid;
/** With the pool: the last world frame the workers finished, copied under the overlays every refresh. */
let shown: CharGrid;
let layout: Layout;
/** The interface's layer over the world, and its layout (UI_ROWS rows). */
let ui: CharGrid;
let uiLayout: Layout;
let running = false;
// display switches: B steps the solid background darker until it is off, U the block glyphs
const SOLID = [0.24, 0.16, 0.08, 0];
let solidStep = 0; // 0.24 ("1/3"), the user's pick
const look: Look = { solid: SOLID[solidStep], blocks: false, sharp: 0, fuse: false };
// the phone's keys (see phone.ts): sounds, and the slide back into the pocket
function phonePress(pk: Key) {
  const was = phone.screen, now = performance.now() / 1000, done = phone.press(pk, now, ...mapView(uiLayout.cellW / uiLayout.cellH, phone.zoom, world.player.inside >= 0));
  // keypad tones as the settings say: none in silent or with them off, the dome's click only, or a
  // tone (touch-tones on the dialer, or on every digit); a call fails for want of a network
  const pr = phone.prefs;
  if (pr.profile !== 2 && pr.keys !== 3) {
    if (done && /^[0-9*#]$/.test(pk) && (pr.keys === 2 || (pr.keys === 0 && was === 'calls'))) sound?.dtmf(pk);
    else sound?.phoneKey(/^\d$/.test(pk), done !== false, pr.keys !== 1);
  }
  if (done === 'away') sound?.phoneSlide(false);
}
/** Sounds the phones asked for. */
function playSfx(list: Sfx[]) {
  for (const f of list) {
    if (!sound) break;
    switch (f[0]) {
      case 'fail': sound.callFail(); break;
      case 'stop': sound.stopRing(); break;
      case 'sms': if (phone.prefs.profile === 0) sound.smsTone(); else if (phone.prefs.profile === 1) sound.vibrate(0.8); break;
      case 'sent': if (phone.prefs.profile === 0) sound.sentTone(); break;
      case 'hook': sound.hook(); break;
      case 'bell': {
        const q = world.telco.payphones[f[1]], p = world.player, dx = q.x - p.x, dy = q.y - p.y;
        sound.bell(Math.hypot(dx, dy), Math.sin(Math.atan2(dy, dx) - camera.yaw));
        break;
      }
      case 'shutter': if (phone.prefs.profile === 0) sound.shutter(); break;
      case 'coin': sound.coin(); break;
      case 'coins': sound.coinsBack(); break;
      case 'ringback': sound.ringback(); break;
      case 'busy': sound.busy(); break;
      case 'intercept': sound.intercept(); break;
      case 'click': sound.stopRing(); sound.hangClick(); break;
      case 'beep': sound.beep(true); break;
      case 'hold': sound.holdMusic(f[1]); break;
      case 'voice': sound.voice(f[1], f[2], f[3]); break;
    }
  }
  list.length = 0;
}
let lapSpin = 0, relock = false;
/** Sounds the notebook asked for. */
function playLap(list: LapSound[]) {
  for (const f of list) {
    if (!sound) break;
    switch (f) {
      case 'key': case 'space': case 'enter': sound.lapKey(f); break;
      case 'zip': sound.zipper(); break;
      case 'open': sound.lid(true); break;
      case 'close': sound.lid(false); break;
      case 'seek': sound.seek(); break;
      case 'beep': sound.biosBeep(); break;
      case 'power': sound.powerClick(); break;
      case 'spin': sound.hddSpinUp(); break;
      case 'spindown': sound.hddPark(); break; // the hum follows the power (laptopHum)
    }
  }
  list.length = 0;
}
function phoneToggle() {
  const r = phone.toggle(performance.now() / 1000);
  // with the phone out the system cursor is free to click its keys; put away, the view takes the mouse again
  if (r === 'in') input.lock(); else input.unlock();
  sound?.phoneSlide(r !== 'in');
  if (r === 'boot') sound?.phoneBoot(0.35 + BOOT_LOG_S);
}
// with the phone out the mouse moves a cursor: a click on one of its keys presses it, the left
// button elsewhere is OK and a click of the right one Back (as in GTA IV); holding the right button
// looks around instead. The middle button takes the phone out and puts it away.
// Otherwise, in a lift car, aim at a button of its panel and click it.
// no browser menu on the right button (it is Back and look-around): stopped early, on the canvas and the document
const noMenu = (e: Event) => { e.preventDefault(); e.stopPropagation(); return false; };
document.addEventListener('contextmenu', noMenu, true);
canvas.addEventListener('contextmenu', noMenu, true);
canvas.oncontextmenu = noMenu;
// the mouse wheel zooms the phone's map, steps through the menu's apps and scrolls its lists
addEventListener('wheel', (e) => {
  if (laptop.open && e.deltaY) { laptop.scroll(-Math.sign(e.deltaY) * 3); return; }
  if (!phone.out || !e.deltaY) return;
  const d = Math.sign(e.deltaY);
  if (phone.screen === 'map') { if (phone.setZoom(phone.zoom + d, performance.now() / 1000)) sound?.phoneKey(false); return; }
  phonePress(phone.screen === 'menu' ? (d > 0 ? 'right' : 'left') : d > 0 ? 'down' : 'up');
});
/** The right button held down: since when, and how far the mouse went (a short still click is Back). */
let rightAt = -1, rightMoved = 0;
/** The interface's cell under the system cursor. */
function cellAtClient(cx: number, cy: number): [number, number] {
  const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1, L = uiLayout;
  return [Math.floor(((cx - r.left) * dpr - L.originX) / L.cellW), Math.floor(((cy - r.top) * dpr - L.originY) / L.cellH)];
}
addEventListener('mousemove', (e) => { [phone.cx, phone.cy] = cellAtClient(e.clientX, e.clientY); });
/** A payphone's key pressed: its sound, and the payphone. */
function payPress(k: Key) {
  if (/^[0-9*#]$/.test(k)) sound?.dtmf(k); else sound?.phoneKey(false);
  payphone.press(k, performance.now() / 1000);
  if (!payphone.active) input.lock();
}
addEventListener('mousedown', (e) => {
  if (relock && !laptop.open) { relock = false; if (running && !phone.out && !payphone.active && e.button !== 1) input.lock(); }
  if (e.button === 2) e.preventDefault();
  if (!running) return;
  if (laptop.open) {
    // the middle button puts the notebook away too (a click can lock the pointer again at once)
    if (e.button === 1) { e.preventDefault(); laptop.close(performance.now() / 1000); input.lock(); return; }
    if (e.button === 2) { rightAt = performance.now(); rightMoved = 0; input.drag = true; input.lock(); }
    return;
  }
  if (e.button === 1) { e.preventDefault(); if (!payphone.active) phoneToggle(); return; }
  if (payphone.active) {
    if (e.button === 0) { const [x, y] = cellAtClient(e.clientX, e.clientY), k = payphone.keyAt(ui.cols, ui.rows, x, y); if (k) payPress(k); }
    else if (e.button === 2) { rightAt = performance.now(); rightMoved = 0; input.drag = true; input.lock(); }
    return;
  }
  if (phone.out) {
    if (e.button === 0) {
      const [x, y] = cellAtClient(e.clientX, e.clientY);
      phonePress(keyAt(ui.cols, ui.rows, phone, x, y) ?? 'ok');
    } else if (e.button === 2) { rightAt = performance.now(); rightMoved = 0; input.drag = true; input.lock(); }
    return;
  }
  if (!input.locked) return;
  if (e.button !== 0 || !liftFloors(world)) return;
  const b = pickedButton();
  if (b >= 0) sound?.beep(callLift(world, b));
});
// the lock arrives a moment after it is asked for: if the right button is already up, free the cursor again
document.addEventListener('pointerlockchange', () => { if (input.locked && rightAt < 0 && (phone.out || payphone.active || laptop.open)) input.unlock(); });
addEventListener('mouseup', (e) => {
  if (e.button !== 2 || rightAt < 0) return;
  if (phone.out && !payphone.active && !laptop.open && performance.now() - rightAt < 300 && rightMoved < 40) phonePress('rsoft');
  rightAt = -1; input.drag = false;
  // the pointer was held while looking around; the cursor is free again over the phone or the payphone,
  // a moment later: freed during the click, the browser could still open its menu where the cursor lands
  if (phone.out || payphone.active || laptop.open) setTimeout(() => { if (rightAt < 0 && (phone.out || payphone.active || laptop.open)) input.unlock(); }, 60);
});
addEventListener('keydown', (e) => {
  // the browser does not lock the pointer from Esc: after closing the notebook the next key (or click) does
  if (relock && !laptop.open) { relock = false; if (running && !phone.out && !payphone.active && !input.locked) input.lock(); }
  // the notebook open takes the whole keyboard; Esc closes the lid and stands up
  if (laptop.open) {
    e.preventDefault();
    if (e.code === 'Escape' && !laptop.shell.fw.mode) { if (!e.repeat) { laptop.close(performance.now() / 1000); input.lock(); relock = true; } return; }
    if (e.repeat && !['Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete'].includes(e.code) && e.key.length !== 1) return;
    laptop.key(e.code, e.key, e.ctrlKey, performance.now() / 1000);
    return;
  }
  // N: take the notebook out, where it can be used (sitting or leaning)
  if (e.code === 'KeyN' && running && !e.repeat && !payphone.active && laptop.raise === 0) {
    if (phone.out) phoneToggle();
    if (laptop.take(performance.now() / 1000)) input.unlock();
    return;
  }
  // a payphone in use takes the keys; F lifts the handset of the one in front, or hangs it up
  if (e.code === 'KeyF' && running && !e.repeat) {
    if (payphone.active) { payphone.close(); input.lock(); return; }
    const k = payphone.near();
    if (k >= 0 && !phone.out) { payphone.open(k); input.unlock(); return; }
  }
  const pp = payphone.active ? phoneKey(e.code, e.key) : null;
  if (pp) { e.preventDefault(); if (!e.repeat) payPress(pp); return; }
  // the phone: Up (or P) takes it out; while it is out, its keys (see phone.ts)
  const pk = phone.out ? phoneKey(e.code, e.key) : null;
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
  else if (e.code === 'KeyV') look.sharp = (look.sharp + 1) % 4;
  else if (e.code === 'KeyG') look.fuse = !look.fuse;
  else if (e.code === 'KeyR') { resStep = (resStep + 1) % RES_ROWS.length; resize(); }
  // debug: T / shift+T move the clock an hour, Y steps through the weather presets
  else if (e.code === 'KeyT') skipHours(world, e.shiftKey ? -1 : 1);
  else if (e.code === 'KeyY') cycleWeather(world);
  // debug: K switches the nearest substation (shift: all of them)
  else if (e.code === 'KeyK') togglePower(world, e.shiftKey);
  // debug: PageUp / PageDown move a storey up or down inside a building
  else if (e.code === 'PageUp' || e.code === 'PageDown') debugFloor(world, e.code === 'PageUp' ? 1 : -1);
});

function computeLayout(rows: number): Layout {
  const dpr = devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  canvas.width = w; canvas.height = h;
  const cellH = Math.max(4, Math.floor(h / rows));
  const cellW = Math.max(3, Math.round(cellH * CELL_ASPECT));
  const cols = Math.floor(w / cellW);
  return { cols, rows, cellW, cellH, originX: (w - cols * cellW) >> 1, originY: (h - rows * cellH) >> 1 };
}

function resize() {
  layout = computeLayout(RES_ROWS[resStep]);
  uiLayout = computeLayout(UI_ROWS);
  grid = new CharGrid(layout.cols, layout.rows);
  ui = new CharGrid(uiLayout.cols, uiLayout.rows);
  shown = new CharGrid(layout.cols, layout.rows);
  pool?.resize(layout.cols, layout.rows);
  renderer.setLayout(layout, uiLayout);
}

function readInput(): PlayerInput {
  // the up and down arrows belong to the phone (as in GTA IV); WASD walk
  const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
  const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
  const go = running && laptop.raise === 0;
  return { forward: go ? f : 0, strafe: go ? s : 0, run: input.down('ShiftLeft', 'ShiftRight'), heading: camera.yaw };
}

// audio can only start from a click, so it is made on entering the city
let sound: Sound | null = null;
/** The storey drawn around the viewer: on the stairs, the one above once past the middle landing. */
const viewFloor = () => (world.player.liftTo >= 0 ? world.player.floor : Math.floor((world.player.z + FLOOR_H / 2) / FLOOR_H));
let wasRiding = false, stride = 0, lastX = 0, lastY = 0;

/** When the player first entered the city (the opening plays from there), or -1. */
let introAt = -1;
function begin() {
  if (!sound) { sound = new Sound(); if (new URLSearchParams(location.search).has('mute')) sound.toggleMute(); }
  sound.resume();
  if (introAt < 0) { introAt = performance.now() / 1000; sound.intro(); }
  overlay.hidden = true;
  running = true;
  input.lock();
}
overlay.addEventListener('click', begin);
canvas.addEventListener('click', () => { if (!input.locked && !phone.out && !laptop.open) input.lock(); });

const bolt = new Float64Array(2);
let last = performance.now();
let acc = 0;
let fps = 60;
/** Time spent drawing the world: smoothed, and the worst of the last second. */
let renderMs = 0, worstMs = 0, worstShown = 0, worstAt = 0;
/** World frames shown a second (with the pool they can lag the screen's refreshes), and the count this second. */
let worldFps = 0, worldFrames = 0, worldAt = 0;

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;

  // camera first, so this frame's movement uses the heading the player sees
  const [mx, my] = input.takeMouse();
  camera.look(mx * MOUSE_SENS, -my * MOUSE_SENS);
  if (rightAt >= 0) rightMoved += Math.abs(mx) + Math.abs(my);
  const turn = (input.down(phone.out ? 'KeyE' : 'ArrowRight', 'KeyE') ? 1 : 0) - (input.down(phone.out ? 'KeyQ' : 'ArrowLeft', 'KeyQ') ? 1 : 0);
  if (running) { if (!laptop.open) camera.look(turn * 2.2 * dt, 0); }
  else camera.look(dt * 0.08, 0); // idle drift behind the title
  camera.update(dt);

  // fixed-step simulation, independent of the frame rate
  acc += dt;
  const cmd = readInput();
  while (acc >= TICK) { stepWorld(world, cmd); acc -= TICK; }
  const alpha = acc / TICK;

  const p = world.player;
  const view: View = {
    x: p.px + (p.x - p.px) * alpha,
    y: p.py + (p.y - p.py) * alpha,
    yaw: camera.yaw,
    pitch: camera.pitch,
    eye: eyeNow() + p.z,
    floor: viewFloor(),
    z: p.z,
    lift: p.liftTo >= 0,
    alpha,
    cellAspect: layout.cellW / layout.cellH,
    look,
    hand: handLightNow(),
  };
  let ms: number;
  if (pool) {
    // the workers draw the next frame while this one shows the last they finished
    if (pool.frame(world, view, shown)) worldFrames++;
    grid.cells.set(shown.cells); grid.bg.set(shown.bg);
    ms = pool.ms;
  } else {
    const r0 = performance.now();
    renderWorld(grid, world, view);
    ms = performance.now() - r0;
    worldFrames++;
  }
  if (now - worldAt > 1000) { worldFps = (worldFrames * 1000) / (now - worldAt); worldFrames = 0; worldAt = now; }
  ui.wipe();
  phone.light = (VIEW_LIGHT[0] + VIEW_LIGHT[1] + VIEW_LIGHT[2]) / 3;
  phone.update(dt, now / 1000);
  // a code dialing itself (from the debug settings), and the sounds the phone asked for
  const ak = phone.out ? phone.autoKey(now / 1000) : null;
  if (ak) phonePress(ak);
  for (const [k] of world.doorSfx) sound?.swing(k > 0);
  world.doorSfx.length = 0;
  payphone.update(now / 1000);
  payphone.hover = payphone.active ? payphone.keyAt(ui.cols, ui.rows, phone.cx, phone.cy) : null;
  playSfx(phone.sfx);
  playSfx(payphone.sfx);
  drawPayphone(ui, payphone, world, now / 1000, VIEW_LIGHT);
  // a payphone in front: how to use it
  const nearPay = !phone.out && !payphone.active && payphone.near() >= 0;
  if (nearPay || payphone.active) { const s = ` ${nearPay ? en.phone.payphone.use : en.phone.payphone.leave} `; ui.text((ui.cols - s.length) >> 1, ui.rows - 6, s, [255, 220, 140], [20, 16, 10]); }
  if (phone.cue) { if (phone.cue === 'ring') sound?.ring(phone.prefs.ring); else if (phone.cue === 'vibrate') sound?.vibrate(); else sound?.stopRing(); phone.cue = null; }
  phone.hover = phone.out ? keyAt(ui.cols, ui.rows, phone, phone.cx, phone.cy) : null;
  drawPhone(ui, phone, world, uiLayout.cellW / uiLayout.cellH, now / 1000, VIEW_LIGHT, VIEW_GLINT);
  // the notebook: its schedule, its sounds, the drive's hum, and on screen
  laptop.update(dt, now / 1000);
  playLap(laptop.sfx);
  const lapOn = laptop.lid > 0 && laptop.pc.bootAt >= 0 && laptop.shell.state !== 'off';
  lapSpin += ((lapOn ? 1 : 0) - lapSpin) * Math.min(1, dt / (lapOn ? 2.5 : 1.5));
  sound?.laptopHum(lapOn || lapSpin > 0.05, lapSpin, laptop.pc.fan);
  drawLaptop(ui, laptop, world, now / 1000, VIEW_LIGHT);
  if (!laptop.open && now / 1000 - laptop.noticeAt < 2.5) { const s = ` ${laptop.notice} `; ui.text((ui.cols - s.length) >> 1, ui.rows - 6, s, [255, 220, 140], [20, 16, 10]); }
  renderMs += (ms - renderMs) * 0.05;
  worstMs = Math.max(worstMs, ms);
  if (now - worstAt > 1000) { worstShown = worstMs; worstMs = 0; worstAt = now; }
  const status = ` SEED ${seed}  POS ${p.x.toFixed(1)},${p.y.toFixed(1)}  ${p.inside >= 0 ? `INSIDE FLOOR ${p.floor}  ` : ''}${p.speed > 4 ? 'RUN ' : 'WALK'} ${p.speed.toFixed(1)} m/s  GRID ${grid.cols}x${grid.rows}  ${Math.round(fps)} FPS (WORLD ${Math.round(worldFps)}, ${pool ? `${pool.n} WORKERS` : 'MAIN'})  DRAW ${renderMs.toFixed(1)} ms (MAX ${worstShown.toFixed(1)})  `
    + `[P] PHONE  [N] LAPTOP  [B] BG ${look.solid ? `${solidStep + 1}/${SOLID.length - 1}` : 'OFF'}  [U] ${look.blocks ? 'BLOCKS' : 'ASCII'}  [V] ${['SOFT', 'SHARP', 'SHARPER', 'SHARPEST'][look.sharp]}  [G] FUSE ${look.fuse ? 'ON' : 'OFF'}  [R] ROWS ${RES_ROWS[resStep]}  [M] SOUND ${sound && !sound.muted ? 'ON' : 'OFF'} `;
  ui.text(1, ui.rows - 1, status, [255, 176, 74], [12, 10, 8]);
  const cal = calendar(world.time), wx = world.weather;
  const clock = ` ${cal.year}-${String(cal.month).padStart(2, '0')}-${String(cal.day).padStart(2, '0')} ${String(Math.floor(cal.hour)).padStart(2, '0')}:${String(Math.floor((cal.hour % 1) * 60)).padStart(2, '0')}  `
    + `${wx.preset >= 0 ? PRESETS[wx.preset][0].toUpperCase() : 'AUTO'} CLOUD ${Math.round(wx.cloud * 100)}% ${wx.precip > 0 ? `${wx.snow ? 'SNOW' : 'RAIN'} ${Math.round(wx.precip * 100)}% ` : ''}${wx.temp.toFixed(0)}C WIND ${Math.hypot(wx.windX, wx.windY).toFixed(0)} m/s  [T] +1H [Y] SKY  POWER ${world.power.subs.filter((s) => s.on).length}/${world.power.subs.length} [K] `;
  ui.text(ui.cols - clock.length - 1, ui.rows - 2, clock, [120, 220, 255], [8, 10, 14]);
  const { city } = world, d = districtAt(city, p.x, p.y);
  const where = ` ${cityName(city).toUpperCase()} / ${districtName(city, d).toUpperCase()} (${districtType(city, d)})  SECTOR ${sectorCode(city, p.x, p.y)}  `
    + `${Math.abs(diagS(city.diagonal, p.x, p.y)) < city.diagonal.w / 2 + SIDEWALK ? diagonalName(city) : roadName(city, true, nearestRoad(city.xb, city.xCell, p.x))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, p.y))} `;
  let lm = 0;
  city.landmarks.forEach((l, k) => { if (Math.hypot(l.x - p.x, l.y - p.y) < Math.hypot(city.landmarks[lm].x - p.x, city.landmarks[lm].y - p.y)) lm = k; });
  const L = city.landmarks[lm];
  ui.text(1, 0, where + ` LANDMARK ${landmarkName(city, lm)} ${Math.round(Math.hypot(L.x - p.x, L.y - p.y))}m ${compass(L.x - p.x, L.y - p.y)} `, [120, 220, 255], [8, 10, 14]);
  // the panel, while standing in a lift car; the chime when it arrives
  const nFloors = liftFloors(world);
  if (nFloors) {
    // a small sight in the middle, to aim at the panel's buttons
    const i = (ui.rows >> 1) * ui.cols + (ui.cols >> 1), on = pickedButton() >= 0;
    ui.put(i, '+'.charCodeAt(0), on ? 255 : 200, on ? 200 : 200, on ? 80 : 200);
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
  // the opening, over everything the first seconds
  if (introAt >= 0 && now / 1000 - introAt < INTRO_S) {
    const c = calendar(world.time), hh = String(Math.floor(c.hour)).padStart(2, '0'), mm = String(Math.floor((c.hour % 1) * 60)).padStart(2, '0');
    ui.wipe();
    intro(grid, now / 1000 - introAt, [
      cityName(city).toUpperCase(),
      `${districtName(city, d).toUpperCase()}  ${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')} ${hh}:${mm}`,
      `${operatorName(city).toUpperCase()} ... SIGNAL OK`,
    ]);
  }
  renderer.draw(grid, ui);
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
document.fonts.load(`16px ${FONT}`).finally(() => {
  resize();
  requestAnimationFrame(frame);
});
