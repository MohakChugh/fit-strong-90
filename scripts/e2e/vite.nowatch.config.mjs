// A watch-free dev server for e2e runs while files are being edited elsewhere
// (the acceptance runner starts one itself when given no --url):
//   npx vite --config scripts/e2e/vite.nowatch.config.mjs --port 49731 --strictPort
//   npm run e2e:acceptance -- --url=http://127.0.0.1:49731/fit-strong-90/
// It never reloads a module it has already served, so restart it to pick up edits.
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// One dependency cache per port: several of these servers run side by side, and
// one re-optimising its dependencies must not pull the files from under another.
const port = process.argv[process.argv.indexOf('--port') + 1] ?? '5174';
export default {
  root,
  base: '/fit-strong-90/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.join(root, 'src') } },
  cacheDir: path.join(root, `node_modules/.vite-nowatch-${/^\d+$/.test(port) ? port : '5174'}`),
  server: { port: 5174, strictPort: true, host: '127.0.0.1', watch: null, hmr: false },
};
