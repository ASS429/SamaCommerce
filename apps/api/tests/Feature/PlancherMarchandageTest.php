<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

class PlancherMarchandageTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    /** Un employé ne peut pas vendre sous le prix plancher ; le patron, si. */
    public function test_l_employe_ne_vend_pas_sous_le_plancher_mais_le_patron_si(): void
    {
        [$patron, $jetonPatron] = $this->inscrireCommercant('patron@test.sn');

        $produit = $this->postJson('/api/produits', [
            'nom' => 'Sac de riz', 'prix_vente' => 800, 'prix_achat' => 500, 'stock' => 100,
            'unite_base' => 'piece', 'prix_min' => 500, 'negociable' => true,
        ], $this->entetes($jetonPatron))->assertCreated()->json();

        [, $jetonEmploye] = $this->creerEmploye($patron, ['vente' => true]);

        // Employé sous le plancher (400 < 500) → refusé.
        $this->postJson('/api/ventes', [
            'produit_id' => $produit['id'], 'quantite_base' => 1, 'prix_reel' => 400, 'moyen_paiement' => 'especes',
        ], $this->entetes($jetonEmploye))->assertStatus(422);

        // Patron sous le plancher → autorisé (il fixe ses prix).
        $this->postJson('/api/ventes', [
            'produit_id' => $produit['id'], 'quantite_base' => 1, 'prix_reel' => 400, 'moyen_paiement' => 'especes',
        ], $this->entetes($jetonPatron))->assertCreated();
    }
}
