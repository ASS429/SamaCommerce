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
 *  1. `livraisons` n'avait pas de `boutique_id` : une livraison appartenait à
 *     tout le monde.
 *  2. Les lignes créées avant le multi-boutique ont `boutique_id = NULL`.
 *     Tant qu'on les tolérait (`orWhereNull`), elles apparaissaient dans
 *     CHAQUE boutique — c'est une des raisons pour lesquelles changer de
 *     boutique ne changeait rien à l'écran. On les rattache à la boutique
 *     principale de leur propriétaire, à qui elles appartiennent réellement.
 *  3. `clotures_caisse` était unique sur (utilisateur_id, date) : deux
 *     boutiques ne POUVAIENT PAS clôturer leur caisse le même jour, la seconde
 *     écrasait la première. La clé devient (utilisateur_id, boutique_id, date).
 */
return new class extends Migration
{
    /** Tables rattachées à une boutique et portant un propriétaire. */
    private const TABLES = [
        'produits', 'ventes', 'clients', 'fournisseurs',
        'commandes', 'livraisons', 'retours', 'clotures_caisse', 'journal_activite',
    ];

    public function up(): void
    {
        if (Schema::hasTable('livraisons') && ! Schema::hasColumn('livraisons', 'boutique_id')) {
            Schema::table('livraisons', fn (Blueprint $t) => $t->unsignedBigInteger('boutique_id')->nullable()->after('utilisateur_id'));
        }

        // Rattachement des données historiques à la boutique principale.
        // `journal_activite` désigne son propriétaire par `proprietaire_id` et
        // non `utilisateur_id`.
        $principales = DB::table('boutiques')->where('est_principale', true)->pluck('id', 'proprietaire_id');
        foreach ($principales as $proprietaireId => $boutiqueId) {
            foreach (self::TABLES as $table) {
                if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'boutique_id')) {
                    continue;
                }
                $colonneProprietaire = Schema::hasColumn($table, 'utilisateur_id') ? 'utilisateur_id' : 'proprietaire_id';
                DB::table($table)
                    ->where($colonneProprietaire, $proprietaireId)
                    ->whereNull('boutique_id')
                    ->update(['boutique_id' => $boutiqueId]);
            }
        }

        // Une clôture de caisse par boutique et par jour.
        if (Schema::hasTable('clotures_caisse')) {
            try {
                Schema::table('clotures_caisse', fn (Blueprint $t) => $t->dropUnique('clotures_caisse_utilisateur_id_date_unique'));
            } catch (\Throwable $e) {
                // Index déjà absent (base recréée depuis une version récente).
            }
            try {
                Schema::table('clotures_caisse', fn (Blueprint $t) => $t->unique(['utilisateur_id', 'boutique_id', 'date'], 'clotures_caisse_utilisateur_boutique_date_unique'));
            } catch (\Throwable $e) {
                // Déjà en place.
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('clotures_caisse')) {
            try {
                Schema::table('clotures_caisse', fn (Blueprint $t) => $t->dropUnique('clotures_caisse_utilisateur_boutique_date_unique'));
                Schema::table('clotures_caisse', fn (Blueprint $t) => $t->unique(['utilisateur_id', 'date']));
            } catch (\Throwable $e) {
                // rien à défaire
            }
        }

        if (Schema::hasTable('livraisons') && Schema::hasColumn('livraisons', 'boutique_id')) {
            Schema::table('livraisons', fn (Blueprint $t) => $t->dropColumn('boutique_id'));
        }
    }
};
