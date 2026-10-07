import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import type { Plugin } from 'vite'

/**
 * Production-only security policy. GitHub Pages can't send custom headers,
 * so it goes in a meta tag (frame-ancestors and X-Frame-Options can't be set
 * this way). Everything loads from our own origin; health data never leaves it.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // Spec §10.3 asks for `style-src 'self'` with only `style-src-attr
  // 'unsafe-inline'`. The toast library (sonner) injects its whole stylesheet
  // as a <style> element at import time, so that would block it; pinning its
  // hash would silently unstyle toasts on any version bump. Inline *styles*
  // carry no script, there is no injection sink (no dangerouslySetInnerHTML,
  // no user-generated content) and `script-src 'self'` is unchanged.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  // data: covers the silent clip that unlocks audio on iOS.
  "media-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

const securityMeta = (): Plugin => ({
  name: 'security-meta',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
    { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head-prepend' },
  ],
})

/**
 * Fill the service worker's precache list with every built asset and the 3D
 * models, so an installed app opens any screen offline, not only the ones it
 * happened to load while online. The list's hash names the cache, so each
 * deploy installs fresh files and drops the old ones.
 */
const precacheList = (base: string): Plugin => ({
  name: 'precache-list',
  apply: 'build',
  writeBundle(options, bundle) {
    const dir = options.dir ?? 'dist';
    const assets = Object.keys(bundle).filter(f => !f.endsWith('.map') && f !== 'index.html' && f !== 'sw.js');
    const models = fs.readdirSync(path.join(dir, 'models')).filter(f => f.endsWith('.bin')).map(f => `models/${f}`);
    const urls = [...assets, ...models].sort().map(f => base + f);
    const build = crypto.createHash('sha256').update(urls.join('\n')).digest('hex').slice(0, 12);
    const sw = path.join(dir, 'sw.js');
    const src = fs.readFileSync(sw, 'utf8');
    if (!src.includes('[/* __PRECACHE__ */]') || !src.includes("'__BUILD__'")) throw new Error('sw.js is missing its precache placeholders');
    fs.writeFileSync(sw, src.replace('[/* __PRECACHE__ */]', JSON.stringify(urls)).replace("'__BUILD__'", JSON.stringify(build)));
  },
})

export default defineConfig({
  base: '/fit-strong-90/',
  plugins: [react(), tailwindcss(), securityMeta(), precacheList('/fit-strong-90/')],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
