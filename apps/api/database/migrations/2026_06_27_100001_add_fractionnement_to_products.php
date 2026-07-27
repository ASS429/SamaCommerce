<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->boolean('negociable')->default(false);
        });

        Schema::table('products', function (Blueprint $table) {
            // Unité de base de SUIVI du stock : piece | g | ml (entier, pas de flottant)
            $table->string('unite_base')->default('piece');
            // Plancher de prix (FCFA / unité d'affichage) — null = pas de plancher
            $table->integer('prix_min')->nullable();
            // Négociable ? null = hérite de la catégorie
            $table->boolean('negociable')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('categories', fn (Blueprint $t) => $t->dropColumn('negociable'));
        Schema::table('products', fn (Blueprint $t) => $t->dropColumn(['unite_base', 'prix_min', 'negociable']));
    }
};
