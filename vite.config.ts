import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';

const ISOLATE = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
// (13.10p) the playtest record's writer, the same as Electron's: playtest/ in the repository
const { playtest } = createRequire(import.meta.url)('./electron/playtest.cjs');
// the version the game shows (F3) and records: the newest in CHANGELOG.md
const VERSION = /^## (\S+)/m.exec(readFileSync('CHANGELOG.md', 'utf8'))?.[1] ?? '?';

export default defineConfig({
  // PORT lets the app's preview pick a free port when other sessions hold 5173; cross-origin
  // isolation lets the render workers share the screen's memory (render/pool.ts)
  // on 127.0.0.1: some browsers (Zen, Firefox) look for localhost there, and Node may listen on ::1 only
  server: { host: '127.0.0.1', port: Number(process.env.PORT) || 5173, strictPort: true, headers: ISOLATE },
  preview: { headers: ISOLATE },
  define: { __VERSION__: JSON.stringify(VERSION) },
  plugins: [{ name: 'playtest', configureServer(s) { s.middlewares.use((req, res, next) => { if (!playtest('playtest', req, res)) next(); }); } }],
});
