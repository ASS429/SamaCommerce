<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

class SecuriteTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush(); // évite la fuite du limiteur de débit entre tests (cache « array »)
        Http::fake(); // pas d'appel réseau réel vers le micro-service IA
    }

    /** S3 — politique de mot de passe : trop court ou sans chiffre, refusé. */
    public function test_l_inscription_refuse_un_mot_de_passe_faible(): void
    {
        $this->postJson('/api/auth/inscription', ['identifiant' => 'a@b.sn', 'mot_de_passe' => 'abc'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('mot_de_passe');

        $this->postJson('/api/auth/inscription', ['identifiant' => 'a@b.sn', 'mot_de_passe' => 'abcdefgh'])
            ->assertStatus(422); // pas de chiffre
    }

    /**
     * Les refus de saisie doivent être en FRANÇAIS.
     *
     * Les traductions vivaient dans lang/fr/ depuis longtemps, mais
     * `config('app.locale')` valait 'en' et n'était surchargée nulle part : un
     * commerçant qui choisissait un mot de passe trop faible lisait
     * « The given password has appeared in a data leak ». Ce test verrouille
     * l'activation, pas seulement l'existence des fichiers de langue.
     */
    public function test_les_messages_de_validation_sont_en_francais(): void
    {
        $this->assertSame('fr', config('app.locale'));

        $court = $this->postJson('/api/auth/inscription', ['identifiant' => 'a@b.sn', 'mot_de_passe' => 'abc'])
            ->assertStatus(422)->json('errors.mot_de_passe.0');
        $this->assertStringContainsString('mot de passe', mb_strtolower((string) $court));

        $sansChiffre = $this->postJson('/api/auth/inscription', ['identifiant' => 'a@b.sn', 'mot_de_passe' => 'abcdefghij'])
            ->assertStatus(422)->json('errors.mot_de_passe.0');
        $this->assertStringContainsString('chiffre', mb_strtolower((string) $sansChiffre));

        $manquant = $this->postJson('/api/auth/inscription', ['identifiant' => 'a@b.sn'])
            ->assertStatus(422)->json('errors.mot_de_passe.0');
        $this->assertStringContainsString('obligatoire', mb_strtolower((string) $manquant));
    }

    /** S3 — message d'échec générique (pas d'énumération de comptes). */
    public function test_l_echec_de_connexion_reste_generique(): void
    {
        [$proprietaire] = $this->inscrireCommercant();

        $inconnu = $this->postJson('/api/auth/connexion', ['identifiant' => 'fantome@x.sn', 'mot_de_passe' => 'nimporte1'])
            ->assertStatus(422)->json('errors.identifiant.0');
        $mauvais = $this->postJson('/api/auth/connexion', ['identifiant' => $proprietaire->identifiant, 'mot_de_passe' => 'Mauvais9'])
            ->assertStatus(422)->json('errors.identifiant.0');

        $this->assertSame($inconnu, $mauvais, 'Les deux messages doivent être identiques (anti-énumération)');
        $this->assertStringContainsString('Identifiants', $inconnu);
    }

    /** S3 — verrouillage après 5 tentatives échouées. */
    public function test_verrouillage_apres_cinq_echecs(): void
    {
        [$proprietaire] = $this->inscrireCommercant();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/connexion', ['identifiant' => $proprietaire->identifiant, 'mot_de_passe' => 'Faux'.$i.'aaaa']);
        }

        $this->postJson('/api/auth/connexion', ['identifiant' => $proprietaire->identifiant, 'mot_de_passe' => 'Password123'])
            ->assertStatus(429); // bloqué même avec le bon mot de passe
    }

    /** S2 — expiration des jetons configurée (pas « à vie »). */
    public function test_l_expiration_des_jetons_est_configuree(): void
    {
        $this->assertNotNull(config('sanctum.expiration'));
        $this->assertGreaterThan(0, config('sanctum.expiration'));
    }

    /** S2 — « déconnecter tous les appareils » révoque tous les jetons. */
    public function test_deconnecter_partout_revoque_chaque_jeton(): void
    {
        [$proprietaire, $jeton] = $this->inscrireCommercant();
        $proprietaire->createToken('autre-appareil'); // 2e session
        $this->assertGreaterThanOrEqual(2, $proprietaire->tokens()->count());

        $this->postJson('/api/auth/deconnexion-partout', [], $this->entetes($jeton))->assertOk();
        $this->assertSame(0, $proprietaire->fresh()->tokens()->count());
    }

    /** S5 — en-têtes de sécurité présents sur les réponses de l'API. */
    public function test_les_entetes_de_securite_sont_presents(): void
    {
        $reponse = $this->getJson('/api/sante');
        $reponse->assertHeader('X-Frame-Options', 'DENY');
        $reponse->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertNotEmpty($reponse->headers->get('Content-Security-Policy'));
        $this->assertNotEmpty($reponse->headers->get('Referrer-Policy'));
    }
}
