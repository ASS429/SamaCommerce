<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * T3 — Index composites sur les colonnes chaudes (perf des listes/stats).
 * T4 — Soft deletes : produits / clients / ventes ne sont plus supprimés
 *      définitivement → corbeille + restauration (filet de sécurité commerçant).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (! Schema::hasColumn('products', 'deleted_at')) {
                $table->softDeletes();
            }
            $table->index(['user_id', 'boutique_id'], 'products_user_boutique_idx');
        });

        Schema::table('sales', function (Blueprint $table) {
            if (! Schema::hasColumn('sales', 'deleted_at')) {
                $table->softDeletes();
            }
            $table->index(['user_id', 'created_at'], 'sales_user_created_idx');
        });

        Schema::table('clients', function (Blueprint $table) {
            if (! Schema::hasColumn('clients', 'deleted_at')) {
                $table->softDeletes();
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_user_boutique_idx');
            $table->dropSoftDeletes();
        });
        Schema::table('sales', function (Blueprint $table) {
            $table->dropIndex('sales_user_created_idx');
            $table->dropSoftDeletes();
        });
        Schema::table('clients', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
