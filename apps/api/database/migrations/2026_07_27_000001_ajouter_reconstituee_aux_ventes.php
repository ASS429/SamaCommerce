<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * T2 — Marque les ventes dont les champs Phase 6 (cout_marchandises,
 * quantite_base…) ont été ESTIMÉS a posteriori (données antérieures au
 * fractionnement). Permet de distinguer une marge réelle d'une marge
 * reconstituée dans les analyses.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ventes', function (Blueprint $table) {
            $table->boolean('reconstituee')->default(false)->after('cout_marchandises');
        });
    }

    public function down(): void
    {
        Schema::table('ventes', function (Blueprint $table) {
            $table->dropColumn('reconstituee');
        });
    }
};
