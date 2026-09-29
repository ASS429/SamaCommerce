<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

/**
 * Point d'entrée que `php artisan db:seed` appelle par défaut (nom imposé par
 * Laravel) : il délègue au jeu de démonstration.
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Remplit la base de démonstration.
     */
    public function run(): void
    {
        $this->call(AmorceurDemo::class);
    }
}
