<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cloisonnement des données par boutique — mise en conformité du schéma.
 *
 * Trois corrections, toutes liées au même défaut : le multi-boutique a été
 * ajouté APRÈS coup, et les données antérieures n'ont jamais été rattachées.
 *
 *  1. `restock_deliveries` n'avait pas de `boutique_id` : une livraison
 *     appartenait à tout le monde.
 *  2. Les lignes créées avant le multi-boutique ont `boutique_id = NULL`.
 *     Tant qu'on les tolérait (`orWhereNull`), elles apparaissaient dans
 *     CHAQUE boutique — c'est une des raisons pour lesquelles changer de
 *     boutique ne changeait rien à l'écran. On les rattache à la boutique
 *     principale de leur propriétaire, à qui elles appartiennent réellement.
 *  3. `caisse_closings` était unique sur (user_id, date) : deux boutiques ne
 *     POUVAIENT PAS clôturer leur caisse le même jour, la seconde écrasait la
 *     première. La clé devient (user_id, boutique_id, date).
 */
return new class extends Migration
{
    /** Tables rattachées à une boutique et portant un user_id. */
    private const TABLES = [
        'products', 'sales', 'clients', 'fournisseurs',
        'restock_orders', 'restock_deliveries', 'returns', 'caisse_closings', 'activity_logs',
    ];

    public function up(): void
    {
        if (Schema::hasTable('restock_deliveries') && ! Schema::hasColumn('restock_deliveries', 'boutique_id')) {
            Schema::table('restock_deliveries', fn (Blueprint $t) => $t->unsignedBigInteger('boutique_id')->nullable()->after('user_id'));
        }

        // Rattachement des données historiques à la boutique principale.
        // `activity_logs` désigne son propriétaire par `owner_id` et non `user_id`.
        $principales = DB::table('boutiques')->where('is_primary', true)->pluck('id', 'owner_id');
        foreach ($principales as $ownerId => $boutiqueId) {
            foreach (self::TABLES as $table) {
                if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'boutique_id')) {
                    continue;
                }
                $colonneProprietaire = Schema::hasColumn($table, 'user_id') ? 'user_id' : 'owner_id';
                DB::table($table)
                    ->where($colonneProprietaire, $ownerId)
                    ->whereNull('boutique_id')
                    ->update(['boutique_id' => $boutiqueId]);
            }
        }

        // Une clôture de caisse par boutique et par jour.
        if (Schema::hasTable('caisse_closings')) {
            try {
                Schema::table('caisse_closings', fn (Blueprint $t) => $t->dropUnique('caisse_closings_user_id_date_unique'));
            } catch (\Throwable $e) {
                // Index déjà absent (base recréée depuis une version récente).
            }
            try {
                Schema::table('caisse_closings', fn (Blueprint $t) => $t->unique(['user_id', 'boutique_id', 'date'], 'caisse_closings_user_boutique_date_unique'));
            } catch (\Throwable $e) {
                // Déjà en place.
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('caisse_closings')) {
            try {
                Schema::table('caisse_closings', fn (Blueprint $t) => $t->dropUnique('caisse_closings_user_boutique_date_unique'));
                Schema::table('caisse_closings', fn (Blueprint $t) => $t->unique(['user_id', 'date']));
            } catch (\Throwable $e) {
                // rien à défaire
            }
        }

        if (Schema::hasTable('restock_deliveries') && Schema::hasColumn('restock_deliveries', 'boutique_id')) {
            Schema::table('restock_deliveries', fn (Blueprint $t) => $t->dropColumn('boutique_id'));
        }
    }
};
