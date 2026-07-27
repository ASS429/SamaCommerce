# SamaCommerce — Analyse du projet & feuille de route
### Améliorations techniques · Sécurité · Design UI/UX cinématique & 3D réaliste

> **Nature du document** : analyse et spécification. **Rien n'est implémenté ici** — chaque point décrit *quoi faire, pourquoi, et comment s'y prendre*, avec une priorité (🔴 P0 critique · 🟠 P1 important · 🟢 P2 confort) et un effort estimé (S/M/L).
>
> Périmètre analysé : `apps/web` (React 19 + Vite + Tailwind v4), `apps/api` (Laravel 12 + Sanctum, SQLite dev / Supabase prod), `services/ia` (FastAPI + scikit-learn).

---

## 0. Synthèse exécutive

| Domaine | État actuel | Verdict |
|---|---|---|
| Fonctionnel | Migration fidèle + 6 batches d'améliorations + fractionnement/marchandage + 2 modules IA, 76 endpoints testés | ✅ Très bon |
| Robustesse technique | Pas de tests PHPUnit, pas de CI, pagination partielle, montants legacy en `decimal` | 🟠 Moyen |
| Sécurité | Auth fonctionnelle mais **plusieurs vulnérabilités réelles** (XSS via toasts, token localStorage sans expiration, mot de passe faible…) | 🔴 À traiter avant toute mise en ligne |
| UI/UX | Design system violet v2 cohérent, responsive, dark mode — mais **statique** : aucun langage de mouvement, pas de profondeur, pas d'émotion | 🟠 Fort potentiel |

