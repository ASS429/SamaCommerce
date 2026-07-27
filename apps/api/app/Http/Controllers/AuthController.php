<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * S3 — Politique de mot de passe forte : 8 caractères minimum, avec lettres
     * et chiffres. (En production on peut activer ->uncompromised() pour vérifier
     * HaveIBeenPwned, désactivé en dev/test pour ne pas dépendre du réseau.)
     */
    private function passwordRules(): array
    {
        $rule = Password::min(8)->letters()->numbers();
        if (app()->environment('production')) {
            $rule = $rule->uncompromised();
        }

        return ['required', 'string', $rule];
    }

    /**
     * S2 — Émet un token en révoquant d'abord l'ancien token du MÊME appareil
     * (évite l'accumulation de tokens à vie). Le token hérite de l'expiration
     * globale (config sanctum.expiration = 7 jours).
     */
    private function issueToken(User $user, Request $request): string
    {
        $device = (string) ($request->input('device_name') ?: 'app');
        $user->tokens()->where('name', $device)->delete();

        return $user->createToken($device)->plainTextToken;
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'password' => $this->passwordRules(),
            'company_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
        ]);

        $user = User::create([
            'username' => $data['username'],
            'password' => Hash::make($data['password']),
            'company_name' => $data['company_name'] ?? null,
            'phone' => $data['phone'] ?? null,
            'role' => 'user',
            'status' => 'Actif',
            'plan' => 'Free',
            'payment_status' => 'À jour',
            'upgrade_status' => 'validé',
        ]);

        // Boutique principale automatique
        $boutique = $user->boutiques()->create([
            'name' => $data['company_name'] ?? 'Ma Boutique',
            'emoji' => '🏪', 'is_primary' => true,
        ]);
        $user->update(['current_boutique_id' => $boutique->id]);

        return response()->json([
            'message' => 'Compte créé avec succès',
            'user' => $user->fresh(),
            'token' => $this->issueToken($user->fresh(), $request),
        ], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        // S3 — Verrouillage progressif contre le bruteforce (en plus du throttle
        // de route) : 5 échecs par identifiant+IP → blocage 60 s.
        $throttleKey = 'login:'.mb_strtolower($data['username']).'|'.$request->ip();
        if (\Illuminate\Support\Facades\RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = \Illuminate\Support\Facades\RateLimiter::availableIn($throttleKey);
            throw ValidationException::withMessages([
                'username' => ["Trop de tentatives. Réessayez dans {$seconds} secondes."],
            ])->status(429);
        }

        $user = User::where('username', $data['username'])->first();

        // S3 — Message GÉNÉRIQUE (pas d'énumération de comptes : on ne révèle pas
        // si c'est l'identifiant ou le mot de passe qui est faux).
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            \Illuminate\Support\Facades\RateLimiter::hit($throttleKey, 60);
            $this->auditLogin($request, $data['username'], false);
            throw ValidationException::withMessages(['username' => ['Identifiants incorrects.']]);
        }

        if ($user->status === 'Bloqué') {
            return response()->json(['error' => 'Votre compte est bloqué. Veuillez contacter l’administrateur.'], 403);
        }

        \Illuminate\Support\Facades\RateLimiter::clear($throttleKey);

        // 2FA activée : on n'émet PAS de token, on génère un code à vérifier.
        if ($user->twofa_enabled) {
            $code = (string) random_int(100000, 999999);
            DB::table('twofa_codes')->insert([
                'user_id' => $user->id,
                'code' => Hash::make($code),
                'expires_at' => Carbon::now()->addMinutes(10),
                'used' => false,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);

            return response()->json([
                'twofa_required' => true,
                'username' => $user->username,
                'dev_code' => (app()->environment('local') && config('app.debug')) ? $code : null,
            ]);
        }

        $this->auditLogin($request, $user->username, true);

        return response()->json([
            'user' => $user,
            'token' => $this->issueToken($user, $request),
        ]);
    }

    /** Vérifie le code 2FA et émet le token (valable 10 min). */
    public function verify2fa(Request $request)
    {
        $data = $request->validate([
            'username' => ['required', 'string'],
            'code' => ['required', 'string'],
        ]);

        $user = User::where('username', $data['username'])->first();
        if (! $user) {
            throw ValidationException::withMessages(['username' => ['Utilisateur introuvable']]);
        }

        $row = DB::table('twofa_codes')->where('user_id', $user->id)->where('used', false)->orderByDesc('id')->first();
        if (! $row || ! Hash::check($data['code'], $row->code)) {
            throw ValidationException::withMessages(['code' => ['Code invalide']]);
        }
        if (Carbon::parse($row->expires_at)->isPast()) {
            throw ValidationException::withMessages(['code' => ['Code expiré, reconnectez-vous']]);
        }

        DB::table('twofa_codes')->where('id', $row->id)->update(['used' => true, 'updated_at' => Carbon::now()]);

        $this->auditLogin($request, $user->username, true);

        return response()->json([
            'user' => $user,
            'token' => $this->issueToken($user, $request),
        ]);
    }

    /**
     * S3 — Audit des connexions (succès et échecs) : journal structuré JSON avec
     * IP et user-agent. Sert au diagnostic et à la détection d'intrusion.
     */
    private function auditLogin(Request $request, string $username, bool $success): void
    {
        Log::channel('stack')->info('auth.login', [
            'username' => $username,
            'success' => $success,
            'ip' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
            'at' => Carbon::now()->toIso8601String(),
        ]);
    }

    /** Active/désactive la 2FA pour le compte réellement connecté. */
    public function toggle2fa(Request $request)
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);
        $user = $request->attributes->get('real_user') ?? $request->user();
        $user->update(['twofa_enabled' => $data['enabled']]);

        return response()->json(['twofa_enabled' => $user->twofa_enabled]);
    }

    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json(array_merge($user->toArray(), [
            'is_employee' => $request->attributes->get('is_employee', false),
            'permissions' => $request->attributes->get('permissions'),
            'boutiques' => $user->boutiques()->orderByDesc('is_primary')->get(),
        ]));
    }

    public function logout(Request $request)
    {
        // real_user = compte réellement authentifié (l'employé, le cas échéant),
        // c'est lui qui porte le token courant — pas le propriétaire résolu.
        $real = $request->attributes->get('real_user') ?? $request->user();
        $token = $real->currentAccessToken();
        if ($token) {
            $token->delete();
        }

        return response()->json(['message' => 'Déconnecté.']);
    }

    /** S2 — « Déconnecter tous les appareils » : révoque TOUS les tokens du compte. */
    public function logoutAll(Request $request)
    {
        $real = $request->attributes->get('real_user') ?? $request->user();
        $real->tokens()->delete();

        return response()->json(['message' => 'Déconnecté de tous les appareils.']);
    }

    /** Mise à jour du profil / de la boutique principale. */
    public function updateProfile(Request $request)
    {
        $data = $request->validate([
            'company_name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
        ]);

        $user = $request->user();
        $user->update(array_filter($data, fn ($v) => $v !== null && $v !== ''));

        if (! empty($data['company_name'])) {
            $user->boutiques()->where('is_primary', true)->update(['name' => $data['company_name']]);
        }

        return response()->json($user->fresh());
    }

    /** Demande d'upgrade vers Premium (5000 FCFA, expiration +1 mois). */
    public function upgrade(Request $request)
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'max:32'],
            'payment_method' => ['required', 'string', 'max:32'],
            'amount' => ['required', 'numeric'],
            'expiration' => ['required', 'date'],
        ]);

        $user = $request->user();
        $user->update([
            'phone' => $data['phone'],
            'plan' => 'Premium',
            'payment_method' => $data['payment_method'],
            'amount' => $data['amount'],
            'expiration' => Carbon::parse($data['expiration']),
            'upgrade_status' => 'en attente',
            'payment_status' => 'À jour',
        ]);

        return response()->json(['message' => 'Demande d’upgrade enregistrée', 'user' => $user]);
    }

    /** Génère un code de réinitialisation (6 chiffres). En prod : envoi SMS/email ; en dev : renvoyé. */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['username' => ['required', 'string']]);
        $user = User::where('username', $data['username'])->first();

        // Message générique : ne révèle pas si le compte existe.
        if (! $user) {
            return response()->json(['message' => 'Si ce compte existe, un code a été envoyé.']);
        }

        $code = (string) random_int(100000, 999999);
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->username],
            ['token' => Hash::make($code), 'created_at' => Carbon::now()],
        );

        return response()->json([
            'message' => 'Code de réinitialisation généré.',
            // S7 — le code n'est exposé QUE en local+debug (logique inversée : un
            // .env de prod mal réglé ne fuite plus de codes).
            'dev_code' => (app()->environment('local') && config('app.debug')) ? $code : null,
        ]);
    }

    /** Réinitialise le mot de passe avec le code reçu (valable 30 min). */
    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'username' => ['required', 'string'],
            'code' => ['required', 'string'],
            'password' => $this->passwordRules(),
        ]);

        $row = DB::table('password_reset_tokens')->where('email', $data['username'])->first();
        if (! $row || ! Hash::check($data['code'], $row->token)) {
            throw ValidationException::withMessages(['code' => ['Code invalide']]);
        }
        if (Carbon::parse($row->created_at)->addMinutes(30)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $data['username'])->delete();
            throw ValidationException::withMessages(['code' => ['Code expiré, redemandez-en un']]);
        }

        $user = User::where('username', $data['username'])->firstOrFail();
        $user->update(['password' => Hash::make($data['password'])]);
        DB::table('password_reset_tokens')->where('email', $data['username'])->delete();

        return response()->json(['message' => 'Mot de passe réinitialisé. Connectez-vous.']);
    }
}
