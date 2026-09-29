<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * Réglages d'écran synchronisés (sections masquées, impression automatique).
 *
 * Le point délicat : pour un employé, `$request->user()` désigne le
 * PROPRIÉTAIRE (intergiciel ResoudreProprietaire). Écrire les préférences là
 * écraserait l'écran du patron et les partagerait entre tous ses vendeurs —
 * ces tests verrouillent le cloisonnement.
 */
class PreferencesTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    public function test_les_preferences_sont_vides_par_defaut(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        $moi = $this->getJson('/api/auth/moi', $this->entetes($jeton))->assertOk()->json();
        $this->assertSame([], (array) $moi['preferences']);
    }

    public function test_les_preferences_reviennent_par_moi(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        $this->putJson('/api/auth/preferences', [
            'sections_masquees' => ['caisse', 'equipe'], 'impression_auto' => true,
        ], $this->entetes($jeton))->assertOk();

        $moi = $this->getJson('/api/auth/moi', $this->entetes($jeton))->assertOk()->json();
        $this->assertSame(['caisse', 'equipe'], $moi['preferences']['sections_masquees']);
        $this->assertTrue($moi['preferences']['impression_auto']);
    }

    public function test_une_mise_a_jour_partielle_fusionne(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        $this->putJson('/api/auth/preferences', ['sections_masquees' => ['caisse'], 'impression_auto' => true], $this->entetes($jeton))->assertOk();
        // Un appareil qui n'envoie qu'une option ne doit pas effacer les autres.
        $reponse = $this->putJson('/api/auth/preferences', ['impression_auto' => false], $this->entetes($jeton))->assertOk()->json();

        $this->assertSame(['caisse'], $reponse['preferences']['sections_masquees']);
        $this->assertFalse($reponse['preferences']['impression_auto']);
    }

    public function test_les_sections_sont_dedoublonnees_et_restent_une_liste(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        $reponse = $this->putJson('/api/auth/preferences', [
            'sections_masquees' => ['caisse', 'caisse', 'equipe'],
        ], $this->entetes($jeton))->assertOk()->json();

        $this->assertSame(['caisse', 'equipe'], $reponse['preferences']['sections_masquees']);
        // Réindexé : sinon le JSON devient un objet {"0":…,"2":…} illisible côté web.
        $this->assertSame([0, 1], array_keys($reponse['preferences']['sections_masquees']));
    }

    public function test_une_charge_invalide_est_refusee(): void
    {
        [, $jeton] = $this->inscrireCommercant();

        $this->putJson('/api/auth/preferences', ['sections_masquees' => 'caisse'], $this->entetes($jeton))->assertStatus(422);
        $this->putJson('/api/auth/preferences', ['sections_masquees' => [['x']]], $this->entetes($jeton))->assertStatus(422);
        $this->putJson('/api/auth/preferences', ['impression_auto' => 'peut-être'], $this->entetes($jeton))->assertStatus(422);
    }

    public function test_les_preferences_de_l_employe_ne_touchent_pas_le_patron(): void
    {
        [$patron, $jetonPatron] = $this->inscrireCommercant();
        [, $jetonEmploye] = $this->creerEmploye($patron, ['vente' => true]);

        $this->putJson('/api/auth/preferences', ['sections_masquees' => ['caisse']], $this->entetes($jetonPatron))->assertOk();
        $this->putJson('/api/auth/preferences', ['sections_masquees' => ['rapports', 'clients']], $this->entetes($jetonEmploye))->assertOk();

        // Chacun garde SON écran, alors que l'employé travaille sur les données
        // du propriétaire.
        $moiPatron = $this->getJson('/api/auth/moi', $this->entetes($jetonPatron))->assertOk()->json();
        $moiEmploye = $this->getJson('/api/auth/moi', $this->entetes($jetonEmploye))->assertOk()->json();

        $this->assertSame(['caisse'], $moiPatron['preferences']['sections_masquees']);
        $this->assertSame(['rapports', 'clients'], $moiEmploye['preferences']['sections_masquees']);
        // L'employé voit bien la boutique du patron : le cloisonnement ne porte
        // que sur les réglages d'affichage.
        $this->assertTrue($moiEmploye['est_employe']);
    }
}
