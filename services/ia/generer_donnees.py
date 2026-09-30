"""
Génère des données synthétiques réalistes pour AMORCER l'entraînement des modèles
tant que l'historique réel du commerçant est court (cf. méthodologie du mémoire :
amorçage par données synthétiques, puis bascule progressive vers les données réelles
du commerçant, exportées depuis l'API — export prévu, pas encore écrit).

Produit :
  - donnees/entrainement_credit.csv   (Module B)
  - donnees/entrainement_demande.csv  (Module A)

Usage :
    python generer_donnees.py [--credits 800] [--jours 180]
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

DONNEES = Path(__file__).resolve().parent / "donnees"
alea = np.random.default_rng(42)


def generer_credits(nombre: int) -> pd.DataFrame:
    lignes = []
    for _ in range(nombre):
        passes = int(alea.integers(0, 12))
        # un "vrai" comportement latent du client : fiabilité intrinsèque
        fiabilite = alea.beta(2, 1.5)
        a_temps = int(round(passes * fiabilite))
        retard_moyen = float(max(0, alea.normal((1 - fiabilite) * 12, 3)))
        montant = int(alea.choice([1000, 2000, 3000, 5000, 7200, 10000, 15000, 22000]))
        delai = int(alea.choice([7, 10, 15, 15, 21, 30]))

        # probabilité de remboursement à temps : dépend de la fiabilité, des retards
        # passés, du montant et du délai (plus c'est long/cher, plus c'est risqué)
        logit = (
            -0.4
            + 2.6 * fiabilite
            - 0.06 * retard_moyen
            - 0.00003 * montant
            - 0.02 * (delai - 15)
            + (0.4 if passes >= 3 else 0)
        )
        probabilite = 1 / (1 + np.exp(-logit))
        rembourse = int(alea.random() < probabilite)

        lignes.append([montant, delai, passes, a_temps, round(retard_moyen, 2), rembourse])

    return pd.DataFrame(
        lignes,
        columns=["montant", "jours_avant_echeance", "credits_passes", "rembourses_a_temps", "retard_moyen_jours", "rembourse"],
    )


def generer_demande(jours: int) -> pd.DataFrame:
    lignes = []
    # trois produits avec niveau de demande et saisonnalité hebdomadaire différents
    profils = {1: (6.0, 1.4), 2: (4.0, 0.8), 3: (5.0, 1.0)}  # (moyenne, amplitude semaine)
    debut = pd.Timestamp.today().normalize() - pd.Timedelta(days=jours)
    for produit, (base, amplitude) in profils.items():
        for j in range(jours):
            date = debut + pd.Timedelta(days=j)
            semaine = amplitude * np.sin(2 * np.pi * date.dayofweek / 7)
            tendance = 0.003 * j
            quantite = max(0.0, alea.normal(base + semaine + tendance, 0.8))
            lignes.append([produit, date.date().isoformat(), round(quantite, 3)])
    return pd.DataFrame(lignes, columns=["produit_id", "date", "quantite_base"])


def main() -> None:
    parametres = argparse.ArgumentParser()
    parametres.add_argument("--credits", type=int, default=800)
    parametres.add_argument("--jours", type=int, default=180)
    arguments = parametres.parse_args()

    DONNEES.mkdir(exist_ok=True)
    generer_credits(arguments.credits).to_csv(DONNEES / "entrainement_credit.csv", index=False)
    generer_demande(arguments.jours).to_csv(DONNEES / "entrainement_demande.csv", index=False)
    print(f"[OK] {arguments.credits} crédits + {arguments.jours} jours x3 produits générés dans {DONNEES}")


if __name__ == "__main__":
    main()
