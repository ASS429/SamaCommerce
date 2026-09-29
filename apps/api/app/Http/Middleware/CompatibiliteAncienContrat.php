<?php

namespace App\Http\Middleware;

use App\Compatibilite\AncienContrat;
use App\Compatibilite\Traducteur;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * TEMPORAIRE — sert l'ancien contrat d'API aux clients restés sur l'ancienne
 * version (cf. App\Compatibilite\AncienContrat, qui explique pourquoi).
 *
 * Trois cas, selon la route atteinte :
 *  - adresse ANCIENNE (`/products`)             → toujours l'ancien format ;
 *  - adresse PARTAGÉE (`/categories`)           → l'ancien format, sauf si le client
 *                                                 s'annonce par l'en-tête X-Contrat-Api: fr ;
 *  - adresse uniquement française (`/produits`) → aucune traduction.
 */
class CompatibiliteAncienContrat
{
    public function handle(Request $requete, Closure $suite): Response
    {
        $route = $requete->route();
        $contrat = $route instanceof Route ? $route->getAction('contrat') : null;
        $ancien = $contrat === 'ancien'
            || ($contrat === 'partage' && $requete->header(AncienContrat::ENTETE) !== 'fr');

        if (! $ancien) {
            return $suite($requete);
        }

        $adresse = (string) $route->getAction('contrat_adresse');
        $this->noterAppel($adresse);
        $this->traduireEntree($requete, $route);

        $reponse = $suite($requete);

        if ($reponse instanceof JsonResponse) {
            // Objets conservés tels quels (`{}` reste `{}`, et non `[]`).
            $reponse->setData(Traducteur::sortie($reponse->getData(), $adresse));
        }

        return $reponse;
    }

    private function traduireEntree(Request $requete, Route $route): void
    {
        $requete->query->replace(Traducteur::entree($requete->query->all()));

        // Corps JSON (ou formulaire) : la source que lit la validation.
        $source = $requete->isJson() ? $requete->json() : $requete->request;
        $source->replace(Traducteur::entree($source->all()));

        foreach (AncienContrat::PARAMETRES_ENTREE as $parametre => $valeurs) {
            $valeur = $route->parameter($parametre);
            if (is_string($valeur) && isset($valeurs[$valeur])) {
                $route->setParameter($parametre, $valeurs[$valeur]);
            }
        }
    }

    /**
     * Compteur d'usage de l'ancien format, pour savoir QUAND retirer cette
     * couche (GET /api/sante/compatibilite). L'état de santé n'est pas compté :
     * Render et la tâche de maintien en éveil l'interrogent en permanence.
     * Un incident de cache ne doit jamais faire échouer la requête du commerçant.
     */
    private function noterAppel(string $adresse): void
    {
        if ($adresse === 'sante') {
            return;
        }
        try {
            $jour = now()->toDateString();
            Cache::add("ancien_contrat:appels:{$jour}", 0, now()->addDays(30));
            Cache::increment("ancien_contrat:appels:{$jour}");
            Cache::put('ancien_contrat:dernier_appel', now()->toIso8601String(), now()->addDays(90));
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
