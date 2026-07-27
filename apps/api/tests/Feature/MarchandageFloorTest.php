<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

class MarchandageFloorTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    /** Un employé ne peut pas vendre sous le prix plancher ; le patron, si. */
    public function test_employee_cannot_sell_below_floor_but_owner_can(): void
    {
        [$owner, $ownerToken] = $this->registerOwner('patron@test.sn');

        $product = $this->postJson('/api/products', [
            'name' => 'Sac de riz', 'price' => 800, 'price_achat' => 500, 'stock' => 100,
            'unite_base' => 'piece', 'prix_min' => 500, 'negociable' => true,
        ], $this->auth($ownerToken))->assertCreated()->json();

        [, $empToken] = $this->createEmployee($owner, ['vente' => true]);

        // Employé sous le plancher (400 < 500) → refusé.
        $this->postJson('/api/sales', [
            'product_id' => $product['id'], 'quantite_base' => 1, 'prix_reel' => 400, 'payment_method' => 'especes',
        ], $this->auth($empToken))->assertStatus(422);

        // Patron sous le plancher → autorisé (il fixe ses prix).
        $this->postJson('/api/sales', [
            'product_id' => $product['id'], 'quantite_base' => 1, 'prix_reel' => 400, 'payment_method' => 'especes',
        ], $this->auth($ownerToken))->assertCreated();
    }
}
