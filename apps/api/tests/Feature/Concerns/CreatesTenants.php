<?php

namespace Tests\Feature\Concerns;

use App\Models\BoutiqueMember;
use App\Models\User;

/**
 * Helpers de test : créer des commerçants (via l'API register, qui crée aussi la
 * boutique principale + le token) et des employés (BoutiqueMember accepté).
 */
trait CreatesTenants
{
    /** Enregistre un commerçant et renvoie [User, token]. */
    protected function registerOwner(string $username = 'owner@test.sn', string $company = 'Boutique Test'): array
    {
        $res = $this->postJson('/api/auth/register', [
            'username' => $username,
            'password' => 'Password123',
            'company_name' => $company,
        ])->assertCreated();

        return [User::where('username', $username)->firstOrFail(), $res->json('token')];
    }

    /** Crée un employé rattaché au propriétaire, renvoie [User, token]. */
    protected function createEmployee(User $owner, array $permissions, string $username = 'emp@test.sn'): array
    {
        [$emp, $token] = $this->registerOwner($username, 'Perso');

        BoutiqueMember::create([
            'owner_id' => $owner->id,
            'ref_boutique_id' => $owner->current_boutique_id,
            'member_id' => $emp->id,
            'email' => $username,
            'role' => 'employe',
            'status' => 'accepted',
            'permissions' => $permissions,
            'accepted_at' => now(),
        ]);

        return [$emp, $token];
    }

    /**
     * En-têtes Bearer. On oublie les guards résolus avant chaque requête : en
     * test, l'app est réutilisée entre les appels HTTP et le guard Sanctum
     * mettrait sinon en cache le PREMIER utilisateur authentifié (en prod chaque
     * requête est un process neuf → non concerné).
     */
    protected function auth(string $token): array
    {
        $this->app['auth']->forgetGuards();

        return ['Authorization' => 'Bearer '.$token, 'Accept' => 'application/json'];
    }
}
