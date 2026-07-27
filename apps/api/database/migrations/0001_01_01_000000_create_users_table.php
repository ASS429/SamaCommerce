<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Schéma fidèle à l'app d'origine (le "username" sert d'identifiant = email).
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('username')->unique();
            $table->string('password');
            $table->string('company_name')->nullable();
            $table->string('phone')->nullable();
            $table->string('role')->default('user');           // user | admin
            $table->string('status')->default('Actif');        // Actif | Bloqué
            $table->string('plan')->default('Free');           // Free | Premium
            $table->string('payment_status')->default('À jour');
            $table->string('payment_method')->nullable();
            $table->date('expiration')->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('upgrade_status')->default('validé'); // validé | en attente | rejeté
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
