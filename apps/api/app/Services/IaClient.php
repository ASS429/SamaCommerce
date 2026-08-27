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

    /**
     * Base du service, tolerante au format.
     *
     * Render fournit l'adresse d'un service lie SANS schema
     * (`samacommerce-ia.onrender.com`). Sans cette normalisation, chaque appel
     * partirait vers une URL invalide et l'IA resterait silencieusement
     * desactivee — le pire des cas, puisque le repli heuristique masque la panne.
     */
    public function baseUrl(): ?string
    {
        $url = trim((string) config('services.ia.url'));
        if ($url === '') {
            return null; // non configure : repli heuristique assume
        }
        if (! str_starts_with($url, 'http://') && ! str_starts_with($url, 'https://')) {
            $url = 'https://'.$url;
        }

        return rtrim($url, '/');
    }

    private function post(string $path, array $payload): ?array
    {
        $base = $this->baseUrl();
        if ($base === null) {
            return null;
        }

        try {
            // 4 s : de quoi absorber un service tiede, mais pas un reveil a
            // froid de Render (~50 s) — on ne fait pas patienter le commercant
            // au comptoir, l'heuristique PHP prend le relais.
            $res = Http::timeout(4)->acceptJson()->post($base.$path, $payload);

            return $res->successful() ? $res->json() : null;
        } catch (\Throwable) {
            return null;
        }
    }
}
