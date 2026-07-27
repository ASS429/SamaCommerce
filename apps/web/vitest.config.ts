import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// T6 — config Vitest dédiée (sans le plugin PWA, inutile en test).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
