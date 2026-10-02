<?php

namespace App\Services\AssistantVocal;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Appels au modèle Gemini (Google), utilisé comme cerveau, et comme oreille
 * pour le français.
 *
 * Pendant les essais, l'offre de Google était régulièrement saturée (503) ou à
 * court de quota (429). Un appel qui échoue ainsi lève ModeleIndisponible :
 * l'appelant essaie alors le modèle suivant de la liste au lieu de faire
 * attendre le commerçant. Le modèle fautif est ensuite laissé de côté une
 * minute : la question suivante ne perd plus son temps à l'attendre.
 */
final class ClientGemini
{
    /** Un appel qui n'a pas répondu en 15 s ne répondra pas à temps pour le commerçant. */
    private const DELAI_SECONDES = 15;

    /** Les quotas de Google se comptent à la minute. */
    private const PAUSE_APRES_SATURATION_SECONDES = 60;

    /** @return string[] du plus récent au plus ancien, sans ceux qui viennent de saturer */
    public function modeles(): array
    {
        $tous = config('assistant_vocal.gemini.modeles') ?: ['gemini-3.8-flash'];
        $disponibles = array_values(array_filter($tous, fn (string $modele) => ! Cache::has(self::cleSaturation($modele))));

        // Tous saturés : on les retente tous plutôt que de renoncer sans essayer.
        return $disponibles ?: $tous;
    }

    /**
     * Un appel « generateContent ».
     *
     * @param  array  $contenus  l'échange jusqu'ici (rôles user / model)
     * @param  array  $declarations  outils que le modèle peut appeler
     * @param  float|null  $delai  secondes restantes au plus (budget de l'appelant)
     * @return array le contenu renvoyé par le modèle (rôle « model »)
     */
    public function generer(string $modele, string $consignes, array $contenus, array $declarations = [], ?float $delai = null): array
    {
        $corps = [
            'system_instruction' => ['parts' => [['text' => $consignes]]],
            'contents' => $contenus,
            // Réflexion réduite : une seconde gagnée sur chaque réponse (essai du 02/10).
            'generationConfig' => ['thinkingConfig' => ['thinkingLevel' => 'low']],
        ];
        if ($declarations !== []) {
            $corps['tools'] = [['function_declarations' => $declarations]];
        }
        $delai = max(1, (int) ceil(min(self::DELAI_SECONDES, $delai ?? self::DELAI_SECONDES)));

        $reponse = $this->envoyer($modele, $corps, $delai);
        // Un modèle qui ne connaîtrait pas le réglage de réflexion : on le retire.
        if ($reponse->status() === 400 && str_contains(strtolower($reponse->body()), 'thinking')) {
            unset($corps['generationConfig']);
            $reponse = $this->envoyer($modele, $corps, $delai);
        }

        if (in_array($reponse->status(), [429, 500, 502, 503, 504], true)) {
            throw $this->saturation($modele, "HTTP {$reponse->status()}");
        }
        if ($reponse->failed()) {
            throw new AssistantIndisponible('cerveau', "{$modele} : HTTP {$reponse->status()}");
        }

        $contenu = $reponse->json('candidates.0.content');
        if (! is_array($contenu)) {
            throw new ModeleIndisponible("{$modele} : réponse vide");
        }

        return self::retablirObjetsVides($contenu);
    }

    /** Le texte d'un contenu renvoyé (sans les pensées internes du modèle). */
    public static function texte(array $contenu): string
    {
        $morceaux = [];
        foreach ($contenu['parts'] ?? [] as $partie) {
            if (isset($partie['text']) && empty($partie['thought'])) {
                $morceaux[] = $partie['text'];
            }
        }

        return trim(implode(' ', $morceaux));
    }

    private function envoyer(string $modele, array $corps, int $delai): Response
    {
        try {
            return Http::timeout($delai)
                ->acceptJson()
                ->withHeaders(['x-goog-api-key' => (string) config('assistant_vocal.gemini.cle')])
                ->post(config('assistant_vocal.gemini.url')."/models/{$modele}:generateContent", $corps);
        } catch (ConnectionException $e) {
            throw $this->saturation($modele, $e->getMessage());
        }
    }

    /** Le modèle ne répond pas : il passe son tour pendant une minute. */
    private function saturation(string $modele, string $raison): ModeleIndisponible
    {
        Cache::put(self::cleSaturation($modele), true, self::PAUSE_APRES_SATURATION_SECONDES);
        Log::info("[assistant vocal] {$modele} indisponible ({$raison}) : modèle suivant");

        return new ModeleIndisponible("{$modele} : {$raison}");
    }

    private static function cleSaturation(string $modele): string
    {
        return "assistant_vocal:modele_sature:{$modele}";
    }

    /**
     * Décodé en tableaux PHP, l'objet vide `{}` devient `[]`. Renvoyé tel quel
     * dans l'échange suivant, Gemini refuserait un appel d'outil sans argument.
     */
    private static function retablirObjetsVides(array $contenu): array
    {
        foreach ($contenu['parts'] ?? [] as $i => $partie) {
            if (isset($partie['functionCall']) && empty($partie['functionCall']['args'])) {
                $contenu['parts'][$i]['functionCall']['args'] = new \stdClass;
            }
        }

        return $contenu;
    }
}
