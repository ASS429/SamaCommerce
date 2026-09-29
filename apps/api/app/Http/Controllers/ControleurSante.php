<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * T14 — État de santé agrégé : base + micro-service IA + version. Permet de
 * diagnostiquer une panne (« l'IA répond-elle ? la base est-elle joignable ? »)
 * sans se connecter au serveur.
 */
class ControleurSante extends Controleur
{
    public function afficher()
    {
        $base = $this->sonder(fn () => DB::connection()->getPdo() !== null);

        $ia = $this->sonder(function () {
            // Même normalisation que les appels métier (ClientIa) : Render
            // fournit l'hôte SANS schéma quand la variable vient d'un autre
            // service. Relire la configuration brute ici ferait mentir le
            // diagnostic — l'IA répondrait, mais /sante la déclarerait morte.
            $url = (new \App\Services\ClientIa)->adresseDeBase();
            if ($url === null) {
                return false;
            }

            return Http::timeout(2)->get($url.'/sante')->successful();
        });

        // La SANTÉ HTTP ne dépend que de la base : l'IA est facultative (repli
        // heuristique PHP), donc une IA absente = « degrade » mais toujours 200
        // (sinon le contrôle de santé de Render échouerait alors que
        // l'application est utilisable).
        $statut = $base['ok'] ? ($ia['ok'] ? 'ok' : 'degrade') : 'hors_service';

        return response()->json([
            'statut' => $statut,
            'version' => (string) config('app.version', '3.0.0'),
            'cache_statistiques' => (bool) config('app.cache_statistiques', false), // aide au diagnostic
            'heure' => now()->toIso8601String(),
            'services' => [
                'base_de_donnees' => $base,
                'ia' => $ia, // si absente, l'application bascule sur l'heuristique PHP
            ],
        ], $base['ok'] ? 200 : 503);
    }

    /**
     * Appels reçus à l'ANCIEN format de l'API, sur les 14 derniers jours.
     * Quand la liste reste vide deux semaines, plus aucun téléphone n'utilise
     * l'ancienne version : la couche de compatibilité peut être retirée.
     */
    public function compatibilite()
    {
        $jours = [];
        for ($i = 13; $i >= 0; $i--) {
            $jour = now()->subDays($i)->toDateString();
            $appels = (int) \Illuminate\Support\Facades\Cache::get("ancien_contrat:appels:{$jour}", 0);
            if ($appels > 0) {
                $jours[$jour] = $appels;
            }
        }

        return response()->json([
            'dernier_appel' => \Illuminate\Support\Facades\Cache::get('ancien_contrat:dernier_appel'),
            'appels_par_jour' => (object) $jours,
        ]);
    }

    /** @param callable():bool $sonde */
    private function sonder(callable $sonde): array
    {
        $debut = microtime(true);
        try {
            $ok = (bool) $sonde();
        } catch (\Throwable $e) {
            $ok = false;
        }

        return ['ok' => $ok, 'latence_ms' => (int) round((microtime(true) - $debut) * 1000)];
    }
}
