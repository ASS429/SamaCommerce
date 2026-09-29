<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * T8 — Le contrat JSON figé (ressources) : montants entiers, forme stable,
 * et l'espace versionné /api/v1 sert exactement les mêmes données.
 */
class ContratApiTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    public function test_la_ressource_produit_fige_la_forme_et_les_montants_entiers(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        // Prix envoyé en « numérique » ; le contrat le renvoie en ENTIER.
        $cree = $this->postJson('/api/produits', [
            'nom' => 'Riz', 'prix_vente' => 600, 'prix_achat' => 450, 'stock' => 20,
        ], $this->entetes($jeton))->assertCreated()->json();

        $this->assertIsInt($cree['prix_vente']);
        $this->assertIsInt($cree['stock']);
        $this->assertSame(600, $cree['prix_vente']);
        $this->assertArrayHasKey('conditionnements', $cree);    // relation exposée
        $this->assertArrayNotHasKey('supprime_le', $cree);      // colonne interne non exposée

        // La liste est un tableau PLAT (sans enveloppe {data}).
        $liste = $this->getJson('/api/produits', $this->entetes($jeton))->assertOk()->json();
        $this->assertArrayHasKey(0, $liste);
        $this->assertIsInt($liste[0]['prix_vente']);
    }

    public function test_l_espace_v1_sert_le_meme_contrat(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $this->postJson('/api/produits', ['nom' => 'Sucre', 'prix_vente' => 700, 'stock' => 5], $this->entetes($jeton))->assertCreated();

        $v1 = $this->getJson('/api/v1/produits', $this->entetes($jeton))->assertOk()->json();
        $this->assertSame('Sucre', $v1[0]['nom']);
        $this->assertIsInt($v1[0]['prix_vente']);
        $this->assertSame(700, $v1[0]['prix_vente']);
    }

    public function test_la_pagination_garde_son_enveloppe(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->postJson('/api/produits', ['nom' => 'Café', 'prix_vente' => 250, 'stock' => 100], $this->entetes($jeton))->assertCreated()->json();
        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/ventes', ['produit_id' => $p['id'], 'quantite' => 1, 'moyen_paiement' => 'especes'], $this->entetes($jeton))->assertCreated();
        }

        // ?page= → enveloppe de pagination conservée (le front en dépend).
        $page = $this->getJson('/api/ventes?page=1&par_page=2', $this->entetes($jeton))->assertOk()->json();
        $this->assertArrayHasKey('current_page', $page);
        $this->assertArrayHasKey('last_page', $page);
        $this->assertArrayHasKey('total', $page);
        $this->assertCount(2, $page['data']);
        $this->assertIsInt($page['data'][0]['total']);

        // Sans ?page= → tableau plat.
        $plat = $this->getJson('/api/ventes', $this->entetes($jeton))->assertOk()->json();
        $this->assertArrayHasKey(0, $plat);
        $this->assertArrayHasKey('nom_produit', $plat[0]);
    }
}
