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
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('emoji')->default('🏪');
            $table->boolean('is_primary')->default(false);
            $table->timestamps();
            $table->index('owner_id');
        });

        // Boutique active de l'utilisateur (contexte courant)
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('current_boutique_id')->nullable()->after('company_name');
        });

        // Tag boutique sur les données cœur (les autres modules l'ont déjà)
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedBigInteger('boutique_id')->nullable()->after('user_id');
        });
        Schema::table('sales', function (Blueprint $table) {
            $table->unsignedBigInteger('boutique_id')->nullable()->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('sales', fn (Blueprint $t) => $t->dropColumn('boutique_id'));
        Schema::table('products', fn (Blueprint $t) => $t->dropColumn('boutique_id'));
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('current_boutique_id'));
        Schema::dropIfExists('boutiques');
    }
};
