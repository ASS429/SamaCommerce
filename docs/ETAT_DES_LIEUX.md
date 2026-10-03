# SamaCommerce — état des lieux

*Dernière mise à jour : 3 octobre 2026.*

Ce document dit **où en est la plateforme**, **ce qui reste à faire** et **comment
l'exploiter au quotidien**. Il est fait pour être relu dans trois mois, quand le
détail des décisions se sera effacé.

---

## 1. Où tourne la plateforme

| Élément | Adresse |
|---|---|
| Application web (PWA) | https://samacommerce-web.onrender.com |
| API | https://samacommerce-api.onrender.com |
| Micro-service IA | https://samacommerce-ia.onrender.com |
| Base de données | Supabase (PostgreSQL, pooler `eu-west-1`) |
| Code source | https://github.com/ASS429/SamaCommerce (**public**) |

Hébergement **Render, plan gratuit** — c'est la contrainte qui explique la
plupart des choix d'exploitation ci-dessous.

---

## 2. État vérifié en production

| Contrôle | Résultat |
|---|---|
| Base de données | Répond en ~195 ms |
| Cloisonnement des données | Vérifié : chaque commerçant ne voit que sa boutique |
| Inscription | Ouverte, boutique créée automatiquement |
| Politique de mot de passe | Refuse les mots de passe déjà compromis |
| Mot de passe oublié | Envoi réel par e-mail (Resend) |
| Administration | Fermée — les identifiants publics ne fonctionnent plus |
| Sauvegarde | Quotidienne, chiffrée, **restauration testée** |
| IA | Modèles entraînés servis (`methode: "modele"`) |
| Abonnements et administration | En ligne depuis le 02/10/2026 (09h19 UTC) : migration appliquée, 34 contrôles verts en production, parcours « Mon plan » vérifié dans un navigateur (voir 3.6) |
| Dettes techniques soldées | En ligne depuis le 02/10/2026 (14h30 UTC) : 23 contrôles verts en production, parcours dans un navigateur (ordinateur, téléphone, compte de démonstration) sans erreur (voir 3.7) |
| Tests | PHPUnit 135/135 · Vitest 157/157 · pytest 10/10 |
| Code en français | API, base de données et IA depuis le 29/09/2026 ; site depuis le 30/09/2026 ; finitions et retrait des passerelles de transition le 01/10/2026 (détail : [`GLOSSAIRE_NOMMAGE.md`](GLOSSAIRE_NOMMAGE.md), section 12) |

---

## 3. Ce qui reste à faire

### 3.1 — Domaine e-mail *(bloquant dès le 5ᵉ utilisateur)*

Tant qu'aucun domaine n'est vérifié chez Resend, **seule l'adresse du
propriétaire reçoit les codes de réinitialisation**. Les autres commerçants
doivent appeler pour récupérer leur compte.

Marche à suivre : acquérir un nom de domaine → Resend → **Domains** → ajouter les
trois enregistrements DNS chez le registraire. Environ une heure.

*02/10/2026 : toujours aucun nom de domaine. En attendant, les rappels
d'échéance des abonnements et les codes de vérification en deux étapes ne
parviennent qu'à l'adresse du titulaire du compte Resend.*

### 3.2 — Mentions légales *(avant toute ouverture large)*

La plateforme collecte des noms, numéros de téléphone et photos de clients. La
**Commission de Protection des Données Personnelles** encadre ce traitement au
Sénégal. C'est aussi une question qu'un jury de mémoire posera.

### 3.3 — Alertes par e-mail *(30 minutes)*

`SENTRY_LARAVEL_DSN` n'est pas renseigné. Les erreurs sont journalisées, mais
personne n'est prévenu. Un bandeau d'erreur est resté affiché plusieurs jours
sans que rien ne le signale — c'est exactement ce que cette alerte évite.

### 3.4 — Application mobile React Native *(décision à prendre)*

`apps/mobile` s'arrête à la connexion et à un tableau de bord (chiffres du jour,
stock). Jusqu'en septembre 2026, ce prototype appelait des adresses qui n'ont
jamais existé dans l'API : il ne pouvait pas se connecter. Il est désormais
branché sur le vrai contrat. C'est la seule phase du projet initial jamais
menée à bout.

**À arbitrer honnêtement** : le web est déjà une PWA installable qui fonctionne
hors ligne. Pour un commerçant, la différence sera mince. La vraie raison de le
faire est **académique** — si le sujet de mémoire annonce une application native,
il faut la livrer.

### 3.5 — Défauts trouvés pendant la francisation

