<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** L'adresse de santé dit quel code est réellement en ligne. */
class SanteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        Http::fake(); // pas d'appel réseau vers le micro-service IA
    }

    public function test_le_commit_deploye_n_apparait_qu_en_ligne(): void
    {
        // Hors de Render (postes, tests) : pas de commit, réponse inchangée.
        $this->getJson('/api/sante')->assertOk()->assertJsonMissingPath('commit');

        // Render fournit RENDER_GIT_COMMIT à chaque mise en ligne.
        config(['app.commit' => '903b04e']);
        $this->getJson('/api/sante')->assertOk()->assertJsonPath('commit', '903b04e');
    }
}
