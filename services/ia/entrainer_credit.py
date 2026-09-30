"""
Entraînement du Module B — scoring de crédit client.

Lit un CSV d'historique de crédits et entraîne un classifieur qui prédit la
probabilité de remboursement (à temps). Sauvegarde le modèle dans
modeles/score_credit.joblib, chargé automatiquement par le service (application/main.py).

CSV attendu (donnees/entrainement_credit.csv), une ligne par vente à crédit passée :
    montant, jours_avant_echeance, credits_passes, rembourses_a_temps, retard_moyen_jours, rembourse
où `rembourse` = 1 si remboursé à temps, 0 sinon.

Pour produire ce CSV : `python generer_donnees.py` (données synthétiques
d'amorçage). Pour le mémoire, on peut aussi amorcer/benchmarker avec le jeu
public « African Credit Scoring Challenge » (Zindi/Kaggle).

Usage :
    python entrainer_credit.py
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
DONNEES = BASE / "donnees" / "entrainement_credit.csv"
MODELES = BASE / "modeles"
VARIABLES = ["montant", "jours_avant_echeance", "credits_passes", "taux_rembourse", "retard_moyen_jours"]


def construire_variables(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["taux_rembourse"] = np.where(
        df["credits_passes"] > 0, df["rembourses_a_temps"] / df["credits_passes"], 0.0
    )
    return df[VARIABLES]


def main() -> None:
    if not DONNEES.exists():
        raise SystemExit(
            f"Données introuvables : {DONNEES}\n"
            "Génère-les avec `python generer_donnees.py`, "
            "ou place un CSV au format attendu."
        )

    df = pd.read_csv(DONNEES)
    X = construire_variables(df)
    y = df["rembourse"].astype(int)

    X_entrainement, X_test, y_entrainement, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y if y.nunique() > 1 else None
    )

    modele = GradientBoostingClassifier(random_state=42)
    modele.fit(X_entrainement, y_entrainement)

    if y_test.nunique() > 1:
        probabilites = modele.predict_proba(X_test)[:, 1]
        print(f"AUC : {roc_auc_score(y_test, probabilites):.3f}")
        print(classification_report(y_test, modele.predict(X_test)))

    MODELES.mkdir(exist_ok=True)
    joblib.dump(modele, MODELES / "score_credit.joblib")
    print(f"[OK] Modèle sauvegardé -> {MODELES / 'score_credit.joblib'}")


if __name__ == "__main__":
    main()
