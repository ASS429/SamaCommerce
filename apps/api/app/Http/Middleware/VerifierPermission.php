<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Vérifie qu'un employé possède une permission. Le propriétaire a tout.
 * Usage sur une route : ->middleware('perm:vente')
 * Alternatives (OU) : ->middleware('perm:stock|vente') — accès si l'employé a
 * L'UNE des permissions (ex. un vendeur doit LIRE les produits pour vendre).
 */
class VerifierPermission
{
    public function handle(Request $requete, Closure $suite, string $permission): Response
    {
        // Propriétaire (pas un employé) → accès total
        if (! $requete->attributes->get('est_employe', false)) {
            return $suite($requete);
        }

        $permissions = $requete->attributes->get('permissions', []);
        foreach (explode('|', $permission) as $p) {
            if (! empty($permissions[$p])) {
                return $suite($requete);
            }
        }

        return response()->json([
            'erreur' => 'Accès refusé',
            'permission' => $permission,
            'message' => "Vous n'avez pas la permission « {$permission} ». Contactez le propriétaire.",
        ], 403);
    }
}