**Les 5 chantiers qui changent tout** : (1) corriger les 4 failles P0 de sécurité, (2) mode hors-ligne réel (file d'attente de ventes), (3) tests automatisés + CI, (4) système de motion design (GSAP + Motion), (5) scène 3D réaliste d'accueil + micro-interactions physiques.

---

# PARTIE 1 — Améliorations techniques à apporter

## 1.1 Dette de données 🔴 P0 → 🟠 P1

| # | Amélioration | Détail | Prio | Effort |
|---|---|---|---|---|
| T1 | **Unifier les montants en entiers** | `products.price/price_achat` et `sales.total` sont en `decimal(12,2)` alors que la Phase 6 a introduit le « zéro flottant » (`prix_reel`, `cogs`… en `integer`). Migrer les colonnes legacy vers `integer` (FCFA sans centimes) + adapter les casts Eloquent et le front (`Number()` partout). Élimine les `300.00` affichés et les risques d'arrondi. | 🔴 | M |
| T2 | **Backfill des ventes pré-Phase 6** | Les anciennes ventes ont `cogs/quantite_base/prix_reel = null` → exclues des stats marchandage. Écrire une commande artisan de backfill (`quantite_base = quantity × facteur`, `cogs` estimé au prix d'achat actuel, flag `backfilled`). | 🟠 | S |
| T3 | **Contraintes d'intégrité DB** | Ajouter des FOREIGN KEY manquantes (`sales.unit_id → product_units`, `activity_logs.owner_id → users`), des CHECK (`stock ≥ 0`, `prix_min ≥ 0`) et des index composites (`sales(user_id, created_at)`, `products(user_id, boutique_id)`). | 🟠 | S |
| T4 | **Soft deletes** sur produits/clients/ventes | Aujourd'hui la suppression est définitive ; une vente annulée par erreur est perdue. `SoftDeletes` + corbeille + restauration = filet de sécurité indispensable pour un commerçant. | 🟠 | M |

## 1.2 Qualité & industrialisation 🟠 P1

| # | Amélioration | Détail | Prio | Effort |
|---|---|---|---|---|
| T5 | **Tests PHPUnit (feature)** | Le QA actuel est un script Python externe (76 endpoints). Le porter en tests Laravel natifs (`RefreshDatabase`, factories) : auth, RBAC (employé bloqué), plancher marchandage, isolation multi-boutique, arrondis fractionnement. Cible : ~60 tests, exécutables en une commande. | 🟠 | L |
| T6 | **Tests front (Vitest + Testing Library)** | Au minimum : helpers de calcul du panier (`lTotal/lCogs/lPerDisplay` — la logique d'arrondi dupliquée du serveur), réducteurs du POS, garde du plancher. | 🟠 | M |
| T7 | **CI GitHub Actions** | Pipeline : lint (oxlint + pint) → tests API → tests web → build. Badge de statut. Aucun merge sans vert. | 🟠 | S |
| T8 | **Versionnage API (`/api/v1`)** + **API Resources** | Figer un contrat JSON (dates ISO, montants entiers, enveloppe `{data, meta}`) avant l'app mobile — sinon chaque refactor cassera le mobile. | 🟠 | M |
| T9 | **Pagination généralisée** | L'opt-in `?page=` n'existe que sur `/sales`. L'étendre à produits, clients, activité, retours — et adopter le scroll infini partout côté front. | 🟠 | M |
| T10 | **Docker Compose dev** | `php`, `node`, `python`, `postgres` en un `docker compose up` : fini les 3 serveurs à lancer à la main + parité dev/prod (Supabase = Postgres, pas SQLite). | 🟢 | M |

## 1.3 Robustesse & exploitation 🟠 P1 → 🟢 P2

| # | Amélioration | Détail | Prio | Effort |
|---|---|---|---|---|
| T11 | **Mode hors-ligne réel (offline-first)** | La PWA met en cache l'UI mais **une vente sans réseau est perdue** — rédhibitoire au marché. Concevoir une file locale (IndexedDB) : la vente est enregistrée localement avec un `uuid` client, synchronisée dès le retour du réseau (endpoint idempotent `POST /sales/sync`), avec résolution de conflits de stock et indicateur « X ventes en attente de sync ». **C'est LA fonctionnalité terrain n°1.** | 🔴 | L |
| T12 | **Files d'attente (queues)** | Emails d'invitation, exports PDF lourds, notifications → `queue:work` + table `jobs`, pour ne jamais bloquer une requête HTTP. | 🟢 | M |
| T13 | **Cache des statistiques** | `/stats/*` et `/ia/reappro` recalculent tout à chaque appel. Cache 5 min (tag par tenant, invalidé à la vente). | 🟢 | S |
| T14 | **Observabilité** | Sentry (front + back) pour les erreurs, logs structurés JSON, healthcheck agrégé `/health` (DB + IA + version). Sans ça, impossible de diagnostiquer un bug chez un commerçant. | 🟠 | S |
| T15 | **Sauvegardes automatiques** | `spatie/laravel-backup` → dump chiffré quotidien vers un stockage externe + test de restauration mensuel documenté. | 🟠 | S |
| T16 | **MLOps léger (services/ia)** | Ré-entraînement planifié sur les données réelles (`artisan ia:export` → `train_*.py`), versionnage des modèles (`demand_v2.joblib` + métriques dans un `metadata.json`), et endpoint `/health` exposant la version du modèle servie. | 🟢 | M |
| T17 | **i18n complète** | `lib/i18n.ts` existe (FR/Wolof/EN) mais la majorité des libellés ajoutés depuis (Phase 6, IA, marchandage) sont en dur en français. Passer chaque chaîne par `t()` — le Wolof est un argument d'adoption majeur. | 🟠 | M |
| T18 | **Web Push serveur (VAPID)** | Déjà documenté : service worker `push` + `minishlink/web-push` + envoi des alertes stock/échéances crédit depuis le backend. Nécessite HTTPS (déploiement). | 🟢 | M |

---

# PARTIE 2 — Sécurité : constats réels & recommandations

> Constats issus de la lecture du code (fichiers cités). Classés par gravité. **Aucun n'est corrigé à ce jour.**

## 2.1 🔴 P0 — à corriger avant toute mise en ligne

### S1 — XSS via les toasts (`apps/web/src/lib/toast.ts:17,30,52`)
Les toasts, `confirmAsync` et `promptAsync` injectent le message avec **`innerHTML`** sans échappement. Or `window.alert` est globalement redirigé vers `toast()`, et des messages contiennent des **données saisies par l'utilisateur renvoyées par l'API** (ex. « Supprimer “NOM_PRODUIT” ? », erreurs de validation). Un nom de produit ou de client contenant `<img src=x onerror=…>` exécuterait du script → vol du token (voir S2).
**Recommandation** : remplacer `innerHTML` par `textContent` / création de nœuds DOM ; n'autoriser aucun HTML dans les messages ; ajouter un test unitaire anti-régression avec une charge XSS type.

### S2 — Token Sanctum en `localStorage`, sans expiration (`apps/web/src/lib/api.ts:69-78`, `apps/api/config/sanctum.php:53`)
Le bearer token est stocké en `localStorage` (lisible par tout script → S1 le rend exploitable) et `sanctum.expiration = null` : **un token volé est valable à vie**.
**Recommandations** : (1) fixer une expiration (ex. 7 jours) + rotation silencieuse ; (2) à la connexion, **révoquer les anciens tokens** du même appareil ; (3) offrir « Déconnecter tous les appareils » (`$user->tokens()->delete()`) ; (4) cible idéale : basculer en **cookies httpOnly + SameSite** (mode SPA de Sanctum) pour sortir le token du DOM ; (5) en attendant, une CSP stricte (S5) réduit la surface.

### S3 — Politique de mot de passe faible (`AuthController.php:18,221` — `min:4`)
4 caractères pour un compte qui contient la comptabilité d'un commerce. De plus, `login` révèle « Utilisateur introuvable » vs « Mot de passe incorrect » (**énumération de comptes**).
**Recommandations** : `Password::min(8)->uncompromised()` (règle Laravel + vérification HaveIBeenPwned), message d'échec **générique** (« identifiants incorrects »), verrouillage progressif après N échecs (en plus du throttle), et audit des connexions dans `activity_logs` (IP + user-agent).

### S4 — Validation cross-tenant (`ProductController.php:76` et équivalents)
`'category_id' => exists:categories,id` vérifie l'existence **dans toute la table**, pas seulement chez le tenant. Un utilisateur peut rattacher son produit à la catégorie d'un autre commerçant (fuite d'ID, incohérences). Le même motif est à vérifier pour `fournisseur_id`, `client_id`, `unit_id`, `boutique_id` dans tous les contrôleurs.
**Recommandation** : règle systématique `Rule::exists('categories','id')->where('user_id', $request->user()->id)` — et un test d'intrusion automatisé « tenant A ne peut jamais référencer une ressource de tenant B ».

## 2.2 🟠 P1 — durcissement indispensable

| # | Constat | Recommandation |
|---|---|---|
| S5 | **Aucun header de sécurité** (aucune CSP, ni HSTS, ni `X-Frame-Options`, ni `Referrer-Policy` — vérifié dans l'app et l'index.html) | Middleware dédié : `Content-Security-Policy` stricte (pas d'`unsafe-inline` à terme), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy` (caméra limitée au scanner). |
| S6 | **CORS non durci** (config par défaut, pas de `config/cors.php` publié) | Publier la config et restreindre `allowed_origins` au(x) domaine(s) réel(s) en production. |
| S7 | **Codes 2FA / reset renvoyés dans la réponse** (`dev_code`, désactivé seulement si `APP_ENV=production`) | Fragile : un `.env` mal configuré en prod = codes exposés. Inverser la logique (n'exposer que si `APP_DEBUG && local`), et brancher un canal d'envoi réel (SMS/WhatsApp Business — plus pertinent que l'email au Sénégal). |
| S8 | **Rate limiting partiel** | Throttle uniquement sur l'auth. Ajouter un limiteur global par utilisateur (`throttle:api`), plus strict sur les écritures et sur `/ia/*` (coûteux). |
| S9 | **Proxy employé → patron** (`ResolveTenant` via `setUserResolver`) | Choix assumé et traçé (`vendu_par`), mais l'employé « devient » le patron pour tout contrôleur oublié par `perm:`. Ajouter un test qui parcourt **toutes les routes** et vérifie qu'une permission est exigée (liste blanche explicite). |
| S10 | **Secrets & prod** | Documenter : rotation des clés (`APP_KEY`, DB Supabase avec SSL `sslmode=require`), `.env` hors dépôt (déjà ✔), secrets CI dans le vault GitHub, comptes démo désactivés en production. |
| S11 | **Verrouillage de session au comptoir** | Un téléphone de boutique passe de main en main : ajouter un **PIN local** (verrouillage après inactivité) pour éviter qu'un client manipule l'app ouverte. |
| S12 | **Dépendances** | Activer `npm audit` / `composer audit` + Dependabot dans la CI ; épingler les versions du micro-service Python (`requirements.txt` actuellement dé-pinglé pour Python 3.14). |

## 2.3 🟢 P2 — bonnes pratiques complémentaires
- **Journal d'audit admin** : les actions d'administration (blocage compte, approbation upgrade) devraient alimenter un log dédié, comme `activity_logs` côté tenant.
- **Chiffrement au repos** des données sensibles (téléphones clients) via `encrypted` cast — à peser contre la recherche.
- **RGPD-like / protection des données** (loi sénégalaise n°2008-12) : mentions, droit à l'effacement d'un client, anonymisation des exports IA (`ia:export`).
- **Pentest léger** avant lancement : scénarios IDOR (S4), XSS (S1), bruteforce (S3), et manipulation de prix côté client (le serveur revalide déjà le plancher — à conserver comme invariant testé).

---

# PARTIE 3 — Design UI/UX : vision « cinématique & 3D réaliste »

> **Intention** : passer d'une interface *propre mais statique* à une expérience **mémorable, professionnelle et vivante** — digne d'un produit SaaS moderne — tout en restant **utilisable au comptoir par un commerçant pressé et peu alphabétisé**. Le mouvement doit **servir le sens** (hiérarchie, feedback, causalité), jamais décorer gratuitement.

## 3.0 Principes directeurs (le contrat)
1. **Le mouvement raconte la causalité** : tout élément qui apparaît vient de quelque part ; tout ce qui disparaît va quelque part (le produit « vole » vers le panier, le reçu « sort » de la vente).
2. **Physique plutôt que tween** : ressorts (spring) avec masse/raideur/amortissement → sensation organique, jamais linéaire.
3. **60 fps ou rien** : n'animer que `transform` et `opacity` ; le 3D est lazy-loadé et dégradé gracieusement.
4. **`prefers-reduced-motion` respecté** : chaque effet a une variante statique — accessibilité non négociable.
5. **Le POS reste un outil** : au comptoir, les animations sont **courtes (≤ 250 ms)** et jamais bloquantes ; le spectaculaire est réservé à l'accueil, au login, à l'onboarding et aux célébrations.

## 3.1 Système de motion design (fondation à créer)
- **Tokens de mouvement** dans le design system : durées (`--motion-fast: 150ms`, `--motion-base: 250ms`, `--motion-hero: 600ms`), courbes (`--ease-out-expo`, `--ease-spring`), distances d'entrée (8/16/32 px). Tout composant les consomme — cohérence garantie.
- **Bibliothèques cibles** : **Motion (Framer Motion)** pour les composants React (layout animations, `AnimatePresence`, gestures), **GSAP + ScrollTrigger** pour les séquences cinématiques scrollées (accueil, onboarding), **React Three Fiber + drei** pour la 3D, **Lottie/Rive** pour les illustrations animées (états vides, succès), **canvas-confetti**/particules maison pour les célébrations.
- **Chorégraphie d'entrée standard** : chaque écran monte en **cascade orchestrée** (header → stats → cartes, stagger 40-60 ms) au lieu de l'actuel `fadeUp` global uniforme.
- **Transitions entre vues** : transitions **d'éléments partagés** (FLIP) — la carte produit du catalogue se **morphe** en ligne de panier ; la tuile « Chiffres » du menu s'étire pour devenir l'en-tête de la page Chiffres. `AnimatePresence` pour des sorties propres (jamais de « pop » sec).

## 3.2 La pièce maîtresse 3D : « la boutique vivante » (accueil & login)
- **Scène R3F photoréaliste stylisée** : une **échoppe sénégalaise** (étal de riz, bidons d'huile, cartons empilés, balance) modélisée low-poly mais rendue **PBR réaliste** — matériaux métal/rugosité, éclairage **HDRI chaud de fin d'après-midi**, ombres douces (soft shadows), légère profondeur de champ.
- **Login** : la scène vit en arrière-plan derrière une **carte de verre** (glassmorphism : flou 24 px, bordure lumineuse 1 px, grain subtil). La caméra fait un **dolly lent** (mouvement de respiration, 20 s en boucle) ; les particules de poussière flottent dans la lumière. À la connexion réussie : la caméra **pousse à travers la porte de la boutique** (transition cinématique 800 ms) → le dashboard apparaît.
- **Interaction douce** : la scène réagit au pointeur (parallaxe 3D ±3°) et au gyroscope sur mobile — l'utilisateur « tient » la boutique dans sa main.
- **Budget & fallback** : glTF compressé **DRACO + textures KTX2** (< 1,5 Mo), chargé en lazy après le first paint ; fallback = dégradé animé « aurora » (violet → rose, `background-position` animé) si WebGL absent ou `reduced-motion`.

## 3.3 Micro-interactions & matière (partout)
- **Boutons magnétiques** : les CTA principaux (« ENCAISSER ») attirent légèrement le curseur (translation 2-4 px vers le pointeur) et **pressent** réellement (scale 0.97 + ombre qui s'écrase) — sensation tactile.
- **Cartes en lévitation** : tilt 3D subtil au survol (perspective 1000 px, rotation ±4°, reflet spéculaire qui glisse) sur les cartes produits/KPI — desktop uniquement.
- **Compteurs vivants** : tous les montants (CA du jour, totaux) **roulent** comme un odomètre (chiffres qui défilent verticalement) au chargement et à chaque mise à jour — le chiffre devient un événement.
- **La marge qui respire** (POS marchandage) : pendant la négociation, la jauge de marge s'anime en continu — **verte et calme** quand la marge est saine, **ambre qui pulse** quand elle fond, **rouge qui tremble** (micro-shake 2 px) sous le plancher. Le vendeur *ressent* la limite sans lire.
- **Ajout au panier balistique** : le produit tapé se clone en vignette qui suit une **courbe de Bézier** jusqu'au badge panier, lequel **rebondit** (spring) en incrémentant — causalité visible, plaisir immédiat.
- **Skeletons → contenu en morph** : le shimmer actuel se **dissout** en croisé (cross-fade + léger scale) vers le contenu réel, au lieu d'un remplacement sec.

## 3.4 Moments cinématiques (les « scènes »)
- **Encaissement réussi** : le bouton se transforme en **cercle de progression** → **coche dessinée au trait** (SVG stroke animé) → **pluie de confettis** aux couleurs de la marque (600 ms, canvas) → le **reçu glisse du haut comme un ticket d'imprimante thermique**, avec un léger effet papier (ondulation) et une ombre portée réaliste. Haptique déjà en place : synchroniser vibration et apogée visuelle.
- **Pièces FCFA 3D** : sur les gros encaissements, 3-4 **pièces dorées 3D** (instanced meshes, rendu métallique) tombent et roulent brièvement — clin d'œil premium, désactivable.
- **Clôture de caisse** : séquence « fin de journée » — le fond s'assombrit en dégradé crépuscule, les totaux du jour se **révèlent ligne par ligne** comme un générique, puis le rapport se « scelle » (tampon animé). 4 s, skippable.
- **Onboarding scrollytelling** : remplacer les 5 slides statiques par une **histoire scrollée** (GSAP ScrollTrigger + scrub) : l'étal 3D se remplit de produits, une vente se joue toute seule, la courbe de CA pousse — l'utilisateur *voit* sa future journée au lieu de lire des bullet points.
- **Réappro IA — « radar »** : l'écran IA s'ouvre sur un **balayage radar** (onde circulaire) qui « scanne » les produits ; les urgences rouges **remontent physiquement** dans la liste (layout animation) et clignotent une fois. Le badge 🧠 « Modèle IA » a un **glow pulsé** discret.
- **Score de crédit — jauge orbitale** : le score 0-100 s'affiche en **anneau 3D** qui se remplit avec un dégradé feu-vert→rouge, l'aiguille oscille avec inertie avant de se stabiliser — la décision a du poids.

## 3.5 Profondeur, lumière & thème
- **Élévation en 3 couches** : fond (bg) → surface (cartes) → flottant (modales, FAB) avec **ombres à deux sources** (ambiante large + directionnelle serrée) et bordures internes 1 px — profondeur réaliste sans lourdeur.
- **Dark mode cinématique** : la bascule jour/nuit n'est plus un switch sec mais une **éclipse radiale** qui part du bouton (View Transitions API) ; en mode sombre, les accents violets gagnent un **halo néon subtil** (glow 8 px à 15 % d'opacité) — ambiance boutique de nuit.
- **Verre & grain** : topbar/sidebar desktop en **glassmorphism léger** (flou 12 px, saturation 160 %), un **grain photographique** 2 % sur les fonds héro pour casser l'aspect « plastique numérique ».
- **Aurora ambiante** : derrière le dashboard, un dégradé conique violet/rose **très lent** (60 s/rotation, opacité 6 %) — la page paraît vivante même immobile.

## 3.6 UX structurelle (au-delà du spectacle)
- **Mode « comptoir » une main** : grille POS agrandie (cibles ≥ 56 px), pavé numérique plein écran pour les poids/prix, contraste renforcé pour plein soleil (marché en extérieur).
- **Command palette desktop** (`Ctrl+K`) : recherche/actions universelle (« vendre riz », « clôturer caisse ») avec animation de spotlight.
- **États vides narratifs** : chaque section vide reçoit une **illustration Lottie** contextuelle (étal vide qui se remplit au clic « Ajouter ») + un CTA unique — jamais un simple « Aucun produit ».
- **Toasts repensés** : pile en haut à droite (desktop) / bas (mobile), entrée en ressort, **barre de progression** de l'auto-dismiss, action « Annuler » (undo) sur les suppressions — et surtout **sans HTML injecté** (cf. S1).
- **Iconographie** : adopter **Lucide** (déjà installé) pour l'interface *chrome* (navigation, actions) en gardant les **emojis pour les objets métier** (produits, catégories) — les emojis restent le langage des utilisateurs peu alphabétisés.
- **Typographie cinétique** : les titres héro (Sora) entrent par **mots masqués** (clip-path, stagger 30 ms) sur l'accueil et l'onboarding uniquement.
- **Son optionnel** : « tick » discret à l'ajout panier, carillon bref à l'encaissement (désactivé par défaut, réglage dans Paramètres) — utile dans le bruit du marché.

## 3.7 Garde-fous performance & accessibilité (non négociables)
- Budget : **TTI < 3 s en 3G**, bundle principal < 300 Ko gzip → **code-splitting** de jspdf/chart.js/html5-qrcode/R3F (le bundle actuel fait **1,37 Mo** en un seul chunk — à découper de toute façon).
- 3D : chargée en `lazy` + `Suspense`, **LOD** (version simplifiée mobile), pause du rendu hors focus, `powerPreference: low-power` sur mobile.
- Toutes les animations pilotées par **`prefers-reduced-motion`** + un réglage in-app « Réduire les animations ».
- Contrastes **WCAG AA** re-vérifiés sur les nouveaux effets (glass, glow) ; focus visibles conservés ; annonces `aria-live` pour les toasts.

## 3.8 Ordre de mise en œuvre suggéré (design)
1. 🟠 Fondation : tokens de motion + Motion/AnimatePresence + chorégraphies d'entrée + toasts sécurisés repensés (S1 corrigé au passage). *(M)*
2. 🟠 POS vivant : ajout panier balistique, jauge de marge vivante, séquence d'encaissement + confettis. *(M)*
3. 🟢 Héro 3D : scène boutique R3F (login + accueil), aurora, dark mode éclipse. *(L)*
4. 🟢 Scènes : onboarding scrollytelling, clôture de caisse, radar IA, jauge de crédit. *(L)*
5. 🟢 Finitions : tilt cards, compteurs odomètre, Lottie des états vides, command palette. *(M)*

---

# PARTIE 4 — Roadmap globale proposée

| Vague | Contenu | Objectif |
|---|---|---|
| **V1 — Sécuriser** (avant tout déploiement) | S1→S4 (P0), S5-S8, T1, T14 | Une base saine et observable |
| **V2 — Fiabiliser** | T5-T9 (tests + CI + API v1), T11 (offline-first), T15 | Prêt pour de vrais commerçants |
| **V3 — Émerveiller** | Design 3.8 vagues 1-2 (motion + POS vivant) | L'app qu'on montre avec fierté (démo mémoire ✨) |
| **V4 — Impressionner** | Design 3.8 vagues 3-5 (3D, scènes), T16-T18 | Niveau produit commercial |

> **Note mémoire** : les vagues V1-V2 alimentent le chapitre « réalisation & validation » (rigueur), la V3 la démo de l'entretien/soutenance (impact), et ce document lui-même peut figurer en **annexe** comme preuve de démarche d'ingénierie (analyse des risques, priorisation, budget performance).
