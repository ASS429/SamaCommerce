<?php

namespace Tests\Feature;

use App\Models\Produit;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

class ReconstituerVentesTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    /** T2 — la commande reconstitue le coût et la quantite_base des ventes antérieures à la Phase 6. */
    public function test_reconstitue_les_ventes_anciennes(): void
    {
        [$proprietaire] = $this->inscrireCommercant();
        $produit = Produit::create([
            'utilisateur_id' => $proprietaire->id, 'nom' => 'Sucre', 'prix_vente' => 600, 'prix_achat' => 450, 'stock' => 100, 'unite_base' => 'piece',
        ]);

        // Vente « ancienne » : champs Phase 6 à null.
        $ancienne = Vente::create([
            'utilisateur_id' => $proprietaire->id, 'produit_id' => $produit->id, 'quantite' => 3, 'total' => 1500, 'moyen_paiement' => 'especes', 'paye' => true,
        ]);
        $this->assertNull($ancienne->cout_marchandises);

        $this->artisan('ventes:reconstituer')->assertOk();

        $ancienne->refresh();
        $this->assertTrue($ancienne->reconstituee);
        $this->assertSame(3 * 1, $ancienne->quantite_base);        // quantité × facteur (pièce → 1)
        $this->assertSame(3 * 450, $ancienne->cout_marchandises);  // quantité × prix d'achat
        $this->assertSame(500, $ancienne->prix_reel);              // total / quantité
        $this->assertSame(300, $ancienne->remise);                 // total de référence (1800) − total (1500)

        // Idempotente : un second passage ne retouche rien.
        $this->artisan('ventes:reconstituer')->expectsOutputToContain('Aucune vente')->assertOk();
    }
}
