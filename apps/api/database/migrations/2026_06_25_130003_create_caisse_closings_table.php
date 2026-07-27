<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('caisse_closings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('boutique_id')->nullable();
            $table->date('date')->useCurrent();
            $table->decimal('total_especes', 12, 2)->default(0);
            $table->decimal('total_wave', 12, 2)->default(0);
            $table->decimal('total_orange', 12, 2)->default(0);
            $table->decimal('total_credits', 12, 2)->default(0);
            $table->decimal('total_retours', 12, 2)->default(0);
            $table->decimal('total_net', 12, 2)->default(0);
            $table->integer('nb_ventes')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('caisse_closings');
    }
};
