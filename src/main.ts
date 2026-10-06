import { Sound } from './audio/sound';
import { Input } from './input';
import { drawPhone, keyAt, mapView, onDial, SCREEN as PHONE_SCREEN } from './phone/draw';
import { BOOT_LOG_S, Phone, phoneKey, type Key } from './phone/phone';
import { TRACKS } from './audio/tracks';
import { drawPayphone, Payphone } from './phone/payphone';
import { songInfo } from './phone/apps';
import { doorAhead, useDoor } from './sim/doors';
import { callCar, carHere, carOf, liftAhead } from './sim/lifts';
import { Counter, counterPrompt, drawCounter } from './counter';
import { drawTalk, TalkView } from './talkUi';
import { hash3 } from './core/rng';
import { staffOn } from './sim/citizens';
import { citizenNames } from './locale/names';
import { BagView } from './bagUi';
import { AskWay, drawAskWay } from './askWay';
import { Barks, drawBarks } from './barks';
import { drawTag, TAG_NEAR, TAG_WAIT } from './tag';
import { fit, swapSim } from './sim/gear';
import { plugIn } from './laptop/look3d';
import { aimedGood, takeGood } from './shop';
import { outletAhead, outletPower } from './sim/outlets';
import { seatAhead, sitDown, standUp } from './sim/seats';
import { hungerStage } from './sim/needs';
import { SPARE_WH } from './sim/gear';
import { type Sfx } from './phone/call';
import { Laptop, type LapSound } from './laptop/laptop';
import { drawWatch, Watch, WATCH_BTN, WATCH_LCD, WATCH_ON } from './watch/watch';
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
import { addToBag } from './sim/bag';
import { DEBUG } from './debug';
import { loadPop, savePop } from './popCache';
import { pace } from './core/steps';
import TIPS from './locale/tips.json';
import TODAY_2008 from './locale/today2008.json';
import { Menu, type Option } from './menu';
import { deleteSave, readSave, SAVE_V, writeSave, type GameSave } from './saveGame';
import { TitleFx } from './titleFx';
import { applyWorld, snapWorld } from './sim/save';
import { NotePanel, Playtest } from './playtest';

/** The grid has this many rows (chosen in the options; more rows cost more to draw); columns follow the window shape. */
const RES_ROWS = [80, 120, 200];
/**
 * The options (the menu's), kept per viewer in the browser, apart from the save (deleting a save keeps them).
 * The style (13.13) sets the rows and the old sharpness together: High Definition (200 rows, soft) or Classic (120, sharper);
 * Sharpness is the far glyphs' fusion (Soft: fused). The background and the glyphs are fixed (0.24 of the glyph's color, ASCII).
 */
interface Opts { style: number; fuse: boolean; mute: boolean }
const STYLES = [{ name: 'HIGH DEFINITION', res: 2, sharp: 0 }, { name: 'CLASSIC', res: 1, sharp: 2 }];
const OPTS: Opts = (() => {
  const d: Opts = { style: 0, fuse: false, mute: false };
  // the options before 13.13 are dropped once (tc.opts), so the game opens in the new defaults
  try { localStorage.removeItem('tc.opts'); return { ...d, ...JSON.parse(localStorage.getItem('tc.opts2') ?? '{}') }; } catch { return d; }
})();
let style = Math.min(OPTS.style, STYLES.length - 1);
let resStep = STYLES[style].res;
/** The rows a security camera's model shows while looking through it (0: the player's own, RES_ROWS[resStep]). */
let camRows = 0;
/** The interface (phone, notebook, payphone, status lines) has its own grid, always this many rows: it keeps its size whatever the world's resolution. */
const UI_ROWS = 80;
/** Cell width / height, close to a monospace glyph. */
const CELL_ASPECT = 0.6;
/** Eye height in metres. */
const EYE = 1.7;
const MOUSE_SENS = 0.0022;

/** The loading bar on the title screen, after the choice: how far (0..1) and what is being done; at 1 the game starts. */
function load(f: number, what: string) {
  const L = document.getElementById('loading')!;
  (L.querySelector('.fill') as HTMLElement).style.transform = `scaleX(${f})`;
  L.querySelector('.what')!.textContent = `${what} ${'.'.repeat(1 + (Math.floor(performance.now() / 300) % 3))}`;
  L.querySelector('.pct')!.textContent = `${Math.floor(f * 100)}%`;
  if (f >= 1) L.hidden = true;
}
showTip(true);
// the line changes every 15–20 s (it shows on the title and in the pause menu, where one may stay a while)
(function cycle() { setTimeout(() => { showTip(false); cycle(); }, 15000 + Math.random() * 5000); })();

/** A line under the bar: the first load of the day shows what happened on this date in 2008 (when the list has it); otherwise (and on every change after) a tip or a fact of 2008. */
function showTip(load: boolean) {
  const now = new Date(), key = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const today = (TODAY_2008.days as Record<string, { text: string }[]>)[key];
  let first = false;
  if (load) try { first = localStorage.getItem('tc.tipDay') !== key; localStorage.setItem('tc.tipDay', key); } catch { /* no storage: treat as seen */ }
  const el = document.getElementById('tip')!, was = el.querySelector('.text')!.textContent;
  const pick = <T extends string | { text: string },>(a: T[]) => { let x = a[0]; for (let k = 0; k < 4; k++) { x = a[Math.floor(Math.random() * a.length)]; if ((typeof x === 'string' ? x : x.text) !== was) break; } return x; };
  let head: string, text: string;
  if (first && today?.length) { head = `${TIPS.today} · ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`; text = pick(today).text; }
  else if (TODAY_2008.facts.length && Math.random() < 0.35) { head = TIPS.fact; text = (pick(TODAY_2008.facts) as { text: string }).text; }
  else { head = TIPS.tip; text = pick(TIPS.tips); }
  el.querySelector('.head')!.textContent = head;
  el.querySelector('.text')!.textContent = text;
}

