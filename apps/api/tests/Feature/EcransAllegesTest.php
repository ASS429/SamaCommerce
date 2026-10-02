<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * Crédits, Inventaire, Chiffres et Retours téléchargeaient TOUT l'historique des
 * ventes pour en tirer quelques nombres. Le serveur leur sert désormais ce
 * qu'ils affichent ; chaque réponse est comparée ici au calcul que faisait
 * l'écran sur la liste complète (GET /ventes).
 */
class EcransAllegesTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    private string $jeton;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Http::fake();
        $this->travelTo(Carbon::parse('2026-10-15 12:00:00'));
    }

    /** Ventes réparties dans le temps, une à crédit impayée, une remboursée, une à la corbeille, une entièrement rendue. */
    private function boutiqueAvecVentes(): array
    {
        [$commercant, $this->jeton] = $this->inscrireCommercant();
        $produit = fn (string $nom, int $prix) => $this->postJson('/api/produits', ['nom' => $nom, 'prix_vente' => $prix, 'prix_achat' => $prix - 200, 'stock' => 100], $this->entetes($this->jeton))->assertCreated()->json('id');
        $riz = $produit('Riz', 600);
        $huile = $produit('Huile', 1000);
        $vendre = function (int $produitId, int $quantite, string $moyen, ?string $quand = null) {
            $id = $this->postJson('/api/ventes', ['produit_id' => $produitId, 'quantite' => $quantite, 'moyen_paiement' => $moyen, 'nom_client' => 'Awa'], $this->entetes($this->jeton))->assertCreated()->json('id');
            if ($quand) {
                DB::table('ventes')->where('id', $id)->update(['cree_le' => Carbon::parse($quand)]);
            }

            return $id;
        };

        $ancienne = $vendre($riz, 2, 'especes', '2026-09-05 10:00:00');      // 1 200, hors du mois
        $vendre($huile, 1, 'wave', '2026-10-05 10:00:00');                     // 1 000, dans le mois
        $creditImpaye = $vendre($riz, 3, 'credit', '2026-10-12 09:00:00');    // 1 800, dans la semaine
        $creditPaye = $vendre($huile, 2, 'credit');                            // 2 000, aujourd'hui
        DB::table('ventes')->where('id', $creditPaye)->update(['paye' => true]);
        $corbeille = $vendre($riz, 1, 'especes');                              // 600, mise à la corbeille
        $this->deleteJson("/api/ventes/{$corbeille}", [], $this->entetes($this->jeton))->assertOk();
        $rendue = $vendre($riz, 4, 'especes');                                 // 2 400, entièrement rendue
        $this->postJson('/api/retours', ['vente_id' => $rendue, 'quantite' => 4], $this->entetes($this->jeton))->assertCreated();

        return compact('commercant', 'riz', 'huile', 'ancienne', 'creditImpaye', 'creditPaye', 'corbeille', 'rendue');
    }

    private function listeComplete(): array
    {
        return $this->getJson('/api/ventes', $this->entetes($this->jeton))->assertOk()->json();
    }

    public function test_credits_ne_recoit_que_les_ventes_a_credit(): void
    {
        $this->boutiqueAvecVentes();
        $attendu = array_values(array_filter($this->listeComplete(), fn ($v) => $v['moyen_paiement'] === 'credit'));

        $obtenu = $this->getJson('/api/ventes?moyen=credit', $this->entetes($this->jeton))->assertOk()->json();

        $this->assertCount(2, $obtenu);
        $this->assertSame($attendu, $obtenu);
    }

    public function test_l_inventaire_recoit_les_quantites_vendues_par_produit(): void
    {
        $v = $this->boutiqueAvecVentes();
        $attendu = [];
        foreach ($this->listeComplete() as $vente) {
            $attendu[$vente['produit_id']] = ($attendu[$vente['produit_id']] ?? 0) + $vente['quantite'];
        }

        $obtenu = collect($this->getJson('/api/ventes/quantites-par-produit', $this->entetes($this->jeton))->assertOk()->json())
            ->mapWithKeys(fn ($ligne) => [$ligne['produit_id'] => $ligne['quantite']])->all();

        ksort($attendu);
        ksort($obtenu);
        $this->assertSame($attendu, $obtenu);
        // 2 + 3 + 4 riz vendus, moins les 4 rendus (le retour s'enregistre en vente négative) ;
        // la vente à la corbeille ne compte pas.
        $this->assertSame([$v['riz'] => 5, $v['huile'] => 3], $obtenu);
    }

    public function test_les_chiffres_recoivent_leurs_indicateurs_tout_faits(): void
    {
        $this->boutiqueAvecVentes();
        $bornes = ['jour' => '2026-10-15T00:00:00Z', 'semaine' => '2026-10-08T12:00:00Z', 'mois' => '2026-09-15T12:00:00Z'];
        $liste = $this->listeComplete();
        $somme = fn (?string $depuis, bool $paye) => array_sum(array_map(fn ($v) => $v['total'], array_filter($liste,
            fn ($v) => $v['paye'] === $paye && (! $depuis || Carbon::parse($v['cree_le'])->gte(Carbon::parse($depuis))))));
        $credits = array_filter($liste, fn ($v) => $v['moyen_paiement'] === 'credit');

        $obtenu = $this->getJson('/api/statistiques/indicateurs?'.http_build_query($bornes), $this->entetes($this->jeton))->assertOk()->json();

        foreach (['jour', 'semaine', 'mois', 'tout'] as $periode) {
            $this->assertSame($somme($bornes[$periode] ?? null, true), $obtenu['encaisse'][$periode], "encaissé ($periode)");
            $this->assertSame($somme($bornes[$periode] ?? null, false), $obtenu['attente'][$periode], "en attente ($periode)");
        }
        $this->assertSame(['rembourses' => 2000, 'impayes' => 1800], $obtenu['credits']);
        $this->assertSame(array_sum(array_map(fn ($v) => $v['total'], array_filter($credits, fn ($v) => ! $v['paye']))), $obtenu['credits']['impayes']);
        // Les périodes s'emboîtent réellement : chaque borne change le résultat.
        // (le remboursement du retour du jour s'y soustrait, comme sur l'écran)
        $this->assertSame(['jour' => 2000, 'semaine' => 2000, 'mois' => 3000, 'tout' => 4200], $obtenu['encaisse']);
        $this->assertSame(['jour' => 0, 'semaine' => 1800, 'mois' => 1800, 'tout' => 1800], $obtenu['attente']);
    }

    public function test_le_retour_ne_propose_que_des_ventes_encore_rendables(): void
    {
        $v = $this->boutiqueAvecVentes();

        $ids = array_column($this->getJson('/api/retours/ventes-retournables', $this->entetes($this->jeton))->assertOk()->json(), 'id');

        $this->assertNotContains($v['rendue'], $ids);      // déjà entièrement rendue
        $this->assertNotContains($v['corbeille'], $ids);   // à la corbeille
        $this->assertContains($v['ancienne'], $ids);
        $this->assertContains($v['creditImpaye'], $ids);
        $this->assertCount(4, $ids);
    }

    /** Chaque écran garde le droit qui l'ouvre, sans exiger en plus le droit « vente ». */
    public function test_chaque_ecran_garde_le_droit_qui_l_ouvre(): void
    {
        $v = $this->boutiqueAvecVentes();
        [, $stock] = $this->creerEmploye($v['commercant'], ['stock' => true], 'stock@test.sn');
        [, $rapports] = $this->creerEmploye($v['commercant'], ['rapports' => true], 'rapports@test.sn');
        [, $credits] = $this->creerEmploye($v['commercant'], ['credits' => true], 'credits@test.sn');

        // Avant : l'inventaire et les chiffres passaient par GET /ventes, réservé au droit « vente ».
        $this->getJson('/api/ventes', $this->entetes($stock))->assertForbidden();
        $this->getJson('/api/ventes/quantites-par-produit', $this->entetes($stock))->assertOk();
        $this->getJson('/api/statistiques/indicateurs', $this->entetes($rapports))->assertOk();
        $this->getJson('/api/retours/ventes-retournables', $this->entetes($credits))->assertOk();
        $this->getJson('/api/statistiques/indicateurs', $this->entetes($stock))->assertForbidden();
    }
}
