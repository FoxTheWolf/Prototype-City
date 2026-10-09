// The game in a window of its own (R.37): full screen, always the same resolution and nothing of a
// browser's around it. Serves the built game (dist/, from `npm run build`) on 127.0.0.1 with the
// cross-origin isolation the render workers need (as vite.config.ts does), and opens it.
// F11 leaves and enters full screen; Alt+F4 closes. Arguments after the script go to the page's
// query string (`npm run electron -- seed=42`).
const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { playtest } = require('./playtest.cjs');
const { sdcard } = require('./sdcard.cjs');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 47180;
// (L.13) the user's own recorded sounds for development, never copied into dist/ nor git: served when the folder exists
const EGGS = path.join(__dirname, '..', 'easter eggs');
// (13.10p) the playtest record: playtest/ beside the game (the repository's in development, the .exe's folder when packaged)
const PLAYTEST = app.isPackaged ? path.join(path.dirname(process.execPath), 'playtest') : path.join(__dirname, '..', 'playtest');
// (15.9c) the phone's SD card: the player's music in music/ beside the game
const MUSIC = app.isPackaged ? path.join(path.dirname(process.execPath), 'music') : path.join(__dirname, '..', 'music');
const TYPES = { '.mp3': 'audio/mpeg', '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml' };
const ISOLATE = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

// the game window, for /relock: the pause menu closed by Esc asks for the pointer again as a user gesture
// (the page's own request from the Esc key is refused; main.ts, resume)
let win = null;

function serve() {
  const server = http.createServer((req, res) => {
    if (req.url === '/relock') { win?.webContents.executeJavaScript('window.__relock?.()', true).catch(() => {}); res.writeHead(204, ISOLATE); res.end(); return; }
    if (playtest(PLAYTEST, req, res, ISOLATE)) return;
    if (sdcard(MUSIC, req, res, ISOLATE)) return;
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (url.startsWith('/easter eggs/')) {
      const egg = path.join(EGGS, url.slice('/easter eggs/'.length));
      if (!egg.startsWith(EGGS) || !fs.existsSync(egg) || fs.statSync(egg).isDirectory()) { res.writeHead(404, ISOLATE); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(egg)] ?? 'application/octet-stream', ...ISOLATE });
      fs.createReadStream(egg).pipe(res);
      return;
    }
    let file = path.join(DIST, url === '/' ? 'index.html' : url);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', ...ISOLATE });
    fs.createReadStream(file).pipe(res);
  });
  // always the same port when it is free: the origin stays the same between runs, so Chromium keeps its caches
  // for it (the compiled shaders, the saved population, localStorage); any free port if it is taken
  return new Promise((ok) => {
    server.once('error', () => server.listen(0, '127.0.0.1', () => ok(server.address().port)));
    server.listen(PORT, '127.0.0.1', () => ok(server.address().port));
  });
}

// the title's opening plays its sounds before any click (titleLogo.ts)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (process.env.TC_HEAP) app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.whenReady().then(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('dist/ is missing: run `npm run build` first.'); app.quit(); return; }
  const port = await serve();
  // TC_CHECK=1: no window; prints whether WebGPU and the isolation work here, then quits (for testing)
  // TC_HEAP=1 (16.1): no window either; the night street for TC_HEAP_S s (15) under the heap sampler, then the
  // functions that allocate the most per frame, and quits (what feeds the garbage collector's pauses)
  const heap = !!process.env.TC_HEAP, check = !!process.env.TC_CHECK || heap;
  // (a hidden window gets ~1 frame a second: the sampler's is shown, small and off the screen)
  win = new BrowserWindow({ fullscreen: !check, show: !check || heap, autoHideMenuBar: false, backgroundColor: '#000000', title: 'GRID DOWN: Terminal State', ...(heap ? { x: -4000, y: 0, width: 1280, height: 720, webPreferences: { backgroundThrottling: false } } : {}) });
  if (heap) { require('./heap.cjs').heap(win, Number(process.env.TC_HEAP_S) || 15).finally(() => app.quit()); win.loadURL(`http://127.0.0.1:${port}/?seed=42&mute&pos=828,800&look=0&at=2008-07-03T22:00`); return; }
  if (check) win.webContents.once('did-finish-load', async () => {
    console.log(await win.webContents.executeJavaScript(`(async () => { while (document.getElementById('ready')?.hidden !== false && performance.now() < 60000) await new Promise((r) => setTimeout(r, 50)); return JSON.stringify({ isolated: crossOriginIsolated, adapter: !!(await navigator.gpu?.requestAdapter()), title: document.title, readyMs: Math.round(performance.now()), origin: location.origin }); })()`));
    app.quit();
  });
  // the menu bar stays hidden (its shortcuts still work): with autoHide, Alt would bring it up, and Alt is the game's (15.9a)
  win.setMenuBarVisibility(false);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  const args = process.argv.slice(2).filter((a) => /^\w+(=.*)?$/.test(a));
  // the packaged .exe (the demo for friends) always keeps the playtest record (13.10p)
  if (app.isPackaged && !args.includes('playtest')) args.push('playtest');
  const query = args.join('&');
  win.loadURL(`http://127.0.0.1:${port}/${query ? '?' + query : ''}`);
});
app.on('window-all-closed', () => app.quit());
