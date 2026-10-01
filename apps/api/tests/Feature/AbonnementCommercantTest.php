<?php

namespace Tests\Feature;

use App\Models\PaiementAbonnement;
use App\Models\Produit;
use App\Models\ReglagesAbonnement;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * Abonnement vu du commerçant : essai offert, déclaration d'un paiement
 * (montant calculé par le serveur, rien ne s'active avant la validation),
 * limites et fonctionnalités du plan qui s'applique.
 */
class AbonnementCommercantTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Carbon::parse('2026-10-20 10:00:00'));
        ReglagesAbonnement::courants()->update(['numero_wave' => '77 000 00 01', 'numero_orange' => '78 000 00 02']);
        ReglagesAbonnement::oublier();
    }

    private function declarer(string $jeton, array $champs = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/abonnement/paiements', $champs + [
            'plan' => 'pro', 'periode' => 'mois', 'moyen' => 'wave',
            'numero_payeur' => '77 123 45 67', 'reference' => 'tx-8f3k q2lm', 'montant' => 5000,
        ], $this->entetes($jeton));
    }

    public function test_l_inscription_offre_trente_jours_du_plan_pro(): void
    {
        [$commercant, $jeton] = $this->inscrireCommercant();

        $etat = $this->getJson('/api/abonnement', $this->entetes($jeton))->assertOk()->json();
        $this->assertSame('pro', $etat['etat']['plan']['code']);
        $this->assertSame('essai', $etat['etat']['source']);
        $this->assertSame('2026-11-19', $etat['etat']['essai_jusqu_au']);
        $this->assertSame(30, $etat['etat']['jours_restants']);
        $this->assertSame('77 000 00 01', $etat['paiement']['numero_wave']);
        $this->assertCount(4, $etat['plans']);
        // Le plan PAYÉ reste « Gratuit » : l'essai n'est pas un paiement.
        $this->assertSame('Gratuit', $commercant->fresh()->plan);
    }

    public function test_le_montant_attendu_vient_du_serveur_et_rien_ne_s_active_avant_la_validation(): void
    {
        [$commercant, $jeton] = $this->inscrireCommercant();

        // Montant déclaré trop bas : enregistré tel quel, l'écart sera visible.
        $paiement = $this->declarer($jeton, ['montant' => 4500])->assertCreated()->json('paiement');
        $this->assertSame('en_attente', $paiement['statut']);
        $this->assertSame(5000, $paiement['montant_attendu']);
        $this->assertSame(4500, $paiement['montant_declare']);
        $this->assertSame('TX-8F3K Q2LM', $paiement['reference']);

        $this->assertSame('Gratuit', $commercant->fresh()->plan);
        $etat = $this->getJson('/api/abonnement', $this->entetes($jeton))->json();
        $this->assertSame('essai', $etat['etat']['source']);
        $this->assertSame($paiement['id'], $etat['en_attente']['id']);

        // Un an : 12 mois moins 2 offerts.
        PaiementAbonnement::query()->delete();
        $annuel = $this->declarer($jeton, ['periode' => 'an', 'reference' => 'TX-ANNUEL', 'montant' => 50000])->assertCreated();
        $this->assertSame(50000, $annuel->json('paiement.montant_attendu'));
    }

    public function test_une_seule_declaration_a_la_fois_et_une_reference_ne_sert_qu_une_fois(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        [, $autre] = $this->inscrireCommercant('autre@test.sn', 'Autre');

        $this->declarer($jeton)->assertCreated();
        // Déjà un paiement en cours de vérification : on attend son résultat.
        $this->declarer($jeton, ['reference' => 'TX-AUTRE'])->assertStatus(409);
        // La même transaction, écrite autrement, par un autre compte : refusée.
        $this->declarer($autre, ['reference' => 'TX 8F3K-Q2LM'])->assertStatus(422)->assertJsonValidationErrors('reference');
        $this->declarer($autre, ['reference' => 'tx8f3kq2lm'])->assertStatus(422);
        // Même référence chez l'autre opérateur : une autre transaction.
        $this->declarer($autre, ['reference' => 'TX8F3KQ2LM', 'moyen' => 'orange'])->assertCreated();
    }

    public function test_une_reference_refusee_peut_etre_redeclaree(): void
    {
        [$commercant, $jeton] = $this->inscrireCommercant();
        $this->declarer($jeton)->assertCreated();
        PaiementAbonnement::where('utilisateur_id', $commercant->id)->update([
            'statut' => 'refuse', 'motif_refus' => 'Montant incorrect', 'decide_le' => Carbon::now(),
        ]);

        $etat = $this->getJson('/api/abonnement', $this->entetes($jeton))->json();
        $this->assertNull($etat['en_attente']);
        $this->assertSame('Montant incorrect', $etat['dernier_refus']['motif_refus']);

        $this->declarer($jeton)->assertCreated();
    }

    public function test_les_declarations_impossibles_sont_refusees_avec_une_raison(): void
    {
        [$proprietaire, $jeton] = $this->inscrireCommercant();

        // Sur devis : on écrit, on ne paie pas en ligne.
        $this->declarer($jeton, ['plan' => 'entreprise'])->assertStatus(422)->assertJsonValidationErrors('plan');
        // Le Gratuit ne se paie pas.
        $this->declarer($jeton, ['plan' => 'gratuit'])->assertStatus(422);
        // Sans référence, rien à vérifier.
        $this->declarer($jeton, ['reference' => ''])->assertStatus(422)->assertJsonValidationErrors('reference');
        // Moyen dont le numéro n'est pas encore configuré.
        ReglagesAbonnement::courants()->update(['numero_orange' => null]);
        ReglagesAbonnement::oublier();
        $this->declarer($jeton, ['moyen' => 'orange'])->assertStatus(422)->assertJsonValidationErrors('moyen');
        // Un employé lit le plan, mais ne paie pas.
        [, $jetonEmploye] = $this->creerEmploye($proprietaire, ['vente' => true]);
        $this->getJson('/api/abonnement', $this->entetes($jetonEmploye))->assertOk()->assertJsonPath('peut_payer', false);
        $this->declarer($jetonEmploye)->assertStatus(403);
    }

    public function test_apres_l_essai_les_ajouts_au_dela_du_plan_gratuit_sont_refuses_sans_rien_retirer(): void
    {
        [$proprietaire, $jeton] = $this->inscrireCommercant();
        // Pendant l'essai Pro : fournisseurs, rapports complets, boutiques…
        $fournisseur = $this->postJson('/api/fournisseurs', ['nom' => 'Grossiste'], $this->entetes($jeton))->assertCreated()->json('id');
        Produit::withoutEvents(function () use ($proprietaire) {
            for ($i = 1; $i <= 100; $i++) {
                Produit::create(['utilisateur_id' => $proprietaire->id, 'boutique_id' => $proprietaire->boutique_active_id, 'nom' => "Produit {$i}", 'prix_vente' => 100]);
            }
        });

        // Un mois plus tard (nouveau jeton : les jetons expirent au bout de 7 jours).
        $this->travel(31)->days();
        $jeton = $proprietaire->createToken('test')->plainTextToken;
        $etat = $this->getJson('/api/abonnement', $this->entetes($jeton))->json('etat');
        $this->assertSame('gratuit', $etat['plan']['code']);

        // 101e produit : refusé, avec le plan qui le permet.
        $this->postJson('/api/produits', ['nom' => 'Un de trop', 'prix_vente' => 100], $this->entetes($jeton))
            ->assertStatus(402)->assertJson(['code' => 'LIMITE_PRODUITS_ATTEINTE', 'plan_requis' => 'essentiel']);
        // …mais les 100 produits restent là et vendables.
        $this->assertCount(100, $this->getJson('/api/produits', $this->entetes($jeton))->json());

        $this->postJson('/api/boutiques', ['nom' => 'Deuxième'], $this->entetes($jeton))
            ->assertStatus(402)->assertJson(['code' => 'LIMITE_BOUTIQUES_ATTEINTE', 'plan_requis' => 'pro']);
        $this->postJson('/api/membres/inviter', ['email' => 'aide@test.sn'], $this->entetes($jeton))
            ->assertStatus(402)->assertJson(['code' => 'LIMITE_EMPLOYES_ATTEINTE', 'plan_requis' => 'essentiel']);

        // Fournisseurs : la LECTURE reste permise, l'ajout est réservé.
        $this->getJson('/api/fournisseurs', $this->entetes($jeton))->assertOk()->assertJsonPath('0.id', $fournisseur);
        $this->postJson('/api/fournisseurs', ['nom' => 'Autre'], $this->entetes($jeton))
            ->assertStatus(402)->assertJson(['code' => 'FONCTIONNALITE_NON_INCLUSE', 'fonctionnalite' => 'fournisseurs_commandes']);

        // Rapports du jour et de la semaine : inclus ; rapports complets : non.
        $this->getJson('/api/statistiques/ventes-par-jour', $this->entetes($jeton))->assertOk();
        $this->getJson('/api/statistiques/marchandage', $this->entetes($jeton))->assertStatus(402);
        $this->getJson('/api/activite', $this->entetes($jeton))->assertStatus(402)->assertJsonPath('plan_requis', 'pro');
    }

    public function test_le_quota_de_conseils_ia_du_plan_gratuit(): void
    {
        [$commercant] = $this->inscrireCommercant();
        $this->travel(31)->days();
        $jeton = $commercant->createToken('test')->plainTextToken;

        for ($i = 0; $i < 5; $i++) {
            $this->getJson('/api/ia/reappro', $this->entetes($jeton))->assertOk();
        }
        $this->getJson('/api/ia/reappro', $this->entetes($jeton))
            ->assertStatus(402)->assertJson(['code' => 'QUOTA_IA_ATTEINT', 'plan_requis' => 'essentiel']);
        $this->assertSame(5, $this->getJson('/api/abonnement', $this->entetes($jeton))->json('utilisation.ia'));

        // Le mois suivant, le quota revient.
        $this->travel(1)->months();
        $jeton = $commercant->createToken('test')->plainTextToken;
        $this->getJson('/api/ia/reappro', $this->entetes($jeton))->assertOk();
    }

    public function test_le_delai_de_grace_garde_le_plan_puis_le_compte_repasse_au_gratuit(): void
    {
        [$commercant, $jeton] = $this->inscrireCommercant();
        $commercant->update(['essai_jusqu_au' => null]);
        PaiementAbonnement::create([
            'utilisateur_id' => $commercant->id, 'plan_code' => 'pro', 'periode' => 'mois',
            'montant_attendu' => 5000, 'montant_declare' => 5000, 'moyen' => 'wave', 'statut' => 'valide',
            'debut_le' => '2026-09-16', 'fin_le' => '2026-10-15',
        ]);

        $etat = $this->getJson('/api/abonnement', $this->entetes($jeton))->json('etat');
        $this->assertSame(['pro', 'grace', '2026-10-22'], [$etat['plan']['code'], $etat['source'], $etat['grace_jusqu_au']]);

        $this->travel(3)->days();
        $etat = $this->getJson('/api/abonnement', $this->entetes($jeton))->json('etat');
        $this->assertSame(['gratuit', 'gratuit', 'pro', '2026-10-15'], [$etat['plan']['code'], $etat['source'], $etat['plan_expire'], $etat['expire_le']]);
    }
}
