<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminSetting extends Model
{
    protected $fillable = [
        'admin_id', 'app_name', 'contact_email', 'timezone', 'premium_price',
        'grace_period', 'alerts_enabled', 'notify_new_subs', 'notify_late_payments',
        'notify_reports', 'multi_sessions', 'twofa_enabled',
    ];

    protected $casts = [
        'premium_price' => 'decimal:2',
        'grace_period' => 'integer',
        'alerts_enabled' => 'boolean',
        'notify_new_subs' => 'boolean',
        'notify_late_payments' => 'boolean',
        'notify_reports' => 'boolean',
        'multi_sessions' => 'boolean',
        'twofa_enabled' => 'boolean',
    ];
}
