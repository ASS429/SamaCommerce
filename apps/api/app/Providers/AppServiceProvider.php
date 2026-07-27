<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // T8 — Contrat JSON figé : pas d'enveloppe "data" sur les ressources simples
        // ni les collections (le front reçoit des tableaux/objets plats, comme avant).
        // La pagination conserve son enveloppe {data, current_page, last_page, total}.
        JsonResource::withoutWrapping();

        // S8 — Limiteurs de débit nommés.
        // Global par utilisateur (ou IP si anonyme). 300/min : un SPA réel
        // rafale légitimement (Chiffres ≈ 10 appels, navigation rapide) — 90
        // déclenchait des 429 en usage normal au comptoir.
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(300)
            ->by($request->user()?->id ?: $request->ip()));

        // L'IA est coûteuse (micro-service ML) : 20 appels / minute / utilisateur.
        RateLimiter::for('ia', fn (Request $request) => Limit::perMinute(20)
            ->by($request->user()?->id ?: $request->ip()));

        // Écritures sensibles (POST/PUT/DELETE) : 40 / minute / utilisateur.
        RateLimiter::for('writes', fn (Request $request) => Limit::perMinute(40)
            ->by($request->user()?->id ?: $request->ip()));
    }
}
