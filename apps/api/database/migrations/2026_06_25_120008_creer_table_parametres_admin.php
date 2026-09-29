<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parametres_admin', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->string('nom_application')->nullable();
            $table->string('email_contact')->nullable();
            $table->string('fuseau_horaire')->nullable();
            $table->decimal('prix_premium', 12, 2)->nullable();
            $table->integer('delai_grace')->nullable();
            $table->boolean('alertes_actives')->default(true);
            $table->boolean('notifier_nouveaux_abonnes')->default(true);
            $table->boolean('notifier_retards_paiement')->default(true);
            $table->boolean('notifier_rapports')->default(false);
            $table->boolean('sessions_multiples')->default(true);
            $table->boolean('double_facteur_actif')->default(false);
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parametres_admin');
    }
};
