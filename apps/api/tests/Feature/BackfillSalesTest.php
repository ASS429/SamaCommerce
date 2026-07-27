<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

class BackfillSalesTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    /** T2 — la commande reconstitue cogs/quantite_base des ventes pré-Phase 6. */
    public function test_backfill_reconstructs_legacy_sales(): void
    {
        [$owner] = $this->registerOwner();
        $product = Product::create([
            'user_id' => $owner->id, 'name' => 'Sucre', 'price' => 600, 'price_achat' => 450, 'stock' => 100, 'unite_base' => 'piece',
        ]);

        // Vente "legacy" : champs Phase 6 à null.
        $legacy = Sale::create([
            'user_id' => $owner->id, 'product_id' => $product->id, 'quantity' => 3, 'total' => 1500, 'payment_method' => 'especes', 'paid' => true,
        ]);
        $this->assertNull($legacy->cogs);

        $this->artisan('sales:backfill')->assertOk();

        $legacy->refresh();
        $this->assertTrue($legacy->backfilled);
        $this->assertSame(3 * 1, $legacy->quantite_base);      // quantity × facteur (piece → 1)
        $this->assertSame(3 * 450, $legacy->cogs);             // quantité × prix d'achat
        $this->assertSame(500, $legacy->prix_reel);            // total / quantité
        $this->assertSame(300, $legacy->remise);               // refTotal (1800) − total (1500)

        // Idempotent : un second passage ne retouche rien.
        $this->artisan('sales:backfill')->expectsOutputToContain('Aucune vente')->assertOk();
    }
}
