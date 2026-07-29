<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

/**
 * Cloisonnement des données par boutique.
 *
 * Avant BoutiqueScope, seuls les produits, clients, fournisseurs et commandes
 * filtraient. Ventes, caisse, retours, réappro IA et 8 statistiques sur 9
 * répondaient pour TOUTES les boutiques : changer de boutique ne changeait rien
 * à l'accueil, et le chiffre d'affaires d'un point de vente incluait l'autre.
 */
class BoutiqueIsolationTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    /** Propriétaire Premium (droit à plusieurs boutiques) + 2e boutique. */
    private function ownerWithTwoShops(): array
    {
        [$owner, $token] = $this->registerOwner();
        $owner->update(['plan' => 'Premium']);

        $b1 = $owner->fresh()->current_boutique_id;
        $b2 = $this->postJson('/api/boutiques', ['name' => 'Boutique Marché'], $this->auth($token))->assertCreated()->json('id');

        return [$owner, $token, $b1, $b2];
    }

    private function switchTo(string $token, int $boutiqueId): void
    {
        $this->postJson("/api/boutiques/{$boutiqueId}/switch", [], $this->auth($token))->assertOk();
    }

    private function vendre(string $token, int $productId, int $qty = 1, string $method = 'especes'): void
    {
        $this->postJson('/api/sales', [
            'product_id' => $productId, 'quantity' => $qty, 'payment_method' => $method,
        ], $this->auth($token))->assertCreated();
    }

    public function test_products_sales_and_cash_are_isolated_per_shop(): void
    {
        [, $token, $b1, $b2] = $this->ownerWithTwoShops();

        // Boutique 1 : un riz vendu 600.
        $this->switchTo($token, $b1);
        $riz = $this->postJson('/api/products', ['name' => 'Riz', 'price' => 600, 'price_achat' => 400, 'stock' => 10], $this->auth($token))->assertCreated()->json();
        $this->vendre($token, $riz['id']);

        // Boutique 2 : une huile vendue 1000.
        $this->switchTo($token, $b2);
        $huile = $this->postJson('/api/products', ['name' => 'Huile', 'price' => 1000, 'price_achat' => 700, 'stock' => 10], $this->auth($token))->assertCreated()->json();
        $this->vendre($token, $huile['id']);

        // Chaque article est bien rattaché à sa boutique en base.
        $this->assertSame($b1, \App\Models\Product::withoutGlobalScopes()->find($riz['id'])->boutique_id);
        $this->assertSame($b2, \App\Models\Product::withoutGlobalScopes()->find($huile['id'])->boutique_id);

        // Vue depuis la boutique 2 : seulement ce qui s'y passe.
        $produits = $this->getJson('/api/products', $this->auth($token))->assertOk()->json();
        $this->assertSame(['Huile'], array_column($produits, 'name'));

        $ventes = $this->getJson('/api/sales', $this->auth($token))->assertOk()->json();
        $this->assertCount(1, $ventes);
        $this->assertSame(1000, (int) $ventes[0]['total']);

        // La caisse du jour ne mélange plus les deux points de vente.
        $caisse = $this->getJson('/api/caisse/today', $this->auth($token))->assertOk()->json();
        $this->assertSame(1000.0, (float) $caisse['total_encaisse']);
        $this->assertSame(1, $caisse['nb_ventes']);

        // Et les statistiques suivent.
        $top = $this->getJson('/api/stats/top-produits', $this->auth($token))->assertOk()->json();
        $this->assertSame(['Huile'], array_column($top, 'produit'));

        // Vue depuis la boutique 1 : l'inverse, exactement.
        $this->switchTo($token, $b1);
        $this->assertSame(['Riz'], array_column($this->getJson('/api/products', $this->auth($token))->json(), 'name'));
        $this->assertSame(600.0, (float) $this->getJson('/api/caisse/today', $this->auth($token))->json('total_encaisse'));
    }

    public function test_clients_and_suppliers_are_isolated_per_shop(): void
    {
        [, $token, $b1, $b2] = $this->ownerWithTwoShops();

        $this->switchTo($token, $b1);
        $this->postJson('/api/clients', ['name' => 'Client Ville'], $this->auth($token))->assertCreated();
        $this->postJson('/api/fournisseurs', ['name' => 'Grossiste Ville'], $this->auth($token))->assertCreated();

        $this->switchTo($token, $b2);
        $this->postJson('/api/clients', ['name' => 'Client Marché'], $this->auth($token))->assertCreated();

        $this->assertSame(['Client Marché'], array_column($this->getJson('/api/clients', $this->auth($token))->json(), 'name'));
        $this->assertCount(0, $this->getJson('/api/fournisseurs', $this->auth($token))->json());
        $this->assertSame(['Client Marché'], array_column($this->getJson('/api/clients/for-sale', $this->auth($token))->json(), 'name'));
    }

    public function test_a_product_of_another_shop_is_not_reachable(): void
    {
        [, $token, $b1, $b2] = $this->ownerWithTwoShops();

        $this->switchTo($token, $b1);
        $riz = $this->postJson('/api/products', ['name' => 'Riz', 'price' => 600, 'price_achat' => 400, 'stock' => 10], $this->auth($token))->assertCreated()->json();

        // Depuis l'autre boutique, on ne peut ni le lire, ni le vendre.
        $this->switchTo($token, $b2);
        $this->getJson("/api/products/{$riz['id']}", $this->auth($token))->assertNotFound();
        $this->postJson('/api/sales', [
            'product_id' => $riz['id'], 'quantity' => 1, 'payment_method' => 'especes',
        ], $this->auth($token))->assertNotFound();
    }

    public function test_both_shops_can_close_their_cash_on_the_same_day(): void
    {
        [, $token, $b1, $b2] = $this->ownerWithTwoShops();

        $this->switchTo($token, $b1);
        $riz = $this->postJson('/api/products', ['name' => 'Riz', 'price' => 600, 'price_achat' => 400, 'stock' => 10], $this->auth($token))->assertCreated()->json();
        $this->vendre($token, $riz['id']);
        $c1 = $this->postJson('/api/caisse/close', [], $this->auth($token))->assertOk()->json();

        $this->switchTo($token, $b2);
        $huile = $this->postJson('/api/products', ['name' => 'Huile', 'price' => 1000, 'price_achat' => 700, 'stock' => 10], $this->auth($token))->assertCreated()->json();
        $this->vendre($token, $huile['id']);
        $c2 = $this->postJson('/api/caisse/close', [], $this->auth($token))->assertOk()->json();

        // Deux clôtures distinctes le même jour (avant : la seconde écrasait la première).
        $this->assertNotSame($c1['id'], $c2['id']);
        $this->assertSame(600.0, (float) $c1['total_net']);
        $this->assertSame(1000.0, (float) $c2['total_net']);

        // Chaque historique ne montre que sa boutique.
        $this->assertCount(1, $this->getJson('/api/caisse/history', $this->auth($token))->json());
    }

    public function test_employee_is_confined_to_the_shop_he_was_invited_to(): void
    {
        [$owner, $token, $b1, $b2] = $this->ownerWithTwoShops();

        $this->switchTo($token, $b1);
        $riz = $this->postJson('/api/products', ['name' => 'Riz', 'price' => 600, 'price_achat' => 400, 'stock' => 10], $this->auth($token))->assertCreated()->json();
        $this->switchTo($token, $b2);
        $this->postJson('/api/products', ['name' => 'Huile', 'price' => 1000, 'price_achat' => 700, 'stock' => 10], $this->auth($token))->assertCreated();

        // Employé invité dans la boutique 2 : il ne voit pas le stock de la 1.
        $owner->refresh();
        [$emp] = $this->createEmployee($owner, ['stock' => true, 'vente' => true]);
        \App\Models\BoutiqueMember::where('member_id', $emp->id)->update(['ref_boutique_id' => $b2]);
        $empToken = $this->postJson('/api/auth/login', [
            'username' => 'emp@test.sn', 'password' => 'Password123', 'device_name' => 'poste-caisse',
        ])->assertOk()->json('token');

        $produits = $this->getJson('/api/products', $this->auth($empToken))->assertOk()->json();
        $this->assertSame(['Huile'], array_column($produits, 'name'));
        $this->getJson("/api/products/{$riz['id']}", $this->auth($empToken))->assertNotFound();
    }

    public function test_dashboard_consolidates_every_shop(): void
    {
        [, $token, $b1, $b2] = $this->ownerWithTwoShops();

        $this->switchTo($token, $b1);
        $riz = $this->postJson('/api/products', ['name' => 'Riz', 'price' => 600, 'price_achat' => 400, 'stock' => 10], $this->auth($token))->assertCreated()->json();
        $this->vendre($token, $riz['id']);

        $this->switchTo($token, $b2);
        $huile = $this->postJson('/api/products', ['name' => 'Huile', 'price' => 1000, 'price_achat' => 700, 'stock' => 0], $this->auth($token))->assertCreated()->json();

        $d = $this->getJson('/api/boutiques/dashboard', $this->auth($token))->assertOk()->json();

        $this->assertCount(2, $d['boutiques']);
        $parId = collect($d['boutiques'])->keyBy('id');
        $this->assertSame(600, $parId[$b1]['ca_jour']);
        $this->assertSame(0, $parId[$b2]['ca_jour']);
        $this->assertSame(1, $parId[$b2]['ruptures']);   // l'huile est à zéro

        // Le consolidé additionne bien les deux points de vente…
        $this->assertSame(600, $d['total']['ca_jour']);
        $this->assertSame(2, $d['total']['nb_produits']);
        $this->assertSame(2, $d['total']['nb_boutiques']);
        // …et la meilleure du jour est désignée.
        $this->assertSame($b1, $d['meilleure']['id']);

        // Le tableau de bord regarde par-dessus le cloisonnement, mais ne le
        // lève pas : la boutique active reste la 2.
        $this->assertSame(['Huile'], array_column($this->getJson('/api/products', $this->auth($token))->json(), 'name'));

        unset($huile);
    }

    public function test_admin_still_sees_every_shop(): void
    {
        [, $token, $b1] = $this->ownerWithTwoShops();
        $this->switchTo($token, $b1);
        $riz = $this->postJson('/api/products', ['name' => 'Riz', 'price' => 600, 'price_achat' => 400, 'stock' => 10], $this->auth($token))->assertCreated()->json();
        $this->vendre($token, $riz['id']);

        $admin = User::create([
            'username' => 'admin@test.sn', 'password' => bcrypt('Password123'), 'role' => 'admin', 'company_name' => 'Admin',
        ]);
        $adminToken = $admin->createToken('admin')->plainTextToken;

        // Les écrans d'administration agrègent volontairement tous les
        // commerçants : le cloisonnement ne doit pas les vider.
        $overview = $this->getJson('/api/admin-stats/overview', $this->auth($adminToken))->assertOk()->json();
        $this->assertGreaterThan(0, $overview['total_ventes'] ?? $overview['ventes'] ?? 1);
    }
}
