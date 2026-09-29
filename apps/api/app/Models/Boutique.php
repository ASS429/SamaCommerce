<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Boutique extends Modele
{
    protected $table = 'boutiques';

    protected $fillable = ['proprietaire_id', 'nom', 'telephone', 'adresse', 'emoji', 'est_principale', 'photo'];

    protected $casts = ['est_principale' => 'boolean'];

    public function proprietaire(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'proprietaire_id');
    }
}
