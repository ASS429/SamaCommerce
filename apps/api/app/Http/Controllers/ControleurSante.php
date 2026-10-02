<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Cache;
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

        // Réveil par cron-job.org (toutes les 10 min en journée) : on note son
        // passage pour le tableau de bord, et on en profite pour envoyer, une
        // fois par jour, les rappels d'échéance (pas de tâche planifiée sur
        // l'hébergement gratuit). Envoi APRÈS la réponse : le réveil reste rapide.
        if (stripos((string) request()->userAgent(), 'cron-job.org') !== false) {
            Cache::put('reveil:dernier', now()->toIso8601String(), now()->addDays(2));
        }
        if ($base['ok'] && Cache::add('rappels-abonnement:'.now()->toDateString(), true, now()->addDay())) {
            dispatch(fn () => \App\Services\RappelsAbonnement::envoyerCeuxDuJour())->afterResponse();
        }
        // Le compte public de démonstration repart à neuf chaque matin. En
        // production seulement : ailleurs, ses données servent aux tests.
        if ($base['ok'] && app()->environment('production') && Cache::add('demo-reinitialisee:'.now()->toDateString(), true, now()->addDay())) {
            dispatch(fn () => \App\Services\Demonstration::reinitialiser())->afterResponse();
        }

        return response()->json([
            'statut' => $statut,
            'version' => (string) config('app.version', '3.0.0'),
        ] + array_filter(['commit' => config('app.commit')]) + [ // en ligne seulement
            'cache_statistiques' => (bool) config('app.cache_statistiques', false), // aide au diagnostic
            'heure' => now()->toIso8601String(),
            'services' => [
                'base_de_donnees' => $base,
                'ia' => $ia, // si absente, l'application bascule sur l'heuristique PHP
            ],
        ], $base['ok'] ? 200 : 503);
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