Antérieurs à la traduction, repérés en la vérifiant, et corrigés à part (un
envoi = un changement), puis **mis en ligne le 01/10/2026 (11h08 UTC) et
vérifiés en production** :

- **Double facteur : le code de connexion n'était jamais envoyé**, et l'option
  s'activait d'un clic. Un compte qui l'activait ne pouvait plus se connecter
  depuis un nouvel appareil. Corrigé : le code part par e-mail, et l'option ne
  s'active qu'après la saisie d'un code reçu. Les activations d'avant la
  correction (aucune n'a jamais fonctionné) sont remises à zéro.
  ⚠️ Tant que le domaine e-mail n'est pas vérifié (3.1), seule l'adresse du
  titulaire du compte Resend reçoit les codes : pour les autres, l'activation
  est refusée avec un message clair — plus personne n'est enfermé dehors.
- **`GET /commandes` ne renvoyait jamais le nom du fournisseur** (`withCount`
  écrasait les colonnes demandées) : « Sans fournisseur » partout. Corrigé.
- **Un employé sans droits « clients » ni « rapports » recevait des refus 403**
  à chaque écran (recherche globale, cloche, accueil). Corrigé.
- **Une vente reçue puis mise à la corbeille, qu'un téléphone renvoyait**
  (accusé de réception perdu), heurtait l'index unique au lieu d'être reconnue
  comme doublon : elle restait « en attente » pour toujours sur ce téléphone,
  et la cause n'était écrite nulle part. Corrigé (trouvé le 30/09 au soir, en
  vérifiant la mise en ligne du site) ; les refus de synchronisation sont
  désormais journalisés.
- **L'interrupteur « Authentification 2FA » du panneau d'administration ne
  protégeait rien** : il enregistrait un réglage que la connexion ne lit
  jamais. Remplacé (décision du 30/09/2026) par la vraie vérification en deux
  étapes du compte. `admin@samacommerce.sn` n'étant pas une vraie boîte, les
  codes de l'administrateur partent à l'adresse `EMAIL_ADMIN`, **à saisir dans
  Render** (jamais dans le dépôt public). L'ancien réglage reste lisible par
  l'ancienne version du site, et disparaît à l'étape 5.
- Au passage : l'e-mail de réinitialisation annonçait un code valable 1 heure
  pour 30 minutes réelles, et « mot de passe oublié » affichait « Code envoyé »
  même quand l'e-mail n'était pas parti. Corrigés.

### 3.6 — Abonnements et panneau d'administration *(en ligne depuis le 02/10/2026)*

Refonte décidée le 01/10/2026, d'après les maquettes validées dans Claude Design :

- **Quatre plans** (Gratuit, Essentiel 2 500 F, Pro 5 000 F, Entreprise sur devis),
  réglables depuis l'administration sans redéployer. Essai Pro de 30 jours à
  l'inscription ; délai de grâce de 7 jours, puis retour au Gratuit **sans perte
  de données** (seuls les ajouts au-delà des limites sont refusés, réponse 402).
- **Paiement manuel vérifié** : le commerçant paie par Wave ou Orange Money puis
  déclare la référence ; rien ne s'active avant la validation de
  l'administrateur, qui doit cocher « J'ai retrouvé ce paiement ». Montant
  attendu calculé par le serveur, référence unique par moyen, reçus `SC-0001`.
- **Panneau d'administration réécrit** (six vues : tableau de bord, paiements à
  vérifier, commerçants, plans et tarifs, finances, paramètres), sur téléphone
  comme sur ordinateur. Au passage : bloquer un compte ferme maintenant ses
  sessions ouvertes (avant : 7 jours d'accès restant), un retrait ou un
  transfert ne peut plus dépasser le solde du compte, la recherche retrouve un
  commerçant par sa référence de paiement, et la liste des appareils connectés
  permet de déconnecter les autres.
- **Migration des comptes** éprouvée sur PostgreSQL 17 le 02/10 : un Premium
  validé et en cours devient une période Pro payée jusqu'à son échéance ; une
  demande jamais validée ou un Premium expiré repasse au Gratuit ; chacun reçoit
  l'essai Pro de 30 jours.

**Mise en ligne du 02/10/2026** : sauvegarde chiffrée lancée à la main juste
avant (réussie), puis fusion dans `main` (903b04e) ; Render a appliqué la
migration au démarrage. Vérifié en production : routes nouvelles présentes et
protégées, anciennes routes retirées, plans et prix servis, compte de
démonstration en essai Pro jusqu'au 1er novembre, déclaration refusée tant
qu'aucun numéro n'est saisi, CORS, site et panneau livrés. Seul le panneau
d'administration lui-même reste à regarder par l'administrateur (il demande
ses identifiants et le code de vérification en deux étapes).
L'adresse de santé renvoie désormais le commit en ligne (`commit`, fourni par
Render) : c'est le repère à vérifier après chaque mise en ligne.

