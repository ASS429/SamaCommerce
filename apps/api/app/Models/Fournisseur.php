<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Fournisseur extends Modele
{
    protected $table = 'fournisseurs';

    protected $fillable = ['utilisateur_id', 'boutique_id', 'nom', 'telephone', 'email', 'adresse', 'notes', 'photo'];

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class);
    }
}
