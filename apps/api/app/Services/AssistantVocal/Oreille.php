<?php

namespace App\Services\AssistantVocal;

use Illuminate\Support\Facades\Http;

/**
 * L'oreille : transforme le message vocal en texte.
 *
 * Wolof : Soynade (`oolel-speech-v1`), le seul service essayé qui comprenne
 * vraiment le wolof (Gemini répondait en français, voire en espagnol).
 * Français : Gemini, à qui l'on DIT que le message est en français avec un
 * accent sénégalais. Sans cette précision, il transcrivait certaines phrases
 * en anglais (essai du 02/10/2026).
 */
final class Oreille
{
    private const CONSIGNE_FRANCAIS = 'Ce message vocal est en FRANÇAIS, parlé avec un accent sénégalais. '
        .'Transcris-le mot pour mot en français. Réponds uniquement par la transcription. '
        .'Si tu n\'entends aucune parole, ne réponds rien.';

    public function __construct(private ClientGemini $gemini) {}

    /** @param string $cheminWav fichier WAV (mono, 16 kHz) envoyé par le navigateur */
    public function transcrire(string $cheminWav, string $langue): string
    {
        return $langue === 'wo' ? $this->parSoynade($cheminWav, $langue) : $this->parGemini($cheminWav);
    }

    private function parSoynade(string $cheminWav, string $langue): string
    {
        $config = config('assistant_vocal.soynade');
        try {
            $reponse = Http::timeout(25)
                ->withToken((string) $config['cle'])
                ->acceptJson()
                ->attach('file', (string) file_get_contents($cheminWav), 'message.wav', ['Content-Type' => 'audio/wav'])
                ->post($config['url'].'/v1/audio/transcriptions', [
                    'language' => $langue,
                    'response_format' => 'json',
                    // Transcription déterministe : la recommandation de Soynade.
                    'temperature' => '0',
                ]);
        } catch (\Throwable $e) {
            throw new AssistantIndisponible('oreille', 'Soynade : '.$e->getMessage());
        }
        if ($reponse->failed()) {
            throw new AssistantIndisponible('oreille', 'Soynade : HTTP '.$reponse->status());
        }

        return self::texteDe($reponse->json());
    }

    private function parGemini(string $cheminWav): string
    {
        $contenus = [[
            'role' => 'user',
            'parts' => [
                ['inline_data' => ['mime_type' => 'audio/wav', 'data' => base64_encode((string) file_get_contents($cheminWav))]],
                ['text' => self::CONSIGNE_FRANCAIS],
            ],
        ]];

        $derniere = '';
        foreach ($this->gemini->modeles() as $modele) {
            try {
                return ClientGemini::texte($this->gemini->generer($modele, 'Tu es un transcripteur fidèle.', $contenus));
            } catch (ModeleIndisponible $e) {
                $derniere = $e->getMessage();
            }
        }
        throw new AssistantIndisponible('oreille', 'Gemini : '.$derniere);
    }

    /** La réponse de Soynade : le premier champ texte connu. */
    private static function texteDe(mixed $donnees): string
    {
        if (is_string($donnees)) {
            return trim($donnees);
        }
        if (is_array($donnees)) {
            foreach (['text', 'transcription', 'output', 'result'] as $cle) {
                if (isset($donnees[$cle]) && is_string($donnees[$cle])) {
                    return trim($donnees[$cle]);
                }
            }
        }

        return '';
    }
}
