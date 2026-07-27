<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminUserController extends Controller
{
    public function index()
    {
        return User::orderByDesc('id')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'unique:users,username'],
            'company_name' => ['nullable', 'string'],
            'phone' => ['nullable', 'string'],
            'plan' => ['nullable', 'in:Free,Premium'],
            'payment_method' => ['nullable', 'string'],
        ]);

        $user = User::create([
            'username' => $data['username'],
            'password' => Hash::make('password'),
            'company_name' => $data['company_name'] ?? null,
            'phone' => $data['phone'] ?? null,
            'plan' => $data['plan'] ?? 'Free',
            'payment_method' => $data['payment_method'] ?? null,
            'upgrade_status' => ($data['plan'] ?? 'Free') === 'Premium' ? 'en attente' : 'validé',
        ]);

        return response()->json($user, 201);
    }

    public function block(int $id)
    {
        $user = User::findOrFail($id);
        $user->update(['status' => 'Bloqué']);
        return $user;
    }

    public function activate(int $id)
    {
        $user = User::findOrFail($id);
        $user->update(['status' => 'Actif', 'payment_status' => 'À jour']);
        return $user;
    }

    public function destroy(int $id)
    {
        User::findOrFail($id)->delete();
        return response()->json(['message' => 'Utilisateur supprimé']);
    }

    public function reminder(int $id)
    {
        $user = User::findOrFail($id);
        return response()->json(['message' => "Rappel envoyé à {$user->username}"]);
    }

    public function approveUpgrade(int $id)
    {
        $user = User::findOrFail($id);
        $user->update(['plan' => 'Premium', 'upgrade_status' => 'validé']);
        return $user;
    }

    public function rejectUpgrade(int $id)
    {
        $user = User::findOrFail($id);
        $user->update(['plan' => 'Free', 'upgrade_status' => 'rejeté']);
        return $user;
    }
}
