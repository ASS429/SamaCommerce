---
name: SamaCommerce
description: Gestion commerciale pour le commerce de quartier, lisible au comptoir, du téléphone à l'ordinateur.
colors:
  violet-marche: "#7C3AED"
  violet-profond: "#5B21B6"
  violet-clair: "#A78BFA"
  rose-bissap: "#EC4899"
  rose-compteur: "#BE185D"
  encre-de-nuit: "#1E1B4B"
  fond-lilas: "#F5F3FF"
  surface: "#FFFFFF"
  teinte-violette: "#F3EFFE"
  trait-lavande: "#E7E2F7"
  trait-doux: "#ECE7FB"
  gris-attenue: "#6B7280"
  libelle-violet: "#6B5BB8"
  vert-paye: "#10B981"
  vert-paye-texte: "#047857"
  ambre-bientot: "#F59E0B"
  ambre-bientot-texte: "#B45309"
  rouge-expire: "#EF4444"
  rouge-expire-texte: "#B91C1C"
  bleu-essai: "#3B82F6"
  bleu-essai-texte: "#1D4ED8"
typography:
  display:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.3px"
  title:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "DM Sans, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.3
  montant:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "tnum"
rounded:
  pastille: "8px"
  controle: "12px"
  bouton-commercant: "13px"
  carte: "18px"
  volet: "20px"
  pilule: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  bouton-principal:
    backgroundColor: "{colors.violet-marche}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.controle}"
    padding: "0 16px"
    height: "44px"
  bouton-principal-survol:
    backgroundColor: "{colors.violet-profond}"
  bouton-contour:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.encre-de-nuit}"
    rounded: "{rounded.controle}"
    padding: "0 16px"
    height: "44px"
  bouton-doux:
    backgroundColor: "{colors.teinte-violette}"
    textColor: "{colors.violet-profond}"
    rounded: "{rounded.controle}"
    padding: "0 16px"
    height: "44px"
  carte:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.carte}"
    padding: "22px"
  champ:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.encre-de-nuit}"
    rounded: "{rounded.controle}"
    padding: "0 12px"
    height: "44px"
  pastille-essai:
    backgroundColor: "#DBEAFE"
    textColor: "{colors.bleu-essai-texte}"
    rounded: "{rounded.pastille}"
    padding: "3px 9px"
  colonne-admin:
    backgroundColor: "{colors.encre-de-nuit}"
    textColor: "#D9D4F5"
    width: "264px"
  carte-action:
    backgroundColor: "{colors.violet-marche}"
    textColor: "{colors.surface}"
    rounded: "{rounded.carte}"
    padding: "20px"
---

# Design System: SamaCommerce

## Overview

**Creative North Star: « Le comptoir lisible »**

SamaCommerce remplace le cahier du boutiquier. Tout le système se juge à une seule question : un commerçant, au comptoir, entre deux clients, sur un téléphone de n'importe quelle gamme, comprend-il l'écran d'un coup d'œil ? D'où des chiffres grands et en Sora, des phrases courtes, des pictogrammes, et des surfaces franches plutôt que des nuances.

