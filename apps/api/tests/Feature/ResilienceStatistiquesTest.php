<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * Le cache des statistiques (T13) est une OPTIMISATION, jamais une dépendance :
 * si le magasin de cache tombe (collision d'écriture concurrente constatée en
 * production), les statistiques doivent être recalculées, pas renvoyer un 500.
 */
class ResilienceStatistiquesTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    public function test_les_statistiques_repondent_meme_si_le_cache_tombe(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->postJson('/api/produits', ['nom' => 'Riz', 'prix_vente' => 600, 'prix_achat' => 400, 'stock' => 10], $this->entetes($jeton))
            ->assertCreated()->json();
        $this->postJson('/api/ventes', ['produit_id' => $p['id'], 'quantite' => 2, 'moyen_paiement' => 'especes'], $this->entetes($jeton))
            ->assertCreated();

        // Simule un magasin de cache défaillant (toute opération lève).
        Cache::shouldReceive('get')->andThrow(new \RuntimeException('cache en panne'));
        Cache::shouldReceive('remember')->andThrow(new \RuntimeException('cache en panne'));
        Cache::shouldReceive('forever')->andThrow(new \RuntimeException('cache en panne'));

        // Les 4 routes mises en cache doivent RÉPONDRE malgré la panne.
        foreach ([
            '/api/statistiques/ventes-par-jour',
            '/api/statistiques/rotation-stock',
            '/api/statistiques/marge-categorie',
            '/api/statistiques/meilleurs-clients',
        ] as $route) {
            $this->getJson($route, $this->entetes($jeton))->assertOk();
        }
    }
}
