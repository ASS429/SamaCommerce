# Guide d'entretien — Validation du sujet de mémoire (MIAGE)

> **But de l'entretien** : convaincre le professeur que SamaCommerce constitue un **vrai sujet de mémoire MIAGE** — une **problématique** claire à la croisée *gestion + informatique + IA*, avec un **apport** (pas un simple développement), une **originalité**, un **périmètre maîtrisé** et une **faisabilité prouvée** (prototype déjà fonctionnel).
>
> **Posture** : tu n'amènes pas « une appli finie », tu amènes un **problème réel non résolu par les outils du marché** et une **démarche scientifique** pour le traiter. Le prototype est ta **preuve de faisabilité**, pas le sujet en soi.

---

## 1. Le pitch (45 secondes, à savoir par cœur)

> « Les petits détaillants du secteur informel sénégalais gèrent leur commerce **de tête** : ils vendent **au fractionnement** (au kg, au bol, au sachet), **marchandent** chaque prix, et font **crédit** à la confiance. Les logiciels de caisse existants supposent l'inverse : prix fixes, vente à l'unité, pas de crédit informel. **Mon mémoire conçoit un système d'information de gestion ET d'aide à la décision réellement adapté à ces pratiques**, et étudie **dans quelle mesure l'apprentissage automatique peut fiabiliser deux décisions critiques — le réapprovisionnement et l'octroi de crédit — malgré la rareté des données.** J'ai déjà un prototype fonctionnel qui démontre la faisabilité. »

---

## 2. Titre proposé (+ variantes)

**Titre principal proposé :**
> *« Conception d'un système d'information de gestion et d'aide à la décision pour le commerce de détail informel : modélisation des pratiques réelles (vente fractionnée, marchandage, crédit) et apprentissage automatique pour le réapprovisionnement et le scoring de crédit. »*

**Variantes plus courtes :**
- *« SamaCommerce : un SI d'aide à la décision adapté au détaillant informel sénégalais. »*
- *« Aide à la décision par l'IA pour le petit commerce informel : prévision de réapprovisionnement et scoring de crédit en contexte de données rares. »*

**Le fil conducteur** (à répéter) : **« l'aide à la décision pour le détaillant informel »**. Tout s'y rattache.

---

## 3. La problématique (cœur de l'entretien)

**Question centrale :**
> *Comment concevoir un système d'information capable à la fois de **gérer** un commerce de détail informel **tel qu'il fonctionne réellement** (fractionnement, marchandage, crédit) et de l'**aider à décider** (quand et combien réapprovisionner ? à qui faire crédit ?), dans un contexte de **données rares et d'utilisateurs peu alphabétisés** ?*

**Sous-questions (les axes du mémoire) :**
1. **Modélisation** — Comment représenter dans un SI les pratiques que les outils classiques ignorent : la **vente fractionnée** (unité de base, conditionnements de gros) et le **marchandage** (prix négocié, marge réelle, plancher) ?
2. **Réapprovisionnement (IA – Module A)** — Peut-on **prévoir la demande** et recommander un **réassort** fiable à partir d'un historique de ventes court et bruité ?
3. **Crédit (IA – Module B)** — Peut-on **scorer le risque** d'une vente à crédit informel à partir du comportement de remboursement passé du client ?
4. **Robustesse & adoption** — Comment garantir que l'outil **fonctionne même sans modèle entraîné** (démarrage à froid) et reste **utilisable** par un commerçant peu alphabétisé (mobile-first, hors-ligne, icônes) ?

