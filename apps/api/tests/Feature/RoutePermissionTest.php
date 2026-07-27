<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * S9 — Garde-fou : toute route de DONNÉES du tenant doit exiger une permission
 * (middleware perm:*). Empêche qu'un futur contrôleur oublié laisse un employé
 * (qui "devient" le patron via ResolveTenant) accéder à tout.
 *
 * Les routes hors périmètre (auth, compte, boutique, équipe, IA, activité, santé)
 * sont explicitement whitelistées : elles sont soit publiques, soit volontairement
 * accessibles à tout utilisateur authentifié, soit réservées admin.
 */
class RoutePermissionTest extends TestCase
{
    /** Préfixes de routes autorisés SANS perm: (justifiés). */
    private array $whitelist = [
        'api/health',
        'api/auth',            // public + compte (me/logout/profile/2fa/upgrade)
        'api/boutiques',       // gérées par propriétaire (logique interne)
        'api/members',         // équipe
        'api/activity',        // journal (lecture propriétaire)
        'api/ia',              // aide à la décision (tout employé peut consulter)
        'api/tontines',        // module hérité, non sensible
        'api/admin',           // groupe admin (middleware 'admin')
        'api/auth/users',      // admin
        'api/auth/upgrade',    // admin
    ];

    public function test_all_tenant_data_routes_require_a_permission(): void
    {
        $offenders = [];

        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();
            if (! str_starts_with($uri, 'api/')) {
                continue;
            }

            // T8 — le namespace versionné /api/v1 duplique /api : on le normalise
            // pour appliquer la même liste blanche aux deux versions.
            $normalized = preg_replace('#^api/v\d+/#', 'api/', $uri);

            $middleware = $route->gatherMiddleware();
            $isProtected = in_array('auth:sanctum', $middleware, true);
            $isAdmin = in_array('admin', $middleware, true);
            if (! $isProtected || $isAdmin) {
                continue; // routes publiques ou admin : hors périmètre
            }

            if ($this->whitelisted($normalized)) {
                continue;
            }

            $hasPerm = collect($middleware)->contains(fn ($m) => str_starts_with($m, 'perm:'));
            if (! $hasPerm) {
                $offenders[] = $route->methods()[0].' '.$uri;
            }
        }

        $this->assertSame([], $offenders, 'Ces routes de données du tenant n\'exigent aucune permission : '.implode(', ', $offenders));
    }

    private function whitelisted(string $uri): bool
    {
        foreach ($this->whitelist as $prefix) {
            if (str_starts_with($uri, $prefix)) {
                return true;
            }
        }

        return false;
    }
}
