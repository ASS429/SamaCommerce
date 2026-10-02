<?php

namespace App\Services\AssistantVocal;

use RuntimeException;

/**
 * Une étape de la chaîne n'a pas pu répondre (service saturé, clé refusée,
 * réseau coupé). Le commerçant lit « réessayez dans un instant » ; la cause
 * exacte reste dans le journal des questions.
 */
class AssistantIndisponible extends RuntimeException
{
    /** Ce que l'oreille avait déjà compris quand une étape suivante a échoué. */
    public ?string $transcription = null;

    public function __construct(public readonly string $etape, string $raison)
    {
        parent::__construct("{$etape} : {$raison}");
    }
}
