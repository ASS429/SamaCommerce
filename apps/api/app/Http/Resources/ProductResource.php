<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * T8 — Contrat JSON figé d'un produit : montants en entiers (FCFA), dates ISO 8601.
 * Découple la forme de l'API du schéma Eloquent (une colonne ajoutée ne fuit plus
 * automatiquement dans la réponse).
 */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'boutique_id' => $this->boutique_id,
            'name' => $this->name,
            'category_id' => $this->category_id,
            'scent' => $this->scent,
            'barcode' => $this->barcode,
            'price' => (int) $this->price,
            'price_achat' => (int) $this->price_achat,
            'stock' => (int) $this->stock,
            'unite_base' => $this->unite_base,
            'prix_min' => $this->prix_min === null ? null : (int) $this->prix_min,
            'negociable' => $this->negociable, // bool | null (null = hérite de la catégorie)
            // Photo de l'article (data-URL réduite à 256 px). C'est l'élément
            // d'identification principal pour un vendeur qui ne lit pas : elle
            // fait donc partie du contrat de la LISTE, pas d'un appel séparé.
            'photo' => $this->photo,
            'units' => ProductUnitResource::collection($this->whenLoaded('units')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
