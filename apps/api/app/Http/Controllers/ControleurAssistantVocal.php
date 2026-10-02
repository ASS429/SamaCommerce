<?php

namespace App\Http\Controllers;

use App\Models\QuestionAssistant;
use App\Services\AssistantVocal\AssistantIndisponible;
use App\Services\AssistantVocal\AssistantVocal;
use App\Services\AssistantVocal\OutilsAssistant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Assistant vocal (bêta) : le commerçant pose une question en wolof ou en
 * français, à la voix ou par écrit. L'assistant répond (texte et voix) et peut
 * ouvrir la page où faire l'opération ; il ne modifie aucune donnée.
 */
class ControleurAssistantVocal extends Controleur
{
    public function __construct(private AssistantVocal $assistant) {}

    /** Le micro s'affiche-t-il, et combien de questions reste-t-il aujourd'hui ? */
    public function etat(Request $requete)
    {
        $proprietaire = $requete->user();
        $ouvert = $this->estOuvert($requete);

        return response()->json([
            'disponible' => $ouvert,
            'questions_restantes' => $ouvert ? AssistantVocal::questionsRestantes($proprietaire) : 0,
            'duree_max_secondes' => (int) config('assistant_vocal.duree_max_secondes'),
        ]);
    }

    public function poser(Request $requete)
    {
        $proprietaire = $requete->user();
        if (! $this->estOuvert($requete)) {
            return response()->json([
                'erreur' => 'Accès refusé',
                'message' => 'L’assistant vocal n’est pas encore ouvert pour cette boutique.',
            ], 403);
        }

        $donnees = $requete->validate([
            'langue' => ['required', 'in:wo,fr'],
            // 30 secondes de WAV mono 16 kHz font moins d'un Mo.
            'audio' => ['required_without:texte', 'nullable', 'file', 'max:1500'],
            'texte' => ['required_without:audio', 'nullable', 'string', 'max:300'],
        ], [
            'audio.required_without' => 'Envoyez un message vocal ou écrivez votre question.',
            'audio.max' => 'Message vocal trop lourd.',
            'texte.max' => 'Question trop longue : 300 caractères au plus.',
        ]);

        $chemin = $requete->file('audio')?->getRealPath() ?: null;
        if ($chemin) {
            $duree = self::dureeWav($chemin);
            if ($duree === null) {
                throw ValidationException::withMessages(['audio' => ['Le message vocal n’a pas pu être lu.']]);
            }
            if ($duree > config('assistant_vocal.duree_max_secondes') + 1) {
                throw ValidationException::withMessages(['audio' => ['Message trop long : 30 secondes au plus.']]);
            }
        }

        if (AssistantVocal::questionsRestantes($proprietaire) <= 0) {
            return response()->json([
                'erreur' => 'Quota atteint',
                'message' => 'Vous avez posé toutes vos questions pour aujourd’hui. L’assistant revient demain.',
            ], 429);
        }

        // Transcription, réflexion et voix : jusqu'à une minute quand Google est chargé.
        set_time_limit(90);
        $outils = new OutilsAssistant(
            $proprietaire,
            (bool) $requete->attributes->get('est_employe', false),
            (array) $requete->attributes->get('permissions', []),
        );

        try {
            $resultat = $this->assistant->repondre(
                $proprietaire, $outils, $donnees['langue'], $chemin, $donnees['texte'] ?? null,
                $requete->attributes->get('utilisateur_reel', $proprietaire),
            );
        } catch (AssistantIndisponible $e) {
            Log::warning('[assistant vocal] '.$e->getMessage());

            return response()->json([
                'erreur' => 'Indisponible',
                'etape' => $e->etape,
                'transcription' => $e->transcription,
                'message' => 'L’assistant ne répond pas pour le moment. Réessayez dans un instant.',
            ], 503);
        }

        return response()->json([
            'id' => $resultat['id'],
            'transcription' => $resultat['transcription'],
            'reponse' => $resultat['reponse'],
            'langue' => $donnees['langue'],
            'carte' => $resultat['carte'],
            'action' => $resultat['action'],
            'questions_restantes' => AssistantVocal::questionsRestantes($proprietaire),
        ]);
    }

    /**
     * La réponse lue à voix haute (MP3), demandée juste après la réponse écrite.
     * En POST et non en GET : chaque lecture est facturée, et le service worker
     * ne doit pas la mettre en cache.
     */
    public function voix(Request $requete, int $id)
    {
        $question = QuestionAssistant::query()
            ->where('utilisateur_id', $requete->user()->id)
            ->whereNull('erreur')
            ->find($id);
        if (! $question || ! $this->estOuvert($requete)) {
            return response()->json(['erreur' => 'Introuvable', 'message' => 'Cette réponse n’existe pas.'], 404);
        }
        if ($question->duree_voix_ms !== null) {
            return response()->json(['erreur' => 'Déjà lue', 'message' => 'Cette réponse a déjà été lue.'], 409);
        }
        if ($question->cree_le->lt(now()->subMinutes(AssistantVocal::VOIX_DISPONIBLE_MINUTES))) {
            return response()->json(['erreur' => 'Trop tard', 'message' => 'Cette réponse est trop ancienne pour être lue.'], 410);
        }

        $audio = $this->assistant->lireAVoixHaute($question);
        if ($audio === null) {
            return response()->json([
                'erreur' => 'Indisponible',
                'etape' => 'voix',
                'message' => 'La voix ne répond pas : la réponse reste écrite.',
            ], 503);
        }

        return response($audio, 200, ['Content-Type' => 'audio/mpeg', 'Cache-Control' => 'no-store']);
    }

    /** Fermé aux comptes de démonstration : chaque question est facturée. */
    private function estOuvert(Request $requete): bool
    {
        $proprietaire = $requete->user();

        return ! $proprietaire->estCompteDemo() && AssistantVocal::estOuvertA($proprietaire);
    }

    /** Durée d'un fichier WAV en secondes, ou null si ce n'en est pas un. */
    private static function dureeWav(string $chemin): ?float
    {
        $fichier = fopen($chemin, 'rb');
        if (! $fichier) {
            return null;
        }
        try {
            $entete = fread($fichier, 12);
            if (strlen($entete) < 12 || substr($entete, 0, 4) !== 'RIFF' || substr($entete, 8, 4) !== 'WAVE') {
                return null;
            }
            // Parcours des morceaux (« chunks ») : « fmt » donne le débit, « data » la taille du son.
            $octetsParSeconde = null;
            while (($morceau = fread($fichier, 8)) !== false && strlen($morceau) === 8) {
                $nom = substr($morceau, 0, 4);
                $taille = unpack('V', substr($morceau, 4, 4))[1];
                if ($nom === 'fmt ') {
                    $format = fread($fichier, $taille);
                    $octetsParSeconde = strlen($format) >= 12 ? unpack('V', substr($format, 8, 4))[1] : null;
                    if ($taille % 2) {
                        fseek($fichier, 1, SEEK_CUR);
                    }
                } elseif ($nom === 'data') {
                    return $octetsParSeconde ? $taille / $octetsParSeconde : null;
                } else {
                    fseek($fichier, $taille + ($taille % 2), SEEK_CUR);
                }
            }

            return null;
        } finally {
            fclose($fichier);
        }
    }
}
