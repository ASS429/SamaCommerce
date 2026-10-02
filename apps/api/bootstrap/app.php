<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/en-service',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => \App\Http\Middleware\VerifierAdmin::class,
            'proprietaire' => \App\Http\Middleware\ResoudreProprietaire::class,
            'perm' => \App\Http\Middleware\VerifierPermission::class,
            'plan' => \App\Http\Middleware\VerifierPlan::class,
        ]);
        // S5 — en-têtes de sécurité sur toutes les réponses de l'API.
        $middleware->appendToGroup('api', \App\Http\Middleware\EntetesSecurite::class);
        // Aucune boutique héritée d'une requête précédente (serveur persistant, tests).
        $middleware->prependToGroup('api', \App\Http\Middleware\OublierBoutiquePrecedente::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $requete) => $requete->is('api/*'),
        );
    })->create();
