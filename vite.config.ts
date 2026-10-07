import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
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

export default defineConfig({
  base: '/fit-strong-90/',
  plugins: [react(), tailwindcss(), securityMeta()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
