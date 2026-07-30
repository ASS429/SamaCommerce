import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// T6 — config Vitest dédiée (sans le plugin PWA, inutile en test).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // `build/` contient le code qui tourne au BUILD (empreintes CSP) : il est
    // testé au même titre que le reste, sinon une régression n'apparaît qu'en
    // production.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'build/**/*.{test,spec}.ts'],
    css: false,
  },
})
