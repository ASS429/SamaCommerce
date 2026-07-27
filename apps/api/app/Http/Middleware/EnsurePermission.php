<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Vérifie qu'un employé possède une permission. Le propriétaire a tout.
 * Usage route: ->middleware('perm:vente')
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        // Propriétaire (pas un employé) → accès total
        if (! $request->attributes->get('is_employee', false)) {
            return $next($request);
        }

        $perms = $request->attributes->get('permissions', []);
        if (empty($perms[$permission])) {
            return response()->json([
                'error' => 'Accès refusé',
                'permission' => $permission,
                'message' => "Vous n'avez pas la permission « {$permission} ». Contactez le propriétaire.",
            ], 403);
        }

        return $next($request);
    }
}
