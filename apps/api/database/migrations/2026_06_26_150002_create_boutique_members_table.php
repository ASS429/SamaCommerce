<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('boutique_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('ref_boutique_id')->nullable(); // boutiques.id
            $table->foreignId('member_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('email');
            $table->string('role')->default('employe'); // employe | gerant
            $table->string('status')->default('pending'); // pending | accepted | rejected
            $table->json('permissions');
            $table->string('invite_token')->nullable()->index();
            $table->timestamp('invite_expires_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
            $table->index(['owner_id', 'email']);
            $table->index('member_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boutique_members');
    }
};
