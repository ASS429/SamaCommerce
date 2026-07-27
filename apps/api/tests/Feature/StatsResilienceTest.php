<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

/**
 * Le cache de statistiques (T13) est une OPTIMISATION, jamais une dépendance :
 * si le store de cache tombe (collision d'écriture concurrente constatée en
 * production), les statistiques doivent être recalculées, pas renvoyer un 500.
 */
class StatsResilienceTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    public function test_stats_still_work_when_cache_store_fails(): void
    {
        [, $token] = $this->registerOwner();
        $p = $this->postJson('/api/products', ['name' => 'Riz', 'price' => 600, 'price_achat' => 400, 'stock' => 10], $this->auth($token))
            ->assertCreated()->json();
        $this->postJson('/api/sales', ['product_id' => $p['id'], 'quantity' => 2, 'payment_method' => 'especes'], $this->auth($token))
            ->assertCreated();

        // Simule un store de cache défaillant (toute opération lève).
        Cache::shouldReceive('get')->andThrow(new \RuntimeException('cache down'));
        Cache::shouldReceive('remember')->andThrow(new \RuntimeException('cache down'));
        Cache::shouldReceive('forever')->andThrow(new \RuntimeException('cache down'));

        // Les 4 endpoints mis en cache doivent RÉPONDRE malgré la panne.
        foreach ([
            '/api/stats/ventes-par-jour',
            '/api/stats/rotation-stock',
            '/api/stats/marge-categorie',
            '/api/stats/meilleurs-clients',
        ] as $endpoint) {
            $this->getJson($endpoint, $this->auth($token))->assertOk();
        }
    }
}
