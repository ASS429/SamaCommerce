<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Feature\Outils\CreationComptes;
use Tests\TestCase;

/**
 * Jetons de connexion : jusqu'à l'étape 5, chaque jeton enregistrait le nom
 * de classe anglais `App\Models\User` (un alias le faisait lire comme
 * `Utilisateur`). L'alias est retiré ; la migration du 01/10/2026 réécrit les
 * jetons existants pour que personne ne soit déconnecté.
 */
class JetonsNomFrancaisTest extends TestCase
{
    use CreationComptes;
    use RefreshDatabase;

    public function test_un_nouveau_jeton_porte_le_nom_francais(): void
    {
        $this->inscrireCommercant();

        $this->assertSame(['App\\Models\\Utilisateur'], DB::table('personal_access_tokens')->pluck('tokenable_type')->unique()->values()->all());
    }

    public function test_une_session_ouverte_avant_le_retrait_de_l_alias_reste_valable(): void
    {
        [, $jeton] = $this->inscrireCommercant();
        // Jeton tel qu'il était enregistré avant l'étape 5. Sans la migration,
        // il serait inutilisable — et même pas proprement refusé : la classe
        // `App\Models\User` n'existant plus, chaque appel finirait en erreur 500.
        DB::table('personal_access_tokens')->update(['tokenable_type' => 'App\\Models\\User']);
        $this->assertGreaterThanOrEqual(400, $this->getJson('/api/auth/moi', $this->entetes($jeton))->status());

        (require database_path('migrations/2026_10_01_000001_ecrire_le_nom_francais_dans_les_jetons.php'))->up();

        $this->getJson('/api/auth/moi', $this->entetes($jeton))->assertOk();
    }
}
