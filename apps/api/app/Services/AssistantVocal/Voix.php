<?php

namespace App\Services\AssistantVocal;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * La voix : lit la réponse avec Oolel-Voices (Soynade), jugée « parfaite » en
 * wolof comme en français par les participants de la campagne du 02/10/2026.
 *
 * Une voix indisponible ne fait pas échouer la question : la réponse écrite
 * s'affiche quand même.
 */
final class Voix
{
    /** @return string|null le son au format MP3 (léger sur les données mobiles), ou null */
    public function synthetiser(string $texte, string $langue): ?string
    {
        $aLire = NombresEnLettres::textePourLaVoix($texte);
        if ($aLire === '') {
            return null;
        }

        $config = config('assistant_vocal.soynade');
        try {
            $reponse = Http::timeout(30)
                ->withToken((string) $config['cle'])
                ->post($config['url'].'/v1/text-to-speech', [
                    'text' => mb_substr($aLire, 0, 600),
                    'language' => $langue,
                    'output_format' => 'mp3',
                    'exaggeration' => 0.3,
                    'temperature' => 0.3,
                    'cfg_weight' => 0.5,
                    'seed' => 0,
                ]);
        } catch (\Throwable $e) {
            Log::warning('[assistant vocal] voix indisponible : '.$e->getMessage());

            return null;
        }
        if ($reponse->failed()) {
            Log::warning('[assistant vocal] voix indisponible : HTTP '.$reponse->status());

            return null;
        }

        // Selon les cas, Soynade renvoie le son brut ou un JSON qui le contient en base64.
        if (str_contains((string) $reponse->header('Content-Type'), 'json')) {
            $base64 = $reponse->json('audio') ?? $reponse->json('audio_base64');

            return is_string($base64) ? (base64_decode($base64, true) ?: null) : null;
        }

        return $reponse->body() !== '' ? $reponse->body() : null;
    }
}
