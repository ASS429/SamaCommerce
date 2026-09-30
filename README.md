# SamaCommerce v3

Plateforme de gestion commerciale pour les commerçants du secteur informel au Sénégal,
avec gestion des stocks **au fractionnement** et deux modules d'IA d'aide à la décision
(prévision de la demande + score de crédit). Support du mémoire MIAGE.

En ligne : https://samacommerce-web.onrender.com

## Architecture (monodépôt)

```
apps/
  api/      Laravel 13 (API REST, Sanctum)          -> PostgreSQL (Supabase) / SQLite en local
  web/      React 19 + Vite + TypeScript + Tailwind v4 (application installable, hors ligne)
  mobile/   React Native / Expo                      (prototype : connexion + tableau de bord)
services/
  ia/       FastAPI + scikit-learn                   (modules A et B)
```

Flux : `web` / `mobile` → **API Laravel** → base de données. Laravel appelle le service IA
pour les prédictions, et retombe sur des heuristiques PHP s'il ne répond pas.

Le code est **entièrement en français** (tables, routes, fonctions, classes CSS) : la
règle et les rares exceptions (mots-clés, bibliothèques, normes) sont dans
[`docs/GLOSSAIRE_NOMMAGE.md`](docs/GLOSSAIRE_NOMMAGE.md).

## Démarrer en local

### 1. API (apps/api)
```bash
cd apps/api
composer install
cp .env.example .env && php artisan key:generate   # DB_CONNECTION=sqlite par défaut
php artisan migrate:fresh --seed                    # schéma + données de démonstration
php artisan serve --port=8000
```
Comptes de démonstration : **demo@samacommerce.sn / password** (commerçant) et
**employe@samacommerce.sn / password** (employé).

### 2. Site (apps/web)
```bash
cd apps/web
npm install
npm run dev                        # http://localhost:5173 (/api relayé vers :8000)
```

### 3. Service IA (services/ia)
```bash
cd services/ia
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn application.main:application --port 8001 --reload   # http://localhost:8001/sante
```
Le service fonctionne en mode **heuristique** tant que les modèles ne sont pas entraînés.

### 4. Mobile (apps/mobile)
```bash
cd apps/mobile
npm install
# Adresse de l'API vue depuis le téléphone (adresse IP du PC sur le réseau local) :
EXPO_PUBLIC_URL_API=http://192.168.1.10:8000/api npx expo start   # puis scanner le QR avec Expo Go
```

## Entraîner les modèles d'IA
```bash
cd services/ia
python generer_donnees.py                 # -> donnees/*.csv (données synthétiques d'amorçage)
python entrainer_demande.py               # -> modeles/prevision_demande.joblib (module A)
python entrainer_credit.py                # -> modeles/score_credit.joblib      (module B)
pip install -r requirements-dev.txt && python -m pytest   # vérifie le service
```
Le service charge automatiquement les `.joblib` présents au démarrage.
L'export des ventes réelles de l'API vers `donnees/` est prévu mais pas encore écrit.

## Modèle de données — le fractionnement
- `produits.unite_base` : plus petite unité suivie en stock (`piece`, `g` ou `ml`). Le stock y est toujours exprimé.
- `conditionnements` : formats de gros d'un produit (sac 50 kg, carton 24, bidon 20 L) avec leur **facteur** vers l'unité de base et leur prix de référence.
- `ventes.quantite_base` : quantité vendue convertie en unité de base (pour le stock et les statistiques) ; `prix_reference` / `prix_reel` gardent la trace du marchandage.

## Mettre en production

Render + Supabase, décrit pas à pas dans [`DEPLOIEMENT.md`](DEPLOIEMENT.md). Sauvegarde
nocturne chiffrée et procédure de restauration : [`docs/RESTAURATION_BASE.md`](docs/RESTAURATION_BASE.md).

## Où en est le projet

État détaillé, écran par écran : [`docs/ETAT_DES_LIEUX.md`](docs/ETAT_DES_LIEUX.md).

- [x] API, modèle de données au fractionnement, marchandage
- [x] Site complet (ventes, stock, crédits, caisse, commandes, retours, employés, exports), installable et utilisable hors ligne
- [x] Modèles d'IA entraînés (demande + crédit) et branchés à l'API
- [x] Mise en ligne (Render + Supabase), sauvegardes, intégration continue
- [ ] Application mobile complète (le prototype ne couvre que la connexion et le tableau de bord)
