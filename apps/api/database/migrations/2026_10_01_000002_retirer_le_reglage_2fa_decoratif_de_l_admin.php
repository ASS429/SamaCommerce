<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Retire le réglage « 2FA » des paramètres d'administration. Il n'a jamais
 * rien protégé : la connexion ne le lisait pas, et il affichait « Activée »
 * à tort. Remplacé le 30/09/2026 par la vraie vérification en deux étapes du
 * compte (`utilisateurs.double_facteur_actif`, codes envoyés à EMAIL_ADMIN).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parametres_admin', fn (Blueprint $table) => $table->dropColumn('double_facteur_actif'));
    }

    public function down(): void
    {
        Schema::table('parametres_admin', fn (Blueprint $table) => $table->boolean('double_facteur_actif')->default(false));
    }
};
