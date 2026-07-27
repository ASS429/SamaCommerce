<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** T8 — Contrat JSON figé d'une catégorie. */
class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'name' => $this->name,
            'emoji' => $this->emoji,
            'couleur' => $this->couleur,
            'negociable' => (bool) $this->negociable,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
