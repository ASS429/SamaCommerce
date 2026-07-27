"""
Micro-service IA de SamaCommerce.

Expose deux modules d'aide à la décision, appelés par l'API Laravel :
  - Module A : prévision de la demande / réapprovisionnement  -> POST /forecast
  - Module B : scoring de crédit client                       -> POST /credit-score

Tant que les modèles ne sont pas entraînés (dossier models/ vide), le service
renvoie des estimations heuristiques afin que la démo fonctionne dès le départ.
Les scripts d'entraînement (train_*.py) produiront les .joblib qui remplaceront
automatiquement ces heuristiques.
"""
from __future__ import annotations

from pathlib import Path

import joblib
from fastapi import FastAPI
from pydantic import BaseModel, Field

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

app = FastAPI(title="SamaCommerce IA", version="0.1.0")


def _load(name: str):
    path = MODELS_DIR / name
    return joblib.load(path) if path.exists() else None


demand_model = _load("demand_forecast.joblib")
credit_model = _load("credit_score.joblib")


# --------------------------------------------------------------------------- #
# Module A — Prévision de la demande
# --------------------------------------------------------------------------- #
class ForecastRequest(BaseModel):
    product_id: int
    current_stock_base: float = Field(..., description="Stock actuel en unité de base")
    history_daily_base: list[float] = Field(
        default_factory=list,
        description="Ventes quotidiennes récentes en unité de base (anciennes -> récentes)",
    )


class ForecastResponse(BaseModel):
    product_id: int
    avg_daily_demand_base: float
    days_until_stockout: float | None
    recommended_reorder_base: float
    method: str


@app.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest) -> ForecastResponse:
    history = [h for h in req.history_daily_base if h is not None]

    if demand_model is not None and history:
        avg = float(demand_model.predict([_demand_features(history)])[0])
        method = "model"
    else:
        # Heuristique : moyenne mobile pondérée vers les jours récents
        avg = _weighted_avg(history) if history else 0.0
        method = "heuristic"

    avg = max(avg, 0.0)
    days_left = (req.current_stock_base / avg) if avg > 0 else None
    # Couverture cible : ~14 jours de demande
    reorder = max(avg * 14 - req.current_stock_base, 0.0)

    return ForecastResponse(
        product_id=req.product_id,
        avg_daily_demand_base=round(avg, 3),
        days_until_stockout=round(days_left, 1) if days_left is not None else None,
        recommended_reorder_base=round(reorder, 3),
        method=method,
    )


# --------------------------------------------------------------------------- #
# Module B — Scoring de crédit client
# --------------------------------------------------------------------------- #
class CreditRequest(BaseModel):
    amount: float = Field(..., description="Montant de la vente à crédit")
    due_in_days: int = Field(15, description="Délai accordé avant échéance")
    past_credits: int = Field(0, description="Nombre de crédits passés du client")
    past_repaid_on_time: int = Field(0, description="Nb remboursés à temps")
    avg_days_late: float = Field(0.0, description="Retard moyen passé (jours)")


class CreditResponse(BaseModel):
    score: int  # 0-100
    risk: str   # green | amber | red
    reasons: list[str]
    method: str


@app.post("/credit-score", response_model=CreditResponse)
def credit_score(req: CreditRequest) -> CreditResponse:
    if credit_model is not None:
        proba = float(credit_model.predict_proba([_credit_features(req)])[0][1])
        score = int(round(proba * 100))
        method = "model"
    else:
        score, method = _credit_heuristic(req), "heuristic"

    risk = "green" if score >= 70 else "amber" if score >= 45 else "red"
    return CreditResponse(score=score, risk=risk, reasons=_credit_reasons(req, risk), method=method)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "demand_model": demand_model is not None,
        "credit_model": credit_model is not None,
    }


# --------------------------------------------------------------------------- #
# Helpers (features partagées avec les scripts d'entraînement)
# --------------------------------------------------------------------------- #
def _weighted_avg(history: list[float]) -> float:
    window = history[-14:]
    weights = list(range(1, len(window) + 1))
    return sum(v * w for v, w in zip(window, weights)) / sum(weights)


def _demand_features(history: list[float]) -> list[float]:
    window = history[-14:]
    n = len(window)
    mean = sum(window) / n
    last7 = window[-7:]
    return [mean, sum(last7) / len(last7), max(window), min(window), float(n)]


def _credit_features(req: "CreditRequest") -> list[float]:
    ratio = (req.past_repaid_on_time / req.past_credits) if req.past_credits else 0.0
    return [req.amount, float(req.due_in_days), float(req.past_credits), ratio, req.avg_days_late]


def _credit_heuristic(req: "CreditRequest") -> int:
    score = 60
    if req.past_credits > 0:
        ratio = req.past_repaid_on_time / req.past_credits
        score += int(ratio * 35) - 10
    score -= min(int(req.avg_days_late), 25)
    score -= max(0, req.due_in_days - 15) // 5
    if req.amount > 30000:
        score -= 5
    return max(0, min(100, score))


def _credit_reasons(req: "CreditRequest", risk: str) -> list[str]:
    reasons: list[str] = []
    if req.past_credits == 0:
        reasons.append("Nouveau client, aucun historique de crédit")
    else:
        ratio = req.past_repaid_on_time / req.past_credits
        reasons.append(f"{req.past_repaid_on_time}/{req.past_credits} crédits remboursés à temps")
        if req.avg_days_late > 0:
            reasons.append(f"Retard moyen passé : {req.avg_days_late:.0f} jours")
    if req.due_in_days > 15:
        reasons.append(f"Échéance longue ({req.due_in_days} jours)")
    return reasons