Le monde est violet et encre sur un fond lilas : un violet de marque (#7C3AED) pour ce qui se fait (agir, choisir, valider), une encre profonde (#1E1B4B) pour ce qui se lit et pour les zones d'autorité (colonne de l'administration, bloc « plan actuel », total des finances), des cartes blanches à bord lavande pour tout le reste. La couleur porte un sens, jamais une décoration : vert payé, bleu essai, ambre bientôt, rouge expiré, gris bloqué, violet à vérifier, chaque fois doublés d'un mot.

Deux registres partagent ce monde. Les écrans du commerçant sont généreux, colorés par grandes surfaces (lot « surfaces en couleur ») et pensés téléphone d'abord avec une disposition bureau. Le panneau d'administration est un outil de travail : plus dense, une colonne d'encre, une décision par minute (« ce paiement est-il réel ? »). Le mode sombre est un vrai second thème, pas une inversion.

**Key Characteristics:**
- Violet pour l'action et la sélection, encre pour l'autorité, lilas pour le fond.
- Montants et titres en Sora, texte en DM Sans, chiffres alignés (tabular).
- Chaque état coloré est aussi écrit.
- Cibles tactiles de 44 px au moins, sur téléphone comme sur ordinateur.
- Mouvement court et utile : réponse au toucher, entrée des volets, pousse des barres.

## Colors

Une palette froide et nette : un violet franc, une encre bleu-nuit, un rose réservé aux compteurs, et cinq couleurs d'état qui ne servent qu'à dire un état.

### Primary
- **Violet du marché** (violet-marche) : boutons principaux, élément de navigation actif, ligne sélectionnée, carte « à faire maintenant » (paiements à vérifier), plan recommandé. C'est la couleur de l'action.
- **Violet profond** (violet-profond) : survol et appui du violet, texte posé sur une teinte violette.
- **Violet clair** (violet-clair) : anneau de focus, barres secondaires des graphiques.

### Secondary
- **Rose bissap** (rose-bissap) : l'accent de marque, rare. Dans l'administration, sa version foncée **rose compteur** (rose-compteur) porte les compteurs blancs (nombre de paiements à vérifier) avec un contraste suffisant.

### Neutral
- **Encre de nuit** (encre-de-nuit) : texte principal ; fond de la colonne d'administration, du bloc « plan actuel », de la carte du total et de la barre « modifications non enregistrées ».
- **Fond lilas** (fond-lilas) : fond de page de toute l'application.
- **Surface** (surface) : cartes, champs, volets.
- **Teinte violette** (teinte-violette) : boutons doux, pastilles violettes, sélection d'une ligne.
- **Trait lavande** (trait-lavande) et **trait doux** (trait-doux) : bords des cartes et séparateurs.
- **Gris atténué** (gris-attenue) et **libellé violet** (libelle-violet) : texte secondaire, libellés de section du commerçant.

### États (toujours avec un mot)
- **Vert payé** / texte (vert-paye, vert-paye-texte) : payé, actif, réussi.
- **Bleu essai** / texte (bleu-essai, bleu-essai-texte) : essai en cours, information.
- **Ambre bientôt** / texte (ambre-bientot, ambre-bientot-texte) : échéance proche, écart de montant, à surveiller.
- **Rouge expiré** / texte (rouge-expire, rouge-expire-texte) : expiré, refusé, action destructrice.
- **Gris** (gris-attenue) : bloqué, gratuit, inconnu.

### Named Rules
**La règle du violet qui agit.** Le violet plein désigne ce que l'on peut faire ou ce qui est choisi. Un bloc purement informatif n'est jamais violet plein ; il prend la surface, la teinte ou l'encre.

**La règle du mot.** Aucune couleur d'état ne parle seule : la pastille porte toujours un mot (« Payé », « Essai · 30 j », « Expire dans 3 j »), et la couleur ne fait que le renforcer.

**La règle du texte sur teinte.** Sur un fond d'état clair, le texte prend la variante « texte » foncée (vert-paye-texte, ambre-bientot-texte…) : la couleur vive seule n'atteint pas le contraste AA sur sa propre teinte.

## Typography

**Display Font:** Sora (avec system-ui)
**Body Font:** DM Sans (avec system-ui, -apple-system)

**Character:** Sora, géométrique et un peu large, donne aux titres et aux montants une présence de chiffre d'affiche ; DM Sans reste discret et très lisible aux petites tailles des téléphones.

### Hierarchy
- **Display** (700, 30px, 1.15, −0.02em) : titre d'un écran de l'administration.
- **Headline** (800, 20px, 1.2, −0.3px) : titre d'une page du commerçant.
- **Title** (700, 15 à 17px, 1.3) : titre d'une carte ou d'une section.
- **Body** (400, 15px, 1.5) : texte courant ; sous-titres limités à environ 65 caractères par ligne.
- **Label** (700, 12 à 13px) : libellés de champ, pastilles, légendes.
- **Montant** (700, 26 à 30px, chiffres tabulaires) : chiffres clés, soldes, prix ; les montants des listes restent en Sora à 15px.

### Named Rules
**La règle de l'argent en Sora.** Tout montant qui se lit (chiffre clé, solde, prix, montant d'une ligne) est en Sora, chiffres tabulaires, sans retour à la ligne. Le texte autour reste en DM Sans.

