<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Conditionnements de GROS (sac, bidon, carton...). L'unité de détail
        // (kg/L/pièce) est dérivée de products.unite_base + products.price.
        Schema::create('product_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('libelle');                 // ex: "Sac 50 kg", "Carton 24", "Bidon 20 L"
            $table->integer('facteur');                // nb d'unités de base (kg=1000, sac 50kg=50000)
            $table->integer('prix');                   // prix de référence FCFA pour 1 de cette unité
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_units');
    }
};
