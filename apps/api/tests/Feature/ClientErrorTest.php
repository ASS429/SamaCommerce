<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * POST /api/client-errors — remontée des plantages du navigateur.
 *
 * L'endpoint est PUBLIC (beaucoup d'erreurs arrivent avant la connexion) : ces
 * tests vérifient surtout qu'il ne devienne pas un dépotoir ni un miroir.
 */
class ClientErrorTest extends TestCase
{
    use RefreshDatabase;

    public function test_journalise_une_erreur_du_navigateur(): void
    {
        Log::spy();

        $this->postJson('/api/client-errors', [
            'message' => "Cannot read properties of undefined",
            'stack' => "TypeError\n  at Stock.tsx:42",
            'url' => '/stock',
            'kind' => 'react',
        ])->assertNoContent();

        Log::shouldHaveReceived('warning')
            ->withArgs(fn ($msg, $ctx) => str_contains($msg, 'Cannot read properties')
                && $ctx['kind'] === 'react' && $ctx['url'] === '/stock')
            ->once();
    }

    public function test_accessible_sans_etre_connecte(): void
    {
        // Une erreur sur l'écran de connexion est justement celle qu'on veut voir.
        $this->postJson('/api/client-errors', ['message' => 'plantage au login'])
            ->assertNoContent();
    }

    public function test_refuse_une_charge_demesuree(): void
    {
        // Sans plafond, l'endpoint public deviendrait un stockage gratuit.
        $this->postJson('/api/client-errors', [
            'message' => str_repeat('x', 5000),
        ])->assertStatus(422);
    }

    public function test_exige_un_message(): void
    {
        $this->postJson('/api/client-errors', ['url' => '/stock'])->assertStatus(422);
    }

    public function test_ne_renvoie_jamais_le_contenu_recu(): void
    {
        // Pas d'écho : un endpoint public qui réaffiche son entrée est un
        // vecteur commode pour faire héberger n'importe quoi par l'API.
        $res = $this->postJson('/api/client-errors', ['message' => 'MARQUEUR_UNIQUE_42']);

        $res->assertNoContent();
        $this->assertStringNotContainsString('MARQUEUR_UNIQUE_42', $res->getContent());
    }
}
