<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * Client HTTP du micro-service IA (FastAPI). Si le service est injoignable,
 * renvoie null pour que le contrôleur bascule sur l'heuristique PHP.
 */
class IaClient
{
    public function forecast(array $payload): ?array
    {
        return $this->post('/forecast', $payload);
    }

    public function creditScore(array $payload): ?array
    {
        return $this->post('/credit-score', $payload);
    }

    private function post(string $path, array $payload): ?array
    {
        try {
            $res = Http::timeout(2)->acceptJson()->post(rtrim((string) config('services.ia.url'), '/').$path, $payload);

            return $res->successful() ? $res->json() : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
