<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RestockOrder extends Model
{
    protected $fillable = ['user_id', 'boutique_id', 'fournisseur_id', 'total', 'notes', 'expected_date', 'status'];

    protected $casts = ['total' => 'decimal:2', 'expected_date' => 'date'];

    public function fournisseur(): BelongsTo
    {
        return $this->belongsTo(Fournisseur::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(CommandeItem::class, 'commande_id');
    }
}
