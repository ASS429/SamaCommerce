<?php

/*
 * Assistant vocal (octobre 2026) : le commerçant parle en wolof ou en français,
 * l'assistant répond à voix haute et le guide vers la bonne page.
 *
 * La chaîne retenue après les essais du 1er et du 2 octobre 2026 :
 *   - l'oreille : Soynade (`oolel-speech-v1`) pour le wolof, Gemini pour le
 *     français (en lui indiquant la langue : sans elle, il prenait l'accent
 *     sénégalais pour de l'anglais) ;
 *   - le cerveau : Gemini, qui lit DIRECTEMENT le wolof (passer par une
 *     traduction française effaçait le dërëm : 10 000 F devenaient 2 000 F) ;
 *   - la voix : Oolel-Voices (Soynade).
 *
 * Phase bêta : seuls les comptes listés dans COMPTES_ASSISTANT_VOCAL voient le
 * bouton. Chaque question coûte environ 20 à 25 F (oreille + voix), d'où le
 * quota quotidien.
 */
return [

    // Identifiants de connexion autorisés, séparés par des virgules. « * »
    // ouvre l'assistant à tous les comptes ; vide, il n'est proposé à personne.
    'comptes' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('COMPTES_ASSISTANT_VOCAL', '')),
    ))),

    // Questions par jour et par commerçant (employés compris).
    'questions_par_jour' => (int) env('QUOTA_ASSISTANT_VOCAL', 40),

    // Au-delà, le navigateur coupe l'enregistrement : Soynade recommande des
    // messages de moins de 30 secondes.
    'duree_max_secondes' => 30,

    'soynade' => [
        'url' => rtrim((string) env('URL_API_SOYNADE', 'https://api.soynade.ai'), '/'),
        'cle' => env('CLE_API_SOYNADE'),
    ],

    'gemini' => [
        'url' => rtrim((string) env('URL_API_GEMINI', 'https://generativelanguage.googleapis.com/v1beta'), '/'),
        'cle' => env('CLE_API_GEMINI'),
        // Du plus récent au plus ancien : si un modèle est saturé (503) ou à
        // court de quota (429), on passe au suivant au lieu de faire attendre.
        'modeles' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('MODELES_GEMINI', 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash')),
        ))),
    ],
];
