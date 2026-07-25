import { defineConfig } from 'vitest/config'
import path from 'path'

// Test config lives here rather than in vite.config.ts so the app's Vite config
// stays typed by Vite alone (a `test` key there fails `tsc -b`).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
