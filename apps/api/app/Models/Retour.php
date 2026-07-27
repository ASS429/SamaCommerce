<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Retour extends Model
{
    protected $table = 'returns';

    protected $fillable = [
        'sale_id', 'product_id', 'user_id', 'boutique_id',
        'quantity', 'reason', 'refund_method', 'refund_amount',
    ];

    protected $casts = ['quantity' => 'integer', 'refund_amount' => 'decimal:2'];

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
