<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Sale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

/**
 * GET /api/stats/resume-jour — les trois chiffres de l'en-tête d'accueil.
 *
 * Le front les calculait en téléchargeant TOUT l'historique des ventes, à
 * chaque changement d'écran. Ces tests figent les deux propriétés qui comptent :
 * les chiffres sont EXACTS, et l'endpoint n'élargit aucun droit.
 */
class ResumeJourTest extends TestCase
{
    use CreatesTenants, RefreshDatabase;

    /** Vente rattachée à la boutique courante du commerçant. */
    private function vendre($owner, int $total, int $quantite, bool $payee, ?string $date = null): Sale
    {
        $produit = Product::create([
            'user_id' => $owner->id, 'boutique_id' => $owner->current_boutique_id,
            'name' => 'Riz '.uniqid(), 'price' => $total, 'price_achat' => 1, 'stock' => 0,
        ]);

        $vente = Sale::create([
            'user_id' => $owner->id, 'boutique_id' => $owner->current_boutique_id,
            'product_id' => $produit->id, 'quantity' => $quantite, 'total' => $total,
            'payment_method' => 'especes', 'paid' => $payee,
        ]);

        // `created_at` n'est pas dans $fillable : Eloquent l'ignore et met
        // l'heure courante. Sans cette reprise, la vente « ancienne » serait
        // datee d'aujourd'hui et le test validerait un filtre qui ne filtre rien.
        if ($date) {
            $vente->forceFill(['created_at' => $date])->saveQuietly();
        }

        return $vente->refresh();
    }

    public function test_additionne_les_ventes_payees_du_jour(): void
    {
        [$owner, $token] = $this->registerOwner();

        $this->vendre($owner, 1000, 2, true);
        $this->vendre($owner, 500, 1, true);
        $this->vendre($owner, 300, 3, false);           // impayée : hors du CA…
        $this->vendre($owner, 9999, 9, true, '2020-01-01 10:00:00'); // …et hors du jour

        Product::create([
            'user_id' => $owner->id, 'boutique_id' => $owner->current_boutique_id,
            'name' => 'Huile', 'price' => 1, 'price_achat' => 1, 'stock' => 42,
        ]);

        $res = $this->withToken($token)->getJson('/api/stats/resume-jour')->assertOk();

        // Le CA ne compte que les ventes PAYÉES du jour : 1000 + 500.
        $this->assertSame(1500, $res->json('ca'));
        // Les articles vendus comptent TOUT le jour, payé ou non : 2 + 1 + 3.
        $this->assertSame(6, $res->json('articles'));
        // Le stock additionne les produits (42 + les 4 produits à 0).
        $this->assertSame(42, $res->json('stock'));
    }

    public function test_renvoie_zero_sans_aucune_vente(): void
    {
        [, $token] = $this->registerOwner();

        $this->withToken($token)->getJson('/api/stats/resume-jour')
            ->assertOk()->assertJson(['ca' => 0, 'articles' => 0, 'stock' => 0]);
    }

    public function test_ne_voit_pas_les_ventes_d_un_autre_commercant(): void
    {
        [$moi, $monToken] = $this->registerOwner('moi@test.sn');
        [$autre] = $this->registerOwner('autre@test.sn');

        $this->vendre($moi, 1000, 1, true);
        $this->vendre($autre, 50000, 99, true);

        $this->withToken($monToken)->getJson('/api/stats/resume-jour')
            ->assertOk()->assertJson(['ca' => 1000, 'articles' => 1]);
    }

    public function test_un_employe_sans_permission_vente_ne_decouvre_pas_la_recette(): void
    {
        // Le point sensible : aujourd'hui cet employé reçoit 403 sur /sales et
        // ne peut donc PAS connaître le chiffre d'affaires. Le nouvel endpoint
        // ne doit pas devenir une porte dérobée.
        [$owner] = $this->registerOwner('patron@test.sn');
        $this->vendre($owner, 7000, 5, true);

        [, $token] = $this->createEmployee($owner, ['stock' => true], 'magasinier@test.sn');

        $res = $this->withToken($token)->getJson('/api/stats/resume-jour')->assertOk();

        // `null` et non 0 : un zéro se confondrait avec « aucune vente ».
        $this->assertNull($res->json('ca'), 'La recette ne doit pas fuiter');
        $this->assertNull($res->json('articles'));
        $this->assertNotNull($res->json('stock'), 'Le stock, lui, le regarde');
    }

    public function test_un_vendeur_voit_bien_les_chiffres_du_jour(): void
    {
        [$owner] = $this->registerOwner('patron2@test.sn');
        $this->vendre($owner, 2500, 4, true);

        [, $token] = $this->createEmployee($owner, ['vente' => true], 'vendeur@test.sn');

        $this->withToken($token)->getJson('/api/stats/resume-jour')
            ->assertOk()->assertJson(['ca' => 2500, 'articles' => 4]);
    }

    public function test_la_reponse_reste_minuscule_quel_que_soit_l_historique(): void
    {
        // C'est la raison d'être de l'endpoint : le poids ne doit PAS grandir
        // avec le nombre de ventes.
        [$owner, $token] = $this->registerOwner();
        for ($i = 0; $i < 60; $i++) {
            $this->vendre($owner, 100, 1, true);
        }

        $taille = strlen($this->withToken($token)->getJson('/api/stats/resume-jour')
            ->assertOk()->getContent());

        $this->assertLessThan(200, $taille, "Réponse de {$taille} octets — l'agrégat doit rester constant");
    }
}
