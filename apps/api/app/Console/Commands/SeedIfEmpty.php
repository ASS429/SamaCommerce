<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

/**
 * Seed la démo UNIQUEMENT si la base est vide (aucun utilisateur). Permet de
 * peupler la base au premier démarrage sur Render (free = pas d'accès Shell)
 * sans dupliquer les données aux redéploiements suivants.
 */
class SeedIfEmpty extends Command
{
    protected $signature = 'db:seed-if-empty';

    protected $description = 'Lance DemoSeeder seulement si la base n\'a aucun utilisateur';

    public function handle(): int
    {
        if (User::query()->exists()) {
            $this->info('Base déjà peuplée — seed ignoré.');

            return self::SUCCESS;
        }

        $this->info('Base vide — création des données de démonstration...');
        $this->call('db:seed', ['--force' => true]);

        return self::SUCCESS;
    }
}
