<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RestockDelivery extends Model
{
    protected $fillable = ['user_id', 'boutique_id', 'commande_id', 'tracking_note', 'status', 'delivered_at'];

    protected $casts = ['delivered_at' => 'datetime'];

    public function commande(): BelongsTo
    {
        return $this->belongsTo(RestockOrder::class, 'commande_id');
    }
}
