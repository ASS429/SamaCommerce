<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * T8 — Contrat JSON figé d'une vente : montants entiers, dates ISO 8601.
 * `nom_produit` n'est présent que sur les listes (jointure) ; il vaut null
 * ailleurs, ce qui est sans effet côté client.
 */
class RessourceVente extends JsonResource
{
    public function toArray(Request $requete): array
    {
        return [
            'id' => $this->id,
            'utilisateur_id' => $this->utilisateur_id,
            'boutique_id' => $this->boutique_id,
            'produit_id' => $this->produit_id,
            'nom_produit' => $this->nom_produit ?? null,
            'quantite' => (int) $this->quantite,
            'total' => (int) $this->total,
            'moyen_paiement' => $this->moyen_paiement,
            'client_id' => $this->client_id,
            'nom_client' => $this->nom_client,
            'telephone_client' => $this->telephone_client,
            'date_echeance' => $this->date_echeance,
            'paye' => (bool) $this->paye,
            'moyen_reglement' => $this->moyen_reglement ?? null,
            'quantite_base' => $this->quantite_base,
            'conditionnement_id' => $this->conditionnement_id,
            'libelle_conditionnement' => $this->libelle_conditionnement,
            'prix_reference' => $this->prix_reference,
            'prix_reel' => $this->prix_reel,
            'remise' => $this->remise,
            'cout_marchandises' => $this->cout_marchandises,
            'reconstituee' => (bool) $this->reconstituee,
            'vendu_par_nom' => $this->vendu_par_nom ?? null,
            'cree_le' => $this->cree_le,
        ];
    }
}
