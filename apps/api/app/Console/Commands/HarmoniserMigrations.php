<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fait reconnaître les migrations déjà jouées sous leur nouveau nom français.
 *
 * LE DANGER ÉVITÉ. Les fichiers de migration ont été renommés
 * (`create_products_table` → `creer_table_produits`). Laravel reconnaît une
 * migration déjà jouée à son NOM DE FICHIER, inscrit dans la table
 * `migrations`. Sur la base de production, sans cette harmonisation, il les
 * croirait toutes nouvelles et recréerait des tables françaises VIDES à côté
 * des vraies.
 *
 * LE CHOIX. On AJOUTE les nouveaux noms à côté des anciens, sans rien effacer :
 * l'ancien code, s'il devait être redéployé, retrouve encore les siens.
 *
 * Lancée automatiquement avant toute commande `migrate` (cf.
 * FournisseurServicesApplication) ; idempotente. À conserver tant qu'une
 * sauvegarde antérieure au 29/09/2026 peut être restaurée (90 jours).
 */
class HarmoniserMigrations extends Command
{
    protected $signature = 'base:harmoniser-migrations';

    protected $description = 'Inscrit les nouveaux noms (français) des migrations déjà jouées';

    /** Ancien nom de migration => nouveau nom. */
    public const NOMS = [
        '0001_01_01_000000_create_users_table' => '0001_01_01_000000_creer_table_utilisateurs',
        '0001_01_01_000001_create_cache_table' => '0001_01_01_000001_creer_tables_cache',
        '0001_01_01_000002_create_jobs_table' => '0001_01_01_000002_creer_tables_files_attente',
        '2026_06_25_044338_create_personal_access_tokens_table' => '2026_06_25_044338_creer_table_jetons_acces',
        '2026_06_25_120001_create_categories_table' => '2026_06_25_120001_creer_table_categories',
        '2026_06_25_120002_create_products_table' => '2026_06_25_120002_creer_table_produits',
        '2026_06_25_120003_create_sales_table' => '2026_06_25_120003_creer_table_ventes',
        '2026_06_25_120004_create_tontines_table' => '2026_06_25_120004_creer_table_tontines',
        '2026_06_25_120005_create_alerts_table' => '2026_06_25_120005_creer_table_alertes',
        '2026_06_25_120006_create_withdrawals_table' => '2026_06_25_120006_creer_table_retraits',
        '2026_06_25_120007_create_admin_transfers_table' => '2026_06_25_120007_creer_table_transferts_admin',
        '2026_06_25_120008_create_admin_settings_table' => '2026_06_25_120008_creer_table_parametres_admin',
        '2026_06_25_120009_create_twofa_codes_table' => '2026_06_25_120009_creer_table_codes_double_facteur',
        '2026_06_25_130001_create_clients_table' => '2026_06_25_130001_creer_table_clients',
        '2026_06_25_130002_create_fournisseurs_table' => '2026_06_25_130002_creer_table_fournisseurs',
        '2026_06_25_130003_create_caisse_closings_table' => '2026_06_25_130003_creer_table_clotures_caisse',
        '2026_06_25_130004_create_returns_table' => '2026_06_25_130004_creer_table_retours',
        '2026_06_26_140001_create_restock_orders_table' => '2026_06_26_140001_creer_tables_commandes',
        '2026_06_26_140002_create_restock_deliveries_table' => '2026_06_26_140002_creer_table_livraisons',
        '2026_06_26_150001_create_boutiques_table' => '2026_06_26_150001_creer_table_boutiques',
        '2026_06_26_150002_create_boutique_members_table' => '2026_06_26_150002_creer_table_membres_boutique',
        '2026_06_26_160001_add_barcode_to_products' => '2026_06_26_160001_ajouter_code_barres_aux_produits',
        '2026_06_27_000001_create_activity_logs_table' => '2026_06_27_000001_creer_table_journal_activite',
        '2026_06_27_000002_add_twofa_enabled_to_users' => '2026_06_27_000002_ajouter_double_facteur_aux_utilisateurs',
        '2026_06_27_100001_add_fractionnement_to_products' => '2026_06_27_100001_ajouter_fractionnement_aux_produits',
        '2026_06_27_100002_create_product_units_table' => '2026_06_27_100002_creer_table_conditionnements',
        '2026_06_27_100003_add_fractionnement_to_sales' => '2026_06_27_100003_ajouter_fractionnement_aux_ventes',
        '2026_07_26_000001_amounts_to_integers' => '2026_07_26_000001_montants_en_entiers',
        '2026_07_26_000002_soft_deletes_and_indexes' => '2026_07_26_000002_corbeille_et_index',
        '2026_07_26_000003_add_client_uuid_to_sales' => '2026_07_26_000003_ajouter_uuid_appareil_aux_ventes',
        '2026_07_27_000001_add_backfilled_to_sales' => '2026_07_27_000001_ajouter_reconstituee_aux_ventes',
        '2026_07_28_000001_add_photos_to_entities' => '2026_07_28_000001_ajouter_photos_aux_fiches',
        '2026_07_29_000001_add_photo_to_users' => '2026_07_29_000001_ajouter_photo_aux_utilisateurs',
        '2026_07_29_000002_add_preferences_to_users' => '2026_07_29_000002_ajouter_preferences_aux_utilisateurs',
        '2026_07_29_000003_scope_data_per_boutique' => '2026_07_29_000003_cloisonner_les_donnees_par_boutique',
    ];

    public function handle(): int
    {
        $ajoutees = self::harmoniser();
        $this->info($ajoutees === 0
            ? 'Migrations déjà harmonisées (ou base neuve) : rien à faire.'
            : "{$ajoutees} migration(s) reconnue(s) sous leur nom français.");

        return self::SUCCESS;
    }

    /** Renvoie le nombre de noms ajoutés. Sans effet sur une base neuve. */
    public static function harmoniser(): int
    {
        $table = config('database.migrations.table', 'migrations');
        if (! Schema::hasTable($table)) {
            return 0;
        }

        return DB::transaction(function () use ($table) {
            $jouees = DB::table($table)->pluck('batch', 'migration');
            $ajoutees = 0;
            foreach (self::NOMS as $ancien => $nouveau) {
                if ($jouees->has($ancien) && ! $jouees->has($nouveau)) {
                    DB::table($table)->insert(['migration' => $nouveau, 'batch' => $jouees[$ancien]]);
                    $ajoutees++;
                }
            }

            return $ajoutees;
        });
    }
}
