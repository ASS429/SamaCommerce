<?php

namespace Tests\Feature;

use App\Models\Categorie;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

class CloisonnementCommercantTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    /** S4 — un commerçant ne peut pas rattacher un produit à la catégorie d'un autre. */
    public function test_la_categorie_d_un_autre_commercant_est_refusee(): void
    {
        [$a, $jetonA] = $this->inscrireCommercant('a@test.sn');
        [$b] = $this->inscrireCommercant('b@test.sn');

        $categorieB = Categorie::create(['utilisateur_id' => $b->id, 'nom' => 'Cat B', 'emoji' => '🍚']);

        // A tente de créer un produit dans la catégorie de B → refusé (422).
        $this->postJson('/api/produits', ['nom' => 'Riz', 'categorie_id' => $categorieB->id], $this->entetes($jetonA))
            ->assertStatus(422)
            ->assertJsonValidationErrors('categorie_id');

        // Avec sa propre catégorie → accepté.
        $categorieA = Categorie::create(['utilisateur_id' => $a->id, 'nom' => 'Cat A', 'emoji' => '🥤']);
        $this->postJson('/api/produits', ['nom' => 'Riz', 'categorie_id' => $categorieA->id], $this->entetes($jetonA))
            ->assertCreated();
    }

    /** S4 — un commerçant ne voit jamais les produits d'un autre. */
    public function test_les_produits_restent_chez_leur_commercant(): void
    {
        [, $jetonA] = $this->inscrireCommercant('a@test.sn');
        [, $jetonB] = $this->inscrireCommercant('b@test.sn');

        $this->postJson('/api/produits', ['nom' => 'Produit A'], $this->entetes($jetonA))->assertCreated();

        $listeB = $this->getJson('/api/produits', $this->entetes($jetonB))->assertOk()->json();
        $this->assertCount(0, $listeB);
    }
}
