import { defineConfig } from 'vite';

const ISOLATE = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

export default defineConfig({
  // PORT lets the app's preview pick a free port when other sessions hold 5173; cross-origin
  // isolation lets the render workers share the screen's memory (render/pool.ts)
  // on 127.0.0.1: some browsers (Zen, Firefox) look for localhost there, and Node may listen on ::1 only
  server: { host: '127.0.0.1', port: Number(process.env.PORT) || 5173, strictPort: true, headers: ISOLATE },
  preview: { headers: ISOLATE },
});
