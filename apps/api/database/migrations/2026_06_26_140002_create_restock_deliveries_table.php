<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('restock_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('commande_id')->nullable()->constrained('restock_orders')->nullOnDelete();
            $table->string('tracking_note')->nullable();
            $table->string('status')->default('en_attente'); // en_attente | en_cours | livree
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('restock_deliveries');
    }
};
