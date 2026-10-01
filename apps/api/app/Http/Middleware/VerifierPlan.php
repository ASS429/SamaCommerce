<?php

namespace App\Http\Middleware;

use App\Services\Abonnements;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Réserve une route aux plans qui incluent la fonctionnalité (402 sinon).
 *
 *   ->middleware('plan:livraisons')            tout est réservé ;
 *   ->middleware('plan:livraisons,ecriture')   la LECTURE reste permise.
 *
 * Le second mode tient la promesse faite au commerçant : en repassant au plan
 * Gratuit, il retrouve toujours ses fournisseurs, commandes et livraisons ; il
 * ne peut simplement plus en ajouter. Le premier sert quand lire EST la
 * fonctionnalité (rapports complets, journal d'activité).
 *
 * À placer après ResoudreProprietaire : pour un employé, c'est le plan du
 * PROPRIÉTAIRE qui compte.
 */
class VerifierPlan
{
    public function handle(Request $requete, Closure $suite, string $fonctionnalite, ?string $mode = null): Response
    {
        $lecture = in_array($requete->method(), ['GET', 'HEAD'], true);
        if (! ($mode === 'ecriture' && $lecture)) {
            Abonnements::exigerFonctionnalite($requete->user(), $fonctionnalite);
        }

        return $suite($requete);
    }
}
