<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('retours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vente_id')->constrained()->cascadeOnDelete();
            $table->foreignId('produit_id')->constrained()->cascadeOnDelete();
            $table->foreignId('utilisateur_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('boutique_id')->nullable();
            $table->integer('quantite');
            $table->string('motif')->nullable();
            $table->string('moyen_remboursement')->default('avoir'); // avoir | especes | wave | orange
            $table->decimal('montant_rembourse', 12, 2)->default(0);
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
            $table->index(['utilisateur_id', 'cree_le']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('retours');
    }
};
