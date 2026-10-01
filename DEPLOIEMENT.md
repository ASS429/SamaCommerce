# Déploiement SamaCommerce — Render + Supabase

Architecture en production :

```
  Navigateur ──► samacommerce-web (site statique React)
                        │
                        ▼
                 samacommerce-api (Laravel/Docker) ──► Supabase (PostgreSQL)
                        │
                        ▼
                 samacommerce-ia (FastAPI/Docker)
```

> Le service IA est **facultatif** : l'API l'appelle avec un court délai
> d'attente et **retombe sur ses heuristiques PHP** s'il ne répond pas (absent,
> lent ou endormi). L'application fonctionne sans lui.

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
   créer **3 services** : `samacommerce-api` (Docker), `samacommerce-ia` (Docker)
   et `samacommerce-web` (statique).
3. Render demande les variables marquées `sync: false` — ce sont les **secrets**,
   jamais écrits dans le dépôt. Toutes les autres (adresses publiques, réglages)
   sont écrites en clair dans `render.yaml` : une resynchronisation du blueprint
   ne peut donc pas les effacer.

   **Service `samacommerce-api`**
   | Variable | Valeur |
   |---|---|
   | `APP_KEY` | le `base64:...` de l'étape 2 |
   | `APP_URL` | `https://samacommerce-api.onrender.com` |
   | `DB_URL` | la chaîne **Session pooler** de l'étape 1 |
   | `ADMIN_PASSWORD` | mot de passe du compte `admin@samacommerce.sn`, 12 caractères minimum. **Vide = compte neutralisé** (personne ne peut s'y connecter) |
   | `EMAIL_ADMIN` | votre adresse e-mail : les codes de la vérification en 2 étapes du compte administrateur y sont envoyés (`admin@samacommerce.sn` n'est pas une vraie boîte). Vide = l'administrateur ne peut pas activer cette vérification. Tant que votre domaine n'est pas vérifié chez Resend, mettez l'adresse du **titulaire du compte Resend**, la seule qui reçoit |
   | `RESEND_API_KEY` | clé Resend (`re_...`) pour envoyer les codes « mot de passe oublié ». Sans elle, le code n'est envoyé nulle part |
   | `SENTRY_LARAVEL_DSN` | facultatif : DSN d'un projet Sentry pour recevoir les erreurs de l'API et du navigateur. Vide = inerte |

   Déjà renseignées en clair dans `render.yaml` : `ORIGINES_CORS_AUTORISEES` et
   `URL_SITE_WEB` (adresse du site), `URL_SERVICE_IA` (adresse du service IA),
   `VITE_URL_API` (adresse de l'API, côté site). Si les adresses Render de tes
   services diffèrent, corrige-les **dans `render.yaml`**, pas dans le tableau de bord.

4. **Apply** → Render construit les trois services (le premier build Docker prend
   quelques minutes).

> `VITE_URL_API` est lue **à la construction** du site pour composer la politique
> de sécurité du contenu (CSP). Si elle manque, la construction **échoue
> volontairement** plutôt que de livrer un site qui ne pourrait joindre aucune API.
> Après toute modification, le site doit être **reconstruit**.

---

## 4) Ce que l'API fait seule au démarrage

Le plan gratuit de Render n'offre **aucun accès en ligne de commande** : tout est
automatique (`apps/api/demarrer.sh`).

1. `php artisan migrate --force` — schéma à jour (idempotent).
2. `php artisan base:amorcer-si-vide` — au **tout premier** démarrage seulement
   (base sans aucun utilisateur), crée la démonstration :
   - `demo@samacommerce.sn` / `password` (commerçant)
   - `employe@samacommerce.sn` / `password` (employé)
   - `admin@samacommerce.sn` (administrateur, mot de passe aléatoire)
3. `php artisan admin:securiser` — applique `ADMIN_PASSWORD` au compte
   administrateur, ou le **neutralise** si la variable est absente. Aucun mot de
   passe d'administration n'est jamais écrit dans le dépôt.

> ⚠️ Les mots de passe de démonstration figurent dans ce dépôt public : ne mets
> jamais de vraies données dans les comptes `demo@` et `employe@`.

---

## 5) Vérifications

- API : `https://samacommerce-api.onrender.com/api/sante` →
  `{"statut":"ok", ..., "services":{"base_de_donnees":{"ok":true}, "ia":{"ok":true}}}`.
  `"statut":"degrade"` avec `"ia":{"ok":false}` signifie seulement que le service
  IA dort (plan gratuit) : le repli PHP prend le relais.
- IA : `https://samacommerce-ia.onrender.com/sante`.
- Site : `https://samacommerce-web.onrender.com` → écran de connexion → `demo@samacommerce.sn`.

---

## 6) Automatisations GitHub

| Fichier | Rôle |
|---|---|
| `.github/workflows/integration-continue.yml` | à chaque envoi sur `main` : tests de l'API, du site et du service IA, construction du site |
| `.github/workflows/sauvegarde-base.yml` | chaque nuit (02h17 UTC) : export **chiffré** de la base, contrôlé puis conservé 90 jours |

La sauvegarde exige deux secrets GitHub (**Settings → Secrets and variables →
Actions**) : `SUPABASE_DB_URL` (chaîne Session pooler) et `BACKUP_PASSPHRASE`
(phrase longue, à conserver **aussi** hors de GitHub). Restauration :
[`docs/RESTAURATION_BASE.md`](docs/RESTAURATION_BASE.md).

## 7) Réveil de l'API (cron-job.org)

Sur le plan gratuit, Render endort l'API après 15 minutes sans visite ; le
réveil prend 30 à 50 secondes, et le premier commerçant de la journée croit
le site en panne. Une tâche externe l'appelle donc pendant les heures de vente :

| Réglage | Valeur |
|---|---|
| Service | [cron-job.org](https://console.cron-job.org), compte du propriétaire |
| Tâche | « Réveil API SamaCommerce » |
| Adresse | `GET https://samacommerce-api.onrender.com/api/sante` |
| Rythme | `*/10 7-20 * * *`, fuseau Africa/Dakar (toutes les 10 min, de 7h à 20h50) |

- **Pourquoi pas GitHub Actions** : la tâche planifiée équivalente
  (`garder-api-eveillee.yml`, retirée le 01/10/2026) ne tournait que 2 à 4 fois
  par jour au lieu de 84 — GitHub retarde ou saute les planifications fréquentes.
- **Pourquoi pas jour et nuit** : les 750 heures gratuites mensuelles de Render
  sont partagées avec le service IA ; de 7h à 21h, l'API en consomme environ 430.
- Le premier appel de 7h peut apparaître en échec dans cron-job.org (le serveur
  a dormi toute la nuit) : c'est normal, celui de 7h10 réussit.

---

## Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| API ne démarre pas, erreur DB `could not connect` | Direct connection (IPv6) au lieu du pooler | Utiliser la chaîne **Session pooler** (étape 1) |
| Le site affiche « Le serveur ne répond pas » partout | `VITE_URL_API` faux, ou API endormie (30 à 50 s de réveil) | Vérifier `render.yaml` puis **reconstruire** le site ; patienter une minute |
| Erreurs CORS dans la console | `ORIGINES_CORS_AUTORISEES` ≠ adresse du site | Mettre l'adresse exacte du site (sans `/` final) dans `render.yaml` |
| `MissingAppKeyException` | `APP_KEY` non défini | Coller le `base64:...` (étape 2) dans les variables de l'API |
| Déconnexion de tous après chaque redémarrage | `APP_KEY` absente : une clé éphémère est générée | Fixer `APP_KEY` en variable (ne pas laisser vide) |
| « Mot de passe oublié » : aucun e-mail reçu | `RESEND_API_KEY` absente, ou domaine non vérifié chez Resend (seule l'adresse du titulaire du compte reçoit) | Renseigner la clé ; vérifier un domaine chez Resend |
| Le compte `admin@` refuse tout mot de passe | `ADMIN_PASSWORD` vide ou trop court : compte neutralisé | Renseigner `ADMIN_PASSWORD` (12 caractères min.) puis redéployer |

> Render **bloque le SMTP sortant** (ports 25/465/587) : l'envoi d'e-mails passe
> par l'API HTTP de Resend, jamais par SMTP.
