# SamaCommerce v3

Plateforme de gestion commerciale pour les commerçants du secteur informel au Sénégal,
avec gestion des stocks **au fractionnement** et deux modules d'IA d'aide à la décision
(prévision de la demande + scoring de crédit). Support du mémoire MIAGE.

## Architecture (monorepo)

```
apps/
  api/      Laravel 12 (API REST, Sanctum)        -> PostgreSQL (Supabase) / SQLite en dev
  web/      React 19 + Vite + TS + Tailwind v4    (tableau de bord)
  mobile/   React Native / Expo                   (à venir)
services/
  ia/       FastAPI + scikit-learn                (Modules A & B)
```

Flux : `web` / `mobile` → **API Laravel** → base de données. Laravel appelle le service IA pour les prédictions.

## Démarrer en local

### 1. Backend (apps/api)
```bash
cd apps/api
composer install --no-dev          # dépendances
# .env : DB_CONNECTION=sqlite (dev) déjà configuré ; bloc Supabase prêt à activer
php artisan migrate:fresh --seed   # crée le schéma + données de démo
php artisan serve --port=8000
```
Compte de démo : **demo@samacommerce.sn / password** (Boutique Diallo).

### 2. Web (apps/web)
```bash
cd apps/web
npm install
npm run dev                        # http://localhost:5173 (proxy /api -> :8000)
```

### 3. Service IA (services/ia)
```bash
cd services/ia
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --port 8001 --reload        # http://localhost:8001/health
```
Le service fonctionne en mode **heuristique** tant que les modèles ne sont pas entraînés.

## Entraîner les modèles d'IA
```bash
cd apps/api && php artisan ia:export      # exporte services/ia/data/*.csv depuis la DB
cd ../../services/ia
python train_demand.py                    # -> models/demand_forecast.joblib (Module A)
python train_credit.py                    # -> models/credit_score.joblib   (Module B)
```
Le service charge automatiquement les .joblib présents au démarrage.

## Passer en production sur Supabase
Dans `apps/api/.env`, décommenter le bloc `pgsql` et renseigner les identifiants
(Supabase > Project Settings > Database > Connection string), puis :
```bash
php artisan migrate --seed
```

## Modèle de données — le fractionnement
- `products.base_unit` : plus petite unité suivie en stock (kg, litre, unité…). Le stock y est toujours exprimé.
- `product_units` : unités d'achat/vente avec leur **facteur de conversion** (Sac 50 kg → Kg → Bol → Sachet).
- `stock_lots` : valorisation par lot (coût moyen / FIFO) et historique des prix.
- `sale_items.quantity_base` : quantité convertie en unité de base (pour le stock et les stats).

## Lancer le mobile (apps/mobile)
```bash
cd apps/mobile
npm install
# Dans lib/api.ts : mettre API_URL = http://<IP-LAN-de-ton-PC>:8000/api
npx expo start                     # puis scanner le QR avec Expo Go
```

## État d'avancement
- [x] Jalon 1 — Backend + modèle de données (fractionnement) — *validé*
- [x] Jalon 2 — API (auth, produits, ventes, crédits, stats) — *testée end-to-end*
- [x] Jalon 3 — Web (tableau de bord branché à l'API) — *build + login via proxy OK*
- [x] Jalon 4 — Mobile (Expo, login + tableau de bord) — *compile (tsc OK)*
- [x] Jalon 5 — Modèles d'IA entraînés (crédit + demande) et branchés à Laravel — *testés end-to-end*

### Prochaines étapes
- Brancher l'écran de **vente** (web + mobile) qui appelle `/api/credit-score` avant un crédit
- Habiller l'UI avec le design system (cf. `Memoire/Prompt_Claude_Design.md`)
- Connecter la base **Supabase** (bloc `pgsql` du `.env`)
- Enrichir les données réelles puis réentraîner via `php artisan ia:export`
