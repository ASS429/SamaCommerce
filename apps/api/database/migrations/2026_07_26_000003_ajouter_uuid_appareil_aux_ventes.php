<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * T11 — Hors ligne d'abord : chaque vente créée hors ligne reçoit un UUID
 * produit par l'appareil. La synchronisation (POST /ventes/synchroniser) est
 * IDEMPOTENTE grâce à cet identifiant unique : rejouer un lot ne crée jamais
 * de doublon.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ventes', function (Blueprint $table) {
            $table->uuid('uuid_appareil')->nullable()->unique()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('ventes', function (Blueprint $table) {
            $table->dropUnique(['uuid_appareil']);
            $table->dropColumn('uuid_appareil');
        });
    }
};