## Layout

Téléphone d'abord, bureau ensuite. En dessous de 1024px : une colonne, en-tête collant, barre de navigation en bas (quatre rubriques à portée de pouce, le reste sous « Plus »), marges de 16px. À partir de 1024px : colonne de navigation fixe à gauche (264px dans l'administration) et contenu centré jusqu'à 1180px (880px pour un écran de réglages). Les écrans « liste et détail » mettent le volet de détail à côté de la liste sur ordinateur et en plein écran sur téléphone, le bouton Retour du téléphone le refermant.

Rythme sur une base de 4px : 8 entre éléments liés, 12 à 16 dans une carte, 24 entre blocs d'un écran. Les grilles de cartes s'adaptent seules (`auto-fit` avec un minimum de 160 à 280px) plutôt que de casser à des largeurs fixes. Aucun défilement horizontal sur téléphone, sauf un tableau comparatif volontairement défilable.

## Elevation & Depth

Le système est plat et s'appuie sur des bords fins : une carte se détache par son bord lavande d'un pixel et par le contraste blanc sur lilas. Les ombres sont rares, teintées de violet ou d'encre, jamais noires, et réservées à ce qui doit avancer : le bouton principal du commerçant, la carte « à faire maintenant », les feuilles et barres flottantes.

### Shadow Vocabulary
- **Carte du commerçant** (`box-shadow: 0 6px 16px rgba(124,58,237,.07)`) : cartes des écrans du commerçant.
- **Bouton principal du commerçant** (`box-shadow: 0 6px 16px rgba(124,58,237,.25)`) : le geste principal d'un écran.
- **Carte d'action** (`box-shadow: 0 10px 30px -18px rgba(30,27,75,.35)`) : carte violette « à faire maintenant », plan recommandé.
- **Barre flottante** (`box-shadow: 0 16px 40px -16px rgba(30,27,75,.6)`) : barre « modifications non enregistrées ».

### Named Rules
**La règle du plat par défaut.** Une surface au repos n'a pas d'ombre dans l'administration ; le bord fait le travail. L'ombre signale ce qui flotte ou ce qui réclame l'attention.

## Shapes

Des angles francs mais doux, plus ronds à mesure que le conteneur grandit : 8px pour une pastille, 12px pour un bouton ou un champ (13px sur les boutons du commerçant), 16 à 18px pour une carte, 20px pour un volet de détail, la pilule complète pour les filtres et les compteurs. Les avatars sont des carrés arrondis (12px), pas des cercles. Les bords sont des traits d'un pixel posés à l'intérieur (ombre interne) pour ne pas décaler la mise en page.

## Components

