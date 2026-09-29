<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('journal_activite', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('proprietaire_id')->index(); // propriétaire des données
            $table->unsignedBigInteger('acteur_id');                // qui a agi (employé ou patron)
            $table->string('nom_acteur')->nullable();
            $table->unsignedBigInteger('boutique_id')->nullable();
            $table->string('action');                               // ex: vente, produit.suppr, caisse.cloture
            $table->string('detail')->nullable();
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('journal_activite');
    }
};