> 👉 Une bonne problématique = **une tension** (« les outils existants ne collent pas à la réalité informelle ») + **une question ouverte** (« l'IA peut-elle aider malgré le peu de données ? »). Tu as les deux.

---

## 4. Pourquoi c'est un **sujet MIAGE** (et pas du simple développement)

C'est **LA** question que le professeur posera. Réponse en trois piliers :

| Pilier | Ce que le mémoire apporte |
|---|---|
| **Gestion** | Modélisation comptable et décisionnelle réelle : **coût des marchandises vendues (COGS)**, **marge réelle** après marchandage, **rotation des stocks**, **recouvrement du crédit**, valorisation du stock fractionné. |
| **Informatique** | Conception d'un **SI multi-tenant** (multi-boutique), **contrôle d'accès par rôles (RBAC)** patron/employé, architecture en couches (API REST, front, micro-service IA), **modèle de données « zéro flottant »** pour la monnaie. |
| **IA / aide à la décision** | Deux modules d'apprentissage supervisé (**régression** pour la demande, **classification** pour le crédit) avec **gestion du démarrage à froid** (repli heuristique) — IA appliquée à un **contexte de données rares**. |

**La phrase qui tue l'objection « c'est juste du dev » :**
> « Le développement n'est que l'**instrument**. La contribution est (1) **un modèle de SI** qui formalise des pratiques informelles que la littérature et les ERP ignorent, et (2) **une évaluation** de l'apport de l'IA pour la décision en contexte de données rares. C'est de l'**informatique de gestion appliquée**, étayée par une **démarche de recherche-conception**. »

---

## 5. La méthodologie — nomme-la, ça rassure le jury

Propose explicitement un cadre méthodologique reconnu :

- **Design Science Research (DSR, Hevner et al.)** : on **conçoit un artefact** (le SI) pour résoudre un **problème organisationnel réel**, en alternant **pertinence** (ancrage terrain) et **rigueur** (évaluation). → C'est exactement ce que tu fais, et ça **légitime « construire un système » comme une recherche**.
- **Démarche en 4 temps** :
  1. **Étude de terrain** — entretiens avec des commerçants (tu en as déjà menés ; besoin n°1 exprimé = l'inventaire).
  2. **Modélisation & conception** — formalisation des pratiques (fractionnement, marchandage, crédit) et architecture du SI.
  3. **Prototypage** — implémentation (déjà réalisée : web + API + micro-service IA).
  4. **Évaluation** — tests techniques (déjà : 76 endpoints validés), métriques IA (MAE pour la demande, AUC/rappel pour le crédit), et **retour utilisateur** prévu avec des commerçants.

> 👉 Mentionner **DSR** + **un protocole d'évaluation** transforme « j'ai codé une appli » en « j'ai mené une recherche-conception évaluée ».

---

## 6. Les contributions, axe par axe (problème → apport)

**A. Vente fractionnée**
- *Problème* : un sac de riz se vend au kg, au demi-kg, au bol ; l'huile au litre ou moins ; les sachets à l'unité ; et **le même produit peut aussi se vendre en gros** (le sac entier) à un **prix dégressif**. Les caisses classiques ne savent pas faire.
- *Apport* : un modèle **unité de base entière + conditionnements** (zéro flottant : stock en grammes/ml/pièces, monnaie en FCFA entiers), avec une **règle d'arrondi** unique `total = arrondi(quantité_base × prix ÷ facteur)`. Calcul automatique du **COGS** et donc de la **marge réelle**.

**B. Marchandage**
- *Problème* : le prix affiché n'est qu'un **point de départ** ; le prix réel se négocie. Un commerçant peut **croire gagner** alors qu'une remise érode sa marge ; un employé peut **brader**.
- *Apport* : le prix devient une **donnée** (prix de référence vs prix réel → **remise** tracée), une **marge affichée en temps réel** au comptoir, un **prix plancher** que **l'employé ne peut pas franchir** (couplé au contrôle d'accès), et des **analyses** (remise moyenne, marge réelle, **par vendeur**). → *Modéliser la négociation est une vraie originalité.*

**C. Réapprovisionnement intelligent (IA – Module A)**
- *Problème* : « quand vais-je être en rupture ? combien commander ? » — décidé à l'intuition.
- *Apport* : **prévision de la demande** (régression **Gradient Boosting**, features moyenne/mobile/extrema sur fenêtre 14 j) → **jours avant rupture** + **quantité recommandée** (couverture ~14 j). **Repli heuristique** (moyenne mobile pondérée) si pas encore de modèle.

**D. Scoring de crédit informel (IA – Module B)**
- *Problème* : le crédit se fait « à la confiance », sans mémoire structurée.
- *Apport* : **score de risque 0-100** (classification **Gradient Boosting**, features montant/échéance/historique de remboursement) → **feu vert/orange/rouge** + **raisons explicables**. Repli heuristique transparent.

> Les deux modules IA partagent **le même garde-fou** : **ils fonctionnent dès le premier jour** (heuristique), puis **s'améliorent** quand les données s'accumulent. C'est ta réponse au « vous n'avez pas de données ».

---

## 7. Originalité / positionnement (état de l'art à esquisser)

- Les **ERP/POS** du marché (et la recherche en SI) modélisent un commerce **formel** : prix fixes, vente à l'unité, paiement comptant. **Le commerce informel — pourtant majoritaire en Afrique de l'Ouest — est sous-modélisé.**
- L'**inclusion financière** et le **credit scoring** existent (mobile money, microfinance) mais **pas au niveau du petit détaillant** qui fait crédit lui-même.
- **Originalité de SamaCommerce** : réunir, dans **un seul SI utilisable au comptoir**, (1) la **modélisation fidèle** des pratiques informelles et (2) une **aide à la décision par l'IA** pensée pour la **rareté des données**.

---

## 8. Faisabilité — ton atout maître

- **Le prototype existe et fonctionne** : web (React) + API (Laravel) + micro-service IA (FastAPI/scikit-learn), **76 points d'API validés**, flux fractionnement/marchandage/IA testés de bout en bout.
- **Données** : (a) **synthétiques** pour entraîner/valider les modèles dès maintenant (générateur réaliste) ; (b) **réelles** collectées progressivement par l'usage ; (c) **terrain** via les entretiens commerçants.
- **Accessibilité des données** : c'est l'app elle-même qui produit la donnée (ventes, crédits) → le sujet est **auto-alimenté**.

> 👉 La faisabilité prouvée **désamorce** l'objection « trop ambitieux » : « ce n'est pas un projet hypothétique, j'ai déjà la preuve de concept ; le mémoire en fait l'**étude méthodique et l'évaluation**. »

---

## 9. Périmètre — montre que tu maîtrises le scope

**Inclus :** gestion (produits, stock fractionné, ventes, marchandage, crédit, caisse, marges), multi-boutique + rôles, et **les 2 modules IA**.
**Exclus volontairement** (à dire toi-même, ça rassure) :
- **Vente en ligne / e-commerce** — hors sujet (outil de gestion).
- **Intégration de paiement réelle** (Wave/Orange Money) — perspective, pas le cœur.
- **Volatilité des prix** — mineure au Sénégal, simple valorisation par lot.
- **Le mobile natif** est une **extension** (le SI et l'IA sont la substance).

> « Je préfère un sujet **profond et cadré** qu'un sujet large et superficiel. »

---

## 10. Plan de mémoire proposé (à montrer)

1. **Introduction & problématique** — le commerce informel, la tension avec les outils existants, la question de recherche.
2. **État de l'art** — SI de gestion commerciale, secteur informel, aide à la décision & ML en contexte de données rares, credit scoring.
3. **Étude de terrain** — entretiens commerçants, besoins (inventaire, crédit, fractionnement, marchandage).
4. **Modélisation & conception** — modèle de données (fractionnement, marchandage), architecture du SI, RBAC/multi-boutique.
5. **Modules d'aide à la décision (IA)** — Module A réappro (données, features, modèle, évaluation MAE) ; Module B scoring (données, features, modèle, évaluation AUC/rappel) ; **stratégie de démarrage à froid**.
6. **Réalisation & validation technique** — stack, tests, robustesse (repli heuristique).
7. **Évaluation & discussion** — résultats, limites, retour utilisateur.
8. **Conclusion & perspectives.**

---

## 11. Questions probables du professeur — et tes réponses

**Q1. « En quoi est-ce un mémoire et pas un projet de développement ? »**
> La contribution n'est pas le code mais (1) **un modèle de SI** formalisant des pratiques informelles ignorées par les outils du marché, et (2) **une évaluation** de l'apport de l'IA pour deux décisions de gestion en contexte de données rares. Démarche **Design Science Research** : artefact + rigueur + pertinence.

**Q2. « Quelle est la problématique, en une phrase ? »**
> Comment concevoir un SI qui gère le commerce informel **tel qu'il est réellement pratiqué** et qui **aide à décider** (réappro, crédit) malgré la **rareté des données** ?

**Q3. « Où est l'apport scientifique / l'originalité ? »**
> La **modélisation du fractionnement et du marchandage** dans un SI (peu traitée), et l'**aide à la décision par ML pensée pour le démarrage à froid** dans le petit commerce informel.

**Q4. « Avez-vous les données pour faire de l'IA ? »**
> Trois sources : **synthétiques** (pour amorcer et valider les modèles), **réelles auto-générées** par l'usage de l'app, et **terrain** (entretiens). Et surtout : **l'outil fonctionne sans modèle** (repli heuristique) puis s'améliore — c'est justement une **contribution** (stratégie cold-start), pas une faiblesse.

**Q5. « Le périmètre n'est-il pas trop large (fractionnement + marchandage + 2 IA) ? »**
> Tout tient sous **un seul fil conducteur** (aide à la décision au détaillant). J'**exclus** explicitement l'e-commerce, le paiement réel, le natif. Et la **faisabilité est déjà prouvée** par le prototype.

**Q6. « Quel algorithme d'IA, et pourquoi ? »**
> **Gradient Boosting** (régression pour la demande, classification pour le crédit) : robuste sur petits jeux tabulaires, peu d'hypothèses, bonnes performances sans réglage lourd. Features simples et **interprétables** (moyennes/extrema pour la demande ; montant/échéance/historique pour le crédit), ce qui permet d'**expliquer** la recommandation au commerçant.

**Q7. « Comment évaluez-vous les résultats ? »**
> Module A : **MAE** (erreur moyenne de prévision) + précision sur « jours avant rupture ». Module B : **AUC, rappel, matrice de confusion**. Côté SI : **tests fonctionnels** (déjà 76 endpoints) + **retour utilisateur** (utilisabilité) auprès de commerçants.

**Q8. « En quoi est-ce spécifique au Sénégal / à l'informel ? »**
> Vente fractionnée et marchandage **omniprésents**, crédit informel « à la confiance », utilisateurs **peu alphabétisés** (d'où mobile-first, hors-ligne, icônes, multilingue FR/Wolof). Le SI est **conçu autour de ces contraintes**, pas adapté après coup.

**Q9. « Pourquoi pas un logiciel existant ? »**
> Aucun ne modélise **simultanément** fractionnement + marchandage + crédit informel + aide à la décision. Les adapter reviendrait à les **reconcevoir** — ce que fait précisément ce mémoire.

**Q10. « Quels sont les risques / limites ? »**
> Qualité/quantité des données réelles au début (→ repli heuristique) ; généralisation des modèles (→ validation et ré-entraînement) ; adoption terrain (→ tests utilisateurs). Limites assumées et **traitées dans la démarche**.

**Q11. « Qu'est-ce qui relève de la gestion exactement ? »**
> COGS et **marge réelle** après remise, **rotation des stocks**, **taux de recouvrement** du crédit, valorisation du stock fractionné, pilotage par vendeur — ce sont des **concepts de gestion** opérationnalisés dans le SI.

---

## 12. Objections à anticiper (et reformulations)

- *« C'est trop opérationnel, pas assez académique. »* → Recadrer sur **DSR** + **état de l'art** + **évaluation chiffrée**.
- *« L'IA est gadget. »* → Montrer les **features**, l'**évaluation**, et le **repli heuristique** (l'IA est un module **mesuré**, pas un argument marketing).
- *« Vous avez déjà tout fait, que reste-t-il à étudier ? »* → Le prototype est la **preuve de faisabilité** ; le **travail de mémoire** est la **formalisation, l'expérimentation et l'évaluation** (entraînement/validation des modèles, mesures, retour terrain, état de l'art).

---

## 13. Arguments-clés à marteler (mémorise-les)

1. **« Les outils existants modélisent le commerce formel ; moi je modélise le commerce informel tel qu'il se pratique. »**
2. **« Le prix et la quantité deviennent des données »** (marchandage + fractionnement) → décision et marge pilotables.
3. **« Une IA qui marche dès le premier jour »** (repli heuristique) puis s'améliore → contribution cold-start.
4. **« Recherche-conception (Design Science) : artefact + évaluation, ancrée sur le terrain. »**
5. **« Faisabilité déjà prouvée »** par un prototype testé.

## 14. À éviter

- Présenter une **démo d'appli** comme si c'était le sujet (le sujet = la **problématique** + l'**apport**).
- Survendre l'IA (« ça prédit tout ») — rester **mesuré** et **évaluable**.
- Élargir le périmètre sous la pression — **tenir le cadrage**.
- Dire « j'ai juste développé » — toujours **relier au problème de gestion et à la démarche**.

---

### Annexe — chiffres & faits à avoir en tête
- Prototype : **React + Laravel + FastAPI/scikit-learn**, **76 endpoints testés**, multi-boutique + RBAC, fractionnement & marchandage opérationnels.
- IA : **GradientBoostingRegressor** (demande), **GradientBoostingClassifier** (crédit), repli **heuristique** si pas de modèle.
- Données : **synthétiques** (amorçage) + **réelles auto-générées** + **terrain** (entretiens commerçants).
- Contexte : commerce de détail informel sénégalais, utilisateurs peu alphabétisés (mobile-first, hors-ligne, FR/Wolof).
