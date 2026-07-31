<?php

namespace Tests\Feature;

use App\Models\BoutiqueMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Feature\Concerns\CreatesTenants;
use Tests\TestCase;

/**
 * Parcours complet d'une invitation d'employé, par LIEN.
 *
 * Le lien renvoyé par /members/invite vaut `<origine>/?invite=<jeton>`. Pour
 * qu'il soit utilisable, l'invité — qui n'a pas encore de compte — doit pouvoir
 * lire à qui il a affaire AVANT de s'inscrire : d'où un aperçu public. C'est la
 * seule route de l'équipe hors `auth:sanctum`, elle mérite donc qu'on verrouille
 * ce qu'elle accepte et ce qu'elle laisse voir.
 */
class InviteFlowTest extends TestCase
{
    use CreatesTenants;
    use RefreshDatabase;

    /** @return array{0: string, 1: string} [jeton d'invitation, lien complet] */
    private function inviter(string $ownerToken, string $email = 'awa@test.sn'): array
    {
        $res = $this->postJson('/api/members/invite', [
            'email' => $email, 'role' => 'employe', 'name' => 'Awa Ndiaye', 'phone' => '77 123 45 67',
        ], $this->auth($ownerToken))->assertCreated()->json();

        return [$res['invite_token'], $res['invite_link']];
    }

    public function test_le_lien_porte_le_jeton_et_pointe_vers_le_site(): void
    {
        [, $token] = $this->registerOwner();
        [$jeton, $lien] = $this->inviter($token);

        // C'est ce lien qui part par WhatsApp : il doit être ouvrable tel quel.
        $this->assertStringContainsString("?invite={$jeton}", $lien);
        $this->assertStringStartsWith('http', $lien);
    }

    public function test_apercu_public_sans_compte(): void
    {
        [, $token] = $this->registerOwner('patron@test.sn', 'Boutique Diallo');
        [$jeton] = $this->inviter($token);

        // Aucun en-tête d'authentification : c'est tout l'intérêt.
        $apercu = $this->getJson("/api/members/invite/{$jeton}")->assertOk()->json();

        $this->assertSame('Boutique Diallo', $apercu['boutique']);
        $this->assertSame('employe', $apercu['role']);
        $this->assertSame('awa@test.sn', $apercu['email']);
        $this->assertSame('Awa Ndiaye', $apercu['name']);
    }

    public function test_apercu_refuse_un_jeton_inconnu(): void
    {
        $this->getJson('/api/members/invite/'.str_repeat('x', 48))->assertNotFound();
    }

    public function test_apercu_refuse_un_jeton_expire(): void
    {
        [, $token] = $this->registerOwner();
        [$jeton] = $this->inviter($token);

        BoutiqueMember::where('invite_token', $jeton)
            ->update(['invite_expires_at' => Carbon::now()->subHour()]);

        $this->getJson("/api/members/invite/{$jeton}")->assertStatus(410);
    }

    /* Une invitation déjà consommée ne doit plus rien révéler : sinon un lien
       qui traîne dans un fil WhatsApp continue d'exposer le nom de la boutique
       et l'email de l'employé longtemps après. */
    public function test_apercu_se_ferme_apres_acceptation(): void
    {
        [$owner, $ownerToken] = $this->registerOwner();
        [$jeton] = $this->inviter($ownerToken);
        [, $empToken] = $this->registerOwner('awa@test.sn', 'Awa');

        $this->postJson('/api/members/accept', ['invite_token' => $jeton], $this->auth($empToken))->assertOk();
        $this->getJson("/api/members/invite/{$jeton}")->assertNotFound();

        $this->assertDatabaseHas('boutique_members', [
            'owner_id' => $owner->id, 'email' => 'awa@test.sn', 'status' => 'accepted',
        ]);
    }

    /* Le parcours que promet le message WhatsApp : j'ouvre le lien, je crée mon
       compte, j'entre dans la boutique. L'acceptation exige un compte, donc
       l'inscription vient d'abord — c'est exactement ce que l'application
       enchaîne toute seule. */
    public function test_parcours_complet_lien_puis_inscription_puis_acces(): void
    {
        [$owner, $ownerToken] = $this->registerOwner('patron@test.sn', 'Boutique Diallo');
        $this->postJson('/api/products', ['name' => 'Riz', 'price' => 600, 'price_achat' => 450, 'stock' => 8], $this->auth($ownerToken))->assertCreated();
        [$jeton] = $this->inviter($ownerToken);

        // 1. L'invité lit l'aperçu sans compte.
        $this->getJson("/api/members/invite/{$jeton}")->assertOk();

        // 2. Il crée son compte depuis l'écran de connexion.
        $empToken = $this->postJson('/api/auth/register', [
            'username' => 'awa@test.sn', 'password' => 'Password123', 'company_name' => 'Awa Ndiaye',
        ])->assertCreated()->json('token');

        // 3. L'application rejoue l'invitation dès que le compte existe.
        $accept = $this->postJson('/api/members/accept', ['invite_token' => $jeton], $this->auth($empToken))->assertOk()->json();
        $this->assertSame('employe', $accept['role']);
        $this->assertSame('Boutique Diallo', $accept['boutique']['company_name']);

        // 4. Il voit alors la boutique du patron, pas la sienne.
        $mienne = $this->getJson('/api/members/my-boutique', $this->auth($empToken))->assertOk()->json();
        $this->assertSame($owner->id, $mienne['owner']['id']);

        $produits = $this->getJson('/api/products', $this->auth($empToken))->assertOk()->json();
        $this->assertSame('Riz', $produits[0]['name']);
    }

    public function test_un_jeton_ne_sert_qu_une_fois(): void
    {
        [, $ownerToken] = $this->registerOwner();
        [$jeton] = $this->inviter($ownerToken);
        [, $premier] = $this->registerOwner('awa@test.sn', 'Awa');
        [, $second] = $this->registerOwner('autre@test.sn', 'Autre');

        $this->postJson('/api/members/accept', ['invite_token' => $jeton], $this->auth($premier))->assertOk();
        $this->postJson('/api/members/accept', ['invite_token' => $jeton], $this->auth($second))->assertNotFound();
    }
}
