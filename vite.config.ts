import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import type { Plugin } from 'vite'
import { releaseFiles, releaseStamp } from './src/app/release'

/**
 * Production-only security policy. GitHub Pages can't send custom headers,
 * so it goes in a meta tag (frame-ancestors and X-Frame-Options can't be set
 * this way). Everything loads from our own origin except the opt-in map
 * pictures, which are OpenStreetMap tiles; health data never leaves it.
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
  // Opt-in map pictures under a kept route (journey §9.5, J§22): OpenStreetMap's standard tiles, and nothing else.
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
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
  transformIndexHtml: {
    // Last, so the hash covers the inline script exactly as it ships.
    order: 'post',
    handler: (html) => {
      // index.html's one inline script sets dark mode before the first paint.
      // Allow exactly that script by its hash, computed here so it can never
      // go stale, rather than loosening script-src for everything.
      const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map(([, body]) => `'sha256-${crypto.createHash('sha256').update(body).digest('base64')}'`)
      const csp = CSP.replace("script-src 'self'", ["script-src 'self'", ...hashes].join(' '))
      return [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
        { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head-prepend' },
      ]
    },
  },
})

/**
 * Fill the service worker's precache list with every file of the release
 * (board D120): what Vite emits, each under a name that changes with its
 * bytes, the 3D models and the icons included, and this release's own copy
 * of index.html, `shell-<stamp>.html`, under a name no other release has, so
 * no precached URL ever answers with another release's bytes (P8S-15). The
 * stamp is every byte the release ships; the number is its place in order,
 * higher than every release before it (P8S-14).
 */
const precacheList = (base: string): Plugin => ({
  name: 'precache-list',
  apply: 'build',
  async writeBundle(options, bundle) {
    const dir = options.dir ?? 'dist'
    const files = releaseFiles(Object.keys(bundle))
    const sw = path.join(dir, 'sw.js')
    const src = fs.readFileSync(sw, 'utf8')
    for (const mark of ['[/* __PRECACHE__ */]', "'__BUILD__'", "'__NUMBER__'"]) {
      if (!src.includes(mark)) throw new Error(`sw.js is missing ${mark}`)
    }
    const build = await releaseStamp(f => new Uint8Array(fs.readFileSync(path.join(dir, f))), [...files, 'index.html'], src)
    const shell = `shell-${build}.html`
    fs.copyFileSync(path.join(dir, 'index.html'), path.join(dir, shell))
    const number = Number(process.env.FITSTRONG_RELEASE_NUMBER ?? Date.now())
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`FITSTRONG_RELEASE_NUMBER must be a whole number, not ${process.env.FITSTRONG_RELEASE_NUMBER}`)
    fs.writeFileSync(sw, src
      .replace('[/* __PRECACHE__ */]', JSON.stringify([...files, shell].map(f => base + f)))
      .replace("'__BUILD__'", JSON.stringify(build))
      .replace("'__NUMBER__'", JSON.stringify(String(number))))
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
