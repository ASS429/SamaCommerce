<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush(); // évite la fuite du RateLimiter entre tests (cache array)
        Http::fake(); // pas d'appel réseau réel vers le micro-service IA
    }

    /** S3 — politique de mot de passe : trop court/sans chiffre rejeté. */
    public function test_register_rejects_weak_password(): void
    {
        $this->postJson('/api/auth/register', ['username' => 'a@b.sn', 'password' => 'abc'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');

        $this->postJson('/api/auth/register', ['username' => 'a@b.sn', 'password' => 'abcdefgh'])
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
    public function test_validation_messages_are_in_french(): void
    {
        $this->assertSame('fr', config('app.locale'));

        $court = $this->postJson('/api/auth/register', ['username' => 'a@b.sn', 'password' => 'abc'])
            ->assertStatus(422)->json('errors.password.0');
        $this->assertStringContainsString('mot de passe', mb_strtolower((string) $court));

        $sansChiffre = $this->postJson('/api/auth/register', ['username' => 'a@b.sn', 'password' => 'abcdefghij'])
            ->assertStatus(422)->json('errors.password.0');
        $this->assertStringContainsString('chiffre', mb_strtolower((string) $sansChiffre));

        $manquant = $this->postJson('/api/auth/register', ['username' => 'a@b.sn'])
            ->assertStatus(422)->json('errors.password.0');
        $this->assertStringContainsString('obligatoire', mb_strtolower((string) $manquant));
    }

    /** S3 — message d'échec générique (pas d'énumération de comptes). */
    public function test_login_error_is_generic(): void
    {
        [$owner] = $this->registerOwner();

        $unknown = $this->postJson('/api/auth/login', ['username' => 'ghost@x.sn', 'password' => 'whatever1'])
            ->assertStatus(422)->json('errors.username.0');
        $wrongPw = $this->postJson('/api/auth/login', ['username' => $owner->username, 'password' => 'WrongPass9'])
            ->assertStatus(422)->json('errors.username.0');

        $this->assertSame($unknown, $wrongPw, 'Les deux messages doivent être identiques (anti-énumération)');
        $this->assertStringContainsString('Identifiants', $unknown);
    }

    /** S3 — verrouillage après 5 tentatives échouées. */
    public function test_login_lockout_after_five_failures(): void
    {
        [$owner] = $this->registerOwner();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['username' => $owner->username, 'password' => 'Bad'.$i.'aaaa']);
        }

        $this->postJson('/api/auth/login', ['username' => $owner->username, 'password' => 'Password123'])
            ->assertStatus(429); // bloqué même avec le bon mot de passe
    }

    /** S2 — token expiration configurée (pas "à vie"). */
    public function test_token_expiration_is_configured(): void
    {
        $this->assertNotNull(config('sanctum.expiration'));
        $this->assertGreaterThan(0, config('sanctum.expiration'));
    }

    /** S2 — "déconnecter tous les appareils" révoque tous les tokens. */
    public function test_logout_all_revokes_every_token(): void
    {
        [$owner, $token] = $this->registerOwner();
        $owner->createToken('autre-appareil'); // 2e session
        $this->assertGreaterThanOrEqual(2, $owner->tokens()->count());

        $this->postJson('/api/auth/logout-all', [], $this->auth($token))->assertOk();
        $this->assertSame(0, $owner->fresh()->tokens()->count());
    }

    /** S5 — en-têtes de sécurité présents sur les réponses API. */
    public function test_security_headers_present(): void
    {
        $res = $this->getJson('/api/health');
        $res->assertHeader('X-Frame-Options', 'DENY');
        $res->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertNotEmpty($res->headers->get('Content-Security-Policy'));
        $this->assertNotEmpty($res->headers->get('Referrer-Policy'));
    }
}
