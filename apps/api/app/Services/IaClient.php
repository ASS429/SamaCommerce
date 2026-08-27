<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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

        /* Nom de service Render nu (« samacommerce-ia ») au lieu de l'hote
         * complet : c'est ce que produit `fromService ... property: host` dans
         * le tableau de bord, et c'est un nom qui ne resout PAS depuis
         * l'exterieur. On complete le domaine plutot que d'echouer en silence.
         *
         * Regle volontairement etroite : uniquement si l'hote n'a ni point ni
         * port, et n'est pas localhost. Un `http://ia:8001` de compose ou un
         * `http://localhost:8001` de dev restent donc intacts. */
        $hote = parse_url($url, PHP_URL_HOST) ?: '';
        $port = parse_url($url, PHP_URL_PORT);
        if ($hote !== '' && $port === null && ! str_contains($hote, '.') && $hote !== 'localhost') {
            $url = str_replace('://'.$hote, '://'.$hote.'.onrender.com', $url);
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
            if ($res->successful()) {
                return $res->json();
            }
            self::signaler($path, 'reponse '.$res->status());
        } catch (\Throwable $e) {
            self::signaler($path, $e->getMessage());
        }

        return null;
    }

    /**
     * Journalise UNE SEULE FOIS par requete HTTP.
     *
     * Le repli heuristique rend cette panne invisible : sans trace, une IA
     * mal configuree (URL sans schema, service endormi, modele absent) peut
     * rester desactivee des mois sans que personne s'en apercoive. C'est
     * exactement ce qui s'est produit avec `fromService`, qui injectait le NOM
     * du service au lieu de son hote.
     *
     * `debug` et non `error` : une IA muette n'est pas une panne applicative,
     * l'heuristique fait le travail. On veut une trace, pas une alerte.
     */
    private static array $dejaSignale = [];

    private static function signaler(string $path, string $raison): void
    {
        if (isset(self::$dejaSignale[$path])) {
            return;
        }
        self::$dejaSignale[$path] = true;
        Log::debug("[ia] {$path} indisponible ({$raison}) — repli heuristique");
    }
}
