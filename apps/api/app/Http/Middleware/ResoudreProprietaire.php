<?php

namespace App\Http\Middleware;

use App\Models\MembreBoutique;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Si l'utilisateur connecté est un EMPLOYÉ accepté d'une boutique, on fait
 * pointer $requete->user() vers le PROPRIÉTAIRE (pour que tous les contrôleurs
 * travaillent sur ses données), et on mémorise les permissions de l'employé
 * pour VerifierPermission. Le propriétaire, lui, n'est pas affecté.
 */
class ResoudreProprietaire
{
    public function handle(Request $requete, Closure $suite): Response
    {
        $utilisateur = $requete->user();
        if (! $utilisateur) {
            return $suite($requete);
        }

        $adhesion = MembreBoutique::where('membre_id', $utilisateur->id)
            ->where('statut', 'acceptee')->first();

        if ($adhesion) {
            $proprietaire = $adhesion->proprietaire;
            // L'employé travaille dans la boutique où il a été invité
            $proprietaire->boutique_active_id = $adhesion->boutique_rattachement_id ?? $proprietaire->boutique_active_id;

            $requete->attributes->set('est_employe', true);
            $requete->attributes->set('permissions', $adhesion->permissions ?? []);
            $requete->attributes->set('utilisateur_reel', $utilisateur);
            $requete->setUserResolver(fn () => $proprietaire);
        } else {
            $requete->attributes->set('est_employe', false);
        }

        /* Cloisonnement par boutique active, appliqué une fois pour toute la
         * requête (cf. CloisonnementBoutique). L'administrateur en est exclu :
         * ses écrans agrègent volontairement tous les commerçants. On l'appelle
         * aussi pour lui, avec null, pour effacer toute boutique précédente. */
        \App\Models\Scopes\CloisonnementBoutique::activer(
            $requete->user()->role !== 'admin' ? $requete->user()->boutique_active_id : null,
        );

        return $suite($requete);
    }
}
