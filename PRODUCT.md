# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Commerçants** : boutiquiers et petits commerces de détail, installés principalement au Sénégal, de nationalités diverses. Ils utilisent l'application sur leur téléphone (modèles variés, du bas de gamme au haut de gamme), souvent au comptoir, entre deux clients, avec un réseau parfois irrégulier. Leur aisance à l'écrit est variable : l'interface s'appuie sur des pictogrammes, des chiffres bien visibles et des phrases courtes. Langue : français d'abord, wolof visé.
- **Employés** d'un commerçant : vendeurs ou gérants invités dans une boutique, avec des droits limités choisis par le propriétaire.
- **Administrateur** : le fondateur, seul à gérer la plateforme. Il vérifie les paiements d'abonnement (en les comparant à l'historique de ses comptes Wave et Orange Money), suit les commerçants et les finances, autant sur téléphone que sur ordinateur.

## Product Purpose

SamaCommerce est une application de gestion commerciale pour petits commerçants : vendre, tenir le stock et la caisse, suivre les clients et le carnet de crédit, travailler hors ligne, et recevoir des conseils d'aide à la décision (réapprovisionnement, risque d'une vente à crédit). Elle est aussi l'objet d'un mémoire MIAGE (gestion, informatique et IA dans le contexte sénégalais).

Réussir, c'est qu'un commerçant gère sa journée sans cahier, sache ce qu'il a vendu et ce qu'on lui doit, et que la plateforme vive de ses abonnements.

## Positioning

Pensée pour le commerce de quartier ouest-africain plutôt qu'adaptée d'un logiciel de caisse : vente hors ligne d'abord (synchronisation au retour du réseau), carnet de crédit au cœur de l'outil, ventes au détail fractionnées et prix marchandés, paiements Wave / Orange Money, interface lisible sans être un grand lecteur, conseils d'IA entraînés sur l'activité de la boutique.

## Operating Context

- Application web installable (PWA) sur téléphone et ordinateur ; API Laravel, micro-service IA (FastAPI), base PostgreSQL (Supabase), hébergement Render gratuit (démarrage à froid, pas de tâche planifiée : un réveil externe passe toutes les 10 minutes en journée).
- Abonnements : plan Gratuit et plans payants (Essentiel, Pro, Entreprise sur devis), essai Pro offert à l'inscription. Le commerçant paie par Wave ou Orange Money puis déclare la référence de la transaction ; l'administrateur vérifie et valide. Aucun paiement automatique.
- Relances par WhatsApp (liens wa.me, indicatif 221) et par e-mail (Resend).

## Capabilities and Constraints

- Vente, stock (dont ventes au poids et conditionnements), catégories, caisse et clôture du jour, clients et carnet de crédit, fournisseurs et commandes, livraisons, retours, inventaire, rapports et exports PDF/Excel, équipe et permissions, plusieurs boutiques, journal d'activité, IA de réapprovisionnement et de score de crédit, mode hors ligne.
- Données cloisonnées par commerçant et par boutique. Un commerçant qui repasse au plan Gratuit ne perd rien : seuls les ajouts au-delà des limites sont bloqués, la vente continue.
- Content-Security-Policy stricte en production (pas de script en ligne non haché) ; service worker nommé `sw.js` (ne jamais renommer).
- Code, base de données et interface entièrement en français.
- Envoi d'e-mails aux commerçants limité tant que le domaine n'est pas vérifié chez Resend.

## Brand Commitments

- Nom : SamaCommerce. Identité existante dans `apps/web/src/theme.css` (lot « surfaces en couleur », juillet 2026) : violet de marque, encre profonde, polices Sora (titres) et DM Sans (texte), mode sombre. Le panneau d'administration et les écrans d'abonnement reprennent cette identité (décision de l'utilisateur, octobre 2026).
- Maquettes validées par l'utilisateur le 1er octobre 2026 dans Claude Design : « Refonte admin et abonnements SamaCommerce ».
- Ton : simple, direct, rassurant ; vouvoiement ; jamais de jargon technique côté commerçant.

## Evidence on Hand

- Aucun client payant ni témoignage pour l'instant : l'utilisateur est le seul utilisateur réel (octobre 2026). Ne jamais inventer de chiffres de clientèle, d'avis ou de logos de clients.
- Les numéros de paiement Wave et Orange Money se règlent dans les paramètres d'administration ; ils ne figurent pas dans le code.

## Product Principles

1. Le commerçant garde la main sur ses données : rien n'est supprimé ni pris en otage, quel que soit son plan.
2. Rien ne s'active sur une simple affirmation du navigateur : montants, échéances et plans se décident côté serveur.
3. Lisible d'un coup d'œil, au comptoir : un chiffre, un pictogramme, une phrase courte valent mieux qu'un tableau.
4. Hors ligne d'abord : une vente ne se perd jamais faute de réseau.
5. Dire la vérité à l'écran : un écran vide ne doit jamais masquer une panne, un message ne doit jamais annoncer ce qui n'a pas eu lieu.

## Accessibility & Inclusion

- Contraste WCAG AA, cibles tactiles d'au moins 44 px, texte agrandissable.
- Aisance variable à l'écrit : pictogrammes accompagnés de mots, phrases courtes, chiffres en grand ; wolof visé (assistant vocal à l'étude).
- Respect de `prefers-reduced-motion` et du mode sombre.
