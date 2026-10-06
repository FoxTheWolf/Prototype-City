// The playtest record's writer (13.10p), shared by the Electron server (main.cjs) and Vite (vite.config.ts):
// GET /playtest/ping answers when it is on; POST /playtest/<name>.jsonl appends the lines to that file,
// POST /playtest/<name>.png keeps a note's picture (the body is a PNG data URL). Files go in `dir`.
const fs = require('node:fs');
const path = require('node:path');

const NAME = /^[\w.-]+\.(jsonl|png)$/;
const MAX = 32 * 1024 * 1024;

/** Handles the request when it is one of the playtest's (true), else leaves it alone (false). */
function playtest(dir, req, res, headers = {}) {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!url.startsWith('/playtest/')) return false;
  const name = url.slice('/playtest/'.length);
  const done = (code) => { res.writeHead(code, { 'Content-Type': 'text/plain', ...headers }); res.end(code === 200 ? 'ok' : ''); };
  if (req.method === 'GET' && name === 'ping') { done(200); return true; }
  if (req.method !== 'POST' || !NAME.test(name)) { done(404); return true; }
  const parts = [];
  let size = 0;
  req.on('data', (c) => { size += c.length; if (size <= MAX) parts.push(c); });
  req.on('end', () => {
    if (size > MAX) { done(413); return; }
    fs.mkdirSync(dir, { recursive: true });
    const body = Buffer.concat(parts), file = path.join(dir, name);
    if (name.endsWith('.png')) fs.writeFileSync(file, Buffer.from(body.toString('latin1').replace(/^data:image\/png;base64,/, ''), 'base64'));
    else fs.appendFileSync(file, body);
    done(200);
  });
  return true;
}

module.exports = { playtest };
