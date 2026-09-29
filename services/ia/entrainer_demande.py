"""
Entraînement du Module A — prévision de la demande.

Lit un CSV de ventes quotidiennes par produit (en unité de base) et entraîne
un régresseur prédisant la demande du jour suivant à partir d'une fenêtre
glissante de 14 jours. Sauvegarde models/prevision_demande.joblib.

CSV attendu (data/entrainement_demande.csv), trié par produit puis par date :
    produit_id, date, quantite_base

Pour produire ce CSV : `python generer_donnees.py`.
Amorçage/benchmark possible avec « Store Item Demand Forecasting » (Kaggle).

Usage :
    python entrainer_demande.py
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
DONNEES = BASE / "data" / "entrainement_demande.csv"
MODELES = BASE / "models"
FENETRE = 14


def variables_fenetre(fenetre: list[float]) -> list[float]:
    """Doit rester cohérent avec app/main.py:_variables_demande()."""
    valeurs = np.array(fenetre[-FENETRE:], dtype=float)
    sept_derniers = valeurs[-7:]
    return [valeurs.mean(), sept_derniers.mean(), valeurs.max(), valeurs.min(), float(len(valeurs))]


def construire_jeu(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    X, y = [], []
    for _, groupe in df.sort_values(["produit_id", "date"]).groupby("produit_id"):
        serie = groupe["quantite_base"].to_list()
        for i in range(FENETRE, len(serie)):
            X.append(variables_fenetre(serie[i - FENETRE : i]))
            y.append(serie[i])  # demande du jour suivant
    return np.array(X), np.array(y)


def main() -> None:
    if not DONNEES.exists():
        raise SystemExit(
            f"Données introuvables : {DONNEES}\n"
            "Génère-les avec `python generer_donnees.py`."
        )

    df = pd.read_csv(DONNEES, parse_dates=["date"])
    X, y = construire_jeu(df)

    if len(X) < 20:
        print(f"⚠️  Peu d'exemples ({len(X)}). Le service utilisera l'heuristique "
              "tant que l'historique est court — c'est attendu au démarrage.")

    X_entrainement, X_test, y_entrainement, y_test = train_test_split(X, y, test_size=0.25, random_state=42)
    modele = GradientBoostingRegressor(random_state=42)
    modele.fit(X_entrainement, y_entrainement)

    erreur = mean_absolute_error(y_test, modele.predict(X_test))
    print(f"Erreur absolue moyenne (unité de base/jour) : {erreur:.3f}")

    MODELES.mkdir(exist_ok=True)
    joblib.dump(modele, MODELES / "prevision_demande.joblib")
    print(f"[OK] Modèle sauvegardé -> {MODELES / 'prevision_demande.joblib'}")


if __name__ == "__main__":
    main()
