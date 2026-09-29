<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Conditionnement de gros d'un produit : sac, bidon, carton… */
class Conditionnement extends Modele
{
    protected $table = 'conditionnements';

    protected $fillable = ['produit_id', 'libelle', 'facteur', 'prix'];

    protected $casts = [
        'facteur' => 'integer',
        'prix' => 'integer',
    ];

    public function produit(): BelongsTo
    {
        return $this->belongsTo(Produit::class);
    }
}
