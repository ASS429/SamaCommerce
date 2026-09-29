<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Livraison extends Modele
{
    protected $table = 'livraisons';

    protected $fillable = ['utilisateur_id', 'boutique_id', 'commande_id', 'note_suivi', 'statut', 'livree_le'];

    protected $casts = ['livree_le' => 'datetime'];

    public function commande(): BelongsTo
    {
        return $this->belongsTo(Commande::class, 'commande_id');
    }
}
