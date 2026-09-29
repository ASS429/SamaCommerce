<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LigneCommande extends Modele
{
    protected $table = 'lignes_commande';

    protected $fillable = ['commande_id', 'produit_id', 'quantite', 'prix_unitaire'];

    protected $casts = ['quantite' => 'integer', 'prix_unitaire' => 'decimal:2'];

    public function produit(): BelongsTo
    {
        return $this->belongsTo(Produit::class);
    }
}
