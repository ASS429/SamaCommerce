<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tontine extends Model
{
    protected $fillable = ['name', 'type', 'amount', 'members', 'created_date'];

    protected $casts = [
        'amount' => 'decimal:2',
        'members' => 'integer',
        'created_date' => 'datetime',
    ];
}
