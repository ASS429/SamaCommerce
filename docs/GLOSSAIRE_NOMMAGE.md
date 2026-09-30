# SamaCommerce — glossaire de nommage et plan de francisation

*Rédigé le 29 septembre 2026, avant le début des travaux, et validé le jour même.
Avancement : section 12.*

Ce document fixe **comment chaque nom du code est traduit en français**, ce qui
reste en anglais et pourquoi, puis **dans quel ordre** la traduction est menée
sans interrompre le service des commerçants déjà inscrits.

Il sert aussi de référence après coup : quiconque reprend le code doit pouvoir
retrouver ici le nom français d'une notion.

---

## 1. Le constat de départ

Le code mélange les deux langues sans règle :

| Endroit | Anglais | Français, au même endroit |
|---|---|---|
| Table des ventes | `quantity`, `total`, `paid` | `prix_reel`, `remise`, `vendu_par` |
| Table des produits | `price` | `price_achat` (moitié-moitié) |
| Modèles | `Sale`, `Product` | `Retour`, `CommandeItem` |
| Contrôleurs | `SaleController` | `CommandeController`, qui lit la table `restock_orders` |
| Écrans | `Home.tsx`, `Returns.tsx` | `Caisse.tsx`, `Commandes.tsx` |

Inventaire mesuré : **1 552 noms distincts** dans l'API, **1 656** dans
l'application web, **470 classes CSS**, **60 variables CSS**, 29 tables
(dont 22 à nous), 112 routes (hors doublon `/v1`).

## 2. La règle

> **Tout ce que nous avons nommé est en français. Ce que la langue de
> programmation, le framework ou un standard impose reste tel quel.**

C'est le principe du *langage omniprésent* (Eric Evans, *Domain-Driven Design*,
2003) : le code parle la langue du métier. Un commerçant dit « vente »,
« crédit », « caisse » ; le code dit désormais `ventes`, `credits`, `caisse`.

---

## 3. Ce qui reste en anglais, et pourquoi

Chaque exception a une raison vérifiable. Aucune n'est une facilité.

