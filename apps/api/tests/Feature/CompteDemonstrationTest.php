<?php

namespace Tests\Feature;

use App\Models\MembreBoutique;
use App\Models\Produit;
use App\Models\ReglagesAbonnement;
use App\Models\Utilisateur;
use App\Models\Vente;
use App\Models\Scopes\CloisonnementBoutique;
use App\Services\Demonstration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/** Le compte public de démonstration : remis à neuf chaque jour, et sans paiement possible. */
class CompteDemonstrationTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Http::fake();
        $this->seed(); // administrateur, commerçant et employé de démonstration
    }

    private function connexionDemo(): string
    {
        return $this->postJson('/api/auth/connexion', ['identifiant' => 'demo@samacommerce.sn', 'mot_de_passe' => 'password'])
            ->assertOk()->json('jeton');
    }

    public function test_la_remise_a_zero_ne_touche_que_le_compte_de_demonstration(): void
    {
        $motDePasseAdmin = Utilisateur::where('identifiant', 'admin@samacommerce.sn')->value('mot_de_passe');
        [$autre, $jetonAutre] = $this->inscrireCommercant('autre@test.sn', 'Autre boutique');
        $produitAutre = $this->postJson('/api/produits', ['nom' => 'Mil', 'prix_vente' => 500, 'stock' => 10], $this->entetes($jetonAutre))->assertCreated()->json('id');
        $this->postJson('/api/ventes', ['produit_id' => $produitAutre, 'quantite' => 1, 'moyen_paiement' => 'especes'], $this->entetes($jetonAutre))->assertCreated();

        // Un visiteur passe sur le compte de démonstration et le transforme.
        $jetonDemo = $this->connexionDemo();
        $ajout = $this->postJson('/api/produits', ['nom' => 'Produit du visiteur', 'prix_vente' => 100, 'stock' => 5], $this->entetes($jetonDemo))->assertCreated()->json('id');
        $this->postJson('/api/ventes', ['produit_id' => $ajout, 'quantite' => 2, 'moyen_paiement' => 'especes'], $this->entetes($jetonDemo))->assertCreated();
        $this->putJson('/api/auth/profil', ['nom_commerce' => 'Nom changé par un visiteur'], $this->entetes($jetonDemo))->assertOk();

        $this->assertTrue(Demonstration::reinitialiser());

        $demo = Utilisateur::where('identifiant', 'demo@samacommerce.sn')->firstOrFail();
        CloisonnementBoutique::activer(null);
        $this->assertSame('Ma Boutique', $demo->nom_commerce);
        $this->assertSame(
            ['Eau minérale', 'Huile (litre)', 'Jus en sachet', 'Riz parfumé (kg)', 'Sucre (kg)'],
            Produit::where('utilisateur_id', $demo->id)->orderBy('nom')->pluck('nom')->all(),
        );
        $this->assertSame(0, Vente::where('utilisateur_id', $demo->id)->where('produit_id', $ajout)->count());
        $this->assertGreaterThan(30, Vente::where('utilisateur_id', $demo->id)->count());
        $this->assertSame(2, $demo->boutiques()->count());
        $this->assertTrue(MembreBoutique::where('proprietaire_id', $demo->id)->where('statut', 'acceptee')
            ->where('boutique_rattachement_id', $demo->boutique_active_id)->exists());

        // Les sessions des visiteurs sont fermées ; le mot de passe d'usine refonctionne.
        $this->getJson('/api/auth/moi', $this->entetes($jetonDemo))->assertUnauthorized();
        $jeton = $this->connexionDemo();
        $this->assertSame('essai', $this->getJson('/api/abonnement', $this->entetes($jeton))->json('etat.source'));

        // Rien d'autre n'a bougé (lu sans la boutique fixée par la dernière requête).
        CloisonnementBoutique::activer(null);
        $this->assertSame($motDePasseAdmin, Utilisateur::where('identifiant', 'admin@samacommerce.sn')->value('mot_de_passe'));
        $this->assertSame(1, Vente::where('utilisateur_id', $autre->id)->count());
        $this->assertSame(['Mil'], Produit::where('utilisateur_id', $autre->id)->pluck('nom')->all());
    }

    /* `cree_le` n'est pas remplissable : `Vente::create` l'ignorait sans rien
       dire, et toute l'histoire de la démonstration tombait le jour de la remise
       à zéro (« Encaissé aujourd'hui » = un mois de ventes, graphiques d'une
       seule barre). */
    public function test_la_demonstration_repart_avec_un_mois_de_ventes_datees(): void
    {
        $this->assertTrue(Demonstration::reinitialiser());

        CloisonnementBoutique::activer(null);
        $demo = Utilisateur::where('identifiant', 'demo@samacommerce.sn')->value('id');
        $this->assertSame(0, Vente::where('utilisateur_id', $demo)->where('cree_le', '>=', now()->startOfDay())->count());
        $this->assertTrue(Vente::where('utilisateur_id', $demo)->where('cree_le', '<', now()->subDays(29))->exists());
        $this->assertTrue(Vente::where('utilisateur_id', $demo)->where('moyen_paiement', 'credit')
            ->whereBetween('cree_le', [now()->subDays(11), now()->subDays(9)])->exists());
    }

    public function test_aucun_paiement_ne_se_declare_sur_le_compte_de_demonstration(): void
    {
        ReglagesAbonnement::courants()->update(['numero_wave' => '77 000 00 01']);
        ReglagesAbonnement::oublier();
        $jeton = $this->connexionDemo();

        $this->getJson('/api/abonnement', $this->entetes($jeton))->assertOk()
            ->assertJsonPath('demonstration', true)
            ->assertJsonPath('peut_payer', false)
            // Le compte est public : les numéros de paiement n'y sont pas exposés.
            ->assertJsonPath('paiement.numero_wave', null)
            ->assertJsonPath('paiement.nom_beneficiaire', null);
        $this->postJson('/api/abonnement/paiements', [
            'plan' => 'pro', 'periode' => 'mois', 'moyen' => 'wave', 'numero_payeur' => '77 000 00 00', 'reference' => 'TX-VISITEUR', 'montant' => 5000,
        ], $this->entetes($jeton))->assertForbidden();

        $this->assertSame(0, \App\Models\PaiementAbonnement::count());
    }

    public function test_sans_compte_de_demonstration_la_remise_a_zero_ne_fait_rien(): void
    {
        config(['app.compte_demo' => 'absent@test.sn']);

        $this->assertFalse(Demonstration::reinitialiser());
    }
}
