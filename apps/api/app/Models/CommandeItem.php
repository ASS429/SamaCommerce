<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommandeItem extends Model
{
    protected $fillable = ['commande_id', 'product_id', 'quantity', 'prix_unitaire'];

    protected $casts = ['quantity' => 'integer', 'prix_unitaire' => 'decimal:2'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