### Buttons
- **Shape :** coins doux (12px), hauteur 44px au moins.
- **Primary :** fond violet du marché, texte blanc en 700 à 14px ; survol violet profond ; à l'appui, `scale(.97)` en 160ms (courbe `cubic-bezier(.23,1,.32,1)`).
- **Contour :** fond surface, trait lavande intérieur, texte encre ; pour les gestes secondaires.
- **Doux :** fond teinte violette, texte violet profond ; pour les gestes fréquents mais non principaux (offrir des jours, ouvrir une file).
- **Danger :** contour rouge clair et texte rouge foncé ; en plein rouge seulement pour confirmer une destruction.
- **Validation :** vert foncé (#065F46) réservé à « Valider et activer le plan », désactivé tant que la case de vérification n'est pas cochée.
- Le survol ne s'applique qu'aux pointeurs fins (`@media (hover: hover) and (pointer: fine)`).

### Chips
- **Pastilles d'état :** coins de 8px, fond clair de l'état, texte foncé de l'état, 12px en 700, toujours un mot.
- **Filtres :** pilules blanches bordées de lavande, compteur en léger retrait ; le filtre actif passe en encre pleine (violet en mode sombre).
- **Segments :** groupe d'onglets dans un cadre blanc ; l'onglet actif en violet plein.

### Cards / Containers
- **Corner Style :** 18px (carte), 20px (volet).
- **Background :** surface ; variante encre pour l'autorité (plan actuel, total) et violet pour l'action.
- **Shadow Strategy :** plat avec trait lavande dans l'administration ; ombre douce teintée chez le commerçant.
- **Border :** trait lavande d'un pixel, intérieur.
- **Internal Padding :** 16px (commerçant), 20 à 24px (administration).

### Inputs / Fields
- **Style :** fond surface, trait intérieur lavande, 12px de rayon, 44px de haut, libellé visible au-dessus en 13px 700, aide en dessous en 13px.
- **Focus :** le trait passe à 2px violet ; l'anneau de focus clavier est violet clair (3px, décalé de 2px).
- **Error / Disabled :** trait rouge 2px avec message sous le champ (rôle alerte) ; désactivé à 45 % d'opacité.

### Navigation
- **Administration, ordinateur :** colonne d'encre, rubriques de 44px, rubrique active en violet plein, compteur rose foncé pour les paiements à vérifier, identité de l'administrateur et état de la vérification en deux étapes en bas.
- **Téléphone :** barre du bas blanche, icône au-dessus du mot, rubrique active en violet ; « Plus » ouvre une feuille montante (260ms, courbe `cubic-bezier(.32,.72,0,1)`).

### File de vérification (composant signature)
La ligne d'un paiement montre le logo officiel du moyen (Wave, Orange Money), le commerce, la formule, le montant déclaré et l'ancienneté ; les écarts s'affichent en pastille. Le volet de détail aligne les champs à comparer, les contrôles automatiques (coche verte, triangle ambre, information bleue), l'effet exact d'une validation, puis la case « J'ai retrouvé ce paiement » qui seule déverrouille le bouton de validation.

## Do's and Don'ts

### Do:
- **Do** réserver le violet plein (#7C3AED) à l'action et à la sélection.
- **Do** écrire l'état en toutes lettres dans chaque pastille colorée.
- **Do** mettre les montants en Sora avec des chiffres tabulaires.
- **Do** garder 44px de cible tactile minimum, sur toutes les tailles d'écran.
- **Do** donner à chaque écran ses états vide, chargement (squelette de la forme finale) et erreur avec « Réessayer ».
- **Do** définir chaque nouvelle couleur pour les deux thèmes (`:root` et `html.sombre`).
- **Do** utiliser les icônes Lucide au trait de 2px dans l'administration.

### Don't:
- **Don't** poser un libellé décoratif au-dessus d'un titre (surtitre) : le titre parle seul.
- **Don't** utiliser le rouge pour autre chose qu'une expiration, un refus ou une destruction.
- **Don't** ouvrir une fenêtre modale pour une tâche simple : formulaire en ligne ou volet ; la modale reste réservée aux confirmations destructrices et aux codes de sécurité.
- **Don't** écrire un numéro de paiement réel dans le code : il se règle dans les paramètres d'administration.
- **Don't** annoncer à l'écran ce qui n'a pas eu lieu (un reçu « envoyé » qui n'est que consultable, un écran vide qui masque une panne).
- **Don't** mettre d'ombre noire : une ombre est teintée de violet ou d'encre.
