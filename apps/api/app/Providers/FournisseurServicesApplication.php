<?php

namespace App\Providers;

use App\Console\Commands\HarmoniserMigrations;
use App\Models\Utilisateur;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class FournisseurServicesApplication extends ServiceProvider
{
    /**
     * Enregistre les services de l'application.
     */
    public function register(): void
    {
        //
    }

    /**
     * Prépare les services au démarrage de l'application.
     */
    public function boot(): void
    {
        // T8 — Contrat JSON figé : pas d'enveloppe "data" sur les ressources simples
        // ni les collections (le front reçoit des tableaux/objets plats, comme avant).
        // La pagination conserve son enveloppe {data, current_page, last_page, total}.
        JsonResource::withoutWrapping();

        // Un identifiant de route est toujours un nombre. Sans cette contrainte,
        // `/clients/{id}` capturerait une adresse littérale comme
        // `/clients/for-sale` déclarée après elle.
        Route::pattern('id', '[0-9]+');

        // Jetons de connexion (Sanctum) : chaque jeton enregistre la CLASSE de
        // son propriétaire. Ceux émis avant la francisation portent l'ancien nom
        // `App\Models\User` ; sans cet alias, tous les commerçants seraient
        // déconnectés d'un coup. Les nouveaux jetons le reprennent aussi, pour
        // que l'ancien code puisse encore les lire pendant la transition.
        // Retrait prévu à l'étape 5 (glossaire, section 3).
        Relation::morphMap(['App\Models\User' => Utilisateur::class]);

        // Avant toute commande de migration, faire reconnaître les migrations
        // déjà jouées sous leur nom français (cf. HarmoniserMigrations) : sans
        // cela, Laravel recréerait des tables vides à côté des vraies.
        Event::listen(CommandStarting::class, function (CommandStarting $evenement) {
            if (str_starts_with((string) $evenement->command, 'migrate')) {
                HarmoniserMigrations::harmoniser();
            }
        });

        // S8 — Limiteurs de débit nommés.
        // Global par utilisateur (ou IP si anonyme). 300/min : une application
        // web réelle enchaîne légitimement les appels (Chiffres ≈ 10 appels,
        // navigation rapide) — 90 déclenchait des 429 en usage normal au comptoir.
        RateLimiter::for('api', fn (Request $requete) => Limit::perMinute(300)
            ->by($requete->user()?->id ?: $requete->ip()));

        // L'IA est coûteuse (micro-service ML) : 20 appels / minute / utilisateur.
        RateLimiter::for('ia', fn (Request $requete) => Limit::perMinute(20)
            ->by($requete->user()?->id ?: $requete->ip()));

        // Écritures sensibles (POST/PUT/DELETE) : 40 / minute / utilisateur.
        RateLimiter::for('ecritures', fn (Request $requete) => Limit::perMinute(40)
            ->by($requete->user()?->id ?: $requete->ip()));
    }
}
