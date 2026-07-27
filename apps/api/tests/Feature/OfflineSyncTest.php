<?php

namespace Tests\Feature;

use App\Models\Sale;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

class OfflineSyncTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    /** T11 — la synchronisation d'un lot est idempotente (rejouable sans doublon). */
    public function test_sync_is_idempotent(): void
    {
        [, $token] = $this->registerOwner();
        $p = $this->postJson('/api/products', ['name' => 'Café', 'price' => 250, 'stock' => 100], $this->auth($token))->assertCreated()->json();

        $uuid = (string) Str::uuid();
        $batch = ['sales' => [[
            'client_uuid' => $uuid, 'product_id' => $p['id'], 'quantity' => 2, 'payment_method' => 'especes',
        ]]];

        // 1er envoi → synchronisée.
        $r1 = $this->postJson('/api/sales/sync', $batch, $this->auth($token))->assertOk()->json();
        $this->assertSame([$uuid], $r1['synced']);
        $this->assertCount(1, Sale::all());

        // Rejeu du MÊME lot → détectée comme doublon, aucune vente créée en plus.
        $r2 = $this->postJson('/api/sales/sync', $batch, $this->auth($token))->assertOk()->json();
        $this->assertSame([$uuid], $r2['duplicates']);
        $this->assertCount(1, Sale::all());
    }

    /** T11 — une vente en échec (produit inconnu) n'interrompt pas le lot. */
    public function test_sync_reports_failures_without_aborting(): void
    {
        [, $token] = $this->registerOwner();
        $p = $this->postJson('/api/products', ['name' => 'Thé', 'price' => 100, 'stock' => 100], $this->auth($token))->assertCreated()->json();

        $good = (string) Str::uuid();
        $bad = (string) Str::uuid();
        $batch = ['sales' => [
            ['client_uuid' => $good, 'product_id' => $p['id'], 'quantity' => 1, 'payment_method' => 'especes'],
            ['client_uuid' => $bad, 'product_id' => 999999, 'quantity' => 1, 'payment_method' => 'especes'],
        ]];

        $r = $this->postJson('/api/sales/sync', $batch, $this->auth($token))->assertOk()->json();
        $this->assertSame([$good], $r['synced']);
        $this->assertCount(1, $r['failed']);
        $this->assertSame($bad, $r['failed'][0]['client_uuid']);
    }
}
