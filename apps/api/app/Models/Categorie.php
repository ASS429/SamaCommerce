<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Categorie extends Modele
{
    protected $table = 'categories';

    protected $fillable = ['utilisateur_id', 'nom', 'emoji', 'couleur', 'negociable'];

    protected $casts = ['negociable' => 'boolean'];

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class);
    }

    public function produits(): HasMany
    {
        return $this->hasMany(Produit::class);
    }
}
