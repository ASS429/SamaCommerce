<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * T1 — Unification des montants en ENTIERS (FCFA sans centimes).
 *
 * Les colonnes historiques produits.prix_vente / produits.prix_achat /
 * ventes.total étaient en decimal(12,2), ce qui produisait des « 300.00 » et
 * des risques d'arrondi. La Phase 6 travaille déjà en entiers (« zéro
 * flottant ») ; on aligne l'historique dessus. ROUND() fonctionne aussi bien
 * en SQLite (dev) qu'en Postgres (Supabase prod).
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1) Nettoyer les données existantes (arrondi au franc).
        DB::statement('UPDATE produits SET prix_vente = ROUND(prix_vente), prix_achat = ROUND(prix_achat)');
        DB::statement('UPDATE ventes SET total = ROUND(total)');

        // 2) Changer le type de colonne en entier.
        Schema::table('produits', function (Blueprint $table) {
            $table->integer('prix_vente')->default(0)->change();
            $table->integer('prix_achat')->default(0)->change();
        });
        Schema::table('ventes', function (Blueprint $table) {
            $table->integer('total')->default(0)->change();
        });
    }

    public function down(): void
    {
        Schema::table('produits', function (Blueprint $table) {
            $table->decimal('prix_vente', 12, 2)->default(0)->change();
            $table->decimal('prix_achat', 12, 2)->default(0)->change();
        });
        Schema::table('ventes', function (Blueprint $table) {
            $table->decimal('total', 12, 2)->default(0)->change();
        });
    }
};
