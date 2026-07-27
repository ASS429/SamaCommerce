# Déploiement SamaCommerce — Render + Supabase

Architecture en production :

```
  Navigateur ──► samacommerce-web (site statique React)  ──►  samacommerce-api (Laravel/Docker)  ──►  Supabase (Postgres)
```

> Le micro-service IA n'est **pas** déployé au départ : l'API possède un **repli
> heuristique PHP**, l'application fonctionne sans lui. (On pourra l'ajouter après.)

---

## 1) Base de données — Supabase

1. Sur https://supabase.com → **New project** (ou réutilise ton projet).
   Note le **mot de passe de la base** (Database Password) choisi à la création.
2. Menu **Connect** (bouton en haut) → onglet **Connection string** → **Session pooler**.
   ⚠️ **Important** : prends bien la variante **Session pooler** (hôte
   `aws-0-<region>.pooler.supabase.com`, port `5432`). C'est de l'**IPv4**, seule
   compatible avec Render. La « Direct connection » (`db.<ref>.supabase.co`) est en
   IPv6 et **échouera** sur Render.
3. Copie la chaîne, elle ressemble à :
   ```
   postgresql://postgres.abcdefgh:MON_MOT_DE_PASSE@aws-0-eu-west-3.pooler.supabase.com:5432/postgres
   ```
   Remplace `[YOUR-PASSWORD]` par ton vrai mot de passe. Garde-la pour l'étape 3.

---

## 2) Générer l'APP_KEY (une fois, en local)

Dans `apps/api` :

```bash
php artisan key:generate --show
```

Copie la sortie complète (`base64:....`). Tu la colleras dans Render.

---

## 3) Render — via le Blueprint (render.yaml)

1. Sur https://render.com → **New +** → **Blueprint**.
2. Connecte le dépôt **ASS429/SamaCommerce**. Render lit `render.yaml` et propose de
   créer **2 services** : `samacommerce-api` (Docker) et `samacommerce-web` (statique).
3. Render demande les variables marquées `sync: false`. Renseigne-les :

   **Service `samacommerce-api`**
   | Variable | Valeur |
   |---|---|
   | `APP_KEY` | le `base64:...` de l'étape 2 |
   | `APP_URL` | (laisse vide pour l'instant, tu la mettras après le 1er déploiement : `https://samacommerce-api.onrender.com`) |
   | `DB_URL` | la chaîne **Session pooler** de l'étape 1 |
   | `CORS_ALLOWED_ORIGINS` | (temporairement `*`, puis l'URL réelle du web après déploiement) |

   **Service `samacommerce-web`**
   | Variable | Valeur |
   |---|---|
   | `VITE_API_URL` | `https://samacommerce-api.onrender.com/api` |

4. **Apply** → Render construit les deux services (le premier build Docker prend
   quelques minutes).

### 3.b) Recoller les URLs croisées (après le 1er déploiement)

Une fois les 2 services créés, tu connais leurs URLs définitives. Ajuste :

- API → `CORS_ALLOWED_ORIGINS = https://samacommerce-web.onrender.com` (l'URL réelle du web)
- API → `APP_URL = https://samacommerce-api.onrender.com`
- Web → `VITE_API_URL = https://samacommerce-api.onrender.com/api`

Après modif d'une variable, clique **Manual Deploy → Deploy latest commit** (le web doit
être **rebuild** car `VITE_API_URL` est injecté au build).

---

## 4) Créer les comptes de démo (une fois)

Les migrations tournent automatiquement au démarrage de l'API. Pour insérer les
comptes de démonstration, ouvre le **Shell** du service `samacommerce-api` sur Render :

```bash
php artisan db:seed --force
```

Comptes créés :
- `demo@samacommerce.sn` / `password` (commerçant)
- `admin@samacommerce.sn` / `password` (administrateur)
- `employe@samacommerce.sn` / `password` (employé)

> ⚠️ En production réelle, changer ces mots de passe (ou désactiver les comptes démo).

---

## 5) Vérifications

- API santé : `https://samacommerce-api.onrender.com/api/health` → `{"status":"ok",...}`
  (l'IA apparaîtra « degraded » — normal, non déployée, repli PHP actif).
- Web : `https://samacommerce-web.onrender.com` → écran de connexion → login `demo@samacommerce.sn`.

---

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| API ne démarre pas, erreur DB `could not connect` | Direct connection (IPv6) au lieu du pooler | Utiliser la chaîne **Session pooler** (étape 1) |
| Web charge mais aucune donnée / erreurs réseau | `VITE_API_URL` faux ou web pas rebuild | Corriger la variable puis **rebuild** le web |
| Erreurs CORS dans la console | `CORS_ALLOWED_ORIGINS` ≠ URL du web | Mettre l'URL exacte du web (sans `/` final) |
| `MissingAppKeyException` | `APP_KEY` non défini | Coller le `base64:...` (étape 2) dans les env vars de l'API |
| 419 / sessions | clé changée à chaque redémarrage | Fixer `APP_KEY` en variable (ne pas laisser vide) |

---

## Plus tard : déployer le micro-service IA (optionnel)

Créer un 3ᵉ service Render (runtime Python) depuis `services/ia`
(`uvicorn app.main:app --host 0.0.0.0 --port $PORT`), puis pointer l'API dessus via
`IA_SERVICE_URL=https://samacommerce-ia.onrender.com`. Tant que c'est vide, le repli
heuristique PHP assure la fonctionnalité.