// The title (2026-10-06): the choice comes first, and the city is made only after it, once (it used to be
// made behind the title, so opening the game waited on it). CONTINUE makes the save's city and puts the
// save on it; NEW GAME erases the save and rolls a new city (?seed=123 reproduces one). Either way the game
// starts by itself when it is ready. ?mute starts with the sound off.
const params = new URLSearchParams(location.search), seedParam = params.get('seed');
const saved = await readSave();
const titleFx = new TitleFx(document.getElementById('overlay')!);
const choice = await titleChoice();
const seed = choice !== 'new' ? saved!.seed : seedParam !== null ? Number(seedParam) | 0 : (Math.random() * 2 ** 31) | 0;
document.getElementById('ready')!.hidden = true;
document.getElementById('loading')!.hidden = false;
load(0.02, 'BOOTING');
/** The title's buttons: CONTINUE and WATCH CCTV (with a save: its city), NEW GAME (a second click when it replaces a save), OPTIONS. */
function titleChoice(): Promise<'continue' | 'new' | 'cctv'> {
  const cont = document.getElementById('continue') as HTMLButtonElement, nb = document.getElementById('start') as HTMLButtonElement;
  const cam = document.getElementById('cctv') as HTMLButtonElement;
  if (saved) {
    cont.hidden = false; cam.hidden = false;
    const c = calendar(saved.world.time), two = (n: number) => String(Math.floor(n)).padStart(2, '0');
    document.querySelector('#ready .saveinfo')!.textContent = `SAVED ${new Date(saved.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} · IN THE CITY ${c.year}-${two(c.month)}-${two(c.day)} ${two(c.hour)}:${two((c.hour % 1) * 60)}`;
  }
  // the options before there is a city: what they change is kept and read when the game is made
  const titleMenu = new Menu({ options: [
    { label: 'SOUND', value: () => (OPTS.mute ? 'OFF' : 'ON'), next: () => { OPTS.mute = !OPTS.mute; keepOpts(); } },
    { label: 'STYLE', value: () => STYLES[style].name, next: () => { style = (style + 1) % STYLES.length; resStep = STYLES[style].res; OPTS.style = style; keepOpts(); } },
    { label: 'SHARPNESS', value: () => (OPTS.fuse ? 'SOFT' : 'SHARP'), next: () => { OPTS.fuse = !OPTS.fuse; keepOpts(); } },
  ], debug: () => '', save: async () => false, resume: () => {}, quit: () => {} });
  document.getElementById('options')!.addEventListener('click', (e) => { e.stopPropagation(); titleMenu.open(true); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && titleMenu.isOpen) titleMenu.back(); });
  return new Promise((ok) => {
    const go = (c: 'continue' | 'new' | 'cctv') => { titleMenu.dispose(); ok(c); };
    cont.addEventListener('click', (e) => { e.stopPropagation(); go('continue'); }, { once: true });
    cam.addEventListener('click', (e) => { e.stopPropagation(); go('cctv'); }, { once: true });
    let sure = !saved;
    nb.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!sure) { sure = true; nb.textContent = 'NEW GAME (ERASES THE SAVE)'; return; }
      if (saved) await deleteSave();
      go('new');
    });
  });
}
function keepOpts() { try { localStorage.setItem('tc.opts2', JSON.stringify(OPTS)); } catch { /* no storage: the defaults next time */ } }
// the city is made in steps, the page alive between them, with a bar on the title screen (load)
const savedPop = await loadPop(seed);
const world = await pace(worldSteps(seed, CITY_SIZE, true, savedPop), (f) => load(0.04 + 0.84 * f, f < 0.05 ? 'LAYING OUT STREETS' : f < 0.1 ? 'WIRING THE GRID' : 'REGISTERING CITIZENS'));
if (!savedPop) void savePop(seed, world.pop);
// ?at=2008-02-20T22:30 starts a new game at that time of the city's clock (the eclipse launchers, jogar-eclipse-*.bat)
const atParam = params.get('at');
// ?sarcnear: only to look at the Sarcophagus up close (13.15): pulls the dome, tower and cranes to 200 m past the fence
if (params.has('sarcnear')) {
  const S = world.city.sarcophagus, C = world.city;
  const dx = S.x - C.w / 2, dy = S.y - C.h / 2, d = Math.hypot(dx, dy), k = -2300 / d;
  S.x += dx * k; S.y += dy * k; S.tx += dx * k; S.ty += dy * k;
  for (const c of S.cranes) { c.x += dx * k; c.y += dy * k; }
}
// ?pos=771.2,971.9 starts a new game standing there (the comparison launchers, comparar-*.bat)
const posParam = params.get('pos')?.split(',').map(Number);
if (posParam?.length === 2 && posParam.every(Number.isFinite)) Object.assign(world.player, { x: posParam[0], y: posParam[1], px: posParam[0], py: posParam[1] });
if (atParam && !Number.isNaN(Date.parse(atParam + 'Z'))) skipHours(world, (Date.parse(atParam + 'Z') - Date.UTC(2008, 0, 1)) / 3.6e6 - world.time / 3600);
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
const counter = new Counter(world);
const bagView = new BagView(world);
const ask = new AskWay(world);
/** Talking to someone: the clerk at a till (14.3), someone on the sidewalk (14.4). */
const talkView = new TalkView(world);
/** The balloons over the heads of the people around (14.4). */
const barks = new Barks(world);
/** Walking off a talk: someone stopped on the sidewalk goes on their way after a moment (unless still pointing it). */
function endTalk() {
  const T = talkView.talk;
  // on the phone (14.7): walking off is hanging up; the phone comes back up, the cursor stays free
  if (talkView.phone) { const c = phone.call; if (c && c.state !== 'ended') { c.hangUp(performance.now() / 1000); } phone.atEar = false; talkView.close(); return; }
  if (T && T.biz < 0) { const q = world.peds.find((e) => e.id === T.who); if (q && (q.hold ?? 0) > 300) { q.hold = 30; q.pdx = q.pdy = 0; } }
  // (if the browser will not lock the pointer without a click, the next key does: relock)
  talkView.close(); input.lock(); relock = true;
}
// the gear fitted from the bag (13.6): the notebook's battery grows; the antenna slides into its port when the notebook comes up
bagView.onEar = (good) => { phone.earphones = !phone.earphones || phone.earGood !== good; phone.earGood = good; return phone.earphones; };
bagView.onFit = (id) => { fit(world, id); if (id === 'battery') gearBattery(true); plugIn(id); };
bagView.onSwap = (op) => { swapSim(world, op); phone.newSim(); };
/** What taking a good off a shelf said, and when; and the last theft shown (its game time). */
let shelfNote = '', shelfNoteAt = -9, theftSeen = world.bag.stolenAt, wasCharging = false, lowSeen = 0;
/** What trying a door said (LOCKED), and when. */
let doorNote = '', doorNoteAt = -9;
/** The notebook's battery with what was bought (F.9): the second pack adds its capacity; bought just now, it comes charged. */
function gearBattery(fresh = false) {
  const pc = laptop.pc, base = pc.hw.battWh * pc.hw.battWear, wh = base + (world.gear.battery ? SPARE_WH : 0);
  if (fresh && wh > pc.battWh) pc.charge = (pc.charge * pc.battWh + (wh - pc.battWh)) / wh;
  pc.battWh = wh;
}
const laptop = new Laptop(world);
const watch = new Watch();
/** Sitting down (13.10f): 0 standing .. 1 seated, and the seat's eye height (kept while getting up). */
let sitK = 0, sitEye = EYE;
/** Eye height over the feet: lower while seated (13.10f), or sitting at the notebook (or leaning on a counter). */
function eyeNow(): number {
  const s = laptop.seat, k = 1 - (1 - laptop.raise) ** 2, base = EYE + (sitEye - EYE) * (1 - (1 - sitK) ** 2);
  // crouched, the eye drops; a jump lifts it (14.8)
  const p = world.player, b = base - (p.crouch ?? 0) * 0.65 + (p.hop ?? 0);
  return s ? b + (s.eye - b) * k : b;
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
  world, camera, pickedButton, callLift, phone, payphone, laptop, bagView, counter, ask, VIEW_LIGHT, VIEW_GLINT, gpuNow: () => gpu, compNow: () => comp, soundNow: () => sound,
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
  watchCam: (k: number) => { if (cctv && !cctv.title) stopCctv(); startCctv(true, k); goToCam(k); }, stopCctv: () => stopCctv(),
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
/** The notebook screen's size on the interface grid (cells), kept from the last frame so a click can be mapped to a terminal cell (15.7). */
let scrTermW = 0, scrTermH = 0;
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
/**
 * The playtest record (13.10p; ?playtest, jogar-playtest.bat, always in the .exe): made once the
 * server answers that it keeps the file, primed when the player goes in. F8 writes a note.
 */
let pt: Playtest | null = null, ptPrimed = false, noteShot: string | null = null, shotWanted = false;
const notePanel = new NotePanel();
if (params.has('playtest')) void Playtest.available().then((ok) => { if (ok) { pt = new Playtest(world, seed, __VERSION__); if (running && !ptPrimed) { pt.prime(phone, continued); ptPrimed = true; } } else console.warn('playtest: no server keeps the record (run it through Electron or Vite)'); });
let lapWasOpen = false;
// the solid background behind the glyphs: 0.24 of the glyph's color ("1/3"), the user's pick
const look: Look = { solid: 0.24, blocks: false, sharp: STYLES[style].sharp, fuse: OPTS.fuse };
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
  // flat (13.9): it stays dark
  if (r === 'out' && phone.screen === 'off') { shelfNote = en.bag.flat; shelfNoteAt = performance.now() / 1000; }
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
  // the earphones' volume wheel on the cable (2026-10-06): turned by the mouse's wheel anywhere near it, the cursor free
  if (e.deltaY && !input.locked && phone.earphones) {
    const [x, y] = cellAtClient(e.clientX, e.clientY);
    if (onDial(x, y)) { phonePress(e.deltaY < 0 ? 'vup' : 'vdown'); return; }
  }
  if (laptop.open && e.deltaY) {
    const wm = laptop.shell.wm, cell = wm && laptopCell(e.clientX, e.clientY);
    if (wm && cell) wm.wheel(Math.sign(e.deltaY), cell[0]);
    else laptop.scroll(-Math.sign(e.deltaY) * 3);
    return;
  }
  if (!phone.out || !e.deltaY) return;
  const d = Math.sign(e.deltaY);
  if (phone.screen === 'map') { if (phone.setZoom(phone.zoom + d, performance.now() / 1000)) sound?.phoneKey(false); return; }
  phonePress(phone.screen === 'menu' ? (d > 0 ? 'right' : 'left') : d > 0 ? 'down' : 'up');
});
/** The right button held down: since when, and how far the mouse went (a short still click is Back). */
let rightAt = -1, rightMoved = 0;
/** Alt held (15.9a): the cursor is free to click the watch (and what else is on the screen) while the keys still walk; let go, it is locked again. */
let altFree = false, watchStartHeld = false;
/** A left click on one of the watch's buttons, with the cursor free: presses it (true when it did). */
function watchClick(e: MouseEvent): boolean {
  if (e.button !== 0 || input.locked || !WATCH_ON || !WATCH_BTN.length) return false;
  const [x, y] = cellAtClient(e.clientX, e.clientY), now = performance.now() / 1000;
  const b = WATCH_BTN.find(([bx, by]) => by === y && Math.abs(bx - x) <= 1)?.[2];
  if (b === 'light') watch.light(now);
  else if (b === 'mode') watch.modeKey(now);
  else if (b === 'start') { watch.startDown(now, false); watchStartHeld = true; }
  return !!b;
}
function altUp() {
  if (!altFree) return;
  altFree = false;
  if (running && !paused && !cctv && !phone.out && !payphone.active && !laptop.open && !bagView.open && !talkView.open && rightAt < 0) input.lock();
}
addEventListener('blur', () => { altFree = false; });
/** The left button is held down over the notebook screen, dragging a selection (15.7c). */
let lapDrag = false;
/** The interface's cell under the system cursor. */
function cellAtClient(cx: number, cy: number): [number, number] {
  const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1, L = uiLayout;
  return [Math.floor(((cx - r.left) * dpr - L.originX) / L.cellW), Math.floor(((cy - r.top) * dpr - L.originY) / L.cellH)];
}
/** The notebook terminal's cell under the system cursor, or null off the screen (15.7). Works head-on, when screenAt is set. */
function laptopCell(cx: number, cy: number): [number, number] | null {
  if (!screenAt || !scrTermW || !scrTermH) return null;
  const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1, L = uiLayout;
  const fx = ((cx - r.left) * dpr - L.originX) / L.cellW, fy = ((cy - r.top) * dpr - L.originY) / L.cellH;
  const tc = Math.floor(((fx - screenAt[0]) / scrTermW) * TERM_W), tr = Math.floor(((fy - screenAt[1]) / scrTermH) * TERM_H);
  return tc >= 0 && tr >= 0 && tc < TERM_W && tr < TERM_H ? [tc, tr] : null;
}
addEventListener('mousemove', (e) => {
  [phone.cx, phone.cy] = cellAtClient(e.clientX, e.clientY);
  if (lapDrag && laptop.shell.wm) { const cell = laptopCell(e.clientX, e.clientY); if (cell) laptop.shell.wm.drag(cell[0], cell[1]); }
});
/** A payphone's key pressed: its sound, and the payphone. */
function payPress(k: Key) {
  if (/^[0-9*#]$/.test(k)) sound?.dtmf(k); else sound?.phoneKey(false);
  payphone.press(k, performance.now() / 1000);
  if (!payphone.active) input.lock();
}
addEventListener('mousedown', (e) => {
  if (relock && !laptop.open) { relock = false; if (running && !phone.out && !payphone.active && e.button !== 1) input.lock(); }
  if (e.button === 2) e.preventDefault();
  if (!running || paused) return;
  // the backpack open: the left button drags a thing, the right one puts it back or throws it away
  if (bagView.open) {
    if (e.button === 0) bagView.grab(phone.cx, phone.cy);
    else if (e.button === 2) bagView.remove(phone.cx, phone.cy, performance.now() / 1000);
    return;
  }
  if (watchClick(e)) return;
  // Alt held with the phone in the pocket: its music keys on top, just out of it, take a click
  if (e.button === 0 && altFree && !phone.out && !laptop.open) {
    const [x, y] = cellAtClient(e.clientX, e.clientY), k = keyAt(ui.cols, ui.rows, phone, x, y);
    if (k) { phonePress(k); return; }
  }
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
        return;
      }
    }
    // the window manager (15.7): press on the screen focuses a pane and starts a selection
    const wm = laptop.shell.wm;
    if (e.button === 0 && wm) { const cell = laptopCell(e.clientX, e.clientY); if (cell) { wm.down(cell[0], cell[1]); lapDrag = true; } }
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
document.addEventListener('pointerlockchange', () => {
  if (input.locked && rightAt < 0 && (phone.out || payphone.active || laptop.open || bagView.open || talkView.open)) input.unlock();
  // the pointer freed by the player (Esc, or leaving the window), not by the game: pause
  else if (!input.locked && running && !cctv && !phone.out && !payphone.active && !laptop.open && !bagView.open && !talkView.open && !altFree && laptop.raise === 0 && rightAt < 0 && performance.now() - input.unlockedAt > 300) pause();
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) phone.release();
  if (e.button === 0 && watchStartHeld) { watchStartHeld = false; watch.startUp(); }
  if (e.button === 0 && bagView.open) bagView.release(phone.cx, phone.cy, performance.now() / 1000);
  if (e.button === 0 && lapDrag) { lapDrag = false; const wm = laptop.shell.wm, cell = laptopCell(e.clientX, e.clientY); if (wm && cell) wm.up(cell[0], cell[1], performance.now() / 1000); }
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
  // the menu open takes the keys: Esc goes a page back, or out
  if (menu.isOpen) { if (e.code === 'Escape' && !e.repeat) { e.preventDefault(); menu.back(); } return; }
  // Alt is the game's: no browser shortcut with it (Alt+Left would go back a page, Alt alone focuses the browser's menu)
  if (e.altKey) e.preventDefault();
  // Alt held frees the cursor (15.9a); the notebook open has it free already, and its own Alt keys
  // the music from the keyboard (2026-10-06): the keyboard's own media keys, and with Alt the arrows
  // (volume, previous and next) and P (play/pause), the same as the phone's keys on top
  const mk: Key | null = e.code === 'MediaPlayPause' ? 'play' : e.code === 'MediaTrackNext' ? 'next' : e.code === 'MediaTrackPrevious' ? 'prev'
    : e.altKey && !laptop.open && running ? ({ ArrowUp: 'vup', ArrowDown: 'vdown', ArrowLeft: 'prev', ArrowRight: 'next', KeyP: 'play' } as Record<string, Key>)[e.code] ?? null : null;
  if (mk) { e.preventDefault(); if (!e.repeat || mk === 'vup' || mk === 'vdown') (e.code.startsWith('Media') ? musicTap : musicKey)(mk); return; }
  if ((e.code === 'AltLeft' || e.code === 'AltRight') && !laptop.open) {
    if (!e.repeat && running && !paused && input.locked) { altFree = true; input.unlock(); }
    return;
  }
  if (e.code === 'F3') { e.preventDefault(); if (!e.repeat) hudOn = !hudOn; return; }
  // F8: a playtest note (the game pauses while it is written)
  if (e.code === 'F8') { e.preventDefault(); if (!e.repeat) openNote(); return; }
  // debug: F4 shows the view at noon, sunset and night side by side (to judge the colors)
  if (e.code === 'F4') { e.preventDefault(); if (!e.repeat) calib = !calib; return; }
  // watching the cameras: Esc leaves (to the title, or back to the game); in the game, V toggles the nearest (C until 14.8, now crouching)
  if (cctv && (e.code === 'Escape' || (e.code === 'KeyV' && !cctv.title))) { stopCctv(); return; }
  if (cctv?.title) return;
  if (e.code === 'KeyV' && running && !laptop.open && !talkView.open && !e.repeat) {
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
    // Insert: the phone up beside it (or down), worked by the mouse while the keys stay the notebook's
    if (e.code === 'Insert' && !e.repeat && !payphone.active) {
      const r = phone.toggle(performance.now() / 1000);
      sound?.phoneSlide(r !== 'in');
      if (r === 'boot') sound?.phoneBoot(0.35 + BOOT_LOG_S);
      return;
    }
    if (e.code === 'Escape' && !laptop.shell.fw.mode) { if (!e.repeat) { laptop.close(performance.now() / 1000); input.lock(); relock = true; } return; }
    if (e.repeat && !['Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete'].includes(e.code) && e.key.length !== 1) return;
    if (pt && laptop.shell.ready && !laptop.shell.screen()) pt.termKey(e.code, e.ctrlKey);
    laptop.key(e.code, e.key, e.ctrlKey, performance.now() / 1000);
    return;
  }
  // asking someone the way (13.9): the list takes the arrows, Enter, F and Esc
  if (ask.open) { if (!e.repeat && ask.key(e.code, performance.now() / 1000)) e.preventDefault(); return; }
  // at a shop's counter (F.9) the arrows, Enter, F and Esc are its
  if (counter.active) {
    if (!e.repeat && counter.key(e.code, performance.now() / 1000)) { e.preventDefault(); if (world.gear.battery) gearBattery(true); }
    if (!counter.active || e.code.startsWith('Arrow') || e.code === 'Enter' || e.code === 'Space' || e.code === 'Tab') return;
  }
  // talking (14.3): the keys type into the box; Enter says it, Tab goes to the till, Esc walks off
  if (talkView.open) {
    e.preventDefault();
    if (counter.active) return;
    const T = talkView.talk!, r = talkView.key(e.code, e.key, performance.now() / 1000);
    if (r === 'leave') endTalk();
    // Tab: the till at a shop; on the sidewalk, the list of places to ask the way to (13.9), the same person
    else if (r === 'till') { if (T.biz >= 0) counter.open(T.biz); else { talkView.close(); ask.who = T.who; ask.pick = 0; relock = true; } }
    else if (r) {
      pt?.log('say', { who: citizenNames(world.city, world.pop, T.who)[0], text: talkView.mine, intent: r.reading.intent === 'unrecognized' ? null : r.reading.intent, tone: `${r.reading.toneLabel} p${r.reading.pressure}`, answer: r.text });
      if (r.counter) counter.open(T.biz);
      // a number given (14.9): into the phone's contacts
      if (r.contact && !phone.contacts.some((x) => x.number === r.contact!.number) && phone.contacts.length < 250) { phone.contacts.push(r.contact); phone.sfx.push(['sent']); }
      // on the phone their answer comes through the call (its voice), and they hang up after their last line
      if (talkView.phone) phone.call?.answer(r.text, performance.now() / 1000, r.end);
      // a way asked on the sidewalk: they point it while they say it
      const q = T.biz < 0 && r.point ? world.peds.find((e) => e.id === T.who) : null;
      if (q) { q.pdx = r.point![0]; q.pdy = r.point![1]; q.hold = 299; }
    }
    return;
  }
  // the backpack open: B or Esc closes it, R turns what is held; the rest of the keys wait
  if (bagView.open) {
    e.preventDefault();
    if (e.repeat) return;
    if ((e.code === 'KeyB' || e.code === 'Escape') && !bagView.swap) { bagView.open = false; bagView.release(); input.lock(); }
    else if (e.code === 'KeyR') bagView.turn();
    else if (e.code === 'KeyE' && bagView.eatAt(phone.cx, phone.cy, performance.now() / 1000)) sound?.munch();
    return;
  }
  // B: open the backpack (13.4)
  if (e.code === 'KeyB' && running && !e.repeat && !phone.out && !payphone.active && !counter.active && laptop.raise === 0) { bagView.open = true; input.unlock(); return; }
  // Esc with nothing in the hands: the pause menu (with the pointer locked, the browser frees it and pointerlockchange opens it)
  if (e.code === 'Escape' && running && !phone.out && !payphone.active) { if (!e.repeat) pause(); return; }
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
    // a good on a shelf under the sight: into the bag, unpaid (13.4)
    const a = !phone.out ? aimedGood(world, camera.yaw, camera.pitch, eyeNow()) : null;
    if (a) {
      const r = takeGood(world, a), name = (en.goods as Record<string, string>)[a.good] ?? a.good;
      shelfNote = r === 'ok' ? en.bag.taken.replace('{x}', name) : en.bag[r]; shelfNoteAt = performance.now() / 1000;
      if (r === 'ok') sound?.phoneKey(false);
      return;
    }
    // a wall outlet in front: plug the phone in, or out (13.9c)
    const o = !phone.out ? outletAhead(world, camera.yaw) : null;
    if (o) {
      const p = world.player;
      if (phone.plug?.f === o) { phone.plug = null; shelfNote = en.bag.unplugged; }
      else { phone.plug = { f: o, b: p.inside, floor: p.floor }; shelfNote = outletPower(world) ? en.bag.charging : en.bag.dead; wasCharging = outletPower(world); }
      shelfNoteAt = performance.now() / 1000;
      sound?.phoneKey(false);
      return;
    }
    const c = counter.near();
    // the clerk: a conversation (14.3), the till through it
    if (c?.staffed && !phone.out) { talkView.start(staffOn(world.pop, world.city, c.k, world.time)[0], c.k, performance.now() / 1000); input.unlock(); return; }
    // a door in front: open it, close it, or find it locked (13.2c)
    // the lift's doors in front, its car elsewhere: call it (13.2d)
    if (!phone.out && liftAhead(world, camera.yaw)) { if (callCar(world)) sound?.beep(true); return; }
    if (!phone.out) { const r = useDoor(world, camera.yaw); if (r) { doorNote = r === 'locked' ? en.doors.locked : ''; doorNoteAt = performance.now() / 1000; return; } }
    // someone on the sidewalk in front: talk to them (14.4); crossing or going in, or late at night, some walk on
    if (!phone.out) {
      const q = ask.near(camera.yaw), t = performance.now() / 1000, h = (world.time / 3600) % 24;
      if (q) {
        if (q.way.length || q.door) ask.ask(q, t);
        else if ((h >= 23 || h < 5) && hash3(q.id, 11, Math.floor(world.time / 3600)) < 0.35) barks.say(q.id, barks.line(q.id, 'dir.busy'), t);
        else { talkView.start(q.id, -1, t); input.unlock(); q.hold = 3600; q.pdx = q.pdy = 0; }
        return;
      }
    }
    // a seat in front: sit on it, facing its way; seated, F with nothing else to do stands up (13.10f)
    if (!phone.out && world.player.sit) { standUp(world); return; }
    const seat = !phone.out ? seatAhead(world, camera.yaw) : null;
    if (seat) { sitDown(world, seat); sitEye = seat.eye; camera.targetYaw = camera.yaw + Math.atan2(Math.sin(seat.yaw - camera.yaw), Math.cos(seat.yaw - camera.yaw)); return; }
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
  // the wristwatch's right button (K): held, it repeats while a field of the alarm is being set
  if (e.code === 'KeyK' && running && WATCH_ON) { watch.startDown(performance.now() / 1000, e.repeat); return; }
  if (e.repeat) return;
  // the wristwatch: I lowers it out of sight (and raises it); its buttons are J (MODE), K (START) and L (LIGHT)
  if (e.code === 'KeyI' && running && WATCH_ON) { watch.toggle(); return; }
  if (e.code === 'KeyL' && running && WATCH_ON) { watch.light(performance.now() / 1000); return; }
  if (e.code === 'KeyJ' && running && WATCH_ON) { watch.modeKey(performance.now() / 1000); return; }
  if (e.code === 'ArrowUp' && !phone.out && running) phoneToggle();
  else if (e.code === 'KeyP' && running && !payphone.active) phoneToggle();
  // debug: T / shift+T move the clock an hour, Y steps through the weather presets
  else if (e.code === 'KeyT') skipHours(world, e.shiftKey ? -1 : 1);
  else if (e.code === 'KeyY') cycleWeather(world);
  // debug: F6 switches the nearest substation (shift: all of them)
  else if (e.code === 'F6') { e.preventDefault(); togglePower(world, e.shiftKey); }
  // debug: PageUp / PageDown move a storey up or down inside a building
  else if (e.code === 'PageUp' || e.code === 'PageDown') debugFloor(world, e.code === 'PageUp' ? 1 : -1);
});

addEventListener('keyup', (e) => {
  if (e.code === 'KeyK' && WATCH_ON) watch.startUp();
  if (e.code === 'AltLeft' || e.code === 'AltRight') { e.preventDefault(); altUp(); }
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') phone.release();
});

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

/** A screen the player is busy with (13.12): the bag, the counter, asking the way; they neither walk nor turn. */
const uiBusy = () => counter.active || bagView.open || ask.open || talkView.open;

function readInput(): PlayerInput {
  // the up and down arrows belong to the phone (as in GTA IV); WASD walk
  const f = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
  const s = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
  const go = running && laptop.raise === 0 && !uiBusy();
  // walking off a seat stands the player up first (13.10f)
  if (go && (f || s) && world.player.sit) standUp(world);
  // Space jumps and C (held) crouches (14.8); with the phone out Space is its green key
  const free = go && !phone.out && !payphone.active;
  return { forward: go ? f : 0, strafe: go ? s : 0, run: input.down('ShiftLeft', 'ShiftRight'), heading: camera.yaw, jump: free && input.down('Space'), crouch: free && input.down('KeyC') };
}

// audio can only start from a click, so it is made on entering the city
let sound: Sound | null = null;
/**
 * The Tunes Player (15.9c): the phone says what is to play, and here it plays, through the earphones
 * or the phone's speaker (muffled in the pocket); the SD card's songs are read from music/ beside the game.
 */
let tunesGen = 0, tunesRoute = '';
fetch('/sd/').then((r) => (r.ok ? r.json() : [])).then((L: { name: string; size: number }[]) => { phone.sd = Array.isArray(L) ? L : []; void sdLengths(); }).catch(() => {});
/** Each SD song's length, read one at a time in the background: its size on the phone is that length at 128 kbps (songInfo). */
async function sdLengths() {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  for (const f of phone.sd) {
    if (f.secs) continue;
    try { f.secs = (await ctx.decodeAudioData(await (await fetch(`/sd/${encodeURIComponent(f.name)}`)).arrayBuffer())).duration; } catch { /* not readable: no size */ }
  }
}
function loadSd(name: string, gen: number) {
  fetch(`/sd/${encodeURIComponent(name)}`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
    .then((b) => sound!.decode(b))
    .then((buf) => { if (phone.tn.gen !== gen || !sound) return; sound.music.play(buf); if (!phone.tn.playing) sound.music.pause(); })
    .catch(() => { if (phone.tn.gen === gen) phone.tn.playing = false; });
}
/** A music key from the keyboard (or the system's media controls): as the phone's own key, with its click. */
function musicKey(k: Key) {
  if (phone.screen === 'off' || phone.screen === 'boot') return;
  phonePress(k);
}
/** A tap from the system's media controls: pressed and let go at once (no seek). */
const musicTap = (k: Key) => { musicKey(k); phone.release(); };
/**
 * The system's media controls (2026-10-06): Chromium hands the keyboard's media keys (and Windows'
 * overlay) to a page with a media session playing, so a silent sound made here (a WAV written in code)
 * loops while the music plays, and the session's actions press the phone's keys.
 */
const mediaEl = (() => {
  if (!('mediaSession' in navigator)) return null;
  const n = 8000 * 10, b = new ArrayBuffer(44 + n), v = new DataView(b), w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  const el = new Audio(URL.createObjectURL(new Blob([b], { type: 'audio/wav' })));
  el.loop = true;
  const S = navigator.mediaSession;
  S.setActionHandler('play', () => { if (!phone.tn.playing) musicKey('play'); });
  S.setActionHandler('pause', () => { if (phone.tn.playing) musicKey('play'); });
  S.setActionHandler('nexttrack', () => musicTap('next'));
  S.setActionHandler('previoustrack', () => musicTap('prev'));
  return el;
})();
let mediaGen = -1;
function syncMedia() {
  if (!mediaEl) return;
  const T = phone.tn, on = T.playing && T.cur >= 0;
  if (on && mediaEl.paused) void mediaEl.play().catch(() => {});
  else if (!on && !mediaEl.paused) mediaEl.pause();
  navigator.mediaSession.playbackState = on ? 'playing' : T.cur >= 0 ? 'paused' : 'none';
  if (T.cur >= 0 && T.gen !== mediaGen) { mediaGen = T.gen; const s = songInfo(phone, T.cur); navigator.mediaSession.metadata = new MediaMetadata({ title: s.title, artist: s.band }); }
}
function syncMusic() {
  syncMedia();
  if (!sound) return;
  const M = sound.music, T = phone.tn;
  if (phone.screen === 'off') T.playing = false;
  // the earphones thrown away (or left on a shelf): out of the ears
  if (phone.earphones && !world.bag.items.some((i) => i.good === phone.earGood)) phone.earphones = false;
  if (T.gen !== tunesGen) {
    tunesGen = T.gen;
    if (T.cur < 0) M.stop();
    else if (T.cur < TRACKS.length) M.play(TRACKS[T.cur]);
    else { M.stop(); const f = phone.sd[T.cur - TRACKS.length]; if (f) loadSd(f.name, T.gen); }
  }
  if (T.playing) M.resume(); else M.pause();
  // previous or next held: after a moment it seeks, faster the longer it is held, playing or paused
  const H = phone.seekHold, tn = performance.now() / 1000;
  if (H && T.cur >= 0 && M.length > 0) {
    if (!H.on && tn - H.at > 0.35) { H.on = true; H.last = tn; }
    if (H.on) { const dt = Math.min(0.1, tn - H.last); H.last = tn; M.seek(M.at + (H.k === 'next' ? 1 : -1) * (6 + 6 * Math.min(2, tn - H.at)) * dt); }
  }
  M.update();
  if (M.ended) { M.ended = false; phone.tunesSkip(1); }
  const r = phone.earphones ? 'phones' : phone.raise > 0.5 ? 'hand' : 'pocket';
  if (`${r}${T.vol}` !== tunesRoute) { tunesRoute = `${r}${T.vol}`; M.route(r, T.vol); }
  T.at = M.at; T.len = M.length;
  M.spectrum(phone.spec);
  // heard out loud by the people around (the speaker in the hand carries further than in the pocket; earphones, not at all)
  const s = T.cur >= 0 && M.playing ? songInfo(phone, T.cur) : null;
  barks.music = s ? { gen: T.gen, band: T.cur < TRACKS.length ? s.band : '', song: s.title, reach: r === 'phones' ? 0 : (r === 'hand' ? 7 : 2.5) * (0.4 + 0.6 * T.vol) } : null;
}
/** The storey drawn around the viewer: on the stairs, the one above once past the middle landing. */
const viewFloor = () => (world.player.liftTo >= 0 ? world.player.floor : Math.floor((world.player.z + FLOOR_H / 2) / FLOOR_H));
/** The debug lines (status, clock, substation, where): F3 shows them; the game always opens with them hidden. */
let hudOn = false;
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
  if (!sound) { sound = new Sound(); if (params.has('mute') || OPTS.mute) sound.toggleMute(); }
  sound.resume();
  if (INTRO && introAt < 0) { introAt = performance.now() / 1000; sound.intro(); }
  overlay.hidden = true;
  titleFx.stop();
  running = true;
  if (pt && !ptPrimed) { pt.prime(phone, continued); ptPrimed = true; }
  lastSave = performance.now();
  input.lock();
}

/**
 * The saved game (F.6): the seed and what changed (sim/save.ts, and the phone's, the notebook's and the
 * watch's own). CONTINUE puts it on this world (made from its seed) and goes in; NEW GAME starts the
 * city fresh (asking first when there is a save it will replace, at the next save). The game saves
 * every AUTOSAVE_S, from the pause menu, on quitting to the title and when the window is hidden.
 */
const AUTOSAVE_S = 180;
let lastSave = 0, continued = false;
function gameSave(): GameSave {
  return { v: SAVE_V, seed, at: Date.now(), world: snapWorld(world), phone: phone.snapshot(), laptop: laptop.snapshot(), watch: watch.snapshot(), cam: { yaw: camera.yaw, pitch: camera.pitch } };
}
async function saveNow(): Promise<boolean> {
  if (!running || cctv) return false;
  lastSave = performance.now();
  return writeSave(gameSave());
}
function applySave(s: GameSave) {
  applyWorld(world, s.world);
  theftSeen = world.bag.stolenAt;
  phone.restore(s.phone as ReturnType<Phone['snapshot']>);
  laptop.restore(s.laptop as ReturnType<Laptop['snapshot']>);
  gearBattery();
  watch.restore(s.watch as ReturnType<Watch['snapshot']>, performance.now() / 1000);
  camera.yaw = camera.targetYaw = s.cam.yaw; camera.pitch = camera.targetPitch = s.cam.pitch;
  sitEye = world.player.sit?.eye ?? EYE; sitK = world.player.sit ? 1 : 0;
}
/** The page again with these in the address (?mute kept): the title of another city. */
function reloadWith(q: Record<string, string>) {
  const u = new URLSearchParams(q);
  if (params.has('mute')) u.set('mute', '');
  if (params.has('playtest')) u.set('playtest', '');
  location.search = u.toString();
}
/** The game starts by itself once the GPU is ready: CONTINUE puts the save on its city first; WATCH CCTV watches that city's cameras (Esc: back to the title). */
function enter() {
  if (choice === 'cctv') { applySave(saved!); titleFx.stop(); startCctv(true); return; }
  if (choice === 'continue' && !continued) { applySave(saved!); continued = true; }
  // (DEBUG.earphones) a new game starts with headphones in the bag
  else if (DEBUG.earphones && !world.bag.items.some((i) => i.good === 'headphones')) addToBag(world.bag, 'headphones', 0, -1, true);
  begin();
}
addEventListener('visibilitychange', () => { if (document.hidden) void saveNow(); });

/** The pause menu (Esc in the game; menu.ts): the world stops while it is open. */
let paused = false;
function pause() {
  if (!running || paused || cctv) return;
  paused = true;
  input.unlock();
  menu.open(false);
}
function resume() { paused = false; menu.close(); input.lock(); }
/** F8 (13.10p): the game pauses, the screen is kept as it is, and the note waits for its text. */
function openNote() {
  if (!pt || !running || paused || cctv || notePanel.isOpen) return;
  paused = true; shotWanted = true; noteShot = null;
  input.unlock();
  notePanel.open((text) => {
    if (text) pt?.note(text, noteShot);
    noteShot = null; paused = false;
    if (!phone.out && !payphone.active && !laptop.open && !bagView.open) input.lock();
  });
}
/** What has the player's hands, for the playtest record ('' walking). */
const handsOn = () => (notePanel.isOpen ? 'note' : paused ? 'pause' : laptop.open ? 'laptop' : counter.active ? 'counter' : bagView.open ? 'bag' : ask.open ? 'ask' : talkView.open ? 'talk' : payphone.active ? 'payphone' : phone.out ? 'phone' : '');
function saveOpts() {
  Object.assign(OPTS, { style, fuse: look.fuse });
  // ?mute is for a session (the tests), not a choice to remember
  if (sound && !params.has('mute')) OPTS.mute = sound.muted;
  try { localStorage.setItem('tc.opts2', JSON.stringify(OPTS)); } catch { /* no storage: the defaults next time */ }
}
const OPTIONS: Option[] = [
  { label: 'SOUND', value: () => ((sound ? sound.muted : OPTS.mute) ? 'OFF' : 'ON'), next: () => { if (sound) sound.toggleMute(); else OPTS.mute = !OPTS.mute; saveOpts(); } },
  { label: 'STYLE', value: () => STYLES[style].name, next: () => { style = (style + 1) % STYLES.length; look.sharp = STYLES[style].sharp; resStep = STYLES[style].res; resize(); saveOpts(); } },
  { label: 'SHARPNESS', value: () => (look.fuse ? 'SOFT' : 'SHARP'), next: () => { look.fuse = !look.fuse; saveOpts(); } },
  { label: 'DEBUG LINES (F3)', value: () => (hudOn ? 'ON' : 'OFF'), next: () => { hudOn = !hudOn; } },
];
/** The debug page: what the status lines show, as text. */
function debugText(): string {
  const p = world.player, c = calendar(world.time), wx = world.weather, two = (n: number) => String(Math.floor(n)).padStart(2, '0');
  let k = 0, bd = Infinity;
  world.power.subs.forEach((S, i) => { const d = Math.hypot(S.x - p.x, S.y - p.y); if (d < bd) { bd = d; k = i; } });
  const S = world.power.subs[k];
  return [
    `VERSION   ${__VERSION__}`,
    `SEED      ${seed}`,
    `POSITION  ${p.x.toFixed(1)}, ${p.y.toFixed(1)}${p.inside >= 0 ? `  INSIDE, FLOOR ${p.floor}` : ''}`,
    `DISTRICT  ${districtName(world.city, districtAt(world.city, p.x, p.y)).toUpperCase()}`,
    `TIME      ${c.year}-${two(c.month)}-${two(c.day)} ${two(c.hour)}:${two((c.hour % 1) * 60)}`,
    `WEATHER   ${wx.preset >= 0 ? PRESETS[wx.preset][0].toUpperCase() : 'AUTO'}  CLOUD ${Math.round(wx.cloud * 100)}%  ${wx.temp.toFixed(0)}C`,
    `FRAME     ${Math.round(fps)} FPS (WORLD ${Math.round(worldFps)})  DRAW ${renderMs.toFixed(1)} ms${gpu && gpu.gpuMs >= 0 ? `  GPU ${gpu.gpuMs.toFixed(2)} ms` : ''}`,
    `GRID      ${grid.cols}x${grid.rows}${gpu ? `  EYE x${gpu.adapt.toFixed(2)}` : ''}`,
    `POWER     ${world.power.subs.filter((s) => s.on).length}/${world.power.subs.length} ON  NEAREST ${String(k + 1).padStart(2, '0')} ${Math.round(bd)}m ${compass(S.x - p.x, S.y - p.y)} ${S.on ? 'ON' : 'OFF'}`,
    `HEAT      ${world.heat.points.toFixed(2)}  TIER ${tierOf(world.heat)}`,
    '',
    'DEBUG KEYS  F3 lines  F4 noon/sunset/night  F8 playtest note  T/Shift+T +-1h  Y weather',
    '            F6 substation (Shift: all)  C nearest camera  PgUp/PgDn floor',
  ].join('\n');
}
const menu = new Menu({ options: OPTIONS, debug: debugText, save: saveNow, resume, quit: async () => { await saveNow(); reloadWith({}); } });

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
  // from the title: the title again (the page anew: it makes no city until the next choice)
  if (C.title) reloadWith({});
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
canvas.addEventListener('click', () => { if (!cctv?.title && !input.locked && !altFree && !phone.out && !laptop.open) input.lock(); });

const bolt = new Float64Array(2);
let last = performance.now();
let acc = 0;
let fps = 60;
/** Time spent drawing the world: smoothed, and the worst of the last second. */
let renderMs = 0, worstMs = 0, worstShown = 0, worstAt = 0;
/** World frames shown a second (with the pool they can lag the screen's refreshes), and the count this second. */
let worldFps = 0, worldFrames = 0, worldAt = 0;

/** The call whose conversation was opened (14.7), so it opens once. */
let talkedCall: unknown = null;
/** The good the sight rests on, and since when (real s), for its tag (14.5). */
let tagWas = '', tagSince = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;

  // camera first, so this frame's movement uses the heading the player sees
  const [mx, my] = input.takeMouse();
  if (!uiBusy()) camera.look(mx * MOUSE_SENS, -my * MOUSE_SENS);
  if (rightAt >= 0) rightMoved += Math.abs(mx) + Math.abs(my);
  const turn = (input.down(phone.out ? 'KeyE' : 'ArrowRight', 'KeyE') ? 1 : 0) - (input.down(phone.out ? 'KeyQ' : 'ArrowLeft', 'KeyQ') ? 1 : 0);
  if (running) { if (!laptop.open && !uiBusy()) camera.look(turn * 2.2 * dt, 0); }
  else camera.look(dt * 0.08, 0); // idle drift behind the title
  camera.update(dt);

  // fixed-step simulation, independent of the frame rate
  acc += dt;
  const cmd = readInput();
  // in the title's camera mode, switch cameras now and then; the pedestrians sync to its heading
  if (cctv?.title && now / 1000 - cctv.at > CCTV_HOLD) { cctv.k = pickCam(cctv.k); cctv.at = now / 1000; goToCam(cctv.k); cctvScreen(cctv.k); }
  if (cctv) cmd.heading = world.cctv[cctv.k].yaw;
  // paused (the menu): the world waits
  if (paused) acc = 0;
  while (acc >= TICK) { stepWorld(world, cmd); acc -= TICK; }
  if (running && !paused && !cctv && now - lastSave > AUTOSAVE_S * 1000) void saveNow();
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
  syncMusic();
  // a code dialing itself (from the debug settings), and the sounds the phone asked for
  const ak = phone.out ? phone.autoKey(now / 1000) : null;
  if (ak) phonePress(ak);
  for (const [k, x, y, kd = 0] of world.doorSfx) {
    // (a door far off, a shutter down the block: quieter with the distance)
    const vol = k === 3 ? 1 : Math.min(1, 3 / Math.max(3, Math.hypot(x - world.player.x, y - world.player.y)));
    if (k === 3) { sound?.ding(); sound?.doors(); } else if (k === 2) sound?.rattle(); else if (k >= 4) sound?.rollShutter(k === 4, vol); else sound?.swing(k > 0, kd, vol);
  }
  world.doorSfx.length = 0;
  payphone.update(now / 1000);
  payphone.hover = payphone.active ? payphone.keyAt(ui.cols, ui.rows, phone.cx, phone.cy) : null;
  playSfx(phone.sfx);
  playSfx(payphone.sfx);
  drawPayphone(ui, payphone, world, now / 1000, VIEW_LIGHT);
  playSfx(counter.sfx);
  for (const s of bagView.sfx) if (s === 'click') sound?.lapKey('key'); else sound?.phoneSlide(true);
  bagView.sfx.length = 0;
  if (counter.ate) { counter.ate = false; sound?.munch(); }
  // the phone's battery (13.9): plugged in at a café's outlet, and low
  if (phone.charging !== wasCharging) { wasCharging = phone.charging; if (phone.charging) { shelfNote = en.bag.charging; shelfNoteAt = now / 1000; } }
  if (phone.pulled) { phone.pulled = false; shelfNote = en.bag.pulled; shelfNoteAt = now / 1000; }
  if (phone.low !== lowSeen) { if (phone.low > lowSeen) { shelfNote = phone.low === 2 ? en.bag.battEmpty : en.bag.battLow; shelfNoteAt = now / 1000; } lowSeen = phone.low; }
  // hunger (13.5): told once at each stage, with the stomach's growl
  const hs = hungerStage(world.needs.food);
  if (hs > world.needs.told) { world.needs.told = hs; shelfNote = en.bag.hungry[hs]; shelfNoteAt = now / 1000; sound?.growl(); }
  drawCounter(ui, counter, world, now / 1000);
  // the backpack: its pile settles every frame, drawn while open
  bagView.step(dt, phone.cx, phone.cy);
  bagView.worn = phone.earphones ? phone.earGood : '';
  bagView.draw(ui, phone.cx, phone.cy, [
    [en.bag.phone, `${phone.maker} ${phone.device.model}`],
    [en.bag.laptop, `${Math.round(laptop.pc.charge * 100)}% ${laptop.pc.battWh.toFixed(0)} Wh`],
    [en.bag.sim, world.telco.player.number],
  ], now / 1000);
  // a good on a shelf under the sight: what F takes, and its price; what taking it said; walking out unpaid
  const aim = running && !phone.out && !counter.active && !bagView.open && !laptop.open ? aimedGood(world, camera.yaw, camera.pitch, eyeNow()) : null;
  if (world.bag.stolenAt !== theftSeen) { theftSeen = world.bag.stolenAt; shelfNote = en.bag.stole.replace('{n}', String(world.bag.stolen)); shelfNoteAt = now / 1000; }
  const plugAt = !aim && running && !phone.out && !counter.active && !bagView.open && !laptop.open ? outletAhead(world, camera.yaw) : null;
  // its tag, close up (14.5): after the sight rests on it a moment, within reach; before that only what F does
  const tagKey = aim ? `${aim.f.x},${aim.f.y},${aim.good}` : '';
  if (tagKey !== tagWas) { tagWas = tagKey; tagSince = now / 1000; }
  const tagOn = !!aim && aim.d <= TAG_NEAR && now / 1000 - tagSince >= TAG_WAIT && !talkView.open;
  const shelfMsg = now / 1000 - shelfNoteAt < 2.5 ? shelfNote : aim ? (tagOn ? '' : en.tag.takeName.replace('{x}', (en.goods as Record<string, string>)[aim.good] ?? aim.good))
    : plugAt ? (phone.plug?.f === plugAt ? en.bag.unplug : en.bag.plug)
    // a seat in front, or getting up from one (13.10f), when nothing else here takes F
    : !running || phone.out || counter.active || bagView.open || laptop.open || payphone.active || doorAhead(world, camera.yaw) || liftAhead(world, camera.yaw) || counter.near() ? ''
    : world.player.sit ? (sitK >= 1 ? en.seat.stand : '') : seatAhead(world, camera.yaw) ? en.seat.sit : '';
  if (shelfMsg && !bagView.open && !talkView.open) { const s = ` ${shelfMsg} `; ui.text((ui.cols - s.length) >> 1, ui.rows - 8, s, [255, 220, 140], [20, 16, 10]); }
  if (aim) { const i = (ui.rows >> 1) * ui.cols + (ui.cols >> 1); ui.put(i, '+'.charCodeAt(0), 255, 200, 80); }
  if (tagOn) drawTag(ui, aim!, world, view, layout, uiLayout, VIEW_LIGHT);
  // a shop's till in front: how to use the counter, or when the shop opens
  const till = !talkView.open && !phone.out && !counter.active && !bagView.open ? counter.near() : null;
  if (till) { const s = ` ${counterPrompt(world, till)} `; ui.text((ui.cols - s.length) >> 1, ui.rows - 6, s, [255, 220, 140], [20, 16, 10]); }
  // a door in front: F to open or close it, or that it is locked (for a moment after trying)
  if (!till && !talkView.open && !phone.out && !counter.active && !payphone.active) {
    const lift = liftAhead(world, camera.yaw) && !carHere(world, world.player.inside, world.player.floor);
    const d = lift ? null : doorAhead(world, camera.yaw), late = now / 1000 - doorNoteAt < 1.5 && doorNote;
    if (d || late || lift) { const s = ` ${late ? doorNote : lift ? (carOf(world, world.player.inside).to === world.player.floor ? en.doors.coming : en.doors.call) : world.doorWant.has(d!.key) ? en.doors.close : en.doors.open} `; ui.text((ui.cols - s.length) >> 1, ui.rows - 6, s, [255, 220, 140], [20, 16, 10]); }
  }
  // the balloons of the people around (14.4), overheard as a subtitle when near and not talking
  if (running && !cctv) { barks.update(now / 1000, camera.yaw); drawBarks(ui, barks, world, view, layout, uiLayout, !talkView.open && !counter.active); }
  // someone to ask the way, in front; the list, and what they said
  drawAskWay(ui, ask, now / 1000);
  // the conversation (14.3): the answer appears letter by letter, murmured; once it ends, they turn back to their work
  // a call picked up by someone (14.7): once they said hello, the talk opens at the bottom and the phone comes down
  const call = phone.call;
  if (call && call.chatWith >= 0 && call.state === 'talk' && call !== talkedCall && call.lines.length && !talkView.open && !counter.active) {
    talkedCall = call; talkView.start(call.chatWith, -1, now / 1000, true, call.lines[call.lines.length - 1].text); phone.atEar = true;
  }
  if (talkView.open && talkView.phone && (!call || call.state === 'ended')) { phone.atEar = false; talkView.close(); }
  if (talkView.open) {
    const t = now / 1000, n = talkView.revealed(t), T = talkView.talk!;
    // (on the phone the call's own voice says it)
    if (talkView.phone) talkView.shown = n;
    for (; talkView.shown + 3 <= n; talkView.shown += 3) if (/[a-z]/i.test(talkView.said[talkView.shown] ?? '')) sound?.murmur((world.pop.gender[T.who] ? 120 : 190) * (0.85 + hash3(T.who, 9, 9) * 0.4));
    // someone on the sidewalk stays while talked to, and walks on if the player walks off
    const q = T.biz < 0 ? world.peds.find((e) => e.id === T.who) : null;
    if (q && q.hold! < 60) q.hold = 3600;
    if (T.biz < 0 && (!q || Math.hypot(q.x - world.player.x, q.y - world.player.y) > 6)) endTalk();
    else if (talkView.last?.end && t - talkView.saidAt > talkView.said.length / 45 + 2.5 && !counter.active) endTalk();
    else drawTalk(ui, talkView, world, t);
  }
  if (!till && !talkView.open && !aim && !phone.out && !counter.active && !ask.open && !bagView.open && !payphone.active && !doorAhead(world, camera.yaw) && ask.near(camera.yaw)) { const s = ` ${en.ask.use} `; ui.text((ui.cols - s.length) >> 1, ui.rows - 6, s, [255, 220, 140], [20, 16, 10]); }
  // a payphone in front: how to use it
  const nearPay = !phone.out && !payphone.active && payphone.near() >= 0;
  if (nearPay || payphone.active) { const s = ` ${nearPay ? en.phone.payphone.use : en.phone.payphone.leave} `; ui.text((ui.cols - s.length) >> 1, ui.rows - 6, s, [255, 220, 140], [20, 16, 10]); }
  if (phone.cue) { if (phone.cue === 'ring') sound?.ring(phone.prefs.ring); else if (phone.cue === 'vibrate') sound?.vibrate(); else sound?.stopRing(); phone.cue = null; }
  phone.reach = altFree && !laptop.open;
  phone.dialHot = !input.locked && onDial(phone.cx, phone.cy);
  // how to reach the music with the phone in the pocket (2026-10-06): a quiet hint while Alt is up
  if (running && !altFree && !phone.out && !laptop.open && !payphone.active && !bagView.open && !talkView.open && phone.handy < 0.05 && phone.peek < 0.05) {
    const TU = en.phone.apps.tunes, s = ` ${phone.tn.cur >= 0 ? TU.altMusic : TU.altFree} `;
    ui.text(ui.cols - s.length - 2, ui.rows - 2, s, [150, 130, 100], [16, 13, 9]);
  }
  phone.hover = phone.out || (laptop.open && phone.raise > 0.5) || phone.handy > 0.5 ? keyAt(ui.cols, ui.rows, phone, phone.cx, phone.cy) : null;
  // over the notebook while it is open (to be clicked), under it otherwise
  watch.update(dt, world.time, now / 1000, world.player.inside >= 0 ? 21 : world.weather.temp);
  for (const f of watch.sfx) {
    if (f === 'chime') sound?.watchChime();
    else if (f === 'alarm') sound?.watchAlarm();
    else if (f === 'beep') sound?.watchBeep();
    else if (f === 'light') sound?.phoneKey(false, true, false);
  }
  watch.sfx.length = 0;
  // in the game only (not over the title or the loading screen)
  if (running && WATCH_ON) drawWatch(ui, watch, world.time, now / 1000, VIEW_LIGHT, VIEW_GLINT, watchMakerName(world.city), camera.yaw);
  const phoneOnTop = laptop.open;
  PHONE_SCREEN.at = null;
  if (!phoneOnTop) drawPhone(ui, phone, world, uiLayout.cellW / uiLayout.cellH, now / 1000, VIEW_LIGHT, VIEW_GLINT);
  // the notebook: its schedule, its sounds, the drive's hum, and on screen
  laptop.update(dt, now / 1000);
  sitK = world.player.sit ? Math.min(1, sitK + dt / 0.4) : Math.max(0, sitK - dt / 0.3);
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
    scrTermW = (T.cols * cw) / uiLayout.cellW; scrTermH = (T.rows * chh) / uiLayout.cellH;
    drawLaptop3d(ui, T, laptop, world, now / 1000, VIEW_LIGHT, VIEW_GLINT, { yaw: camera.yaw, pitch: camera.pitch, aspect: uiLayout.cellW / uiLayout.cellH, still: !input.drag, termW: scrTermW, termH: scrTermH });
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
  if (pt && ptPrimed && running && !cctv) pt.frame(dt, phone, camera.yaw, camera.pitch, handsOn(), input.down('KeyW', 'KeyA', 'KeyS', 'KeyD'));
  if (hudOn) {
    // the debug lines (F3; redrawn in 13.10p): one panel at the top left, in groups, cut to the screen's width
    type RGB = [number, number, number];
    const W = Math.min(ui.cols - 2, 74), BG: RGB = [10, 9, 8], EDGE: RGB = [110, 92, 66], AMBER: RGB = [255, 176, 74], CYAN: RGB = [120, 220, 255], DIM: RGB = [185, 165, 135];
    const two = (n: number) => String(Math.floor(n)).padStart(2, '0');
    let y = 1;
    const head = (name: string, right = '') => {
      const l = `+- ${name} `, r = right ? ` ${right} -+` : '+';
      ui.text(1, y++, (l + '-'.repeat(Math.max(0, W - l.length - r.length)) + r).slice(0, W), EDGE, BG);
    };
    const row = (s: string, fg: RGB = DIM) => {
      ui.text(1, y, '|' + ' '.repeat(W - 2) + '|', EDGE, BG);
      ui.text(3, y++, s.slice(0, W - 4), fg, BG);
    };
    head('DEBUG', `v${__VERSION__}`);
    row(`SEED ${seed}  GRID ${grid.cols}x${grid.rows}  ${STYLES[style].name} ${look.fuse ? 'SOFT' : 'SHARP'}`, AMBER);
    row(`${Math.round(fps)} FPS (WORLD ${Math.round(worldFps)})  DRAW ${renderMs.toFixed(1)} ms (MAX ${worstShown.toFixed(1)})${gpu && gpu.gpuMs >= 0 ? `  GPU ${gpu.gpuMs.toFixed(2)} ms` : ''}${gpu ? `  EYE x${gpu.adapt.toFixed(2)}` : ''}`);
    head('PLAYER');
    row(`POS ${p.x.toFixed(1)},${p.y.toFixed(1)}  Z ${p.z.toFixed(1)}  ${p.inside >= 0 ? `INSIDE FLOOR ${p.floor}` : 'OUTSIDE'}${p.liftTo >= 0 ? `  LIFT TO ${p.liftTo}` : ''}`, AMBER);
    const deg = (r: number) => Math.round((r * 180) / Math.PI), bearing = ((deg(camera.yaw) + 90) % 360 + 360) % 360;
    row(`LOOK ${String(bearing).padStart(3, '0')} ${compass(Math.cos(camera.yaw), Math.sin(camera.yaw))}  PITCH ${deg(camera.pitch) > 0 ? '+' : ''}${deg(camera.pitch)}  ${p.speed > 4 ? 'RUN' : 'WALK'} ${p.speed.toFixed(1)} m/s`);
    head('PLACE');
    row(`${cityName(city).toUpperCase()} / ${districtName(city, d).toUpperCase()} (${districtType(city, d)})  SECTOR ${sectorCode(city, p.x, p.y)}`, CYAN);
    row(`${Math.abs(diagS(city.diagonal, p.x, p.y)) < city.diagonal.w / 2 + SIDEWALK ? diagonalName(city) : roadName(city, true, nearestRoad(city.xb, city.xCell, p.x))} & ${roadName(city, false, nearestRoad(city.yb, city.yCell, p.y))}`);
    if (p.inside >= 0) {
      const k = city.businesses.findIndex((b) => b.building === p.inside);
      row(k >= 0 ? `IN ${businessName(city, k).toUpperCase()} (${city.businesses[k].kind})  BUILDING ${p.inside}` : `IN BUILDING ${p.inside}`);
    }
    let lm = 0;
    city.landmarks.forEach((l, k) => { if (Math.hypot(l.x - p.x, l.y - p.y) < Math.hypot(city.landmarks[lm].x - p.x, city.landmarks[lm].y - p.y)) lm = k; });
    const L = city.landmarks[lm];
    row(`LANDMARK ${landmarkName(city, lm)} ${Math.round(Math.hypot(L.x - p.x, L.y - p.y))}m ${compass(L.x - p.x, L.y - p.y)}`);
    head('TIME');
    const cal = calendar(world.time), wx = world.weather;
    row(`${cal.year}-${two(cal.month)}-${two(cal.day)} ${two(cal.hour)}:${two((cal.hour % 1) * 60)}  ${wx.preset >= 0 ? PRESETS[wx.preset][0].toUpperCase() : 'AUTO'} CLOUD ${Math.round(wx.cloud * 100)}% ${wx.precip > 0 ? `${wx.snow ? 'SNOW' : 'RAIN'} ${Math.round(wx.precip * 100)}% ` : ''}${wx.temp.toFixed(0)}C WIND ${Math.hypot(wx.windX, wx.windY).toFixed(0)} m/s`, CYAN);
    head('SYSTEMS');
    // the nearest substation (a fenced yard), how far, which way and whether it runs
    {
      let k = 0, bd = Infinity;
      world.power.subs.forEach((S, i) => { const dd = Math.hypot(S.x - p.x, S.y - p.y); if (dd < bd) { bd = dd; k = i; } });
      const S = world.power.subs[k];
      row(`POWER ${world.power.subs.filter((s) => s.on).length}/${world.power.subs.length} ON  SUBSTATION ${two(k + 1)} ${Math.round(bd)}m ${compass(S.x - p.x, S.y - p.y)} ${S.on ? 'ON' : 'OFF'}${S.yard ? '' : ' (NO YARD)'}`, S.on ? [140, 255, 170] : [255, 120, 90]);
    }
    // [HACKING] debug: the heat the player has drawn, its tier and the traces behind it
    if (world.heat.points > 0.005) {
      const H = world.heat, tier = tierOf(H), by: Record<string, number> = {};
      for (const t of H.traces) by[t.kind] = (by[t.kind] ?? 0) + 1;
      const tr = (['witness', 'camera', 'antenna', 'wifi'] as const).filter((k) => by[k]).map((k) => `${by[k]}${k[0].toUpperCase()}`).join(' ');
      const cop = H.cop ? ` COP ${Math.round(Math.hypot(H.cop.x - p.x, H.cop.y - p.y))}m ${compass(H.cop.x - p.x, H.cop.y - p.y)}` : '';
      row(`HEAT ${H.points.toFixed(2)} TIER ${tier} [${['CLEAN', 'LOCAL', 'CITY', 'FEDERAL'][tier]}] ${tr}${cop}`, tier >= 3 ? [255, 90, 90] : tier >= 2 ? [255, 150, 70] : [255, 210, 90]);
    }
    row(pt ? `PLAYTEST REC ${pt.file}` : 'PLAYTEST OFF (jogar-playtest.bat)', pt ? [255, 120, 120] : DIM);
    head('KEYS');
    row('F3 LINES  F4 NOON/SUNSET/NIGHT  F8 NOTE  T/SHIFT+T +-1H  Y SKY');
    row('K POWER  F6 SUBSTATION  C CAMERA  PGUP/PGDN FLOOR');
    row(`^ PHONE  N LAPTOP  ${WATCH_ON ? 'H WATCH  J MODE  I START  ' : ''}M SOUND ${sound && !sound.muted ? 'ON' : 'OFF'}`);
    ui.text(1, y, '+' + '-'.repeat(W - 2) + '+', EDGE, BG);
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
      `${operatorName(city, world.telco.player.op ?? 0).toUpperCase()} ... SIGNAL OK`,
    ]);
  }
  const T3 = termMode === 'fb' ? termFb : termTx;
  const termAt = screenAt ? { grid: T3, x: uiLayout.originX + screenAt[0] * uiLayout.cellW, y: uiLayout.originY + screenAt[1] * uiLayout.cellH } : null;
  // the GPU's compositor also takes the screen seen from aside (not shown as a layer), for its glow
  const G = glassBox, toPx = (c: number, k: number) => (k & 1 ? uiLayout.originY + c * uiLayout.cellH : uiLayout.originX + c * uiLayout.cellW);
  const lapAt = G && termMode ? { grid: T3, x: termAt?.x ?? 0, y: termAt?.y ?? 0, show: !!termAt, glass: G.map(toPx) } : null;
  // the watch's lit LCD glows like a screen, when the phone's is not up (the compositor takes one)
  if (onGpu) comp!.draw(world, view, ui, hd, lapAt, PHONE_SCREEN.at ?? WATCH_LCD.at);
  else renderer.draw(grid, ui, hd, termAt);
  // the note's picture: read in the same task the frame was drawn in (the GPU's canvas is cleared once shown)
  if (shotWanted) { shotWanted = false; try { noteShot = (onGpu ? gpuCanvas : canvas).toDataURL('image/png'); } catch { noteShot = null; } }
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
    enter();
  }, (err) => console.error('WebGPU:', err));
});
