<?php

use App\Compatibilite\AncienContrat;
use Illuminate\Support\Facades\Route;

/*
 * COMPATIBILITÉ TEMPORAIRE — anciennes adresses de l'API.
 *
 * Chaque ancienne adresse est CALQUÉE sur la route française correspondante :
 * même contrôleur, mêmes contrôles de droits (auth, propriétaire, permissions,
 * limites de débit). Rien n'est redéclaré à la main, donc rien ne peut être
 * oublié ; le test RoutesAncienContratTest vérifie en plus que la table obtenue
 * est identique à celle d'avant la francisation.
 *
 * Une adresse identique dans les deux langues n'est pas dupliquée : la route
 * française est marquée PARTAGÉE, et c'est l'en-tête X-Contrat-Api qui dit
 * quel format le client parle (cf. CompatibiliteAncienContrat).
 */
$versAncienne = array_flip(AncienContrat::ADRESSES);

foreach (Route::getRoutes()->getRoutes() as $route) {
    if (! str_starts_with($route->uri(), 'api/')) {
        continue;
    }
    $relative = substr($route->uri(), strlen('api/'));
    $version = str_starts_with($relative, 'v1/') ? 'v1/' : '';
    $adresse = substr($relative, strlen($version));
    if (! isset($versAncienne[$adresse])) {
        continue; // route apparue avec la francisation : pas d'ancienne adresse
    }

    $ancienne = $versAncienne[$adresse];
    $marque = ['contrat_adresse' => $adresse];

    if ($ancienne === $adresse) {
        $route->setAction(array_merge($route->getAction(), $marque, ['contrat' => 'partage']));

        continue;
    }

    $copie = Route::match($route->methods(), $version.$ancienne, $route->getAction('uses'))
        ->middleware(array_values(array_diff($route->middleware(), ['api'])));
    $copie->setAction(array_merge($copie->getAction(), $marque, ['contrat' => 'ancien']));
}
