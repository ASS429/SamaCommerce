<?php

namespace App\Models;

use Illuminate\Support\Carbon;

/** Une question posée à l'assistant vocal (quota quotidien et suivi de qualité). */
class QuestionAssistant extends Modele
{
    protected $table = 'questions_assistant';

    protected $fillable = [
        'utilisateur_id', 'boutique_id', 'pose_par', 'langue', 'mode', 'transcription', 'reponse',
        'outils', 'action', 'modele', 'duree_oreille_ms', 'duree_cerveau_ms', 'duree_voix_ms', 'erreur',
    ];

    protected $casts = [
        'duree_oreille_ms' => 'integer',
        'duree_cerveau_ms' => 'integer',
        'duree_voix_ms' => 'integer',
    ];

    /** Questions posées aujourd'hui par le commerçant, toutes boutiques confondues. */
    public static function duJour(int $utilisateurId): int
    {
        return static::query()
            ->where('utilisateur_id', $utilisateurId)
            ->where('cree_le', '>=', Carbon::today())
            ->count();
    }
}
