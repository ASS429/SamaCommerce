<?php

namespace Tests\Feature;

use App\Models\Produit;
use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * GET /api/statistiques/resume-jour — les trois chiffres de l'en-tête d'accueil.
 *
 * Le front les calculait en téléchargeant TOUT l'historique des ventes, à
 * chaque changement d'écran. Ces tests figent les deux propriétés qui comptent :
 * les chiffres sont EXACTS, et la route n'élargit aucun droit.
 */
class ResumeJourTest extends TestCase
{
    use CreationComptes, RefreshDatabase;

    /** Vente rattachée à la boutique courante du commerçant. */
    private function vendre($proprietaire, int $total, int $quantite, bool $payee, ?string $date = null): Vente
    {
        $produit = Produit::create([
            'utilisateur_id' => $proprietaire->id, 'boutique_id' => $proprietaire->boutique_active_id,
            'nom' => 'Riz '.uniqid(), 'prix_vente' => $total, 'prix_achat' => 1, 'stock' => 0,
        ]);

        $vente = Vente::create([
            'utilisateur_id' => $proprietaire->id, 'boutique_id' => $proprietaire->boutique_active_id,
            'produit_id' => $produit->id, 'quantite' => $quantite, 'total' => $total,
            'moyen_paiement' => 'especes', 'paye' => $payee,
        ]);

        // `cree_le` n'est pas dans $fillable : Eloquent l'ignore et met l'heure
        // courante. Sans cette reprise, la vente « ancienne » serait datée
        // d'aujourd'hui et le test validerait un filtre qui ne filtre rien.
        if ($date) {
            $vente->forceFill(['cree_le' => $date])->saveQuietly();
        }

        return $vente->refresh();
    }

    public function test_additionne_les_ventes_payees_du_jour(): void
    {
        [$proprietaire, $jeton] = $this->inscrireCommercant();

        $this->vendre($proprietaire, 1000, 2, true);
        $this->vendre($proprietaire, 500, 1, true);
        $this->vendre($proprietaire, 300, 3, false);           // impayée : hors du CA…
        $this->vendre($proprietaire, 9999, 9, true, '2020-01-01 10:00:00'); // …et hors du jour

        Produit::create([
            'utilisateur_id' => $proprietaire->id, 'boutique_id' => $proprietaire->boutique_active_id,
            'nom' => 'Huile', 'prix_vente' => 1, 'prix_achat' => 1, 'stock' => 42,
        ]);

        $reponse = $this->withToken($jeton)->getJson('/api/statistiques/resume-jour')->assertOk();

        // Le CA ne compte que les ventes PAYÉES du jour : 1000 + 500.
        $this->assertSame(1500, $reponse->json('ca'));
        // Les articles vendus comptent TOUT le jour, payé ou non : 2 + 1 + 3.
        $this->assertSame(6, $reponse->json('articles'));
        // Le stock additionne les produits (42 + les 4 produits à 0).
        $this->assertSame(42, $reponse->json('stock'));
    }

    public function test_renvoie_zero_sans_aucune_vente(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        $this->withToken($jeton)->getJson('/api/statistiques/resume-jour')
            ->assertOk()->assertJson(['ca' => 0, 'articles' => 0, 'stock' => 0]);
    }

    public function test_ne_voit_pas_les_ventes_d_un_autre_commercant(): void
    {
        [$moi, $monJeton] = $this->inscrireCommercant('moi@test.sn');
        [$autre] = $this->inscrireCommercant('autre@test.sn');

        $this->vendre($moi, 1000, 1, true);
        $this->vendre($autre, 50000, 99, true);

        $this->withToken($monJeton)->getJson('/api/statistiques/resume-jour')
            ->assertOk()->assertJson(['ca' => 1000, 'articles' => 1]);
    }

    public function test_un_employe_sans_permission_vente_ne_decouvre_pas_la_recette(): void
    {
        // Le point sensible : aujourd'hui cet employé reçoit 403 sur /ventes et
        // ne peut donc PAS connaître le chiffre d'affaires. Cette route ne doit
        // pas devenir une porte dérobée.
        [$patron] = $this->inscrireCommercant('patron@test.sn');
        $this->vendre($patron, 7000, 5, true);

        [, $jeton] = $this->creerEmploye($patron, ['stock' => true], 'magasinier@test.sn');

        $reponse = $this->withToken($jeton)->getJson('/api/statistiques/resume-jour')->assertOk();

        // `null` et non 0 : un zéro se confondrait avec « aucune vente ».
        $this->assertNull($reponse->json('ca'), 'La recette ne doit pas fuiter');
        $this->assertNull($reponse->json('articles'));
        $this->assertNotNull($reponse->json('stock'), 'Le stock, lui, le regarde');
    }

    public function test_un_vendeur_voit_bien_les_chiffres_du_jour(): void
    {
        [$patron] = $this->inscrireCommercant('patron2@test.sn');
        $this->vendre($patron, 2500, 4, true);

        [, $jeton] = $this->creerEmploye($patron, ['vente' => true], 'vendeur@test.sn');

        $this->withToken($jeton)->getJson('/api/statistiques/resume-jour')
            ->assertOk()->assertJson(['ca' => 2500, 'articles' => 4]);
    }

    public function test_la_reponse_reste_minuscule_quel_que_soit_l_historique(): void
    {
        // C'est la raison d'être de la route : le poids ne doit PAS grandir
        // avec le nombre de ventes.
        [$proprietaire, $jeton] = $this->inscrireCommercant();
        for ($i = 0; $i < 60; $i++) {
            $this->vendre($proprietaire, 100, 1, true);
        }

        $taille = strlen($this->withToken($jeton)->getJson('/api/statistiques/resume-jour')
            ->assertOk()->getContent());

        $this->assertLessThan(200, $taille, "Réponse de {$taille} octets — l'agrégat doit rester constant");
    }
}
