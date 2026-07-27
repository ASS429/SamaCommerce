<?php

namespace Tests\Feature;

use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    /** S4 — un commerçant ne peut pas rattacher un produit à la catégorie d'un autre. */
    public function test_cannot_use_other_tenant_category(): void
    {
        [$a, $tokenA] = $this->registerOwner('a@test.sn');
        [$b] = $this->registerOwner('b@test.sn');

        $catB = Category::create(['user_id' => $b->id, 'name' => 'Cat B', 'emoji' => '🍚']);

        // A tente de créer un produit dans la catégorie de B → refusé (422).
        $this->postJson('/api/products', ['name' => 'Riz', 'category_id' => $catB->id], $this->auth($tokenA))
            ->assertStatus(422)
            ->assertJsonValidationErrors('category_id');

        // Avec sa propre catégorie → OK.
        $catA = Category::create(['user_id' => $a->id, 'name' => 'Cat A', 'emoji' => '🥤']);
        $this->postJson('/api/products', ['name' => 'Riz', 'category_id' => $catA->id], $this->auth($tokenA))
            ->assertCreated();
    }

    /** S4 — un commerçant ne voit jamais les produits d'un autre. */
    public function test_products_are_isolated_between_tenants(): void
    {
        [, $tokenA] = $this->registerOwner('a@test.sn');
        [, $tokenB] = $this->registerOwner('b@test.sn');

        $this->postJson('/api/products', ['name' => 'Produit A'], $this->auth($tokenA))->assertCreated();

        $listB = $this->getJson('/api/products', $this->auth($tokenB))->assertOk()->json();
        $this->assertCount(0, $listB);
    }
}
