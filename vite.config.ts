import { defineConfig } from 'vite';

export default defineConfig({
  // PORT lets the app's preview pick a free port when other sessions hold 5173
  server: { port: Number(process.env.PORT) || 5173, strictPort: true },
});
