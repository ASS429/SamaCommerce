import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// T6 — configuration de Vitest dédiée (sans le greffon PWA, inutile en test).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/preparation.ts'],
    // `compilation/` contient le code qui tourne à la CONSTRUCTION (empreintes
    // CSP) : il est testé au même titre que le reste, sinon une régression
    // n'apparaît qu'en production.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'compilation/**/*.{test,spec}.ts'],
    css: false,
  },
})
