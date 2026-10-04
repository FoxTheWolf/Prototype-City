import { Sound } from './audio/sound';
import { Input } from './input';
import { drawPhone, keyAt, mapView, SCREEN as PHONE_SCREEN } from './phone/draw';
import { BOOT_LOG_S, Phone, phoneKey, type Key } from './phone/phone';
import { drawPayphone, Payphone } from './phone/payphone';
import { type Sfx } from './phone/call';
import { Laptop, type LapSound } from './laptop/laptop';
import { drawWatch, Watch, WATCH_ON } from './watch/watch';
import { drawLaptop3d, glassBox, laptopAnchor, laptopPitch, power3d, screenAt } from './laptop/look3d';
import { TERM_H, TERM_W } from './laptop/shell';
import en from './locale/en.json';
import { FONT } from './render/atlas';
import { Camera } from './render/camera';
import { GlyphRenderer, type Layout } from './render/glRenderer';
import { CharGrid } from './render/grid';
import { type Look } from './render/palette';
import { power } from './render/power';
import { pickedButton } from './render/interior';
import { VIEW_GLINT, VIEW_LIGHT, type View } from './render/raycaster';
import { GpuWorld } from './render/gpu/world';
import { GpuCompositor } from './render/gpu/compositor';
import { intro, INTRO_S } from './render/intro';
import { HD, HdLayer } from './render/hd';
import { setHd } from './phone/lcd';
import { daylight } from './render/sky';
import { cctvLook } from './render/cctv';
import { CAMS, cctvYaw } from './sim/cctv';
import { cctvMakerName, watchMakerName } from './locale/names';
import { spawnPeds } from './sim/peds';
import { businessName, operatorName, cityName, compass, diagonalName, districtName, districtType, landmarkName, roadName, sectorCode } from './locale/names';
import { diagS, districtAt, FLOOR_H, nearestRoad, SIDEWALK } from './sim/city';
import { calendar, sunDir } from './sim/clock';
import { isOffice } from './sim/interior';
import { lightning, PRESETS } from './sim/weather';
import { callLift, cycleWeather, debugFloor, liftFloors, skipHours, stepWorld, TICK, togglePower, worldSteps, CITY_SIZE, type PlayerInput } from './sim/world';
import { tierOf } from './sim/heat'; // [HACKING]
import { loadPop, savePop } from './popCache';
import { pace } from './core/steps';
import TIPS from './locale/tips.json';
import TODAY_2008 from './locale/today2008.json';

/** The grid has this many rows (key R steps through them; more rows cost more to draw); columns follow the window shape. */
const RES_ROWS = [80, 120, 200];
let resStep = 2;
/** The rows a security camera's model shows while looking through it (0: the player's own, RES_ROWS[resStep]). */
let camRows = 0;
/** The interface (phone, notebook, payphone, status lines) has its own grid, always this many rows: it keeps its size whatever the world's resolution. */
const UI_ROWS = 80;
/** Cell width / height, close to a monospace glyph. */
const CELL_ASPECT = 0.6;
/** Eye height in metres. */
const EYE = 1.7;
const MOUSE_SENS = 0.0022;

/** The loading bar on the title screen: how far (0..1) and what is being done; at 1 the buttons show. */
function load(f: number, what: string) {
  const L = document.getElementById('loading')!;
  (L.querySelector('.fill') as HTMLElement).style.transform = `scaleX(${f})`;
  L.querySelector('.what')!.textContent = `${what} ${'.'.repeat(1 + (Math.floor(performance.now() / 300) % 3))}`;
  L.querySelector('.pct')!.textContent = `${Math.floor(f * 100)}%`;
  if (f >= 1) { L.hidden = true; document.getElementById('ready')!.hidden = false; }
}
load(0.02, 'BOOTING');
showTip();

/** A line under the bar: the first load of the day shows what happened on this date in 2008 (when the list has it); otherwise a tip or a fact of 2008. */
function showTip() {
  const now = new Date(), key = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const today = (TODAY_2008.days as Record<string, { text: string }[]>)[key];
  let first = false;
  try { first = localStorage.getItem('tc.tipDay') !== key; localStorage.setItem('tc.tipDay', key); } catch { /* no storage: treat as seen */ }
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  let head: string, text: string;
  if (first && today?.length) { head = `${TIPS.today} · ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`; text = pick(today).text; }
  else if (TODAY_2008.facts.length && Math.random() < 0.35) { head = TIPS.fact; text = (pick(TODAY_2008.facts) as { text: string }).text; }
  else { head = TIPS.tip; text = pick(TIPS.tips); }
  const el = document.getElementById('tip')!;
  el.querySelector('.head')!.textContent = head;
  el.querySelector('.text')!.textContent = text;
}

