<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Fournisseur extends Model
{
    protected $table = 'fournisseurs';

    protected $fillable = ['user_id', 'boutique_id', 'name', 'phone', 'email', 'address', 'notes'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
