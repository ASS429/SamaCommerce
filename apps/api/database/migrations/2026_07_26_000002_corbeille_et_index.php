<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * T3 — Index composites sur les colonnes chaudes (perf des listes/stats).
 * T4 — Corbeille : produits / clients / ventes ne sont plus supprimés
 *      définitivement → corbeille + restauration (filet de sécurité commerçant).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('produits', function (Blueprint $table) {
            if (! Schema::hasColumn('produits', 'supprime_le')) {
                $table->softDeletes('supprime_le');
            }
            $table->index(['utilisateur_id', 'boutique_id'], 'produits_utilisateur_boutique_idx');
        });

        Schema::table('ventes', function (Blueprint $table) {
            if (! Schema::hasColumn('ventes', 'supprime_le')) {
                $table->softDeletes('supprime_le');
            }
            $table->index(['utilisateur_id', 'cree_le'], 'ventes_utilisateur_cree_idx');
        });

        Schema::table('clients', function (Blueprint $table) {
            if (! Schema::hasColumn('clients', 'supprime_le')) {
                $table->softDeletes('supprime_le');
            }
        });
    }

    public function down(): void
    {
        Schema::table('produits', function (Blueprint $table) {
            $table->dropIndex('produits_utilisateur_boutique_idx');
            $table->dropSoftDeletes('supprime_le');
        });
        Schema::table('ventes', function (Blueprint $table) {
            $table->dropIndex('ventes_utilisateur_cree_idx');
            $table->dropSoftDeletes('supprime_le');
        });
        Schema::table('clients', function (Blueprint $table) {
            $table->dropSoftDeletes('supprime_le');
        });
    }
};
