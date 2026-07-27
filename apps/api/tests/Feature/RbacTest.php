<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    /** S9 — un employé "vente uniquement" voit les ventes mais pas le stock. */
    public function test_employee_permissions_are_enforced(): void
    {
        [$owner] = $this->registerOwner('patron@test.sn');
        [, $empToken] = $this->createEmployee($owner, ['vente' => true]);

        // Autorisé : ventes.
        $this->getJson('/api/sales', $this->auth($empToken))->assertOk();
        // Refusé : stock (pas la permission).
        $this->getJson('/api/products', $this->auth($empToken))->assertStatus(403);
        // Refusé : catégories.
        $this->getJson('/api/categories', $this->auth($empToken))->assertStatus(403);
    }

    /** L'employé opère sur les données du PROPRIÉTAIRE (résolution de tenant). */
    public function test_employee_sees_owner_data(): void
    {
        [$owner, $ownerToken] = $this->registerOwner('patron@test.sn');
        $this->postJson('/api/products', ['name' => 'Riz patron'], $this->auth($ownerToken))->assertCreated();

        [, $empToken] = $this->createEmployee($owner, ['vente' => true, 'stock' => true]);
        $list = $this->getJson('/api/products', $this->auth($empToken))->assertOk()->json();

        $this->assertCount(1, $list);
        $this->assertSame('Riz patron', $list[0]['name']);
    }
}
