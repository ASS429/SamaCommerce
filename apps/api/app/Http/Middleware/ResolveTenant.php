<?php

namespace App\Http\Middleware;

use App\Models\BoutiqueMember;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Si l'utilisateur connecté est un EMPLOYÉ accepté d'une boutique,
 * on fait pointer $request->user() vers le PROPRIÉTAIRE (pour que tous les
 * contrôleurs opèrent sur ses données), et on mémorise les permissions de
 * l'employé pour EnsurePermission. Le propriétaire, lui, n'est pas affecté.
 */
class ResolveTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return $next($request);
        }

        $membership = BoutiqueMember::where('member_id', $user->id)
            ->where('status', 'accepted')->first();

        if ($membership) {
            $owner = $membership->owner;
            // L'employé travaille dans la boutique où il a été invité
            $owner->current_boutique_id = $membership->ref_boutique_id ?? $owner->current_boutique_id;

            $request->attributes->set('is_employee', true);
            $request->attributes->set('permissions', $membership->permissions ?? []);
            $request->attributes->set('real_user', $user);
            $request->setUserResolver(fn () => $owner);
        } else {
            $request->attributes->set('is_employee', false);
        }

        return $next($request);
    }
}
