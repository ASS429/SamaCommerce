<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use App\Mail\CodeReinitialisation;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * « Mot de passe oublie ».
 *
 * Regression corrigee : le code etait genere et n'allait NULLE PART (aucun
 * mailer configure). L'utilisateur lisait « un code a ete envoye », ne recevait
 * rien, et restait enferme dehors avec son stock et ses ventes a l'interieur.
 */
class MotDePasseOublieTest extends TestCase
{
    use RefreshDatabase;

    private function commercant(string $email = 'awa@boutique.sn'): User
    {
        return User::create([
            'username' => $email, 'password' => Hash::make('AncienMotDePasse1'),
            'company_name' => 'Boutique Awa', 'role' => 'user', 'status' => 'Actif', 'plan' => 'Free',
        ]);
    }

    public function test_envoie_reellement_un_email(): void
    {
        Mail::fake();
        $u = $this->commercant();

        $this->postJson('/api/auth/forgot-password', ['username' => $u->username])
            ->assertOk()->assertJson(['envoye' => true]);

        Mail::assertSent(CodeReinitialisation::class);
    }

    public function test_le_message_contient_le_code_en_clair(): void
    {
        // Le code doit etre LISIBLE dans le mail : c'est tout l'objet de l'envoi.
        Mail::fake();
        $u = $this->commercant();

        $this->postJson('/api/auth/forgot-password', ['username' => $u->username]);

        Mail::assertSent(function (CodeReinitialisation $mail) {
            // Deux verifications : le code fait bien 6 chiffres, ET il apparait
            // dans le message rendu — sans la seconde, on pourrait envoyer un
            // corps vide sans que le test s'en apercoive.
            return preg_match('/^\d{6}$/', $mail->code) === 1
                && str_contains($mail->render(), $mail->code);
        });
    }

    public function test_n_envoie_rien_si_l_identifiant_n_est_pas_une_adresse(): void
    {
        // Comptes crees a la main : inutile de pretendre avoir envoye.
        Mail::fake();
        $u = $this->commercant('boutique-awa');

        $this->postJson('/api/auth/forgot-password', ['username' => $u->username])
            ->assertOk()->assertJson(['envoye' => false]);

        Mail::assertNothingSent();
    }

    public function test_ne_revele_pas_qu_un_compte_est_inconnu(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/forgot-password', ['username' => 'inconnu@nulle-part.sn'])
            ->assertOk()
            ->assertJsonMissing(['envoye' => true]);

        Mail::assertNothingSent();
    }

    public function test_le_code_permet_reellement_de_changer_le_mot_de_passe(): void
    {
        // Sans ce parcours complet, on testerait un envoi qui ne sert a rien.
        Mail::fake();
        $u = $this->commercant();
        $this->postJson('/api/auth/forgot-password', ['username' => $u->username])->assertOk();

        $code = null;
        Mail::assertSent(CodeReinitialisation::class, function (CodeReinitialisation $mail) use (&$code) {
            $code = $mail->code;

            return true;
        });

        $this->postJson('/api/auth/reset-password', [
            'username' => $u->username, 'code' => $code, 'password' => 'NouveauMdp2026',
        ])->assertOk();

        $this->assertTrue(Hash::check('NouveauMdp2026', $u->fresh()->password));
    }
}
