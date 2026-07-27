"""
Génère des données synthétiques réalistes pour AMORCER l'entraînement des modèles
tant que l'historique réel du commerçant est court (cf. méthodologie du mémoire :
amorçage par données synthétiques, puis bascule progressive vers les données réelles
collectées via `php artisan ia:export`).

Produit :
  - data/credit_training.csv  (Module B)
  - data/demand_training.csv  (Module A)

Usage :
    python make_synthetic.py [--credits 800] [--days 180]
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parent / "data"
rng = np.random.default_rng(42)


def make_credit(n: int) -> pd.DataFrame:
    rows = []
    for _ in range(n):
        past = int(rng.integers(0, 12))
        # un "vrai" comportement latent du client : fiabilité intrinsèque
        reliability = rng.beta(2, 1.5)
        on_time = int(round(past * reliability))
        avg_late = float(max(0, rng.normal((1 - reliability) * 12, 3)))
        amount = int(rng.choice([1000, 2000, 3000, 5000, 7200, 10000, 15000, 22000]))
        due = int(rng.choice([7, 10, 15, 15, 21, 30]))

        # probabilité de remboursement à temps : dépend de la fiabilité, des retards
        # passés, du montant et du délai (plus c'est long/cher, plus c'est risqué)
        logit = (
            -0.4
            + 2.6 * reliability
            - 0.06 * avg_late
            - 0.00003 * amount
            - 0.02 * (due - 15)
            + (0.4 if past >= 3 else 0)
        )
        p = 1 / (1 + np.exp(-logit))
        repaid = int(rng.random() < p)

        rows.append([amount, due, past, on_time, round(avg_late, 2), repaid])

    return pd.DataFrame(
        rows,
        columns=["amount", "due_in_days", "past_credits", "past_repaid_on_time", "avg_days_late", "repaid"],
    )


def make_demand(days: int) -> pd.DataFrame:
    rows = []
    # trois produits avec niveau de demande et saisonnalité hebdomadaire différents
    profiles = {1: (6.0, 1.4), 2: (4.0, 0.8), 3: (5.0, 1.0)}  # (moyenne, amplitude semaine)
    start = pd.Timestamp.today().normalize() - pd.Timedelta(days=days)
    for pid, (base, amp) in profiles.items():
        for d in range(days):
            date = start + pd.Timedelta(days=d)
            weekly = amp * np.sin(2 * np.pi * date.dayofweek / 7)
            trend = 0.003 * d
            qty = max(0.0, rng.normal(base + weekly + trend, 0.8))
            rows.append([pid, date.date().isoformat(), round(qty, 3)])
    return pd.DataFrame(rows, columns=["product_id", "date", "quantity_base"])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--credits", type=int, default=800)
    ap.add_argument("--days", type=int, default=180)
    args = ap.parse_args()

    DATA.mkdir(exist_ok=True)
    make_credit(args.credits).to_csv(DATA / "credit_training.csv", index=False)
    make_demand(args.days).to_csv(DATA / "demand_training.csv", index=False)
    print(f"[OK] {args.credits} credits + {args.days} jours x3 produits generes dans {DATA}")


if __name__ == "__main__":
    main()
