"""
Tests du micro-service IA.

Les empreintes (tests/empreintes_avant_francisation.json) ont été enregistrées
sur le code d'origine, AVANT la traduction en français, avec les modèles
entraînés réels : 42 prévisions et 1 299 scores de crédit, entrées invalides
comprises. Elles prouvent que les routes françaises calculent exactement les
mêmes résultats que les routes d'origine. Celles-ci (/forecast, /credit-score,
/health) ont été retirées le 01/10/2026 (étape 5 du glossaire) : l'API
n'appelait plus que les routes françaises depuis le 29/09.
"""
from __future__ import annotations

import json
import warnings
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from application import main
from application.main import application

EMPREINTES = json.loads((Path(__file__).parent / "empreintes_avant_francisation.json").read_text(encoding="utf-8"))

# Traduction de l'ancien contrat vers le nouveau (glossaire, section 10).
CHAMPS = {
    "product_id": "produit_id",
    "current_stock_base": "stock_actuel_base",
    "history_daily_base": "historique_jour_base",
    "avg_daily_demand_base": "demande_moyenne_jour_base",
    "days_until_stockout": "jours_avant_rupture",
    "recommended_reorder_base": "reassort_conseille_base",
    "method": "methode",
    "amount": "montant",
    "due_in_days": "jours_avant_echeance",
    "past_credits": "credits_passes",
    "past_repaid_on_time": "rembourses_a_temps",
    "avg_days_late": "retard_moyen_jours",
    "risk": "risque",
    "reasons": "raisons",
    "score": "score",
}
VALEURS = {"model": "modele", "heuristic": "heuristique", "green": "vert", "amber": "orange", "red": "rouge"}


@pytest.fixture(scope="module")
def client() -> TestClient:
    warnings.filterwarnings("ignore")
    return TestClient(application)


def _traduire(dico: dict) -> dict:
    return {CHAMPS[c]: (VALEURS.get(v, v) if isinstance(v, str) else v) for c, v in dico.items()}


@pytest.mark.parametrize("module,route", [("prevision", "/prevision"), ("credit", "/score-credit")])
def test_les_routes_francaises_calculent_la_meme_chose(client, module, route):
    valides = [e for e in EMPREINTES[module] if e["statut"] == 200]
    assert len(valides) > 40
    for empreinte in valides:
        r = client.post(route, json=_traduire(empreinte["entree"]))
        assert r.status_code == 200, empreinte["entree"]
        assert r.json() == _traduire(empreinte["sortie"]), empreinte["entree"]


@pytest.mark.parametrize("route,corps", [("/prevision", {"produit_id": "x"}), ("/score-credit", {"montant": "abc"}), ("/score-credit", {})])
def test_une_entree_invalide_est_refusee(client, route, corps):
    assert client.post(route, json=corps).status_code == 422


def test_sante(client):
    assert client.get("/sante").json() == {"statut": "ok", "modele_demande": True, "modele_credit": True}


@pytest.mark.parametrize("methode,ancienne_route", [("post", "/forecast"), ("post", "/credit-score"), ("get", "/health")])
def test_les_routes_d_origine_ont_disparu(client, methode, ancienne_route):
    assert getattr(client, methode)(ancienne_route).status_code == 404


def test_les_modeles_deployes_portent_les_noms_francais():
    """Sans ce contrôle, un ancien .joblib resté en place passerait inaperçu :
    les prédictions sont identiques, seuls les noms de variables diffèrent."""
    assert list(main.modele_credit.feature_names_in_) == [
        "montant", "jours_avant_echeance", "credits_passes", "taux_rembourse", "retard_moyen_jours",
    ]
    assert main.modele_demande is not None
