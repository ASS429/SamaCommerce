<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Commande de réapprovisionnement passée à un fournisseur. */
class Commande extends Modele
{
    protected $table = 'commandes';

    protected $fillable = ['utilisateur_id', 'boutique_id', 'fournisseur_id', 'total', 'notes', 'date_prevue', 'statut'];

    protected $casts = ['total' => 'decimal:2', 'date_prevue' => 'date'];

    public function fournisseur(): BelongsTo
    {
        return $this->belongsTo(Fournisseur::class);
    }

    public function lignes(): HasMany
    {
        return $this->hasMany(LigneCommande::class, 'commande_id');
    }
}
