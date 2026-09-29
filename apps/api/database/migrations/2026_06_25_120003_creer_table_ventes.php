<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ventes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained()->cascadeOnDelete();
            $table->foreignId('produit_id')->constrained()->cascadeOnDelete();
            $table->integer('quantite');
            $table->decimal('total', 12, 2);
            $table->string('moyen_paiement');            // especes | wave | orange | credit
            $table->string('nom_client')->nullable();
            $table->string('telephone_client')->nullable();
            $table->date('date_echeance')->nullable();
            $table->boolean('paye')->default(true);
            $table->string('moyen_reglement')->nullable();
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ventes');
    }
};
