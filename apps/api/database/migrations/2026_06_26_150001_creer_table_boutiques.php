<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boutiques', function (Blueprint $table) {
            $table->id();
            $table->foreignId('proprietaire_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->string('nom');
            $table->string('telephone')->nullable();
            $table->string('adresse')->nullable();
            $table->string('emoji')->default('🏪');
            $table->boolean('est_principale')->default(false);
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
            $table->index('proprietaire_id');
        });

        // Boutique active de l'utilisateur (contexte courant)
        Schema::table('utilisateurs', function (Blueprint $table) {
            $table->unsignedBigInteger('boutique_active_id')->nullable()->after('nom_commerce');
        });

        // Rattachement à une boutique des données cœur (les autres modules l'ont déjà)
        Schema::table('produits', function (Blueprint $table) {
            $table->unsignedBigInteger('boutique_id')->nullable()->after('utilisateur_id');
        });
        Schema::table('ventes', function (Blueprint $table) {
            $table->unsignedBigInteger('boutique_id')->nullable()->after('utilisateur_id');
        });
    }

    public function down(): void
    {
        Schema::table('ventes', fn (Blueprint $t) => $t->dropColumn('boutique_id'));
        Schema::table('produits', fn (Blueprint $t) => $t->dropColumn('boutique_id'));
        Schema::table('utilisateurs', fn (Blueprint $t) => $t->dropColumn('boutique_active_id'));
        Schema::dropIfExists('boutiques');
    }
};
