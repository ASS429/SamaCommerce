<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** T8 — Contrat JSON figé d'une catégorie. */
class RessourceCategorie extends JsonResource
{
    public function toArray(Request $requete): array
    {
        return [
            'id' => $this->id,
            'utilisateur_id' => $this->utilisateur_id,
            'nom' => $this->nom,
            'emoji' => $this->emoji,
            'couleur' => $this->couleur,
            'negociable' => (bool) $this->negociable,
            'cree_le' => $this->cree_le,
            'modifie_le' => $this->modifie_le,
        ];
    }
}
