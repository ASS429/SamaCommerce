<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Client HTTP du micro-service IA (FastAPI). Si le service est injoignable,
 * renvoie null pour que le contrôleur bascule sur l'heuristique PHP.
 */
class ClientIa
{
    public function prevision(array $donnees): ?array
    {
        return $this->envoyer('/prevision', $donnees);
    }

    public function scoreCredit(array $donnees): ?array
    {
        return $this->envoyer('/score-credit', $donnees);
    }

    /**
     * Adresse de base du service, tolérante au format.
     *
     * Render fournit l'adresse d'un service lié SANS schéma
     * (`samacommerce-ia.onrender.com`). Sans cette normalisation, chaque appel
     * partirait vers une adresse invalide et l'IA resterait silencieusement
     * désactivée — le pire des cas, puisque le repli heuristique masque la panne.
     */
    public function adresseDeBase(): ?string
    {
        $url = trim((string) config('services.ia.url'));
        if ($url === '') {
            return null; // non configurée : repli heuristique assumé
        }
        if (! str_starts_with($url, 'http://') && ! str_starts_with($url, 'https://')) {
            $url = 'https://'.$url;
        }

        /* Nom de service Render nu (« samacommerce-ia ») au lieu de l'hôte
         * complet : c'est ce que produit `fromService ... property: host` dans
         * le tableau de bord, et c'est un nom qui ne se résout PAS depuis
         * l'extérieur. On complète le domaine plutôt que d'échouer en silence.
         *
         * Règle volontairement étroite : uniquement si l'hôte n'a ni point ni
         * port, et n'est pas localhost. Un `http://ia:8001` de compose ou un
         * `http://localhost:8001` de développement restent donc intacts. */
        $hote = parse_url($url, PHP_URL_HOST) ?: '';
        $port = parse_url($url, PHP_URL_PORT);
        if ($hote !== '' && $port === null && ! str_contains($hote, '.') && $hote !== 'localhost') {
            $url = str_replace('://'.$hote, '://'.$hote.'.onrender.com', $url);
        }

        return rtrim($url, '/');
    }

    private function envoyer(string $chemin, array $donnees): ?array
    {
        $base = $this->adresseDeBase();
        if ($base === null) {
            return null;
        }

        try {
            // 4 s : de quoi absorber un service tiède, mais pas un réveil à
            // froid de Render (~50 s) — on ne fait pas patienter le commerçant
            // au comptoir, l'heuristique PHP prend le relais.
            $reponse = Http::timeout(4)->acceptJson()->post($base.$chemin, $donnees);
            if ($reponse->successful()) {
                return $reponse->json();
            }
            self::signaler($chemin, 'réponse '.$reponse->status());
        } catch (\Throwable $e) {
            self::signaler($chemin, $e->getMessage());
        }

        return null;
    }

    /**
     * Journalise UNE SEULE FOIS par requête HTTP.
     *
     * Le repli heuristique rend cette panne invisible : sans trace, une IA
     * mal configurée (adresse sans schéma, service endormi, modèle absent) peut
     * rester désactivée des mois sans que personne s'en aperçoive. C'est
     * exactement ce qui s'est produit avec `fromService`, qui injectait le NOM
     * du service au lieu de son hôte.
     *
     * `debug` et non `error` : une IA muette n'est pas une panne applicative,
     * l'heuristique fait le travail. On veut une trace, pas une alerte.
     */
    private static array $dejaSignale = [];

    private static function signaler(string $chemin, string $raison): void
    {
        if (isset(self::$dejaSignale[$chemin])) {
            return;
        }
        self::$dejaSignale[$chemin] = true;
        Log::debug("[ia] {$chemin} indisponible ({$raison}) — repli heuristique");
    }
}
