<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Boutique extends Model
{
    protected $fillable = ['owner_id', 'name', 'phone', 'address', 'emoji', 'is_primary', 'photo'];

    protected $casts = ['is_primary' => 'boolean'];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }
}
