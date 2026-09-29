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

    /**
     * Une vente faite HORS LIGNE sur l'ancienne version de l'application,
     * envoyée après la mise à jour du serveur, doit être reçue : c'est la
     * garantie que la francisation ne fait perdre aucune vente.
     */
    public function test_une_vente_hors_ligne_de_l_ancienne_application_est_recue(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        $p = $this->postJson('/api/produits', ['nom' => 'Pain', 'prix_vente' => 150, 'stock' => 20], $this->entetes($jeton))->assertCreated()->json();
        $uuid = (string) Str::uuid();

        // Exactement ce qu'envoie l'ancienne application : ancienne adresse,
        // anciens noms de champs, sans l'en-tête du nouveau format.
        $this->app['auth']->forgetGuards();
        $r = $this->postJson('/api/sales/sync', ['sales' => [[
            'client_uuid' => $uuid, 'product_id' => $p['id'], 'quantity' => 3, 'payment_method' => 'wave',
            'created_at' => '2026-09-15T09:00:00Z', 'label' => '3× Pain — 450 F',
        ]]], ['Authorization' => 'Bearer '.$jeton])->assertOk()->json();

        $this->assertSame([$uuid], $r['synced']);
        $vente = Vente::firstOrFail();
        $this->assertSame($uuid, $vente->uuid_appareil);
        $this->assertSame(3, $vente->quantite);
        $this->assertSame('wave', $vente->moyen_paiement);
        $this->assertSame(450, $vente->total);
    }
}
