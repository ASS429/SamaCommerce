<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Réception des erreurs JavaScript survenues chez les utilisateurs.
 *
 * POURQUOI PUBLIC. Une bonne part des plantages arrive AVANT la connexion
 * (écran de login, chargement initial) : exiger un jeton reviendrait à ne
 * jamais voir ces erreurs-là. Le débit est donc bridé au niveau de la route, et
 * rien de ce qui arrive ici n'est réaffiché ni exécuté — c'est du journal.
 *
 * POURQUOI PAS LE SDK NAVIGATEUR DE SENTRY. ~30 Ko compressés côté client, pour
 * des utilisateurs dont la data mobile est chère (cf. apps/web/src/lib/
 * errorReporter.ts). On relaie donc côté serveur : un seul canal d'alerte.
 */
class ClientErrorController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:500'],
            'stack' => ['nullable', 'string', 'max:3000'],
            'source' => ['nullable', 'string', 'max:300'],
            'url' => ['nullable', 'string', 'max:300'],
            'kind' => ['nullable', 'in:error,unhandledrejection,react'],
        ]);

        $contexte = [
            'kind' => $data['kind'] ?? 'error',
            'url' => $data['url'] ?? null,
            'source' => $data['source'] ?? null,
            'stack' => $data['stack'] ?? null,
            // L'utilisateur n'est connu que s'il était connecté : l'endpoint est
            // public, on ne se repose donc jamais dessus.
            'user_id' => optional($request->user())->id,
            'agent' => substr((string) $request->userAgent(), 0, 200),
        ];

        // Journal : toujours, même sans Sentry configuré. C'est le filet minimal.
        Log::warning('[client] '.$data['message'], $contexte);

        // Sentry : seulement s'il est installé ET configuré (DSN renseigné).
        // Le `class_exists` évite de faire dépendre la remontée d'erreurs d'un
        // paquet optionnel — l'endpoint doit marcher dans tous les cas.
        if (class_exists(\Sentry\SentrySdk::class) && config('sentry.dsn')) {
            \Sentry\withScope(function ($scope) use ($data, $contexte) {
                $scope->setContext('navigateur', $contexte);
                $scope->setTag('origine', 'client');
                \Sentry\captureMessage('[client] '.$data['message']);
            });
        }

        // 204 : rien à renvoyer, et surtout aucun écho de l'entrée.
        return response()->noContent();
    }
}
