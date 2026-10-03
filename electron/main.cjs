// The game in a window of its own (R.37): full screen, always the same resolution and nothing of a
// browser's around it. Serves the built game (dist/, from `npm run build`) on 127.0.0.1 with the
// cross-origin isolation the render workers need (as vite.config.ts does), and opens it.
// F11 leaves and enters full screen; Alt+F4 closes. Arguments after the script go to the page's
// query string (`npm run electron -- seed=42`).
const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const DIST = path.join(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml' };
const ISOLATE = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(DIST, url === '/' ? 'index.html' : url);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', ...ISOLATE });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server.address().port)));
}

app.whenReady().then(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('dist/ is missing: run `npm run build` first.'); app.quit(); return; }
  const port = await serve();
  // TC_CHECK=1: no window; prints whether WebGPU and the isolation work here, then quits (for testing)
  const check = !!process.env.TC_CHECK;
  const win = new BrowserWindow({ fullscreen: !check, show: !check, autoHideMenuBar: true, backgroundColor: '#000000', title: 'Terminal City' });
  if (check) win.webContents.once('did-finish-load', async () => {
    console.log(await win.webContents.executeJavaScript(`(async () => JSON.stringify({ isolated: crossOriginIsolated, adapter: !!(await navigator.gpu?.requestAdapter()), title: document.title }))()`));
    app.quit();
  });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  const query = process.argv.slice(2).filter((a) => /^\w+(=.*)?$/.test(a)).join('&');
  win.loadURL(`http://127.0.0.1:${port}/${query ? '?' + query : ''}`);
});
app.on('window-all-closed', () => app.quit());
