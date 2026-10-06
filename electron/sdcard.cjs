// (15.9c) The phone's SD card: the player's own music, from a folder beside the game (music/: the
// repository's in development, the .exe's folder when packaged). Served by Electron and by Vite alike:
// GET /sd/ lists the songs ([{ name, size }]), GET /sd/<name> sends one. The folder is never in git.
const fs = require('node:fs');
const path = require('node:path');

const KINDS = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.opus': 'audio/ogg' };

/** Answers the request when it is the SD card's (true), else leaves it (false). */
function sdcard(dir, req, res, headers = {}) {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!url.startsWith('/sd/')) return false;
  const root = path.resolve(dir), name = url.slice(4);
  if (!name) {
    let list = [];
    try {
      list = fs.readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isFile() && KINDS[path.extname(d.name).toLowerCase()])
        .map((d) => ({ name: d.name, size: fs.statSync(path.join(root, d.name)).size }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch { /* no folder: an empty card */ }
    res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify(list));
    return true;
  }
  const file = path.join(root, name), kind = KINDS[path.extname(file).toLowerCase()];
  if (!file.startsWith(root + path.sep) || !kind || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, headers); res.end(); return true; }
  res.writeHead(200, { 'Content-Type': kind, ...headers });
  fs.createReadStream(file).pipe(res);
  return true;
}

module.exports = { sdcard };
