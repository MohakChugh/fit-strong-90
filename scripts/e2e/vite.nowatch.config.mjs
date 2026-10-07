// A watch-free dev server for e2e runs while files are being edited elsewhere:
//   npx vite --config scripts/e2e/vite.nowatch.config.mjs   (port 5174)
//   npm run e2e -- --url=http://127.0.0.1:5174/fit-strong-90/
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export default {
  root,
  base: '/fit-strong-90/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.join(root, 'src') } },
  cacheDir: path.join(root, 'node_modules/.vite-nowatch'),
  server: { port: 5174, strictPort: true, host: '127.0.0.1', watch: null, hmr: false },
};
