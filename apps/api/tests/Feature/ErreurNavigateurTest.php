<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * POST /api/erreurs-navigateur — remontée des plantages du navigateur.
 *
 * La route est PUBLIQUE (beaucoup d'erreurs arrivent avant la connexion) : ces
 * tests vérifient surtout qu'elle ne devienne pas un dépotoir ni un miroir.
 */
class ErreurNavigateurTest extends TestCase
{
    use RefreshDatabase;

    public function test_journalise_une_erreur_du_navigateur(): void
    {
        Log::spy();

        $this->postJson('/api/erreurs-navigateur', [
            'message' => "Cannot read properties of undefined",
            'pile' => "TypeError\n  at Stock.tsx:42",
            'url' => '/stock',
            'type' => 'react',
        ])->assertNoContent();

        Log::shouldHaveReceived('warning')
            ->withArgs(fn ($message, $contexte) => str_contains($message, 'Cannot read properties')
                && $contexte['type'] === 'react' && $contexte['url'] === '/stock')
            ->once();
    }

    public function test_accessible_sans_etre_connecte(): void
    {
        // Une erreur sur l'écran de connexion est justement celle qu'on veut voir.
        $this->postJson('/api/erreurs-navigateur', ['message' => 'plantage à la connexion'])
            ->assertNoContent();
    }

    public function test_refuse_une_charge_demesuree(): void
    {
        // Sans plafond, la route publique deviendrait un stockage gratuit.
        $this->postJson('/api/erreurs-navigateur', [
            'message' => str_repeat('x', 5000),
        ])->assertStatus(422);
    }

    public function test_exige_un_message(): void
    {
        $this->postJson('/api/erreurs-navigateur', ['url' => '/stock'])->assertStatus(422);
    }

    public function test_ne_renvoie_jamais_le_contenu_recu(): void
    {
        // Pas d'écho : une route publique qui réaffiche son entrée est un
        // vecteur commode pour faire héberger n'importe quoi par l'API.
        $reponse = $this->postJson('/api/erreurs-navigateur', ['message' => 'MARQUEUR_UNIQUE_42']);

        $reponse->assertNoContent();
        $this->assertStringNotContainsString('MARQUEUR_UNIQUE_42', $reponse->getContent());
    }
}
