# SamaCommerce — état des lieux

*Dernière mise à jour : 30 septembre 2026.*

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
| Tests | PHPUnit 90/90 · Vitest 145/145 · pytest 9/9 |
| Code en français | API, base de données et IA depuis le 29/09/2026 ; site depuis le 30/09/2026 ; finitions : voir [`GLOSSAIRE_NOMMAGE.md`](GLOSSAIRE_NOMMAGE.md), section 12 |

---

## 3. Ce qui reste à faire

### 3.1 — Domaine e-mail *(bloquant dès le 5ᵉ utilisateur)*

Tant qu'aucun domaine n'est vérifié chez Resend, **seule l'adresse du
propriétaire reçoit les codes de réinitialisation**. Les autres commerçants
doivent appeler pour récupérer leur compte.

Marche à suivre : acquérir un nom de domaine → Resend → **Domains** → ajouter les
trois enregistrements DNS chez le registraire. Environ une heure.

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
envoi = un changement) sur la branche `corrections-anterieures` — **pas encore
en ligne** :

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

---

## 4. Dette technique connue

**Quatre écrans téléchargent tout l'historique des ventes** — Crédits,
Inventaire, Chiffres, Retours. L'accueil a été corrigé (35 897 → 55 octets par
navigation) mais pas ceux-là. Indolore aujourd'hui ; à 20 ventes/jour, l'écran
Chiffres coûtera plus d'un mégaoctet dans six mois.

**Le compte de démonstration est partagé.** Tous les visiteurs voient les
modifications des autres et peuvent supprimer des produits. Une remise à zéro
périodique serait souhaitable.

**`CloisonnementBoutique` (ex-`BoutiqueScope`) et les runtimes persistants.** Le cloisonnement par boutique
s'enregistre par requête, dans un processus PHP qui meurt avec la réponse.
Passer à **Octane, Swoole ou FrankenPHP** ferait fuir ce cloisonnement d'une
requête à l'autre : un commerçant hériterait de la boutique du précédent. À
traiter impérativement avant tout changement de runtime.

**Le plan gratuit Render.** Les services s'endorment après 15 minutes ; le réveil
prend 30 à 50 secondes. Un plan payant (~7 $/mois) supprimerait le problème et
permettrait de garder l'IA éveillée.

---

## 5. Exploitation au quotidien

### Tâches automatiques (GitHub Actions)

| Tâche (fichier) | Rythme | Rôle |
|---|---|---|
| **Sauvegarde base** (`sauvegarde-base.yml`) | Chaque nuit, 02h17 UTC | Export chiffré, contrôlé, conservé 90 jours |
| **Garder l'API éveillée** (`garder-api-eveillee.yml`) | Toutes les 10 min, 7h–21h | Évite l'attente de 30-50 s |
| **Intégration continue** (`integration-continue.yml`) | À chaque envoi sur `main` | Tests API + site + IA, analyse du code, construction |

Jusqu'au 30/09/2026, ces fichiers s'appelaient `backup.yml`, `keepalive.yml` et
`ci.yml` : GitHub range leurs anciennes exécutions sous ces noms.

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

**Tout client de l'API envoie l'en-tête `X-Contrat-Api: fr`.** Certaines
adresses sont communes à l'ancien contrat (anglais) et au nouveau ; sans cet
en-tête, elles répondent dans l'ancien format, conservé pour les téléphones pas
encore mis à jour.

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
