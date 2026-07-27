<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

class RbacTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    /** S9 — un employé "vente uniquement" vend (et LIT le catalogue pour le
     *  POS) mais ne peut ni modifier le stock ni gérer les catégories. */
    public function test_employee_permissions_are_enforced(): void
    {
        [$owner] = $this->registerOwner('patron@test.sn');
        [, $empToken] = $this->createEmployee($owner, ['vente' => true]);

        // Autorisé : ventes + LECTURE produits/catégories (nécessaire au POS).
        $this->getJson('/api/sales', $this->auth($empToken))->assertOk();
        $this->getJson('/api/products', $this->auth($empToken))->assertOk();
        $this->getJson('/api/categories', $this->auth($empToken))->assertOk();
        // Refusé : ÉCRITURE stock/catégories et corbeille (gestion du stock).
        $this->postJson('/api/products', ['name' => 'X'], $this->auth($empToken))->assertStatus(403);
        $this->getJson('/api/products/trash', $this->auth($empToken))->assertStatus(403);
        $this->postJson('/api/categories', ['name' => 'X'], $this->auth($empToken))->assertStatus(403);
        // Refusé : sections sans permission (fournisseurs).
        $this->getJson('/api/fournisseurs', $this->auth($empToken))->assertStatus(403);
    }

    /** Le login renvoie is_employee + permissions (gating immédiat de l'UI). */
    public function test_login_returns_permissions_for_employee(): void
    {
        [$owner] = $this->registerOwner('patron@test.sn');
        $this->createEmployee($owner, ['vente' => true, 'caisse' => true]);

        $res = $this->postJson('/api/auth/login', ['username' => 'emp@test.sn', 'password' => 'Password123'])
            ->assertOk()->json();

        $this->assertTrue($res['user']['is_employee']);
        $this->assertTrue($res['user']['permissions']['vente']);
        $this->assertArrayNotHasKey('stock', array_filter($res['user']['permissions'] ?? []));

        // Un propriétaire, lui, n'est pas employé.
        $res2 = $this->postJson('/api/auth/login', ['username' => 'patron@test.sn', 'password' => 'Password123'])
            ->assertOk()->json();
        $this->assertFalse($res2['user']['is_employee']);
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
