# SamaCommerce — Suggestions d'améliorations (avec statut)

Légende : ✅ fait · 🟡 partiel · 🔜 à faire · 🚧 en cours (Batch 1)

## 🎯 BATCH 1 — ✅ FAIT & TESTÉ (build+lint clean, backend 76/76)
1. ✅ **Toasts** — `window.alert` global remplacé par toasts stylés (succès/erreur/info auto), via lib/toast.ts (+ confirmAsync/promptAsync prêts). Les ~48 alert() des 16 fichiers sont stylés sans les toucher.
2. ✅ **Barre « ENCAISSER » collante** (Vente restructuré : catalogue → panier → barre `.vente-sticky` en bas).
3. ✅ **Sélecteur de boutique** (dropdown dans la topbar desktop → switch + reload).
4. ✅ **Indicateur hors-ligne** (bannière via events online/offline, mobile + desktop).
5. ✅ **Cloche 🔔 → panneau d'alertes** (stock faible en direct, mobile + desktop, pastille si alertes).

## 🎯 BATCH 2 — ✅ FAIT & TESTÉ (build+lint clean, backend 76/76, isolation multi-boutique vérifiée)
1. ✅ **Confirmations stylées** : `confirm()`/`prompt()` natifs → `confirmAsync`/`promptAsync` (11 fichiers).
2. ✅ **Skeleton loaders** (shimmer) : Stock, Vente, Clients, Crédits (`components/Skeleton.tsx`).
3. ✅ **Recherche** : barre globale topbar desktop (produits + clients) + barre recherche dans Vente.
4. ✅ **Export PDF** Crédits & Caisse (jsPDF + autoTable).
5. ✅ **Journal d'activité** : table `activity_logs` + `ActivityLog::record` (vente/remboursement/produit/caisse/équipe) + `GET /activity` + carte « Activité récente » dans Paramètres.
6. ✅ **Scoping `boutique_id`** : clients, fournisseurs, commandes, retours (set au create + filtre read fallback null). Isolation testée OK. (Catégories partagées, caisse par tenant/jour.)

## 🎯 BATCH 3 — ✅ FAIT & TESTÉ (build+lint clean, backend 76/76)
1. ✅ **Retour haptique** (`lib/haptics.ts`) : ajout panier + encaissement (Vente), +/- et suppression (Stock).
2. ✅ **Reçu imprimable stylé** : `components/ReceiptModal.tsx` (in-app, logo + nom boutique réel) + CSS `@media print` (isole `.receipt-print`). Remplace l'ancien `window.open`. WhatsApp utilise le vrai nom de boutique.
3. ✅ **Onboarding** 1er lancement : `components/Onboarding.tsx` (5 étapes, flag localStorage).
4. ✅ **Accessibilité** : `:focus-visible` global, cibles ≥ 44px, `aria-label` sur les boutons à icône (FAB, cloche, retour, thème).
5. ✅ **Rate limiting** : `throttle:30,1` sur `/auth/login`, `throttle:10,1` sur `/auth/register` (vérifié via route:list).

## 🎯 BATCH 4 — ✅ FAIT & TESTÉ (build+lint clean)
1. ✅ **POS desktop 2 colonnes** : Vente restructuré (`.vente-layout` / `.vente-col-main` / `.vente-col-side`) — catalogue à gauche, **panier + total + ENCAISSER collants à droite** sur ≥ 1024px ; empilé en mobile.
2. ✅ **Dashboard desktop riche** : graphique barres **7 derniers jours** (encaissements) + carte **alertes de stock** avec bouton « Commander » (façon maquette `SamaCommerce Desktop.dc.html`).

