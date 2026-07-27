<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminSetting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function show(Request $request)
    {
        return AdminSetting::firstOrCreate(['admin_id' => $request->user()->id]);
    }

    public function update(Request $request)
    {
        $setting = AdminSetting::firstOrCreate(['admin_id' => $request->user()->id]);

        $setting->update($request->validate([
            'app_name' => ['nullable', 'string'],
            'contact_email' => ['nullable', 'string'],
            'timezone' => ['nullable', 'string'],
            'premium_price' => ['nullable', 'numeric'],
            'grace_period' => ['nullable', 'integer'],
            'alerts_enabled' => ['nullable', 'boolean'],
            'notify_new_subs' => ['nullable', 'boolean'],
            'notify_late_payments' => ['nullable', 'boolean'],
            'notify_reports' => ['nullable', 'boolean'],
            'multi_sessions' => ['nullable', 'boolean'],
        ]));

        return response()->json(['message' => 'Paramètres mis à jour', 'settings' => $setting]);
    }

    public function toggle2fa(Request $request)
    {
        $setting = AdminSetting::firstOrCreate(['admin_id' => $request->user()->id]);
        $setting->update(['twofa_enabled' => ! $setting->twofa_enabled]);

        return response()->json(['message' => '2FA mis à jour', 'enabled' => $setting->twofa_enabled]);
    }
}
