<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Retour extends Modele
{
    protected $table = 'retours';

    protected $fillable = [
        'vente_id', 'produit_id', 'utilisateur_id', 'boutique_id',
        'quantite', 'motif', 'moyen_remboursement', 'montant_rembourse',
    ];

    protected $casts = ['quantite' => 'integer', 'montant_rembourse' => 'decimal:2'];

    public function vente(): BelongsTo
    {
        return $this->belongsTo(Vente::class);
    }

    public function produit(): BelongsTo
    {
        return $this->belongsTo(Produit::class);
    }
}
