<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * T14 — Healthcheck agrégé : état DB + micro-service IA + version. Permet de
 * diagnostiquer une panne (« l'IA répond-elle ? la base est-elle joignable ? »)
 * sans se connecter au serveur.
 */
class HealthController extends Controller
{
    public function index()
    {
        $db = $this->check(fn () => DB::connection()->getPdo() !== null);

        $ia = $this->check(function () {
            $url = rtrim((string) config('services.ia.url'), '/');
            if ($url === '') {
                return false;
            }

            return Http::timeout(2)->get($url.'/health')->successful();
        });

        // La SANTÉ HTTP ne dépend que de la base : l'IA est optionnelle (repli
        // heuristique PHP), donc une IA absente = « degraded » mais toujours 200
        // (sinon le health check Render échouerait alors que l'app est utilisable).
        $status = $db['ok'] ? ($ia['ok'] ? 'ok' : 'degraded') : 'down';

        return response()->json([
            'status' => $status,
            'version' => (string) config('app.version', '3.0.0'),
            'time' => now()->toIso8601String(),
            'services' => [
                'database' => $db,
                'ia' => $ia, // si down, l'app bascule sur l'heuristique PHP (dégradation gracieuse)
            ],
        ], $db['ok'] ? 200 : 503);
    }

    /** @param callable():bool $probe */
    private function check(callable $probe): array
    {
        $start = microtime(true);
        try {
            $ok = (bool) $probe();
        } catch (\Throwable $e) {
            $ok = false;
        }

        return ['ok' => $ok, 'latency_ms' => (int) round((microtime(true) - $start) * 1000)];
    }
}
