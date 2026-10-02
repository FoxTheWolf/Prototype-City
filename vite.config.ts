import { defineConfig } from 'vite';

const ISOLATE = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };

export default defineConfig({
  // PORT lets the app's preview pick a free port when other sessions hold 5173; cross-origin
  // isolation lets the render workers share the screen's memory (render/pool.ts)
  server: { port: Number(process.env.PORT) || 5173, strictPort: true, headers: ISOLATE },
  preview: { headers: ISOLATE },
});
