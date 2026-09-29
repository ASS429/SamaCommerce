<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('membres_boutique', function (Blueprint $table) {
            $table->id();
            $table->foreignId('proprietaire_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->unsignedBigInteger('boutique_rattachement_id')->nullable(); // boutiques.id
            $table->foreignId('membre_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->string('email');
            $table->string('role')->default('employe'); // employe | gerant
            $table->string('statut')->default('invitee'); // invitee | acceptee | refusee
            $table->json('permissions');
            $table->string('jeton_invitation')->nullable()->index();
            $table->timestamp('invitation_expire_le')->nullable();
            $table->timestamp('acceptee_le')->nullable();
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
            $table->index(['proprietaire_id', 'email']);
            $table->index('membre_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('membres_boutique');
    }
};
