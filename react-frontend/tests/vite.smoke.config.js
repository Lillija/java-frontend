import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds the app as a plain ES module so tests/react-smoke.mjs can mount it in jsdom.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: resolve(import.meta.dirname, 'build'),
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, 'smoke-entry.jsx'),
      formats: ['es'],
      fileName: 'smoke',
    },
  },
})
