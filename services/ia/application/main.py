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


# --------------------------------------------------------------------------- #
# COMPATIBILITÉ TEMPORAIRE — ancien contrat anglais
#
# L'API en production appelle encore /forecast, /credit-score et /health avec
# les anciens noms de champs. Ces routes traduisent à l'entrée et à la sortie
# et renvoient EXACTEMENT les réponses d'avant (vérifié par
# tests/test_service.py contre tests/empreintes_avant_francisation.json).
#
# Les noms anglais ci-dessous SONT l'ancien contrat : ils ne peuvent pas être
# traduits. À retirer quand l'API ne les appelle plus (glossaire, section 3).
# --------------------------------------------------------------------------- #
_ANCIENNE_METHODE = {"modele": "model", "heuristique": "heuristic"}
_ANCIEN_RISQUE = {"vert": "green", "orange": "amber", "rouge": "red"}


class _AncienneDemandePrevision(BaseModel):
    product_id: int
    current_stock_base: float = Field(..., description="Stock actuel en unité de base")
    history_daily_base: list[float] = Field(
        default_factory=list,
        description="Ventes quotidiennes récentes en unité de base (anciennes -> récentes)",
    )


class _AncienneReponsePrevision(BaseModel):
    product_id: int
    avg_daily_demand_base: float
    days_until_stockout: float | None
    recommended_reorder_base: float
    method: str


class _AncienneDemandeScoreCredit(BaseModel):
    amount: float = Field(..., description="Montant de la vente à crédit")
    due_in_days: int = Field(15, description="Délai accordé avant échéance")
    past_credits: int = Field(0, description="Nombre de crédits passés du client")
    past_repaid_on_time: int = Field(0, description="Nb remboursés à temps")
    avg_days_late: float = Field(0.0, description="Retard moyen passé (jours)")


class _AncienneReponseScoreCredit(BaseModel):
    score: int
    risk: str
    reasons: list[str]
    method: str


@application.post("/forecast", response_model=_AncienneReponsePrevision, include_in_schema=False)
def _ancienne_prevision(ancienne: _AncienneDemandePrevision) -> _AncienneReponsePrevision:
    r = prevision(DemandePrevision(
        produit_id=ancienne.product_id,
        stock_actuel_base=ancienne.current_stock_base,
        historique_jour_base=ancienne.history_daily_base,
    ))
    return _AncienneReponsePrevision(
        product_id=r.produit_id,
        avg_daily_demand_base=r.demande_moyenne_jour_base,
        days_until_stockout=r.jours_avant_rupture,
        recommended_reorder_base=r.reassort_conseille_base,
        method=_ANCIENNE_METHODE[r.methode],
    )


@application.post("/credit-score", response_model=_AncienneReponseScoreCredit, include_in_schema=False)
def _ancien_score_credit(ancienne: _AncienneDemandeScoreCredit) -> _AncienneReponseScoreCredit:
    r = score_credit(DemandeScoreCredit(
        montant=ancienne.amount,
        jours_avant_echeance=ancienne.due_in_days,
        credits_passes=ancienne.past_credits,
        rembourses_a_temps=ancienne.past_repaid_on_time,
        retard_moyen_jours=ancienne.avg_days_late,
    ))
    return _AncienneReponseScoreCredit(
        score=r.score, risk=_ANCIEN_RISQUE[r.risque], reasons=r.raisons, method=_ANCIENNE_METHODE[r.methode],
    )


@application.get("/health", include_in_schema=False)
def _ancienne_sante() -> dict:
    s = sante()
    return {"status": s["statut"], "demand_model": s["modele_demande"], "credit_model": s["modele_credit"]}
