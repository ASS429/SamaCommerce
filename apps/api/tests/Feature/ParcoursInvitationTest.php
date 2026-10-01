<?php

namespace Tests\Feature;

use App\Models\MembreBoutique;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * Parcours complet d'une invitation d'employé, par LIEN.
 *
 * Le lien renvoyé par /membres/inviter vaut `<origine>/?invitation=<jeton>`.
 * Pour qu'il soit utilisable, l'invité — qui n'a pas encore de compte — doit
 * pouvoir lire à qui il a affaire AVANT de s'inscrire : d'où un aperçu public.
 * C'est la seule route de l'équipe hors `auth:sanctum`, elle mérite donc qu'on
 * verrouille ce qu'elle accepte et ce qu'elle laisse voir.
 */
class ParcoursInvitationTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    /** @return array{0: string, 1: string} [jeton d'invitation, lien complet] */
    private function inviter(string $jetonPatron, string $email = 'awa@test.sn'): array
    {
        $reponse = $this->postJson('/api/membres/inviter', [
            'email' => $email, 'role' => 'employe', 'nom' => 'Awa Ndiaye', 'telephone' => '77 123 45 67',
        ], $this->entetes($jetonPatron))->assertCreated()->json();

        return [$reponse['jeton_invitation'], $reponse['lien_invitation']];
    }

    public function test_le_lien_porte_le_jeton_et_pointe_vers_le_site(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        [$jetonInvitation, $lien] = $this->inviter($jeton);

        // C'est ce lien qui part par WhatsApp : il doit être ouvrable tel quel.
        $this->assertStringContainsString("?invitation={$jetonInvitation}", $lien);
        $this->assertStringStartsWith('http', $lien);
    }

    public function test_apercu_public_sans_compte(): void
    {
        [, $jeton] = $this->inscrireCommercant('patron@test.sn', 'Boutique Diallo');
        [$jetonInvitation] = $this->inviter($jeton);

        // Aucun en-tête d'authentification : c'est tout l'intérêt.
        $apercu = $this->getJson("/api/membres/invitation/{$jetonInvitation}")->assertOk()->json();

        $this->assertSame('Boutique Diallo', $apercu['boutique']);
        $this->assertSame('employe', $apercu['role']);
        $this->assertSame('awa@test.sn', $apercu['email']);
        $this->assertSame('Awa Ndiaye', $apercu['nom']);
    }

    public function test_apercu_refuse_un_jeton_inconnu(): void
    {
        $this->getJson('/api/membres/invitation/'.str_repeat('x', 48))->assertNotFound();
    }

    public function test_apercu_refuse_un_jeton_expire(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        [$jetonInvitation] = $this->inviter($jeton);

        MembreBoutique::where('jeton_invitation', $jetonInvitation)
            ->update(['invitation_expire_le' => Carbon::now()->subHour()]);

        $this->getJson("/api/membres/invitation/{$jetonInvitation}")->assertStatus(410);
    }

    /* Une invitation déjà consommée ne doit plus rien révéler : sinon un lien
       qui traîne dans un fil WhatsApp continue d'exposer le nom de la boutique
       et l'adresse de l'employé longtemps après. */
    public function test_apercu_se_ferme_apres_acceptation(): void
    {
        [$patron, $jetonPatron] = $this->inscrireCommercant();
        [$jetonInvitation] = $this->inviter($jetonPatron);
        [, $jetonEmploye] = $this->inscrireCommercant('awa@test.sn', 'Awa');

        $this->postJson('/api/membres/accepter', ['jeton_invitation' => $jetonInvitation], $this->entetes($jetonEmploye))->assertOk();
        $this->getJson("/api/membres/invitation/{$jetonInvitation}")->assertNotFound();

        $this->assertDatabaseHas('membres_boutique', [
            'proprietaire_id' => $patron->id, 'email' => 'awa@test.sn', 'statut' => 'acceptee',
        ]);
    }

    /* Le parcours que promet le message WhatsApp : j'ouvre le lien, je crée mon
       compte, j'entre dans la boutique. L'acceptation exige un compte, donc
       l'inscription vient d'abord — c'est exactement ce que l'application
       enchaîne toute seule. */
    public function test_parcours_complet_lien_puis_inscription_puis_acces(): void
    {
        [$patron, $jetonPatron] = $this->inscrireCommercant('patron@test.sn', 'Boutique Diallo');
        $this->postJson('/api/produits', ['nom' => 'Riz', 'prix_vente' => 600, 'prix_achat' => 450, 'stock' => 8], $this->entetes($jetonPatron))->assertCreated();
        [$jetonInvitation] = $this->inviter($jetonPatron);

        // 1. L'invité lit l'aperçu sans compte.
        $this->getJson("/api/membres/invitation/{$jetonInvitation}")->assertOk();

        // 2. Il crée son compte depuis l'écran de connexion.
        $jetonEmploye = $this->postJson('/api/auth/inscription', [
            'identifiant' => 'awa@test.sn', 'mot_de_passe' => 'Password123', 'nom_commerce' => 'Awa Ndiaye',
        ])->assertCreated()->json('jeton');

        // 3. L'application rejoue l'invitation dès que le compte existe.
        $acceptation = $this->postJson('/api/membres/accepter', ['jeton_invitation' => $jetonInvitation], $this->entetes($jetonEmploye))->assertOk()->json();
        $this->assertSame('employe', $acceptation['role']);
        $this->assertSame('Boutique Diallo', $acceptation['boutique']['nom_commerce']);

        // 4. Il voit alors la boutique du patron, pas la sienne.
        $sienne = $this->getJson('/api/membres/ma-boutique', $this->entetes($jetonEmploye))->assertOk()->json();
        $this->assertSame($patron->id, $sienne['proprietaire']['id']);

        $produits = $this->getJson('/api/produits', $this->entetes($jetonEmploye))->assertOk()->json();
        $this->assertSame('Riz', $produits[0]['nom']);
    }

    public function test_un_jeton_ne_sert_qu_une_fois(): void
    {
        [, $jetonPatron] = $this->inscrireCommercant();
        [$jetonInvitation] = $this->inviter($jetonPatron);
        [, $premier] = $this->inscrireCommercant('awa@test.sn', 'Awa');
        [, $second] = $this->inscrireCommercant('autre@test.sn', 'Autre');

        $this->postJson('/api/membres/accepter', ['jeton_invitation' => $jetonInvitation], $this->entetes($premier))->assertOk();
        $this->postJson('/api/membres/accepter', ['jeton_invitation' => $jetonInvitation], $this->entetes($second))->assertNotFound();
    }
}
