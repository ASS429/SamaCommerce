<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * S9 — Garde-fou : toute route de DONNÉES d'un commerçant doit exiger une
 * permission (intergiciel perm:*). Empêche qu'un futur contrôleur oublié laisse
 * un employé (qui « devient » le patron via ResoudreProprietaire) accéder à tout.
 *
 * Les routes hors périmètre (authentification, compte, boutiques, équipe, IA,
 * journal, santé) sont explicitement listées : elles sont soit publiques, soit
 * volontairement ouvertes à tout utilisateur connecté, soit réservées à
 * l'administration.
 */
class PermissionsRoutesTest extends TestCase
{
    /** Débuts d'adresse autorisés SANS perm: (justifiés). */
    private array $exceptions = [
        'api/sante',
        'api/auth',                       // public + compte (moi, déconnexion, profil…)
        'api/boutiques',                  // gérées par le propriétaire (logique interne)
        'api/membres',                    // équipe
        'api/activite',                   // journal (lecture propriétaire)
        'api/ia',                         // aide à la décision (tout employé peut consulter)
        'api/tontines',                   // module hérité, non sensible
        // Abonnement : chacun voit le plan de la boutique (l'écran adapte ses
        // limites) ; PAYER est réservé au propriétaire, vérifié par le contrôleur.
        'api/abonnement',
        // Assistant vocal : ouvert à tout utilisateur connecté, mais chacun de
        // ses outils vérifie la permission de l'employé, comme l'écran qu'il
        // remplace (OutilsAssistant::autorise, éprouvé par AssistantVocalTest).
        'api/assistant-vocal',
    ];

    public function test_toutes_les_routes_de_donnees_exigent_une_permission(): void
    {
        $fautives = [];

        foreach (Route::getRoutes() as $route) {
            $adresse = $route->uri();
            if (! str_starts_with($adresse, 'api/')) {
                continue;
            }

            // T8 — l'espace versionné /api/v1 duplique /api : on le ramène à la
            // racine pour appliquer la même liste aux deux versions.
            $normalisee = preg_replace('#^api/v\d+/#', 'api/', $adresse);

            $intergiciels = $route->gatherMiddleware();
            $protegee = in_array('auth:sanctum', $intergiciels, true);
            $admin = in_array('admin', $intergiciels, true);
            if (! $protegee || $admin) {
                continue; // routes publiques ou d'administration : hors périmètre
            }

            if ($this->exemptee($normalisee)) {
                continue;
            }

            $aUnePermission = collect($intergiciels)->contains(fn ($m) => str_starts_with($m, 'perm:'));
            if (! $aUnePermission) {
                $fautives[] = $route->methods()[0].' '.$adresse;
            }
        }

        $this->assertSame([], $fautives, 'Ces routes de données n\'exigent aucune permission : '.implode(', ', $fautives));
    }

    private function exemptee(string $adresse): bool
    {
        foreach ($this->exceptions as $debut) {
            if (str_starts_with($adresse, $debut)) {
                return true;
            }
        }

        return false;
    }
}
