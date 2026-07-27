"""
Entraînement du Module A — prévision de la demande.

Lit un CSV de ventes quotidiennes par produit (en unité de base) et entraîne
un régresseur prédisant la demande du jour suivant à partir d'une fenêtre
glissante de 14 jours. Sauvegarde models/demand_forecast.joblib.

CSV attendu (data/demand_training.csv), trié par produit puis par date :
    product_id, date, quantity_base

Génération depuis Laravel : `php artisan ia:export`.
Amorçage/benchmark possible avec « Store Item Demand Forecasting » (Kaggle).

Usage :
    python train_demand.py
"""
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

BASE = Path(__file__).resolve().parent
DATA = BASE / "data" / "demand_training.csv"
MODELS = BASE / "models"
WINDOW = 14


def window_features(window: list[float]) -> list[float]:
    """Doit rester cohérent avec app/main.py:_demand_features()."""
    arr = np.array(window[-WINDOW:], dtype=float)
    last7 = arr[-7:]
    return [arr.mean(), last7.mean(), arr.max(), arr.min(), float(len(arr))]


def build_dataset(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    X, y = [], []
    for _, group in df.sort_values(["product_id", "date"]).groupby("product_id"):
        series = group["quantity_base"].to_list()
        for i in range(WINDOW, len(series)):
            X.append(window_features(series[i - WINDOW : i]))
            y.append(series[i])  # demande du jour suivant
    return np.array(X), np.array(y)


def main() -> None:
    if not DATA.exists():
        raise SystemExit(
            f"Données introuvables : {DATA}\n"
            "Génère-les avec `php artisan ia:export` (côté apps/api)."
        )

    df = pd.read_csv(DATA, parse_dates=["date"])
    X, y = build_dataset(df)

    if len(X) < 20:
        print(f"⚠️  Peu d'exemples ({len(X)}). Le service utilisera l'heuristique "
              "tant que l'historique est court — c'est attendu au démarrage.")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42)
    model = GradientBoostingRegressor(random_state=42)
    model.fit(X_train, y_train)

    mae = mean_absolute_error(y_test, model.predict(X_test))
    print(f"MAE (unité de base/jour) : {mae:.3f}")

    MODELS.mkdir(exist_ok=True)
    joblib.dump(model, MODELS / "demand_forecast.joblib")
    print(f"[OK] Modele sauvegarde -> {MODELS / 'demand_forecast.joblib'}")


if __name__ == "__main__":
    main()
