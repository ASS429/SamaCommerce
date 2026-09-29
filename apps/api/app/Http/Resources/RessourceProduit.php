<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * T8 — Contrat JSON figé d'un produit : montants en entiers (FCFA), dates ISO 8601.
 * Découple la forme de l'API du schéma Eloquent (une colonne ajoutée ne fuit plus
 * automatiquement dans la réponse).
 */
class RessourceProduit extends JsonResource
{
    public function toArray(Request $requete): array
    {
        return [
            'id' => $this->id,
            'utilisateur_id' => $this->utilisateur_id,
            'boutique_id' => $this->boutique_id,
            'nom' => $this->nom,
            'categorie_id' => $this->categorie_id,
            'description' => $this->description,
            'code_barres' => $this->code_barres,
            'prix_vente' => (int) $this->prix_vente,
            'prix_achat' => (int) $this->prix_achat,
            'stock' => (int) $this->stock,
            'unite_base' => $this->unite_base,
            'prix_min' => $this->prix_min === null ? null : (int) $this->prix_min,
            'negociable' => $this->negociable, // bool | null (null = hérite de la catégorie)
            // Photo de l'article (data-URL réduite à 256 px). C'est l'élément
            // d'identification principal pour un vendeur qui ne lit pas : elle
            // fait donc partie du contrat de la LISTE, pas d'un appel séparé.
            'photo' => $this->photo,
            'conditionnements' => RessourceConditionnement::collection($this->whenLoaded('conditionnements')),
            'cree_le' => $this->cree_le,
            'modifie_le' => $this->modifie_le,
        ];
    }
}
