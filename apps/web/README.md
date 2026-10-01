# SamaCommerce — application web

Application de gestion de boutique (React 19, TypeScript, Vite), installable sur
téléphone (PWA) et utilisable hors ligne. Elle dialogue avec l'API Laravel
(`apps/api`), dont les adresses et les champs sont en français (cf.
`src/outils/api.ts`).

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement ; `/api` est relayé vers `http://127.0.0.1:8000` |
| `npm run build` | vérification des types puis construction de production dans `dist/` |
| `npm run preview` | sert la construction de production en local |
| `npm run test:run` | tests (Vitest) |
| `npm run lint` | analyse du code (oxlint) |

En production, `VITE_URL_API` doit contenir l'adresse de l'API
(`https://samacommerce-api.onrender.com/api`) : elle entre dans la politique de
sécurité du contenu (CSP) calculée à la construction. Sans elle, la construction
échoue volontairement sur Render plutôt que de livrer un site qui ne pourrait
joindre aucun serveur.

## Organisation

| Dossier | Contenu |
|---|---|
| `src/sections/` | les écrans (Accueil, Vente, Stock, Crédits, Caisse…) |
| `src/composants/` | les éléments réutilisables (vignette, fenêtres, scanner, verrou PIN…) |
| `src/outils/` | la logique sans affichage : client de l'API, panier, file hors ligne, thème, exports PDF/Excel, WhatsApp… |
| `compilation/` | code exécuté à la construction (empreintes CSP des scripts en ligne) |
| `public/` | fichiers servis tels quels (logos, icônes, logos de paiement) |

Le vocabulaire suit le glossaire du projet (`docs/GLOSSAIRE_NOMMAGE.md`) : les
noms sont en français, sauf ceux imposés par les bibliothèques (`useState`,
`onClick`, `className`…), par les normes, ou par Tailwind.

## Deux fichiers à ne jamais renommer

`sw.js` et `manifest.webmanifest`, produits par la construction. Un téléphone
qui a installé l'application interroge `/sw.js` pour se mettre à jour : renommé,
ce fichier répondrait 404 et le téléphone resterait bloqué sur l'ancienne
version.

## Données des versions d'avant la francisation

Jusqu'au 01/10/2026, le site reprenait au premier lancement la session, les
réglages et les ventes hors ligne enregistrés par la version d'avant la
francisation, sous leurs noms anglais. Ce code de transition est retiré
depuis : tous les appareils utilisés étaient passés à la nouvelle version.
