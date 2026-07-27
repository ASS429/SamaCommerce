<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminTransfer extends Model
{
    protected $fillable = ['admin_id', 'from_account', 'to_account', 'amount'];

    protected $casts = ['amount' => 'decimal:2'];
}
