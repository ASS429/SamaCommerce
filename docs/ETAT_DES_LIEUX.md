# SamaCommerce — état des lieux

*Dernière mise à jour : 28 août 2026.*

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
| IA | Modèles entraînés servis (`method: "model"`) |
| Tests | PHPUnit 82/82 · Vitest 115/115 |

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

`apps/mobile` s'arrête à un écran de connexion. C'est la seule phase du projet
initial jamais menée à bout.

**À arbitrer honnêtement** : le web est déjà une PWA installable qui fonctionne
hors ligne. Pour un commerçant, la différence sera mince. La vraie raison de le
faire est **académique** — si le sujet de mémoire annonce une application native,
il faut la livrer.

---

## 4. Dette technique connue

**Quatre écrans téléchargent tout l'historique des ventes** — Crédits,
Inventaire, Chiffres, Retours. L'accueil a été corrigé (35 897 → 55 octets par
navigation) mais pas ceux-là. Indolore aujourd'hui ; à 20 ventes/jour, l'écran
Chiffres coûtera plus d'un mégaoctet dans six mois.

**Le compte de démonstration est partagé.** Tous les visiteurs voient les
modifications des autres et peuvent supprimer des produits. Une remise à zéro
périodique serait souhaitable.

**`BoutiqueScope` et les runtimes persistants.** Le cloisonnement par boutique
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

| Tâche | Rythme | Rôle |
|---|---|---|
| **Sauvegarde base** | Chaque nuit, 02h17 UTC | Dump chiffré, conservé 90 jours |
| **Garder l'API éveillée** | Toutes les 10 min, 7h–21h | Évite l'attente de 30-50 s |
| **CI** | À chaque push | Tests API + web, lint, build |

### Variables à connaître

Sur **Render** (service API) : `ADMIN_PASSWORD`, `RESEND_API_KEY`,
`IA_SERVICE_URL`, `SANCTUM_EXPIRATION` (30 jours), `SENTRY_LARAVEL_DSN` (vide).

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
sinon c'est la version 16 qui répond et le dump échoue.

**Render inscrit le NOM d'un service lié**, pas son adresse. `IA_SERVICE_URL`
contenait `samacommerce-ia` au lieu de `https://samacommerce-ia.onrender.com`.

**`/api/health` sert de sonde de diagnostic.** La latence dit tout :
**0 ms** = aucun appel tenté (URL vide) · **~2 ms** = échec DNS (adresse
invalide) · **~40 ms** = tout va bien.

**Le hash du bundle web diffère toujours du build local**, car `VITE_API_URL` est
injecté à la compilation sur Render. Pour vérifier un déploiement, comparer le
**CSS** ou chercher une chaîne du nouveau code.

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
