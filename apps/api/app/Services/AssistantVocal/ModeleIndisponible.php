<?php

namespace App\Services\AssistantVocal;

use RuntimeException;

/** Ce modèle Gemini est saturé ou à court de quota : on essaie le suivant. */
class ModeleIndisponible extends RuntimeException {}
