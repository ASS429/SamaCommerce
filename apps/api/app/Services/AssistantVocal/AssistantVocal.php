<?php

namespace App\Services\AssistantVocal;

use App\Models\QuestionAssistant;
use App\Models\Utilisateur;
use App\Services\Abonnements;

/**
 * Une question à l'assistant, du message vocal à la réponse lue :
 * l'oreille (transcription) → le cerveau (outils + réponse) → la voix.
 *
 * La voix est demandée À PART (lireAVoixHaute), juste après : la réponse
 * écrite s'affiche — et la bonne page s'ouvre — sans attendre les 5 à 10
 * secondes de la synthèse vocale (essai du 02/10/2026).
 *
 * Le son n'est jamais conservé : le journal garde le texte, les outils
 * appelés et les durées de chaque étape (pour suivre la latence et le coût).
 */
final class AssistantVocal
{
    /** Code de la fonctionnalité dans le catalogue des plans (Plan::FONCTIONNALITES). */
    public const FONCTIONNALITE = 'assistant_vocal';

    /** La voix d'une réponse se demande dans les minutes qui suivent, et une seule fois (elle est facturée). */
    public const VOIX_DISPONIBLE_MINUTES = 10;

    /** Réponse quand l'oreille n'a rien reconnu (le wolof est à faire relire par un locuteur). */
    public const PAS_ENTENDU = [
        'fr' => 'Je n\'ai pas bien entendu. Pouvez-vous répéter ?',
        'wo' => 'Dégguma bu baax. Mën nga ko waxaat ?',
    ];

    public function __construct(
        private Oreille $oreille,
        private Cerveau $cerveau,
        private Voix $voix,
    ) {}

    public static function estActive(): bool
    {
        return filled(config('assistant_vocal.soynade.cle')) && filled(config('assistant_vocal.gemini.cle'));
    }

    /**
     * Ouvert au commerçant ?
     *
     * Réservé aux ABONNÉS dont le plan inclut l'assistant : période payée (ou
     * offerte par l'administrateur), ou délai de grâce. Pas pendant l'essai
     * gratuit : chaque question est facturée par Soynade. La liste
     * COMPTES_ASSISTANT_VOCAL l'ouvre EN PLUS à d'autres comptes, pour les
     * essais (« * » = tout le monde).
     */
    public static function estOuvertA(Utilisateur $proprietaire): bool
    {
        if (! self::estActive()) {
            return false;
        }
        $comptes = config('assistant_vocal.comptes', []);
        if (in_array('*', $comptes, true) || in_array($proprietaire->identifiant, $comptes, true)) {
            return true;
        }
        $etat = Abonnements::etat($proprietaire);

        return in_array($etat->source, ['paye', 'grace'], true) && $etat->inclut(self::FONCTIONNALITE);
    }

    public static function questionsRestantes(Utilisateur $proprietaire): int
    {
        return max(0, (int) config('assistant_vocal.questions_par_jour') - QuestionAssistant::duJour($proprietaire->id));
    }

    /**
     * @param  string|null  $cheminWav  message vocal, ou null pour une question écrite
     * @return array{id: int, transcription: string, reponse: string, carte: ?array, action: ?array}
     */
    public function repondre(
        Utilisateur $proprietaire,
        OutilsAssistant $outils,
        string $langue,
        ?string $cheminWav,
        ?string $texte,
        ?Utilisateur $posePar = null,
    ): array {
        $journal = new QuestionAssistant([
            'utilisateur_id' => $proprietaire->id,
            'boutique_id' => $proprietaire->boutique_active_id,
            'pose_par' => $posePar?->id,
            'langue' => $langue,
            'mode' => $cheminWav ? 'voix' : 'texte',
        ]);

        try {
            $transcription = trim((string) $texte);
            if ($cheminWav) {
                $debut = hrtime(true);
                $transcription = $this->oreille->transcrire($cheminWav, $langue);
                $journal->duree_oreille_ms = self::millisecondesDepuis($debut);
            }
            $journal->transcription = $transcription;

            if (self::estVide($transcription)) {
                $reponse = self::PAS_ENTENDU[$langue];
            } else {
                $debut = hrtime(true);
                [$reponse, $modele] = $this->cerveau->repondre($transcription, Consignes::pour($proprietaire, $langue), $outils);
                $journal->duree_cerveau_ms = self::millisecondesDepuis($debut);
                $journal->modele = $modele;
            }
            $journal->reponse = $reponse;
            $journal->outils = mb_substr(implode(',', $outils->utilises), 0, 160) ?: null;
            $journal->action = $outils->action ? $outils->action['ecran'] : null;
        } catch (AssistantIndisponible $e) {
            $journal->erreur = mb_substr($e->getMessage(), 0, 255);
            $journal->save();
            // L'oreille a déjà été payée : le commerçant voit ce qu'elle a compris,
            // et « Réessayer » renverra ce texte au lieu de refaire écouter le son.
            if ($cheminWav && $journal->transcription) {
                $e->transcription = $journal->transcription;
            }
            throw $e;
        }
        $journal->save();

        return [
            'id' => $journal->id,
            'transcription' => $transcription,
            'reponse' => $reponse,
            'carte' => $outils->carte,
            'action' => $outils->action,
        ];
    }

    /** @return string|null la réponse lue (MP3), ou null si la voix est en panne */
    public function lireAVoixHaute(QuestionAssistant $question): ?string
    {
        $debut = hrtime(true);
        $audio = $this->voix->synthetiser((string) $question->reponse, $question->langue);
        if ($audio !== null) {
            // Noté seulement en cas de succès : une voix en panne peut être redemandée.
            $question->forceFill(['duree_voix_ms' => self::millisecondesDepuis($debut)])->save();
        }

        return $audio;
    }

    /** Silence ou bruit : aucune lettre reconnue (« ... », « [musique] » compte pour vide). */
    private static function estVide(string $transcription): bool
    {
        $sansBalises = preg_replace('/\[[^\]]*\]|\([^)]*\)/u', '', $transcription);

        return ! preg_match('/\p{L}/u', (string) $sansBalises);
    }

    private static function millisecondesDepuis(int $debut): int
    {
        return (int) round((hrtime(true) - $debut) / 1_000_000);
    }
}
