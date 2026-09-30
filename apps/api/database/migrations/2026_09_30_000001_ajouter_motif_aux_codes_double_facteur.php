<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sépare les codes du double facteur selon leur usage : « connexion » (second
 * temps de la connexion) et « activation » (preuve que l'e-mail arrive bien,
 * AVANT d'activer l'option). Un code reçu pour activer l'option ne doit jamais
 * ouvrir une session.
 *
 * Les codes existants étaient tous des codes de connexion : la valeur par
 * défaut les classe correctement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('codes_double_facteur', function (Blueprint $table) {
            $table->string('motif')->default('connexion');
        });
    }

    public function down(): void
    {
        Schema::table('codes_double_facteur', fn (Blueprint $table) => $table->dropColumn('motif'));
    }
};
