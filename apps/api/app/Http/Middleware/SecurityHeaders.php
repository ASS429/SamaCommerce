<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * S5 — En-têtes de sécurité HTTP sur toutes les réponses de l'API.
 *  - X-Content-Type-Options: nosniff  → empêche le MIME-sniffing
 *  - X-Frame-Options: DENY            → anti-clickjacking (l'API n'est jamais iframée)
 *  - Referrer-Policy                  → limite la fuite d'URL
 *  - Permissions-Policy               → caméra autorisée (scanner) ; le reste coupé
 *  - Strict-Transport-Security        → HTTPS forcé (uniquement hors dev / requête sécurisée)
 *  - Content-Security-Policy          → l'API ne renvoie que du JSON : tout bloqué
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
        $response->headers->set('Cross-Origin-Resource-Policy', 'same-site');

        // CSP minimale pour les réponses API (JSON) : aucune ressource ne doit s'y charger.
        $response->headers->set(
            'Content-Security-Policy',
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
        );

        // HSTS : seulement si la requête est déjà en HTTPS (évite de casser le dev en http).
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