## 🎯 BATCH 5 — ✅ FAIT & TESTÉ (build+lint clean, backend 76/76, flux auth testés bout-en-bout)
1. ✅ **Rapports avancés** : `GET /stats/marge-categorie` (marge brute par catégorie), `/stats/rotation-stock` (vendus vs stock → Rapide/Moyenne/Lente), `/stats/meilleurs-clients` (top CA). Affichés dans Chiffres (graphe marge/CA + tableau rotation + classement clients). SQL DB-agnostique.
2. ✅ **Reset mot de passe** : `POST /auth/forgot-password` (code 6 chiffres, hashé en base `password_reset_tokens`, renvoyé en dev) + `POST /auth/reset-password` (valable 30 min). UI « Mot de passe oublié ? » sur Login. Testé bout-en-bout (+ mot de passe restauré).
3. ✅ **2FA login optionnel** : flag `twofa_enabled` sur users (opt-in, démo non concernée). Login renvoie `twofa_required` + code (table `twofa_codes`) → `POST /auth/verify-2fa` émet le token ; `PUT /auth/2fa` active/désactive. UI : étape code sur Login + toggle dans Paramètres. Testé (activer→login 2 étapes→vérifier→désactiver).

## 🎯 BATCH 6 — finitions ✅ FAIT & TESTÉ (build+lint clean, backend 76/76)
1. ✅ **Tri persistant du stock** (récent / nom / stock ↑↓ / prix), mémorisé en localStorage.
2. ✅ **Ajout rapide d'un produit** depuis Vendre (bouton « ＋ Produit » + modale, recharge la grille).
3. ✅ **Pull-to-refresh** sur mobile (`lib/usePullToRefresh.ts`) : tirer vers le bas recharge la section (remount via refreshKey).
4. ✅ **Pagination API + scroll infini** : `GET /sales?page=N&per_page=M` (opt-in, renvoie `{data,current_page,last_page,total}` ; tableau complet par défaut → zéro régression). Carte « Historique des ventes » dans Chiffres avec IntersectionObserver + « Charger plus ». Testé (65 ventes, 5 pages).
5. ✅ **Swipe-to-delete** (`components/SwipeRow.tsx`) : glisser une ligne client vers la gauche révèle 🗑️. Appliqué à Clients.
6. ✅ **Notifications stock (locales)** : `lib/notifications.ts` (permission + `notifyStock` via Notification API, tag anti-spam), déclenchées au chargement quand stock faible ; toggle « 🔔 Notifications stock » dans Paramètres.
   - ⚠️ **Web Push serveur (VAPID)** non inclus : nécessite un déploiement HTTPS + service worker `push` + lib serveur (`minishlink/web-push`) + envoi depuis le backend. Les notifications **locales** ci-dessus couvrent le besoin testable en dev ; le push serveur reste un item de mise en production.

> ℹ️ La liste détaillée ci-dessous est l'inventaire d'origine ; **les sections BATCH 1→6 ci-dessus font foi** pour le statut réel.

## 🎯 PHASES MÉMOIRE
- **PHASE 6 — ✅ FAIT & TESTÉ** :
  - **Fractionnement** (vente au poids/volume/unité + conditionnements de gros, unité de base entière, zéro flottant) + **marchandage** (prix négociable par catégorie hérité, plancher employé via RBAC, remise & vendu_par tracés, marge en direct au comptoir) + analytics « marge réelle / remise / par vendeur ».
  - **IA** : Module A **prévision réappro** (`GET /ia/reappro` + section Assistant Réappro) et Module B **scoring crédit** (`POST /ia/credit-score` + badge risque dans Crédits). Micro-service FastAPI (modèles ML `*.joblib`) avec **fallback heuristique PHP** si le service est coupé. Lancer le service : `cd services/ia && .venv/Scripts/python.exe -m uvicorn app.main:app --port 8001`.
- **PHASE 5** : mobile React Native à l'identique (dernier gros chantier).

## 🎨 Frontend — UX / UI

### Feedback & interactions
1. 🚧 **Toasts** + **modales de confirmation** stylées au lieu de `alert/confirm/prompt`.
2. 🔜 **Skeleton loaders** (shimmer) pendant les chargements.
3. 🔜 **Pull-to-refresh** et **swipe-to-delete** sur les listes.
4. 🔜 **Retour haptique** (`navigator.vibrate`) sur encaisser/supprimer.
5. ✅ **Transitions** entre sections (fadeUp dans le shell).
6. 🟡 **États chargement/désactivé** sur les boutons (présent sur la plupart).

