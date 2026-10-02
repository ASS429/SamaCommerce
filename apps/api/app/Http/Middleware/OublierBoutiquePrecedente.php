<?php

namespace App\Http\Middleware;

use App\Models\Scopes\CloisonnementBoutique;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Efface, au début de chaque requête de l'API, la boutique active laissée par
 * la requête précédente servie par le même processus. ResoudreProprietaire la
 * fixe ensuite pour les routes des commerçants ; l'administration et les routes
 * publiques, qui ne passent pas par lui, travaillent ainsi sans cloisonnement
 * hérité.
 */
class OublierBoutiquePrecedente
{
    public function handle(Request $requete, Closure $suite): Response
    {
        CloisonnementBoutique::activer(null);

        return $suite($requete);
    }
}
