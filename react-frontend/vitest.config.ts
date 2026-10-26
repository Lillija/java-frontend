/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Vitest reuses the Vite pipeline, so TS/JSX resolution matches the real build.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom', // DOM + localStorage in Node — no browser needed in CI
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
})
