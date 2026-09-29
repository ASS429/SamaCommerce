<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * Rattachement d'une vente au fichier clients, et chaînage
 * commande → livraison → stock.
 */
class VenteClientEtLivraisonTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    private function produit(string $jeton, string $nom = 'Riz', int $stock = 50): array
    {
        return $this->postJson('/api/produits', [
            'nom' => $nom, 'prix_vente' => 600, 'prix_achat' => 450, 'stock' => $stock,
        ], $this->entetes($jeton))->assertCreated()->json();
    }

    public function test_la_vente_se_rattache_a_une_fiche_client_existante(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->produit($jeton);
        $client = $this->postJson('/api/clients', ['nom' => 'Awa Ndiaye', 'telephone' => '77 123 45 67'], $this->entetes($jeton))->assertCreated()->json();

        $vente = $this->postJson('/api/ventes', [
            'produit_id' => $p['id'], 'quantite' => 2, 'moyen_paiement' => 'especes',
            'client_id' => $client['id'],
        ], $this->entetes($jeton))->assertCreated()->json();

        $this->assertSame($client['id'], $vente['client_id']);
        // Le nom et le téléphone sont repris de la FICHE, pas de la saisie.
        $this->assertSame('Awa Ndiaye', $vente['nom_client']);
        $this->assertSame('77 123 45 67', $vente['telephone_client']);
    }

    public function test_la_vente_retrouve_une_fiche_par_son_nom(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->produit($jeton);
        $client = $this->postJson('/api/clients', ['nom' => 'Moussa Fall'], $this->entetes($jeton))->assertCreated()->json();

        // Saisi en minuscules : on ne veut pas d'un second « moussa fall ».
        $vente = $this->postJson('/api/ventes', [
            'produit_id' => $p['id'], 'quantite' => 1, 'moyen_paiement' => 'especes',
            'nom_client' => 'moussa fall',
        ], $this->entetes($jeton))->assertCreated()->json();

        $this->assertSame($client['id'], $vente['client_id']);
        $this->assertSame(1, Client::count());
    }

    public function test_une_vente_a_credit_cree_la_fiche_client(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->produit($jeton);

        $vente = $this->postJson('/api/ventes', [
            'produit_id' => $p['id'], 'quantite' => 1, 'moyen_paiement' => 'credit',
            'nom_client' => 'Fatou Sow', 'telephone_client' => '78 000 11 22', 'date_echeance' => '2026-08-01',
        ], $this->entetes($jeton))->assertCreated()->json();

        $this->assertNotNull($vente['client_id']);
        $this->assertDatabaseHas('clients', ['nom' => 'Fatou Sow', 'telephone' => '78 000 11 22']);

        // La dette apparaît sur la fiche du client : c'est ce qui alimente le
        // score de crédit et la relance.
        $liste = $this->getJson('/api/clients', $this->entetes($jeton))->assertOk()->json();
        $this->assertSame(1, $liste[0]['credits_ouverts']);
    }

    public function test_une_vente_comptant_reste_anonyme_sans_nom(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->produit($jeton);

        $vente = $this->postJson('/api/ventes', [
            'produit_id' => $p['id'], 'quantite' => 1, 'moyen_paiement' => 'especes',
        ], $this->entetes($jeton))->assertCreated()->json();

        $this->assertNull($vente['client_id']);
        $this->assertSame(0, Client::count()); // aucune fiche parasite créée
    }

    public function test_le_client_d_un_autre_commercant_est_ignore(): void
    {
        [, $jetonA] = $this->inscrireCommercant('a@test.sn', 'Boutique A');
        [, $jetonB] = $this->inscrireCommercant('b@test.sn', 'Boutique B');

        $clientB = $this->postJson('/api/clients', ['nom' => 'Client de B'], $this->entetes($jetonB))->assertCreated()->json();
        $p = $this->produit($jetonA);

        $vente = $this->postJson('/api/ventes', [
            'produit_id' => $p['id'], 'quantite' => 1, 'moyen_paiement' => 'especes',
            'client_id' => $clientB['id'],
        ], $this->entetes($jetonA))->assertCreated()->json();

        // S4 — pas de fuite entre commerçants : l'identifiant étranger est ignoré.
        $this->assertNull($vente['client_id']);
    }

    public function test_la_livraison_signale_puis_receptionne_la_commande(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->produit($jeton, 'Huile', 10);

        $commande = $this->postJson('/api/commandes', [
            'lignes' => [['produit_id' => $p['id'], 'quantite' => 20, 'prix_unitaire' => 450]],
        ], $this->entetes($jeton))->assertCreated()->json();

        $livraison = $this->postJson('/api/livraisons', ['commande_id' => $commande['id']], $this->entetes($jeton))->assertCreated()->json();

        // Marquer « livrée » ne touche PAS au stock : ça signale seulement qu'il
        // reste une commande à réceptionner.
        $etape = $this->patchJson("/api/livraisons/{$livraison['id']}", ['statut' => 'livree'], $this->entetes($jeton))->assertOk()->json();
        $this->assertSame($commande['id'], $etape['commande_a_recevoir']);
        $this->assertNotNull($etape['livree_le']);
        $this->assertSame(10, $this->getJson("/api/produits/{$p['id']}", $this->entetes($jeton))->json('stock'));

        // Réception explicite : le stock monte de la quantité commandée.
        $recue = $this->patchJson("/api/livraisons/{$livraison['id']}", ['statut' => 'livree', 'recevoir' => true], $this->entetes($jeton))->assertOk()->json();
        $this->assertTrue($recue['commande_recue']);
        $this->assertSame(30, $this->getJson("/api/produits/{$p['id']}", $this->entetes($jeton))->json('stock'));

        // Idempotence : une commande déjà reçue ne recrédite pas le stock.
        $encore = $this->patchJson("/api/livraisons/{$livraison['id']}", ['statut' => 'livree', 'recevoir' => true], $this->entetes($jeton))->assertOk()->json();
        $this->assertNull($encore['commande_a_recevoir']);
        $this->assertSame(30, $this->getJson("/api/produits/{$p['id']}", $this->entetes($jeton))->json('stock'));
    }

    public function test_la_photo_de_profil_se_pose_et_se_retire(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

        $u = $this->putJson('/api/auth/profil', ['nom_commerce' => 'Chez Awa', 'photo' => $png], $this->entetes($jeton))->assertOk()->json();
        $this->assertSame($png, $u['photo']);
        $this->assertSame('Chez Awa', $u['nom_commerce']);

        // photo: null = retrait explicite ; le nom de la boutique ne bouge pas.
        $vide = $this->putJson('/api/auth/profil', ['photo' => null], $this->entetes($jeton))->assertOk()->json();
        $this->assertNull($vide['photo']);
        $this->assertSame('Chez Awa', $vide['nom_commerce']);

        $this->putJson('/api/auth/profil', ['photo' => 'pas-une-image'], $this->entetes($jeton))->assertStatus(422);
    }

    public function test_une_connexion_sur_un_autre_appareil_garde_la_premiere_session(): void
    {
        [, $jetonTelephone] = $this->inscrireCommercant();

        // Deuxième connexion depuis un AUTRE appareil (nom distinct).
        $jetonOrdi = $this->postJson('/api/auth/connexion', [
            'identifiant' => 'proprietaire@test.sn', 'mot_de_passe' => 'Password123', 'nom_appareil' => 'ordi-abc123',
        ])->assertOk()->json('jeton');

        // Les deux sessions doivent répondre : c'est ce qui donnait l'impression
        // que « le jeton expire tout le temps » quand tous les appareils
        // s'appelaient « app ».
        $this->getJson('/api/auth/moi', $this->entetes($jetonOrdi))->assertOk();
        $this->getJson('/api/auth/moi', $this->entetes($jetonTelephone))->assertOk();

        // En revanche, se reconnecter depuis le MÊME appareil révoque l'ancien
        // jeton (hygiène : pas de jeton orphelin qui traîne).
        $jetonOrdi2 = $this->postJson('/api/auth/connexion', [
            'identifiant' => 'proprietaire@test.sn', 'mot_de_passe' => 'Password123', 'nom_appareil' => 'ordi-abc123',
        ])->assertOk()->json('jeton');
        $this->getJson('/api/auth/moi', $this->entetes($jetonOrdi2))->assertOk();
        $this->getJson('/api/auth/moi', $this->entetes($jetonOrdi))->assertUnauthorized();
    }

    public function test_la_vente_d_un_employe_se_rattache_au_client_de_la_boutique(): void
    {
        [$patron, $jetonPatron] = $this->inscrireCommercant();
        [, $jetonEmploye] = $this->creerEmploye($patron, ['vente' => true]);
        $p = $this->produit($jetonPatron);
        $client = $this->postJson('/api/clients', ['nom' => 'Habitué'], $this->entetes($jetonPatron))->assertCreated()->json();

        $this->postJson('/api/ventes', [
            'produit_id' => $p['id'], 'quantite' => 1, 'moyen_paiement' => 'especes', 'client_id' => $client['id'],
        ], $this->entetes($jetonEmploye))->assertCreated();

        $this->assertSame($client['id'], Vente::first()->client_id);
    }
}
