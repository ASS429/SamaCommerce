<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** T8 — Contrat figé d'un conditionnement de gros. */
class RessourceConditionnement extends JsonResource
{
    public function toArray(Request $requete): array
    {
        return [
            'id' => $this->id,
            'produit_id' => $this->produit_id,
            'libelle' => $this->libelle,
            'facteur' => (int) $this->facteur,
            'prix' => (int) $this->prix,
        ];
    }
}
