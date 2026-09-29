<?php

namespace Tests\Feature;

use App\Models\MembreBoutique;
use App\Models\Produit;
use App\Models\Utilisateur;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * Cloisonnement des données par boutique.
 *
 * Avant CloisonnementBoutique, seuls les produits, clients, fournisseurs et
 * commandes filtraient. Ventes, caisse, retours, réappro IA et 8 statistiques
 * sur 9 répondaient pour TOUTES les boutiques : changer de boutique ne
 * changeait rien à l'accueil, et le chiffre d'affaires d'un point de vente
 * incluait l'autre.
 */
class CloisonnementBoutiqueTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    /** Propriétaire Premium (droit à plusieurs boutiques) + 2e boutique. */
    private function proprietaireADeuxBoutiques(): array
    {
        [$proprietaire, $jeton] = $this->inscrireCommercant();
        $proprietaire->update(['plan' => 'Premium']);

        $b1 = $proprietaire->fresh()->boutique_active_id;
        $b2 = $this->postJson('/api/boutiques', ['nom' => 'Boutique Marché'], $this->entetes($jeton))->assertCreated()->json('id');

        return [$proprietaire, $jeton, $b1, $b2];
    }

    private function activer(string $jeton, int $boutiqueId): void
    {
        $this->postJson("/api/boutiques/{$boutiqueId}/activer", [], $this->entetes($jeton))->assertOk();
    }

    private function vendre(string $jeton, int $produitId, int $quantite = 1, string $moyen = 'especes'): void
    {
        $this->postJson('/api/ventes', [
            'produit_id' => $produitId, 'quantite' => $quantite, 'moyen_paiement' => $moyen,
        ], $this->entetes($jeton))->assertCreated();
    }

    public function test_produits_ventes_et_caisse_sont_cloisonnes_par_boutique(): void
    {
        [, $jeton, $b1, $b2] = $this->proprietaireADeuxBoutiques();

        // Boutique 1 : un riz vendu 600.
        $this->activer($jeton, $b1);
        $riz = $this->postJson('/api/produits', ['nom' => 'Riz', 'prix_vente' => 600, 'prix_achat' => 400, 'stock' => 10], $this->entetes($jeton))->assertCreated()->json();
        $this->vendre($jeton, $riz['id']);

        // Boutique 2 : une huile vendue 1000.
        $this->activer($jeton, $b2);
        $huile = $this->postJson('/api/produits', ['nom' => 'Huile', 'prix_vente' => 1000, 'prix_achat' => 700, 'stock' => 10], $this->entetes($jeton))->assertCreated()->json();
        $this->vendre($jeton, $huile['id']);

        // Chaque article est bien rattaché à sa boutique en base.
        $this->assertSame($b1, Produit::withoutGlobalScopes()->find($riz['id'])->boutique_id);
        $this->assertSame($b2, Produit::withoutGlobalScopes()->find($huile['id'])->boutique_id);

        // Vue depuis la boutique 2 : seulement ce qui s'y passe.
        $produits = $this->getJson('/api/produits', $this->entetes($jeton))->assertOk()->json();
        $this->assertSame(['Huile'], array_column($produits, 'nom'));

        $ventes = $this->getJson('/api/ventes', $this->entetes($jeton))->assertOk()->json();
        $this->assertCount(1, $ventes);
        $this->assertSame(1000, (int) $ventes[0]['total']);

        // La caisse du jour ne mélange plus les deux points de vente.
        $caisse = $this->getJson('/api/caisse/aujourdhui', $this->entetes($jeton))->assertOk()->json();
        $this->assertSame(1000.0, (float) $caisse['total_encaisse']);
        $this->assertSame(1, $caisse['nb_ventes']);

        // Et les statistiques suivent.
        $meilleurs = $this->getJson('/api/statistiques/meilleurs-produits', $this->entetes($jeton))->assertOk()->json();
        $this->assertSame(['Huile'], array_column($meilleurs, 'produit'));

        // Vue depuis la boutique 1 : l'inverse, exactement.
        $this->activer($jeton, $b1);
        $this->assertSame(['Riz'], array_column($this->getJson('/api/produits', $this->entetes($jeton))->json(), 'nom'));
        $this->assertSame(600.0, (float) $this->getJson('/api/caisse/aujourdhui', $this->entetes($jeton))->json('total_encaisse'));
    }

    public function test_clients_et_fournisseurs_sont_cloisonnes_par_boutique(): void
    {
        [, $jeton, $b1, $b2] = $this->proprietaireADeuxBoutiques();

        $this->activer($jeton, $b1);
        $this->postJson('/api/clients', ['nom' => 'Client Ville'], $this->entetes($jeton))->assertCreated();
        $this->postJson('/api/fournisseurs', ['nom' => 'Grossiste Ville'], $this->entetes($jeton))->assertCreated();

        $this->activer($jeton, $b2);
        $this->postJson('/api/clients', ['nom' => 'Client Marché'], $this->entetes($jeton))->assertCreated();

        $this->assertSame(['Client Marché'], array_column($this->getJson('/api/clients', $this->entetes($jeton))->json(), 'nom'));
        $this->assertCount(0, $this->getJson('/api/fournisseurs', $this->entetes($jeton))->json());
        $this->assertSame(['Client Marché'], array_column($this->getJson('/api/clients/pour-vente', $this->entetes($jeton))->json(), 'nom'));
    }

    public function test_le_produit_d_une_autre_boutique_est_inaccessible(): void
    {
        [, $jeton, $b1, $b2] = $this->proprietaireADeuxBoutiques();

        $this->activer($jeton, $b1);
        $riz = $this->postJson('/api/produits', ['nom' => 'Riz', 'prix_vente' => 600, 'prix_achat' => 400, 'stock' => 10], $this->entetes($jeton))->assertCreated()->json();

        // Depuis l'autre boutique, on ne peut ni le lire, ni le vendre.
        $this->activer($jeton, $b2);
        $this->getJson("/api/produits/{$riz['id']}", $this->entetes($jeton))->assertNotFound();
        $this->postJson('/api/ventes', [
            'produit_id' => $riz['id'], 'quantite' => 1, 'moyen_paiement' => 'especes',
        ], $this->entetes($jeton))->assertNotFound();
    }

    public function test_les_deux_boutiques_cloturent_leur_caisse_le_meme_jour(): void
    {
        [, $jeton, $b1, $b2] = $this->proprietaireADeuxBoutiques();

        $this->activer($jeton, $b1);
        $riz = $this->postJson('/api/produits', ['nom' => 'Riz', 'prix_vente' => 600, 'prix_achat' => 400, 'stock' => 10], $this->entetes($jeton))->assertCreated()->json();
        $this->vendre($jeton, $riz['id']);
        $c1 = $this->postJson('/api/caisse/cloturer', [], $this->entetes($jeton))->assertOk()->json();

        $this->activer($jeton, $b2);
        $huile = $this->postJson('/api/produits', ['nom' => 'Huile', 'prix_vente' => 1000, 'prix_achat' => 700, 'stock' => 10], $this->entetes($jeton))->assertCreated()->json();
        $this->vendre($jeton, $huile['id']);
        $c2 = $this->postJson('/api/caisse/cloturer', [], $this->entetes($jeton))->assertOk()->json();

        // Deux clôtures distinctes le même jour (avant : la seconde écrasait la première).
        $this->assertNotSame($c1['id'], $c2['id']);
        $this->assertSame(600.0, (float) $c1['total_net']);
        $this->assertSame(1000.0, (float) $c2['total_net']);

        // Chaque historique ne montre que sa boutique.
        $this->assertCount(1, $this->getJson('/api/caisse/historique', $this->entetes($jeton))->json());
    }

    public function test_l_employe_reste_dans_la_boutique_ou_il_a_ete_invite(): void
    {
        [$proprietaire, $jeton, $b1, $b2] = $this->proprietaireADeuxBoutiques();

        $this->activer($jeton, $b1);
        $riz = $this->postJson('/api/produits', ['nom' => 'Riz', 'prix_vente' => 600, 'prix_achat' => 400, 'stock' => 10], $this->entetes($jeton))->assertCreated()->json();
        $this->activer($jeton, $b2);
        $this->postJson('/api/produits', ['nom' => 'Huile', 'prix_vente' => 1000, 'prix_achat' => 700, 'stock' => 10], $this->entetes($jeton))->assertCreated();

        // Employé invité dans la boutique 2 : il ne voit pas le stock de la 1.
        $proprietaire->refresh();
        [$employe] = $this->creerEmploye($proprietaire, ['stock' => true, 'vente' => true]);
        MembreBoutique::where('membre_id', $employe->id)->update(['boutique_rattachement_id' => $b2]);
        $jetonEmploye = $this->postJson('/api/auth/connexion', [
            'identifiant' => 'employe@test.sn', 'mot_de_passe' => 'Password123', 'nom_appareil' => 'poste-caisse',
        ])->assertOk()->json('jeton');

        $produits = $this->getJson('/api/produits', $this->entetes($jetonEmploye))->assertOk()->json();
        $this->assertSame(['Huile'], array_column($produits, 'nom'));
        $this->getJson("/api/produits/{$riz['id']}", $this->entetes($jetonEmploye))->assertNotFound();
    }

    public function test_le_tableau_de_bord_rassemble_toutes_les_boutiques(): void
    {
        [, $jeton, $b1, $b2] = $this->proprietaireADeuxBoutiques();

        $this->activer($jeton, $b1);
        $riz = $this->postJson('/api/produits', ['nom' => 'Riz', 'prix_vente' => 600, 'prix_achat' => 400, 'stock' => 10], $this->entetes($jeton))->assertCreated()->json();
        $this->vendre($jeton, $riz['id']);

        $this->activer($jeton, $b2);
        $this->postJson('/api/produits', ['nom' => 'Huile', 'prix_vente' => 1000, 'prix_achat' => 700, 'stock' => 0], $this->entetes($jeton))->assertCreated();

        $t = $this->getJson('/api/boutiques/tableau-de-bord', $this->entetes($jeton))->assertOk()->json();

        $this->assertCount(2, $t['boutiques']);
        $parId = collect($t['boutiques'])->keyBy('id');
        $this->assertSame(600, $parId[$b1]['ca_jour']);
        $this->assertSame(0, $parId[$b2]['ca_jour']);
        $this->assertSame(1, $parId[$b2]['ruptures']);   // l'huile est à zéro

        // Le consolidé additionne bien les deux points de vente…
        $this->assertSame(600, $t['total']['ca_jour']);
        $this->assertSame(2, $t['total']['nb_produits']);
        $this->assertSame(2, $t['total']['nb_boutiques']);
        // …et la meilleure du jour est désignée.
        $this->assertSame($b1, $t['meilleure']['id']);

        // Le tableau de bord regarde par-dessus le cloisonnement, mais ne le
        // lève pas : la boutique active reste la 2.
        $this->assertSame(['Huile'], array_column($this->getJson('/api/produits', $this->entetes($jeton))->json(), 'nom'));
    }

    public function test_l_administrateur_voit_toujours_toutes_les_boutiques(): void
    {
        [, $jeton, $b1] = $this->proprietaireADeuxBoutiques();
        $this->activer($jeton, $b1);
        $riz = $this->postJson('/api/produits', ['nom' => 'Riz', 'prix_vente' => 600, 'prix_achat' => 400, 'stock' => 10], $this->entetes($jeton))->assertCreated()->json();
        $this->vendre($jeton, $riz['id']);

        $admin = Utilisateur::create([
            'identifiant' => 'admin@test.sn', 'mot_de_passe' => bcrypt('Password123'), 'role' => 'admin', 'nom_commerce' => 'Admin',
        ]);
        $jetonAdmin = $admin->createToken('admin')->plainTextToken;

        // Les écrans d'administration agrègent volontairement tous les
        // commerçants : le cloisonnement ne doit pas les vider.
        $vue = $this->getJson('/api/admin/statistiques/vue-ensemble', $this->entetes($jetonAdmin))->assertOk()->json();
        $this->assertGreaterThan(0, $vue['total_utilisateurs']);
    }
}
