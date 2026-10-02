---
version: 1
slug: "apps-web-src-sections-monplan-tsx"
primary_target: "apps/web/src/sections/MonPlan.tsx"
related_targets: []
---

# Mon plan (côté commerçant)

Portée : écran « Mon plan » de l'application commerçant — état de l'abonnement, choix d'un plan, paiement en trois étapes (payer, déclarer, vérification), et la feuille qui s'ouvre quand une limite du plan est atteinte. Mode : Persuade pour le choix du plan, Operate pour le paiement. Utilisateur : le propriétaire de la boutique, sur téléphone, aisance variable à l'écrit.

Contraintes : identité SamaCommerce de l'application (theme.css, classes existantes), phrases courtes, montants en très grand, aucune promesse de délai de vérification, numéros de paiement lus dans les réglages (jamais écrits en dur), rien ne s'active avant la validation.

## Direction contract

THESIS: Choisir un plan comme on choisit au marché : on voit le prix, ce qu'on gagne, et la garantie qu'on ne perd rien. Refuse la grille de prix à trois colonnes copiée des logiciels d'ailleurs.

OWN-WORLD: Surfaces en couleur de l'application : carte Pro violette #7C3AED pleine, cartes blanches bordées #E7E2F7, bandeau d'encre #1E1B4B pour l'état, Sora pour les prix, DM Sans pour le texte, coches au trait, bascule mois/année.

STORY: Le commerçant comprend où il en est (essai, échéance), choisit, paie avec son téléphone, recopie la référence du SMS, et sait que la vérification suit.

FIRST VIEWPORT: En-tête de l'application, bandeau d'état (essai ou échéance), bascule « Par mois / Par an · 2 mois offerts », puis la carte Pro pleine avec son prix et son bouton.

FORM: Maquettes validées dans Claude Design le 1er octobre 2026 (écrans « Choisir son plan » et « Payer et faire vérifier ») ; pas de tirage. Interaction signature : la copie du numéro de paiement en un geste, et l'erreur de référence dite à côté du champ.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
