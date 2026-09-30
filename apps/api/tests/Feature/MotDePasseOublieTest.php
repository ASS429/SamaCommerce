<?php

namespace Tests\Feature;

use App\Mail\CodeParEmail;
use App\Models\Utilisateur;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * « Mot de passe oublié ».
 *
 * Régression corrigée : le code était généré et n'allait NULLE PART (aucun
 * expéditeur configuré). L'utilisateur lisait « un code a été envoyé », ne
 * recevait rien, et restait enfermé dehors avec son stock et ses ventes à
 * l'intérieur.
 */
class MotDePasseOublieTest extends TestCase
{
    use RefreshDatabase;

    private function commercant(string $identifiant = 'awa@boutique.sn'): Utilisateur
    {
        return Utilisateur::create([
            'identifiant' => $identifiant, 'mot_de_passe' => Hash::make('AncienMotDePasse1'),
            'nom_commerce' => 'Boutique Awa', 'role' => 'commercant', 'statut' => 'Actif', 'plan' => 'Gratuit',
        ]);
    }

    public function test_envoie_reellement_un_email(): void
    {
        Mail::fake();
        $u = $this->commercant();

        $this->postJson('/api/auth/mot-de-passe-oublie', ['identifiant' => $u->identifiant])
            ->assertOk()->assertJson(['envoye' => true]);

        Mail::assertSent(CodeParEmail::class);
    }

    public function test_le_message_contient_le_code_en_clair(): void
    {
        // Le code doit être LISIBLE dans le courriel : c'est tout l'objet de l'envoi.
        Mail::fake();
        $u = $this->commercant();

        $this->postJson('/api/auth/mot-de-passe-oublie', ['identifiant' => $u->identifiant]);

        Mail::assertSent(function (CodeParEmail $courriel) {
            // Deux vérifications : le code fait bien 6 chiffres, ET il apparaît
            // dans le message rendu — sans la seconde, on pourrait envoyer un
            // corps vide sans que le test s'en aperçoive.
            return preg_match('/^\d{6}$/', $courriel->code) === 1
                && str_contains($courriel->render(), $courriel->code);
        });
    }

    public function test_le_message_annonce_la_duree_reelle_du_code(): void
    {
        // Il annonçait « 1 heure » pour un code qui expire au bout de 30 minutes.
        Mail::fake();
        $u = $this->commercant();

        $this->postJson('/api/auth/mot-de-passe-oublie', ['identifiant' => $u->identifiant]);

        Mail::assertSent(fn (CodeParEmail $courriel) => $courriel->motif === 'reinitialisation'
            && str_contains($courriel->render(), 'valable 30 minutes'));
    }

    public function test_n_envoie_rien_si_l_identifiant_n_est_pas_une_adresse(): void
    {
        // Comptes créés à la main : inutile de prétendre avoir envoyé.
        Mail::fake();
        $u = $this->commercant('boutique-awa');

        $this->postJson('/api/auth/mot-de-passe-oublie', ['identifiant' => $u->identifiant])
            ->assertOk()->assertJson(['envoye' => false]);

        Mail::assertNothingSent();
    }

    public function test_ne_revele_pas_qu_un_compte_est_inconnu(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/mot-de-passe-oublie', ['identifiant' => 'inconnu@nulle-part.sn'])
            ->assertOk()
            ->assertJsonMissing(['envoye' => true]);

        Mail::assertNothingSent();
    }

    public function test_le_code_permet_reellement_de_changer_le_mot_de_passe(): void
    {
        // Sans ce parcours complet, on testerait un envoi qui ne sert à rien.
        Mail::fake();
        $u = $this->commercant();
        $this->postJson('/api/auth/mot-de-passe-oublie', ['identifiant' => $u->identifiant])->assertOk();

        $code = null;
        Mail::assertSent(CodeParEmail::class, function (CodeParEmail $courriel) use (&$code) {
            $code = $courriel->code;

            return true;
        });

        $this->postJson('/api/auth/reinitialiser-mot-de-passe', [
            'identifiant' => $u->identifiant, 'code' => $code, 'mot_de_passe' => 'NouveauMdp2026',
        ])->assertOk();

        $this->assertTrue(Hash::check('NouveauMdp2026', $u->fresh()->mot_de_passe));
    }
}
