<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

class SoftDeleteTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    /** T4 — un produit supprimé va à la corbeille et peut être restauré. */
    public function test_product_soft_delete_and_restore(): void
    {
        [, $token] = $this->registerOwner();
        $p = $this->postJson('/api/products', ['name' => 'Bissap'], $this->auth($token))->assertCreated()->json();

        $this->deleteJson('/api/products/'.$p['id'], [], $this->auth($token))->assertOk();

        // Absent de la liste active, présent en corbeille.
        $this->assertCount(0, $this->getJson('/api/products', $this->auth($token))->json());
        $this->assertCount(1, $this->getJson('/api/products/trash', $this->auth($token))->json());

        // Restauration → de nouveau actif.
        $this->postJson('/api/products/'.$p['id'].'/restore', [], $this->auth($token))->assertOk();
        $this->assertCount(1, $this->getJson('/api/products', $this->auth($token))->json());
        $this->assertCount(0, $this->getJson('/api/products/trash', $this->auth($token))->json());
    }
}
