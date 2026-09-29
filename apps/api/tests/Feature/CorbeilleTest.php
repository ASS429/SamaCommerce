<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

class CorbeilleTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    /** T4 — un produit supprimé va à la corbeille et peut être restauré. */
    public function test_un_produit_supprime_va_a_la_corbeille_puis_revient(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->postJson('/api/produits', ['nom' => 'Bissap'], $this->entetes($jeton))->assertCreated()->json();

        $this->deleteJson('/api/produits/'.$p['id'], [], $this->entetes($jeton))->assertOk();

        // Absent de la liste active, présent en corbeille.
        $this->assertCount(0, $this->getJson('/api/produits', $this->entetes($jeton))->json());
        $this->assertCount(1, $this->getJson('/api/produits/corbeille', $this->entetes($jeton))->json());

        // Restauration → de nouveau actif.
        $this->postJson('/api/produits/'.$p['id'].'/restaurer', [], $this->entetes($jeton))->assertOk();
        $this->assertCount(1, $this->getJson('/api/produits', $this->entetes($jeton))->json());
        $this->assertCount(0, $this->getJson('/api/produits/corbeille', $this->entetes($jeton))->json());
    }
}