**Fait par l'administrateur le 02/10/2026** : numéros de paiement et nom du
bénéficiaire saisis dans *Paramètres* (ils ne sont **jamais** écrits dans le
code). Les rappels d'échéance par e-mail dépendent du domaine Resend (3.1).

À savoir : les photos de reçu jointes par les commerçants sont stockées en base
(compressées, 150 Ko au plus). Le test de contrat (`ContratFrancaisTest`)
suppose SQLite : sur PostgreSQL, les identifiants diffèrent (séquences non
remises à zéro) ; tout le reste de la suite passe sur PostgreSQL.

---

### 3.7 — Dettes techniques soldées *(en ligne depuis le 02/10/2026)*

Les trois dettes de la section 4 qui touchaient au code sont réglées, avec
d'autres défauts trouvés en chemin :

- **Les quatre écrans qui téléchargeaient tout l'historique des ventes**
  reçoivent désormais du serveur ce qu'ils affichent : Crédits
  (`/ventes?moyen=credit`), Inventaire (`/ventes/quantites-par-produit`),
  Chiffres (`/statistiques/indicateurs`), Retours
  (`/retours/ventes-retournables`, chargé à l'ouverture de la fenêtre). Le
  serveur refait **exactement** les calculs du navigateur, retours compris
  (ventes négatives) : les tests comparent chaque réponse au calcul d'avant.
- **Le compte de démonstration repart à neuf chaque jour** : le premier appel
  de `/api/sante` de la journée (contrôle de santé de Render, ou réveil par
  cron-job.org à 7h) le remet dans son état d'origine, après la réponse, en une
  seule transaction, et ferme ses sessions (40 accumulées le 02/10). Seul ce
  compte est touché ; le verrou du jour est dans le cache en base, il survit
  donc aux redémarrages.
- **Confidentialité** : un visiteur de la démonstration voyait, à l'étape
  « Payer », le vrai numéro Wave et le nom du bénéficiaire, et pouvait déclarer
  de faux paiements dans la file de l'administrateur. Désormais, aucun numéro
  n'est envoyé au compte de démonstration, les boutons de paiement y sont
  désactivés, et une déclaration y est refusée (403).
- **Cloisonnement sûr sous Octane, Swoole ou FrankenPHP** : la boutique active
  et les caches des plans et réglages vivent dans le conteneur de
  l'application, remis à zéro au début de chaque requête
  (`OublierBoutiquePrecedente`). Un test vérifie qu'une boutique ne survit pas
  à la requête suivante.
- **« Quitter » ferme aussi la session sur le serveur** (avant : seulement dans
  le navigateur, le jeton restait valable 7 jours). La liste des appareils
  connectés n'affiche plus les sessions expirées.
- **« Mon plan » sur ordinateur** : offres sur trois colonnes, paiement sur deux
  avec le récapitulatif à droite (maquettes ajoutées au canevas Claude Design,
  version 5). Le téléphone garde sa présentation.
- **Divers** : la case « Abonnement » de l'accueil dit le plan (« Essai Pro ») ;
  l'empreinte CSP du script anti-flash se calcule sur les fins de ligne que lit
  le navigateur (un `index.html` extrait en CRLF sous Windows bloquait le
  script en local) ; les derniers noms anglais arrivés avec les abonnements
  sont traduits (`plan-cta` → `plan-bouton`, `plan-chip` → `plan-pastille`,
  `adm-compte-2fa` → `adm-compte-double-facteur`, `$mrr` → `$revenuMensuel`).

Tests : PHPUnit 134/134, Vitest 157/157 (dont 8 sur l'empreinte CSP).

**Mise en ligne du 02/10/2026** : sauvegarde chiffrée lancée à la main juste
avant (réussie, 206 Ko), puis fusion dans `main` (0ae75d5), en ligne à 14h30
UTC. Vérifié en production : nouvelles adresses protégées et justes, compte de
démonstration sans numéro de paiement et déclaration refusée (403), jeton
inutilisable après « Quitter », remise à zéro de la démonstration faite au
premier contrôle de santé (40 sessions fermées), site et styles traduits
livrés ; puis parcours dans un navigateur sur le site en ligne, sur ordinateur
et sur téléphone, sans erreur.

**Défaut trouvé pendant cette vérification, puis corrigé** : toutes les ventes de
la démonstration étaient datées du jour de la remise à zéro. `cree_le` n'est
pas remplissable, et `Vente::create` l'ignorait sans rien dire (défaut d'origine
de l'amorceur, devenu visible chaque jour avec la remise à zéro). L'amorceur
date désormais ses ventes sur les 30 derniers jours ; effet à la remise à zéro
suivante.

### 3.8 — Assistant vocal en wolof et en français *(prêt, pas encore en ligne)*

Le commerçant **maintient le micro vert, comme pour un vocal WhatsApp**, et
pose sa question en wolof ou en français. L'assistant répond par écrit puis à
voix haute, dans une discussion présentée comme celle de WhatsApp. Il
**consulte** (ventes du jour, stock d'un produit, produits bientôt finis, dette
d'un client) ou **guide** : il ouvre la page où agir et entoure le bouton à
toucher. **Il n'enregistre rien lui-même.**

- **Chaîne** (choisie après les essais du 1er et du 2 octobre, voir le dossier
  de tests `test-vocal`) : oreille Soynade (`oolel-speech-v1`) pour le wolof,
  Gemini pour le français ; cerveau Gemini, qui lit le wolof directement et
  appelle des outils en lecture seule ; voix Oolel-Voices, demandée à part
  pour que la réponse écrite n'attende pas. Les nombres sont écrits en lettres
  avant la voix (« 2 000 » était lu « deux zéro »).
- **Qui l'a** : les abonnés dont le plan inclut la fonctionnalité « Assistant
  vocal » (cochée pour Essentiel, Pro et Entreprise, réglable dans l'écran
  Plans de l'administration) — période payée, offerte ou en délai de grâce ;
  **pas pendant l'essai gratuit**. L'employé profite du plan de son patron et
  ne lit que ce que ses droits lui ouvrent. Le compte de démonstration ne l'a
  jamais. Sans `CLE_API_SOYNADE` et `CLE_API_GEMINI`, personne ne l'a.
- **Garde-fous** : 40 questions par jour et par commerçant ; message de
  30 secondes au plus ; aucun son conservé (la table `questions_assistant`
  garde le texte, les outils appelés et la durée de chaque étape) ; un nom de
  client ou de produit inconnu n'est jamais inventé (l'assistant propose les
  noms proches et demande) ; la langue est demandée au tout premier appui (un
  message wolof écouté « en français » donnait du charabia).
- **Code** : `app/Services/AssistantVocal/`, `ControleurAssistantVocal`
  (`GET /assistant-vocal/etat`, `POST /assistant-vocal/questions`,
  `POST /assistant-vocal/questions/{id}/voix`) ; côté site
  `composants/BoutonVocal.tsx`, `DiscussionAssistant.tsx`, `AssistantVocal.tsx`
  (chargé seulement pour ceux qui y ont droit), `outils/enregistreurVocal.ts`
  (WAV 16 kHz fabriqué dans le navigateur).
- **Tests** : PHPUnit 183/183, Vitest 192/192 ; essais réels avec les clés
  (Soynade transcrit parfaitement l'enregistrement fait par le navigateur) et
  parcours dans un navigateur (téléphone, ordinateur, thème sombre).

**Risques acceptés pour l'instant** (Gemini reste sur l'offre **gratuite** :
Google refuse les cartes prépayées, seules disponibles) :

- le quota gratuit de Google est **partagé par tous les commerçants** et s'est
  épuisé le 02/10 après quelques dizaines d'appels : l'assistant répondra
  alors « ne répond pas pour le moment » ;
- sur l'offre gratuite, Google peut utiliser les questions (noms de clients,
  montants) pour améliorer ses produits : à dire dans les mentions légales
  (voir 3.2) ;
- Soynade reste payant : ≈ 13 à 21 F par question ;
- l'API n'a que 4 processus Apache, et une question en occupe un 5 à 60
  secondes : à surveiller au-delà de quelques utilisateurs simultanés.

**À valider** : trois phrases en wolof écrites sans locuteur natif
(« Dégguma bu baax. Mën nga ko waxaat ? », « Bësal fii », « Tey ñaata laa
jaay ? »).

---

## 4. Dette technique connue

**Le plan gratuit Render.** Les services s'endorment après 15 minutes ; le réveil
prend 30 à 50 secondes. Un plan payant (~7 $/mois) supprimerait le problème et
permettrait de garder l'IA éveillée.

---

## 5. Exploitation au quotidien

### Tâches automatiques (GitHub Actions)

| Tâche (fichier) | Rythme | Rôle |
|---|---|---|
| **Sauvegarde base** (`sauvegarde-base.yml`) | Chaque nuit, 02h17 UTC | Export chiffré, contrôlé, conservé 90 jours |
| **Intégration continue** (`integration-continue.yml`) | À chaque envoi sur `main` | Tests API + site + IA, analyse du code, construction |

Jusqu'au 30/09/2026, ces fichiers s'appelaient `backup.yml`, `keepalive.yml` et
`ci.yml` : GitHub range leurs anciennes exécutions sous ces noms.

**Réveil de l'API : sur cron-job.org depuis le 01/10/2026** (toutes les 10 min,
de 7h à 21h, heure de Dakar ; réglages dans `DEPLOIEMENT.md`, section 7). La
tâche GitHub qui le faisait (`garder-api-eveillee.yml`) ne tournait que 2 à 4
fois par jour au lieu de 84 : GitHub retarde ou saute les planifications
fréquentes. Elle a été retirée.

### Variables à connaître

Sur **Render** (service API) : `ADMIN_PASSWORD`, `RESEND_API_KEY`,
`URL_SERVICE_IA`, `SANCTUM_EXPIRATION` (30 jours), `SENTRY_LARAVEL_DSN` (vide).

Sur **GitHub** (secrets) : `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE`.

> ⚠️ **`BACKUP_PASSPHRASE` doit être conservée ailleurs que sur GitHub.** Sans
> elle, aucune sauvegarde n'est récupérable — y compris par vous.

### Restaurer la base

Procédure complète dans [`RESTAURATION_BASE.md`](RESTAURATION_BASE.md).
À tester **une fois par trimestre** : une sauvegarde jamais restaurée n'est pas
une sauvegarde.

---

## 6. Pièges d'exploitation à ne pas réapprendre

**Render bloque les ports SMTP sortants** (25, 465, 587). Une configuration SMTP
parfaitement correcte échoue en production alors qu'elle marche en local. D'où
l'usage de l'**API HTTP** de Resend, sur le port 443.

**`pg_dump` d'Ubuntu est un aiguilleur.** Installer `postgresql-client-17` ne
suffit pas : il faut appeler `/usr/lib/postgresql/17/bin/pg_dump` explicitement,
sinon c'est la version 16 qui répond et l'export échoue.

**Render inscrit le NOM d'un service lié**, pas son adresse. `URL_SERVICE_IA`
contenait `samacommerce-ia` au lieu de `https://samacommerce-ia.onrender.com`.

**`/api/sante` sert de sonde de diagnostic.** La latence dit tout :
**0 ms** = aucun appel tenté (URL vide) · **~2 ms** = échec DNS (adresse
invalide) · **~40 ms** = tout va bien.

**L'empreinte du paquet JavaScript du site diffère toujours de la construction
locale**, car `VITE_URL_API` est injectée à la construction sur Render. Pour
vérifier un déploiement, comparer le **CSS** ou chercher une chaîne du nouveau code.

**Deux fichiers du site ne se renomment jamais** : `sw.js` et
`manifest.webmanifest`. Un téléphone qui a installé l'application interroge
`/sw.js` pour se mettre à jour ; renommé, ce fichier répondrait 404 et le
téléphone resterait bloqué sur l'ancienne version.

**Un nom de classe enregistré en base ne se renomme pas sans migration.**
Les jetons de connexion gardent le nom de classe de leur propriétaire : en
retirant l'alias `App\Models\User`, une session ouverte avant aurait fini en
erreur 500 à chaque appel (pas en simple déconnexion). Une migration a réécrit
les jetons au nom français dans le même envoi.

**On ne change jamais le chemin de santé dans le déploiement qui le crée.**
Le réglage de Render peut s'appliquer au conteneur encore en service, qui ne
connaît pas la nouvelle adresse : il serait jugé en panne. `/api/sante` a donc
été créé par un envoi, et n'est devenu le chemin de santé qu'à l'envoi suivant.

---

## 7. Leçons de méthode

Trois fausses pistes ont été suivies avant de trouver le vrai défaut d'un
bandeau d'erreur affiché en permanence : la politique de sécurité du navigateur,
puis le poids des photos, puis la mise en veille de l'hébergeur. La capture
d'écran de l'utilisateur a tranché en une seconde.

1. **Demander une capture tôt.** Elle a résolu ce que quatre séries de tests
   n'avaient pas résolu.
2. **« Erreur affichée » n'est pas « requête en échec ».** Si les données sont
   visibles, le défaut est dans l'affichage, pas dans le réseau.
3. **Devant une lenteur, mesurer le TEMPS de réponse**, pas seulement le code de
   statut.
4. **Un état vide ne doit jamais mentir.** « Aucun produit » face à une base
   injoignable a fait croire à une perte de données. Chaque écran distingue
   désormais « c'est vide » de « je n'ai pas pu lire ».
