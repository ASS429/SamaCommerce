<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Sale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

/**
 * Rattachement d'une vente au fichier clients, et chaînage
 * commande → livraison → stock.
 */
class VenteClientEtLivraisonTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    private function produit(string $token, string $nom = 'Riz', int $stock = 50): array
    {
        return $this->postJson('/api/products', [
            'name' => $nom, 'price' => 600, 'price_achat' => 450, 'stock' => $stock,
        ], $this->auth($token))->assertCreated()->json();
    }

    public function test_sale_links_to_an_existing_client(): void
    {
        [, $token] = $this->registerOwner();
        $p = $this->produit($token);
        $client = $this->postJson('/api/clients', ['name' => 'Awa Ndiaye', 'phone' => '77 123 45 67'], $this->auth($token))->assertCreated()->json();

        $sale = $this->postJson('/api/sales', [
            'product_id' => $p['id'], 'quantity' => 2, 'payment_method' => 'especes',
            'client_id' => $client['id'],
        ], $this->auth($token))->assertCreated()->json();

        $this->assertSame($client['id'], $sale['client_id']);
        // Le nom et le téléphone sont repris de la FICHE, pas de la saisie.
        $this->assertSame('Awa Ndiaye', $sale['client_name']);
        $this->assertSame('77 123 45 67', $sale['client_phone']);
    }

    public function test_sale_reuses_an_existing_client_matched_by_name(): void
    {
        [, $token] = $this->registerOwner();
        $p = $this->produit($token);
        $client = $this->postJson('/api/clients', ['name' => 'Moussa Fall'], $this->auth($token))->assertCreated()->json();

        // Saisi en minuscules : on ne veut pas d'un second « moussa fall ».
        $sale = $this->postJson('/api/sales', [
            'product_id' => $p['id'], 'quantity' => 1, 'payment_method' => 'especes',
            'client_name' => 'moussa fall',
        ], $this->auth($token))->assertCreated()->json();

        $this->assertSame($client['id'], $sale['client_id']);
        $this->assertSame(1, Client::count());
    }

    public function test_credit_sale_creates_the_client_file(): void
    {
        [, $token] = $this->registerOwner();
        $p = $this->produit($token);

        $sale = $this->postJson('/api/sales', [
            'product_id' => $p['id'], 'quantity' => 1, 'payment_method' => 'credit',
            'client_name' => 'Fatou Sow', 'client_phone' => '78 000 11 22', 'due_date' => '2026-08-01',
        ], $this->auth($token))->assertCreated()->json();

        $this->assertNotNull($sale['client_id']);
        $this->assertDatabaseHas('clients', ['name' => 'Fatou Sow', 'phone' => '78 000 11 22']);

        // La dette apparaît sur la fiche du client : c'est ce qui alimente le
        // score de crédit et la relance.
        $liste = $this->getJson('/api/clients', $this->auth($token))->assertOk()->json();
        $this->assertSame(1, $liste[0]['credits_ouverts']);
    }

    public function test_cash_sale_stays_anonymous_without_a_name(): void
    {
        [, $token] = $this->registerOwner();
        $p = $this->produit($token);

        $sale = $this->postJson('/api/sales', [
            'product_id' => $p['id'], 'quantity' => 1, 'payment_method' => 'especes',
        ], $this->auth($token))->assertCreated()->json();

        $this->assertNull($sale['client_id']);
        $this->assertSame(0, Client::count()); // aucune fiche parasite créée
    }

    public function test_client_id_of_another_tenant_is_ignored(): void
    {
        [, $tokenA] = $this->registerOwner('a@test.sn', 'Boutique A');
        [, $tokenB] = $this->registerOwner('b@test.sn', 'Boutique B');

        $clientB = $this->postJson('/api/clients', ['name' => 'Client de B'], $this->auth($tokenB))->assertCreated()->json();
        $p = $this->produit($tokenA);

        $sale = $this->postJson('/api/sales', [
            'product_id' => $p['id'], 'quantity' => 1, 'payment_method' => 'especes',
            'client_id' => $clientB['id'],
        ], $this->auth($tokenA))->assertCreated()->json();

        // S4 — pas de fuite entre commerçants : l'id étranger est simplement ignoré.
        $this->assertNull($sale['client_id']);
    }

    public function test_delivery_signals_then_receives_the_linked_order(): void
    {
        [, $token] = $this->registerOwner();
        $p = $this->produit($token, 'Huile', 10);

        $cmd = $this->postJson('/api/commandes', [
            'items' => [['product_id' => $p['id'], 'quantity' => 20, 'prix_unitaire' => 450]],
        ], $this->auth($token))->assertCreated()->json();

        $liv = $this->postJson('/api/livraisons', ['commande_id' => $cmd['id']], $this->auth($token))->assertCreated()->json();

        // Marquer « livrée » ne touche PAS au stock : ça signale seulement qu'il
        // reste une commande à réceptionner.
        $etape = $this->patchJson("/api/livraisons/{$liv['id']}", ['status' => 'livree'], $this->auth($token))->assertOk()->json();
        $this->assertSame($cmd['id'], $etape['commande_a_recevoir']);
        $this->assertNotNull($etape['delivered_at']);
        $this->assertSame(10, $this->getJson("/api/products/{$p['id']}", $this->auth($token))->json('stock'));

        // Réception explicite : le stock monte de la quantité commandée.
        $recue = $this->patchJson("/api/livraisons/{$liv['id']}", ['status' => 'livree', 'recevoir' => true], $this->auth($token))->assertOk()->json();
        $this->assertTrue($recue['commande_recue']);
        $this->assertSame(30, $this->getJson("/api/products/{$p['id']}", $this->auth($token))->json('stock'));

        // Idempotence : une commande déjà reçue ne recrédite pas le stock.
        $again = $this->patchJson("/api/livraisons/{$liv['id']}", ['status' => 'livree', 'recevoir' => true], $this->auth($token))->assertOk()->json();
        $this->assertNull($again['commande_a_recevoir']);
        $this->assertSame(30, $this->getJson("/api/products/{$p['id']}", $this->auth($token))->json('stock'));
    }

    public function test_profile_photo_can_be_set_and_removed(): void
    {
        [, $token] = $this->registerOwner();
        $png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

        $u = $this->putJson('/api/auth/profile', ['company_name' => 'Chez Awa', 'photo' => $png], $this->auth($token))->assertOk()->json();
        $this->assertSame($png, $u['photo']);
        $this->assertSame('Chez Awa', $u['company_name']);

        // photo: null = retrait explicite ; le nom de la boutique ne bouge pas.
        $vide = $this->putJson('/api/auth/profile', ['photo' => null], $this->auth($token))->assertOk()->json();
        $this->assertNull($vide['photo']);
        $this->assertSame('Chez Awa', $vide['company_name']);

        $this->putJson('/api/auth/profile', ['photo' => 'pas-une-image'], $this->auth($token))->assertStatus(422);
    }

    public function test_login_on_another_device_keeps_the_first_session_alive(): void
    {
        [, $tokenTelephone] = $this->registerOwner();

        // Deuxième connexion depuis un AUTRE appareil (nom distinct).
        $tokenOrdi = $this->postJson('/api/auth/login', [
            'username' => 'owner@test.sn', 'password' => 'Password123', 'device_name' => 'ordi-abc123',
        ])->assertOk()->json('token');

        // Les deux sessions doivent répondre : c'est ce qui donnait l'impression
        // que « le token expire tout le temps » quand tous les appareils
        // s'appelaient « app ».
        $this->getJson('/api/auth/me', $this->auth($tokenOrdi))->assertOk();
        $this->getJson('/api/auth/me', $this->auth($tokenTelephone))->assertOk();

        // En revanche, se reconnecter depuis le MÊME appareil révoque l'ancien
        // jeton (hygiène : pas de jeton orphelin qui traîne).
        $tokenOrdi2 = $this->postJson('/api/auth/login', [
            'username' => 'owner@test.sn', 'password' => 'Password123', 'device_name' => 'ordi-abc123',
        ])->assertOk()->json('token');
        $this->getJson('/api/auth/me', $this->auth($tokenOrdi2))->assertOk();
        $this->getJson('/api/auth/me', $this->auth($tokenOrdi))->assertUnauthorized();
    }

    public function test_sale_of_an_employee_is_attached_to_the_shop_client(): void
    {
        [$owner, $ownerToken] = $this->registerOwner();
        [, $empToken] = $this->createEmployee($owner, ['vente' => true]);
        $p = $this->produit($ownerToken);
        $client = $this->postJson('/api/clients', ['name' => 'Habitué'], $this->auth($ownerToken))->assertCreated()->json();

        $this->postJson('/api/sales', [
            'product_id' => $p['id'], 'quantity' => 1, 'payment_method' => 'especes', 'client_id' => $client['id'],
        ], $this->auth($empToken))->assertCreated();

        $this->assertSame($client['id'], Sale::first()->client_id);
    }
}
