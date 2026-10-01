<?php

namespace Tests\Feature;

use App\Models\Vente;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

class SynchronisationHorsLigneTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    /** T11 — la synchronisation d'un lot est idempotente (rejouable sans doublon). */
    public function test_la_synchronisation_est_idempotente(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->postJson('/api/produits', ['nom' => 'Café', 'prix_vente' => 250, 'stock' => 100], $this->entetes($jeton))->assertCreated()->json();

        $uuid = (string) Str::uuid();
        $lot = ['ventes' => [[
            'uuid_appareil' => $uuid, 'produit_id' => $p['id'], 'quantite' => 2, 'moyen_paiement' => 'especes',
        ]]];

        // 1er envoi → synchronisée.
        $r1 = $this->postJson('/api/ventes/synchroniser', $lot, $this->entetes($jeton))->assertOk()->json();
        $this->assertSame([$uuid], $r1['synchronisees']);
        $this->assertCount(1, Vente::all());

        // Rejeu du MÊME lot → reconnue comme doublon, aucune vente de plus.
        $r2 = $this->postJson('/api/ventes/synchroniser', $lot, $this->entetes($jeton))->assertOk()->json();
        $this->assertSame([$uuid], $r2['doublons']);
        $this->assertCount(1, Vente::all());
    }

    /**
     * Défaut corrigé le 01/10/2026 : une vente reçue puis mise à la corbeille,
     * que le téléphone renvoie (accusé de réception perdu), heurtait l'index
     * unique et partait en échec. Elle restait alors « en attente » pour
     * toujours sur le téléphone. Elle est désormais reconnue comme doublon —
     * et ne ressort pas de la corbeille.
     */
    public function test_une_vente_renvoyee_apres_sa_mise_a_la_corbeille_est_un_doublon(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->postJson('/api/produits', ['nom' => 'Café', 'prix_vente' => 250, 'stock' => 100], $this->entetes($jeton))->assertCreated()->json();
        $uuid = (string) Str::uuid();
        $lot = ['ventes' => [[
            'uuid_appareil' => $uuid, 'produit_id' => $p['id'], 'quantite' => 1, 'moyen_paiement' => 'especes',
        ]]];

        $this->postJson('/api/ventes/synchroniser', $lot, $this->entetes($jeton))->assertOk()->assertJson(['synchronisees' => [$uuid]]);
        $vente = Vente::where('uuid_appareil', $uuid)->firstOrFail();
        $this->deleteJson('/api/ventes/'.$vente->id, [], $this->entetes($jeton))->assertOk();

        $r = $this->postJson('/api/ventes/synchroniser', $lot, $this->entetes($jeton))->assertOk()->json();
        $this->assertSame([$uuid], $r['doublons']);
        $this->assertSame([], $r['echecs']);
        $this->assertSame(0, Vente::count(), 'La vente annulée ne ressort pas de la corbeille');
        $this->assertSame(1, Vente::onlyTrashed()->count());
    }

    /** T11 — une vente en échec (produit inconnu) n'interrompt pas le lot. */
    public function test_un_echec_n_interrompt_pas_le_lot(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->postJson('/api/produits', ['nom' => 'Thé', 'prix_vente' => 100, 'stock' => 100], $this->entetes($jeton))->assertCreated()->json();

        $bonne = (string) Str::uuid();
        $mauvaise = (string) Str::uuid();
        $lot = ['ventes' => [
            ['uuid_appareil' => $bonne, 'produit_id' => $p['id'], 'quantite' => 1, 'moyen_paiement' => 'especes'],
            ['uuid_appareil' => $mauvaise, 'produit_id' => 999999, 'quantite' => 1, 'moyen_paiement' => 'especes'],
        ]];

        $r = $this->postJson('/api/ventes/synchroniser', $lot, $this->entetes($jeton))->assertOk()->json();
        $this->assertSame([$bonne], $r['synchronisees']);
        $this->assertCount(1, $r['echecs']);
        $this->assertSame($mauvaise, $r['echecs'][0]['uuid_appareil']);
    }
}
