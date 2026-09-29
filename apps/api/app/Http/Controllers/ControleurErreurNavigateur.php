<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Réception des erreurs JavaScript survenues chez les utilisateurs.
 *
 * POURQUOI PUBLIC. Une bonne part des plantages arrive AVANT la connexion
 * (écran de connexion, chargement initial) : exiger un jeton reviendrait à ne
 * jamais voir ces erreurs-là. Le débit est donc bridé au niveau de la route, et
 * rien de ce qui arrive ici n'est réaffiché ni exécuté — c'est du journal.
 *
 * POURQUOI PAS LA BIBLIOTHÈQUE NAVIGATEUR DE SENTRY. ~30 Ko compressés côté
 * client, pour des utilisateurs dont la data mobile est chère (cf.
 * apps/web/src/outils/rapporteurErreurs.ts). On relaie donc côté serveur : un
 * seul canal d'alerte.
 */
class ControleurErreurNavigateur extends Controleur
{
    public function creer(Request $requete)
    {
        $donnees = $requete->validate([
            'message' => ['required', 'string', 'max:500'],
            'pile' => ['nullable', 'string', 'max:3000'],
            'source' => ['nullable', 'string', 'max:300'],
            'url' => ['nullable', 'string', 'max:300'],
            'type' => ['nullable', 'in:erreur,promesse_rejetee,react'],
        ]);

        $contexte = [
            'type' => $donnees['type'] ?? 'erreur',
            'url' => $donnees['url'] ?? null,
            'source' => $donnees['source'] ?? null,
            'pile' => $donnees['pile'] ?? null,
            // L'utilisateur n'est connu que s'il était connecté : la route est
            // publique, on ne se repose donc jamais dessus.
            'utilisateur_id' => optional($requete->user())->id,
            'navigateur' => substr((string) $requete->userAgent(), 0, 200),
        ];

        // Journal : toujours, même sans Sentry configuré. C'est le filet minimal.
        Log::warning('[client] '.$donnees['message'], $contexte);

        // Sentry : seulement s'il est installé ET configuré (DSN renseigné).
        // Le `class_exists` évite de faire dépendre la remontée d'erreurs d'un
        // paquet facultatif — la route doit marcher dans tous les cas.
        if (class_exists(\Sentry\SentrySdk::class) && config('sentry.dsn')) {
            \Sentry\withScope(function ($portee) use ($donnees, $contexte) {
                $portee->setContext('navigateur', $contexte);
                $portee->setTag('origine', 'client');
                \Sentry\captureMessage('[client] '.$donnees['message']);
            });
        }

        // 204 : rien à renvoyer, et surtout aucun écho de l'entrée.
        return response()->noContent();
    }
}
