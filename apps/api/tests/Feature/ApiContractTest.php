<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

/**
 * T8 — Le contrat JSON figé (API Resources) : montants entiers, forme stable,
 * et le namespace versionné /api/v1 sert exactement les mêmes données.
 */
class ApiContractTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    public function test_product_resource_freezes_shape_and_integer_amounts(): void
    {
        [, $token] = $this->registerOwner();

        // Prix envoyé en "numérique" ; le contrat le renvoie en ENTIER.
        $created = $this->postJson('/api/products', [
            'name' => 'Riz', 'price' => 600, 'price_achat' => 450, 'stock' => 20,
        ], $this->auth($token))->assertCreated()->json();

        $this->assertIsInt($created['price']);
        $this->assertIsInt($created['stock']);
        $this->assertSame(600, $created['price']);
        $this->assertArrayHasKey('units', $created);           // relation exposée
        $this->assertArrayNotHasKey('deleted_at', $created);   // colonne interne non exposée

        // La liste est un tableau PLAT (withoutWrapping) — pas d'enveloppe {data}.
        $list = $this->getJson('/api/products', $this->auth($token))->assertOk()->json();
        $this->assertArrayHasKey(0, $list);
        $this->assertIsInt($list[0]['price']);
    }

    public function test_v1_namespace_serves_same_contract(): void
    {
        [, $token] = $this->registerOwner();
        $this->postJson('/api/products', ['name' => 'Sucre', 'price' => 700, 'stock' => 5], $this->auth($token))->assertCreated();

        $v1 = $this->getJson('/api/v1/products', $this->auth($token))->assertOk()->json();
        $this->assertSame('Sucre', $v1[0]['name']);
        $this->assertIsInt($v1[0]['price']);
        $this->assertSame(700, $v1[0]['price']);
    }

    public function test_sales_pagination_keeps_envelope(): void
    {
        [, $token] = $this->registerOwner();
        $p = $this->postJson('/api/products', ['name' => 'Café', 'price' => 250, 'stock' => 100], $this->auth($token))->assertCreated()->json();
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/sales', ['product_id' => $p['id'], 'quantity' => 1, 'payment_method' => 'especes'], $this->auth($token))->assertCreated();
        }

        // ?page= → enveloppe pagination conservée (le front en dépend).
        $page = $this->getJson('/api/sales?page=1&per_page=2', $this->auth($token))->assertOk()->json();
        $this->assertArrayHasKey('current_page', $page);
        $this->assertArrayHasKey('last_page', $page);
        $this->assertArrayHasKey('total', $page);
        $this->assertIsInt($page['data'][0]['total']);

        // Sans ?page= → tableau plat.
        $flat = $this->getJson('/api/sales', $this->auth($token))->assertOk()->json();
        $this->assertArrayHasKey(0, $flat);
        $this->assertArrayHasKey('product_name', $flat[0]);
    }
}
