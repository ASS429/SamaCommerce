<?php

namespace Tests\Feature;

use App\Mail\CodeParEmail;
use App\Models\Utilisateur;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * Vérification en deux étapes (double facteur).
 *
 * Défaut corrigé le 30/09/2026 : l'option s'activait d'un clic, et le code de
 * connexion était créé… puis envoyé NULLE PART. Tout compte qui l'activait se
 * retrouvait enfermé dehors à la connexion suivante sur un autre appareil.
 * Désormais : le code de connexion part par e-mail, et l'option ne s'active
 * qu'après la saisie d'un code reçu — la preuve que l'e-mail arrive.
 */
class DoubleFacteurTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    /** Code du dernier e-mail envoyé pour ce motif. */
    private function codeRecu(string $motif): string
    {
        $code = null;
        Mail::assertSent(CodeParEmail::class, function (CodeParEmail $courriel) use ($motif, &$code) {
            if ($courriel->motif === $motif) {
                $code = $courriel->code;
            }

            return true;
        });
        $this->assertNotNull($code, "Aucun code « {$motif} » envoyé");

        return (string) $code;
    }

    private function activer(string $jeton): string
    {
        $this->putJson('/api/auth/double-facteur', ['actif' => true], $this->entetes($jeton))
            ->assertOk()->assertJson(['double_facteur_actif' => false, 'code_envoye' => true]);
        $code = $this->codeRecu('activation');
        $this->postJson('/api/auth/double-facteur/confirmer', ['code' => $code], $this->entetes($jeton))
            ->assertOk()->assertJson(['double_facteur_actif' => true]);

        return $code;
    }

    public function test_activer_envoie_un_code_sans_activer_l_option(): void
    {
        Mail::fake();
        [$u, $jeton] = $this->inscrireCommercant('awa@boutique.sn');

        $this->putJson('/api/auth/double-facteur', ['actif' => true], $this->entetes($jeton))
            ->assertOk()->assertJson(['double_facteur_actif' => false, 'code_envoye' => true]);

        Mail::assertSent(CodeParEmail::class, fn (CodeParEmail $c) => $c->hasTo('awa@boutique.sn')
            && $c->motif === 'activation' && str_contains($c->render(), $c->code));
        $this->assertFalse((bool) $u->fresh()->double_facteur_actif, 'Pas encore : le code n\'a pas été saisi');
    }

    public function test_seul_le_bon_code_active_l_option(): void
    {
        Mail::fake();
        [$u, $jeton] = $this->inscrireCommercant('awa@boutique.sn');
        $this->putJson('/api/auth/double-facteur', ['actif' => true], $this->entetes($jeton))->assertOk();
        $code = $this->codeRecu('activation');

        $faux = $code === '000000' ? '111111' : '000000';
        $this->postJson('/api/auth/double-facteur/confirmer', ['code' => $faux], $this->entetes($jeton))
            ->assertStatus(422)->assertJsonValidationErrors('code');
        $this->assertFalse((bool) $u->fresh()->double_facteur_actif);

        $this->postJson('/api/auth/double-facteur/confirmer', ['code' => $code], $this->entetes($jeton))
            ->assertOk()->assertJson(['double_facteur_actif' => true]);
        $this->assertTrue((bool) $u->fresh()->double_facteur_actif);
    }

    public function test_un_code_ne_sert_qu_une_fois(): void
    {
        Mail::fake();
        [, $jeton] = $this->inscrireCommercant('awa@boutique.sn');
        $code = $this->activer($jeton);

        $this->postJson('/api/auth/double-facteur/confirmer', ['code' => $code], $this->entetes($jeton))
            ->assertStatus(422);
    }

    public function test_l_activation_est_refusee_si_aucun_e_mail_ne_peut_arriver(): void
    {
        // Identifiant qui n'est pas une adresse : aucun code ne pourra jamais
        // arriver. Activer l'option enfermerait le commerçant dehors.
        Mail::fake();
        [$u, $jeton] = $this->inscrireCommercant('boutique-awa');

        $this->putJson('/api/auth/double-facteur', ['actif' => true], $this->entetes($jeton))
            ->assertStatus(422)->assertJsonPath('erreur', fn ($m) => str_contains($m, 'adresse e-mail'));

        Mail::assertNothingSent();
        $this->assertFalse((bool) $u->fresh()->double_facteur_actif);
    }

    public function test_l_activation_est_refusee_si_l_envoi_echoue(): void
    {
        [$u, $jeton] = $this->inscrireCommercant('awa@boutique.sn');
        // Expéditeur inexistant : l'envoi lève une exception, comme une panne réelle.
        config(['mail.default' => 'expediteur-inexistant']);

        $this->putJson('/api/auth/double-facteur', ['actif' => true], $this->entetes($jeton))
            ->assertStatus(422)->assertJsonPath('erreur', fn ($m) => str_contains($m, "n'a pas pu partir"));

        $this->assertFalse((bool) $u->fresh()->double_facteur_actif);
    }

    public function test_la_connexion_envoie_le_code_et_il_ouvre_la_session(): void
    {
        Mail::fake();
        [, $jeton] = $this->inscrireCommercant('awa@boutique.sn');
        $this->activer($jeton);

        $this->postJson('/api/auth/connexion', ['identifiant' => 'awa@boutique.sn', 'mot_de_passe' => 'Password123'])
            ->assertOk()
            ->assertJson(['double_facteur_requis' => true, 'envoye' => true, 'code_dev' => null])
            ->assertJsonMissing(['jeton']);

        $this->postJson('/api/auth/verifier-double-facteur', ['identifiant' => 'awa@boutique.sn', 'code' => $this->codeRecu('connexion')])
            ->assertOk()->assertJsonStructure(['utilisateur', 'jeton']);
    }

    public function test_un_code_d_activation_n_ouvre_jamais_de_session(): void
    {
        // Les deux sortes de codes partagent la même table : sans le motif, le
        // code d'activation (le plus récent) aurait servi de code de connexion.
        Mail::fake();
        [, $jeton] = $this->inscrireCommercant('awa@boutique.sn');
        $this->putJson('/api/auth/double-facteur', ['actif' => true], $this->entetes($jeton))->assertOk();

        $this->postJson('/api/auth/verifier-double-facteur', ['identifiant' => 'awa@boutique.sn', 'code' => $this->codeRecu('activation')])
            ->assertStatus(422);
    }

    public function test_la_connexion_dit_quand_le_code_n_a_pas_pu_partir(): void
    {
        // Compte activé AVANT la correction avec un identifiant sans e-mail
        // (la migration les désactive, mais le message doit rester honnête).
        [$u] = $this->inscrireCommercant('boutique-awa');
        $u->update(['double_facteur_actif' => true]);

        $this->postJson('/api/auth/connexion', ['identifiant' => 'boutique-awa', 'mot_de_passe' => 'Password123'])
            ->assertOk()
            ->assertJson(['double_facteur_requis' => true, 'envoye' => false])
            ->assertJsonPath('message', fn ($m) => str_contains($m, "n'a pas pu être envoyé"));
    }

    public function test_desactiver_ne_demande_pas_de_code(): void
    {
        Mail::fake();
        [$u, $jeton] = $this->inscrireCommercant('awa@boutique.sn');
        $this->activer($jeton);

        $this->putJson('/api/auth/double-facteur', ['actif' => false], $this->entetes($jeton))
            ->assertOk()->assertJson(['double_facteur_actif' => false]);
        $this->assertFalse((bool) $u->fresh()->double_facteur_actif);
    }

    public function test_l_ancien_contrat_n_active_plus_rien_sans_code(): void
    {
        // Un téléphone resté sur l'ancienne version appelle encore PUT /auth/2fa :
        // il reçoit le code par e-mail, mais ne peut plus enfermer le compte.
        Mail::fake();
        [$u, $jeton] = $this->inscrireCommercant('awa@boutique.sn');
        $this->app['auth']->forgetGuards();

        $this->putJson('/api/auth/2fa', ['enabled' => true], ['Authorization' => 'Bearer '.$jeton])
            ->assertOk()->assertJson(['twofa_enabled' => false, 'code_envoye' => true]);
        $this->assertFalse((bool) $u->fresh()->double_facteur_actif);
    }

    /** Compte administrateur connecté : [Utilisateur, jeton]. */
    private function administrateur(): array
    {
        $admin = Utilisateur::create([
            'identifiant' => 'admin@samacommerce.sn', 'mot_de_passe' => Hash::make('MotDePasseAdmin2026'),
            'nom_commerce' => 'Admin', 'role' => 'admin', 'plan' => 'Premium',
        ]);
        $jeton = $this->postJson('/api/auth/connexion', ['identifiant' => 'admin@samacommerce.sn', 'mot_de_passe' => 'MotDePasseAdmin2026'])
            ->assertOk()->json('jeton');

        return [$admin, $jeton];
    }

    public function test_les_codes_de_l_administrateur_partent_a_l_adresse_reglee_dans_render(): void
    {
        // `admin@samacommerce.sn` n'est pas une vraie boîte : ses codes partent
        // à EMAIL_ADMIN, jamais à son identifiant.
        Mail::fake();
        config(['app.email_admin' => 'responsable@exemple.sn']);
        [$admin, $jeton] = $this->administrateur();

        $this->activer($jeton);
        Mail::assertSent(CodeParEmail::class, fn (CodeParEmail $c) => $c->motif === 'activation'
            && $c->hasTo('responsable@exemple.sn') && ! $c->hasTo('admin@samacommerce.sn'));
        $this->assertTrue((bool) $admin->fresh()->double_facteur_actif);

        $this->postJson('/api/auth/connexion', ['identifiant' => 'admin@samacommerce.sn', 'mot_de_passe' => 'MotDePasseAdmin2026'])
            ->assertOk()->assertJson(['double_facteur_requis' => true, 'envoye' => true]);
        Mail::assertSent(CodeParEmail::class, fn (CodeParEmail $c) => $c->motif === 'connexion' && $c->hasTo('responsable@exemple.sn'));
    }

    public function test_sans_adresse_reglee_l_administrateur_ne_peut_pas_activer(): void
    {
        Mail::fake();
        config(['app.email_admin' => null]);
        [$admin, $jeton] = $this->administrateur();

        $this->putJson('/api/auth/double-facteur', ['actif' => true], $this->entetes($jeton))
            ->assertStatus(422)->assertJsonPath('erreur', fn ($m) => str_contains($m, 'EMAIL_ADMIN'));

        Mail::assertNothingSent();
        $this->assertFalse((bool) $admin->fresh()->double_facteur_actif);
    }

    public function test_la_migration_desactive_les_activations_jamais_verifiees(): void
    {
        [$u] = $this->inscrireCommercant('awa@boutique.sn');
        $u->update(['double_facteur_actif' => true]);

        (require database_path('migrations/2026_09_30_000002_desactiver_le_double_facteur_jamais_verifie.php'))->up();

        $this->assertFalse((bool) $u->fresh()->double_facteur_actif);
    }
}
