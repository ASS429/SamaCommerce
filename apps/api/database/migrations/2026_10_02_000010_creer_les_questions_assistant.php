<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Assistant vocal : une ligne par question posée.
 *
 * Elle sert au quota quotidien (chaque question coûte de l'argent : oreille et
 * voix sont facturées à l'usage) et à suivre la qualité du service : temps de
 * chaque étape, outil utilisé, erreur éventuelle. AUCUN AUDIO n'est conservé,
 * seulement le texte entendu et la réponse.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('questions_assistant', function (Blueprint $table) {
            $table->id();
            // Le commerçant (propriétaire des données), même quand un employé parle.
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->unsignedBigInteger('boutique_id')->nullable();
            // Celui qui a réellement posé la question (l'employé, sinon le commerçant).
            $table->unsignedBigInteger('pose_par')->nullable();
            $table->string('langue', 2);
            $table->string('mode', 8); // voix | texte
            $table->text('transcription')->nullable();
            $table->text('reponse')->nullable();
            $table->string('outils', 160)->nullable();
            $table->string('action', 64)->nullable();
            $table->string('modele', 40)->nullable();
            $table->unsignedInteger('duree_oreille_ms')->nullable();
            $table->unsignedInteger('duree_cerveau_ms')->nullable();
            $table->unsignedInteger('duree_voix_ms')->nullable();
            $table->string('erreur', 255)->nullable();
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
            $table->index(['utilisateur_id', 'cree_le']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('questions_assistant');
    }
};
