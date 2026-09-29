<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Retrait extends Modele
{
    protected $table = 'retraits';

    protected $fillable = ['admin_id', 'montant', 'moyen', 'statut'];

    protected $casts = ['montant' => 'decimal:2'];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'admin_id');
    }
}
