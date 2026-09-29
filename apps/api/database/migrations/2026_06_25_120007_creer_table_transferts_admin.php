<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transferts_admin', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->string('compte_source');
            $table->string('compte_destination');
            $table->decimal('montant', 12, 2);
            $table->timestamp('cree_le')->nullable();
            $table->timestamp('modifie_le')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transferts_admin');
    }
};