| Ce qui reste | Exemples | Pourquoi on ne peut pas (ou ne doit pas) le traduire |
|---|---|---|
| Mots-clés des langages | `function`, `return`, `class`, `if`, `const`, `def` | Définis par PHP, TypeScript et Python. |
| Fonctions des bibliothèques | `useState`, `Route::get`, `belongsTo`, `validate`, `FastAPI`, `axios` | Écrites par d'autres ; on les appelle, on ne les nomme pas. |
| Méthodes que le framework appelle lui-même | `handle()`, `toArray()`, `up()`/`down()`, `boot()`, `apply()`, `setUp()`, `render()` | Laravel, PHPUnit ou React les appellent **par ce nom exact**. Renommées, elles ne seraient plus jamais exécutées. |
| Propriétés lues par le framework | `$fillable`, `$casts`, `$hidden`, `$table`, `$signature` | Même raison. |
| Préfixe `use` des hooks React | `useProduits`, `useErreurChargement` | Les règles de React détectent un hook à ce préfixe. **La suite du nom est en français.** |
| Tables internes de Laravel | `migrations`, `sessions`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`, `personal_access_tokens` | Leur structure est lue et écrite par le code du framework, pas par le nôtre. |
| Arborescence générée par Laravel et Vite | `app/Http/Controllers`, `app/Models`, `app/Models/Scopes`, `app/Console/Commands`, `database/migrations`, `tests/Feature`, `config/`, `public/`, `src/`, `dist/` | **Décision du 29/09/2026.** Les générateurs (`php artisan make:…`) et tout développeur Laravel s'attendent à la trouver là. Les dossiers **que nous avons créés** (`components`, `lib`, `build`, `assets`…) sont, eux, traduits. |
| Dossier racine `apps/` | `apps/api`, `apps/web`, `apps/mobile` | **Décision du 30/09/2026.** Le renommer changerait le dossier que Render construit pour les trois services en ligne, pour un gain nul. |
| Fichiers de convention | `README.md`, `Dockerfile`, `render.yaml`, `package.json`, `composer.json`, `phpunit.xml`, `.gitignore`, `index.html`, `favicon.ico` | GitHub, Docker, Render, npm, Composer et les navigateurs les cherchent sous ce nom. |
| Fichier du service worker | `sw.js`, `manifest.webmanifest` | **Piège majeur.** Un téléphone qui a installé l'application interroge `/sw.js` pour se mettre à jour. Renommé, ce fichier renverrait une erreur 404 : le navigateur garderait l'ancienne version **indéfiniment**. |
| Variables d'environnement du framework | `APP_KEY`, `DB_URL`, `MAIL_MAILER`, `SANCTUM_EXPIRATION`, `SENTRY_LARAVEL_DSN`, `RESEND_API_KEY`, `PORT` | Lues par Laravel, Sanctum, Sentry, Resend ou Render. |
| Les trois secrets | `ADMIN_PASSWORD` (Render), `SUPABASE_DB_URL` et `BACKUP_PASSPHRASE` (GitHub) | **Décision du 29/09/2026.** Leur valeur n'est connue que du propriétaire : les renommer l'obligerait à les recréer à la main, avec un risque d'oubli (administration neutralisée, sauvegarde en échec) pour un gain nul. |
| Standards et formats | en-têtes HTTP (`Authorization`), manifeste PWA (`short_name`), format Excel (`workbook.xml`), options de jsPDF (`fontSize`) | Imposés par une norme ou par le format de fichier. |
| Enveloppe de pagination et d'erreur de validation | `data`, `current_page`, `last_page`, `errors` | Produites par Laravel. Les noms de champs **à l'intérieur** sont traduits. |
| Classes utilitaires Tailwind | `flex`, `p-4`, `bg-violet-600` | Vocabulaire de la bibliothèque. |
| Noms propres | Wave, Orange Money, WhatsApp, Render, Supabase | Ce sont des marques. |
| Traductions anglaises de l'interface | `lib/i18n` : option de langue « EN » | C'est du **contenu** destiné aux utilisateurs anglophones, pas du code. Le wolof reste aussi. |
| Adresses publiques | `samacommerce-api.onrender.com`, `samacommerce-web…` | Les renommer casserait les favoris et les applications déjà installées. |
| Historique Git | messages des anciens commits | L'historique d'un dépôt public ne se réécrit pas. |
| Sigles admis en français | `id`, `uuid`, `url`, `api`, `ia`, `pdf`, `pin`, `kpi`, `ok`, `email` | Employés tels quels en français. |

### Exceptions temporaires, avec date de retrait

Pour **ne casser aucun téléphone** pendant la transition, quatre éléments
contiennent forcément les anciens noms anglais : ils traduisent de l'ancien vers
le nouveau. Ils sont isolés, commentés, et retirés à la date indiquée.

| Élément | Rôle | Retrait prévu |
|---|---|---|
| Couche de compatibilité de l'API | Une application restée ouverte sur l'ancienne version continue de fonctionner. | Quand l'API n'a reçu **aucun appel** à l'ancien format pendant 14 jours (compteur visible sur `/api/sante`). |
| Migration inverse, prête à l'emploi | Retour arrière de la base en un seul envoi si le nouveau code devait être retiré. | Quelques semaines après un passage stable. |
| Migration du stockage du navigateur | Recopie jeton, réglages et **ventes hors ligne en attente** sous les nouveaux noms. | Trois mois après la bascule. |
| Harmonisation des noms de migrations | Permet de restaurer une ancienne sauvegarde sur le nouveau code. | Quand la dernière sauvegarde anglaise a expiré (90 jours). |

La **migration de renommage** elle-même garde les anciens noms pour toujours :
c'est l'acte de traduction, il faut bien qu'il dise d'où il part.

---

## 4. Conventions d'écriture

### Base de données

- `snake_case`, sans accents : `categorie_id`, `prix_achat`.
- Tables au pluriel : `produits`, `ventes`, `lignes_commande`.
- Clés étrangères : `<entité>_id` → `produit_id`, `utilisateur_id`.
- Instants : suffixe `_le` → `cree_le`, `modifie_le`, `supprime_le`, `livree_le`.
- Dates civiles : préfixe `date_` → `date_echeance`, `date_prevue`.
- Booléens : `est_…` (`est_principale`), participe (`paye`, `utilise`), ou `…_actif`.
- Ordre naturel du français : `nom_client`, et non `client_nom`.

### PHP (API)

- Classes en `PascalCase`, nom principal d'abord : `ControleurProduit`,
  `RessourceVente`, `VerifierPermission`.
- Méthodes et variables en `camelCase`, verbes à l'infinitif : `creer()`,
  `restaurer()`, `$boutiqueActive`.
- Actions des contrôleurs : `index` → `lister`, `show` → `afficher`,
  `store` → `creer`, `update` → `modifier`, `destroy` → `supprimer`,
  `trash` → `corbeille`, `restore` → `restaurer`.
- Classes de test : suffixe `Test` (mot français), méthodes `test_…` en français.

### TypeScript et React (web)

- Composants et types en `PascalCase` : `Accueil`, `FenetreRecu`, `Produit`.
- Fonctions en `camelCase`, verbes à l'infinitif : `chargerProduits()`.
- Accès à l'état React : `[produits, definirProduits]` (`set` → `definir`).
- Propriétés d'événement de nos composants : `on…` → `sur…`
  (`surFermer`, `surEnregistrer`). Les attributs du DOM (`onClick`) restent.
- Booléens : `est…`, `a…`, `peut…` → `estEmploye`, `peutVendre`.
- Constantes en majuscules : `CLE_JETON`.

### CSS

- Classes en `kebab-case` français : `.carte-produit`, `.bouton-principal`.
- Variables : `--marque`, `--fond`, `--texte`, `--attenue`, `--bordure`, `--ombre`.
- Animations : `apparitionHaut`, `impulsion`, `balayageRadar`.

### Python (service IA)

- `snake_case` pour fonctions et variables, `PascalCase` pour les classes.

---

## 5. Dictionnaire métier

Le vocabulaire de base, dont découlent tous les noms composés.

| Anglais | Français | | Anglais | Français |
|---|---|---|---|---|
| product | produit | | owner | propriétaire |
| sale | vente | | member | membre |
| category | catégorie | | employee | employé |
| customer | client | | manager | gérant |
| supplier | fournisseur | | user | utilisateur |
| restock order | commande | | account | compte |
| order line | ligne de commande | | token | jeton |
| delivery | livraison | | device | appareil |
| return | retour | | login / logout | connexion / déconnexion |
| refund | remboursement | | register | inscription |
| repayment | règlement | | two-factor (2FA) | double facteur |
| cash closing | clôture de caisse | | settings | paramètres |
| shop | boutique | | activity log | journal d'activité |
| packaging unit | conditionnement | | tenant scope | cloisonnement |
| barcode | code-barres | | forecast | prévision |
| price / cost | prix / coût | | restock | réappro |
| purchase price | prix d'achat | | stockout | rupture |
| selling price | prix de vente | | risk / reason | risque / raison |
| amount | montant | | health | santé |
| quantity | quantité | | trash / restore | corbeille / restaurer |
| discount | remise | | sync | synchroniser |
| revenue | chiffre d'affaires (`ca`) | | offline queue | file hors ligne |
| COGS | coût des marchandises | | pending | en attente |
| payment method | moyen de paiement | | backfill | reconstituer |
| paid | payé | | seed | amorcer |
| due date | échéance | | cart / receipt | panier / reçu |
| upgrade (Premium) | passage Premium | | withdrawal / transfer | retrait / transfert |
| dashboard | tableau de bord | | overview | vue d'ensemble |

---

## 6. Base de données

### 6.1 Tables

| Actuelle | Nouvelle | | Actuelle | Nouvelle |
|---|---|---|---|---|
| `users` | `utilisateurs` | | `restock_orders` | `commandes` |
| `products` | `produits` | | `commande_items` | `lignes_commande` |
| `product_units` | `conditionnements` | | `restock_deliveries` | `livraisons` |
| `sales` | `ventes` | | `returns` | `retours` |
| `categories` | `categories` | | `caisse_closings` | `clotures_caisse` |
| `clients` | `clients` | | `boutiques` | `boutiques` |
| `fournisseurs` | `fournisseurs` | | `boutique_members` | `membres_boutique` |
| `tontines` | `tontines` | | `activity_logs` | `journal_activite` |
| `alerts` | `alertes` | | `twofa_codes` | `codes_double_facteur` |
| `withdrawals` | `retraits` | | `password_reset_tokens` | `codes_reinitialisation` |
| `admin_transfers` | `transferts_admin` | | `admin_settings` | `parametres_admin` |

`password_reset_tokens` est traduite parce que **seul notre code** l'utilise
(le mécanisme de réinitialisation de Laravel n'est pas employé).

### 6.2 Colonnes communes

| Actuelle | Nouvelle |
|---|---|
| `created_at` / `updated_at` / `deleted_at` | `cree_le` / `modifie_le` / `supprime_le` |
| `user_id` | `utilisateur_id` |
| `owner_id` | `proprietaire_id` |
| `product_id` / `sale_id` / `category_id` | `produit_id` / `vente_id` / `categorie_id` |
| `name` | `nom` |
| `phone` | `telephone` |
| `address` | `adresse` |
| `status` | `statut` |
| `amount` | `montant` |
| `quantity` | `quantite` |

`id`, `boutique_id`, `client_id`, `fournisseur_id`, `commande_id`, `email`,
`notes`, `photo`, `emoji`, `couleur`, `total`, `stock`, `date`, `type`,
`role`, `plan`, `message`, `action`, `detail` ne changent pas.

### 6.3 Colonnes propres à chaque table

| Table | Actuelle → Nouvelle |
|---|---|
| `utilisateurs` | `username` → `identifiant` · `password` → `mot_de_passe` · `company_name` → `nom_commerce` · `current_boutique_id` → `boutique_active_id` · `payment_status` → `statut_paiement` · `payment_method` → `moyen_paiement` · `upgrade_status` → `statut_demande_premium` · `twofa_enabled` → `double_facteur_actif` · `remember_token` → `jeton_souvenir` |
| `produits` | `scent` → `description` · `barcode` → `code_barres` · `price` → `prix_vente` · `price_achat` → `prix_achat` |
| `ventes` | `client_uuid` → `uuid_appareil` · `payment_method` → `moyen_paiement` · `client_name` → `nom_client` · `client_phone` → `telephone_client` · `due_date` → `date_echeance` · `paid` → `paye` · `repayment_method` → `moyen_reglement` · `unit_id` → `conditionnement_id` · `unit_libelle` → `libelle_conditionnement` · `cogs` → `cout_marchandises` · `backfilled` → `reconstituee` |
| `retours` | `reason` → `motif` · `refund_method` → `moyen_remboursement` · `refund_amount` → `montant_rembourse` |
| `commandes` | `expected_date` → `date_prevue` |
| `livraisons` | `tracking_note` → `note_suivi` · `delivered_at` → `livree_le` |
| `boutiques` | `is_primary` → `est_principale` |
| `membres_boutique` | `ref_boutique_id` → `boutique_rattachement_id` · `member_id` → `membre_id` · `invite_token` → `jeton_invitation` · `invite_expires_at` → `invitation_expire_le` · `accepted_at` → `acceptee_le` |
| `journal_activite` | `actor_id` → `acteur_id` · `actor_name` → `nom_acteur` |
| `tontines` | `members` → `membres` · `created_date` → `date_creation` |
| `alertes` | `days` → `jours` |
| `retraits` | `method` → `moyen` |
| `transferts_admin` | `from_account` → `compte_source` · `to_account` → `compte_destination` |
| `parametres_admin` | `app_name` → `nom_application` · `contact_email` → `email_contact` · `timezone` → `fuseau_horaire` · `premium_price` → `prix_premium` · `grace_period` → `delai_grace` · `alerts_enabled` → `alertes_actives` · `notify_new_subs` → `notifier_nouveaux_abonnes` · `notify_late_payments` → `notifier_retards_paiement` · `notify_reports` → `notifier_rapports` · `multi_sessions` → `sessions_multiples` · `twofa_enabled` → `double_facteur_actif` |
| `codes_double_facteur` | `code` → `code_hache` · `expires_at` → `expire_le` · `used` → `utilise` |
| `codes_reinitialisation` | `email` → `identifiant` · `token` → `code_hache` |

Deux choix à signaler :

- **`repayment_method` → `moyen_reglement`, `refund_method` → `moyen_remboursement`.**
  Les deux auraient donné « moyen de remboursement ». Or ce sont deux gestes
  opposés : le client **règle** sa dette, la boutique **rembourse** un retour.
- **`client_uuid` → `uuid_appareil`.** En français, « client » désigne
  l'acheteur. Cet identifiant est produit par le téléphone pour éviter les
  doublons hors ligne.

Les index, clés et séquences sont renommés en conséquence
(`products_user_boutique_idx` → `produits_utilisateur_boutique_idx`…), pour
qu'une base neuve et la base de production soient **strictement identiques**.

### 6.4 Valeurs enregistrées

| Où | Actuelle → Nouvelle |
|---|---|
| `utilisateurs.role` | `user` → `commercant` (`admin` inchangé) |
| `utilisateurs.plan` | `Free` → `Gratuit` (`Premium` inchangé ; `Business`/`Enterprise` → `Entreprise`) |
| `membres_boutique.statut` | `pending` → `invitee` · `accepted` → `acceptee` · `rejected` → `refusee` |
| `alertes.type` | `late` → `retard` · `upcoming` → `a_venir` |
| Comptes de l'administration | `cash` → `especes` |
| Réglages (`utilisateurs.preferences`) | `modules_off` → `sections_masquees` · `auto_print` → `impression_auto` · section `returns` → `retours` |

Déjà en français, donc inchangés : moyens de paiement (`especes`, `wave`,
`orange`, `credit`), statuts de commande et de livraison, actions du journal
(`vente`, `produit.ajout`…), permissions (`vente`, `stock`, `caisse`…).

Pour les membres, `invitee` a été préféré à `en_attente` : ce dernier désigne
déjà une commande non reçue, et les deux ne doivent pas se confondre.

---

## 7. API

### 7.1 Routes

Le préfixe de version `/v1` est conservé.

| Actuelle | Nouvelle |
|---|---|
| `GET /health` | `GET /sante` |
| `POST /auth/register` · `/auth/login` | `/auth/inscription` · `/auth/connexion` |
| `POST /auth/forgot-password` · `/auth/reset-password` | `/auth/mot-de-passe-oublie` · `/auth/reinitialiser-mot-de-passe` |
| `POST /auth/verify-2fa` · `PUT /auth/2fa` | `/auth/verifier-double-facteur` · `/auth/double-facteur` |
| `GET /auth/me` | `/auth/moi` |
| `POST /auth/logout` · `/auth/logout-all` | `/auth/deconnexion` · `/auth/deconnexion-partout` |
| `PUT /auth/profile` · `/auth/upgrade` | `/auth/profil` · `/auth/passage-premium` |
| `PUT /auth/preferences` | *(inchangée)* |
| `/boutiques/dashboard` · `/boutiques/{id}/switch` · `/boutiques/{id}/stats` | `/boutiques/tableau-de-bord` · `/boutiques/{id}/activer` · `/boutiques/{id}/statistiques` |
| `GET /activity` | `GET /activite` |
| `POST /ia/credit-score` | `POST /ia/score-credit` (`/ia/reappro` inchangée) |
| `/members` · `/members/invite` · `/members/accept` · `/members/my-boutique` · `/members/invite/{token}` | `/membres` · `/membres/inviter` · `/membres/accepter` · `/membres/ma-boutique` · `/membres/invitation/{jeton}` |
| `/products` · `/products/trash` · `/products/{id}/restore` | `/produits` · `/produits/corbeille` · `/produits/{id}/restaurer` |
| `/sales` · `/sales/trash` · `/sales/sync` · `/sales/{id}/restore` | `/ventes` · `/ventes/corbeille` · `/ventes/synchroniser` · `/ventes/{id}/restaurer` |
| `/clients/for-sale` · `/clients/{id}/stats` | `/clients/pour-vente` · `/clients/{id}/statistiques` |
| `/returns` · `/returns/stats` | `/retours` · `/retours/statistiques` |
| `/caisse/today` · `/history` · `/weekly` · `/close` | `/caisse/aujourdhui` · `/historique` · `/semaine` · `/cloturer` |
| `/fournisseurs/{id}/reappro-message` | `/fournisseurs/{id}/message-reappro` |
| `/stats/…` · `/stats/top-produits` | `/statistiques/…` · `/statistiques/meilleurs-produits` |
| `/client-errors` | `/erreurs-navigateur` |
| `/auth/users…` (`block`, `activate`, `reminder`) | `/admin/utilisateurs…` (`bloquer`, `activer`, `relancer`) |
| `/auth/upgrade/{id}/approve` · `reject` | `/admin/passages-premium/{id}/valider` · `refuser` |
| `/admin-stats/overview` · `accounts` | `/admin/statistiques/vue-ensemble` · `comptes` |
| `/admin-withdrawals` · `/admin-transfers` · `/admin-settings` · `…/twofa` | `/admin/retraits` · `/admin/transferts` · `/admin/parametres` · `…/double-facteur` |

`/categories`, `/tontines`, `/commandes`, `/livraisons`, `/fournisseurs`,
`/boutiques` gardent leur nom : ils sont déjà en français.

### 7.2 Champs JSON

Les champs qui reflètent une colonne suivent la section 6. Les autres :

| Actuel | Nouveau | | Actuel | Nouveau |
|---|---|---|---|---|
| `user` / `token` | `utilisateur` / `jeton` | | `product_name` | `nom_produit` |
| `token_expires_at` | `jeton_expire_le` | | `fournisseur_name` / `_phone` | `nom_fournisseur` / `telephone_fournisseur` |
| `twofa_required` | `double_facteur_requis` | | `units` / `items` | `conditionnements` / `lignes` |
| `dev_code` | `code_dev` | | `items_count` | `nb_lignes` |
| `device_name` | `nom_appareil` | | `invite_link` | `lien_invitation` |
| `is_employee` | `est_employe` | | `whatsapp_url` | `url_whatsapp` |
| `error` / `success` | `erreur` / `succes` | | `display_label` | `libelle_affichage` |
| `enabled` | `actif` | | `days_until_stockout` | `jours_avant_rupture` |
| `risk` / `reasons` / `method` | `risque` / `raisons` / `methode` | | `reorder_display` | `a_commander_affiche` |

Valeurs renvoyées : risque `green`/`amber`/`red` → `vert`/`orange`/`rouge` ;
méthode `model`/`heuristic` → `modele`/`heuristique` ; santé
`ok`/`degraded`/`down` → `ok`/`degrade`/`hors_service` ; code d'erreur
`BOUTIQUE_LIMIT_REACHED` → `LIMITE_BOUTIQUES_ATTEINTE`.

---

## 8. Code PHP

| Actuel | Nouveau |
|---|---|
| **Modèles** `User`, `Product`, `ProductUnit`, `Category`, `Sale` | `Utilisateur`, `Produit`, `Conditionnement`, `Categorie`, `Vente` |
| `RestockOrder`, `CommandeItem`, `RestockDelivery` | `Commande`, `LigneCommande`, `Livraison` |
| `CaisseClosing`, `BoutiqueMember`, `ActivityLog` | `ClotureCaisse`, `MembreBoutique`, `JournalActivite` |
| `Alert`, `Withdrawal`, `AdminTransfer`, `AdminSetting` | `Alerte`, `Retrait`, `TransfertAdmin`, `ParametreAdmin` |
| *(nouveau)* | `Modele` : classe mère qui déclare `cree_le` / `modifie_le` / `supprime_le` |
| `Scopes/BoutiqueScope` | `Scopes/CloisonnementBoutique` |
| **Contrôleurs** `Controller` (classe mère) | `Controleur` |
| `AuthController`, `SaleController`, `ProductController`… | `ControleurAuthentification`, `ControleurVente`, `ControleurProduit`… (même règle pour les 23) |
| `HealthController`, `ClientErrorController`, `StatsController` | `ControleurSante`, `ControleurErreurNavigateur`, `ControleurStatistiques` |
| `Admin/AdminUserController`, `AdminStatsController` | `Admin/ControleurUtilisateurs`, `ControleurStatistiques` |
| **Intergiciels** `EnsureAdmin`, `EnsurePermission` | `VerifierAdmin`, `VerifierPermission` |
| `ResolveTenant`, `SecurityHeaders` | `ResoudreProprietaire`, `EntetesSecurite` |
| **Ressources** `ProductResource`, `SaleResource`… | `RessourceProduit`, `RessourceVente`… |
| **Service** `IaClient` | `ClientIa` |
| **Commandes** `sales:backfill`, `admin:secure`, `db:seed-if-empty` | `ventes:reconstituer`, `admin:securiser`, `base:amorcer-si-vide` |
| **Amorçage** `DemoSeeder` | `AmorceurDemo` |
| `UserFactory` | **supprimée** : jamais utilisée, et elle décrit des colonnes (`name`, `email`) qui n'existent pas |
| `AppServiceProvider` | `FournisseurServicesApplication` |
| Script de démarrage `start.sh` | `demarrer.sh` |

`DatabaseSeeder` garde son nom : c'est le point d'entrée que
`php artisan db:seed` appelle par défaut.

---

## 9. Application web

### 9.1 Dossiers et fichiers

| Actuel | Nouveau |
|---|---|
| `src/components/` · `src/lib/` · `build/` | `src/composants/` · `src/outils/` · `compilation/` |
| `src/assets/` (3 images du gabarit Vite, **jamais utilisées**) | supprimé |
| `App.tsx` · `main.tsx` · `test/setup.ts` | `Application.tsx` · `demarrage.tsx` · `test/preparation.ts` |
| `sections/Home` · `Login` · `Returns` · `PlusSheet` | `Accueil` · `Connexion` · `Retours` · `VoletPlus` |
| `BoutiquesDashboard` · `BoutiquesSection` · `CategoriesSection` | `TableauBordBoutiques` · `SectionBoutiques` · `SectionCategories` |
| `admin/AdminApp` | `admin/ApplicationAdmin` |
| `BarcodeScanner` · `CommandPalette` · `ErrorBoundary` | `ScannerCodeBarres` · `PaletteCommandes` · `BarriereErreur` |
| `HeroBackdrop` · `HeroScene` · `ClotureScene` | `FondBanniere` · `SceneBanniere` · `SceneCloture` |
| `LoadError` · `Odometer` · `Onboarding` | `ErreurChargement` · `Compteur` · `PremiersPas` |
| `PaymentPicker` · `PhotoPicker` · `PinLock` | `ChoixPaiement` · `ChoixPhoto` · `VerrouPin` |
| `ReceiptModal` · `ScoreRing` · `Skeleton` · `SwipeRow` | `FenetreRecu` · `AnneauScore` · `Squelette` · `LigneGlissante` |
| `lib/cart` · `celebrate` · `errorReporter` · `flyToCart` | `outils/panier` · `celebrer` · `rapporteurErreurs` · `envolVersPanier` |
| `haptics` · `i18n` · `invite` · `loadError` | `vibrations` · `traductions` · `invitation` · `erreursChargement` |
| `offlineQueue` · `payments` · `pinLock` · `productIcon` | `fileHorsLigne` · `paiements` · `verrouPin` · `iconeProduit` |
| `queries` · `toast` · `tone` · `usePullToRefresh` | `requetes` · `bulles` · `teinte` · `useTirerPourRafraichir` |
| `public/pay/` · `icon-192.png` · `icon-512.png` | `public/paiement/` · `icone-192.png` · `icone-512.png` |

Déjà en français, inchangés : `Caisse`, `Clients`, `Commandes`, `Credits`,
`Equipe`, `Fournisseurs`, `IaReappro`, `Inventaire`, `Livraisons`, `Premium`,
`Profil`, `Rapports`, `Stock`, `Vente`, `Avatar`, `Logo`, `api`, `modules`,
`notifications`, `pdf`, `photo`, `theme`, `whatsapp`, `xlsx`.

Identifiants d'écran : `menu` → `accueil`, `returns` → `retours`.

### 9.2 Stockage du navigateur

**C'est l'endroit où une erreur ferait perdre des données.** Chaque clé est
recopiée sous son nouveau nom au premier lancement de la nouvelle version,
puis l'ancienne est effacée **seulement après** une écriture réussie.

| Actuelle | Nouvelle | Contenu |
|---|---|---|
| `samacommerce_token` | `samacommerce_jeton` | Session : sans elle, déconnexion |
| `samacommerce_user` | `samacommerce_utilisateur` | Champs internes traduits aussi |
| `samacommerce_device` | `samacommerce_appareil` | **Valeur conservée à l'identique** (c'est le nom du jeton en base) |
| `samacommerce_theme` | *(inchangée)* | Valeurs `light`/`dark` → `clair`/`sombre` |
| `samacommerce_lang` · `samacommerce_invite` | `samacommerce_langue` · `samacommerce_invitation` | |
| `samacommerce_onboarded` | `samacommerce_premiers_pas_vus` | |
| `samacommerce_modules_off` | `samacommerce_sections_masquees` | `returns` → `retours` |
| `samacommerce_autoprint` · `samacommerce_prefs_dirty` | `samacommerce_impression_auto` · `samacommerce_reglages_a_envoyer` | |
| `samacommerce_pin` · `samacommerce_pin_delay` | `samacommerce_code_pin` · `samacommerce_delai_verrou` | **Code PIN conservé** |
| `sc_stock_sort` · `sc_notif` | `samacommerce_tri_stock` · `samacommerce_notifications` | |
| IndexedDB `samacommerce_offline` / `pending_sales` | `samacommerce_hors_ligne` / `ventes_en_attente` | **Ventes pas encore envoyées** : recopiées une à une, champs traduits |
| Cache `api-cache` | `cache-api` | Ancien cache effacé |

Les liens d'invitation déjà envoyés par WhatsApp portent `?invite=…`. Le
nouveau paramètre est `?invitation=…` ; **l'ancien reste reconnu**, sinon un
employé invité la veille resterait à la porte.

---

## 10. Service IA

| Actuel | Nouveau |
|---|---|
| `POST /forecast` · `POST /credit-score` · `GET /health` | `POST /prevision` · `POST /score-credit` · `GET /sante` |
| `current_stock_base` · `history_daily_base` | `stock_actuel_base` · `historique_jour_base` |
| `avg_daily_demand_base` · `recommended_reorder_base` | `demande_moyenne_jour_base` · `reassort_conseille_base` |
| `amount` · `due_in_days` · `past_credits` | `montant` · `jours_avant_echeance` · `credits_passes` |
| `past_repaid_on_time` · `avg_days_late` · `repaid` | `rembourses_a_temps` · `retard_moyen_jours` · `rembourse` |
| `make_synthetic.py` · `train_credit.py` · `train_demand.py` | `generer_donnees.py` · `entrainer_credit.py` · `entrainer_demande.py` |
| `credit_training.csv` · `demand_training.csv` | `entrainement_credit.csv` · `entrainement_demande.csv` |
| `credit_score.joblib` · `demand_forecast.joblib` | `score_credit.joblib` · `prevision_demande.joblib` |
| Dossiers `app/` · `models/` · `data/` | `application/` · `modeles/` · `donnees/` *(ajout de l'étape 4)* |
| Variable FastAPI `app` (lancement `uvicorn app.main:app`) | `application` (`uvicorn application.main:application`) *(ajout de l'étape 4)* |

Les deux dernières lignes avaient échappé à l'inventaire initial. La règle de
la section 3 s'y applique : ces dossiers ont été créés par nous, pas par un
générateur (FastAPI n'en a pas). Vérifié avant envoi : tests du service, et
démarrage avec **uniquement** ce que copie le `Dockerfile`, modèles chargés.

**Point délicat : les modèles entraînés contiennent les noms de colonnes.** Ils
seront réentraînés avec les noms français, et on vérifiera que **leurs
prédictions sont identiques au chiffre près** à celles des modèles actuels sur
une grille d'entrées. Un nom de colonne ne doit rien changer au calcul ; si
quelque chose change, c'est un défaut, et on s'arrête.

---

## 11. Variables d'environnement et secrets

| Actuelle | Nouvelle | Où | Qui agit |
|---|---|---|---|
| `IA_SERVICE_URL` | `URL_SERVICE_IA` | `render.yaml` (en clair) | automatique |
| `STATS_CACHE` · `APP_VERSION` | `CACHE_STATISTIQUES` · `VERSION_APPLICATION` | code | automatique |
| `FRONTEND_URL` | `URL_SITE_WEB` | `render.yaml`, désormais en clair (adresse publique) | automatique |
| `CORS_ALLOWED_ORIGINS` | `ORIGINES_CORS_AUTORISEES` | idem | automatique |
| `VITE_API_URL` | `VITE_URL_API` (préfixe `VITE_` imposé par Vite) | `render.yaml` | automatique |
| `ADMIN_PASSWORD` · `SUPABASE_DB_URL` · `BACKUP_PASSPHRASE` | **inchangés** (secrets, cf. section 3) | Render / GitHub | — |
| — *(nouvelle, 30/09/2026)* | `EMAIL_ADMIN` : adresse qui reçoit les codes de vérification du compte administrateur | Render, saisie à la main (jamais dans le dépôt public) | le propriétaire |

Toutes les variables renommées ont une valeur publique, écrite en clair dans
`render.yaml` : Render les applique seul, aucune action manuelle n'est requise.

Fichiers d'automatisation : `backup.yml` → `sauvegarde-base.yml`, `ci.yml` →
`integration-continue.yml`, `keepalive.yml` → `garder-api-eveillee.yml`.
Documentation : `DEPLOY.md` → `DEPLOIEMENT.md`.

---

## 12. Plan d'exécution

### Pourquoi par étapes

Trois éléments ne se déploient pas au même instant : le service IA, l'API et le
site. Render les reconstruit l'un après l'autre, en quelques minutes. Si l'API
passait au français **avant** que les téléphones aient la nouvelle version, ils
appelleraient des adresses qui n'existent plus. D'où l'ordre ci-dessous, où
chaque étape reste compatible avec la précédente.

### Étape 0 — Photographier l'existant *(aucun changement visible)*

- Liste exacte des 112 routes actuelles.
- Réponses JSON de **chaque** route sur des données de test : ce sont les
  « empreintes » que la couche de compatibilité devra reproduire à l'identique.
- Schéma complet de la base PostgreSQL actuelle.
- **Captures d'écran de toutes les pages**, clair et sombre, téléphone et
  ordinateur : le renommage de 470 classes CSS peut casser un style sans
  qu'aucun test ne le voie. Les captures d'après seront comparées pixel par pixel.

### Étape 1 — Service IA

Code, routes et modèles en français. **Les anciennes routes restent actives**
tant que l'API actuelle les appelle. Vérification en production : les deux
jeux de routes répondent, avec `methode: "modele"`.

### Étape 2 — API et base de données *(l'étape la plus délicate)*

- Migration de renommage : tables, colonnes, index, séquences, valeurs.
  **Renommer ne déplace aucune donnée** : PostgreSQL change une étiquette, les
  lignes ne bougent pas.
- **Une seule transaction** : PostgreSQL sait annuler un changement de
  structure. Soit tout est renommé, soit rien ne l'est ; une base à moitié
  traduite est impossible. Si la migration échoue, le nouveau serveur ne
  démarre pas et Render garde l'ancien, sur une base intacte.
- **Migration inverse préparée et testée à l'avance** : si le nouveau code
  devait être retiré, un seul envoi remet la base en anglais.

  *Écartée après examen : des « vues SQL » portant les anciens noms. Une vue ne
  peut pas porter le nom d'une table existante ; or `categories`, `clients`,
  `fournisseurs`, `boutiques` et `tontines` gardent leur nom tout en changeant
  de colonnes. La protection n'aurait été que partielle.*
- **Anciennes routes maintenues** et traduites au vol : le site encore en
  anglais continue de fonctionner, **y compris la file des ventes hors ligne**.
- Mise à jour, **dans le même envoi**, de la sauvegarde nocturne : elle
  vérifie la présence des tables `users`, `products` et `sales` et échouerait
  la nuit suivante.

Vérifications **avant** d'envoyer :

1. Tous les tests PHPUnit, renommés.
2. Sur un PostgreSQL 17 identique à la production (Docker) : base créée par
   l'**ancien** code, remplie, puis migrée → schéma comparé à une base neuve
   créée par le nouveau code : **aucune différence tolérée**.
3. Même base : nombre de lignes et contenu comparés avant et après, table par
   table.
4. La migration inverse jouée sur la base renommée : l'**ancien** code doit
   ensuite fonctionner (preuve que le retour arrière est possible).
5. L'image Docker de production démarrée localement, exactement comme Render
   la lance, sur une base remplie par l'ancien code.
6. Les anciennes routes rejouées : réponses comparées aux empreintes de
   l'étape 0.

En production : sauvegarde déclenchée juste avant, déploiement **après 21 h**
(heure de Dakar), comptage des lignes avant/après, parcours complet. Le site
reste sur l'ancienne version pendant au moins une journée : c'est l'épreuve
réelle de la couche de compatibilité.

### Étape 3 — Application web

Tout le code web en français, la migration du stockage du navigateur (avec ses
tests, dont **« une vente hors ligne en attente survit à la mise à jour »**),
les classes CSS. Vérifications : Vitest, typage, lint, construction, puis
parcours complet dans un vrai navigateur et **comparaison des captures** avec
l'étape 0. En production : même parcours.

### Étape 4 — Finitions

Application mobile (écran de connexion), automatisations GitHub, documentation.

Réalisé : les trois automatisations renommées (section 11) ; l'application
mobile traduite **et rebranchée** — elle appelait `/login`, `/stats/dashboard`
et `/products`, qui n'ont jamais existé dans l'API ; les dossiers du service IA
oubliés par l'inventaire (section 10) ; README, guide de déploiement, état des
lieux, procédure de restauration. Les documents d'avant la francisation
(`AMELIORATIONS`, `ANALYSE_AMELIORATIONS_SECURITE_DESIGN`, `PROMPT_DESIGN`)
gardent leur texte, précédé d'une note qui renvoie ici.

La sauvegarde nocturne change de fichier : après la mise en ligne, on vérifie
que la première nuit tourne bien sous le nouveau nom.

### Étape 5 — Retrait des compatibilités *(quelques semaines plus tard)*

Aux dates du tableau de la section 3. Chaque retrait est un commit isolé.

S'y ajoute l'ancien réglage « 2FA » du panneau d'administration (route
`PATCH /admin/parametres/double-facteur`, colonne
`parametres_admin.double_facteur_actif`) : il ne protégeait rien et a été
remplacé le 30/09/2026 par la vraie vérification en deux étapes du compte.
Il ne reste que pour l'ancienne version du site.

### Action manuelle requise

Aucune : les secrets gardent leur nom (décision du 29/09/2026).

### Avancement

| Étape | État |
|---|---|
| 0 — Empreintes de l'existant | faite le 29/09 |
| 1 — Service IA | en production le 29/09 |
| 2 — API et base de données | en production le 29/09 (21h01 UTC), vérifiée |
| 3 — Site web | en production le 30/09 (21h15 UTC), vérifiée : un téléphone resté sur l'ancienne version garde sa session, et ses ventes hors ligne sont reprises et envoyées |
| 4 — Finitions | prête ; mise en ligne après l'étape 3 |
| 5 — Retrait des compatibilités | après 14 jours sans aucun appel à l'ancien contrat |