// ?seed=123 reproduces a city; otherwise every game rolls a new one. ?mute starts with the sound off.
const seedParam = new URLSearchParams(location.search).get('seed');
const seed = seedParam !== null ? Number(seedParam) | 0 : (Math.random() * 2 ** 31) | 0;
// the city is made in steps, the page alive between them, with a bar on the title screen (load)
const savedPop = await loadPop(seed);
const world = await pace(worldSteps(seed, CITY_SIZE, true, savedPop), (f) => load(0.04 + 0.84 * f, f < 0.05 ? 'LAYING OUT STREETS' : f < 0.1 ? 'WIRING THE GRID' : 'REGISTERING CITIZENS'));
if (!savedPop) void savePop(seed, world.pop);
// the world is drawn on the GPU (WebGPU; stage R), from the moment the device is ready. Its compositor
// draws on a canvas of its own over the WebGL one (events pass through to the WebGL canvas), which
// still shows the cameras' monitor and the opening (pictures read back from the GPU and worked on here)
let gpu: GpuWorld | null = null, comp: GpuCompositor | null = null;
const gpuCanvas = document.createElement('canvas');
Object.assign(gpuCanvas.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', pointerEvents: 'none', display: 'none' });

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const overlay = document.getElementById('overlay')!;
const renderer = new GlyphRenderer(canvas);
const input = new Input(canvas);
const camera = new Camera();
const phone = new Phone(world);
const payphone = new Payphone(world);
const laptop = new Laptop(world);
const watch = new Watch();
/** Eye height over the feet: lower while sitting at the notebook (or leaning on a counter). */
function eyeNow(): number {
  const s = laptop.seat, k = 1 - (1 - laptop.raise) ** 2;
  return s ? EYE + (s.eye - EYE) * k : EYE;
}
payphone.outgoing = () => phone.call;
phone.incomingCall = () => (payphone.call && payphone.active ? [payphone.call, world.telco.payphones[payphone.k].num] : null);
/**
 * View v drawn into g, for what works on the picture on the CPU: read back from a recent GPU frame of
 * g's size under `key` (false before one has landed; see GpuWorld.shot).
 */
function drawInto(g: CharGrid, v: View, key: string, tag?: string): boolean {
  const s = gpu?.shot(`${key} ${g.cols}x${g.rows}`, world, v, g.cols, g.rows, tag);
  if (s) { g.cells.set(s.cells); g.bg.set(s.bg); }
  return !!s;
}
// the phone's camera sees the player's view
phone.render = (g, k = 1) => drawInto(g, { x: world.player.x, y: world.player.y, yaw: camera.yaw, pitch: camera.pitch, eye: eyeNow() + world.player.z, floor: viewFloor(), z: world.player.z, lift: world.player.liftTo >= 0, alpha: 0, cellAspect: (layout.cellW / layout.cellH) * k, look, hand: handLightNow() }, 'camera');
// Streetwire's photos: the city seen from where a post's author stood
phone.shoot = (g, x, y, yaw, eye = 1.6, pitch = 0.06) => drawInto(g, { x, y, yaw, pitch, eye, floor: 0, z: 0, lift: false, alpha: 0, cellAspect: layout.cellW / layout.cellH, look }, 'shoot', `${x} ${y} ${yaw} ${eye} ${pitch}`);
/** The light in the player's hand now: the camera's flash for a moment after a shot, the torch app while the phone is out. */
function handLightNow(): number {
  const t = performance.now() / 1000;
  if (t - phone.shotAt < 0.12) return 1.8;
  return phone.out && phone.torch() ? 0.6 : 0;
}
// Dev-only handles for testing from the browser console (pointer lock does not work in the app's preview pane).
// gridText(x0, y0, x1, y1) returns the glyphs of a screen region as text, to inspect detail the pane is too small to show.
if (import.meta.env.DEV) Object.assign(window, {
  world, camera, pickedButton, callLift, phone, payphone, laptop, VIEW_LIGHT, VIEW_GLINT, gpuNow: () => gpu, compNow: () => comp,
  // the GPU world's characters (J on), read back from its output buffer, to compare with gridText
  gpuText: async (x0 = 0, y0 = 0, x1?: number, y1?: number) => {
    if (!gpu) return '';
    const g = gpu, size = g.cols * g.rows * 8, st = g.dev.createBuffer({ size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const e = g.dev.createCommandEncoder(); e.copyBufferToBuffer(g.out, 0, st, 0, size); g.dev.queue.submit([e.finish()]);
    await st.mapAsync(GPUMapMode.READ);
    const a = new Uint32Array(st.getMappedRange().slice(0)); st.destroy();
    x1 ??= g.cols; y1 ??= g.rows;
    let s = '';
    for (let y = y0; y < y1; y++) { for (let x = x0; x < x1; x++) { const c = a[y * g.cols + x] & 255; s += c < 33 ? ' ' : String.fromCharCode(c); } s += '\n'; }
    return s;
  },
  // watch camera k as on the title (stopCctv to leave)
  watchCam: (k: number) => { stopCctv(); startCctv(true, k); goToCam(k); }, stopCctv: () => stopCctv(),
  // the world's characters; with ui = true the interface's (where it drew, else the world's under it at 80 rows)
  gridText: (x0 = 0, y0 = 0, x1?: number, y1?: number, onUi = false) => {
    const G = onUi ? ui : grid;
    x1 ??= G.cols; y1 ??= G.rows;
    let s = '';
    for (let y = y0; y < y1; y++) { for (let x = x0; x < x1; x++) s += String.fromCharCode(G.bg[(y * G.cols + x) * 4 + 3] || !onUi ? G.cells[(y * G.cols + x) * 4] : 32); s += '\n'; }
    return s;
  },
});
let grid: CharGrid;
let layout: Layout;
/** The interface's layer over the world, and its layout (UI_ROWS rows). */
let ui: CharGrid;
/** The HD layer: pixels at HD x the interface's grid (the phone's photos). */
let hd: HdLayer;
/**
 * The notebook's screen layer (3D look): the system's console, TERM_W x TERM_H, or the firmware's
 * text mode, 80 x 25, each with its cell size so both fill the same 16:10 screen, about two thirds of
 * the view's height; which one is shown, as on a real PC, follows what runs (the firmware, a
 * full-screen program, or the console).
 */
const TEXT_MODE = [80, 25] as const;
/** The notebook screen's shape: 16:10, as the widescreen notebooks of 2008 (1280 x 800). */
const TERM_ASPECT = 16 / 10;
let termFb: CharGrid, termTx: CharGrid, termCells: Record<'fb' | 'tx', [number, number]> = { fb: [8, 16], tx: [16, 32] }, termMode: 'fb' | 'tx' | '' = '';
function termLayout() {
  const w = canvas.width, h = canvas.height;
  // whole pixels a cell, as near the screen's shape (TERM_ASPECT) as they come: from the height (about two
  // thirds of the view's), or from the width if that is too wide
  let ch = Math.max(5, Math.floor((h * 0.68) / TERM_H)), cw = Math.max(3, Math.round((ch * TERM_H * TERM_ASPECT) / TERM_W));
  if (cw * TERM_W > w * 0.94) { cw = Math.max(3, Math.floor((w * 0.94) / TERM_W)); ch = Math.max(5, Math.round((cw * TERM_W) / (TERM_ASPECT * TERM_H))); }
  // the text mode's cells are the console's doubled (80 x 25 against 160 x 50), so both fill exactly the
  // same glass: the notebook stays where it is when the firmware hands over to the system
  const fb: [number, number] = [cw, ch];
  termCells = { fb, tx: [fb[0] * (TERM_W / TEXT_MODE[0]), fb[1] * (TERM_H / TEXT_MODE[1])] };
  termMode = '';
}
let uiLayout: Layout;
let running = false;
let lapWasOpen = false;
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
// looks around instead. The middle button (or P) takes the phone out and lowers it; on the standby screen it opens the dialer.
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
    // the phone stays usable by the mouse over the notebook (a call coming in, or taken out before):
    // a click on one of its keys presses it, and takes it into the hand if it was only up for the call
    if (e.button === 0 && phone.raise > 0.5) {
      const [x, y] = cellAtClient(e.clientX, e.clientY), k = keyAt(ui.cols, ui.rows, phone, x, y);
      if (k) { if (!phone.out) phone.out = true; phonePress(k); return; }
    }
    // the notebook's power button
    const pw = power3d;
    if (e.button === 0 && pw) {
      const [x, y] = cellAtClient(e.clientX, e.clientY);
      // off, it powers on (Enter is the same button); on, it halts the system (or cuts the power outside it)
      if (x >= pw[0] && x < pw[2] && y >= pw[1] && y < pw[3]) {
        if (laptop.shell.halted) laptop.key('Enter', 'Enter', false, performance.now() / 1000);
        else { laptop.shell.powerButton(performance.now() / 1000); sound?.powerClick(); }
      }
    }
    return;
  }
  // the middle button: takes the phone out; on the standby screen it opens the dialer; elsewhere it
  // lowers the phone, which keeps its screen and state for when it comes up again
  if (e.button === 1) { e.preventDefault(); if (!payphone.active) { if (phone.out && phone.screen === 'standby') phonePress('up'); else phoneToggle(); } return; }
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
  // the 3D notebook: let go, the view comes back to it, its screen centred
  if (laptop.open) { camera.targetYaw = laptopAnchor(); camera.targetPitch = laptopPitch(); }
  // the pointer was held while looking around; the cursor is free again over the phone or the payphone,
  // a moment later: freed during the click, the browser could still open its menu where the cursor lands
  if (phone.out || payphone.active || laptop.open) setTimeout(() => { if (rightAt < 0 && (phone.out || payphone.active || laptop.open)) input.unlock(); }, 60);
});
addEventListener('keydown', (e) => {
  // F3 hides and shows the debug lines (for clean screenshots), whatever is in the hands
  if (e.code === 'F3') { e.preventDefault(); if (!e.repeat) hudOn = !hudOn; return; }
  // debug: F4 shows the view at noon, sunset and night side by side (to judge the colors)
  if (e.code === 'F4') { e.preventDefault(); if (!e.repeat) calib = !calib; return; }
  // watching the cameras: Esc leaves (to the title, or back to the game); in the game, C toggles the nearest
  if (cctv && (e.code === 'Escape' || (e.code === 'KeyC' && !cctv.title))) { stopCctv(); return; }
  if (cctv?.title) return;
  if (e.code === 'KeyC' && running && !laptop.open && !e.repeat) {
    const p = world.player;
    let best = -1, bd = 200;
    world.cctv.forEach((C, k) => { const d = Math.hypot(C.x - p.x, C.y - p.y); if (d < bd) { bd = d; best = k; } });
    if (best >= 0) startCctv(false, best);
    return;
  }
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
    if (laptop.take(performance.now() / 1000)) { input.unlock(); camera.targetPitch = laptopPitch(); }
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
  const pk = phone.out && e.code !== 'KeyP' ? phoneKey(e.code, e.key) : null;
  if (pk) {
    e.preventDefault();
    if (e.repeat && pk !== 'up' && pk !== 'down' && pk !== 'left' && pk !== 'right') return;
    phonePress(pk);
    return;
  }
  // the wristwatch's right button (I): held, it repeats while a field of the alarm is being set
  if (e.code === 'KeyI' && running && WATCH_ON) { watch.startDown(performance.now() / 1000, e.repeat); return; }
  if (e.repeat) return;
  // the wristwatch: H lowers it out of sight (and raises it), L lights it, J steps its mode
  if (e.code === 'KeyH' && running && WATCH_ON) { watch.toggle(); return; }
  if (e.code === 'KeyL' && running && WATCH_ON) { watch.light(performance.now() / 1000); return; }
  if (e.code === 'KeyJ' && running && WATCH_ON) { watch.modeKey(performance.now() / 1000); return; }
  if (e.code === 'ArrowUp' && !phone.out && running) phoneToggle();
  else if (e.code === 'KeyP' && running && !payphone.active) phoneToggle();
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

addEventListener('keyup', (e) => { if (e.code === 'KeyI' && WATCH_ON) watch.startUp(); });

/** `rows` sets the cell size; the grid then gets as many rows as fill the screen (no black bars, the phone on the bottom edge).
 *  cover: the world overfills by up to a cell (cut at the edges); the interface stays whole, the leftover (< a cell) on top. */
function computeLayout(rows: number, cover: boolean): Layout {
  const dpr = devicePixelRatio || 1;
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  canvas.width = w; canvas.height = h;
  const cellH = Math.max(4, Math.floor(h / rows));
  const cellW = Math.max(3, Math.round(cellH * CELL_ASPECT));
  const fit = cover ? Math.ceil : Math.floor;
  const cols = fit(w / cellW), n = fit(h / cellH);
  return { cols, rows: n, cellW, cellH, originX: (w - cols * cellW) >> 1, originY: cover ? (h - n * cellH) >> 1 : h - n * cellH };
}

function resize() {
  layout = computeLayout(camRows || RES_ROWS[resStep], true);
  uiLayout = computeLayout(UI_ROWS, false);
  grid = new CharGrid(layout.cols, layout.rows);
  ui = new CharGrid(uiLayout.cols, uiLayout.rows);
  hd = new HdLayer(uiLayout.cols * HD, uiLayout.rows * HD);
  termFb = new CharGrid(TERM_W, TERM_H); termTx = new CharGrid(TEXT_MODE[0], TEXT_MODE[1]);
  termLayout();
  setHd(hd);
  gpu?.resize(layout.cols, layout.rows);
  renderer.setLayout(layout, uiLayout);
  if (comp) { gpuCanvas.width = canvas.width; gpuCanvas.height = canvas.height; comp.setLayout(layout, uiLayout); }
  if (cctv) dvrLayout();
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
/** The debug lines (status, clock, substation, where): F3 hides them. */
let hudOn = true;
// [HACKING] the last arrest shown (its game time) and when (real time) the banner started, to time it
let bustSeen = -1, bustShownAt = 0;
/** Debug (F4): the same view at noon, at sunset and at night, side by side, to decide the palette by looking at it. */
let calib = false, calibTags: string[] = [];
const CALIB = ['NOON', 'SUNSET', 'NIGHT'];
/** Today's noon, the evening moment the sun is about 2 degrees up, and 11 pm. */
function calibTimes(t: number): number[] {
  const day0 = Math.floor(t / 86400) * 86400, sd = new Float64Array(2);
  let dusk = day0 + 18 * 3600, best = Infinity;
  for (let h = 14; h < 22; h += 1 / 12) { sunDir(day0 + h * 3600, sd); const e = Math.abs(sd[0] - 0.035); if (e < best) { best = e; dusk = day0 + h * 3600; } }
  return [day0 + 12 * 3600, dusk, day0 + 23 * 3600];
}
/** The three pictures into grid (each a third of its width), drawn with the clock moved to each time; their labels. */
function drawCalib(view: View): string[] {
  const w3 = Math.floor(grid.cols / 3), t0 = world.time, p0 = world.ptime, ts = calibTimes(t0);
  grid.clear();
  ts.forEach((t, k) => {
    world.time = world.ptime = t;
    const g = gpu?.shot(`calib${k}`, world, view, w3, grid.rows);
    if (g) for (let r = 0; r < grid.rows; r++) {
      const src = r * w3 * 4, dst = (r * grid.cols + k * w3) * 4;
      grid.cells.set(g.cells.subarray(src, src + w3 * 4), dst); grid.bg.set(g.bg.subarray(src, src + w3 * 4), dst);
    }
  });
  world.time = t0; world.ptime = p0;
  return ts.map((t, k) => { const c = calendar(t); return `${CALIB[k]} ${String(Math.floor(c.hour)).padStart(2, '0')}:${String(Math.floor((c.hour % 1) * 60)).padStart(2, '0')}`; });
}
let wasRiding = false, stride = 0, lastX = 0, lastY = 0;

/** When the player first entered the city (the opening plays from there), or -1. */
let introAt = -1;
/** The opening is switched off for now (the user did not like it, and it slows the tests). */
const INTRO = false;
function begin() {
  if (!gpu) return; // still loading
  if (!sound) { sound = new Sound(); if (new URLSearchParams(location.search).has('mute')) sound.toggleMute(); }
  sound.resume();
  if (INTRO && introAt < 0) { introAt = performance.now() / 1000; sound.intro(); }
  overlay.hidden = true;
  running = true;
  input.lock();
}
overlay.addEventListener('click', begin);
document.getElementById('cctv')!.addEventListener('click', (e) => { e.stopPropagation(); startCctv(true); });

/**
 * Watching the security cameras: the title's other choice (the city goes on, seen only through its
 * cameras, switching every CCTV_HOLD seconds, the street poles far more often than the shops'), or
 * in the game (debug, key C) the nearest camera. The picture is a camera of the time into a DVR:
 * the world at the model's resolution (its rows) in a 4:3 frame, as its model sees color and light,
 * held at the model's frames a second, with the recorder's overlay on a layer of big characters.
 */
const CCTV_HOLD = 14, CCTV_POLE_WEIGHT = 15;
let cctv: { k: number; at: number; title: boolean; res: number; sx: number; sy: number } | null = null;
/** The last picture the recorder kept (shown until the next, at the model's rate), when, and the overlay's layer (DVR_ROWS rows). */
let cctvHold: CharGrid | null = null, cctvShot = -1;
const DVR_ROWS = 40;
let dvr: CharGrid | null = null, dvrAt: [number, number] = [0, 0];
/** The world's resolution for camera k: its model's rows; the overlay's layer over its 4:3 frame. */
function cctvScreen(k: number) {
  const rows = CAMS[world.cctv[k].model].rows;
  if (rows !== camRows || !dvr) { camRows = rows; resize(); }
  cctvHold = null;
}
/** The overlay's layer over the 4:3 frame (again on every resize). */
function dvrLayout() {
  const h = canvas.height, cellH = Math.floor(h / DVR_ROWS), cellW = Math.max(3, Math.round(cellH * CELL_ASPECT));
  const fw = Math.min(canvas.width, Math.round((h * 4) / 3)), cols = Math.floor(fw / cellW);
  dvr = new CharGrid(cols, DVR_ROWS);
  dvrAt = [(canvas.width - cols * cellW) >> 1, (h - DVR_ROWS * cellH) >> 1];
  renderer.setTerm(cols, DVR_ROWS, cellW, cellH);
  termMode = '';
}
function pickCam(from: number): number {
  const L = world.cctv, cur = L[from];
  let tot = 0;
  const w = L.map((c) => (cur && Math.hypot(c.x - cur.x, c.y - cur.y) < 150 ? 0 : c.kind === 0 ? CCTV_POLE_WEIGHT : 1));
  for (const x of w) tot += x;
  let r = Math.random() * tot;
  for (let k = 0; k < L.length; k++) if ((r -= w[k]) < 0) return k;
  return 0;
}
/** Puts the (unseen) player under camera k, so the people and the traffic around it are simulated. */
function goToCam(k: number) {
  const C = world.cctv[k], p = world.player, nx = Math.cos(C.yaw), ny = Math.sin(C.yaw);
  p.x = p.px = C.x + nx * 1.5; p.y = p.py = C.y + ny * 1.5; p.inside = -1; p.floor = 0; p.z = 0;
  world.peds = spawnPeds(world.city, world.pop, world.rng, world.time, p.x, p.y);
}
function startCctv(title: boolean, k = -1) {
  if (!world.cctv.length) return;
  const p = world.player;
  cctv = { k: k >= 0 ? k : pickCam(-1), at: performance.now() / 1000, title, res: resStep, sx: p.x, sy: p.y };
  dvr = null; cctvScreen(cctv.k);
  if (title) { overlay.hidden = true; goToCam(cctv.k); }
}
function stopCctv() {
  if (!cctv) return;
  const C = cctv;
  cctv = null; dvr = null; cctvHold = null; termMode = '';
  resStep = C.res; camRows = 0; resize();
  if (C.title) {
    const p = world.player;
    p.x = p.px = C.sx; p.y = p.py = C.sy;
    world.peds = spawnPeds(world.city, world.pop, world.rng, world.time, p.x, p.y);
    overlay.hidden = false;
  }
}
/** The recorder's overlay over a camera's picture, inside the 4:3 frame (x0..x1 on the interface's grid). */
function cctvOverlay(k: number, now: number) {
  const ui = dvr!, x0 = 0, x1 = ui.cols, M = CAMS[world.cctv[k].model];
  const C = world.cctv[k], c = calendar(world.time), city = world.city, ch = String(k + 1).padStart(2, '0');
  const two = (n: number) => String(Math.floor(n)).padStart(2, '0'), secs = Math.floor((world.time % 60));
  const W: [number, number, number] = [235, 240, 235], bgc: [number, number, number] = [0, 0, 0];
  const place = C.kind === 0
    ? `${roadName(city, true, nearestRoad(city.xb, city.xCell, C.x))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, C.y))}`
    : businessName(city, C.biz);
  const name = (C.kind === 0 ? `TRAFFIC ${place}` : place).toUpperCase().slice(0, x1 - x0 - 30);
  ui.text(x0 + 2, 1, `CAM${ch} ${name}`, W, bgc);
  ui.text(x1 - 22, 1, `${two(c.month)}/${two(c.day)}/${c.year} ${two(c.hour)}:${two((c.hour % 1) * 60)}:${two(secs)}`, W, bgc);
  if (Math.floor(now * 1.2) & 1) ui.text(x1 - 8, 2, 'O', [255, 40, 30], bgc);
  ui.text(x1 - 6, 2, 'REC', W, bgc);
  ui.text(x0 + 2, ui.rows - 3, `CH${ch} ${cctvMakerName(world.city, M.maker).toUpperCase()} ${M.code}`, W, bgc);
  ui.text(x0 + 2, ui.rows - 2, `${M.color ? 'COLOR' : 'B/W'} ${M.res} ${M.px}  ${M.fps} FPS  ${C.sweep ? 'AUTO-PAN' : 'FIXED'}`, W, bgc);
  if (cctv?.title) ui.text(x1 - 26, ui.rows - 2, `NEXT ${Math.max(0, Math.ceil(CCTV_HOLD - (now - cctv.at)))}s  [ESC] MENU`, [150, 160, 150], bgc);
}
canvas.addEventListener('click', () => { if (!cctv?.title && !input.locked && !phone.out && !laptop.open) input.lock(); });

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
  // in the title's camera mode, switch cameras now and then; the pedestrians sync to its heading
  if (cctv?.title && now / 1000 - cctv.at > CCTV_HOLD) { cctv.k = pickCam(cctv.k); cctv.at = now / 1000; goToCam(cctv.k); cctvScreen(cctv.k); }
  if (cctv) cmd.heading = world.cctv[cctv.k].yaw;
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
  if (cctv) {
    // the view from the lens, panning; a cheap lens sees a little wider (more rows of the same picture)
    const C = world.cctv[cctv.k];
    Object.assign(view, { x: C.x, y: C.y, yaw: cctvYaw(C, (world.tick + alpha) / 60), pitch: C.pitch, eye: C.z - 0.1, floor: 0, z: 0, lift: false, hand: 0 });
  }
  let ms: number;
  // on the GPU the world is drawn with the rest of the screen at the end of the frame; the cameras'
  // monitor and the opening work on the picture on the CPU, so for them it is read back (a frame late)
  const onGpu = !!comp && !cctv && !calib && !(introAt >= 0 && now / 1000 - introAt < INTRO_S);
  gpuCanvas.style.display = onGpu ? 'block' : 'none';
  if (onGpu) {
    ms = comp!.ms;
    worldFrames++;
  } else {
    if (calib) calibTags = drawCalib(view);
    else if (!drawInto(grid, view, 'screen')) grid.clear();
    ms = comp?.ms ?? 0;
    worldFrames++;
  }
  if (now - worldAt > 1000) { worldFps = (worldFrames * 1000) / (now - worldAt); worldFrames = 0; worldAt = now; }
  ui.wipe(); hd.wipe();
  if (calib) calibTags.forEach((tag, k) => {
    const x = Math.round((layout.originX + k * Math.floor(grid.cols / 3) * layout.cellW - uiLayout.originX) / uiLayout.cellW) + 1;
    ui.text(Math.max(0, x), 2, ` ${tag} `, [255, 230, 160], [12, 10, 8]);
  });
  if (cctv) {
    // the camera's picture: kept at its model's rate and seen its way, then a 4:3 frame on the monitor (black bars at the sides)
    const C = world.cctv[cctv.k], M = CAMS[C.model];
    if (!cctvHold || cctvHold.cols !== grid.cols || cctvHold.rows !== grid.rows) { cctvHold = new CharGrid(grid.cols, grid.rows); cctvShot = -1; }
    if (cctvShot < 0 || now / 1000 - cctvShot >= 1 / M.fps) {
      cctvShot = now / 1000;
      cctvHold.cells.set(grid.cells); cctvHold.bg.set(grid.bg);
      cctvLook(cctvHold, now / 1000, cctv.k * 31 + 7, M, C.wear);
    }
    grid.cells.set(cctvHold.cells); grid.bg.set(cctvHold.bg);
    const w43 = Math.min(grid.cols, Math.round((grid.rows * layout.cellH * 4) / 3 / layout.cellW)), gx0 = (grid.cols - w43) >> 1;
    for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) if (x < gx0 || x >= gx0 + w43) { const i = y * grid.cols + x; grid.put(i, 32, 0, 0, 0); grid.setBg(i, 0, 0, 0); }
    dvr!.wipe();
    cctvOverlay(cctv.k, now / 1000);
    renderer.draw(grid, ui, hd, { grid: dvr!, x: dvrAt[0], y: dvrAt[1] });
    requestAnimationFrame(frame);
    return;
  }
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
  phone.hover = phone.out || (laptop.open && phone.raise > 0.5) ? keyAt(ui.cols, ui.rows, phone, phone.cx, phone.cy) : null;
  // over the notebook while it is open (to be clicked), under it otherwise
  watch.update(dt, world.time, now / 1000);
  for (const f of watch.sfx) {
    if (f === 'chime') sound?.watchChime();
    else if (f === 'alarm') sound?.watchAlarm();
    else if (f === 'beep') sound?.watchBeep();
    else if (f === 'light') sound?.phoneKey(false, true, false);
  }
  watch.sfx.length = 0;
  // in the game only (not over the title or the loading screen)
  if (running && WATCH_ON) drawWatch(ui, watch, world.time, now / 1000, VIEW_LIGHT, watchMakerName(world.city));
  const phoneOnTop = laptop.open;
  PHONE_SCREEN.at = null;
  if (!phoneOnTop) drawPhone(ui, phone, world, uiLayout.cellW / uiLayout.cellH, now / 1000, VIEW_LIGHT, VIEW_GLINT);
  // the notebook: its schedule, its sounds, the drive's hum, and on screen
  laptop.update(dt, now / 1000);
  // the phone over its cable: mounted at /mnt/phone while the notebook is open and running
  {
    const want = phone.usb && laptop.open && laptop.pc.bootAt >= 0, mnt = laptop.pc.mkdirs('/mnt');
    if (want && mnt.kids!.get('phone') !== phone.fs) mnt.kids!.set('phone', phone.fs);
    else if (!want && mnt.kids!.has('phone')) mnt.kids!.delete('phone');
    phone.usbLinked = want;
  }
  // the 3D look tipped the view down at the desk: back up as it closes
  if (lapWasOpen && !laptop.open) camera.targetPitch = 0;
  lapWasOpen = laptop.open;
  playLap(laptop.sfx);
  const lapOn = laptop.lid > 0 && laptop.pc.bootAt >= 0 && laptop.shell.state !== 'off';
  lapSpin += ((lapOn ? 1 : 0) - lapSpin) * Math.min(1, dt / (lapOn ? 2.5 : 1.5));
  sound?.laptopHum(lapOn || lapSpin > 0.05, lapSpin, laptop.pc.fan);
  {
    // the screen layer's mode, and its place on the interface's grid
    // (the editor runs in the system's console, full screen; only the firmware is in text mode)
    const mode = laptop.shell.bios || laptop.shell.fw.mode ? 'tx' : 'fb', T = mode === 'fb' ? termFb : termTx, [cw, chh] = termCells[mode];
    if (mode !== termMode) { termMode = mode; renderer.setTerm(T.cols, T.rows, cw, chh); comp?.setTerm(T.cols, T.rows, cw, chh); }
    drawLaptop3d(ui, T, laptop, world, now / 1000, VIEW_LIGHT, VIEW_GLINT, { yaw: camera.yaw, pitch: camera.pitch, aspect: uiLayout.cellW / uiLayout.cellH, still: !input.drag, termW: (T.cols * cw) / uiLayout.cellW, termH: (T.rows * chh) / uiLayout.cellH });
    // while the lid opens, the view tips down to the screen
    if (laptop.open && laptop.raise < 1 && !input.drag) camera.targetPitch = laptopPitch();
  }
  if (phoneOnTop) drawPhone(ui, phone, world, uiLayout.cellW / uiLayout.cellH, now / 1000, VIEW_LIGHT, VIEW_GLINT);
  if (!laptop.open && now / 1000 - laptop.noticeAt < 2.5) { const s = ` ${laptop.notice} `; ui.text((ui.cols - s.length) >> 1, ui.rows - 6, s, [255, 220, 140], [20, 16, 10]); }
  renderMs += (ms - renderMs) * 0.05;
  worstMs = Math.max(worstMs, ms);
  if (now - worstAt > 1000) { worstShown = worstMs; worstMs = 0; worstAt = now; }
  const { city } = world, d = districtAt(city, p.x, p.y);
  // [HACKING] wanted: a warning while a patrol is closing, and a banner just after an arrest
  {
    const H = world.heat;
    if (H.bust && H.bust.at !== bustSeen) { bustSeen = H.bust.at; bustShownAt = now; }
    if (H.bust && now - bustShownAt < 7000) {
      const B = H.bust, lost = ((B.fine + B.lostPay) / 100).toFixed(0);
      const where = B.lm >= 0 ? landmarkName(city, B.lm).toUpperCase() : 'DOWNTOWN';
      const s1 = ` ARRESTED — HELD AT ${where} `, s2 = ` FINE & PAYMENT LOST: $${lost}  —  LET THINGS COOL OFF `;
      ui.text((ui.cols - s1.length) >> 1, (ui.rows >> 1) - 1, s1, [255, 230, 230], [120, 20, 20]);
      ui.text((ui.cols - s2.length) >> 1, ui.rows >> 1, s2, [255, 200, 160], [40, 12, 10]);
    } else if (H.cop && p.inside < 0) {
      const dd = Math.round(Math.hypot(H.cop.x - p.x, H.cop.y - p.y)), near = dd < 60;
      const s = ` WANTED — POLICE ${dd}m ${compass(H.cop.x - p.x, H.cop.y - p.y)} `;
      if (near || (now & 512)) ui.text((ui.cols - s.length) >> 1, 1, s, near ? [255, 90, 90] : [255, 170, 80], [30, 10, 8]);
    }
  }
  if (hudOn) {
    const status = ` SEED ${seed}  POS ${p.x.toFixed(1)},${p.y.toFixed(1)}  ${p.inside >= 0 ? `INSIDE FLOOR ${p.floor}  ` : ''}${p.speed > 4 ? 'RUN ' : 'WALK'} ${p.speed.toFixed(1)} m/s  GRID ${grid.cols}x${grid.rows}  ${Math.round(fps)} FPS (WORLD ${Math.round(worldFps)})  DRAW ${renderMs.toFixed(1)} ms (MAX ${worstShown.toFixed(1)})${gpu && gpu.gpuMs >= 0 ? `  GPU ${gpu.gpuMs.toFixed(2)} ms` : ''}${gpu ? `  EYE x${gpu.adapt.toFixed(2)}` : ''}  `
      + `[^] PHONE  [N] LAPTOP  ${WATCH_ON ? '[H] WATCH [J] MODE [I] START  ' : ''}[B] BG ${look.solid ? `${solidStep + 1}/${SOLID.length - 1}` : 'OFF'}  [U] ${look.blocks ? 'BLOCKS' : 'ASCII'}  [V] ${['SOFT', 'SHARP', 'SHARPER', 'SHARPEST'][look.sharp]}  [G] FUSE ${look.fuse ? 'ON' : 'OFF'}  [R] ROWS ${RES_ROWS[resStep]}  [M] SOUND ${sound && !sound.muted ? 'ON' : 'OFF'} `;
    ui.text(1, ui.rows - 1, status, [255, 176, 74], [12, 10, 8]);
    const cal = calendar(world.time), wx = world.weather;
    const clock = ` ${cal.year}-${String(cal.month).padStart(2, '0')}-${String(cal.day).padStart(2, '0')} ${String(Math.floor(cal.hour)).padStart(2, '0')}:${String(Math.floor((cal.hour % 1) * 60)).padStart(2, '0')}  `
      + `${wx.preset >= 0 ? PRESETS[wx.preset][0].toUpperCase() : 'AUTO'} CLOUD ${Math.round(wx.cloud * 100)}% ${wx.precip > 0 ? `${wx.snow ? 'SNOW' : 'RAIN'} ${Math.round(wx.precip * 100)}% ` : ''}${wx.temp.toFixed(0)}C WIND ${Math.hypot(wx.windX, wx.windY).toFixed(0)} m/s  [T] +1H [Y] SKY  POWER ${world.power.subs.filter((s) => s.on).length}/${world.power.subs.length} [K] `;
    ui.text(ui.cols - clock.length - 1, ui.rows - 2, clock, [120, 220, 255], [8, 10, 14]);
    // debug: the nearest substation (a fenced yard), how far, which way and whether it runs
    {
      let k = 0, bd = Infinity;
      world.power.subs.forEach((S, i) => { const d = Math.hypot(S.x - p.x, S.y - p.y); if (d < bd) { bd = d; k = i; } });
      const S = world.power.subs[k], s = ` SUBSTATION ${String(k + 1).padStart(2, '0')} ${Math.round(bd)}m ${compass(S.x - p.x, S.y - p.y)} ${S.on ? 'ON' : 'OFF'}${S.yard ? '' : ' (NO YARD)'} `;
      ui.text(ui.cols - s.length - 1, ui.rows - 3, s, S.on ? [140, 255, 170] : [255, 120, 90], [8, 10, 14]);
    }
    // [HACKING] debug: the heat the player has drawn, its tier and the traces behind it
    if (world.heat.points > 0.005) {
      const H = world.heat, tier = tierOf(H), by: Record<string, number> = {};
      for (const t of H.traces) by[t.kind] = (by[t.kind] ?? 0) + 1;
      const tr = (['witness', 'camera', 'antenna', 'wifi'] as const).filter((k) => by[k]).map((k) => `${by[k]}${k[0].toUpperCase()}`).join(' ');
      const cop = H.cop ? ` COP ${Math.round(Math.hypot(H.cop.x - p.x, H.cop.y - p.y))}m ${compass(H.cop.x - p.x, H.cop.y - p.y)}` : '';
      const hs = ` HEAT ${H.points.toFixed(2)} TIER ${tier} [${['CLEAN', 'LOCAL', 'CITY', 'FEDERAL'][tier]}] ${tr}${cop} `;
      ui.text(ui.cols - hs.length - 1, ui.rows - 4, hs, tier >= 3 ? [255, 90, 90] : tier >= 2 ? [255, 150, 70] : [255, 210, 90], [14, 8, 6]);
    }
    const where = ` ${cityName(city).toUpperCase()} / ${districtName(city, d).toUpperCase()} (${districtType(city, d)})  SECTOR ${sectorCode(city, p.x, p.y)}  `
      + `${Math.abs(diagS(city.diagonal, p.x, p.y)) < city.diagonal.w / 2 + SIDEWALK ? diagonalName(city) : roadName(city, true, nearestRoad(city.xb, city.xCell, p.x))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, p.y))} `;
    let lm = 0;
    city.landmarks.forEach((l, k) => { if (Math.hypot(l.x - p.x, l.y - p.y) < Math.hypot(city.landmarks[lm].x - p.x, city.landmarks[lm].y - p.y)) lm = k; });
    const L = city.landmarks[lm];
    ui.text(1, 0, where + ` LANDMARK ${landmarkName(city, lm)} ${Math.round(Math.hypot(L.x - p.x, L.y - p.y))}m ${compass(L.x - p.x, L.y - p.y)} `, [120, 220, 255], [8, 10, 14]);
  }
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
    ui.wipe(); hd.wipe();
    intro(grid, now / 1000 - introAt, [
      cityName(city).toUpperCase(),
      `${districtName(city, d).toUpperCase()}  ${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')} ${hh}:${mm}`,
      `${operatorName(city).toUpperCase()} ... SIGNAL OK`,
    ]);
  }
  const T3 = termMode === 'fb' ? termFb : termTx;
  const termAt = screenAt ? { grid: T3, x: uiLayout.originX + screenAt[0] * uiLayout.cellW, y: uiLayout.originY + screenAt[1] * uiLayout.cellH } : null;
  // the GPU's compositor also takes the screen seen from aside (not shown as a layer), for its glow
  const G = glassBox, toPx = (c: number, k: number) => (k & 1 ? uiLayout.originY + c * uiLayout.cellH : uiLayout.originX + c * uiLayout.cellW);
  const lapAt = G && termMode ? { grid: T3, x: termAt?.x ?? 0, y: termAt?.y ?? 0, show: !!termAt, glass: G.map(toPx) } : null;
  if (onGpu) comp!.draw(world, view, ui, hd, lapAt, PHONE_SCREEN.at);
  else renderer.draw(grid, ui, hd, termAt);
  requestAnimationFrame(frame);
}

addEventListener('resize', resize);
document.fonts.load(`16px ${FONT}`).finally(() => {
  resize();
  requestAnimationFrame(frame);
  if (!GpuWorld.available()) { load(0.88, 'WebGPU IS REQUIRED (A CHROMIUM BROWSER)'); return; }
  load(0.9, 'COMPILING SHADERS');
  GpuWorld.create(world.city).then((g) => {
    load(1, 'READY');
    gpu = g; g.resize(layout.cols, layout.rows);
    canvas.after(gpuCanvas); gpuCanvas.width = canvas.width; gpuCanvas.height = canvas.height;
    comp = new GpuCompositor(g, gpuCanvas); comp.setLayout(layout, uiLayout);
    if (termMode) { const T = termMode === 'fb' ? termFb : termTx, [cw, chh] = termCells[termMode]; comp.setTerm(T.cols, T.rows, cw, chh); }
  }, (err) => console.error('WebGPU:', err));
});
