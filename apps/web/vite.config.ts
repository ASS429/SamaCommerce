import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { empreintesScriptsEnLigne } from './compilation/empreintesCsp.ts'

// S5 — Injecte une Content-Security-Policy stricte dans le HTML DE PRODUCTION
// uniquement (le développement garde le rechargement à chaud et l'eval de Vite
// intacts). style-src garde 'unsafe-inline' car React applique des styles en
// attribut `style=`.
const cspProduction: Plugin = {
  name: 'html-csp-production',
  apply: 'build',
  transformIndexHtml: {
    // `post` : on veut hacher le HTML FINAL, une fois que les autres greffons
    // (dont le PWA) ont injecté ce qu'ils avaient à injecter.
    order: 'post',
    handler(html) {
      // L'API est sur un autre domaine (Render) : on autorise son origine dans
      // connect-src, dérivée de VITE_URL_API à la construction (pas de domaine
      // écrit en dur).
      let origineApi = ''
      try {
        const adresse = process.env.VITE_URL_API || ''
        origineApi = adresse ? new URL(adresse).origin : ''
      } catch { origineApi = '' }

      /* GARDE-FOU. Sans origine d'API, la CSP produite est `connect-src 'self'`
       * et le navigateur bloque TOUS les appels : l'application se déploie,
       * s'affiche... et chaque écran annonce « Le serveur ne répond pas ».
       * Panne déjà vécue deux fois, invisible à la construction. On échoue
       * donc bruyamment plutôt que de livrer un site mort : Render garde alors
       * la version précédente en ligne.
       *
       * Uniquement sur Render (variable RENDER posée par la plateforme) : en
       * local et en intégration continue, l'application passe par le proxy de
       * Vite et n'a pas besoin de cette variable. */
      if (!origineApi && process.env.RENDER) {
        throw new Error(
          "VITE_URL_API est vide : la CSP bloquerait tous les appels vers l'API. "
          + 'Définissez-la dans le service web Render avant de déployer.',
        )
      }
      const connectSrc = ["'self'", origineApi].filter(Boolean).join(' ')
      const scriptSrc = ["'self'", ...empreintesScriptsEnLigne(html)].join(' ')

      // NB : `frame-ancestors` est ignoré dans une balise <meta> (il faut un
      // en-tête HTTP) → on ne le met pas ici pour éviter un avertissement.
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
    cspProduction,
    react(),
    tailwindcss(),
    VitePWA({
      /* Le service worker s'appelle `sw.js` et le manifeste
         `manifest.webmanifest` : ces deux noms NE DOIVENT PAS changer. Un
         téléphone qui a installé l'application interroge `/sw.js` pour se
         mettre à jour ; renommé, ce fichier répondrait 404 et le téléphone
         resterait bloqué sur l'ancienne version (cf. glossaire, section 3). */
      registerType: 'autoUpdate',
      includeAssets: ['icone-192.png', 'icone-512.png'],
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
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Cache des réponses GET de l'API (consultation hors ligne).
            // Nom différent de l'ancien (`api-cache`, réponses au format
            // anglais d'avant la francisation), pour ne jamais les relire.
            urlPattern: ({ url, request }) => url.pathname.startsWith('/api') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cache-api',
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
