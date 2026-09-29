<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Alerte extends Modele
{
    protected $table = 'alertes';

    protected $fillable = ['utilisateur_id', 'type', 'message', 'jours'];

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class);
    }
}
