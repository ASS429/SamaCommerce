<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Alert extends Model
{
    protected $fillable = ['user_id', 'type', 'message', 'days'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
