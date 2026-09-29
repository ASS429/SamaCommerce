<?php

namespace App\Models;

class TransfertAdmin extends Modele
{
    protected $table = 'transferts_admin';

    protected $fillable = ['admin_id', 'compte_source', 'compte_destination', 'montant'];

    protected $casts = ['montant' => 'decimal:2'];
}
