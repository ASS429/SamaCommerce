"""
Entraînement du Module B — scoring de crédit client.

Lit un CSV d'historique de crédits et entraîne un classifieur qui prédit la
probabilité de remboursement (à temps). Sauvegarde le modèle dans models/credit_score.joblib,
chargé automatiquement par le service (app/main.py).

CSV attendu (data/credit_training.csv), une ligne par vente à crédit passée :
    amount, due_in_days, past_credits, past_repaid_on_time, avg_days_late, repaid
où `repaid` = 1 si remboursé à temps, 0 sinon.

Pour générer ce CSV depuis la base Laravel :
    php artisan ia:export
Pour le mémoire, on peut aussi amorcer/benchmarker avec le jeu public
« African Credit Scoring Challenge » (Zindi/Kaggle).

Usage :
    python train_credit.py
"""
from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split

BASE = Path(__file__).resolve().parent
DATA = BASE / "data" / "credit_training.csv"
MODELS = BASE / "models"
FEATURES = ["amount", "due_in_days", "past_credits", "repaid_ratio", "avg_days_late"]


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["repaid_ratio"] = np.where(
        df["past_credits"] > 0, df["past_repaid_on_time"] / df["past_credits"], 0.0
    )
    return df[FEATURES]


def main() -> None:
    if not DATA.exists():
        raise SystemExit(
            f"Données introuvables : {DATA}\n"
            "Génère-les avec `php artisan ia:export` (côté apps/api), "
            "ou place un CSV au format attendu."
        )

    df = pd.read_csv(DATA)
    X = build_features(df)
    y = df["repaid"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y if y.nunique() > 1 else None
    )

    model = GradientBoostingClassifier(random_state=42)
    model.fit(X_train, y_train)

    if y_test.nunique() > 1:
        proba = model.predict_proba(X_test)[:, 1]
        print(f"AUC : {roc_auc_score(y_test, proba):.3f}")
        print(classification_report(y_test, model.predict(X_test)))

    MODELS.mkdir(exist_ok=True)
    joblib.dump(model, MODELS / "credit_score.joblib")
    print(f"[OK] Modele sauvegarde -> {MODELS / 'credit_score.joblib'}")


if __name__ == "__main__":
    main()
