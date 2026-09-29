<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Client extends Modele
{
    use SoftDeletes; // T4 — corbeille + restauration

    protected $table = 'clients';

    protected $fillable = ['utilisateur_id', 'boutique_id', 'nom', 'telephone', 'email', 'adresse', 'notes', 'photo'];

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class);
    }

    public function ventes(): HasMany
    {
        return $this->hasMany(Vente::class);
    }
}
