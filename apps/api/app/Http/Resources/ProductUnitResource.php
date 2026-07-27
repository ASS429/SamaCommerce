<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** T8 — Contrat figé d'un conditionnement de gros. */
class ProductUnitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'libelle' => $this->libelle,
            'facteur' => (int) $this->facteur,
            'prix' => (int) $this->prix,
        ];
    }
}
