<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CaisseClosing extends Model
{
    protected $fillable = [
        'user_id', 'boutique_id', 'date', 'total_especes', 'total_wave', 'total_orange',
        'total_credits', 'total_retours', 'total_net', 'nb_ventes', 'notes',
    ];

    protected $casts = [
        'total_especes' => 'decimal:2', 'total_wave' => 'decimal:2', 'total_orange' => 'decimal:2',
        'total_credits' => 'decimal:2', 'total_retours' => 'decimal:2', 'total_net' => 'decimal:2',
        'nb_ventes' => 'integer',
    ];
}
