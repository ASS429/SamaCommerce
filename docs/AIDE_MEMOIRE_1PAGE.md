# SamaCommerce — Aide-mémoire entretien (validation du sujet)

**TITRE** — *Conception d'un SI de gestion et d'aide à la décision pour le commerce de détail informel : modélisation des pratiques réelles (vente fractionnée, marchandage, crédit) et ML pour le réapprovisionnement et le scoring de crédit.*
**Fil conducteur :** *l'aide à la décision pour le détaillant informel.*

---

### 🎤 Pitch (45 s)
> « Les petits détaillants informels vendent **au fractionnement** (kg, bol, sachet), **marchandent** chaque prix et font **crédit** à la confiance. Les logiciels de caisse supposent l'inverse : prix fixes, vente à l'unité, pas de crédit. **Mon mémoire conçoit un SI réellement adapté à ces pratiques** et étudie **dans quelle mesure l'IA peut fiabiliser deux décisions critiques — réappro et crédit — malgré la rareté des données.** J'ai déjà un prototype fonctionnel qui prouve la faisabilité. »

### ❓ Problématique (par cœur)
> Comment concevoir un SI qui **gère** le commerce informel tel qu'il se pratique (fractionnement, marchandage, crédit) **et** qui **aide à décider** (réappro, crédit) malgré la **rareté des données** et des utilisateurs peu alphabétisés ?

### 🧩 4 axes (sous-questions)
1. **Modélisation** — fractionnement (unité de base + gros) & marchandage (prix négocié, marge, plancher).
2. **IA Module A** — prévision de la demande → **réapprovisionnement** (jours avant rupture, quantité conseillée).
3. **IA Module B** — **scoring du crédit** (score 0-100, feu vert/orange/rouge, raisons).
4. **Robustesse & adoption** — démarrage à froid (repli heuristique), mobile-first, hors-ligne, FR/Wolof.

### 🎯 Apport MIAGE (3 piliers)
- **Gestion** : COGS, **marge réelle** après marchandage, rotation stocks, recouvrement crédit.
- **Informatique** : SI **multi-boutique**, **RBAC** patron/employé, archi en couches, **monnaie zéro flottant**.
- **IA** : Gradient Boosting (régression demande, classification crédit) + **repli heuristique** (données rares).

### 🧪 Méthodologie — **Design Science Research** (Hevner)
Artefact + rigueur + pertinence. Terrain (entretiens commerçants ✔) → modélisation → prototypage (✔) → **évaluation** (MAE demande, AUC/rappel crédit, 76 endpoints testés, retour utilisateur).

### 🛡️ Faisabilité (atout)
Prototype **opérationnel et testé** : React + Laravel + FastAPI/scikit-learn, **76 endpoints OK**, fractionnement + marchandage + 2 IA. Données : **synthétiques** (amorçage) + **réelles auto-générées** + **terrain**.

### 🚫 Exclus (assumés) — *tenir le cadrage*
E-commerce · paiement réel (Wave/OM) · volatilité des prix · mobile natif = **extension**, pas le cœur.

---

### 💬 LA question : « Mémoire ou simple développement ? »
> « Le code n'est que l'**instrument**. La contribution, c'est (1) un **modèle de SI** formalisant des pratiques informelles ignorées par les ERP, et (2) une **évaluation** de l'apport de l'IA pour deux décisions de gestion en **contexte de données rares**. Démarche **Design Science**. »

### 🔑 5 phrases à marteler
1. « Les outils existants modélisent le commerce **formel** ; moi le commerce **informel** tel qu'il se pratique. »
2. « Le **prix et la quantité deviennent des données** → marge et décision pilotables. »
3. « Une **IA qui marche dès le 1ᵉʳ jour** (heuristique) puis s'améliore. »
4. « **Recherche-conception** : artefact + évaluation, ancrée terrain. »
5. « **Faisabilité déjà prouvée** par un prototype testé. »

### ⛔ À éviter
Faire une démo comme si c'était le sujet · survendre l'IA · élargir le périmètre · dire « j'ai juste développé ».
