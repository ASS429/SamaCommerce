<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
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
    /**
     * Émet un jeton pour CET appareil.
     *
     * On révoque l'ancien jeton portant le même nom (pas de jeton orphelin
     * après une reconnexion). Le client envoie donc un `device_name` distinct
     * par appareil : sans lui, tous s'appelaient « app » et se connecter sur le
     * téléphone déconnectait le PC dans la seconde.
     */
    private function issueToken(User $user, Request $request): string
    {
        $device = (string) ($request->input('device_name') ?: 'app');
        $user->tokens()->where('name', $device)->delete();

        return $user->createToken($device)->plainTextToken;
    }

    /**
     * Date d'expiration du jeton (config sanctum.expiration, en minutes).
     * Renvoyée au client pour qu'une session qui tombe soit diagnosticable
     * sans accès au serveur — et non plus attribuée au hasard.
     */
    private function tokenExpiry(): ?string
    {
        $minutes = (int) config('sanctum.expiration', 0);

        return $minutes > 0 ? now()->addMinutes($minutes)->toIso8601String() : null;
    }

    /**
     * Utilisateur enrichi pour la réponse de login : l'UI a besoin de
     * is_employee/permissions IMMÉDIATEMENT pour filtrer la navigation
     * (sans attendre le /auth/me asynchrone).
     */
    private function userPayload(User $user): array
    {
        $member = \App\Models\BoutiqueMember::where('member_id', $user->id)
            ->where('status', 'accepted')->first();

        return array_merge($user->toArray(), [
            'is_employee' => (bool) $member,
            'permissions' => $member?->permissions,
        ]);
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
            'token_expires_at' => $this->tokenExpiry(),
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
            'user' => $this->userPayload($user),
            'token' => $this->issueToken($user, $request),
            'token_expires_at' => $this->tokenExpiry(),
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
            'user' => $this->userPayload($user),
            'token' => $this->issueToken($user, $request),
            'token_expires_at' => $this->tokenExpiry(),
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
            // Écrase la valeur venue de toArray() : pour un employé, $user est le
            // PROPRIÉTAIRE, et chacun doit retrouver SES propres réglages d'écran.
            'preferences' => $this->preferencesOwner($request)->preferences ?? new \stdClass,
        ]));
    }

    /**
     * Compte porteur des préférences d'affichage : le compte réellement
     * connecté, jamais le propriétaire résolu par ResolveTenant.
     */
    private function preferencesOwner(Request $request): User
    {
        return $request->attributes->get('real_user') ?? $request->user();
    }

    /**
     * Réglages d'interface synchronisés entre les appareils du même compte
     * (sections masquées, impression automatique du reçu).
     *
     * Fusion et non remplacement : un appareil qui ne connaît pas encore une
     * option future ne doit pas l'effacer en enregistrant les siennes.
     */
    public function updatePreferences(Request $request)
    {
        $data = $request->validate([
            'modules_off' => ['nullable', 'array', 'max:40'],
            'modules_off.*' => ['string', 'max:32'],
            'auto_print' => ['nullable', 'boolean'],
        ]);

        $user = $this->preferencesOwner($request);
        $merged = array_merge($user->preferences ?? [], $data);

        // `modules_off` est une LISTE : on la dédoublonne et on la réindexe,
        // sinon le JSON stocké devient un objet {"0":…,"2":…} après filtrage.
        if (isset($merged['modules_off'])) {
            $merged['modules_off'] = array_values(array_unique($merged['modules_off']));
        }

        $user->update(['preferences' => $merged]);

        return response()->json(['preferences' => $merged]);
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
            'photo' => self::PHOTO_RULES,
        ]);

        $user = $request->user();
        // array_filter écarte les valeurs vides : on ne veut pas effacer le nom
        // de la boutique parce que le champ n'était pas dans la requête. La photo
        // fait exception — `null` y signifie « retirer la photo », un geste
        // explicite de l'utilisateur.
        $user->update(array_filter($data, fn ($v) => $v !== null && $v !== ''));
        if ($request->exists('photo')) {
            $user->update(['photo' => $data['photo'] ?? null]);
        }

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

        $envoye = $this->envoyerCodeParEmail($user, $code);

        return response()->json([
            'message' => $envoye
                ? 'Code envoyé par e-mail. Pensez à regarder vos courriers indésirables.'
                : "Code généré, mais l'e-mail n'a pas pu partir. Contactez la boutique.",
            'envoye' => $envoye,
            // S7 — le code n'est exposé QUE en local+debug (logique inversée : un
            // .env de prod mal réglé ne fuite plus de codes).
            'dev_code' => (app()->environment('local') && config('app.debug')) ? $code : null,
        ]);
    }

    /**
     * Envoie le code de réinitialisation.
     *
     * Jusqu'ici le code était généré... et n'allait NULLE PART : aucun mailer
     * n'était configuré. L'utilisateur lisait « un code a été envoyé », ne
     * recevait rien, et se retrouvait enfermé dehors avec son stock et ses
     * ventes à l'intérieur. Pour un commerçant, c'était irréparable.
     *
     * L'échec d'envoi ne fait pas échouer la requête : le code EXISTE en base,
     * le propriétaire peut donc encore dépanner. Mais on le journalise, car un
     * envoi muet est exactement le défaut qu'on vient de corriger.
     */
    private function envoyerCodeParEmail(User $user, string $code): bool
    {
        // Un identifiant qui n'est pas une adresse (compte créé à la main) :
        // rien à envoyer, inutile de faire semblant.
        if (! filter_var($user->username, FILTER_VALIDATE_EMAIL)) {
            Log::warning('[mdp-oublie] identifiant non-email, envoi impossible');

            return false;
        }

        $nom = $user->company_name ?: 'Bonjour';

        try {
            Mail::to($user->username)->send(
                new \App\Mail\CodeReinitialisation($code, $nom)
            );

            return true;
        } catch (\Throwable $e) {
            // On ne renvoie JAMAIS le détail au client : il indiquerait si le
            // compte existe, et exposerait la configuration du serveur.
            Log::error('[mdp-oublie] envoi impossible : '.$e->getMessage());

            return false;
        }
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
