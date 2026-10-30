import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiTarget = process.env['API_PROXY_TARGET'] ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The browser only ever talks to its own origin. In development Vite forwards API calls to
    // the server, so no cross-origin access (and no CORS configuration) is needed.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
});
