<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/** « Appareils connectés » : la liste des sessions, et déconnecter les autres seulement. */
class AppareilsConnectesTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    public function test_la_liste_montre_chaque_appareil_et_reconnait_celui_ci(): void
    {
        $this->postJson('/api/auth/inscription', [
            'identifiant' => 'patron@test.sn', 'mot_de_passe' => 'Password123', 'nom_appareil' => 'ordi-1a2b3c4d',
        ])->assertCreated();
        $jeton = $this->postJson('/api/auth/connexion', [
            'identifiant' => 'patron@test.sn', 'mot_de_passe' => 'Password123', 'nom_appareil' => 'mobile-9z8y7x6w',
        ])->assertOk()->json('jeton');

        $appareils = $this->getJson('/api/auth/appareils', $this->entetes($jeton))->assertOk()->json();

        $this->assertCount(2, $appareils);
        $actuels = array_values(array_filter($appareils, fn ($a) => $a['actuel']));
        $this->assertCount(1, $actuels);
        $this->assertSame('telephone', $actuels[0]['type']);
        $this->assertContains('ordinateur', array_column($appareils, 'type'));
        // L'identifiant d'appareil ne sort pas : il ne dit rien à personne.
        $this->assertArrayNotHasKey('name', $appareils[0]);
    }

    public function test_deconnecter_les_autres_garde_cet_appareil(): void
    {
        [$proprietaire, $jeton] = $this->inscrireCommercant();
        $proprietaire->createToken('mobile-autre');
        $proprietaire->createToken('ordi-autre');

        $this->postJson('/api/auth/deconnexion-autres', [], $this->entetes($jeton))
            ->assertOk()->assertJsonPath('deconnectes', 2);

        $this->assertSame(1, $proprietaire->fresh()->tokens()->count());
        $this->getJson('/api/auth/moi', $this->entetes($jeton))->assertOk();
    }
}
