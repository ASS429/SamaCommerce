<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * T8 — Contrat JSON figé d'une vente : montants entiers, dates ISO 8601.
 * `product_name` n'est présent que sur les endpoints de liste (jointure) ; il
 * vaut null ailleurs, ce qui est sans effet côté client.
 */
class SaleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'boutique_id' => $this->boutique_id,
            'product_id' => $this->product_id,
            'product_name' => $this->product_name ?? null,
            'quantity' => (int) $this->quantity,
            'total' => (int) $this->total,
            'payment_method' => $this->payment_method,
            'client_id' => $this->client_id,
            'client_name' => $this->client_name,
            'client_phone' => $this->client_phone,
            'due_date' => $this->due_date,
            'paid' => (bool) $this->paid,
            'repayment_method' => $this->repayment_method ?? null,
            'quantite_base' => $this->quantite_base,
            'unit_id' => $this->unit_id,
            'unit_libelle' => $this->unit_libelle,
            'prix_reference' => $this->prix_reference,
            'prix_reel' => $this->prix_reel,
            'remise' => $this->remise,
            'cogs' => $this->cogs,
            'backfilled' => (bool) $this->backfilled,
            'vendu_par_nom' => $this->vendu_par_nom ?? null,
            'created_at' => $this->created_at,
        ];
    }
}
