<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('livraisons', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained()->cascadeOnDelete();
            $table->foreignId('commande_id')->nullable()->constrained('commandes')->nullOnDelete();
            $table->string('note_suivi')->nullable();
            $table->string('statut')->default('en_attente'); // en_attente | en_cours | livree
            $table->timestamp('livree_le')->nullable();
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
            $table->index(['utilisateur_id', 'cree_le']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('livraisons');
    }
};
