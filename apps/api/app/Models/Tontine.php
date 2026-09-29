<?php

namespace App\Models;

class Tontine extends Modele
{
    protected $table = 'tontines';

    protected $fillable = ['nom', 'type', 'montant', 'membres', 'date_creation'];

    protected $casts = [
        'montant' => 'decimal:2',
        'membres' => 'integer',
        'date_creation' => 'datetime',
    ];
}
