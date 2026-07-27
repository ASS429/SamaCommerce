<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * T2 — Marque les ventes dont les champs Phase 6 (cogs, quantite_base…) ont été
 * ESTIMÉS a posteriori (données antérieures au fractionnement). Permet de
 * distinguer une marge réelle d'une marge reconstituée dans les analyses.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->boolean('backfilled')->default(false)->after('cogs');
        });
    }

    public function down(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->dropColumn('backfilled');
        });
    }
};
