<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales', function (Blueprint $table) {
            $table->integer('quantite_base')->nullable();   // quantité vendue en unités de base (g/ml/pièce)
            $table->unsignedBigInteger('unit_id')->nullable(); // product_unit choisie (null = détail)
            $table->string('unit_libelle')->nullable();     // libellé figé au moment de la vente
            $table->integer('prix_reference')->nullable();  // prix catalogue (FCFA / unité d'affichage)
            $table->integer('prix_reel')->nullable();       // prix négocié (FCFA / unité d'affichage)
            $table->integer('remise')->default(0);          // remise totale FCFA (référence - réel)
            $table->integer('cogs')->nullable();            // coût des marchandises vendues (FCFA)
            $table->unsignedBigInteger('vendu_par')->nullable(); // qui a réellement vendu (employé/patron)
            $table->string('vendu_par_nom')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sales', fn (Blueprint $t) => $t->dropColumn([
            'quantite_base', 'unit_id', 'unit_libelle', 'prix_reference', 'prix_reel', 'remise', 'cogs', 'vendu_par', 'vendu_par_nom',
        ]));
    }
};
