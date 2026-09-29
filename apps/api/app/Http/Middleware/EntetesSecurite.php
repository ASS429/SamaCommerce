<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * S5 — En-têtes de sécurité HTTP sur toutes les réponses de l'API.
 *  - X-Content-Type-Options: nosniff  → empêche la devinette du type MIME
 *  - X-Frame-Options: DENY            → anti-détournement de clic (l'API n'est jamais encadrée)
 *  - Referrer-Policy                  → limite la fuite d'adresse
 *  - Permissions-Policy               → caméra autorisée (scanner) ; le reste coupé
 *  - Strict-Transport-Security        → HTTPS forcé (uniquement sur requête déjà sécurisée)
 *  - Content-Security-Policy          → l'API ne renvoie que du JSON : tout bloqué
 */
class EntetesSecurite
{
    public function handle(Request $requete, Closure $suite): Response
    {
        $reponse = $suite($requete);

        $reponse->headers->set('X-Content-Type-Options', 'nosniff');
        $reponse->headers->set('X-Frame-Options', 'DENY');
        $reponse->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $reponse->headers->set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
        $reponse->headers->set('Cross-Origin-Resource-Policy', 'same-site');

        // Politique minimale pour des réponses JSON : aucune ressource ne doit s'y charger.
        $reponse->headers->set(
            'Content-Security-Policy',
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
        );

        // HSTS : seulement si la requête est déjà en HTTPS (évite de casser le développement en http).
        if ($requete->isSecure()) {
            $reponse->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $reponse;
    }
}
