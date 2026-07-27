<?php

/**
 * S6 — Configuration CORS durcie.
 * En production, définir CORS_ALLOWED_ORIGINS avec le(s) domaine(s) réel(s)
 * (séparés par des virgules) au lieu d'accepter toutes les origines.
 */

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // Par défaut : origines locales du dev. En prod, surchargées par l'env.
    'allowed_origins' => array_filter(explode(',', env(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173'
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Content-Type', 'X-Requested-With', 'Authorization', 'Accept', 'Origin'],

    'exposed_headers' => [],

    'max_age' => 3600,

    // On utilise des bearer tokens (pas de cookies stateful) → pas besoin de credentials.
    'supports_credentials' => false,

];
