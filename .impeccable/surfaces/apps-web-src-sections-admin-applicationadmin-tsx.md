---
version: 1
slug: "apps-web-src-sections-admin-applicationadmin-tsx"
primary_target: "apps/web/src/sections/admin/ApplicationAdmin.tsx"
related_targets: ["apps/web/src/sections/admin"]
---

# Panneau d'administration

Portée : application d'administration (tableau de bord, paiements à vérifier, commerçants, plans et tarifs, finances, paramètres). Mode : Operate. Utilisateur : l'administrateur seul, autant sur téléphone que sur ordinateur. Tâche dominante : vérifier un paiement déclaré contre l'historique de son compte Wave ou Orange Money, puis valider ou refuser.

Contraintes : identité SamaCommerce (theme.css), CSP stricte, mode sombre du poste, cibles 44 px, chiffres tabulaires, données réelles de l'API uniquement (aucun chiffre d'exemple à l'écran).

## Direction contract

THESIS: Le panneau sert une décision par minute — « ce paiement est-il réel ? ». Il refuse le tableau de bord vitrine aux cartes grises : la file de vérification et ses contrôles automatiques sont le cœur, tout le reste l'entoure.

OWN-WORLD: Colonne d'encre #1E1B4B, violet #7C3AED réservé à l'action et à la sélection, fond lilas #F5F3FF, cartes blanches bordées #E7E2F7, Sora pour titres et montants, DM Sans pour le texte, icônes Lucide au trait de 2 px, pastilles d'état toujours doublées d'un mot (vert payé, bleu essai, ambre bientôt, rouge expiré, gris bloqué, violet à vérifier).

STORY: L'administrateur ouvre, voit ce qui attend, compare une déclaration à son historique, coche « retrouvé », valide ; le commerçant est prévenu, le reçu est numéroté.

FIRST VIEWPORT: Ordinateur : colonne de navigation à gauche avec le compteur rose des paiements, titre et recherche, quatre chiffres dont la carte violette « Paiements à vérifier », revenus de six mois et file prioritaire côte à côte. Téléphone : barre du bas, chiffres sur deux colonnes, file prioritaire juste dessous.

FORM: Maquettes validées par l'utilisateur dans Claude Design le 1er octobre 2026 (« Refonte admin et abonnements SamaCommerce ») ; demande précisément spécifiée, donc pas de tirage concept-seed. Interaction signature : la case « J'ai retrouvé ce paiement » qui déverrouille Valider, et l'effet exact de la validation affiché avant le clic.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
