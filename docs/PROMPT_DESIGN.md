# Prompt prêt à coller — Refonte du design SamaCommerce (Claude / Claude Design)

> Colle ce prompt dans Claude (mode design / artifacts). Il contient l'extraction
> complète du design system actuel + la mission de refonte.

---

Tu es un designer produit senior spécialisé en **mobile-first** et **PWA**. Tu vas **retravailler et élever le design** de **SamaCommerce**, une application de gestion commerciale pour les **petits commerçants du Sénégal** (boutiquiers, alimentations, secteur informel). Beaucoup d'utilisateurs sont peu habitués au numérique : l'app doit rester **ultra simple, chaleureuse, lisible en plein soleil, utilisable d'une main**, en **français** (et Wolof/Anglais), montants en **FCFA**.

## Contraintes
- **Mobile-first absolu** (cible : téléphones Android d'entrée de gamme), puis responsive jusqu'au desktop.
- **PWA installable** + mode hors-ligne + **mode sombre**.
- Garde l'**identité** mais rends-la plus **moderne, premium et délicieuse** (micro-interactions, profondeur, douceur).
- Accessibilité : cibles ≥ 44px, contrastes AA, focus visibles.

## Design system ACTUEL (à conserver comme base et à sublimer)

### Couleurs (tokens CSS)
```
--primary: #7C3AED ;  --primary-dark: #5B21B6 ;  --primary-light: #A78BFA
--accent (rose): #EC4899
--green: #10B981 ; --blue: #3B82F6 ; --orange: #F59E0B ; --teal: #14B8A6 ; --red: #EF4444
--surface: #FFFFFF ; --bg: #F5F3FF ; --text: #1E1B4B ; --muted: #6B7280
Mode sombre : surface #1E1B2E, bg #13111F, text #F1F0FF (mêmes accents éclaircis)
```

### Typographie
- **Sora** (700–800) pour les titres, chiffres, libellés forts.
- **DM Sans** (400–600) pour le corps de texte.

### Layout
- Conteneur **app-container** centré, **max-width 480px**, fond blanc.
- **En-tête** en dégradé `135deg` (violet foncé → violet → rose) avec **2 cercles décoratifs** translucides ; titre + sous-titre + icône 💰.
- **Carte de stats flottantes** (`today-float`) qui **chevauche** le bas du header (marge négative), 3 tuiles (Encaissé vert / Vendus bleu / Stock orange).
- **Zone scrollable** puis **barre de navigation basse** (5 emplacements, de gauche à droite) : **🏠 Accueil**, **📈 Chiffres**, **💳 Vendre au centre (FAB proéminent surélevé)**, **👤 Profil**, **＋ Plus tout à DROITE** (ouvre le menu de toutes les fonctions).

### Composants clés (à redessiner en mieux)
- **Boutons d'action** (accueil) : grandes tuiles dégradées (vert/bleu/violet/orange/teal/rose), grosse emoji + libellé Sora + sous-titre.
- **Cartes** : rayon 18px, ombre douce teintée violet.
- **Carte produit** : bordure gauche colorée selon le stock (ok vert / faible orange / rupture rouge), pastille de stock, contrôles **− / +**, boutons modifier/supprimer.
- **Carte catégorie** : dégradé plein, emoji, compteur produits.
- **Barre TOTAL** (dégradé lavande→rose) + bouton **ENCAISSER** (dégradé vert).
- **Boutons de paiement** (Espèces vert, Wave bleu, Orange orange, Crédit violet).
- **Modales** : rayon 22px, animation scale-in douce, overlay flouté.
- **Champs** : fond gris très clair, focus = anneau violet.
- **Chips** de filtre, **tuiles de stats** (2×2), **table d'historique**, **états vides** (emoji + texte + CTA), **skeletons** shimmer, **splash screen** dégradé.

### ⚠️ Écrans à livrer — UNE MAQUETTE PAR PAGE (ne saute aucune)
Livre une **maquette dédiée pour CHAQUE écran ci-dessous**, en version mobile, cohérente, **avec sa variante mode sombre**. C'est exhaustif : chaque fonctionnalité, chaque page du menu “+”, et tout le dashboard admin.

**A. Authentification (2)**
1. Connexion
2. Inscription

**B. Coquille / navigation (3)**
3. En-tête + carte de stats flottantes (le « chrome » commun)
4. **Barre de navigation basse** : 🏠 Accueil · 📈 Chiffres · 💳 Vendre (FAB central) · 👤 Profil · **＋ à DROITE**
5. **Menu “+” (bottom sheet)** listant TOUTES les fonctions

**C. Écrans principaux (6)**
6. Accueil (header, stats flottantes, 6 grands boutons d'action, alertes stock, guide de bienvenue)
7. Vendre (panier, barre TOTAL collante, grille de produits, recherche + scan)
8. Stock (cartes produit avec bordure de statut, recherche + scan code-barres, ± stock)
9. Catégories (grille de cartes colorées + palette emoji)
10. Chiffres (tuiles résumé, graphiques ligne/barre/donut, export)
11. Inventaire (tuiles stats + tableau bénéfices/marges, export Excel)

**D. Pages du menu “+” (10) — une maquette chacune**
12. Crédits (3 tuiles, formulaire nouvelle vente à crédit, historique, action rembourser)
13. Clients (liste + badges achats/dette, fiche client, formulaire)
14. Fournisseurs (liste, fiche, bouton relance réappro WhatsApp)
15. Commandes (réappro fournisseur : liste, création multi-lignes, réception → +stock)
16. Livraisons (suivi de statut en_attente → en_cours → livrée)
17. Caisse (clôture de journée : tuiles espèces/wave/orange/crédits, net, graphique 7 jours, historique)
18. Retours (tuiles stats, historique, formulaire de retour + remboursement)
19. Boutiques (multi-boutique : cartes avec compteurs, boutique active, switch, création)
20. Équipe (membres : statut, **permissions affichées en badges cliquables**, invitation par code)
21. Paramètres / Profil (nom boutique + téléphone, mode sombre, abonnement, déconnexion)

**E. Modales clés (à dessiner aussi)**
22. Modale de paiement (Espèces/Wave/Orange/Crédit)
23. Modale vente à crédit (client, téléphone, échéance)
24. Modale produit (ajout/édition + champ code-barres + scan)
25. Modale scanner code-barres (vue caméra)
26. Modale « Rejoindre une boutique » (code d'invitation)
27. Reçu imprimable / reçu WhatsApp

**F. Dashboard ADMIN (layout desktop : sidebar gauche + contenu) — une maquette par section (6)**
28. Tableau de bord admin (4 cartes KPI : utilisateurs, abonnés actifs, revenus, en attente + graphique d'évolution des revenus)
29. Abonnés (cartes utilisateurs : statut, plan, actions approuver/rejeter/bloquer/supprimer)
30. Revenus (cartes solde/période/attente + retrait + transactions récentes)
31. Mes Comptes (cartes Orange Money / Wave / Espèces + résumé entrées/sorties/net + transfert)
32. Analyses (KPI conversion/rétention + graphiques)
33. Paramètres admin (généraux, paiement, notifications, sécurité + 2FA)

> Au total : ~33 maquettes. Procède par lots et **n'oublie aucune page** — surtout celles du menu “+” et tout le dashboard admin.

## Livrables attendus
- Une **palette + tokens** affinés (clair + sombre).
- Une **bibliothèque de composants** revisités (boutons, cartes, champs, modales, nav, FAB, chips, tuiles, états vides, skeletons).
- Les **écrans ci-dessus** au nouveau look, cohérents, mobile-first et responsive.
- Des **micro-interactions** (appui, transition d'écran, succès de vente, pull-to-refresh).
- Tout en **français**, **FCFA**, contexte **sénégalais** (riz, huile, sucre…), emojis tolérées pour les catégories.

Commence par proposer **la palette + 3 composants clés (bouton d'action, carte produit, barre de nav + FAB)**, puis **l'écran d'accueil**, puis **l'écran de vente**.