### Vente (le plus utilisé)
7. 🚧 **Barre « ENCAISSER » collante**.
8. 🔜 **Ajout rapide d'un produit** depuis la vente.
9. 🔜 **Reçu** comme composant imprimable stylé (logo boutique) au lieu de `window.open`.
10. 🟡 **Recherche produit** dans la vente (chips catégories OK ; manque barre texte + debounce).

### Listes & données
11. 🔜 **Pagination / scroll infini** sur historiques (ventes, crédits).
12. 🔜 **Filtres & tri** persistants.
13. ✅ **Empty states** stylés (icône + texte + CTA).
14. 🟡 **Export** : PDF Chiffres ✅, Excel/CSV Inventaire ✅ ; manque Crédits & Caisse.

### Général
15. 🔜 **Onboarding** interactif au 1er lancement.
16. 🚧 **Indicateur hors-ligne** + statut de sync.
17. 🔜 **Accessibilité** : `aria-label`, focus visibles, contrastes AA, cibles ≥ 44px.
18. ✅ **Dark mode** (toggle mobile + desktop, persistant).
19. ✅ **Responsive desktop** (sidebar + topbar ≥ 1024px, mobile en dessous).
20. 🚧 **Sélecteur de boutique** dans la topbar (switch rapide).

### NOUVEAU (depuis la refonte design v2)
21. 🔜 **Adoption complète des icônes Lucide** (lucide-react installé ; emojis conservés pour l'accessibilité — à arbitrer).
22. 🔜 **Dashboard desktop riche** : graphique 7 jours + cartes comme la maquette `SamaCommerce Desktop.dc.html`.
23. 🔜 **POS desktop 2 colonnes** (catalogue à gauche, panier collant à droite).
24. 🔜 **Panneau notifications** (cloche) listant alertes stock + échéances crédit.
25. 🔜 **Recherche globale** dans la topbar desktop (produits, clients).

## ⚙️ Backend — robustesse & scalabilité

### Sécurité & auth
1. 🔜 **2FA login complet** (table `twofa_codes` prête ; flux envoi+vérif non branché).
2. 🔜 **Réinitialisation de mot de passe** (email + token).
3. 🔜 **Rate limiting** (`throttle`) sur `/auth/login` & `/auth/register`.
4. 🔜 **Expiration / refresh** des tokens Sanctum.
5. 🔜 **Envoi d'emails réel** (invitations équipe, rappels).

### Données & cohérence
6. 🟡 **Scoping `boutique_id` complet** : produits & ventes isolés ✅ ; étendre clients/fournisseurs/caisse/commandes/retours.
7. 🔜 **Montants en entiers (FCFA sans centimes)** — éviter les flottants `decimal`.
8. 🔜 **Pagination API** (produits/ventes/clients) — adapter le front en même temps.
9. 🔜 **API Resources/Transformers** (forme JSON homogène).
10. 🟡 **Index** (présents sur les colonnes chaudes) ; **eager loading** anti N+1 à généraliser.
11. 🔜 **Journal d'activité** (`activity_logs`) — audit multi-employés.

### Performance & exploitation
12. 🔜 **Cache** des stats/dashboard.
13. 🔜 **Files d'attente** (emails, exports).
14. 🔜 **API versionnée** (`/api/v1`).
15. 🟡 **Tests** : script QA `test_api.py` (76 endpoints) ✅ ; ajouter PHPUnit feature tests.
16. 🔜 **Intégration paiement** Wave/Orange Money réelle.
17. 🔜 **Sauvegarde** automatique Supabase.

## 🚀 Fonctionnel (vers le mémoire & le marché)
- 🔜 **Fractionnement** (vente au kg/bol/sachet) — valeur ajoutée du mémoire (Phase 6).
- 🔜 **IA** : prévision de réappro + scoring de crédit (micro-service prêt à rebrancher — Phase 6).
- 🔜 **Commandes clients + livraisons + livreurs** (`customer_orders`/`deliveries`).
- 🔜 **Notifications push** (Web Push + VAPID).
- 🔜 **Rapports avancés** : marge par catégorie, rotation des stocks, meilleurs clients.
- 🔜 **Mobile React Native** à l'identique (Phase 5).
