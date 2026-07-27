<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('owner_id')->index();   // tenant (propriétaire)
            $table->unsignedBigInteger('actor_id');            // qui a agi (employé ou patron)
            $table->string('actor_name')->nullable();
            $table->unsignedBigInteger('boutique_id')->nullable();
            $table->string('action');                          // ex: vente, produit.suppr, caisse.cloture
            $table->string('detail')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
