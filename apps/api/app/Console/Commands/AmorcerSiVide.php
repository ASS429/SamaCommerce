<?php

namespace App\Console\Commands;

use App\Models\Utilisateur;
use Illuminate\Console\Command;

/**
 * Amorce la démonstration UNIQUEMENT si la base est vide (aucun utilisateur).
 * Permet de peupler la base au premier démarrage sur Render (offre gratuite =
 * pas d'accès en ligne de commande) sans dupliquer les données aux
 * redéploiements suivants.
 */
class AmorcerSiVide extends Command
{
    protected $signature = 'base:amorcer-si-vide';

    protected $description = 'Lance AmorceurDemo seulement si la base n\'a aucun utilisateur';

    public function handle(): int
    {
        if (Utilisateur::query()->exists()) {
            $this->info('Base déjà peuplée — amorçage ignoré.');

            return self::SUCCESS;
        }

        $this->info('Base vide — création des données de démonstration...');
        $this->call('db:seed', ['--force' => true]);

        return self::SUCCESS;
    }
}
