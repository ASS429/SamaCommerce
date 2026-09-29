<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * La couche de compatibilité (TEMPORAIRE) elle-même : qui reçoit quel format,
 * et le compteur qui dira quand la retirer.
 */
class CompatibiliteTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    public function test_une_adresse_partagee_suit_l_en_tete_du_client(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $this->postJson('/api/categories', ['nom' => 'Boissons'], $this->entetes($jeton))->assertCreated();

        // La nouvelle application s'annonce : format français.
        $francais = $this->getJson('/api/categories', $this->entetes($jeton))->assertOk()->json();
        $this->assertSame('Boissons', $francais[0]['nom']);
        $this->assertArrayNotHasKey('name', $francais[0]);

        // L'ancienne application ne sait rien de l'en-tête : ancien format.
        $this->app['auth']->forgetGuards();
        $ancien = $this->getJson('/api/categories', ['Authorization' => 'Bearer '.$jeton])->assertOk()->json();
        $this->assertSame('Boissons', $ancien[0]['name']);
        $this->assertArrayNotHasKey('nom', $ancien[0]);
    }

    public function test_une_adresse_uniquement_francaise_ne_traduit_jamais(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $this->app['auth']->forgetGuards();

        // Même sans l'en-tête, /produits parle français.
        $this->postJson('/api/produits', ['nom' => 'Riz', 'prix_vente' => 600], ['Authorization' => 'Bearer '.$jeton])
            ->assertCreated()->assertJsonPath('prix_vente', 600);
    }

    public function test_le_compteur_dit_quand_retirer_la_compatibilite(): void
    {
        $vide = $this->getJson('/api/sante/compatibilite')->assertOk()->json();
        $this->assertNull($vide['dernier_appel']);

        // L'état de santé n'est pas compté : Render l'interroge sans cesse.
        $this->getJson('/api/health')->assertOk();
        $this->assertNull($this->getJson('/api/sante/compatibilite')->json('dernier_appel'));

        // Un vrai appel de l'ancienne application, lui, est compté.
        [, $jeton] = $this->inscrireCommercant();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/products', ['Authorization' => 'Bearer '.$jeton])->assertOk();

        $compte = $this->getJson('/api/sante/compatibilite')->assertOk()->json();
        $this->assertNotNull($compte['dernier_appel']);
        $this->assertSame(1, $compte['appels_par_jour'][now()->toDateString()]);
    }
}
