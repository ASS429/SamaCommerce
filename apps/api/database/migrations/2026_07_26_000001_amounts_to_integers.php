<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * T1 — Unification des montants en ENTIERS (FCFA sans centimes).
 *
 * Les colonnes legacy products.price / products.price_achat / sales.total
 * étaient en decimal(12,2), ce qui produisait des « 300.00 » et des risques
 * d'arrondi. La Phase 6 travaille déjà en entiers ("zéro flottant") ; on aligne
 * le legacy dessus. ROUND() fonctionne aussi bien en SQLite (dev) qu'en Postgres
 * (Supabase prod).
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1) Nettoyer les données existantes (arrondi au franc).
        DB::statement('UPDATE products SET price = ROUND(price), price_achat = ROUND(price_achat)');
        DB::statement('UPDATE sales SET total = ROUND(total)');

        // 2) Changer le type de colonne en entier.
        Schema::table('products', function (Blueprint $table) {
            $table->integer('price')->default(0)->change();
            $table->integer('price_achat')->default(0)->change();
        });
        Schema::table('sales', function (Blueprint $table) {
            $table->integer('total')->default(0)->change();
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('price', 12, 2)->default(0)->change();
            $table->decimal('price_achat', 12, 2)->default(0)->change();
        });
        Schema::table('sales', function (Blueprint $table) {
            $table->decimal('total', 12, 2)->default(0)->change();
        });
    }
};
