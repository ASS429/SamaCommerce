<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

/**
 * Réglages d'écran synchronisés (sections masquées, impression automatique).
 *
 * Le point délicat : pour un employé, `$request->user()` désigne le
 * PROPRIÉTAIRE (middleware ResolveTenant). Écrire les préférences là
 * écraserait l'écran du patron et les partagerait entre tous ses vendeurs —
 * ces tests verrouillent le cloisonnement.
 */
class PreferencesTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    public function test_preferences_are_empty_by_default(): void
    {
        [, $token] = $this->registerOwner();

        $me = $this->getJson('/api/auth/me', $this->auth($token))->assertOk()->json();
        $this->assertSame([], (array) $me['preferences']);
    }

    public function test_preferences_round_trip_through_me(): void
    {
        [, $token] = $this->registerOwner();

        $this->putJson('/api/auth/preferences', [
            'modules_off' => ['caisse', 'equipe'], 'auto_print' => true,
        ], $this->auth($token))->assertOk();

        $me = $this->getJson('/api/auth/me', $this->auth($token))->assertOk()->json();
        $this->assertSame(['caisse', 'equipe'], $me['preferences']['modules_off']);
        $this->assertTrue($me['preferences']['auto_print']);
    }

    public function test_partial_update_merges_instead_of_replacing(): void
    {
        [, $token] = $this->registerOwner();

        $this->putJson('/api/auth/preferences', ['modules_off' => ['caisse'], 'auto_print' => true], $this->auth($token))->assertOk();
        // Un appareil qui n'envoie qu'une option ne doit pas effacer les autres.
        $res = $this->putJson('/api/auth/preferences', ['auto_print' => false], $this->auth($token))->assertOk()->json();

        $this->assertSame(['caisse'], $res['preferences']['modules_off']);
        $this->assertFalse($res['preferences']['auto_print']);
    }

    public function test_modules_off_is_deduplicated_and_stays_a_list(): void
    {
        [, $token] = $this->registerOwner();

        $res = $this->putJson('/api/auth/preferences', [
            'modules_off' => ['caisse', 'caisse', 'equipe'],
        ], $this->auth($token))->assertOk()->json();

        $this->assertSame(['caisse', 'equipe'], $res['preferences']['modules_off']);
        // Réindexé : sinon le JSON devient un objet {"0":…,"2":…} illisible côté web.
        $this->assertSame([0, 1], array_keys($res['preferences']['modules_off']));
    }

    public function test_invalid_payloads_are_rejected(): void
    {
        [, $token] = $this->registerOwner();

        $this->putJson('/api/auth/preferences', ['modules_off' => 'caisse'], $this->auth($token))->assertStatus(422);
        $this->putJson('/api/auth/preferences', ['modules_off' => [['x']]], $this->auth($token))->assertStatus(422);
        $this->putJson('/api/auth/preferences', ['auto_print' => 'peut-être'], $this->auth($token))->assertStatus(422);
    }

    public function test_employee_preferences_do_not_leak_into_the_owner_account(): void
    {
        [$owner, $ownerToken] = $this->registerOwner();
        [, $empToken] = $this->createEmployee($owner, ['vente' => true]);

        $this->putJson('/api/auth/preferences', ['modules_off' => ['caisse']], $this->auth($ownerToken))->assertOk();
        $this->putJson('/api/auth/preferences', ['modules_off' => ['rapports', 'clients']], $this->auth($empToken))->assertOk();

        // Chacun garde SON écran, alors que l'employé travaille sur les données
        // du propriétaire.
        $meOwner = $this->getJson('/api/auth/me', $this->auth($ownerToken))->assertOk()->json();
        $meEmp = $this->getJson('/api/auth/me', $this->auth($empToken))->assertOk()->json();

        $this->assertSame(['caisse'], $meOwner['preferences']['modules_off']);
        $this->assertSame(['rapports', 'clients'], $meEmp['preferences']['modules_off']);
        // L'employé voit bien la boutique du patron : le cloisonnement ne porte
        // que sur les réglages d'affichage.
        $this->assertTrue($meEmp['is_employee']);
    }
}
