<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Jetons de connexion (Sanctum) : chaque jeton enregistre la CLASSE de son
 * propriétaire. Depuis la francisation, un alias faisait lire l'ancien nom
 * `App\Models\User` comme `App\Models\Utilisateur`, et les nouveaux jetons
 * l'écrivaient encore, pour que l'ancien code puisse les lire pendant la
 * transition. L'alias est retiré à l'étape 5 (glossaire, section 3) : les
 * jetons existants prennent le nom français, et personne n'est déconnecté.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('personal_access_tokens')
            ->where('tokenable_type', 'App\\Models\\User')
            ->update(['tokenable_type' => 'App\\Models\\Utilisateur']);
    }

    public function down(): void
    {
        DB::table('personal_access_tokens')
            ->where('tokenable_type', 'App\\Models\\Utilisateur')
            ->update(['tokenable_type' => 'App\\Models\\User']);
    }
};
