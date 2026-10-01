<?php

/**
 * S6 — Configuration CORS durcie.
 * En production, définir ORIGINES_CORS_AUTORISEES avec le(s) domaine(s) réel(s)
 * (séparés par des virgules) au lieu d'accepter toutes les origines.
 */

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Par défaut : origines locales du développement ET l'adresse publique du
    // site. Si la variable venait à manquer en production, le navigateur
    // bloquerait sinon TOUS les appels du site vers l'API.
    'allowed_origins' => array_filter(explode(',', env(
        'ORIGINES_CORS_AUTORISEES',
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,https://samacommerce-web.onrender.com'
    ))),

    'allowed_origins_patterns' => [],

    // X-Contrat-Api : envoyé par les versions du site d'avant le 01/10/2026
    // (il départageait l'ancien et le nouveau format, retiré depuis) et ignoré
    // désormais. On l'autorise encore : une version gardée en cache sur un
    // téléphone serait sinon bloquée à sa première ouverture après la mise à
    // jour. Peut disparaître une fois tous les appareils à jour.
    'allowed_headers' => ['Content-Type', 'X-Requested-With', 'Authorization', 'Accept', 'Origin', 'X-Contrat-Api'],

    'exposed_headers' => [],

    'max_age' => 3600,

    // On utilise des bearer tokens (pas de cookies stateful) → pas besoin de credentials.
    'supports_credentials' => false,

];
