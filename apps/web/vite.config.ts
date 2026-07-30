import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { inlineScriptHashes } from './build/inlineCsp.ts'

// S5 — Injecte une Content-Security-Policy stricte dans le HTML DE PRODUCTION
// uniquement (le dev garde HMR/eval de Vite intact). style-src garde
// 'unsafe-inline' car React applique des styles en attribut `style=`.
const cspProd: Plugin = {
  name: 'html-csp-prod',
  apply: 'build',
  transformIndexHtml: {
    // `post` : on veut hacher le HTML FINAL, une fois que les autres greffons
    // (dont le PWA) ont injecté ce qu'ils avaient à injecter.
    order: 'post',
    handler(html) {
      // L'API est sur un autre domaine (Render) : on autorise son origine dans
      // connect-src, dérivée de VITE_API_URL au build (pas de domaine en dur).
      let apiOrigin = ''
      try {
        const u = process.env.VITE_API_URL || ''
        apiOrigin = u ? new URL(u).origin : ''
      } catch { apiOrigin = '' }
      const connectSrc = ["'self'", apiOrigin].filter(Boolean).join(' ')
      const scriptSrc = ["'self'", ...inlineScriptHashes(html)].join(' ')

      // NB : `frame-ancestors` est ignoré dans une balise <meta> (nécessite un
      // en-tête HTTP) → on ne le met pas ici pour éviter un warning console.
      const csp = [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        `connect-src ${connectSrc}`,
        "media-src 'self' blob:",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        'upgrade-insecure-requests',
      ].join('; ')
      return {
        html,
        tags: [
          { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
          { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head' },
        ],
      }
    },
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    cspProd,
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'SamaCommerce — Gestion de boutique',
        short_name: 'SamaCommerce',
        description: 'Gestion commerciale pour les commerçants du Sénégal',
        lang: 'fr',
        theme_color: '#7C3AED',
        background_color: '#5B21B6',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Cache des réponses API GET (consultation hors-ligne)
            urlPattern: ({ url, request }) => url.pathname.startsWith('/api') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
