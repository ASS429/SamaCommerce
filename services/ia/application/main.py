"""
Micro-service IA de SamaCommerce.

Expose deux modules d'aide à la décision, appelés par l'API Laravel :
  - Module A : prévision de la demande / réapprovisionnement  -> POST /prevision
  - Module B : score de crédit client                         -> POST /score-credit
et un état de santé                                            -> GET  /sante

Tant que les modèles ne sont pas entraînés (dossier modeles/ vide), le service
renvoie des estimations heuristiques afin que la démo fonctionne dès le départ.
Les scripts d'entraînement (entrainer_*.py) produisent les .joblib qui
remplacent automatiquement ces heuristiques.
"""
from __future__ import annotations

from pathlib import Path

import joblib
from fastapi import FastAPI
from pydantic import BaseModel, Field

REPERTOIRE_MODELES = Path(__file__).resolve().parent.parent / "modeles"

application = FastAPI(title="SamaCommerce IA", version="0.2.0")


def _charger(nom: str):
    chemin = REPERTOIRE_MODELES / nom
    return joblib.load(chemin) if chemin.exists() else None


modele_demande = _charger("prevision_demande.joblib")
modele_credit = _charger("score_credit.joblib")


# --------------------------------------------------------------------------- #
# Module A — Prévision de la demande
# --------------------------------------------------------------------------- #
class DemandePrevision(BaseModel):
    produit_id: int
    stock_actuel_base: float = Field(..., description="Stock actuel en unité de base")
    historique_jour_base: list[float] = Field(
        default_factory=list,
        description="Ventes quotidiennes récentes en unité de base (anciennes -> récentes)",
    )


class ReponsePrevision(BaseModel):
    produit_id: int
    demande_moyenne_jour_base: float
    jours_avant_rupture: float | None
    reassort_conseille_base: float
    methode: str


@application.post("/prevision", response_model=ReponsePrevision)
def prevision(demande: DemandePrevision) -> ReponsePrevision:
    historique = [h for h in demande.historique_jour_base if h is not None]

    if modele_demande is not None and historique:
        moyenne = float(modele_demande.predict([_variables_demande(historique)])[0])
        methode = "modele"
    else:
        # Heuristique : moyenne mobile pondérée vers les jours récents
        moyenne = _moyenne_ponderee(historique) if historique else 0.0
        methode = "heuristique"

    moyenne = max(moyenne, 0.0)
    jours_restants = (demande.stock_actuel_base / moyenne) if moyenne > 0 else None
    # Couverture cible : ~14 jours de demande
    reassort = max(moyenne * 14 - demande.stock_actuel_base, 0.0)

    return ReponsePrevision(
        produit_id=demande.produit_id,
        demande_moyenne_jour_base=round(moyenne, 3),
        jours_avant_rupture=round(jours_restants, 1) if jours_restants is not None else None,
        reassort_conseille_base=round(reassort, 3),
        methode=methode,
    )


# --------------------------------------------------------------------------- #
# Module B — Score de crédit client
# --------------------------------------------------------------------------- #
class DemandeScoreCredit(BaseModel):
    montant: float = Field(..., description="Montant de la vente à crédit")
    jours_avant_echeance: int = Field(15, description="Délai accordé avant échéance")
    credits_passes: int = Field(0, description="Nombre de crédits passés du client")
    rembourses_a_temps: int = Field(0, description="Nb remboursés à temps")
    retard_moyen_jours: float = Field(0.0, description="Retard moyen passé (jours)")


class ReponseScoreCredit(BaseModel):
    score: int  # 0-100
    risque: str  # vert | orange | rouge
    raisons: list[str]
    methode: str


@application.post("/score-credit", response_model=ReponseScoreCredit)
def score_credit(demande: DemandeScoreCredit) -> ReponseScoreCredit:
    if modele_credit is not None:
        probabilite = float(modele_credit.predict_proba([_variables_credit(demande)])[0][1])
        score = int(round(probabilite * 100))
        methode = "modele"
    else:
        score, methode = _score_heuristique(demande), "heuristique"

    risque = "vert" if score >= 70 else "orange" if score >= 45 else "rouge"
    return ReponseScoreCredit(score=score, risque=risque, raisons=_raisons_credit(demande), methode=methode)


@application.get("/sante")
def sante() -> dict:
    return {
        "statut": "ok",
        "modele_demande": modele_demande is not None,
        "modele_credit": modele_credit is not None,
    }


# --------------------------------------------------------------------------- #
# Outils (variables partagées avec les scripts d'entraînement)
# --------------------------------------------------------------------------- #
def _moyenne_ponderee(historique: list[float]) -> float:
    fenetre = historique[-14:]
    poids = list(range(1, len(fenetre) + 1))
    return sum(v * p for v, p in zip(fenetre, poids)) / sum(poids)


def _variables_demande(historique: list[float]) -> list[float]:
    fenetre = historique[-14:]
    n = len(fenetre)
    moyenne = sum(fenetre) / n
    sept_derniers = fenetre[-7:]
    return [moyenne, sum(sept_derniers) / len(sept_derniers), max(fenetre), min(fenetre), float(n)]


def _variables_credit(demande: DemandeScoreCredit) -> list[float]:
    taux = (demande.rembourses_a_temps / demande.credits_passes) if demande.credits_passes else 0.0
    return [demande.montant, float(demande.jours_avant_echeance), float(demande.credits_passes), taux, demande.retard_moyen_jours]


def _score_heuristique(demande: DemandeScoreCredit) -> int:
    score = 60
    if demande.credits_passes > 0:
        taux = demande.rembourses_a_temps / demande.credits_passes
        score += int(taux * 35) - 10
    score -= min(int(demande.retard_moyen_jours), 25)
    score -= max(0, demande.jours_avant_echeance - 15) // 5
    if demande.montant > 30000:
        score -= 5
    return max(0, min(100, score))


def _raisons_credit(demande: DemandeScoreCredit) -> list[str]:
    raisons: list[str] = []
    if demande.credits_passes == 0:
        raisons.append("Nouveau client, aucun historique de crédit")
    else:
        raisons.append(f"{demande.rembourses_a_temps}/{demande.credits_passes} crédits remboursés à temps")
        if demande.retard_moyen_jours > 0:
            raisons.append(f"Retard moyen passé : {demande.retard_moyen_jours:.0f} jours")
    if demande.jours_avant_echeance > 15:
        raisons.append(f"Échéance longue ({demande.jours_avant_echeance} jours)")
    return raisons

