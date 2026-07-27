---
marp: true
paginate: true
---

<!--
Support d'entretien — VALIDATION du sujet de mémoire MIAGE.
6 slides. Chaque slide a ses "Notes orateur" (ce que tu dis, pas ce que tu projettes).
Astuce : projette peu de texte, parle beaucoup. Vise ~1 min par slide + discussion.
Conversion possible avec Marp (VS Code) ou copier dans PowerPoint.
-->

# SamaCommerce
### Un SI de gestion **et d'aide à la décision** pour le commerce de détail **informel**

Modélisation des pratiques réelles (vente fractionnée · marchandage · crédit)
et **IA** pour le réapprovisionnement et le scoring de crédit

*Mémoire MIAGE — entretien de validation du sujet*

> **Notes orateur :** « Je viens valider un sujet à la croisée gestion / informatique / IA, ancré sur un problème de terrain au Sénégal. En une phrase : **concevoir un SI adapté au commerce informel tel qu'il se pratique, et y intégrer une aide à la décision par l'IA**. » Annonce le fil conducteur : *l'aide à la décision pour le détaillant informel.*

---

## 1 · Le constat : un décalage réel

- Le petit détaillant informel : vend **au fractionnement** (kg, bol, sachet), **marchande** chaque prix, fait **crédit** à la confiance — et gère **de tête**.
- Les logiciels de caisse / ERP supposent **l'inverse** : prix **fixes**, vente **à l'unité**, paiement **comptant**.
- → Le secteur **majoritaire** en Afrique de l'Ouest est **sous-modélisé** par les outils et la littérature.

> **Notes orateur :** Pose la **tension** : les outils existants ne collent pas à la réalité informelle. Appuie-toi sur tes **entretiens terrain** (besoin n°1 exprimé = l'inventaire). C'est le point de départ d'une vraie problématique, pas d'un simple projet.

---

## 2 · Problématique & questions de recherche

**Question centrale**
> Comment concevoir un SI qui **gère** le commerce informel *tel qu'il se pratique* **et** qui **aide à décider** (réappro, crédit), malgré la **rareté des données** ?

**Sous-questions**
1. **Modéliser** fractionnement & marchandage dans un SI ?
2. **Prévoir** la demande → réapprovisionner (IA – A) ?
3. **Scorer** le risque de crédit (IA – B) ?
4. **Fonctionner sans données** au départ + rester **utilisable** (peu alphabétisés) ?

> **Notes orateur :** Une bonne problématique = **une tension + une question ouverte**. La question ouverte ici : *l'IA peut-elle aider malgré peu de données ?* Insiste : ce n'est pas « je code une appli », c'est « je réponds à ces 4 questions ».

---

## 3 · Les contributions (problème → apport)

| Axe | Apport |
|---|---|
| **Fractionnement** | Modèle *unité de base entière + conditionnements de gros*, **zéro flottant**, COGS & marge automatiques |
| **Marchandage** | Le **prix devient une donnée** : prix réel vs référence, **remise** tracée, **marge en direct**, **plancher** (employé bloqué via RBAC) |
| **IA – Réappro (A)** | Prévision demande (**Gradient Boosting**) → jours avant rupture + **quantité conseillée** |
| **IA – Crédit (B)** | **Score 0-100** + risque (vert/orange/rouge) + **raisons explicables** |

> **Notes orateur :** Les deux modules IA **fonctionnent dès le 1ᵉʳ jour** (repli heuristique) puis s'améliorent → c'est ta réponse au « vous n'avez pas de données », et c'est **une contribution** (stratégie *cold-start*), pas une faiblesse.

---

## 4 · Pourquoi c'est un sujet **MIAGE** (apport, pas du dev)

- **Gestion** : COGS, **marge réelle** après marchandage, rotation des stocks, recouvrement du crédit.
- **Informatique** : SI **multi-boutique**, **contrôle d'accès par rôles**, architecture en couches, **monnaie en entiers**.
- **IA / décision** : régression + classification **Gradient Boosting**, features interprétables, **repli heuristique** (données rares).
- **Originalité** : réunir, dans **un seul outil au comptoir**, la **modélisation fidèle de l'informel** + une **aide à la décision par l'IA** pensée pour le *cold-start*.

> **Notes orateur :** LA question du prof : « mémoire ou développement ? ». Réponse : « Le code est l'**instrument** ; la contribution est un **modèle de SI** + une **évaluation** de l'apport de l'IA. C'est de l'**informatique de gestion appliquée**. »

---

## 5 · Méthodologie & faisabilité

- **Cadre : Design Science Research (Hevner)** — concevoir un **artefact** pour un **problème réel**, avec **rigueur** (évaluation) + **pertinence** (terrain).
- **Démarche** : terrain (entretiens ✔) → modélisation → **prototype (✔)** → **évaluation**.
- **Évaluation** : **MAE** (demande), **AUC / rappel** (crédit), **76 endpoints testés**, retour utilisateur prévu.
- **Faisabilité prouvée** : prototype **React + Laravel + FastAPI/scikit-learn** opérationnel.
- **Données** : **synthétiques** (amorçage) + **réelles auto-générées** par l'usage + **terrain**.

> **Notes orateur :** Nommer **DSR** rassure : ça **légitime « construire un SI » comme une recherche**. Le prototype **désamorce** « trop ambitieux » : la faisabilité est acquise, le mémoire en fait l'**étude et l'évaluation**.

---

## 6 · Périmètre, plan & perspectives

**Inclus** : gestion (stock fractionné, ventes, marchandage, crédit, marges) · multi-boutique + rôles · **2 modules IA**.
**Exclus (assumés)** : e-commerce · paiement réel (Wave/OM) · mobile natif = *extension*.

**Plan de mémoire** : Problématique → État de l'art → Terrain → Modélisation/Conception → Modules IA (données, modèles, évaluation) → Réalisation/validation → Discussion → Perspectives.

**Perspectives** : déploiement terrain · ré-entraînement sur données réelles · paiement mobile · application native.

> **Notes orateur :** Conclus sur le **cadrage maîtrisé** (« je préfère profond et cadré que large et superficiel ») et ouvre sur la discussion. Phrase de clôture : *« Les outils existants modélisent le commerce formel ; mon mémoire modélise et outille le commerce informel tel qu'il se pratique réellement. »*
